import { describe, it, expect } from 'vitest';
import {
  getDispensingLineStatus,
  summarizeBatchDispensing,
  isBatchOnDispensingTray,
  batchMatchesDispensingTrayFilter,
  enrichDispensingTrayDetails,
  batchTrayContext,
  countDispensedTrayLines,
  getDispensingStageLabel,
  formatDispensingTrayTimestamp,
} from '../batchDispensingStatus';

describe('batchDispensingStatus', () => {
  it('classifies line status from done / dispensed qty', () => {
    expect(getDispensingLineStatus({ required: 10, dispensed: 0, done: false })).toBe('pending');
    expect(getDispensingLineStatus({ required: 10, dispensed: 5, done: false })).toBe('partial');
    expect(getDispensingLineStatus({ required: 10, dispensed: 0, done: true })).toBe('done');
  });

  it('counts dispensed tray lines including partial', () => {
    const lines = summarizeBatchDispensing(
      [
        { code: 'RM-1', required: 10, dispensed: 10, done: true },
        { code: 'RM-2', required: 5, dispensed: 2, done: false },
        { code: 'RM-3', required: 3, dispensed: 0, done: false },
      ],
      [],
    ).rmLines;
    expect(countDispensedTrayLines(lines)).toBe(2);
  });

  it('summarizes RM and PM progress with dispensed counts', () => {
    const summary = summarizeBatchDispensing(
      [
        { code: 'RM-1', required: 10, dispensed: 10, done: true },
        { code: 'RM-2', required: 5, dispensed: 2, done: false },
      ],
      [{ code: 'PM-1', required: 100, dispensed: 0, done: false }],
    );
    expect(summary.rm.dispensed).toBe(2);
    expect(summary.rm.total).toBe(2);
    expect(summary.rm.status).toBe('in_progress');
    expect(summary.pm.status).toBe('not_started');
  });

  it('builds tray detail with pending label or vessel slot', () => {
    const ctx = batchTrayContext({
      bmrNo: 'BMR-1',
      bprNo: 'BPR-1',
      productName: 'X',
      soNo: 'SO-1',
      batchNo: '07',
      mainVessel: 'SS-Drum-07',
      bmrStatus: 'dispensing',
      bprStatus: 'draft',
    });
    const pending = enrichDispensingTrayDetails(
      [{ code: 'RM-1', inci: 'Niacinamide', required: 6, dispensed: 0, done: false }],
      'rm',
      ctx,
    )[0];
    expect(pending.trayLabel).toBe('— · pending');
    expect(pending.statusText).toBe('pending');

    const done = enrichDispensingTrayDetails(
      [{
        code: 'RM-2',
        inci: 'Glycerin',
        required: 15,
        dispensed: 15,
        done: true,
        trayContainer: 'SS-Beaker-08',
        traySlot: '07/A',
        dispensedAt: '2026-06-05T10:42:00',
      }],
      'rm',
      ctx,
    )[0];
    expect(done.trayLabel).toBe('SS-Beaker-08 · 07/A');
    expect(done.statusText).toBe(`✓ ${formatDispensingTrayTimestamp('2026-06-05T10:42:00')}`);
  });

  it('includes batches with dispensing lines or connect status', () => {
    expect(isBatchOnDispensingTray({
      bmrNo: 'B-1',
      bprNo: 'P-1',
      productName: 'X',
      soNo: 'SO-1',
      batchNo: '01',
      bmrStatus: 'draft',
      bprStatus: 'draft',
      dispensingRM: [],
      dispensingPM: [],
    })).toBe(false);
    expect(isBatchOnDispensingTray({
      bmrNo: 'B-2',
      bprNo: 'P-2',
      productName: 'X',
      soNo: 'SO-1',
      batchNo: '01',
      bmrStatus: 'rm_connected',
      bprStatus: 'draft',
      dispensingRM: [],
      dispensingPM: [],
    })).toBe(true);
  });

  it('derives stage label for RM+PM dispensing', () => {
    const summary = summarizeBatchDispensing(
      [
        { code: 'RM-1', required: 1, dispensed: 1, done: true },
        { code: 'RM-2', required: 1, dispensed: 0, done: false },
      ],
      [{ code: 'PM-1', required: 1, dispensed: 0, done: false }],
    );
    expect(getDispensingStageLabel('dispensing', 'pm_dispensing', summary)).toBe('Dispense (RM+PM)');
  });

  it('filters by RM pending and complete', () => {
    const pending = summarizeBatchDispensing(
      [{ code: 'RM-1', required: 1, dispensed: 0, done: false }],
      [],
    );
    const complete = summarizeBatchDispensing(
      [{ code: 'RM-1', required: 1, dispensed: 1, done: true }],
      [],
    );
    expect(batchMatchesDispensingTrayFilter(pending, 'rm_pending')).toBe(true);
    expect(batchMatchesDispensingTrayFilter(complete, 'rm_pending')).toBe(false);
    expect(batchMatchesDispensingTrayFilter(complete, 'rm_done')).toBe(true);
  });
});
