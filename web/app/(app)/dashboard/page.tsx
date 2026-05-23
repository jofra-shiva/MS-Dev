'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToTasks, subscribeToUserProjects } from '@/lib/firebase/firestore';
import { Project, Task } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import CreateProjectModal from '@/components/projects/CreateProjectModal';

const COLORS = ['#34d399', '#38bdf8', '#6ee7b7', '#7dd3fc', '#a7f3d0', '#bae6fd'];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTaskMap, setProjectTaskMap] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProjects(user.uid, (p) => { setProjects(p); setLoading(false); });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (projects.length === 0) {
      setProjectTaskMap({});
      return;
    }

    const unsubs = projects.map((project) => subscribeToTasks(project.id, (tasks) => {
      setProjectTaskMap((current) => ({ ...current, [project.id]: tasks }));
    }));

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [projects]);

  const allTasks = useMemo(() => Object.values(projectTaskMap).flat(), [projectTaskMap]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const timeA = new Date((a.updatedAt as any)?.toDate?.() || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date((b.updatedAt as any)?.toDate?.() || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [projects]);

  const completedTasks = allTasks.filter((task) => ['completed', 'deployed'].includes(task.status));
  
  const totalTasks = allTasks.length;
  const totalCompleted = completedTasks.length;
  const totalCommits = projects.reduce((s, p) => s + (p.stats?.totalCommits || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'active').length;

  const latestUpdatedTasks = [...allTasks]
    .sort((a, b) => new Date((b.updatedAt as any)?.toDate?.() || b.updatedAt || 0).getTime() - new Date((a.updatedAt as any)?.toDate?.() || a.updatedAt || 0).getTime())
    .slice(0, 5);
  const latestCompletedTasks = [...completedTasks]
    .sort((a, b) => new Date((b.completedAt as any)?.toDate?.() || b.updatedAt || 0).getTime() - new Date((a.completedAt as any)?.toDate?.() || a.updatedAt || 0).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Active Projects', value: activeProjects, icon: '📁', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    { label: 'Total Tasks',     value: totalTasks,      icon: '✅', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { label: 'GitHub Tasks',    value: allTasks.filter(t => t.status === 'github_pushed').length, icon: '🐙', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    { label: 'Deployed',        value: allTasks.filter(t => t.status === 'deployed').length, icon: '🚀', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { label: 'Completed',       value: totalCompleted,  icon: '🎯', color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
    { label: 'Total Commits',   value: totalCommits,    icon: '⚡', color: '#7dd3fc', bg: 'rgba(125,211,252,0.12)' },
  ];

  const taskStatusSummary = [
    { label: 'Recently updated', value: latestUpdatedTasks.length, color: '#38bdf8' },
    { label: 'Recently completed', value: latestCompletedTasks.length, color: '#10b981' },
    { label: 'Completion verified', value: allTasks.filter((task) => ['completed', 'deployed'].includes(task.status) && task.githubRef?.lastCommitSha).length, color: '#8b5cf6' },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ padding: '36px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-1)' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span style={{ color: 'var(--accent)' }}>{user?.displayName?.split(' ')[0] || 'Developer'}</span> 👋
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, fontWeight: 400 }}>Here's the latest pulse on your projects and team activity.</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          id="create-project-btn" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15, zIndex: 1, borderRadius: 12, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }} onClick={() => setShowCreate(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </motion.button>
      </motion.div>

      {/* Stats */}
      <motion.div 
        initial="hidden" animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}
      >
        {stats.map((s, i) => (
          <motion.div 
            key={s.label} 
            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
            whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}
            transition={{ duration: 0.2 }}
            style={{ 
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderTop: `3px solid ${s.color}`, borderRadius: 16, 
              padding: '24px 24px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' 
            }}
          >
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>



      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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
            <div style={{ padding: 60, textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 24, background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse-glow 3s infinite' }}>🚀</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>No projects yet</div>
              <div style={{ color: 'var(--text-2)', fontSize: 15, marginBottom: 24 }}>Create your first project to get started</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {sortedProjects.slice(0, 3).map((p, i) => {
                const pTasks = projectTaskMap[p.id] || [];
                const pTotalTasks = pTasks.length;
                const pCompletedTasks = pTasks.filter(t => ['completed', 'deployed'].includes(t.status)).length;
                const pCompletionPercentage = pTotalTasks > 0 ? (pCompletedTasks / pTotalTasks) * 100 : 0;
                
                return (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
                  <div style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <motion.div onClick={() => router.push(`/projects/${p.id}`)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 20, cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} whileHover={{ y: -6, boxShadow: '0 16px 40px rgba(0,0,0,0.08)', borderColor: 'var(--border)' }}>
                      <div style={{ height: 4, width: '100%', background: p.color || COLORS[i % COLORS.length] }} />
                      <div style={{ padding: 28, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }} className="truncate-1">{p.name}</h3>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.status}</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, flex: 1, lineHeight: 1.6, opacity: 0.85 }} className="truncate-2">{p.description || 'No description available for this project.'}</p>
                        
                        <div style={{ marginTop: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 }}>
                            <span>Progress</span><span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{Math.round(pCompletionPercentage)}%</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${pCompletionPercentage}%`, height: '100%', background: p.color || 'var(--accent)', borderRadius: 99, boxShadow: `0 0 12px ${p.color || 'var(--accent)'}`, transition: 'width 0.5s ease' }} />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-3)', marginTop: 16, fontWeight: 500 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> {pTotalTasks} tasks</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> {Object.keys(p.members || {}).length} team</span>
                          </div>


                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}
        </div>


      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
