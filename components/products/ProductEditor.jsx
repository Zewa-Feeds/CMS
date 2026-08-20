"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Eye,
  Upload,
  Trash2,
  Plus,
  GripVertical,
  ImagePlus,
  Film,
  AlertCircle,
  Maximize2,
  ChevronUp,
  ChevronDown,
  FileText,
  RotateCcw,
} from "lucide-react";
import { useData } from "@/lib/store";
import { checkUploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, BADGES, PRODUCT_STATUSES } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { RichText } from "@/components/ui/RichText";
import { ConfirmModal } from "@/components/ui/Modal";
import { MediaLightbox } from "@/components/ui/MediaLightbox";
import MediaManager from "@/components/products/MediaManager";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";

const NUTRITION_FIELDS = [
  ["protein", "Crude Protein (min)", "42"],
  ["fat", "Crude Fat (min)", "12%"],
  ["fibre", "Crude Fibre (max)", "3%"],
  ["moisture", "Moisture (max)", "8%"],
  ["ash", "Ash (max)", "9%"],
  ["astaxanthin", "Astaxanthin", "50 ppm"],
];

const EMPTY = {
  name: "",
  slug: "",
  category: "Betta",
  status: "Draft",
  badge: "None",
  protein: 42,
  shortDesc: "",
  fullDesc: "",
  benefits: [""],
  seoTitle: "",
  seoDesc: "",
  nutrition: {},
  feedFreq: "",
  feedPortion: "",
  feedNotes: "",
  media: [],
  /* Null is "use the default": the first active pack by position. A new product
     has no packs to choose from yet anyway. */
  representativeSku: null,
  variants: [{ sku: "", pack: "", mrp: "", price: "", stock: 0, hsn: "23099090" }],
};

const TABS = [
  { key: "basic", label: "Basic Info" },
  { key: "variants", label: "Variants / SKUs" },
  { key: "images", label: "Media" },
  { key: "nutrition", label: "Nutritional Analysis" },
  { key: "feeding", label: "Feeding Guide" },
];

/**
 * Coerce whatever media shape the API returned into the editor's gallery model.
 *
 * Three historical shapes exist, so a product saved at any point still loads:
 *   1. `media[]`                — current: {type, url, alt, posterUrl, …}
 *   2. `images[]`               — pre-video: {url, alt} or a bare URL string
 *   3. `presentation.gallery[]` — oldest: {src, alt}
 *
 * Anything without a usable URL is dropped rather than rendered as a broken tile.
 */
function normaliseMedia(api) {
  if (Array.isArray(api?.media) && api.media.length > 0) {
    return api.media.map((m) => ({
      /*
       * Carried through editing so a save UPDATES this asset rather than
       * replacing it. Without the id, every save handed the asset a new
       * identity and any hero pointer or pack assignment aimed at it was lost.
       */
      id: m.id ?? null,
      type: m.type === "VIDEO" ? "VIDEO" : "IMAGE",
      url: m.url,
      publicId: m.publicId ?? null,
      alt: m.alt ?? "",
      posterUrl: m.posterUrl ?? null,
      durationSec: m.durationSec ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
      /** Legacy single-pack field. `skus` is the real answer. */
      sku: m.sku ?? null,
      /** Every pack this asset is shown for. Empty = shared with all of them. */
      skus: Array.isArray(m.skus) && m.skus.length > 0 ? m.skus : m.sku ? [m.sku] : [],
    }));
  }

  const legacy = api?.images?.length ? api.images : (api?.presentation?.gallery ?? []);
  return legacy
    .map((item) => (typeof item === "string" ? { url: item } : item))
    .map((item) => ({
      type: "IMAGE",
      url: item.url ?? item.src ?? null,
      publicId: item.publicId ?? null,
      alt: item.alt ?? "",
      posterUrl: null,
      durationSec: null,
      width: null,
      height: null,
      sku: null,
    }))
    .filter((m) => Boolean(m.url));
}

function toForm(api) {
  if (!api) return EMPTY;

  /*
   * LOAD THE DRAFT, NOT THE LIVE ROWS, when an unpublished draft exists.
   *
   * The API returns `draftPayload` — the exact body last saved — but this editor
   * ignored it and always rendered the live version. So saving worked, and then
   * reopening the page showed the OLD data: stock edits, media reordering and
   * pack assignments all appeared to have been lost. They were in the overlay
   * the whole time.
   *
   * Live values are still used for anything the draft does not carry (slug,
   * publishedAt, hasDraft), hence the merge rather than a straight swap.
   */
  const d = api.draftPayload;
  if (d) {
    api = {
      ...api,
      ...d,
      // Never let the overlay override identity or draft-state fields.
      slug: api.slug,
      hasDraft: true,
      // The draft stores rupees + display labels exactly as the form produced
      // them, so its variants/media are already in form shape.
      variants: d.variants ?? api.variants,
      media: d.media ?? api.media,
    };
  }

  return {
    name: api.name || "",
    slug: api.slug || "",
    category: api.categoryLabel || api.category || "Betta",
    status: api.statusLabel || api.status || "Draft",
    badge: api.badge || "None",
    protein: api.protein ?? 42,
    shortDesc: api.shortDesc || "",
    fullDesc: api.fullDesc || api.fullDescHtml || "",
    benefits: api.benefits?.length ? api.benefits : [""],
    seoTitle: api.seoTitle || "",
    seoDesc: api.seoDesc || "",
    nutrition: api.nutrition || {},
    feedFreq: api.feedFreq || "",
    feedPortion: api.feedPortion || "",
    feedNotes: api.feedNotes || api.feedNotesHtml || "",
    hasDraft: Boolean(api.hasDraft || api.draft),
    /*
     * `media` is the current shape (ordered, typed). The fallbacks cover a
     * product last saved before video existed: presentation.gallery held
     * {src} objects and api.images held bare URLs or {url} objects.
     */
    media: normaliseMedia(api),
    /* Which pack's photography represents the product on listing surfaces.
       Null means the default (first active pack), which is a real choice and
       round-trips as null rather than being dropped. */
    representativeSku: api.representativeSku ?? null,
    variants: (api.variants || []).map((v) => ({
      id: v.id,
      sku: v.sku || "",
      pack: v.pack || "",
      mrp: v.mrpPaise ? String(v.mrpPaise / 100) : String(v.mrp ?? ""),
      price: v.pricePaise ? String(v.pricePaise / 100) : String(v.price ?? ""),
      stock: v.stock ?? 0,
      hsn: v.hsn || "23099090",
      isActive: v.isActive ?? true,
      /* The pack's chosen main image, round-tripped so the ★ survives a reload
         and a save does not quietly clear it. */
      heroMediaId: v.heroMediaId ?? null,
    })),
  };
}

export function ProductEditor({ initial }) {
  const router = useRouter();
  const createProduct = useData((s) => s.createProduct);
  const saveProduct = useData((s) => s.saveProduct);
  const publishProduct = useData((s) => s.publishProduct);
  const discardProductDraft = useData((s) => s.discardProductDraft);
  const productPreviewToken = useData((s) => s.productPreviewToken);
  const deleteProduct = useData((s) => s.deleteProduct);
  const uploadAsset = useData((s) => s.uploadAsset);
  const toast = useToast();

  const isNew = !initial;
  const [form, setForm] = useState(() => toForm(initial));
  const [tab, setTab] = useState("basic");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [confirmDel, setConfirmDel] = useState(false);
  const [delText, setDelText] = useState("");
  /** Upload progress for the media tab. `total` > 1 during a multi-file upload. */
  const [uploading, setUploading] = useState({
    active: false,
    label: "",
    percent: 0,
    done: 0,
    total: 0,
  });
  /** Last upload failure, shown inline until the next attempt. */
  const [uploadError, setUploadError] = useState("");
  /** Gallery index open in the full-size viewer, or null when closed. */
  const [lightbox, setLightbox] = useState(null);
  /** True for a few seconds after a successful save, to confirm it landed. */
  const [justSaved, setJustSaved] = useState(false);

  /**
   * Snapshot of the form as last SAVED, so the editor can tell three states
   * apart. Without this it could only ask "does a draft exist?", which is why
   * the status read the same before and after pressing Save.
   *
   *   dirty            edited, NOT yet saved   -> "Unsaved changes"
   *   hasDraft only    saved, not published    -> "Saved — awaiting publish"
   *   neither          matches live            -> nothing to say
   */
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toForm(initial)));
  const dirty = JSON.stringify(form) !== savedSnapshot;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /** At most one video per product (enforced by the API too). */
  const hasVideo = form.media.some((m) => m.type === "VIDEO");

  /**
   * Which tab each field lives on, so a validation failure can send the owner to
   * the field instead of leaving them staring at a tab that looks fine.
   */
  const FIELD_TAB = {
    name: "basic",
    slug: "basic",
    shortDesc: "basic",
    protein: "basic",
    variants: "variants",
  };
  const tabForField = (key) => (key.startsWith("variant_") ? "variants" : FIELD_TAB[key] ?? "basic");

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Product name is required.";
    if (!form.slug.trim()) e.slug = "Slug is required.";
    if (!form.shortDesc.trim()) e.shortDesc = "Short description is required.";
    if (form.shortDesc.length > 200) e.shortDesc = "Short description cannot exceed 200 characters.";
    if (form.protein === "" || Number(form.protein) < 0) e.protein = "Enter a protein %.";

    // Variant validation
    if (!form.variants || form.variants.length === 0) {
      e.variants = "At least one SKU variant is required.";
    } else {
      form.variants.forEach((v, idx) => {
        if (!v.sku.trim()) e[`variant_${idx}_sku`] = "SKU is required.";
        if (!v.pack.trim()) e[`variant_${idx}_pack`] = "Pack size is required.";
        if (v.price === "" || Number(v.price) < 0) e[`variant_${idx}_price`] = "Enter a price.";
        if (v.mrp === "" || Number(v.mrp) < 0) e[`variant_${idx}_mrp`] = "Enter an MRP.";
        // Selling above MRP is illegal, and the PDP renders MRP as a
        // strikethrough — it would display a negative discount. Quote the actual
        // numbers so the fix is obvious.
        if (v.mrp !== "" && v.price !== "" && Number(v.price) > Number(v.mrp)) {
          e[`variant_${idx}_price`] =
            `Price (₹${v.price}) is above MRP (₹${v.mrp}). Lower the price or raise the MRP.`;
        }
      });
    }

    setErrors(e);
    // Returns the error map, not just a boolean: callers need the actual messages
    // to report, and reading `errors` state back would be a tick stale.
    return e;
  };

  /**
   * Report a validation failure usefully: name the first real problem and switch
   * to the tab holding it. "Fix the highlighted fields" alone is useless when the
   * highlighted field is on a tab you are not currently looking at.
   */
  const reportInvalid = (e) => {
    const [key, message] = Object.entries(e)[0] ?? [];
    if (!message) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return;
    }
    const target = tabForField(key);
    if (target !== tab) setTab(target);
    toast.push(message, { bad: true });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    slug: form.slug.trim(),
    category: form.category,
    status: form.status,
    badge: form.badge === "None" ? null : form.badge,
    shortDesc: form.shortDesc.trim(),
    fullDesc: form.fullDesc || "",
    protein: Number(form.protein) || 0,
    benefits: form.benefits.filter((b) => b.trim().length > 0),
    feedFreq: form.feedFreq?.trim() || null,
    feedPortion: form.feedPortion?.trim() || null,
    feedNotes: form.feedNotes || null,
    nutrition: form.nutrition || {},
    seoTitle: form.seoTitle?.trim() || null,
    seoDesc: form.seoDesc?.trim() || null,
    // Array order IS gallery order; the server assigns `position` from the index.
    media: form.media.map((m) => ({
      // Present for an existing asset, so the server updates rather than replaces.
      ...(m.id ? { id: m.id } : {}),
      type: m.type,
      url: m.url,
      publicId: m.publicId ?? null,
      alt: m.alt?.trim() || null,
      ...(m.type === "VIDEO"
        ? { posterUrl: m.posterUrl ?? null, durationSec: m.durationSec ?? null }
        : {}),
      width: m.width ?? null,
      height: m.height ?? null,
      // Legacy single-pack field, still sent so an older API keeps working.
      sku: (m.skus?.length ? m.skus[0] : m.sku) || null,
      // Every pack this asset is shown for. Empty means shared with all.
      skus: m.skus ?? (m.sku ? [m.sku] : []),
    })),
    // Imagery only — price, stock and Add-to-Cart still follow the first
    // purchasable pack. Validated server-side against this family's own packs.
    representativeSku: form.representativeSku ?? null,
    variants: form.variants.map((v) => ({
      /* Stable identity, so renaming a SKU renames the pack instead of
         replacing it and stranding its photography. Absent for a pack added
         in this session — the server falls back to matching by SKU. */
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim().toUpperCase(),
      pack: v.pack.trim(),
      mrp: Number(v.mrp) || 0,
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
      hsn: v.hsn?.trim() || "23099090",
      ...(v.isActive === undefined ? {} : { isActive: v.isActive }),
      // Validated server-side against this pack's resolved gallery.
      heroMediaId: v.heroMediaId ?? null,
    })),
  });

  const doSave = async (silent = false) => {
    const invalid = validate();
    if (Object.keys(invalid).length > 0) {
      reportInvalid(invalid);
      return false;
    }

    const payload = buildPayload();
    setBusy(true);

    try {
      if (isNew) {
        const created = await createProduct(payload);
        toast.push("Product created as DRAFT.");
        router.push(`/products/${created.slug}/edit`);
      } else {
        await saveProduct(initial.slug, payload);
        if (!silent) toast.push("Saved. Publish to make it live.");
        // Snapshot from the UPDATED state, not the closed-over `form` — reading
        // `form` here captures the value from before this render and would leave
        // the editor looking dirty immediately after a successful save.
        setForm((f) => {
          const next = { ...f, hasDraft: true };
          setSavedSnapshot(JSON.stringify(next));
          return next;
        });
        // Brief confirmation in the status bar, so the banner does not read as
        // "you still have unsaved changes" the moment after a successful save.
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
      }
      return true;
    } catch (err) {
      if (err.fields) {
        setErrors(err.fields);
        toast.push(Object.values(err.fields)[0] || "Fix the highlighted fields.", { bad: true });
      } else {
        toast.push(err.message, { bad: true });
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doPublish = async () => {
    // Publishing an existing product previously skipped validation entirely and
    // let an invalid payload (e.g. price above MRP) reach the API as a raw 422.
    const invalid = validate();
    if (Object.keys(invalid).length > 0) {
      reportInvalid(invalid);
      return;
    }

    setBusy(true);
    try {
      const targetSlug = isNew ? form.slug : initial.slug;
      if (isNew) {
        const saved = await doSave(true);
        if (!saved) return;
      } else {
        await saveProduct(targetSlug, buildPayload());
      }

      await publishProduct(targetSlug);
      toast.push(`${form.name} is now live.`);
      router.push("/products");
    } catch (err) {
      toast.push(err.message || "Failed to publish product.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doDiscardDraft = async () => {
    if (isNew || !initial?.slug) return;
    setBusy(true);
    try {
      await discardProductDraft(initial.slug);
      toast.push("Draft overlay discarded.");
      router.refresh();
    } catch (err) {
      toast.push(err.message || "Failed to discard draft.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Open the storefront preview.
   *
   * Preview renders from the DATABASE, not from unsaved form state — so a product
   * that has never been saved has nothing to render and the API correctly 404s.
   * Previously the only guard was "is the slug non-empty", which let a brand-new
   * product open a broken tab. Now an unsaved product is saved first.
   */
  const doPreview = async () => {
    if (isNew) {
      /*
       * A never-saved product cannot be previewed: creating it also navigates to
       * its own edit page, so rather than racing that redirect we tell the owner
       * to save, which is one predictable click instead of a surprise navigation
       * plus a popup.
       */
      toast.push("Save the product first — preview renders the saved version.", {
        bad: true,
      });
      return;
    }

    const targetSlug = initial.slug;

    try {
      const res = await productPreviewToken(targetSlug);
      if (!res?.url) throw new Error("The API did not return a preview URL.");
      // Opened only after the token resolves, so a failure never leaves a blank
      // tab sitting on a 404.
      window.open(res.url, "_blank", "noopener");
    } catch (err) {
      toast.push(
        err.status === 404
          ? "Save the product before previewing — preview renders the saved version."
          : err.message || "Could not generate the preview link.",
        { bad: true },
      );
    }
  };

  const handleDelete = async () => {
    if (delText !== (form.name || initial.name)) {
      toast.push("Type the exact product name to confirm.", { bad: true });
      return;
    }
    setBusy(true);
    try {
      await deleteProduct(initial.slug, delText);
      toast.push("Product deleted.");
      setConfirmDel(false);
      router.push("/products");
    } catch (err) {
      toast.push(err.message || "Failed to delete product.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Upload one or more files and append them to the gallery.
   *
   * `resourceType` decides both the Cloudinary endpoint and the validation
   * limits. A second video is refused here so the editor explains itself
   * immediately rather than surfacing a 422 after a long upload.
   */
  /*
   * `targetSku` is a PARAMETER, not read from state.
   *
   * The media manager sets the destination and starts the upload in the same
   * tick, so a state read here would still see the previous value and file the
   * new photographs against the wrong pack.
   */
  const handleFiles = async (fileList, resourceType, targetSku = null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    if (resourceType === "video") {
      if (files.length > 1) {
        setUploadError("Only one video per product — pick a single file.");
        toast.push("Only one video per product.", { bad: true });
        return;
      }
      if (form.media.some((m) => m.type === "VIDEO")) {
        setUploadError("This product already has a video. Remove it first to replace it.");
        toast.push("This product already has a video.", { bad: true });
        return;
      }
    }

    // Reject everything unusable up front, so a bad file in a multi-select does
    // not abort the good ones halfway through.
    const rejected = files
      .map((f) => ({ name: f.name, error: checkUploadFile(f, resourceType) }))
      .filter((r) => r.error);
    if (rejected.length > 0) {
      setUploadError(`${rejected[0].name} — ${rejected[0].error}`);
      toast.push(rejected[0].error, { bad: true });
      return;
    }

    setUploadError("");
    setUploading({ active: true, label: files[0].name, percent: 0, done: 0, total: files.length });

    const added = [];
    try {
      for (const [i, file] of files.entries()) {
        setUploading((u) => ({ ...u, label: file.name, percent: 0, done: i }));
        const media = await uploadAsset(file, {
          folder: "products",
          resourceType,
          onProgress: (percent) => setUploading((u) => ({ ...u, percent })),
        });
        // A video covers the product, not one pack, so it is always shared.
        // A video covers the product, not one pack, so it is always shared.
        const sku = resourceType === "video" ? null : targetSku || uploadTargetSku || null;
        added.push({ ...media, sku, skus: sku ? [sku] : [] });
      }
      // One state write, so a multi-file upload does not re-render per file.
      set({ media: [...form.media, ...added] });
      toast.push(
        added.length === 1
          ? `${resourceType === "video" ? "Video" : "Image"} uploaded.`
          : `${added.length} images uploaded.`,
      );
    } catch (err) {
      // Anything already uploaded is kept — discarding it would orphan the asset
      // in Cloudinary while losing the owner's work.
      if (added.length > 0) set({ media: [...form.media, ...added] });

      /*
       * Always say WHY. A silent failure was a real bug: a large video that timed
       * out simply disappeared with no message, so there was no way to tell a
       * too-big file from a dropped connection.
       */
      const failedName = files[added.length]?.name ?? "the file";
      const reason =
        err.status === 503
          ? "Cloudinary is not configured on this environment."
          : err.message || "the upload did not complete.";
      setUploadError(`${failedName} — ${reason}`);
      toast.push(`Upload failed: ${reason}`, { bad: true });
    } finally {
      setUploading({ active: false, label: "", percent: 0, done: 0, total: 0 });
    }
  };

  // ---- gallery ordering -------------------------------------------------
  const moveMedia = (from, to) => {
    if (to < 0 || to >= form.media.length) return;
    const next = [...form.media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ media: next });
  };

  const removeMedia = (i) => set({ media: form.media.filter((_, idx) => idx !== i) });

  const setMediaAlt = (i, alt) =>
    set({ media: form.media.map((m, idx) => (idx === i ? { ...m, alt } : m)) });

  /** Assign an asset to a pack, or "" for shared across all packs. */
  const setMediaSku = (i, sku) =>
    set({ media: form.media.map((m, idx) => (idx === i ? { ...m, sku: sku || null } : m)) });

  /**
   * Pack each NEW upload is assigned to. Sticky across uploads, because an admin
   * adding six 200g photos should not re-pick the pack six times.
   */
  const [uploadTargetSku, setUploadTargetSku] = useState("");

  // variants helpers
  const setVariant = (i, patch) => {
    const variants = form.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v));

    /*
     * A SKU is a label, but several things reference a pack BY that label:
     * every media assignment, and the listing representative. Renaming without
     * moving those references left them pointing at a name that no longer
     * exists — the server drops unknown names, so a pack's photography would
     * quietly become shared, or vanish with the pack it was stranded on.
     *
     * The server has the same alias as a safety net; doing it here as well
     * keeps the media manager and the live preview correct BEFORE saving,
     * which is where an operator would otherwise watch a gallery empty itself.
     */
    const from = form.variants[i]?.sku;
    const to = patch.sku;
    if (!("sku" in patch) || !from || !to || from === to) {
      set({ variants });
      return;
    }

    set({
      variants,
      media: (form.media ?? []).map((m) => {
        const skus = m.skus?.length ? m.skus : m.sku ? [m.sku] : [];
        if (!skus.includes(from)) return m;
        const next = skus.map((s) => (s === from ? to : s));
        return { ...m, skus: next, sku: next[0] ?? null };
      }),
      representativeSku: form.representativeSku === from ? to : form.representativeSku,
    });
  };
  const addVariant = () =>
    set({
      variants: [...form.variants, { sku: "", pack: "", mrp: "", price: "", stock: 0, hsn: "23099090" }],
    });
  const removeVariant = (i) => set({ variants: form.variants.filter((_, idx) => idx !== i) });

  // benefits helpers
  const setBenefit = (i, val) => set({ benefits: form.benefits.map((b, idx) => (idx === i ? val : b)) });
  const addBenefit = () => form.benefits.length < 8 && set({ benefits: [...form.benefits, ""] });
  const removeBenefit = (i) => set({ benefits: form.benefits.filter((_, idx) => idx !== i) });

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Products", href: "/products" },
          { label: isNew ? "Add Product" : form.name || "Edit Product" },
        ]}
      />
      <PageHeader
        title={isNew ? "Add Product" : form.name || "Edit Product"}
        sub="Nothing goes live on save alone — save a draft, preview, then publish."
        actions={
          !isNew && (
            <Button variant="danger" onClick={() => setConfirmDel(true)} disabled={busy}>
              <Trash2 size={15} /> Delete
            </Button>
          )
        }
      />

      {/* draft → preview → publish action bar (spec §5.2) */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-card p-3 shadow-card">
        <div className="flex items-center gap-2.5 text-[12.5px] text-muted">
          <Pill tone={form.status === "Active" || form.status === "ACTIVE" ? "green" : "grey"}>
            {form.status}
          </Pill>
          {/*
            Wording matters here. "Draft overlay changes present" read like
            "you have unsaved work", so after pressing Save the owner could not
            tell whether it had saved. The truth is the opposite: the changes ARE
            saved, they are just not LIVE until Publish. Say that instead.
          */}
          {dirty ? (
            <span className="font-medium text-amber-deep">Unsaved changes</span>
          ) : justSaved ? (
            <span className="font-medium text-green-deep">Saved — publish to go live</span>
          ) : form.hasDraft ? (
            <span className="font-medium text-amber-deep">Saved — awaiting publish</span>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {/*
            "Discard Draft" sounded like it might throw away a save that had just
            succeeded. It actually reverts to whatever is currently LIVE, so the
            label names that instead.
          */}
          {form.hasDraft && !isNew && !dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={doDiscardDraft}
              disabled={busy}
              title="Throw away these unpublished changes and go back to the live version"
            >
              <RotateCcw size={14} /> Revert to live
            </Button>
          )}
          {/* Nothing edited = nothing to save, so the button says so. */}
          <Button
            variant="default"
            onClick={() => doSave(false)}
            disabled={busy || (!dirty && !isNew)}
            title={!dirty && !isNew ? "No changes to save" : "Save these changes"}
          >
            <Save size={15} /> {dirty || isNew ? "Save Draft" : "Saved"}
          </Button>
          {/*
            Hidden entirely on Add Product: preview renders from the DATABASE, so
            a product that has never been saved has nothing to show. A disabled
            button just raises the question "why?" — better to not offer it yet.

            It DOES appear for a saved-but-unpublished draft: verified that
            previewing a DRAFT product renders correctly on the storefront, and
            that is exactly when checking your work matters most.
          */}
          {!isNew && (
            <Button
              variant="default"
              onClick={doPreview}
              disabled={busy}
              title="Open the storefront preview in a new tab"
            >
              <Eye size={15} /> Preview
            </Button>
          )}
          <Button variant="primary" onClick={doPublish} disabled={busy}>
            <Upload size={15} /> Publish
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "basic" && (
        <Card>
          <CardBody>
            <div className="grid gap-x-[18px] md:grid-cols-2">
              <Field label="Product Name" required error={errors.name}>
                <Input
                  value={form.name}
                  bad={!!errors.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    set({ name, slug: isNew ? slugify(name) : form.slug });
                  }}
                  placeholder="e.g. Betta Bites F3"
                />
              </Field>
              <Field
                label="Family Slug"
                required
                error={errors.slug}
                hint={isNew ? "Auto-generated from name. Locked after first publish." : "Locked after first publish (SLUG_IMMUTABLE)."}
              >
                <Input
                  value={form.slug}
                  readOnly={!isNew}
                  bad={!!errors.slug}
                  onChange={(e) => set({ slug: slugify(e.target.value) })}
                />
              </Field>
              <Field label="Category" required error={errors.category}>
                <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" required error={errors.status}>
                <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                  {PRODUCT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Badge" hint="Optional promotional tag on the PDP.">
                <Select value={form.badge} onChange={(e) => set({ badge: e.target.value })}>
                  {BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Protein Percentage (%)" required error={errors.protein}>
                <Input
                  type="number"
                  value={form.protein}
                  bad={!!errors.protein}
                  onChange={(e) => set({ protein: e.target.value })}
                  placeholder="42"
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Short Description"
                required
                error={errors.shortDesc}
                hint="Shown under product name on PDP (max 200 chars)."
                counter={`${form.shortDesc.length}/200`}
              >
                <Textarea
                  maxLength={200}
                  value={form.shortDesc}
                  bad={!!errors.shortDesc}
                  onChange={(e) => set({ shortDesc: e.target.value })}
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Full Description"
                hint="Rich text rendered on PDP."
              >
                <RichText
                  value={form.fullDesc}
                  onChange={(fullDesc) => set({ fullDesc })}
                  placeholder="Describe formulation, ingredients, and benefits…"
                  minHeight={200}
                />
              </Field>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12.5px] font-semibold">
                  Key Benefits <span className="font-normal text-muted-2">— up to 8 bullet points</span>
                </label>
                {form.benefits.map((b, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <span className="grid w-5 place-items-center text-muted-2">
                      <GripVertical size={15} />
                    </span>
                    <Input
                      value={b}
                      onChange={(e) => setBenefit(i, e.target.value)}
                      placeholder="e.g. 42% insect protein"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeBenefit(i)}>
                      <Trash2 size={15} className="text-muted" />
                    </Button>
                  </div>
                ))}
                {form.benefits.length < 8 && (
                  <Button variant="ghost" size="sm" onClick={addBenefit}>
                    <Plus size={14} /> Add benefit
                  </Button>
                )}
              </div>

              <Field className="md:col-span-2 mt-2" label="SEO Title" hint="Meta title override.">
                <Input value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} />
              </Field>
              <Field
                className="md:col-span-2"
                label="SEO Description"
                counter={`${form.seoDesc.length}/180`}
              >
                <Textarea
                  maxLength={180}
                  value={form.seoDesc}
                  onChange={(e) => set({ seoDesc: e.target.value })}
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "variants" && (
        <Card>
          <CardHead>
            <CardTitle>Variants / SKUs</CardTitle>
            <Button variant="default" size="sm" className="ml-auto" onClick={addVariant}>
              <Plus size={14} /> Add SKU
            </Button>
          </CardHead>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Pack</Th>
                  <Th>MRP (₹)</Th>
                  <Th>Price (₹)</Th>
                  <Th>Stock</Th>
                  <Th>HSN</Th>
                  <Th right></Th>
                </tr>
              </thead>
              <tbody>
                {form.variants.map((v, i) => (
                  <Tr key={i}>
                    <Td>
                      <Input
                        className="!py-1.5 font-mono text-[12.5px]"
                        value={v.sku}
                        bad={!!errors[`variant_${i}_sku`]}
                        onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })}
                        placeholder="F3-45G"
                      />
                      {/* The red border alone does not say WHAT is wrong. */}
                      {errors[`variant_${i}_sku`] && (
                        <div className="mt-1 text-[11.5px] leading-snug text-red">
                          {errors[`variant_${i}_sku`]}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Input
                        className="!py-1.5"
                        value={v.pack}
                        bad={!!errors[`variant_${i}_pack`]}
                        onChange={(e) => setVariant(i, { pack: e.target.value })}
                        placeholder="45 g"
                      />
                      {/* The red border alone does not say WHAT is wrong. */}
                      {errors[`variant_${i}_pack`] && (
                        <div className="mt-1 text-[11.5px] leading-snug text-red">
                          {errors[`variant_${i}_pack`]}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Input
                        className="!py-1.5 w-24"
                        type="number"
                        step="0.01"
                        value={v.mrp}
                        bad={!!errors[`variant_${i}_mrp`]}
                        onChange={(e) => setVariant(i, { mrp: e.target.value })}
                      />
                      {/* The red border alone does not say WHAT is wrong. */}
                      {errors[`variant_${i}_mrp`] && (
                        <div className="mt-1 text-[11.5px] leading-snug text-red">
                          {errors[`variant_${i}_mrp`]}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Input
                        className="!py-1.5 w-24"
                        type="number"
                        step="0.01"
                        value={v.price}
                        bad={!!errors[`variant_${i}_price`]}
                        onChange={(e) => setVariant(i, { price: e.target.value })}
                      />
                      {/* The red border alone does not say WHAT is wrong. */}
                      {errors[`variant_${i}_price`] && (
                        <div className="mt-1 text-[11.5px] leading-snug text-red">
                          {errors[`variant_${i}_price`]}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Input
                        className="!py-1.5 w-20"
                        type="number"
                        value={v.stock}
                        onChange={(e) => setVariant(i, { stock: Number(e.target.value) })}
                      />
                    </Td>
                    <Td>
                      <Input
                        className="!py-1.5 w-28 font-mono text-[12.5px]"
                        value={v.hsn}
                        onChange={(e) => setVariant(i, { hsn: e.target.value })}
                      />
                    </Td>
                    <Td right>
                      {form.variants.length > 1 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => removeVariant(i)}>
                          <Trash2 size={14} className="text-muted" />
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/*
        Media is its own concern now — grouped by pack, with coverage and a live
        customer preview — so it lives in its own component rather than adding
        another few hundred lines to this file.
      */}
      {tab === "images" && (
        <MediaManager
          media={form.media}
          variants={form.variants}
          /* The SAVED slug, not form.slug: the preview endpoint looks the product
             up by slug, so an edited-but-unsaved slug would 404. A brand-new
             product has none yet, and the manager skips previewing until it does. */
          slug={initial?.slug ?? null}
          representativeSku={form.representativeSku}
          onChange={(media) => set({ media })}
          onVariantsChange={(variants) => set({ variants })}
          onRepresentativeChange={(representativeSku) => set({ representativeSku })}
          onUpload={(files, resourceType, sku) => void handleFiles(files, resourceType, sku)}
          uploading={uploading}
          uploadError={uploadError}
          disabled={busy}
        />
      )}

      {tab === "nutrition" && (
        <Card>
          <CardBody>
            <div className="grid gap-x-[18px] md:grid-cols-2">
              {NUTRITION_FIELDS.map(([key, label, placeholder]) => (
                <Field key={key} label={label}>
                  <Input
                    value={key === "protein" ? form.protein : form.nutrition?.[key] || ""}
                    placeholder={placeholder}
                    readOnly={key === "protein"}
                    onChange={(e) =>
                      key !== "protein" &&
                      set({ nutrition: { ...(form.nutrition || {}), [key]: e.target.value } })
                    }
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              Crude Protein mirrors Basic Info.
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "feeding" && (
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
              <FileText size={16} /> Feeding guidance shown on the PDP.
            </div>
            <div className="grid gap-x-[18px] md:grid-cols-2">
              <Field label="Feeding Frequency">
                <Input
                  value={form.feedFreq}
                  onChange={(e) => set({ feedFreq: e.target.value })}
                  placeholder="2–3 times daily"
                />
              </Field>
              <Field label="Portion Guidance">
                <Input
                  value={form.feedPortion}
                  onChange={(e) => set({ feedPortion: e.target.value })}
                  placeholder="What they finish in 2 minutes"
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Notes"
                hint="Step-by-step feeding notes."
              >
                <RichText
                  value={form.feedNotes}
                  onChange={(feedNotes) => set({ feedNotes })}
                  placeholder="Feeding cautions, water-quality notes…"
                  minHeight={160}
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      )}

      <ConfirmModal
        open={confirmDel}
        onClose={() => {
          setConfirmDel(false);
          setDelText("");
        }}
        title="Delete this product?"
        confirmLabel="Delete product"
        onConfirm={handleDelete}
        message={
          <div>
            <p className="mb-3">
              This permanently removes <b>{form.name}</b> and all its SKUs from the catalogue.
            </p>
            <p className="mb-2 text-[12.5px] text-muted">
              Type <b className="mono">{form.name}</b> to confirm:
            </p>
            <Input value={delText} onChange={(e) => setDelText(e.target.value)} autoFocus />
          </div>
        }
      />

      {/* Full-size media viewer. Rendered last so it layers above everything. */}
      {lightbox !== null && (
        <MediaLightbox
          media={form.media}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

