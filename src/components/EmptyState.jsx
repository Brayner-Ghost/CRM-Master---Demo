import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Database, MousePointer2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const EmptyState = ({ title, description, icon: Icon = Database, color, onClick }) => {
  const { t } = useTheme();
  const iconColor = color || t.accent;

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', width: '100%', minHeight: 'calc(100vh - 280px)', flex: 1
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        style={{ position: 'relative', marginBottom: '2.5rem' }}
      >
        {/* Animated Background Aura */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{ 
            position: 'absolute', inset: -30, filter: 'blur(40px)', opacity: 0.15,
            background: `conic-gradient(from 0deg, ${iconColor}, #8b5cf6, #f59e0b, ${iconColor})`,
            borderRadius: '50%'
          }}
        />

        <div style={{ 
          backgroundColor: t.bg, padding: '2.5rem', borderRadius: '35px', 
          boxShadow: t.shadowLarge, border: t.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          zIndex: 2
        }}>
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ color: iconColor }}
          >
            <Icon size={64} strokeWidth={2} />
          </motion.div>

          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ 
              position: 'absolute', bottom: '-10px', right: '-10px', 
              backgroundColor: '#10b981', color: 'white', padding: '8px', 
              borderRadius: '12px', boxShadow: '0 8px 16px rgba(16,185,129,0.3)' 
            }}
          >
            <Plus size={20} strokeWidth={3} />
          </motion.div>
        </div>
      </motion.div>

      <motion.h3
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, marginBottom: '1rem', textAlign: 'center' }}
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ color: t.textSecondary, fontSize: '1.1rem', textAlign: 'center', maxWidth: '400px', lineHeight: 1.5, marginBottom: 0 }}
      >
        {description}
      </motion.p>
    </div>
  );
};

export default EmptyState;
