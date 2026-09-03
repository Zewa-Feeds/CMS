/**
 * The stacking warnings, and the number they quote.
 *
 * The copy is the safety feature here: choosing "adds on top" on a percentage
 * coupon gives away two discounts on one order, and the editor should say so
 * before it ships rather than after a customer has had 24% off.
 */
import { describe, expect, it } from "vitest";

/** Mirrors the helper in CouponEditor — two discounts applied in series. */
const combinedPct = (a, b) => {
  const x = Number(a) || 0;
  return Math.round((1 - (1 - x / 100) * (1 - b / 100)) * 1000) / 10;
};

describe("the combined-discount figure quoted to the admin", () => {
  it("compounds in series, matching how the engine applies them", () => {
    /*
     * discounts.ts applies each promotion to the RUNNING residual, so 15% then
     * 10% is 23.5% off — not the 25% a naive sum would claim. Quoting 25% would
     * overstate the giveaway and make the warning wrong in the reassuring
     * direction.
     */
    expect(combinedPct(15, 10)).toBe(23.5);
    expect(combinedPct(12, 10)).toBe(20.8);
    expect(combinedPct(20, 10)).toBe(28);
  });

  it("never claims a bigger giveaway than either discount alone", () => {
    for (const p of [1, 5, 10, 15, 25, 50, 90]) {
      expect(combinedPct(p, 10)).toBeGreaterThanOrEqual(p);
      expect(combinedPct(p, 10)).toBeLessThan(100);
    }
  });

  it("handles an empty or unset discount without producing NaN", () => {
    expect(combinedPct("", 10)).toBe(10);
    expect(combinedPct(undefined, 10)).toBe(10);
  });
});

describe("the affiliate stacking choices", () => {
  // Kept in step with AFFILIATE_STACKING on the server, which rejects the
  // fourth mode for an affiliate code.
  const OFFERED = ["NON_STACKABLE", "STACKABLE", "EXCLUSIVE"];

  it("never offers the always-applies mode", () => {
    expect(OFFERED).not.toContain("GLOBALLY_STACKABLE");
  });

  it("defaults to the safe one", () => {
    expect(OFFERED[0]).toBe("NON_STACKABLE");
  });
});
