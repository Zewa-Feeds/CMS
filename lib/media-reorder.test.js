import { describe, expect, it } from "vitest";

/**
 * Reordering algorithm extracted from MediaManager for deterministic unit testing.
 */
function moveWithinGroup(media, groupItems, fromGroupIdx, toGroupIdx, insertPosition = "after") {
  if (
    fromGroupIdx === null ||
    toGroupIdx === null ||
    fromGroupIdx < 0 ||
    fromGroupIdx >= groupItems.length ||
    toGroupIdx < 0 ||
    toGroupIdx >= groupItems.length
  ) {
    return media;
  }

  const reorderedGroup = [...groupItems];
  const [dragged] = reorderedGroup.splice(fromGroupIdx, 1);

  let destinationIndex = toGroupIdx;
  if (fromGroupIdx < toGroupIdx) {
    destinationIndex = insertPosition === "before" ? toGroupIdx - 1 : toGroupIdx;
  } else {
    destinationIndex = insertPosition === "before" ? toGroupIdx : toGroupIdx + 1;
  }

  destinationIndex = Math.max(0, Math.min(destinationIndex, reorderedGroup.length));
  if (destinationIndex === fromGroupIdx) {
    return media;
  }

  reorderedGroup.splice(destinationIndex, 0, dragged);

  const slots = groupItems.map((m) => m._i);
  const next = [...media];
  slots.forEach((slotIndex, i) => {
    const item = reorderedGroup[i];
    const { _i, ...cleanItem } = item;
    next[slotIndex] = cleanItem;
  });

  return next;
}

const img = (id, skus = []) => ({ id, url: `https://cdn/${id}.jpg`, skus });

describe("MediaManager Drag & Drop Reordering", () => {
  it("reorders items in a simple shared list (forward drag, drop after)", () => {
    const media = [img("s1"), img("s2"), img("s3")];
    const groupItems = media.map((m, i) => ({ ...m, _i: i }));

    // Drag s1 (index 0) to drop after s3 (index 2)
    const result = moveWithinGroup(media, groupItems, 0, 2, "after");
    expect(result.map((m) => m.id)).toEqual(["s2", "s3", "s1"]);
  });

  it("reorders items in a simple shared list (backward drag, drop before)", () => {
    const media = [img("s1"), img("s2"), img("s3")];
    const groupItems = media.map((m, i) => ({ ...m, _i: i }));

    // Drag s3 (index 2) to drop before s1 (index 0)
    const result = moveWithinGroup(media, groupItems, 2, 0, "before");
    expect(result.map((m) => m.id)).toEqual(["s3", "s1", "s2"]);
  });

  it("reorders items in an interleaved multi-variant list without touching other variants", () => {
    // Interleaved media array:
    // Slot 0: Shared 1
    // Slot 1: VarA 1
    // Slot 2: VarB 1
    // Slot 3: VarA 2
    // Slot 4: VarB 2
    // Slot 5: VarA 3
    const media = [
      img("shared1", []),
      img("varA1", ["SKU-A"]),
      img("varB1", ["SKU-B"]),
      img("varA2", ["SKU-A"]),
      img("varB2", ["SKU-B"]),
      img("varA3", ["SKU-A"]),
    ];

    // Filtered items for Variant A
    const indexed = media.map((m, i) => ({ ...m, _i: i }));
    const ownItemsVarA = indexed.filter((m) => m.skus.includes("SKU-A"));
    expect(ownItemsVarA.map((m) => m.id)).toEqual(["varA1", "varA2", "varA3"]);
    expect(ownItemsVarA.map((m) => m._i)).toEqual([1, 3, 5]);

    // Drag VarA3 (group index 2) to drop before VarA1 (group index 0)
    const result = moveWithinGroup(media, ownItemsVarA, 2, 0, "before");

    // VarA items should now be in order: varA3, varA1, varA2
    // And other items should remain in slots 0, 2, 4
    expect(result).toEqual([
      img("shared1", []),
      img("varA3", ["SKU-A"]),
      img("varB1", ["SKU-B"]),
      img("varA1", ["SKU-A"]),
      img("varB2", ["SKU-B"]),
      img("varA2", ["SKU-A"]),
    ]);

    // Check that Variant B's relative order is completely unaffected
    const varBItems = result.filter((m) => m.skus.includes("SKU-B"));
    expect(varBItems.map((m) => m.id)).toEqual(["varB1", "varB2"]);
  });

  it("drag target 'before' vs 'after' on adjacent elements", () => {
    const media = [img("a"), img("b"), img("c"), img("d")];
    const groupItems = media.map((m, i) => ({ ...m, _i: i }));

    // Drag 'a' to drop before 'c' -> [b, a, c, d]
    const resBefore = moveWithinGroup(media, groupItems, 0, 2, "before");
    expect(resBefore.map((m) => m.id)).toEqual(["b", "a", "c", "d"]);

    // Drag 'a' to drop after 'c' -> [b, c, a, d]
    const resAfter = moveWithinGroup(media, groupItems, 0, 2, "after");
    expect(resAfter.map((m) => m.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("does not mutate or corrupt the original array if dropped on self", () => {
    const media = [img("a"), img("b"), img("c")];
    const groupItems = media.map((m, i) => ({ ...m, _i: i }));

    const result = moveWithinGroup(media, groupItems, 1, 1, "before");
    expect(result).toEqual(media);
  });

  it("safely handles out-of-bounds indices", () => {
    const media = [img("a"), img("b")];
    const groupItems = media.map((m, i) => ({ ...m, _i: i }));

    expect(moveWithinGroup(media, groupItems, -1, 1)).toEqual(media);
    expect(moveWithinGroup(media, groupItems, 0, 5)).toEqual(media);
  });
});
