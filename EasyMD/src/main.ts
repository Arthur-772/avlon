import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "katex/dist/katex.min.css";
import "./theme.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

import { findMatches, replaceAllMatches, replaceMatch, type TextMatch } from "./find";
import { translate, type I18nKey, type Lang } from "./i18n";
import { normalizeDocumentPath, sameDocumentPath } from "./paths";
import {
  clampAutosaveInterval,
  clampZoom,
  addRecentFile,
  readStoredSettings,
  saveSettings,
  type Settings,
} from "./settings";
import { parseSession, serializeSession } from "./session";
import { countWords, parseOutline } from "./outline";

import chevronDownSvg from "lucide-static/icons/chevron-down.svg?raw";
import chevronUpSvg from "lucide-static/icons/chevron-up.svg?raw";
import folderOpenSvg from "lucide-static/icons/folder-open.svg?raw";
import filePlusSvg from "lucide-static/icons/file-plus.svg?raw";
import saveSvg from "lucide-static/icons/save.svg?raw";
import codeSvg from "lucide-static/icons/code.svg?raw";
import listSvg from "lucide-static/icons/list.svg?raw";
import settingsSvg from "lucide-static/icons/settings.svg?raw";
import xSvg from "lucide-static/icons/x.svg?raw";
import minusSvg from "lucide-static/icons/minus.svg?raw";
import plusSvg from "lucide-static/icons/plus.svg?raw";
import rotateCcwSvg from "lucide-static/icons/rotate-ccw.svg?raw";

const ICONS: Record<string, string> = {
  "file-plus": filePlusSvg,
  "folder-open": folderOpenSvg,
  save: saveSvg,
  code: codeSvg,
  list: listSvg,
  settings: settingsSvg,
  x: xSvg,
  minus: minusSvg,
  plus: plusSvg,
  "rotate-ccw": rotateCcwSvg,
  "chevron-up": chevronUpSvg,
  "chevron-down": chevronDownSvg,
};

const MD_FILTERS = [{ name: "Markdown", extensions: ["md", "markdown"] }];

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface Doc {
  id: number;
  path: string | null;
  markdown: string;
  dirty: boolean;
  scrollTop: number;
  mtimeNs: number | null;
  welcome: boolean;
}

interface AppState {
  settings: Settings;
  crepe: Crepe | null;
  docs: Doc[];
  activeId: number;
  nextId: number;
  sourceMode: boolean;
  outlineVisible: boolean;
}

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const state: AppState = {
  settings: readStoredSettings(),
  crepe: null,
  docs: [],
  activeId: 0,
  nextId: 1,
  sourceMode: false,
  outlineVisible: false,
};

const t = (key: I18nKey) => translate(state.settings.lang, key);

const openingPaths = new Set<string>();
const saveLocks = new Map<string, Promise<unknown>>();

function findDocByPath(path: string): Doc | undefined {
  return state.docs.find((d) => d.path && sameDocumentPath(d.path, path));
}

function activeDoc(): Doc | null {
  return state.docs.find((d) => d.id === state.activeId) ?? null;
}

function createDoc(markdown: string): Doc {
  return {
    id: state.nextId++,
    path: null,
    markdown,
    dirty: false,
    scrollTop: 0,
    mtimeNs: null,
    welcome: false,
  };
}

function currentContent(): string {
  if (state.sourceMode) return ($("source") as HTMLTextAreaElement).value;
  return activeDoc()?.markdown ?? "";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodeFileBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("gbk").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

async function trustPath(path: string): Promise<void> {
  await invoke("trust_directory", { path });
}

async function readTextFile(
  path: string,
): Promise<{ content: string; mtimeNs: number | null }> {
  if (!isTauri) {
    return { content: await fetch(path).then((r) => r.text()), mtimeNs: null };
  }
  await trustPath(path);
  const r = await invoke<{ contents_base64: string; mtime_ns: number | null }>(
    "read_file_bytes",
    { path },
  );
  return {
    content: decodeFileBytes(base64ToBytes(r.contents_base64)),
    mtimeNs: r.mtime_ns,
  };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file: File): Promise<string> {
  const doc = activeDoc();
  if (state.settings.imageStrategy === "relative" && isTauri && doc?.path) {
    const buffer = await file.arrayBuffer();
    return invoke<string>("save_image_file", {
      docPath: doc.path,
      fileName: file.name || "image.png",
      contentsBase64: arrayBufferToBase64(buffer),
    });
  }
  return fileToDataUri(file);
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

async function proxyImageUrl(url: string): Promise<string> {
  if (!isTauri) return url;
  const doc = activeDoc();
  if (!doc?.path) return url;
  const normalized = url.replace(/^\.\//, "");
  if (!normalized.startsWith("assets/")) return url;
  const sep = Math.max(doc.path.lastIndexOf("\\"), doc.path.lastIndexOf("/"));
  if (sep < 0) return url;
  const absolute = `${doc.path.slice(0, sep + 1)}${normalized.replaceAll("/", "\\")}`;
  const ext = absolute.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  try {
    const base64 = await invoke<string>("read_file_base64", { path: absolute });
    return `data:${mime};base64,${base64}`;
  } catch {
    return url;
  }
}

async function insertImageFile(file: File): Promise<void> {
  if (!isTauri || !state.crepe) return;
  try {
    const src = await uploadImage(file);
    state.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const imageType = view.state.schema.nodes.image;
      if (!imageType) return;
      const node = imageType.create({ src, alt: file.name });
      view.dispatch(view.state.tr.replaceSelectionWith(node));
    });
  } catch (err) {
    toast(`${t("saveFailed")}: ${String(err)}`);
  }
}

function initialDoc(): string {
  return state.settings.lang === "zh"
    ? "# 欢迎使用 EasyMD\n\n开始编辑你的 Markdown 文档。\n"
    : "# Welcome to EasyMD\n\nStart editing your Markdown document.\n";
}

function applyIcons(): void {
  document.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    if (name && ICONS[name]) el.innerHTML = ICONS[name];
  });
}

function applyI18n(): void {
  document.documentElement.lang = state.settings.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as I18nKey;
    el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle as I18nKey;
    el.title = t(key);
  });
  document
    .querySelectorAll<HTMLElement>("[data-i18n-placeholder]")
    .forEach((el) => {
      const key = el.dataset.i18nPlaceholder as I18nKey;
      (el as HTMLInputElement).placeholder = t(key);
    });
  updateTitle();
  updateStatus();
  updateOutline();
  renderTabs();
  renderRecentPanel();
}

function updateTitle(): void {
  const doc = activeDoc();
  const name = doc?.path ? doc.path.split(/[\\/]/).pop() : t("untitled");
  document.title = `${doc?.dirty ? "● " : ""}${name} - EasyMD`;
}

function updateStatus(): void {
  const dot = $("status-dot");
  const doc = activeDoc();
  dot.classList.toggle("dirty", doc?.dirty ?? false);
  $("status-file").textContent =
    doc?.path ?? `${t("untitled")}${doc?.dirty ? " ●" : ""}`;
  $("status-words").textContent = `${t("words")} ${countWords(doc?.markdown ?? "")}`;
}

function updateZoomUi(): void {
  $("status-zoom").textContent = `${Math.round(state.settings.zoom * 100)}%`;
  document.documentElement.style.setProperty(
    "--app-zoom",
    String(state.settings.zoom),
  );
}

function setZoom(z: number): void {
  state.settings.zoom = clampZoom(z);
  saveSettings(state.settings);
  updateZoomUi();
}

function markDirty(dirty: boolean): void {
  const doc = activeDoc();
  if (!doc || doc.dirty === dirty) return;
  doc.dirty = dirty;
  updateTitle();
  updateStatus();
  const tab = document.querySelector(`.tab[data-id="${doc.id}"]`);
  tab?.classList.toggle("dirty", doc.dirty);
  renderRecentPanel();
  persistSessionSoon();
}

async function createEditor(markdown: string): Promise<void> {
  const root = $("editor");
  root.innerHTML = "";
  if (state.crepe) {
    await state.crepe.destroy();
    state.crepe = null;
  }
  const crepe = new Crepe({
    root,
    defaultValue: markdown,
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: state.settings.lang === "zh" ? "开始输入..." : "Start writing...",
      },
      [Crepe.Feature.ImageBlock]: {
        onUpload: (file: File) => uploadImage(file),
        inlineOnUpload: (file: File) => uploadImage(file),
        blockOnUpload: (file: File) => uploadImage(file),
        proxyDomURL: (url: string) => proxyImageUrl(url),
      },
    },
  });
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, md) => {
      const doc = activeDoc();
      if (doc) doc.markdown = md;
      markDirty(true);
      updateOutline();
    });
  });
  await crepe.create();
  state.crepe = crepe;
  const doc = activeDoc();
  if (doc && doc.id === state.activeId) doc.markdown = markdown;
}

function updateOutline(): void {
  const list = $("outline-list");
  const items = parseOutline(activeDoc()?.markdown ?? "");
  list.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "outline-empty";
    empty.textContent = t("noOutline");
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const el = document.createElement("div");
    el.className = `outline-item lv-${item.level}`;
    el.textContent = item.text;
    el.dataset.index = String(item.index);
    el.addEventListener("click", () => jumpToHeading(item.index));
    list.appendChild(el);
  }
}

function jumpToHeading(index: number): void {
  const headings = $("editor").querySelectorAll("h1,h2,h3,h4,h5,h6");
  const target = headings[index];
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setSourceMode(on: boolean): void {
  state.sourceMode = on;
  $("editor").style.display = on ? "none" : "";
  const src = $("source") as HTMLTextAreaElement;
  src.style.display = on ? "block" : "none";
  $("btn-source").classList.toggle("active", on);
  if (on) {
    src.value = activeDoc()?.markdown ?? "";
    closeFindBar();
  } else {
    const md = src.value;
    const doc = activeDoc();
    const unchanged = md === (doc?.markdown ?? "");
    const wasDirty = doc?.dirty ?? false;
    if (doc) doc.markdown = md;
    void createEditor(md).then(() => {
      if (unchanged && doc) {
        doc.dirty = wasDirty;
        updateTitle();
        updateStatus();
      }
      updateOutline();
      if (finder.open) refreshMatches();
    });
  }
}

async function openFile(path?: string): Promise<void> {
  try {
    let target = path ?? null;
    if (!target && isTauri) {
      const picked = await openDialog({ multiple: false, filters: MD_FILTERS });
      if (typeof picked !== "string") return;
      target = picked;
    }
    if (!target) return;
    hideRecentPanel();
    const key = normalizeDocumentPath(target);
    if (openingPaths.has(key)) return;
    const existingBeforeRead = findDocByPath(target);
    if (existingBeforeRead) {
      await switchTab(existingBeforeRead.id);
      return;
    }
    openingPaths.add(key);
    try {
      const { content, mtimeNs } = await readTextFile(target);
      const existing = findDocByPath(target);
      if (existing) {
        await switchTab(existing.id);
        return;
      }

      const emptyActive = activeDoc();
      if (emptyActive && !emptyActive.path && !emptyActive.dirty) {
        emptyActive.path = target;
        emptyActive.markdown = content;
        emptyActive.mtimeNs = mtimeNs;
        emptyActive.welcome = false;
      } else {
        const doc = createDoc(content);
        doc.path = target;
        doc.mtimeNs = mtimeNs;
        state.docs.push(doc);
        state.activeId = doc.id;
      }
      addRecent(target);
      persistSessionSoon();
      await activateActiveDoc();
    } finally {
      openingPaths.delete(key);
    }
  } catch (err) {
    toast(`${t("openFailed")}: ${String(err)}`);
  }
}

function addRecent(path: string): void {
  state.settings.recentFiles = addRecentFile(state.settings.recentFiles, path);
  saveSettings(state.settings);
}

async function newDocument(): Promise<void> {
  const empty = state.docs.find(
    (d) => !d.path && !d.dirty && !d.markdown.trim(),
  );
  if (empty) {
    await switchTab(empty.id);
    return;
  }
  const doc = createDoc("");
  doc.welcome = true;
  state.docs.push(doc);
  await switchTab(doc.id);
}

async function activateActiveDoc(): Promise<void> {
  const doc = activeDoc();
  if (!doc) return;
  if (state.sourceMode) ($("source") as HTMLTextAreaElement).value = doc.markdown;
  await createEditor(doc.markdown);
  markDirty(doc.dirty);
  updateTitle();
  updateStatus();
  updateOutline();
  renderRecentPanel();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (state.sourceMode) {
        ($("source") as HTMLTextAreaElement).scrollTop = doc.scrollTop;
      } else {
        $("editor").scrollTop = doc.scrollTop;
      }
    }),
  );
}

async function switchTab(id: number): Promise<void> {
  if (id === state.activeId) return;
  const doc = state.docs.find((d) => d.id === id);
  if (!doc) return;
  const cur = activeDoc();
  if (cur) {
    cur.scrollTop = state.sourceMode
      ? ($("source") as HTMLTextAreaElement).scrollTop
      : $("editor").scrollTop;
  }
  if (state.sourceMode) {
    if (cur) cur.markdown = ($("source") as HTMLTextAreaElement).value;
  }
  state.activeId = id;
  await activateActiveDoc();
  persistSessionSoon();
}

async function closeTab(id: number): Promise<void> {
  const idx = state.docs.findIndex((d) => d.id === id);
  if (idx === -1) return;
  const doc = state.docs[idx];
  if (doc.dirty) {
    const content = doc.id === state.activeId ? currentContent() : doc.markdown;
    const choice = await confirmUnsaved();
    if (choice === "cancel") return;
    if (choice === "saved" && !(await saveDoc(doc, content))) return;
  }
  state.docs.splice(idx, 1);
  if (state.docs.length === 0) {
    clearSession();
    await getCurrentWindow().destroy();
    return;
  }
  if (id === state.activeId) {
    const next = state.docs[Math.min(idx, state.docs.length - 1)];
    state.activeId = next.id;
    await activateActiveDoc();
  } else {
    renderTabs();
  }
  persistSessionSoon();
}

async function saveDoc(
  doc: Doc,
  contentOverride?: string,
  forceDialog = false,
): Promise<boolean> {
  return withSaveLock(doc, doc.path, async () => {
  try {
    const content =
      contentOverride ??
      (doc.id === state.activeId ? currentContent() : doc.markdown);
    let path = doc.path;
    if (forceDialog || !path) {
      if (!isTauri) return false;
      const picked = await saveDialog({
        defaultPath: doc.path
          ? doc.path.split(/[\\/]/).pop()
          : `${t("untitled")}.md`,
        filters: MD_FILTERS,
      });
      if (typeof picked !== "string") return false;
      path = picked;
      doc.path = path;
      await trustPath(path);
    }
    if (isTauri && path) {
      const otherDoc = findDocByPath(path);
      if (otherDoc && otherDoc.id !== doc.id) {
        toast(t("duplicateDocument"));
        return false;
      }
    }
    if (isTauri) {
      try {
        doc.mtimeNs = await invoke<number>("write_text_file", {
          path,
          contents: content,
          expectedMtimeNs: doc.mtimeNs,
        });
      } catch (err) {
        if (!String(err).includes("external modified")) throw err;
        const choice = await confirmConflict();
        if (choice === "cancel") return false;
        if (choice === "overwrite") {
          doc.mtimeNs = await invoke<number>("write_text_file", {
            path,
            contents: content,
            expectedMtimeNs: null,
          });
        } else {
          return reloadDocFromDisk(doc);
        }
      }
    }
    doc.markdown = content;
    doc.dirty = false;
    doc.welcome = false;
    if (path) addRecent(path);
    updateTitle();
    updateStatus();
    renderTabs();
    persistSessionSoon();
    return true;
  } catch (err) {
    toast(`${t("saveFailed")}: ${String(err)}`);
    return false;
  }
  });
}

function withSaveLock<T>(
  doc: Doc,
  path: string | null,
  task: () => Promise<T>,
): Promise<T> {
  const key = path ? normalizeDocumentPath(path) : `doc:${doc.id}`;
  const previous = saveLocks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  saveLocks.set(key, next.then(() => undefined, () => undefined));
  return next;
}

async function reloadDocFromDisk(doc: Doc): Promise<boolean> {
  try {
    if (!doc.path) return false;
    const { content, mtimeNs } = await readTextFile(doc.path);
    doc.markdown = content;
    doc.mtimeNs = mtimeNs;
    doc.dirty = false;
    if (doc.id === state.activeId) {
      if (state.sourceMode) {
        ($("source") as HTMLTextAreaElement).value = content;
      } else {
        await createEditor(content);
      }
      updateOutline();
    }
    updateTitle();
    updateStatus();
    renderTabs();
    return false;
  } catch {
    toast(t("reloadFailed"));
    return false;
  }
}

async function doSave(): Promise<boolean> {
  const doc = activeDoc();
  if (!doc) return false;
  return saveDoc(doc);
}

async function doSaveAs(): Promise<boolean> {
  const doc = activeDoc();
  if (!doc) return false;
  const ok = await saveDoc(doc, undefined, true);
  if (ok) toast(t("saved"));
  return ok;
}

function confirmUnsaved(): Promise<"saved" | "discard" | "cancel"> {
  return askModal("confirm-modal", [
    "btn-confirm-save",
    "btn-confirm-discard",
    "btn-confirm-cancel",
  ]).then((i) => (["saved", "discard", "cancel"] as const)[i]);
}

function confirmConflict(): Promise<"overwrite" | "reload" | "cancel"> {
  return askModal("conflict-modal", [
    "btn-conflict-overwrite",
    "btn-conflict-reload",
    "btn-conflict-cancel",
  ]).then((i) => (["overwrite", "reload", "cancel"] as const)[i]);
}

function askModal(modalId: string, buttonIds: string[]): Promise<number> {
  return new Promise((resolve) => {
    const modal = $(modalId);
    modal.classList.remove("hidden");
    const done = (result: number) => {
      modal.classList.add("hidden");
      resolve(result);
    };
    buttonIds.forEach((id, i) => {
      ($(id) as HTMLButtonElement).onclick = () => done(i);
    });
  });
}

async function requestClose(): Promise<boolean> {
  const dirtyDocs = state.docs.filter((d) => d.dirty);
  if (dirtyDocs.length === 0) return true;
  const choice = await confirmUnsaved();
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  for (const doc of dirtyDocs) {
    if (!(await saveDoc(doc))) return false;
  }
  return true;
}

function renderTabs(): void {
  const bar = $("tab-bar");
  bar.innerHTML = "";
  for (const doc of state.docs) {
    const tab = document.createElement("div");
    tab.className = `tab${doc.id === state.activeId ? " active" : ""}${doc.dirty ? " dirty" : ""}`;
    tab.dataset.id = String(doc.id);
    const name = doc.path
      ? doc.path.split(/[\\/]/).pop() ?? ""
      : t("untitled");
    const dot = document.createElement("span");
    dot.className = "tab-dot";
    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = name;
    label.title = doc.path ?? name;
    const close = document.createElement("button");
    close.className = "tab-close";
    close.innerHTML = ICONS["x"];
    close.title = t("closeTab");
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      void closeTab(doc.id);
    });
    tab.append(dot, label, close);
    tab.addEventListener("click", () => void switchTab(doc.id));
    bar.appendChild(tab);
  }
}

function toast(message: string): void {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  window.setTimeout(() => el.classList.add("hidden"), 2200);
}

function applyTheme(): void {
  const theme = state.settings.theme;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function renderRecentPanel(): void {
  const panel = $("recent-panel");
  const doc = activeDoc();
  const show =
    !!doc &&
    !doc.path &&
    !doc.dirty &&
    doc.welcome &&
    state.settings.recentFiles.length > 0;
  if (!show) {
    panel.classList.add("hidden");
    return;
  }
  const list = $("recent-list");
  list.innerHTML = "";
  for (const p of state.settings.recentFiles) {
    const item = document.createElement("div");
    item.className = "recent-item";
    const name = document.createElement("span");
    name.className = "recent-name";
    name.textContent = p.split(/[\\/]/).pop() ?? p;
    const sep = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
    const dir = document.createElement("span");
    dir.className = "recent-dir";
    dir.textContent = sep > 0 ? p.slice(0, sep) : "";
    dir.title = p;
    item.append(name, dir);
    item.addEventListener("click", () => void openFile(p));
    list.appendChild(item);
  }
  panel.classList.remove("hidden");
}

function hideRecentPanel(): void {
  $("recent-panel").classList.add("hidden");
}

function applySettingsToUi(): void {
  ($("set-lang") as HTMLSelectElement).value = state.settings.lang;
  ($("set-theme") as HTMLSelectElement).value = state.settings.theme;
  ($("set-autosave") as HTMLInputElement).checked = state.settings.autosave;
  ($("set-autosave-interval") as HTMLInputElement).value =
    String(state.settings.autosaveInterval);
  ($("set-autosave-toast") as HTMLInputElement).checked =
    state.settings.autosaveToast;
  ($("set-session-restore") as HTMLInputElement).checked =
    state.settings.sessionRestore;
  ($("set-image-strategy") as HTMLSelectElement).value =
    state.settings.imageStrategy;
  applyTheme();
  applyI18n();
  updateZoomUi();
}

async function refreshAssociationCheckbox(): Promise<void> {
  if (!isTauri) return;
  try {
    const associated = await invoke<boolean>("is_md_associated");
    ($("set-associate") as HTMLInputElement).checked = associated;
  } catch {
    /* registry not available; leave unchecked */
  }
}

function setupUi(): void {
  applyIcons();
  $("btn-new").addEventListener("click", () => void newDocument());
  $("btn-open").addEventListener("click", () => void openFile());
  $("btn-save").addEventListener("click", () =>
    void doSave().then((ok) => {
      if (ok) toast(t("saved"));
    }),
  );
  $("btn-source").addEventListener("click", () => setSourceMode(!state.sourceMode));
  $("btn-outline").addEventListener("click", () => {
    state.outlineVisible = !state.outlineVisible;
    $("outline-panel").style.display = state.outlineVisible ? "" : "none";
    $("btn-outline").classList.toggle("active", state.outlineVisible);
  });
  $("btn-outline-close").addEventListener("click", () => {
    state.outlineVisible = false;
    $("outline-panel").style.display = "none";
    $("btn-outline").classList.remove("active");
  });
  $("btn-settings").addEventListener("click", () => {
    void refreshAssociationCheckbox();
    $("settings-modal").classList.remove("hidden");
  });
  $("btn-settings-close").addEventListener("click", () =>
    $("settings-modal").classList.add("hidden"),
  );
  $("btn-zoom-in").addEventListener("click", () => setZoom(state.settings.zoom + 0.1));
  $("btn-zoom-out").addEventListener("click", () => setZoom(state.settings.zoom - 0.1));
  $("btn-zoom-reset").addEventListener("click", () => setZoom(1));

  ($("set-lang") as HTMLSelectElement).addEventListener("change", (e) => {
    state.settings.lang = (e.target as HTMLSelectElement).value as Lang;
    saveSettings(state.settings);
    applySettingsToUi();
  });
  ($("set-theme") as HTMLSelectElement).addEventListener("change", (e) => {
    state.settings.theme = (e.target as HTMLSelectElement).value as Settings["theme"];
    saveSettings(state.settings);
    applyTheme();
  });
  ($("set-autosave") as HTMLInputElement).addEventListener("change", (e) => {
    state.settings.autosave = (e.target as HTMLInputElement).checked;
    saveSettings(state.settings);
  });
  ($("set-autosave-interval") as HTMLInputElement).addEventListener("change", (e) => {
    state.settings.autosaveInterval = clampAutosaveInterval(
      Number((e.target as HTMLInputElement).value),
    );
    (e.target as HTMLInputElement).value = String(state.settings.autosaveInterval);
    saveSettings(state.settings);
  });
  ($("set-autosave-toast") as HTMLInputElement).addEventListener("change", (e) => {
    state.settings.autosaveToast = (e.target as HTMLInputElement).checked;
    saveSettings(state.settings);
  });
  ($("set-session-restore") as HTMLInputElement).addEventListener("change", (e) => {
    state.settings.sessionRestore = (e.target as HTMLInputElement).checked;
    saveSettings(state.settings);
  });
  ($("set-image-strategy") as HTMLSelectElement).addEventListener("change", (e) => {
    state.settings.imageStrategy = (e.target as HTMLSelectElement)
      .value as Settings["imageStrategy"];
    saveSettings(state.settings);
  });
  ($("set-associate") as HTMLInputElement).addEventListener("change", async (e) => {
    const enable = (e.target as HTMLInputElement).checked;
    if (!isTauri) return;
    try {
      await invoke("set_md_association", { enable });
      toast(enable ? t("associated") : t("disassociated"));
    } catch (err) {
      (e.target as HTMLInputElement).checked = !enable;
      toast(`${t("associateFailed")}: ${String(err)}`);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      void doSaveAs();
    } else if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      void doSave().then((ok) => {
        if (ok) toast(t("saved"));
      });
    } else if (e.ctrlKey && (e.key === "o" || e.key === "O")) {
      e.preventDefault();
      void openFile();
    } else if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      void newDocument();
    } else if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
      e.preventDefault();
      void closeTab(state.activeId);
    } else if (e.ctrlKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      openFindBar(false);
    } else if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
      e.preventDefault();
      openFindBar(true);
    } else if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      setZoom(state.settings.zoom + 0.1);
    } else if (e.ctrlKey && e.key === "-") {
      e.preventDefault();
      setZoom(state.settings.zoom - 0.1);
    } else if (e.ctrlKey && e.key === "0") {
      e.preventDefault();
      setZoom(1);
    }
  });

  ($("source") as HTMLTextAreaElement).addEventListener("input", () => {
    const doc = activeDoc();
    if (!doc) return;
    doc.markdown = ($("source") as HTMLTextAreaElement).value;
    markDirty(true);
    updateOutline();
  });

  const editorPane = document.querySelector(".editor-pane") as HTMLElement;
  editorPane.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(state.settings.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
      }
    },
    { passive: false },
  );

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme();
  });

  $("editor").addEventListener(
    "paste",
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let file: File | null = null;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          file = item.getAsFile();
          break;
        }
      }
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      void insertImageFile(file);
    },
    true,
  );
}

function setupTauri(): void {
  if (!isTauri) return;
  const win = getCurrentWindow();
  win.onCloseRequested(async (event) => {
    const allowed = await requestClose();
    if (!allowed) event.preventDefault();
    else clearSession();
  });
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      const paths = event.payload.paths ?? [];
      const md = paths.find((p) => /\.(md|markdown)$/i.test(p));
      if (md) void openFile(md);
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "/") {
      e.preventDefault();
      setSourceMode(!state.sourceMode);
    }
  });
  void getCurrentWindow().listen<string>("open-file", (event) => {
    void openFile(event.payload);
  });
  void invoke<string | null>("get_open_file_arg").then((p) => {
    if (p) void openFile(p);
  });
}

function runAutosave(): void {
  if (!state.settings.autosave) return;
  for (const doc of [...state.docs]) {
    if (!doc.dirty || !doc.path) continue;
    const content = doc.id === state.activeId ? currentContent() : doc.markdown;
    void saveDoc(doc, content).then((ok) => {
      if (ok && state.settings.autosaveToast) toast(t("autosaved"));
    });
  }
  persistSessionSoon();
}

function startAutosave(): void {
  let counter = 0;
  window.setInterval(() => {
    counter++;
    if (counter >= state.settings.autosaveInterval) {
      counter = 0;
      runAutosave();
    }
  }, 1_000);
}

let sessionTimer: number | null = null;

function clearSession(): void {
  if (!isTauri) return;
  void invoke("save_session", { json: '{"active":0,"docs":[]}' }).catch(() => {});
}

function persistSessionSoon(): void {
  if (!isTauri || !state.settings.sessionRestore) return;
  if (sessionTimer !== null) window.clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(persistSession, 800);
}

function persistSession(): void {
  if (!isTauri) return;
  const activeIndex = Math.max(
    0,
    state.docs.findIndex((d) => d.id === state.activeId),
  );
  const json = serializeSession(
    activeIndex,
    state.docs.map((d) => ({
      path: d.path,
      markdown: d.markdown,
      dirty: d.dirty,
      scrollTop: d.scrollTop,
    })),
  );
  void invoke("save_session", { json }).catch(() => {});
}

async function restoreSession(): Promise<boolean> {
  if (!isTauri || !state.settings.sessionRestore) return false;
  const raw = await invoke<string | null>("load_session");
  const session = parseSession(raw);
  if (!session) return false;
  for (const sd of session.docs) {
    const doc = createDoc(sd.markdown);
    doc.path = sd.path;
    doc.dirty = sd.dirty;
    doc.scrollTop = sd.scrollTop;
    doc.welcome = !sd.path && !sd.dirty;
    if (sd.path) {
      try {
        const { content, mtimeNs } = await readTextFile(sd.path);
        if (sd.dirty) {
          doc.markdown = sd.markdown;
          doc.mtimeNs = null;
        } else {
          doc.markdown = content;
          doc.mtimeNs = mtimeNs;
        }
      } catch {
        doc.path = null;
        doc.dirty = true;
        doc.mtimeNs = null;
      }
    }
    if (doc.path && findDocByPath(doc.path)) {
      if (doc.dirty) {
        doc.path = null;
      } else {
        continue;
      }
    }
    state.docs.push(doc);
  }
  const active = state.docs[Math.min(session.active, state.docs.length - 1)];
  state.activeId = active.id;
  return true;
}

const finder = {
  open: false,
  query: "",
  matches: [] as ({ from: number; to: number } | TextMatch)[],
  index: -1,
};

function getEditorView(): EditorView | null {
  if (!state.crepe || state.sourceMode) return null;
  let view: EditorView | null = null;
  state.crepe.editor.action((ctx) => {
    view = ctx.get(editorViewCtx);
  });
  return view;
}

function wysiwygSegments(
  view: EditorView,
): { text: string; segments: { text: string; pos: number }[] } {
  const segments: { text: string; pos: number }[] = [];
  let text = "";
  view.state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segments.push({ text: node.text, pos });
      text += node.text;
    }
    return true;
  });
  return { text, segments };
}

function isWysiwygMatch(
  m: { from: number; to: number } | TextMatch,
): m is { from: number; to: number } {
  return "from" in m;
}

function refreshMatches(): void {
  const query = ($("find-input") as HTMLInputElement).value;
  finder.query = query;
  const count = $("find-count");
  if (!query) {
    finder.matches = [];
    finder.index = -1;
    count.textContent = "";
    return;
  }
  const view = getEditorView();
  if (view) {
    const { text, segments } = wysiwygSegments(view);
    const raw = findMatches(text, query);
    let offset = 0;
    let segIdx = 0;
    finder.matches = raw.map((m) => {
      while (
        segIdx < segments.length - 1 &&
        offset + segments[segIdx].text.length <= m.start
      ) {
        offset += segments[segIdx].text.length;
        segIdx++;
      }
      return {
        from: segments[segIdx].pos + (m.start - offset),
        to: segments[segIdx].pos + (m.end - offset),
      };
    });
  } else {
    const src = $("source") as HTMLTextAreaElement;
    finder.matches = findMatches(src.value, query);
  }
  finder.index = finder.matches.length > 0 ? 0 : -1;
  count.textContent =
    finder.matches.length > 0
      ? `${finder.matches.length} ${t("matchCount")}`
      : t("noMatches");
  if (finder.index >= 0) gotoMatch(finder.index);
}

function gotoMatch(index: number): void {
  const matches = finder.matches;
  if (index < 0 || index >= matches.length) return;
  finder.index = index;
  const view = getEditorView();
  if (view && isWysiwygMatch(matches[index])) {
    const m = matches[index] as { from: number; to: number };
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, m.from, m.to))
        .scrollIntoView(),
    );
  } else {
    const src = $("source") as HTMLTextAreaElement;
    const m = matches[index] as TextMatch;
    src.focus();
    src.setSelectionRange(m.start, m.end);
    const line = src.value.slice(0, m.start).split("\n").length - 1;
    src.scrollTop = Math.max(0, line * 24 - src.clientHeight / 2);
  }
}

function stepMatch(delta: number): void {
  if (finder.matches.length === 0) return;
  const next =
    (finder.index + delta + finder.matches.length) % finder.matches.length;
  gotoMatch(next);
}

function replaceCurrent(): void {
  const replacement = ($("replace-input") as HTMLInputElement).value;
  const m = finder.matches[finder.index];
  if (!m) return;
  const view = getEditorView();
  if (view && isWysiwygMatch(m)) {
    view.dispatch(view.state.tr.insertText(replacement, m.from, m.to));
    const doc = activeDoc();
    if (doc) {
      doc.markdown = view.state.doc.textBetween(
        0,
        view.state.doc.content.size,
        "\n",
      );
      markDirty(true);
    }
  } else {
    const src = $("source") as HTMLTextAreaElement;
    const tm = m as TextMatch;
    src.value = replaceMatch(src.value, tm, replacement);
    const doc = activeDoc();
    if (doc) doc.markdown = src.value;
    markDirty(true);
  }
  refreshMatches();
}

function replaceEverything(): void {
  const replacement = ($("replace-input") as HTMLInputElement).value;
  const view = getEditorView();
  if (view && finder.matches.length > 0 && isWysiwygMatch(finder.matches[0])) {
    for (const m of [...finder.matches].reverse() as { from: number; to: number }[]) {
      view.dispatch(view.state.tr.insertText(replacement, m.from, m.to));
    }
    const doc = activeDoc();
    if (doc) {
      doc.markdown = view.state.doc.textBetween(
        0,
        view.state.doc.content.size,
        "\n",
      );
      markDirty(true);
    }
  } else {
    const src = $("source") as HTMLTextAreaElement;
    src.value = replaceAllMatches(
      src.value,
      finder.matches as TextMatch[],
      replacement,
    );
    const doc = activeDoc();
    if (doc) doc.markdown = src.value;
    markDirty(true);
  }
  refreshMatches();
}

function openFindBar(withReplace: boolean): void {
  finder.open = true;
  $("find-bar").classList.remove("hidden");
  $("replace-input").classList.toggle("hidden", !withReplace);
  $("btn-replace-one").classList.toggle("hidden", !withReplace);
  $("btn-replace-all").classList.toggle("hidden", !withReplace);
  const input = $("find-input") as HTMLInputElement;
  input.focus();
  input.select();
  refreshMatches();
}

function closeFindBar(): void {
  finder.open = false;
  $("find-bar").classList.add("hidden");
}

function setupFindBar(): void {
  const input = $("find-input") as HTMLInputElement;
  input.addEventListener("input", () => refreshMatches());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      stepMatch(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      closeFindBar();
    }
  });
  ($("replace-input") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFindBar();
  });
  $("btn-find-prev").addEventListener("click", () => stepMatch(-1));
  $("btn-find-next").addEventListener("click", () => stepMatch(1));
  $("btn-replace-one").addEventListener("click", () => replaceCurrent());
  $("btn-replace-all").addEventListener("click", () => replaceEverything());
  $("btn-find-close").addEventListener("click", () => closeFindBar());
}

function setupRecentPanel(): void {
  const panel = $("recent-panel");
  document.addEventListener("mousedown", (event) => {
    if (!panel.contains(event.target as Node)) hideRecentPanel();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideRecentPanel();
  });
}

async function boot(): Promise<void> {
  applySettingsToUi();
  setupUi();
  setupFindBar();
  setupRecentPanel();
  setupTauri();
  let restored = false;
  try {
    restored = await restoreSession();
  } catch {
    restored = false;
  }
  if (!restored) {
    const doc = createDoc(initialDoc());
    doc.welcome = true;
    state.docs.push(doc);
    state.activeId = doc.id;
  }
  await activateActiveDoc();
  startAutosave();
}

void boot();
