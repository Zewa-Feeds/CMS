"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, Film, ImagePlus, Monitor, Smartphone, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { prettyBytes, requirementLine, validateAsset } from "@/lib/placements";
import { MediaPicker } from "./MediaPicker";

/**
 * One file slot in the website editor: what it needs, what is in it, how that
 * file will actually be cropped on desktop and on a phone, and what is wrong.
 *
 * `value` is `{ assetId }` or null; `assets` is the shared row cache.
 * `serverIssues` are the publish gate's findings for this slot's path.
 */
export function AssetSlot({ label, placement, value, assets, onChange, required, serverIssues = [], disabled }) {
  const [picking, setPicking] = useState(false);
  const asset = value?.assetId ? assets.get(value.assetId) : null;
  const local = asset && !asset.missing ? validateAsset(placement, asset) : [];
  // Server findings win where they overlap; local ones show instantly after a pick.
  const issues = [...serverIssues, ...local.filter((l) => !serverIssues.some((s) => s.message === l.message))];
  if (required && !value?.assetId) issues.unshift({ level: "error", message: `${label} is required.` });
  if (asset?.archived) issues.unshift({ level: "error", message: "This file is archived — restore it or pick another." });
  if (asset?.missing) issues.unshift({ level: "error", message: "This file is no longer in the library." });

  return (
    <div className="rounded-lg border border-line bg-card p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[13px] font-semibold">
          {label}
          {required && <span className="text-red-deep"> *</span>}
        </span>
        {placement && (
          <span className="text-[11.5px] text-muted">
            {placement.spec ? `Spec #${placement.spec} · ` : ""}
            {requirementLine(placement)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-[180px] shrink-0">
          {asset && !asset.missing ? (
            <div className="overflow-hidden rounded-md border border-line">
              <div className="aspect-[4/3] bg-[repeating-conic-gradient(#eef1f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                <Thumb asset={asset} fit="contain" />
              </div>
              <div className="border-t border-line px-2 py-1.5 text-[11px] leading-tight">
                <div className="truncate font-medium">{asset.title}</div>
                <div className="text-muted">
                  {asset.width && asset.height ? `${asset.width}×${asset.height}` : "size unknown"} · {asset.format?.toUpperCase()}
                  {asset.bytes ? ` · ${prettyBytes(asset.bytes)}` : ""}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPicking(true)}
              className="grid aspect-[4/3] w-full place-items-center rounded-md border-[1.5px] border-dashed border-line bg-canvas text-[12px] text-muted hover:border-teal hover:bg-teal-wash"
            >
              <span><ImagePlus size={18} className="mx-auto mb-1 text-muted-2" />Choose file</span>
            </button>
          )}
          {!disabled && (
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" onClick={() => setPicking(true)}>{asset ? "Change" : "Choose"}</Button>
              {value?.assetId && !required && (
                <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Remove file">
                  <X size={13} /> Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {asset && !asset.missing && placement && <CropPreview asset={asset} placement={placement} />}
      </div>

      <IssueList issues={issues} ok={Boolean(asset) && !asset.missing && issues.length === 0} />

      <MediaPicker
        open={picking}
        placement={placement}
        onClose={() => setPicking(false)}
        onSelect={(row) => {
          setPicking(false);
          onChange({ assetId: row.id });
        }}
      />
    </div>
  );
}

export function IssueList({ issues, ok }) {
  if (!issues.length) {
    return ok ? (
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-green-deep">
        <CircleCheck size={13} /> Fits the spec.
      </p>
    ) : null;
  }
  return (
    <ul className="mt-2 space-y-1">
      {issues.map((i, n) => (
        <li
          key={n}
          className={cn("flex items-start gap-1.5 text-[12px]", i.level === "error" ? "text-red-deep" : "text-amber-deep")}
        >
          {i.level === "error" ? <XCircle size={13} className="mt-px shrink-0" /> : <AlertTriangle size={13} className="mt-px shrink-0" />}
          {i.message}
        </li>
      ))}
    </ul>
  );
}

function Thumb({ asset, fit = "cover", position = "center" }) {
  const style = { objectFit: fit, objectPosition: position };
  if (asset.type === "VIDEO") {
    return asset.posterUrl ? (
      <img src={asset.posterDisplayUrl ?? asset.posterUrl} alt="" className="h-full w-full" style={style} />
    ) : (
      <video src={asset.displayUrl ?? asset.url} muted preload="metadata" className="h-full w-full" style={style} />
    );
  }
  return <img src={asset.displayUrl ?? asset.url} alt={asset.altText || ""} className="h-full w-full" style={style} />;
}

/**
 * The file inside the box the storefront actually renders, at each
 * breakpoint, with the same object-fit and object-position. Scaled down; the
 * proportions are what matter.
 */
function CropPreview({ asset, placement }) {
  const boxes = [
    { key: "desktop", icon: Monitor, label: "Desktop", box: placement.preview.desktop, maxW: 260 },
    { key: "mobile", icon: Smartphone, label: "Mobile", box: placement.preview.mobile, maxW: 120 },
  ];
  return (
    <div className="flex flex-wrap items-end gap-3">
      {boxes.map(({ key, icon: Icon, label, box, maxW }) => {
        const style = boxStyle(box, maxW, asset);
        return (
          <figure key={key}>
            <div className="overflow-hidden rounded border border-line bg-navy" style={style}>
              <Thumb asset={asset} fit={placement.fit} position={placement.position || "center"} />
            </div>
            <figcaption className="mt-1 flex items-center gap-1 text-[10.5px] text-muted">
              <Icon size={11} /> {label}
              {asset.type === "VIDEO" && <Film size={10} className="ml-1" />}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function boxStyle(box, maxW, asset) {
  if (box.ratio) return { width: maxW, aspectRatio: `${box.ratio[0]} / ${box.ratio[1]}` };
  if (box.width && box.height) return { width: maxW, aspectRatio: `${box.width} / ${box.height}` };
  // Height-capped contain slots (spotlight): width follows the file.
  const ratio = asset.width && asset.height ? asset.width / asset.height : 1;
  const h = Math.min(90, box.height ?? 90);
  return { height: h, width: Math.min(maxW, Math.round(h * ratio)) };
}
