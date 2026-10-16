import { describe, expect, it } from "vitest";
import { countWords, findActiveOutlineIndex, parseOutline } from "./outline";

describe("parseOutline", () => {
  it("parses headings with levels in order", () => {
    const md = "# A\n\ntext\n## B\n### C\n";
    expect(parseOutline(md)).toEqual([
      { level: 1, text: "A", index: 0 },
      { level: 2, text: "B", index: 1 },
      { level: 3, text: "C", index: 2 },
    ]);
  });

  it("ignores hashes inside fenced code blocks", () => {
    const md = "# Real\n\n```\n# Fake\n```\n\n~~~\n# Also fake\n~~~\n## Real2\n";
    const items = parseOutline(md);
    expect(items.map((i) => i.text)).toEqual(["Real", "Real2"]);
  });

  it("supports closing hashes and up to h6", () => {
    const md = "###### deep #\n####### seven\n";
    const items = parseOutline(md);
    expect(items.length).toBe(1);
    expect(items[0].level).toBe(6);
    expect(items[0].text).toBe("deep");
  });
});

describe("countWords", () => {
  it("counts cjk chars and latin words", () => {
    expect(countWords("你好世界 hello world")).toBe(6);
  });

  it("ignores fenced code blocks", () => {
    expect(countWords("正文\n```\nignored_code_words\n```\n")).toBe(2);
  });
});

describe("findActiveOutlineIndex", () => {
  it("selects the nearest heading above the viewport threshold", () => {
    expect(
      findActiveOutlineIndex([{ top: 40 }, { top: 180 }, { top: 720 }], 80),
    ).toBe(0);
    expect(
      findActiveOutlineIndex([{ top: 40 }, { top: 90 }, { top: 720 }], 220),
    ).toBe(1);
  });

  it("clears the highlight at the top and falls back to the first heading after scrolling", () => {
    expect(findActiveOutlineIndex([{ top: 280 }, { top: 760 }], 0)).toBe(-1);
    expect(findActiveOutlineIndex([{ top: 280 }, { top: 760 }], 32)).toBe(0);
    expect(findActiveOutlineIndex([], 80)).toBe(-1);
  });
});
