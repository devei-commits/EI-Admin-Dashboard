import React, { useCallback, useEffect, useState } from 'react';
import api from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Ticket, TicketCategory, TicketPriority } from '../../types/ticket.types';
import { ModalOverlay } from '../ui/ModalOverlay';

type UserSearchRow = {
 userid: number;
 display_name?: string | null;
 email?: string | null;
 role_name?: string | null;
};

type PortalCustomerRow = {
 userid: number;
 display_name?: string | null;
 email?: string | null;
 mobile?: string | null;
 role_name?: string | null;
 vendor_client_code?: string | null;
};

interface CreateCustomerTicketModalProps {
 open: boolean;
 onClose: () => void;
 onCreated: (ticket: Ticket) => void;
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
 { value: 'product-inquiry', label: 'Product inquiry' },
 { value: 'order-issue', label: 'Order issue' },
 { value: 'delivery-issue', label: 'Delivery' },
 { value: 'payment-issue', label: 'Payment' },
 { value: 'quotation-request', label: 'Quotation' },
 { value: 'partnership', label: 'Partnership' },
 { value: 'pis-issue', label: 'PIS issue' },
 { value: 'refund', label: 'Refund' },
 { value: 'other', label: 'Other' },
];

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

const CreateCustomerTicketModal: React.FC<CreateCustomerTicketModalProps> = ({
 open,
 onClose,
 onCreated,
}) => {
 const { user } = useAuth();
 const [subject, setSubject] = useState('');
 const [description, setDescription] = useState('');
 const [category, setCategory] = useState<TicketCategory>('product-inquiry');
 const [priority, setPriority] = useState<TicketPriority>('medium');
 const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>('registered');
 const [customerQuery, setCustomerQuery] = useState('');
 const [customerResults, setCustomerResults] = useState<PortalCustomerRow[]>([]);
 const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
 const [selectedCustomer, setSelectedCustomer] = useState<PortalCustomerRow | null>(null);
 const [customerName, setCustomerName] = useState('');
 const [customerEmail, setCustomerEmail] = useState('');
 const [customerPhone, setCustomerPhone] = useState('');
 const [staffOptions, setStaffOptions] = useState<UserSearchRow[]>([]);
 const [assigneeUserId, setAssigneeUserId] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const loadUsers = useCallback(async () => {
  try {
   const users = await api.get<UserSearchRow[]>('/api/v1/users/search');
   setStaffOptions(Array.isArray(users) ? users : []);
  } catch {
   setStaffOptions([]);
  }
 }, []);

 useEffect(() => {
  if (!open) return;
  void loadUsers();
  setError(null);
  setCustomerMode('registered');
  setCustomerQuery('');
  setCustomerResults([]);
  setSelectedCustomer(null);
  setCustomerName('');
  setCustomerEmail('');
  setCustomerPhone('');
 }, [open, loadUsers]);

 useEffect(() => {
  if (!open || customerMode !== 'registered') {
   setCustomerResults([]);
   setCustomerSearchLoading(false);
   return;
  }
  const q = customerQuery.trim();
  if (q.length < 2) {
   setCustomerResults([]);
   setCustomerSearchLoading(false);
   return;
  }
  setCustomerSearchLoading(true);
  const t = window.setTimeout(() => {
   void (async () => {
    try {
     const rows = await api.get<PortalCustomerRow[]>(
      `/api/v1/users/search-portal-customers?q=${encodeURIComponent(q)}`
     );
     setCustomerResults(Array.isArray(rows) ? rows : []);
    } catch {
     setCustomerResults([]);
    } finally {
     setCustomerSearchLoading(false);
    }
   })();
  }, 300);
  return () => window.clearTimeout(t);
 }, [customerQuery, customerMode, open]);

 const pickCustomer = (row: PortalCustomerRow) => {
  setSelectedCustomer(row);
  const name =
   (row.display_name && row.display_name.trim()) ||
   (row.email ? row.email.split('@')[0] : '') ||
   `User ${row.userid}`;
  setCustomerName(name);
  setCustomerEmail((row.email || '').trim());
  setCustomerPhone((row.mobile || '').trim());
  setCustomerQuery('');
  setCustomerResults([]);
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) {
   setError('You must be signed in.');
   return;
  }
  if (!subject.trim()) {
   setError('Subject is required.');
   return;
  }
  if (customerMode === 'registered') {
   if (!selectedCustomer) {
    setError('Search and select a registered customer so the ticket appears on their website account.');
    return;
   }
  } else if (!customerName.trim() || !customerEmail.trim()) {
   setError('Customer name and email are required for a guest ticket.');
   return;
  }
  if (!assigneeUserId) {
   setError('Please select who this ticket is assigned to before creating it.');
   return;
  }
  const assignee = staffOptions.find((u) => String(u.userid) === assigneeUserId);
  if (!assignee) {
   setError('Selected assignee is no longer available. Refresh and try again.');
   return;
  }
  const actor =
   (user.name && user.name.trim()) || (user.email && user.email.trim()) || `user:${user.id}`;
  setSubmitting(true);
  setError(null);
  try {
   const isRegistered = customerMode === 'registered';
   const customerPayload = {
    name: customerName.trim(),
    email: customerEmail.trim(),
    phone: customerPhone.trim() || '',
    company:
     isRegistered && selectedCustomer?.vendor_client_code
      ? selectedCustomer.vendor_client_code
      : null,
    isRegistered,
   };
   const body: Record<string, unknown> = {
    subject: subject.trim(),
    description: description.trim() || '',
    category,
    priority,
    ticket_scope: 'customer',
    source: isRegistered ? 'admin-dashboard' : 'other',
    customer: customerPayload,
    current_assignee: {
     staffId: String(assignee.userid),
     staffName: (assignee.display_name || assignee.email || `User ${assignee.userid}`).trim(),
     staffEmail: assignee.email || '',
     department: assignee.role_name || 'General',
     assignedAt: new Date().toISOString(),
     assignedBy: actor,
     isActive: true,
    },
   };
   if (isRegistered && selectedCustomer) {
    body.customer_user_id = selectedCustomer.userid;
   }
   const res = await api.post<{ success?: boolean; data?: Ticket; message?: string }>(
    '/api/v1/enquiries',
    body
   );
   if (res?.success && res.data) {
    onCreated(res.data);
    setSubject('');
    setDescription('');
    setCategory('product-inquiry');
    setPriority('medium');
    setCustomerMode('registered');
    setCustomerQuery('');
    setCustomerResults([]);
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setAssigneeUserId('');
    onClose();
   } else {
    setError(typeof res?.message === 'string' ? res.message : 'Could not create ticket');
   }
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Request failed');
  } finally {
   setSubmitting(false);
  }
 };

 if (!open) return null;

 return (
  <ModalOverlay onClose={() => { if (!submitting) onClose(); }} z="z-50" dismissable={true} backdrop="default">
   <div role="dialog" aria-modal="true" aria-labelledby="create-customer-ticket-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
     <div>
      <h2 id="create-customer-ticket-title" className="text-lg font-semibold text-gray-900">New customer ticket</h2>
      <p className="text-sm text-gray-500 mt-0.5">
       Link a portal customer so the ticket shows on their site, or use guest details for callers without an account.
      </p>
     </div>
     <button
      type="button"
      disabled={submitting}
      onClick={onClose}
      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      aria-label="Close"
     >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
     {error && (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
     )}

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
      <input
       type="text"
       value={subject}
       onChange={(e) => setSubject(e.target.value)}
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
       maxLength={500}
       aria-label="Subject"
      />
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
      <textarea
       value={description}
       onChange={(e) => setDescription(e.target.value)}
       rows={3}
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
       aria-label="Description"
      />
     </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
       <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
       <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        aria-label="Category"
       >
        {CATEGORIES.map((c) => (
         <option key={c.value} value={c.value}>
          {c.label}
         </option>
        ))}
       </select>
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
       <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TicketPriority)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        aria-label="Priority"
       >
        {PRIORITIES.map((p) => (
         <option key={p} value={p}>
          {p}
         </option>
        ))}
       </select>
      </div>
     </div>

     <div className="border-t border-gray-100 pt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
      <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-sm">
       <button
        type="button"
        onClick={() => {
         setCustomerMode('registered');
         setSelectedCustomer(null);
         setCustomerName('');
         setCustomerEmail('');
         setCustomerPhone('');
         setError(null);
        }}
        className={`flex-1 rounded-md py-1.5 font-medium ${
         customerMode === 'registered' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
        }`}
       >
        Registered (website)
       </button>
       <button
        type="button"
        onClick={() => {
         setCustomerMode('guest');
         setSelectedCustomer(null);
         setCustomerQuery('');
         setCustomerResults([]);
         setError(null);
        }}
        className={`flex-1 rounded-md py-1.5 font-medium ${
         customerMode === 'guest' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
        }`}
       >
        Guest
       </button>
      </div>

      {customerMode === 'registered' ? (
       <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Find customer *</label>
        <input
         type="search"
         value={customerQuery}
         onChange={(e) => setCustomerQuery(e.target.value)}
         placeholder="Type at least 2 characters (name or email)"
         className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
         autoComplete="off"
         aria-label="Find customer"
        />
        {customerSearchLoading && (
         <p className="text-xs text-gray-500">Searching…</p>
        )}
        {!customerSearchLoading && customerQuery.trim().length >= 2 && customerResults.length === 0 && (
         <p className="text-xs text-gray-500">No matches. Try another email or name.</p>
        )}
        {customerResults.length > 0 && (
         <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
          {customerResults.map((row) => (
           <li key={row.userid}>
            <button
             type="button"
             onClick={() => pickCustomer(row)}
             className="w-full text-left px-3 py-2 hover:bg-slate-50"
            >
             <span className="font-medium text-gray-900">
              {row.display_name || row.email || `User ${row.userid}`}
             </span>
             <span className="block text-xs text-gray-500">{row.email}</span>
             {row.vendor_client_code ? (
              <span className="block text-xs text-gray-400">{row.vendor_client_code}</span>
             ) : null}
            </button>
           </li>
          ))}
         </ul>
        )}
        {selectedCustomer && (
         <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
          <p className="font-medium text-emerald-900">Selected</p>
          <p className="text-emerald-800">
           {customerName} · {customerEmail}
           {customerPhone ? ` · ${customerPhone}` : ''}
          </p>
          <button
           type="button"
           className="mt-1 text-xs text-emerald-700 underline"
           onClick={() => {
            setSelectedCustomer(null);
            setCustomerName('');
            setCustomerEmail('');
            setCustomerPhone('');
           }}
          >
           Clear selection
          </button>
         </div>
        )}
       </div>
      ) : (
       <>
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
         <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Name"
         />
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
         <input
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Email"
         />
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
         <input
          type="text"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Phone"
         />
        </div>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
         Guest tickets are not tied to a website login and will not appear on the client portal.
        </p>
       </>
      )}
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Assign to *</label>
      <select
       value={assigneeUserId}
       onChange={(e) => setAssigneeUserId(e.target.value)}
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
       required
       aria-label="Assign to"
      >
       <option value="">Select staff member…</option>
       {staffOptions.map((u) => (
        <option key={u.userid} value={String(u.userid)}>
         {(u.display_name || u.email || `User ${u.userid}`) +
          (u.role_name ? ` — ${u.role_name}` : '')}
        </option>
       ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">Required. You can change assignee later; previous assignees are kept in history.</p>
     </div>

     <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
      <button
       type="button"
       disabled={submitting}
       onClick={onClose}
       className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
       Cancel
      </button>
      <button
       type="submit"
       disabled={submitting}
       className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
       {submitting ? 'Creating…' : 'Create ticket'}
      </button>
     </div>
    </form>
   </div>
  </ModalOverlay>
 );
};

export default CreateCustomerTicketModal;
