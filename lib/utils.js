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
  if (units === 0) return "Out of Stock";
  if (units < 10) return "Low Stock";
  return "In Stock";
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
