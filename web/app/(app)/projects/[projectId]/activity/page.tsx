'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToActivity } from '@/lib/firebase/firestore';
import { ActivityLog } from '@/types';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS: Record<string, string> = {
  task_created: '📝', task_updated: '✏️', task_completed: '✅',
  commit_pushed: '⚡', pr_merged: '🔀', member_added: '👤',
  member_removed: '🚫', project_created: '🚀',
};

export default function ActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

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
                  <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{item.userName}</span>
                        <span style={{ color: 'var(--text-2)', fontSize: 13.5 }}> {item.type.replace(/_/g, ' ')}</span>
                        {item.taskTitle && <span style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600 }}> "{item.taskTitle}"</span>}
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
    </div>
  );
}
