import { PR_FACILITY_LICENCE_SLOT_DEFAULTS } from '../constants/prFacilityLicenceDefaults';
import type {
  PrFacilityCode,
  PrFacilityLicenceClearance,
  PrFacilityLicenceRecord,
} from '../types/prFacilityLicence';

function emptyLicenceFields(): Pick<
  PrFacilityLicenceRecord,
  'applicable' | 'licenceStatus' | 'licenceType' | 'licenceNumber' | 'issuedOn' | 'validTill' | 'remarks'
> {
  return {
    applicable: '',
    licenceStatus: '',
    licenceType: '',
    licenceNumber: '',
    issuedOn: '',
    validTill: '',
    remarks: '',
  };
}

export function createDefaultPrFacilityLicenceRecords(): PrFacilityLicenceRecord[] {
  return PR_FACILITY_LICENCE_SLOT_DEFAULTS.map((slot) => ({
    ...slot,
    ...emptyLicenceFields(),
  }));
}

function normalizeApplicable(raw: unknown): PrFacilityLicenceRecord['applicable'] {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'yes' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'n' || v === 'false') return 'no';
  return '';
}

function normalizeLicenceStatus(raw: unknown): PrFacilityLicenceRecord['licenceStatus'] {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'active') return 'active';
  if (v === 'expired') return 'expired';
  if (v === 'suspended') return 'suspended';
  if (v === 'pending' || v === 'pending renewal' || v === 'pending_renewal') return 'pending';
  return '';
}

function normalizeFacilityCode(raw: unknown): PrFacilityCode | null {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'ML1') return 'ML1';
  if (v === 'ML2') return 'ML2';
  return null;
}

function parseDateOnly(raw: string): Date | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizePrFacilityLicenceDateInput(raw: string): string {
  const parsed = parseDateOnly(raw);
  return parsed ? toIsoDateOnly(parsed) : String(raw ?? '').trim();
}

function parseLicenceRecord(raw: unknown, idx: number): PrFacilityLicenceRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const facilityCode =
    normalizeFacilityCode(row.facilityCode ?? row.facility_code) ??
    (idx === 0 ? 'ML1' : idx === 1 ? 'ML2' : null);
  if (!facilityCode) return null;
  const defaultSlot = PR_FACILITY_LICENCE_SLOT_DEFAULTS.find((s) => s.facilityCode === facilityCode);
  return {
    facilityCode,
    facilityLabel: String(row.facilityLabel ?? row.facility_label ?? defaultSlot?.facilityLabel ?? facilityCode).trim(),
    applicable: normalizeApplicable(row.applicable),
    licenceStatus: normalizeLicenceStatus(row.licenceStatus ?? row.licence_status),
    licenceType: String(row.licenceType ?? row.licence_type ?? '').trim(),
    licenceNumber: String(row.licenceNumber ?? row.licence_number ?? '').trim(),
    issuedOn: normalizePrFacilityLicenceDateInput(String(row.issuedOn ?? row.issued_on ?? '')),
    validTill: normalizePrFacilityLicenceDateInput(String(row.validTill ?? row.valid_till ?? '')),
    remarks: String(row.remarks ?? '').trim(),
  };
}

export function hydratePrFacilityLicenceRecords(source: unknown): PrFacilityLicenceRecord[] {
  if (!Array.isArray(source)) return createDefaultPrFacilityLicenceRecords();
  const parsed = source
    .map((item, idx) => parseLicenceRecord(item, idx))
    .filter((r): r is PrFacilityLicenceRecord => r !== null);
  if (parsed.length === 0) return createDefaultPrFacilityLicenceRecords();
  const byCode = new Map(parsed.map((r) => [r.facilityCode, r]));
  return PR_FACILITY_LICENCE_SLOT_DEFAULTS.map((slot) => {
    const hit = byCode.get(slot.facilityCode);
    return hit ?? { ...slot, ...emptyLicenceFields() };
  });
}

export function flattenPrFacilityLicenceRecordsForPayload(
  records: PrFacilityLicenceRecord[]
): PrFacilityLicenceRecord[] {
  return records
    .map((row) => ({
      facilityCode: row.facilityCode,
      facilityLabel: row.facilityLabel.trim(),
      applicable: row.applicable,
      licenceStatus: row.licenceStatus,
      licenceType: row.licenceType.trim(),
      licenceNumber: row.licenceNumber.trim(),
      issuedOn: row.issuedOn.trim(),
      validTill: row.validTill.trim(),
      remarks: row.remarks.trim(),
    }))
    .filter(
      (row) =>
        row.applicable ||
        row.licenceStatus ||
        (row.licenceType && row.licenceType !== 'Other') ||
        row.licenceNumber ||
        row.issuedOn ||
        row.validTill ||
        row.remarks
    );
}

function isLicenceCurrentlyValid(record: PrFacilityLicenceRecord, asOf = new Date()): boolean {
  if (record.licenceStatus !== 'active') return false;
  const till = parseDateOnly(record.validTill);
  if (!till) return false;
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12, 0, 0);
  return till.getTime() >= today.getTime();
}

function facilityRecordIsComplete(record: PrFacilityLicenceRecord): boolean {
  if (record.applicable !== 'yes') return true;
  const typeOk = Boolean(record.licenceType && record.licenceType !== 'Other');
  return Boolean(
    record.licenceStatus &&
      typeOk &&
      record.licenceNumber &&
      record.issuedOn &&
      record.validTill
  );
}

/** Overall PR licence clearance for display on the Licensing step. */
export function evaluatePrFacilityLicenceClearance(
  records: PrFacilityLicenceRecord[],
  asOf = new Date()
): PrFacilityLicenceClearance {
  const applicable = records.filter((r) => r.applicable === 'yes');
  if (applicable.length === 0) {
    return {
      status: 'incomplete',
      message: 'Mark at least one ML facility as applicable and complete licence details.',
    };
  }
  const incomplete = applicable.find((r) => !facilityRecordIsComplete(r));
  if (incomplete) {
    return {
      status: 'incomplete',
      message: `Complete licence fields for ${incomplete.facilityCode} before production can start.`,
    };
  }
  const blocked = applicable.find((r) => !isLicenceCurrentlyValid(r, asOf));
  if (blocked) {
    return {
      status: 'blocked',
      message: `${blocked.facilityCode} licence is not active / valid — update status or validity before batch start.`,
    };
  }
  return {
    status: 'cleared',
    message: 'Cleared for production at all applicable ML facilities.',
  };
}

/** Map scheduled MU zone code → facility code (ML1 / ML2). */
export function facilityCodeFromMuZone(zoneCode: string): PrFacilityCode {
  const z = String(zoneCode || '').trim().toUpperCase();
  if (z.includes('ML2') || z === 'LOC-ML2' || z.includes('MU02')) return 'ML2';
  return 'ML1';
}

export function evaluatePrFacilityLicenceForMuZone(
  records: PrFacilityLicenceRecord[],
  muZoneCode: string,
  asOf = new Date()
): { ok: boolean; message: string } {
  const facilityCode = facilityCodeFromMuZone(muZoneCode);
  const record = records.find((r) => r.facilityCode === facilityCode);
  if (!record || record.applicable !== 'yes') {
    return {
      ok: false,
      message: `PR is not licensed for production at ${facilityCode}. Update Licensing in PR Master.`,
    };
  }
  if (!facilityRecordIsComplete(record)) {
    return {
      ok: false,
      message: `PR ${facilityCode} licence details are incomplete. Complete Licensing in PR Master.`,
    };
  }
  if (!isLicenceCurrentlyValid(record, asOf)) {
    return {
      ok: false,
      message: `PR ${facilityCode} licence is not active or has expired. Update Licensing in PR Master.`,
    };
  }
  return { ok: true, message: `Cleared for production at ${facilityCode}.` };
}

export function seedPrFacilityLicencesIfEmpty(
  records: PrFacilityLicenceRecord[]
): PrFacilityLicenceRecord[] {
  if (!records?.length) return createDefaultPrFacilityLicenceRecords();
  const hasContent = records.some(
    (r) =>
      r.applicable ||
      r.licenceStatus ||
      r.licenceType ||
      r.licenceNumber ||
      r.issuedOn ||
      r.validTill ||
      r.remarks
  );
  if (hasContent) return records;
  return createDefaultPrFacilityLicenceRecords();
}
