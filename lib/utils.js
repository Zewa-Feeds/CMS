import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge tailwind class names, resolving conflicts (shadcn convention). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees, e.g. 1847 -> "₹1,847". */
export function inr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/** Slugify a product/article name. */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stock status derived from unit count (spec §5.1). */
export function stockStatus(units) {
  if (units <= 0) return "Out of Stock";
  if (units < 10) return "Low Stock";
  return "In Stock";
}

/**
 * A product's stock state judged per SKU, not by the family total (mirrors
 * Backend skuStockSummary). A total hid empty packs: Micro Pellets M3 read
 * "In Stock · 26" with two packs at 0. Any active SKU at 0 → Out of Stock;
 * any under 10 → Low Stock. Switched-off SKUs don't count.
 *
 * `stockOf` lets the stock modal judge the numbers being typed.
 */
export function skuStockSummary(variants = [], stockOf = (v) => Number(v.stock) || 0) {
  const active = variants.filter((v) => v.isActive !== false);
  const out = active.filter((v) => stockOf(v) <= 0).length;
  const low = active.filter((v) => stockOf(v) > 0 && stockOf(v) < 10).length;
  const worst = active.length === 0 || out > 0 ? "Out of Stock" : low > 0 ? "Low Stock" : "In Stock";
  return { worst, out, low, activeSkus: active.length };
}

/** "Out of Stock · 2 SKUs", "Low Stock · 1 SKU", "In Stock · 26". */
export function skuStockLabel(summary, total) {
  const n = (k) => `${k} SKU${k === 1 ? "" : "s"}`;
  if (summary.worst === "Out of Stock") return summary.out > 0 ? `Out of Stock · ${n(summary.out)}` : "Out of Stock";
  if (summary.worst === "Low Stock") return `Low Stock · ${n(summary.low)}`;
  return `In Stock · ${total}`;
}

/**
 * Sanitize numeric stock input:
 * - Allows empty string while the operator is editing/backspacing.
 * - Strips non-digits and leading zeros so typing "10" into "0" yields "10", not "010".
 * - Keeps a solitary "0" intact.
 */
export function sanitizeStockInput(raw) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (str === "") return "";
  const digits = str.replace(/[^\d]/g, "");
  if (digits === "") return "";
  return digits.replace(/^0+(?=\d)/, "");
}

/** Deterministic initials from a name, for avatars/thumbs. */
export function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}
