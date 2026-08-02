import { useAdminSidebar } from '../context/AdminSidebarContext';

type Props = {
  className?: string;
};

const AdminMainMenuButton = ({ className = '' }: Props) => {
  const adminSidebar = useAdminSidebar();
  if (!adminSidebar) return null;

  const { open, toggle } = adminSidebar;

  return (
    <button
      type="button"
      className={`p-2 rounded-lg hover:bg-surface-3 transition-colors shrink-0 text-ink-2 ${className}`}
      onClick={toggle}
      aria-label={open ? 'Close main menu' : 'Open main menu'}
      aria-expanded={open}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        {open ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
};

export default AdminMainMenuButton;
