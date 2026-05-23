'use client';
import { useState, useEffect } from 'react';
import { Task, Comment, Meeting } from '@/types';
import { updateTask, deleteTask, subscribeToComments, addComment, logActivity, subscribeToMeetings, approveTaskMovePermission } from '@/lib/firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Props { task: Task; projectId: string; onClose: () => void; }

export default function TaskDetailModal({ task, projectId, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ 
    title: task.title, 
    description: task.description, 
    progress: task.progress, 
    status: task.status, 
    priority: task.priority, 
    type: task.type || 'feature',
    meetingId: task.meetingId || 'none'
  });
  const [saving, setSaving] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const unsubComments = subscribeToComments(projectId, task.id, setComments);
    const unsubMeetings = subscribeToMeetings(projectId, setMeetings);
    return () => {
      unsubComments();
      unsubMeetings();
    };
  }, [projectId, task.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTask(projectId, task.id, {
        ...form,
        meetingId: form.meetingId === 'none' ? null : form.meetingId,
        lastMovedBy: {
          uid: user!.uid,
          name: user!.displayName || 'Unknown User',
          photo: user!.photoURL || '',
          date: new Date()
        },
        ...(form.status === 'completed' && task.status !== 'completed' ? {
          completedBy: {
            uid: user!.uid,
            name: user!.displayName || 'Unknown User',
            photo: user!.photoURL || '',
            date: new Date(),
          }
        } : {}),
        ...(form.status !== 'completed' && task.status === 'completed' ? { completedBy: null } : {})
      });
      await logActivity(projectId, { type: 'task_updated', userId: user!.uid, userName: user!.displayName||'', userPhoto: user!.photoURL||'', taskId: task.id, taskTitle: form.title, metadata: {} });
      toast.success('Task updated');
      setEditing(false);
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await deleteTask(projectId, task.id);
    toast.success('Task deleted');
    onClose();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setCommenting(true);
    try {
      await addComment(projectId, task.id, { authorId: user.uid, authorName: user.displayName||'', authorPhoto: user.photoURL||'', text: newComment.trim(), attachments: [] });
      setNewComment('');
    } finally { setCommenting(false); }
  };

  const handleApproveMove = async (requesterId: string) => {
    try {
      await approveTaskMovePermission(projectId, task.id, requesterId, task.title);
      toast.success('Permission granted!');
    } catch (e: any) {
      toast.error('Failed to grant permission: ' + e.message);
    }
  };

  const toDate = (value: any) => {
    if (!value) return null;
    return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  };

  const formatAuditDate = (value: any) => {
    const date = toDate(value);
    if (!date || Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString('en-GB')} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const isAssignee = user?.uid === task.assigneeId;

  return (
    <AnimatePresence>
      <div key="main-modal" className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div className="modal modal-lg" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              {editing
                ? <input className="input" style={{ fontSize: 18, fontWeight: 700 }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                : <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{task.title}</h2>
              }
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                <span style={{ fontSize: 11, background: 'var(--bg-elevated)', color: 'var(--text-1)', padding: '3px 9px', borderRadius: 99 }}>{task.type === 'bug' ? 'Bug' : task.type === 'feature' ? 'Feature' : 'Improvement'}</span>
                {task.module && <span style={{ fontSize: 11, background: 'var(--bg-elevated)', color: 'var(--text-2)', padding: '3px 9px', borderRadius: 99 }}>Module: {task.module}</span>}
                {task.githubRef?.lastCommitSha && <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: 'var(--success)', padding: '3px 9px', borderRadius: 99 }} className="mono">Commit: {task.githubRef.lastCommitSha.slice(0, 7)}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {editing
                ? <>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Save'}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  </>
                : <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
                  </>
              }
              <button className="btn-icon btn-ghost" onClick={onClose}>✕</button>
            </div>
          </div>

          {isAssignee && task.moveRequests && task.moveRequests.length > 0 && (
            <div style={{ marginBottom: 20, padding: 14, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                Permission Requests
              </div>
              {task.moveRequests.map(reqId => (
                <div key={reqId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Someone requested to move this task.</span>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApproveMove(reqId)}>Approve</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>
            {/* Main content */}
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Description</div>
                {editing
                  ? <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
                  : <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{task.description || 'No description.'}</p>
                }
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Progress — {editing ? form.progress : task.progress}%
                </div>
                {editing
                  ? <input type="range" min={0} max={100} step={5} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  : <div className="progress-bar" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
                }
              </div>

              {/* GitHub Ref */}
              {task.githubRef?.lastCommitMessage && (
                <div style={{ marginBottom: 18, padding: 14, background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--success)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 6 }}>Latest Commit</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{task.githubRef.lastCommitMessage}</div>
                </div>
              )}

              {/* Audit Trail */}
              <div style={{ marginBottom: 18, padding: 14, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 10 }}>Audit Trail</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Created</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', textAlign: 'right' }}>{formatAuditDate(task.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Last updated</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', textAlign: 'right' }}>{formatAuditDate(task.updatedAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Updated by</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', textAlign: 'right' }}>{task.lastMovedBy?.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Completed</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', textAlign: 'right' }}>{task.completedAt ? formatAuditDate(task.completedAt) : 'Not completed yet'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Completed by</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', textAlign: 'right' }}>{task.completedBy?.name || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Attachments / Screenshots */}
              {task.attachments && task.attachments.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>Screenshots</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    {task.attachments.map((attachment, idx) => (
                      <div key={idx} onClick={() => setPreviewImage(attachment.url)} style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', aspectRatio: '16/9', background: 'var(--bg-elevated)', cursor: 'zoom-in' }}>
                        <img src={attachment.url} alt={`Screenshot ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>Comments ({comments.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                      {c.authorPhoto
                        ? <img src={c.authorPhoto} className="avatar avatar-sm" style={{ flexShrink: 0 }} alt="" />
                        : <div className="avatar-placeholder" style={{ width: 24, height: 24, fontSize: 9, flexShrink: 0 }}>{c.authorName.slice(0,2).toUpperCase()}</div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{c.authorName}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{(c.createdAt as any)?.toDate ? formatDistanceToNow((c.createdAt as any).toDate(), { addSuffix: true }) : ''}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8 }}>{c.text}</div>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No comments yet. Be the first!</div>}
                </div>
                <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!newComment.trim() || commenting}>Send</button>
                </form>
              </div>
            </div>

            {/* Sidebar details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Assignee', content: task.assigneeName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {task.assigneePhoto ? <img src={task.assigneePhoto} className="avatar avatar-sm" alt="" /> : <div className="avatar-placeholder" style={{ width: 22, height: 22, fontSize: 8 }}>{task.assigneeName.slice(0,2).toUpperCase()}</div>}
                    <span style={{ fontSize: 13 }}>{task.assigneeName}</span>
                  </div>
                ) : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Unassigned</span> },
                { label: 'Due Date', content: <span style={{ fontSize: 13 }}>{task.dueDate ? new Date((task.dueDate as any).toDate?.() || task.dueDate).toLocaleDateString('en-GB') : '—'}</span> },
                { label: 'Meeting', content: task.meetingId ? <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }} title="Task originated from a meeting">📅 {meetings.find(m => m.id === task.meetingId)?.name || 'Linked'}</span> : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>None</span> },
                { label: 'Created', content: <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{(task.createdAt as any)?.toDate ? formatDistanceToNow((task.createdAt as any).toDate(), { addSuffix: true }) : '—'}</span> },
                { label: 'Tags', content: task.tags?.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{task.tags.map(t => <span key={t} style={{ fontSize: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 99 }}>#{t}</span>)}</div> : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>None</span> },
              ].map(({ label, content }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</div>
                  {content}
                </div>
              ))}
              {editing && (
                <>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Type</div>
                    <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                      <option value="bug">Bug</option>
                      <option value="feature">Feature</option>
                      <option value="improvement">Improvement</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Status</div>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="testing">Testing</option>
                      <option value="completed">Completed</option>
                      <option value="github_pushed">🐙 GitHub Pushed</option>
                      <option value="deployed">🚀 Deployed</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Priority</div>
                    <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Meeting</div>
                    <select className="input" value={form.meetingId} onChange={e => setForm(f => ({ ...f, meetingId: e.target.value }))}>
                      <option value="none">No Meeting</option>
                      {meetings.map(m => (
                        <option key={m.id} value={m.id}>{m.name || 'Unnamed Meeting'}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div key="delete-confirm-modal" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={() => setShowDeleteConfirm(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', maxWidth: 400, width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Delete Task</h3>
              </div>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete Task</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div key="image-preview" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} onClick={() => setPreviewImage(null)}>
          <button style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreviewImage(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <motion.img 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            src={previewImage} 
            alt="Preview" 
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} 
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}
    </AnimatePresence>
  );
}
