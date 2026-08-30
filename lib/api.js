/**
 * CMS ↔ backend API client.
 *
 * One module that knows the API's shape, so pages never build URLs or unwrap
 * envelopes. Backend conventions:
 *
 *   success → { data, meta? }
 *   failure → { error: { code, message, fields? } }
 *
 * `ApiError` carries the machine-readable `code` and per-field messages, so forms
 * render inline errors (§17.3) without parsing prose.
 *
 * ── AUTH MODEL ──────────────────────────────────────────────────────────────
 * The access token lives in MEMORY only, never localStorage — an XSS in the CMS
 * must not be able to exfiltrate a staff token. The refresh token is an httpOnly
 * cookie the browser attaches automatically, so a page reload restores the session
 * by calling /auth/refresh rather than by reading a stored token.
 *
 * A 401 triggers one automatic refresh-and-retry; if that fails the session is
 * cleared and the shell redirects to /login.
 */

/**
 * Where the API lives, resolved once.
 *
 * Order of precedence:
 *   1. NEXT_PUBLIC_API_URL — an explicit override always wins, so a preview
 *      deploy or a laptop pointed at staging needs no code change.
 *   2. NODE_ENV — development falls back to the local backend, anything else
 *      (production builds, `next start`) falls back to the hosted API.
 *
 * The environment-aware fallback matters: a bare localhost default would let a
 * production build ship silently pointing at a machine that is not there, and
 * the failure only shows up in the browser as a connection refused.
 *
 * Kept identical to the storefront's copy in Frontend/lib/api.js — the two apps
 * must never disagree about which backend they are talking to.
 */
const HOSTED_API = "https://zewa-api.onrender.com/api/v1";
const LOCAL_API = "http://localhost:4000/api/v1";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? LOCAL_API : HOSTED_API)
).replace(/\/$/, "");

const ADMIN = `${API_BASE}/admin`;

export class ApiError extends Error {
  constructor(message, { code, status, fields, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code ?? "UNKNOWN";
    this.status = status ?? 0;
    /** { fieldName: message } — drives §17.3 inline form errors. */
    this.fields = fields ?? null;
    this.details = details ?? null;
  }
}

// ---- Session store ----------------------------------------------------------

/**
 * ── SINGLE SOURCE OF TRUTH ──────────────────────────────────────────────────
 * One record, in ONE place, holding everything about the session:
 *
 *   { refreshToken, accessToken, accessExpiresAt, remember }
 *
 * It lives in localStorage when "Remember me for 7 days" was ticked and in
 * sessionStorage when it was not — that choice IS the difference between the two
 * modes on the client, and it is the only thing that differs.
 *
 * Everything else derives from this record and is allowed to disagree only by
 * being stale: the in-memory copy is a cache of it, the `zewa_cms_session` cookie
 * is a presence hint for middleware, and React state is a render of it. There is
 * no longer a state in which localStorage says one thing and a cookie says
 * another, because nothing else is ever consulted to answer "am I signed in".
 *
 * The refresh token sits in web storage rather than in an httpOnly cookie
 * because in production the CMS and the API are on different registrable domains
 * (`cms.zewafeeds.com` vs `zewa-api.onrender.com`), which makes the API's cookie
 * third-party — blocked outright by Safari and by Chrome in Incognito. The cookie
 * is still set and still used when the browser allows it; it just cannot be
 * relied on. Moving the API to `api.zewafeeds.com` would make it first-party and
 * let the token go back to being unreadable by JavaScript.
 */
const STORE_KEY = "zewa_cms_session_v2";

/** Legacy keys from the previous scheme, cleared on sight so they cannot vote. */
const LEGACY_KEYS = ["zewa_cms_rt", "zewa_cms_remember"];

/** In-memory cache of the stored record. Never the authority. */
let cached = null;
let onSessionLost = null;

function readStore() {
  if (typeof window === "undefined") return null;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = store.getItem(STORE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.refreshToken) return parsed;
    } catch {
      /* unparseable or unavailable — treat as absent */
    }
  }
  return adoptLegacyRecord();
}

/**
 * Carry a session forward from the previous storage scheme.
 *
 * Without this, shipping the new key would sign out everyone holding a valid
 * 7-day session at the moment of deploy — the exact failure this whole change
 * exists to stop, delivered once more on the way out. The old token is still a
 * real token the API will honour, so it is adopted rather than discarded.
 */
function adoptLegacyRecord() {
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      const token = store.getItem("zewa_cms_rt");
      if (!token) continue;
      const record = {
        refreshToken: token,
        accessToken: null,
        // Unknown, so treat it as spent and let the first refresh settle it.
        accessExpiresAt: 0,
        remember: store === window.localStorage,
      };
      writeStore(record);
      return record;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function writeStore(record) {
  if (typeof window === "undefined") return;
  try {
    const target = record.remember ? window.localStorage : window.sessionStorage;
    const other = record.remember ? window.sessionStorage : window.localStorage;
    other.removeItem(STORE_KEY);
    target.setItem(STORE_KEY, JSON.stringify(record));
    for (const k of LEGACY_KEYS) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch {
    /* quota or blocked storage — the in-memory copy still carries the tab */
  }
  cached = record;
}

function clearStore() {
  if (typeof window === "undefined") return;
  try {
    for (const k of [STORE_KEY, ...LEGACY_KEYS]) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
  cached = null;
}

/** The current record, preferring storage so a sibling tab's rotation is seen. */
function currentRecord() {
  const stored = readStore();
  if (stored) {
    cached = stored;
    return stored;
  }
  return cached;
}

/** Milliseconds of life left in the stored access token. */
function accessTokenRemainingMs(record) {
  if (!record?.accessExpiresAt) return 0;
  return record.accessExpiresAt - Date.now();
}

/**
 * Presence marker for middleware.js.
 *
 * Holds no secret — it exists only so an unauthenticated visitor is redirected
 * to /login instead of being served an admin shell that would bounce them.
 */
const SESSION_MARKER = "zewa_cms_session";
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function setSessionMarker(remember) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  // A remembered session gets a dated cookie so it survives browser restart; a
  // non-remembered one stays a session cookie, which is exactly the intent.
  const age = remember
    ? `; Max-Age=${SEVEN_DAYS_SECONDS}; Expires=${new Date(
        Date.now() + SEVEN_DAYS_SECONDS * 1000,
      ).toUTCString()}`
    : "";
  document.cookie = `${SESSION_MARKER}=1; Path=/; SameSite=Lax${age}${secure}`;
}

function clearSessionMarker() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_MARKER}=; Path=/; Max-Age=0; SameSite=Lax`;
}

// ---- Cross-tab notification -------------------------------------------------

/**
 * BroadcastChannel, not the `storage` event.
 *
 * `storage` fires only in OTHER tabs and only for localStorage, so it says
 * nothing during a non-remembered session and nothing to the tab that acted. A
 * channel gives every tab the same two facts explicitly: a session was renewed,
 * or a session genuinely ended.
 */
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("zewa_cms_auth") : null;

const sessionRenewedHandlers = new Set();

if (channel) {
  channel.onmessage = (event) => {
    const msg = event.data;
    if (msg?.type === "renewed") {
      // Another tab rotated. Adopt its result; do not refresh again.
      cached = readStore();
      for (const fn of sessionRenewedHandlers) fn(cached);
    } else if (msg?.type === "ended") {
      cached = null;
      clearSessionMarker();
      onSessionLost?.();
    }
  };
}

export const session = {
  get token() {
    return currentRecord()?.accessToken ?? null;
  },

  /** Persist a freshly-issued session. `remember` is sticky once chosen. */
  set(accessToken, remember, refreshToken, expiresInSeconds) {
    const previous = currentRecord();
    const isRemembered = remember ?? previous?.remember ?? false;
    const record = {
      accessToken,
      refreshToken: refreshToken ?? previous?.refreshToken ?? null,
      // Trimmed by a minute so a token is never presented in its last moments.
      accessExpiresAt: Date.now() + ((expiresInSeconds ?? 900) - 60) * 1000,
      remember: isRemembered,
    };
    writeStore(record);
    setSessionMarker(isRemembered);
    channel?.postMessage({ type: "renewed" });
    return record;
  },

  /**
   * End the session everywhere.
   *
   * Only ever called when the SERVER has said the refresh credential is dead, or
   * when the user signs out. A failed network request must not reach this — that
   * was how one offline tab used to sign every other tab out.
   */
  clear({ broadcast = true } = {}) {
    clearStore();
    clearSessionMarker();
    if (broadcast) channel?.postMessage({ type: "ended" });
  },

  /**
   * Re-assert the middleware marker from the stored record.
   *
   * Needed because a session can be CONFIRMED without being re-issued — the
   * adopt path below verifies an existing token rather than rotating it, so
   * session.set() never runs and nothing rewrites the cookie. If the marker had
   * been lost meanwhile (cleared, expired, or never set), middleware kept
   * bouncing the user to /login while the login page, correctly seeing a valid
   * session, sent them straight back: a redirect loop on a working account.
   */
  touch() {
    const record = currentRecord();
    if (record?.refreshToken) setSessionMarker(record.remember);
  },

  /** Is there a credential worth attempting a restore with? */
  get exists() {
    return Boolean(currentRecord()?.refreshToken) || hasSessionMarker();
  },

  onLost(handler) {
    onSessionLost = handler;
  },

  onRenewed(handler) {
    sessionRenewedHandlers.add(handler);
    return () => sessionRenewedHandlers.delete(handler);
  },
};

function hasSessionMarker() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_MARKER}=`));
}

// ---- Refresh ----------------------------------------------------------------

/**
 * Outcomes, kept distinct on purpose.
 *
 * Collapsing "could not reach the server" into "session invalid" is the single
 * mistake that made this app log people out. A thrown fetch — offline, DNS,
 * a cold Render dyno, a blocked CORS preflight — says nothing whatsoever about
 * whether the 7-day session is still good, and must never end it.
 */
export const REFRESH_OK = "ok";
export const REFRESH_INVALID = "invalid";
export const REFRESH_UNREACHABLE = "unreachable";

/**
 * Refresh in flight IN THIS TAB — concurrent 401s share one call.
 *
 * Tracked WITH its `force` flag, because the two kinds must not share.
 * A forced refresh (something got a 401, so the access token is definitively
 * rejected) that piggybacked on an in-flight unforced one could be answered by
 * the adopt branch — "your stored token still has time left" — which is exactly
 * the token the server just refused. The request would then replay with the same
 * dead token, fail again, and be reported as an expired session.
 */
let inFlight = null;

async function postRefresh(refreshToken) {
  const response = await fetch(`${ADMIN}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The token travels in the BODY. It was previously also sent as an
    // `X-Refresh-Token` header, which the API's CORS allowlist did not include —
    // so the browser failed the preflight and the request was never sent at all.
    // The body needs no preflight allowance beyond Content-Type, which is
    // already allowed, so there is nothing here to drift out of sync again.
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    // Also send the httpOnly cookie, for browsers that still accept it
    // cross-site. Same credential, second carrier — not a second mechanism.
    credentials: "include",
  });

  if (response.ok) {
    const { data } = await response.json();
    return { status: REFRESH_OK, data };
  }

  // ONLY an explicit rejection of the credential ends the session. A 5xx is the
  // server having a bad day — Render cold starts routinely 502 — and a 429 is
  // rate limiting. Neither means the user signed out.
  if (response.status === 401 || response.status === 403) {
    return { status: REFRESH_INVALID };
  }
  return { status: REFRESH_UNREACHABLE };
}

/**
 * Refresh, serialized across every tab in this browser.
 *
 * Web Locks make one tab the writer and park the rest. When a parked tab finally
 * enters, the winner has already stored a fresh token, so it adopts that and
 * makes no request at all. Three tabs waking together therefore produce ONE
 * rotation, not three — which is what stopped them from revoking each other.
 *
 * Where the API is unavailable (older browsers, non-secure contexts) this falls
 * back to a per-tab promise. The server's token chain covers that case.
 */
async function refreshSession({ force = false } = {}) {
  // Join the in-flight call only when it is at least as strong as this request.
  if (inFlight && !(force && !inFlight.forced)) return inFlight.promise;

  const entry = { forced: force };
  entry.promise = (async () => {
    try {
      const run = () => refreshUnderLock({ force });
      // Web Locks serialise across TABS; `inFlight` serialises within one tab.
      if (typeof navigator !== "undefined" && navigator.locks?.request) {
        return await navigator.locks.request("zewa_cms_refresh", run);
      }
      return await run();
    } finally {
      if (inFlight === entry) inFlight = null;
    }
  })();
  inFlight = entry;
  return entry.promise;
}

async function refreshUnderLock({ force }) {
  // Re-read INSIDE the lock: a tab that queued behind another is very likely
  // holding a token that has already been rotated and stored for it.
  const record = currentRecord();

  if (!force && record?.accessToken && accessTokenRemainingMs(record) > 0) {
    // The marker is re-asserted here, not only on rotation: this branch is the
    // common one on page load, and it is the branch that used to leave
    // middleware with nothing to see.
    session.touch();
    return { status: REFRESH_OK, data: null, adopted: true };
  }
  if (!record?.refreshToken && !hasSessionMarker()) {
    return { status: REFRESH_INVALID };
  }

  let result;
  try {
    result = await postRefresh(record?.refreshToken);
  } catch {
    // Network-level failure. Keep the session; the caller decides how to surface it.
    return { status: REFRESH_UNREACHABLE };
  }

  if (result.status === REFRESH_OK) {
    const { data } = result;
    session.set(
      data.accessToken,
      data.isRemembered ?? record?.remember ?? false,
      data.refreshToken,
      data.expiresIn,
    );
    return { status: REFRESH_OK, data };
  }

  if (result.status === REFRESH_INVALID) {
    session.clear();
  }
  return result;
}


/**
 * Core request wrapper.
 *
 * `retryOn401` is false on the replay, so a persistently-expired session cannot
 * loop.
 */
async function request(
  path,
  { method = "GET", body, headers = {}, raw = false, retryOn401 = true } = {},
) {
  const finalHeaders = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }

  /*
   * Refresh BEFORE the request when the stored access token is spent, rather
   * than firing a request we know will 401 and repairing it afterwards. This is
   * what makes returning to a tab left open overnight uneventful: the first
   * action after waking renews quietly instead of surfacing an auth failure.
   */
  if (!path.startsWith("/auth/") && session.exists) {
    const record = currentRecord();
    if (record?.refreshToken && accessTokenRemainingMs(record) <= 0) {
      const pre = await refreshSession();
      if (pre.status === REFRESH_INVALID) {
        onSessionLost?.();
        throw new ApiError("Your session has expired. Please sign in again.", {
          code: "TOKEN_EXPIRED",
          status: 401,
        });
      }
    }
  }

  const token = session.token;
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${ADMIN}${path}`, {
      method,
      headers: finalHeaders,
      credentials: "include",
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the API is running.", {
      code: "NETWORK_ERROR",
    });
  }

  /*
   * A 401 here means THIS ACCESS TOKEN is spent. It does not mean the 7-day
   * session is over, and the two must not be conflated — that conflation is
   * what put people back on /login for the crime of leaving a tab open.
   *
   * So: refresh, and branch on WHY it failed.
   *   ok          → replay the request, user notices nothing
   *   unreachable → a network error, and the session is left completely alone
   *   invalid     → the server rejected the refresh token itself; only now is
   *                 the session actually over
   */
  if (response.status === 401 && retryOn401 && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession({ force: true });

    if (refreshed.status === REFRESH_OK) {
      return request(path, { method, body, headers, raw, retryOn401: false });
    }

    if (refreshed.status === REFRESH_UNREACHABLE) {
      throw new ApiError("Cannot reach the server. Check your connection and try again.", {
        code: "NETWORK_ERROR",
        status: 0,
      });
    }

    // refreshSession() already cleared the store on an INVALID result.
    onSessionLost?.();
    throw new ApiError("Your session has expired. Please sign in again.", {
      code: "TOKEN_EXPIRED",
      status: 401,
    });
  }

  // Binary responses (invoice PDF, CSV export).
  if (raw) {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(payload.error?.message ?? "Download failed.", {
        code: payload.error?.code,
        status: response.status,
      });
    }
    return response.blob();
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = payload.error ?? {};
    throw new ApiError(error.message ?? "Something went wrong.", {
      code: error.code,
      status: response.status,
      fields: error.fields,
      details: error.details,
    });
  }

  return payload;
}

/** Query string builder. Drops empties and the UI's "All" sentinel. */
function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "All") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ============================================================================
// AUTH (§14)
// ============================================================================

export const auth = {
  /** Step 1 — password. Returns a challenge token, never a session. */
  async login(email, password, remember = false) {
    const { data } = await request("/auth/login", {
      method: "POST",
      body: { email, password, remember },
    });
    return data; // { challengeToken, twofaEnrolled, twofaMethod }
  },

  /** Step 2 — TOTP or a single-use backup code. Opens the session. */
  async verifyTwofa(challengeToken, code, remember = false) {
    const { data } = await request("/auth/2fa/verify", {
      method: "POST",
      body: { challengeToken, code, remember },
    });
    session.set(data.accessToken, remember, data.refreshToken, data.expiresIn);
    return data;
  },

  /** Forced first-login enrolment (§14.3) — returns a secret + otpauth URL. */
  async startTwofaSetup(challengeToken) {
    const { data } = await request("/auth/2fa/setup", {
      method: "POST",
      body: { challengeToken },
    });
    return data;
  },

  /** Confirm enrolment; returns the session plus one-time backup codes. */
  async completeTwofaSetup(challengeToken, code, remember = false) {
    const { data } = await request("/auth/2fa/enroll", {
      method: "POST",
      body: { challengeToken, code, remember },
    });
    session.set(data.accessToken, remember, data.refreshToken, data.expiresIn);
    return data;
  },

  /** Resend Email OTP verification code. */
  async resendOtp(challengeToken) {
    const { data } = await request("/auth/otp/resend", {
      method: "POST",
      body: { challengeToken },
    });
    return data; // { ok, maskedEmail, cooldownSeconds }
  },

  /** Start in-profile Authenticator (TOTP) setup. */
  async setupTotp() {
    const { data } = await request("/auth/totp/setup", {
      method: "POST",
    });
    return data; // { secret, otpauthUrl }
  },

  /** Confirm in-profile Authenticator (TOTP) setup. */
  async confirmTotp(code) {
    const { data } = await request("/auth/totp/enroll", {
      method: "POST",
      body: { code },
    });
    return data; // { ok, backupCodes }
  },

  /**
   * Restore a session on page load.
   *
   * Returns the OUTCOME, not a truthy/falsy blob, because the caller has to be
   * able to tell "your session is over" apart from "I could not ask". Returning
   * null for both is what turned every blocked request into a sign-out.
   *
   *   { status: 'ok', data }     → signed in
   *   { status: 'invalid' }      → genuinely signed out; store already cleared
   *   { status: 'unreachable' }  → unknown; the session is untouched
   */
  async restore() {
    /*
     * NOT forced. A page load whose stored access token still has life left
     * should adopt it, not spend a rotation proving it — which is what lets
     * three tabs reloading together produce ONE refresh between them instead of
     * three, with the two late arrivals reading what the winner stored.
     */
    const result = await refreshSession();
    if (result.status === REFRESH_OK && !result.data) {
      // Adopted a token a sibling tab had just stored; fetch the profile that
      // a refresh response would otherwise have carried.
      try {
        const user = await auth.me();
        session.touch();
        return { status: REFRESH_OK, data: { user } };
      } catch {
        // The adopted token was rejected after all — fall back to a real refresh.
        return await refreshSession({ force: true });
      }
    }
    return result;
  },

  async me() {
    const { data } = await request("/auth/me");
    return data.user;
  },

  async logout() {
    const record = currentRecord();
    try {
      await request("/auth/logout", {
        method: "POST",
        body: record?.refreshToken ? { refreshToken: record.refreshToken } : {},
      });
    } finally {
      // Deliberate: this is the one place a local clear is correct regardless of
      // what the server said, because the user asked to sign out.
      session.clear();
    }
  },

  async changePassword(currentPassword, newPassword) {
    const { data } = await request("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
    session.set(data.accessToken, data.isRemembered, data.refreshToken, data.expiresIn);
    return data;
  },

  async passwordPolicy() {
    const { data } = await request("/auth/password-policy");
    return data.rules;
  },

  async regenerateBackupCodes() {
    const { data } = await request("/auth/2fa/backup-codes", { method: "POST" });
    return data.backupCodes;
  },

  async sessions() {
    const { data } = await request("/auth/sessions");
    return data;
  },

  async revokeSession(id) {
    await request(`/auth/sessions/${id}`, { method: "DELETE" });
  },

  async invitationDetails(token) {
    const { data } = await request(`/auth/invitation-details?token=${encodeURIComponent(token)}`);
    return data;
  },

  async acceptInvitation(body) {
    const { data } = await request("/auth/accept-invitation", {
      method: "POST",
      body,
    });
    return data;
  },
};

// ============================================================================
// DASHBOARD (§4) + GLOBAL SEARCH (§3.1)
// ============================================================================

export const dashboard = {
  async load() {
    const { data } = await request("/dashboard");
    return data; // { counters, activity }
  },
};

export const search = {
  async global(q) {
    const { data } = await request(`/search${qs({ q })}`);
    return data;
  },
};

// ============================================================================
// PRODUCTS (§5)
// ============================================================================

export const products = {
  /** Returns { data, meta } — the list is paginated. */
  async list(params = {}) {
    return request(`/products${qs(params)}`);
  },

  async get(slug) {
    const { data } = await request(`/products/${slug}`);
    return data;
  },

  async create(body) {
    const { data } = await request("/products", { method: "POST", body });
    return data;
  },

  /** Writes a draft overlay when the product is already live (§5.2). */
  async save(slug, body) {
    const { data } = await request(`/products/${slug}`, { method: "PATCH", body });
    return data;
  },

  /**
   * Resolved galleries for the media manager.
   *
   * POSTs the gallery as it currently stands in the editor — unsaved edits and
   * all — and gets back what a customer would see for each pack. The rules live
   * on the server, so the CMS preview and the storefront can never disagree.
   */
  async mediaPreview(slug, body) {
    const { data } = await request(`/products/${slug}/media-preview`, { method: "POST", body });
    return data;
  },

  /** What removing one asset would do, computed from the staged gallery. */
  async mediaImpact(slug, body) {
    const { data } = await request(`/products/${slug}/media-impact`, { method: "POST", body });
    return data;
  },

  async publish(slug) {
    const { data } = await request(`/products/${slug}/publish`, { method: "POST" });
    return data;
  },

  async discardDraft(slug) {
    await request(`/products/${slug}/discard-draft`, { method: "POST" });
  },

  async setStatus(slug, status) {
    const { data } = await request(`/products/${slug}/status`, {
      method: "PATCH",
      body: { status },
    });
    return data;
  },

  /** §5.3 stock quick-update — every SKU in the family in one call. */
  async updateStock(slug, updates) {
    const { data } = await request(`/products/${slug}/stock`, {
      method: "PATCH",
      body: { updates },
    });
    return data;
  },

  /**
   * The catalogue in merchandising order.
   *
   * PRODUCT order — the sequence products appear in on the storefront. Not the
   * pack order inside a product, and not gallery order.
   *
   * Separate from list() because that one is paginated, filtered and sorted by
   * last-edited: useful for finding a product, useless for sequencing one.
   */
  async displayOrder() {
    const { data } = await request("/products/order");
    return data;
  },

  /** Takes the full ordered slug list, so the operation is idempotent. */
  async reorder(order) {
    const { data } = await request("/products/order", { method: "PUT", body: { order } });
    return data;
  },

  async previewToken(slug) {
    const { data } = await request(`/products/${slug}/preview-token`, { method: "POST" });
    return data;
  },

  /** Admin only; the typed name is re-checked server-side (§17.1). */
  async remove(slug, confirmName) {
    await request(`/products/${slug}`, { method: "DELETE", body: { confirmName } });
  },
};

// ============================================================================
// ORDERS (§6)
// ============================================================================

export const orders = {
  async list(params = {}) {
    return request(`/orders${qs(params)}`);
  },

  async get(orderNo) {
    const { data } = await request(`/orders/${orderNo}`);
    return data;
  },

  /** One endpoint for every lifecycle move; the server owns the state machine. */
  async transition(orderNo, { to, fields = {}, internalNote, notifyCustomer = true }) {
    const { data } = await request(`/orders/${orderNo}/transition`, {
      method: "POST",
      body: { to, fields, internalNote, notifyCustomer },
    });
    return data;
  },

  /** Admin only (§6.4). `amount` is in rupees. */
  async refund(orderNo, amount, reason) {
    const { data } = await request(`/orders/${orderNo}/refund`, {
      method: "POST",
      body: { amount, reason },
    });
    return data;
  },

  async updateNote(orderNo, internalNote) {
    const { data } = await request(`/orders/${orderNo}/note`, {
      method: "PATCH",
      body: { internalNote },
    });
    return data;
  },

  /** Invoice PDF (§6.5) — triggers a browser download. */
  async downloadInvoice(orderNo, filename) {
    const blob = await request(`/orders/${orderNo}/invoice`, { raw: true });
    downloadBlob(blob, filename || `invoice-${orderNo}.pdf`);
  },

  /** CSV export (§6.1) — Admin only. */
  async exportCsv(params = {}) {
    const blob = await request(`/orders/export.csv${qs(params)}`, { raw: true });
    downloadBlob(blob, `zewa-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  },

  /** Reconcile payment with Razorpay. */
  async reconcilePayment(orderNo, paymentId) {
    const result = await request(`/orders/${orderNo}/reconcile-payment`, {
      method: "POST",
      body: { paymentId },
    });
    return result;
  },
};

// ============================================================================
// CUSTOMERS (§7)
// ============================================================================

export const customers = {
  async list(params = {}) {
    return request(`/customers${qs(params)}`);
  },
  async get(id) {
    const { data } = await request(`/customers/${id}`);
    return data;
  },
  /** Admin only (§7.2). */
  async setStatus(id, status) {
    const { data } = await request(`/customers/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
    return data;
  },
};

// ============================================================================
// REVIEWS (§9)
// ============================================================================

export const reviews = {
  /** `meta.counts` drives the Pending/Approved/Rejected tab badges. */
  async list(params = {}) {
    return request(`/reviews${qs(params)}`);
  },
  async setState(id, state) {
    const { data } = await request(`/reviews/${id}/state`, {
      method: "PATCH",
      body: { state },
    });
    return data;
  },
  async bulkApprove() {
    const { data } = await request("/reviews/bulk-approve", { method: "POST" });
    return data;
  },
};

// ============================================================================
// COUPONS (§10)
// ============================================================================

export const coupons = {
  async list(params = {}) {
    return request(`/coupons${qs(params)}`);
  },
  async get(id) {
    const { data } = await request(`/coupons/${id}`);
    return data;
  },
  async create(body) {
    const { data } = await request("/coupons", { method: "POST", body });
    return data;
  },
  async update(id, body) {
    const { data } = await request(`/coupons/${id}`, { method: "PATCH", body });
    return data;
  },
  /** Admin only. */
  async remove(id) {
    await request(`/coupons/${id}`, { method: "DELETE" });
  },
  /** Which orders used this coupon and what they were worth. */
  async redemptions(id, params = {}) {
    return request(`/coupons/${id}/redemptions${qs(params)}`);
  },
  /** Redemption totals, unique customers and remaining usage. */
  async analytics(id) {
    const { data } = await request(`/coupons/${id}/analytics`);
    return data;
  },
  /**
   * Dry-run a promotion against a hypothetical cart.
   *
   * Read-only: the endpoint prices but never writes, so a preview never consumes
   * usage or creates a redemption.
   */
  async preview(body) {
    const { data } = await request("/coupons/preview", { method: "POST", body });
    return data;
  },
};

// ============================================================================
// CONTENT (§8)
// ============================================================================

export const content = {
  articles: {
    async list(params = {}) {
      return request(`/content/articles${qs(params)}`);
    },
    async get(slug) {
      const { data } = await request(`/content/articles/${slug}`);
      return data;
    },
    async create(body) {
      const { data } = await request("/content/articles", { method: "POST", body });
      return data;
    },
    async save(slug, body) {
      const { data } = await request(`/content/articles/${slug}`, { method: "PATCH", body });
      return data;
    },
    /** Needs `articles.publish` — Editors are excluded (§2.1). */
    async publish(slug) {
      const { data } = await request(`/content/articles/${slug}/publish`, { method: "POST" });
      return data;
    },
    async setStatus(slug, status) {
      const { data } = await request(`/content/articles/${slug}/status`, {
        method: "PATCH",
        body: { status },
      });
      return data;
    },
    async discardDraft(slug) {
      await request(`/content/articles/${slug}/discard-draft`, { method: "POST" });
    },
    async previewToken(slug) {
      const { data } = await request(`/content/articles/${slug}/preview-token`, {
        method: "POST",
      });
      return data;
    },
    /** Admin only (§2.1). */
    async remove(slug) {
      await request(`/content/articles/${slug}`, { method: "DELETE" });
    },
  },

  spotlights: {
    async list() {
      const { data } = await request("/content/spotlights");
      return data;
    },
    async create(body) {
      const { data } = await request("/content/spotlights", { method: "POST", body });
      return data;
    },
    async update(id, body) {
      const { data } = await request(`/content/spotlights/${id}`, { method: "PATCH", body });
      return data;
    },
    async toggle(id) {
      const { data } = await request(`/content/spotlights/${id}/toggle`, { method: "PATCH" });
      return data;
    },
    /** Takes the full ordered id list, so the operation is idempotent. */
    async reorder(order) {
      const { data } = await request("/content/spotlights/reorder", {
        method: "PUT",
        body: { order },
      });
      return data;
    },
    async remove(id) {
      await request(`/content/spotlights/${id}`, { method: "DELETE" });
    },
  },

  homepage: {
    /** Defaults to the DRAFT row — that is what the editor loads (§8.3). */
    async get(version = "DRAFT") {
      const { data } = await request(`/content/homepage${qs({ version })}`);
      return data;
    },
    async saveDraft(sections) {
      const { data } = await request("/content/homepage", { method: "PUT", body: sections });
      return data;
    },
    /** Pushes every pending section edit live at once (§8.3). */
    async publish() {
      const { data } = await request("/content/homepage/publish", { method: "POST" });
      return data;
    },
    async discardDraft() {
      const { data } = await request("/content/homepage/discard-draft", { method: "POST" });
      return data;
    },
    async previewToken() {
      const { data } = await request("/content/homepage/preview-token", { method: "POST" });
      return data;
    },
  },
};

// ============================================================================
// CMS USERS (§11) — Admin only
// ============================================================================

export const users = {
  async list(params = {}) {
    return request(`/users${qs(params)}`);
  },
  async get(id) {
    const { data } = await request(`/users/${id}`);
    return data;
  },
  async create(body) {
    const { data } = await request("/users", { method: "POST", body });
    return data;
  },
  async update(id, body) {
    const { data } = await request(`/users/${id}`, { method: "PATCH", body });
    return data;
  },
  async setStatus(id, status) {
    const { data } = await request(`/users/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
    return data;
  },
  async resetPassword(id) {
    const { data } = await request(`/users/${id}/reset-password`, { method: "POST" });
    return data;
  },
  async resendInvitation(id) {
    const { data } = await request(`/users/${id}/resend-invitation`, { method: "POST" });
    return data;
  },
  async revokeInvitation(id) {
    const { data } = await request(`/users/${id}/revoke-invitation`, { method: "POST" });
    return data;
  },
  async remove(id) {
    await request(`/users/${id}`, { method: "DELETE" });
  },
};

// ============================================================================
// AUDIT LOG (§12) + SETTINGS (§13)
// ============================================================================

export const audit = {
  /** Ops sees only their own entries — enforced server-side (§12.2). */
  async list(params = {}) {
    return request(`/audit-log${qs(params)}`);
  },
  /** Admin only. */
  async actors() {
    const { data } = await request("/audit-log/actors");
    return data;
  },
};

export const settings = {
  async get() {
    const { data } = await request("/settings");
    return data;
  },
  /** Groups save independently so one tab cannot clobber another (§13). */
  async updateGroup(group, value) {
    const { data } = await request(`/settings/${group}`, { method: "PUT", body: value });
    return data;
  },
};

// ============================================================================
// UPLOADS — Cloudinary signed direct upload
// ============================================================================

/**
 * Client-side limits, checked BEFORE the upload starts.
 *
 * The server signs `allowed_formats`, so Cloudinary is the real gate — but
 * failing fast here means a 90 MB mistake is caught instantly instead of after a
 * long upload that ends in a rejection.
 */
export const UPLOAD_LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"], label: "10 MB" },
  video: { maxBytes: 100 * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"], label: "100 MB" },
};

const prettyBytes = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

/**
 * Reject a file locally before uploading. Returns an error string, or null.
 */
export function checkUploadFile(file, resourceType) {
  const limit = UPLOAD_LIMITS[resourceType];
  if (!limit) return "Unsupported upload type.";
  if (!limit.mimes.includes(file.type)) {
    const kinds = resourceType === "video" ? "MP4, WebM or MOV" : "JPG, PNG, WebP or AVIF";
    return `That file is a ${file.type || "unknown type"}. Use ${kinds}.`;
  }
  if (file.size > limit.maxBytes) {
    return `That file is ${prettyBytes(file.size)}. The limit is ${limit.label}.`;
  }
  return null;
}

/**
 * POST to Cloudinary via XHR rather than fetch, purely because fetch cannot
 * report upload progress. A 100 MB video with no feedback looks like a hang.
 */
function xhrUpload(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new ApiError("Cloudinary returned an unreadable response.", { code: "UPLOAD_FAILED" }));
        }
      } else {
        // Surface Cloudinary's own reason (bad format, too large) when present.
        let detail = "";
        try {
          detail = JSON.parse(xhr.responseText)?.error?.message ?? "";
        } catch {
          /* keep the generic message */
        }
        reject(new ApiError(detail || "Upload failed.", { code: "UPLOAD_FAILED", status: xhr.status }));
      }
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          "Network error during upload — the connection dropped. Check your internet and try again.",
          { code: "UPLOAD_FAILED" },
        ),
      );
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", { code: "UPLOAD_ABORTED" }));
    /*
     * Without an explicit timeout AND an ontimeout handler, a stalled request
     * leaves this promise permanently unsettled — the progress bar disappears and
     * the file silently vanishes with no error. That was a real bug for large
     * videos. 10 minutes is generous enough for a 100 MB file on a slow line.
     */
    xhr.timeout = 10 * 60 * 1000;
    xhr.ontimeout = () =>
      reject(
        new ApiError(
          "Upload timed out after 10 minutes. The file may be too large for your connection — try a shorter or more compressed video.",
          { code: "UPLOAD_TIMEOUT" },
        ),
      );
    xhr.send(form);
  });
}

export const uploads = {
  /**
   * Upload straight to Cloudinary with a signature minted by our API. The bytes
   * never pass through the backend — which is what makes a 100 MB video viable.
   *
   * Returns a ProductMedia-shaped object, ready to push into the editor's gallery.
   */
  async asset(file, { folder = "products", resourceType = "image", slug, onProgress } = {}) {
    const localError = checkUploadFile(file, resourceType);
    if (localError) throw new ApiError(localError, { code: "UPLOAD_REJECTED" });

    /*
     * `slug` ties the signature to the product being edited, so an upload that
     * is never saved can be traced back and cleaned up. The server records it
     * before telling us where to upload — see UploadTicket.
     */
    const { data: sig } = await request("/uploads/signature", {
      method: "POST",
      body: { folder, resourceType, ...(slug ? { slug } : {}) },
    });

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("signature", sig.signature);
    form.append("folder", sig.folder);
    /*
     * Echo back EXACTLY the params the server signed — no more, no fewer, or
     * Cloudinary rejects the signature. Images get `transformation` (inline);
     * video gets `eager` + `eager_async` so the response does not wait for a
     * multi-minute transcode.
     */
    if (sig.transformation) form.append("transformation", sig.transformation);
    if (sig.eager) {
      form.append("eager", sig.eager);
      form.append("eager_async", sig.eagerAsync ?? "true");
    }
    if (sig.allowedFormats) form.append("allowed_formats", sig.allowedFormats);
    /*
     * The public_id is chosen by the SERVER, not here. It is part of the signed
     * payload, so echoing it back unchanged is required — and because the server
     * picked it, a client cannot aim an upload at somebody else's asset.
     */
    if (sig.publicId) form.append("public_id", sig.publicId);
    if (sig.notificationUrl) form.append("notification_url", sig.notificationUrl);
    if (sig.eagerNotificationUrl) form.append("eager_notification_url", sig.eagerNotificationUrl);

    const result = await xhrUpload(sig.uploadUrl, form, onProgress);

    const isVideo = resourceType === "video";
    return {
      type: isVideo ? "VIDEO" : "IMAGE",
      url: result.secure_url,
      publicId: result.public_id,
      /*
       * What the operator is looking at, before any save.
       *
       * An image is finished the moment Cloudinary responds — its transform runs
       * inline. A video is not: the upload returns while transcoding continues,
       * so it is genuinely still processing and the editor must say so rather
       * than showing it as ready. The server decides the stored status; this is
       * only what to display until the gallery is saved and reloaded.
       */
      status: isVideo ? "PENDING" : "READY",
      alt: "",
      width: result.width ?? null,
      height: result.height ?? null,
      ...(isVideo
        ? {
            durationSec: result.duration ?? null,
            // Cloudinary renders a frame on demand from the video's public_id —
            // no second upload needed. so_0 pins it to the first frame.
            posterUrl: `https://res.cloudinary.com/${sig.cloudName}/video/upload/so_0,q_auto,f_jpg/${result.public_id}.jpg`,
          }
        : {}),
    };
  },

  /** Back-compat wrapper: existing callers upload images by URL only. */
  async image(file, folder = "products") {
    const media = await uploads.asset(file, { folder, resourceType: "image" });
    return { url: media.url, publicId: media.publicId };
  },
};

// ============================================================================
// ANALYTICS & KPIS
// ============================================================================

export const analytics = {
  async overview(params = {}) {
    const { data } = await request(`/analytics/overview${qs(params)}`);
    return data;
  },

  async revenue(params = {}) {
    const { data } = await request(`/analytics/revenue${qs(params)}`);
    return data;
  },

  async products(params = {}) {
    return request(`/analytics/products${qs(params)}`);
  },

  async promotions(params = {}) {
    return request(`/analytics/promotions${qs(params)}`);
  },

  async customers(params = {}) {
    const { data } = await request(`/analytics/customers${qs(params)}`);
    return data;
  },

  async geography(params = {}) {
    const { data } = await request(`/analytics/geography${qs(params)}`);
    return data;
  },

  async exportCsv(type, params = {}) {
    const blob = await request(`/analytics/export${qs({ type, ...params })}`, { raw: true });
    const filename = `${type}-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    downloadBlob(blob, filename);
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Paise → "₹1,847". The backend is authoritative; this only displays. */
export function formatPaise(paise, { decimals = false } = {}) {
  const rupees = (paise ?? 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}
