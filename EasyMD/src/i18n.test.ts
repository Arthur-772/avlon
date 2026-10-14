import { describe, expect, it } from "vitest";
import { i18nKeys, translate } from "./i18n";

describe("i18n", () => {
  it("has identical key sets for zh and en", () => {
    const keys = i18nKeys();
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("zh", key)).not.toBe(key);
    }
  });

  it("falls back to zh when key missing in target lang", () => {
    expect(translate("zh", "save")).toBe("保存");
    expect(translate("en", "save")).toBe("Save");
  });
});
