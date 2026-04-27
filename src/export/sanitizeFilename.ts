const MAX_LENGTH = 64;

export function sanitizeFilename(raw: string, fallback = 'untitled'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function timestampStamp(date: Date = new Date()): string {
  // ISO without separators, second precision: e.g. 20260427120530
  return date
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
}

export function buildExportFilename(
  baseName: string,
  identifier: string | null | undefined,
  ext: 'pdf' | 'png' | 'json',
  date: Date = new Date(),
): string {
  const safeBase = sanitizeFilename(baseName);
  const safeId = identifier && identifier.length > 0 ? sanitizeFilename(identifier) : 'project';
  return `${safeBase}_${safeId}_${timestampStamp(date)}.${ext}`;
}
