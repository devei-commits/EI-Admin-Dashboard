import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  addSharedQualitySpec,
  getSharedQualitySpecs,
} from '../masterSharedQualitySpecs';
import {
  collectNewlyHiddenSharedParameters,
  mergeSharedAndItemQualitySpecRows,
} from '../qualitySpecSharedMerge';
import { createEmptyQualitySpecRow } from '../../types/qualitySpecTable';

const STORAGE_KEY = 'ei-master-shared-quality-specs';

function mockLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('window', { localStorage });
}

describe('qualitySpecSharedMerge', () => {
  beforeEach(() => {
    mockLocalStorage();
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('merges shared parameters into item display and lets item override values', () => {
    const shared = [
      createEmptyQualitySpecRow({ parameter: 'abc', specLimit: '1', custom: true }),
    ];
    const item = [
      createEmptyQualitySpecRow({ parameter: 'abc', specLimit: '2', custom: true }),
      createEmptyQualitySpecRow({ parameter: 'local only', custom: true }),
    ];
    const merged = mergeSharedAndItemQualitySpecRows(shared, item, []);
    expect(merged.map((r) => r.parameter)).toEqual(['abc', 'local only']);
    expect(merged.find((r) => r.parameter === 'abc')?.specLimit).toBe('2');
  });

  it('hides shared parameters per item without removing from shared store', () => {
    addSharedQualitySpec(
      'RM',
      'common',
      'Actives',
      createEmptyQualitySpecRow({ parameter: 'abc', custom: true })
    );
    const shared = getSharedQualitySpecs('RM', 'common', 'Actives');
    const merged = mergeSharedAndItemQualitySpecRows(shared, [], ['abc']);
    expect(merged).toHaveLength(0);
    expect(getSharedQualitySpecs('RM', 'common', 'Actives')).toHaveLength(1);
  });

  it('collects hidden keys only for shared parameters that were removed', () => {
    addSharedQualitySpec(
      'RM',
      'common',
      'Actives',
      createEmptyQualitySpecRow({ parameter: 'abc', custom: true })
    );
    addSharedQualitySpec(
      'RM',
      'common',
      'Actives',
      createEmptyQualitySpecRow({ parameter: 'xyz', custom: true })
    );
    const prev = [
      createEmptyQualitySpecRow({ parameter: 'abc', custom: true }),
      createEmptyQualitySpecRow({ parameter: 'xyz', custom: true }),
      createEmptyQualitySpecRow({ parameter: 'item only', custom: true }),
    ];
    const next = [createEmptyQualitySpecRow({ parameter: 'item only', custom: true })];
    const hidden = collectNewlyHiddenSharedParameters('RM', 'common', 'Actives', prev, next);
    expect(hidden.sort()).toEqual(['abc', 'xyz']);
  });
});
