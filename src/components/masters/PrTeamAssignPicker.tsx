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
  const borderAccent = isRm ? 'border-brand-soft' : 'border-brand-soft';
  const bgAccent = isRm ? 'bg-brand-soft' : 'bg-brand-soft';
  const ringAccent = isRm ? 'focus:ring-[color:var(--ring)]' : 'focus:ring-[color:var(--ring)]';
  const hoverAccent = isRm ? 'hover:bg-brand-soft' : 'hover:bg-brand-soft';

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
          <h3 id={`${fieldId}-heading`} className="text-sm font-bold text-ink">
            <span aria-hidden="true">{emoji} </span>
            {label}
          </h3>
          <p className="text-xs text-ink-3 mt-0.5">
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
            className="shrink-0 text-xs font-semibold text-ink-3 hover:text-ink underline-offset-2 hover:underline disabled:opacity-50"
          >
            Set open
          </button>
        ) : (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-4">Open</span>
        )}
      </div>

      {slot?.user_id ? (
        <div className="rounded-lg border border-white bg-surface px-3 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-ink">{slot.display_name}</p>
          {slot.role_name ? <p className="text-xs text-ink-3 mt-0.5">{slot.role_name}</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={fieldId} className="block text-xs font-medium text-ink-2">
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
            className={`w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 ${ringAccent} disabled:opacity-60`}
            autoComplete="off"
          />
          {open ? (
            <ul
              role="listbox"
              aria-label={`${label} suggestions`}
              className="w-full max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-md text-sm"
            >
              {staffLoading ? (
                <li className="px-3 py-2 text-ink-3">Loading team members…</li>
              ) : staffLoadError ? (
                <li className="px-3 py-2 text-err" role="alert">
                  {staffLoadError}
                </li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2 text-ink-3">
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
                      <span className="font-medium text-ink">{u.display_name}</span>
                      <span className="block text-xs text-ink-3 truncate">
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
