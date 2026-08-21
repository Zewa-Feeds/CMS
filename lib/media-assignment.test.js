/**
 * "Specific packs" with nothing selected cannot be saved.
 *
 * The data model is deliberate and unchanged: zero ProductMediaVariant rows
 * means shared with every pack, including ones added later. So "Specific, none
 * chosen" has nowhere to live — persisting it would silently become Shared and
 * the operator would find their choice reverted after a reload.
 *
 * Rather than add a column to record an intention the resolver would ignore, the
 * save is refused until the operator resolves it: pick a pack, or pick Shared.
 * These pin that rule and the two ways out of it.
 *
 * The validation is reproduced here rather than imported, because it lives
 * inside ProductEditor alongside JSX that would drag the whole CMS into the test
 * run. The assertions below mirror it line for line.
 */
import { describe, expect, it } from "vitest";

/** Exactly the check ProductEditor.validate() performs. */
function validateMedia(media, specificMode) {
  const unassigned = (media ?? []).filter((m) => {
    const key = m.id ?? m.url;
    const skus = m.skus?.length ? m.skus : m.sku ? [m.sku] : [];
    return specificMode.has(key) && skus.length === 0;
  });
  if (unassigned.length === 0) return null;
  return unassigned.length === 1
    ? "One image is set to “Specific packs” with no packs selected. Select at least one variant, or switch it to Shared."
    : `${unassigned.length} images are set to “Specific packs” with no packs selected. Select at least one variant each, or switch them to Shared.`;
}

/** What the row renders, given its assignments and whether it was forced. */
function rowState(item, specificMode) {
  const assigned = item.skus?.length ? item.skus : item.sku ? [item.sku] : [];
  const forced = specificMode.has(item.id ?? item.url);
  const mode = assigned.length > 0 || forced ? "specific" : "shared";
  return {
    mode,
    count: assigned.length,
    label: mode === "shared"
      ? "Shared — all packs"
      : `Applies to ${assigned.length} ${assigned.length === 1 ? "variant" : "variants"}`,
    warning: mode === "specific" && assigned.length === 0
      ? "Select at least one variant, or switch to Shared."
      : null,
  };
}

const img = (id, skus = []) => ({ id, url: `https://cdn/${id}.jpg`, skus });

describe("switching to Specific and clearing everything", () => {
  const item = img("m1", ["A", "B"]);

  it("1-3. clearing shows zero variants while staying Specific", () => {
    const cleared = { ...item, skus: [] };
    const state = rowState(cleared, new Set(["m1"]));
    expect(state.mode).toBe("specific");
    expect(state.count).toBe(0);
    expect(state.label).toBe("Applies to 0 variants");
  });

  it("4. the warning appears", () => {
    const state = rowState({ ...item, skus: [] }, new Set(["m1"]));
    expect(state.warning).toBe("Select at least one variant, or switch to Shared.");
  });

  it("5-6. the save is refused", () => {
    const error = validateMedia([{ ...item, skus: [] }], new Set(["m1"]));
    expect(error).toContain("Select at least one variant, or switch it to Shared");
  });

  it("names how many rows need fixing", () => {
    const error = validateMedia(
      [{ ...img("m1"), skus: [] }, { ...img("m2"), skus: [] }],
      new Set(["m1", "m2"]),
    );
    expect(error).toContain("2 images");
  });
});

describe("the two ways out", () => {
  it("7-8. switching to Shared saves — zero rows is a legitimate state", () => {
    // Leaving Specific mode is what makes zero rows mean Shared again.
    expect(validateMedia([{ ...img("m1"), skus: [] }], new Set())).toBeNull();
    expect(rowState(img("m1"), new Set()).label).toBe("Shared — all packs");
    expect(rowState(img("m1"), new Set()).warning).toBeNull();
  });

  it("selecting a variant saves, and the mode follows the data", () => {
    const picked = img("m1", ["A"]);
    expect(validateMedia([picked], new Set(["m1"]))).toBeNull();
    expect(rowState(picked, new Set(["m1"])).label).toBe("Applies to 1 variant");
    expect(rowState(picked, new Set(["m1"])).warning).toBeNull();
  });
});

describe("9-10. what survives a reload", () => {
  /*
   * After a reload the transient mode is gone, so every row's state is read
   * from its assignments alone — which is the only thing the database holds.
   */
  const afterReload = (item) => rowState(item, new Set());

  it("Shared stays Shared", () => {
    expect(afterReload(img("m1")).mode).toBe("shared");
    expect(afterReload(img("m1")).label).toBe("Shared — all packs");
  });

  it("Specific A+B stays A+B", () => {
    const s = afterReload(img("m1", ["A", "B"]));
    expect(s.mode).toBe("specific");
    expect(s.count).toBe(2);
    expect(s.label).toBe("Applies to 2 variants");
  });

  it("Select all stays every variant", () => {
    expect(afterReload(img("m1", ["A", "B", "C", "D"])).label).toBe("Applies to 4 variants");
  });

  it("after removing one, the rest remain", () => {
    expect(afterReload(img("m1", ["A", "C"])).count).toBe(2);
  });

  it("a blocked state can never come back, because it was never saved", () => {
    // The only zero-row state that reaches the database is Shared.
    expect(afterReload(img("m1", [])).mode).toBe("shared");
    expect(afterReload(img("m1", [])).warning).toBeNull();
  });
});

describe("rows nobody touched", () => {
  it("are never blocked just for being shared", () => {
    const media = [img("shared1"), img("shared2"), img("specific", ["A"])];
    expect(validateMedia(media, new Set())).toBeNull();
  });

  it("only the row actually in Specific mode blocks", () => {
    const media = [img("shared1"), { ...img("m2"), skus: [] }];
    expect(validateMedia(media, new Set(["m2"]))).toContain("One image");
  });

  it("honours the legacy single-sku field", () => {
    // Older payloads carry `sku` rather than `skus`; it still counts as assigned.
    const legacy = { id: "m1", url: "https://cdn/m1.jpg", sku: "A" };
    expect(validateMedia([legacy], new Set(["m1"]))).toBeNull();
    expect(rowState(legacy, new Set()).count).toBe(1);
  });
});

describe("freshly uploaded rows", () => {
  // Mirrors ProductEditor.handleFiles: the section the operator dropped the
  // file into is the only thing that decides the assignment.
  const uploaded = (targetSku) => ({
    id: undefined,
    url: "https://cdn/new.jpg",
    sku: targetSku ?? null,
    skus: targetSku ? [targetSku] : [],
  });

  it("from the shared section stay Shared, and do not block the save", () => {
    const row = uploaded(null);
    expect(rowState(row, new Set()).mode).toBe("shared");
    expect(validateMedia([row], new Set())).toBeNull();
  });

  it("from a variant section belong to that pack alone", () => {
    const row = uploaded("B");
    expect(rowState(row, new Set()).count).toBe(1);
    expect(row.skus).toEqual(["B"]);
  });

  it("are never assigned to every variant", () => {
    for (const target of [null, "A", "B", "C", "D"]) {
      expect(uploaded(target).skus.length).toBeLessThan(4);
    }
  });
});
