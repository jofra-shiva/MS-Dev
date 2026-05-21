'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToProject, subscribeToTasks } from '@/lib/firebase/firestore';
import { Project, Task } from '@/types';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToProject(projectId, p => { setProject(p); setLoading(false); });
    const u2 = subscribeToTasks(projectId, setTasks);
    return () => { u1(); u2(); };
  }, [projectId]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="animate-spin" style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%' }} />
    </div>
  );
  if (!project) return <div style={{ textAlign:'center', padding:60, color:'var(--text-2)' }}>Project not found.</div>;

  const byStatus = {
    pending: tasks.filter(t => t.status==='pending'),
    in_progress: tasks.filter(t => t.status==='in_progress'),
    testing: tasks.filter(t => t.status==='testing'),
    completed: tasks.filter(t => t.status==='completed'),
  };

  const members = Object.entries(project.members || {});

  return (
    <div className="animate-fadeIn">
      {/* Stats Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Tasks', value:tasks.length, color:'var(--accent)' },
          { label:'In Progress', value:byStatus.in_progress.length, color:'var(--warning)' },
          { label:'Completed', value:byStatus.completed.length, color:'var(--success)' },
          { label:'Team Size', value:members.length, color:'var(--info)' },
        ].map((s,i) => (
          <motion.div key={s.label} className="stat-card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}>
            <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-2)' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
        {/* Task Status Breakdown */}
        <div>
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Task Progress</h3>
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-2)', marginBottom:6 }}>
                <span>Overall completion</span>
                <span style={{ fontWeight:700, color:'var(--text-1)' }}>{Math.round(project.completionPercentage||0)}%</span>
              </div>
              <div className="progress-bar" style={{ height:8 }}><div className="progress-fill" style={{ width:`${project.completionPercentage||0}%` }} /></div>
            </div>
            {[
              { label:'Completed', count:byStatus.completed.length, color:'var(--success)', cls:'completed' },
              { label:'Testing', count:byStatus.testing.length, color:'var(--info)', cls:'testing' },
              { label:'In Progress', count:byStatus.in_progress.length, color:'var(--warning)', cls:'in_progress' },
              { label:'Pending', count:byStatus.pending.length, color:'var(--text-3)', cls:'pending' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:row.color, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color:'var(--text-2)' }}>{row.label}</span>
                <span style={{ fontSize:13, fontWeight:700 }}>{row.count}</span>
                <div style={{ width:80 }}>
                  <div className="progress-bar" style={{ height:4 }}>
                    <div style={{ height:'100%', borderRadius:99, background:row.color, width: tasks.length > 0 ? `${(row.count/tasks.length)*100}%` : '0%', transition:'width 0.5s' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Tasks */}
          <div className="card" style={{ marginTop:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>Recent Tasks</h3>
              <Link href={`/projects/${projectId}/kanban`} style={{ fontSize:12, color:'var(--accent)', textDecoration:'none' }}>View board →</Link>
            </div>
            {tasks.length === 0
              ? <div style={{ color:'var(--text-3)', fontSize:13, textAlign:'center', padding:'20px 0' }}>No tasks yet</div>
              : tasks.slice(0,5).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                  <span className={`badge badge-${t.status}`} style={{ flexShrink:0, fontSize:10 }}>{t.status.replace('_',' ')}</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }} className="truncate-1">{t.title}</span>
                  <span className={`badge badge-${t.priority}`} style={{ flexShrink:0, fontSize:10 }}>{t.priority}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* Members Panel */}
        <div>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>Team Members</h3>
              <Link href={`/projects/${projectId}/settings`} style={{ fontSize:12, color:'var(--accent)', textDecoration:'none' }}>Manage →</Link>
            </div>
            {members.map(([uid, m]: any) => (
              <div key={uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                {m.photoURL
                  ? <img src={m.photoURL} className="avatar" alt="" />
                  : <div className="avatar-placeholder">{m.displayName?.slice(0,2).toUpperCase()}</div>
                }
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:13, fontWeight:600 }} className="truncate-1">{m.displayName}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>{m.email}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                  background: m.role==='admin' ? 'rgba(99,102,241,0.15)' : m.role==='member' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.15)',
                  color: m.role==='admin' ? 'var(--accent)' : m.role==='member' ? 'var(--success)' : 'var(--text-3)',
                  textTransform:'uppercase' }}>{m.role}</span>
              </div>
            ))}
          </div>

          {/* GitHub Status */}
          <div className="card" style={{ marginTop:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>GitHub Integration</h3>
            {project.github?.connected ? (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)' }} />
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>Connected</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text-2)', fontFamily:'var(--mono)' }}>
                  {project.github.repoOwner}/{project.github.repoName}
                </div>
                <div style={{ marginTop:10, fontSize:12, color:'var(--text-3)' }}>⚡ {project.stats?.totalCommits||0} commits tracked</div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>🔗</div>
                <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>Connect a GitHub repository to track commits automatically</div>
                <Link href={`/projects/${projectId}/github`} className="btn btn-secondary btn-sm">Connect GitHub</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
