import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Timer } from 'lucide-react';

const UnderDevelopment = ({ title, description, icon: Icon, color = "#2563eb" }) => {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '100%', minHeight: 'calc(100vh - 5rem)', position: 'relative', overflow: 'hidden',
      padding: '2rem'
    }}>
      {/* Background Animated Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: [0, 80, 0],
          y: [0, 50, 0],
          rotate: [0, 90, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute', top: '5%', left: '5%', width: '35vw', height: '35vw',
          backgroundColor: color, filter: 'blur(100px)', opacity: 0.12, zIndex: 0, borderRadius: '50%'
        }}
      />

      <motion.div
        animate={{
          scale: [1.3, 1, 1.3],
          x: [0, -80, 0],
          y: [0, -50, 0],
          rotate: [0, -90, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute', bottom: '5%', right: '5%', width: '35vw', height: '35vw',
          backgroundColor: '#8b5cf6', filter: 'blur(100px)', opacity: 0.1, zIndex: 0, borderRadius: '50%'
        }}
      />

      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          x: [-30, 30, -30],
          y: [30, -30, 30]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute', top: '40%', left: '45%', width: '20vw', height: '20vw',
          backgroundColor: '#f59e0b', filter: 'blur(80px)', opacity: 0.08, zIndex: 0, borderRadius: '50%'
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px' }}>
        {/* Ícone Animado Central */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 10 }}
          style={{ marginBottom: '3rem', position: 'relative' }}
        >
          <div
            style={{
              position: 'absolute', inset: -20, filter: 'blur(40px)', opacity: 0.3,
              backgroundColor: color, borderRadius: '50%'
            }}
          />
          <div style={{
            backgroundColor: 'white', padding: '3.5rem', borderRadius: '40px',
            boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
          }}>
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ color: color }}
            >
              <Icon size={96} strokeWidth={2.5} />
            </motion.div>

            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ position: 'absolute', top: '-10px', right: '-10px', color: '#f59e0b' }}
            >
              <Sparkles size={40} fill="currentColor" />
            </motion.div>
          </div>
        </motion.div>

        {/* Textos */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 600, color: '#0f172a',
            textAlign: 'center', marginBottom: '1.5rem', letterSpacing: '-0.04em', lineHeight: 1
          }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', color: '#64748b', textAlign: 'center',
            maxWidth: '600px', lineHeight: 1.4, marginBottom: '4rem', fontWeight: 500
          }}
        >
          {description}
        </motion.p>

        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 2.5rem',
            backgroundColor: 'white', borderRadius: '30px', boxShadow: 'var(--shadow-lg)',
            border: '1px solid #f1f5f9'
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color }}
          />
          <span style={{ fontWeight: 600, color: '#334155', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Timer size={20} style={{ color: color }} />
            Módulo em fase final de compilação
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default UnderDevelopment;
