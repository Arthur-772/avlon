import { describe, expect, it } from "vitest";
import { findMatches, replaceAllMatches, replaceMatch } from "./find";

describe("findMatches", () => {
  it("finds all occurrences case-insensitively", () => {
    expect(findMatches("Abc abc ABC", "abc")).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 },
    ]);
  });

  it("respects case sensitivity", () => {
    expect(findMatches("Abc abc", "abc", true)).toEqual([{ start: 4, end: 7 }]);
  });

  it("returns empty for empty query", () => {
    expect(findMatches("text", "")).toEqual([]);
  });

  it("returns empty when nothing matches", () => {
    expect(findMatches("hello", "xyz")).toEqual([]);
  });
});

describe("replaceMatch", () => {
  it("replaces the matched range", () => {
    expect(replaceMatch("hello world", { start: 6, end: 11 }, "there")).toBe(
      "hello there",
    );
  });
});

describe("replaceAllMatches", () => {
  it("replaces every match", () => {
    const text = "one one one";
    const matches = findMatches(text, "one");
    expect(replaceAllMatches(text, matches, "two")).toBe("two two two");
  });

  it("handles replacements of different lengths", () => {
    const text = "aaa";
    const matches = findMatches(text, "a");
    expect(replaceAllMatches(text, matches, "bb")).toBe("bbbbbb");
  });
});
