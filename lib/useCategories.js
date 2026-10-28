"use client";

import { useCallback, useEffect, useState } from "react";
import { categories as categoriesApi } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";

/**
 * Product categories from the API (Products → Categories), shared by the
 * product form and the products list.
 *
 * Module-level cache so moving between pages doesn't refetch; `reload` after a
 * change. Until the first response, and if it fails, falls back to the built-in
 * list so the form still works offline from the API.
 */
let cache = null;

export function useCategories() {
  const [list, setList] = useState(cache);

  const reload = useCallback(async () => {
    try {
      cache = await categoriesApi.list();
      setList(cache);
    } catch {
      // Keep whatever we had; the fallback below covers a first-load failure.
    }
  }, []);

  useEffect(() => {
    if (!cache) reload();
  }, [reload]);

  const all = list ?? CATEGORIES.map((label) => ({ code: label, label, isActive: true, productCount: 0 }));
  return {
    all,
    /** Labels offered for new products. */
    activeLabels: all.filter((c) => c.isActive).map((c) => c.label),
    /** Every label, hidden included — for filtering existing products. */
    allLabels: all.map((c) => c.label),
    loaded: !!list,
    reload,
  };
}

/** Call after any category change so every page's next mount refetches. */
export function invalidateCategories() {
  cache = null;
}
