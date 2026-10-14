import { describe, expect, it } from "vitest";
import { parseSession, serializeSession } from "./session";

describe("serializeSession / parseSession", () => {
  it("round-trips a valid session", () => {
    const json = serializeSession(1, [
      { path: null, markdown: "# hello", dirty: false, scrollTop: 0 },
      { path: "C:\\docs\\a.md", markdown: "content", dirty: true, scrollTop: 120 },
    ]);
    const session = parseSession(json);
    expect(session).not.toBeNull();
    expect(session?.active).toBe(1);
    expect(session?.docs.length).toBe(2);
    expect(session?.docs[1]).toEqual({
      path: "C:\\docs\\a.md",
      markdown: "content",
      dirty: true,
      scrollTop: 120,
    });
  });

  it("returns null for null input", () => {
    expect(parseSession(null)).toBeNull();
  });

  it("returns null for malformed json", () => {
    expect(parseSession("{not json")).toBeNull();
  });

  it("returns null when docs is empty or missing", () => {
    expect(parseSession('{"active":0,"docs":[]}')).toBeNull();
    expect(parseSession('{"active":0}')).toBeNull();
  });

  it("coerces invalid doc fields", () => {
    const session = parseSession(
      '{"active":5,"docs":[{"path":42,"markdown":null,"dirty":"yes","scrollTop":"abc"}]}',
    );
    expect(session).not.toBeNull();
    expect(session?.active).toBe(0);
    expect(session?.docs[0].path).toBeNull();
    expect(session?.docs[0].markdown).toBe("");
    expect(session?.docs[0].dirty).toBe(true);
    expect(session?.docs[0].scrollTop).toBe(0);
  });
});
