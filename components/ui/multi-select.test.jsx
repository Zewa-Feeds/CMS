/**
 * The orders filter bar must let an operator tick SEVERAL statuses at once.
 *
 * A single-value `<select>` could only answer "show me cancelled orders", never
 * "show me shipped AND delivered". These pin the behaviour the checkbox
 * dropdown replaced it with — including the two states that are easy to get
 * wrong: an empty selection must read as "All" (not as a blank button), and
 * unticking the last box must return to that state rather than leaving an empty
 * array that filters everything out.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MultiSelect } from "@/components/ui/Field";

afterEach(cleanup);

const OPTIONS = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((s) => ({
  value: s,
  label: s,
}));

/** Renders with the given selection and returns the trigger + the onChange spy. */
function setup(value = []) {
  const onChange = vi.fn();
  render(
    <MultiSelect value={value} onChange={onChange} options={OPTIONS} allLabel="All statuses" />
  );
  return { onChange, trigger: screen.getByRole("button", { expanded: false }) };
}

const open = (trigger) => fireEvent.click(trigger);
const box = (label) => screen.getByRole("option", { name: label }).querySelector("input");

describe("MultiSelect, as the orders status filter uses it", () => {
  it("reads as 'All statuses' when nothing is selected", () => {
    const { trigger } = setup([]);
    expect(trigger.textContent).toContain("All statuses");
  });

  it("names the single choice, and counts several", () => {
    setup(["Shipped"]);
    expect(screen.getByRole("button").textContent).toContain("Shipped");
    cleanup();
    setup(["Shipped", "Delivered"]);
    expect(screen.getByRole("button").textContent).toContain("2 selected");
  });

  it("opens on click and ticks only the selected boxes", () => {
    const { trigger } = setup(["Shipped"]);
    open(trigger);
    expect(box("Shipped").checked).toBe(true);
    expect(box("Delivered").checked).toBe(false);
  });

  it("ADDS a status instead of replacing the current one", () => {
    const { trigger, onChange } = setup(["Shipped"]);
    open(trigger);
    fireEvent.click(box("Delivered"));
    expect(onChange).toHaveBeenCalledWith(["Shipped", "Delivered"]);
  });

  it("removes a status when its box is unticked", () => {
    const { trigger, onChange } = setup(["Shipped", "Delivered"]);
    open(trigger);
    fireEvent.click(box("Shipped"));
    expect(onChange).toHaveBeenCalledWith(["Delivered"]);
  });

  it("returns an EMPTY array when the last box is unticked, which means 'no filter'", () => {
    const { trigger, onChange } = setup(["Shipped"]);
    open(trigger);
    fireEvent.click(box("Shipped"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("stays open while several boxes are ticked", () => {
    const { trigger } = setup(["Shipped"]);
    open(trigger);
    fireEvent.click(box("Delivered"));
    // A dropdown that closed on each tick would make multi-select unusable.
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("offers Clear only once something is selected", () => {
    const { trigger } = setup([]);
    open(trigger);
    expect(screen.queryByText("Clear selection")).toBeNull();
    cleanup();

    const second = setup(["Shipped"]);
    open(second.trigger);
    fireEvent.click(screen.getByText("Clear selection"));
    expect(second.onChange).toHaveBeenCalledWith([]);
  });

  it("closes on an outside click and on Escape", () => {
    const { trigger } = setup([]);
    open(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();

    open(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows an unknown value (from a stale URL) rather than a blank button", () => {
    setup(["Archived"]);
    expect(screen.getByRole("button").textContent).toContain("Archived");
  });
});
