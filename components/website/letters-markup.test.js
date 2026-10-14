import { describe, expect, it } from "vitest";
import { markupToRich, richToMarkup } from "./LettersEditor";

describe("letter inline marks", () => {
  it("keeps plain text as a plain string", () => {
    expect(markupToRich("Hi All,")).toBe("Hi All,");
  });
  it("turns **bold** and _italic_ into the segments LetterBody renders", () => {
    expect(markupToRich("Reviews like **“Best pleco food”** came _unprompted_.")).toEqual([
      { text: "Reviews like " },
      { text: "“Best pleco food”", strong: true },
      { text: " came " },
      { text: "unprompted", em: true },
      { text: "." },
    ]);
  });
  it("round-trips the shape stored for the Zewa Day letter", () => {
    const segs = [{ text: "A " }, { text: "bold", strong: true }, { text: " end." }];
    expect(markupToRich(richToMarkup(segs))).toEqual(segs);
  });
  it("never produces HTML — angle brackets stay text", () => {
    expect(markupToRich("<b>x</b>")).toBe("<b>x</b>");
  });
});
