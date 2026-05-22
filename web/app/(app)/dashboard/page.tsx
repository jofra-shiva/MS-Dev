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
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Header */}
      <motion.div 
        className="glass-card"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', right: '-10%', top: '-50%', width: '300px', height: '300px', background: 'var(--accent-glow)', borderRadius: '50%', filter: 'blur(80px)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="text-gradient">{user?.displayName?.split(' ')[0] || 'Developer'}</span> 👋
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 15, fontWeight: 500 }}>Here's the latest pulse on your projects and team activity.</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          id="create-project-btn" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15, zIndex: 1 }} onClick={() => setShowCreate(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {stats.map((s, i) => (
          <motion.div key={s.label} className="stat-card glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ scale: 1.02, y: -4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="stat-icon" style={{ background: s.bg, boxShadow: `0 0 20px ${s.bg}` }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <span style={{ fontSize: 12, color: s.color, fontWeight: 700, background: s.bg, padding: '4px 10px', borderRadius: 99 }}>+12%</span>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Projects Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Active Projects</h2>
            <Link href="/projects" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} className="hover:opacity-80 transition-opacity">
              View all <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center', borderStyle: 'dashed' }}>
              <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse-glow 3s infinite' }}>🚀</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>No projects yet</div>
              <div style={{ color: 'var(--text-2)', fontSize: 15, marginBottom: 24 }}>Create your first project to get started</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {projects.slice(0, 6).map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
                  <Link href={`/projects/${p.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <motion.div className="glass-card" style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }} whileHover={{ y: -6, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
                      <div style={{ height: 4, width: '100%', background: `linear-gradient(90deg, ${p.color || COLORS[i % COLORS.length]}, transparent)` }} />
                      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }} className="truncate-1">{p.name}</h3>
                          <span className={`badge badge-${p.status}`} style={{ flexShrink: 0, marginLeft: 8 }}>{p.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, flex: 1, lineHeight: 1.5 }} className="truncate-2">{p.description || 'No description available for this project.'}</p>
                        
                        <div style={{ marginTop: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 }}>
                            <span>Progress</span><span style={{ color: 'var(--text-1)' }}>{Math.round(p.completionPercentage || 0)}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: 6, background: 'rgba(0,0,0,0.2)' }}>
                            <div className="progress-fill" style={{ width: `${p.completionPercentage || 0}%`, background: p.color || 'var(--accent)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 16, fontWeight: 500 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> {p.stats?.totalTasks || 0} tasks</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> {Object.keys(p.members || {}).length} team</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            Insights <span className="live-indicator" style={{ marginLeft: 'auto' }}>Live</span>
          </h2>
          
          <motion.div className="glass-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'var(--accent-2)', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15 }} />
            
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 36 36" style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <motion.path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#gradient)" strokeWidth="3" strokeDasharray={`${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}, 100`} initial={{ strokeDasharray: '0, 100' }} animate={{ strokeDasharray: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}, 100` }} transition={{ duration: 1.5, ease: "easeOut" }} strokeLinecap="round" />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--accent)" />
                      <stop offset="100%" stopColor="var(--accent-2)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>{totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0}%</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Overall Completion</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Completed', value: totalCompleted, color: 'var(--accent)' },
                { label: 'In Progress', value: projects.reduce((s,p) => s + (p.stats?.inProgressTasks || 0), 0), color: 'var(--accent-2)' },
                { label: 'Pending', value: projects.reduce((s,p) => s + (p.stats?.pendingTasks || 0), 0), color: 'var(--text-3)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, boxShadow: `0 0 10px ${item.color}` }} />
                    <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, padding: 20, background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(52,211,153,0.1))', borderRadius: 16, border: '1px solid rgba(56,189,248,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--accent-2)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Development Velocity</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.5"><path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3 3 3 0 00-3 3v-12a3 3 0 00-3-3z"/><path d="M6 3a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V3z"/><path d="M9 9h6"/></svg>
                {totalCommits}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Total GitHub Commits</div>
            </div>
          </motion.div>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
