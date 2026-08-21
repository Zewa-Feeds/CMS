/**
 * Server validation errors -> something an operator can act on.
 *
 * The API answers a failed save with a field map keyed by the request path:
 * `{ "variants.0.sku": "Use uppercase letters, numbers and hyphens only." }`.
 * The editor keys its own errors differently — `variant_0_sku` — because that
 * is what the inputs read to show a red border and an inline message. Feeding
 * the server's keys straight into that state meant nothing matched: no field
 * lit up, the tab never changed, and the toast showed a bare rule with no
 * mention of which of a product's forty-odd inputs had broken it.
 *
 * This translates between the two and names the field, so the message can say
 * WHAT is wrong and WHERE.
 */

export const TAB_LABELS = {
  basic: "Basic Info",
  variants: "Variants / SKUs",
  images: "Media",
  nutrition: "Nutritional Analysis",
  feeding: "Feeding Guide",
};

/** Editor-facing name and tab for each field the product endpoint validates. */
const FIELDS = {
  name: { label: "Product Name", tab: "basic" },
  slug: { label: "Family Slug", tab: "basic" },
  category: { label: "Category", tab: "basic" },
  status: { label: "Status", tab: "basic" },
  badge: { label: "Badge", tab: "basic" },
  shortDesc: { label: "Short Description", tab: "basic" },
  fullDesc: { label: "Full Description", tab: "basic" },
  protein: { label: "Protein %", tab: "basic" },
  benefits: { label: "Benefits", tab: "basic" },
  tags: { label: "Tags", tab: "basic" },
  seoTitle: { label: "SEO Title", tab: "basic" },
  seoDesc: { label: "SEO Description", tab: "basic" },
  feedFreq: { label: "Feeding Frequency", tab: "feeding" },
  feedPortion: { label: "Portion Guidance", tab: "feeding" },
  feedNotes: { label: "Feeding Notes", tab: "feeding" },
  nutrition: { label: "Nutritional Analysis", tab: "nutrition" },
  media: { label: "Media", tab: "images" },
  presentation: { label: "Media presentation", tab: "images" },
  representativeSku: { label: "Main Listing Variant", tab: "images" },
  variants: { label: "Variants", tab: "variants" },
};

/** Per-variant column names, matching the table headers operators see. */
const VARIANT_FIELDS = {
  sku: "SKU",
  pack: "Pack size",
  mrp: "MRP",
  price: "Price",
  stock: "Stock",
  hsn: "HSN",
  weightGrams: "Weight (g)",
  isActive: "Active",
  heroMediaId: "Main image",
  id: "Pack identity",
};

/** Which tab holds a given editor error key. Shared by local and server errors. */
export function fieldTabFor(key) {
  if (!key) return "basic";
  const variant = /^variant_(\d+)_/.exec(key);
  if (variant) return "variants";
  const root = String(key).split(/[._]/)[0];
  return FIELDS[root]?.tab ?? "basic";
}

/**
 * Name a field the way the editor labels it.
 *
 * `variants` is the form's own list, so a pack can be named rather than
 * numbered — "45g Bottle — SKU" beats "Variant 1 — SKU" when a product has
 * twelve of them.
 */
export function labelForPath(path, variants = []) {
  const m = /^variants\.(\d+)\.(.+)$/.exec(path);
  if (m) {
    const idx = Number(m[1]);
    const field = VARIANT_FIELDS[m[2]] ?? m[2];
    const v = variants[idx];
    const who = v?.pack?.trim() || v?.sku?.trim() || `Variant ${idx + 1}`;
    return `${who} — ${field}`;
  }
  if (path === "variants") return FIELDS.variants.label;
  if (path === "_root") return "This product";

  const [root, ...rest] = String(path).split(".");
  const base = FIELDS[root]?.label ?? root;
  // A nested path under a field with no inline slot of its own (nutrition.crudeProtein).
  return rest.length ? `${base} — ${rest.join(" ")}` : base;
}

/** The editor's own error key for a server path, so the input can go red. */
export function localKeyForPath(path) {
  const m = /^variants\.(\d+)\.(.+)$/.exec(path);
  if (m) return `variant_${m[1]}_${m[2]}`;
  // Nested paths collapse onto their root: `media.0.id` belongs to `media`.
  return String(path).split(".")[0];
}

/**
 * Translate a server field map into editor state plus a list to show.
 *
 * Returns the `errors` object to hand to setErrors — keyed the way the inputs
 * expect — and `list`, ordered for a summary the operator can click through.
 */
export function mapServerFieldErrors(fields, variants = []) {
  const errors = {};
  const list = [];
  for (const [path, message] of Object.entries(fields ?? {})) {
    const key = localKeyForPath(path);
    const label = labelForPath(path, variants);
    const tab = fieldTabFor(key);
    // First message per input wins, matching how the API already de-duplicates.
    errors[key] ??= message;
    list.push({ path, key, label, tab, message });
  }
  return { errors, list };
}

/** One line for a toast: what is wrong, and where to find it. */
export function summarise(list) {
  if (!list.length) return "Fix the highlighted fields.";
  const [first] = list;
  const where = TAB_LABELS[first.tab] ?? first.tab;
  const head = `${first.label}: ${first.message} (${where} tab)`;
  const rest = list.length - 1;
  return rest > 0 ? `${head} — and ${rest} more ${rest === 1 ? "field" : "fields"}.` : head;
}
