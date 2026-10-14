"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, Film, Image as ImageIcon, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { content as contentApi, products as productsApi, site as siteApi } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";
import { InfoBox, Modal, WarnBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AssetSlot, IssueList } from "@/components/media/AssetSlot";
import { assetIdsIn, useAssets, usePlacements } from "@/components/media/useAssets";
import { ABOUT_COPY_SECTIONS, AboutCopySection, FieldsEditor, PROOF_FIELDS, STATEMENT_FIELDS } from "./CopyEditor";
import { LettersEditor } from "./LettersEditor";

const TABS = [
  { key: "home", label: "Homepage" },
  { key: "products", label: "Products page" },
  { key: "blog", label: "Blog placements" },
  { key: "about", label: "About page" },
  { key: "letters", label: "Letters" },
];

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}`;

function move(list, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Set a value at a dotted path, immutably. */
function setIn(obj, path, value) {
  const [head, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[head] = rest.length ? setIn(obj[head], rest, value) : value;
  return copy;
}

export function WebsiteEditor() {
  const { push } = useToast();
  const permissions = useAuth((s) => s.permissions);
  const canPublish = permissions.includes("site.publish");
  const placements = usePlacements();

  const [tab, setTab] = useState("home");
  const [draft, setDraft] = useState(null); // { sections, revision, liveVersion, hasUnpublishedChanges }
  const [sections, setSections] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState({ issues: [], errors: 0, warnings: 0 });
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);

  const assets = useAssets(useMemo(() => assetIdsIn(sections), [sections]));

  const refreshChecks = useCallback(async () => {
    try {
      setCheck(await siteApi.validate());
    } catch {
      /* the checklist is advisory; publish re-checks */
    }
  }, []);

  const load = useCallback(async () => {
    const d = await siteApi.draft();
    setDraft(d);
    setSections(d.sections);
    setDirty(false);
    setConflict(false);
    await refreshChecks();
  }, [refreshChecks]);

  useEffect(() => {
    load().catch((err) => push(err.message, { bad: true }));
  }, [load, push]);

  // Leaving with unsaved edits loses them; say so.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (path, value) => {
    setSections((s) => setIn(s, path, value));
    setDirty(true);
  };

  const issuesAt = (path) =>
    check.issues.filter((i) => i.path === path).map((i) => ({ level: i.level, message: i.message }));

  const save = async () => {
    setBusy(true);
    try {
      const d = await siteApi.saveDraft(draft.revision, sections);
      setDraft(d);
      setSections(d.sections);
      setDirty(false);
      push("Draft saved. Nothing is live until it is published.");
      await refreshChecks();
      return true;
    } catch (err) {
      if (err.status === 409) setConflict(true);
      const first = err.fields ? Object.entries(err.fields)[0] : null;
      push(first ? `${first[0]}: ${first[1]}` : err.message, { bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const preview = async (page, slug) => {
    if (dirty && !(await save())) return;
    try {
      const { url } = await siteApi.previewToken();
      const q = page === "home" ? "" : `&page=${page}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`;
      window.open(`${url}${q}`, "_blank", "noopener");
    } catch (err) {
      push(err.message, { bad: true });
    }
  };

  const openPublish = async () => {
    if (dirty && !(await save())) return;
    await refreshChecks();
    setPublishing(true);
  };

  if (!sections || !placements) {
    return <div className="py-20 text-center text-[13px] text-muted">Loading website content…</div>;
  }

  const P = placements;

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Website" }]} />
      <PageHeader
        title="Website content"
        sub="Edit the draft, preview it, then publish. The live site only changes on Publish — and only the pages that changed are rebuilt."
      />

      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-card p-3 shadow-card">
        {draft.liveVersion ? <Pill tone="green">Live: v{draft.liveVersion}</Pill> : <Pill tone="grey">Nothing published yet</Pill>}
        {dirty ? (
          <Pill tone="amber">Unsaved edits</Pill>
        ) : draft.hasUnpublishedChanges ? (
          <Pill tone="amber">Draft differs from live</Pill>
        ) : (
          <Pill tone="grey" dot={false}>Draft matches live</Pill>
        )}
        {check.errors > 0 && <Pill tone="red">{check.errors} to fix</Pill>}
        {check.warnings > 0 && <Pill tone="amber" dot={false}>{check.warnings} warning{check.warnings > 1 ? "s" : ""}</Pill>}
        <Link href="/content/publishing" className="text-[12.5px] text-muted underline-offset-2 hover:underline">
          Publishing history
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => preview(tab === "about" || tab === "letters" ? tab : "home")} disabled={busy}>
            <Eye size={15} /> Preview {tab === "about" ? "About" : tab === "letters" ? "newest letter" : "Homepage"}
          </Button>
          <Button onClick={save} disabled={busy || !dirty}>
            <Save size={15} /> Save draft
          </Button>
          {canPublish && (
            <Button variant="primary" onClick={openPublish} disabled={busy}>
              <Rocket size={15} /> Publish…
            </Button>
          )}
        </div>
      </div>

      {conflict && (
        <div className="mb-4">
          <WarnBox>
            Someone else saved the website draft after you opened it. Your edits are still on this screen.{" "}
            <button className="font-semibold underline" onClick={() => load()}>Reload their version</button> (your
            unsaved edits will be lost), then reapply.
          </WarnBox>
        </div>
      )}
      {!canPublish && (
        <div className="mb-4">
          <InfoBox>You can edit and preview the draft. Publishing to customers is done by an Admin.</InfoBox>
        </div>
      )}

      <Tabs
        tabs={TABS.map((t) => ({ ...t, count: check.issues.filter((i) => i.path.startsWith(`${t.key}.`) && i.level === "error").length || null }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "home" && <HomeTab s={sections.home} update={update} P={P} assets={assets} issuesAt={issuesAt} />}
      {tab === "products" && <ProductsTab s={sections.products} update={update} P={P} assets={assets} issuesAt={issuesAt} />}
      {tab === "blog" && <BlogTab s={sections.blog} update={update} issuesAt={issuesAt} />}
      {tab === "about" && <AboutTab s={sections.about} update={update} P={P} assets={assets} issuesAt={issuesAt} />}
      {tab === "letters" && (
        <LettersEditor
          letters={sections.letters ?? []}
          onChange={(v) => update(["letters"], v)}
          P={P}
          assets={assets}
          issuesAt={issuesAt}
          onPreview={(slug) => preview("letters", slug)}
        />
      )}

      <PublishModal
        open={publishing}
        check={check}
        onClose={() => setPublishing(false)}
        onPublished={async (pub) => {
          setPublishing(false);
          push(`Published v${pub.version}. The storefront is regenerating the changed pages.`);
          await load();
        }}
      />
    </>
  );
}

// ============================================================================
// HOMEPAGE
// ============================================================================

function HomeTab({ s, update, P, assets, issuesAt }) {
  const slides = s.heroSlides;
  const setSlides = (next) => update(["home", "heroSlides"], next);
  const at = (i, key) => `home.heroSlides.${i}.${key}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead>
          <CardTitle>Hero slides</CardTitle>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                setSlides([...slides, { id: newId("banner"), type: "banner", enabled: false, desktop: null, mobile: null, alt: "" }])
              }
            >
              <ImageIcon size={13} /> Add banner
            </Button>
            <Button
              size="sm"
              onClick={() => setSlides([...slides, { id: newId("video"), type: "video", enabled: false, mp4: null, webm: null, mobileMp4: null, poster: null }])}
            >
              <Film size={13} /> Add video
            </Button>
          </div>
        </CardHead>
        <CardBody className="space-y-3">
          <p className="text-[12.5px] text-muted">
            Slides rotate in this order. Banners and the statement hold for 5 seconds; a video advances when it ends.
            New slides start disabled so a half-finished one never ships.
          </p>
          {slides.map((slide, i) => {
            const set = (key, v) => setSlides(slides.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
            return (
              <div key={slide.id} className="rounded-lg border border-line p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => setSlides(move(slides, i, -1))} aria-label="Move up"><ChevronUp size={14} /></Button>
                    <Button variant="ghost" size="icon-sm" disabled={i === slides.length - 1} onClick={() => setSlides(move(slides, i, 1))} aria-label="Move down"><ChevronDown size={14} /></Button>
                  </div>
                  <span className="text-[13px] font-semibold">
                    {i + 1}.{" "}
                    {slide.type === "statement" ? "Statement — “Your fish is built to digest insects”" : slide.type === "banner" ? "Banner" : "Brand video"}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <Switch checked={slide.enabled} onChange={(v) => set("enabled", v)} label={slide.enabled ? "Shown" : "Hidden"} />
                    {slide.type !== "statement" && (
                      <Button variant="danger" size="sm" onClick={() => setSlides(slides.filter((_, j) => j !== i))}>
                        <Trash2 size={13} /> Remove
                      </Button>
                    )}
                  </div>
                </div>

                {slide.type === "statement" && (
                  <p className="text-[12.5px] text-muted">The statement slide’s copy and digestion chart are part of the page design.</p>
                )}

                {slide.type === "banner" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 xl:grid-cols-2">
                      <AssetSlot label="Desktop (≥768px)" placement={P["home.hero.banner.desktop"]} value={slide.desktop} assets={assets} onChange={(v) => set("desktop", v)} required={slide.enabled} serverIssues={issuesAt(at(i, "desktop"))} />
                      <AssetSlot label="Mobile (<768px)" placement={P["home.hero.banner.mobile"]} value={slide.mobile} assets={assets} onChange={(v) => set("mobile", v)} required={slide.enabled} serverIssues={issuesAt(at(i, "mobile"))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Alt text" required hint="Read aloud by screen readers — describe what the banner says.">
                        <Input value={slide.alt} maxLength={200} onChange={(e) => set("alt", e.target.value)} />
                      </Field>
                      <Field label="Link (optional)" hint="A site path like /products/betta-bites, or https://…">
                        <Input value={slide.href ?? ""} onChange={(e) => set("href", e.target.value || null)} />
                      </Field>
                    </div>
                  </div>
                )}

                {slide.type === "video" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 xl:grid-cols-2">
                      <AssetSlot label="Desktop MP4" placement={P["home.hero.video.mp4"]} value={slide.mp4} assets={assets} onChange={(v) => set("mp4", v)} required={slide.enabled} serverIssues={issuesAt(at(i, "mp4"))} />
                      <AssetSlot label="Poster frame" placement={P["home.hero.video.poster"]} value={slide.poster} assets={assets} onChange={(v) => set("poster", v)} required={slide.enabled} serverIssues={issuesAt(at(i, "poster"))} />
                      <AssetSlot label="Mobile MP4 (recommended)" placement={P["home.hero.video.mobile"]} value={slide.mobileMp4} assets={assets} onChange={(v) => set("mobileMp4", v)} serverIssues={issuesAt(at(i, "mobileMp4"))} />
                      <AssetSlot label="Desktop WebM (optional)" placement={P["home.hero.video.webm"]} value={slide.webm} assets={assets} onChange={(v) => set("webm", v)} serverIssues={issuesAt(at(i, "webm"))} />
                    </div>
                    <Field label="Accessible label (optional)">
                      <Input value={slide.label ?? ""} maxLength={120} onChange={(e) => set("label", e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
          <IssueList issues={issuesAt("home.heroSlides")} />
        </CardBody>
      </Card>

      <Card>
        <CardHead><CardTitle>Statement slide — words</CardTitle></CardHead>
        <CardBody>
          <p className="mb-3 text-[12.5px] text-muted">The first hero slide’s copy and its digestion comparison. The layout stays as designed.</p>
          <FieldsEditor fields={STATEMENT_FIELDS} value={s.statement} onChange={(v) => update(["home", "statement"], v)} />
        </CardBody>
      </Card>

      <Card>
        <CardHead><CardTitle>Clinical proof figures</CardTitle></CardHead>
        <CardBody>
          <FieldsEditor fields={PROOF_FIELDS} value={s.proof} onChange={(v) => update(["home", "proof"], v)} />
        </CardBody>
      </Card>

      <ProductShowcaseCard slugs={s.showcase.productSlugs} onChange={(v) => update(["home", "showcase", "productSlugs"], v)} issuesAt={issuesAt} />
      <ArticlePickCard
        title="Knowledge Hub (homepage)"
        hint="Up to three articles, in order. Leave empty to show the newest three. Each article’s cover is the background behind its row (spec #4)."
        max={3}
        slugs={s.knowledgeHub.articleSlugs}
        onChange={(v) => update(["home", "knowledgeHub", "articleSlugs"], v)}
        issues={issuesAt}
        pathPrefix="home.knowledgeHub.articleSlugs"
      />
    </div>
  );
}

function OrderedSlugList({ items, labelFor, onChange, options, max, placeholder, pathPrefix, issuesAt }) {
  const free = options.filter((o) => !items.includes(o.value));
  return (
    <div className="space-y-2">
      {items.map((slug, i) => (
        <div key={slug}>
          <div className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
            <span className="w-5 text-right font-mono text-[11px] text-muted">{i + 1}</span>
            <span className="flex-1 truncate text-[13px]">{labelFor(slug)}</span>
            <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label="Move up"><ChevronUp size={14} /></Button>
            <Button variant="ghost" size="icon-sm" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label="Move down"><ChevronDown size={14} /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(items.filter((x) => x !== slug))} aria-label="Remove"><Trash2 size={14} /></Button>
          </div>
          {issuesAt && <IssueList issues={issuesAt(`${pathPrefix}.${i}`)} />}
        </div>
      ))}
      {items.length < max && (
        <Select value="" onChange={(e) => e.target.value && onChange([...items, e.target.value])}>
          <option value="">{placeholder}</option>
          {free.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )}
    </div>
  );
}

function ProductShowcaseCard({ slugs, onChange, issuesAt }) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    productsApi
      .list({ limit: 100 })
      .then((res) => setOptions(res.data.map((p) => ({ value: p.slug, label: `${p.name}${p.status && p.status !== "ACTIVE" && p.status !== "Active" ? ` (${p.statusLabel ?? p.status})` : ""}` }))))
      .catch(() => setOptions([]));
  }, []);
  const label = (slug) => options.find((o) => o.value === slug)?.label ?? slug;

  return (
    <Card>
      <CardHead><CardTitle>Product showcase — “The Range”</CardTitle></CardHead>
      <CardBody>
        <p className="mb-3 text-[12.5px] text-muted">
          Which products lead the homepage, in order. Names, photos and prices always come from the live catalogue; an
          unpublished product is skipped and the row is filled from the rest of the range.
        </p>
        <OrderedSlugList items={slugs} labelFor={label} onChange={onChange} options={options} max={6} placeholder="+ Add a product…" pathPrefix="home.showcase.productSlugs" issuesAt={issuesAt} />
      </CardBody>
    </Card>
  );
}

function usePublishedArticles() {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    contentApi.articles
      .list({ status: "PUBLISHED", limit: 100 })
      .then((res) => setOptions(res.data.map((a) => ({ value: a.slug, label: a.title }))))
      .catch(() => setOptions([]));
  }, []);
  return options;
}

function ArticlePickCard({ title, hint, max, slugs, onChange, issues, pathPrefix }) {
  const options = usePublishedArticles();
  return (
    <Card>
      <CardHead><CardTitle>{title}</CardTitle></CardHead>
      <CardBody>
        <p className="mb-3 text-[12.5px] text-muted">{hint}</p>
        <OrderedSlugList items={slugs} labelFor={(slug) => options.find((o) => o.value === slug)?.label ?? slug} onChange={onChange} options={options} max={max} placeholder="+ Pin an article…" pathPrefix={pathPrefix} issuesAt={issues} />
      </CardBody>
    </Card>
  );
}

// ============================================================================
// PRODUCTS PAGE
// ============================================================================

function ProductsTab({ s, update, P, assets, issuesAt }) {
  const b = s.heroBanner;
  return (
    <div className="space-y-4">
      <Card>
        <CardHead>
          <CardTitle>Products page hero banner</CardTitle>
          <div className="ml-auto">
            <Switch checked={b.enabled} onChange={(v) => update(["products", "heroBanner", "enabled"], v)} label={b.enabled ? "Shown" : "Hidden"} />
          </div>
        </CardHead>
        <CardBody className="space-y-3">
          <AssetSlot label="Banner" placement={P["products.hero"]} value={b.image} assets={assets} onChange={(v) => update(["products", "heroBanner", "image"], v)} required={b.enabled} serverIssues={issuesAt("products.heroBanner.image")} />
          <Field label="Alt text" required={b.enabled}>
            <Input value={b.alt} maxLength={200} onChange={(e) => update(["products", "heroBanner", "alt"], e.target.value)} />
          </Field>
          <IssueList issues={issuesAt("products.heroBanner.alt")} />
        </CardBody>
      </Card>
      <InfoBox>
        The spotlight rotator lives under <Link className="underline" href="/content/banners">Spotlight Banners</Link>; product photos and
        videos under each product’s Media tab.
      </InfoBox>
    </div>
  );
}

// ============================================================================
// BLOG
// ============================================================================

function BlogTab({ s, update, issuesAt }) {
  const options = usePublishedArticles();
  const [topicsText, setTopicsText] = useState(s.topics.join(", "));
  return (
    <div className="space-y-4">
      <Card>
        <CardHead><CardTitle>Featured article</CardTitle></CardHead>
        <CardBody>
          <Field label="Shown as the large card at the top of /blog" hint="Uses the article’s cover at a fixed 560px height (spec #10).">
            <Select value={s.featuredSlug ?? ""} onChange={(e) => update(["blog", "featuredSlug"], e.target.value || null)}>
              <option value="">The newest article (default)</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <IssueList issues={issuesAt("blog.featuredSlug")} />
        </CardBody>
      </Card>
      <Card>
        <CardHead><CardTitle>Topic filter</CardTitle></CardHead>
        <CardBody>
          <Field label="Topics, in order" hint="Comma-separated. Keep “All” first. A topic matches an article whose category has the same name.">
            <Input
              value={topicsText}
              onChange={(e) => {
                setTopicsText(e.target.value);
                update(["blog", "topics"], e.target.value.split(",").map((t) => t.trim()).filter(Boolean));
              }}
            />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================================
// ABOUT
// ============================================================================

function AboutTab({ s, update, P, assets, issuesAt }) {
  const ms = s.milestones;
  const logos = s.logos;
  const setMs = (v) => update(["about", "milestones"], v);
  const setLogos = (v) => update(["about", "logos"], v);

  return (
    <div className="space-y-4">
      <Card>
        <CardHead><CardTitle>“Our Story” video</CardTitle></CardHead>
        <CardBody className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div>
            <Field label="YouTube video id" required hint="The 11 characters after v= in the YouTube link (spec #13 — master at 16:9).">
              <Input className="mono" value={s.storyVideo.youtubeId} maxLength={11} onChange={(e) => update(["about", "storyVideo", "youtubeId"], e.target.value.trim())} />
            </Field>
            <Field label="Title" required hint="Announced by screen readers.">
              <Input value={s.storyVideo.title} onChange={(e) => update(["about", "storyVideo", "title"], e.target.value)} />
            </Field>
          </div>
          {/^[A-Za-z0-9_-]{11}$/.test(s.storyVideo.youtubeId) && (
            <img
              src={`https://i.ytimg.com/vi/${s.storyVideo.youtubeId}/hqdefault.jpg`}
              alt="Video thumbnail"
              className="aspect-video w-full rounded-md border border-line object-cover"
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Founder section</CardTitle>
          <div className="ml-auto">
            <Switch checked={s.founder.enabled} onChange={(v) => update(["about", "founder", "enabled"], v)} label={s.founder.enabled ? "Shown" : "Hidden"} />
          </div>
        </CardHead>
        <CardBody className="space-y-3">
          <AssetSlot label="Portrait" placement={P["about.founder"]} value={s.founder.portrait} assets={assets} onChange={(v) => update(["about", "founder", "portrait"], v)} required={s.founder.enabled} serverIssues={issuesAt("about.founder.portrait")} />
          <Field label="Alt text" required={s.founder.enabled}>
            <Input value={s.founder.alt} onChange={(e) => update(["about", "founder", "alt"], e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Milestones</CardTitle>
          <Button size="sm" className="ml-auto" onClick={() => setMs([...ms, { id: newId("m"), year: String(new Date().getFullYear()), points: [""], image: null, imageAlt: "" }])}>
            <Plus size={13} /> Add milestone
          </Button>
        </CardHead>
        <CardBody className="space-y-3">
          {ms.map((m, i) => {
            const set = (key, v) => setMs(ms.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
            return (
              <div key={m.id} className="rounded-lg border border-line p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => setMs(move(ms, i, -1))} aria-label="Move up"><ChevronUp size={14} /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === ms.length - 1} onClick={() => setMs(move(ms, i, 1))} aria-label="Move down"><ChevronDown size={14} /></Button>
                  <span className="text-[13px] font-semibold">Card {String(i + 1).padStart(2, "0")}</span>
                  <Button variant="danger" size="sm" className="ml-auto" onClick={() => setMs(ms.filter((_, j) => j !== i))}><Trash2 size={13} /> Remove</Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-[140px_1fr]">
                  <Field label="Year" required>
                    <Input value={m.year} maxLength={12} onChange={(e) => set("year", e.target.value)} />
                  </Field>
                  <Field label="Points" required hint="One per line.">
                    <Textarea rows={Math.max(3, m.points.length)} value={m.points.join("\n")} onChange={(e) => set("points", e.target.value.split("\n"))} onBlur={(e) => set("points", e.target.value.split("\n").map((p) => p.trim()).filter(Boolean))} />
                  </Field>
                </div>
                <div className="mt-2 space-y-2">
                  <AssetSlot label="Photo" placement={P["about.milestone"]} value={m.image} assets={assets} onChange={(v) => set("image", v)} serverIssues={issuesAt(`about.milestones.${i}.image`)} />
                  <Field label="Photo alt text">
                    <Input value={m.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value)} />
                  </Field>
                  <IssueList issues={issuesAt(`about.milestones.${i}.imageAlt`)} />
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Institution logos (“Backed by”)</CardTitle>
          <Button size="sm" className="ml-auto" onClick={() => setLogos([...logos, { id: newId("logo"), image: null, alt: "" }])}>
            <Plus size={13} /> Add logo
          </Button>
        </CardHead>
        <CardBody className="space-y-3">
          {logos.map((l, i) => {
            const set = (key, v) => setLogos(logos.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
            return (
              <div key={l.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-line p-3">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => setLogos(move(logos, i, -1))} aria-label="Move up"><ChevronUp size={14} /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === logos.length - 1} onClick={() => setLogos(move(logos, i, 1))} aria-label="Move down"><ChevronDown size={14} /></Button>
                </div>
                <div className="min-w-[280px] flex-1 space-y-2">
                  <AssetSlot label={`Logo ${i + 1}`} placement={P["about.logo"]} value={l.image} assets={assets} onChange={(v) => set("image", v)} required serverIssues={issuesAt(`about.logos.${i}.image`)} />
                  <Field label="Institution’s full name" required hint="Logos are wordmarks a screen reader cannot read.">
                    <Input value={l.alt} onChange={(e) => set("alt", e.target.value)} />
                  </Field>
                </div>
                <Button variant="danger" size="sm" onClick={() => setLogos(logos.filter((_, j) => j !== i))}><Trash2 size={13} /> Remove</Button>
              </div>
            );
          })}
        </CardBody>
      </Card>
      <Card>
        <CardHead><CardTitle>Page copy</CardTitle></CardHead>
        <CardBody className="space-y-2">
          <p className="text-[12.5px] text-muted">Every heading and paragraph on the About page, section by section.</p>
          {ABOUT_COPY_SECTIONS.map((sec) => (
            <details key={sec.key} className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">{sec.title}</summary>
              <div className="px-3 pb-3">
                <AboutCopySection section={sec} value={s.copy?.[sec.key]} onChange={(v) => update(["about", "copy", sec.key], v)} />
              </div>
            </details>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================================
// PUBLISH
// ============================================================================

function PublishModal({ open, check, onClose, onPublished }) {
  const { push } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const errors = check.issues.filter((i) => i.level === "error");
  const warnings = check.issues.filter((i) => i.level === "warning");

  const publish = async () => {
    setBusy(true);
    try {
      const pub = await siteApi.publish({ note: note || undefined, acknowledgeWarnings: true });
      setNote("");
      await onPublished(pub);
    } catch (err) {
      push(err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Publish website"
      sub="Creates a new numbered version. Only the pages it changes are rebuilt; the current pages keep serving until the new ones are ready."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={publish} disabled={busy || errors.length > 0}>
            <Rocket size={15} /> {warnings.length ? `Publish with ${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "Publish"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 px-[18px] pb-4">
        {errors.length > 0 && (
          <WarnBox>Fix {errors.length} problem{errors.length > 1 ? "s" : ""} before publishing:</WarnBox>
        )}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="max-h-[260px] overflow-y-auto rounded-md border border-line p-2.5">
            <IssueList issues={[...errors, ...warnings].map((i) => ({ ...i, message: `${i.path.replace(/\./g, " › ")} — ${i.message}` }))} />
          </div>
        )}
        {errors.length === 0 && warnings.length === 0 && <InfoBox>Every placement fits the asset specification.</InfoBox>}
        <Field label="Note (optional)" hint="Shown in the publishing history, e.g. “Diwali hero banner”.">
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
