/**
 * The orders status filter, as it survives the URL.
 *
 * The URL owns this filter (the sidebar's New/Accepted/Shipped links set it),
 * so multi-select had to widen `?status=` WITHOUT breaking the links already
 * pointing at it. Two mappings meet here and are easy to get wrong:
 *
 *   - The sidebar's wording is not the checkbox wording. "New" and "Pending"
 *     are the same status; if the URL label were not normalised, clicking
 *     "New" in the sidebar would open the dropdown with nothing ticked.
 *   - The API wants enums, the URL holds labels. Sending a label would 422.
 */
import { describe, expect, it } from "vitest";
import { parseStatusParam, normalizeStatus, toEnumList } from "./page";

const STATUS_ENUM = {
  Pending: "PENDING",
  New: "PENDING",
  Processing: "PROCESSING",
  Accepted: "PROCESSING",
  Shipped: "SHIPPED",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED",
};

describe("reading ?status= back into checkboxes", () => {
  it("treats a missing or empty param as no filter", () => {
    expect(parseStatusParam(null)).toEqual([]);
    expect(parseStatusParam("")).toEqual([]);
  });

  it("still reads the single value the sidebar links use", () => {
    expect(parseStatusParam("Pending")).toEqual(["Pending"]);
    expect(parseStatusParam("Shipped")).toEqual(["Shipped"]);
  });

  it("maps the sidebar's OWN wording onto the checkbox labels", () => {
    // /orders?status=New and /orders?status=Accepted are real sidebar links.
    expect(parseStatusParam("New")).toEqual(["Pending"]);
    expect(parseStatusParam("Accepted")).toEqual(["Processing"]);
  });

  it("reads several statuses from one param", () => {
    expect(parseStatusParam("Shipped,Delivered")).toEqual(["Shipped", "Delivered"]);
  });

  it("tolerates spacing, casing and a raw enum from a hand-edited URL", () => {
    expect(parseStatusParam(" shipped , DELIVERED ")).toEqual(["Shipped", "Delivered"]);
  });

  it("collapses labels that mean the same status", () => {
    expect(parseStatusParam("New,Pending")).toEqual(["Pending"]);
  });

  it("drops an 'All' left over from the old single-select URL", () => {
    expect(parseStatusParam("All")).toEqual([]);
    expect(parseStatusParam("All,Shipped")).toEqual(["Shipped"]);
  });

  it("keeps an unrecognised value rather than silently dropping the filter", () => {
    expect(normalizeStatus("Archived")).toBe("Archived");
  });
});

describe("sending the selection to the API", () => {
  it("sends nothing at all when nothing is selected", () => {
    expect(toEnumList([], STATUS_ENUM)).toBeUndefined();
    expect(toEnumList(undefined, STATUS_ENUM)).toBeUndefined();
  });

  it("converts labels to a comma-separated enum list", () => {
    expect(toEnumList(["Shipped", "Delivered"], STATUS_ENUM)).toBe("SHIPPED,DELIVERED");
  });

  it("sends a single enum for a single selection", () => {
    expect(toEnumList(["Pending"], STATUS_ENUM)).toBe("PENDING");
  });

  it("de-duplicates labels that share an enum", () => {
    expect(toEnumList(["New", "Pending"], STATUS_ENUM)).toBe("PENDING");
  });
});
