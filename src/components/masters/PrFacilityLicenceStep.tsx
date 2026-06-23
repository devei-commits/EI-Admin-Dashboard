import React from 'react';
import {
  PR_FACILITY_LICENCE_STATUS_OPTIONS,
  PR_FACILITY_LICENCE_TYPE_OPTIONS,
} from '../../constants/prFacilityLicenceDefaults';
import { evaluatePrFacilityLicenceClearance } from '../../lib/prFacilityLicence';
import type { PrFacilityLicenceRecord } from '../../types/prFacilityLicence';

type PrFacilityLicenceStepProps = {
  records: PrFacilityLicenceRecord[];
  onChange: (records: PrFacilityLicenceRecord[]) => void;
  productLabel?: string;
};

function statusBadgeClass(status: PrFacilityLicenceRecord['licenceStatus']): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'expired':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'suspended':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'pending':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function clearanceBannerClass(status: ReturnType<typeof evaluatePrFacilityLicenceClearance>['status']): string {
  if (status === 'cleared') return 'bg-emerald-50 border-emerald-200 text-emerald-900';
  if (status === 'blocked') return 'bg-red-50 border-red-200 text-red-900';
  return 'bg-amber-50 border-amber-200 text-amber-900';
}

function formatDisplayDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function PrFacilityLicenceStep({
  records,
  onChange,
  productLabel,
}: PrFacilityLicenceStepProps): React.ReactElement {
  const clearance = evaluatePrFacilityLicenceClearance(records);

  const updateRecord = (facilityCode: PrFacilityLicenceRecord['facilityCode'], patch: Partial<PrFacilityLicenceRecord>) => {
    onChange(
      records.map((row) => (row.facilityCode === facilityCode ? { ...row, ...patch } : row))
    );
  };

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">PR Licence Status — per Facility</h3>
        <p className="text-xs text-slate-500 mt-1">
          Edit ML1 / ML2 licence info here · Production module reads this in real time to gate batch start
          {productLabel ? ` for ${productLabel}` : ''}.
        </p>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm font-medium flex items-start gap-2 ${clearanceBannerClass(clearance.status)}`}
        role="status"
      >
        <span aria-hidden="true">{clearance.status === 'cleared' ? '✓' : clearance.status === 'blocked' ? '✕' : '!'}</span>
        <span>{clearance.status === 'cleared' ? 'Cleared for production' : clearance.message}</span>
      </div>

      <div className="space-y-4">
        {records.map((record) => {
          const presetTypes = PR_FACILITY_LICENCE_TYPE_OPTIONS.filter((opt) => opt !== 'Other');
          const licenceTypeSelectValue = presetTypes.includes(
            record.licenceType as (typeof presetTypes)[number]
          )
            ? record.licenceType
            : record.licenceType
              ? 'Other'
              : '';
          const showCustomLicenceType =
            record.licenceType === 'Other' ||
            (Boolean(record.licenceType) &&
              !presetTypes.includes(record.licenceType as (typeof presetTypes)[number]));
          const statusLabel =
            PR_FACILITY_LICENCE_STATUS_OPTIONS.find((o) => o.value === record.licenceStatus)?.label ??
            (record.licenceStatus ? record.licenceStatus : 'Not set');
          return (
            <section
              key={record.facilityCode}
              className="border border-slate-200 rounded-lg bg-white overflow-hidden"
              aria-labelledby={`pr-licence-${record.facilityCode}-title`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div>
                  <h4 id={`pr-licence-${record.facilityCode}-title`} className="text-sm font-semibold text-slate-900">
                    <span aria-hidden="true" className="mr-1">
                      🏭
                    </span>
                    {record.facilityCode}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">{record.facilityLabel || '—'}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass(record.licenceStatus)}`}
                >
                  {record.licenceStatus === 'active' ? '✓ Active' : statusLabel}
                </span>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`facility-label-${record.facilityCode}`}
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Facility label
                  </label>
                  <input
                    id={`facility-label-${record.facilityCode}`}
                    type="text"
                    value={record.facilityLabel}
                    onChange={(e) => updateRecord(record.facilityCode, { facilityLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Hyderabad ML1 · Plot 24"
                  />
                </div>

                <div>
                  <label htmlFor={`applicable-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Applicable?
                  </label>
                  <select
                    id={`applicable-${record.facilityCode}`}
                    value={record.applicable}
                    onChange={(e) =>
                      updateRecord(record.facilityCode, {
                        applicable: e.target.value as PrFacilityLicenceRecord['applicable'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select…</option>
                    <option value="yes">Yes — produced at {record.facilityCode}</option>
                    <option value="no">No — not produced here</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`licence-status-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Licence Status
                  </label>
                  <select
                    id={`licence-status-${record.facilityCode}`}
                    value={record.licenceStatus}
                    onChange={(e) =>
                      updateRecord(record.facilityCode, {
                        licenceStatus: e.target.value as PrFacilityLicenceRecord['licenceStatus'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select status…</option>
                    {PR_FACILITY_LICENCE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`licence-type-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Licence Type
                  </label>
                  <select
                    id={`licence-type-${record.facilityCode}`}
                    value={licenceTypeSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateRecord(record.facilityCode, {
                        licenceType: v === 'Other' ? 'Other' : v,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select type…</option>
                    {PR_FACILITY_LICENCE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {showCustomLicenceType ? (
                    <input
                      type="text"
                      value={record.licenceType === 'Other' ? '' : record.licenceType}
                      onChange={(e) => updateRecord(record.facilityCode, { licenceType: e.target.value })}
                      className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Custom licence type"
                      aria-label={`Custom licence type for ${record.facilityCode}`}
                    />
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`licence-number-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Licence Number
                  </label>
                  <input
                    id={`licence-number-${record.facilityCode}`}
                    type="text"
                    value={record.licenceNumber}
                    onChange={(e) => updateRecord(record.facilityCode, { licenceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. TS-COS-2023-00214"
                  />
                </div>

                <div>
                  <label htmlFor={`issued-on-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Issued On
                  </label>
                  <input
                    id={`issued-on-${record.facilityCode}`}
                    type="date"
                    value={record.issuedOn}
                    onChange={(e) => updateRecord(record.facilityCode, { issuedOn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {record.issuedOn ? (
                    <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(record.issuedOn)}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`valid-till-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid Till
                  </label>
                  <input
                    id={`valid-till-${record.facilityCode}`}
                    type="date"
                    value={record.validTill}
                    onChange={(e) => updateRecord(record.facilityCode, { validTill: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {record.validTill ? (
                    <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(record.validTill)}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`remarks-${record.facilityCode}`} className="block text-xs font-semibold text-slate-700 mb-1">
                    Remarks
                  </label>
                  <textarea
                    id={`remarks-${record.facilityCode}`}
                    value={record.remarks}
                    onChange={(e) => updateRecord(record.facilityCode, { remarks: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Notes for production / regulatory"
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
