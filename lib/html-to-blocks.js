import { slugify } from "@/lib/utils";

/**
 * Old rich-text body (sanitised Tiptap HTML) → the structured blocks the
 * storefront renders.
 *
 * Each top-level element becomes its own block, so the article keeps its
 * shape: headings stay headings (and get a contents label), paragraphs keep
 * their links, lists stay lists, quotes become pull quotes. The previous
 * conversion flattened everything into one lead paragraph, gluing headings to
 * the text after them ("…headline numberThe number on the tub…").
 *
 * Only https:// and site-relative links survive — the same rule the API
 * enforces on a paragraph's links.
 */
export function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ""}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  const used = new Set();
  const out = [];

  const text = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const anchor = (t) => {
    const base = slugify(t).slice(0, 60) || "section";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const linksIn = (el) =>
    [...el.querySelectorAll("a[href]")]
      .map((a) => ({ text: text(a), href: a.getAttribute("href") ?? "" }))
      .filter((l) => l.text && (/^https:\/\/\S+$/.test(l.href) || (l.href.startsWith("/") && !l.href.startsWith("//"))));

  for (const el of root.children) {
    const tag = el.tagName.toLowerCase();
    const t = text(el);
    if (!t && tag !== "hr") continue;

    if (tag === "h1" || tag === "h2") out.push({ type: "h2", id: anchor(t), text: t, toc: t.slice(0, 60) });
    else if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") out.push({ type: "h3", text: t });
    else if (tag === "ul" || tag === "ol") {
      const items = [...el.children].map(text).filter(Boolean);
      if (items.length) out.push({ type: "list", ordered: tag === "ol", items });
    } else if (tag === "blockquote") out.push({ type: "pullquote", text: t });
    else if (tag === "hr") continue;
    else {
      const links = linksIn(el);
      out.push(links.length ? { type: "p", text: t, links } : { type: "p", text: t });
    }
  }

  // Bare text with no wrapping element.
  if (out.length === 0 && text(root)) out.push({ type: "p", text: text(root) });
  return out;
}
