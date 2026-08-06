// ==========================================================================
// RBAC — spec §2 and §2.1
// 3-role model. Higher roles inherit all permissions of lower roles.
// ==========================================================================

export const ROLES = {
  editor: {
    key: "editor",
    name: "Content Editor",
    dot: "#60A5FA",
    who: "Marketing / Copywriter",
    person: "Priya Shah",
    email: "priya@zewafeeds.com",
    av: "PS",
  },
  ops: {
    key: "ops",
    name: "Ops Manager",
    dot: "#F59E0B",
    who: "Operations / Logistics",
    person: "Rahul Kamat",
    email: "rahul@zewafeeds.com",
    av: "RK",
  },
  admin: {
    key: "admin",
    name: "Admin",
    dot: "#44E5C2",
    who: "Business Owner / CTO",
    person: "Aditi Nair",
    email: "aditi@zewafeeds.com",
    av: "AN",
  },
};

export const ROLE_ORDER = ["editor", "ops", "admin"];

// permission -> roles that hold it (spec §2.1 permission matrix)
export const CAN = {
  "articles.create": ["editor", "ops", "admin"],
  "articles.publish": ["ops", "admin"],
  "articles.delete": ["admin"],
  "banners.edit": ["editor", "ops", "admin"],
  "homepage.edit": ["editor", "ops", "admin"],
  "products.view": ["editor", "ops", "admin"],
  "products.edit": ["ops", "admin"],
  "products.sku": ["ops", "admin"],
  "orders.view": ["ops", "admin"],
  "orders.status": ["ops", "admin"],
  "orders.invoice": ["ops", "admin"],
  "orders.refund": ["admin"],
  "orders.export": ["admin"],
  "customers.view": ["ops", "admin"],
  "customers.ban": ["admin"],
  "reviews.moderate": ["ops", "admin"],
  "coupons.edit": ["ops", "admin"],
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
