'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuraOrb } from '@/components/ui/AuraOrb';
import { useAuth } from '@/lib/hooks/useAuth';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { motion } from 'framer-motion';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [continueOnWeb, setContinueOnWeb] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
      try {
        if (localStorage.getItem('continueOnWeb') === 'true') {
          setContinueOnWeb(true);
        }
      } catch (e) {
        console.warn('localStorage not available', e);
      }
    }
  }, []);

  const handleContinue = () => {
    setContinueOnWeb(true);
    try {
      localStorage.setItem('continueOnWeb', 'true');
    } catch (e) {
      console.warn('localStorage not available', e);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <AuraOrb subtitle="Workspace" />
    </div>
  );
  if (!user) return null;

  if (isMobile && !continueOnWeb) {
    return (
      <div style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24, textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: 40, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ marginBottom: 24, color: 'var(--accent)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>Mobile App Available!</h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 32, lineHeight: 1.6 }}>
            The web dashboard is optimized for desktop viewing. For the best experience on your phone, download our native Android app.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <a href="https://github.com/jofra-shiva/MS-Dev/raw/master/releases/MS-Dev-Mobile.apk" download className="btn btn-primary" style={{ padding: '16px', fontSize: 15, fontWeight: 700, textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
              Download Native App
            </a>
            <button onClick={handleContinue} className="btn" style={{ padding: '16px', fontSize: 15, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-2)', width: '100%', justifyContent: 'center' }}>
              Continue in Browser
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Topbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
