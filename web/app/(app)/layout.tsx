'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { continueOnWebStore } from '@/lib/store/uiStore';
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
      if (localStorage.getItem('continueOnWeb') === 'true') {
        setContinueOnWeb(true);
      }
    }
  }, []);

  const handleContinue = () => {
    setContinueOnWeb(true);
    localStorage.setItem('continueOnWeb', 'true');
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: 40, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(56,189,248,0.3)', background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))' }}>
          <div style={{ fontSize: 64, marginBottom: 24, animation: 'pulse-glow 2s infinite' }}>📱</div>
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
