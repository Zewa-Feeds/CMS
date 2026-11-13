import { describe, it, expect } from "vitest";
import { skuStockSummary, skuStockLabel } from "./utils";

const v = (stock, isActive = true) => ({ stock, isActive });

describe("per-SKU stock status (Micro Pellets M3, Nov 2026)", () => {
  it("an empty SKU makes the product Out of Stock even with a healthy total", () => {
    const s = skuStockSummary([v(0), v(8), v(9), v(9), v(0)]);
    expect(s.worst).toBe("Out of Stock");
    expect(skuStockLabel(s, 26)).toBe("Out of Stock · 2 SKUs");
  });
  it("labels low and healthy products", () => {
    expect(skuStockLabel(skuStockSummary([v(50), v(9)]), 59)).toBe("Low Stock · 1 SKU");
    expect(skuStockLabel(skuStockSummary([v(50), v(10)]), 60)).toBe("In Stock · 60");
  });
  it("ignores switched-off SKUs", () => {
    expect(skuStockSummary([v(40), v(0, false)]).worst).toBe("In Stock");
  });
});
