import React from 'react';
import type { VendorClientRecord } from '../services/vendorClient.service';
import {
  formatStagedPaymentTermsObject,
  resolveStagedPaymentTermsFromVendorRecord,
  serializeStagedPaymentTerms,
  validateStagedPercents,
} from '../lib/stagedPaymentTerms';

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
  errors?: Record<string, string>;
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
  errors = {},
}) => {
  const priceKey = variant === 'rm' ? 'unitPrice' : 'price';
  const uomHint = variant === 'rm' ? 'MOQ (KG etc.)' : 'MOQ (pcs etc.)';

  const hydrateFromVendorMaster = (name: string) => {
    const v = vendorClientList.find((x) => x.name === name);
    if (!v) return;
    onTempFieldChange('location', v.location || '');
    const staged = resolveStagedPaymentTermsFromVendorRecord(v.paymentTerms, v.data);
    onTempFieldChange('advancePct', String(staged.advance_pct));
    onTempFieldChange('preShipmentPct', String(staged.pre_shipment_pct));
    onTempFieldChange('postShipmentPct', String(staged.post_shipment_pct));
    onTempFieldChange('creditDays', String(staged.credit_days ?? 0));
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 mb-4 space-y-4">
      <h3 className="font-semibold text-gray-800">Vendor Manager</h3>
      <p className="text-xs text-gray-500">
        Payment terms match the Items List “Add Price Tier” flow (advance / pre-shipment / post-shipment %, credit days, lead time). Add one or more MOQ/price rows; if you only fill MOQ + unit price below, a single tier is created from those values. Vendor pricing is synced to Items List when you submit this master.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor name</label>
            <select
              value={tempFields.name || ''}
              onChange={(e) => {
                const val = e.target.value;
                onTempFieldChange('name', val);
                hydrateFromVendorMaster(val);
              }}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Select vendor</option>
              {vendorClientList.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
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
          {vendors.map((v, vIdx) => {
            const tiers = v.tiers && v.tiers.length > 0 ? v.tiers : [];
            const fallbackMoq = String(v.moq ?? '');
            const fallbackPrice =
              variant === 'rm' ? String((v as RmCommercialVendor).unitPrice ?? '') : String((v as PmCommercialVendor).price ?? '');
            const displayTiers =
              tiers.length > 0
                ? tiers
                : fallbackMoq || fallbackPrice
                  ? [{ moq: fallbackMoq, price: fallbackPrice, validTill: '', note: '' }]
                  : [];
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">MOQ</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Price</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Valid till</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTiers.map((t, ti) => (
                      <tr key={ti} className="border-b border-gray-50">
                        <td className="py-1.5 px-2 font-mono text-xs">{t.moq || '—'}</td>
                        <td className="py-1.5 px-2 font-mono text-xs font-semibold text-amber-700">{t.price || '—'}</td>
                        <td className="py-1.5 px-2 text-xs">{t.validTill || '—'}</td>
                        <td className="py-1.5 px-2 text-[11px] text-gray-500">{t.note || ''}</td>
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
