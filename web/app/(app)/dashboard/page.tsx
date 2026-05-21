'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToUserProjects } from '@/lib/firebase/firestore';
import { Project } from '@/types';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import CreateProjectModal from '@/components/projects/CreateProjectModal';

const COLORS = ['#34d399', '#38bdf8', '#6ee7b7', '#7dd3fc', '#a7f3d0', '#bae6fd'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProjects(user.uid, (p) => { setProjects(p); setLoading(false); });
    return unsub;
  }, [user]);

  const totalTasks = projects.reduce((s, p) => s + (p.stats?.totalTasks || 0), 0);
  const totalCompleted = projects.reduce((s, p) => s + (p.stats?.completedTasks || 0), 0);
  const totalCommits = projects.reduce((s, p) => s + (p.stats?.totalCommits || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'active').length;

  const stats = [
    { label: 'Active Projects', value: activeProjects, icon: '📁', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    { label: 'Total Tasks',     value: totalTasks,      icon: '✅', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { label: 'Completed',       value: totalCompleted,  icon: '🎯', color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
    { label: 'Total Commits',   value: totalCommits,    icon: '⚡', color: '#7dd3fc', bg: 'rgba(125,211,252,0.12)' },
  ];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="text-gradient">{user?.displayName?.split(' ')[0] || 'Developer'}</span> 👋
          </h1>
          <p style={{ color: 'var(--text-2)', marginTop: 4, fontSize: 14 }}>Here's what's happening across your projects today.</p>
        </div>
        <button id="create-project-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="stat-icon" style={{ background: s.bg }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <span style={{ fontSize: 11, color: s.color, fontWeight: 700, background: s.bg, padding: '3px 8px', borderRadius: 99 }}>+12%</span>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Projects Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Your Projects</h2>
            <Link href="/projects" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 12 }} />)}
            </div>
          ) : projects.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No projects yet</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 18 }}>Create your first project to get started</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {projects.slice(0, 6).map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Link href={`/projects/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${p.color || COLORS[i % COLORS.length]}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }} className="truncate-1">{p.name}</h3>
                        <span className={`badge badge-${p.status}`} style={{ flexShrink: 0, marginLeft: 8 }}>{p.status}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }} className="truncate-2">{p.description || 'No description'}</p>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 5 }}>
                          <span>Progress</span><span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{Math.round(p.completionPercentage || 0)}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.completionPercentage || 0}%` }} /></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                        <span>📋 {p.stats?.totalTasks || 0} tasks</span>
                        <span>👥 {Object.keys(p.members || {}).length} members</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Stats</h2>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 }}>OVERALL COMPLETION</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
                  {totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0}%
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}%` }} />
                </div>
              </div>
              <hr className="divider" style={{ margin: '4px 0' }} />
              {[
                { label: 'Tasks Completed', value: totalCompleted, color: 'var(--accent)' },
                { label: 'In Progress', value: projects.reduce((s,p) => s + (p.stats?.inProgressTasks || 0), 0), color: 'var(--accent-2)' },
                { label: 'Pending', value: projects.reduce((s,p) => s + (p.stats?.pendingTasks || 0), 0), color: 'var(--text-3)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{item.value}</span>
                </div>
              ))}
              <hr className="divider" style={{ margin: '4px 0' }} />
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>GitHub Commits</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-2)' }}>⚡ {totalCommits}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
