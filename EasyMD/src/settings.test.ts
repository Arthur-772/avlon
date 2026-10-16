import { describe, expect, it } from "vitest";
import {
  clampEditorFontSize,
  DEFAULT_SETTINGS,
  loadSettings,
} from "./settings";

describe("loadSettings", () => {
  it("returns defaults for null input", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial input over defaults", () => {
    const s = loadSettings(JSON.stringify({ lang: "en", zoom: 1.3 }));
    expect(s.lang).toBe("en");
    expect(s.editorFontSize).toBe(21);
    expect(s.autosave).toBe(true);
  });

  it("rejects invalid values", () => {
    const s = loadSettings(
      JSON.stringify({ lang: "fr", theme: "blue", editorFontSize: 99 }),
    );
    expect(s.lang).toBe("zh");
    expect(s.theme).toBe("system");
    expect(s.editorFontSize).toBe(32);
  });

  it("handles corrupted json", () => {
    expect(loadSettings("not-json")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("clampEditorFontSize", () => {
  it("clamps to 12..32 with integer steps", () => {
    expect(clampEditorFontSize(5)).toBe(12);
    expect(clampEditorFontSize(18.4)).toBe(18);
    expect(clampEditorFontSize(40)).toBe(32);
  });
});
