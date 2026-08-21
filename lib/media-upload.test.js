import { describe, expect, it } from "vitest";
import { checkUploadFile, UPLOAD_LIMITS } from "./api";

/**
 * Queue processing and progress calculation algorithms extracted from MediaManager
 * for deterministic unit testing.
 */
function validateAndEnqueue(files, existingMedia, targetSku, currentQueue = []) {
  const rawFiles = Array.from(files ?? []);
  const newQueueItems = [];
  const rejectedItems = [];

  const hasExistingVideo = existingMedia.some((m) => m.type === "VIDEO");
  let videoQueuedInBatch = currentQueue.some(
    (q) => q.type === "VIDEO" && q.status !== "FAILED",
  );

  for (const file of rawFiles) {
    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    const resourceType = isVideo ? "video" : "image";

    if (isVideo) {
      if (hasExistingVideo || videoQueuedInBatch) {
        rejectedItems.push({
          name: file.name,
          reason: "This product already has a video. Remove it first to replace it.",
        });
        continue;
      }
      videoQueuedInBatch = true;
    }

    const validationError = checkUploadFile(file, resourceType);
    if (validationError) {
      rejectedItems.push({
        name: file.name,
        reason: validationError,
      });
      continue;
    }

    newQueueItems.push({
      name: file.name,
      size: file.size,
      type: isVideo ? "VIDEO" : "IMAGE",
      targetSku: isVideo ? null : targetSku,
      status: "QUEUED",
      progress: 0,
      error: null,
    });
  }

  return { newQueueItems, rejectedItems };
}

function calculateOverallProgress(queue) {
  if (!queue || queue.length === 0) return 0;
  const totalProgressSum = queue.reduce((acc, q) => {
    if (q.status === "READY") return acc + 100;
    if (q.status === "PROCESSING") return acc + 96;
    if (q.status === "UPLOADING") return acc + Math.round((q.progress || 0) * 0.9);
    if (q.status === "FAILED") return acc + 100;
    return acc;
  }, 0);
  return Math.min(100, Math.max(0, Math.round(totalProgressSum / queue.length)));
}

describe("MediaManager Upload Pipeline & Validation", () => {
  const createFile = (name, size, type) => ({ name, size, type });

  it("accepts valid image formats (JPEG, PNG, WebP, AVIF) under 10MB", () => {
    const validImages = [
      createFile("hero.jpg", 2 * 1024 * 1024, "image/jpeg"),
      createFile("shot.png", 5 * 1024 * 1024, "image/png"),
      createFile("thumb.webp", 1 * 1024 * 1024, "image/webp"),
      createFile("art.avif", 800 * 1024, "image/avif"),
    ];

    const { newQueueItems, rejectedItems } = validateAndEnqueue(validImages, [], null);
    expect(rejectedItems).toHaveLength(0);
    expect(newQueueItems).toHaveLength(4);
    expect(newQueueItems.every((q) => q.type === "IMAGE")).toBe(true);
  });

  it("accepts valid video formats (MP4, WebM, QuickTime) under 100MB", () => {
    const validVideo = createFile("video.mp4", 45 * 1024 * 1024, "video/mp4");
    const { newQueueItems, rejectedItems } = validateAndEnqueue([validVideo], [], "BET-45G");

    expect(rejectedItems).toHaveLength(0);
    expect(newQueueItems).toHaveLength(1);
    expect(newQueueItems[0].type === "VIDEO").toBe(true);
    // Videos are always shared across the product, regardless of the active pane
    expect(newQueueItems[0].targetSku).toBeNull();
  });

  it("rejects unsupported file extensions or mime types without aborting valid files", () => {
    const mixedBatch = [
      createFile("valid.jpg", 1024 * 1024, "image/jpeg"),
      createFile("notes.pdf", 500 * 1024, "application/pdf"),
      createFile("valid.png", 2 * 1024 * 1024, "image/png"),
      createFile("script.sh", 100, "text/x-sh"),
    ];

    const { newQueueItems, rejectedItems } = validateAndEnqueue(mixedBatch, [], "SKU-1");

    expect(newQueueItems).toHaveLength(2);
    expect(newQueueItems.map((q) => q.name)).toEqual(["valid.jpg", "valid.png"]);

    expect(rejectedItems).toHaveLength(2);
    expect(rejectedItems.map((r) => r.name)).toEqual(["notes.pdf", "script.sh"]);
  });

  it("rejects oversized images (> 10MB) and oversized videos (> 100MB)", () => {
    const oversized = [
      createFile("huge.jpg", 12 * 1024 * 1024, "image/jpeg"),
      createFile("huge.mp4", 120 * 1024 * 1024, "video/mp4"),
    ];

    const { newQueueItems, rejectedItems } = validateAndEnqueue(oversized, [], null);
    expect(newQueueItems).toHaveLength(0);
    expect(rejectedItems).toHaveLength(2);
    expect(rejectedItems[0].reason).toContain("10 MB");
    expect(rejectedItems[1].reason).toContain("100 MB");
  });

  it("enforces single video rule when product already has a video", () => {
    const existingMedia = [{ type: "VIDEO", url: "https://cdn/existing.mp4" }];
    const droppedFiles = [
      createFile("extra.mp4", 20 * 1024 * 1024, "video/mp4"),
      createFile("photo.jpg", 1 * 1024 * 1024, "image/jpeg"),
    ];

    const { newQueueItems, rejectedItems } = validateAndEnqueue(droppedFiles, existingMedia, null);

    // Video is rejected, photo is queued
    expect(rejectedItems).toHaveLength(1);
    expect(rejectedItems[0].name).toBe("extra.mp4");
    expect(rejectedItems[0].reason).toContain("already has a video");

    expect(newQueueItems).toHaveLength(1);
    expect(newQueueItems[0].name).toBe("photo.jpg");
  });

  it("captures and preserves targetSku for variant-specific uploads", () => {
    const files = [
      createFile("pouch-45g.jpg", 1024 * 1024, "image/jpeg"),
      createFile("back-45g.png", 1024 * 1024, "image/png"),
    ];

    const { newQueueItems } = validateAndEnqueue(files, [], "BET-45G");
    expect(newQueueItems).toHaveLength(2);
    expect(newQueueItems[0].targetSku).toBe("BET-45G");
    expect(newQueueItems[1].targetSku).toBe("BET-45G");
  });

  it("calculates smooth, non-decreasing overall batch progress", () => {
    const queue = [
      { id: "1", status: "READY", progress: 100 },
      { id: "2", status: "UPLOADING", progress: 50 },
      { id: "3", status: "QUEUED", progress: 0 },
    ];

    // Item 1: 100, Item 2: 50 * 0.9 = 45, Item 3: 0 -> sum = 145 / 3 = ~48%
    const p1 = calculateOverallProgress(queue);
    expect(p1).toBe(48);

    // Item 2 moves to PROCESSING (96%)
    queue[1] = { id: "2", status: "PROCESSING", progress: 100 };
    const p2 = calculateOverallProgress(queue);
    expect(p2).toBe(65);

    // All items become READY
    queue[1] = { id: "2", status: "READY", progress: 100 };
    queue[2] = { id: "3", status: "READY", progress: 100 };
    const p3 = calculateOverallProgress(queue);
    expect(p3).toBe(100);
  });
});
