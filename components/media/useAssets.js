"use client";

import { useEffect, useState } from "react";
import { media as mediaApi, site as siteApi } from "@/lib/api";

/**
 * Library rows by id, shared across every slot on a page.
 *
 * Content stores only `{ assetId }`, so each slot needs the row to show a
 * thumbnail and check it against its placement. One module-level cache means
 * an editor page with thirty slots fetches each asset once.
 */
const cache = new Map();
const inflight = new Map();
const listeners = new Set();

export function rememberAsset(asset) {
  if (!asset?.id) return;
  cache.set(asset.id, asset);
  listeners.forEach((fn) => fn());
}

async function fetchOne(id) {
  if (cache.has(id) || inflight.has(id)) return inflight.get(id);
  const p = mediaApi
    .get(id)
    .then((row) => rememberAsset(row))
    .catch(() => cache.set(id, { id, missing: true }))
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** Map of id → library row for the given ids; re-renders as they arrive. */
export function useAssets(ids) {
  const [, bump] = useState(0);
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    if (!key) return;
    key.split(",").forEach((id) => void fetchOne(id));
  }, [key]);

  return cache;
}

/** Every `{ assetId }` inside a value. */
export function assetIdsIn(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => assetIdsIn(v, out));
  else if (value && typeof value === "object") {
    if (typeof value.assetId === "string") out.push(value.assetId);
    Object.values(value).forEach((v) => assetIdsIn(v, out));
  }
  return out;
}

let placementsPromise = null;

/** The spec's placements, keyed. Fetched once per session. */
export function usePlacements() {
  const [data, setData] = useState(null);
  useEffect(() => {
    placementsPromise ??= siteApi.placements().catch((err) => {
      placementsPromise = null;
      throw err;
    });
    placementsPromise
      .then((d) => setData(Object.fromEntries(d.placements.map((p) => [p.key, p]))))
      .catch(() => setData({}));
  }, []);
  return data;
}
