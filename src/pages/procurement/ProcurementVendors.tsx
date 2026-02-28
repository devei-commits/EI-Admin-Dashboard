import React from 'react';
import type { Vendor, PurchaseOrder, MainTab, SideSection } from '../../types/procurement.types';

export type ProcurementVendorsProps = {
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  selectedVendor: Vendor | null;
  setSelectedVendor: (vendor: Vendor | null) => void;
  applyRouteState: (tab: MainTab, section?: SideSection) => void;
  sideSection: SideSection;
};

const ProcurementVendors: React.FC<ProcurementVendorsProps> = ({
  vendors,
  purchaseOrders,
  selectedVendor,
  setSelectedVendor,
  applyRouteState,
  sideSection,
}) => {
  return (
    <div className="flex gap-4 h-screen-minus-header">
      <div className="flex-1 pr-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-archivo text-slate-900">Vendor Directory</h2>
            <p className="text-sm text-slate-600 mt-1">Manage suppliers and purchase orders</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => applyRouteState('Procurement', sideSection)}
              className="px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-300 hover:bg-cyan-100 transition"
            >
              ← Back
            </button>
            <button className="px-4 py-2 rounded-lg bg-yellow-400 text-yellow-900 font-semibold hover:bg-yellow-500 transition">
              + Add Vendor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-4">
            <p className="text-xs text-cyan-600 tracking-widest font-semibold">TOTAL VENDORS</p>
            <p className="text-3xl font-bold text-cyan-700 mt-2">{vendors.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-600 tracking-widest font-semibold">ACTIVE</p>
            <p className="text-3xl font-bold text-emerald-700 mt-2">{vendors.filter(v => v.status === 'Active').length}</p>
          </div>
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-600 tracking-widest font-semibold">RM SUPPLIERS</p>
            <p className="text-3xl font-bold text-yellow-700 mt-2">{vendors.filter(v => v.type === 'RM').length}</p>
          </div>
          <div className="rounded-xl border border-violet-300 bg-violet-50 p-4">
            <p className="text-xs text-violet-600 tracking-widest font-semibold">PM SUPPLIERS</p>
            <p className="text-3xl font-bold text-violet-700 mt-2">{vendors.filter(v => v.type === 'PM').length}</p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-blue-200 bg-linear-to-r from-blue-50 to-cyan-50">
            <h3 className="font-bold text-slate-900">Vendor Directory</h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="text-left text-xs tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3">VENDOR</th>
                  <th className="px-6 py-3">CATEGORY</th>
                  <th className="px-6 py-3">CONTACT</th>
                  <th className="px-6 py-3">CITY</th>
                  <th className="px-6 py-3">PAYMENT TERMS</th>
                  <th className="px-6 py-3">RATING</th>
                  <th className="px-6 py-3">POS ISSUED</th>
                  <th className="px-6 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(vendor => (
                  <tr
                    key={vendor.id}
                    onClick={() => setSelectedVendor(vendor)}
                    className="border-b border-slate-100 hover:bg-blue-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-3 font-semibold text-slate-900">{vendor.name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${vendor.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                        {vendor.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-700">{vendor.contact}</td>
                    <td className="px-6 py-3 text-slate-600">{vendor.city}</td>
                    <td className="px-6 py-3 text-slate-600 text-xs">{vendor.paymentTerms}</td>
                    <td className="px-6 py-3">
                      <span className="text-yellow-700 font-bold">{'★'.repeat(Math.round(vendor.rating))} {vendor.rating}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-semibold">{vendor.posIssued}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{vendor.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedVendor && (
        <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto shadow-lg rounded-lg">
          <div className="sticky top-0 bg-linear-to-r from-blue-50 to-cyan-50 border-b border-blue-200 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">{selectedVendor.name}</h3>
            <button
              onClick={() => setSelectedVendor(null)}
              className="text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">VENDOR ID</p>
              <p className="text-sm font-mono text-slate-700 mt-1">{selectedVendor.vendorCode}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">CATEGORY</p>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${selectedVendor.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                {selectedVendor.type}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">CONTACT</p>
              <p className="text-sm text-slate-700 mt-1">{selectedVendor.contact}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">EMAIL</p>
              <p className="text-sm text-blue-600 mt-1">{selectedVendor.email}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">PHONE</p>
              <p className="text-sm text-slate-700 font-mono mt-1">{selectedVendor.phone}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">CITY</p>
              <p className="text-sm text-slate-700 mt-1">{selectedVendor.city}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">PAYMENT TERMS</p>
              <p className="text-sm text-slate-700 mt-1">{selectedVendor.paymentTerms}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 tracking-widest font-semibold">RATING</p>
              <p className="text-sm text-yellow-700 font-bold mt-1">{'★'.repeat(Math.round(selectedVendor.rating))} {selectedVendor.rating}</p>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500 tracking-widest font-semibold mb-3">PURCHASE ORDERS ({purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length})</p>
              <div className="space-y-3">
                {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).map((po) => (
                  <div key={po.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-mono text-xs text-slate-600">{po.poNumber}</p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          po.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-700'
                            : po.status === 'Shipped'
                            ? 'bg-blue-100 text-blue-700'
                            : po.status === '80% Complete'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {po.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">Value: ₹{po.value.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-500">{po.date}</p>
                  </div>
                ))}
                {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length === 0 && (
                  <p className="text-xs text-slate-500 italic">No purchase orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementVendors;
