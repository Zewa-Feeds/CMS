"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { slugify } from "@/lib/utils";
import { AssetSlot } from "@/components/media/AssetSlot";

/**
 * Article body as structured blocks — the exact shapes the storefront renders
 * (Frontend/components/blog/ArticleBlocks + the article page).
 *
 * Structured rather than free HTML on purpose: every block renders as React
 * text, so nothing an editor types can inject markup, and every block gets the
 * site's own design (pull quotes, comparison tables, FAQ with its schema.org
 * markup) instead of whatever a pasted document carried.
 *
 * Inline links are declared per paragraph as "phrase → URL"; the phrase is
 * linked wherever it appears in that paragraph.
 */

export const BLOCK_TYPES = {
  lead: { label: "Lead paragraph", make: () => ({ type: "lead", text: "" }) },
  p: { label: "Paragraph", make: () => ({ type: "p", text: "" }) },
  h2: { label: "Section heading (H2)", make: () => ({ type: "h2", id: "", text: "", toc: "" }) },
  h3: { label: "Subheading (H3)", make: () => ({ type: "h3", text: "" }) },
  figure: { label: "Figure (image)", make: () => ({ type: "figure", asset: null, alt: "", caption: "", aspect: "16 / 9" }) },
  takeaways: { label: "Key takeaways list", make: () => ({ type: "takeaways", title: "", items: [""] }) },
  table: { label: "Comparison table", make: () => ({ type: "table", caption: "", headers: ["", ""], rows: [["", ""]] }) },
  faq: { label: "FAQ (adds FAQ rich results)", make: () => ({ type: "faq", items: [{ q: "", a: "" }] }) },
  references: { label: "References", make: () => ({ type: "references", items: [{ n: 1, text: "" }] }) },
  pullquote: { label: "Pull quote", make: () => ({ type: "pullquote", text: "" }) },
  "stat-block": { label: "Stat row (up to 4)", make: () => ({ type: "stat-block", items: [{ val: "", label: "" }] }) },
  callout: { label: "Callout box", make: () => ({ type: "callout", variant: "info", title: "", text: "" }) },
  didyouknow: { label: "“Did you know?” box", make: () => ({ type: "didyouknow", title: "Did you know?", text: "" }) },
  proscons: { label: "Pros & cons", make: () => ({ type: "proscons", items: [{ name: "", pros: [""], cons: [""] }] }) },
};

const lines = (v) => (v ?? []).join("\n");
const fromLines = (s) => s.split("\n");
const tidyLines = (arr) => arr.map((x) => x.trim()).filter(Boolean);

export function BlockEditor({ blocks, onChange, placements, assets, issuesAt }) {
  const set = (i, block) => onChange(blocks.map((b, j) => (j === i ? block : b)));
  const insert = (at, type) => {
    const next = [...blocks];
    next.splice(at, 0, BLOCK_TYPES[type].make());
    onChange(next);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => (
        <div key={i} className="rounded-lg border border-line bg-card">
          <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
            <span className="text-[12px] font-semibold text-muted">
              {i + 1}. {BLOCK_TYPES[b.type]?.label ?? b.type}
            </span>
            <div className="ml-auto flex items-center">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={14} /></Button>
              <Button variant="ghost" size="icon-sm" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={14} /></Button>
              <AddMenu compact onAdd={(t) => insert(i + 1, t)} />
              <Button variant="ghost" size="icon-sm" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Delete block"><Trash2 size={14} /></Button>
            </div>
          </div>
          <div className="p-3">
            <BlockFields block={b} onChange={(nb) => set(i, nb)} placements={placements} assets={assets} issues={issuesAt?.(`article.blocks.${i}.asset`) ?? []} />
          </div>
        </div>
      ))}
      <AddMenu onAdd={(t) => insert(blocks.length, t)} />
    </div>
  );
}

function AddMenu({ onAdd, compact }) {
  return (
    <label className={compact ? "relative inline-flex" : "flex items-center gap-2"} title="Insert a block">
      {!compact && <Plus size={14} className="text-muted" />}
      <Select
        value=""
        aria-label="Add block"
        className={compact ? "w-[30px] cursor-pointer appearance-none border-transparent bg-transparent px-1 text-transparent" : "w-auto"}
        onChange={(e) => e.target.value && onAdd(e.target.value)}
      >
        <option value="">{compact ? "+" : "Add a block…"}</option>
        {Object.entries(BLOCK_TYPES).map(([k, v]) => (
          <option key={k} value={k} className="text-ink">{v.label}</option>
        ))}
      </Select>
      {compact && <Plus size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />}
    </label>
  );
}

function BlockFields({ block: b, onChange, placements, assets, issues }) {
  const set = (patch) => onChange({ ...b, ...patch });

  switch (b.type) {
    case "lead":
    case "pullquote":
      return <Textarea rows={3} value={b.text} onChange={(e) => set({ text: e.target.value })} />;

    case "p":
      return (
        <div className="space-y-2">
          <Textarea rows={4} value={b.text} onChange={(e) => set({ text: e.target.value })} />
          <LinkList links={b.links ?? []} onChange={(links) => set({ links: links.length ? links : undefined })} />
        </div>
      );

    case "h2":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_200px]">
          <Field label="Heading">
            <Input value={b.text} onChange={(e) => set({ text: e.target.value, id: b.id || "" })} onBlur={() => !b.id && set({ id: slugify(b.text).slice(0, 60) })} />
          </Field>
          <Field label="Anchor id" hint="For #links. Must be unique.">
            <Input className="mono text-[12px]" value={b.id} onChange={(e) => set({ id: slugify(e.target.value) })} />
          </Field>
          <Field label="Contents label" hint="Short; blank = not in the contents list.">
            <Input value={b.toc ?? ""} maxLength={60} onChange={(e) => set({ toc: e.target.value || undefined })} />
          </Field>
        </div>
      );

    case "h3":
      return <Input value={b.text} onChange={(e) => set({ text: e.target.value })} />;

    case "figure":
      return (
        <div className="space-y-2">
          <AssetSlot label="Image" placement={placements?.["article.figure"]} value={b.asset} assets={assets} onChange={(asset) => set({ asset })} required serverIssues={issues} />
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <Field label="Alt text" required>
              <Input value={b.alt} onChange={(e) => set({ alt: e.target.value })} />
            </Field>
            <Field label="Frame">
              <Select value={b.aspect ?? "16 / 9"} onChange={(e) => set({ aspect: e.target.value })}>
                {["16 / 9", "3 / 2", "4 / 3", "1 / 1"].map((a) => <option key={a} value={a}>{a.replace(/ /g, "")}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Caption">
            <Input value={b.caption ?? ""} onChange={(e) => set({ caption: e.target.value || undefined })} />
          </Field>
        </div>
      );

    case "takeaways":
      return (
        <div className="space-y-2">
          <Field label="Title"><Input value={b.title ?? ""} onChange={(e) => set({ title: e.target.value || undefined })} /></Field>
          <Field label="Points" hint="One per line.">
            <Textarea rows={4} value={lines(b.items)} onChange={(e) => set({ items: fromLines(e.target.value) })} onBlur={() => set({ items: tidyLines(b.items) })} />
          </Field>
        </div>
      );

    case "table":
      return (
        <div className="space-y-2">
          <Field label="Caption"><Input value={b.caption ?? ""} onChange={(e) => set({ caption: e.target.value || undefined })} /></Field>
          <Field label="Column headings" hint="Separate columns with |">
            <Input value={b.headers.join(" | ")} onChange={(e) => set({ headers: e.target.value.split("|").map((x) => x.trim()) })} />
          </Field>
          <Field label="Rows" hint="One row per line; columns separated with |">
            <Textarea
              rows={Math.max(3, b.rows.length + 1)}
              className="mono text-[12px]"
              value={b.rows.map((r) => r.join(" | ")).join("\n")}
              onChange={(e) => set({ rows: e.target.value.split("\n").map((r) => r.split("|").map((x) => x.trim())) })}
              onBlur={() => set({ rows: b.rows.filter((r) => r.some(Boolean)) })}
            />
          </Field>
          <Field label="Highlight column" hint="Usually the Zewa column.">
            <Select value={b.highlightColumn ?? ""} onChange={(e) => set({ highlightColumn: e.target.value === "" ? undefined : Number(e.target.value) })}>
              <option value="">None</option>
              {b.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </Select>
          </Field>
        </div>
      );

    case "faq":
      return <PairList items={b.items} keys={["q", "a"]} labels={["Question", "Answer"]} multiline onChange={(items) => set({ items })} />;

    case "stat-block":
      return <PairList items={b.items} keys={["val", "label"]} labels={["Figure", "Label"]} max={4} onChange={(items) => set({ items })} />;

    case "references":
      return (
        <Field label="References" hint="One per line: citation text | https://link (link optional). Numbered in order.">
          <Textarea
            rows={Math.max(3, b.items.length + 1)}
            value={b.items.map((r) => (r.href ? `${r.text} | ${r.href}` : r.text)).join("\n")}
            onChange={(e) =>
              set({
                items: e.target.value.split("\n").map((line, i) => {
                  const [text, href] = line.split(" | ");
                  return { n: i + 1, text: text ?? "", ...(href?.trim() ? { href: href.trim() } : {}) };
                }),
              })
            }
            onBlur={() => set({ items: b.items.filter((r) => r.text.trim()).map((r, i) => ({ ...r, n: i + 1 })) })}
          />
        </Field>
      );

    case "callout":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <Field label="Style">
              <Select value={b.variant ?? "info"} onChange={(e) => set({ variant: e.target.value })}>
                <option value="info">Information</option>
                <option value="brand">Zewa brand</option>
              </Select>
            </Field>
            <Field label="Title"><Input value={b.title ?? ""} onChange={(e) => set({ title: e.target.value || undefined })} /></Field>
          </div>
          <Textarea rows={3} value={b.text} onChange={(e) => set({ text: e.target.value })} />
        </div>
      );

    case "didyouknow":
      return (
        <div className="space-y-2">
          <Field label="Title"><Input value={b.title ?? ""} onChange={(e) => set({ title: e.target.value || undefined })} /></Field>
          <Textarea rows={3} value={b.text} onChange={(e) => set({ text: e.target.value })} />
        </div>
      );

    case "proscons":
      return (
        <div className="space-y-3">
          {b.items.map((item, i) => {
            const setItem = (patch) => set({ items: b.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="rounded-md border border-line p-2.5">
                <div className="flex gap-2">
                  <Field label="Option" className="flex-1"><Input value={item.name} onChange={(e) => setItem({ name: e.target.value })} /></Field>
                  <Button variant="ghost" size="icon-sm" className="mt-6" onClick={() => set({ items: b.items.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={14} /></Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Pros" hint="One per line."><Textarea rows={3} value={lines(item.pros)} onChange={(e) => setItem({ pros: fromLines(e.target.value) })} onBlur={() => setItem({ pros: tidyLines(item.pros) })} /></Field>
                  <Field label="Cons" hint="One per line."><Textarea rows={3} value={lines(item.cons)} onChange={(e) => setItem({ cons: fromLines(e.target.value) })} onBlur={() => setItem({ cons: tidyLines(item.cons) })} /></Field>
                </div>
              </div>
            );
          })}
          {b.items.length < 6 && <Button size="sm" onClick={() => set({ items: [...b.items, { name: "", pros: [""], cons: [""] }] })}><Plus size={13} /> Add option</Button>}
        </div>
      );

    default:
      return <p className="text-[12px] text-muted">This block type cannot be edited here.</p>;
  }
}

function PairList({ items, keys, labels, onChange, multiline, max = 20 }) {
  const [a, b] = keys;
  const Text = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className={multiline ? "grid flex-1 gap-2" : "grid flex-1 gap-2 sm:grid-cols-[160px_1fr]"}>
            <Input placeholder={labels[0]} value={item[a]} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [a]: e.target.value } : x)))} />
            <Text placeholder={labels[1]} rows={multiline ? 3 : undefined} value={item[b]} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [b]: e.target.value } : x)))} />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={14} /></Button>
        </div>
      ))}
      {items.length < max && <Button size="sm" onClick={() => onChange([...items, { [a]: "", [b]: "" }])}><Plus size={13} /> Add</Button>}
    </div>
  );
}

function LinkList({ links, onChange }) {
  return (
    <div className="space-y-1.5">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="flex-1" placeholder="Exact phrase in the paragraph" value={l.text} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <span className="text-muted">→</span>
          <Input className="flex-1" placeholder="/products/betta-bites or https://…" value={l.href} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label="Remove link"><Trash2 size={14} /></Button>
        </div>
      ))}
      <button type="button" className="text-[12px] text-muted underline-offset-2 hover:underline" onClick={() => onChange([...links, { text: "", href: "" }])}>
        + Link a phrase
      </button>
    </div>
  );
}
