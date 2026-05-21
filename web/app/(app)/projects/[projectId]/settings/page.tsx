'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToProject, updateProject, inviteMember } from '@/lib/firebase/firestore';
import { Project, UserRole } from '@/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    return subscribeToProject(projectId, p => {
      setProject(p);
      setName(p.name);
      setDesc(p.description);
    });
  }, [projectId]);

  const myRole = project?.members?.[user?.uid || '']?.role;
  const isAdmin = myRole === 'admin';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProject(projectId, { name: name.trim(), description: desc.trim() });
      toast.success('Settings saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(projectId, project?.name || '', inviteEmail.trim(), inviteRole, user.uid, user.displayName || '');
      
      // Send real email via Next.js API route
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: inviteEmail.trim(),
          subject: `You have been invited to join ${project?.name || 'a project'}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Project Invitation</h2>
              <p><strong>${user.displayName || 'Someone'}</strong> has invited you to join the project <strong>${project?.name || ''}</strong>.</p>
              <p>Please log in to the application with this email address to accept or decline the invitation.</p>
              <a href="${window.location.origin}/login" style="display: inline-block; padding: 10px 20px; margin-top: 15px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Accept Invitation</a>
            </div>
          `
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send email');
      }

      toast.success(`Invitation and email sent to ${inviteEmail}!`);
      setInviteEmail('');
    } catch (e: any) { 
      toast.error(e.message || 'Failed to send invitation'); 
      console.error(e); 
    }
    finally { setInviting(false); }
  };

  const handleRemoveMember = async (uid: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), { [`members.${uid}`]: null });
      toast.success(`${name} removed`);
    } catch { toast.error('Failed to remove member'); }
  };

  const handleChangeRole = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { [`members.${uid}.role`]: role });
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
  };

  if (!project) return null;
  const members = Object.entries(project.members || {});

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Project Settings</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>Manage project details, members, and access control</p>
      </div>

      {/* General Settings */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>General</h3>
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Project Name</label>
            <input id="settings-name-input" className="input" value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} required />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} disabled={!isAdmin} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>
              <div className="input-label" style={{ marginBottom: 6 }}>Task Prefix</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '6px 14px', borderRadius: 8 }}>{project.taskPrefix}-001</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="input-label" style={{ marginBottom: 6 }}>Project Status</div>
              <select className="input" value={project.status} disabled={!isAdmin} onChange={async e => { await updateProject(projectId, { status: e.target.value as any }); }}>
                <option value="active">🟢 Active</option>
                <option value="archived">🟡 Archived</option>
                <option value="completed">✅ Completed</option>
              </select>
            </div>
          </div>
          {isAdmin && (
            <button id="save-settings-btn" type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
              {saving ? '...' : '💾 Save Changes'}
            </button>
          )}
        </form>
      </div>

      {/* Invite Member */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Invite Team Member</h3>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10 }}>
            <input id="invite-email-input" className="input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} required />
            <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} style={{ width: 140 }}>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button id="send-invite-btn" type="submit" className="btn btn-primary" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? '...' : '📧 Invite'}
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
                  <select className="input" style={{ width: 110, padding: '4px 8px', fontSize: 12 }} value={m.role} onChange={e => handleChangeRole(uid, e.target.value as UserRole)}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(uid, m.displayName)}>Remove</button>
                </div>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, textTransform: 'uppercase', background: m.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)', color: m.role === 'admin' ? 'var(--accent)' : 'var(--success)' }}>{m.role}</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      {isAdmin && (
        <div className="card" style={{ marginTop: 20, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 12 }}>⚠️ Danger Zone</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Deleting a project is permanent and cannot be undone. All tasks, activity, and data will be lost.</p>
          <button className="btn btn-danger" onClick={() => toast.error('Delete functionality requires additional confirmation — contact support.')}>
            🗑️ Delete Project
          </button>
        </div>
      )}
    </div>
  );
}
