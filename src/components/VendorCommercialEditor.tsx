import React, { useMemo, useRef } from 'react';
import VendorClientNameTypeahead from './VendorClientNameTypeahead';
import { fetchVendorClientById, type VendorClientRecord } from '../services/vendorClient.service';
import {
  formatStagedPaymentTermsObject,
  mergeCreditDaysFromClientData,
  resolveStagedPaymentTermsFromVendorRecord,
  serializeStagedPaymentTerms,
  validateStagedPercents,
} from '../lib/stagedPaymentTerms';

export function findVendorClientByName(
  vendorClientList: VendorClientRecord[],
  name: string
): VendorClientRecord | undefined {
  const t = String(name ?? '').trim();
  if (!t) return undefined;
  return (
    vendorClientList.find((x) => x.name.trim() === t) ||
    vendorClientList.find((x) => x.name.trim().toLowerCase() === t.toLowerCase())
  );
}

function resolveVendorLocation(v: VendorClientRecord): string {
  const loc = String(v.location ?? '').trim();
  if (loc) return loc;
  const data = v.data && typeof v.data === 'object' ? v.data : {};
  const state = String((data as { state?: unknown }).state ?? '').trim();
  if (state) return state;
  return [v.city, v.country].filter(Boolean).join(', ').trim();
}

export type VendorTierDraft = {
  moq: string;
  price: string;
  validTill: string;
  note: string;
};

export type RmCommercialVendor = {
  id?: string;
  name: string;
  location: string;
  moq: number;
  unitPrice: number;
  leadTime: number;
  approved: string;
  priceValidTill: string;
  currency?: string;
  advancePct?: string;
  preShipmentPct?: string;
  postShipmentPct?: string;
  creditDays?: string;
  tiers?: VendorTierDraft[];
};

export type PmCommercialVendor = {
  id?: string;
  name: string;
  location: string;
  moq: number;
  /** Per-piece price (primary). Legacy payloads may use `unitPrice` instead; sync accepts both. */
  price: number;
  unitPrice?: number;
  leadTime: number;
  approved: string;
  priceType: string;
  validTill: string;
  sampleCost: number;
  currency?: string;
  advancePct?: string;
  preShipmentPct?: string;
  postShipmentPct?: string;
  creditDays?: string;
  tiers?: VendorTierDraft[];
};

const EMPTY_TIER = (): VendorTierDraft => ({ moq: '', price: '', validTill: '', note: '' });

function paymentSummary(v: RmCommercialVendor | PmCommercialVendor): string {
  const adv = Number(v.advancePct);
  const pre = Number(v.preShipmentPct);
  const post = Number(v.postShipmentPct);
  const cd = Number(v.creditDays);
  if (!Number.isFinite(adv) && !Number.isFinite(pre) && !Number.isFinite(post)) return '—';
  const staged = {
    advance_pct: Number.isFinite(adv) ? adv : 0,
    pre_shipment_pct: Number.isFinite(pre) ? pre : 0,
    post_shipment_pct: Number.isFinite(post) ? post : 0,
    credit_days: Number.isFinite(cd) ? Math.max(0, Math.floor(cd)) : 0,
  };
  return formatStagedPaymentTermsObject(staged);
}

interface VendorCommercialEditorProps {
  variant: 'rm' | 'pm';
  vendors: RmCommercialVendor[] | PmCommercialVendor[];
  tempFields: Record<string, string>;
  tempTiers: VendorTierDraft[];
  vendorClientList: VendorClientRecord[];
  onTempFieldChange: (field: string, value: string) => void;
  onTempTierChange: (rowIdx: number, field: keyof VendorTierDraft, value: string) => void;
  onAddTempTierRow: () => void;
  onAddVendor: () => void;
  onRemoveVendor: (index: number) => void;
  onVendorsChange: (vendors: RmCommercialVendor[] | PmCommercialVendor[]) => void;
  errors?: Record<string, string>;
}

function getVendorTiers(
  v: RmCommercialVendor | PmCommercialVendor,
  variant: 'rm' | 'pm'
): VendorTierDraft[] {
  const tiers = v.tiers && v.tiers.length > 0 ? v.tiers : [];
  if (tiers.length > 0) {
    return tiers.map((t) => ({
      moq: String(t.moq ?? ''),
      price: String(t.price ?? ''),
      validTill: String(t.validTill ?? ''),
      note: String(t.note ?? ''),
    }));
  }
  const moq = String(v.moq ?? '');
  const price =
    variant === 'rm'
      ? String((v as RmCommercialVendor).unitPrice ?? '')
      : String((v as PmCommercialVendor).price ?? (v as PmCommercialVendor).unitPrice ?? '');
  const validTill =
    variant === 'rm'
      ? String((v as RmCommercialVendor).priceValidTill ?? '')
      : String((v as PmCommercialVendor).validTill ?? '');
  if (moq.trim() || price.trim()) {
    return [{ moq, price, validTill, note: '' }];
  }
  return [];
}

function syncVendorFallbackFromTiers(
  v: RmCommercialVendor | PmCommercialVendor,
  tiers: VendorTierDraft[],
  variant: 'rm' | 'pm'
): RmCommercialVendor | PmCommercialVendor {
  const first = tiers.find((t) => String(t.moq).trim() && String(t.price).trim()) ?? tiers[0];
  if (!first) return v;
  const moq = Number(first.moq) || 0;
  const price = Number(first.price) || 0;
  if (variant === 'rm') {
    return {
      ...(v as RmCommercialVendor),
      moq,
      unitPrice: price,
      priceValidTill: first.validTill,
      tiers,
    };
  }
  return {
    ...(v as PmCommercialVendor),
    moq,
    price,
    validTill: first.validTill,
    tiers,
  };
}

function patchVendorTiers(
  vendors: RmCommercialVendor[] | PmCommercialVendor[],
  vendorIdx: number,
  variant: 'rm' | 'pm',
  updater: (tiers: VendorTierDraft[]) => VendorTierDraft[]
): RmCommercialVendor[] | PmCommercialVendor[] {
  const next = [...vendors];
  const current = next[vendorIdx];
  if (!current) return vendors;
  const tiers = updater(getVendorTiers(current, variant));
  next[vendorIdx] = syncVendorFallbackFromTiers(current, tiers, variant);
  return next;
}

const VendorCommercialEditor: React.FC<VendorCommercialEditorProps> = ({
  variant,
  vendors,
  tempFields,
  tempTiers,
  vendorClientList,
  onTempFieldChange,
  onTempTierChange,
  onAddTempTierRow,
  onAddVendor,
  onRemoveVendor,
  onVendorsChange,
  errors = {},
}) => {
  const priceKey = variant === 'rm' ? 'unitPrice' : 'price';
  const uomHint = variant === 'rm' ? 'MOQ (KG etc.)' : 'MOQ (pcs etc.)';
  const hydrateRequestRef = useRef(0);

  const selectedVendorId = useMemo(() => {
    const row = findVendorClientByName(vendorClientList, tempFields.name || '');
    return row?.id ?? '';
  }, [vendorClientList, tempFields.name]);

  /** Pull location, lead time, MOQ, and staged payment terms from vendor master (full row when possible). */
  const hydrateFromVendorMaster = (name: string) => {
    const listRow = findVendorClientByName(vendorClientList, name);
    if (!listRow) return;
    const reqId = ++hydrateRequestRef.current;
    void (async () => {
      let paymentTerms = listRow.paymentTerms;
      let data: Record<string, unknown> | undefined =
        listRow.data && typeof listRow.data === 'object' ? (listRow.data as Record<string, unknown>) : undefined;
      let lead = String(listRow.leadTime ?? '').trim();
      let location = resolveVendorLocation(listRow);
      let moq = String(listRow.moq ?? '').trim();

      try {
        const fullRes = await fetchVendorClientById(listRow.id);
        if (fullRes.success && fullRes.data) {
          const full = fullRes.data;
          paymentTerms = full.paymentTerms ?? paymentTerms;
          data =
            full.data && typeof full.data === 'object'
              ? (full.data as Record<string, unknown>)
              : data;
          lead = String(full.leadTime ?? lead).trim();
          location = resolveVendorLocation(full) || location;
          moq = String(full.moq ?? moq).trim();
        }
      } catch {
        // List row is enough when detail fetch fails
      }

      if (reqId !== hydrateRequestRef.current) return;

      onTempFieldChange('location', location);
      onTempFieldChange('leadTime', lead);
      if (moq) onTempFieldChange('moq', moq);

      const staged = mergeCreditDaysFromClientData(
        resolveStagedPaymentTermsFromVendorRecord(paymentTerms, data),
        data
      );
      onTempFieldChange('advancePct', String(staged.advance_pct));
      onTempFieldChange('preShipmentPct', String(staged.pre_shipment_pct));
      onTempFieldChange('postShipmentPct', String(staged.post_shipment_pct));
      onTempFieldChange('creditDays', staged.credit_days ? String(staged.credit_days) : '');
    })();
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 mb-4 space-y-4">
      <h3 className="font-semibold text-gray-800">Vendor Manager</h3>
      <p className="text-xs text-gray-500">
        Search and pick a vendor from suggestions to auto-fill location, lead time, MOQ (when set on the vendor master), and payment terms (same source as Items List). Add one or more MOQ/price rows; the same vendor can be added again with different pricing. Edit tiers on added vendors below before saving. Vendor pricing is synced to Items List when you submit this master.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor name</label>
            <VendorClientNameTypeahead
              parties={vendorClientList}
              selectedId={selectedVendorId}
              placeholder="Search vendor by name, code, city…"
              onSelect={(party) => {
                const name = party?.name?.trim() ?? '';
                onTempFieldChange('name', name);
                if (name) hydrateFromVendorMaster(name);
              }}
            />
            {errors.venName ? <p className="text-red-500 text-xs mt-1">{errors.venName}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <input
              type="text"
              value={tempFields.location || ''}
              onChange={(e) => onTempFieldChange('location', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
            <select
              value={tempFields.currency || 'INR'}
              onChange={(e) => onTempFieldChange('currency', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lead time (days)</label>
            <input
              type="number"
              min={0}
              value={tempFields.leadTime || ''}
              onChange={(e) => onTempFieldChange('leadTime', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <p className="text-[11px] font-semibold text-gray-600 mb-2">Payment terms (% of order value)</p>
          <p className="text-[10px] text-gray-500 mb-2">Advance, pre-shipment, and post-shipment must total at most 100%.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Advance %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={tempFields.advancePct ?? ''}
                onChange={(e) => onTempFieldChange('advancePct', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Pre-shipment %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={tempFields.preShipmentPct ?? ''}
                onChange={(e) => onTempFieldChange('preShipmentPct', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Post-shipment %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={tempFields.postShipmentPct ?? ''}
                onChange={(e) => onTempFieldChange('postShipmentPct', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Credit days</span>
              <input
                type="number"
                min={0}
                value={tempFields.creditDays ?? ''}
                onChange={(e) => onTempFieldChange('creditDays', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-600 uppercase">Price tiers</span>
            <button type="button" onClick={onAddTempTierRow} className="text-xs text-teal-700 font-semibold hover:underline">
              + Add tier row
            </button>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-500">{uomHint}</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-500">Price</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-500">Valid till</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-500">Note</th>
              </tr>
            </thead>
            <tbody>
              {tempTiers.map((t, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      value={t.moq}
                      onChange={(e) => onTempTierChange(idx, 'moq', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                      placeholder="MOQ"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={t.price}
                      onChange={(e) => onTempTierChange(idx, 'price', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                      placeholder="Price"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="date"
                      value={t.validTill}
                      onChange={(e) => onTempTierChange(idx, 'validTill', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={t.note}
                      onChange={(e) => onTempTierChange(idx, 'note', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs"
                      placeholder="Note"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 mt-2">
            Shortcut: fill <strong>MOQ</strong> + <strong>{variant === 'rm' ? 'Unit price' : 'Unit price'}</strong> below; if no tier rows have both MOQ and price, those two fields create one tier.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div>
              <label className="text-[10px] text-gray-600">MOQ (fallback)</label>
              <input
                type="number"
                value={tempFields.moq || ''}
                onChange={(e) => onTempFieldChange('moq', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600">{variant === 'rm' ? 'Unit price' : 'Unit price'}</label>
              <input
                type="number"
                step="0.01"
                value={tempFields[priceKey] || ''}
                onChange={(e) => onTempFieldChange(priceKey, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
            {variant === 'rm' ? (
              <>
                <div>
                  <label className="text-[10px] text-gray-600">Approved</label>
                  <input
                    type="text"
                    value={tempFields.approved || ''}
                    onChange={(e) => onTempFieldChange('approved', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Price valid till</label>
                  <input
                    type="date"
                    value={tempFields.priceValidTill || ''}
                    onChange={(e) => onTempFieldChange('priceValidTill', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] text-gray-600">Approved</label>
                  <input
                    type="text"
                    value={tempFields.approved || ''}
                    onChange={(e) => onTempFieldChange('approved', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Price type</label>
                  <input
                    type="text"
                    value={tempFields.priceType || ''}
                    onChange={(e) => onTempFieldChange('priceType', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Valid till</label>
                  <input
                    type="date"
                    value={tempFields.validTill || ''}
                    onChange={(e) => onTempFieldChange('validTill', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Sample cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempFields.sampleCost || ''}
                    onChange={(e) => onTempFieldChange('sampleCost', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddVendor}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
        >
          + Add vendor
        </button>
      </div>

      {vendors.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Added vendors &amp; tiers</h4>
          <p className="text-xs text-gray-500">Edit MOQ, price, valid till, or notes on any tier row. Use + Add tier to add another price break for that vendor.</p>
          {vendors.map((v, vIdx) => {
            const displayTiers = getVendorTiers(v, variant);
            const editableTiers = displayTiers.length > 0 ? displayTiers : [EMPTY_TIER()];
            return (
              <div key={v.id ?? `vendor-${vIdx}`} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-gray-800">{v.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{v.location || '—'}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{v.currency || 'INR'}</span>
                  </div>
                  <div className="text-[10px] text-gray-600">{paymentSummary(v)}</div>
                  <button type="button" onClick={() => onRemoveVendor(vIdx)} className="text-red-600 text-xs font-semibold hover:underline">
                    Remove
                  </button>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Price tiers</span>
                  <button
                    type="button"
                    onClick={() =>
                      onVendorsChange(
                        patchVendorTiers(vendors, vIdx, variant, (tiers) => [...tiers, EMPTY_TIER()])
                      )
                    }
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    + Add tier
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">{uomHint}</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Price</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Valid till</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Note</th>
                      <th className="text-right py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase w-16"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableTiers.map((t, ti) => (
                      <tr key={ti} className="border-b border-gray-50">
                        <td className="p-1">
                          <input
                            type="number"
                            min={0}
                            value={t.moq}
                            onChange={(e) =>
                              onVendorsChange(
                                patchVendorTiers(vendors, vIdx, variant, (tiers) =>
                                  tiers.map((row, idx) =>
                                    idx === ti ? { ...row, moq: e.target.value } : row
                                  )
                                )
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                            placeholder="MOQ"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            value={t.price}
                            onChange={(e) =>
                              onVendorsChange(
                                patchVendorTiers(vendors, vIdx, variant, (tiers) =>
                                  tiers.map((row, idx) =>
                                    idx === ti ? { ...row, price: e.target.value } : row
                                  )
                                )
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                            placeholder="Price"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="date"
                            value={t.validTill}
                            onChange={(e) =>
                              onVendorsChange(
                                patchVendorTiers(vendors, vIdx, variant, (tiers) =>
                                  tiers.map((row, idx) =>
                                    idx === ti ? { ...row, validTill: e.target.value } : row
                                  )
                                )
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={t.note}
                            onChange={(e) =>
                              onVendorsChange(
                                patchVendorTiers(vendors, vIdx, variant, (tiers) =>
                                  tiers.map((row, idx) =>
                                    idx === ti ? { ...row, note: e.target.value } : row
                                  )
                                )
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                            placeholder="Note"
                          />
                        </td>
                        <td className="p-1 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onVendorsChange(
                                patchVendorTiers(vendors, vIdx, variant, (tiers) =>
                                  tiers.length <= 1 ? tiers : tiers.filter((_, idx) => idx !== ti)
                                )
                              )
                            }
                            disabled={editableTiers.length <= 1}
                            className="text-[10px] font-semibold text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-2">No vendors added yet</p>
      )}
    </div>
  );
};

export function defaultTempVendorTiers(count = 4): VendorTierDraft[] {
  return Array.from({ length: count }, () => EMPTY_TIER());
}

export function serializePaymentTermsFromTemp(temp: Record<string, string>): string {
  const adv = Number(temp.advancePct);
  const pre = Number(temp.preShipmentPct);
  const post = Number(temp.postShipmentPct);
  const cd = temp.creditDays ? Math.max(0, parseInt(temp.creditDays, 10) || 0) : 0;
  const a = Number.isFinite(adv) ? adv : 0;
  const b = Number.isFinite(pre) ? pre : 0;
  const c = Number.isFinite(post) ? post : 0;
  const pctErr = validateStagedPercents(a, b, c);
  if (pctErr) throw new Error(pctErr);
  return serializeStagedPaymentTerms({
    advance_pct: a,
    pre_shipment_pct: b,
    post_shipment_pct: c,
    credit_days: cd,
  });
}

export default VendorCommercialEditor;
