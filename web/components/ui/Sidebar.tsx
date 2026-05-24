'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect } from 'react';
import { subscribeToUserProjects, subscribeToNotifications } from '@/lib/firebase/firestore';
import { Project } from '@/types';

import { subscribeToUserChats } from '@/lib/firebase/chat';
import { Chat } from '@/types';

const getAuraGradient = (name: string) => {
  const hash = Array.from(name || '').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6;
  const gradients = [
    'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', // Blue to Purple
    'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
    'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', // Amber to Orange
    'linear-gradient(135deg, #ec4899 0%, #e11d48 100%)', // Pink to Rose
    'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', // Sky to Blue
    'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // Violet to Fuchsia
  ];
  return gradients[hash];
};

const NAV: Array<{ href: string; label: string; icon: React.ReactNode; badgeType?: 'notifications' | 'messages' }> = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    badgeType: 'messages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
  },
];

interface SidebarProps { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProjects(user.uid, setProjects);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToNotifications(user.uid, setNotifs as any);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserChats(user.uid, setChats);
    return unsub;
  }, [user]);

  const unreadNotifsCount = notifs.filter((n: any) => !n.read).length;
  const unreadChatsCount = chats.reduce((sum, chat) => sum + (chat.unreadCounts?.[user?.uid || ''] || 0), 0);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
        />
      )}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Logo header */}
        <div style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          <Link
            href="/dashboard"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 0 }}
            onClick={onClose}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <img src="/logo.png" alt="MSDEV" style={{ width: 36, height: 36, objectFit: 'cover', display: 'block' }} />
            </div>
            <span className="nav-label" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              MS Dev
            </span>
          </Link>
        </div>

        {/* Main Nav */}
        <nav style={{ padding: '10px 6px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ marginBottom: 4 }}>
            {NAV.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const badgeCount = item.badgeType === 'messages' ? unreadChatsCount : (item.badgeType === 'notifications' ? unreadNotifsCount : 0);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  style={{ position: 'relative', justifyContent: 'flex-start', padding: '9px 12px', marginBottom: 2 }}
                  title={item.label}
                >
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className="nav-badge"
                      style={{
                        marginLeft: 'auto',
                        background: 'var(--danger)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 99,
                        padding: '1px 6px',
                        minWidth: 18,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                  {/* Collapsed badge dot */}
                  {badgeCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      border: '1.5px solid var(--bg-card)',
                    }}
                    className="collapsed-badge"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Projects List */}
          {projects.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                className="section-label"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '0 12px',
                  marginBottom: 6,
                }}
              >
                Projects
              </div>
              {[...projects]
                .sort((a, b) => {
                  const aCompleted = a.status === 'completed' || Math.round(a.completionPercentage || 0) === 100;
                  const bCompleted = b.status === 'completed' || Math.round(b.completionPercentage || 0) === 100;
                  if (aCompleted && !bCompleted) return 1;
                  if (!aCompleted && bCompleted) return -1;
                  const aTasks = a.stats?.totalTasks || 0;
                  const bTasks = b.stats?.totalTasks || 0;
                  return bTasks - aTasks;
                })
                .slice(0, 6)
                .map(p => {
                const isActive = pathname.startsWith(`/projects/${p.id}`);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                    style={{ justifyContent: 'flex-start', padding: '7px 12px', marginBottom: 1 }}
                    title={p.name}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: getAuraGradient(p.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.3)',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="nav-label truncate-1" style={{ fontSize: 13 }}>{p.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
