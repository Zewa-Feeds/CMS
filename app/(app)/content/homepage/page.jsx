"use client";

import { useEffect, useState } from "react";
import { Save, Eye, Upload } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input, Switch } from "@/components/ui/Field";
import { RichText } from "@/components/ui/RichText";
import { useToast } from "@/components/ui/Toast";

const SECTIONS = [
  { key: "hero", title: "Hero", fields: [["eyebrow", "Eyebrow"], ["title", "Headline"], ["sub", "Subtext", true], ["cta", "CTA button label"]] },
  { key: "science", title: "Science Section", fields: [["title", "Title"], ["sub", "Subtext", true]] },
  { key: "why", title: "Why Choose Zewa", fields: [["title", "Title"], ["sub", "Subtext", true]] },
  { key: "knowledge", title: "Knowledge Hub", fields: [["title", "Title"], ["sub", "Subtext", true]] },
];

/** Shape the editor expects, so a first-run empty DRAFT still renders. */
const EMPTY_SECTIONS = {
  hero: { eyebrow: "", title: "", sub: "", cta: "" },
  science: { title: "", sub: "" },
  why: { title: "", sub: "" },
  knowledge: { title: "", sub: "" },
  announcement: {
    text: "", linkLabel: "", linkUrl: "/", bg: "#080C18", fg: "#44E5C2", active: false,
  },
};

export default function HomepagePage() {
  const { data, loading, error } = useData((s) => s.homepage);
  const loadHomepage = useData((s) => s.loadHomepage);
  const saveHomepage = useData((s) => s.saveHomepage);
  const publishHomepage = useData((s) => s.publishHomepage);
  const homepagePreviewToken = useData((s) => s.homepagePreviewToken);
  const toast = useToast();

  const [form, setForm] = useState(EMPTY_SECTIONS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // The editor always loads the DRAFT row (§8.3) — LIVE is what customers see.
  useEffect(() => {
    void loadHomepage("DRAFT").catch(() => undefined);
  }, [loadHomepage]);

  // Merge server sections over the defaults so a partial row cannot crash a field.
  useEffect(() => {
    if (!data?.sections) return;
    setForm({
      ...EMPTY_SECTIONS,
      ...data.sections,
      hero: { ...EMPTY_SECTIONS.hero, ...(data.sections.hero ?? {}) },
      science: { ...EMPTY_SECTIONS.science, ...(data.sections.science ?? {}) },
      why: { ...EMPTY_SECTIONS.why, ...(data.sections.why ?? {}) },
      knowledge: { ...EMPTY_SECTIONS.knowledge, ...(data.sections.knowledge ?? {}) },
      announcement: { ...EMPTY_SECTIONS.announcement, ...(data.sections.announcement ?? {}) },
    });
    setDirty(false);
  }, [data]);

  const setField = (section, key, val) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: val } }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveHomepage(form);
      setDirty(false);
      toast.push("Homepage draft saved. Nothing is live until you publish.");
    } catch (err) {
      toast.push(err.fields ? Object.values(err.fields)[0] : err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  /** §8.3 — publish pushes every pending section live at once. */
  const publish = async () => {
    setBusy(true);
    try {
      if (dirty) await saveHomepage(form);
      await publishHomepage();
      setDirty(false);
      toast.push("Homepage changes published live.");
    } catch (err) {
      toast.push(err.fields ? Object.values(err.fields)[0] : err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    try {
      const { url } = await homepagePreviewToken();
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Homepage" }]} />
      <PageHeader title="Homepage Sections" sub="Edit the static homepage. Draft → Preview → Publish — nothing goes live on save alone." />

      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-card p-3 shadow-card">
        <Pill tone={dirty ? "amber" : "grey"}>{dirty ? "Unpublished changes" : "In sync"}</Pill>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="default" onClick={save}><Save size={15} /> Save Draft</Button>
          <Button variant="default" onClick={preview}><Eye size={15} /> Preview</Button>
          <Button variant="primary" onClick={publish}><Upload size={15} /> Publish</Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <Card key={s.key}>
            <CardHead><CardTitle>{s.title}</CardTitle></CardHead>
            <CardBody>
              <div className="grid gap-x-[18px] md:grid-cols-2">
                {s.fields.map(([key, label, wide]) => (
                  <Field
                    key={key}
                    className={wide ? "md:col-span-2" : ""}
                    label={label}
                    hint={wide ? "Bold, italics, and links are supported." : undefined}
                  >
                    {wide ? (
                      <RichText
                        compact
                        value={form[s.key]?.[key] || ""}
                        onChange={(v) => setField(s.key, key, v)}
                        placeholder="Supporting copy for this section…"
                        minHeight={90}
                      />
                    ) : (
                      <Input value={form[s.key]?.[key] || ""} onChange={(e) => setField(s.key, key, e.target.value)} />
                    )}
                  </Field>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}

        <Card>
          <CardHead>
            <CardTitle>Announcement Bar</CardTitle>
            <div className="ml-auto">
              <Switch
                checked={form.announcement.active}
                onChange={(v) => setField("announcement", "active", v)}
                label={form.announcement.active ? "Shown" : "Hidden"}
              />
            </div>
          </CardHead>
          <CardBody>
            <div className="grid gap-x-[18px] md:grid-cols-2">
              <Field className="md:col-span-2" label="Bar text">
                <Input value={form.announcement.text} onChange={(e) => setField("announcement", "text", e.target.value)} />
              </Field>
              <Field label="Link label">
                <Input value={form.announcement.linkLabel} onChange={(e) => setField("announcement", "linkLabel", e.target.value)} />
              </Field>
              <Field label="Link URL">
                <Input value={form.announcement.linkUrl} onChange={(e) => setField("announcement", "linkUrl", e.target.value)} className="mono text-[12.5px]" />
              </Field>
              <Field label="Background colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.announcement.bg} onChange={(e) => setField("announcement", "bg", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line" />
                  <Input value={form.announcement.bg} onChange={(e) => setField("announcement", "bg", e.target.value)} className="mono text-[12.5px]" />
                </div>
              </Field>
              <Field label="Text colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.announcement.fg} onChange={(e) => setField("announcement", "fg", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line" />
                  <Input value={form.announcement.fg} onChange={(e) => setField("announcement", "fg", e.target.value)} className="mono text-[12.5px]" />
                </div>
              </Field>
              <div className="md:col-span-2">
                <div className="mb-1.5 text-[12.5px] font-semibold">Preview</div>
                <div className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px]" style={{ background: form.announcement.bg, color: form.announcement.fg }}>
                  {form.announcement.text}
                  <span className="font-semibold underline">{form.announcement.linkLabel}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
