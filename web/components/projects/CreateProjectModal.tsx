'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [liveLink, setLiveLink] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    try {
      const id = await createProject({
        name: name.trim(),
        description: desc.trim(),
        ownerId: user.uid,
        taskPrefix: PREFIXES[Math.floor(Math.random() * PREFIXES.length)],
        liveUrl: liveLink.trim(),
        color: randomColor,
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

  const modalContent = (
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
            <div className="input-group">
              <label className="input-label">Live Link (optional)</label>
              <input id="project-livelink-input" className="input" placeholder="https://..." type="url" value={liveLink} onChange={e => setLiveLink(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button id="create-project-submit" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !name.trim()}>
                {loading ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> : 'Create Project'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
