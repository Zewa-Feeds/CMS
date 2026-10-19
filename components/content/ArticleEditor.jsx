"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { useAuth, useData } from "@/lib/store";
import { content as contentApi } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { RichText } from "@/components/ui/RichText";
import { ConfirmModal, InfoBox } from "@/components/ui/Modal";
import { AssetSlot, IssueList } from "@/components/media/AssetSlot";
import { assetIdsIn, useAssets, usePlacements } from "@/components/media/useAssets";
import { BlockEditor } from "./BlockEditor";
import { htmlToBlocks } from "@/lib/html-to-blocks";
import { categoryColor } from "@/lib/categoryColor";

/** Categories already used on the site; any other value is allowed. */
const CATEGORY_SUGGESTIONS = ["NUTRITION", "FEED SCIENCE", "BIOLOGY", "SUSTAINABILITY", "HATCHERY", "SPECIES GUIDE"];

const htmlToText = (html) =>
  (html || "")
    .replace(/<\/(p|li)>\s*/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const csv = (arr) => (arr ?? []).join(", ");
const fromCsv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

const EMPTY = {
  title: "",
  slug: "",
  shortTitle: "",
  tag: "NUTRITION",
  // Empty = automatic, from the category. A value is a deliberate override.
  tagColor: "",
  tags: "",
  readMinutes: 6,
  status: "Draft",
  excerpt: "",
  authorName: "Zewa Research Team",
  stat: "",
  statLabel: "",
  coverAssetId: null,
  coverMobileAssetId: null,
  coverAlt: "",
  seoTitle: "",
  seoDesc: "",
  focusKeyword: "",
  seoKeywords: "",
  ogTitle: "",
  ogDescription: "",
  relatedSlugs: [],
  contentBlocks: [],
  bodyHtml: "",
  coverImageUrl: null,
  scheduledAt: null,
};

/** API row → form. A pending overlay is what the editor edits. */
function toForm(api) {
  if (!api) return EMPTY;
  const a = { ...api, ...(api.draftPayload ?? {}) };
  return {
    title: a.title || "",
    slug: api.slug || "",
    shortTitle: a.shortTitle || "",
    tag: a.tag || "NUTRITION",
    tagColor: a.tagColor || "",
    tags: csv(a.tags),
    readMinutes: a.readMinutes ?? a.read ?? 6,
    status: api.statusLabel || api.status || "Draft",
    excerpt: htmlToText(a.excerpt),
    authorName: a.authorName || "",
    stat: a.stat || "",
    statLabel: a.statLabel || "",
    coverAssetId: a.coverAssetId || null,
    coverMobileAssetId: a.coverMobileAssetId || null,
    coverAlt: a.coverAlt || "",
    seoTitle: a.seoTitle || "",
    seoDesc: a.seoDesc || "",
    focusKeyword: a.focusKeyword || "",
    seoKeywords: csv(a.seoKeywords),
    ogTitle: a.ogTitle || "",
    ogDescription: a.ogDescription || "",
    relatedSlugs: a.relatedSlugs || [],
    contentBlocks: Array.isArray(a.contentBlocks) ? a.contentBlocks : [],
    bodyHtml: a.bodyHtml || a.body || "",
    coverImageUrl: a.coverImageUrl || null,
    scheduledAt: api.scheduledAt || null,
    hasDraft: Boolean(api.hasDraft || api.draftPayload),
  };
}

const nullIfBlank = (v) => (v && String(v).trim() ? String(v).trim() : null);

export function ArticleEditor({ initial }) {
  const router = useRouter();
  const permissions = useAuth((s) => s.permissions);
  const createArticle = useData((s) => s.createArticle);
  const saveArticle = useData((s) => s.saveArticle);
  const publishArticle = useData((s) => s.publishArticle);
  const discardArticleDraft = useData((s) => s.discardArticleDraft);
  const articlePreviewToken = useData((s) => s.articlePreviewToken);
  const deleteArticle = useData((s) => s.deleteArticle);
  const { push } = useToast();
  const placements = usePlacements();

  const isNew = !initial;
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [serverIssues, setServerIssues] = useState([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [otherArticles, setOtherArticles] = useState([]);
  const [confirmSwitchBack, setConfirmSwitchBack] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const canPublish = permissions.includes("articles.publish");
  const canDelete = permissions.includes("articles.delete");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const assets = useAssets(
    useMemo(() => [form.coverAssetId, form.coverMobileAssetId, ...assetIdsIn(form.contentBlocks)].filter(Boolean), [form.coverAssetId, form.coverMobileAssetId, form.contentBlocks]),
  );

  const refreshIssues = useCallback(async () => {
    if (isNew) return;
    try {
      const { issues } = await contentApi.articles.validate(initial.slug);
      setServerIssues(issues);
    } catch {
      /* advisory */
    }
  }, [isNew, initial?.slug]);

  useEffect(() => {
    void refreshIssues();
    contentApi.articles
      .list({ status: "PUBLISHED", limit: 100 })
      .then((res) => setOtherArticles(res.data.filter((a) => a.slug !== initial?.slug)))
      .catch(() => {});
  }, [refreshIssues, initial?.slug]);

  const issuesAt = (path) => serverIssues.filter((i) => i.path === path);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (!form.slug.trim()) e.slug = "Slug is required.";
    if (!form.excerpt.trim()) e.excerpt = "Excerpt is required.";
    if (form.excerpt.length > 300) e.excerpt = "Keep the excerpt under 300 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    slug: form.slug.trim(),
    shortTitle: nullIfBlank(form.shortTitle),
    tag: form.tag.trim(),
    tagColor: nullIfBlank(form.tagColor),
    tags: fromCsv(form.tags),
    readMinutes: Number(form.readMinutes) || 1,
    excerpt: form.excerpt.trim(),
    authorName: form.authorName.trim() || undefined,
    stat: nullIfBlank(form.stat),
    statLabel: nullIfBlank(form.statLabel),
    coverAssetId: form.coverAssetId,
    coverMobileAssetId: form.coverMobileAssetId,
    coverAlt: nullIfBlank(form.coverAlt),
    seoTitle: nullIfBlank(form.seoTitle),
    seoDesc: nullIfBlank(form.seoDesc),
    focusKeyword: nullIfBlank(form.focusKeyword),
    seoKeywords: fromCsv(form.seoKeywords),
    ogTitle: nullIfBlank(form.ogTitle),
    ogDescription: nullIfBlank(form.ogDescription),
    relatedSlugs: form.relatedSlugs,
    contentBlocks: form.contentBlocks,
    // The original rich-text body is KEPT after converting to blocks, so the
    // editor can switch back. The site renders blocks whenever there are any.
    bodyHtml: form.bodyHtml || "",
    // Legacy URL only when no library cover is chosen.
    coverImageUrl: form.coverAssetId ? null : form.coverImageUrl,
  });

  const reportError = (err) => {
    if (err.fields) {
      setErrors(err.fields);
      const [k, v] = Object.entries(err.fields)[0] ?? [];
      push(k ? `${k}: ${v}` : "Fix the highlighted fields.", { bad: true });
    } else {
      push(err.message, { bad: true });
    }
    if (err.details?.issues) setServerIssues(err.details.issues);
  };

  const doSave = async (silent = false) => {
    if (!validate()) {
      push("Fix the highlighted fields.", { bad: true });
      return false;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await createArticle(buildPayload());
        push("Article created as a draft.");
        router.push(`/content/articles/${created.slug}/edit`);
      } else {
        await saveArticle(initial.slug, buildPayload());
        if (!silent) push(form.status.toUpperCase().startsWith("PUBLISHED") ? "Changes saved as a draft — the live article is unchanged until you publish." : "Draft saved.");
        set({ hasDraft: form.status.toUpperCase().startsWith("PUBLISHED") });
        await refreshIssues();
      }
      return true;
    } catch (err) {
      reportError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doPublish = async () => {
    if (!(await doSave(true)) || isNew) return;
    setBusy(true);
    try {
      const res = await publishArticle(initial.slug);
      push(res?.siteVersion ? `Published. Website v${res.siteVersion} is regenerating the blog pages.` : "Article published.");
      router.push("/content/articles");
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const doSchedule = async (when) => {
    if (when && !(await doSave(true))) return;
    setBusy(true);
    try {
      const res = await contentApi.articles.schedule(initial.slug, when ? new Date(when).toISOString() : null);
      set({ scheduledAt: res.scheduledAt });
      push(when ? `Scheduled for ${new Date(when).toLocaleString("en-IN")}.` : "Schedule cancelled.");
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const doDiscardDraft = async () => {
    setBusy(true);
    try {
      await discardArticleDraft(initial.slug);
      push("Pending changes discarded.");
      router.refresh();
      setForm(toForm({ ...initial, draftPayload: null, hasDraft: false }));
    } catch (err) {
      push(err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    if (isNew) return push("Save the article before previewing.", { bad: true });
    if (!(await doSave(true))) return;
    try {
      const res = await articlePreviewToken(initial.slug);
      window.open(res.url, "_blank", "noopener");
    } catch (err) {
      push(err.message, { bad: true });
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteArticle(initial.slug);
      push("Article deleted.");
      router.push("/content/articles");
    } catch (err) {
      push(err.message, { bad: true });
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  };

  const isPublished = String(form.status).toUpperCase().startsWith("PUBLISHED");
  const errorCount = serverIssues.filter((i) => i.level === "error").length;

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
        sub="Draft → Preview → Publish. Edits to a live article stay pending until published."
        actions={
          !isNew &&
          canDelete && (
            <Button variant="danger" onClick={() => setConfirmDel(true)} disabled={busy}>
              <Trash2 size={15} /> Delete
            </Button>
          )
        }
      />

      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-card p-3 shadow-card">
        <Pill tone={isPublished ? "green" : "grey"}>{isPublished ? "Published" : "Draft"}</Pill>
        {form.hasDraft && <Pill tone="amber">Unpublished changes</Pill>}
        {form.scheduledAt && <Pill tone="blue">Scheduled {new Date(form.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Pill>}
        {errorCount > 0 && <Pill tone="red">{errorCount} to fix before publishing</Pill>}
        <div className="ml-auto flex flex-wrap gap-2">
          {form.hasDraft && !isNew && (
            <Button variant="ghost" size="sm" onClick={doDiscardDraft} disabled={busy}>
              <RotateCcw size={14} /> Discard changes
            </Button>
          )}
          <Button onClick={() => doSave(false)} disabled={busy}>
            <Save size={15} /> Save draft
          </Button>
          <Button onClick={doPreview} disabled={busy || isNew}>
            <Eye size={15} /> Preview
          </Button>
          {canPublish && !isNew && isPublished && (
            <Button variant="ghost" onClick={() => setConfirmUnpublish(true)} disabled={busy}>
              Unpublish
            </Button>
          )}
          {canPublish && !isNew && (
            <Button variant="primary" onClick={doPublish} disabled={busy}>
              <Upload size={15} /> Publish now
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-1">
              <Field label="Title" required error={errors.title} counter={`${form.title.length}/180`}>
                <Input
                  maxLength={180}
                  value={form.title}
                  bad={!!errors.title}
                  onChange={(e) => set({ title: e.target.value, slug: isNew ? slugify(e.target.value) : form.slug })}
                />
              </Field>
              <Field label="Excerpt" required error={errors.excerpt} counter={`${form.excerpt.length}/300`} hint="Shown on cards, the Knowledge Hub and as the fallback meta description.">
                <Textarea rows={3} maxLength={300} value={form.excerpt} bad={!!errors.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHead><CardTitle>Body</CardTitle></CardHead>
            <CardBody>
              {form.contentBlocks.length === 0 && form.bodyHtml ? (
                <div className="space-y-2">
                  <InfoBox>
                    This article uses the older rich-text editor, which cannot hold images, stat rows, FAQs or tables. To add
                    those, convert it to blocks: each heading, paragraph and list becomes its own block, and the original is
                    kept so you can switch back.
                  </InfoBox>
                  <RichText value={form.bodyHtml} onChange={(bodyHtml) => set({ bodyHtml })} />
                  <Button
                    size="sm"
                    onClick={() => {
                      const blocks = htmlToBlocks(form.bodyHtml);
                      set({ contentBlocks: blocks.length ? blocks : [{ type: "p", text: "" }] });
                      push(`Converted into ${blocks.length} block${blocks.length === 1 ? "" : "s"}. Nothing is saved until you press Save draft.`);
                    }}
                  >
                    Convert to blocks
                  </Button>
                </div>
              ) : (
                <>
                  {form.bodyHtml && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-[12.5px] text-muted">
                      Converted from the older rich-text body. The original is kept.
                      <Button size="sm" className="ml-auto" onClick={() => setConfirmSwitchBack(true)}>
                        Switch back to the original body
                      </Button>
                    </div>
                  )}
                  <BlockEditor blocks={form.contentBlocks} onChange={(contentBlocks) => set({ contentBlocks })} placements={placements} assets={assets} issuesAt={issuesAt} />
                </>
              )}
              <IssueList issues={issuesAt("article.blocks")} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-1">
              <Field label="Slug" required error={errors.slug} hint={isNew ? "The article’s URL." : "Locked once published — it is the URL."}>
                <Input value={form.slug} readOnly={!isNew} bad={!!errors.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} className="mono text-[12.5px]" />
              </Field>
              <Field label="Short title" hint="Breadcrumbs and compact cards.">
                <Input value={form.shortTitle} maxLength={90} onChange={(e) => set({ shortTitle: e.target.value })} />
              </Field>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <Field label="Category" hint="Matches a blog topic of the same name.">
                  {/*
                    A real dropdown of the blog's topics. "Other…" reveals a text
                    box for a new category. The old field was a free-text box with
                    a browser suggestion list, which looked like a broken select
                    and showed an empty value until something was typed.
                  */}
                  <Select
                    value={CATEGORY_SUGGESTIONS.includes(form.tag) ? form.tag : "__other"}
                    onChange={(e) => set({ tag: e.target.value === "__other" ? "" : e.target.value })}
                  >
                    {CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__other">Other…</option>
                  </Select>
                  {!CATEGORY_SUGGESTIONS.includes(form.tag) && (
                    <Input
                      className="mt-2"
                      placeholder="New category, e.g. SHRIMP CARE"
                      value={form.tag}
                      onChange={(e) => set({ tag: e.target.value.toUpperCase() })}
                    />
                  )}
                </Field>
                {/*
                  Automatic by default — every article in a category shares its
                  colour. "Custom" stores an override for this article only;
                  turning it off clears the override.
                */}
                <Field label="Colour" hint={form.tagColor ? "This article only." : "From the category."}>
                  <div className="flex items-center gap-2">
                    {form.tagColor ? (
                      <input
                        type="color"
                        value={form.tagColor}
                        onChange={(e) => set({ tagColor: e.target.value })}
                        className="h-[38px] w-full cursor-pointer rounded-md border border-line"
                        aria-label="Custom colour"
                      />
                    ) : (
                      <div
                        className="h-[38px] w-full rounded-md border border-line"
                        style={{ background: categoryColor(form.tag) }}
                        title={categoryColor(form.tag)}
                        aria-label={`Automatic colour ${categoryColor(form.tag)}`}
                      />
                    )}
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(form.tagColor)}
                      onChange={(e) => set({ tagColor: e.target.checked ? categoryColor(form.tag) : "" })}
                    />
                    Custom colour
                  </label>
                </Field>
              </div>
              <Field label="Tags" hint="Comma-separated.">
                <Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Read time (min)">
                  <Input type="number" min={1} value={form.readMinutes} onChange={(e) => set({ readMinutes: e.target.value })} />
                </Field>
                <Field label="Author">
                  <Input value={form.authorName} onChange={(e) => set({ authorName: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-[96px_1fr] gap-2">
                <Field label="Headline stat"><Input value={form.stat} maxLength={20} placeholder="88%" onChange={(e) => set({ stat: e.target.value })} /></Field>
                <Field label="Stat label"><Input value={form.statLabel} maxLength={120} placeholder="pepsin digestibility" onChange={(e) => set({ statLabel: e.target.value })} /></Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead><CardTitle>Cover</CardTitle></CardHead>
            <CardBody className="space-y-3">
              <AssetSlot
                label="Cover image"
                placement={placements?.["article.cover"]}
                value={form.coverAssetId ? { assetId: form.coverAssetId } : null}
                assets={assets}
                onChange={(v) => set({ coverAssetId: v?.assetId ?? null })}
                required={!form.coverImageUrl}
                serverIssues={issuesAt("article.coverAssetId")}
              />
              {!form.coverAssetId && form.coverImageUrl && (
                <p className="text-[12px] text-muted">Currently using a legacy cover URL. Choose a library file to manage it here.</p>
              )}
              <AssetSlot
                label="Mobile hero (optional)"
                placement={placements?.["article.cover.mobile"]}
                value={form.coverMobileAssetId ? { assetId: form.coverMobileAssetId } : null}
                assets={assets}
                onChange={(v) => set({ coverMobileAssetId: v?.assetId ?? null })}
                serverIssues={issuesAt("article.coverMobileAssetId")}
              />
              <Field label="Cover alt text">
                <Input value={form.coverAlt} onChange={(e) => set({ coverAlt: e.target.value })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHead><CardTitle>SEO</CardTitle></CardHead>
            <CardBody className="space-y-1">
              <Field label="SEO title" counter={`${form.seoTitle.length}/70`}>
                <Input maxLength={70} value={form.seoTitle} placeholder={`${form.shortTitle || form.title} | Zewa Feeds`} onChange={(e) => set({ seoTitle: e.target.value })} />
              </Field>
              <Field label="Meta description" counter={`${form.seoDesc.length}/180`}>
                <Textarea maxLength={180} rows={3} value={form.seoDesc} placeholder={form.excerpt} onChange={(e) => set({ seoDesc: e.target.value })} />
              </Field>
              <IssueList issues={issuesAt("article.seoDesc")} />
              <Field label="Focus keyword"><Input value={form.focusKeyword} onChange={(e) => set({ focusKeyword: e.target.value })} /></Field>
              <Field label="Keywords" hint="Comma-separated."><Input value={form.seoKeywords} onChange={(e) => set({ seoKeywords: e.target.value })} /></Field>
              <Field label="Social share title"><Input maxLength={90} value={form.ogTitle} onChange={(e) => set({ ogTitle: e.target.value })} /></Field>
              <Field label="Social share description"><Textarea maxLength={200} rows={2} value={form.ogDescription} onChange={(e) => set({ ogDescription: e.target.value })} /></Field>
            </CardBody>
          </Card>

          <Card>
            <CardHead><CardTitle>Related reading</CardTitle></CardHead>
            <CardBody className="space-y-2">
              <p className="text-[12px] text-muted">Two cards under the article. Leave empty for the newest others.</p>
              {form.relatedSlugs.map((slug) => (
                <div key={slug} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-[13px]">
                  <span className="flex-1 truncate">{otherArticles.find((a) => a.slug === slug)?.title ?? slug}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => set({ relatedSlugs: form.relatedSlugs.filter((s) => s !== slug) })} aria-label="Remove"><X size={14} /></Button>
                </div>
              ))}
              {form.relatedSlugs.length < 2 && (
                <Select value="" onChange={(e) => e.target.value && set({ relatedSlugs: [...form.relatedSlugs, e.target.value] })}>
                  <option value="">+ Pick a related article…</option>
                  {otherArticles.filter((a) => !form.relatedSlugs.includes(a.slug)).map((a) => <option key={a.slug} value={a.slug}>{a.title}</option>)}
                </Select>
              )}
            </CardBody>
          </Card>

          {canPublish && !isNew && (
            <Card>
              <CardHead><CardTitle>Schedule</CardTitle></CardHead>
              <CardBody className="space-y-2">
                {form.scheduledAt ? (
                  <div className="flex items-center gap-2 text-[13px]">
                    <CalendarClock size={15} /> Publishes {new Date(form.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => doSchedule(null)} disabled={busy}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <Button onClick={() => doSchedule(scheduleAt)} disabled={busy || !scheduleAt}>Schedule</Button>
                  </div>
                )}
                <p className="text-[11.5px] text-muted">Checked now, published within a minute of the time, with the same checks as Publish now.</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        title="Take this article off the website?"
        confirmLabel="Unpublish"
        onConfirm={async () => {
          setBusy(true);
          try {
            await contentApi.articles.setStatus(initial.slug, "DRAFT");
            push("Unpublished. It leaves the blog within about a minute; it stays here as a draft.");
            set({ status: "Draft" });
          } catch (err) {
            reportError(err);
          } finally {
            setBusy(false);
            setConfirmUnpublish(false);
          }
        }}
        message="It becomes a draft again: it leaves the blog, the homepage Knowledge Hub and the sitemap, and its link shows “not found”. You can publish it again at any time."
      />

      <ConfirmModal
        open={confirmSwitchBack}
        onClose={() => setConfirmSwitchBack(false)}
        title="Switch back to the original body?"
        confirmLabel="Switch back"
        onConfirm={() => {
          set({ contentBlocks: [] });
          setConfirmSwitchBack(false);
          push("Back to the original rich-text body. Save draft to keep it; your blocks are discarded.");
        }}
        message="The blocks you have now (including any images or stat rows you added) are removed, and the article goes back to its original rich-text body."
      />

      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete article?"
        confirmLabel="Delete article"
        onConfirm={handleDelete}
        message={`“${form.title}” will be removed${isPublished ? " from the website on the next regeneration" : ""}.`}
      />
    </>
  );
}
