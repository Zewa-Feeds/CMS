import { describe, expect, it } from "vitest";
import { sanitizeStockInput, stockStatus } from "./utils";

describe("Stock Input Sanitization & UX", () => {
  it("preserves 0 as a solitary valid value", () => {
    expect(sanitizeStockInput("0")).toBe("0");
    expect(sanitizeStockInput(0)).toBe("0");
  });

  it("normalizes leading zero when user types after 0 (e.g. '010' -> '10', '05' -> '5')", () => {
    expect(sanitizeStockInput("01")).toBe("1");
    expect(sanitizeStockInput("010")).toBe("10");
    expect(sanitizeStockInput("05")).toBe("5");
    expect(sanitizeStockInput("007")).toBe("7");
    expect(sanitizeStockInput("000")).toBe("0");
  });

  it("preserves multi-digit numbers without leading zeros", () => {
    expect(sanitizeStockInput("10")).toBe("10");
    expect(sanitizeStockInput("25")).toBe("25");
    expect(sanitizeStockInput("100")).toBe("100");
    expect(sanitizeStockInput("1250")).toBe("1250");
  });

  it("handles empty input safely so operator can backspace-clear the field", () => {
    expect(sanitizeStockInput("")).toBe("");
    expect(sanitizeStockInput(null)).toBe("");
    expect(sanitizeStockInput(undefined)).toBe("");
    expect(sanitizeStockInput("   ")).toBe("");
  });

  it("strips non-digits cleanly", () => {
    expect(sanitizeStockInput("abc")).toBe("");
    expect(sanitizeStockInput("-5")).toBe("5");
    expect(sanitizeStockInput("10.5")).toBe("105");
  });

  it("derives correct stockStatus for catalogue display", () => {
    expect(stockStatus(0)).toBe("Out of Stock");
    expect(stockStatus(5)).toBe("Low Stock");
    expect(stockStatus(9)).toBe("Low Stock");
    expect(stockStatus(10)).toBe("In Stock");
    expect(stockStatus(100)).toBe("In Stock");
  });
});
