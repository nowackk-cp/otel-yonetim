import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useTheme } from './useTheme';

const COLLAPSE_KEY = 'otel-sidebar-collapsed';

export function Layout() {
  const { dark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobile={() => setMobileOpen(true)} dark={dark} onToggleTheme={toggle} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
