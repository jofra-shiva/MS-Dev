'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { use } from 'react';

const PROJECT_TABS = [
  { key: 'overview', label: 'Overview', icon: '📊', path: '' },
  { key: 'kanban', label: 'Kanban', icon: '🗂️', path: '/kanban' },
  { key: 'tracker', label: 'Tracker', icon: '📋', path: '/tracker' },
  { key: 'analytics', label: 'Analytics', icon: '📈', path: '/analytics' },
  { key: 'activity', label: 'Activity', icon: '⚡', path: '/activity' },
  { key: 'github', label: 'GitHub', icon: '🔗', path: '/github' },
  { key: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
];

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }> | { projectId: string };
}) {
  const pathname = usePathname();
  
  // Unwrap params depending on Next.js version (Next.js 15+ passes a Promise)
  const resolvedParams = 'then' in params ? use(params) : params;
  const projectId = resolvedParams.projectId;

  const basePath = `/projects/${projectId}`;

  return (
    <div className="animate-fadeIn">
      {/* Sub-nav tabs - Persistent across all project pages */}
      <div style={{ display:'flex', gap:2, marginBottom:24, borderBottom:'1px solid var(--border-subtle)', paddingBottom:0, overflowX: 'auto' }}>
        {PROJECT_TABS.map(tab => {
          const href = `${basePath}${tab.path}`;
          const isActive = pathname === href || (tab.path !== '' && pathname.startsWith(href));
          return (
            <Link key={tab.key}
              href={href}
              style={{ padding:'8px 14px', borderRadius:'8px 8px 0 0', fontSize:13, fontWeight:500, textDecoration:'none',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? 'var(--text-1)' : 'var(--text-2)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                display:'flex', alignItems:'center', gap:6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              <span>{tab.icon}</span>{tab.label}
            </Link>
          )
        })}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
