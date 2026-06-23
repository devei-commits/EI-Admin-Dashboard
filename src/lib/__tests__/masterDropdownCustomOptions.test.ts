import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCustomDropdownOption,
  getCustomOptionsForField,
  mergeDropdownOptions,
  mergeEntityCustomDropdownOptions,
  removeCustomDropdownOption,
} from '../masterDropdownCustomOptions';

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

describe('masterDropdownCustomOptions', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('adds and merges custom options with built-in list', () => {
    addCustomDropdownOption('RM', 'Grade', 'Lab grade');
    expect(getCustomOptionsForField('RM', 'Grade')).toEqual(['Lab grade']);
    expect(mergeDropdownOptions(['Cosmetic', 'IP'], 'RM', 'Grade')).toEqual([
      'Cosmetic',
      'IP',
      'Lab grade',
    ]);
  });

  it('rejects duplicate custom options', () => {
    addCustomDropdownOption('PM', 'Material', 'Bio-resin');
    const dup = addCustomDropdownOption('PM', 'Material', 'bio-resin');
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe('duplicate');
  });

  it('removes custom options', () => {
    addCustomDropdownOption('RM', 'State', 'Gel');
    removeCustomDropdownOption('RM', 'State', 'Gel');
    expect(getCustomOptionsForField('RM', 'State')).toEqual([]);
  });

  it('hydrates from saved form_data map', () => {
    mergeEntityCustomDropdownOptions('PM', {
      'Closure Type': ['Magnetic snap'],
    });
    expect(getCustomOptionsForField('PM', 'Closure Type')).toEqual(['Magnetic snap']);
  });
});
