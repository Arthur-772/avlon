import { describe, expect, it } from "vitest";
import { normalizeMermaidSource } from "./mermaid";

describe("normalizeMermaidSource", () => {
  it("converts ER attribute keys with suffixes into quoted comments", () => {
    const source = [
      "erDiagram",
      "    orders {",
      "        string number PK",
      "        string channel_number PK_业务单号",
      "    }",
    ].join("\n");

    expect(normalizeMermaidSource(source)).toContain(
      'string channel_number PK "业务单号"',
    );
    expect(normalizeMermaidSource(source)).toContain("string number PK");
  });

  it("does not rewrite non-ER diagrams", () => {
    const source = 'flowchart LR\n  node["FK_important"]';

    expect(normalizeMermaidSource(source)).toBe(source);
  });
});
