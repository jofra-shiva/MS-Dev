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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '11px 14px',
    color: 'var(--text-1)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  };

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 520,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Modal Header */}
          <div style={{
            padding: '24px 28px 0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,168,132,0.3)',
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.01em' }}>
                  Create New Project
                </h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
                Set up your workspace in seconds
              </p>
            </div>
            <button
              id="close-modal-btn"
              onClick={onClose}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-3)',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 0' }} />

          {/* Form Body */}
          <form onSubmit={handleCreate} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Project Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Project Name <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                id="project-name-input"
                style={inputStyle}
                placeholder="e.g. E-Commerce Platform"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,168,132,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Description
              </label>
              <textarea
                id="project-desc-input"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }}
                placeholder="What is this project about?"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,168,132,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                rows={3}
              />
            </div>

            {/* Live Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Live URL <span style={{ color: 'var(--text-3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <input
                  id="project-livelink-input"
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  placeholder="https://..."
                  type="url"
                  value={liveLink}
                  onChange={e => setLiveLink(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,168,132,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-2)'; }}
              >
                Cancel
              </button>
              <button
                id="create-project-submit"
                type="submit"
                disabled={loading || !name.trim()}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 10,
                  background: loading || !name.trim() ? 'var(--bg-hover)' : 'var(--accent)',
                  border: 'none',
                  color: loading || !name.trim() ? 'var(--text-3)' : 'white',
                  fontSize: 14, fontWeight: 700,
                  cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s',
                  boxShadow: !loading && name.trim() ? '0 4px 14px rgba(0,168,132,0.3)' : 'none',
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    Create Project
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
