"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Upload, ImagePlus, Trash2, RotateCcw } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { ARTICLE_TAGS } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { RichText } from "@/components/ui/RichText";
import { ConfirmModal } from "@/components/ui/Modal";

const EMPTY = {
  title: "",
  slug: "",
  tag: "Science",
  readMinutes: 6,
  status: "Draft",
  excerpt: "",
  bodyHtml: "",
  coverImageUrl: null,
  seoTitle: "",
  seoDesc: "",
};

function toForm(api) {
  if (!api) return EMPTY;
  return {
    title: api.title || "",
    slug: api.slug || "",
    tag: api.tag || "Science",
    readMinutes: api.readMinutes ?? api.read ?? 6,
    status: api.statusLabel || api.status || "Draft",
    excerpt: api.excerpt || "",
    bodyHtml: api.bodyHtml || api.body || "",
    coverImageUrl: api.coverImageUrl || null,
    seoTitle: api.seoTitle || "",
    seoDesc: api.seoDesc || "",
    hasDraft: Boolean(api.hasDraft || api.draftPayload),
  };
}

export function ArticleEditor({ initial }) {
  const router = useRouter();
  const permissions = useAuth((s) => s.permissions);
  const createArticle = useData((s) => s.createArticle);
  const saveArticle = useData((s) => s.saveArticle);
  const publishArticle = useData((s) => s.publishArticle);
  const discardArticleDraft = useData((s) => s.discardArticleDraft);
  const articlePreviewToken = useData((s) => s.articlePreviewToken);
  const deleteArticle = useData((s) => s.deleteArticle);
  const uploadImage = useData((s) => s.uploadImage);
  const toast = useToast();

  const isNew = !initial;
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const canPublish = permissions.includes("articles.publish");
  const canDelete = permissions.includes("articles.delete");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (!form.slug.trim()) e.slug = "Slug is required.";
    if (!form.excerpt.trim()) e.excerpt = "Excerpt is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    slug: form.slug.trim(),
    tag: form.tag,
    readMinutes: Number(form.readMinutes) || 1,
    excerpt: form.excerpt.trim(),
    bodyHtml: form.bodyHtml || "",
    coverImageUrl: form.coverImageUrl || null,
    seoTitle: form.seoTitle?.trim() || null,
    seoDesc: form.seoDesc?.trim() || null,
  });

  const doSave = async (silent = false) => {
    if (!validate()) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return false;
    }

    const payload = buildPayload();
    setBusy(true);

    try {
      if (isNew) {
        const created = await createArticle(payload);
        toast.push("Article created as DRAFT.");
        router.push(`/content/articles/${created.slug}/edit`);
      } else {
        await saveArticle(initial.slug, payload);
        if (!silent) toast.push("Draft saved.");
        setForm((f) => ({ ...f, hasDraft: true }));
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
    if (!canPublish) {
      toast.push("You do not have permission to publish articles.", { bad: true });
      return;
    }

    setBusy(true);
    try {
      const targetSlug = isNew ? form.slug : initial.slug;
      if (isNew) {
        const saved = await doSave(true);
        if (!saved) return;
      } else {
        await saveArticle(targetSlug, buildPayload());
      }

      await publishArticle(targetSlug);
      toast.push("Article published.");
      router.push("/content/articles");
    } catch (err) {
      toast.push(err.message || "Failed to publish article.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doDiscardDraft = async () => {
    if (isNew || !initial?.slug) return;
    setBusy(true);
    try {
      await discardArticleDraft(initial.slug);
      toast.push("Draft overlay discarded.");
      router.refresh();
    } catch (err) {
      toast.push(err.message || "Failed to discard draft.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    const targetSlug = isNew ? form.slug : initial.slug;
    if (!targetSlug) {
      toast.push("Article title/slug required before preview.", { bad: true });
      return;
    }

    try {
      toast.push("Generating preview token…");
      const res = await articlePreviewToken(targetSlug);
      const url = res?.url || `http://localhost:3000/blog/${targetSlug}?preview=${res?.token || ""}`;
      window.open(url, "_blank");
    } catch (err) {
      toast.push(err.message || "Failed to generate preview token.", { bad: true });
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      toast.push("You do not have permission to delete articles.", { bad: true });
      return;
    }
    setBusy(true);
    try {
      await deleteArticle(initial.slug);
      toast.push("Article deleted.");
      setConfirmDel(false);
      router.push("/content/articles");
    } catch (err) {
      toast.push(err.message || "Failed to delete article.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const res = await uploadImage(file, "articles");
      set({ coverImageUrl: res.url });
      toast.push("Cover image uploaded successfully.");
    } catch (err) {
      toast.push(
        err.status === 503
          ? "Cloudinary not configured. Image byte upload endpoint requires Cloudinary credentials."
          : err.message || "Failed to upload image.",
        { bad: true }
      );
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Content", href: "/content/articles" },
          { label: "Blog Articles", href: "/content/articles" },
          { label: isNew ? "New Article" : form.title || "Edit Article" },
        ]}
      />
      <PageHeader
        title={isNew ? "New Article" : form.title || "Edit Article"}
        sub="Draft → Preview → Publish. Nothing goes live on save alone."
        actions={
          !isNew &&
          canDelete && (
            <Button variant="danger" onClick={() => setConfirmDel(true)} disabled={busy}>
              <Trash2 size={15} /> Delete
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-card p-3 shadow-card">
        <Pill tone={form.status === "Published" || form.status === "PUBLISHED" ? "green" : "grey"}>
          {form.status}
        </Pill>
        {form.hasDraft && (
          <span className="text-amber-deep font-medium text-[12.5px]">Draft overlay changes present</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {form.hasDraft && !isNew && (
            <Button variant="ghost" size="sm" onClick={doDiscardDraft} disabled={busy}>
              <RotateCcw size={14} /> Discard Draft
            </Button>
          )}
          <Button variant="default" onClick={() => doSave(false)} disabled={busy}>
            <Save size={15} /> Save Draft
          </Button>
          <Button variant="default" onClick={doPreview} disabled={busy}>
            <Eye size={15} /> Preview
          </Button>
          {canPublish && (
            <Button variant="primary" onClick={doPublish} disabled={busy}>
              <Upload size={15} /> Publish
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardBody className="space-y-1">
            <Field label="Title" required error={errors.title} counter={`${form.title.length}/90`}>
              <Input
                maxLength={90}
                value={form.title}
                bad={!!errors.title}
                onChange={(e) =>
                  set({
                    title: e.target.value,
                    slug: isNew ? slugify(e.target.value) : form.slug,
                  })
                }
              />
            </Field>

            <Field label="Excerpt" required error={errors.excerpt} hint="Shown in article cards and previews (max 180 chars).">
              <RichText
                compact
                limit={180}
                value={form.excerpt}
                onChange={(excerpt) => set({ excerpt })}
                placeholder="One or two lines that make someone want to read on…"
                minHeight={80}
              />
            </Field>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Article Body</label>
              <RichText value={form.bodyHtml} onChange={(bodyHtml) => set({ bodyHtml })} />
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="space-y-1">
              <Field label="Slug" required error={errors.slug} hint="URL path for the article.">
                <Input
                  value={form.slug}
                  readOnly={!isNew}
                  bad={!!errors.slug}
                  onChange={(e) => set({ slug: slugify(e.target.value) })}
                  className="mono text-[12.5px]"
                />
              </Field>
              <Field label="Tag">
                <Select value={form.tag} onChange={(e) => set({ tag: e.target.value })}>
                  {ARTICLE_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Read Time (min)">
                <Input
                  type="number"
                  min={1}
                  value={form.readMinutes}
                  onChange={(e) => set({ readMinutes: e.target.value })}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <label className="mb-2 block text-[12.5px] font-semibold">Cover Image</label>
              {form.coverImageUrl ? (
                <div className="relative aspect-video overflow-hidden rounded-md border border-line">
                  <img
                    src={form.coverImageUrl}
                    alt="Cover"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => set({ coverImageUrl: null })}
                    className="absolute right-2 top-2 rounded bg-navy/80 p-1.5 text-white hover:bg-red-deep"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label className="grid aspect-video cursor-pointer place-items-center rounded-md border-[1.5px] border-dashed border-line bg-canvas text-center transition-colors hover:border-teal hover:bg-teal-wash">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                  <div>
                    <ImagePlus size={20} className="mx-auto mb-1.5 text-muted-2" />
                    <div className="text-[12.5px] text-muted">
                      {uploadingCover ? "Uploading to Cloudinary…" : "Click to upload cover image"}
                    </div>
                  </div>
                </label>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-1">
              <div className="mb-1 text-[12.5px] font-semibold">SEO</div>
              <Field label="SEO Title">
                <Input
                  value={form.seoTitle}
                  onChange={(e) => set({ seoTitle: e.target.value })}
                  placeholder={form.title}
                />
              </Field>
              <Field label="SEO Description" counter={`${form.seoDesc.length}/160`}>
                <Textarea
                  maxLength={160}
                  value={form.seoDesc}
                  onChange={(e) => set({ seoDesc: e.target.value })}
                />
              </Field>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete article?"
        confirmLabel="Delete article"
        onConfirm={handleDelete}
        message={`Are you sure you want to delete "${form.title}"? This cannot be undone.`}
      />
    </>
  );
}

