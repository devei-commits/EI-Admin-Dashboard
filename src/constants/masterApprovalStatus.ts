/** Master registration approval workflow — RM, PM, PR. */
export const MASTER_APPROVAL_STATUSES = [
  'Draft',
  'Under Review',
  'Under Approval',
  'Active',
] as const;

export type MasterApprovalStatus = (typeof MASTER_APPROVAL_STATUSES)[number];

const LEGACY_STATUS_MAP: Record<string, MasterApprovalStatus> = {
  active: 'Active',
  draft: 'Draft',
  'under review': 'Under Review',
  'under-review': 'Under Review',
  'under approval': 'Under Approval',
  'under-approval': 'Under Approval',
};

export function normalizeMasterApprovalStatus(raw: unknown, fallback: MasterApprovalStatus = 'Draft'): MasterApprovalStatus {
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  const lower = s.toLowerCase();
  if (LEGACY_STATUS_MAP[lower]) return LEGACY_STATUS_MAP[lower];
  const found = MASTER_APPROVAL_STATUSES.find((x) => x.toLowerCase() === lower);
  if (found) return found;
  return fallback;
}

export function isMasterApprovalActive(raw: unknown): boolean {
  return normalizeMasterApprovalStatus(raw) === 'Active';
}

export function getNextMasterApprovalStatus(current: unknown): MasterApprovalStatus | null {
  const norm = normalizeMasterApprovalStatus(current);
  const idx = MASTER_APPROVAL_STATUSES.indexOf(norm);
  if (idx < 0 || idx >= MASTER_APPROVAL_STATUSES.length - 1) return null;
  return MASTER_APPROVAL_STATUSES[idx + 1] ?? null;
}

export function masterApprovalStatusBadgeClass(status: unknown): string {
  const s = normalizeMasterApprovalStatus(status);
  switch (s) {
    case 'Active':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Under Review':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Under Approval':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Draft':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

/** Suffix for picker labels — omit when already Active so lists stay readable. */
export function masterPickerLabelSuffix(status: unknown): string {
  const s = normalizeMasterApprovalStatus(status);
  return s === 'Active' ? '' : ` [${s}]`;
}

export type MasterApprovalKind = 'RM' | 'PM' | 'PR';

/** Stage assignee slots aligned with Draft → Under Review → Under Approval. */
export type MasterApprovalStageKey = 'drafter' | 'reviewer' | 'approver';

export type MasterApprovalStageSlot = {
  user_id: number;
  display_name: string;
  role_name: string | null;
} | null;

export type MasterApprovalStageAssignees = Record<MasterApprovalStageKey, MasterApprovalStageSlot>;

export const MASTER_APPROVAL_STAGES: ReadonlyArray<{
  key: MasterApprovalStageKey;
  label: string;
  emoji: string;
  workflowStatus: MasterApprovalStatus;
}> = [
  { key: 'drafter', label: 'Drafter', emoji: '🔵', workflowStatus: 'Draft' },
  { key: 'reviewer', label: 'Reviewer', emoji: '🟡', workflowStatus: 'Under Review' },
  { key: 'approver', label: 'Approver', emoji: '🟣', workflowStatus: 'Under Approval' },
];

export function emptyStageAssignees(): MasterApprovalStageAssignees {
  return { drafter: null, reviewer: null, approver: null };
}

export function normalizeStageAssignees(raw: unknown): MasterApprovalStageAssignees {
  const base = emptyStageAssignees();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const stage of MASTER_APPROVAL_STAGES) {
    const slot = o[stage.key];
    if (slot == null) {
      base[stage.key] = null;
      continue;
    }
    if (typeof slot !== 'object' || Array.isArray(slot)) continue;
    const s = slot as Record<string, unknown>;
    const id = parseInt(String(s.user_id ?? s.userId ?? ''), 10);
    if (!Number.isFinite(id) || id <= 0) {
      base[stage.key] = null;
      continue;
    }
    const display_name = String(s.display_name ?? s.displayName ?? `User #${id}`).trim();
    const role_name =
      s.role_name != null && String(s.role_name).trim() !== ''
        ? String(s.role_name).trim()
        : s.roleName != null && String(s.roleName).trim() !== ''
          ? String(s.roleName).trim()
          : null;
    base[stage.key] = { user_id: id, display_name, role_name };
  }
  return base;
}

export function formatStageAssigneeLabel(slot: MasterApprovalStageSlot): string {
  if (!slot?.user_id) return 'Open';
  return slot.role_name ? `${slot.display_name} · ${slot.role_name}` : slot.display_name;
}

export function stageKeyForCurrentStatus(status: unknown): MasterApprovalStageKey | null {
  const s = normalizeMasterApprovalStatus(status);
  const found = MASTER_APPROVAL_STAGES.find((x) => x.workflowStatus === s);
  return found?.key ?? null;
}

export function isAssignedForCurrentApprovalStage(
  currentUserId: string | number | undefined,
  currentStatus: unknown,
  assignees: MasterApprovalStageAssignees
): boolean {
  const stageKey = stageKeyForCurrentStatus(currentStatus);
  if (!stageKey) return false;
  const slot = assignees[stageKey];
  if (!slot?.user_id) return false;
  const me = parseInt(String(currentUserId ?? ''), 10);
  return Number.isFinite(me) && me === slot.user_id;
}

export function canActAtCurrentStage(
  isAdmin: boolean,
  hasTeamAccess: boolean,
  currentUserId: string | number | undefined,
  currentStatus: unknown,
  assignees: MasterApprovalStageAssignees
): boolean {
  if (isAdmin) return true;
  if (!hasTeamAccess) return false;
  return isAssignedForCurrentApprovalStage(currentUserId, currentStatus, assignees);
}

/** Tab filter on master list screens — `all` shows every row. */
export type MasterApprovalStatusTab = 'all' | MasterApprovalStatus;

export function matchesMasterApprovalStatusTab(raw: unknown, tab: MasterApprovalStatusTab): boolean {
  if (tab === 'all') return true;
  return normalizeMasterApprovalStatus(raw) === tab;
}

/** Per-tab counts for master list status tabs (includes `all`). */
export function buildMasterApprovalStatusCounts<T>(
  items: readonly T[],
  getStatus: (item: T) => unknown,
  extraTabIds: readonly string[] = []
): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };
  for (const s of MASTER_APPROVAL_STATUSES) counts[s] = 0;
  for (const id of extraTabIds) counts[id] = 0;

  for (const item of items) {
    const raw = getStatus(item);
    const rawStr = String(raw ?? '').trim();
    if (extraTabIds.includes(rawStr)) {
      counts[rawStr] = (counts[rawStr] ?? 0) + 1;
      continue;
    }
    const norm = normalizeMasterApprovalStatus(raw);
    if (norm in counts) counts[norm] = (counts[norm] ?? 0) + 1;
  }
  return counts;
}
