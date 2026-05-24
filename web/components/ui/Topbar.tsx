'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { subscribeToNotifications, markNotificationRead, subscribeToUserProjects, subscribeToMyInvitations, acceptInvitation, declineInvitation, approveTaskMovePermission } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';
import { Project } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import { signOutUser } from '@/lib/firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import CreateProjectModal from '@/components/projects/CreateProjectModal';

// Avatar sets — 5 male, 5 female
const MALE_AVATARS   = ['/avatar_m1.png', '/avatar_m2.png', '/avatar_m3.png', '/avatar_m4.png', '/avatar_m5.png'];
const FEMALE_AVATARS = ['/avatar_f1.png', '/avatar_f2.png', '/avatar_f3.png', '/avatar_f4.png', '/avatar_f5.png'];

/** Pick a deterministic default avatar based on uid */
function getDefaultAvatar(uid: string, gender?: string): string {
  const pool = gender === 'female' ? FEMALE_AVATARS : MALE_AVATARS;
  const idx  = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % pool.length;
  return pool[idx];
}

interface TopbarProps { onMenuClick: () => void; }

function ProjectSwitcher({ projects, currentProjectId, router }: { projects: Project[], currentProjectId: string, router: any }) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = projects.find(p => p.id === currentProjectId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!current) return <div style={{ fontWeight: 600 }}>Loading...</div>;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button 
        onClick={() => setOpen(!open)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: 8, 
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 10px', borderRadius: 8, marginLeft: -10,
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 4, flexShrink: 0,
          background: '#090a0f', color: '#0ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, fontFamily: 'var(--mono), monospace', textTransform: 'uppercase',
          border: '1px solid #0ff',
          boxShadow: '0 0 8px rgba(0, 255, 255, 0.5), inset 0 0 4px rgba(0, 255, 255, 0.3)',
          textShadow: '0 0 5px #0ff'
        }}>
          {current.name.charAt(0)}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{current.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          width: 240, background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 100, overflow: 'hidden', padding: 6
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Switch Project
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { router.push(`/projects/${p.id}`); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: p.id === currentProjectId ? 'var(--bg-elevated)' : 'transparent', 
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if(p.id !== currentProjectId) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { if(p.id !== currentProjectId) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                  background: '#090a0f', color: '#0ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 900, fontFamily: 'var(--mono), monospace', textTransform: 'uppercase',
                  border: '1px solid #0ff',
                  boxShadow: '0 0 8px rgba(0, 255, 255, 0.5), inset 0 0 4px rgba(0, 255, 255, 0.3)',
                  textShadow: '0 0 5px #0ff'
                }}>
                  {p.name.charAt(0)}
                </div>
                <span style={{ fontSize: 13, fontWeight: p.id === currentProjectId ? 700 : 500, color: p.id === currentProjectId ? 'var(--text-1)' : 'var(--text-2)', flex: 1 }} className="truncate-1">
                  {p.name}
                </span>
                {p.id === currentProjectId && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            ))}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
          
          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              color: 'var(--accent)', fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            Create New Project
          </button>
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user }  = useAuth();
  const pathname  = usePathname();
  const router    = useRouter();

  const [notifs, setNotifs]           = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [approvingNotifId, setApprovingNotifId] = useState<string | null>(null);

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  /* ─── subscriptions ─── */
  useEffect(() => {
    if (!user) return;
    const unsubNotifs = subscribeToNotifications(user.uid, setNotifs as any);
    const unsubProjects = subscribeToUserProjects(user.uid, setProjects);
    let unsubInvites: any = () => {};
    if (user.email) {
      unsubInvites = subscribeToMyInvitations(user.email.toLowerCase(), setInvitations);
    }
    return () => {
      unsubNotifs();
      unsubProjects();
      unsubInvites();
    };
  }, [user]);

  /* ─── click-outside close ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAccept = async (inv: any) => {
    if (!user || !user.email) return;
    try {
      await acceptInvitation(inv.id, user.uid, user.displayName || 'User', user.photoURL || '', user.email);
      toast.success(`Joined ${inv.projectName}!`);
    } catch (e: any) {
      toast.error('Failed to accept invitation');
      console.error(e);
    }
  };

  const handleDecline = async (inv: any) => {
    try {
      await declineInvitation(inv.id);
      toast.success(`Declined invitation to ${inv.projectName}`);
    } catch (e: any) {
      toast.error('Failed to decline invitation');
      console.error(e);
    }
  };

  const handleApproveMoveRequest = async (notif: any) => {
    if (!user) return;
    const requesterId = notif.metadata?.requesterId;
    const projectId = notif.projectId;
    const taskId = notif.taskId;
    const taskTitle = notif.metadata?.taskTitle || 'Unknown';

    if (!requesterId || !projectId || !taskId) {
      toast.error('This request is missing approval details');
      return;
    }

    setApprovingNotifId(notif.id);
    try {
      await approveTaskMovePermission(projectId, taskId, requesterId, taskTitle);
      await markNotificationRead(user.uid, notif.id);
      setNotifs(prev => prev.map(item => item.id === notif.id ? { ...item, read: true } : item));
      setNotifOpen(false);
      toast.success('Permission granted. They can move the task now.');
    } catch (e: any) {
      toast.error('Failed to approve move request');
      console.error(e);
    } finally {
      setApprovingNotifId(null);
    }
  };

  const unread = notifs.filter((n: any) => !n.read).length + invitations.length;
  const lastNotif = notifs[0]; // most recent

  const pathParts = pathname.split('/').filter(Boolean);

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/login');
  };

  /* pick avatar */
  const avatarSrc = user?.photoURL || (user?.uid ? getDefaultAvatar(user.uid) : MALE_AVATARS[0]);
  const initials  = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="topbar">
      {/* Mobile menu button */}
      <button
        id="mobile-menu-btn"
        className="btn-icon btn-ghost"
        onClick={onMenuClick}
        style={{ display: 'none' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Page Title / Project Switcher */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {pathParts[0] === 'projects' && pathParts[1] ? (
          <ProjectSwitcher 
            projects={projects} 
            currentProjectId={pathParts[1]} 
            router={router} 
          />
        ) : (
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
            {pathParts[0] ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) : 'Dashboard'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

        {/* ── Notifications ── */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            id="notif-btn"
            className="btn-icon btn-ghost"
            onClick={() => setNotifOpen(v => !v)}
            title="Notifications"
            style={{ position: 'relative', width: 36, height: 36, borderRadius: 10 }}
          >
            {/* Custom bell icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 8a6 6 0 0 1 12 0c0 5.25 2.4 7 3 7.5H3c.6-.5 3-2.25 3-7.5z"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--danger)',
                border: '1.5px solid var(--bg-card)',
              }} />
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              width: 360,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              zIndex: 100, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {unread > 0 && (
                    <span style={{
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 7px',
                    }}>{unread} new</span>
                  )}
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => { router.push('/notifications'); setNotifOpen(false); }}
                  >View all →</button>
                </div>
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {notifs.length === 0 && invitations.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    No notifications yet
                  </div>
                ) : (
                  <>
                    {invitations.length > 0 && (
                      <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Invitations
                      </div>
                    )}
                    {invitations.map((inv: any) => (
                      <div key={inv.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(99,102,241,0.06)', display: 'flex', gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }} className="truncate-1">Project Invitation: {inv.projectName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, whiteSpace: 'normal' }}>
                            <strong>{inv.invitedByName}</strong> invited you to join the project as a {inv.role}.
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleAccept(inv)}>Accept</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleDecline(inv)}>Decline</button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {notifs.length > 0 && (
                      <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Notifications
                      </div>
                    )}
                    {notifs.slice(0, 15).map((n: any) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.type !== 'task_move_request') {
                            markNotificationRead(user!.uid, n.id);
                          }
                        }}
                        style={{
                          padding: '11px 16px',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: n.type === 'task_move_request' ? 'default' : 'pointer',
                          background: n.read ? 'transparent' : 'rgba(52,211,153,0.04)',
                          display: 'flex', gap: 10,
                          transition: 'background 0.15s',
                        }}
                      >
                        {!n.read && (
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--accent)', marginTop: 5, flexShrink: 0,
                          }} />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden', paddingLeft: n.read ? 17 : 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }} className="truncate-1">{n.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }} className="truncate-1">{n.body}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ''}
                            </div>
                            {n.type === 'task_move_request' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleApproveMoveRequest(n); }}
                                disabled={approvingNotifId === n.id}
                                style={{ padding: '6px 10px', height: 30 }}
                              >
                                {approvingNotifId === n.id ? 'Approving...' : 'Accept'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Profile avatar + dropdown ── */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            id="profile-btn"
            onClick={() => setProfileOpen(v => !v)}
            style={{
              width: 34, height: 34,
              borderRadius: '50%',
              border: `2px solid ${profileOpen ? 'var(--accent)' : 'var(--border)'}`,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              background: 'var(--bg-elevated)',
              transition: 'border-color 0.2s',
              flexShrink: 0,
            }}
            title="Profile"
          >
            <img
              src={avatarSrc}
              alt={initials}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                // fallback: hide img, show initials via background
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              width: 220,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
              zIndex: 100,
              overflow: 'hidden',
            }}>
              {/* User info */}
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <img
                  src={avatarSrc}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }} className="truncate-1">
                    {user?.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }} className="truncate-1">{user?.email}</div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: 6 }}>
                <button
                  onClick={() => { router.push('/profile'); setProfileOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-1)', fontSize: 13, fontWeight: 500,
                    transition: 'background 0.15s', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Profile
                </button>

                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--danger)', fontSize: 13, fontWeight: 500,
                    transition: 'background 0.15s', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
