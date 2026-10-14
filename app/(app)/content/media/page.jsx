"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Copy, Film, RefreshCw, Search, Upload } from "lucide-react";
import { media as mediaApi } from "@/lib/api";
import { RoleGate } from "@/components/shell/RoleGate";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Modal, InfoBox } from "@/components/ui/Modal";
import { Pager } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { prettyBytes } from "@/lib/placements";

const STORAGE_LABEL = { CLOUDINARY: "Uploaded", STATIC: "Site file", EXTERNAL: "External link" };

export default function MediaPage() {
  return (
    <RoleGate perm="media.manage">
      <MediaLibrary />
    </RoleGate>
  );
}

function MediaLibrary() {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], meta: { page: 1, pages: 1, total: 0 } });
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setRes(await mediaApi.list({ q: q || undefined, type: type || undefined, archived: archived ? "true" : undefined, page }));
    } catch (err) {
      push(err.message, { bad: true });
    }
  }, [q, type, archived, page, push]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const upload = async (files) => {
    for (const file of files) {
      setProgress(0);
      try {
        const row = await mediaApi.upload(file, { onProgress: setProgress });
        push(`Uploaded “${row.title}”. Add alt text before using it.`);
      } catch (err) {
        push(`${file.name}: ${err.message}`, { bad: true });
      }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    await load();
  };

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Media Library" }]} />
      <PageHeader
        title="Media library"
        sub="Every image and video the website content can use. Placements reference files here, so replacing a file updates every place it appears on the next publish."
        actions={
          <>
            <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => upload([...(e.target.files ?? [])])} />
            <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
              <Upload size={15} /> {progress !== null ? `Uploading ${progress}%` : "Upload"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <Input className="pl-8" placeholder="Search title, alt text, file name or tag" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Images & videos</option>
          <option value="IMAGE">Images</option>
          <option value="VIDEO">Videos</option>
        </Select>
        <Select value={archived ? "archived" : "active"} onChange={(e) => { setArchived(e.target.value === "archived"); setPage(1); }} className="w-auto">
          <option value="active">In use / available</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {res.data.map((row) => (
          <button key={row.id} type="button" onClick={() => setSelected(row)} className="overflow-hidden rounded-lg border border-line bg-card text-left shadow-card hover:border-teal">
            <div className="relative aspect-[4/3] bg-[repeating-conic-gradient(#eef1f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
              {row.type === "VIDEO" ? (
                row.posterUrl ? <img src={row.posterDisplayUrl ?? row.posterUrl} alt="" className="h-full w-full object-contain" /> : <video src={row.displayUrl ?? row.url} muted preload="metadata" className="h-full w-full object-contain" />
              ) : (
                <img src={row.displayUrl ?? row.url} alt={row.altText} loading="lazy" className="h-full w-full object-contain" />
              )}
              {row.type === "VIDEO" && <Film size={14} className="absolute left-1.5 top-1.5 text-white drop-shadow" />}
            </div>
            <div className="p-2">
              <div className="truncate text-[12.5px] font-medium">{row.title}</div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                {row.width && row.height ? `${row.width}×${row.height}` : "size unknown"} · {row.format?.toUpperCase()}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.usageCount > 0 ? <Pill tone="green" dot={false}>Used ×{row.usageCount}</Pill> : <Pill tone="grey" dot={false}>Unused</Pill>}
                {!row.altText && row.type === "IMAGE" && <Pill tone="amber" dot={false}>No alt</Pill>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {res.data.length === 0 && <Card className="p-10 text-center text-[13px] text-muted">No files match.</Card>}
      <div className="mt-4">
        <Pager page={res.meta.page} pages={res.meta.pages} total={res.meta.total} onPage={setPage} unit="files" />
      </div>

      <MediaDetail
        row={selected}
        onClose={() => setSelected(null)}
        onChanged={async (row) => {
          setSelected(row);
          await load();
        }}
      />
    </>
  );
}

function MediaDetail({ row, onClose, onChanged }) {
  const { push } = useToast();
  const [form, setForm] = useState({ title: "", altText: "", tags: "" });
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!row) return;
    setForm({ title: row.title, altText: row.altText ?? "", tags: (row.tags ?? []).join(", ") });
    mediaApi.get(row.id).then(setDetail).catch(() => setDetail(row));
  }, [row]);

  if (!row) return null;
  const d = detail ?? row;

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const next = await fn();
      push(ok);
      await onChanged(next);
    } catch (err) {
      push(err.message, { bad: true });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide="xl"
      title={d.title}
      sub={`${STORAGE_LABEL[d.storage] ?? d.storage} · ${d.width && d.height ? `${d.width}×${d.height}` : "size unknown"} · ${d.format?.toUpperCase() ?? ""}${d.bytes ? ` · ${prettyBytes(d.bytes)}` : ""}${d.revision > 1 ? ` · replaced ${d.revision - 1}×` : ""}`}
    >
      <div className="grid gap-4 px-[18px] pb-[18px] md:grid-cols-[1fr_340px]">
        <div className="grid min-h-[240px] place-items-center rounded-lg bg-[repeating-conic-gradient(#eef1f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
          {d.type === "VIDEO" ? (
            <video src={d.displayUrl ?? d.url} poster={d.posterDisplayUrl ?? d.posterUrl ?? undefined} controls className="max-h-[420px] max-w-full" />
          ) : (
            <img src={d.displayUrl ?? d.url} alt={d.altText} className="max-h-[420px] max-w-full object-contain" />
          )}
        </div>

        <div className="space-y-1">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Alt text" hint="Default description wherever a placement does not set its own.">
            <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} />
          </Field>
          <Field label="Tags" hint="Comma-separated, for search.">
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="dark"
              disabled={busy}
              onClick={() =>
                run(
                  () => mediaApi.update(d.id, { title: form.title, altText: form.altText, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
                  "Details saved.",
                )
              }
            >
              Save details
            </Button>
            <Button size="default" onClick={() => navigator.clipboard?.writeText(d.displayUrl ?? d.url).then(() => push("URL copied."))}>
              <Copy size={14} /> Copy URL
            </Button>
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 text-[12.5px] font-semibold">Used in</div>
            {d.usages?.length ? (
              <ul className="space-y-1 text-[12.5px]">
                {d.usages.map((u, i) => (
                  <li key={i}>
                    {u.href ? <Link className="underline-offset-2 hover:underline" href={u.href}>{u.label}</Link> : u.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">Not used anywhere.</p>
            )}
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={d.type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) run(() => mediaApi.replace(d.id, file, { onProgress: setProgress }), "File replaced. Publish the website to put it live.");
              }}
            />
            <Button disabled={busy || d.archived} onClick={() => fileRef.current?.click()}>
              <RefreshCw size={14} /> {progress !== null ? `Uploading ${progress}%` : "Replace file…"}
            </Button>
            <p className="text-[11.5px] text-muted">
              Every placement using this item switches to the new file in the draft at once, and on the live site at the next
              publish. The old file is kept so earlier versions can still be rolled back to.
            </p>
            {d.archived ? (
              <Button disabled={busy} onClick={() => run(() => mediaApi.restore(d.id), "Restored.")}>
                <ArchiveRestore size={14} /> Restore
              </Button>
            ) : (
              <Button variant="danger" disabled={busy || d.usages?.length > 0} onClick={() => run(() => mediaApi.archive(d.id), "Archived.")}>
                <Archive size={14} /> Archive
              </Button>
            )}
            {d.usages?.length > 0 && !d.archived && (
              <InfoBox>Files in use cannot be archived. Remove them from the places above first.</InfoBox>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
