// ==========================================================================
// RBAC — spec §2 and §2.1
// 3-role model. Higher roles inherit all permissions of lower roles.
// ==========================================================================

export const ROLES = {
  editor: {
    key: "editor",
    name: "Content Editor",
    dot: "#60A5FA",
    who: "Marketing / Content",
  },
  ops: {
    key: "ops",
    name: "Ops Manager",
    dot: "#F59E0B",
    who: "Operations / Logistics",
  },
  admin: {
    key: "admin",
    name: "Admin",
    dot: "#44E5C2",
    who: "Administration / Owner",
  },
};

export const ROLE_ORDER = ["editor", "ops", "admin"];

export const CAN = {
  // Content Creator (Editor + Admin)
  "articles.create": ["editor", "admin"],
  "articles.publish": ["admin"],
  "articles.delete": ["admin"],
  "banners.edit": ["editor", "admin"],
  "homepage.edit": ["editor", "admin"],

  // Listings (Editor gets read-only view; Ops & Admin get full management)
  "products.view": ["editor", "ops", "admin"],
  "products.edit": ["ops", "admin"],
  "products.sku": ["ops", "admin"],

  // Order Management (Ops & Admin get view, status transitions, invoices)
  "orders.view": ["ops", "admin"],
  "orders.status": ["ops", "admin"],
  "orders.invoice": ["ops", "admin"],

  // Admin Only
  "orders.refund": ["admin"],
  "orders.export": ["admin"],
  "customers.view": ["admin"],

  /*
   * Z-Coin (ZSOP004 §9.4). Mirrors the backend's rbac/permissions.ts — the keys
   * are identical by design, so a role can never be allowed a screen the API
   * will refuse. Support VIEWS balances (the 60-second "why is my balance this
   * number?" screen); only admins move coins or change configuration, because
   * §9.2 requires a reason code, an admin id and second-person approval.
   */
  "loyalty.view": ["ops", "admin"],
  "loyalty.adjust": ["admin"],
  "loyalty.config": ["admin"],

  // Support answering "did the customer get their confirmation?" needs to READ
  // the log. Resending puts mail in someone's inbox — and during an incident a
  // few hundred at once — so it stays ADMIN. Mirrors src/rbac/permissions.ts.
  "emails.view": ["ops", "admin"],
  "emails.resend": ["admin"],
  "customers.ban": ["admin"],
  "reviews.moderate": ["admin"],
  "coupons.edit": ["admin"],
  "coupons.delete": ["admin"],
  "users.manage": ["admin"],
  "settings.manage": ["admin"],
  "audit.all": ["admin"],
  "audit.own": ["ops", "admin"],
};

export function can(role, key) {
  return (CAN[key] || []).includes(role);
}

/**
 * Backend Role enum -> the legacy key used throughout this codebase.
 *
 * The server speaks CONTENT_EDITOR / OPS_MANAGER / ADMIN; components here were
 * written against "editor" / "ops" / "admin". Mapped rather than renamed so the
 * existing pages and RoleGate keep working.
 */
export const ROLE_KEY_BY_ENUM = {
  CONTENT_EDITOR: "editor",
  OPS_MANAGER: "ops",
  ADMIN: "admin",
};

export const ROLE_ENUM_BY_KEY = {
  editor: "CONTENT_EDITOR",
  ops: "OPS_MANAGER",
  admin: "ADMIN",
};
