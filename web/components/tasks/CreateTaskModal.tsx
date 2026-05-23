'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createTask, logActivity, getProjectModules, addCustomModule, subscribeToMeetings, createMeeting, createNotification } from '@/lib/firebase/firestore';
import { Project, TaskPriority, TaskStatus, TaskType, TaskAttachment, Meeting } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Props { projectId: string; project: Project | null; onClose: () => void; preselectedMeetingId?: string; }

export default function CreateTaskModal({ projectId, project, onClose, preselectedMeetingId }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '', description: '', type: 'bug' as TaskType, priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus, module: '', tags: '',
    assigneeId: '', assigneeName: '', assigneePhoto: '', progress: 0, dueDate: '',
  });
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [githubModules, setGithubModules] = useState<string[]>([]);
  const [projectModules, setProjectModules] = useState<string[]>([]);
  const [moduleFocused, setModuleFocused] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(preselectedMeetingId && preselectedMeetingId !== 'all' ? preselectedMeetingId : 'none');

  useEffect(() => {
    // Fetch unique modules from existing tasks in the project
    getProjectModules(projectId).then(setProjectModules).catch(console.error);

    if (project?.github?.connected && project.github.repoOwner && project.github.repoName) {
      fetch(`https://api.github.com/repos/${project.github.repoOwner}/${project.github.repoName}/contents`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const dirs = data.filter((item: any) => item.type === 'dir').map((item: any) => item.name);
            setGithubModules(dirs);
          }
        })
        .catch(console.error);
    }

    const unsubMeetings = subscribeToMeetings(projectId, setMeetings);
    return () => {
      unsubMeetings();
    };
  }, [project, projectId]);

  const members = Object.entries(project?.members || {});

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setLoading(true);
    try {
      const taskCount = (project?.stats?.totalTasks || 0) + 1;
      
      // Handle multiple optional screenshot uploads via ImgBB
      const attachmentUrls: TaskAttachment[] = [];
      if (screenshots.length > 0) {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey) {
          toast.error('ImgBB API Key is missing. Images will not be uploaded.');
        } else {
          await Promise.all(screenshots.map(async (file) => {
            try {
              const formData = new FormData();
              formData.append('image', file);
              const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData,
              });
              const data = await res.json();
              if (data.success) {
                attachmentUrls.push({
                  id: `att_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
                  name: file.name,
                  url: data.data.url,
                  size: file.size,
                  type: file.type,
                  uploadedBy: user.uid,
                  uploadedAt: new Date()
                });
              } else {
                console.error('ImgBB Upload Error:', data);
                toast.error(`Failed to upload ${file.name}`);
              }
            } catch (err) {
              console.error('ImgBB Network Error:', err);
              toast.error(`Failed to upload ${file.name}`);
            }
          }));
        }
      }

      let finalMeetingId: string | null = null;
      if (selectedMeetingId === 'new_today') {
        const dateObj = new Date();
        const defaultName = `Sync - ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        finalMeetingId = await createMeeting(projectId, {
          name: defaultName,
          date: dateObj,
          link: null,
          attendees: [user.uid],
          createdBy: user.uid,
        });
      } else if (selectedMeetingId !== 'none') {
        finalMeetingId = selectedMeetingId;
      }

      await createTask(projectId, {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        status: form.status,
        priority: form.priority,
        module: form.module.trim(),
        progress: form.progress,
        assigneeId: form.assigneeId || null,
        assigneeName: form.assigneeName || null,
        assigneePhoto: form.assigneePhoto || null,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        attachments: attachmentUrls,
        githubRef: { lastCommitSha: null, lastCommitMessage: null, prNumber: null, branchName: null },
        meetingId: finalMeetingId,
        createdBy: user.uid,
      });

      await logActivity(projectId, {
        type: 'task_created', userId: user.uid, userName: user.displayName || '',
        userPhoto: user.photoURL || '', taskId: null, taskTitle: form.title,
        metadata: { priority: form.priority, assignee: form.assigneeName },
      });

      // Send urgent deadline notification if due date is within 24 hours and assignee is selected
      if (form.dueDate && form.assigneeId) {
        const due = new Date(form.dueDate).getTime();
        const now = Date.now();
        const diffHours = (due - now) / (1000 * 60 * 60);

        // Create in-app notification
        await createNotification(form.assigneeId, {
          type: 'deadline',
          title: 'Task Assigned with Deadline',
          body: `You were assigned "${form.title}" due on ${new Date(form.dueDate).toLocaleDateString()}.`,
        });
        
        // If due date is today or tomorrow (less than ~24 hours away logically for a date input)
        if (diffHours < 24) {
          const assigneeMember = members.find(([uid]) => uid === form.assigneeId);
          if (assigneeMember) {
            const assigneeEmail = (assigneeMember[1] as any)?.email;
            if (assigneeEmail) {
              await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: assigneeEmail,
                  subject: `Urgent Task Assigned: ${form.title}`,
                  html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                      <h2>Urgent Task Assignment</h2>
                      <p><strong>${user.displayName || 'Someone'}</strong> assigned you an urgent task in project <strong>${project?.name || ''}</strong>.</p>
                      <p><strong>Task:</strong> ${form.title}</p>
                      <p><strong>Module:</strong> ${form.module || 'N/A'}</p>
                      <p style="color: #ef4444; font-weight: bold;">Due in less than 24 hours!</p>
                    </div>
                  `
                })
              }).catch(console.error); // fail silently so it doesn't block task creation
            }
          }
        }
      }

      toast.success('Task created!');
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div className="modal modal-lg" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
          <style>{`
            .create-task-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
            @media (max-width: 640px) { .create-task-grid { grid-template-columns: 1fr; } }
            .radio-group { grid-column: 1/-1; display: flex; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Task</h2>
            <button className="btn-icon btn-ghost" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="create-task-grid">
              {/* Task Type Selection */}
              <div className="radio-group">
                {[
                  { id: 'bug', label: 'Bug' },
                  { id: 'feature', label: 'Feature' },
                  { id: 'improvement', label: 'Improvement' }
                ].map(t => (
                  <label key={t.id} style={{
                    flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8, cursor: 'pointer',
                    border: form.type === t.id ? '2px solid var(--accent)' : '2px solid var(--border-subtle)',
                    background: form.type === t.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                    fontWeight: 600, fontSize: 14, color: form.type === t.id ? 'var(--accent)' : 'var(--text-2)',
                    transition: 'all 0.2s'
                  }}>
                    <input type="radio" name="taskType" value={t.id} checked={form.type === t.id} onChange={e => set('type', e.target.value)} style={{ display: 'none' }} />
                    {t.label}
                  </label>
                ))}
              </div>

              <div className="input-group" style={{ gridColumn: '1/-1', position: 'relative' }}>
                <label className="input-label">Module / Category</label>
                <input 
                  className="input" 
                  placeholder="e.g. Authentication (Select or type a new one)" 
                  value={form.module} 
                  onChange={e => set('module', e.target.value)}
                  onFocus={() => setModuleFocused(true)}
                  onBlur={() => setTimeout(() => setModuleFocused(false), 200)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = form.module.trim();
                      if (val) {
                        setModuleFocused(false);
                        try {
                          await addCustomModule(projectId, val);
                          toast.success(`Module "${val}" saved for future use!`);
                          document.getElementById('task-title-input')?.focus();
                        } catch (err) { toast.error('Failed to save module'); }
                      }
                    }
                  }}
                  autoComplete="off"
                />
                {moduleFocused && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', 
                    borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto',
                    boxShadow: 'var(--shadow-card)', padding: 4
                  }}>
                    {Array.from(new Set([...githubModules, ...projectModules, ...((project as any)?.customModules || [])]))
                      .sort()
                      .filter(m => m.toLowerCase().includes(form.module.toLowerCase()))
                      .map((m, i) => (
                        <div 
                          key={m} 
                          style={{ 
                            padding: '10px 12px', cursor: 'pointer', fontSize: 13, 
                            borderRadius: 6, color: 'var(--text-1)', transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', gap: 8
                          }}
                          onMouseDown={() => { set('module', m); setModuleFocused(false); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          {m}
                        </div>
                      ))}
                    {Array.from(new Set([...githubModules, ...projectModules, ...((project as any)?.customModules || [])])).filter(m => m.toLowerCase().includes(form.module.toLowerCase())).length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        Press enter to save "{form.module}" as a new module
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Task Title *</label>
                <input id="task-title-input" className="input" placeholder="e.g. Implement user authentication" value={form.title} onChange={e => set('title', e.target.value)} required />
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Description</label>
                <textarea className="input" placeholder="Describe what needs to be done..." value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
              </div>
              <div className="input-group">
                <label className="input-label">Priority</label>
                <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Status</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="testing">Testing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Meeting Source</label>
                <select className="input" value={selectedMeetingId} onChange={e => setSelectedMeetingId(e.target.value)}>
                  <option value="none">No Meeting</option>
                  <option value="new_today">✨ New Meet (Today)</option>
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name || 'Unnamed Meeting'} - {m.date.toLocaleDateString('en-GB')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Due Date</label>
                <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Assign To</label>
                <select className="input" value={form.assigneeId} onChange={e => {
                  const member = members.find(([uid]) => uid === e.target.value);
                  set('assigneeId', e.target.value);
                  set('assigneeName', (member?.[1] as any)?.displayName || '');
                  set('assigneePhoto', (member?.[1] as any)?.photoURL || '');
                }}>
                  <option value="">Unassigned</option>
                  {members.map(([uid, m]: any) => (
                    <option key={uid} value={uid}>{m.displayName} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Tags (comma-separated)</label>
                <input className="input" placeholder="frontend, auth, bug" value={form.tags} onChange={e => set('tags', e.target.value)} />
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Attach Screenshots (Optional)</label>
                <div 
                  tabIndex={0}
                  onPaste={(e) => {
                    const items = e.clipboardData.items;
                    const newFiles: File[] = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) {
                          // Generate a generic name for pasted images
                          const ext = file.type.split('/')[1] || 'png';
                          const namedFile = new File([file], `Pasted Image ${screenshots.length + newFiles.length + 1}.${ext}`, { type: file.type });
                          newFiles.push(namedFile);
                        }
                      }
                    }
                    if (newFiles.length > 0) {
                      setScreenshots(prev => [...prev, ...newFiles]);
                    }
                  }}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 8, padding: '20px', textAlign: 'center',
                    cursor: 'text', background: 'var(--bg-elevated)', outline: 'none', transition: 'border-color 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                >
                  <input id="hidden-file-input" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => {
                    if (e.target.files) {
                      setScreenshots(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }} />
                  {screenshots.length > 0 ? (
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
                        {screenshots.map((file, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                              <img src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setScreenshots(prev => prev.filter((_, i) => i !== idx)); }}
                              style={{
                                position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: 'white',
                                border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                              title="Remove image"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>{screenshots.length} file{screenshots.length > 1 ? 's' : ''} selected</div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button 
                          type="button" 
                          style={{ pointerEvents: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontWeight: 600, color: 'var(--text-1)' }}
                          onClick={(e) => { e.stopPropagation(); document.getElementById('hidden-file-input')?.click(); }}
                        >
                          Add More Files
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ marginBottom: 4 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>Click here and press (Ctrl+V) to Paste</div>
                      <button 
                        type="button" 
                        style={{ pointerEvents: 'auto', marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontWeight: 600, color: 'var(--text-1)' }}
                        onClick={(e) => { e.stopPropagation(); document.getElementById('hidden-file-input')?.click(); }}
                      >
                        or Browse Files
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button id="create-task-submit" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.title.trim()}>
                {loading
                  ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  : 'Create Task'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
