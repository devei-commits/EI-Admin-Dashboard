/**
 * BD Management — top-level tab vocabulary (5 tabs, §2 of the spec).
 * The page host reads/writes the active tab via a `?tab=` URL query param so a
 * tab is shareable/bookmarkable, mirroring the procurement nav pattern.
 */
import type { LucideIcon } from 'lucide-react';
import { Users, HelpCircle, Flag, CalendarClock, BarChart3 } from 'lucide-react';

export type BdTab = 'Customer Tracker' | 'Queries' | 'Grievances' | 'Meetings' | 'Analytics';

export interface BdNavItem { key: BdTab; icon: LucideIcon; param: string; hint: string; }

export const BD_NAV: BdNavItem[] = [
  { key: 'Customer Tracker', icon: Users,        param: 'tracker',    hint: 'One row per client — health at a glance' },
  { key: 'Queries',          icon: HelpCircle,   param: 'queries',    hint: 'Customer questions & their SLAs' },
  { key: 'Grievances',       icon: Flag,         param: 'grievances', hint: 'Complaints, root cause & CAPA' },
  { key: 'Meetings',         icon: CalendarClock, param: 'meetings',  hint: 'Scheduling, MoM & follow-ups' },
  { key: 'Analytics',        icon: BarChart3,    param: 'analytics',  hint: 'CLV, tiers, TAT & sales mix' },
];

export const BD_TABS: BdTab[] = BD_NAV.map((n) => n.key);

export function bdTabFromParam(param: string | null | undefined): BdTab {
  const found = BD_NAV.find((n) => n.param === param);
  return found ? found.key : 'Customer Tracker';
}
export function bdParamFromTab(tab: BdTab): string {
  return (BD_NAV.find((n) => n.key === tab) || BD_NAV[0]).param;
}
