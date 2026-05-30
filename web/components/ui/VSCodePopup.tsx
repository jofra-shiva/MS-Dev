'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';

export default function VSCodePopup() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if user is relatively new (created within the last 24 hours)
    const creationTime = user.metadata?.creationTime;
    const isNewUser = creationTime && (Date.now() - new Date(creationTime).getTime()) < 1000 * 60 * 60 * 24;
    const hasSeenPopup = localStorage.getItem('vscodePopupSeen');

    if (isNewUser && !hasSeenPopup) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShow(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem('vscodePopupSeen', 'true');
  };

  const handleAction = () => {
    localStorage.setItem('vscodePopupSeen', 'true');
    // Allow default link behavior to open vscode
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0.4 }}
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: 800,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(6, 182, 212, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>🚀</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                New to coding? Supercharge your workflow!
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.5 }}>
                Naanga pudhusa code pandravangalukkagave oru VS Code Extension create pannirukom. Try it out now!
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href="vscode:extension/jofra-shiva.ms-dev"
              onClick={handleAction}
              className="btn btn-primary shadow-lg"
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                background: '#ffffff',
                color: '#06b6d4',
                border: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Get Extension
            </a>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: 'none',
                color: '#fff',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              className="hover:bg-black/40"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
