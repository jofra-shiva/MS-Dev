'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToNotifications, markNotificationRead, subscribeToMyInvitations, acceptInvitation, declineInvitation, approveTaskMovePermission, declineTaskMovePermission } from '@/lib/firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { writeBatch, collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';

const NOTIF_ICONS: Record<string, string> = {
  task_assigned: '📋', task_completed: '✅', deadline: '⏰',
  commit: '⚡', mention: '💬', project_update: '🔔', task_move_request: '🟠', task_move_approved: '🟢', system_announcement: '📢',
};

const NOTIF_COLORS: Record<string, string> = {
  task_assigned: '#8B5CF6', task_completed: '#10B981', deadline: '#EF4444',
  commit: '#3B82F6', mention: '#F59E0B', project_update: '#6366F1', task_move_request: '#F97316', task_move_approved: '#10B981', system_announcement: '#0ea5e9',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !user.email) return;
    
    const unsubNotifs = subscribeToNotifications(user.uid, (n) => { setNotifs(n as any[]); setLoading(false); });
    const unsubInvites = subscribeToMyInvitations(user.email.toLowerCase(), (inv) => { setInvitations(inv); });
    
    return () => {
      unsubNotifs();
      unsubInvites();
    };
  }, [user]);

  const handleAccept = async (inv: any) => {
    if (!user || !user.email) return;
    try {
      await acceptInvitation(inv.id, user.uid, user.displayName || 'User', user.photoURL || '', user.email);
      toast.success(`Joined ${inv.projectName}!`);
    } catch (e: any) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleDecline = async (inv: any) => {
    try {
      await declineInvitation(inv.id);
      toast.success(`Declined invitation to ${inv.projectName}`);
    } catch (e: any) {
      toast.error('Failed to decline invitation');
    }
  };

  const handleDeclineMoveRequest = async (n: any) => {
    if (!user) return;
    const requesterId = n.metadata?.requesterId;
    const projectId = n.projectId;
    const taskId = n.taskId;
    const taskTitle = n.metadata?.taskTitle || 'Unknown';

    if (!requesterId || !projectId || !taskId) {
      toast.error('This request is missing details');
      return;
    }

    setApprovingId(n.id);
    try {
      await declineTaskMovePermission(projectId, taskId, requesterId, taskTitle);
      await markNotificationRead(user.uid, n.id);
      setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      toast.success('Request declined.');
    } catch (e: any) {
      toast.error('Failed to decline move request');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveMoveRequest = async (n: any) => {
    if (!user) return;
    const requesterId = n.metadata?.requesterId;
    const projectId = n.projectId;
    const taskId = n.taskId;
    const taskTitle = n.metadata?.taskTitle || 'Unknown';

    if (!requesterId || !projectId || !taskId) {
      toast.error('This request is missing approval details');
      return;
    }

    setApprovingId(n.id);
    try {
      await approveTaskMovePermission(projectId, taskId, requesterId, taskTitle);
      await markNotificationRead(user.uid, n.id);
      setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      toast.success('Permission granted. They can move the task now.');
    } catch (e: any) {
      toast.error('Failed to approve move request');
    } finally {
      setApprovingId(null);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const q = query(collection(db, `notifications/${user.uid}/items`));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.filter(d => !d.data().read).forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    toast.success('All marked as read');
  };

  const unread = notifs.filter(n => !n.read).length + invitations.length;

  return (
    <div className="animate-fadeIn w-full max-w-[840px] mx-auto py-4 px-2 sm:px-6">
      
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>Notifications</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            {unread > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                You have {unread} unread message{unread > 1 ? 's' : ''}
              </span>
            ) : 'You are all caught up!'}
          </p>
        </div>
        {unread > 0 && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-elevated)', transition: 'all 0.2s', color: 'var(--text-1)' }}
            onClick={markAllRead}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6, display: 'inline-block' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 86, borderRadius: 16 }} />)}
        </div>
      ) : notifs.length === 0 && invitations.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center p-8 sm:p-[80px]" 
          style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div style={{ fontSize: 64, marginBottom: 16, filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))' }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8, color: 'var(--text-1)' }}>Zero notifications</div>
          <div style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 300, margin: '0 auto', lineHeight: 1.5 }}>When you get assignments, mentions, or team updates, they'll show up here.</div>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Invitations Section */}
          {invitations.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Invitations</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {invitations.map((inv: any, i) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px', 
                      background: 'linear-gradient(145deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.05) 100%)', 
                      border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
                      boxShadow: '0 4px 12px rgba(99,102,241,0.05)'
                    }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: '0 4px 10px rgba(99,102,241,0.3)' }}>
                      🤝
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Project Invitation: {inv.projectName}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{inv.createdAt?.toDate ? formatDistanceToNow(inv.createdAt.toDate(), { addSuffix: true }) : ''}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text-1)' }}>{inv.invitedByName}</strong> invited you to join this project as a <strong style={{ color: 'var(--text-1)', textTransform: 'capitalize' }}>{inv.role}</strong>.
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                        <button className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: 99, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }} onClick={() => handleAccept(inv)}>Accept Invitation</button>
                        <button className="btn btn-secondary" style={{ padding: '8px 20px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)' }} onClick={() => handleDecline(inv)}>Decline</button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Notifications Section */}
          {notifs.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {notifs.slice(0, 30).map((n: any, i) => {
                    const accentColor = NOTIF_COLORS[n.type] || '#8B5CF6';
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => {
                          if (n.type !== 'task_move_request') markNotificationRead(user!.uid, n.id);
                        }}
                        className={`notif-card ${!n.read ? 'unread' : ''}`}
                        style={{
                          padding: '16px 20px',
                          background: n.read ? 'var(--bg-card)' : 'var(--bg-elevated)',
                          border: `1px solid ${n.read ? 'var(--border-subtle)' : 'var(--border)'}`,
                          borderRadius: 16,
                          cursor: n.type === 'task_move_request' ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'flex-start', gap: 16,
                          position: 'relative', overflow: 'hidden',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: n.read ? 'none' : '0 4px 20px rgba(0,0,0,0.03)',
                        }}
                        onMouseEnter={(e) => {
                          if (n.read) e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          if (n.read) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Unread indicator strip */}
                        {!n.read && (
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accentColor, borderRadius: '4px 0 0 4px' }} />
                        )}

                        <div style={{ 
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0, 
                          background: `${accentColor}15`, color: accentColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                          border: `1px solid ${accentColor}30`
                        }}>
                          {NOTIF_ICONS[n.type] || '🔔'}
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontSize: 14.5, fontWeight: n.read ? 600 : 800, color: 'var(--text-1)', lineHeight: 1.3 }}>{n.title}</div>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                              {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ''}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: 13.5, color: n.read ? 'var(--text-3)' : 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
                            {n.body}
                          </div>
                          
                          {!n.read && n.type === 'task_move_request' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10, marginTop: 14 }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={(e) => { e.stopPropagation(); handleDeclineMoveRequest(n); }}
                                disabled={approvingId === n.id}
                                style={{ 
                                  padding: '8px 24px', borderRadius: 99, height: 'auto', fontSize: 13, fontWeight: 600,
                                  background: 'transparent', color: 'var(--text-1)', border: '1px solid var(--border)'
                                }}
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={(e) => { e.stopPropagation(); handleApproveMoveRequest(n); }}
                                disabled={approvingId === n.id}
                                style={{ 
                                  padding: '8px 24px', borderRadius: 99, height: 'auto', fontSize: 13, fontWeight: 700,
                                  background: accentColor, color: '#fff', border: 'none',
                                  boxShadow: `0 4px 12px ${accentColor}40`
                                }}
                              >
                                {approvingId === n.id ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                                    Processing...
                                  </span>
                                ) : 'Approve Request'}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
