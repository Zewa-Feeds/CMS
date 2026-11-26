/**
 * Inline SKU quantity on the Products → SKUs tab.
 *
 * It must send ONLY its own SKU to the stock endpoint (never the family), save
 * on Enter or ✓, revert on Escape or ✕, refuse anything but a whole number,
 * and leave the value alone when the save fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const updateStock = vi.fn();
const push = vi.fn();
vi.mock("@/lib/store", () => ({ useData: (selector) => selector({ updateStock }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ push }) }));

const { SkuStockEditor } = await import("./SkuStockEditor");

const onSaved = vi.fn();
const renderEditor = (stock = 10) =>
  render(<SkuStockEditor slug="betta-bites" sku="F3-45G" stock={stock} onSaved={onSaved} />);
const input = () => screen.getByLabelText("Stock for F3-45G");

beforeEach(() => {
  updateStock.mockReset().mockResolvedValue({});
  push.mockReset();
  onSaved.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("SkuStockEditor", () => {
  it("shows the current quantity and no save controls until it changes", () => {
    renderEditor(10);
    expect(input().value).toBe("10");
    expect(screen.queryByLabelText("Save stock for F3-45G")).toBeNull();
  });

  it("saves only this SKU with ✓, then refreshes the list", async () => {
    renderEditor(10);
    fireEvent.change(input(), { target: { value: "25" } });
    fireEvent.click(screen.getByLabelText("Save stock for F3-45G"));

    await waitFor(() => expect(updateStock).toHaveBeenCalledWith("betta-bites", [{ sku: "F3-45G", stock: 25 }]));
    expect(updateStock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("Stock for F3-45G set to 25.");
  });

  it("saves on Enter", async () => {
    renderEditor(10);
    fireEvent.change(input(), { target: { value: "0" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() => expect(updateStock).toHaveBeenCalledWith("betta-bites", [{ sku: "F3-45G", stock: 0 }]));
  });

  it("does nothing on Enter when the value is unchanged", () => {
    renderEditor(10);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(updateStock).not.toHaveBeenCalled();
  });

  it("reverts on Escape and on ✕ without saving", () => {
    renderEditor(10);
    fireEvent.change(input(), { target: { value: "99" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().value).toBe("10");

    fireEvent.change(input(), { target: { value: "99" } });
    fireEvent.click(screen.getByLabelText("Cancel stock change for F3-45G"));
    expect(input().value).toBe("10");
    expect(updateStock).not.toHaveBeenCalled();
  });

  it("strips non-digits and refuses an empty value", () => {
    renderEditor(10);
    fireEvent.change(input(), { target: { value: "-5" } });
    expect(input().value).toBe("5");

    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(updateStock).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("Enter a whole number of 0 or more for F3-45G.", { bad: true });
  });

  it("keeps the typed value and reports the error when the save fails", async () => {
    updateStock.mockRejectedValue(new Error("You do not have permission to do that."));
    renderEditor(10);
    fireEvent.change(input(), { target: { value: "30" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    await waitFor(() => expect(push).toHaveBeenCalledWith("You do not have permission to do that.", { bad: true }));
    expect(input().value).toBe("30");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("picks up a new live value after a refetch", () => {
    const { rerender } = renderEditor(10);
    rerender(<SkuStockEditor slug="betta-bites" sku="F3-45G" stock={7} onSaved={onSaved} />);
    expect(input().value).toBe("7");
  });
});
