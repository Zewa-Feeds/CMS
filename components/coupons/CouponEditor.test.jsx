import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const createCoupon = vi.fn();
const updateCoupon = vi.fn();
const loadProducts = vi.fn().mockResolvedValue({ data: [] });
const previewCoupon = vi.fn();
const push = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ push }),
}));

const mockStoreState = {
  createCoupon,
  updateCoupon,
  loadProducts,
  previewCoupon,
  products: { data: [{ id: "p1", name: "Betta Bites B1", slug: "betta-bites" }], loading: false },
};

vi.mock("@/lib/store", () => ({
  useData: Object.assign(
    (selector) => selector(mockStoreState),
    { getState: () => mockStoreState }
  ),
}));

const { CouponEditor } = await import("./CouponEditor");

const INITIAL_ALL_PRODUCTS_COUPON = {
  id: "coupon-1",
  code: "ALLPROMO10",
  name: "All Products Sale",
  description: "10% off everything",
  type: "Percentage",
  val: 10,
  maxDiscount: 500,
  min: 0,
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-30T23:59:59.000Z",
  scope: "ALL_PRODUCTS",
  products: [],
  qualifyingProducts: [],
  excludedProducts: [{ id: "p-ex", name: "Excluded Pellets" }],
  stackingMode: "NON_STACKABLE",
  priority: 0,
  trigger: "CODE",
  combinesWithAutomatic: true,
  customerEligibility: "ALL_CUSTOMERS",
};

const INITIAL_SPECIFIC_COUPON = {
  id: "coupon-2",
  code: "BETTA20",
  name: "Betta Promotion",
  description: "20% off Betta",
  type: "Percentage",
  val: 20,
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-30T23:59:59.000Z",
  scope: "SPECIFIC_PRODUCTS",
  products: [{ id: "p1", name: "Betta Bites B1", slug: "betta-bites" }],
  qualifyingProducts: [{ id: "p2", name: "Guppy Bites G1", slug: "guppy-bites" }],
  excludedProducts: [],
  stackingMode: "NON_STACKABLE",
  priority: 0,
  trigger: "CODE",
  combinesWithAutomatic: true,
  customerEligibility: "ALL_CUSTOMERS",
};

beforeEach(() => {
  createCoupon.mockReset();
  updateCoupon.mockReset();
  push.mockReset();
  routerPush.mockReset();
});

afterEach(cleanup);

describe("CouponEditor UX - Product Scope & Targeting", () => {
  it("renders 'All products' scope by default for a new coupon", async () => {
    render(<CouponEditor />);

    // Switch to Products tab
    fireEvent.click(screen.getByRole("button", { name: /^products/i }));

    // Scope dropdown shows "All products"
    const select = screen.getByLabelText(/discount applies to/i);
    expect(select.value).toBe("ALL_PRODUCTS");

    // Clear explanatory copy for All products
    expect(
      screen.getByText("Applies to every product in the cart unless excluded below.")
    ).toBeDefined();

    // Hides Discounted products and Qualifying products selectors
    expect(screen.queryByText(/discounted products/i)).toBeNull();
    expect(screen.queryByText(/qualifying products/i)).toBeNull();

    // Still shows Excluded products selector
    expect(screen.getByText(/excluded products/i)).toBeDefined();

    // Does NOT display the misleading warning
    expect(
      screen.queryByText(/no products selected — this coupon would not apply to anything/i)
    ).toBeNull();
  });

  it("shows all three targeting sections when scope is 'Specific products'", async () => {
    render(<CouponEditor />);

    // Switch to Products tab
    fireEvent.click(screen.getByRole("button", { name: /^products/i }));

    // Change scope to Specific products
    const select = screen.getByLabelText(/discount applies to/i);
    fireEvent.change(select, { target: { value: "SPECIFIC_PRODUCTS" } });

    // Explanatory copy updates for Specific products
    expect(
      screen.getByText("A product-specific promotion only discounts the eligible items in a cart.")
    ).toBeDefined();

    // Shows Discounted products selector
    expect(screen.getByText(/discounted products/i)).toBeDefined();

    // Shows Qualifying products selector
    expect(screen.getByText(/qualifying products/i)).toBeDefined();

    // Shows Excluded products selector
    expect(screen.getByText(/excluded products/i)).toBeDefined();

    // Shows the warning on Discounted products since 0 products are selected
    expect(
      screen.getByText("No products selected — choose at least one product.")
    ).toBeDefined();
  });

  it("preserves product selections when toggling between scopes", async () => {
    render(<CouponEditor initial={INITIAL_SPECIFIC_COUPON} />);

    // Switch to Products tab
    fireEvent.click(screen.getByRole("button", { name: /^products/i }));

    expect(screen.getByText("Betta Bites B1")).toBeDefined();
    expect(screen.getByText("Guppy Bites G1")).toBeDefined();

    // Toggle to All products
    const select = screen.getByLabelText(/discount applies to/i);
    fireEvent.change(select, { target: { value: "ALL_PRODUCTS" } });

    // Selectors are hidden
    expect(screen.queryByText(/discounted products/i)).toBeNull();
    expect(screen.queryByText(/qualifying products/i)).toBeNull();

    // Toggle back to Specific products
    fireEvent.change(select, { target: { value: "SPECIFIC_PRODUCTS" } });

    // Previous selections are intact
    expect(screen.getByText("Betta Bites B1")).toBeDefined();
    expect(screen.getByText("Guppy Bites G1")).toBeDefined();
  });

  it("saves 'All products' coupon with empty productIds and qualifyingProductIds", async () => {
    render(<CouponEditor initial={INITIAL_ALL_PRODUCTS_COUPON} />);

    // Click Save changes
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateCoupon).toHaveBeenCalledTimes(1);
    });

    const [id, payload] = updateCoupon.mock.calls[0];
    expect(id).toBe("coupon-1");
    expect(payload.scope).toBe("ALL_PRODUCTS");
    expect(payload.productIds).toEqual([]);
    expect(payload.qualifyingProductIds).toEqual([]);
    expect(payload.excludedProductIds).toEqual(["p-ex"]);
  });

  it("saves 'Specific products' coupon with designated productIds and qualifyingProductIds", async () => {
    render(<CouponEditor initial={INITIAL_SPECIFIC_COUPON} />);

    // Click Save changes
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateCoupon).toHaveBeenCalledTimes(1);
    });

    const [id, payload] = updateCoupon.mock.calls[0];
    expect(id).toBe("coupon-2");
    expect(payload.scope).toBe("SPECIFIC_PRODUCTS");
    expect(payload.productIds).toEqual(["p1"]);
    expect(payload.qualifyingProductIds).toEqual(["p2"]);
    expect(payload.excludedProductIds).toEqual([]);
  });
});

describe("CouponEditor Preview Tab - Interactive Dry-Run", () => {
  it("allows testing unsaved promotions without saving first", async () => {
    previewCoupon.mockResolvedValueOnce({
      eligible: true,
      reason: null,
      discountPaise: 2000,
      discountLabel: "10% off",
      appliedTo: ["Slow-Sinking Granules F3"],
      freeShipping: false,
      cart: {
        subtotalPaise: 37800,
        discountPaise: 2000,
        shippingPaise: 4500,
        taxPaise: 1800,
        totalPaise: 42100,
        lines: [
          {
            sku: "F3-45G",
            name: "Slow-Sinking Granules F3",
            pack: "45g Bottle",
            qty: 2,
            unitPricePaise: 18900,
            lineTotalPaise: 37800,
            isQualifying: true,
            isDiscounted: true,
            isExcluded: false,
            excludeReason: null,
          },
        ],
      },
      evaluationChecks: [
        { key: "status", label: "Active Status & Dates", passed: true, detail: "Promotion is active." },
        { key: "minOrder", label: "Minimum Spend", passed: true, detail: "Cart subtotal meets minimum." },
      ],
      stack: [],
      otherRejections: [],
    });

    render(<CouponEditor />);

    // Switch to Preview tab
    fireEvent.click(screen.getByRole("button", { name: /^preview/i }));

    // Should NOT show the old blocking message
    expect(screen.queryByText(/save the promotion first/i)).toBeNull();

    // Shows interactive cart and controls
    expect(screen.getByText(/test cart items/i)).toBeDefined();
    expect(screen.getByText(/shopper & checkout context/i)).toBeDefined();

    // Click "Run Promotion Test"
    fireEvent.click(screen.getByRole("button", { name: /run promotion test/i }));

    await waitFor(() => {
      expect(previewCoupon).toHaveBeenCalledTimes(1);
    });

    // Check payload passed to previewCoupon
    const [previewPayload] = previewCoupon.mock.calls[0];
    expect(previewPayload.coupon).toBeDefined();
    expect(previewPayload.lines).toEqual([{ sku: "F3-45G", qty: 2 }]);

    // Check outcome rendering
    expect(await screen.findByText(/promotion applied/i)).toBeDefined();
    expect(screen.getByText(/active status & dates/i)).toBeDefined();
    expect(screen.getByText(/cart subtotal meets minimum/i)).toBeDefined();
  });

  it("renders rejection reason and evaluation checks when promotion is not eligible", async () => {
    previewCoupon.mockResolvedValueOnce({
      eligible: false,
      reason: "Spend ₹999 or more to use this promotion.",
      reasonCode: "COUPON_MIN_ORDER",
      discountPaise: 0,
      discountLabel: null,
      appliedTo: [],
      freeShipping: false,
      cart: {
        subtotalPaise: 37800,
        discountPaise: 0,
        shippingPaise: 4500,
        taxPaise: 1800,
        totalPaise: 44100,
        lines: [
          {
            sku: "F3-45G",
            name: "Slow-Sinking Granules F3",
            pack: "45g Bottle",
            qty: 2,
            unitPricePaise: 18900,
            lineTotalPaise: 37800,
            isQualifying: true,
            isDiscounted: false,
            isExcluded: false,
            excludeReason: null,
          },
        ],
      },
      evaluationChecks: [
        {
          key: "minOrder",
          label: "Minimum Spend",
          passed: false,
          detail: "Cart subtotal (₹378) is below the required ₹999 minimum.",
        },
      ],
      stack: [],
      otherRejections: [],
    });

    render(<CouponEditor />);

    // Switch to Preview tab
    fireEvent.click(screen.getByRole("button", { name: /^preview/i }));

    // Run preview
    fireEvent.click(screen.getByRole("button", { name: /run promotion test/i }));

    expect(await screen.findByText(/promotion was not applied/i)).toBeDefined();
    expect(screen.getByText("COUPON_MIN_ORDER")).toBeDefined();
    expect(screen.getByText(/cart subtotal \(₹378\) is below the required ₹999 minimum/i)).toBeDefined();
  });
});
