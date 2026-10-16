export type ThemeSetting = "system" | "light" | "dark";
export type ImageStrategy = "relative" | "original";

export const MAX_RECENT_FILES = 10;

export interface Settings {
  lang: "zh" | "en";
  theme: ThemeSetting;
  editorFontSize: number;
  autosave: boolean;
  autosaveInterval: number;
  autosaveToast: boolean;
  sessionRestore: boolean;
  imageStrategy: ImageStrategy;
  recentFiles: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "zh",
  theme: "system",
  editorFontSize: 16,
  autosave: true,
  autosaveInterval: 30,
  autosaveToast: false,
  sessionRestore: true,
  imageStrategy: "relative",
  recentFiles: [],
};

const STORAGE_KEY = "easymd.settings.v1";

export function clampZoom(z: number): number {
  return Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
}

export function clampEditorFontSize(v: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 16;
  return Math.min(32, Math.max(12, n));
}

export function clampAutosaveInterval(v: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 30;
  return Math.min(600, Math.max(5, n));
}

export function addRecentFile(existing: string[], path: string): string[] {
  const next = [path, ...existing.filter((p) => p !== path)];
  return next.slice(0, MAX_RECENT_FILES);
}

export function loadSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    const recent = Array.isArray(merged.recentFiles)
      ? merged.recentFiles.filter((p): p is string => typeof p === "string").slice(0, MAX_RECENT_FILES)
      : [];
    return {
      lang: merged.lang === "en" ? "en" : "zh",
      theme: ["system", "light", "dark"].includes(merged.theme)
        ? merged.theme
        : "system",
      editorFontSize:
        parsed.editorFontSize === undefined
          ? clampEditorFontSize(
              clampZoom(Number((parsed as { zoom?: number }).zoom) || 1) * 16,
            )
          : clampEditorFontSize(Number(parsed.editorFontSize)),
      autosave: Boolean(merged.autosave),
      autosaveInterval: clampAutosaveInterval(Number(merged.autosaveInterval)),
      autosaveToast: Boolean(merged.autosaveToast),
      sessionRestore: merged.sessionRestore === undefined ? true : Boolean(merged.sessionRestore),
      imageStrategy: merged.imageStrategy === "original" ? "original" : "relative",
      recentFiles: recent,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): string {
  const json = JSON.stringify(s);
  localStorage.setItem(STORAGE_KEY, json);
  return json;
}

export function readStoredSettings(): Settings {
  return loadSettings(localStorage.getItem(STORAGE_KEY));
}
