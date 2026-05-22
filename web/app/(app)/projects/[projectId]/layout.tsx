'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import { subscribeToProject } from '@/lib/firebase/firestore';
import { Project } from '@/types';

const PROJECT_TABS = [
  { key: 'overview', label: 'Overview', icon: '📊', path: '' },
  { key: 'kanban', label: 'A to Z', icon: '🗂️', path: '/kanban' },
  { key: 'tracker', label: 'Tracker', icon: '📋', path: '/tracker' },
  { key: 'analytics', label: 'Analytics', icon: '📈', path: '/analytics' },
  { key: 'activity', label: 'Activity', icon: '⚡', path: '/activity' },
  { key: 'meetings', label: 'Meetings', icon: '📅', path: '/meetings' },
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
  
  const resolvedParams = 'then' in params ? use(params) : params;
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    return subscribeToProject(projectId, setProject);
  }, [projectId]);

  const basePath = `/projects/${projectId}`;

  return (
    <div className="animate-fadeIn">
      {/* Sub-nav tabs - Persistent across all project pages */}
      <div style={{ 
        display:'flex', gap:2, marginBottom:24, borderBottom:'1px solid var(--border-subtle)', paddingBottom:0, overflowX: 'auto',
        position: 'sticky', top: 60, zIndex: 20, background: 'var(--bg-primary)',
        paddingTop: 20, margin: '-28px -28px 24px -28px', paddingLeft: 28, paddingRight: 28
      }}>
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
        {project?.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noreferrer"
            style={{ 
              marginLeft: 'auto',
              padding:'6px 14px', borderRadius:'8px', fontSize:12, fontWeight:700, textDecoration:'none', textTransform: 'uppercase',
              background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display:'flex', alignItems:'center', gap:6, transition: 'all 0.2s', whiteSpace: 'nowrap',
              marginBottom: 4, height: 32, alignSelf: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
            title="Open Live Project"
          >
            <span style={{ fontSize: 13 }}>🌐</span> Live Preview
          </a>
        )}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
