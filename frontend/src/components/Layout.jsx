import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BPCLIcon from '../assets/bpcl-icon.svg';
import {
  LayoutDashboard,
  Image,
  Upload,
  CheckSquare,
  FileText,
  PenTool,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Fuel,
  Globe,
  Sparkles
} from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [] },
  {
    name: 'DAM Workflow',
    icon: Image,
    roles: [],
    children: [
      { name: 'Overview', href: '/dam', icon: Image, roles: [] },
      { name: 'Upload Assets', href: '/dam/upload', icon: Upload, roles: ['dxcontentauthors', 'wpsadmin'] },
      { name: 'Approvals', href: '/dam/approvals', icon: CheckSquare, roles: ['dxcontentapprovers', 'wpsadmin'] },
    ],
  },
  {
    name: 'WCM Composer',
    icon: FileText,
    roles: [],
    children: [
      { name: 'Content List', href: '/wcm', icon: FileText, roles: [] },
      { name: 'Create Content', href: '/wcm/compose', icon: PenTool, roles: ['dxcontentauthors', 'wpsadmin'] },
      { name: 'Approvals', href: '/wcm/approvals', icon: CheckSquare, roles: ['dxcontentapprovers', 'wpsadmin'] },
    ],
  },
  { name: 'AI Creative Studio', href: '/ai-studio', icon: Sparkles, roles: ['dxcontentauthors', 'wpsadmin'] },
  { name: 'Microsite', href: '/microsite', icon: Globe, roles: [] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['wpsadmin'] },
];

function NavItem({ item, hasAnyRole, mobile = false }) {
  const [isOpen, setIsOpen] = useState(false);

  if (item.roles.length > 0 && !hasAnyRole(item.roles)) {
    return null;
  }

  if (item.children) {
    const visibleChildren = item.children.filter(
      child => child.roles.length === 0 || hasAnyRole(child.roles)
    );

    if (visibleChildren.length === 0) return null;

    return (
      <div className={mobile ? '' : 'relative'}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            'text-neutral-600 hover:text-navy-800 hover:bg-neutral-100',
            isOpen && 'bg-neutral-100 text-navy-800'
          )}
        >
          <span className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            {item.name}
          </span>
          <ChevronDown
            className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          />
        </button>
        {isOpen && (
          <div className={clsx(mobile ? 'pl-4 mt-1 space-y-1' : 'mt-1 space-y-1')}>
            {visibleChildren.map((child) => (
              <NavLink
                key={child.href}
                to={child.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-500 text-navy-800'
                      : 'text-neutral-600 hover:text-navy-800 hover:bg-neutral-100'
                  )
                }
              >
                <child.icon className="w-4 h-4" />
                {child.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
          isActive
            ? 'bg-primary-500 text-navy-800'
            : 'text-neutral-600 hover:text-navy-800 hover:bg-neutral-100'
        )
      }
    >
      <item.icon className="w-5 h-5" />
      {item.name}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-150">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* BPCL Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-neutral-200 bg-secondary-500">
          <img 
            src={BPCLIcon} 
            alt="BPCL" 
            className="w-10 h-10"
          />
          <div>
            <h1 className="text-lg font-bold text-white">DX Composer</h1>
            <p className="text-xs text-primary-300">Bharat Petroleum</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} hasAnyRole={hasAnyRole} />
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary-100 text-secondary-600">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800 truncate">
                {user?.displayName || user?.username}
              </p>
              <p className="text-xs text-neutral-500 truncate">
                {user?.roles?.join(', ') || 'No roles'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-neutral-600 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-neutral-200 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-neutral-600 hover:text-navy-800 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          {/* Language Selector */}
          <LanguageSelector />

          {/* Mobile close button */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-navy-800 lg:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
