'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect } from 'react';
import { subscribeToUserProjects, subscribeToNotifications } from '@/lib/firebase/firestore';
import { Project } from '@/types';

import { subscribeToUserChats } from '@/lib/firebase/chat';
import { Chat } from '@/types';
import { motion } from 'framer-motion';

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        <line x1="9" y1="14" x2="15" y2="14" opacity="0.5"/>
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    badgeType: 'messages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <path d="M8 10h.01M12 10h.01M16 10h.01" />
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
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '9px 12px', marginBottom: 4, borderRadius: 10, textDecoration: 'none', color: isActive ? 'var(--text-1)' : 'var(--text-3)', transition: 'color 0.2s', zIndex: 1 }}
                  title={item.label}
                  className="group"
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      style={{ position: 'absolute', inset: 0, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: -1 }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3, background: 'var(--accent)', borderRadius: '0 4px 4px 0' }}
                    />
                  )}
                  
                  {/* Hover effect for non-active */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-[10px] bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-opacity z-[-1]" />
                  )}

                  <span style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'inherit', transition: 'color 0.2s' }}>{item.icon}</span>
                  <span className="nav-label" style={{ marginLeft: 12, fontSize: 14, fontWeight: isActive ? 600 : 500, transition: 'all 0.2s' }}>{item.label}</span>
                  
                  {badgeCount > 0 && (
                    <span
                      className="nav-badge"
                      style={{
                        marginLeft: 'auto', background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center', flexShrink: 0,
                      }}
                    >
                      {badgeCount}
                    </span>
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
                    onClick={onClose}
                    className="group"
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '7px 12px', marginBottom: 2, borderRadius: 10, textDecoration: 'none', color: isActive ? 'var(--text-1)' : 'var(--text-3)', transition: 'all 0.2s', zIndex: 1 }}
                    title={p.name}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-pill-projects"
                        style={{ position: 'absolute', inset: 0, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: -1 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {!isActive && (
                      <div className="absolute inset-0 rounded-[10px] bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-opacity z-[-1]" />
                    )}

                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: getAuraGradient(p.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.3)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      opacity: isActive ? 1 : 0.8,
                      transition: 'opacity 0.2s',
                    }} className="group-hover:opacity-100">
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="nav-label truncate-1" style={{ marginLeft: 10, fontSize: 13, fontWeight: isActive ? 600 : 500, flex: 1 }}>{p.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Sidebar Footer (Settings) */}
        <div style={{ padding: '10px 6px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, marginTop: 'auto' }}>
          <Link
            href="/settings"
            onClick={onClose}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '9px 12px', borderRadius: 10, textDecoration: 'none', color: pathname === '/settings' ? 'var(--text-1)' : 'var(--text-3)', transition: 'color 0.2s', zIndex: 1 }}
            className="group"
          >
            {pathname === '/settings' && (
              <motion.div
                layoutId="sidebar-active-pill"
                style={{ position: 'absolute', inset: 0, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: -1 }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            {pathname === '/settings' && (
              <motion.div
                layoutId="sidebar-active-indicator"
                style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3, background: 'var(--accent)', borderRadius: '0 4px 4px 0' }}
              />
            )}
            
            {pathname !== '/settings' && (
              <div className="absolute inset-0 rounded-[10px] bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-opacity z-[-1]" />
            )}

            <span style={{ flexShrink: 0, color: pathname === '/settings' ? 'var(--accent)' : 'inherit', transition: 'color 0.2s' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span className="nav-label" style={{ marginLeft: 12, fontSize: 14, fontWeight: pathname === '/settings' ? 600 : 500, transition: 'all 0.2s' }}>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
