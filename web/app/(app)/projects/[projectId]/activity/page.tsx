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
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: 'var(--border-subtle)', zIndex: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map((item, i) => {
              const ts = (item.createdAt as any)?.toDate?.() || new Date(item.createdAt as any);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  style={{ display: 'flex', gap: 14, padding: '10px 0', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                    {ACTIVITY_ICONS[item.type] || '📌'}
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{item.userName}</span>
                        <span style={{ color: 'var(--text-2)', fontSize: 13 }}> {item.type.replace(/_/g, ' ')}</span>
                        {item.taskTitle && <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}> "{item.taskTitle}"</span>}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{formatDistanceToNow(ts, { addSuffix: true })}</span>
                    </div>
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {JSON.stringify(item.metadata)}
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
