'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToNotifications, markNotificationRead, subscribeToMyInvitations, acceptInvitation, declineInvitation } from '@/lib/firebase/firestore';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { writeBatch, collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';

const NOTIF_ICONS: Record<string, string> = {
  task_assigned: '📋', task_completed: '✅', deadline: '⏰',
  commit: '⚡', mention: '💬', project_update: '🔔',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !user.email) return;
    
    // Subscribe to standard notifications
    const unsubNotifs = subscribeToNotifications(user.uid, (n) => { setNotifs(n as any[]); setLoading(false); });
    
    // Subscribe to pending project invitations
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
    <div className="animate-fadeIn" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Notifications</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>
            {unread > 0 ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{unread} unread</span> : 'All caught up!'}
          </p>
        </div>
        {unread > 0 && (
          <button id="mark-all-read-btn" className="btn btn-secondary btn-sm" onClick={markAllRead}>
            ✓ Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
        </div>
      ) : notifs.length === 0 && invitations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No notifications yet</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>You'll be notified about task updates, commits, and team activity</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Render pending invitations first */}
          {invitations.map((inv: any, i) => (
            <motion.div key={inv.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                🤝
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>Project Invitation: {inv.projectName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{inv.createdAt?.toDate ? formatDistanceToNow(inv.createdAt.toDate(), { addSuffix: true }) : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>
                  <strong>{inv.invitedByName}</strong> invited you to join the project as a {inv.role}.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleAccept(inv)}>Accept Invitation</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDecline(inv)}>Decline</button>
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Render standard notifications */}
          {notifs.map((n: any, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (i + invitations.length) * 0.03 }}
              onClick={() => !n.read && markNotificationRead(user!.uid, n.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: n.read ? 'var(--bg-card)' : 'rgba(99,102,241,0.06)', border: `1px solid ${n.read ? 'var(--border-subtle)' : 'rgba(99,102,241,0.2)'}`, borderRadius: 10, cursor: n.read ? 'default' : 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: n.read ? 'var(--bg-elevated)' : 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {NOTIF_ICONS[n.type] || '🔔'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: n.read ? 500 : 700, color: 'var(--text-1)' }}>{n.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{n.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
