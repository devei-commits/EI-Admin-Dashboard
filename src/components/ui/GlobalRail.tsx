import { useState, useCallback, useRef } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent, FocusEvent as ReactFocusEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon } from '@phosphor-icons/react';
import { LogOut, ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import eilogofull from '../../assets/logo/eilogofull.svg';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { isSuperAdmin } from '../SuperAdminRoute';
import { preloadRoute } from '../../lib/preloadRoutes';
import { getStoredTheme, toggleTheme, type ThemeMode } from '../../lib/themeMode';

/**
 * GlobalRail — the ONE persistent global navigation for every route.
 *
 * A thin (w-16) icon rail on md+ with hover/focus flyout panels for grouped
 * modules; a full drawer on mobile. Replaces the old fat Sidebar + the
 * hidden hamburger-drawer that standalone module routes used, so global nav
 * is always visible ("rail + panel"): rail → module section panel → content.
 *
 * IA + permission gates mirror Sidebar.tsx exactly.
 */

const P = {
  dashboard:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  shield:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  user: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  building:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  clipboard:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  cube: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  masters:
    'M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z',
  currency:
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  warehouse:
    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  planning:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  beaker:
    'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  box: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  clients: 'M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM4.318 20H3v-2a6 6 0 018-5.656',
  bd: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z',
  catalogue:
    'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  grid: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  atom: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  badge:
    'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  folder: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  swap: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  usersRing: 'M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.697M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  docChart: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
} as const;

const Icon = ({ d, className }: { d: string; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={d} />
  </svg>
);

type Leaf = { label: string; to: string; icon: string; show: boolean };
type NavItem =
  | { kind: 'link'; label: string; to: string; icon: string; show: boolean }
  | { kind: 'group'; label: string; to?: string; icon: string; show: boolean; children: Leaf[] };

/** NavLink that preloads its lazy chunk on hover. */
const RailLink = ({ to, className, children, onClick }: {
  to: string;
  className: (a: { isActive: boolean }) => string;
  children: ReactNode;
  onClick?: () => void;
}) => (
  <NavLink to={to} className={className} onMouseEnter={() => preloadRoute(to)} onClick={onClick} end={to === '/'}>
    {children}
  </NavLink>
);

const GlobalRail = ({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasModuleAccess, isAdmin } = usePermissions();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

  const can = useCallback((m: string) => isAdmin || hasModuleAccess(m), [isAdmin, hasModuleAccess]);

  const items: NavItem[] = [
    { kind: 'link', label: 'Dashboard', to: '/', icon: P.dashboard, show: can('dashboard') },
    { kind: 'link', label: 'Role Management', to: '/role-management', icon: P.shield, show: can('role-management') },
    { kind: 'link', label: 'User Management', to: '/user-management', icon: P.user, show: can('user-management') },
    { kind: 'link', label: 'Facility Management', to: '/facility-management', icon: P.building, show: can('order-management') },
    {
      kind: 'group', label: 'Order Management', icon: P.clipboard, show: can('order-management'),
      children: [
        { label: 'Procurement', to: '/procurement', icon: P.bolt, show: true },
        { label: 'Warehouse', to: '/warehouse', icon: P.warehouse, show: true },
        { label: 'Quality', to: '/quality', icon: P.shield, show: true },
        { label: 'Planning', to: '/planning', icon: P.planning, show: true },
        { label: 'Production', to: '/production', icon: P.beaker, show: true },
        { label: 'Fulfillment', to: '/fulfillment', icon: P.box, show: true },
        { label: 'Client Hub', to: '/client-hub', icon: P.clients, show: true },
        { label: 'BD Management', to: '/bd', icon: P.bd, show: true },
      ],
    },
    {
      kind: 'group', label: 'Product Management', to: '/catalogue-management', icon: P.cube,
      show: can('catalogue-management') || can('packaging-management') || can('active-ingredients'),
      children: [
        { label: 'Catalogue Management', to: '/catalogue-management', icon: P.catalogue, show: can('catalogue-management') },
        { label: 'Packaging Management', to: '/packaging-management', icon: P.cube, show: can('packaging-management') },
        { label: 'Customize packaging (website)', to: '/customization-packaging-catalog', icon: P.grid, show: can('packaging-management') },
        { label: 'Active Ingredients', to: '/active-ingredients', icon: P.beaker, show: can('active-ingredients') },
        { label: 'Customization Catalog', to: '/customization-catalog', icon: P.beaker, show: can('active-ingredients') },
      ],
    },
    {
      kind: 'group', label: 'Masters', icon: P.masters,
      show: can('inventory') || can('vendor-client') || isSuperAdmin(user?.roleName),
      children: [
        { label: 'Raw Materials', to: '/raw-material', icon: P.atom, show: can('inventory') },
        { label: 'Packaging', to: '/packaging', icon: P.cube, show: can('inventory') },
        { label: 'Products (PR)', to: '/bom', icon: P.badge, show: can('inventory') },
        { label: 'Item Groups', to: '/item-groups', icon: P.folder, show: can('inventory') },
        { label: 'Quality Spec Rules', to: '/quality-spec-rules', icon: P.checkCircle, show: can('inventory') },
        { label: 'Universal Swap', to: '/universal-swap', icon: P.swap, show: can('inventory') },
        { label: 'Vendors and Client', to: '/vendor-client', icon: P.usersRing, show: can('vendor-client') },
        { label: 'Price List', to: '/items-list', icon: P.doc, show: can('inventory') },
        { label: 'Quotations', to: '/quotations', icon: P.docChart, show: isSuperAdmin(user?.roleName) },
      ],
    },
    { kind: 'link', label: 'Treasury', to: '/treasury', icon: P.currency, show: can('treasury') },
    {
      kind: 'group', label: 'Enquiry Management', to: '/enquiry-management', icon: P.chat,
      show: can('enquiry-management') || can('doctor-appointments') || can('contact-enquiry') || can('new-developments') || can('product-samples'),
      children: [
        { label: 'Doctor Appointments', to: '/doctor-appointments', icon: P.calendar, show: can('doctor-appointments') },
        { label: 'Contact Enquiry', to: '/contact-enquiry', icon: P.mail, show: can('contact-enquiry') },
        { label: 'New Developments', to: '/new-developments', icon: P.bolt, show: can('new-developments') },
        { label: 'Product Samples', to: '/product-samples', icon: P.cube, show: can('product-samples') },
      ],
    },
  ];

  const visible = items
    .filter((it) => it.show)
    .map((it) => (it.kind === 'group' ? { ...it, children: it.children.filter((c) => c.show) } : it))
    .filter((it) => it.kind === 'link' || it.children.length > 0);

  const pathActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/'));
  const groupActive = (it: Extract<NavItem, { kind: 'group' }>) => it.children.some((c) => pathActive(c.to));

  const onThemeToggle = () => setThemeMode(toggleTheme());
  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Desktop flyout — fixed-positioned so it escapes the rail's own vertical scroll
  // container (an in-flow absolute panel gets clipped once the nav can scroll).
  type Group = Extract<NavItem, { kind: 'group' }>;
  const [flyout, setFlyout] = useState<{ item: Group; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFlyout = (item: Group, top: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFlyout({ item, top });
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyout(null), 120);
  };

  // ---- Expanded (labeled) vs collapsed (icon rail) mode, persisted ----
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('ei-rail-expanded') !== '0'; } catch { return true; }
  });
  const toggleExpanded = () => {
    setExpanded((e) => {
      const next = !e;
      try { localStorage.setItem('ei-rail-expanded', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  // Inline accordion state for expanded groups; default-open the active group.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (it: Group) => openGroups[it.label] ?? groupActive(it);
  const setGroupOpen = (it: Group, val: boolean) => setOpenGroups((p) => ({ ...p, [it.label]: val }));
  const toggleGroup = (it: Group) => setGroupOpen(it, !isGroupOpen(it));

  // ---- Rail (icon) styling ----
  const railBtn = (active: boolean) =>
    `relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 ${
      active ? 'bg-brand-soft text-brand shadow-[var(--e1)]' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
    }`;

  const RailItem = (it: NavItem) => {
    if (it.kind === 'link') {
      return (
        <li key={it.to}>
          <RailLink to={it.to} className={({ isActive }) => railBtn(isActive)}>
            <Icon d={it.icon} className="w-5 h-5" />
            <span className="sr-only">{it.label}</span>
          </RailLink>
        </li>
      );
    }
    const active = groupActive(it);
    const onEnter = (e: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>) =>
      openFlyout(it, e.currentTarget.getBoundingClientRect().top);
    // group trigger: navigates to its landing route if it has one, flyout on hover/focus
    const trigger = it.to ? (
      <RailLink to={it.to} className={() => railBtn(active)}>
        <Icon d={it.icon} className="w-5 h-5" />
        <span className="sr-only">{it.label}</span>
      </RailLink>
    ) : (
      <button type="button" className={`${railBtn(active)} w-11`} aria-label={it.label}>
        <Icon d={it.icon} className="w-5 h-5" />
      </button>
    );
    return (
      <li key={it.label} onMouseEnter={onEnter} onMouseLeave={scheduleClose} onFocus={onEnter} onBlur={scheduleClose}>
        {trigger}
      </li>
    );
  };

  // ---- Expanded (labeled) row styling ----
  const expRow = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-4 ${
      active ? 'bg-brand-soft text-brand border-l-brand' : 'text-ink-2 hover:bg-surface-3 hover:text-ink border-l-transparent'
    }`;
  const expSub = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-brand-soft text-brand font-medium' : 'text-ink-3 hover:bg-surface-3 hover:text-ink'
    }`;

  const ExpandedItem = (it: NavItem) => {
    if (it.kind === 'link') {
      return (
        <li key={it.to}>
          <RailLink to={it.to} className={({ isActive }) => expRow(isActive)}>
            <Icon d={it.icon} className="w-5 h-5 shrink-0" />
            <span className="truncate">{it.label}</span>
          </RailLink>
        </li>
      );
    }
    const gActive = groupActive(it);
    const open = isGroupOpen(it);
    return (
      <li key={it.label}>
        <div className={`group/gr flex items-center rounded-lg border-l-4 transition-colors ${
          gActive ? 'bg-brand-soft border-l-brand shadow-[var(--e1)]' : 'border-l-transparent hover:bg-surface-3'
        }`}>
          {it.to ? (
            <RailLink
              to={it.to}
              onClick={() => setGroupOpen(it, true)}
              className={() =>
                `flex-1 min-w-0 flex items-center gap-3 pl-3 pr-1 py-2.5 text-sm font-medium ${
                  gActive ? 'text-brand' : 'text-ink-2 group-hover/gr:text-ink'
                }`
              }
            >
              <Icon d={it.icon} className="w-5 h-5 shrink-0" />
              <span className="truncate">{it.label}</span>
            </RailLink>
          ) : (
            <button
              type="button"
              onClick={() => toggleGroup(it)}
              className={`flex-1 min-w-0 flex items-center gap-3 pl-3 pr-1 py-2.5 text-sm font-medium text-left ${
                gActive ? 'text-brand' : 'text-ink-2 group-hover/gr:text-ink'
              }`}
            >
              <Icon d={it.icon} className="w-5 h-5 shrink-0" />
              <span className="truncate">{it.label}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleGroup(it)}
            className={`pr-3 pl-1 py-2.5 ${gActive ? 'text-brand' : 'text-ink-3 group-hover/gr:text-ink'}`}
            aria-label={open ? `Collapse ${it.label}` : `Expand ${it.label}`}
            aria-expanded={open}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[600px]' : 'max-h-0'}`}>
          <ul className="mt-0.5 ml-4 border-l border-hairline pl-3 space-y-0.5 py-1">
            {it.children.map((c) => (
              <li key={c.to}>
                <RailLink to={c.to} className={({ isActive }) => expSub(isActive)}>
                  <Icon d={c.icon} className="w-4 h-4 opacity-80 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </RailLink>
              </li>
            ))}
          </ul>
        </div>
      </li>
    );
  };

  const initials =
    (user?.name ?? user?.email ?? 'U').split(' ').map((n) => n[0]).filter(Boolean).join('').substring(0, 2) || 'U';

  return (
    <>
      {/* ============ Desktop rail (md+) — collapsed icon rail OR expanded labeled nav ============ */}
      <aside className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-hairline bg-surface z-40 transition-[width] duration-300 ${expanded ? 'w-64 items-stretch' : 'w-16 items-center'}`}>
        <div className={`flex h-16 items-center border-b border-hairline shrink-0 ${expanded ? 'px-4' : 'w-full justify-center'}`}>
          {expanded ? (
            <img src={eilogofull} alt="Esthetic Insights" className="max-h-9 max-w-full object-contain" />
          ) : (
            <img src="/eilogo.svg" alt="Esthetic Insights" className="h-8 w-8 object-contain shrink-0" />
          )}
        </div>
        <nav className={`flex-1 w-full overflow-y-auto py-3 ${expanded ? 'px-2 overflow-x-hidden' : 'overflow-x-visible'}`}>
          {expanded ? (
            <ul className="space-y-1">{visible.map(ExpandedItem)}</ul>
          ) : (
            <ul className="flex flex-col items-center gap-1">{visible.map(RailItem)}</ul>
          )}
        </nav>

        {expanded ? (
          <div className="w-full shrink-0 border-t border-hairline p-3 space-y-2 bg-surface-2">
            {user && (
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 bg-brand rounded-full flex items-center justify-center text-brand-ink font-semibold text-xs shrink-0">{initials}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{user.name ?? user.email ?? 'User'}</p>
                  <p className="text-xs text-ink-3 truncate">{user.roleName ?? '—'}</p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onThemeToggle} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-3 hover:bg-surface text-ink-2 rounded-lg text-sm font-medium transition-colors">
                {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <button type="button" onClick={onLogout} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-3 hover:bg-err-soft text-ink-2 hover:text-err rounded-lg text-sm font-medium transition-colors">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
            <button type="button" onClick={toggleExpanded} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors" title="Collapse to icon rail" aria-label="Collapse to icon rail">
              <ChevronsLeft className="w-4 h-4 shrink-0" />
              <span>Collapse</span>
            </button>
          </div>
        ) : (
          <div className="w-full shrink-0 border-t border-hairline py-3 flex flex-col items-center gap-1">
            <button type="button" onClick={onThemeToggle} className={railBtn(false)} title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'} aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {themeMode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button type="button" onClick={onLogout} className={`${railBtn(false)} hover:bg-err-soft hover:text-err`} title="Logout" aria-label="Logout">
              <LogOut className="w-5 h-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-ink text-xs font-semibold shadow-[var(--e1)]" title={`${user?.name ?? user?.email ?? 'User'}${user?.roleName ? ' · ' + user.roleName : ''}`}>
              {initials}
            </div>
            <button type="button" onClick={toggleExpanded} className={`${railBtn(false)} mt-1`} title="Expand navigation" aria-label="Expand navigation">
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </aside>

      {/* Desktop flyout panel — collapsed mode only; fixed, escapes the rail scroll container */}
      {!expanded && flyout && (
        <div
          className="hidden md:block fixed z-[80] left-[56px] pl-2"
          style={{ top: Math.max(8, flyout.top) }}
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
          }}
          onMouseLeave={scheduleClose}
        >
          <div className="min-w-[220px] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-border bg-surface shadow-[var(--e3)] p-2">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-4">{flyout.item.label}</p>
            <ul className="space-y-0.5">
              {flyout.item.children.map((c) => (
                <li key={c.to}>
                  <RailLink
                    to={c.to}
                    onClick={() => setFlyout(null)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-brand-soft text-brand font-medium' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
                      }`
                    }
                  >
                    <Icon d={c.icon} className="w-4 h-4 opacity-80" />
                    <span>{c.label}</span>
                  </RailLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============ Mobile drawer (< md) ============ */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm" onClick={onMobileClose} aria-hidden />
      )}
      <aside
        className={`md:hidden fixed top-0 left-0 z-[96] h-screen w-72 max-w-[85vw] flex flex-col bg-surface border-r border-hairline shadow-[var(--e3)] transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4 shrink-0">
          <img src={eilogofull} alt="Esthetic Insights" className="h-8 object-contain" />
          <button type="button" onClick={onMobileClose} className="p-2 rounded-lg hover:bg-surface-3 text-ink-2" aria-label="Close menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visible.map((it) =>
            it.kind === 'link' ? (
              <RailLink
                key={it.to}
                to={it.to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
                  }`
                }
              >
                <Icon d={it.icon} className="w-5 h-5" />
                <span>{it.label}</span>
              </RailLink>
            ) : (
              <div key={it.label} className="pt-2">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-4">{it.label}</p>
                {it.children.map((c) => (
                  <RailLink
                    key={c.to}
                    to={c.to}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-brand-soft text-brand font-medium' : 'text-ink-3 hover:bg-surface-3 hover:text-ink'
                      }`
                    }
                  >
                    <Icon d={c.icon} className="w-4 h-4 opacity-80" />
                    <span>{c.label}</span>
                  </RailLink>
                ))}
              </div>
            )
          )}
        </nav>
        <div className="shrink-0 border-t border-hairline p-3 space-y-2 bg-surface-2">
          {user && (
            <div className="flex items-center gap-3 px-1">
              <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-brand-ink font-semibold text-sm shrink-0">{initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{user.name ?? user.email ?? 'User'}</p>
                <p className="text-xs text-ink-3 truncate">{user.roleName ?? '—'}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onThemeToggle} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-3 hover:bg-surface text-ink-2 rounded-lg text-sm font-medium">
              {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button type="button" onClick={onLogout} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-3 hover:bg-err-soft text-ink-2 hover:text-err rounded-lg text-sm font-medium">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default GlobalRail;
