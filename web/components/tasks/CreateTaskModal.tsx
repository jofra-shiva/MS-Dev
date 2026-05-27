'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createTask, logActivity, getProjectModules, addCustomModule, subscribeToMeetings, createMeeting, createNotification } from '@/lib/firebase/firestore';
import { Project, TaskPriority, TaskStatus, TaskType, TaskAttachment, Meeting } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Props { projectId: string; project: Project | null; onClose: () => void; preselectedMeetingId?: string; }

export default function CreateTaskModal({ projectId, project, onClose, preselectedMeetingId }: Props) {
  const { user } = useAuth();
  
  // AI vs Manual mode
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  
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

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  
  const handleFormChange = (k: string, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  useEffect(() => {
    if (screenshots.length > 0 || aiMessage.trim() !== '') {
      setIsDirty(true);
    }
  }, [screenshots, aiMessage]);

  const handleCloseWithCheck = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
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
    return () => unsubMeetings();
  }, [project, projectId]);

  const members = Object.entries(project?.members || {});

  const handleAIAnalyze = async () => {
    if (!aiMessage.trim() && screenshots.length === 0) return;
    setAiLoading(true);

    const membersList = Object.entries(project?.members || {}).map(([uid, m]: any) => ({
      uid, name: m.displayName, role: m.role,
    }));

    const meetingContext = meetings.slice(0, 5).map(m => ({
      id: m.id,
      name: m.name,
      date: m.date instanceof Date ? m.date.toLocaleDateString('en-GB') : String(m.date),
    }));

    try {
      const res = await fetch('/api/ai-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiMessage || 'Create task from screenshot',
          projectContext: { members: membersList, modules: projectModules, meetings: meetingContext },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.task) {
        toast.error(data.error || 'AI failed to parse. Please try again.');
        setAiLoading(false);
        return;
      }

      const parsed = data.task;
      
      setForm(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        type: parsed.taskType || prev.type,
        status: parsed.status || prev.status,
        priority: parsed.priority || prev.priority,
        module: parsed.module || prev.module,
        dueDate: parsed.dueDate || prev.dueDate,
        assigneeId: parsed.assigneeId || prev.assigneeId,
        assigneeName: parsed.assigneeName || prev.assigneeName,
        tags: parsed.tags ? parsed.tags.join(', ') : prev.tags
      }));
      
      if (parsed.meetingId) {
        setSelectedMeetingId(parsed.meetingId);
      }

      toast.success('AI pre-filled the task! Please review and save.');
      setMode('manual');
      setIsDirty(true);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `Pasted Image ${screenshots.length + newFiles.length + 1}.${ext}`, { type: file.type });
          newFiles.push(namedFile);
        }
      }
    }
    if (newFiles.length > 0) {
      setScreenshots(prev => [...prev, ...newFiles]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setLoading(true);
    try {
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
                toast.error(`Failed to upload ${file.name}`);
              }
            } catch (err) {
              toast.error(`Failed to upload ${file.name}`);
            }
          }));
        }
      }

      let finalMeetingId: string | null = null;
      if (selectedMeetingId === 'new_today') {
        const dateObj = new Date();
        const sortedMeetings = [...meetings].sort((a, b) => b.date.getTime() - a.date.getTime());
        const lastMeetingName = sortedMeetings.length > 0 ? sortedMeetings[0].name : '';
        
        const suggestNextName = (lastName: string) => {
          if (!lastName) return 'Phase 1';
          const match = lastName.match(/^(.*?)(\d+)$/);
          if (match) {
            const num = parseInt(match[2], 10);
            return `${match[1]}${num + 1}`;
          }
          return `${lastName} 2`;
        };

        const defaultName = suggestNextName(lastMeetingName);
        
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

      if (form.dueDate && form.assigneeId) {
        const due = new Date(form.dueDate).getTime();
        const now = Date.now();
        const diffHours = (due - now) / (1000 * 60 * 60);

        await createNotification(form.assigneeId, {
          type: 'deadline',
          title: 'Task Assigned with Deadline',
          body: `You were assigned "${form.title}" due on ${new Date(form.dueDate).toLocaleDateString()}.`,
        });
        
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
              }).catch(console.error);
            }
          }
        }
      }

      toast.success('Task created!');
      setIsDirty(false);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleCloseWithCheck()}>
        <motion.div className="modal modal-lg" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }} style={{ minHeight: 650, display: 'flex', flexDirection: 'column' }}>
          <style>{`
            .ctm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
            @media (max-width: 600px) { .ctm-grid { grid-template-columns: 1fr; } }
            .ctm-type-row { grid-column: 1/-1; display: flex; gap: 8px; margin-bottom: 4px; }
            .ctm-type-btn {
              flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
              padding: 9px 14px; border-radius: 10px; cursor: pointer; border: 1.5px solid var(--border);
              background: transparent; font-size: 13px; font-weight: 600; color: var(--text-2);
              font-family: inherit; transition: all 0.18s; white-space: nowrap;
            }
            .ctm-type-btn:hover { border-color: var(--text-3); color: var(--text-1); background: var(--bg-elevated); }
            .ctm-type-btn.active-bug    { border-color: #f87171; background: rgba(248,113,113,0.10); color: #f87171; }
            .ctm-type-btn.active-feature { border-color: #34d399; background: rgba(52,211,153,0.10); color: #34d399; }
            .ctm-type-btn.active-improvement { border-color: #38bdf8; background: rgba(56,189,248,0.10); color: #38bdf8; }
            .ctm-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
            .ctm-header-icon {
              width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
              background: linear-gradient(135deg, rgba(52,211,153,0.2), rgba(56,189,248,0.2));
              border: 1px solid var(--glass-border);
              display: flex; align-items: center; justify-content: center;
            }
            .ctm-section-divider { grid-column: 1/-1; border: none; border-top: 1px solid var(--border-subtle); margin: 2px 0 4px; }
            .ctm-footer { display: flex; gap: 10px; margin-top: 6px; }
            
            /* Tabs */
            .ctm-tabs { display: flex; gap: 4px; background: var(--bg-elevated); padding: 4px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 20px; }
            .ctm-tab { flex: 1; text-align: center; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; transition: all 0.2s; border: none; background: transparent; }
            .ctm-tab:hover { color: var(--text-1); }
            .ctm-tab.active { background: var(--bg-primary); color: var(--text-1); box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 1px solid var(--border-subtle); }
          `}</style>

          <div className="ctm-header">
            <div className="ctm-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#ctm-grad)" strokeWidth="2">
                <defs><linearGradient id="ctm-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs>
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>Create Task</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Add a new task to this project</p>
            </div>
            <button className="btn-icon btn-ghost" onClick={handleCloseWithCheck} style={{ marginLeft: 'auto' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="ctm-tabs">
            <button type="button" className={`ctm-tab ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>
              Manual Entry
            </button>
            <button type="button" className={`ctm-tab ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
              AI Assistant
            </button>
          </div>

          {mode === 'ai' ? (
            <div onPaste={handlePaste} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="input-label" style={{ margin: 0 }}>Describe your task naturally</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseWithCheck}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAIAnalyze} disabled={aiLoading || (!aiMessage.trim() && screenshots.length === 0)}>
                    {aiLoading ? (
                      <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Analyze</>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea 
                  className="input" 
                  style={{ flex: 1, minHeight: 200, resize: 'none' }}
                  placeholder="e.g. login la otp varala production la... (Tamil, Tanglish, English) or Paste a Screenshot (Ctrl+V)" 
                  value={aiMessage} 
                  onChange={e => setAiMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAIAnalyze();
                  }}
                  autoFocus
                />
              </div>

              {/* Screenshots preview */}
              {screenshots.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  {screenshots.map((file, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setScreenshots(prev => prev.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="ctm-grid">
                <div className="ctm-type-row">
                  {[
                    { id: 'bug',         label: 'Bug' },
                    { id: 'feature',     label: 'Feature' },
                    { id: 'improvement', label: 'Improvement' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`ctm-type-btn${form.type === t.id ? ` active-${t.id}` : ''}`}
                      onClick={() => handleFormChange('type', t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="input-group" style={{ gridColumn: '1/-1', position: 'relative' }}>
                  <label className="input-label">Module / Category</label>
                  <input 
                    className="input" 
                    placeholder="e.g. Authentication (Select or type a new one)" 
                    value={form.module} 
                    onChange={e => handleFormChange('module', e.target.value)}
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
                            toast.success(`Module "${val}" saved!`);
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
                            onMouseDown={() => { handleFormChange('module', m); setModuleFocused(false); }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            {m}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <hr className="ctm-section-divider" />
                <div className="input-group" style={{ gridColumn: '1/-1' }}>
                  <label className="input-label">Task Title *</label>
                  <input id="task-title-input" className="input" placeholder="e.g. Implement user authentication" value={form.title} onChange={e => handleFormChange('title', e.target.value)} required />
                </div>
                <div className="input-group" style={{ gridColumn: '1/-1' }}>
                  <label className="input-label">Description</label>
                  <textarea className="input" placeholder="Describe what needs to be done..." value={form.description} onChange={e => handleFormChange('description', e.target.value)} rows={3} />
                </div>
                <div className="input-group">
                  <label className="input-label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => handleFormChange('priority', e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Status</label>
                  <select className="input" value={form.status} onChange={e => handleFormChange('status', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="testing">Testing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="input-group" style={{ gridColumn: '1/-1' }}>
                  <label className="input-label">Meeting Source</label>
                  <select className="input" value={selectedMeetingId} onChange={e => { setSelectedMeetingId(e.target.value); setIsDirty(true); }}>
                    <option value="none">No Meeting</option>
                    {!meetings.some(m => new Date(m.date).toDateString() === new Date().toDateString()) && (
                      <option value="new_today">New Meet (Today)</option>
                    )}
                    {meetings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name || 'Unnamed Meeting'} - {m.date.toLocaleDateString('en-GB')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Due Date</label>
                  <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={e => handleFormChange('dueDate', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Assign To</label>
                  <select className="input" value={form.assigneeId} onChange={e => {
                    const member = members.find(([uid]) => uid === e.target.value);
                    handleFormChange('assigneeId', e.target.value);
                    handleFormChange('assigneeName', (member?.[1] as any)?.displayName || '');
                    handleFormChange('assigneePhoto', (member?.[1] as any)?.photoURL || '');
                  }}>
                    <option value="">Unassigned</option>
                    {members.map(([uid, m]: any) => (
                      <option key={uid} value={uid}>{m.displayName} ({m.role})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Tags (comma-separated)</label>
                  <input className="input" placeholder="frontend, auth, bug" value={form.tags} onChange={e => handleFormChange('tags', e.target.value)} />
                </div>
                <div className="input-group" style={{ gridColumn: '1/-1' }}>
                  <label className="input-label">Attach Screenshots (Optional)</label>
                  <div 
                    tabIndex={0}
                    onPaste={handlePaste}
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
              <div className="ctm-footer" style={{ marginTop: 'auto', paddingTop: 16 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: '0 0 auto', minWidth: 100 }} onClick={handleCloseWithCheck}>Cancel</button>
                <button id="create-task-submit" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.title.trim()}>
                  {loading
                    ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M9 11l3 3L22 4"/></svg>Create Task</>}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
