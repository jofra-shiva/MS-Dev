'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToProject, updateProject, inviteMember } from '@/lib/firebase/firestore';
import { Project, UserRole } from '@/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer' | 'task_assigner'>('member');
  const [inviting, setInviting] = useState(false);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    return subscribeToProject(projectId, p => {
      setProject(p);
      setName(p.name);
      setDesc(p.description);
      setLiveUrl(p.liveUrl || '');
    });
  }, [projectId]);

  const myRole = project?.members?.[user?.uid || '']?.role;
  const isAdmin = myRole === 'admin';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProject(projectId, { name: name.trim(), description: desc.trim(), liveUrl: liveUrl.trim() });
      toast.success('Settings saved!');
      setIsEditingGeneral(false);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteEmail.trim()) return;
    
    const emailToInvite = inviteEmail.trim().toLowerCase();

    // Check if user is already a member
    const isAlreadyMember = Object.values(project?.members || {}).some((m: any) => m && m.email?.toLowerCase() === emailToInvite);
    if (isAlreadyMember) {
      toast.error('User is already in the team');
      return;
    }

    setInviting(true);
    try {
      // Check for existing pending invites
      const q = query(collection(db, 'invitations'), where('invitedEmail', '==', emailToInvite), where('projectId', '==', projectId), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Delete old pending invitations so we can send a fresh one
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, 'invitations', docSnap.id));
        }
      }

      await inviteMember(projectId, project?.name || '', emailToInvite, inviteRole, user.uid, user.displayName || '');
      
      // Send real email via Next.js API route
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailToInvite,
          subject: `You have been invited to join ${project?.name || 'a project'}`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
              <div style="background-color: #050a0e; padding: 32px 24px; text-align: center; border-bottom: 3px solid #00f3ff;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">MS<span style="color: #00f3ff;">DEV</span></h1>
              </div>
              <div style="padding: 40px 32px; color: #374151; line-height: 1.6;">
                <h2 style="margin-top: 0; color: #111827; font-size: 22px; font-weight: 700;">You've been invited! 🎉</h2>
                <p style="font-size: 16px; color: #4b5563;"><strong>${user.displayName || 'Someone'}</strong> has invited you to collaborate on the project <strong style="color: #111827; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${project?.name || ''}</strong>.</p>
                <p style="font-size: 16px; margin-bottom: 36px; color: #4b5563;">Join the team to start managing tasks, tracking progress, and collaborating seamlessly.</p>
                <div style="text-align: center;">
                  <a href="${window.location.origin}/login" style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);">Accept Invitation</a>
                </div>
              </div>
              <div style="background-color: #f9fafb; padding: 20px 24px; text-align: center; color: #9ca3af; font-size: 13px; border-top: 1px solid #f3f4f6;">
                <p style="margin: 0;">If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
            </div>
          `
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send email');
      }

      toast.success(`Invitation and email sent to ${emailToInvite}!`);
      setInviteEmail('');
    } catch (e: any) { 
      toast.error(e.message || 'Failed to send invitation'); 
      console.error(e); 
    }
    finally { setInviting(false); }
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), { [`members.${memberToRemove.uid}`]: null });
      toast.success(`${memberToRemove.name} removed`);
      setMemberToRemove(null);
    } catch { 
      toast.error('Failed to remove member'); 
    }
  };

  const handleChangeRole = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { [`members.${uid}.role`]: role });
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
  };

  if (!project) return null;
  const members = Object.entries(project.members || {}).filter(([_, m]) => m !== null && m !== undefined);

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Project Settings</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>Manage project details, members, and access control</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 40, alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {/* General Settings */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>General</h3>
              {isAdmin && !isEditingGeneral && (
                <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingGeneral(true)}>Edit</button>
              )}
            </div>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Project Name</label>
                {isEditingGeneral ? (
                  <input id="settings-name-input" className="input" value={name} onChange={e => setName(e.target.value)} required autoFocus />
                ) : (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 14, color: 'var(--text-1)' }}>{name}</div>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                {isEditingGeneral ? (
                  <textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                ) : (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 14, color: 'var(--text-2)', minHeight: 40 }}>{desc || 'No description provided'}</div>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">Live Project URL</label>
                {isEditingGeneral ? (
                  <input className="input" type="url" placeholder="https://my-live-project.com" value={liveUrl} onChange={e => setLiveUrl(e.target.value)} />
                ) : (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 14, color: 'var(--text-2)' }}>
                    {liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{liveUrl}</a> : 'No live URL configured'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div>
                  <div className="input-label" style={{ marginBottom: 6 }}>Task Prefix</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '6px 14px', borderRadius: 8 }}>{project.taskPrefix}-001</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="input-label" style={{ marginBottom: 6 }}>Project Status</div>
                  {isEditingGeneral ? (
                    <select className="input" value={project.status} onChange={async e => { await updateProject(projectId, { status: e.target.value as any }); }}>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 14, color: 'var(--text-1)' }}>
                      {project.status === 'active' ? 'Active' : project.status === 'archived' ? 'Archived' : 'Completed'}
                    </div>
                  )}
                </div>
              </div>
              {isEditingGeneral && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button id="save-settings-btn" type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? '...' : 'Save Changes'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setIsEditingGeneral(false); setName(project.name); setDesc(project.description); setLiveUrl(project.liveUrl || ''); }}>
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Danger Zone */}
          {isAdmin && (
            <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 12 }}>⚠️ Danger Zone</h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Deleting a project is permanent and cannot be undone. All tasks, activity, and data will be lost.</p>
              <button className="btn btn-danger" onClick={() => toast.error('Delete functionality requires additional confirmation — contact support.')}>
                Delete Project
              </button>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {/* Invite Member */}
          {isAdmin && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Invite Team Member</h3>
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10 }}>
                <input id="invite-email-input" className="input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} required />
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} style={{ width: 140 }}>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  <option value="task_assigner">Task Assigner</option>
                </select>
                <button id="send-invite-btn" type="submit" className="btn btn-primary" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? '...' : 'Invite'}
                </button>
              </form>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>An invitation link will be sent. The user must sign in with the invited email address.</p>
            </div>
          )}

          {/* Members List */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Team Members ({members.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {members.map(([uid, m]: any, i) => (
                <motion.div key={uid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  {m.photoURL
                    ? <img src={m.photoURL} className="avatar" alt="" />
                    : <div className="avatar-placeholder">{m.displayName?.slice(0, 2).toUpperCase()}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.displayName} {uid === user?.uid ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(you)</span> : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                  </div>
                  {isAdmin && uid !== user?.uid ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="input" style={{ width: 130, padding: '4px 8px', fontSize: 12 }} value={m.role} onChange={e => handleChangeRole(uid, e.target.value as UserRole)}>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        <option value="task_assigner">Task Assigner</option>
                      </select>
                      <button className="btn btn-danger btn-sm" onClick={() => setMemberToRemove({ uid, name: m.displayName })}>Remove</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, textTransform: 'uppercase', background: m.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)', color: m.role === 'admin' ? 'var(--accent)' : 'var(--success)' }}>{m.role === 'task_assigner' ? 'Task Assigner' : m.role}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {memberToRemove && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} className="modal" style={{ maxWidth: 400, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: 10, borderRadius: '50%' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H5c-1.1 0-2 .9-2 2v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Remove Member?</h3>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                Are you sure you want to remove <strong>{memberToRemove.name}</strong> from this project? They will lose all access immediately.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setMemberToRemove(null)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--danger)', color: 'white', border: 'none' }} onClick={confirmRemoveMember}>
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
