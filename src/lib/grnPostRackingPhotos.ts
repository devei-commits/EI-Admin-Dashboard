import type { GeneratedLabel } from '../services/grn.service';
import type { InboundGrnPostRackingPhotosMeta } from './inboundGrnSourceDocs';

export type PostRackingRackTarget = {
  rackCode: string;
  /** Display label e.g. MW · Rack-D08-A1 */
  displayLabel: string;
};

function parseRackFromQrPayload(payload: string | undefined): string {
  if (!payload) return '';
  try {
    const p = JSON.parse(payload) as {
      toRack?: string;
      rack?: string;
      location_prefix?: string;
    };
    return String(p.toRack ?? p.rack ?? p.location_prefix ?? '').trim();
  } catch {
    return '';
  }
}

/** Unique rack codes assigned on this GRN (labels + saved location prefix). */
export function extractPostRackingRackTargets(input: {
  locationPrefix?: string | null;
  locationZone?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
  lineItems?: Array<{ generatedLabels?: GeneratedLabel[] | null }> | null;
  warehouseCode?: string | null;
}): PostRackingRackTarget[] {
  const warehouse = String(input.warehouseCode ?? 'MW').trim() || 'MW';
  const codes = new Set<string>();
  const add = (code: string | null | undefined): void => {
    const c = String(code ?? '').trim();
    if (c) codes.add(c);
  };

  add(input.locationPrefix);

  const labelSets = [
    ...(input.generatedLabels ?? []),
    ...(input.lineItems ?? []).flatMap((li) => li.generatedLabels ?? []),
  ];
  for (const label of labelSets) {
    add(parseRackFromQrPayload(label.qrPayload));
  }

  return [...codes]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((rackCode) => ({
      rackCode,
      displayLabel: `${warehouse} · Rack-${rackCode.replace(/^Rack-/i, '')}`,
    }));
}

export function savedPostRackingPhotoCount(
  meta: InboundGrnPostRackingPhotosMeta | null | undefined,
  rackCode: string,
): number {
  const count = meta?.byRack?.[rackCode]?.photoCount;
  return typeof count === 'number' && count >= 0 ? count : 0;
}

export function buildPostRackingPhotosMeta(
  photosByRack: Record<string, { length: number }>,
): InboundGrnPostRackingPhotosMeta {
  const byRack: InboundGrnPostRackingPhotosMeta['byRack'] = {};
  const now = new Date().toISOString();
  for (const [rackCode, photos] of Object.entries(photosByRack)) {
    const code = String(rackCode).trim();
    if (!code) continue;
    byRack[code] = { photoCount: photos.length, updatedAt: now };
  }
  return { byRack };
}

export function buildPostRackingPhotoStatusMessage(
  racks: PostRackingRackTarget[],
  photosByRack: Record<string, { length: number }>,
  savedMeta?: InboundGrnPostRackingPhotosMeta | null,
): string {
  if (racks.length === 0) {
    return 'Select rack location(s) above, then upload at least one photo per rack.';
  }

  const rackChecks = racks.map((rack) => {
    const live = photosByRack[rack.rackCode]?.length ?? 0;
    const saved = savedPostRackingPhotoCount(savedMeta, rack.rackCode);
    const total = live > 0 ? live : saved;
    const shortCode = rack.rackCode.replace(/^Rack-/i, '');
    return { shortCode, total, ok: total >= 1 };
  });

  const totalPhotos = rackChecks.reduce((sum, r) => sum + r.total, 0);
  const rackPart = rackChecks.map((r) => (r.ok ? `✓ Rack ${r.shortCode}` : `○ Rack ${r.shortCode}`)).join(' ');
  return `${rackPart} + ${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} uploaded · min 1 per rack required`;
}

export function postRackingPhotoBlockers(
  racks: PostRackingRackTarget[],
  photosByRack: Record<string, { length: number }>,
  savedMeta?: InboundGrnPostRackingPhotosMeta | null,
): string[] {
  if (racks.length === 0) {
    return ['Rack location is required before completing GRN.'];
  }
  const missing = racks.filter((rack) => {
    const live = photosByRack[rack.rackCode]?.length ?? 0;
    const saved = savedPostRackingPhotoCount(savedMeta, rack.rackCode);
    return live < 1 && saved < 1;
  });
  if (missing.length === 0) return [];
  return [`Post-racking photo required for: ${missing.map((r) => r.rackCode).join(', ')}.`];
}
