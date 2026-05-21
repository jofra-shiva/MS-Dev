'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createProject } from '@/lib/firebase/firestore';
import { logActivity } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#6366F1','#8B5CF6','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];
const PREFIXES = ['TASK','FEAT','BUG','PROJ','DEV','ISSUE'];

interface Props { onClose: () => void; }

export default function CreateProjectModal({ onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [prefix, setPrefix] = useState('TASK');
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    try {
      const id = await createProject({
        name: name.trim(),
        description: desc.trim(),
        ownerId: user.uid,
        taskPrefix: prefix,
        color,
        status: 'active',
        members: {
          [user.uid]: {
            role: 'admin',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            email: user.email || '',
            joinedAt: new Date(),
          },
        },
        github: { connected: false, repoOwner: '', repoName: '', repoUrl: '', webhookId: null, installationId: null, connectedAt: null },
      }, user.uid);
      await logActivity(id, { type: 'project_created', userId: user.uid, userName: user.displayName || '', userPhoto: user.photoURL || '', taskId: null, taskTitle: null, metadata: { projectName: name } });
      toast.success('Project created!');
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create New Project</h2>
            <button id="close-modal-btn" className="btn-icon btn-ghost" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Project Name *</label>
              <input id="project-name-input" className="input" placeholder="e.g. E-Commerce Platform" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea id="project-desc-input" className="input" placeholder="What is this project about?" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Task Prefix</label>
                <select id="task-prefix-select" className="input" value={prefix} onChange={e => setPrefix(e.target.value)}>
                  {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Project Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" id={`color-${c}`}
                      onClick={() => setColor(c)}
                      style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '3px solid white' : '3px solid transparent', cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 1 }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button id="create-project-submit" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !name.trim()}>
                {loading ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> : '✨ Create Project'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
