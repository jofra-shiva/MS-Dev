'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const MALE_AVATARS   = ['/avatar_m1.png', '/avatar_m2.png', '/avatar_m3.png', '/avatar_m4.png', '/avatar_m5.png'];
const FEMALE_AVATARS = ['/avatar_f1.png', '/avatar_f2.png', '/avatar_f3.png', '/avatar_f4.png', '/avatar_f5.png'];

const TOKEN_TTL = 5 * 60; // 5 minutes in seconds

export default function ProfilePage() {
  const { user } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  // VS Code connect state
  const [ideToken, setIdeToken] = useState<string | null>(null);
  const [ideLoading, setIdeLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const avatars = gender === 'male' ? MALE_AVATARS : FEMALE_AVATARS;
  const currentAvatar = selectedAvatar || user?.photoURL || avatars[0];

  // Clear countdown on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const generateToken = async () => {
    setIdeLoading(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable<{}, { token: string }>(functions, 'generateIDEToken');
      const result = await fn({});
      setIdeToken(result.data.token);
      setCountdown(TOKEN_TTL);

      // Start countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setIdeToken(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(`Failed to generate token: ${err.message}`);
    } finally {
      setIdeLoading(false);
    }
  };

  const copyToken = async () => {
    if (!ideToken) return;
    await navigator.clipboard.writeText(ideToken);
    toast.success('Token copied to clipboard!');
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
        My Profile
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
        Manage your account and avatar preferences.
      </p>

      {/* Profile card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: '3px solid var(--accent)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img
              src={currentAvatar}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
              {user?.displayName || 'User'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{user?.email}</div>
          </div>
        </div>

        {/* Info rows */}
        {[
          { label: 'Display Name', value: user?.displayName || '—' },
          { label: 'Email', value: user?.email || '—' },
          { label: 'Provider', value: user?.providerData?.[0]?.providerId || '—' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* VS Code Connect Card */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,122,204,0.2), rgba(99,102,241,0.2))',
            border: '1px solid rgba(0,122,204,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {'</> '}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Connect VS Code</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Manage your MSDEV tasks directly from the editor
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 16 }}>
          {[
            { num: '1', text: 'Install the MSDEV Tasks extension in VS Code' },
            { num: '2', text: 'Click "Generate Token" below' },
            { num: '3', text: 'In VS Code: Cmd/Ctrl+Shift+P → "MSDEV: Sign In" → paste token' },
          ].map(step => (
            <div key={step.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)',
                color: 'white', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', paddingTop: 2 }}>{step.text}</div>
            </div>
          ))}
        </div>

        {ideToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Token display */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              wordBreak: 'break-all',
              color: 'var(--text-1)',
              maxHeight: 80,
              overflowY: 'auto',
              lineHeight: 1.5,
            }}>
              {ideToken}
            </div>

            {/* Copy + countdown */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyToken}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Token
              </button>
              <div style={{
                padding: '8px 14px', borderRadius: 8, background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', fontSize: 13, fontWeight: 700,
                color: countdown < 60 ? 'var(--danger)' : 'var(--text-2)',
                fontFamily: 'var(--mono)',
              }}>
                ⏱ {formatCountdown(countdown)}
              </div>
              <button className="btn btn-secondary" onClick={generateToken}>
                Regenerate
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              ⚠️ This token expires in {formatCountdown(countdown)}. Never share it publicly.
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={generateToken}
            disabled={ideLoading}
          >
            {ideLoading ? (
              <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                Generate VS Code Token
              </>
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}

