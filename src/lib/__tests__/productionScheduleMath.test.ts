/**
 * Unit and integration tests for production schedule recommendation math.
 * Run: npm run test:run (or npm run test for watch).
 */
import { describe, it, expect } from 'vitest';
import {
  addDaysToDateStr,
  deriveScheduleDatesFromMfg,
  getBatchVolumeLiters,
  getCompatibleVesselIds,
  isEquipmentFreeOnDate,
  getFirstFreeEquipment,
  getEquipDisplayName,
  getCompatibleFillLineIds,
  getCompatiblePackLineIds,
  isBatchMaterialsAvailable,
  computeBestScheduleRecommendation,
  computeRecommendedScheduleForSlot,
  computeRmVolumeBreakdown,
  computeVolumeFromBomRmLines,
  type BatchForScheduleLike,
  type BatchWithDispensingLike,
  type ScheduledBatchLike,
  type EquipmentLike,
  type ScheduleSlotLike,
} from '../productionScheduleMath';

describe('addDaysToDateStr', () => {
  it('returns empty string for falsy dateStr', () => {
    expect(addDaysToDateStr('', 1)).toBe('');
  });

  it('adds positive days', () => {
    expect(addDaysToDateStr('2026-03-15', 3)).toBe('2026-03-18');
    expect(addDaysToDateStr('2026-03-31', 1)).toBe('2026-04-01');
  });

  it('subtracts with negative n', () => {
    expect(addDaysToDateStr('2026-03-15', -2)).toBe('2026-03-13');
    expect(addDaysToDateStr('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('returns same date for n=0', () => {
    expect(addDaysToDateStr('2026-03-15', 0)).toBe('2026-03-15');
  });
});

describe('deriveScheduleDatesFromMfg', () => {
  it('derives fill +3, pack +4, fg +5, rm -2, pm from fill-2', () => {
    const r = deriveScheduleDatesFromMfg('2026-03-15');
    expect(r.fillDate).toBe('2026-03-18');
    expect(r.packDate).toBe('2026-03-19');
    expect(r.fgDate).toBe('2026-03-20');
    expect(r.rmConnectDate).toBe('2026-03-13');
    expect(r.pmConnectDate).toBe('2026-03-16');
  });
});

describe('getBatchVolumeLiters', () => {
  it('uses requiredVolumeLiters when set', () => {
    expect(getBatchVolumeLiters({ batchSize: 500, requiredVolumeLiters: 280 })).toBe(280);
  });

  it('falls back to batchSize when requiredVolumeLiters null/undefined', () => {
    expect(getBatchVolumeLiters({ batchSize: 500 })).toBe(500);
    expect(getBatchVolumeLiters({ batchSize: 500, requiredVolumeLiters: null })).toBe(500);
  });
});

describe('getCompatibleVesselIds', () => {
  const manufacturing: EquipmentLike['manufacturing'] = [
    { id: 'MV-01', name: 'Vessel 1', cap: 500, type: 'jacketed' },
    { id: 'MV-02', name: 'Vessel 2', cap: 200, type: 'jacketed' },
    { id: 'ST-01', name: 'Support Tank', cap: 1000, type: 'support' },
  ];

  it('returns compatibleVessels when batch has them', () => {
    const batch: BatchForScheduleLike = {
      batchSize: 300,
      compatibleVessels: ['MV-01'],
    };
    expect(getCompatibleVesselIds(batch, manufacturing)).toEqual(['MV-01']);
  });

  it('filters by cap >= batch volume and type !== support', () => {
    const batch: BatchForScheduleLike = { batchSize: 300 };
    expect(getCompatibleVesselIds(batch, manufacturing)).toEqual(['MV-01']);
  });

  it('uses requiredVolumeLiters for volume when set', () => {
    const batch: BatchForScheduleLike = { batchSize: 500, requiredVolumeLiters: 250 };
    expect(getCompatibleVesselIds(batch, manufacturing)).toEqual(['MV-01']);
  });

  it('excludes support type even if cap is enough', () => {
    const batch: BatchForScheduleLike = { batchSize: 100 };
    expect(getCompatibleVesselIds(batch, manufacturing)).not.toContain('ST-01');
  });
});

describe('isEquipmentFreeOnDate', () => {
  const batches: ScheduledBatchLike[] = [
    { mainVessel: 'MV-01', mfgDate: '2026-03-15' },
    { fillingLine: 'FL-01', fillDate: '2026-03-18' },
    { packagingLine: 'PL-01', packDate: '2026-03-19' },
  ];

  it('returns false when vessel is used on that date', () => {
    expect(isEquipmentFreeOnDate(batches, 'MV-01', '2026-03-15')).toBe(false);
  });

  it('returns true when vessel is not used on that date', () => {
    expect(isEquipmentFreeOnDate(batches, 'MV-01', '2026-03-16')).toBe(true);
    expect(isEquipmentFreeOnDate(batches, 'MV-02', '2026-03-15')).toBe(true);
  });

  it('returns false for fill line on fill date', () => {
    expect(isEquipmentFreeOnDate(batches, 'FL-01', '2026-03-18')).toBe(false);
  });

  it('returns false for pack line on pack date', () => {
    expect(isEquipmentFreeOnDate(batches, 'PL-01', '2026-03-19')).toBe(false);
  });
});

describe('getFirstFreeEquipment', () => {
  const batches: ScheduledBatchLike[] = [
    { mainVessel: 'MV-01', mfgDate: '2026-03-15' },
  ];

  it('returns first free id in list', () => {
    expect(getFirstFreeEquipment(['MV-02', 'MV-01'], '2026-03-15', batches)).toBe('MV-02');
  });

  it('returns second when first is busy', () => {
    expect(getFirstFreeEquipment(['MV-01', 'MV-02'], '2026-03-15', batches)).toBe('MV-02');
  });

  it('returns first id when list has one and it is free', () => {
    expect(getFirstFreeEquipment(['MV-02'], '2026-03-15', batches)).toBe('MV-02');
  });

  it('returns empty string for empty list', () => {
    expect(getFirstFreeEquipment([], '2026-03-15', batches)).toBe('');
  });
});

describe('getEquipDisplayName', () => {
  const equipment: EquipmentLike = {
    manufacturing: [{ id: 'MV-01', name: 'Main Vessel 1' }],
    filling: [{ id: 'FL-01', name: 'Filling Line 1', compatible: ['bottle'] }],
    packaging: [{ id: 'PL-01', name: 'Pack Line 1' }],
  };

  it('returns name when found', () => {
    expect(getEquipDisplayName(equipment, 'MV-01', 'mfg')).toBe('Main Vessel 1');
    expect(getEquipDisplayName(equipment, 'FL-01', 'fill')).toBe('Filling Line 1');
    expect(getEquipDisplayName(equipment, 'PL-01', 'pack')).toBe('Pack Line 1');
  });

  it('returns id when not found', () => {
    expect(getEquipDisplayName(equipment, 'MV-99', 'mfg')).toBe('MV-99');
  });
});

describe('getCompatibleFillLineIds', () => {
  const filling: EquipmentLike['filling'] = [
    { id: 'FL-01', compatible: ['bottle', 'tube'] },
    { id: 'FL-02', compatible: ['jar'] },
  ];

  it('returns compatibleFillLines when batch has them', () => {
    const batch: BatchForScheduleLike = { batchSize: 100, compatibleFillLines: ['FL-02'] };
    expect(getCompatibleFillLineIds(batch, filling)).toEqual(['FL-02']);
  });

  it('filters by fillingType (default bottle)', () => {
    const batch: BatchForScheduleLike = { batchSize: 100 };
    expect(getCompatibleFillLineIds(batch, filling)).toEqual(['FL-01']);
  });

  it('filters by fillingType jar', () => {
    const batch: BatchForScheduleLike = { batchSize: 100, fillingType: 'jar' };
    expect(getCompatibleFillLineIds(batch, filling)).toEqual(['FL-02']);
  });
});

describe('getCompatiblePackLineIds', () => {
  const packaging: EquipmentLike['packaging'] = [
    { id: 'PL-01' },
    { id: 'PL-02' },
  ];

  it('returns compatiblePackLines when batch has them', () => {
    const batch: BatchForScheduleLike = { batchSize: 100, compatiblePackLines: ['PL-02'] };
    expect(getCompatiblePackLineIds(batch, packaging)).toEqual(['PL-02']);
  });

  it('returns all packaging when batch has no override', () => {
    const batch: BatchForScheduleLike = { batchSize: 100 };
    expect(getCompatiblePackLineIds(batch, packaging)).toEqual(['PL-01', 'PL-02']);
  });
});

describe('isBatchMaterialsAvailable', () => {
  it('returns true when batch has no dispensing lists', () => {
    const batch: BatchWithDispensingLike = {};
    expect(isBatchMaterialsAvailable(batch, {}, {})).toBe(true);
    expect(isBatchMaterialsAvailable(batch, { 'RM-1': 10 }, {})).toBe(true);
  });

  it('returns true when dispensingRM is empty and dispensingPM has stock', () => {
    const batch: BatchWithDispensingLike = { dispensingRM: [], dispensingPM: [{ code: 'PM-1', required: 5 }] };
    expect(isBatchMaterialsAvailable(batch, {}, { 'PM-1': 5 })).toBe(true);
    expect(isBatchMaterialsAvailable(batch, {}, { 'PM-1': 10 })).toBe(true);
  });

  it('returns false when RM required exceeds stock', () => {
    const batch: BatchWithDispensingLike = { dispensingRM: [{ code: 'RM-1', required: 10 }], dispensingPM: [] };
    expect(isBatchMaterialsAvailable(batch, { 'RM-1': 5 }, {})).toBe(false);
    expect(isBatchMaterialsAvailable(batch, {}, {})).toBe(false);
  });

  it('returns true when all RM and PM have sufficient stock', () => {
    const batch: BatchWithDispensingLike = {
      dispensingRM: [{ code: 'RM-A', required: 20 }, { code: 'RM-B', required: 5 }],
      dispensingPM: [{ code: 'PM-X', required: 100 }],
    };
    const stockRM = { 'RM-A': 20, 'RM-B': 10 };
    const stockPM = { 'PM-X': 100 };
    expect(isBatchMaterialsAvailable(batch, stockRM, stockPM)).toBe(true);
  });

  it('returns false when one PM is short', () => {
    const batch: BatchWithDispensingLike = {
      dispensingRM: [{ code: 'RM-A', required: 10 }],
      dispensingPM: [{ code: 'PM-X', required: 50 }, { code: 'PM-Y', required: 20 }],
    };
    const stockRM = { 'RM-A': 10 };
    const stockPM = { 'PM-X': 50, 'PM-Y': 10 };
    expect(isBatchMaterialsAvailable(batch, stockRM, stockPM)).toBe(false);
  });

  it('treats missing stock key as 0', () => {
    const batch: BatchWithDispensingLike = { dispensingRM: [{ code: 'RM-1', required: 1 }], dispensingPM: [] };
    expect(isBatchMaterialsAvailable(batch, {}, {})).toBe(false);
    expect(isBatchMaterialsAvailable(batch, { 'RM-1': 1 }, {})).toBe(true);
  });
});

describe('computeRmVolumeBreakdown', () => {
  it('returns empty lines and 0 total for empty items', () => {
    const r = computeRmVolumeBreakdown([]);
    expect(r.lines).toEqual([]);
    expect(r.totalVolumeL).toBe(0);
  });

  it('computes volume as kg / specificGravity, default SG 1', () => {
    const r = computeRmVolumeBreakdown([{ code: 'RM-1', required: 100 }]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toEqual({ code: 'RM-1', kg: 100, specificGravity: 1, volumeL: 100 });
    expect(r.totalVolumeL).toBe(100);
  });

  it('uses specificGravity when provided', () => {
    const r = computeRmVolumeBreakdown([{ code: 'Glycerin', required: 15, specificGravity: 1.26 }]);
    expect(r.lines[0].volumeL).toBe(Math.round((15 / 1.26) * 100) / 100);
    expect(r.totalVolumeL).toBe(r.lines[0].volumeL);
  });

  it('sums multiple RMs and rounds to 2 decimals', () => {
    const r = computeRmVolumeBreakdown([
      { code: 'A', required: 260, specificGravity: 1 },
      { code: 'B', required: 3.8, specificGravity: 1.26 },
    ]);
    expect(r.lines).toHaveLength(2);
    expect(r.totalVolumeL).toBe(Math.round((260 + 3.8 / 1.26) * 100) / 100);
  });
});

describe('computeVolumeFromBomRmLines', () => {
  it('returns null for zero or missing batchSizeKg', () => {
    expect(computeVolumeFromBomRmLines(0, [{ pct_w_w: 100, specific_gravity: 1 }])).toBeNull();
    expect(computeVolumeFromBomRmLines(0, [])).toBeNull();
  });

  it('returns null for empty or missing rmLines', () => {
    expect(computeVolumeFromBomRmLines(500, [])).toBeNull();
    expect(computeVolumeFromBomRmLines(500, null)).toBeNull();
    expect(computeVolumeFromBomRmLines(500, undefined)).toBeNull();
  });

  it('computes volume from pct_w_w and specific_gravity (same as backend)', () => {
    const rmLines = [{ pct_w_w: 100, specific_gravity: 1 }];
    expect(computeVolumeFromBomRmLines(500, rmLines)).toBe(500);
    const rmLines2 = [{ pct_w_w: 100, specific_gravity: 2 }];
    expect(computeVolumeFromBomRmLines(500, rmLines2)).toBe(250);
  });

  it('sums multiple lines and rounds to 2 decimals', () => {
    const rmLines = [
      { pct_w_w: 52.3, specific_gravity: 1.0 },
      { pct_w_w: 3, specific_gravity: 1.26 },
    ];
    const vol = computeVolumeFromBomRmLines(500, rmLines);
    expect(vol).toBe(Math.round(vol! * 100) / 100);
    expect(vol).toBeCloseTo(261.5 + 500 * 0.03 / 1.26, 1);
  });

  it('uses pct when pct_w_w missing', () => {
    expect(computeVolumeFromBomRmLines(500, [{ pct: 10, specific_gravity: 1 }])).toBe(50);
  });
});

describe('schedulable batches (integration)', () => {
  const stockRM: Record<string, number> = { 'RM-1': 100, 'RM-2': 50 };
  const stockPM: Record<string, number> = { 'PM-1': 200 };

  it('filters to unscheduled + materials-available batches for an SO', () => {
    const batches: (BatchWithDispensingLike & { soNo?: string; mfgDate?: string })[] = [
      { soNo: 'SO-001', mfgDate: '', dispensingRM: [{ code: 'RM-1', required: 50 }], dispensingPM: [] },
      { soNo: 'SO-001', mfgDate: '2026-03-20', dispensingRM: [{ code: 'RM-1', required: 10 }], dispensingPM: [] },
      { soNo: 'SO-001', mfgDate: '', dispensingRM: [{ code: 'RM-2', required: 100 }], dispensingPM: [] },
      { soNo: 'SO-001', mfgDate: '', dispensingRM: [], dispensingPM: [{ code: 'PM-1', required: 50 }] },
    ];
    const forSo = batches.filter(b => b.soNo === 'SO-001');
    const schedulable = forSo.filter(
      b => !b.mfgDate && isBatchMaterialsAvailable(b, stockRM, stockPM)
    );
    expect(schedulable.length).toBe(2);
    expect(schedulable.every(b => !b.mfgDate)).toBe(true);
    expect(schedulable.map(b => b.dispensingRM?.length ?? 0)).toEqual([1, 0]);
  });
});

describe('computeBestScheduleRecommendation (integration)', () => {
  const equipment: EquipmentLike = {
    manufacturing: [
      { id: 'MV-01', name: 'V1', cap: 500, type: 'jacketed' },
      { id: 'MV-02', name: 'V2', cap: 300, type: 'jacketed' },
    ],
    filling: [{ id: 'FL-01', name: 'F1', compatible: ['bottle'] }],
    packaging: [{ id: 'PL-01', name: 'P1' }],
  };

  it('returns a suggestion with first non-support vessel when no vessel fits by volume (fallback)', () => {
    const batch: BatchForScheduleLike = { batchSize: 1000, requiredVolumeLiters: 1000 };
    const result = computeBestScheduleRecommendation(batch, equipment, []);
    expect(result).not.toBeNull();
    expect(result!.vessel).toBe('MV-01');
  });

  it('returns earliest date when all equipment free', () => {
    const batch: BatchForScheduleLike = { batchSize: 200, requiredVolumeLiters: 150 };
    const fromDate = '2026-03-15';
    const result = computeBestScheduleRecommendation(batch, equipment, [], {
      fromDate,
      maxDays: 5,
    });
    expect(result).not.toBeNull();
    expect(result!.mfgDate).toBe(fromDate);
    expect(result!.vessel).toBe('MV-01');
    expect(result!.fillLine).toBe('FL-01');
    expect(result!.packLine).toBe('PL-01');
    expect(result!.fillDate).toBe('2026-03-18');
    expect(result!.packDate).toBe('2026-03-19');
    expect(result!.reasons.length).toBeGreaterThan(0);
    expect(result!.confidenceScore).toBeGreaterThanOrEqual(85);
  });

  it('skips dates when vessel is busy and returns next free', () => {
    const batch: BatchForScheduleLike = { batchSize: 200 };
    const scheduled: ScheduledBatchLike[] = [
      { mainVessel: 'MV-01', mfgDate: '2026-03-15' },
      { mainVessel: 'MV-02', mfgDate: '2026-03-15' },
    ];
    const fromDate = '2026-03-15';
    const result = computeBestScheduleRecommendation(batch, equipment, scheduled, {
      fromDate,
      maxDays: 3,
    });
    expect(result).not.toBeNull();
    expect(result!.mfgDate).toBe('2026-03-16');
  });

  it('uses batchSize when requiredVolumeLiters not set', () => {
    const batch: BatchForScheduleLike = { batchSize: 400 };
    const result = computeBestScheduleRecommendation(batch, equipment, [], {
      fromDate: '2026-03-15',
      maxDays: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.vessel).toBe('MV-01');
  });
});

describe('computeRecommendedScheduleForSlot (integration)', () => {
  const equipment: EquipmentLike = {
    manufacturing: [
      { id: 'MV-01', name: 'V1', cap: 500, type: 'jacketed' },
      { id: 'MV-02', name: 'V2', cap: 300, type: 'jacketed' },
    ],
    filling: [
      { id: 'FL-01', name: 'F1', compatible: ['bottle'] },
      { id: 'FL-02', name: 'F2', compatible: ['bottle'] },
    ],
    packaging: [{ id: 'PL-01', name: 'P1' }],
  };
  const batch: BatchForScheduleLike = { batchSize: 200, fillingType: 'bottle' };
  const scheduled: ScheduledBatchLike[] = [];

  it('slot mfg: uses slot date and vessel, picks first free fill/pack', () => {
    const slot: ScheduleSlotLike = {
      equipId: 'MV-01',
      category: 'mfg',
      dateIso: '2026-03-20',
    };
    const r = computeRecommendedScheduleForSlot(slot, batch, equipment, scheduled);
    expect(r.mfgDate).toBe('2026-03-20');
    expect(r.vessel).toBe('MV-01');
    expect(r.fillDate).toBe('2026-03-23');
    expect(r.packDate).toBe('2026-03-24');
    expect(r.fillLine).toBe('FL-01');
    expect(r.packLine).toBe('PL-01');
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('slot fill: back-computes mfg date, uses slot for fill', () => {
    const slot: ScheduleSlotLike = {
      equipId: 'FL-02',
      category: 'fill',
      dateIso: '2026-03-25',
    };
    const r = computeRecommendedScheduleForSlot(slot, batch, equipment, scheduled);
    expect(r.fillDate).toBe('2026-03-25');
    expect(r.fillLine).toBe('FL-02');
    expect(r.mfgDate).toBe('2026-03-22');
    expect(r.packDate).toBe('2026-03-26');
  });

  it('slot pack: back-computes mfg and fill, uses slot for pack', () => {
    const slot: ScheduleSlotLike = {
      equipId: 'PL-01',
      category: 'pack',
      dateIso: '2026-03-28',
    };
    const r = computeRecommendedScheduleForSlot(slot, batch, equipment, scheduled);
    expect(r.packDate).toBe('2026-03-28');
    expect(r.packLine).toBe('PL-01');
    expect(r.fillDate).toBe('2026-03-27');
    expect(r.mfgDate).toBe('2026-03-24');
  });
});
