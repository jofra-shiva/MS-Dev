'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToProject, updateProject } from '@/lib/firebase/firestore';
import { Project } from '@/types';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/hooks/useAuth';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function GitHubPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');

  useEffect(() => {
    const u1 = subscribeToProject(projectId, setProject);
    const q = query(collection(db, `projects/${projectId}/github_events`), orderBy('processedAt', 'desc'), limit(30));
    const u2 = onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [projectId]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoOwner.trim() || !repoName.trim()) return;
    setConnecting(true);
    try {
      await updateProject(projectId, {
        github: {
          connected: true, repoOwner: repoOwner.trim(), repoName: repoName.trim(),
          repoUrl: `https://github.com/${repoOwner.trim()}/${repoName.trim()}`,
          webhookId: null, installationId: null, connectedAt: new Date(),
        },
      });
      toast.success('GitHub repository connected!');
    } catch { toast.error('Failed to connect'); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect GitHub repository?')) return;
    await updateProject(projectId, { github: { connected: false, repoOwner: '', repoName: '', repoUrl: '', webhookId: null, installationId: null, connectedAt: null } });
    toast.success('GitHub disconnected');
  };

  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    // Only available on the client side
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/github/webhook?projectId=${projectId}`);
    }
  }, [projectId]);

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>GitHub Integration</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>Connect your repository to auto-track commits and update tasks</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Connection Status */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Repository Connection</h3>
          {project?.github?.connected ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>Connected</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{project.github.repoOwner}/{project.github.repoName}</div>
                </div>
              </div>
              <a href={project.github.repoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', marginBottom: 10 }}>
                🔗 Open Repository
              </a>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>⚡ {project.stats?.totalCommits || 0} commits tracked</div>
              <button className="btn btn-danger btn-sm" style={{ marginTop: 12 }} onClick={handleDisconnect}>Disconnect</button>
            </div>
          ) : (
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Connect a GitHub repository to automatically detect commits and update task statuses when developers push code with task IDs (e.g., <span className="mono" style={{ color: 'var(--accent)' }}>TASK-12 completed</span>).
              </div>
              <div className="input-group">
                <label className="input-label">Repository Owner</label>
                <input id="repo-owner-input" className="input" placeholder="e.g. acme-corp" value={repoOwner} onChange={e => setRepoOwner(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Repository Name</label>
                <input id="repo-name-input" className="input" placeholder="e.g. my-project" value={repoName} onChange={e => setRepoName(e.target.value)} required />
              </div>
              <button id="connect-github-btn" type="submit" className="btn btn-primary" disabled={connecting}>
                {connecting ? '...' : '🔗 Connect Repository'}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Setup Guide or Recent Events */}
        {project?.github?.connected ? (
          <div className="card" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recent GitHub Events</h3>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⚡</div>
                <div style={{ fontSize: 13 }}>No events yet. Push a commit with a task ID to see it here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.map((ev, i) => (
                  <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ev.type === 'push' ? '⚡' : ev.type === 'pull_request' ? '🔀' : '🎯'}</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code className="mono truncate-1" style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 600 }}>{ev.commitMessage}</code>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginLeft: 12 }}>{ev.processedAt?.toDate ? formatDistanceToNow(ev.processedAt.toDate(), { addSuffix: true }) : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
                        <span>👤 {ev.author}</span>
                        {ev.taskRefs?.length > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>🎯 {ev.taskRefs.join(', ')}</span>}
                        {ev.additions > 0 && <span style={{ color: 'var(--success)' }}>+{ev.additions}</span>}
                        {ev.deletions > 0 && <span style={{ color: 'var(--danger)' }}>-{ev.deletions}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Webhook Setup Guide</h3>
            
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Follow these steps to connect your GitHub repository with this project:
            </div>
            
            <ol style={{ fontSize: 13, color: 'var(--text-2)', paddingLeft: 20, marginBottom: 20, lineHeight: 1.6 }}>
              <li>Go to your repository on <strong>GitHub</strong>.</li>
              <li>Navigate to <strong>Settings</strong> {'>'} <strong>Webhooks</strong> {'>'} <strong>Add webhook</strong>.</li>
              <li>Paste the <strong>Webhook URL</strong> below into the <strong>Payload URL</strong> field.</li>
              <li>Select <strong>application/json</strong> for the Content type.</li>
              <li>In the <strong>Secret</strong> field, enter exactly: <code style={{ color: 'var(--accent)', fontWeight: 'bold' }}>naanthandaleo</code></li>
              <li>Under "Which events would you like to trigger this webhook?", choose <strong>Let me select individual events</strong>.</li>
              <li>Check <strong>Pushes</strong> and <strong>Pull requests</strong>, then click <strong>Add webhook</strong>.</li>
            </ol>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Your Webhook URL</div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <code className="mono" style={{ fontSize: 11, color: 'var(--accent)', flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{webhookUrl}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied!'); }}>Copy</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
