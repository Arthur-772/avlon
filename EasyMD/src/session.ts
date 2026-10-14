export interface SessionDoc {
  path: string | null;
  markdown: string;
  dirty: boolean;
  scrollTop: number;
}

export interface Session {
  active: number;
  docs: SessionDoc[];
}

export function serializeSession(active: number, docs: SessionDoc[]): string {
  return JSON.stringify({ active, docs } satisfies Session);
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!Array.isArray(parsed.docs) || parsed.docs.length === 0) return null;
    const docs: SessionDoc[] = [];
    for (const d of parsed.docs) {
      if (typeof d !== "object" || d === null) return null;
      docs.push({
        path: typeof d.path === "string" ? d.path : null,
        markdown: typeof d.markdown === "string" ? d.markdown : "",
        dirty: Boolean(d.dirty),
        scrollTop: Number(d.scrollTop) || 0,
      });
    }
    const active = Number(parsed.active);
    return {
      active: Number.isInteger(active) && active >= 0 && active < docs.length ? active : 0,
      docs,
    };
  } catch {
    return null;
  }
}
