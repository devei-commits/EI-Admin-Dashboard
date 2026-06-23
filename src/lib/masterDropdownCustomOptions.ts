export type MasterDropdownEntity = 'RM' | 'PM';

const STORAGE_KEY = 'ei-master-custom-dropdown-options';

export type MasterCustomDropdownStore = Record<MasterDropdownEntity, Record<string, string[]>>;

function emptyStore(): MasterCustomDropdownStore {
  return { RM: {}, PM: {} };
}

function readStore(): MasterCustomDropdownStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const obj = parsed as Partial<MasterCustomDropdownStore>;
    return {
      RM: { ...(obj.RM ?? {}) },
      PM: { ...(obj.PM ?? {}) },
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: MasterCustomDropdownStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const listeners = new Set<() => void>();

export function subscribeMasterDropdownOptions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMasterDropdownOptionsChanged(): void {
  for (const listener of listeners) listener();
}

export function normDropdownOption(raw: string): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

export function getCustomOptionsForField(
  entity: MasterDropdownEntity,
  fieldLabel: string
): string[] {
  const key = fieldLabel.trim();
  if (!key) return [];
  return [...(readStore()[entity][key] ?? [])];
}

export function setCustomOptionsForField(
  entity: MasterDropdownEntity,
  fieldLabel: string,
  options: string[]
): void {
  const key = fieldLabel.trim();
  if (!key) return;
  const store = readStore();
  const cleaned = options.map(normDropdownOption).filter(Boolean);
  if (cleaned.length === 0) {
    delete store[entity][key];
  } else {
    store[entity][key] = cleaned;
  }
  writeStore(store);
  notifyMasterDropdownOptionsChanged();
}

export function addCustomDropdownOption(
  entity: MasterDropdownEntity,
  fieldLabel: string,
  option: string
): { ok: true; option: string } | { ok: false; reason: 'empty' | 'duplicate' } {
  const value = normDropdownOption(option);
  if (!value) return { ok: false, reason: 'empty' };
  const key = fieldLabel.trim();
  if (!key) return { ok: false, reason: 'empty' };
  const store = readStore();
  const existing = store[entity][key] ?? [];
  if (existing.some((o) => o.toLowerCase() === value.toLowerCase())) {
    return { ok: false, reason: 'duplicate' };
  }
  store[entity][key] = [...existing, value];
  writeStore(store);
  notifyMasterDropdownOptionsChanged();
  return { ok: true, option: value };
}

export function removeCustomDropdownOption(
  entity: MasterDropdownEntity,
  fieldLabel: string,
  option: string
): void {
  const key = fieldLabel.trim();
  if (!key) return;
  const store = readStore();
  const existing = store[entity][key] ?? [];
  const next = existing.filter((o) => o !== option);
  if (next.length === 0) delete store[entity][key];
  else store[entity][key] = next;
  writeStore(store);
  notifyMasterDropdownOptionsChanged();
}

export function mergeDropdownOptions(
  base: readonly string[],
  entity: MasterDropdownEntity,
  fieldLabel: string,
  currentValue?: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (opt: string) => {
    const v = normDropdownOption(opt);
    if (!v) return;
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };
  for (const opt of base) add(opt);
  for (const opt of getCustomOptionsForField(entity, fieldLabel)) add(opt);
  const cur = normDropdownOption(currentValue ?? '');
  if (cur) add(cur);
  return out;
}

export function loadEntityCustomDropdownOptions(
  entity: MasterDropdownEntity
): Record<string, string[]> {
  return { ...readStore()[entity] };
}

export function mergeEntityCustomDropdownOptions(
  entity: MasterDropdownEntity,
  incoming: Record<string, string[] | undefined> | null | undefined
): void {
  if (!incoming || typeof incoming !== 'object') return;
  const store = readStore();
  const bucket = { ...store[entity] };
  for (const [fieldLabel, opts] of Object.entries(incoming)) {
    if (!Array.isArray(opts)) continue;
    const merged = new Set<string>();
    for (const o of [...(bucket[fieldLabel] ?? []), ...opts]) {
      const v = normDropdownOption(o);
      if (v) merged.add(v);
    }
    if (merged.size === 0) delete bucket[fieldLabel];
    else bucket[fieldLabel] = [...merged];
  }
  store[entity] = bucket;
  writeStore(store);
  notifyMasterDropdownOptionsChanged();
}
