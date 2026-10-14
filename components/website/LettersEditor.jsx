"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHead, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { slugify } from "@/lib/utils";
import { AssetSlot, IssueList } from "@/components/media/AssetSlot";

/**
 * Founder's letters (Website → Letters).
 *
 * Paragraphs and list items accept two marks, typed inline:
 *   **bold**   and   _italic_
 * They are stored as { text, strong?, em? } segments — the exact shape
 * components/letters/LetterBody renders as React text, so no markup reaches
 * the page.
 */

// ---- **bold** / _italic_ ⇄ segments -------------------------------------------

const TOKEN = /(\*\*[^*]+\*\*|_[^_]+_)/g;

export function markupToRich(src) {
  const segs = src
    .split(TOKEN)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return { text: p.slice(2, -2), strong: true };
      if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return { text: p.slice(1, -1), em: true };
      return { text: p };
    });
  // No marks: keep the plain-string form the renderer also accepts.
  return segs.some((s) => s.strong || s.em) ? segs : src;
}

export function richToMarkup(value) {
  if (typeof value === "string") return value;
  return (value ?? []).map((s) => (s.strong ? `**${s.text}**` : s.em ? `_${s.text}_` : s.text)).join("");
}

const BLOCKS = {
  p: { label: "Paragraph", make: () => ({ type: "p", text: "" }) },
  h2: { label: "Heading", make: () => ({ type: "h2", text: "" }) },
  h3: { label: "Subheading", make: () => ({ type: "h3", text: "" }) },
  phase: { label: "Lesson heading (number + period)", make: () => ({ type: "phase", number: 1, period: "", text: "" }) },
  lesson: { label: "Lesson takeaway", make: () => ({ type: "lesson", text: "" }) },
  ul: { label: "Bullet list", make: () => ({ type: "ul", items: [""] }) },
  gallery: { label: "Photo gallery", make: () => ({ type: "gallery", images: [] }) },
};

function newLetter() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    slug: "",
    title: "",
    subtitle: "",
    date: today,
    dateLabel: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    author: "Nik Mulakkal",
    authorRole: "Founder & CEO",
    authorOrg: "ZEWA Ecosystems Pvt Ltd",
    excerpt: "",
    cover: null,
    // New letters start hidden so a half-written one never ships.
    published: false,
    blocks: [{ type: "p", text: "" }],
  };
}

export function LettersEditor({ letters, onChange, P, assets, issuesAt, onPreview }) {
  const [open, setOpen] = useState(letters.length ? 0 : null);
  const setLetter = (i, v) => onChange(letters.map((l, j) => (j === i ? v : l)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[12.5px] text-muted">
          The About page previews the newest published letter; /letters lists them all. Type <b>**bold**</b> or <i>_italic_</i> in paragraphs.
        </p>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => {
            onChange([newLetter(), ...letters]);
            setOpen(0);
          }}
        >
          <Plus size={13} /> New letter
        </Button>
      </div>
      <IssueList issues={issuesAt("letters")} />

      {letters.map((l, i) => (
        <Card key={i}>
          <CardHead>
            <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <CardTitle>{l.title || "Untitled letter"}</CardTitle>
              <span className="text-[12px] text-muted">{l.date}</span>
              <Pill tone={l.published ? "green" : "grey"}>{l.published ? "Published" : "Hidden"}</Pill>
            </button>
            {l.slug && (
              <Button size="sm" onClick={() => onPreview(l.slug)}>
                Preview
              </Button>
            )}
          </CardHead>
          {open === i && (
            <CardBody className="space-y-3">
              <LetterFields letter={l} onChange={(v) => setLetter(i, v)} P={P} assets={assets} issuesAt={issuesAt} at={`letters.${i}`} />
              <div className="flex justify-end">
                <Button variant="danger" size="sm" onClick={() => onChange(letters.filter((_, j) => j !== i))}>
                  <Trash2 size={13} /> Delete letter
                </Button>
              </div>
            </CardBody>
          )}
        </Card>
      ))}
    </div>
  );
}

function LetterFields({ letter: l, onChange, P, assets, issuesAt, at }) {
  const set = (patch) => onChange({ ...l, ...patch });
  return (
    <>
      <div className="flex items-center gap-3">
        <Switch checked={l.published} onChange={(v) => set({ published: v })} label={l.published ? "Published with the next website publish" : "Hidden"} />
      </div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Title" required>
          <Input value={l.title} onChange={(e) => set({ title: e.target.value, slug: l.slug || "" })} onBlur={() => !l.slug && set({ slug: slugify(l.title) })} />
        </Field>
        <Field label="Slug" required hint="The URL: /letters/<slug>. Keep it once published.">
          <Input className="mono text-[12px]" value={l.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
        </Field>
        <Field label="Subtitle"><Input value={l.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date" hint="Newest is previewed."><Input type="date" value={l.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Date label"><Input value={l.dateLabel} onChange={(e) => set({ dateLabel: e.target.value })} /></Field>
        </div>
        <Field label="Author"><Input value={l.author} onChange={(e) => set({ author: e.target.value })} /></Field>
        <Field label="Author role"><Input value={l.authorRole} onChange={(e) => set({ authorRole: e.target.value })} /></Field>
        <Field label="Organisation"><Input value={l.authorOrg} onChange={(e) => set({ authorOrg: e.target.value })} /></Field>
      </div>
      <Field label="Excerpt" required hint="Shown on the About page and letter cards.">
        <Textarea rows={3} value={l.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
      </Field>
      <AssetSlot
        label="Cover"
        placement={P["letter.cover"]}
        value={l.cover?.asset ?? null}
        assets={assets}
        onChange={(v) => set({ cover: v ? { asset: v, alt: l.cover?.alt ?? "" } : null })}
        serverIssues={issuesAt(`${at}.cover`)}
      />
      {l.cover && (
        <Field label="Cover alt text" required>
          <Input value={l.cover.alt} onChange={(e) => set({ cover: { ...l.cover, alt: e.target.value } })} />
        </Field>
      )}
      <div className="pt-2 text-[13px] font-semibold">Body</div>
      <LetterBlocks blocks={l.blocks} onChange={(blocks) => set({ blocks })} P={P} assets={assets} issuesAt={issuesAt} at={at} />
    </>
  );
}

function LetterBlocks({ blocks, onChange, P, assets, issuesAt, at }) {
  const set = (i, b) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <div key={i} className="rounded-lg border border-line">
          <div className="flex items-center gap-1 border-b border-line px-2 py-1">
            <span className="text-[12px] font-semibold text-muted">{i + 1}. {BLOCKS[b.type]?.label ?? b.type}</span>
            <div className="ml-auto flex">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={14} /></Button>
              <Button variant="ghost" size="icon-sm" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={14} /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Delete block"><Trash2 size={14} /></Button>
            </div>
          </div>
          <div className="p-2.5">
            <LetterBlock block={b} onChange={(nb) => set(i, nb)} P={P} assets={assets} issuesAt={issuesAt} at={`${at}.blocks.${i}`} />
          </div>
        </div>
      ))}
      <Select value="" className="w-auto" onChange={(e) => e.target.value && onChange([...blocks, BLOCKS[e.target.value].make()])}>
        <option value="">+ Add a block…</option>
        {Object.entries(BLOCKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </Select>
    </div>
  );
}

function LetterBlock({ block: b, onChange, P, assets, issuesAt, at }) {
  const set = (patch) => onChange({ ...b, ...patch });
  switch (b.type) {
    case "p":
      return <Textarea rows={3} value={richToMarkup(b.text)} onChange={(e) => set({ text: markupToRich(e.target.value) })} />;
    case "h2":
    case "h3":
    case "lesson":
      return <Textarea rows={b.type === "lesson" ? 3 : 1} value={b.text} onChange={(e) => set({ text: e.target.value })} />;
    case "phase":
      return (
        <div className="grid gap-2 sm:grid-cols-[80px_140px_1fr]">
          <Field label="Number"><Input type="number" min={1} value={b.number} onChange={(e) => set({ number: Number(e.target.value) || 1 })} /></Field>
          <Field label="Period"><Input value={b.period} onChange={(e) => set({ period: e.target.value })} /></Field>
          <Field label="Heading"><Input value={b.text} onChange={(e) => set({ text: e.target.value })} /></Field>
        </div>
      );
    case "ul":
      return (
        <Field label="Items" hint="One per line. **bold** and _italic_ work here too.">
          <Textarea
            rows={Math.max(3, b.items.length + 1)}
            value={b.items.map(richToMarkup).join("\n")}
            onChange={(e) => set({ items: e.target.value.split("\n").map(markupToRich) })}
            onBlur={() => set({ items: b.items.filter((x) => richToMarkup(x).trim()) })}
          />
        </Field>
      );
    case "gallery":
      return (
        <div className="space-y-2">
          {b.images.map((img, k) => (
            <div key={k} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <AssetSlot
                  label={`Photo ${k + 1}`}
                  placement={P["letter.image"]}
                  value={img.asset}
                  assets={assets}
                  required
                  onChange={(v) => set({ images: b.images.map((x, j) => (j === k ? { ...x, asset: v } : x)) })}
                  serverIssues={issuesAt(`${at}.images.${k}`)}
                />
                <Input placeholder="Alt text" value={img.alt} onChange={(e) => set({ images: b.images.map((x, j) => (j === k ? { ...x, alt: e.target.value } : x)) })} />
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => set({ images: b.images.filter((_, j) => j !== k) })} aria-label="Remove photo"><Trash2 size={14} /></Button>
            </div>
          ))}
          {b.images.length < 12 && (
            <Button size="sm" onClick={() => set({ images: [...b.images, { asset: null, alt: "" }] })}><Plus size={13} /> Add photo</Button>
          )}
        </div>
      );
    default:
      return null;
  }
}
