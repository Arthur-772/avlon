export function normalizeDocumentPath(path: string): string {
  const normalized = path.trim().replace(/\//g, "\\");
  const withoutNamespace = normalized.startsWith("\\\\?\\")
    ? normalized.slice(4)
    : normalized;

  const isWindowsPath =
    /^[a-zA-Z]:/.test(withoutNamespace) || withoutNamespace.startsWith("\\\\");
  return isWindowsPath ? withoutNamespace.toLowerCase() : withoutNamespace;
}

export function sameDocumentPath(a: string, b: string): boolean {
  return normalizeDocumentPath(a) === normalizeDocumentPath(b);
}
