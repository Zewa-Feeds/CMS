import { describe, expect, it } from "vitest";
import { htmlToBlocks } from "./html-to-blocks";

describe("htmlToBlocks", () => {
  it("keeps a heading and the paragraph after it apart (the screenshot bug)", () => {
    const html = "<h2>Digestibility beats the headline number</h2><p>The number on the tub is crude protein. What matters is how much of it your fish actually absorbs.</p>";
    expect(htmlToBlocks(html)).toEqual([
      { type: "h2", id: "digestibility-beats-the-headline-number", text: "Digestibility beats the headline number", toc: "Digestibility beats the headline number" },
      { type: "p", text: "The number on the tub is crude protein. What matters is how much of it your fish actually absorbs." },
    ]);
  });

  it("maps lists, subheadings and quotes, and keeps safe links", () => {
    const html =
      '<h3>Why</h3><ul><li>Less waste</li><li>Clearer water</li></ul><ol><li>One</li></ol><blockquote><p>Feed the fish, not the filter.</p></blockquote><p>See <a href="/products/betta-bites">Betta Bites</a> or <a href="javascript:alert(1)">this</a>.</p><hr>';
    expect(htmlToBlocks(html)).toEqual([
      { type: "h3", text: "Why" },
      { type: "list", ordered: false, items: ["Less waste", "Clearer water"] },
      { type: "list", ordered: true, items: ["One"] },
      { type: "pullquote", text: "Feed the fish, not the filter." },
      { type: "p", text: "See Betta Bites or this.", links: [{ text: "Betta Bites", href: "/products/betta-bites" }] },
    ]);
  });

  it("gives repeated headings unique anchors", () => {
    const ids = htmlToBlocks("<h2>FAQ</h2><h2>FAQ</h2>").map((b) => b.id);
    expect(ids).toEqual(["faq", "faq-2"]);
  });
});
