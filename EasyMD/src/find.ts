export interface TextMatch {
  start: number;
  end: number;
}

export function findMatches(
  text: string,
  query: string,
  caseSensitive = false,
): TextMatch[] {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: TextMatch[] = [];
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    out.push({ start: i, end: i + needle.length });
    i += needle.length;
  }
  return out;
}

export function replaceMatch(text: string, match: TextMatch, replacement: string): string {
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}

export function replaceAllMatches(
  text: string,
  matches: TextMatch[],
  replacement: string,
): string {
  let out = text;
  for (const m of [...matches].reverse()) {
    out = replaceMatch(out, m, replacement);
  }
  return out;
}
