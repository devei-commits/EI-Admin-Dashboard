/**
 * "Confirm Receipt" step (step 1 of the GRN inbound flow): record the physical receipt
 * of goods at the dock — assignment, receipt date/time, vehicle & driver, document
 * checklist, photos, and remarks.
 *
 * Deliberately has NO auto-notify (WhatsApp/Email) control.
 */

import React, { useRef, useState } from 'react';
import { UserRound, Camera, X } from 'lucide-react';
import type { AssignableUser } from '../../services/grn.service';
import { compressImage } from '../../lib/compressImage';
import {
  GRN_RECEIPT_CHECKLIST_ITEMS,
  GRN_RECEIPT_MAX_PHOTOS,
  GRN_RECEIPT_MIN_VEHICLE_PHOTOS,
  type GrnAssignmentType,
  type GrnReceiptChecklistKey,
  type InboundGrnReceiptMeta,
} from '../../lib/inboundGrnReceiptMeta';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export interface GrnConfirmReceiptSectionProps {
  value: InboundGrnReceiptMeta;
  onChange: (patch: Partial<InboundGrnReceiptMeta>) => void;
  assignableUsers: AssignableUser[];
  disabled?: boolean;
}

export const GrnConfirmReceiptSection: React.FC<GrnConfirmReceiptSectionProps> = ({
  value,
  onChange,
  assignableUsers,
  disabled = false,
}) => {
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);
  const docPhotoRef = useRef<HTMLInputElement>(null);
  const [busyField, setBusyField] = useState<'vehiclePhotos' | 'documentPhotos' | null>(null);

  const assignmentType: GrnAssignmentType = value.assignmentType ?? 'open';
  const vehiclePhotos = value.vehiclePhotos ?? [];
  const documentPhotos = value.documentPhotos ?? [];

  const toggleChecklist = (key: GrnReceiptChecklistKey): void => {
    onChange({ checklist: { ...(value.checklist ?? {}), [key]: !(value.checklist ?? {})[key] } });
  };

  const addPhotos = async (
    field: 'vehiclePhotos' | 'documentPhotos',
    fileList: FileList | null,
  ): Promise<void> => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const current = value[field] ?? [];
    const room = GRN_RECEIPT_MAX_PHOTOS - current.length;
    if (room <= 0) return;
    setBusyField(field);
    try {
      const compressed = await Promise.all(files.slice(0, room).map((f) => compressImage(f)));
      onChange({ [field]: [...current, ...compressed] } as Partial<InboundGrnReceiptMeta>);
    } catch {
      /* a bad image is skipped silently; others still apply */
    } finally {
      setBusyField(null);
    }
  };

  const removePhoto = (field: 'vehiclePhotos' | 'documentPhotos', index: number): void => {
    const current = value[field] ?? [];
    onChange({ [field]: current.filter((_, i) => i !== index) } as Partial<InboundGrnReceiptMeta>);
  };

  const renderPhotoField = (
    field: 'vehiclePhotos' | 'documentPhotos',
    photos: string[],
    inputRef: React.RefObject<HTMLInputElement>,
    labelNode: React.ReactNode,
    addLabel: string,
  ) => (
    <div>
      <span className={labelClass}>{labelNode}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          void addPhotos(field, e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative">
            <img src={src} alt={`${field} ${i + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            {!disabled ? (
              <button
                type="button"
                onClick={() => removePhoto(field, i)}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white hover:bg-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
        {!disabled && photos.length < GRN_RECEIPT_MAX_PHOTOS ? (
          <button
            type="button"
            disabled={busyField === field}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" aria-hidden />
            <span className="text-[10px]">{busyField === field ? '…' : addLabel}</span>
          </button>
        ) : null}
      </div>
      <span className="mt-1 block text-xs text-slate-500">
        {photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? '' : 's'} stored` : 'No photos yet'}
      </span>
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">1 · Confirm Receipt</h3>
        <p className="mt-1 text-xs text-slate-500">
          Record physical receipt of the goods at the dock. Take vehicle photos + doc checklist. Assign
          this GRN to a specific person or leave Open.
        </p>
      </div>

      {/* Assignment */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <UserRound className="h-4 w-4" aria-hidden /> Assign to Person (for next steps)
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="grn-assignment-type">Assignment Type *</label>
            <select
              id="grn-assignment-type"
              value={assignmentType}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  assignmentType: e.target.value as GrnAssignmentType,
                  // Clearing the person when switching back to Open avoids a stale assignee.
                  ...(e.target.value === 'open' ? { assignedTo: null } : {}),
                })
              }
              className={inputClass}
            >
              <option value="open">🌐 Open · anyone in WH can proceed</option>
              <option value="specific">👤 Specific · accountable single owner</option>
            </select>
          </div>
          {assignmentType === 'specific' ? (
            <div>
              <label className={labelClass} htmlFor="grn-assignee">Assigned Person *</label>
              <select
                id="grn-assignee"
                value={value.assignedTo ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ assignedTo: e.target.value || null })}
                className={inputClass}
              >
                <option value="">Select person…</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Open = any WH team member picks up · faster · shared responsibility. Specific = accountable
          single owner · action buttons enabled only for that person's login.
        </p>
      </div>

      {/* Receipt details */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="grn-receipt-date">Receipt Date *</label>
          <input
            id="grn-receipt-date"
            type="date"
            value={value.receiptDate ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ receiptDate: e.target.value || null })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-receipt-time">Receipt Time *</label>
          <input
            id="grn-receipt-time"
            type="time"
            value={value.receiptTime ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ receiptTime: e.target.value || null })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-received-by">Received by</label>
          <select
            id="grn-received-by"
            value={value.receivedBy ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ receivedBy: e.target.value || null })}
            className={inputClass}
          >
            <option value="">Select person…</option>
            {/* Keep a previously-saved name selectable even if it's not in the current list. */}
            {value.receivedBy && !assignableUsers.some((u) => u.displayName === value.receivedBy) ? (
              <option value={value.receivedBy}>{value.receivedBy}</option>
            ) : null}
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.displayName}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-vehicle-no">Vehicle Number *</label>
          <input
            id="grn-vehicle-no"
            type="text"
            value={value.vehicleNumber ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ vehicleNumber: e.target.value.toUpperCase() || null })}
            placeholder="e.g. MH-04-XX-1234"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-driver-name">Driver Name</label>
          <input
            id="grn-driver-name"
            type="text"
            value={value.driverName ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ driverName: e.target.value || null })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-driver-phone">Driver Phone</label>
          <input
            id="grn-driver-phone"
            type="tel"
            inputMode="tel"
            value={value.driverPhone ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ driverPhone: e.target.value || null })}
            placeholder="+91"
            className={inputClass}
          />
        </div>
      </div>

      {/* Document checklist */}
      <div className="mb-4">
        <span className={labelClass}>Document Checklist *</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GRN_RECEIPT_CHECKLIST_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={!!(value.checklist ?? {})[item.key]}
                disabled={disabled}
                onChange={() => toggleChecklist(item.key)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {/* Photos — compressed and stored inline for reference */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {renderPhotoField(
          'vehiclePhotos',
          vehiclePhotos,
          vehiclePhotoRef,
          <>Vehicle Photos * · min {GRN_RECEIPT_MIN_VEHICLE_PHOTOS} (front + goods)</>,
          'Add',
        )}
        {renderPhotoField('documentPhotos', documentPhotos, docPhotoRef, <>Document Photos</>, 'Add')}
      </div>

      {/* Remarks */}
      <div>
        <label className={labelClass} htmlFor="grn-receipt-remarks">Receipt Remarks</label>
        <textarea
          id="grn-receipt-remarks"
          value={value.remarks ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ remarks: e.target.value || null })}
          rows={2}
          placeholder="Any visible damage · shortage · special notes"
          className={inputClass}
        />
      </div>
    </section>
  );
};
