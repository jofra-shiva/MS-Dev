'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToTasks, subscribeToUserProjects } from '@/lib/firebase/firestore';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Project, Task } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDistanceToNow, addDays } from 'date-fns';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import LinkGithubModal from '@/components/ui/LinkGithubModal';

const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTaskMap, setProjectTaskMap] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [localGithub, setLocalGithub] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, 'users', user.uid)).then(d => {
        if (d.exists() && d.data().githubUsername) {
          setLocalGithub(d.data().githubUsername);
        }
      }).catch(console.error);
    }
  }, [user]);

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

    return () => unsubs.forEach((unsub) => unsub());
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
  const activeProjects = projects.filter(p => p.status === 'active').length;

  // Mock data for UI presentation based on real lengths
  const trendActive = activeProjects > 0 ? '+12%' : '0%';
  const trendTasks = allTasks.length > 0 ? '+5%' : '0%';
  const trendCommits = projects.length > 0 ? '+18%' : '0%';

  const stats = [
    { label: 'Active Projects', value: activeProjects, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>, color: '#06b6d4', trend: trendActive },
    { label: 'Total Tasks', value: allTasks.length, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>, color: '#8b5cf6', trend: trendTasks },
    { label: 'GitHub Sync', value: allTasks.filter(t => t.status === 'github_pushed').length, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>, color: '#10b981', trend: '+2%' },
    { label: 'Completed', value: completedTasks.length, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>, color: '#f59e0b', trend: trendCommits },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>

      {/* Top Banner - Compact Glassmorphic */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{
          padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, overflow: 'hidden' }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            ) : (
              user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'
            )}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-1)', margin: 0, lineHeight: 1.2 }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.displayName?.split(' ')[0] || 'Developer'}
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0, marginTop: 4 }}>You have {allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length} active tasks across {activeProjects} projects.</p>
          </div>
        </div>
        <button className="btn btn-primary" style={{ borderRadius: 10, padding: '8px 16px', fontSize: 13, height: 38 }} onClick={() => setShowCreate(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Project
        </button>
      </motion.div>

      {/* Promotional Banner for VS Code Extension */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🚀</div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px 0' }}>New to coding? Supercharge your workflow!</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
              Naanga pudhusa code pandravangalukkagave oru VS Code Extension create pannirukom. Try it out now!
            </p>
          </div>
        </div>
        <a href="vscode:extension/jofra-shiva.ms-dev" className="btn btn-primary shadow-lg" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', background: 'var(--accent)', color: '#fff', border: 'none' }}>
          Get Extension
        </a>
      </motion.div>

      {/* Main Grid Layout (Row-based for equal heights) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Row 1: Stats & Activity Map */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="stats-grid">
            {stats.map((s, i) => (
              <motion.div
                key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, backgroundColor: 'var(--bg-hover)' }}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14,
                  padding: 20, position: 'relative', overflow: 'hidden', cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: `${s.color}15`, padding: '2px 8px', borderRadius: 99 }}>
                    {s.trend}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, fontWeight: 600 }}>{s.label}</div>

                {/* Glow effect */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', background: `radial-gradient(circle at right top, ${s.color}10, transparent 60%)`, pointerEvents: 'none' }} />
              </motion.div>
            ))}
          </div>

          {/* Activity Map */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Activity Map</h2>
                {(user as any)?.githubUsername || localGithub ? (
                  <span style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 99, color: 'var(--text-2)' }}>
                    @{(user as any)?.githubUsername || localGithub}
                  </span>
                ) : null}
              </div>
            </div>

            {(user as any)?.githubUsername || localGithub ? (
              <div style={{ position: 'relative', height: 74, overflow: 'hidden', borderRadius: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', background: 'var(--bg-card)' }}>
                <div style={{ position: 'absolute', top: 6, left: 10, fontSize: 10, fontWeight: 700, color: 'var(--text-3)', zIndex: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {new Date().toLocaleString('default', { month: 'long' })}
                </div>
                <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, boxShadow: 'inset 30px 0 20px var(--bg-card)', zIndex: 5, pointerEvents: 'none' }} />
                <img
                  src={`https://ghchart.rshah.org/10b981/${(user as any)?.githubUsername || localGithub}`}
                  alt={`${(user as any)?.githubUsername || localGithub}'s GitHub chart`}
                  className="github-chart"
                  style={{
                    height: 88,
                    maxWidth: 'none',
                    marginTop: -12,
                    marginRight: -4,
                  }}
                  onError={(e) => {
                    (e.target as any).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, opacity: 0.25, pointerEvents: 'none', filter: 'blur(1.5px)' }}>
                  {Array.from({ length: 36 }).map((_, i) => {
                    const intensity = Math.random() > 0.6 ? 0 : Math.floor(Math.random() * 4);
                    const colors = ['var(--bg-hover)', '#064e3b', '#059669', '#10b981'];
                    return (
                      <div key={i} style={{ aspectRatio: '1/1', background: colors[intensity], borderRadius: 3 }} />
                    );
                  })}
                </div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <button
                    onClick={() => setShowGithubModal(true)}
                    className="btn btn-primary shadow-lg" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
                    Connect GitHub
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Active Projects & Upcoming Deadlines */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
          {/* Active Projects */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', height: 250 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Active Projects</h2>
              <Link href="/projects" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
            </div>

            {loading ? (
              <div style={{ display: 'flex', gap: 16 }}>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 140, flex: 1, borderRadius: 12 }} />)}</div>
            ) : sortedProjects.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No active projects. Create one above!</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginRight: -4 }} className="custom-scrollbar">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {sortedProjects.map((p, i) => {
                    const pTasks = projectTaskMap[p.id] || [];
                    const pCompleted = pTasks.filter(t => ['completed', 'deployed'].includes(t.status)).length;
                    const progress = pTasks.length ? (pCompleted / pTasks.length) * 100 : 0;
                    const color = p.color || COLORS[i % COLORS.length];

                    // Mock data for new UI elements
                    const priorities = ['High', 'Med', 'Low'];
                    const priority = priorities[p.name.length % 3];
                    const pColors: any = { High: 'var(--danger)', Med: 'var(--warning)', Low: 'var(--success)' };

                    return (
                      <motion.div key={p.id} whileHover={{ y: -4, borderColor: 'var(--accent)' }} onClick={() => router.push(`/projects/${p.id}`)}
                        style={{
                          border: '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer',
                          background: 'var(--bg-card)', position: 'relative', overflow: 'hidden', height: 150
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-1)' }} className="truncate-1">{p.name}</h3>
                          <span style={{ fontSize: 10, fontWeight: 700, color: pColors[priority], background: `${pColors[priority]}15`, padding: '2px 6px', borderRadius: 4 }}>{priority}</span>
                        </div>

                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5, height: 36 }} className="truncate-2">
                          {p.description || 'No description available for this project.'}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-2)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> {pTasks.length}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> {pTasks.length % 3} bugs</span>
                          </div>
                          {/* Mock Team Avatars */}
                          <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                            {[1, 2].map(x => (
                              <div key={x} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--bg-card)', marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-1)' }}>
                                {user?.displayName?.[0] || 'U'}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                            style={{ height: '100%', background: `linear-gradient(90deg, ${color}, ${color}80)`, borderRadius: 99 }}
                          />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', height: 250 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Upcoming Deadlines</h2>
                <span style={{ fontSize: 10, background: 'var(--danger)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Due</span>
              </div>
              <Link href="/projects" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', paddingRight: 4, marginRight: -4 }} className="custom-scrollbar">
              {allTasks.filter(t => t.status !== 'completed' && t.status !== 'deployed').map((t, i) => (
                <div key={`${t.id || 'task'}-${i}`} onClick={() => router.push(`/projects/${t.projectId}`)} style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }} className="group hover:bg-[var(--bg-hover)]">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }} className="truncate-1">{t.title}</div>
                  </div>
                </div>
              ))}
              {allTasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '10px 0' }}>No upcoming deadlines</div>}
            </div>
          </div>
        </div>

        {/* Row 3: Analytics & Recent Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
          {/* Weekly Productivity (Mock Chart) */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-1)', marginBottom: 20 }}>Weekly Productivity</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, padding: '0 10px' }}>
              {/* Mock Bar Chart */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                const h = 30 + Math.random() * 70;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{ width: '100%', height: `${h}%`, background: idx === 4 ? 'var(--accent)' : 'var(--bg-hover)', borderRadius: '4px 4px 0 0', transition: 'background 0.2s', position: 'relative' }}>
                      {idx === 4 && <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-1)', color: 'var(--bg-primary)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>24</div>}
                    </div>
                    <span style={{ fontSize: 11, color: idx === 4 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 600 }}>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-1)', marginBottom: 16 }}>Recent Activity</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }}>
              {allTasks.slice(0, 4).map((t, i) => (
                <div key={`${t.id || 'task'}-${i}`} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, zIndex: 1, position: 'relative', color: 'var(--text-2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    {i !== 3 && <div style={{ position: 'absolute', top: 28, left: 13, width: 2, height: 24, background: 'var(--bg-hover)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }} className="truncate-1">
                      <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{user?.displayName?.split(' ')[0]}</span> {i % 2 === 0 ? 'deployed' : 'updated'} <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{t.title.slice(0, 15)}...</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {t.updatedAt ? formatDistanceToNow((t.updatedAt as any).toDate ? (t.updatedAt as any).toDate() : t.updatedAt, { addSuffix: true }) : 'Just now'}
                    </div>
                  </div>
                </div>
              ))}
              {allTasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>No recent activity</div>}
            </div>
          </div>

        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}

      {showGithubModal && (
        <LinkGithubModal
          onClose={() => setShowGithubModal(false)}
          onLink={async (un) => {
            if (un && user?.uid) {
              try {
                setLocalGithub(un);
                await updateDoc(doc(db, 'users', user.uid), { githubUsername: un });
                setShowGithubModal(false);
              } catch (e) {
                console.error('Failed to link GitHub', e);
              }
            }
          }}
        />
      )}
    </div>
  );
}
