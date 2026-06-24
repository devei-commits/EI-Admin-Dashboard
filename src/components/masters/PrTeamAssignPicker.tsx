import { useEffect, useMemo, useState } from 'react';
import {
  formatStageAssigneeLabel,
  type MasterApprovalStageKey,
  type MasterApprovalStageSlot,
} from '../../constants/masterApprovalStatus';
import { searchUsers, type UserSearchHit } from '../../services/user.service';

function slotFromUser(user: UserSearchHit): MasterApprovalStageSlot {
  return {
    user_id: user.userid,
    display_name: user.display_name,
    role_name: user.role_name ?? null,
  };
}

function filterStaffPool(pool: UserSearchHit[], query: string): UserSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, 50);
  return pool
    .filter((u) => {
      const name = u.display_name.toLowerCase();
      const email = u.email.toLowerCase();
      const role = (u.role_name ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    })
    .slice(0, 50);
}

export type PrTeamAssignPickerProps = {
  teamKey: MasterApprovalStageKey;
  label: string;
  emoji: string;
  slot: MasterApprovalStageSlot;
  disabled?: boolean;
  fieldId: string;
  onChange: (next: MasterApprovalStageSlot) => void;
};

export function PrTeamAssignPicker({
  teamKey,
  label,
  emoji,
  slot,
  disabled = false,
  fieldId,
  onChange,
}: PrTeamAssignPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [staffPool, setStaffPool] = useState<UserSearchHit[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);

  const results = useMemo(() => filterStaffPool(staffPool, query), [staffPool, query]);
  const isRm = teamKey === 'rm_team';
  const borderAccent = isRm ? 'border-indigo-200' : 'border-violet-200';
  const bgAccent = isRm ? 'bg-indigo-50/40' : 'bg-violet-50/40';
  const ringAccent = isRm ? 'focus:ring-indigo-400' : 'focus:ring-violet-400';
  const hoverAccent = isRm ? 'hover:bg-indigo-50' : 'hover:bg-violet-50';

  useEffect(() => {
    let cancelled = false;
    setStaffLoading(true);
    setStaffLoadError(null);
    void searchUsers('').then((res) => {
      if (cancelled) return;
      setStaffLoading(false);
      if (res.success && res.data) {
        setStaffPool(res.data);
      } else {
        setStaffPool([]);
        setStaffLoadError(
          typeof res.error === 'object' && res.error && 'message' in res.error
            ? String((res.error as { message?: string }).message)
            : 'Could not load team members'
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className={`rounded-xl border ${borderAccent} ${bgAccent} p-4 space-y-3`}
      aria-labelledby={`${fieldId}-heading`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${fieldId}-heading`} className="text-sm font-bold text-gray-900">
            <span aria-hidden="true">{emoji} </span>
            {label}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {slot?.user_id ? 'Assigned — only this person can sign for this team' : 'Open — any PR approver may sign'}
          </p>
        </div>
        {slot?.user_id ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setQuery('');
              setOpen(false);
            }}
            className="shrink-0 text-xs font-semibold text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Set open
          </button>
        ) : (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">Open</span>
        )}
      </div>

      {slot?.user_id ? (
        <div className="rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">{slot.display_name}</p>
          {slot.role_name ? <p className="text-xs text-gray-500 mt-0.5">{slot.role_name}</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={fieldId} className="block text-xs font-medium text-gray-700">
            Search team member
          </label>
          <input
            id={fieldId}
            type="search"
            value={query}
            disabled={disabled}
            placeholder={`Search ${label.toLowerCase()}…`}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 ${ringAccent} disabled:opacity-60`}
            autoComplete="off"
          />
          {open ? (
            <ul
              role="listbox"
              aria-label={`${label} suggestions`}
              className="w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-md text-sm"
            >
              {staffLoading ? (
                <li className="px-3 py-2 text-gray-500">Loading team members…</li>
              ) : staffLoadError ? (
                <li className="px-3 py-2 text-red-600" role="alert">
                  {staffLoadError}
                </li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2 text-gray-500">
                  {query.trim() ? 'No matches' : 'No internal team members found'}
                </li>
              ) : (
                results.map((u) => (
                  <li key={u.userid}>
                    <button
                      type="button"
                      role="option"
                      className={`w-full text-left px-3 py-2 ${hoverAccent} focus:outline-none`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(slotFromUser(u));
                        setQuery('');
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-gray-900">{u.display_name}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {[u.role_name, u.email].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
