'use client';
import { useState, useEffect } from 'react';
import Select from '@/components/ui/Select';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { updatePassword } from 'firebase/auth';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isGithubEditing, setIsGithubEditing] = useState(false);

  // Security / password state
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
  const [initialData, setInitialData] = useState(formData);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        
        let fetchedData: any = {};
        if (snap.exists()) {
          fetchedData = snap.data();
          if (fetchedData.theme && (fetchedData.theme === 'dark' || fetchedData.theme === 'light')) {
            document.documentElement.setAttribute('data-theme', fetchedData.theme);
            localStorage.setItem('theme', fetchedData.theme);
          } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'system');
          }
        }
        
        setFormData(prev => {
          const defaultName = user.displayName || fetchedData.displayName || (user.email ? user.email.split('@')[0] : '') || '';
          const newData = {
            ...prev,
            displayName: defaultName,
            email: user.email || fetchedData.email || '',
            githubUsername: fetchedData.githubUsername || '',
            role: fetchedData.role || 'developer',
            bio: fetchedData.bio || '',
            emailNotifications: fetchedData.emailNotifications ?? true,
            pushNotifications: fetchedData.pushNotifications ?? false,
            theme: fetchedData.theme || 'system',
          };
          setInitialData(newData);
          return newData;
        });

      } catch (err) {
        console.error("Error loading profile", err);
        setFormData(prev => {
          const defaultName = user.displayName || (user.email ? user.email.split('@')[0] : '') || '';
          const newData = {
            ...prev,
            displayName: defaultName,
            email: user.email || ''
          };
          setInitialData(newData);
          return newData;
        });
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
        displayName: formData.displayName,
        githubUsername: formData.githubUsername,
        role: formData.role,
        bio: formData.bio,
        emailNotifications: formData.emailNotifications,
        pushNotifications: formData.pushNotifications,
        theme: formData.theme,
        updatedAt: new Date()
      });
      setMessage('Changes saved successfully!');
      setInitialData(formData);
      setIsProfileEditing(false);
      setIsGithubEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (!user) return;
    setChangingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast.success('Password updated! You can now log in with Email & Password.');
      setNewPassword('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        toast.error('Please sign out and sign back in before changing your password.');
      } else {
        toast.error(`Failed: ${err.message}`);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} /></div>;
  }

  const isProfileDirty = formData.displayName !== initialData.displayName;
  const isGithubDirty = formData.githubUsername !== initialData.githubUsername;
  const isNotificationsDirty = formData.emailNotifications !== initialData.emailNotifications || formData.pushNotifications !== initialData.pushNotifications;
  const isThemeDirty = formData.theme !== initialData.theme;

  const inputStyle = {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
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
        
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 48 }}>
          
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

                <div style={{ display: 'flex', flex: 1, gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Full Name</label>
                    <input 
                      type="text" 
                      value={formData.displayName} 
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      disabled={!isProfileEditing}
                      placeholder="Enter your full name" 
                      style={{ ...inputStyle, opacity: isProfileEditing ? 1 : 0.5, cursor: isProfileEditing ? 'text' : 'not-allowed' }} 
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Email Address</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      disabled={true}
                      placeholder="No email provided" 
                      style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 72, paddingBottom: 2 }}>
                  {!isProfileEditing ? (
                    <button className="btn btn-secondary" onClick={() => setIsProfileEditing(true)} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-secondary" onClick={() => { setIsProfileEditing(false); setFormData(prev => ({ ...prev, displayName: initialData.displayName })) }} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary shadow-lg" onClick={handleSave} disabled={saving || !isProfileDirty} style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600, opacity: (saving || !isProfileDirty) ? 0.5 : 1 }}>
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
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
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
                      <span style={{ position: 'absolute', left: 16, color: 'var(--text-3)', fontSize: 14, opacity: isGithubEditing ? 1 : 0.5 }}>github.com/</span>
                      <input 
                        type="text" 
                        value={formData.githubUsername}
                        onChange={e => setFormData({...formData, githubUsername: e.target.value})}
                        disabled={!isGithubEditing}
                        placeholder="username"
                        style={{ ...inputStyle, paddingLeft: 96, opacity: isGithubEditing ? 1 : 0.5, cursor: isGithubEditing ? 'text' : 'not-allowed' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isGithubEditing ? (
                        <button className="btn btn-secondary" onClick={() => setIsGithubEditing(true)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
                          Edit
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-secondary" onClick={() => { setIsGithubEditing(false); setFormData(prev => ({ ...prev, githubUsername: initialData.githubUsername })) }} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
                            Cancel
                          </button>
                          <button className="btn btn-primary shadow-lg" onClick={handleSave} disabled={saving || !isGithubDirty} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, fontWeight: 600, opacity: (saving || !isGithubDirty) ? 0.5 : 1 }}>
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
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
                  disabled={saving || !isNotificationsDirty}
                  style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600, minWidth: 120, opacity: (saving || !isNotificationsDirty) ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-1)' }}>Appearance</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Customize the look and feel of the application.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Theme Preference</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Select
                    options={[
                      { value: 'system', label: 'System Preference' },
                      { value: 'dark', label: 'Dark Mode' },
                      { value: 'light', label: 'Light Mode' }
                    ]}
                    value={formData.theme}
                    onChange={(t) => {
                      setFormData({...formData, theme: t});
                      localStorage.setItem('theme', t);
                      if (t === 'dark' || t === 'light') {
                        document.documentElement.setAttribute('data-theme', t);
                      } else {
                        document.documentElement.removeAttribute('data-theme');
                      }
                    }}
                  />
                  
                  <button 
                    className="btn btn-primary shadow-lg" 
                    onClick={handleSave}
                    disabled={saving || !isThemeDirty}
                    style={{ padding: '10px 24px', fontSize: 14, borderRadius: 10, fontWeight: 600, opacity: (saving || !isThemeDirty) ? 0.5 : 1 }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-1)' }}>Security</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Set or change your account password for VS Code extension sign-in.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ flex: 1, marginRight: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>Set / Change Password</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Set a password so you can log in with Email &amp; Password in the VS Code extension.</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handlePasswordChange(); }}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-1)', fontSize: 13, outline: 'none', width: 220 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handlePasswordChange}
                    disabled={changingPassword || newPassword.length < 6}
                    style={{ padding: '10px 20px', fontSize: 13, borderRadius: 8, fontWeight: 600, whiteSpace: 'nowrap', opacity: (changingPassword || newPassword.length < 6) ? 0.5 : 1 }}
                  >
                    {changingPassword ? 'Saving…' : 'Set Password'}
                  </button>
                </div>
              </div>
            </motion.div>

        </div>
      </div>
    </div>
  );
}
