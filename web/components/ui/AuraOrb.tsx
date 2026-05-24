'use client';
import { motion } from 'framer-motion';

export const AuraOrb = ({ subtitle }: { subtitle?: string }) => (
  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
    
    {/* Orb Assembly */}
    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Outermost pulsing ring */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.05, 0.15] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 120, height: 120,
          borderRadius: '50%',
          border: '1px solid rgba(83, 189, 235, 0.5)',
        }}
      />

      {/* Middle ring */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        style={{
          position: 'absolute',
          width: 90, height: 90,
          borderRadius: '50%',
          border: '1px solid rgba(0, 168, 132, 0.4)',
        }}
      />

      {/* Spinning arc */}
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', width: 100, height: 100 }}>
        <defs>
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00a884" stopOpacity="0" />
            <stop offset="50%" stopColor="#00a884" stopOpacity="1" />
            <stop offset="100%" stopColor="#53bdeb" stopOpacity="1" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="50" cy="50" r="46"
          fill="none"
          stroke="url(#arcGradient)"
          strokeWidth="2"
          strokeDasharray="289"
          strokeDashoffset="217"
          strokeLinecap="round"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '50% 50%' }}
        />
      </svg>

      {/* Inner glow orb */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
        style={{
          width: 60, height: 60,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(83,189,235,0.8), rgba(0,168,132,0.6), rgba(59,130,246,0.4))',
          boxShadow: '0 0 30px rgba(0,168,132,0.4), 0 0 60px rgba(83,189,235,0.2), inset 0 0 20px rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
        }}
      />
    </div>

    {/* Text Block */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      {/* Brand name */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <span style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>MS</span>
        <span style={{
          fontSize: 30,
          fontWeight: 300,
          letterSpacing: '-0.02em',
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1,
        }}>-</span>
        <span style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #53bdeb 0%, #00a884 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>Dev</span>
      </div>

      {/* Loading dots + subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {subtitle && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
          }}>
            {subtitle}
          </span>
        )}
        {/* Animated dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              style={{
                width: 4, height: 4,
                borderRadius: '50%',
                background: i === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>

  </div>
);
