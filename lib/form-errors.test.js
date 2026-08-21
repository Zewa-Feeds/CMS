import { describe, expect, it } from "vitest";
import {
  TAB_LABELS,
  fieldTabFor,
  labelForPath,
  localKeyForPath,
  mapServerFieldErrors,
  summarise,
} from "./form-errors";

/** The exact payload the API returns for the reported bug. */
const SKU_RULE = "Use uppercase letters, numbers and hyphens only.";
const VARIANTS = [
  { sku: "ZZQA_45GX2", pack: "45g Bottle" },
  { sku: "ZZQA-100G", pack: "100g Pouch" },
];

describe("the reported bug: an invalid variant SKU", () => {
  it("1. maps the server path onto the key the input actually reads", () => {
    // The input renders errors[`variant_0_sku`]; the API says "variants.0.sku".
    expect(localKeyForPath("variants.0.sku")).toBe("variant_0_sku");
  });

  it("2. names the offending field instead of showing a bare rule", () => {
    expect(labelForPath("variants.0.sku", VARIANTS)).toBe("45g Bottle — SKU");
  });

  it("3. puts the error on the field, so it can go red", () => {
    const { errors } = mapServerFieldErrors({ "variants.0.sku": SKU_RULE }, VARIANTS);
    expect(errors).toEqual({ variant_0_sku: SKU_RULE });
  });

  it("4. routes the operator to the tab that holds it", () => {
    const { list } = mapServerFieldErrors({ "variants.0.sku": SKU_RULE }, VARIANTS);
    expect(list[0].tab).toBe("variants");
    expect(TAB_LABELS[list[0].tab]).toBe("Variants / SKUs");
  });

  it("says what is wrong and where, in one line", () => {
    const { list } = mapServerFieldErrors({ "variants.0.sku": SKU_RULE }, VARIANTS);
    expect(summarise(list)).toBe(
      "45g Bottle — SKU: Use uppercase letters, numbers and hyphens only. (Variants / SKUs tab)",
    );
  });

  it("falls back to a number when the pack has no name yet", () => {
    expect(labelForPath("variants.1.sku", [{}, {}])).toBe("Variant 2 — SKU");
  });

  it("prefers the SKU when the pack is blank", () => {
    expect(labelForPath("variants.0.pack", [{ sku: "ABC-1", pack: "  " }])).toBe("ABC-1 — Pack size");
  });
});

describe("6. multiple errors", () => {
  const fields = {
    "variants.0.sku": SKU_RULE,
    "variants.1.price": "Cannot be negative.",
    shortDesc: "Short description is required.",
  };

  it("keeps every one of them, each on its own field", () => {
    const { errors, list } = mapServerFieldErrors(fields, VARIANTS);
    expect(list).toHaveLength(3);
    expect(errors.variant_0_sku).toBe(SKU_RULE);
    expect(errors.variant_1_price).toBe("Cannot be negative.");
    expect(errors.shortDesc).toBe("Short description is required.");
  });

  it("counts the rest rather than hiding them", () => {
    const { list } = mapServerFieldErrors(fields, VARIANTS);
    expect(summarise(list)).toContain("and 2 more fields.");
  });

  it("keeps each error's own tab", () => {
    const { list } = mapServerFieldErrors(fields, VARIANTS);
    expect(list.map((e) => e.tab)).toEqual(["variants", "variants", "basic"]);
  });
});

describe("5. every tab is reachable — nothing is swallowed", () => {
  // Each field the product endpoint validates must land somewhere nameable.
  const cases = [
    ["name", "basic", "Product Name"],
    ["slug", "basic", "Family Slug"],
    ["shortDesc", "basic", "Short Description"],
    ["protein", "basic", "Protein %"],
    ["seoTitle", "basic", "SEO Title"],
    ["feedFreq", "feeding", "Feeding Frequency"],
    ["feedPortion", "feeding", "Portion Guidance"],
    ["feedNotes", "feeding", "Feeding Notes"],
    ["nutrition", "nutrition", "Nutritional Analysis"],
    ["media", "images", "Media"],
    ["representativeSku", "images", "Main Listing Variant"],
    ["variants", "variants", "Variants"],
  ];

  for (const [path, tab, label] of cases) {
    it(`${path} -> ${tab}`, () => {
      const { list } = mapServerFieldErrors({ [path]: "bad" }, VARIANTS);
      expect(list[0].tab).toBe(tab);
      expect(list[0].label).toBe(label);
    });
  }

  it("nested paths collapse onto the field that owns them", () => {
    expect(localKeyForPath("media.0.id")).toBe("media");
    expect(fieldTabFor(localKeyForPath("media.0.id"))).toBe("images");
    expect(fieldTabFor(localKeyForPath("nutrition.crudeProtein"))).toBe("nutrition");
  });

  it("an unknown field is still shown rather than dropped", () => {
    const { errors, list } = mapServerFieldErrors({ somethingNew: "nope" }, VARIANTS);
    expect(errors.somethingNew).toBe("nope");
    expect(list[0].label).toBe("somethingNew");
    expect(summarise(list)).toContain("nope");
  });

  it("a whole-form error is named too", () => {
    expect(labelForPath("_root")).toBe("This product");
  });
});

describe("7. local validation keys keep working", () => {
  // reportInvalid() feeds its own keys through the same routing.
  it("routes the editor's own keys to the same tabs", () => {
    expect(fieldTabFor("variant_3_sku")).toBe("variants");
    expect(fieldTabFor("name")).toBe("basic");
    expect(fieldTabFor("media")).toBe("images");
    expect(fieldTabFor("protein")).toBe("basic");
  });

  it("defaults to Basic Info rather than throwing on junk", () => {
    expect(fieldTabFor("")).toBe("basic");
    expect(fieldTabFor(undefined)).toBe("basic");
    expect(fieldTabFor("totally_unknown")).toBe("basic");
  });

  it("survives an empty or missing field map", () => {
    expect(mapServerFieldErrors(undefined).list).toEqual([]);
    expect(mapServerFieldErrors({}).errors).toEqual({});
    expect(summarise([])).toBe("Fix the highlighted fields.");
  });
});
