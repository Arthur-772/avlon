import type { Node } from "@milkdown/kit/prose/model";
import {
  $mark,
  $remark,
} from "@milkdown/utils";
import type { MarkdownNode } from "@milkdown/transformer";

export const MIN_TEXT_FONT_SIZE = 10;
export const MAX_TEXT_FONT_SIZE = 40;

export interface TextStyleAttrs {
  size: number | null;
  color: string | null;
  background: string | null;
}

export function clampTextFontSize(value: number): number {
  if (!Number.isFinite(value)) return 16;
  return Math.min(MAX_TEXT_FONT_SIZE, Math.max(MIN_TEXT_FONT_SIZE, Math.round(value)));
}

export function normalizeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed.toLowerCase();
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    return hex;
  }
  return trimmed;
}

export function parseTextStyleHtml(value: string): TextStyleAttrs | false {
  const match = value.match(
    /^\s*<span\s+style\s*=\s*["']([^"']+)["']\s*>\s*$/,
  );
  if (!match) return false;

  const styleStr = match[1];
  const attrs: TextStyleAttrs = { size: null, color: null, background: null };

  const sizeMatch = styleStr.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
  if (sizeMatch) attrs.size = clampTextFontSize(Number(sizeMatch[1]));

  const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/i);
  if (colorMatch) attrs.color = normalizeColor(colorMatch[1]);

  const bgMatch = styleStr.match(/background-color:\s*([^;]+)/i);
  if (bgMatch) attrs.background = normalizeColor(bgMatch[1]);

  if (attrs.size === null && attrs.color === null && attrs.background === null) {
    return false;
  }
  return attrs;
}

export function isTextStyleClosingTag(value: string): boolean {
  return /^\s*<\/span>\s*$/.test(value);
}

export function wrapTextStyleHtml(text: string, attrs: TextStyleAttrs): string {
  const styles: string[] = [];
  if (attrs.size !== null) styles.push(`font-size:${attrs.size}px`);
  if (attrs.color !== null) styles.push(`color:${attrs.color}`);
  if (attrs.background !== null) styles.push(`background-color:${attrs.background}`);
  return `<span style="${styles.join(";")}">${text}</span>`;
}

type ParentWithChildren = MarkdownNode & { children: MarkdownNode[] };

function wrapInlineSpans(parent: ParentWithChildren): void {
  const children = parent.children;
  const next: MarkdownNode[] = [];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index] as MarkdownNode & { value?: string };
    const attrs = child.type === "html" && typeof child.value === "string"
      ? parseTextStyleHtml(child.value)
      : false;

    if (attrs === false) {
      next.push(child);
      continue;
    }

    let closeIndex = -1;
    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      const candidate = children[cursor] as MarkdownNode & { value?: string };
      if (
        candidate.type === "html" &&
        typeof candidate.value === "string" &&
        isTextStyleClosingTag(candidate.value)
      ) {
        closeIndex = cursor;
        break;
      }
    }
    if (closeIndex < 0) {
      next.push(child);
      continue;
    }

    next.push({
      type: "easymdTextStyle",
      ...attrs,
      children: children.slice(index + 1, closeIndex),
    });
    index = closeIndex;
  }

  parent.children = next;
}

export function transformTextStyleMarkdownAst(node: MarkdownNode): void {
  if (Array.isArray((node as ParentWithChildren).children)) {
    wrapInlineSpans(node as ParentWithChildren);
    for (const child of (node as ParentWithChildren).children) {
      transformTextStyleMarkdownAst(child);
    }
  }
}

export const textStyleRemark = $remark("easymdTextStyle", () => () => (tree) => {
  transformTextStyleMarkdownAst(tree as MarkdownNode);
});

export const textStyleMark = $mark("easymd_text_style", () => ({
  attrs: {
    size: { default: null },
    color: { default: null },
    background: { default: null },
  },
  inclusive: false,
  priority: 1000,
  parseDOM: [
    {
      tag: "span[data-easymd-font-size], span[data-easymd-color], span[data-easymd-background]",
      getAttrs: (dom) => {
        const el = dom as HTMLElement;
        return {
          size: el.dataset.easymdFontSize
            ? clampTextFontSize(Number(el.dataset.easymdFontSize))
            : null,
          color: el.dataset.easymdColor ?? null,
          background: el.dataset.easymdBackground ?? null,
        };
      },
    },
    {
      tag: "span[style]",
      getAttrs: (dom) => {
        const el = dom as HTMLElement;
        const fontSizeRaw = parseFloat(el.style.fontSize);
        const size = Number.isFinite(fontSizeRaw)
          ? clampTextFontSize(fontSizeRaw)
          : null;
        const color = normalizeColor(el.style.color || null);
        const background = normalizeColor(el.style.backgroundColor || null);
        if (size === null && color === null && background === null) return false;
        return { size, color, background };
      },
    },
  ],
  toDOM: (mark) => {
    const size = mark.attrs.size ? clampTextFontSize(Number(mark.attrs.size)) : null;
    const color = normalizeColor(mark.attrs.color);
    const background = normalizeColor(mark.attrs.background);

    const styleParts: string[] = [];
    if (size !== null) styleParts.push(`font-size:${size}px`);
    if (color !== null) styleParts.push(`color:${color}`);
    if (background !== null) styleParts.push(`background-color:${background}`);

    const domAttrs: Record<string, string> = {};
    if (size !== null) domAttrs["data-easymd-font-size"] = String(size);
    if (color !== null) domAttrs["data-easymd-color"] = color;
    if (background !== null) domAttrs["data-easymd-background"] = background;
    if (styleParts.length > 0) domAttrs.style = styleParts.join(";");

    return ["span", domAttrs];
  },
  parseMarkdown: {
    match: (node) => node.type === "easymdTextStyle",
    runner: (state, node, markType) => {
      state.openMark(markType, {
        size: (node as MarkdownNode & { size?: number }).size ?? null,
        color: (node as MarkdownNode & { color?: string }).color ?? null,
        background: (node as MarkdownNode & { background?: string }).background ?? null,
      });
      state.next(node.children ?? []);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "easymd_text_style",
    runner: (state, mark, node: Node) => {
      const attrs: TextStyleAttrs = {
        size: mark.attrs.size ? clampTextFontSize(Number(mark.attrs.size)) : null,
        color: normalizeColor(mark.attrs.color),
        background: normalizeColor(mark.attrs.background),
      };
      state.withMark(
        mark,
        "html",
        wrapTextStyleHtml(String((node as Node & { text?: string }).text ?? ""), attrs),
      );
    },
  },
}));
