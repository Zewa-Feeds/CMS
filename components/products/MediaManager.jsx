"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { products as productsApi } from "@/lib/api";

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

/** Matches the Button "default" variant, since a label cannot be a <Button>. */
const UPLOAD_BTN =
  "inline-flex cursor-pointer items-center rounded-[7px] border border-line bg-card px-[13px] py-2 text-[13px] hover:border-[#CFD6E0] hover:bg-[#FBFCFD] aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export default function MediaManager({
  media,
  variants,
  slug,
  onChange,
  onUpload,
  uploading,
  uploadError,
  disabled,
}) {
  /** Server-resolved galleries, keyed by SKU. Null until the first response. */
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewSku, setPreviewSku] = useState(null);
  const [busy, setBusy] = useState(false);

  const activeVariants = useMemo(
    () => (variants ?? []).filter((v) => v.isActive !== false && v.sku?.trim()),
    [variants],
  );

  /** What the editor currently has, in the shape the preview endpoint wants. */
  const payload = useMemo(
    () => ({
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
    [media],
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
  const selected = packs.find((p) => p.sku === previewSku) ?? packs[0] ?? null;

  // ---- Mutations -----------------------------------------------------------

  const update = (index, patch) =>
    onChange(media.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const move = (from, to) => {
    if (to < 0 || to >= media.length) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

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

  const makeShared = (index) => update(index, { skus: [], sku: null });

  // Grouping is presentational only; `position` in the array stays authoritative.
  const indexed = (media ?? []).map((m, i) => ({ ...m, _i: i }));
  const shared = indexed.filter((m) => !(m.skus?.length || m.sku));
  const forPack = (sku) =>
    indexed.filter((m) => (m.skus?.length ? m.skus.includes(sku) : m.sku === sku));

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Coverage ---------- */}
      <Card>
        <CardHead>
          <CardTitle>What customers will see</CardTitle>
          {busy && <span className="text-[11.5px] text-grey-deep">Checking…</span>}
        </CardHead>
        <CardBody>
          {previewError ? (
            <p className="text-[13px] text-amber-deep">{previewError}</p>
          ) : packs.length === 0 ? (
            <p className="text-[13px] text-grey-deep">
              Add a pack to see how its photography resolves.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/5">
              {packs.map((p) => {
                const c = coverageOf(p.coverage);
                return (
                  <li key={p.sku} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-[150px] text-[13px] font-medium">{p.pack}</span>
                    <Pill tone={c.tone}>{c.label}</Pill>
                    <span className="text-[12px] text-grey-deep">
                      {c.explain(p.pack, p.inheritedFromSku)}
                    </span>
                    <span className="ml-auto text-[11.5px] text-grey-deep">
                      {p.items.length} {p.items.length === 1 ? "item" : "items"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---------- Live preview ---------- */}
      {packs.length > 0 && (
        <Card>
          <CardHead>
            <CardTitle>Preview as a customer</CardTitle>
            <div className="w-[200px]">
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
          <CardBody>
            {!selected || selected.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-black/10 px-4 py-8 text-center">
                <p className="text-[13px] font-medium">No photography available for this pack.</p>
                <p className="mt-1 text-[12px] text-grey-deep">
                  Customers see a short note here. They are never shown another pack&rsquo;s
                  photographs.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2.5">
                  {selected.items.map((m) => (
                    <figure key={m.id} className="w-[104px]">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-grey-wash">
                        {m.type === "VIDEO" ? (
                          <span className="flex h-full items-center justify-center text-[11px] text-grey-deep">
                            Video
                          </span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt={m.alt || ""} className="h-full w-full object-cover" />
                        )}
                        {m.isPrimary && (
                          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            ★ Main
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
                <p className="mt-3 text-[12px] text-grey-deep">
                  {coverageOf(selected.coverage).explain(selected.pack, selected.inheritedFromSku)}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ---------- Shared ---------- */}
      <MediaSection
        title="Shared across all packs"
        hint="Fish photography, nutrition panels, the product video — anything that is not about one pack size."
        items={shared}
        emptyHint="Nothing shared yet. Anything added here appears for every pack."
        variants={activeVariants}
        /* Video lives here only: it shows the product, not one pack size. */
        allowVideo
        onUpload={(files, kind) => onUpload(files, kind, null)}
        uploading={uploading}
        disabled={disabled}
        update={update}
        move={move}
        remove={remove}
        toggleAssignment={toggleAssignment}
        makeShared={makeShared}
        total={media.length}
      />

      {/* ---------- Per pack ---------- */}
      {activeVariants.map((v) => {
        const resolved = packs.find((p) => p.sku === v.sku);
        const inheritsFrom = resolved?.coverage === "INHERITED" ? resolved.inheritedFromSku : null;

        return (
          <MediaSection
            key={v.sku}
            title={v.pack || v.sku}
            hint={
              inheritsFrom
                ? `No photographs of its own — currently showing ${inheritsFrom}'s. Anything added here replaces that.`
                : "Photographs of this pack size only."
            }
            badge={
              inheritsFrom ? (
                <Pill tone="blue" dot={false}>
                  ↗ Uses {inheritsFrom}
                </Pill>
              ) : resolved ? (
                <Pill tone={coverageOf(resolved.coverage).tone} dot={false}>
                  {coverageOf(resolved.coverage).label}
                </Pill>
              ) : null
            }
            items={forPack(v.sku)}
            emptyHint={
              inheritsFrom
                ? `Borrowing ${inheritsFrom}'s photographs. Add photos here to give this pack its own.`
                : "No photographs for this pack yet."
            }
            variants={activeVariants}
            onUpload={(files, kind) => onUpload(files, kind, v.sku)}
            uploading={uploading}
            disabled={disabled}
            update={update}
            move={move}
            remove={remove}
            toggleAssignment={toggleAssignment}
            makeShared={makeShared}
            total={media.length}
          />
        );
      })}

      {uploadError && <p className="text-[12.5px] text-red-deep">{uploadError}</p>}
    </div>
  );
}

/** One titled group of assets. Grouping is a view; array order is the truth. */
function MediaSection({
  title,
  hint,
  badge,
  allowVideo = false,
  items,
  emptyHint,
  variants,
  onUpload,
  uploading,
  disabled,
  update,
  move,
  remove,
  toggleAssignment,
  makeShared,
  total,
}) {
  return (
    <Card>
      <CardHead>
        <div className="flex flex-wrap items-center gap-2.5">
          <CardTitle>{title}</CardTitle>
          {badge}
        </div>
        {/*
          A hidden input inside a label, matching the pattern this editor already
          used. The resource type has to be known BEFORE the file is chosen — it
          selects the Cloudinary endpoint, the ingest transformation and the size
          limit — so images and video get separate inputs rather than one
          accept="image/*,video/*".
        */}
        <span className="flex items-center gap-2">
          <label className={UPLOAD_BTN} aria-disabled={disabled || uploading?.active}>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={disabled || uploading?.active}
              onChange={(e) => {
                if (e.target.files?.length) onUpload(e.target.files, "image");
                e.target.value = "";
              }}
            />
            {uploading?.active ? "Uploading…" : "Add photos"}
          </label>
          {allowVideo && (
            <label className={UPLOAD_BTN} aria-disabled={disabled || uploading?.active}>
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                disabled={disabled || uploading?.active}
                onChange={(e) => {
                  if (e.target.files?.length) onUpload(e.target.files, "video");
                  e.target.value = "";
                }}
              />
              Add video
            </label>
          )}
        </span>
      </CardHead>
      <CardBody>
        <p className="mb-3 text-[12px] text-grey-deep">{hint}</p>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 px-4 py-6 text-center text-[12.5px] text-grey-deep">
            {emptyHint}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((m) => (
              <MediaRow
                key={m.id ?? m.url}
                item={m}
                variants={variants}
                disabled={disabled}
                total={total}
                onAlt={(alt) => update(m._i, { alt })}
                onMove={(dir) => move(m._i, m._i + dir)}
                onRemove={() => remove(m._i)}
                onToggle={(sku) => toggleAssignment(m._i, sku)}
                onShare={() => makeShared(m._i)}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function MediaRow({ item, variants, disabled, total, onAlt, onMove, onRemove, onToggle, onShare }) {
  const [open, setOpen] = useState(false);
  const assigned = item.skus?.length ? item.skus : item.sku ? [item.sku] : [];
  const isShared = assigned.length === 0;

  return (
    <li className="flex gap-3 rounded-lg border border-black/8 p-3">
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-md border border-black/10 bg-grey-wash">
        {item.type === "VIDEO" ? (
          <span className="flex h-full items-center justify-center text-[10.5px] text-grey-deep">
            Video
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Field label="Description for screen readers" htmlFor={`alt-${item._i}`}>
          <Input
            id={`alt-${item._i}`}
            value={item.alt ?? ""}
            onChange={(e) => onAlt(e.target.value)}
            placeholder="What is in this photograph?"
            disabled={disabled}
          />
        </Field>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-grey-deep">
            {isShared
              ? "Shown for every pack"
              : `Shown for ${assigned.length} ${assigned.length === 1 ? "pack" : "packs"}`}
          </span>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11.5px] font-medium text-blue-deep underline-offset-2 hover:underline"
            aria-expanded={open}
          >
            Change where this appears
          </button>

          <span className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={disabled || item._i === 0} aria-label="Move earlier">
              ↑
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={disabled || item._i === total - 1} aria-label="Move later">
              ↓
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onRemove} disabled={disabled} aria-label="Remove">
              Remove
            </Button>
          </span>
        </div>

        {open && (
          <div className="mt-2 rounded-md bg-grey-wash p-2.5">
            <p className="mb-2 text-[11.5px] text-grey-deep">
              Tick every pack this should appear for. One photograph can serve several packs —
              it is not copied.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-[12px]">
                <input type="checkbox" checked={isShared} onChange={onShare} disabled={disabled} />
                All packs
              </label>
              {variants.map((v) => (
                <label key={v.sku} className="flex items-center gap-1.5 text-[12px]">
                  <input
                    type="checkbox"
                    checked={assigned.includes(v.sku)}
                    onChange={() => onToggle(v.sku)}
                    disabled={disabled}
                  />
                  {v.pack || v.sku}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
