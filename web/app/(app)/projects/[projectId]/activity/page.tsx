'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToActivity } from '@/lib/firebase/firestore';
import { ActivityLog, MSDEVUser } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const ACTIVITY_ICONS: Record<string, string> = {
  task_created: '📝', task_updated: '✏️', task_completed: '✅',
  commit_pushed: '⚡', pr_merged: '🔀', member_added: '👤',
  member_removed: '🚫', project_created: '🚀',
};

export default function ActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<(MSDEVUser & { uid: string }) | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const openProfile = async (userId: string, fallbackName: string, fallbackPhoto: string) => {
    setLoadingProfile(true);
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        setSelectedUser({ ...(snap.data() as MSDEVUser), uid: snap.id });
      } else {
        setSelectedUser({
          uid: userId,
          email: '',
          displayName: fallbackName,
          photoURL: fallbackPhoto,
          projectIds: [],
          fcmTokens: [],
          preferences: { theme: 'dark', notifications: true },
          createdAt: new Date(),
          lastActive: new Date(),
        });
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  const getActionLabel = (item: ActivityLog) => {
    if (item.type === 'task_updated' && item.metadata?.from && item.metadata?.to) return 'moved';
    if (item.type === 'task_completed') return 'completed';
    if (item.type === 'task_created') return 'created';
    return item.type.replace(/_/g, ' ');
  };

  useEffect(() => {
    return subscribeToActivity(projectId, a => { setActivity(a); setLoading(false); }, 100);
  }, [projectId]);

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Activity Timeline</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>Real-time feed of all project activity</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
        </div>
      ) : activity.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 600 }}>No activity yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Activity will appear here as your team works</div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 10 }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 30, top: 20, bottom: 0, width: 2, background: 'var(--border-subtle)', zIndex: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activity.map((item, i) => {
              const ts = (item.createdAt as any)?.toDate?.() || new Date(item.createdAt as any);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                  
                  {/* Avatar & Icon */}
                  <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
                    {item.userPhoto ? (
                      <img src={item.userPhoto} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-base)' }} alt="" />
                    ) : (
                      <div className="avatar-placeholder" style={{ width: 42, height: 42, fontSize: 15, border: '2px solid var(--bg-base)' }}>
                        {item.userName ? item.userName.slice(0, 2).toUpperCase() : '👤'}
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-base)', borderRadius: '50%', padding: 3, fontSize: 11, boxShadow: '0 2px 4px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }}>
                      {ACTIVITY_ICONS[item.type] || '📌'}
                    </div>
                  </div>

                  {/* Content Card */}
                  <div style={{ flex: 1, background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(10,15,25,0.98) 100%)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ lineHeight: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openProfile(item.userId, item.userName, item.userPhoto)}
                          style={{
                            border: '1px solid rgba(59,130,246,0.28)',
                            background: 'rgba(59,130,246,0.1)',
                            color: '#93c5fd',
                            fontWeight: 800,
                            fontSize: 13.5,
                            padding: '3px 10px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, background 0.15s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                          title="Open profile"
                        >
                          {item.userName}
                        </button>
                        <span style={{ color: 'var(--text-2)', fontSize: 13.5 }}>
                          {getActionLabel(item)}
                        </span>
                        {item.taskTitle && (
                          <span style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 700, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.18)', padding: '2px 8px', borderRadius: 999 }}>
                            {item.type === 'task_updated' && item.metadata?.to ? `${item.taskTitle} to ${(item.metadata.to as string).replace(/_/g, ' ')}` : `"${item.taskTitle}"`}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontWeight: 500 }}>{formatDistanceToNow(ts, { addSuffix: true })}</span>
                    </div>

                    {/* Metadata Formatting */}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {item.metadata.from && item.metadata.to ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 99, background: 'var(--bg-base)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                              {(item.metadata.from as string).replace(/_/g, ' ')}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, fontWeight: 700 }}>
                              {(item.metadata.to as string).replace(/_/g, ' ')}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, background: 'var(--bg-base)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-2)' }}>
                            {Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 420, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(8,12,20,0.98) 100%)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)', overflow: 'hidden' }}
            >
              <div style={{ padding: 24, background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(16,185,129,0.14) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative' }}>
                <button type="button" onClick={() => setSelectedUser(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(15,23,42,0.7)', border: '1px solid var(--border)', color: 'var(--text-3)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer' }}>✕</button>
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt="" style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(15,23,42,0.95)', boxShadow: '0 10px 24px rgba(0,0,0,0.35)' }} />
                ) : (
                  <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: '#fff', border: '4px solid rgba(15,23,42,0.95)' }}>
                    {(selectedUser.displayName || 'User').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ margin: 0, color: 'var(--text-1)', fontSize: 24, fontWeight: 800 }}>{selectedUser.displayName}</h2>
                  <div style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 4 }}>{selectedUser.email || 'No email available'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>User profile</span>
                  <span style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{loadingProfile ? 'Loading...' : 'Ready'}</span>
                </div>
              </div>

              <div style={{ padding: 20, display: 'grid', gap: 10 }}>
                {[
                  { label: 'Display name', value: selectedUser.displayName },
                  { label: 'Email', value: selectedUser.email || '—' },
                  { label: 'Last active', value: selectedUser.lastActive ? new Date(selectedUser.lastActive as any).toLocaleString() : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.65)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</span>
                    <span style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
