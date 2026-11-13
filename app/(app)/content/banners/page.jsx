"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Image as ImageIcon, Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Switch, Field, Input, Select } from "@/components/ui/Field";
import { InfoBox, Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { MediaPicker } from "@/components/media/MediaPicker";
import { usePlacements } from "@/components/media/useAssets";
import { validateAsset } from "@/lib/placements";

export default function BannersPage() {
  const { data, loading, error } = useData((s) => s.spotlights);
  const loadSpotlights = useData((s) => s.loadSpotlights);
  const toggleSpotlight = useData((s) => s.toggleSpotlight);
  const reorderSpotlights = useData((s) => s.reorderSpotlights);
  const updateSpotlight = useData((s) => s.updateSpotlight);
  const createSpotlight = useData((s) => s.createSpotlight);
  const deleteSpotlight = useData((s) => s.deleteSpotlight);
  const products = useData((s) => s.products.data);
  const loadProducts = useData((s) => s.loadProducts);
  /** null = closed; {} = adding; a spotlight = editing it. */
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const placements = usePlacements();
  const [picking, setPicking] = useState(null); // spotlight id

  useEffect(() => {
    void loadSpotlights().catch(() => undefined);
    void loadProducts({ limit: 100 }).catch(() => undefined);
  }, [loadSpotlights, loadProducts]);

  const remove = async (b) => {
    if (!window.confirm(`Delete the spotlight for ${b.prod}? This can't be undone. (To hide it for now, switch it off instead.)`)) return;
    try {
      await deleteSpotlight(b.id);
      toast.push("Spotlight deleted.");
      await loadSpotlights();
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  const banners = data ?? [];

  /**
   * Reorder sends the FULL ordered id list, so the operation is idempotent — a
   * dropped request cannot leave positions half-applied.
   */
  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await reorderSpotlights(next.map((b) => b.id));
      await loadSpotlights();
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Banners" }]} />
      <PageHeader
        title="Spotlight Banners"
        sub="Up to 3 products featured in the rotating banner on the products page."
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Plus size={15} /> Add spotlight
          </Button>
        }
      />

      <div className="mb-4">
        <InfoBox>
          Up to 3 can be active at once; they rotate on the products page in this order. Reorder with the
          arrows, switch one off to hide it without deleting it.
        </InfoBox>
      </div>

      {/*
        Empty, not blank. Until Nov 2026 this page had no way to add a spotlight,
        so with none in the database it rendered nothing at all.
      */}
      {!error && data !== null && banners.length === 0 && (
        <Card>
          <EmptyState icon={Megaphone} title="No spotlights yet">
            The products page shows no spotlight banner until you add one. Click <strong>Add spotlight</strong> to
            feature a product.
          </EmptyState>
        </Card>
      )}
      {error && (
        <Card>
          <EmptyState icon={Megaphone} title="Couldn't load spotlights">{error}</EmptyState>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {banners.map((b, i) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={i === banners.length - 1} onClick={() => move(i, 1)}>
                  <ChevronDown size={15} />
                </Button>
              </div>
              {/* Spec #7: a height-capped, never-cropped cutout. */}
              <button
                type="button"
                onClick={() => setPicking(b.id)}
                title="Change the spotlight image"
                className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-grey-wash text-muted-2 hover:border-teal"
              >
                {b.imageUrl ? <img src={b.imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={22} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.prod}</span>
                  {b.badge && b.badge !== "None" && <Pill tone="teal" dot={false}>{b.badge}</Pill>}
                </div>
                <div className="mt-0.5 text-[13px]">{b.tagline}</div>
                <div className="text-[12.5px] text-muted">{b.subText}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setEditing(b)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => remove(b)}>
                  <Trash2 size={14} className="text-red-deep" />
                </Button>
                <Pill tone={b.isActive ? "green" : "grey"}>{b.isActive ? "Active" : "Inactive"}</Pill>
                <Switch
                  checked={b.isActive}
                  onChange={async () => {
                    try {
                      // §8.2 caps active spotlights at 3; the server rejects a 4th.
                      await toggleSpotlight(b.id);
                      toast.push(`Spotlight ${b.isActive ? "hidden" : "shown"}.`);
                      await loadSpotlights();
                    } catch (err) {
                      toast.push(err.message, { bad: true });
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <SpotlightForm
          spotlight={editing.id ? editing : null}
          products={products ?? []}
          placement={placements?.["spotlight.image"]}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            if (editing.id) await updateSpotlight(editing.id, body);
            else await createSpotlight(body);
            toast.push(editing.id ? "Spotlight updated." : "Spotlight added. It shows on the products page within a few minutes.");
            setEditing(null);
            await loadSpotlights();
          }}
        />
      )}

      <MediaPicker
        open={Boolean(picking)}
        placement={placements?.["spotlight.image"]}
        onClose={() => setPicking(null)}
        onSelect={async (row) => {
          const id = picking;
          setPicking(null);
          try {
            await updateSpotlight(id, { imageUrl: row.url });
            const warn = validateAsset(placements?.["spotlight.image"], row).find((i) => i.level === "warning");
            toast.push(warn ? `Image updated. Note: ${warn.message}` : "Spotlight image updated.");
            await loadSpotlights();
          } catch (err) {
            toast.push(err.message, { bad: true });
          }
        }}
      />
    </>
  );
}

/**
 * Add or edit one spotlight. The API (POST/PATCH /content/spotlights) checks
 * the fields and caps active spotlights at 3, saying so if a 4th is switched on.
 */
function SpotlightForm({ spotlight, products, placement, onClose, onSave }) {
  const toast = useToast();
  const [familyId, setFamilyId] = useState(spotlight?.familyId ?? "");
  const [tagline, setTagline] = useState(spotlight?.tagline ?? "");
  const [subText, setSubText] = useState(spotlight?.subText ?? "");
  const [badge, setBadge] = useState(spotlight?.badge ?? "");
  const [imageUrl, setImageUrl] = useState(spotlight?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(spotlight?.isActive ?? true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const live = products.filter((p) => p.status === "ACTIVE" || p.status === "Active" || p.id === familyId);

  const submit = async () => {
    if (!familyId) return toast.push("Pick the product to feature.", { bad: true });
    if (!tagline.trim()) return toast.push("Add a tagline.", { bad: true });
    setBusy(true);
    try {
      await onSave({
        familyId,
        tagline: tagline.trim(),
        subText: subText.trim(),
        badge: badge.trim() || null,
        imageUrl: imageUrl || null,
        isActive,
      });
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={spotlight ? "Edit spotlight" : "Add spotlight"}
      sub="Shown in the rotating banner at the top of the products page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : spotlight ? "Save" : "Add spotlight"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5 px-[18px] pb-4">
        <Field label="Product" required hint="The banner links to this product's page.">
          <Select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
            <option value="">Choose a product…</option>
            {live.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tagline" required counter={`${tagline.length}/120`} hint="The headline, e.g. “The highest-protein feed for bettas”.">
          <Input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} />
        </Field>
        <Field label="Short line" counter={`${subText.length}/160`} hint="One supporting sentence under the tagline.">
          <Input value={subText} maxLength={160} onChange={(e) => setSubText(e.target.value)} />
        </Field>
        <Field label="Badge (optional)" counter={`${badge.length}/30`} hint="A short label such as “New” or “Bestseller”.">
          <Input value={badge} maxLength={30} onChange={(e) => setBadge(e.target.value)} />
        </Field>
        <Field label="Image (optional)" hint="A cutout of the pack works best. Without one, the product's own photo is used.">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-grey-wash text-muted-2 hover:border-teal"
            >
              {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={22} />}
            </button>
            {imageUrl && <Button variant="ghost" onClick={() => setImageUrl("")}>Remove</Button>}
          </div>
        </Field>
        <Switch checked={isActive} onChange={() => setIsActive((v) => !v)} label="Show on the products page" />
      </div>
      <MediaPicker
        open={picking}
        placement={placement}
        onClose={() => setPicking(false)}
        onSelect={(row) => {
          setPicking(false);
          setImageUrl(row.url);
        }}
      />
    </Modal>
  );
}
