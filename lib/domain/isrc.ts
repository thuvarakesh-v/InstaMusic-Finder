const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;

export function normalizeIsrc(value: string): string | null {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^isrc:/i, "");

  if (/^isrc:/i.test(withoutPrefix)) {
    return null;
  }

  const normalized = withoutPrefix.replace(/[\s-]/g, "").toUpperCase();
  return ISRC_PATTERN.test(normalized) ? normalized : null;
}

export function formatInstagramSearch(value: string): string {
  const normalized = normalizeIsrc(value);
  if (!normalized) {
    throw new Error("INVALID_ISRC");
  }
  return `isrc:${normalized}`;
}
