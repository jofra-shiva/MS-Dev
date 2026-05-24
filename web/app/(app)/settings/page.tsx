'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    githubUsername: '',
    role: 'developer',
    bio: '',
    emailNotifications: true,
    pushNotifications: false,
    theme: 'dark'
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setFormData(prev => ({
            ...prev,
            displayName: user.displayName || data.displayName || '',
            email: user.email || data.email || '',
            githubUsername: data.githubUsername || '',
            role: data.role || 'developer',
            bio: data.bio || '',
            emailNotifications: data.emailNotifications ?? true,
            pushNotifications: data.pushNotifications ?? false,
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            displayName: user.displayName || '',
            email: user.email || ''
          }));
        }
      } catch (err) {
        console.error("Error loading profile", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        githubUsername: formData.githubUsername,
        role: formData.role,
        bio: formData.bio,
        emailNotifications: formData.emailNotifications,
        pushNotifications: formData.pushNotifications,
        updatedAt: new Date()
      });
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' }
  ];

  if (loading) {
    return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} /></div>;
  }

  const inputStyle = {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    textAlign: 'left' as const
  };

  return (
    <div style={{ width: '100%', paddingBottom: 60 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Content Area */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 48 }}>
          
          {message && (
            <div style={{ padding: '12px 16px', background: message.includes('Failed') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: message.includes('Failed') ? '#ef4444' : '#10b981', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px solid ${message.includes('Failed') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}` }}>
              {message}
            </div>
          )}

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-1)' }}>Profile Details</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>This information will be displayed publicly to your team.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '12px 0' }}>
                
                {/* Avatar */}
                <div 
                  style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', overflow: 'hidden' }}
                  onMouseEnter={() => setIsHoveringAvatar(true)}
                  onMouseLeave={() => setIsHoveringAvatar(false)}
                >
                  {avatarPreview || user?.photoURL ? <img src={avatarPreview || user?.photoURL || undefined} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : formData.displayName.charAt(0).toUpperCase()}
                  
                  {isEditing && (
                    <label style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isHoveringAvatar ? 1 : 0, cursor: 'pointer', transition: 'opacity 0.2s', fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, zIndex: 10 }}>
                      Change
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             setAvatarPreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </label>
                  )}
                </div>

                {/* Inputs */}
                <div style={{ display: 'flex', flex: 1, gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Full Name</label>
                    <input 
                      type="text" 
                      value={formData.displayName} 
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      disabled={!isEditing} 
                      style={{ ...inputStyle, opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'text' : 'not-allowed' }} 
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Email Address</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      disabled={!isEditing} 
                      style={{ ...inputStyle, opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'text' : 'not-allowed' }} 
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 72, paddingBottom: 2 }}>
                  {!isEditing ? (
                    <button className="btn btn-secondary" onClick={() => setIsEditing(true)} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary shadow-lg" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  )}
                </div>

              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-1)' }}>GitHub Integration</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>Link your GitHub account to enable activity tracking and commit history.</p>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#24292e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>GitHub Username</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Required for Activity Map tracking</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 260, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 16, color: 'var(--text-3)', fontSize: 14, opacity: isEditing ? 1 : 0.5 }}>github.com/</span>
                      <input 
                        type="text" 
                        value={formData.githubUsername}
                        onChange={e => setFormData({...formData, githubUsername: e.target.value})}
                        disabled={!isEditing}
                        style={{ ...inputStyle, paddingLeft: 96, opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'text' : 'not-allowed' }}
                        placeholder="username"
                      />
                    </div>
                    
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isEditing ? (
                        <button className="btn btn-secondary" onClick={() => setIsEditing(true)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
                          Edit
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
                            Cancel
                          </button>
                          <button className="btn btn-primary shadow-lg" onClick={handleSave} disabled={saving} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
                            {saving ? '...' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-1)' }}>Notification Settings</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Control how you want to be notified about updates.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.emailNotifications} onChange={e => setFormData({...formData, emailNotifications: e.target.checked})} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Email Notifications</div>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.pushNotifications} onChange={e => setFormData({...formData, pushNotifications: e.target.checked})} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Push Notifications</div>
                  </label>
                </div>
                
                <button 
                  className="btn btn-primary shadow-lg" 
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600, minWidth: 120 }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>

        </div>
      </div>
    </div>
  );
}
