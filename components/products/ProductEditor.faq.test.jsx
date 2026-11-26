/**
 * FAQ tab in the product editor.
 *
 * Loads the product's FAQs (from a pending draft when there is one), lets an
 * editor add, edit, reorder and remove them, and sends them in the save payload
 * in order, with fully blank rows dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const saveProduct = vi.fn();
const push = vi.fn();
const store = {
  createProduct: vi.fn(), saveProduct, publishProduct: vi.fn(), discardProductDraft: vi.fn(),
  productPreviewToken: vi.fn(), deleteProduct: vi.fn(), uploadAsset: vi.fn(), getProduct: vi.fn(), updateStock: vi.fn(),
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/store", () => ({
  useData: (selector) => selector(store),
  useAuth: (selector) => selector({ permissions: ["products.view", "products.edit", "products.sku"] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ push }) }));
vi.mock("@/lib/useCategories", () => ({ useCategories: () => ({ activeLabels: ["Betta"], allLabels: ["Betta"] }) }));
vi.mock("@/components/products/MediaManager", () => ({ default: () => null }));
vi.mock("@/components/ui/RichText", () => ({ RichText: () => null }));

const { ProductEditor } = await import("./ProductEditor");

const PRODUCT = {
  slug: "betta-bites", name: "Betta Bites", category: "Betta", status: "ACTIVE", shortDesc: "Short.",
  variants: [{ id: "v1", sku: "F3-45G", pack: "45g Bottle", mrp: 249, price: 185, stock: 7, hsn: "23099090", isActive: true }],
  media: [],
  faq: [
    { q: "How many pellets should I feed my betta?", a: "Feed 4–6 pellets twice daily." },
    { q: "Is it suitable for fry?", a: "Use Hatch'E for fry." },
  ],
};

const openFaq = () => fireEvent.click(screen.getByRole("button", { name: /^FAQ$/ }));
const q = (i) => screen.getByLabelText(`FAQ ${i} question`);
const a = (i) => screen.getByLabelText(`FAQ ${i} answer`);
const save = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
  await waitFor(() => expect(saveProduct).toHaveBeenCalled());
  return saveProduct.mock.calls.at(-1)[1];
};

beforeEach(() => { saveProduct.mockReset().mockResolvedValue({}); push.mockReset(); });
afterEach(cleanup);

describe("FAQ tab", () => {
  it("shows the product's FAQs in order", () => {
    render(<ProductEditor initial={PRODUCT} />);
    openFaq();
    expect(q(1).value).toBe("How many pellets should I feed my betta?");
    expect(a(2).value).toBe("Use Hatch'E for fry.");
  });

  it("loads the draft's FAQs when a draft is pending", () => {
    render(<ProductEditor initial={{ ...PRODUCT, hasDraft: true, draftPayload: { faq: [{ q: "Draft Q?", a: "Draft A." }] } }} />);
    openFaq();
    expect(q(1).value).toBe("Draft Q?");
    expect(screen.queryByLabelText("FAQ 2 question")).toBeNull();
  });

  it("saves edits, additions and order, and drops a fully blank row", async () => {
    render(<ProductEditor initial={PRODUCT} />);
    openFaq();
    fireEvent.change(a(1), { target: { value: "Feed 4–6 pellets, twice a day." } });
    fireEvent.click(screen.getByRole("button", { name: "Move FAQ 2 up" }));
    fireEvent.click(screen.getByRole("button", { name: /Add FAQ/ }));
    fireEvent.change(q(3), { target: { value: "New question?" } });
    fireEvent.change(a(3), { target: { value: "New answer." } });
    fireEvent.click(screen.getByRole("button", { name: /Add FAQ/ })); // left blank

    const payload = await save();
    expect(payload.faq).toEqual([
      { q: "Is it suitable for fry?", a: "Use Hatch'E for fry." },
      { q: "How many pellets should I feed my betta?", a: "Feed 4–6 pellets, twice a day." },
      { q: "New question?", a: "New answer." },
    ]);
  });

  it("removes an FAQ", async () => {
    render(<ProductEditor initial={PRODUCT} />);
    openFaq();
    fireEvent.click(screen.getByRole("button", { name: "Remove FAQ 1" }));
    const payload = await save();
    expect(payload.faq).toEqual([{ q: "Is it suitable for fry?", a: "Use Hatch'E for fry." }]);
  });

  it("starts empty for a product with no FAQs and sends an empty list", async () => {
    render(<ProductEditor initial={{ ...PRODUCT, faq: undefined }} />);
    openFaq();
    expect(screen.getByText(/No FAQs yet/)).toBeTruthy();
    // Save is disabled until something changes; a blank row makes it dirty and is dropped on save.
    fireEvent.click(screen.getByRole("button", { name: /Add FAQ/ }));
    const payload = await save();
    expect(payload.faq).toEqual([]);
  });
});
