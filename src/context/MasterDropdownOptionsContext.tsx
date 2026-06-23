import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addCustomDropdownOption,
  getCustomOptionsForField,
  loadEntityCustomDropdownOptions,
  mergeDropdownOptions,
  mergeEntityCustomDropdownOptions,
  normDropdownOption,
  removeCustomDropdownOption,
  subscribeMasterDropdownOptions,
  type MasterDropdownEntity,
} from '../lib/masterDropdownCustomOptions';

type MasterDropdownOptionsContextValue = {
  entity: MasterDropdownEntity;
  version: number;
  getMergedOptions: (fieldLabel: string, base: readonly string[], currentValue?: string) => string[];
  getCustomOptions: (fieldLabel: string) => string[];
  addOption: (fieldLabel: string, option: string) => { ok: true; option: string } | { ok: false; reason: 'empty' | 'duplicate' };
  removeOption: (fieldLabel: string, option: string) => void;
  importOptions: (incoming: Record<string, string[] | undefined> | null | undefined) => void;
  exportOptions: () => Record<string, string[]>;
};

const MasterDropdownOptionsContext = createContext<MasterDropdownOptionsContextValue | null>(null);

export type MasterDropdownOptionsProviderProps = {
  entity: MasterDropdownEntity;
  children: ReactNode;
};

export function MasterDropdownOptionsProvider({
  entity,
  children,
}: MasterDropdownOptionsProviderProps): JSX.Element {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => subscribeMasterDropdownOptions(bump), [bump]);

  const getMergedOptions = useCallback(
    (fieldLabel: string, base: readonly string[], currentValue?: string) =>
      mergeDropdownOptions(base, entity, fieldLabel, currentValue),
    [entity, version]
  );

  const getCustomOptions = useCallback(
    (fieldLabel: string) => getCustomOptionsForField(entity, fieldLabel),
    [entity, version]
  );

  const addOption = useCallback(
    (fieldLabel: string, option: string) => {
      const result = addCustomDropdownOption(entity, fieldLabel, option);
      if (result.ok) bump();
      return result;
    },
    [entity, bump]
  );

  const removeOption = useCallback(
    (fieldLabel: string, option: string) => {
      removeCustomDropdownOption(entity, fieldLabel, option);
      bump();
    },
    [entity, bump]
  );

  const importOptions = useCallback(
    (incoming: Record<string, string[] | undefined> | null | undefined) => {
      mergeEntityCustomDropdownOptions(entity, incoming);
      bump();
    },
    [entity, bump]
  );

  const exportOptions = useCallback(() => loadEntityCustomDropdownOptions(entity), [entity, version]);

  const value = useMemo(
    () => ({
      entity,
      version,
      getMergedOptions,
      getCustomOptions,
      addOption,
      removeOption,
      importOptions,
      exportOptions,
    }),
    [entity, version, getMergedOptions, getCustomOptions, addOption, removeOption, importOptions, exportOptions]
  );

  return (
    <MasterDropdownOptionsContext.Provider value={value}>
      {children}
    </MasterDropdownOptionsContext.Provider>
  );
}

export function useMasterDropdownOptions(): MasterDropdownOptionsContextValue {
  const ctx = useContext(MasterDropdownOptionsContext);
  if (!ctx) {
    throw new Error('useMasterDropdownOptions must be used within MasterDropdownOptionsProvider');
  }
  return ctx;
}

export function useOptionalMasterDropdownOptions(): MasterDropdownOptionsContextValue | null {
  return useContext(MasterDropdownOptionsContext);
}

export { normDropdownOption };
