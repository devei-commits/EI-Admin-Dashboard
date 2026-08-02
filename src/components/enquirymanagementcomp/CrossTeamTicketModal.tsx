import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Ticket, TicketCategory, TicketCollaboration, TicketPriority } from '../../types/ticket.types';
import { ModalOverlay } from '../ui/ModalOverlay';

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
 /** Primary owner — required before ticket is created */
 const [primaryAssigneeId, setPrimaryAssigneeId] = useState('');
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
  if (!primaryAssigneeId) {
   setError('Please select who this ticket is assigned to before creating it.');
   return;
  }
  const primary = staffOptions.find((u) => String(u.userid) === primaryAssigneeId);
  if (!primary) {
   setError('Selected assignee is no longer in the list. Refresh and try again.');
   return;
  }
  const actor =
   (user.name && user.name.trim()) || (user.email && user.email.trim()) || `user:${user.id}`;
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
     current_assignee: {
      staffId: String(primary.userid),
      staffName: (primary.display_name || primary.email || `User ${primary.userid}`).trim(),
      staffEmail: primary.email || '',
      department: primary.role_name || 'Internal',
      assignedAt: new Date().toISOString(),
      assignedBy: actor,
      isActive: true,
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
    setPrimaryAssigneeId('');
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
   <div role="dialog" aria-modal="true" aria-labelledby="cross-team-ticket-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface px-5 py-4">
     <div>
      <h2 id="cross-team-ticket-title" className="text-lg font-semibold text-ink">Cross-team ticket</h2>
      <p className="text-sm text-ink-3 mt-0.5">
       Raise an internal issue, tag teams and colleagues, and flag PIS or other areas.
      </p>
     </div>
     <button
      type="button"
      disabled={submitting}
      onClick={onClose}
      className="rounded-lg p-2 text-ink-4 hover:bg-surface-3 hover:text-ink-2"
      aria-label="Close"
     >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-5">
     {error && (
      <div className="rounded-lg border border-err bg-err-soft px-3 py-2 text-sm text-err">{error}</div>
     )}

     <div>
      <label className="block text-sm font-medium text-ink-2 mb-1">Subject</label>
      <input
       type="text"
       value={subject}
       onChange={(e) => setSubject(e.target.value)}
       className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-slate-800 focus:ring-1 focus:ring-border"
       placeholder="Short summary for other teams"
       maxLength={500}
       aria-label="Subject"
      />
     </div>

     <div>
      <label className="block text-sm font-medium text-ink-2 mb-1">Description</label>
      <textarea
       value={description}
       onChange={(e) => setDescription(e.target.value)}
       rows={4}
       className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-slate-800 focus:ring-1 focus:ring-border"
       placeholder="Context, links, SKU/PIS codes, what you need from which team…"
       aria-label="Description"
      />
     </div>

     <div>
      <label className="block text-sm font-medium text-ink-2 mb-1">Assign to *</label>
      <select
       value={primaryAssigneeId}
       onChange={(e) => setPrimaryAssigneeId(e.target.value)}
       className="w-full rounded-lg border border-border px-3 py-2 text-sm"
       required
       aria-label="Assign to"
      >
       <option value="">Select primary assignee…</option>
       {staffOptions.map((u) => (
        <option key={u.userid} value={String(u.userid)}>
         {(u.display_name || u.email || `User ${u.userid}`) + (u.role_name ? ` — ${u.role_name}` : '')}
        </option>
       ))}
      </select>
      <p className="text-xs text-ink-3 mt-1">
       Required at creation. You can reassign later; previous assignees are kept in history.
      </p>
     </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
       <label className="block text-sm font-medium text-ink-2 mb-1">Category</label>
       <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        aria-label="Category"
       >
        {INTERNAL_CATEGORIES.map((c) => (
         <option key={c.value} value={c.value}>
          {c.label}
         </option>
        ))}
       </select>
      </div>
      <div>
       <label className="block text-sm font-medium text-ink-2 mb-1">Priority</label>
       <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TicketPriority)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        aria-label="Priority"
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
      <label className="block text-sm font-medium text-ink-2 mb-2">Tag teams</label>
      <div className="flex flex-wrap gap-2">
       {teams.length === 0 ? (
        <span className="text-sm text-ink-3">Loading teams…</span>
       ) : (
        teams.map((t) => (
         <button
          key={t.id}
          type="button"
          onClick={() => toggleTeam(t.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
           selectedTeamIds.has(t.id)
            ? 'border-violet-600 bg-violet-50 text-violet-900'
            : 'border-border bg-surface text-ink-2 hover:border-border'
          }`}
         >
          {t.name}
         </button>
        ))
       )}
      </div>
     </div>

     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">Issue areas</label>
      <p className="text-xs text-ink-3 mb-2">Include <strong>PIS</strong> when the issue relates to product master data, codes, or formulations.</p>
      <div className="flex flex-wrap gap-2">
       {issueAreas.length === 0 ? (
        <span className="text-sm text-ink-3">Loading…</span>
       ) : (
        issueAreas.map((a) => (
         <button
          key={a.id}
          type="button"
          onClick={() => toggleArea(a.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
           selectedAreaIds.has(a.id)
            ? a.id === 'pis'
             ? 'border-warn bg-warn-soft text-warn'
             : 'border-slate-700 bg-surface-2 text-ink'
            : 'border-border bg-surface text-ink-2 hover:border-border'
          }`}
         >
          {a.label}
         </button>
        ))
       )}
      </div>
     </div>

     <div>
      <label className="block text-sm font-medium text-ink-2 mb-1">Tag people</label>
      <input
       type="text"
       value={memberSearch}
       onChange={(e) => setMemberSearch(e.target.value)}
       placeholder="Search by name or email…"
       className="w-full rounded-lg border border-border px-3 py-2 text-sm mb-2"
       aria-label="Tag people"
      />
      {memberSearch.trim().length >= 1 && filteredStaff.length > 0 && (
       <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-surface-2">
        {filteredStaff.map((u) => (
         <button
          key={u.userid}
          type="button"
          onClick={() => addMember(u)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
         >
          <span>{u.display_name || u.email || `User ${u.userid}`}</span>
          <span className="text-xs text-ink-3">{u.role_name || ''}</span>
         </button>
        ))}
       </div>
      )}
      {selectedMembers.length > 0 && (
       <div className="mt-2 flex flex-wrap gap-2">
        {selectedMembers.map((m) => (
         <span
          key={m.userid}
          className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-1 text-xs text-ink"
         >
          {m.display_name || m.email}
          <button type="button" className="text-ink-3 hover:text-err" onClick={() => removeMember(m.userid)}>
           ×
          </button>
         </span>
        ))}
       </div>
      )}
     </div>

     <div className="flex justify-end gap-2 border-t border-hairline pt-4">
      <button
       type="button"
       disabled={submitting}
       onClick={onClose}
       className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
      >
       Cancel
      </button>
      <button
       type="submit"
       disabled={submitting}
       className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
      >
       {submitting ? 'Creating…' : 'Create ticket'}
      </button>
     </div>
    </form>
   </div>
  </ModalOverlay>
 );
};

export default CrossTeamTicketModal;
