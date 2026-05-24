'use client';
import { motion } from 'framer-motion';

export default function MSLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <svg width="200" height="120" viewBox="0 0 200 120" fill="none">
        {/* Letter M */}
        <motion.path
          d="M 40 90 C 40 90, 45 40, 45 35 C 50 60, 65 75, 70 80 C 75 75, 90 60, 95 35 C 95 40, 100 90, 100 90"
          stroke="url(#msGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        {/* Letter S */}
        <motion.path
          d="M 160 40 C 130 20, 115 55, 140 60 C 165 65, 150 100, 120 80"
          stroke="url(#msGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut", delay: 1 }}
        />
        <defs>
          <linearGradient id="msGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00a884" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        style={{ color: '#00a884', fontSize: 16, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}
      >
        MS-Dev
      </motion.div>
    </div>
  );
}
