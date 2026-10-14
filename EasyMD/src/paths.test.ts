import { describe, expect, it } from "vitest";
import { normalizeDocumentPath, sameDocumentPath } from "./paths";

describe("document paths", () => {
  it("treats Windows separators and letter case as equivalent", () => {
    expect(normalizeDocumentPath("C:\\Docs\\Note.md")).toBe("c:\\docs\\note.md");
    expect(sameDocumentPath("C:/Docs/Note.md", "c:\\DOCS\\NOTE.md")).toBe(true);
  });

  it("removes the Windows extended-length prefix for comparison", () => {
    expect(sameDocumentPath("\\\\?\\C:\\Docs\\Note.md", "C:\\Docs\\Note.md")).toBe(true);
  });

  it("keeps non-Windows paths case sensitive", () => {
    expect(sameDocumentPath("/Docs/Note.md", "/docs/Note.md")).toBe(false);
  });
});
