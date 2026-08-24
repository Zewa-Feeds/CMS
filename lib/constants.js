/**
 * Display constants — labels, colours and pill tones.
 *
 * These were previously exported from `seed.js` alongside mock records. Split out
 * so the seed file can be deleted: this is presentation vocabulary the UI needs
 * regardless of where the data comes from.
 *
 * The API returns both an enum and a human label for every status, so these maps
 * are keyed on the LABEL — that is what the tables render.
 */

// ---- Products (§5.1) --------------------------------------------------------

export const CATEGORIES = ["Betta", "Cichlid", "Hatchery", "Guppy"];

/** Category accent, used for the row dot and thumbnail tint. */
export const catColor = (c) =>
  ({
    Betta: "#60A5FA",
    Cichlid: "#F59E0B",
    Hatchery: "#34D399",
    Guppy: "#C084FC",
  })[c] ?? "#7E8EA4";

/** §17.2 colour coding. */
export const PROD_STATUS_PILL = {
  Active: "green",
  Draft: "grey",
  "Coming Soon": "blue",
  // Amber, not red: Inactive is reversible ("back in a bit"), Discontinued is not.
  Inactive: "amber",
  Discontinued: "red",
};

/**
 * Selectable statuses, in lifecycle order. ONE list so the editor dropdown and
 * the list filter cannot drift apart — they were hardcoded separately before.
 */
export const PRODUCT_STATUSES = ["Draft", "Active", "Coming Soon", "Inactive", "Discontinued"];

/** Enum → label, for responses that only carry the enum. */
export const PRODUCT_STATUS_LABEL = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMING_SOON: "Coming Soon",
  INACTIVE: "Inactive",
  DISCONTINUED: "Discontinued",
};

export const PRODUCT_STATUS_ENUM = {
  Draft: "DRAFT",
  Active: "ACTIVE",
  "Coming Soon": "COMING_SOON",
  Inactive: "INACTIVE",
  Discontinued: "DISCONTINUED",
};

export const CATEGORY_LABEL = {
  BETTA: "Betta",
  CICHLID: "Cichlid",
  HATCHERY: "Hatchery",
  GUPPY: "Guppy",
};

export const CATEGORY_ENUM = {
  Betta: "BETTA",
  Cichlid: "CICHLID",
  Hatchery: "HATCHERY",
  Guppy: "GUPPY",
};

export const BADGES = ["None", "BESTSELLER", "NEW", "PRO"];

// ---- Orders (§6.1) ----------------------------------------------------------

export const ORDER_STATUS_PILL = {
  Pending: "amber",
  Processing: "blue",
  Shipped: "blue",
  Delivered: "green",
  Cancelled: "red",
};

export const ORDER_STATUS_LABEL = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAY_STATUS_PILL = {
  Paid: "green",
  Unpaid: "amber",
  Refunded: "grey",
  "Partially Refunded": "amber",
};

// ---- Content (§8.1) ---------------------------------------------------------

export const ARTICLE_TAGS = ["Science", "Betta", "Cichlid", "Hatchery", "Guppy", "Guides"];

export const CONTENT_STATUS_PILL = {
  Published: "green",
  Draft: "grey",
};

// ---- Coupons (§10.1) --------------------------------------------------------

export const COUPON_STATUS_PILL = {
  Active: "green",
  Inactive: "grey",
  Expired: "red",
};

// ---- Reviews (§9) -----------------------------------------------------------

export const REVIEW_STATE_PILL = {
  Pending: "amber",
  Approved: "green",
  Rejected: "red",
};

export const REVIEW_STATE_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// ---- Customers (§7.1) / CMS users (§11.1) -----------------------------------

export const CUSTOMER_STATUS_PILL = { Active: "green", Banned: "red" };

export const USER_STATUS_PILL = { Active: "green", Deactivated: "grey" };

/** §12.1 audit modules, for the log's filter dropdown. */
export const AUDIT_MODULES = [
  "PRODUCTS",
  "ORDERS",
  "CONTENT",
  "REVIEWS",
  "COUPONS",
  "CUSTOMERS",
  "USERS",
  "SETTINGS",
  "AUTH",
];

export const AUDIT_MODULE_LABEL = {
  PRODUCTS: "Products",
  ORDERS: "Orders",
  CONTENT: "Content",
  REVIEWS: "Reviews",
  COUPONS: "Coupons",
  CUSTOMERS: "Customers",
  USERS: "Users",
  SETTINGS: "Settings",
  AUTH: "Auth",
};

/** Indian states, for address forms and shipping rates. */
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
