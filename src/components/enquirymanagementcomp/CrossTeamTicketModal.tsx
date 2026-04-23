import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Ticket, TicketCategory, TicketCollaboration, TicketPriority } from '../../types/ticket.types';

type TeamOpt = { id: string; name: string };
type AreaOpt = { id: string; label: string };

type UserSearchRow = {
 userid: number;
 display_name?: string | null;
 email?: string | null;
 role_name?: string | null;
};

interface CrossTeamTicketModalProps {
 open: boolean;
 onClose: () => void;
 onCreated: (ticket: Ticket) => void;
}

const INTERNAL_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

const INTERNAL_CATEGORIES: { value: TicketCategory; label: string }[] = [
 { value: 'pis-issue', label: 'PIS issue (product data / master)' },
 { value: 'order-issue', label: 'Order / fulfillment' },
 { value: 'delivery-issue', label: 'Delivery / logistics' },
 { value: 'payment-issue', label: 'Payment / finance' },
 { value: 'product-inquiry', label: 'Product / formulation' },
 { value: 'technical-support', label: 'Systems / technical' },
 { value: 'other', label: 'Other' },
];

export const CrossTeamTicketModal: React.FC<CrossTeamTicketModalProps> = ({
 open,
 onClose,
 onCreated,
}) => {
 const { user } = useAuth();
 const [subject, setSubject] = useState('');
 const [description, setDescription] = useState('');
 const [category, setCategory] = useState<TicketCategory>('pis-issue');
 const [priority, setPriority] = useState<TicketPriority>('medium');
 const [teams, setTeams] = useState<TeamOpt[]>([]);
 const [issueAreas, setIssueAreas] = useState<AreaOpt[]>([]);
 const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
 const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set(['pis']));
 const [staffOptions, setStaffOptions] = useState<UserSearchRow[]>([]);
 const [memberSearch, setMemberSearch] = useState('');
 const [selectedMembers, setSelectedMembers] = useState<UserSearchRow[]>([]);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const loadMeta = useCallback(async () => {
  try {
   const res = await api.get<{
    success?: boolean;
    data?: { crossTeamTeams?: TeamOpt[]; issueAreas?: AreaOpt[] };
   }>('/api/v1/enquiries/types');
   const d = res?.data;
   if (d && typeof d === 'object') {
    if (Array.isArray(d.crossTeamTeams)) setTeams(d.crossTeamTeams);
    if (Array.isArray(d.issueAreas)) setIssueAreas(d.issueAreas);
   }
  } catch {
   setTeams([]);
   setIssueAreas([]);
  }
 }, []);

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
  void loadMeta();
  void loadUsers();
  setError(null);
 }, [open, loadMeta, loadUsers]);

 const filteredStaff = useMemo(() => {
  const q = memberSearch.trim().toLowerCase();
  if (!q) return staffOptions.slice(0, 80);
  return staffOptions.filter((u) => {
   const name = (u.display_name || '').toLowerCase();
   const email = (u.email || '').toLowerCase();
   return name.includes(q) || email.includes(q) || String(u.userid).includes(q);
  }).slice(0, 40);
 }, [staffOptions, memberSearch]);

 const toggleTeam = (id: string) => {
  setSelectedTeamIds((prev) => {
   const next = new Set(prev);
   if (next.has(id)) next.delete(id);
   else next.add(id);
   return next;
  });
 };

 const toggleArea = (id: string) => {
  setSelectedAreaIds((prev) => {
   const next = new Set(prev);
   if (next.has(id)) next.delete(id);
   else next.add(id);
   return next;
  });
 };

 const addMember = (u: UserSearchRow) => {
  if (selectedMembers.some((m) => m.userid === u.userid)) return;
  setSelectedMembers((prev) => [...prev, u]);
  setMemberSearch('');
 };

 const removeMember = (userid: number) => {
  setSelectedMembers((prev) => prev.filter((m) => m.userid !== userid));
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) {
   setError('You must be signed in to raise an internal ticket.');
   return;
  }
  if (!subject.trim()) {
   setError('Subject is required.');
   return;
  }
  setSubmitting(true);
  setError(null);
  try {
   const collaboration: TicketCollaboration = {
    taggedMembers: selectedMembers.map((m) => ({
     userid: m.userid,
     displayName: m.display_name ?? null,
     email: m.email ?? null,
    })),
    taggedTeams: teams
     .filter((t) => selectedTeamIds.has(t.id))
     .map((t) => ({ id: t.id, name: t.name })),
    issueAreas: Array.from(selectedAreaIds),
   };

   const res = await api.post<{ success?: boolean; data?: Ticket; message?: string }>(
    '/api/v1/enquiries',
    {
     subject: subject.trim(),
     description: description.trim() || '',
     category,
     priority,
     ticket_scope: 'internal',
     source: 'internal-cross-team',
     collaboration,
     customer: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: '',
      isRegistered: true,
     },
    }
   );

   if (res?.success && res.data) {
    onCreated(res.data);
    setSubject('');
    setDescription('');
    setCategory('pis-issue');
    setPriority('medium');
    setSelectedTeamIds(new Set());
    setSelectedAreaIds(new Set(['pis']));
    setSelectedMembers([]);
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
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 bg-black/45" onClick={() => !submitting && onClose()} />
   <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
     <div>
      <h2 className="text-lg font-semibold text-gray-900">Cross-team ticket</h2>
      <p className="text-sm text-gray-500 mt-0.5">
       Raise an internal issue, tag teams and colleagues, and flag PIS or other areas.
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

    <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-5">
     {error && (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
     )}

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
      <input
       type="text"
       value={subject}
       onChange={(e) => setSubject(e.target.value)}
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
       placeholder="Short summary for other teams"
       maxLength={500}
      />
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
      <textarea
       value={description}
       onChange={(e) => setDescription(e.target.value)}
       rows={4}
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
       placeholder="Context, links, SKU/PIS codes, what you need from which team…"
      />
     </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
       <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
       <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
       >
        {INTERNAL_CATEGORIES.map((c) => (
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
       >
        {INTERNAL_PRIORITIES.map((p) => (
         <option key={p} value={p}>
          {p}
         </option>
        ))}
       </select>
      </div>
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Tag teams</label>
      <div className="flex flex-wrap gap-2">
       {teams.length === 0 ? (
        <span className="text-sm text-gray-500">Loading teams…</span>
       ) : (
        teams.map((t) => (
         <button
          key={t.id}
          type="button"
          onClick={() => toggleTeam(t.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
           selectedTeamIds.has(t.id)
            ? 'border-violet-600 bg-violet-50 text-violet-900'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
         >
          {t.name}
         </button>
        ))
       )}
      </div>
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Issue areas</label>
      <p className="text-xs text-gray-500 mb-2">Include <strong>PIS</strong> when the issue relates to product master data, codes, or formulations.</p>
      <div className="flex flex-wrap gap-2">
       {issueAreas.length === 0 ? (
        <span className="text-sm text-gray-500">Loading…</span>
       ) : (
        issueAreas.map((a) => (
         <button
          key={a.id}
          type="button"
          onClick={() => toggleArea(a.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
           selectedAreaIds.has(a.id)
            ? a.id === 'pis'
             ? 'border-amber-500 bg-amber-50 text-amber-900'
             : 'border-slate-700 bg-slate-50 text-slate-900'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
         >
          {a.label}
         </button>
        ))
       )}
      </div>
     </div>

     <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Tag people</label>
      <input
       type="text"
       value={memberSearch}
       onChange={(e) => setMemberSearch(e.target.value)}
       placeholder="Search by name or email…"
       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2"
      />
      {memberSearch.trim().length >= 1 && filteredStaff.length > 0 && (
       <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
        {filteredStaff.map((u) => (
         <button
          key={u.userid}
          type="button"
          onClick={() => addMember(u)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white"
         >
          <span>{u.display_name || u.email || `User ${u.userid}`}</span>
          <span className="text-xs text-gray-500">{u.role_name || ''}</span>
         </button>
        ))}
       </div>
      )}
      {selectedMembers.length > 0 && (
       <div className="mt-2 flex flex-wrap gap-2">
        {selectedMembers.map((m) => (
         <span
          key={m.userid}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800"
         >
          {m.display_name || m.email}
          <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => removeMember(m.userid)}>
           ×
          </button>
         </span>
        ))}
       </div>
      )}
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
  </div>
 );
};

export default CrossTeamTicketModal;
