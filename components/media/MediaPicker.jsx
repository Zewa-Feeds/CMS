"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Film, ImagePlus, Search, Upload } from "lucide-react";
import { media as mediaApi } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { requirementLine, validateAsset } from "@/lib/placements";
import { rememberAsset } from "./useAssets";

/**
 * Pick a file from the library — or upload one — for a placement.
 *
 * Every tile is checked against the placement as you browse, so the file that
 * fits is visible before it is chosen. Errors (wrong kind or format) cannot be
 * picked; warnings can, and are shown again on the slot.
 */
export function MediaPicker({ open, onClose, onSelect, placement, kind }) {
  // `push` is stable; the context object is not (it changes with every toast).
  const { push: notify } = useToast();
  const toast = { push: notify };
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);
  const wantType = placement?.kind ?? kind ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mediaApi.list({ q: q || undefined, type: wantType, limit: 60 });
      res.data.forEach(rememberAsset);
      setRows(res.data);
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setLoading(false);
    }
  }, [q, wantType, notify]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, load, q]);

  const upload = async (file) => {
    if (!file) return;
    setProgress(0);
    try {
      const row = await mediaApi.upload(file, { onProgress: setProgress });
      rememberAsset(row);
      toast.push(`Uploaded “${row.title}”.`);
      const issues = validateAsset(placement, row);
      if (issues.some((i) => i.level === "error")) {
        toast.push(issues.find((i) => i.level === "error").message, { bad: true });
        await load();
      } else {
        onSelect(row);
      }
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide="xl"
      title={placement ? `Choose: ${placement.label}` : "Choose a file"}
      sub={placement ? `Spec${placement.spec ? ` #${placement.spec}` : ""}: ${requirementLine(placement)}. ${placement.guidance}` : undefined}
    >
      <div className="flex flex-wrap items-center gap-2 px-[18px] pb-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <Input className="pl-8" placeholder="Search title, alt text or file name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={wantType === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : wantType === "IMAGE" ? "image/*" : "image/*,video/*"}
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
          <Upload size={15} /> {progress !== null ? `Uploading ${progress}%` : "Upload new"}
        </Button>
      </div>

      <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto px-[18px] pb-[18px] sm:grid-cols-3 lg:grid-cols-4">
        {loading && rows.length === 0 && <div className="col-span-full py-10 text-center text-[13px] text-muted">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="col-span-full py-10 text-center text-[13px] text-muted">
            <ImagePlus className="mx-auto mb-2 text-muted-2" /> Nothing matches. Upload a file instead.
          </div>
        )}
        {rows.map((row) => {
          const issues = validateAsset(placement, row);
          const blocked = issues.some((i) => i.level === "error");
          const warned = !blocked && issues.length > 0;
          return (
            <button
              key={row.id}
              type="button"
              disabled={blocked}
              title={issues.map((i) => i.message).join("\n") || "Fits this placement"}
              onClick={() => onSelect(row)}
              className="group overflow-hidden rounded-lg border border-line text-left transition-colors hover:border-teal disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="relative aspect-[4/3] bg-[repeating-conic-gradient(#eef1f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                {row.type === "VIDEO" ? (
                  row.posterUrl ? (
                    <img src={row.posterDisplayUrl ?? row.posterUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-2"><Film /></div>
                  )
                ) : (
                  <img src={row.displayUrl ?? row.url} alt={row.altText} loading="lazy" className="h-full w-full object-contain" />
                )}
                {row.type === "VIDEO" && <Film size={14} className="absolute left-1.5 top-1.5 text-white drop-shadow" />}
              </div>
              <div className="p-2">
                <div className="truncate text-[12.5px] font-medium">{row.title}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  {row.width && row.height ? `${row.width}×${row.height}` : "size unknown"} · {row.format?.toUpperCase()}
                  {blocked && <Pill tone="red" dot={false}>won’t fit</Pill>}
                  {warned && <Pill tone="amber" dot={false}>{issues.length} warning{issues.length > 1 ? "s" : ""}</Pill>}
                  {!blocked && !warned && placement && <Pill tone="green" dot={false}>fits</Pill>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
