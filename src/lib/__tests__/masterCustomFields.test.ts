import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCustomField,
  buildMasterCustomFieldsTaxonomyKey,
  createCustomFieldId,
  customFieldFormKey,
  getCustomFieldsForModule,
  loadEntityCustomFields,
  mergeEntityCustomFields,
  pmCustomFieldsModuleCode,
  removeCustomField,
  supportsCustomFieldButton,
} from '../masterCustomFields';

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

describe('masterCustomFields', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('builds taxonomy key like HTML customKey()', () => {
    expect(buildMasterCustomFieldsTaxonomyKey('PPM', 'BOTTLES', 'PET')).toBe('PPM|BOTTLES|PET');
    expect(buildMasterCustomFieldsTaxonomyKey('', '', '')).toBe('_|_|_');
  });

  it('stores custom fields per entity, taxonomy, and module code', () => {
    const key = buildMasterCustomFieldsTaxonomyKey('PPM', 'BOTTLES', 'PET');
    const id = createCustomFieldId();
    const result = addCustomField('PM', key, 'TECH', {
      id,
      label: 'Neck torque',
      type: 'text',
      required: true,
    });
    expect(result.ok).toBe(true);
    expect(getCustomFieldsForModule('PM', key, 'TECH')).toHaveLength(1);
    expect(customFieldFormKey(id)).toBe(`masterCustomField__${id}`);
  });

  it('rejects duplicate labels in the same module', () => {
    const key = buildMasterCustomFieldsTaxonomyKey('RAW', 'EMULSIFIERS', 'O/W');
    addCustomField('RM', key, 'TECH', { id: 'a', label: 'Viscosity', type: 'number' });
    const dup = addCustomField('RM', key, 'TECH', { id: 'b', label: 'viscosity', type: 'text' });
    expect(dup.ok).toBe(false);
  });

  it('merges incoming definitions from form_data', () => {
    const key = buildMasterCustomFieldsTaxonomyKey('PPM', 'TUBES', '—');
    mergeEntityCustomFields('PM', {
      [key]: {
        ART: [{ id: 'art-1', label: 'Foil band', type: 'select', options: ['Gold', 'Silver'] }],
      },
    });
    expect(getCustomFieldsForModule('PM', key, 'ART')[0]?.label).toBe('Foil band');
    expect(loadEntityCustomFields('PM')[key]?.ART).toHaveLength(1);
  });

  it('removes custom field definitions', () => {
    const key = buildMasterCustomFieldsTaxonomyKey('PPM', 'JARS', '');
    addCustomField('PM', key, 'TECH', { id: 'rm-1', label: 'Wall gauge', type: 'text' });
    removeCustomField('PM', key, 'TECH', 'rm-1');
    expect(getCustomFieldsForModule('PM', key, 'TECH')).toHaveLength(0);
  });

  it('maps module slugs to HTML module codes', () => {
    expect(pmCustomFieldsModuleCode('dimensions')).toBe('TECH');
    expect(pmCustomFieldsModuleCode('material')).toBe('TECH');
    expect(pmCustomFieldsModuleCode('aesthetics')).toBe('ART');
    expect(pmCustomFieldsModuleCode('quality')).toBe('QUAL');
    expect(pmCustomFieldsModuleCode('technical')).toBe('TECH');
    expect(pmCustomFieldsModuleCode('regulatory')).toBe('REG');
    expect(supportsCustomFieldButton('TECH')).toBe(true);
    expect(supportsCustomFieldButton('REG')).toBe(true);
    expect(supportsCustomFieldButton('SPEC')).toBe(true);
    expect(supportsCustomFieldButton('QUAL')).toBe(false);
  });
});
