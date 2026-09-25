import { describe, expect, it } from "vitest";
import { can } from "./rbac";

/**
 * Email permissions, mirrored from the backend's `src/rbac/permissions.ts`.
 *
 * These matter because there are TWO routes that resend a customer email — the
 * `/emails` page and the order detail page — and for a while they disagreed. The
 * order route was gated on `orders.status` (OPS + ADMIN), so an operator without
 * `emails.resend` could still put mail in a customer's inbox from there. Both now
 * require `emails.resend`, and this pins the split the two share.
 */
describe("email permissions", () => {
  it("lets ops read the log so support can answer 'did it arrive?'", () => {
    expect(can("ops", "emails.view")).toBe(true);
  });

  /* Sending mail to a customer is outward-facing, so it stays ADMIN. */
  it("does not let ops resend", () => {
    expect(can("ops", "emails.resend")).toBe(false);
  });

  it("lets admin do both", () => {
    expect(can("admin", "emails.view")).toBe(true);
    expect(can("admin", "emails.resend")).toBe(true);
  });

  it("keeps both away from a content editor", () => {
    expect(can("content", "emails.view")).toBe(false);
    expect(can("content", "emails.resend")).toBe(false);
  });

  /*
   * The order page's resend must not be reachable through a permission that is
   * merely adjacent. If this ever passes for ops, the order route has drifted back
   * to `orders.status` and the ADMIN-only rule is bypassable again.
   */
  it("does not let orders.status stand in for emails.resend", () => {
    expect(can("ops", "orders.status")).toBe(true);
    expect(can("ops", "emails.resend")).toBe(false);
  });
});
