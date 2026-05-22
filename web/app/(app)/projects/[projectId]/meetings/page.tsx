'use client';

import { use, useEffect, useState } from 'react';
import { subscribeToProject, subscribeToMeetings, subscribeToTasks, updateMeeting, deleteMeeting, createMeeting } from '@/lib/firebase/firestore';
import { Project, Meeting, Task } from '@/types';
import toast from 'react-hot-toast';

export default function MeetingsPage({ params }: { params: Promise<{ projectId: string }> | { projectId: string } }) {
  const resolvedParams = 'then' in params ? use(params) : params;
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDailyMeetingPrompt, setShowDailyMeetingPrompt] = useState(false);

  useEffect(() => {
    const unsubProject = subscribeToProject(projectId, setProject);
    const unsubMeetings = subscribeToMeetings(projectId, setMeetings);
    const unsubTasks = subscribeToTasks(projectId, setTasks);
    return () => {
      unsubProject();
      unsubMeetings();
      unsubTasks();
    };
  }, [projectId]);

  if (!project) return <div className="p-8 text-center" style={{ color: 'var(--text-3)' }}>Loading meetings...</div>;

  const members = Object.entries(project.members || {});

  const handleSaveMeeting = async (e: React.FormEvent, meetingData: any, isNew: boolean) => {
    e.preventDefault();
    try {
      if (isNew) {
        await createMeeting(projectId, meetingData);
        toast.success('Meeting created');
        setIsCreating(false);
      } else if (editingMeeting) {
        await updateMeeting(projectId, editingMeeting.id, meetingData);
        toast.success('Meeting updated');
        setEditingMeeting(null);
      }
    } catch (err) {
      toast.error('Failed to save meeting');
    }
  };

  const handleJoinMainMeeting = () => {
    const todayStr = new Date().toDateString();
    const todayMeeting = meetings.find(m => m.date.toDateString() === todayStr);

    if (todayMeeting) {
      if (todayMeeting.link) {
        window.open(todayMeeting.link, '_blank');
      } else if (project?.liveUrl) {
        window.open(project.liveUrl, '_blank');
      } else {
        toast.error("No link associated with today's meeting.");
      }
    } else {
      setShowDailyMeetingPrompt(true);
    }
  };

  const handleSaveDailyMeeting = async (form: any) => {
    try {
      const data = {
        ...form,
        date: new Date(form.date),
        attendees: [project.ownerId] // Using ownerId as default attendee
      };
      await createMeeting(projectId, data);
      toast.success('Meeting logged');
      setShowDailyMeetingPrompt(false);
      if (form.link) {
        window.open(form.link, '_blank');
      }
    } catch (err) {
      toast.error('Failed to create daily meeting');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fadeIn" style={{ paddingTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>Meetings & Syncs</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Track action items and tasks assigned during meetings.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleJoinMainMeeting} style={{ background: 'var(--accent)', color: 'white' }}>
            <span style={{ fontSize: 16, marginRight: 6 }}>🌐</span> Join Project Meeting Room
          </button>
          <button className="btn btn-secondary" onClick={() => setIsCreating(true)}>
            <span style={{ fontSize: 16 }}>+</span> Add Meeting
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {meetings.length === 0 && !isCreating && (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-elevated)', borderRadius: 16, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>No Meetings Yet</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Create a meeting to start tracking action items.</p>
          </div>
        )}

        {isCreating && (
          <MeetingEditor 
            projectMembers={members}
            onCancel={() => setIsCreating(false)}
            onSave={(data: any) => handleSaveMeeting({ preventDefault: () => {} } as any, data, true)}
          />
        )}

        {showDailyMeetingPrompt && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDailyMeetingPrompt(false)}>
            <div className="modal" style={{ maxWidth: 450 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Log Today's Session?</h3>
                <button className="btn-icon btn-ghost" onClick={() => setShowDailyMeetingPrompt(false)}>✕</button>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                No meeting has been recorded for today yet. Do you want to store a record for this session so you can track action items against it?
              </p>
              <form onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleSaveDailyMeeting({
                  name: fd.get('name'),
                  date: fd.get('date'),
                  link: fd.get('link')
                });
              }}>
                <div className="input-group">
                  <label className="input-label">Meeting Name</label>
                  <input name="name" className="input" defaultValue={`Daily Sync - ${new Date().toLocaleDateString('en-US', { weekday: 'short' })}`} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Date</label>
                  <input name="date" className="input" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Meeting Link</label>
                  <input name="link" className="input" type="url" defaultValue={project.liveUrl || ''} placeholder="https://meet.google.com/..." required />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowDailyMeetingPrompt(false);
                    const link = (document.querySelector('input[name="link"]') as HTMLInputElement)?.value;
                    if (link) window.open(link, '_blank');
                    else toast.error("Please enter a meeting link");
                  }}>
                    Skip & Just Join
                  </button>
                  <button type="submit" className="btn btn-primary">Save & Join</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {meetings.map(m => {
          if (editingMeeting?.id === m.id) {
            return (
              <MeetingEditor 
                key={m.id}
                initialData={m}
                projectMembers={members}
                onCancel={() => setEditingMeeting(null)}
                onSave={(data: any) => handleSaveMeeting({ preventDefault: () => {} } as any, data, false)}
              />
            );
          }

          const meetingTasks = tasks.filter(t => t.meetingId === m.id);

          return (
            <div key={m.id} style={{ 
              background: 'var(--bg-elevated)', borderRadius: 16, padding: 24, 
              border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{m.name || 'Unnamed Meeting'}</h2>
                    <span style={{ fontSize: 13, color: 'var(--text-3)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: 12 }}>
                      {m.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noreferrer" style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, 
                      color: '#38bdf8', textDecoration: 'none', background: 'rgba(56, 189, 248, 0.1)', 
                      padding: '4px 10px', borderRadius: 6, fontWeight: 600, marginBottom: 12
                    }}>
                      🌐 Join Meeting / Live Link
                    </a>
                  )}
                  
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {m.attendees.map(uid => {
                      const member = project.members[uid];
                      if (!member) return null;
                      return (
                        <div key={uid} title={member.displayName} style={{
                          width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', 
                          border: '2px solid var(--bg-elevated)', background: 'var(--bg-primary)'
                        }}>
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-2)' }}>
                              {member.displayName.charAt(0)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-icon btn-ghost" onClick={() => setEditingMeeting(m)} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icon btn-ghost" onClick={() => {
                    if (confirm('Delete this meeting? Tasks will remain but lose their meeting association.')) {
                      deleteMeeting(projectId, m.id);
                    }
                  }} style={{ color: 'var(--danger)' }} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Action Items ({meetingTasks.length})
                </h4>
                {meetingTasks.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks linked to this meeting.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {meetingTasks.map(t => (
                      <div key={t.id} style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8,
                        borderLeft: `3px solid ${
                          t.status === 'completed' ? 'var(--success)' :
                          t.status === 'in_progress' ? 'var(--accent)' :
                          t.status === 'testing' ? '#38bdf8' : 'var(--text-3)'
                        }`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{t.id}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: t.status === 'completed' ? 'var(--text-3)' : 'var(--text-1)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
                            {t.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {t.assigneePhoto && (
                            <img src={t.assigneePhoto} alt="Assignee" style={{ width: 20, height: 20, borderRadius: '50%' }} title={t.assigneeName || ''} />
                          )}
                          <span style={{ 
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                            background: t.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-elevated)',
                            color: t.status === 'completed' ? 'var(--success)' : 'var(--text-2)',
                            textTransform: 'uppercase'
                          }}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingEditor({ initialData, projectMembers, onCancel, onSave }: any) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    link: initialData?.link || '',
    attendees: initialData?.attendees || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      date: new Date(form.date)
    });
  };

  const toggleAttendee = (uid: string) => {
    setForm(f => ({
      ...f,
      attendees: f.attendees.includes(uid) ? f.attendees.filter((id: string) => id !== uid) : [...f.attendees, uid]
    }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ 
      background: 'var(--bg-elevated)', borderRadius: 16, padding: 24, 
      border: '1px solid var(--accent)', boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.2)' 
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{initialData ? 'Edit Meeting' : 'New Meeting'}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="input-group">
          <label className="input-label">Meeting Name</label>
          <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Weekly Sync" required />
        </div>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
        </div>
        <div className="input-group" style={{ gridColumn: '1/-1' }}>
          <label className="input-label">Meeting Link (Optional)</label>
          <input className="input" type="url" value={form.link} onChange={e => setForm({...form, link: e.target.value})} placeholder="https://meet.google.com/..." />
        </div>
        <div className="input-group" style={{ gridColumn: '1/-1' }}>
          <label className="input-label">Attendees</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {projectMembers.map(([uid, m]: any) => (
              <div 
                key={uid} 
                onClick={() => toggleAttendee(uid)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, 
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: form.attendees.includes(uid) ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-primary)',
                  color: form.attendees.includes(uid) ? 'var(--accent)' : 'var(--text-2)',
                  border: form.attendees.includes(uid) ? '1px solid var(--accent)' : '1px solid var(--border)'
                }}
              >
                {m.photoURL ? (
                  <img src={m.photoURL} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                    {m.displayName.charAt(0)}
                  </div>
                )}
                {m.displayName}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Meeting</button>
      </div>
    </form>
  );
}
