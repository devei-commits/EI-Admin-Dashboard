import React, { useState, useEffect, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { createVendorClient, fetchNextCode } from '../../services/vendorClient.service';
import type { Vendor, PurchaseOrder, MainTab, SideSection } from '../../types/procurement.types';
import { PaymentTermsDisplay } from '../../components/procurement/PaymentTermsDisplay';
import { formatStagedPaymentTermsSummary } from '../../lib/stagedPaymentTerms';
import { ProcSection, ProcSectionHeader, ProcStatCards, ProcTableCard, ProcThead } from '../../components/procurement/ProcSection';
import { X } from '@phosphor-icons/react';

export type ProcurementVendorsProps = {
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  selectedVendor: Vendor | null;
  setSelectedVendor: (vendor: Vendor | null) => void;
  applyRouteState: (tab: MainTab, section?: SideSection) => void;
  sideSection: SideSection;
};

const INIT_ADD_FORM = {
  name: '',
  email: '',
  phone: '',
  location: '',
  country: '',
  category: 'Raw Material',
  paymentTerms: '',
  notes: '',
};

const ProcurementVendors: React.FC<ProcurementVendorsProps> = ({
  vendors,
  purchaseOrders,
  selectedVendor,
  setSelectedVendor,
  applyRouteState,
  sideSection,
}) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(INIT_ADD_FORM);
  const [nextCode, setNextCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const addModalHeadingId = useId();

  useEffect(() => {
    if (!showAddModal) return;
    setLoadingCode(true);
    setFormError('');
    fetchNextCode('vendor')
      .then((res) => {
        if (res.success && res.data) setNextCode(res.data);
        else setNextCode('');
      })
      .finally(() => setLoadingCode(false));
  }, [showAddModal]);

  const handleAddVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = nextCode?.trim();
    if (!code) {
      setFormError('Vendor code could not be generated. Please try again.');
      return;
    }
    const name = addForm.name.trim();
    if (!name) {
      setFormError('Vendor name is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    const res = await createVendorClient({
      type: 'vendor',
      entityCode: code,
      name,
      email: addForm.email.trim() || undefined,
      phone: addForm.phone.trim() || undefined,
      location: addForm.location.trim() || undefined,
      country: addForm.country.trim() || undefined,
      category: addForm.category || undefined,
      status: 'pending',
      paymentTerms: addForm.paymentTerms.trim() || undefined,
      notes: addForm.notes.trim() || undefined,
      data: {},
    });
    setSaving(false);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ['vendor-client', 'vendor'] });
      addToast('success', 'Vendor created successfully.');
      setShowAddModal(false);
      setAddForm(INIT_ADD_FORM);
      setNextCode('');
    } else {
      const msg = typeof res.error === 'object' && res.error && 'message' in res.error
        ? (res.error as { message?: string }).message
        : String(res.error ?? 'Failed to create vendor');
      setFormError(msg);
      addToast('error', msg);
    }
  };

  const closeAddModal = () => {
    if (!saving) {
      setShowAddModal(false);
      setAddForm(INIT_ADD_FORM);
      setFormError('');
    }
  };

  return (
    <div className="flex gap-4 h-screen-minus-header">
      <div className="flex-1 pr-4">
        <ProcSection>
        <ProcSectionHeader
          title="Vendor Directory"
          subtitle="Manage suppliers and purchase orders"
          actions={
            <>
              <button onClick={() => applyRouteState('Procurement', sideSection)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface text-ink-2 border border-border hover:bg-surface-3">Back</button>
              <button type="button" onClick={() => setShowAddModal(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-brand-ink hover:bg-brand-press">+ Add Vendor</button>
            </>
          }
        />

        <ProcStatCards cards={[
          { label: 'Total Vendors', value: vendors.length, tone: 'brand' },
          { label: 'Active', value: vendors.filter(v => v.status === 'Active').length, tone: 'ok' },
          { label: 'RM Suppliers', value: vendors.filter(v => v.type === 'RM').length, tone: 'warn' },
          { label: 'PM Suppliers', value: vendors.filter(v => v.type === 'PM').length, tone: 'brand' },
        ]} />

        <ProcTableCard>
            <ProcThead cols={['Vendor', 'Category', 'Contact', 'City', 'Payment Terms', 'Rating', 'POs Issued', 'Status']} />
            <tbody className="divide-y divide-hairline">
                {vendors.map(vendor => (
                  <tr
                    key={vendor.id}
                    onClick={() => setSelectedVendor(vendor)}
                    className="hover:bg-surface-3 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-semibold text-ink">{vendor.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-brand-soft text-brand border border-brand-soft">
                        {vendor.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{vendor.contact}</td>
                    <td className="px-3 py-2.5 text-ink-3">{vendor.city}</td>
                    <td className="px-3 py-2.5 text-ink-3 text-xs max-w-[220px]">
                      <span className="line-clamp-2" title={formatStagedPaymentTermsSummary(vendor.paymentTerms)}>
                        {formatStagedPaymentTermsSummary(vendor.paymentTerms)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-warn font-bold">{vendor.rating}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-3 font-semibold tabular-nums">{vendor.posIssued}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-ok-soft text-ok">{vendor.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
        </ProcTableCard>
        </ProcSection>
      </div>

      {selectedVendor && (
        <div className="w-96 bg-surface border-l border-border overflow-y-auto shadow-lg rounded-lg">
          <div className="sticky top-0 bg-brand-soft border-b border-brand-soft px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-ink text-lg">{selectedVendor.name}</h3>
            <button
              type="button"
              onClick={() => setSelectedVendor(null)}
              aria-label="Close"
              className="text-ink-4 hover:text-ink-3"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">VENDOR ID</p>
              <p className="text-sm font-mono text-ink-2 mt-1">{selectedVendor.vendorCode}</p>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">CATEGORY</p>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${selectedVendor.type === 'RM' ? 'bg-brand-soft text-brand border border-brand-soft' : 'bg-brand-soft text-brand border border-brand-soft'}`}>
                {selectedVendor.type}
              </span>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">CONTACT</p>
              <p className="text-sm text-ink-2 mt-1">{selectedVendor.contact}</p>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">EMAIL</p>
              <p className="text-sm text-brand mt-1">{selectedVendor.email}</p>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">PHONE</p>
              <p className="text-sm text-ink-2 font-mono mt-1">{selectedVendor.phone}</p>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">CITY</p>
              <p className="text-sm text-ink-2 mt-1">{selectedVendor.city}</p>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">PAYMENT TERMS</p>
              <div className="mt-1">
                <PaymentTermsDisplay value={selectedVendor.paymentTerms} />
              </div>
            </div>

            <div>
              <p className="text-xs text-ink-3 tracking-widest font-semibold">RATING</p>
              <p className="text-sm text-warn font-bold mt-1">{selectedVendor.rating}</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-ink-3 tracking-widest font-semibold mb-3">PURCHASE ORDERS ({purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length})</p>
              <div className="space-y-3">
                {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).map((po) => (
                  <div key={po.id} className="p-3 rounded-lg bg-surface-3 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-mono text-xs text-ink-3">{po.poNumber}</p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          po.status === 'Delivered'
                            ? 'bg-ok-soft text-ok'
                            : po.status === 'Shipped'
                            ? 'bg-brand-soft text-brand'
                            : po.status === '80% Complete'
                            ? 'bg-warn-soft text-warn'
                            : 'bg-warn-soft text-warn'
                        }`}
                      >
                        {po.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-3 mb-1">Value: ₹{po.value.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-ink-3">{po.date}</p>
                  </div>
                ))}
                {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length === 0 && (
                  <p className="text-xs text-ink-3 italic">No purchase orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeAddModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={addModalHeadingId}
            className="bg-surface rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface-3 border-b border-border px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h3 id={addModalHeadingId} className="text-lg font-bold text-ink">Add Vendor</h3>
              <button
                type="button"
                onClick={closeAddModal}
                disabled={saving}
                aria-label="Close"
                className="text-ink-4 hover:text-ink-3 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVendorSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-err-soft text-err text-sm border border-[color:var(--st-red-fg)]/30">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Vendor code</label>
                <input
                  type="text"
                  value={nextCode}
                  readOnly
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface-3 text-ink-2 font-mono text-sm"
                />
                {loadingCode && <p className="text-xs text-ink-3 mt-1">Generating code…</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="Vendor / trade name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Phone</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Location / City</label>
                <input
                  type="text"
                  value={addForm.location}
                  onChange={(e) => setAddForm((p) => ({ ...p, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="City or state"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Country</label>
                <input
                  type="text"
                  value={addForm.country}
                  onChange={(e) => setAddForm((p) => ({ ...p, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="Country"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                >
                  <option value="Raw Material">Raw Material (RM)</option>
                  <option value="Packaging">Packaging (PM)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Payment terms</label>
                <input
                  type="text"
                  value={addForm.paymentTerms}
                  onChange={(e) => setAddForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="e.g. Net 30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 tracking-widest mb-1">Notes</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-ink-2 hover:bg-surface-3 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingCode || !nextCode}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-brand-press disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementVendors;
