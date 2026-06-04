import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { Zap, Mail, Lock, Loader2, AlertCircle, ArrowRight, Eye, EyeOff, X, Copyright, ShieldCheck, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/* ─── helpers ─── */
const inp = (t) => ({
  width: '100%',
  height: '44px',
  padding: '0 1rem 0 2.75rem',
  background: t.bgSecondary,
  border: t.border,
  borderRadius: '12px',
  color: t.text,
  fontSize: '0.9375rem',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: 'inherit',
});

const label = (t) => ({
  display: 'block',
  fontWeight: 600,
  fontSize: '0.6875rem',
  marginBottom: '6px',
  color: t.textSecondary,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
});

export default function Login() {
  const { login } = useUser();
  const { t, currentTheme, setTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [createAccountData, setCreateAccountData] = useState({ nome: '', telefone: '', email: '', solicitacao: '', plano: 'Básico' });
  const [saveIp, setSaveIp] = useState(localStorage.getItem('trustedDevice') === 'true');
  const [attempts, setAttempts] = useState(parseInt(localStorage.getItem('loginAttempts') || '0'));
  const [lockoutUntil, setLockoutUntil] = useState(parseInt(localStorage.getItem('lockoutTime') || '0'));
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTimeLeft(lockoutUntil > now ? Math.ceil((lockoutUntil - now) / 1000) : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (timeLeft > 0) { setError(`Bloqueado. Tente em ${timeLeft}s.`); return; }
    setLoading(true); setError('');
    const result = await login(email, password);
    if (result.success) {
      localStorage.removeItem('loginAttempts'); localStorage.removeItem('lockoutTime');
      if (saveIp) localStorage.setItem('trustedDevice', 'true');
      else localStorage.removeItem('trustedDevice');
      window.location.href = './';
    } else {
      const n = attempts + 1; setAttempts(n); localStorage.setItem('loginAttempts', n.toString());
      const threshold = saveIp ? 1 : 5;
      if (n >= threshold) { const t2 = Date.now() + 30000; setLockoutUntil(t2); localStorage.setItem('lockoutTime', t2.toString()); }
      let msg = 'E-mail ou senha incorretos.';
      if (result.error?.includes('network-request-failed')) msg = 'Erro de conexão. Verifique sua internet.';
      else if (result.error?.includes('too-many-requests')) msg = 'Muitas tentativas. Conta temporariamente bloqueada.';
      setError(msg); setLoading(false);
    }
  };

  /* ─── styles ─── */
  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);

  const getLeftPanelBg = () => {
    if (currentTheme === 'midnight') return '#000000';
    if (currentTheme === 'dim') return '#15202b';
    if (currentTheme === 'highContrast') return '#000000';
    if (currentTheme === 'beige') return '#2a221e';
    if (isDark) return '#09090b';
    return '#020617'; // Elegant, premium deep slate for clean/clear/beige
  };

  const pageStyle = {
    minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: t.bgSecondary, position: 'relative', overflow: 'hidden',
    fontFamily: "'Outfit', 'Inter', sans-serif", padding: '1rem',
  };

  const cardStyle = {
    width: '100%', maxWidth: '920px',
    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
    background: t.bg, borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: isDark ? '0 32px 64px -12px rgba(0,0,0,0.7)' : '0 32px 64px -12px rgba(0,0,0,0.18)',
    border: t.border,
  };

  const leftStyle = {
    flex: '0 0 320px',
    background: getLeftPanelBg(),
    display: isMobile ? 'none' : 'flex',
    flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
    padding: '3rem 2.5rem', color: '#fff', position: 'relative', overflow: 'hidden',
  };

  const rightStyle = {
    flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
    padding: isMobile ? '2rem 1.5rem' : '3rem 3.5rem', background: t.bg,
  };

  const btnPrimary = {
    width: '100%', height: '46px',
    background: timeLeft > 0 ? t.bgSecondary : t.accent, color: t.accentContrast, border: 'none',
    borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700,
    cursor: (loading || timeLeft > 0) ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    letterSpacing: '0.04em', transition: 'opacity 0.2s',
  };

  const btnGhost = {
    background: 'none', border: 'none', color: t.textSecondary,
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
    padding: '4px 0',
  };

  const modalOverlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.55)',
    backdropFilter: 'blur(10px)', padding: '1rem',
  };

  const modalBox = {
    background: t.bg, border: t.border, borderRadius: '20px',
    padding: isMobile ? '1.5rem' : '2rem',
    width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto',
    position: 'relative', boxShadow: t.shadowLarge,
  };

  const closeBtn = {
    position: 'absolute', top: '1rem', right: '1rem',
    background: '#ef4444', border: 'none', width: '30px', height: '30px',
    borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', zIndex: 10,
  };

  return (
    <div style={pageStyle}>
      {/* dot grid */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: isDark ? 'radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)' : 'radial-gradient(rgba(15,23,42,0.06) 1px,transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* theme toggle */}
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 100 }}>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setTheme(isDark ? 'clean' : 'dark')}
          style={{
            background: t.bg, border: t.border, color: t.textSecondary,
            width: '40px', height: '40px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: t.shadow,
          }}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
      </div>

      <motion.div key={currentTheme} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }} style={{ ...cardStyle, zIndex: 1 }}>

        {/* ── LEFT ── */}
        <div style={leftStyle}>
          <motion.div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)',
            backgroundSize: '36px 36px',
          }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 5, repeat: Infinity }} />

          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: '80px', height: '80px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)',
                borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.75rem', boxShadow: '0 16px 32px rgba(0,0,0,0.3)',
              }}>
              <Zap size={38} fill="#2563eb" color="#2563eb" />
            </motion.div>

            <h1 style={{
              fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '0.75rem',
              background: 'linear-gradient(to bottom,#fff,#94a3b8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>CRM Master</h1>

            <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500, lineHeight: 1.6, maxWidth: '220px' }}>
              Gestão inteligente e escala acelerada para o seu negócio.
            </p>
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
            <span>Braynner's Tech</span><Copyright size={11} /><span>2026</span>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div style={rightStyle}>
          <div style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}>
            {/* mobile logo */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.75rem' }}>
                <div style={{ width: '36px', height: '36px', background: '#0f172a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={20} fill="#2563eb" color="#2563eb" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: t.text }}>CRM Master</span>
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: t.text, letterSpacing: '-0.03em', marginBottom: '4px' }}>
                Acessar conta
              </h2>
              <p style={{ color: t.textSecondary, fontSize: '0.875rem', fontWeight: 500 }}>
                Bem-vindo de volta! Por favor, identifique-se.
              </p>
            </div>

            {/* Quick Demo Access / Tutorial Card */}
            <div style={{
              background: isDark ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.04)',
              border: `1px dashed ${isDark ? 'rgba(37, 99, 235, 0.4)' : 'rgba(37, 99, 235, 0.25)'}`,
              borderRadius: '16px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.2)' : '0 4px 20px rgba(37, 99, 235, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: t.accent, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <Zap size={14} fill={t.accent} style={{ color: t.accent }} />
                <span>Modo de Demonstração</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: t.textSecondary, lineHeight: 1.5, margin: 0 }}>
                Use as credenciais abaixo para acessar e explorar todas as funcionalidades do sistema:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: t.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>E-mail:</span>
                  <strong style={{ fontSize: '0.75rem', color: t.text, fontFamily: 'monospace' }}>demo@crmmaster.com</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>Senha:</span>
                  <strong style={{ fontSize: '0.75rem', color: t.text, fontFamily: 'monospace' }}>Qualquer senha (ex: 123456)</strong>
                </div>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEmail('demo@crmmaster.com');
                  setPassword('123456');
                }}
                style={{
                  background: t.accent,
                  color: t.accentContrast,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.625rem',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: isDark ? '0 4px 12px rgba(37,99,235,0.3)' : '0 4px 12px rgba(37,99,235,0.15)',
                  transition: 'opacity 0.2s',
                }}
              >
                PREENCHER DADOS
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* email */}
              <div>
                <label style={label(t)}>E-mail</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary, display: 'flex' }}>
                    <Mail size={16} />
                  </div>
                  <input type="email" required placeholder="nome@empresa.com" value={email}
                    onChange={e => setEmail(e.target.value)} style={inp(t)} />
                </div>
              </div>

              {/* password */}
              <div>
                <label style={label(t)}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary, display: 'flex' }}>
                    <Lock size={16} />
                  </div>
                  <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inp(t), paddingRight: '2.75rem' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', display: 'flex' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* trusted device */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="saveIp" checked={saveIp} onChange={e => setSaveIp(e.target.checked)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: t.accent }} />
                <label htmlFor="saveIp" style={{ fontSize: '0.8125rem', color: t.textSecondary, fontWeight: 500, cursor: 'pointer' }}>
                  Dispositivo confiável
                </label>
              </div>

              {/* error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{
                      padding: '0.75rem 1rem', background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                      border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.3)' : '#fee2e2'),
                      borderRadius: '10px', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                    <AlertCircle size={15} /> {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* submit */}
              <motion.button type="submit" disabled={loading || timeLeft > 0}
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.98 }} style={btnPrimary}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>{timeLeft > 0 ? `BLOQUEADO (${timeLeft}s)` : 'ENTRAR'}<ArrowRight size={16} /></>
                )}
              </motion.button>
            </form>

            {/* links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
              <motion.button onClick={() => setShowRecoveryModal(true)}
                whileHover={{ color: t.accent }} style={btnGhost}>
                Esqueceu a senha? <span style={{ color: t.accent }}>Recuperar</span>
              </motion.button>

              <motion.button onClick={() => setShowCreateAccountModal(true)} type="button"
                whileHover={{ borderColor: t.accent, color: t.accent }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  width: '100%',
                  padding: '0.625rem', background: t.bg, border: t.border,
                  borderRadius: '10px', color: t.text, cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em',
                }}>
                CRIAR CONTA
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── RECOVERY MODAL ── */}
      <AnimatePresence>
        {showRecoveryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={modalOverlay}>
            <motion.div initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
              style={modalBox}>
              <motion.button onClick={() => setShowRecoveryModal(false)} whileHover={{ scale: 1.1, rotate: 90 }}
                style={closeBtn}><X size={16} /></motion.button>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '56px', height: '56px', background: t.primary, borderRadius: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#fff',
                }}>
                  <ShieldCheck size={26} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.text, marginBottom: '0.75rem' }}>
                  Suporte Técnico
                </h3>
                <p style={{ color: t.muted, lineHeight: 1.65, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Para sua segurança, a recuperação de senha deve ser solicitada diretamente ao nosso time técnico.
                </p>
                <motion.a href="mailto:suporte@crm.braynner.com"
                  whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    padding: '0.875rem', background: t.bgSecondary, color: t.text, textDecoration: 'none',
                    borderRadius: '12px', fontWeight: 600, fontSize: '0.9375rem', border: t.border,
                  }}>
                  <Mail size={18} /> suporte@crm.braynner.com
                </motion.a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CREATE ACCOUNT MODAL ── */}
      <AnimatePresence>
        {showCreateAccountModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={modalOverlay}>
            <motion.div initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
              style={modalBox}>
              <motion.button onClick={() => { setShowCreateAccountModal(false); setIsSent(false); }}
                whileHover={{ scale: 1.1, rotate: 90 }} style={closeBtn}><X size={16} /></motion.button>

              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '14px',
                  background: `${t.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem', color: t.accent,
                }}>
                  <Zap size={26} fill={t.accent} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.text, marginBottom: '4px' }}>
                  Solicitar Acesso
                </h2>
                <p style={{ color: t.textSecondary, fontSize: '0.8125rem' }}>
                  Preencha os dados para solicitar sua conta.
                </p>
              </div>

              {isSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%', background: t.successSoft || '#f0fdf4',
                    color: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
                  }}>
                    <ShieldCheck size={26} />
                  </div>
                  <h3 style={{ color: t.text, fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                    Solicitação Enviada!
                  </h3>
                  <p style={{ color: t.textSecondary, fontSize: '0.8125rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    Recebemos seus dados. Nosso time entrará em contato em breve.
                  </p>
                  <motion.button onClick={() => { setShowCreateAccountModal(false); setIsSent(false); }}
                    whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '0.6rem 1.75rem', background: t.accent, color: t.accentContrast,
                      border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}>
                    ENTENDI
                  </motion.button>
                </motion.div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={label(t)}>Nome do Responsável</label>
                    <input type="text" placeholder="Seu nome completo" value={createAccountData.nome}
                      onChange={e => setCreateAccountData({ ...createAccountData, nome: e.target.value })}
                      style={{ ...inp(t), paddingLeft: '1rem' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={label(t)}>Telefone</label>
                      <input type="text" placeholder="(00) 00000-0000" value={createAccountData.telefone}
                        onChange={e => setCreateAccountData({ ...createAccountData, telefone: e.target.value })}
                        style={{ ...inp(t), paddingLeft: '1rem' }} />
                    </div>
                    <div>
                      <label style={label(t)}>E-mail</label>
                      <input type="email" placeholder="seu@email.com" value={createAccountData.email}
                        onChange={e => setCreateAccountData({ ...createAccountData, email: e.target.value })}
                        style={{ ...inp(t), paddingLeft: '1rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={label(t)}>Plano Escolhido</label>
                    <select value={createAccountData.plano}
                      onChange={e => setCreateAccountData({ ...createAccountData, plano: e.target.value })}
                      style={{
                        ...inp(t),
                        paddingLeft: '1rem',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(t.textSecondary || '#64748b')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1.2em'
                      }}>
                      <option value="PDV">PDV (R$ 80/mês)</option>
                      <option value="Básico">Básico (R$ 100/mês)</option>
                      <option value="Intermediário">Intermediário (R$ 250/mês)</option>
                      <option value="Premium">Premium (R$ 400/mês)</option>
                    </select>
                  </div>

                  <div>
                    <label style={label(t)}>Mensagem / Solicitação (Opcional)</label>
                    <textarea placeholder="Descreva sua necessidade..." value={createAccountData.solicitacao}
                      onChange={e => setCreateAccountData({ ...createAccountData, solicitacao: e.target.value })}
                      style={{
                        width: '100%', padding: '0.75rem 1rem', background: t.bgSecondary, border: t.border,
                        borderRadius: '12px', outline: 'none', minHeight: '90px', resize: 'none',
                        color: t.text, fontSize: '0.9375rem', fontFamily: 'inherit',
                      }} />
                  </div>

                  <motion.a
                    href={`https://api.whatsapp.com/send?phone=5531999720489&text=${encodeURIComponent(
                      `Olá! Gostaria de solicitar a criação de uma nova conta no CRM Master:\n\n` +
                      `• Nome do Responsável: ${createAccountData.nome}\n` +
                      `• Telefone: ${createAccountData.telefone || 'Não informado'}\n` +
                      `• E-mail: ${createAccountData.email}\n` +
                      `• Plano Escolhido: ${createAccountData.plano || 'Básico'}\n\n` +
                      `Mensagem Opcional:\n${createAccountData.solicitacao || 'Nenhuma'}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={async (e) => {
                      if (!createAccountData.nome || !createAccountData.email) {
                        e.preventDefault();
                        alert('Preencha o Nome e o E-mail.');
                        return;
                      }
                      try {
                        await addDoc(collection(db, 'leads'), { 
                          ...createAccountData, 
                          status: 'novo', 
                          createdAt: serverTimestamp(), 
                          type: 'account_request' 
                        });
                        setIsSent(true);
                      } catch (err) { 
                        console.error('Erro ao registrar lead:', err);
                      }
                    }}
                    whileHover={{ opacity: 0.88 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%', padding: '0.75rem', background: t.accent, color: t.accentContrast,
                      border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      fontSize: '0.875rem', letterSpacing: '0.04em', textDecoration: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    ENVIAR SOLICITAÇÃO
                  </motion.a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
