import { describe, expect, it } from "vitest";
import { clampZoom, DEFAULT_SETTINGS, loadSettings } from "./settings";

describe("loadSettings", () => {
  it("returns defaults for null input", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial input over defaults", () => {
    const s = loadSettings(JSON.stringify({ lang: "en", zoom: 1.3 }));
    expect(s.lang).toBe("en");
    expect(s.zoom).toBe(1.3);
    expect(s.autosave).toBe(true);
  });

  it("rejects invalid values", () => {
    const s = loadSettings(
      JSON.stringify({ lang: "fr", theme: "blue", zoom: 99 }),
    );
    expect(s.lang).toBe("zh");
    expect(s.theme).toBe("system");
    expect(s.zoom).toBe(2);
  });

  it("handles corrupted json", () => {
    expect(loadSettings("not-json")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("clampZoom", () => {
  it("clamps to 0.5..2 with 0.1 steps", () => {
    expect(clampZoom(0.33)).toBe(0.5);
    expect(clampZoom(5)).toBe(2);
    expect(clampZoom(1.234)).toBe(1.2);
  });
});
