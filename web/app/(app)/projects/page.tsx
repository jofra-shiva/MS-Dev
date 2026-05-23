'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { subscribeToUserProjects, subscribeToTasks } from '@/lib/firebase/firestore';
import { Project, Task } from '@/types';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CreateProjectModal from '@/components/projects/CreateProjectModal';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTaskMap, setProjectTaskMap] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all'|'active'|'completed'|'archived'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeToUserProjects(user.uid, p => { setProjects(p); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (projects.length === 0) {
      setProjectTaskMap({});
      return;
    }

    const unsubs = projects.map((project) => subscribeToTasks(project.id, (tasks) => {
      setProjectTaskMap((current) => ({ ...current, [project.id]: tasks as Task[] }));
    }));

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [projects]);

  const filtered = projects.filter(p =>
    (filter === 'all' || p.status === filter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fadeIn">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.02em' }}>Projects</h1>
          <p style={{ color:'var(--text-2)', fontSize:13.5, marginTop:3 }}>{projects.length} total projects</p>
        </div>
        <button id="new-project-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="project-search" className="input" style={{ paddingLeft:36 }} placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6, background:'var(--bg-elevated)', padding:4, borderRadius:8, border:'1px solid var(--border-subtle)' }}>
          {(['all','active','completed','archived'] as const).map(f => (
            <button key={f} id={`filter-${f}`} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: filter===f ? 'var(--accent)' : 'transparent', color: filter===f ? 'white' : 'var(--text-2)', transition:'all 0.15s' }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:180, borderRadius:12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', background:'var(--bg-card)', borderRadius:12, border:'1px dashed var(--border)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
          <div style={{ fontWeight:700, marginBottom:6 }}>{search ? 'No projects found' : 'No projects yet'}</div>
          <div style={{ color:'var(--text-2)', fontSize:13, marginBottom:20 }}>{search ? 'Try a different search term' : 'Create your first project to start tracking work'}</div>
          {!search && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {filtered.map((p, i) => {
            const pTasks = projectTaskMap[p.id] || [];
            const pTotalTasks = pTasks.length;
            const pCompletedTasks = pTasks.filter(t => ['completed', 'deployed'].includes(t.status)).length;
            const pCompletionPercentage = pTotalTasks > 0 ? (pCompletedTasks / pTotalTasks) * 100 : 0;
            const pCommits = pTasks.filter(t => Boolean(t.githubRef?.lastCommitSha)).length;
            
            return (
            <motion.div key={p.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}>
              <Link href={`/projects/${p.id}`} style={{ textDecoration:'none' }}>
                <div className="card" style={{ cursor:'pointer', borderLeft:`4px solid ${p.color||'var(--accent)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <h3 style={{ fontSize:15, fontWeight:700 }} className="truncate-1">{p.name}</h3>
                    <span className={`badge badge-${p.status}`} style={{ flexShrink:0, marginLeft:8 }}>{p.status}</span>
                  </div>
                  <p style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:14, lineHeight:1.5 }} className="truncate-2">{p.description || 'No description provided.'}</p>
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-2)', marginBottom:5 }}>
                      <span>Completion</span><span style={{ fontWeight:700, color:'var(--text-1)' }}>{Math.round(pCompletionPercentage)}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${pCompletionPercentage}%` }} /></div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--text-3)' }}>
                      <span>📋 {pTotalTasks} tasks</span>
                      <span>✅ {pCompletedTasks} done</span>
                      <span>⚡ {pCommits || p.stats?.totalCommits || 0} commits</span>
                    </div>
                    <div style={{ display:'flex', marginLeft:'auto' }}>
                      {Object.entries(p.members||{}).slice(0,4).map(([uid, m]: any) => (
                        m.photoURL
                          ? <img key={uid} src={m.photoURL} title={m.displayName} className="avatar avatar-sm" style={{ marginLeft:-6, border:'2px solid var(--bg-card)' }} />
                          : <div key={uid} title={m.displayName} className="avatar-placeholder" style={{ width:24, height:24, fontSize:9, marginLeft:-6, border:'2px solid var(--bg-card)' }}>{m.displayName?.slice(0,2).toUpperCase()}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )})}
        </div>
      )}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
