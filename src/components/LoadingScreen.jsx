import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, Shield, Cpu, Bot } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import packageJson from '../../package.json';

const LoadingScreen = () => {
  const { t, currentTheme } = useTheme();
  const [statusIndex, setStatusIndex] = useState(0);

  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
  const isHighContrast = ['highContrast', 'highContrastLight'].includes(currentTheme);

  const hexToRgba = (hex, alpha) => {
    if (!hex || typeof hex !== 'string') return 'transparent';
    if (hex.startsWith('rgb')) return hex;
    const cleanHex = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    } else {
      return hex;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getBorder = () => {
    if (isHighContrast) return t.border;
    const match = t.border.match(/#[0-9a-fA-F]{3,6}/);
    if (match) {
      return `1px solid ${hexToRgba(match[0], isDark ? 0.25 : 0.6)}`;
    }
    return t.border;
  };

  const statuses = [
    "Iniciando motores...",
    "Sincronizando com a nuvem...",
    "Otimizando performance...",
    "Preparando sua dashboard...",
    "Quase lá..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.bgSecondary,
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background Decorative Elements */}
      {!isHighContrast && (
        <>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{
              position: 'absolute',
              top: '-10%',
              right: '-10%',
              width: '40vw',
              height: '40vw',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${hexToRgba(t.accent, 0.2)} 0%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
              rotate: [0, -120, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            style={{
              position: 'absolute',
              bottom: '-15%',
              left: '-10%',
              width: '50vw',
              height: '50vw',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${hexToRgba(t.accent, 0.13)} 0%, transparent 70%)`,
              filter: 'blur(80px)',
            }}
          />
        </>
      )}

      {/* Floating Particles */}
      {!isHighContrast && [...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: 0
          }}
          animate={{
            y: [null, Math.random() * -100, Math.random() * 100],
            x: [null, Math.random() * 100, Math.random() * -100],
            opacity: [0, 0.3, 0]
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: t.accent,
            filter: 'blur(2px)'
          }}
        />
      ))}

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          padding: '4rem 3rem',
          borderRadius: isHighContrast ? '0px' : '48px',
          backgroundColor: isHighContrast ? t.bg : hexToRgba(t.bg, 0.7),
          backdropFilter: isHighContrast ? 'none' : 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: isHighContrast ? 'none' : 'blur(30px) saturate(180%)',
          border: getBorder(),
          boxShadow: isHighContrast ? 'none' : (isDark ? '0 30px 60px -12px rgba(0, 0, 0, 0.5)' : '0 30px 60px -12px rgba(0, 0, 0, 0.15)'),
          maxWidth: '440px',
          width: '90%',
          textAlign: 'center'
        }}
      >
        {/* Logo Section */}
        <div style={{ position: 'relative' }}>
          {!isHighContrast && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '35px',
                border: `2px dashed ${hexToRgba(t.accent, 0.2)}`,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          <motion.div
            style={{
              width: '85px',
              height: '85px',
              borderRadius: isHighContrast ? '0px' : '26px',
              backgroundColor: t.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.accentContrast,
              boxShadow: isHighContrast ? 'none' : `0 15px 30px -5px ${hexToRgba(t.accent, 0.33)}`,
              position: 'relative',
              zIndex: 2,
              border: isHighContrast ? t.border : 'none'
            }}
            whileHover={isHighContrast ? {} : { scale: 1.05 }}
          >
            <motion.div
              animate={{
                opacity: [1, 0.5, 1],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap size={42} fill="currentColor" />
            </motion.div>
          </motion.div>
        </div>

        {/* Text Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <motion.h2
            style={{
              fontSize: '2.5rem',
              fontWeight: 600,
              color: t.text,
              margin: 0,
              letterSpacing: '-0.06em',
              background: `linear-gradient(135deg, ${t.text} 30%, ${t.accent} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: isDark ? 'none' : '0 10px 20px rgba(0,0,0,0.05)'
            }}
          >
            {packageJson.name.replace(/-root$/, '').toUpperCase().replace('-', ' ')}
          </motion.h2>

          <div style={{ height: '24px' }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={statusIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  color: t.textSecondary,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  opacity: 0.8
                }}
              >
                {statuses[statusIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress Container */}
        <div style={{ width: '100%', marginTop: '0.5rem' }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: hexToRgba(t.accent, 0.12),
            borderRadius: isHighContrast ? '0px' : '20px',
            overflow: 'hidden',
            border: `1px solid ${hexToRgba(t.accent, 0.1)}`
          }}>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 12, ease: "easeInOut" }}
              style={{
                height: '100%',
                borderRadius: isHighContrast ? '0px' : '20px',
                background: `linear-gradient(90deg, ${hexToRgba(t.accent, 0.6)}, ${t.accent})`,
                boxShadow: isHighContrast ? 'none' : `0 0 15px ${hexToRgba(t.accent, 0.4)}`
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '10px',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: t.textSecondary,
            opacity: 0.6,
            textTransform: 'uppercase'
          }}>
            <span>v{packageJson.version}</span>
            <span>Braynner's Tech</span>
          </div>
        </div>

        {/* Floating Dock Elements */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          marginTop: '0.5rem',
          padding: '12px 24px',
          borderRadius: isHighContrast ? '0px' : '20px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          color: t.textSecondary,
          border: isHighContrast ? t.border : 'none'
        }}>
          <motion.div whileHover={isHighContrast ? {} : { y: -2, color: t.accent }}><Shield size={20} /></motion.div>
          <motion.div whileHover={isHighContrast ? {} : { y: -2, color: t.accent }}><Cpu size={20} /></motion.div>
          <motion.div whileHover={isHighContrast ? {} : { y: -2, color: t.accent }}><Bot size={20} /></motion.div>
        </div>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
