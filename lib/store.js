"use client";

import { create } from "zustand";
import * as api from "./api";
import { ROLE_KEY_BY_ENUM } from "./rbac";

/**
 * CMS state — backed by the real API.
 *
 * This file replaces the previous mock store. Three deliberate changes from it:
 *
 *  1. **No `persist`.** The session lives in an httpOnly refresh cookie the
 *     browser owns; the access token is held in memory by lib/api.js. Persisting
 *     auth state to localStorage would let an XSS resurrect a session.
 *  2. **No `setRole`.** The old topbar switcher let a user change their own role
 *     client-side. Role now comes from the JWT and the server enforces it.
 *  3. **No `log()`.** Audit entries are derived server-side from the mutation that
 *     caused them. A client-callable audit writer would let a browser forge
 *     history and repudiate its own actions.
 */

// ==========================================================================
// AUTH (§14) — password → 2FA → session
// ==========================================================================

/**
 * The store's signed-out shape.
 *
 * Named because four places need to reach it and they must agree — a branch that
 * forgets `permissions: []` would leave stale permissions gating the UI after a
 * session ends.
 */
const SIGNED_OUT = { status: "out", user: null, permissions: [], role: null, offline: false };

export const useAuth = create((set, get) => ({
  /** out | twofa | enrol | in | restoring | offline */
  status: "restoring",
  /** True when the last restore could not reach the API. Not a signed-out state. */
  offline: false,
  user: null,
  /** Permission strings from the server; the source of truth for UI gating. */
  permissions: [],
  /** Legacy key ("admin" | "ops" | "editor") for components using rbac.js. */
  role: null,
  /** Short-lived token issued after the password step. */
  challengeToken: null,
  maskedEmail: null,
  hasTotp: false,
  twofaSetup: null,
  backupCodes: null,
  rememberMe: true,

  /**
   * Restore the session on app load.
   *
   * ── THE RULE THIS FUNCTION EXISTS TO ENFORCE ────────────────────────────────
   * Failing to CONFIRM a session is not the same as learning it is over, and only
   * the second may sign anyone out.
   *
   * This used to clear the session on any failure at all. Since every failure
   * looked identical from here, a blocked CORS preflight, an offline laptop and a
   * cold Render dyno were all treated as "your 7-day session has expired" — and
   * the CORS preflight for /auth/refresh was, in fact, blocked on every single
   * page load. That is the whole bug: hard refresh, new tab and returning to an
   * idle tab all run this path, and all three ended in a sign-out that the server
   * never asked for.
   *
   * Now the three outcomes are distinct, and "unreachable" leaves the stored
   * session completely untouched so a later attempt can still succeed.
   */
  restore: async () => {
    // No credential at all means there is nothing to restore, and the request
    // would be a guaranteed 401. Trusted only as a NEGATIVE.
    if (!api.session.exists) {
      set(SIGNED_OUT);
      return false;
    }

    let result;
    try {
      result = await api.auth.restore();
    } catch {
      result = { status: api.REFRESH_UNREACHABLE };
    }

    if (result.status === api.REFRESH_OK && result.data?.user) {
      const user = result.data.user;
      set({
        status: "in",
        user,
        permissions: user.permissions ?? [],
        role: ROLE_KEY_BY_ENUM[user.role] ?? null,
        offline: false,
      });
      return true;
    }

    if (result.status === api.REFRESH_UNREACHABLE) {
      /*
       * The server could not be reached. The session is very probably still
       * valid, so it is left alone and the shell shows a retry instead of a
       * login form. Signing out here is what this whole change is about not doing.
       */
      set({ status: "offline", offline: true });
      return false;
    }

    // Genuinely invalid — api.js has already cleared the store and the marker.
    set(SIGNED_OUT);
    return false;
  },

  /** Step 1. Returns { ok, error } — Email OTP is dispatched automatically. */
  login: async (email, password, remember = true) => {
    try {
      const data = await api.auth.login(email, password, remember);
      set({
        status: "twofa",
        challengeToken: data.challengeToken,
        twofaMethod: data.twofaMethod,
        hasTotp: Boolean(data.hasTotp),
        maskedEmail: data.maskedEmail ?? null,
        rememberMe: remember,
      });
      return { ok: true, twofaEnrolled: data.twofaEnrolled, hasTotp: data.hasTotp, maskedEmail: data.maskedEmail };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Resend Email OTP verification code. */
  resendOtp: async () => {
    const { challengeToken } = get();
    if (!challengeToken) return { ok: false, error: "Start again from the sign-in page." };
    try {
      const data = await api.auth.resendOtp(challengeToken);
      if (data.maskedEmail) {
        set({ maskedEmail: data.maskedEmail });
      }
      return { ok: true, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Step 2 — Email OTP code, TOTP code, or a single-use backup code. */
  verify2fa: async (code, rememberOverride) => {
    const { challengeToken, rememberMe } = get();
    const remember = rememberOverride !== undefined ? rememberOverride : Boolean(rememberMe);
    if (!challengeToken) return { ok: false, error: "Start again from the sign-in page." };

    try {
      const data = await api.auth.verifyTwofa(challengeToken, code, remember);
      set({
        status: "in",
        user: data.user,
        permissions: data.user.permissions ?? [],
        role: ROLE_KEY_BY_ENUM[data.user.role] ?? null,
        challengeToken: null,
        maskedEmail: null,
        hasTotp: false,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Begin forced enrolment — returns a secret to render as a QR code. */
  startEnrolment: async () => {
    const { challengeToken } = get();
    if (!challengeToken) return { ok: false, error: "Start again from the sign-in page." };
    try {
      const data = await api.auth.startTwofaSetup(challengeToken);
      set({ twofaSetup: data });
      return { ok: true, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Confirm enrolment; backup codes are returned once and must be shown. */
  completeEnrolment: async (code, rememberOverride) => {
    const { challengeToken, rememberMe } = get();
    const remember = rememberOverride !== undefined ? rememberOverride : Boolean(rememberMe);
    if (!challengeToken) return { ok: false, error: "Start again from the sign-in page." };
    try {
      const data = await api.auth.completeTwofaSetup(challengeToken, code, remember);
      set({
        status: "in",
        user: data.user,
        permissions: data.user.permissions ?? [],
        role: ROLE_KEY_BY_ENUM[data.user.role] ?? null,
        challengeToken: null,
        twofaSetup: null,
        backupCodes: data.backupCodes ?? null,
      });
      return { ok: true, backupCodes: data.backupCodes };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Start in-profile Authenticator (TOTP) setup. */
  setupTotp: async () => {
    try {
      const data = await api.auth.setupTotp();
      return { ok: true, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Confirm in-profile Authenticator (TOTP) setup. */
  confirmTotp: async (code) => {
    try {
      const data = await api.auth.confirmTotp(code);
      return { ok: true, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  clearBackupCodes: () => set({ backupCodes: null }),

  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      set({ ...SIGNED_OUT, challengeToken: null, maskedEmail: null, hasTotp: false });
    }
  },

  /** Permission check against the server-issued list. */
  can: (permission) => get().permissions.includes(permission),
}));

// Wire the API client's session-lost handler to the store, so an unrecoverable
// 401 anywhere in the app lands the user back on /login.
if (typeof window !== "undefined") {
  /*
   * Reached ONLY when the API has explicitly rejected the refresh credential, or
   * the user signed out. Network failures deliberately never arrive here — a
   * single tab that briefly loses connectivity must not end a session the other
   * tabs are using perfectly well.
   */
  api.session.onLost(() => {
    // lib/api.js has already cleared the store and the marker; mirror it.
    useAuth.setState(SIGNED_OUT);
  });
}

// ==========================================================================
// GENERIC ASYNC RESOURCE
// ==========================================================================

/**
 * Shared shape for every list/detail fetch: `{ data, meta, loading, error }`.
 *
 * Factored out because every module page needs the same four states, and
 * hand-rolling them per page is where inconsistent loading UX comes from.
 */
function resource() {
  return { data: null, meta: null, loading: false, error: null };
}

/** Run a fetch and fold the result into a named slice of the store. */
async function load(set, key, fn) {
  set((s) => ({ [key]: { ...s[key], loading: true, error: null } }));
  try {
    const result = await fn();
    const isEnvelope = result && typeof result === "object" && "data" in result;
    set({
      [key]: {
        data: isEnvelope ? result.data : result,
        meta: isEnvelope ? (result.meta ?? null) : null,
        loading: false,
        error: null,
      },
    });
    return isEnvelope ? result.data : result;
  } catch (err) {
    set((s) => ({ [key]: { ...s[key], loading: false, error: err.message } }));
    throw err;
  }
}

// ==========================================================================
// DATA STORE — every read and write goes through the API
// ==========================================================================
export const useData = create((set, get) => ({
  dashboard: resource(),
  products: resource(),
  orders: resource(),
  customers: resource(),
  reviews: resource(),
  coupons: resource(),
  users: resource(),
  audit: resource(),
  articles: resource(),
  spotlights: resource(),
  homepage: resource(),
  settings: resource(),

  // ---- Dashboard (§4) ----------------------------------------------------
  loadDashboard: () => load(set, "dashboard", () => api.dashboard.load()),

  // ---- Products (§5) ----------------------------------------------------
  loadProducts: (params) => load(set, "products", () => api.products.list(params)),
  getProduct: (slug) => api.products.get(slug),
  createProduct: (body) => api.products.create(body),
  saveProduct: (slug, body) => api.products.save(slug, body),
  publishProduct: (slug) => api.products.publish(slug),
  discardProductDraft: (slug) => api.products.discardDraft(slug),
  setProductStatus: (slug, status) => api.products.setStatus(slug, status),
  updateStock: (slug, updates) => api.products.updateStock(slug, updates),
  productDisplayOrder: () => api.products.displayOrder(),
  reorderProducts: (order) => api.products.reorder(order),
  productPreviewToken: (slug) => api.products.previewToken(slug),
  deleteProduct: (slug, confirmName) => api.products.remove(slug, confirmName),

  // ---- Orders (§6) ------------------------------------------------------
  loadOrders: (params) => load(set, "orders", () => api.orders.list(params)),
  getOrder: (orderNo) => api.orders.get(orderNo),
  transitionOrder: async (orderNo, payload) => {
    const res = await api.orders.transition(orderNo, payload);
    void get().loadDashboard().catch(() => undefined);
    return res;
  },
  refundOrder: async (orderNo, amount, reason) => {
    const res = await api.orders.refund(orderNo, amount, reason);
    void get().loadDashboard().catch(() => undefined);
    return res;
  },
  reconcilePayment: async (orderNo, paymentId) => {
    const res = await api.orders.reconcilePayment(orderNo, paymentId);
    void get().loadDashboard().catch(() => undefined);
    return res;
  },
  updateOrderNote: (orderNo, note) => api.orders.updateNote(orderNo, note),
  downloadInvoice: (orderNo, filename) => api.orders.downloadInvoice(orderNo, filename),
  exportOrdersCsv: (params) => api.orders.exportCsv(params),

  // ---- Customers (§7) ---------------------------------------------------
  loadCustomers: (params) => load(set, "customers", () => api.customers.list(params)),
  getCustomer: (id) => api.customers.get(id),
  setCustomerStatus: (id, status) => api.customers.setStatus(id, status),

  // ---- Reviews (§9) -----------------------------------------------------
  loadReviews: (params) => load(set, "reviews", () => api.reviews.list(params)),
  setReviewState: (id, state) => api.reviews.setState(id, state),
  approveAllPending: () => api.reviews.bulkApprove(),

  // ---- Coupons (§10) ----------------------------------------------------
  loadCoupons: (params) => load(set, "coupons", () => api.coupons.list(params)),
  getCoupon: (id) => api.coupons.get(id),
  createCoupon: (body) => api.coupons.create(body),
  updateCoupon: (id, body) => api.coupons.update(id, body),
  deleteCoupon: (id) => api.coupons.remove(id),
  couponRedemptions: (id, params) => api.coupons.redemptions(id, params),
  couponAnalytics: (id) => api.coupons.analytics(id),
  previewCoupon: (body) => api.coupons.preview(body),

  // ---- Content (§8) -----------------------------------------------------
  loadArticles: (params) => load(set, "articles", () => api.content.articles.list(params)),
  getArticle: (slug) => api.content.articles.get(slug),
  createArticle: (body) => api.content.articles.create(body),
  saveArticle: (slug, body) => api.content.articles.save(slug, body),
  publishArticle: (slug) => api.content.articles.publish(slug),
  setArticleStatus: (slug, status) => api.content.articles.setStatus(slug, status),
  discardArticleDraft: (slug) => api.content.articles.discardDraft(slug),
  articlePreviewToken: (slug) => api.content.articles.previewToken(slug),
  deleteArticle: (slug) => api.content.articles.remove(slug),

  loadSpotlights: () => load(set, "spotlights", () => api.content.spotlights.list()),
  createSpotlight: (body) => api.content.spotlights.create(body),
  updateSpotlight: (id, body) => api.content.spotlights.update(id, body),
  toggleSpotlight: (id) => api.content.spotlights.toggle(id),
  reorderSpotlights: (order) => api.content.spotlights.reorder(order),
  deleteSpotlight: (id) => api.content.spotlights.remove(id),

  loadHomepage: (version) => load(set, "homepage", () => api.content.homepage.get(version)),
  saveHomepage: (sections) => api.content.homepage.saveDraft(sections),
  publishHomepage: () => api.content.homepage.publish(),
  discardHomepageDraft: () => api.content.homepage.discardDraft(),
  homepagePreviewToken: () => api.content.homepage.previewToken(),

  // ---- CMS users (§11) --------------------------------------------------
  loadUsers: (params) => load(set, "users", () => api.users.list(params)),
  getUser: (id) => api.users.get(id),
  createUser: (body) => api.users.create(body),
  updateUser: (id, body) => api.users.update(id, body),
  setUserStatus: (id, status) => api.users.setStatus(id, status),
  resendInvitation: (id) => api.users.resendInvitation(id),
  revokeInvitation: (id) => api.users.revokeInvitation(id),
  resetUserPassword: (id) => api.users.resetPassword(id),
  deleteUser: (id) => api.users.remove(id),

  // ---- Audit (§12) + Settings (§13) -------------------------------------
  loadAudit: (params) => load(set, "audit", () => api.audit.list(params)),
  auditActors: () => api.audit.actors(),

  loadSettings: () => load(set, "settings", () => api.settings.get()),
  saveSettingsGroup: (group, value) => api.settings.updateGroup(group, value),

  // ---- Search (§3.1) ----------------------------------------------------
  globalSearch: (q) => api.search.global(q),

  // ---- Uploads ----------------------------------------------------------
  uploadImage: (file, folder) => api.uploads.image(file, folder),
  /**
   * Upload an image or video and get back a gallery-ready media object.
   * `onProgress` receives 0–100.
   */
  uploadAsset: (file, opts) => api.uploads.asset(file, opts),

  /** Re-fetch whichever list is currently loaded, after a mutation. */
  refresh: (key, params) => {
    const loaders = {
      products: () => get().loadProducts(params),
      orders: () => get().loadOrders(params),
      customers: () => get().loadCustomers(params),
      reviews: () => get().loadReviews(params),
      coupons: () => get().loadCoupons(params),
      users: () => get().loadUsers(params),
      articles: () => get().loadArticles(params),
      spotlights: () => get().loadSpotlights(),
      audit: () => get().loadAudit(params),
      dashboard: () => get().loadDashboard(),
      settings: () => get().loadSettings(),
      homepage: () => get().loadHomepage(),
    };
    return loaders[key]?.();
  },
}));
