'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToTasks, subscribeToProject } from '@/lib/firebase/firestore';
import { Task, Project } from '@/types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const COLORS_PIE = ['#475569', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];

const toDate = (value: any) => {
  if (!value) return null;
  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
};

const timeValue = (value: any) => {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

export default function AnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const u1 = subscribeToProject(projectId, setProject);
    const u2 = subscribeToTasks(projectId, setTasks);
    return () => { u1(); u2(); };
  }, [projectId]);

  const byStatus = [
    { name: 'Pending', value: tasks.filter(t => t.status === 'pending').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length },
    { name: 'Testing', value: tasks.filter(t => t.status === 'testing').length },
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length },
    { name: 'GitHub', value: tasks.filter(t => t.status === 'github_pushed').length },
    { name: 'Deployed', value: tasks.filter(t => t.status === 'deployed').length },
  ];

  const byPriority = [
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length },
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length },
    { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length },
  ];

  const completedTasks = tasks.filter(t => ['completed', 'deployed'].includes(t.status));
  const githubVerifiedTasks = completedTasks.filter(t => Boolean(t.githubRef?.lastCommitSha));
  const latestCompletedTask = [...completedTasks].sort((a, b) => timeValue(b.completedAt || b.updatedAt) - timeValue(a.completedAt || a.updatedAt))[0];
  const latestUpdatedTask = [...tasks].sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt))[0];
  const lastUpdater = latestUpdatedTask?.lastMovedBy?.name || '—';

  // Module breakdown
  const modules = tasks.reduce((acc, t) => {
    if (!t.module) return acc;
    if (!acc[t.module]) acc[t.module] = { total: 0, completed: 0 };
    acc[t.module].total++;
    if (['completed', 'deployed'].includes(t.status)) acc[t.module].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);
  const moduleData = Object.entries(modules).map(([name, v]) => ({ name, ...v, pct: Math.round((v.completed / v.total) * 100) }));

  // Assignee breakdown
  const assignees = tasks.reduce((acc, t) => {
    if (!t.assigneeName) return acc;
    if (!acc[t.assigneeName]) acc[t.assigneeName] = { total: 0, completed: 0 };
    acc[t.assigneeName].total++;
    if (['completed', 'deployed'].includes(t.status)) acc[t.assigneeName].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);
  const assigneeData = Object.entries(assignees).map(([name, v]) => ({ name, ...v }));

  const completionOwners = tasks.reduce((acc, t) => {
    const owner = t.completedBy?.name;
    if (!owner) return acc;
    if (!acc[owner]) acc[owner] = { total: 0 };
    acc[owner].total++;
    return acc;
  }, {} as Record<string, { total: number }>);
  const completionOwnerData = Object.entries(completionOwners).map(([name, v]) => ({ name, total: v.total }));

  const auditCards = [
    { label: 'Verified completion', value: `${tasks.length > 0 ? Math.round((githubVerifiedTasks.length / tasks.length) * 100) : 0}%`, hint: `${githubVerifiedTasks.length} tasks confirmed by GitHub`, color: '#10B981' },
    { label: 'Latest completed by', value: latestCompletedTask?.completedBy?.name || '—', hint: latestCompletedTask?.completedAt ? formatDistanceToNow(toDate(latestCompletedTask.completedAt)!, { addSuffix: true }) : 'No completed task yet', color: '#38BDF8' },
    { label: 'Last updated by', value: lastUpdater, hint: latestUpdatedTask?.updatedAt ? formatDistanceToNow(toDate(latestUpdatedTask.updatedAt)!, { addSuffix: true }) : 'No updates yet', color: '#F59E0B' },
    { label: 'Latest commit linked', value: tasks.some(t => t.githubRef?.lastCommitSha) ? 'Yes' : 'No', hint: 'Tracker now shows commit-backed completion state', color: '#8B5CF6' },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Analytics</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>Project performance and team insights</p>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Completion Rate', value: `${tasks.length > 0 ? Math.round((completedTasks.length/tasks.length)*100) : 0}%`, color: '#6366F1' },
          { label: 'Total Tasks', value: tasks.length, color: '#10B981' },
          { label: 'Avg Progress', value: `${tasks.length > 0 ? Math.round(tasks.reduce((s,t)=>s+t.progress,0)/tasks.length) : 0}%`, color: '#F59E0B' },
          { label: 'Verified by GitHub', value: `${githubVerifiedTasks.length}/${completedTasks.length || 0}`, color: '#38BDF8' },
          { label: 'Team Members', value: Object.keys(project?.members||{}).length, color: '#3B82F6' },
        ].map((s,i) => (
          <motion.div key={s.label} className="stat-card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Audit summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {auditCards.map((card, i) => (
          <motion.div key={card.label} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.06 }} style={{ borderTop: `3px solid ${card.color}` }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{card.hint}</div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Status Pie */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Bar */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byPriority} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#6366F1" radius={[6,6,0,0]}>
                {byPriority.map((_, i) => <Cell key={i} fill={['#475569','#3B82F6','#F59E0B','#EF4444'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Completion Ownership</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={completionOwnerData} layout="vertical" barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#10B981" radius={[0,4,4,0]} name="Completed by" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Latest Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Most recently updated</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{latestUpdatedTask?.title || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                {lastUpdater !== '—' ? `Updated by ${lastUpdater}` : 'No update history yet'}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Latest completion</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{latestCompletedTask?.title || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                {latestCompletedTask?.completedBy?.name ? `Completed by ${latestCompletedTask.completedBy.name}` : 'No completed task yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Completion */}
      {moduleData.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Module Completion</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {moduleData.map(m => (
              <div key={m.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 500 }}>{m.name}</span>
                  <span style={{ color: 'var(--text-2)' }}>{m.completed}/{m.total} · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{m.pct}%</span></span>
                </div>
                <div className="progress-bar" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${m.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Contribution */}
      {assigneeData.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Team Contribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={assigneeData} layout="vertical" barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="rgba(99,102,241,0.3)" radius={[0,4,4,0]} name="Total" />
              <Bar dataKey="completed" fill="#6366F1" radius={[0,4,4,0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
