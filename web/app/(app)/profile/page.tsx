'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useState } from 'react';
import { motion } from 'framer-motion';

const MALE_AVATARS   = ['/avatar_m1.png', '/avatar_m2.png', '/avatar_m3.png', '/avatar_m4.png', '/avatar_m5.png'];
const FEMALE_AVATARS = ['/avatar_f1.png', '/avatar_f2.png', '/avatar_f3.png', '/avatar_f4.png', '/avatar_f5.png'];

export default function ProfilePage() {
  const { user } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const avatars = gender === 'male' ? MALE_AVATARS : FEMALE_AVATARS;
  const currentAvatar = selectedAvatar || user?.photoURL || avatars[0];

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

    </div>
  );
}
