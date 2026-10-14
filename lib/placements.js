/**
 * Placement checks, client side — the same rules as the API's
 * src/modules/site/placements.ts, applied instantly as an editor picks a file.
 *
 * The placement DATA (sizes, ratios, formats) is fetched from the API
 * (/admin/site/placements), so there is one copy of the spec. Only this small
 * pure function is mirrored; lib/placements.test.js pins it to the server's
 * behaviour on the cases that matter. The server re-checks everything at
 * publish — this is for feedback, not enforcement.
 */

const RATIO_TOLERANCE = 0.03;

const ratioLabel = ([w, h]) => {
  const r = w / h;
  return Number.isInteger(r) ? `${r}:1` : w > 100 ? `${(w / h).toFixed(2)}:1` : `${w}:${h}`;
};

/** @returns {{ level: "error"|"warning", message: string }[]} */
export function validateAsset(p, asset) {
  if (!p || !asset) return [];
  const issues = [];
  const err = (message) => issues.push({ level: "error", message });
  const warn = (message) => issues.push({ level: "warning", message });

  if (asset.type !== p.kind) {
    err(`${p.label} needs ${p.kind === "VIDEO" ? "a video" : "an image"}.`);
    return issues;
  }

  const format = asset.format?.toLowerCase() ?? null;
  if (format && !p.formats.includes(format)) {
    err(`${p.label} must be ${p.formats.map((f) => f.toUpperCase()).join(" or ")} — this file is ${format.toUpperCase()}.`);
  } else if (format && !p.recommendedFormats.includes(format)) {
    warn(
      p.transparentPreferred
        ? `${p.label} should be a transparent ${(p.recommendedFormats[0] ?? "png").toUpperCase()} — a ${format.toUpperCase()} will show its background.`
        : `The spec recommends ${p.recommendedFormats.map((f) => f.toUpperCase()).join("/")} here.`,
    );
  }

  if (!asset.width || !asset.height) {
    warn("Dimensions are unknown, so size and ratio could not be checked.");
    return issues;
  }

  if ((p.minWidth && asset.width < p.minWidth) || (p.minHeight && asset.height < p.minHeight)) {
    warn(`${asset.width}×${asset.height} is smaller than the ${p.height ? `${p.width}×${p.height}` : `${p.width}px width`} the spec asks for — it will look soft on retina screens.`);
  }

  if (p.ratio) {
    const want = p.ratio[0] / p.ratio[1];
    const have = asset.width / asset.height;
    if (Math.abs(have - want) / want > RATIO_TOLERANCE) {
      warn(
        p.fit === "cover"
          ? `Ratio is ${have.toFixed(2)}:1 but the slot is ${ratioLabel(p.ratio)} — the edges will be cropped.`
          : `Ratio is ${have.toFixed(2)}:1 but the slot is ${ratioLabel(p.ratio)} — it will be letterboxed.`,
      );
    }
  } else if (p.fit === "contain" && asset.width / asset.height > 3) {
    warn("Very wide files render tiny in a height-capped slot.");
  }

  return issues;
}

/** "1920×814 · 2.36:1 · JPG/WebP · cover" — the requirement, in one line. */
export function requirementLine(p) {
  if (!p) return "";
  const size = p.width && p.height ? `${p.width}×${p.height}` : "any size";
  const ratio = p.ratio ? ratioLabel(p.ratio) : "any ratio";
  return `${size} · ${ratio} · ${p.recommendedFormats.map((f) => f.toUpperCase()).join("/")} · ${p.fit}`;
}

export function prettyBytes(n) {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}
