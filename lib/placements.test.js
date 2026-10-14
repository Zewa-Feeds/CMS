/**
 * The CMS's instant placement checks must say exactly what the API's publish
 * gate says. These fixtures mirror Backend/src/modules/site/placements.test.ts
 * (the placement objects below are copies of the API's, which the CMS fetches
 * at runtime) — if either side changes wording or thresholds, one suite fails.
 */
import { describe, expect, it } from "vitest";
import { requirementLine, validateAsset } from "./placements";

const P = {
  bannerDesktop: { key: "home.hero.banner.desktop", label: "Hero banner — desktop", kind: "IMAGE", formats: ["jpg", "jpeg", "png", "webp", "avif"], recommendedFormats: ["jpg", "jpeg", "webp"], width: 1920, height: 814, minWidth: 1600, minHeight: 678, ratio: [1920, 814], fit: "contain" },
  milestone: { key: "about.milestone", label: "Milestone photo", kind: "IMAGE", formats: ["jpg", "jpeg", "png", "webp", "avif"], recommendedFormats: ["jpg", "jpeg", "webp"], width: 1360, height: 850, minWidth: 680, minHeight: 425, ratio: [16, 10], fit: "cover" },
  cover: { key: "article.cover", label: "Article cover", kind: "IMAGE", formats: ["jpg", "jpeg", "png", "webp", "avif"], recommendedFormats: ["jpg", "jpeg", "webp"], width: 2000, height: 1125, minWidth: 1600, minHeight: 900, ratio: [16, 9], fit: "cover" },
  logo: { key: "about.logo", label: "Institution logo", kind: "IMAGE", formats: ["jpg", "jpeg", "png", "webp", "avif"], recommendedFormats: ["png", "webp", "avif"], width: 470, height: 290, minWidth: 156, minHeight: 96, ratio: null, fit: "contain", transparentPreferred: true },
};
const img = (format, width, height) => ({ type: "IMAGE", format, width, height });

describe("validateAsset (mirrors the API)", () => {
  it("refuses a video in an image slot", () => {
    expect(validateAsset(P.bannerDesktop, { type: "VIDEO", format: "mp4", width: 1920, height: 814 })).toEqual([
      { level: "error", message: "Hero banner — desktop needs an image." },
    ]);
  });
  it("warns on an off-ratio milestone photo with the same wording", () => {
    expect(validateAsset(P.milestone, img("jpg", 2210, 3072))).toEqual([
      { level: "warning", message: "Ratio is 0.72:1 but the slot is 16:10 — the edges will be cropped." },
    ]);
  });
  it("warns on an undersized cover", () => {
    expect(validateAsset(P.cover, img("jpg", 1024, 576))[0].message).toContain("smaller than the 2000×1125");
  });
  it("asks for a transparent PNG logo", () => {
    expect(validateAsset(P.logo, img("jpg", 470, 290))[0].message).toBe(
      "Institution logo should be a transparent PNG — a JPG will show its background.",
    );
  });
  it("tolerates a rounding pixel", () => {
    expect(validateAsset(P.cover, img("jpg", 2000, 1124))).toEqual([]);
  });
  it("summarises the requirement in one line", () => {
    expect(requirementLine(P.cover)).toBe("2000×1125 · 16:9 · JPG/JPEG/WEBP · cover");
  });
});
