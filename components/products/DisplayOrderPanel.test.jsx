/**
 * Catalogue order panel.
 *
 * PRODUCT order — the sequence products appear in on the storefront. What
 * matters here is that the list renders in the order the API gave, that both
 * ways of reordering produce the same array, that Save sends the whole
 * sequence exactly once, and that an EDITOR cannot reorder at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const productDisplayOrder = vi.fn();
const reorderProducts = vi.fn();
const push = vi.fn();

vi.mock("@/lib/store", () => ({
  useData: (selector) => selector({ productDisplayOrder, reorderProducts }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ push }) }));

const { DisplayOrderPanel } = await import("./DisplayOrderPanel");

const ROWS = [
  { slug: "guppy-bites", name: "Guppy Bites G2", category: "Slow-Sinking Granules", status: "ACTIVE", position: 0 },
  { slug: "goldfish-bites", name: "Goldfish Bites K4", category: "Slow-Sinking Granules", status: "ACTIVE", position: 1 },
  { slug: "koi-bites", name: "Koi Bites K7", category: "Floating Pellets", status: "COMING_SOON", position: 2 },
];

/** Product names in the order the list currently renders them. */
const rendered = () =>
  [...document.querySelectorAll("[data-order-row]")].map((li) => li.getAttribute("data-order-row"));

const renderPanel = async (props = {}) => {
  const view = render(<DisplayOrderPanel editable onClose={() => {}} {...props} />);
  await waitFor(() => expect(rendered().length).toBe(ROWS.length));
  return view;
};

beforeEach(() => {
  productDisplayOrder.mockReset().mockResolvedValue(ROWS);
  reorderProducts.mockReset().mockImplementation(async (order) =>
    order.map((slug, i) => ({ ...ROWS.find((r) => r.slug === slug), position: i })),
  );
  push.mockReset();
});

afterEach(cleanup);

describe("rendering", () => {
  it("shows a loading state before the order arrives", () => {
    let resolve;
    productDisplayOrder.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<DisplayOrderPanel editable onClose={() => {}} />);
    expect(screen.getByLabelText("Loading catalogue order")).toBeDefined();
    act(() => resolve(ROWS));
  });

  it("renders products in the order the API returned", async () => {
    await renderPanel();
    expect(rendered()).toEqual(["guppy-bites", "goldfish-bites", "koi-bites"]);
  });

  it("numbers positions from 01, not from the stored value", async () => {
    await renderPanel();
    expect(screen.getByText("01")).toBeDefined();
    expect(screen.getByText("03")).toBeDefined();
  });

  it("shows the slug and category so two similar products can be told apart", async () => {
    await renderPanel();
    expect(screen.getByText(/guppy-bites/)).toBeDefined();
    expect(screen.getAllByText(/Floating Pellets/).length).toBeGreaterThan(0);
  });

  it("shows an error and a retry when loading fails", async () => {
    productDisplayOrder.mockRejectedValue(new Error("network down"));
    render(<DisplayOrderPanel editable onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("network down")).toBeDefined());
    expect(screen.getByText("Try again")).toBeDefined();
  });
});

describe("reordering", () => {
  it("moves a product down with the keyboard-accessible button", async () => {
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    expect(rendered()).toEqual(["goldfish-bites", "guppy-bites", "koi-bites"]);
  });

  it("moves a product up", async () => {
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Koi Bites K7 up to position 2"));
    expect(rendered()).toEqual(["guppy-bites", "koi-bites", "goldfish-bites"]);
  });

  it("cannot move the first product up or the last one down", async () => {
    await renderPanel();
    expect(screen.getByLabelText("Move Guppy Bites G2 up to position 0").disabled).toBe(true);
    expect(screen.getByLabelText("Move Koi Bites K7 down to position 4").disabled).toBe(true);
  });

  it("reorders by drag and drop", async () => {
    await renderPanel();
    const rows = document.querySelectorAll("[data-order-row]");
    const dataTransfer = { effectAllowed: "", setData: vi.fn() };

    fireEvent.dragStart(rows[2], { dataTransfer });   // Koi
    fireEvent.dragEnter(rows[0]);
    fireEvent.dragOver(rows[0]);
    fireEvent.drop(rows[0], { dataTransfer });

    expect(rendered()).toEqual(["koi-bites", "guppy-bites", "goldfish-bites"]);
  });

  it("marks the panel unsaved once the order changes", async () => {
    await renderPanel();
    expect(screen.queryByText("Unsaved")).toBeNull();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    expect(screen.getByText("Unsaved")).toBeDefined();
  });

  it("reverts back to the saved order", async () => {
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    fireEvent.click(screen.getByText("Revert"));
    expect(rendered()).toEqual(["guppy-bites", "goldfish-bites", "koi-bites"]);
  });
});

describe("saving", () => {
  it("sends the complete new sequence", async () => {
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    fireEvent.click(screen.getByText("Save order"));

    await waitFor(() => expect(reorderProducts).toHaveBeenCalledTimes(1));
    expect(reorderProducts).toHaveBeenCalledWith(["goldfish-bites", "guppy-bites", "koi-bites"]);
  });

  it("confirms success", async () => {
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    fireEvent.click(screen.getByText("Save order"));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("saved")));
  });

  it("does nothing when nothing changed", async () => {
    await renderPanel();
    expect(screen.getByText("Save order").disabled).toBe(true);
    fireEvent.click(screen.getByText("Save order"));
    expect(reorderProducts).not.toHaveBeenCalled();
  });

  it("does not fire twice on a double-click", async () => {
    let release;
    reorderProducts.mockImplementation(() => new Promise((r) => { release = r; }));
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));

    const save = screen.getByText("Save order").closest("button");
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);

    expect(reorderProducts).toHaveBeenCalledTimes(1);
    await act(async () => release([]));
  });

  it("surfaces the server's message on failure and keeps the edit", async () => {
    reorderProducts.mockRejectedValue(new Error("The catalogue changed while you were reordering it."));
    await renderPanel();
    fireEvent.click(screen.getByLabelText("Move Guppy Bites G2 down to position 2"));
    fireEvent.click(screen.getByText("Save order"));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "The catalogue changed while you were reordering it.",
        { bad: true },
      ),
    );
    // The operator's work is not thrown away by a failed save.
    expect(rendered()).toEqual(["goldfish-bites", "guppy-bites", "koi-bites"]);
  });
});

describe("permissions", () => {
  it("gives a read-only viewer no way to reorder", async () => {
    await renderPanel({ editable: false });

    expect(screen.queryByText("Save order")).toBeNull();
    expect(screen.queryByText("Revert")).toBeNull();
    expect(document.querySelectorAll('[aria-label^="Move "]').length).toBe(0);
  });

  it("does not make rows draggable for a read-only viewer", async () => {
    await renderPanel({ editable: false });
    for (const li of document.querySelectorAll("[data-order-row]")) {
      expect(li.getAttribute("draggable")).not.toBe("true");
    }
  });

  it("still lets a read-only viewer see the order", async () => {
    await renderPanel({ editable: false });
    expect(rendered()).toEqual(["guppy-bites", "goldfish-bites", "koi-bites"]);
  });
});
