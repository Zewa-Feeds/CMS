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

// ---- In-memory token --------------------------------------------------------

let accessToken = null;
let onSessionLost = null;

/**
 * Presence marker for middleware.js.
 *
 * The real session is the httpOnly `zewa_rt` cookie on the API's origin, which
 * middleware cannot see (it is path-scoped to /api/v1/admin/auth). This cookie
 * exists ONLY so middleware can redirect an unauthenticated visitor to /login
 * instead of serving them an admin shell that would immediately bounce.
 *
 * It deliberately holds no token, id or role — forging it grants nothing, because
 * every API call is authenticated and permission-checked independently.
 */
const SESSION_MARKER = "zewa_cms_session";

function setSessionMarker() {
  if (typeof document === "undefined") return;
  // Session cookie (no Max-Age): dies with the tab, while `zewa_rt` decides how
  // long the actual session lasts. SameSite=Lax so a normal navigation carries it.
  document.cookie = `${SESSION_MARKER}=1; Path=/; SameSite=Lax`;
}

function clearSessionMarker() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_MARKER}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Is a session marker present?
 *
 * Only useful as a NEGATIVE signal: absent means there is certainly no session
 * to restore, so an attempt would be a guaranteed 401. Present proves nothing —
 * the cookie can outlive the session it stands for, which is exactly what caused
 * the sign-in dead end.
 */
function hasSessionMarker() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_MARKER}=`));
}

export const session = {
  get token() {
    return accessToken;
  },
  set(token) {
    accessToken = token;
    setSessionMarker();
  },
  clear() {
    accessToken = null;
    clearSessionMarker();
  },
  /** See hasSessionMarker: a reliable "no", never a reliable "yes". */
  get exists() {
    return hasSessionMarker();
  },
  /** Registered by the app shell so an unrecoverable 401 can redirect. */
  onLost(handler) {
    onSessionLost = handler;
  },
};

/** Refresh in flight — concurrent 401s share one call rather than racing. */
let refreshPromise = null;

async function refreshSession() {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${ADMIN}/auth/refresh`, {
        method: "POST",
        credentials: "include", // sends the httpOnly refresh cookie
      });
      if (!response.ok) return null;
      const { data } = await response.json();
      accessToken = data.accessToken;
      // A restored session must re-assert the marker: the cookie is per-tab, so a
      // new tab reaching here has none yet.
      setSessionMarker();
      return data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
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
  if (accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

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

  // Expired access token — refresh once, then replay.
  if (response.status === 401 && retryOn401 && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, { method, body, headers, raw, retryOn401: false });
    }
    session.clear();
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
    session.set(data.accessToken);
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
    session.set(data.accessToken);
    return data;
  },

  /** Restore a session on page load, using the httpOnly refresh cookie. */
  async restore() {
    return (await refreshSession()) ?? null;
  },

  async me() {
    const { data } = await request("/auth/me");
    return data.user;
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      session.clear();
    }
  },

  async changePassword(currentPassword, newPassword) {
    const { data } = await request("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
    session.set(data.accessToken);
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
  async downloadInvoice(orderNo) {
    const blob = await request(`/orders/${orderNo}/invoice`, { raw: true });
    downloadBlob(blob, `invoice-${orderNo}.pdf`);
  },

  /** CSV export (§6.1) — Admin only. */
  async exportCsv(params = {}) {
    const blob = await request(`/orders/export.csv${qs(params)}`, { raw: true });
    downloadBlob(blob, `zewa-orders-${new Date().toISOString().slice(0, 10)}.csv`);
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
