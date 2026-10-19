/**
 * Article category colour — mirror of Backend/src/modules/site/categoryColor.ts.
 *
 * The site colours an article by its CATEGORY, never per article, so the editor
 * shows this as a preview only. The SAME fixtures are asserted here and in the
 * backend test, so the two copies cannot drift apart unnoticed.
 */
export const CATEGORY_COLORS = {
  NUTRITION: "#fb923c",
  BIOLOGY: "#44e5c2",
  "FEED SCIENCE": "#60a5fa",
  SCIENCE: "#38bdf8",
  SUSTAINABILITY: "#4ade80",
  HATCHERY: "#f472b6",
  "SPECIES GUIDE": "#a78bfa",
  GUPPY: "#facc15",
};

export const FALLBACK_PALETTE = ["#f87171", "#34d399", "#c084fc", "#fbbf24", "#22d3ee", "#e879f9", "#a3e635", "#fda4af"];

export function categoryColor(category) {
  const key = String(category ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!key) return "#44e5c2";
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}
