const INDIA_OFFSET = '+05:30';

/**
 * Parse API / form timestamps for Planning SLA elapsed time.
 * - DATEONLY (YYYY-MM-DD): start of day in India (Asia/Kolkata)
 * - ISO with Z or offset: instant as stored
 * - Legacy "YYYY-MM-DD HH:mm:ss" from old FE (UTC wall clock, no Z): treat as UTC
 */
export function parsePlanningSlaTimestamp(raw: string | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const s = String(raw).trim();
  if (!s) return null;

  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const ts = Date.parse(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00${INDIA_OFFSET}`);
    return Number.isFinite(ts) ? new Date(ts) : null;
  }

  const legacyUtcSpace = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (legacyUtcSpace) {
    const ts = Date.parse(`${legacyUtcSpace[1]}-${legacyUtcSpace[2]}-${legacyUtcSpace[3]}T${legacyUtcSpace[4]}:${legacyUtcSpace[5]}:${legacyUtcSpace[6]}Z`);
    return Number.isFinite(ts) ? new Date(ts) : null;
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** ISO string for API writes (true instant, not UTC wall clock with missing Z). */
export function planningBomConfirmedAtIso(): string {
  return new Date().toISOString();
}
