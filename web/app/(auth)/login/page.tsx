'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { signInWithGoogle } from '@/lib/firebase/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 30px rgba(147,51,234,0.4)' }}>
            <img src="/MSDEV.png" alt="MSDEV" width={48} height={48} style={{ display: 'block', objectFit: 'cover' }} />
          </div>
        </div>
        
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 40, lineHeight: 1.6 }}>
          Sign in to MSDEV to access your workspace,<br />projects, and real-time trackers.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-1)', fontSize: 15, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: loading ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'var(--bg-hover)';
            el.style.borderColor = 'var(--accent)';
            el.style.transform = 'translateY(-2px)';
            el.style.boxShadow = 'var(--shadow-glow)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'var(--bg-elevated)';
            el.style.borderColor = 'var(--border)';
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = 'none';
          }}
        >
          {loading ? (
            <span style={{ width: 22, height: 22, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div style={{ marginTop: 32, fontSize: 12, color: 'var(--text-3)' }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </div>
      </motion.div>
    </div>
  );
}
