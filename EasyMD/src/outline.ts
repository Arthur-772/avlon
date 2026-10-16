export interface OutlineItem {
  level: number;
  text: string;
  index: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(trimmed);
    if (m) {
      items.push({ level: m[1].length, text: m[2], index: items.length });
    }
  }
  return items;
}

export function countWords(markdown: string): number {
  const stripped = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const cjk = stripped.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
  const latin = stripped.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ");
  const words = latin.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  return cjk + words;
}

export function findActiveOutlineIndex(
  headings: Array<{ top: number }>,
  scrollTop: number,
): number {
  if (headings.length === 0) return -1;
  for (let index = headings.length - 1; index >= 0; index -= 1) {
    if (headings[index].top <= 112) return index;
  }
  return scrollTop > 0 ? 0 : -1;
}
