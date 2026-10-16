import { describe, expect, it } from "vitest";
import type { MarkdownNode } from "@milkdown/transformer";
import {
  clampTextFontSize,
  isTextStyleClosingTag,
  normalizeColor,
  parseTextStyleHtml,
  transformTextStyleMarkdownAst,
  wrapTextStyleHtml,
} from "./text-style";

describe("text font size", () => {
  it("clamps to the supported range", () => {
    expect(clampTextFontSize(8)).toBe(10);
    expect(clampTextFontSize(17.4)).toBe(17);
    expect(clampTextFontSize(41)).toBe(40);
    expect(clampTextFontSize(Number.NaN)).toBe(16);
  });
});

describe("text style html", () => {
  it("recognizes font-size opening tags", () => {
    const attrs = parseTextStyleHtml('<span style="font-size:18px">');
    expect(attrs).toEqual({ size: 18, color: null, background: null });
    expect(parseTextStyleHtml("<span>")).toBe(false);
    expect(parseTextStyleHtml("<script>")).toBe(false);
  });

  it("recognizes combined style tags", () => {
    const attrs = parseTextStyleHtml(
      '<span style="font-size:20px;color:#ff0000;background-color:#ffff00">',
    );
    expect(attrs).toEqual({ size: 20, color: "#ff0000", background: "#ffff00" });
  });

  it("recognizes closing tags", () => {
    expect(isTextStyleClosingTag("</span>")).toBe(true);
    expect(isTextStyleClosingTag("<span>")).toBe(false);
  });

  it("serializes a stable inline HTML wrapper", () => {
    expect(wrapTextStyleHtml("Hi", { size: 18, color: null, background: null })).toBe(
      '<span style="font-size:18px">Hi</span>',
    );
    expect(
      wrapTextStyleHtml("Hi", { size: null, color: "#ff0000", background: null }),
    ).toBe('<span style="color:#ff0000">Hi</span>');
    expect(
      wrapTextStyleHtml("Hi", {
        size: 20,
        color: "#ff0000",
        background: "#ffff00",
      }),
    ).toBe(
      '<span style="font-size:20px;color:#ff0000;background-color:#ffff00">Hi</span>',
    );
  });
});

describe("color normalization", () => {
  it("normalizes rgb to hex", () => {
    expect(normalizeColor("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(normalizeColor("rgba(0, 128, 255, 0.5)")).toBe("#0080ff");
  });

  it("preserves hex colors", () => {
    expect(normalizeColor("#FF0000")).toBe("#ff0000");
    expect(normalizeColor("#f00")).toBe("#f00");
  });

  it("returns null for empty values", () => {
    expect(normalizeColor(null)).toBe(null);
    expect(normalizeColor("")).toBe(null);
  });
});

describe("markdown AST transformation", () => {
  it("turns inline HTML wrapper pairs into text-style mark input", () => {
    const tree = {
      type: "paragraph",
      children: [
        { type: "text", value: "before " },
        { type: "html", value: '<span style="font-size:20px;color:#ff0000">' },
        { type: "text", value: "styled" },
        { type: "html", value: "</span>" },
        { type: "text", value: " after" },
      ],
    } as MarkdownNode;

    transformTextStyleMarkdownAst(tree);
    expect(tree.children).toHaveLength(3);
    expect(tree.children?.[1]).toMatchObject({
      type: "easymdTextStyle",
      size: 20,
      color: "#ff0000",
      background: null,
      children: [{ type: "text", value: "styled" }],
    });
  });
});
