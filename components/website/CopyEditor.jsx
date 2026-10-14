"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

/**
 * Structured page copy, edited field by field.
 *
 * The storefront renders each field as plain text in its existing design, so
 * the editor exposes the exact fields the page shows — no free-form HTML, and
 * nothing that could change the layout.
 *
 * Field kinds:
 *   text | textarea           a string
 *   number                    a number
 *   lines                     a list of strings, one per line
 *   cta                       { label, href }
 *   list (of: [...fields])    repeatable rows
 *   group (fields: [...])     a nested object
 */
export function FieldsEditor({ fields, value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-1">
      {fields.map((f) => (
        <FieldInput key={f.key} f={f} value={value?.[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

function FieldInput({ f, value, onChange }) {
  switch (f.kind) {
    case "textarea":
      return (
        <Field label={f.label} hint={f.hint} counter={f.max ? `${(value ?? "").length}/${f.max}` : undefined}>
          <Textarea rows={f.rows ?? 3} maxLength={f.max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "number":
      return (
        <Field label={f.label} hint={f.hint}>
          <Input type="number" min={f.min} max={f.maxValue} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
        </Field>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 py-1 text-[13px]">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    case "lines":
      return (
        <Field label={f.label} hint={f.hint ?? "One per line."}>
          <Textarea
            rows={Math.max(3, (value ?? []).length + 1)}
            value={(value ?? []).join("\n")}
            onChange={(e) => onChange(e.target.value.split("\n"))}
            onBlur={() => onChange((value ?? []).map((x) => x.trim()).filter(Boolean))}
          />
        </Field>
      );
    case "cta":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={`${f.label} — label`}>
            <Input value={value?.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value })} />
          </Field>
          <Field label={`${f.label} — link`} hint="A site path like /products, #section, or https://…">
            <Input value={value?.href ?? ""} onChange={(e) => onChange({ ...value, href: e.target.value })} />
          </Field>
        </div>
      );
    case "group":
      return (
        <fieldset className="rounded-md border border-line p-3">
          <legend className="px-1 text-[12px] font-semibold text-muted">{f.label}</legend>
          <FieldsEditor fields={f.fields} value={value ?? {}} onChange={onChange} />
        </fieldset>
      );
    case "list":
      return <ListInput f={f} value={value ?? []} onChange={onChange} />;
    default:
      return (
        <Field label={f.label} hint={f.hint} counter={f.max ? `${(value ?? "").length}/${f.max}` : undefined}>
          <Input maxLength={f.max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}

function ListInput({ f, value, onChange }) {
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const blank = () => Object.fromEntries(f.of.map((x) => [x.key, x.kind === "number" ? 0 : x.kind === "boolean" ? false : x.kind === "lines" ? [] : ""]));
  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 text-[12px] font-semibold text-muted">{f.label}</div>
      <div className="space-y-2">
        {value.map((row, i) => (
          <div key={i} className="flex gap-2 rounded-md bg-canvas p-2">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={13} /></Button>
              <Button variant="ghost" size="icon-sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={13} /></Button>
            </div>
            <div className={`grid flex-1 gap-x-2 ${f.of.length > 1 && !f.stack ? "sm:grid-cols-2" : ""}`}>
              {f.of.map((sub) => (
                <FieldInput key={sub.key} f={sub} value={row[sub.key]} onChange={(v) => onChange(value.map((r, j) => (j === i ? { ...r, [sub.key]: v } : r)))} />
              ))}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={13} /></Button>
          </div>
        ))}
      </div>
      {(!f.maxItems || value.length < f.maxItems) && (
        <Button size="sm" className="mt-2" onClick={() => onChange([...value, blank()])}>
          <Plus size={13} /> Add
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Field maps — one per block of copy. Keys match the API schema exactly.
// ============================================================================

const cta = (key, label) => ({ key, label, kind: "cta" });

export const STATEMENT_FIELDS = [
  { key: "titleLead", label: "Headline", max: 120 },
  { key: "titleEmphasis", label: "Headline — highlighted words", hint: "Shown in italic teal after the headline.", max: 80 },
  { key: "titleTail", label: "Headline — second line", max: 120 },
  { key: "body", label: "Body", kind: "textarea", max: 600 },
  cta("primaryCta", "Primary button"),
  cta("secondaryCta", "Secondary button"),
  {
    key: "panel",
    label: "Comparison panel (desktop)",
    kind: "group",
    fields: [
      { key: "eyebrow", label: "Heading", max: 60 },
      { key: "source", label: "Source note", max: 60 },
      {
        key: "bars",
        label: "Bars",
        kind: "list",
        maxItems: 4,
        of: [
          { key: "label", label: "Label", max: 40 },
          { key: "value", label: "Figure shown", max: 12 },
          { key: "pct", label: "Bar length (0–100)", kind: "number", min: 0, maxValue: 100 },
          { key: "highlight", label: "Highlight (Zewa)", kind: "boolean" },
        ],
      },
      { key: "footnote", label: "Footnote", kind: "textarea", max: 300 },
    ],
  },
];

export const PROOF_FIELDS = [
  { key: "eyebrow", label: "Eyebrow", max: 60 },
  { key: "title", label: "Heading", max: 160 },
  { key: "intro", label: "Intro", kind: "textarea", max: 300 },
  {
    key: "stats",
    label: "Figures (the first card is highlighted)",
    kind: "list",
    maxItems: 4,
    of: [
      { key: "value", label: "Figure", max: 12 },
      { key: "caption", label: "Caption", max: 120 },
      { key: "label", label: "Internal label", max: 60 },
    ],
  },
  { key: "footnote", label: "Footnote", kind: "textarea", max: 300 },
];

const heading = (extra = []) => [
  { key: "eyebrow", label: "Eyebrow", max: 60 },
  { key: "title", label: "Heading", max: 160 },
  ...extra,
];

export const ABOUT_COPY_SECTIONS = [
  { key: "hero", title: "Page header", fields: heading([{ key: "lead", label: "Lead", kind: "textarea", max: 600 }, { key: "sub", label: "Sub-lead", kind: "textarea", max: 600 }]) },
  {
    key: "headlineStats",
    title: "Headline figures",
    list: { label: "Figures", maxItems: 4, of: [{ key: "value", label: "Figure", max: 12 }, { key: "label", label: "Label", max: 60 }, { key: "note", label: "Note", max: 80 }] },
  },
  {
    key: "story",
    title: "Our story",
    fields: heading([
      { key: "paragraphs", label: "Paragraphs", kind: "lines", hint: "One paragraph per line." },
      { key: "outcomes", label: "Outcomes list", kind: "lines" },
    ]),
  },
  { key: "purpose", title: "Vision & mission", list: { label: "Statements", maxItems: 4, stack: true, of: [{ key: "label", label: "Label", max: 40 }, { key: "text", label: "Text", kind: "textarea", max: 400 }] } },
  {
    key: "why",
    title: "Why Zewa exists",
    fields: heading([
      { key: "body", label: "Body", kind: "textarea", max: 1200 },
      { key: "loop", label: "Loop steps", kind: "list", maxItems: 6, of: [{ key: "step", label: "Step", max: 40 }, { key: "detail", label: "Detail", max: 200 }] },
      { key: "quote", label: "Quote", kind: "textarea", max: 300 },
    ]),
  },
  {
    key: "founder",
    title: "Founder section (text)",
    fields: [
      { key: "eyebrow", label: "Eyebrow", max: 60 },
      { key: "name", label: "Name", max: 80 },
      { key: "role", label: "Role", max: 120 },
      { key: "statement", label: "Statement", kind: "textarea", max: 800 },
      { key: "bio", label: "Bio", kind: "textarea", max: 800 },
      { key: "credentials", label: "Education", kind: "list", maxItems: 8, of: [{ key: "label", label: "Degree", max: 20 }, { key: "detail", label: "Institution", max: 120 }] },
      { key: "honours", label: "Recognition", kind: "lines" },
    ],
  },
  { key: "values", title: "What we stand for", fields: heading([{ key: "items", label: "Principles", kind: "list", maxItems: 8, of: [{ key: "title", label: "Title", max: 80 }, { key: "detail", label: "Detail", max: 300 }] }]) },
  {
    key: "trust",
    title: "Trust & backers",
    fields: heading([
      { key: "body", label: "Body", kind: "textarea", max: 1200 },
      { key: "trialStats", label: "Trial figures", kind: "list", maxItems: 4, of: [{ key: "value", label: "Figure", max: 12 }, { key: "label", label: "Label", max: 80 }] },
      { key: "footnote", label: "Footnote", kind: "textarea", max: 300 },
      { key: "backedByEyebrow", label: "Logo band eyebrow", max: 60 },
      { key: "backedByTitle", label: "Logo band heading", max: 160 },
      { key: "institutionsTextOnly", label: "Backers without a logo", kind: "lines" },
    ]),
  },
  { key: "milestonesHeading", title: "Milestones heading", fields: heading() },
  {
    key: "range",
    title: "The range",
    fields: heading([
      { key: "body", label: "Body", kind: "textarea", max: 600 },
      { key: "products", label: "Product cards", kind: "list", maxItems: 12, of: [{ key: "name", label: "Name", max: 80 }, { key: "spec", label: "Spec line", max: 160 }, { key: "slug", label: "Product slug", hint: "Links once the product is published." }] },
    ]),
  },
  {
    key: "cta",
    title: "Closing call to action",
    fields: [{ key: "title", label: "Heading", max: 160 }, { key: "body", label: "Body", kind: "textarea", max: 300 }, cta("primary", "Primary button"), cta("secondary", "Secondary button")],
  },
];

/** One About-page copy section: either a field group or a top-level list. */
export function AboutCopySection({ section, value, onChange }) {
  if (section.list) {
    return <ListInput f={{ key: section.key, ...section.list }} value={value ?? []} onChange={onChange} />;
  }
  return <FieldsEditor fields={section.fields} value={value ?? {}} onChange={onChange} />;
}
