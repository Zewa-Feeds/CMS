/**
 * Pack stock in the product editor.
 *
 * Publishing never writes stock to a saved pack, so the editor must not offer
 * an input whose value would be silently ignored. A saved pack shows its LIVE
 * count (not the draft's stale copy) with an "Update stock" action that opens
 * the stock tool; a pack added in this session keeps an input for its
 * initial stock, because publishing does create it with that value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const getProduct = vi.fn();
const updateStock = vi.fn();
const push = vi.fn();
let permissions = ["products.view", "products.edit", "products.sku"];

const store = {
  createProduct: vi.fn(), saveProduct: vi.fn(), publishProduct: vi.fn(), discardProductDraft: vi.fn(),
  productPreviewToken: vi.fn(), deleteProduct: vi.fn(), uploadAsset: vi.fn(), getProduct, updateStock,
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/store", () => ({
  useData: (selector) => selector(store),
  useAuth: (selector) => selector({ permissions }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ push }) }));
vi.mock("@/lib/useCategories", () => ({ useCategories: () => ({ activeLabels: ["Betta"], allLabels: ["Betta"] }) }));
vi.mock("@/components/products/MediaManager", () => ({ default: () => null }));
vi.mock("@/components/ui/RichText", () => ({ RichText: () => null }));

const { ProductEditor } = await import("./ProductEditor");

/** Live rows say 7 and 3; a pending draft still carries the 10s the editor loaded hours ago. */
const PRODUCT = {
  slug: "betta-bites", name: "Betta Bites", category: "Betta", status: "ACTIVE",
  variants: [
    { id: "v1", sku: "F3-45G", pack: "45g Bottle", mrp: 249, price: 185, stock: 7, hsn: "23099090", isActive: true },
    { id: "v2", sku: "F3-1KG", pack: "1kg Pouch", mrp: 1785, price: 1430, stock: 3, hsn: "23099090", isActive: true },
  ],
  media: [],
  hasDraft: true,
  draftPayload: {
    name: "Betta Bites", category: "Betta",
    variants: [
      { id: "v1", sku: "F3-45G", pack: "45g Bottle", mrp: "249", price: "185", stock: 10, hsn: "23099090", isActive: true },
      { id: "v2", sku: "F3-1KG", pack: "1kg Pouch", mrp: "1785", price: "1430", stock: 10, hsn: "23099090", isActive: true },
    ],
    media: [],
  },
};

const openVariants = () => fireEvent.click(screen.getByRole("button", { name: /Variants \/ SKUs/ }));
const stockCell = (i) => screen.getByTestId(`live-stock-${i}`);

beforeEach(() => {
  permissions = ["products.view", "products.edit", "products.sku"];
  getProduct.mockReset();
  updateStock.mockReset().mockResolvedValue({});
  push.mockReset();
});
afterEach(cleanup);

describe("saved packs", () => {
  it("show LIVE stock read-only, not the draft's copy", () => {
    render(<ProductEditor initial={PRODUCT} />);
    openVariants();
    expect(stockCell(0).textContent).toContain("7");
    expect(stockCell(1).textContent).toContain("3");
    // No stock input for either saved pack.
    expect(within(stockCell(0)).queryByRole("spinbutton")).toBeNull();
    expect(within(stockCell(1)).queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByTestId("new-stock-0")).toBeNull();
    expect(screen.queryByTestId("new-stock-1")).toBeNull();
  });

  it("open the stock tool, and show the new count after it saves", async () => {
    getProduct.mockResolvedValue({ ...PRODUCT, variants: [{ ...PRODUCT.variants[0], stock: 20 }, PRODUCT.variants[1]] });
    render(<ProductEditor initial={PRODUCT} />);
    openVariants();
    fireEvent.click(within(stockCell(0)).getByRole("button", { name: "Update stock" }));

    const dialog = await screen.findByRole("dialog");
    const inputs = within(dialog).getAllByRole("spinbutton");
    // The stock tool lists the LIVE counts.
    expect(inputs.map((el) => el.value)).toEqual(["7", "3"]);
    fireEvent.change(inputs[0], { target: { value: "20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update Stock" }));

    await waitFor(() => expect(updateStock).toHaveBeenCalledWith("betta-bites", [{ sku: "F3-45G", stock: 20 }]));
    await waitFor(() => expect(stockCell(0).textContent).toContain("20"));
    expect(getProduct).toHaveBeenCalledWith("betta-bites");
  });

  it("hide the Update stock action from users without stock permission", () => {
    permissions = ["products.view", "products.edit"];
    render(<ProductEditor initial={PRODUCT} />);
    openVariants();
    expect(stockCell(0).textContent).toContain("7");
    expect(screen.queryByRole("button", { name: "Update stock" })).toBeNull();
  });
});

describe("new packs", () => {
  it("keep an editable initial-stock input", () => {
    render(<ProductEditor initial={PRODUCT} />);
    openVariants();
    fireEvent.click(screen.getByRole("button", { name: /Add SKU/i }));
    // The new pack is the third row; the two saved packs stay read-only.
    const input = screen.getByTestId("new-stock-2");
    fireEvent.change(input, { target: { value: "12" } });
    expect(input.value).toBe("12");
    expect(screen.queryByTestId("new-stock-0")).toBeNull();
    expect(screen.getByTestId("live-stock-0").textContent).toContain("7");
  });
});
