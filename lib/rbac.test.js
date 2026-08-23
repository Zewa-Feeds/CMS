import { describe, expect, it } from "vitest";
import { ROLES, ROLE_ORDER, can, ROLE_KEY_BY_ENUM, ROLE_ENUM_BY_KEY } from "./rbac";

describe("CMS RBAC Configuration & User Role Mapping", () => {
  it("defines standard role definitions without stale demo mock data", () => {
    expect(ROLES.editor.name).toBe("Content Editor");
    expect(ROLES.ops.name).toBe("Ops Manager");
    expect(ROLES.admin.name).toBe("Admin");

    expect(ROLES.editor.dot).toBe("#60A5FA");
    expect(ROLES.ops.dot).toBe("#F59E0B");
    expect(ROLES.admin.dot).toBe("#44E5C2");
  });

  it("correctly maps backend Role enums to CMS role keys", () => {
    expect(ROLE_KEY_BY_ENUM.CONTENT_EDITOR).toBe("editor");
    expect(ROLE_KEY_BY_ENUM.OPS_MANAGER).toBe("ops");
    expect(ROLE_KEY_BY_ENUM.ADMIN).toBe("admin");

    expect(ROLE_ENUM_BY_KEY.editor).toBe("CONTENT_EDITOR");
    expect(ROLE_ENUM_BY_KEY.ops).toBe("OPS_MANAGER");
    expect(ROLE_ENUM_BY_KEY.admin).toBe("ADMIN");
  });

  describe("Permission Matrix Resolution for Target User Roles", () => {
    it("allows Admin (Nik Mulakkal & Zewa Feeds IT) all permissions", () => {
      expect(can("admin", "users.manage")).toBe(true);
      expect(can("admin", "settings.manage")).toBe(true);
      expect(can("admin", "orders.view")).toBe(true);
      expect(can("admin", "orders.status")).toBe(true);
      expect(can("admin", "orders.invoice")).toBe(true);
      expect(can("admin", "orders.refund")).toBe(true);
      expect(can("admin", "orders.export")).toBe(true);
      expect(can("admin", "products.view")).toBe(true);
      expect(can("admin", "products.edit")).toBe(true);
      expect(can("admin", "products.sku")).toBe(true);
      expect(can("admin", "articles.create")).toBe(true);
      expect(can("admin", "articles.publish")).toBe(true);
      expect(can("admin", "articles.delete")).toBe(true);
      expect(can("admin", "customers.view")).toBe(true);
      expect(can("admin", "customers.ban")).toBe(true);
      expect(can("admin", "coupons.edit")).toBe(true);
      expect(can("admin", "coupons.delete")).toBe(true);
      expect(can("admin", "reviews.moderate")).toBe(true);
      expect(can("admin", "audit.all")).toBe(true);
    });

    it("allows Ops Manager (Zewa Feeds & Aromal Santhosh) ONLY Listings and Order Management", () => {
      // Allowed Listings
      expect(can("ops", "products.view")).toBe(true);
      expect(can("ops", "products.edit")).toBe(true);
      expect(can("ops", "products.sku")).toBe(true);

      // Allowed Order Management
      expect(can("ops", "orders.view")).toBe(true);
      expect(can("ops", "orders.status")).toBe(true);
      expect(can("ops", "orders.invoice")).toBe(true);

      // Explicitly Denied: reviews, coupons, customers, articles, banners, homepage, and admin-only
      expect(can("ops", "reviews.moderate")).toBe(false);
      expect(can("ops", "coupons.edit")).toBe(false);
      expect(can("ops", "coupons.delete")).toBe(false);
      expect(can("ops", "customers.view")).toBe(false);
      expect(can("ops", "customers.ban")).toBe(false);
      expect(can("ops", "articles.create")).toBe(false);
      expect(can("ops", "articles.publish")).toBe(false);
      expect(can("ops", "articles.delete")).toBe(false);
      expect(can("ops", "banners.edit")).toBe(false);
      expect(can("ops", "homepage.edit")).toBe(false);
      expect(can("ops", "orders.refund")).toBe(false);
      expect(can("ops", "orders.export")).toBe(false);
      expect(can("ops", "users.manage")).toBe(false);
      expect(can("ops", "settings.manage")).toBe(false);
      expect(can("ops", "audit.all")).toBe(false);
    });

    it("allows Content Editor (Vaishnavi Prabhakar) ONLY Content Creator and Listings View", () => {
      // Allowed Content Creator
      expect(can("editor", "articles.create")).toBe(true);
      expect(can("editor", "banners.edit")).toBe(true);
      expect(can("editor", "homepage.edit")).toBe(true);

      // Allowed Listings View
      expect(can("editor", "products.view")).toBe(true);

      // Explicitly Denied: product edits, orders, customers, coupons, reviews, and admin
      expect(can("editor", "products.edit")).toBe(false);
      expect(can("editor", "products.sku")).toBe(false);
      expect(can("editor", "orders.view")).toBe(false);
      expect(can("editor", "orders.status")).toBe(false);
      expect(can("editor", "orders.invoice")).toBe(false);
      expect(can("editor", "orders.refund")).toBe(false);
      expect(can("editor", "orders.export")).toBe(false);
      expect(can("editor", "customers.view")).toBe(false);
      expect(can("editor", "customers.ban")).toBe(false);
      expect(can("editor", "coupons.edit")).toBe(false);
      expect(can("editor", "coupons.delete")).toBe(false);
      expect(can("editor", "reviews.moderate")).toBe(false);
      expect(can("editor", "articles.publish")).toBe(false);
      expect(can("editor", "articles.delete")).toBe(false);
      expect(can("editor", "users.manage")).toBe(false);
      expect(can("editor", "settings.manage")).toBe(false);
      expect(can("editor", "audit.all")).toBe(false);
    });
  });
});
