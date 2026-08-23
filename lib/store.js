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
const SIGNED_OUT = { status: "out", user: null, permissions: [], role: null };

export const useAuth = create((set, get) => ({
  /** out | twofa | enrol | in | restoring */
  status: "restoring",
  user: null,
  /** Permission strings from the server; the source of truth for UI gating. */
  permissions: [],
  /** Legacy key ("admin" | "ops" | "editor") for components using rbac.js. */
  role: null,
  /** Short-lived token issued after the password step. */
  challengeToken: null,
  twofaSetup: null,
  backupCodes: null,

  /**
   * Restore a session on app load using the refresh cookie.
   *
   * FAILURE MUST CLEAR THE SESSION MARKER, and that is not cosmetic.
   *
   * `api.session.clear()` drops the `zewa_cms_session` cookie that middleware.js
   * reads to decide whether someone is signed in. This function used to set
   * `status: "out"` and leave the marker in place, which left the browser
   * asserting a session that no longer existed. Middleware then bounced /login
   * back to /, the shell restored again, failed again, and redirected to /login
   * again — a dead end showing "Redirecting to sign-in…" that no reload could
   * escape, only clearing cookies.
   *
   * The 401 path in lib/api.js has always cleared it. This is the other way a
   * session is discovered dead, and it is the one that runs on every page load.
   */
  restore: async () => {
    /*
     * No marker means there is certainly no session to restore, so the refresh
     * call would be a guaranteed 401 — about half a second on the critical path
     * of every visit to the sign-in page, for an answer already known.
     *
     * Trusted only as a NEGATIVE. A stale marker still leads to a real attempt,
     * which fails and clears it; that is what recovers the dead end rather than
     * hiding it.
     */
    if (!api.session.exists) {
      set(SIGNED_OUT);
      return false;
    }

    try {
      const data = await api.auth.restore();
      if (!data) {
        api.session.clear();
        set(SIGNED_OUT);
        return false;
      }
      set({
        status: "in",
        user: data.user,
        permissions: data.user.permissions ?? [],
        role: ROLE_KEY_BY_ENUM[data.user.role] ?? null,
      });
      return true;
    } catch {
      api.session.clear();
      set(SIGNED_OUT);
      return false;
    }
  },

  /** Step 1. Returns { ok, error } — the shape the login page already expects. */
  login: async (email, password, remember = false) => {
    try {
      const data = await api.auth.login(email, password, remember);
      set({
        // A user who has never enrolled must set up 2FA before anything else (§14.3).
        status: data.twofaEnrolled ? "twofa" : "enrol",
        challengeToken: data.challengeToken,
        twofaMethod: data.twofaMethod,
      });
      return { ok: true, twofaEnrolled: data.twofaEnrolled };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /** Step 2 — TOTP code or a single-use backup code. */
  verify2fa: async (code, remember = false) => {
    const { challengeToken } = get();
    if (!challengeToken) return { ok: false, error: "Start again from the sign-in page." };

    try {
      const data = await api.auth.verifyTwofa(challengeToken, code, remember);
      set({
        status: "in",
        user: data.user,
        permissions: data.user.permissions ?? [],
        role: ROLE_KEY_BY_ENUM[data.user.role] ?? null,
        challengeToken: null,
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
  completeEnrolment: async (code, remember = false) => {
    const { challengeToken } = get();
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

  clearBackupCodes: () => set({ backupCodes: null }),

  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      set({ ...SIGNED_OUT, challengeToken: null });
    }
  },

  /** Permission check against the server-issued list. */
  can: (permission) => get().permissions.includes(permission),
}));

// Wire the API client's session-lost handler to the store, so an unrecoverable
// 401 anywhere in the app lands the user back on /login.
if (typeof window !== "undefined") {
  api.session.onLost(() => {
    // lib/api.js has already called session.clear() by this point, so the marker
    // is gone; this only mirrors it into the store.
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
  loadOrders: async (params) => {
    const res = await load(set, "orders", () => api.orders.list(params));
    void get().loadDashboard().catch(() => undefined);
    return res;
  },
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
  updateOrderNote: (orderNo, note) => api.orders.updateNote(orderNo, note),
  downloadInvoice: (orderNo) => api.orders.downloadInvoice(orderNo),
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
