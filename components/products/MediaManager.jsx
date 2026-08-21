"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { MediaLightbox } from "@/components/ui/MediaLightbox";
import { products as productsApi } from "@/lib/api";
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
  onChange,
  onVariantsChange,
  onRepresentativeChange,
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
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const activeVariants = useMemo(
    () => (variants ?? []).filter((v) => v.isActive !== false && v.sku?.trim()),
    [variants],
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

      {/* ---------- Main listing variant ---------- */}
      {packs.length > 0 && (
        <Card>
          <CardHead>
            <CardTitle>Main listing variant</CardTitle>
            <div className="w-[240px]">
              <Select
                value={representativeSku ?? ""}
                onChange={(e) => onRepresentativeChange?.(e.target.value || null)}
                disabled={disabled}
                aria-label="Main listing variant"
              >
                <option value="">
                  Default &mdash; {packs[0]?.pack ?? "first pack"}
                </option>
                {packs.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.pack} ({p.sku})
                  </option>
                ))}
              </Select>
            </div>
          </CardHead>
          <CardBody>
            <p className="mb-3.5 text-[12px] text-grey-deep">
              How this product appears on the shop grid and the homepage. The listing card uses the{" "}
              <strong className="font-semibold text-ink">photography, price, and SKU</strong> of this
              variant when in stock. If it sells out, the storefront automatically falls back to an
              available in-stock variant without altering your configured setting.
            </p>

            {!listing ? (
              <p className="text-[13px] text-grey-deep">Working out the card&hellip;</p>
            ) : (
              <div className="flex flex-wrap items-start gap-5">
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
                      const idx = media.findIndex((m) => m.type === "VIDEO" || m.url === listing.videoUrl);
                      if (idx !== -1) setLightboxIndex(idx);
                    }
                  }}
                  title="Click to preview full size"
                  className="group relative h-[168px] w-[168px] shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-[#0d1726] transition-transform hover:scale-[1.02]"
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
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 text-center text-[10.5px] text-white">
                        Video poster &mdash; no photograph
                      </span>
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center px-3 text-center text-[11.5px] text-white/45">
                      Placeholder
                      <br />
                      &ldquo;Image coming soon&rdquo;
                    </span>
                  )}
                  {listing.videoUrl && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      ▶ 2s hover
                    </span>
                  )}
                </div>

                <dl className="grid min-w-[260px] flex-1 grid-cols-[132px_1fr] gap-x-3 gap-y-2 text-[12.5px]">
                  <dt className="text-grey-deep">Main listing variant</dt>
                  <dd className="font-medium">
                    {listing.pack ?? "—"}
                    <span className="ml-1.5 text-[11px] font-normal text-grey-deep">
                      {listing.isExplicit ? "(chosen)" : "(default \u2014 first pack)"}
                    </span>
                  </dd>

                  <dt className="text-grey-deep">Main image</dt>
                  <dd>
                    {listing.heroUrl ? (
                      "The pack\u2019s main image"
                    ) : (
                      <span className="text-amber-deep">
                        None. Customers see a placeholder &mdash; never another pack&rsquo;s
                        photograph.
                      </span>
                    )}
                  </dd>

                  <dt className="text-grey-deep">Hover video</dt>
                  <dd>
                    {listing.videoUrl
                      ? `Plays after about 2 seconds \u2014 ${VIDEO_SOURCE[listing.videoSource] ?? "available"}`
                      : "None. The card keeps the image."}
                  </dd>

                  <dt className="text-grey-deep">Then</dt>
                  <dd>
                    {listing.extraImageCount > 0
                      ? `${listing.extraImageCount} more ${listing.extraImageCount === 1 ? "image" : "images"} the shopper can step through`
                      : "Nothing further to step through."}
                  </dd>

                  <dt className="text-grey-deep">Coverage</dt>
                  <dd>
                    <Pill tone={coverageOf(listing.coverage).tone}>
                      {coverageOf(listing.coverage).label}
                    </Pill>
                  </dd>
                </dl>
              </div>
            )}
          </CardBody>
        </Card>
      )}

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
                  {previewItems.map((m) => (
                    <figure key={m.id} className="w-[104px]">
                      <div
                        onClick={() => {
                          const idx = media.findIndex((x) => (m.id && x.id === m.id) || x.url === m.url);
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
        remove={askToRemove}
        heroes={heroes}
        onSetHero={setHero}
        onPreview={setLightboxIndex}
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
            remove={askToRemove}
            heroes={heroes}
            onSetHero={setHero}
            onPreview={setLightboxIndex}
            packSku={v.sku}
            toggleAssignment={toggleAssignment}
            makeShared={makeShared}
            total={media.length}
          />
        );
      })}

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
  heroes,
  onSetHero,
  onPreview,
  packSku,
}) {
  /*
   * Index of the row being dragged, within THIS section.
   *
   * Held per section because a section shows a filtered view of one array — a
   * shared asset appears here and in nothing else, a multi-pack asset appears in
   * several. Dragging moves the item in the underlying array using its real
   * index (`_i`), so ordering stays a property of the gallery rather than of
   * whichever section it was dragged in.
   */
  const [dragFrom, setDragFrom] = useState(null);
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
                isHero={packSku ? heroes?.[packSku] === m.id : false}
                /*
                  Only a finished IMAGE can lead a gallery. A video renders into
                  an <img> as a card photograph, a product page's opening frame
                  and an Open Graph image; an asset still processing or failed
                  would put a broken frame in all three. The control is withheld
                  rather than offered and then rejected by the server.
                */
                canSetHero={Boolean(
                  packSku && m.id && m.type !== "VIDEO" && (m.status ?? "READY") === "READY",
                )}
                onSetHero={() => onSetHero(packSku, m.id)}
                onPreview={() => onPreview?.(m._i)}
                onAlt={(alt) => update(m._i, { alt })}
                onMove={(dir) => move(m._i, m._i + dir)}
                onRemove={() => remove(m._i)}
                onToggle={(sku) => toggleAssignment(m._i, sku)}
                onShare={() => makeShared(m._i)}
                dragging={dragFrom === m._i}
                onDragStart={() => setDragFrom(m._i)}
                onDragEnd={() => setDragFrom(null)}
                onDropOn={() => {
                  if (dragFrom !== null && dragFrom !== m._i) move(dragFrom, m._i);
                  setDragFrom(null);
                }}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function MediaRow({
  item, variants, disabled, total,
  isHero, canSetHero, onSetHero, onPreview,
  onAlt, onMove, onRemove, onToggle, onShare,
  dragging, onDragStart, onDragEnd, onDropOn,
}) {
  const [open, setOpen] = useState(false);
  const assigned = item.skus?.length ? item.skus : item.sku ? [item.sku] : [];
  const isShared = assigned.length === 0;

  return (
    /*
      Draggable, with the arrow buttons kept as the keyboard path. Drag-and-drop
      is not reachable by keyboard or screen reader, so it is the convenience and
      the buttons are the guarantee — removing them would make reordering
      impossible for some operators.
    */
    <li
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData("text/plain", String(item._i));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      className={cn(
        "flex gap-3 rounded-lg border border-black/8 p-3 transition-colors",
        !disabled && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50 ring-2 ring-teal",
      )}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onPreview?.();
        }}
        title="Click to preview full size"
        className="group relative h-[68px] w-[68px] shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10 bg-grey-wash transition-transform hover:scale-[1.03] hover:border-teal hover:shadow-sm"
      >
        {item.type === "VIDEO" ? (
          /* The poster frame is a real picture of the asset and exists as soon
             as the original lands, so it is available even while the derived
             version is still transcoding. */
          item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="flex h-full items-center justify-center text-[10.5px] text-grey-deep">
              Video
            </span>
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="h-full w-full object-cover" />
        )}
        {/*
          A processing or failed asset is dimmed and labelled ON the thumbnail.
          An operator scanning a gallery reads the pictures, not the rows, so a
          badge somewhere else would be missed — and the whole point of PENDING
          is that this asset is not yet what customers will see.
        */}
        {item.status && item.status !== "READY" && (
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[9.5px] font-semibold text-white",
              item.status === "FAILED" ? "bg-red-600/85" : "bg-black/70",
            )}
          >
            {stateOf(item.status).label}
          </span>
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

        {item.status && item.status !== "READY" && (
          <p
            className={cn(
              "mt-1 text-[11.5px]",
              item.status === "FAILED" ? "text-red-600" : "text-amber-deep",
            )}
          >
            {stateOf(item.status).note}
          </p>
        )}

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

          {canSetHero &&
            (isHero ? (
              <span className="text-[11.5px] font-semibold" title="Shown first for this pack">
                ★ Main image
              </span>
            ) : (
              <button
                type="button"
                onClick={onSetHero}
                disabled={disabled}
                className="text-[11.5px] font-medium text-blue-deep underline-offset-2 hover:underline disabled:opacity-50"
              >
                Make main image
              </button>
            ))}

          <span className="ml-auto flex items-center gap-1">
            <span aria-hidden="true" className="mr-1 select-none text-[13px] text-grey-deep">
              ⠿
            </span>
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
