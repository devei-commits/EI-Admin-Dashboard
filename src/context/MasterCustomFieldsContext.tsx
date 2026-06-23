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
  addCustomField,
  getCustomFieldsForModule,
  loadEntityCustomFields,
  mergeEntityCustomFields,
  removeCustomField,
  subscribeMasterCustomFields,
  type MasterCustomFieldDef,
  type MasterCustomFieldModuleCode,
  type MasterCustomFieldsEntity,
} from '../lib/masterCustomFields';

type MasterCustomFieldsContextValue = {
  entity: MasterCustomFieldsEntity;
  taxonomyKey: string;
  version: number;
  getFields: (moduleCode: MasterCustomFieldModuleCode) => MasterCustomFieldDef[];
  addField: (
    moduleCode: MasterCustomFieldModuleCode,
    field: MasterCustomFieldDef
  ) => { ok: true } | { ok: false; reason: 'empty-label' | 'duplicate' };
  removeField: (moduleCode: MasterCustomFieldModuleCode, fieldId: string) => void;
  importFields: (
    incoming: Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>> | null | undefined
  ) => void;
  exportFields: () => Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>>;
};

const MasterCustomFieldsContext = createContext<MasterCustomFieldsContextValue | null>(null);

export type MasterCustomFieldsProviderProps = {
  entity: MasterCustomFieldsEntity;
  taxonomyKey: string;
  children: ReactNode;
};

export function MasterCustomFieldsProvider({
  entity,
  taxonomyKey,
  children,
}: MasterCustomFieldsProviderProps): React.ReactElement {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => subscribeMasterCustomFields(bump), [bump]);

  const getFields = useCallback(
    (moduleCode: MasterCustomFieldModuleCode) =>
      getCustomFieldsForModule(entity, taxonomyKey, moduleCode),
    [entity, taxonomyKey, version]
  );

  const addFieldFn = useCallback(
    (moduleCode: MasterCustomFieldModuleCode, field: MasterCustomFieldDef) => {
      const result = addCustomField(entity, taxonomyKey, moduleCode, field);
      if (result.ok) bump();
      return result;
    },
    [entity, taxonomyKey, bump]
  );

  const removeFieldFn = useCallback(
    (moduleCode: MasterCustomFieldModuleCode, fieldId: string) => {
      removeCustomField(entity, taxonomyKey, moduleCode, fieldId);
      bump();
    },
    [entity, taxonomyKey, bump]
  );

  const importFields = useCallback(
    (
      incoming: Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>> | null | undefined
    ) => {
      mergeEntityCustomFields(entity, incoming);
      bump();
    },
    [entity, bump]
  );

  const exportFields = useCallback(() => loadEntityCustomFields(entity), [entity, version]);

  const value = useMemo(
    () => ({
      entity,
      taxonomyKey,
      version,
      getFields,
      addField: addFieldFn,
      removeField: removeFieldFn,
      importFields,
      exportFields,
    }),
    [entity, taxonomyKey, version, getFields, addFieldFn, removeFieldFn, importFields, exportFields]
  );

  return (
    <MasterCustomFieldsContext.Provider value={value}>{children}</MasterCustomFieldsContext.Provider>
  );
}

export function useMasterCustomFields(): MasterCustomFieldsContextValue {
  const ctx = useContext(MasterCustomFieldsContext);
  if (!ctx) {
    throw new Error('useMasterCustomFields must be used within MasterCustomFieldsProvider');
  }
  return ctx;
}

export function useOptionalMasterCustomFields(): MasterCustomFieldsContextValue | null {
  return useContext(MasterCustomFieldsContext);
}
