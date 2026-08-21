"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  Check,
  AlertCircle,
  Loader2,
  X,
  RotateCw,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { useData } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { MediaLightbox } from "@/components/ui/MediaLightbox";
import { products as productsApi, checkUploadFile } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Product media, organised the way an operator thinks about it.
 *
 * The old media tab was one flat list with a pack dropdown per tile, which said
 * nothing about what a customer would actually see. It could not show that a
 * pack had no photography, that a multipack was borrowing another pack's, or
 * which image would lead the gallery.
 *
 * Everything shown here about RESOLUTION — coverage, inheritance, hero, what
 * each pack displays — comes from the server, resolved by the same function the
 * storefront uses. This component never decides any of it. That is deliberate:
 * the two implementations drifting apart is exactly how a 1kg pouch photograph
 * ended up on a 45g product page.
 */

/** Operator-facing wording for each coverage state. No enum names on screen. */
const COVERAGE = {
  EXACT: {
    tone: "green",
    label: "Own photography",
    explain: (p) => `Shows its own ${p} photographs.`,
  },
  INHERITED: {
    tone: "blue",
    label: "Uses another pack's photos",
    explain: (_p, from) => `No photographs of its own, so it shows ${from}'s.`,
  },
  SHARED_ONLY: {
    tone: "amber",
    label: "Shared photos only",
    explain: () =>
      "No photographs of its own. Customers see the shared product images instead.",
  },
  EMPTY: {
    tone: "red",
    label: "Nothing to show",
    explain: () =>
      "No photography is currently available for this pack. Customers see a short note rather than another pack's photographs.",
  },
};

const coverageOf = (state) => COVERAGE[state] ?? COVERAGE.EMPTY;

/**
 * What state an asset is in, in words an operator can act on.
 *
 * The distinction that matters: a video is not usable the moment its upload
 * finishes. Cloudinary returns as soon as the bytes land and transcodes
 * afterwards, so showing it as ready would be a lie the storefront then has to
 * cope with — which is why PENDING exists and why it is surfaced here rather
 * than hidden.
 */
const MEDIA_STATE = {
  READY: { label: "Ready", tone: "green", note: null },
  PENDING: {
    label: "Processing",
    tone: "amber",
    note: "Still being processed. It will appear on the storefront once it is ready.",
  },
  FAILED: {
    label: "Failed",
    tone: "red",
    note: "This upload did not process. Remove it and try again.",
  },
  ARCHIVED: { label: "Removed", tone: "grey", note: "Removed from the gallery." },
};
const stateOf = (status) => MEDIA_STATE[status] ?? MEDIA_STATE.READY;

const prettyBytes = (n) => {
  if (!n || typeof n !== "number") return "0 B";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
};

/**
 * Upload Queue — shows batch progress, per-file status, Cloudinary processing state,
 * and retry affordance for failed files.
 */
function UploadQueue({ queue, onRetryItem, onRetryAll, onDismiss }) {
  if (!queue || queue.length === 0) return null;

  const totalCount = queue.length;
  const readyCount = queue.filter((q) => q.status === "READY").length;
  const failedCount = queue.filter((q) => q.status === "FAILED").length;
  const uploadingCount = queue.filter((q) => q.status === "UPLOADING").length;
  const processingCount = queue.filter((q) => q.status === "PROCESSING").length;
  const isComplete = totalCount > 0 && readyCount + failedCount === totalCount;
  const isAllSuccessful = totalCount > 0 && readyCount === totalCount;
  const isProcessing = processingCount > 0;

  // Calculate overall progress (monotonically non-decreasing)
  const totalProgressSum = queue.reduce((acc, q) => {
    if (q.status === "READY") return acc + 100;
    if (q.status === "PROCESSING") return acc + 96;
    if (q.status === "UPLOADING") return acc + Math.round((q.progress || 0) * 0.9);
    if (q.status === "FAILED") return acc + 100;
    return acc;
  }, 0);

  const overallPercent = Math.min(100, Math.max(0, Math.round(totalProgressSum / totalCount)));

  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-card transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          {isAllSuccessful ? (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-green-wash text-green-deep">
              <Check size={16} strokeWidth={2.5} />
            </div>
          ) : failedCount > 0 && isComplete ? (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-wash text-amber-deep">
              <AlertCircle size={16} />
            </div>
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-teal-wash text-teal-deep">
              <Loader2 size={16} className="animate-spin text-teal-deep" />
            </div>
          )}

          <div>
            <h4 className="text-[13.5px] font-semibold text-ink">
              {isAllSuccessful
                ? "All media ready"
                : failedCount > 0 && isComplete
                  ? `${readyCount} of ${totalCount} ready (${failedCount} failed)`
                  : isProcessing && uploadingCount === 0
                    ? `Processing media (${readyCount} of ${totalCount} ready)`
                    : `Uploading media (${readyCount} / ${totalCount} uploaded)`}
            </h4>
            <p className="text-[11.5px] text-grey-deep">
              {isAllSuccessful
                ? `✓ ${readyCount} ${readyCount === 1 ? "file" : "files"} added to gallery`
                : failedCount > 0 && isComplete
                  ? "Some uploads encountered an error. Click Retry to re-upload."
                  : isProcessing && uploadingCount === 0
                    ? "Finalizing Cloudinary optimizations…"
                    : `${totalCount} ${totalCount === 1 ? "file" : "files"} in queue · ${uploadingCount} uploading`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onRetryAll}
              className="h-7 text-[11.5px]"
            >
              <RotateCw size={12} className="mr-1.5" />
              Retry all failed
            </Button>
          )}

          {isComplete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 text-[11.5px] text-muted hover:text-ink"
            >
              <X size={14} className="mr-1" />
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            isAllSuccessful
              ? "bg-green-deep"
              : failedCount > 0
                ? "bg-amber-deep"
                : "bg-teal",
          )}
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {/* Queue Items */}
      <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto pr-1">
        {queue.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-line-soft bg-canvas/40 p-2 text-[12px]"
          >
            {/* Thumbnail */}
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-line bg-grey-wash">
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : item.type === "VIDEO" ? (
                <div className="flex h-full items-center justify-center text-[10px] text-grey-deep">
                  <Film size={14} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-grey-deep">
                  <ImageIcon size={14} />
                </div>
              )}
              {item.type === "VIDEO" && (
                <span className="absolute bottom-0 inset-x-0 bg-black/70 py-px text-center text-[8px] font-semibold text-white">
                  VID
                </span>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-ink" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted-2">
                  {item.formattedSize}
                </span>
                <span className="shrink-0 rounded bg-grey-wash px-1.5 py-0.5 text-[10px] font-medium text-grey-deep">
                  {item.targetLabel}
                </span>
              </div>

              {/* Status and Progress line */}
              <div className="mt-0.5 flex items-center justify-between gap-2">
                {item.status === "QUEUED" && (
                  <span className="text-[11px] text-muted">Queued…</span>
                )}
                {item.status === "UPLOADING" && (
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-teal transition-all duration-150"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] text-muted">
                      Uploading… {item.progress}%
                    </span>
                  </div>
                )}
                {item.status === "PROCESSING" && (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-deep">
                    <Loader2 size={11} className="animate-spin text-amber-deep" />
                    Processing…
                  </span>
                )}
                {item.status === "READY" && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-green-deep">
                    <Check size={12} className="text-green-deep" />
                    Ready
                  </span>
                )}
                {item.status === "FAILED" && (
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-red-deep" title={item.error}>
                      Failed: {item.error}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRetryItem(item.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-deep hover:bg-blue-wash hover:underline"
                    >
                      <RotateCw size={10} /> Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where a card's hover film comes from. Plain words, not resolver enum names. */
const VIDEO_SOURCE = {
  VARIANT: "this pack\u2019s own film",
  INHERITED: "borrowed from the pack it inherits from",
  SHARED: "the shared product film",
};

/** Matches the Button "default" variant, since a label cannot be a <Button>. */
const UPLOAD_BTN =
  "inline-flex cursor-pointer items-center rounded-[7px] border border-line bg-card px-[13px] py-2 text-[13px] hover:border-[#CFD6E0] hover:bg-[#FBFCFD] aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export default function MediaManager({
  media,
  variants,
  slug,
  representativeSku,
  /**
   * Media the operator has switched to "Specific packs" but not yet ticked.
   *
   * Owned by ProductEditor rather than here, because zero assignments cannot be
   * persisted as "Specific": no rows is exactly what Shared looks like in the
   * database. The editor blocks the save until the operator either picks a pack
   * or chooses Shared, so this has to be visible to validate().
   */
  specificMode,
  onSpecificModeChange,
  onChange,
  onVariantsChange,
  onRepresentativeChange,
  onUpload,
  uploading,
  uploadError,
  disabled,
}) {
  const uploadAsset = useData((s) => s.uploadAsset);
  const toast = useToast();

  /*
   * Which pane the operator is looking at: "shared", or a pack's SKU.
   *
   * Presentational only. Every asset still lives in one flat `media` array in
   * one order — a pane is a filtered view of it, exactly as the stacked
   * sections were. Switching panes touches no form state, so nothing unsaved is
   * lost, and `_i` keeps pointing at the real position in the array.
   */
  const [view, setView] = useState("shared");
  /* Declared here, ahead of every callback that closes over it: the file-drop
     handlers below list `view` in their dependency arrays, and a dependency
     array is evaluated the moment useCallback runs. Declaring it further down
     put it in the temporal dead zone at that point, so opening the Media tab
     threw "Cannot access 'view' before initialization" and the editor's error
     boundary replaced the page. */

  /** Server-resolved galleries, keyed by SKU. Null until the first response. */
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewSku, setPreviewSku] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  /** Active upload queue items */
  const [uploadQueue, setUploadQueue] = useState([]);
  const fileDropCounter = useRef(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef(null);

  const activeVariants = useMemo(
    () => (variants ?? []).filter((v) => v.isActive !== false && v.sku?.trim()),
    [variants],
  );

  /**
   * Enqueue files for upload with upfront format, size, and single-video validation.
   * Target SKU is captured at the moment of queuing so switching tabs mid-upload
   * does not misdirect files.
   */
  const enqueueFiles = useCallback(
    (fileList, targetSku = null) => {
      const rawFiles = Array.from(fileList ?? []);
      if (rawFiles.length === 0) return;

      const newQueueItems = [];
      const rejectedItems = [];

      const hasExistingVideo = (media ?? []).some((m) => m.type === "VIDEO");
      let videoQueuedInBatch = uploadQueue.some(
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

        let previewUrl = null;
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          // ignore
        }

        let targetLabel = "Shared";
        if (!isVideo && targetSku) {
          const v = activeVariants.find((x) => x.sku === targetSku);
          targetLabel = v?.pack ? `${v.pack} (${targetSku})` : targetSku;
        }

        const id = "upl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        newQueueItems.push({
          id,
          file,
          name: file.name,
          size: file.size,
          formattedSize: prettyBytes(file.size),
          type: isVideo ? "VIDEO" : "IMAGE",
          targetSku: isVideo ? null : targetSku,
          targetLabel,
          status: "QUEUED",
          progress: 0,
          error: null,
          previewUrl,
        });
      }

      if (rejectedItems.length > 0) {
        rejectedItems.forEach((r) => {
          toast.push(`${r.name} — ${r.reason}`, { bad: true });
        });
      }

      if (newQueueItems.length > 0) {
        setUploadQueue((prev) => [...prev, ...newQueueItems]);
      }
    },
    [media, uploadQueue, activeVariants, toast],
  );

  // Queue runner: processes queued files concurrently up to 2
  useEffect(() => {
    const queuedItems = uploadQueue.filter((q) => q.status === "QUEUED");
    if (queuedItems.length === 0) return;

    const activeCount = uploadQueue.filter(
      (q) => q.status === "UPLOADING" || q.status === "PROCESSING",
    ).length;
    if (activeCount >= 2) return;

    const nextItem = queuedItems[0];

    const runUpload = async (item) => {
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "UPLOADING", progress: 0 } : q)),
      );

      try {
        const isVideo = item.type === "VIDEO";
        const mediaResult = await uploadAsset(item.file, {
          folder: "products",
          resourceType: isVideo ? "video" : "image",
          slug: slug || undefined,
          onProgress: (percent) => {
            setUploadQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, progress: Math.min(percent, 99) } : q,
              ),
            );
          },
        });

        // Set status to PROCESSING (Cloudinary completed upload)
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "PROCESSING", progress: 100 } : q,
          ),
        );

        const finalMedia = {
          ...mediaResult,
          sku: item.targetSku || null,
          skus: item.targetSku ? [item.targetSku] : [],
        };

        onChange((prevMedia) => [...(prevMedia || []), finalMedia]);

        setTimeout(() => {
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: "READY" } : q)),
          );
        }, 400);
      } catch (err) {
        const reason =
          err.status === 503
            ? "Cloudinary is not configured on this environment."
            : err.message || "Upload did not complete.";

        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "FAILED", error: reason, progress: 0 } : q,
          ),
        );
        toast.push(`Upload failed (${item.name}): ${reason}`, { bad: true });
      }
    };

    runUpload(nextItem);
  }, [uploadQueue, uploadAsset, slug, onChange, toast]);

  const handleRetryItem = useCallback((id) => {
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, status: "QUEUED", error: null, progress: 0 } : q,
      ),
    );
  }, []);

  const handleRetryAll = useCallback(() => {
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.status === "FAILED" ? { ...q, status: "QUEUED", error: null, progress: 0 } : q,
      ),
    );
  }, []);

  const handleDismissQueue = useCallback(() => {
    setUploadQueue((prev) => {
      prev.forEach((q) => {
        if (q.previewUrl) {
          try {
            URL.revokeObjectURL(q.previewUrl);
          } catch {}
        }
      });
      return [];
    });
  }, []);

  const handleDragEnter = useCallback((e) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    fileDropCounter.current += 1;
    if (fileDropCounter.current === 1) {
      setIsDraggingFiles(true);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    fileDropCounter.current -= 1;
    if (fileDropCounter.current <= 0) {
      fileDropCounter.current = 0;
      setIsDraggingFiles(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      fileDropCounter.current = 0;
      setIsDraggingFiles(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const targetSku = view === "shared" ? null : view;
        enqueueFiles(files, targetSku);
      }
    },
    [view, enqueueFiles],
  );

  /** What the editor currently has, in the shape the preview endpoint wants. */
  const payload = useMemo(
    () => ({
      /* Hero travels with the preview so the ★ moves the moment it is chosen,
         rather than after a save. */
      variants: activeVariants.map((v) => ({
        sku: v.sku,
        heroMediaId: v.heroMediaId ?? null,
      })),
      /* Null means "use the default", which is a real choice and must reach the
         server as null rather than being dropped as undefined. */
      representativeSku: representativeSku ?? null,
      media: (media ?? []).map((m) => ({
        ...(m.id ? { id: m.id } : {}),
        type: m.type,
        url: m.url,
        alt: m.alt || null,
        posterUrl: m.posterUrl ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
        durationSec: m.durationSec ?? null,
        sku: (m.skus?.length ? m.skus[0] : m.sku) || null,
        skus: m.skus ?? (m.sku ? [m.sku] : []),
      })),
    }),
    [media, activeVariants, representativeSku],
  );

  /*
   * Ask the server what this gallery resolves to.
   *
   * Debounced because it fires on every reorder and every assignment change,
   * and a preview is not worth a request per keystroke.
   */
  const refresh = useCallback(async () => {
    if (!slug) return;
    setBusy(true);
    try {
      const data = await productsApi.mediaPreview(slug, payload);
      setPreview(data);
      setPreviewError(null);
    } catch (err) {
      // A failed preview must never block editing — the gallery itself is fine,
      // only the "what will customers see" panel is unavailable.
      setPreviewError(
        err?.message || "Couldn't work out what customers will see. Your changes are unaffected.",
      );
    } finally {
      setBusy(false);
    }
  }, [slug, payload]);

  useEffect(() => {
    const t = setTimeout(refresh, 400);
    return () => clearTimeout(t);
  }, [refresh]);

  const packs = preview?.packs ?? [];
  /** SKU -> id of the asset leading that pack, as the server resolved it. */
  const heroes = useMemo(
    () => Object.fromEntries(packs.map((p) => [p.sku, p.heroMediaId])),
    [packs],
  );
  const selected = packs.find((p) => p.sku === previewSku) ?? packs[0] ?? null;

  /**
   * The selected pack's gallery in the order a customer sees it.
   *
   * `items` arrives in CMS order — the operator's arrangement, which the rest of
   * this editor reads. The product page leads with the main image and then the
   * film, so previewing `items` directly would show an order no customer gets.
   * `presentation.orderedIds` is the server's answer to that, from the same
   * function the storefront calls.
   */
  const previewItems = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(selected.items.map((m) => [m.id, m]));
    const ordered = (selected.presentation?.orderedIds ?? []).map((id) => byId.get(id)).filter(Boolean);
    // Falls back to CMS order if an older server has not sent presentation yet.
    return ordered.length === selected.items.length ? ordered : selected.items;
  }, [selected]);

  /** What the shop grid and homepage will show for this product. */
  const listing = preview?.listing ?? null;

  // ---- Mutations -----------------------------------------------------------

  const update = (index, patch) =>
    onChange(media.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  /**
   * Move an item within a filtered group, preserving the relative slot positions
   * of all other media outside this group.
   */
  const moveWithinGroup = useCallback(
    (groupItems, fromGroupIdx, toGroupIdx, insertPosition = "after") => {
      if (
        fromGroupIdx === null ||
        toGroupIdx === null ||
        fromGroupIdx < 0 ||
        fromGroupIdx >= groupItems.length ||
        toGroupIdx < 0 ||
        toGroupIdx >= groupItems.length
      ) {
        return;
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
        return;
      }

      reorderedGroup.splice(destinationIndex, 0, dragged);

      const slots = groupItems.map((m) => m._i);
      const next = [...media];
      slots.forEach((slotIndex, i) => {
        const item = reorderedGroup[i];
        const { _i, ...cleanItem } = item;
        next[slotIndex] = cleanItem;
      });

      onChange(next);
    },
    [media, onChange],
  );

  const remove = (index) => onChange(media.filter((_, i) => i !== index));

  /** Add or remove one pack from an asset's assignments. */
  const toggleAssignment = (index, sku) => {
    const item = media[index];
    const current = item.skus ?? (item.sku ? [item.sku] : []);
    const next = current.includes(sku)
      ? current.filter((s) => s !== sku)
      : [...current, sku];
    update(index, { skus: next, sku: next[0] ?? null });
  };

  /**
   * Back to the SHARED state: zero ProductMediaVariant rows.
   *
   * Deliberately not the same as ticking every pack. Shared means "available to
   * every pack, including any added later" and resolves as SHARED_ONLY for a
   * pack with no photography of its own; ticking all N packs writes N rows and
   * resolves as EXACT. The resolver has always distinguished them and this UI
   * must not blur it — 21 of the catalogue's assets are shared today, and they
   * are the fish photography, the nutrition panels and every product video.
   */
  const makeShared = (index) => update(index, { skus: [], sku: null });

  /** Explicit rows for every ACTIVE pack. Retired packs are never assigned. */
  const assignAll = (index) => {
    const skus = activeVariants.map((v) => v.sku);
    update(index, { skus, sku: skus[0] ?? null });
  };

  /**
   * Drop every assignment while STAYING specific.
   *
   * The radio does not spring back to Shared, because "no packs chosen yet" and
   * "shared with all of them" are different intentions and one must not be
   * mistaken for the other mid-edit.
   */
  const clearAssignments = (index) => update(index, { skus: [], sku: null });

  /**
   * Choose a pack's main image.
   *
   * Stored on the VARIANT, exactly as the database does, and saved through the
   * normal save. Validity is the server's call: `checkHero` re-checks on save
   * and clears anything the resolver would ignore, so this never has to decide
   * whether a choice is legal.
   */
  const setHero = (sku, mediaId) => {
    onVariantsChange(
      (variants ?? []).map((v) => (v.sku === sku ? { ...v, heroMediaId: mediaId } : v)),
    );
  };

  /*
   * Where an unfinished "Specific packs" asset is being edited.
   *
   * Such an asset has no assignments yet, which is indistinguishable from
   * shared by looking at the data — so without this it would slide out of the
   * pack pane and into the shared group the moment "Clear all" was pressed,
   * taking its own controls with it. It is not shared; it is unfinished, and it
   * belongs where the operator left it until they resolve it either way.
   */
  const [pendingPane, setPendingPane] = useState(() => new Map());

  /** Records that a row is in "Specific packs" mode; read by the editor's validate(). */
  const markSpecific = (key, on) => {
    setPendingPane((prev) => {
      const next = new Map(prev);
      if (on) next.set(key, view);
      else next.delete(key);
      return next;
    });
    onSpecificModeChange?.(key, on);
  };

  /** Asked before anything is removed. Null when no confirmation is pending. */
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const askToRemove = async (index) => {
    const item = media[index];
    const id = item.id ?? `staged-${index}`;

    // A never-saved upload has no relationships to explain — drop it directly.
    if (!item.id) return remove(index);

    setPendingRemoval({ index, item, loading: true, impact: null, error: null });
    try {
      const impact = await productsApi.mediaImpact(slug, { ...payload, mediaId: id });
      setPendingRemoval((p) => (p ? { ...p, loading: false, impact } : p));
    } catch (err) {
      setPendingRemoval((p) =>
        p ? { ...p, loading: false, error: err?.message || "Couldn't check what this affects." } : p,
      );
    }
  };

  // Grouping is presentational only; `position` in the array stays authoritative.
  const indexed = (media ?? []).map((m, i) => ({ ...m, _i: i }));
  const unassigned = indexed.filter((m) => !(m.skus?.length || m.sku));
  const unfinished = (m) => specificMode.has(m.id ?? m.url);
  const paneOf = (m) => pendingPane.get(m.id ?? m.url) ?? "shared";

  /** Genuinely shared: no assignments, and not mid-edit toward specific ones. */
  const shared = unassigned.filter((m) => !unfinished(m));
  /** The Shared pane also holds anything being made specific from within it. */
  const sharedPane = unassigned.filter((m) => !unfinished(m) || paneOf(m) === "shared");

  const forPack = (sku) =>
    indexed.filter((m) => {
      const assigned = m.skus?.length ? m.skus : m.sku ? [m.sku] : [];
      if (assigned.length) return assigned.includes(sku);
      return unfinished(m) && paneOf(m) === sku;
    });

  /* A pack retired or renamed mid-edit must not strand the operator on a pane
     that no longer exists. */
  useEffect(() => {
    if (view !== "shared" && !activeVariants.some((v) => v.sku === view)) setView("shared");
  }, [activeVariants, view]);

  /* The customer preview follows the pane, so the operator sees the pack they
     are editing without choosing it twice. Its own selector still overrides. */
  useEffect(() => {
    if (view !== "shared") setPreviewSku(view);
  }, [view]);

  const viewVariant = view === "shared" ? null : (activeVariants.find((v) => v.sku === view) ?? null);
  const viewPack = view === "shared" ? null : (packs.find((p) => p.sku === view) ?? null);
  const inheritsFrom = viewPack?.coverage === "INHERITED" ? viewPack.inheritedFromSku : null;

  const ownItems = viewVariant ? forPack(viewVariant.sku) : [];
  const borrowedItems = inheritsFrom ? forPack(inheritsFrom) : [];

  /* Packs a customer would find nothing for. Worth saying once at the top
     rather than making someone open every pane to discover it. */
  const gaps = packs.filter((p) => p.coverage === "EMPTY");

  const tabs = [
    {
      key: "shared",
      label: "Shared",
      count: sharedPane.length,
      tone: "grey",
      status: "Every pack",
    },
    ...activeVariants.map((v) => {
      const p = packs.find((x) => x.sku === v.sku);
      const c = coverageOf(p?.coverage ?? "EMPTY");
      return {
        key: v.sku,
        label: v.pack || v.sku,
        count: forPack(v.sku).length,
        tone: c.tone,
        status: c.label,
      };
    }),
  ];

  /* Everything a pane needs to mutate the one array standing behind all of them. */
  const gridProps = {
    variants: activeVariants,
    disabled,
    heroes,
    onSetHero: setHero,
    onPreview: setLightboxIndex,
    update,
    moveWithinGroup,
    remove: askToRemove,
    toggleAssignment,
    makeShared,
    assignAll,
    clearAssignments,
    specificMode,
    markSpecific,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Listing configuration ---------- */}
      {packs.length > 0 && (
        <Card>
          <CardHead>
            <CardTitle>Main listing variant</CardTitle>
            <span className="hidden text-[11.5px] text-grey-deep sm:inline">
              Which pack represents the product on the shop grid &mdash; not its main image.
            </span>
            <div className="ml-auto w-[220px]">
              <Select
                value={representativeSku ?? ""}
                onChange={(e) => onRepresentativeChange?.(e.target.value || null)}
                disabled={disabled}
                aria-label="Main listing variant"
              >
                <option value="">Default &mdash; {packs[0]?.pack ?? "first pack"}</option>
                {packs.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.pack} ({p.sku})
                  </option>
                ))}
              </Select>
            </div>
          </CardHead>
          <CardBody className="p-3.5">
            {!listing ? (
              <p className="text-[13px] text-grey-deep">Working out the card&hellip;</p>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                {/*
                  Deliberately square and dark: the storefront card sits on a dark
                  panel with a square image well, and a light preview would flatter
                  artwork that disappears against the real thing.
                */}
                <div
                  onClick={() => {
                    if (listing.heroUrl) {
                      const idx = media.findIndex((m) => m.url === listing.heroUrl);
                      if (idx !== -1) setLightboxIndex(idx);
                    } else if (listing.videoUrl) {
                      const idx = media.findIndex(
                        (m) => m.type === "VIDEO" || m.url === listing.videoUrl,
                      );
                      if (idx !== -1) setLightboxIndex(idx);
                    }
                  }}
                  title="Click to preview full size"
                  className="group relative h-[132px] w-[132px] shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-[#0d1726] transition-transform hover:scale-[1.02]"
                >
                  {listing.heroUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.heroUrl}
                      alt={listing.heroAlt || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : listing.posterUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={listing.posterUrl}
                        alt=""
                        className="h-full w-full object-contain opacity-70"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 text-center text-[10px] text-white">
                        Video poster
                      </span>
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center px-3 text-center text-[11px] text-white/45">
                      &ldquo;Image coming soon&rdquo;
                    </span>
                  )}
                  {listing.videoUrl && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      &#9654; 2s hover
                    </span>
                  )}
                </div>

                <dl className="grid min-w-[250px] flex-1 grid-cols-[118px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
                  <dt className="text-grey-deep">Represented by</dt>
                  <dd className="font-medium">
                    {listing.pack ?? "—"}
                    <span className="ml-1.5 text-[11px] font-normal text-grey-deep">
                      {listing.isExplicit ? "(chosen)" : "(default — first pack)"}
                    </span>
                  </dd>

                  <dt className="text-grey-deep">Main image</dt>
                  <dd>
                    {listing.heroUrl ? (
                      "The pack’s main image"
                    ) : (
                      <span className="text-amber-deep">
                        None &mdash; a placeholder, never another pack&rsquo;s photograph.
                      </span>
                    )}
                  </dd>

                  <dt className="text-grey-deep">Hover video</dt>
                  <dd>
                    {listing.videoUrl
                      ? `Plays after about 2 seconds — ${VIDEO_SOURCE[listing.videoSource] ?? "available"}`
                      : "None. The card keeps the image."}
                  </dd>

                  <dt className="text-grey-deep">Then</dt>
                  <dd>
                    {listing.extraImageCount > 0
                      ? `${listing.extraImageCount} more ${listing.extraImageCount === 1 ? "image" : "images"} to step through`
                      : "Nothing further to step through."}
                  </dd>
                </dl>
              </div>
            )}
            <p className="mt-3 border-t border-line-soft pt-2.5 text-[11.5px] text-grey-deep">
              If this pack sells out the storefront falls back to an in-stock one on its own. Your
              setting here does not change, and it returns when stock does.
            </p>
          </CardBody>
        </Card>
      )}

      {previewError && <p className="text-[12.5px] text-amber-deep">{previewError}</p>}

      {/* A gap is worth one quiet line, not a table of every pack's status. */}
      {gaps.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-red-wash px-3 py-2 text-[12px] text-red-deep">
          <span className="font-semibold">Nothing to show for</span>
          {gaps.map((p) => (
            <button
              key={p.sku}
              type="button"
              onClick={() => setView(p.sku)}
              className="rounded border border-red-deep/25 px-1.5 py-px font-medium underline-offset-2 hover:underline"
            >
              {p.pack}
            </button>
          ))}
          <span className="text-red-deep/80">
            &mdash; customers see a short note rather than another pack&rsquo;s photographs.
          </span>
        </p>
      )}

      {/* ---------- Variant switcher + the selected pane ---------- */}
      <section>
        <VariantSwitcher tabs={tabs} value={view} onChange={setView} />

        <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2.5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-.01em]">
              {view === "shared" ? "Shared media" : viewVariant?.pack || view}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-grey-deep">
              {view === "shared" ? (
                <span>Available to every pack, including variants added later.</span>
              ) : (
                <>
                  <span className="font-mono text-[11px]">{viewVariant?.sku}</span>
                  <Pill tone={Number(viewVariant?.stock) > 0 ? "green" : "amber"}>
                    {Number(viewVariant?.stock) > 0 ? "In stock" : "Out of stock"}
                  </Pill>
                  {viewPack && (
                    <Pill tone={coverageOf(viewPack.coverage).tone} dot={false}>
                      {inheritsFrom
                        ? `↗ Uses ${inheritsFrom}`
                        : coverageOf(viewPack.coverage).label}
                    </Pill>
                  )}
                </>
              )}
              {busy && <span className="text-grey-deep">Checking&hellip;</span>}
            </div>
          </div>

          <span className="ml-auto flex items-center gap-2">
            <UploadButton
              kind="image"
              label="Add photos"
              multiple
              disabled={disabled}
              onPick={(files) => enqueueFiles(files, view === "shared" ? null : view)}
            />
            {/* Video lives on Shared only: it shows the product, not one pack size. */}
            {view === "shared" && (
              <UploadButton
                kind="video"
                label="Add video"
                disabled={disabled}
                onPick={(files) => enqueueFiles(files, null)}
              />
            )}
          </span>
        </div>

        {/* Upload Queue Panel (when active items exist) */}
        {uploadQueue.length > 0 && (
          <div className="mt-4">
            <UploadQueue
              queue={uploadQueue}
              onRetryItem={handleRetryItem}
              onRetryAll={handleRetryAll}
              onDismiss={handleDismissQueue}
            />
          </div>
        )}

        {/* Finder File Drag & Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "mt-4 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all duration-150",
            isDraggingFiles
              ? "border-teal bg-teal-wash/60 ring-4 ring-teal/20 scale-[1.005] shadow-pop"
              : "border-line-soft bg-canvas/40 hover:border-line hover:bg-canvas/70",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files?.length) {
                const targetSku = view === "shared" ? null : view;
                enqueueFiles(e.target.files, targetSku);
              }
              e.target.value = "";
            }}
          />

          <div className="pointer-events-none flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full transition-colors",
                isDraggingFiles ? "bg-teal text-ink" : "bg-grey-wash text-grey-deep",
              )}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-ink">
                {isDraggingFiles ? (
                  <span className="font-semibold text-teal-deep">
                    Drop files to upload to {view === "shared" ? "Shared media" : `${viewVariant?.pack || view}`}
                  </span>
                ) : (
                  <>
                    Drag and drop images or video from Finder here, or{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabled}
                      className="pointer-events-auto font-semibold text-teal-deep underline underline-offset-2 hover:text-teal"
                    >
                      browse files
                    </button>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-grey-deep">
                JPG, PNG, WebP, AVIF up to 10 MB {view === "shared" ? "· MP4, WebM, MOV up to 100 MB" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-6">
          {view === "shared" ? (
            <MediaGrid
              items={sharedPane}
              empty="Nothing shared yet. Anything added here appears for every pack."
              {...gridProps}
              groupId="shared"
            />
          ) : (
            <>
              <MediaGrid
                heading="Own photography"
                items={ownItems}
                empty={
                  inheritsFrom
                    ? `Borrowing ${inheritsFrom}’s photographs. Add photos here to give this pack its own.`
                    : "No photographs of this pack yet."
                }
                {...gridProps}
                groupId={`own-${view}`}
                packSku={view}
              />

              {borrowedItems.length > 0 && (
                <MediaGrid
                  heading={`Borrowed from ${inheritsFrom}`}
                  note={`This pack has none of its own, so it shows ${inheritsFrom}’s. Edit them in that pack’s pane.`}
                  items={borrowedItems}
                  {...gridProps}
                  groupId={`borrowed-${view}`}
                  packSku={view}
                  /* Structural edits belong to the pack that owns them; only the
                     main image is this pack's own decision. */
                  heroOnly
                />
              )}

              {shared.length > 0 && (
                <MediaGrid
                  heading="Shared media"
                  note="Applies to every pack. Edit these in the Shared pane."
                  items={shared}
                  {...gridProps}
                  groupId={`shared-${view}`}
                  packSku={view}
                  heroOnly
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* ---------- Customer preview ---------- */}
      {packs.length > 0 && (
        <Card>
          <CardHead>
            <CardTitle>Preview as a customer</CardTitle>
            <div className="ml-auto w-[190px]">
              <Select
                value={selected?.sku ?? ""}
                onChange={(e) => setPreviewSku(e.target.value)}
                aria-label="Preview pack"
              >
                {packs.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.pack}
                  </option>
                ))}
              </Select>
            </div>
          </CardHead>
          <CardBody className="p-3.5">
            {!selected || selected.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-black/10 px-4 py-6 text-center text-[12.5px] text-grey-deep">
                No photography available for this pack. Customers see a short note &mdash; never
                another pack&rsquo;s photographs.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2.5">
                  {previewItems.map((m) => (
                    <figure key={m.id} className="w-[84px]">
                      <div
                        onClick={() => {
                          const idx = media.findIndex(
                            (x) => (m.id && x.id === m.id) || x.url === m.url,
                          );
                          if (idx !== -1) setLightboxIndex(idx);
                        }}
                        title="Click to preview full size"
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-black/10 bg-grey-wash transition-transform hover:scale-[1.03]"
                      >
                        {m.type === "VIDEO" ? (
                          <span className="flex h-full items-center justify-center text-[11px] text-grey-deep">
                            Video
                          </span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.url}
                            alt={m.alt || ""}
                            className="h-full w-full object-cover"
                          />
                        )}
                        {m.isPrimary && (
                          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            &#9733; Main
                          </span>
                        )}
                      </div>
                      <figcaption className="mt-1 truncate text-[10.5px] text-grey-deep">
                        {m.source === "SHARED"
                          ? "Shared"
                          : m.source === "INHERITED"
                            ? `From ${selected.inheritedFromSku}`
                            : "This pack"}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <p className="mt-2.5 text-[11.5px] text-grey-deep">
                  {coverageOf(selected.coverage).explain(selected.pack, selected.inheritedFromSku)}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {uploadError && <p className="text-[12.5px] text-red-deep">{uploadError}</p>}

      {pendingRemoval && (
        <RemovalDialog
          state={pendingRemoval}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            remove(pendingRemoval.index);
            setPendingRemoval(null);
          }}
        />
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          media={media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}

/**
 * What removing this image would do, before it happens.
 *
 * Every figure comes from the server, resolved against the staged gallery, so
 * the consequences shown are the consequences a customer would experience. The
 * old flow removed silently and an operator discovered the gap later — or did
 * not.
 */
function RemovalDialog({ state, onCancel, onConfirm }) {
  const { item, loading, impact, error } = state;
  const leavesEmpty = impact?.leavesEmpty ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="removal-title"
        className="w-full max-w-[440px] rounded-xl bg-card p-5 shadow-xl"
      >
        <h3 id="removal-title" className="text-[15px] font-semibold">
          Remove this image?
        </h3>

        <div className="mt-3 flex gap-3">
          <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-md border border-black/10 bg-grey-wash">
            {item.type === "VIDEO" ? (
              <span className="flex h-full items-center justify-center text-[10px] text-grey-deep">
                Video
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-[12.5px]">
            {loading && <p className="text-grey-deep">Checking what this affects…</p>}
            {error && <p className="text-amber-deep">{error}</p>}

            {impact && (
              <>
                <p className="text-grey-deep">
                  {impact.isShared
                    ? "Currently shown for every pack."
                    : impact.usedBy.length === 0
                      ? "Not currently shown for any pack."
                      : `Currently shown for ${impact.usedBy.length} ${
                          impact.usedBy.length === 1 ? "pack" : "packs"
                        }.`}
                </p>

                {impact.usedBy.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {impact.usedBy.map((u) => (
                      <li key={u.sku} className="flex items-center gap-1.5">
                        <span>{u.pack}</span>
                        {u.isPrimary && (
                          <span className="text-[11px] font-semibold">★ main image</span>
                        )}
                        {u.source === "INHERITED" && (
                          <span className="text-[11px] text-grey-deep">(borrowed)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {impact.coverageChanges.length > 0 && (
                  <div className="mt-2.5 rounded-md bg-amber-wash p-2">
                    <p className="font-medium text-amber-deep">This changes what customers see:</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-amber-deep">
                      {impact.coverageChanges.map((c) => (
                        <li key={c.sku}>
                          {c.pack} — {coverageOf(c.to).label.toLowerCase()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {leavesEmpty.length > 0 && (
                  <div className="mt-2 rounded-md bg-red-wash p-2 text-red-deep">
                    <p className="font-semibold">
                      {leavesEmpty.join(", ")} will have no photography at all.
                    </p>
                    <p className="mt-0.5">
                      Customers see a short note instead — never another pack&rsquo;s photographs.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-grey-deep">
          The image is kept and can be restored; it simply stops being shown.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            Remove image
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Solid dot colours for the switcher, matching the Pill tones. */
const DOT = {
  green: "bg-green-deep",
  amber: "bg-amber-deep",
  red: "bg-red-deep",
  blue: "bg-blue-deep",
  grey: "bg-grey",
};

/**
 * Pane navigation: Shared, then one entry per pack.
 *
 * Replaces the stack that rendered every pack's gallery at once — a product
 * with a dozen packs made the tab several screens tall before an operator could
 * reach the one they wanted. Tabs scroll horizontally rather than wrapping, and
 * a narrow viewport gets a select instead, where a scrolling strip is fiddly.
 */
function VariantSwitcher({ tabs, value, onChange }) {
  const strip = useRef(null);
  /*
   * Whether there is more strip in either direction.
   *
   * With a dozen packs the tabs run past the edge, and a strip that is cut off
   * with no affordance reads as the end of the list — the operator never learns
   * the later packs are there.
   */
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    const measure = () =>
      setEdge({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [tabs.length]);

  return (
    <>
      <div className="md:hidden">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pack to edit"
        >
          {tabs.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} &mdash; {t.status} ({t.count})
            </option>
          ))}
        </Select>
      </div>

      <div className="relative hidden md:block">
        {edge.left && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-canvas to-transparent"
          />
        )}
        {edge.right && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-canvas to-transparent"
          />
        )}
        <div
          role="tablist"
          aria-label="Pack to edit"
          ref={strip}
          className="flex gap-0.5 overflow-x-auto border-b border-line"
        >
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-left transition-colors",
                on ? "border-navy" : "border-transparent hover:bg-grey-wash/70",
              )}
            >
              <span
                className={cn(
                  "block whitespace-nowrap text-[13px] font-medium",
                  on ? "text-ink" : "text-muted",
                )}
              >
                {t.label}
                <span className="ml-1.5 font-mono text-[11px] text-muted-2">{t.count}</span>
              </span>
              <span className="mt-px flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-grey-deep">
                <i className={cn("h-[5px] w-[5px] shrink-0 rounded-full", DOT[t.tone] ?? DOT.grey)} />
                {t.status}
              </span>
            </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/**
 * A hidden file input inside a label, matching the pattern this editor uses.
 *
 * The resource type has to be known BEFORE the file is chosen — it selects the
 * Cloudinary endpoint, the ingest transformation and the size limit — so images
 * and video get separate inputs rather than one accept="image/*,video/*".
 */
function UploadButton({ kind, label, multiple = false, busy, disabled, onPick }) {
  return (
    <label className={UPLOAD_BTN} aria-disabled={disabled || busy}>
      <input
        type="file"
        accept={kind === "video" ? "video/*" : "image/*"}
        multiple={multiple}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? "Uploading…" : label}
    </label>
  );
}

/**
 * One group of assets inside a pane. Grouping is a view; array order is truth.
 *
 * `heroOnly` marks a group this pane does not own — shared assets, or the ones
 * a pack is borrowing. Their main image is still this pack's decision, but
 * reordering and removal belong to the pane that owns them, so offering those
 * here would let someone delete from every pack while looking at one.
 */
function MediaGrid({
  heading,
  note,
  items,
  empty,
  groupId,
  packSku,
  heroOnly = false,
  variants,
  disabled,
  heroes,
  onSetHero,
  onPreview,
  update,
  moveWithinGroup,
  remove,
  toggleAssignment,
  makeShared,
  assignAll,
  clearAssignments,
  specificMode,
  markSpecific,
}) {
  /*
   * Drag state scoped to this group.
   *
   * Dragging is strictly intra-group: dropping across groups is prohibited so
   * shared and variant assets never cross boundaries accidentally.
   */
  const [dragState, setDragState] = useState({
    sourceIndex: null,
    targetIndex: null,
    insertPosition: null,
    groupId: null,
  });

  const dragJustEndedRef = useRef(false);

  const handleDragStart = useCallback(
    (idx) => {
      dragJustEndedRef.current = true;
      setDragState({
        sourceIndex: idx,
        targetIndex: null,
        insertPosition: null,
        groupId,
      });
    },
    [groupId],
  );

  const handleDragOver = useCallback(
    (e, idx) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files")) {
        return;
      }
      if (dragState.groupId !== groupId || dragState.sourceIndex === null) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = e.currentTarget.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const pos = e.clientX < midX ? "before" : "after";

      setDragState((prev) => {
        if (prev.targetIndex === idx && prev.insertPosition === pos) return prev;
        return { ...prev, targetIndex: idx, insertPosition: pos };
      });
    },
    [dragState.groupId, dragState.sourceIndex, groupId],
  );

  const handleDragLeave = useCallback((e, idx) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragState((prev) => {
      if (prev.targetIndex === idx) {
        return { ...prev, targetIndex: null, insertPosition: null };
      }
      return prev;
    });
  }, []);

  const handleDrop = useCallback(
    (e, idx) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      if (
        dragState.groupId === groupId &&
        dragState.sourceIndex !== null &&
        moveWithinGroup
      ) {
        moveWithinGroup(
          items,
          dragState.sourceIndex,
          idx,
          dragState.insertPosition || "after",
        );
      }

      setDragState({
        sourceIndex: null,
        targetIndex: null,
        insertPosition: null,
        groupId: null,
      });

      setTimeout(() => {
        dragJustEndedRef.current = false;
      }, 100);
    },
    [dragState, groupId, items, moveWithinGroup],
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      sourceIndex: null,
      targetIndex: null,
      insertPosition: null,
      groupId: null,
    });
    setTimeout(() => {
      dragJustEndedRef.current = false;
    }, 100);
  }, []);

  return (
    <div>
      {heading && (
        <div className="mb-2.5">
          <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-grey-deep">
            {heading}
          </h4>
          {note && <p className="mt-0.5 text-[11.5px] text-grey-deep">{note}</p>}
        </div>
      )}

      {items.length === 0 ? (
        empty ? (
          <p className="rounded-lg border border-dashed border-black/10 px-4 py-7 text-center text-[12.5px] text-grey-deep">
            {empty}
          </p>
        ) : null
      ) : (
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {items.map((m, idx) => (
            <MediaCard
              key={m.id ?? m.url}
              item={m}
              groupIndex={idx}
              groupTotal={items.length}
              variants={variants}
              disabled={disabled}
              groupId={groupId}
              heroOnly={heroOnly}
              isHero={packSku ? heroes?.[packSku] === m.id : false}
              canSetHero={Boolean(
                packSku && m.id && m.type !== "VIDEO" && (m.status ?? "READY") === "READY",
              )}
              onSetHero={() => onSetHero(packSku, m.id)}
              onPreview={() => onPreview?.(m._i)}
              onAlt={(alt) => update(m._i, { alt })}
              onMove={(dir) => {
                const targetIdx = idx + dir;
                if (targetIdx >= 0 && targetIdx < items.length) {
                  moveWithinGroup(items, idx, targetIdx, dir < 0 ? "before" : "after");
                }
              }}
              onRemove={() => remove(m._i)}
              onToggle={(sku) => {
                markSpecific(m.id ?? m.url, true);
                toggleAssignment(m._i, sku);
              }}
              onShare={() => {
                markSpecific(m.id ?? m.url, false);
                makeShared(m._i);
              }}
              onChooseSpecific={() => markSpecific(m.id ?? m.url, true)}
              onSelectAll={() => {
                markSpecific(m.id ?? m.url, true);
                assignAll(m._i);
              }}
              onClearAll={() => {
                markSpecific(m.id ?? m.url, true);
                clearAssignments(m._i);
              }}
              forceSpecific={specificMode.has(m.id ?? m.url)}
              isDragging={dragState.sourceIndex === idx && dragState.groupId === groupId}
              isDropTarget={
                dragState.targetIndex === idx &&
                dragState.groupId === groupId &&
                dragState.sourceIndex !== idx
              }
              insertPosition={dragState.targetIndex === idx ? dragState.insertPosition : null}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={(e) => handleDragLeave(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              dragJustEndedRef={dragJustEndedRef}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One asset, as a card.
 *
 * The picture leads, the metadata is quiet, and the pack assignment lives
 * behind one summary that opens on demand.
 */
function MediaCard({
  item,
  groupIndex,
  groupTotal,
  variants,
  disabled,
  groupId,
  heroOnly,
  isHero,
  canSetHero,
  onSetHero,
  onPreview,
  onAlt,
  onMove,
  onRemove,
  onToggle,
  onShare,
  onChooseSpecific,
  onSelectAll,
  onClearAll,
  forceSpecific,
  isDragging,
  isDropTarget,
  insertPosition,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragJustEndedRef,
}) {
  const [editing, setEditing] = useState(false);

  const assigned = item.skus?.length ? item.skus : item.sku ? [item.sku] : [];
  const mode = assigned.length > 0 || forceSpecific ? "specific" : "shared";
  const needsPacks = mode === "specific" && assigned.length === 0;
  const state = stateOf(item.status ?? "READY");
  const notReady = item.status && item.status !== "READY";

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const handlePreviewClick = () => {
    if (dragJustEndedRef?.current) return;
    onPreview?.();
  };

  const isDraggable = !disabled && !heroOnly && !editing;

  return (
    <li
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-zewa-media", JSON.stringify({ groupId, groupIndex }));
        e.dataTransfer.setData("text/plain", String(item._i));
        onDragStart(e);
      }}
      onDragEnd={onDragEnd}
      onDragOver={heroOnly ? undefined : onDragOver}
      onDragLeave={heroOnly ? undefined : onDragLeave}
      onDrop={heroOnly ? undefined : onDrop}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card transition-all duration-150",
        needsPacks ? "border-amber-deep/45" : "border-line-soft hover:border-line",
        isDraggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.98] border-dashed border-teal/70 ring-2 ring-teal/30 shadow-none",
        isDropTarget && "ring-2 ring-teal/60 bg-teal/[0.03]",
      )}
    >
      {/* Drop Insertion Position Line Indicators */}
      {isDropTarget && insertPosition === "before" && (
        <div className="pointer-events-none absolute -left-[5px] top-0 bottom-0 z-30 flex flex-col items-center justify-between py-1">
          <div className="h-2 w-2 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
          <div className="w-[3px] flex-1 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
          <div className="h-2 w-2 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
        </div>
      )}
      {isDropTarget && insertPosition === "after" && (
        <div className="pointer-events-none absolute -right-[5px] top-0 bottom-0 z-30 flex flex-col items-center justify-between py-1">
          <div className="h-2 w-2 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
          <div className="w-[3px] flex-1 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
          <div className="h-2 w-2 rounded-full bg-teal shadow-[0_0_8px_rgba(68,229,194,0.9)]" />
        </div>
      )}

      <div
        onClick={handlePreviewClick}
        title="Click to preview full size"
        className="relative aspect-square cursor-pointer overflow-hidden rounded-t-xl bg-grey-wash select-none"
      >
        {item.type === "VIDEO" ? (
          item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt="" className="h-full w-full object-contain pointer-events-none" />
          ) : (
            <span className="flex h-full items-center justify-center text-[11px] text-grey-deep pointer-events-none">
              Video
            </span>
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="h-full w-full object-cover pointer-events-none" />
        )}

        {isHero && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            &#9733; Main
          </span>
        )}

        {item.type === "VIDEO" && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Video
          </span>
        )}

        {notReady && (
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[10px] font-semibold text-white",
              item.status === "FAILED" ? "bg-red-600/85" : "bg-black/70",
            )}
          >
            {state.label}
          </span>
        )}

        {/* Quiet until hover, so a grid of pictures reads as pictures. */}
        {!heroOnly && (
          <span className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={stop(() => onMove(-1))}
              disabled={disabled || groupIndex === 0}
              aria-label="Move earlier"
              className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-black/80 disabled:opacity-35"
            >
              &#8592;
            </button>
            <button
              type="button"
              onClick={stop(() => onMove(1))}
              disabled={disabled || groupIndex === groupTotal - 1}
              aria-label="Move later"
              className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-black/80 disabled:opacity-35"
            >
              &#8594;
            </button>
            <button
              type="button"
              onClick={stop(onRemove)}
              disabled={disabled}
              aria-label="Remove"
              className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-red-600 disabled:opacity-35"
            >
              &#10005;
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        {canSetHero &&
          (isHero ? (
            <span className="text-[11.5px] font-semibold" title="Shown first for this pack">
              &#9733; Main image
            </span>
          ) : (
            <button
              type="button"
              onClick={onSetHero}
              disabled={disabled}
              className="self-start text-[11.5px] font-medium text-blue-deep underline-offset-2 hover:underline disabled:opacity-50"
            >
              Make main image
            </button>
          ))}

        {notReady && (
          <p
            className={cn(
              "text-[11px]",
              item.status === "FAILED" ? "text-red-600" : "text-amber-deep",
            )}
          >
            {state.note}
          </p>
        )}

        {heroOnly ? (
          <p className="text-[11px] text-grey-deep">
            {mode === "shared"
              ? "Shared with every pack"
              : `Assigned to ${assigned.length} ${assigned.length === 1 ? "pack" : "packs"}`}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              disabled={disabled}
              className={cn(
                "flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11.5px] transition-colors hover:bg-grey-wash disabled:opacity-50",
                needsPacks && "text-amber-deep",
              )}
            >
              <span className="text-grey-deep">Applies to</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {mode === "shared"
                  ? "Shared"
                  : assigned.length === 0
                    ? "no packs"
                    : `${assigned.length} ${assigned.length === 1 ? "pack" : "packs"}`}
              </span>
              <span aria-hidden="true" className="text-grey-deep">
                &#9662;
              </span>
            </button>

            {needsPacks && (
              <p className="flex items-start gap-1 text-[11px] font-medium text-amber-deep">
                <span aria-hidden="true">&#9888;</span>
                <span>Select at least one variant, or switch to Shared.</span>
              </p>
            )}

            <Input
              value={item.alt ?? ""}
              onChange={(e) => onAlt(e.target.value)}
              placeholder="Describe this image…"
              aria-label="Description for screen readers"
              disabled={disabled}
              className="mt-auto px-2 py-1 text-[11.5px]"
            />
          </>
        )}
      </div>

      {editing && (
        <AssignmentPopover
          item={item}
          variants={variants}
          groupId={groupId}
          disabled={disabled}
          mode={mode}
          assigned={assigned}
          onToggle={onToggle}
          onShare={onShare}
          onChooseSpecific={onChooseSpecific}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

/**
 * Where an asset appears, on demand.
 *
 * Shared and Specific stay two explicit choices rather than collapsing into
 * "tick every box". Shared means available to every pack including ones added
 * later and resolves as SHARED_ONLY for a pack with no photography of its own;
 * ticking all N packs writes N rows and resolves as EXACT. The resolver has
 * always distinguished them and this control must not blur it.
 */
function AssignmentPopover({
  item,
  variants,
  groupId,
  disabled,
  mode,
  assigned,
  onToggle,
  onShare,
  onChooseSpecific,
  onSelectAll,
  onClearAll,
  onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      /* The card is draggable; a drag started in here would be nonsense. */
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="absolute left-0 top-full z-30 mt-1 w-[254px] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-3 shadow-pop"
    >
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-[12px]">
          <input
            type="radio"
            /*
              Scoped to this GROUP, not to the asset. A shared asset is rendered
              in more than one pane, and identical radio names would make the
              browser treat those copies as a single group — checking one
              silently unchecked the others, so a correctly-assigned asset
              rendered with neither option selected.
            */
            name={`applies-${groupId}-${item._i}`}
            checked={mode === "shared"}
            onChange={onShare}
            disabled={disabled}
          />
          <span>
            Shared <span className="text-grey-deep">&mdash; every pack, including new ones</span>
          </span>
        </label>
        <label className="flex items-center gap-1.5 text-[12px]">
          <input
            type="radio"
            name={`applies-${groupId}-${item._i}`}
            checked={mode === "specific"}
            onChange={onChooseSpecific}
            disabled={disabled}
          />
          Specific packs
        </label>
      </div>

      {mode === "shared" ? (
        <p className="mt-2 border-t border-line-soft pt-2 text-[11.5px] text-grey-deep">
          Shared &mdash; all packs. No per-pack assignments, so a pack added later gets it too.
        </p>
      ) : (
        <div className="mt-2 border-t border-line-soft pt-2">
          {/* Scrolls rather than growing: a product may carry a dozen packs. */}
          <div className="flex max-h-[188px] flex-col gap-1 overflow-y-auto">
            {variants.map((v) => (
              <label key={v.sku} className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={assigned.includes(v.sku)}
                  onChange={() => onToggle(v.sku)}
                  disabled={disabled}
                />
                <span className="min-w-0 flex-1 truncate">{v.pack || v.sku}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-grey-deep">{v.sku}</span>
              </label>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              disabled={disabled || assigned.length === variants.length}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={disabled || assigned.length === 0}
            >
              Clear all
            </Button>
          </div>

          <p className="mt-1.5 text-[11.5px] font-medium">
            {`Applies to ${assigned.length} ${assigned.length === 1 ? "variant" : "variants"}`}
          </p>

          {/*
            Zero selected is fine while choosing, but it cannot be SAVED as
            "Specific": no rows is exactly what Shared looks like in the
            database, so persisting it would quietly turn into Shared. The
            editor refuses the save until this is resolved either way.
          */}
          {assigned.length === 0 && (
            <p className="mt-1 flex items-start gap-1.5 text-[11.5px] font-medium text-amber-deep">
              <span aria-hidden="true">&#9888;</span>
              <span>Select at least one variant, or switch to Shared.</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-2.5 flex justify-end border-t border-line-soft pt-2.5">
        <Button type="button" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
