import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import Coupons from './pages/Coupons';
import Partners from './pages/Partners';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Login from './pages/Login';
import UnderDevelopment from './components/UnderDevelopment';
import LoadingScreen from './components/LoadingScreen';
import Service from './pages/Service';
import LLM from './pages/LLM';
import Automations from './pages/Automations';
import Help from './pages/Help';
import Reports from './pages/Reports';
import Ecommerce from './pages/Ecommerce';
import FloatingAIAssistant from './components/FloatingAIAssistant';
import { useUser, UserProvider } from './context/UserContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ShoppingBag, Building2, FileText, Shield, Star, Lock, Eye, EyeOff, X, Mail, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from './firebase';
import { updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { encryptData } from './utils/crypto';
import './App.css';

const ProtectedRoute = ({ children, id }) => {
  const { loading, hasPermission, hasPlanAccess, subscription, user } = useUser();
  const { t } = useTheme();

  if (loading) return null;

  // Se não tem acesso pelo plano, e não é developer
  if (!hasPlanAccess(id) && user?.funcao !== 'developer') {
    return (
      <div style={{
        height: 'calc(100vh - 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: t.bgSecondary, padding: '2rem'
      }}>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            maxWidth: '650px', width: '100%', backgroundColor: t.bg, border: `2px solid ${t.accent}`,
            borderRadius: t.radius, padding: '3rem', textAlign: 'center', boxShadow: t.shadowLarge
          }}
        >
          <div style={{
            width: '80px', height: '80px', backgroundColor: t.accentSoft, color: t.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px',
            margin: '0 auto 2rem'
          }}>
            <Star size={40} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: t.text, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            Upgrade Necessário
          </h1>
          <p style={{ color: t.textSecondary, fontWeight: 500, fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
              O módulo <strong>{id.charAt(0).toUpperCase() + id.slice(1)}</strong> não está disponível no plano <strong>{subscription?.plano}</strong>.
            </span>
            Faça o upgrade para liberar este e outros recursos avançados.
          </p>
          <button
            onClick={() => window.location.href = '/help?tab=plans'}
            style={{
              width: '100%', height: '56px', backgroundColor: t.accent, color: t.accentContrast,
              border: 'none', borderRadius: t.radiusSmall, fontWeight: 600, fontSize: '1rem',
              cursor: 'pointer', boxShadow: t.shadowSmall, transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Ver Planos de Assinatura
          </button>
        </motion.div>
      </div>
    );
  }

  // Se tem plano mas não tem permissão de usuário
  if (!hasPermission(id)) {
    return (
      <div style={{
        height: 'calc(100vh - 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: t.bgSecondary, padding: '2rem'
      }}>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            maxWidth: '500px', width: '100%', backgroundColor: t.bg, border: t.border,
            borderRadius: t.radius, padding: '3rem', textAlign: 'center', boxShadow: t.shadow
          }}
        >
          <div style={{
            width: '80px', height: '80px', backgroundColor: '#fee2e2', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px',
            margin: '0 auto 2rem'
          }}>
            <Shield size={40} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: t.text, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            Acesso Restrito
          </h1>
          <p style={{ color: t.textSecondary, fontWeight: 500, fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Você não possui as permissões necessárias para acessar este módulo. Contate o administrador do sistema.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              width: '100%', height: '56px', backgroundColor: t.bgSecondary, color: t.text,
              border: t.border, borderRadius: t.radiusSmall, fontWeight: 600, fontSize: '1rem',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Voltar ao Início
          </button>
        </motion.div>
      </div>
    );
  }
  return children;
};

function AppContent() {
  const { t, currentTheme } = useTheme();
  const { user, loading, hasPermission, hasPlanAccess, companyData, subscription, logout, getTenantDoc, activeCompany } = useUser();
  const [sidebarState, setSidebarState] = useState('expanded');

  // Password change states for first login
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Blocked subscription states
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarState('mobile');
      else if (window.innerWidth <= 1024) setSidebarState('collapsed');
      else setSidebarState('expanded');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setPasswordLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        await updateDoc(doc(db, 'users', user.id), {
          requirePasswordChange: encryptData('false'),
          temporaryPassword: ''
        });
      } else {
        setPasswordError('Usuário não autenticado.');
      }
    } catch (err) {
      console.error("Password change error:", err);
      let msg = 'Erro ao alterar a senha.';
      if (err.code === 'auth/requires-recent-login') {
        msg = 'Sessão expirada. Faça login novamente para alterar a senha.';
      } else if (err.message) {
        msg = err.message;
      }
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!user) return <Login />;

  const isBlocked = (companyData?.status === 'bloqueada' || subscription?.status === 'bloqueada') && user?.funcao !== 'developer';

  const handleSelectPlan = async (planName) => {
    if (user?.funcao === 'developer') {
      if (window.confirm(`Deseja alterar o plano corporativo para ${planName} imediatamente?`)) {
        setPlanLoading(true);
        try {
          const encryptedPlan = encryptData(planName);
          await setDoc(getTenantDoc('company', 'subscription'), {
            plano: encryptedPlan,
            status: encryptData('Ativa')
          }, { merge: true });

          await setDoc(doc(db, 'business', activeCompany || user?.empresa || 'development'), {
            status: encryptData('ativa')
          }, { merge: true });

          alert(`Plano alterado para ${planName} com sucesso!`);
          setShowPlansModal(false);
        } catch (e) {
          console.error(e);
          alert('Erro ao alterar o plano.');
        }
        setPlanLoading(false);
      }
    } else if (user?.funcao === 'responsavel') {
      // Abre o envio de e-mail de solicitação
      const subject = encodeURIComponent('Solicitação de Mudança de Plano (Conta Bloqueada)');
      const body = encodeURIComponent(
        `Solicitação de Mudança de Plano\n\nUsuário: ${user?.nome}\nCargo: ${user?.funcao}\nEmpresa: ${companyData?.nome || 'Minha Empresa'}\nE-mail de acesso: ${user?.email}\nPlano solicitado: ${planName}\n\nOlá,\n\nGostaria de solicitar a mudança do plano da assinatura suspensa da minha empresa para o plano "${planName}".\n\nAtenciosamente,\n${user?.nome}`
      );
      window.location.href = `mailto:braynners.tech@braynner.com.br?subject=${subject}&body=${body}`;
      alert(`Uma solicitação de mudança para o plano ${planName} foi preparada no seu cliente de e-mail. Por favor, conclua o envio para que possamos atualizar sua assinatura!`);
      setShowPlansModal(false);
    } else {
      alert('Acesso negado. Apenas o responsável pode escolher e solicitar planos, e apenas desenvolvedores podem alterá-los diretamente.');
    }
  };

  const handleRequestBackup = () => {
    const empresaNome = companyData?.nome || 'Minha Empresa';
    const usuarioNome = user?.nome || 'Usuário';
    const usuarioFuncao = user?.funcao || 'Funcionário';
    
    const subject = encodeURIComponent(`Solicitação de Backup - ${empresaNome}`);
    const body = encodeURIComponent(
      `Olá,\n\nGostaria de solicitar o backup dos meus dados conforme previsto em contrato.\n\nEmpresa: ${empresaNome}\nSolicitante: ${usuarioNome} - ${usuarioFuncao}\n\nAtenciosamente,\n${usuarioNome}`
    );
    
    window.location.href = `mailto:suporte@newglobal.com.br?subject=${subject}&body=${body}`;
  };

  if (user && isBlocked) {
    const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
    const isOwner = user?.funcao === 'responsavel' || user?.funcao === 'admin' || user?.funcao === 'developer';

    return (
      <div style={{
        minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bgSecondary, position: 'relative', overflow: 'hidden',
        fontFamily: "'Outfit', 'Inter', sans-serif", padding: '1rem',
        zIndex: 10000
      }}>
        {/* Decorative glowing spheres */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Dot Grid Background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: isDark ? 'radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)' : 'radial-gradient(rgba(15,23,42,0.06) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            width: '100%', maxWidth: '640px', backgroundColor: t.bg, border: `2.5px solid #ef4444`,
            borderRadius: '32px', padding: '3.5rem 3rem', boxShadow: t.shadowLarge, zIndex: 1,
            position: 'relative', textAlign: 'center'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              width: '80px', height: '80px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px',
              margin: '0 auto 2rem', border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <Lock size={38} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: t.text, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
              {isOwner ? 'Assinatura Bloqueada' : 'Acesso Bloqueado'}
            </h1>
            <p style={{ 
              color: t.textSecondary, 
              fontWeight: 500, 
              fontSize: '0.95rem', 
              lineHeight: 1.65, 
              marginBottom: '1rem',
              textAlign: 'justify',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              padding: '1.5rem',
              borderRadius: '16px',
              border: t.border
            }}>
              {isOwner ? (
                "Sua assinatura está bloqueada. Como proprietário/administrador da conta, você possui privilégios para regularizar o acesso escolhendo um dos nossos planos ou solicitar o backup dos seus dados cadastrais (sujeito a custos contratuais previstos em contrato). Se nenhuma ação for tomada, os dados poderão ser excluídos definitivamente em até 5 anos."
              ) : (
                "O acesso ao sistema está bloqueado porque a assinatura desta empresa está suspensa. Apenas o proprietário ou responsável pela conta possui permissão para reativar o acesso ou solicitar o backup de dados. Caso acredite que isso seja um engano, por favor entre em contato com o responsável ou administrador do sistema."
              )}
            </p>
          </div>

          {/* DYNAMIC COLORED BUTTONS */}
          {isOwner ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              <motion.button
                onClick={() => setShowPlansModal(true)}
                whileHover={{ scale: 1.02, backgroundColor: '#1d4ed8', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: '1 1 160px', height: '56px', backgroundColor: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', boxShadow: t.shadowSmall, outline: 'none'
                }}
              >
                <Star size={18} /> Ver Planos
              </motion.button>

              <motion.button
                onClick={() => setShowContactModal(true)}
                whileHover={{ scale: 1.02, backgroundColor: '#059669', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: '1 1 160px', height: '56px', backgroundColor: '#10b981', color: '#fff',
                  border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', boxShadow: t.shadowSmall, outline: 'none'
                }}
              >
                <Mail size={18} /> Entrar em Contato
              </motion.button>

              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.02, backgroundColor: '#dc2626', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: '1 1 160px', height: '56px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', boxShadow: t.shadowSmall, outline: 'none'
                }}
              >
                <LogOut size={18} /> Sair
              </motion.button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.02, backgroundColor: '#dc2626', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', maxWidth: '240px', height: '56px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', boxShadow: t.shadowSmall, outline: 'none'
                }}
              >
                <LogOut size={18} /> Sair
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Plans Modal */}
        {showPlansModal && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(12px)', zIndex: 11000 }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="modal-content"
              style={{ maxWidth: '850px', padding: '3rem', borderRadius: '32px', backgroundColor: t.bg || '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: t.text || '#0f172a' }}>Escolha um Plano de Assinatura</h2>
                <button 
                  onClick={() => setShowPlansModal(false)} 
                  className="btn-close-modal"
                  style={{ outline: 'none' }}
                >
                  <X size={24} />
                </button>
              </div>

              <p style={{ color: t.textSecondary || '#64748b', marginBottom: '2rem', fontSize: '0.95rem' }}>
                Selecione o plano desejado para reativar sua conta. Apenas o responsável tem permissão para confirmar a alteração.
              </p>

              {planLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                  <Loader2 className="animate-spin" size={32} color={t.accent} />
                </div>
              )}

              {!planLoading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                  {[
                    { name: 'PDV', price: 'R$ 80', period: '/mês', desc: 'Gestão simplificada de vendas e PDV', color: '#14b8a6' },
                    { name: 'Básico', price: 'R$ 100', period: '/mês', desc: 'Ideal para pequenas empresas em crescimento', color: '#2563eb' },
                    { name: 'Intermediário', price: 'R$ 250', period: '/mês', desc: 'Recursos avançados de estoque e documentos', color: '#6366f1' },
                    { name: 'Premium', price: 'R$ 400', period: '/mês', desc: 'Acesso ilimitado e inteligência AI completa', color: '#f59e0b' },
                    { name: 'Personalizado', price: 'A consultar', period: '', desc: 'Solução customizada sob demanda', color: '#8b5cf6' }
                  ].map(plan => (
                    <motion.div
                      key={plan.name}
                      whileHover={{ y: -4, boxShadow: '0 12px 20px -8px rgba(0,0,0,0.1)' }}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '20px',
                        border: `2px solid ${subscription?.plano === plan.name ? plan.color : '#e2e8f0'}`,
                        backgroundColor: subscription?.plano === plan.name ? `${plan.color}05` : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        position: 'relative'
                      }}
                    >
                      {subscription?.plano === plan.name && (
                        <span style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: plan.color, color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 900 }}>ATIVO</span>
                      )}
                      <div>
                        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: t.text || '#0f172a' }}>{plan.name}</h3>
                        <p style={{ fontSize: '0.75rem', color: t.textSecondary || '#64748b', marginTop: '0.25rem', lineHeight: 1.3 }}>{plan.desc}</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '1.25rem', color: plan.color }}>
                          {plan.price}
                          {plan.period && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: t.textSecondary }}>{plan.period}</span>}
                        </div>
                        <motion.button
                          onClick={() => handleSelectPlan(plan.name)}
                          disabled={subscription?.plano === plan.name}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: subscription?.plano === plan.name ? '#cbd5e1' : plan.color,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: subscription?.plano === plan.name ? 'default' : 'pointer',
                            marginTop: '0.75rem'
                          }}
                        >
                          {subscription?.plano === plan.name ? 'Plano Atual' : 'Selecionar'}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Support / Contact Modal */}
        {showContactModal && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(12px)', zIndex: 11000 }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="modal-content"
              style={{ maxWidth: '600px', padding: '3rem', borderRadius: '32px', backgroundColor: t.bg || '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: t.text || '#0f172a' }}>Entrar em Contato</h2>
                <button 
                  onClick={() => setShowContactModal(false)} 
                  className="btn-close-modal"
                  style={{ outline: 'none' }}
                >
                  <X size={24} />
                </button>
              </div>

              <p style={{ color: t.textSecondary || '#64748b', marginBottom: '2rem', fontSize: '0.95rem' }}>
                Para solicitar a reativação, suporte ou a exportação/backup dos seus dados (custo adicional previsto em contrato), clique no botão abaixo para nos enviar um e-mail.
              </p>

              <div style={{ padding: '1.5rem', backgroundColor: t.bgSecondary || '#f8fafc', borderRadius: '16px', border: `1px solid ${t.border || '#e2e8f0'}`, fontSize: '0.95rem', marginBottom: '2rem', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: t.text }}>Detalhes da Solicitação:</div>
                <div style={{ color: t.textSecondary }}>Empresa: <strong style={{ color: t.text }}>{companyData?.nome || 'Minha Empresa'}</strong></div>
                <div style={{ color: t.textSecondary }}>Solicitante: <strong style={{ color: t.text }}>{user?.nome} ({user?.funcao})</strong></div>
                <div style={{ color: t.textSecondary }}>E-mail: <strong style={{ color: t.text }}>{user?.email}</strong></div>
              </div>

              <motion.button 
                onClick={handleRequestBackup}
                className="btn-primary w-full" 
                whileHover={{ scale: 1.02, backgroundColor: t.primaryHover || '#1d4ed8', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                style={{ padding: '1rem', borderRadius: '16px', cursor: 'pointer', backgroundColor: t.accent || '#2563eb', color: t.accentContrast || '#fff', border: 'none', fontWeight: 700 }}
              >
                Enviar Solicitação de Backup por E-mail
              </motion.button>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if (user && user.requirePasswordChange) {
    const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
    const handleBackToLogin = async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Error signing out:", err);
      }
    };

    return (
      <div style={{
        minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bgSecondary, position: 'relative', overflow: 'hidden',
        fontFamily: "'Outfit', 'Inter', sans-serif", padding: '1rem',
      }}>
        {/* dot grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: isDark ? 'radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)' : 'radial-gradient(rgba(15,23,42,0.06) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            width: '100%', maxWidth: '420px', backgroundColor: t.bg, border: t.border,
            borderRadius: '24px', padding: '2.5rem', boxShadow: t.shadowLarge, zIndex: 1,
            position: 'relative'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px', height: '64px', backgroundColor: `${t.accent}15`, color: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '20px',
              margin: '0 auto 1.25rem'
            }}>
              <Lock size={30} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: t.text, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Alterar Senha Inicial
            </h1>
            <p style={{ color: t.textSecondary, fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.6 }}>
              Para garantir a segurança da sua conta, você deve alterar a senha temporária em seu primeiro acesso.
            </p>
          </div>
          
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', marginBottom: '6px', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nova Senha <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{
                    width: '100%', height: '44px', padding: '0 2.5rem 0 1rem',
                    background: t.bgSecondary, border: t.border, borderRadius: '12px',
                    color: t.text, fontSize: '0.9375rem', outline: 'none', transition: 'border-color 0.2s'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', color: t.textSecondary, padding: 0
                  }}
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', marginBottom: '6px', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirmar Nova Senha <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%', height: '44px', padding: '0 2.5rem 0 1rem',
                    background: t.bgSecondary, border: t.border, borderRadius: '12px',
                    color: t.text, fontSize: '0.9375rem', outline: 'none', transition: 'border-color 0.2s'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', color: t.textSecondary, padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            {passwordError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '0.75rem 1rem', background: t.currentTheme === 'dark' ? 'rgba(239,68,68,0.12)' : '#fef2f2', border: '1px solid #fee2e2',
                  borderRadius: '10px', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {passwordError}
              </motion.div>
            )}
            
            <motion.button
              type="submit"
              disabled={passwordLoading}
              whileHover={passwordLoading ? {} : { backgroundColor: `${t.accent}dd`, scale: 1.01 }}
              whileTap={passwordLoading ? {} : { scale: 0.99 }}
              style={{
                width: '100%', height: '46px', backgroundColor: t.accent, color: t.accentContrast,
                border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem',
                cursor: passwordLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', transition: 'all 0.2s', outline: 'none'
              }}
            >
              {passwordLoading ? 'SALVANDO...' : 'ALTERAR SENHA'}
            </motion.button>

            <motion.button
              type="button"
              onClick={handleBackToLogin}
              whileHover={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                width: '100%', height: '44px', backgroundColor: 'transparent', color: t.textSecondary,
                border: t.border, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', transition: 'all 0.2s', outline: 'none',
                marginTop: '0.25rem'
              }}
            >
              VOLTAR AO LOGIN
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  const getMainClass = () => {
    if (sidebarState === 'mobile')    return 'main-content content-mobile';
    if (sidebarState === 'collapsed') return 'main-content content-collapsed';
    return 'main-content content-expanded';
  };

  return (
    <div className="app-container">
      <Sidebar sidebarState={sidebarState} setSidebarState={setSidebarState} />
      <main className={getMainClass()}>
        <Routes>
          <Route path="/" element={<ProtectedRoute id="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute id="contacts"><Contacts sidebarState={sidebarState} /></ProtectedRoute>} />
          <Route path="/deals" element={<ProtectedRoute id="deals"><Deals /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute id="inventory"><Inventory sidebarState={sidebarState} /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute id="calendar"><Calendar /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute id="coupons"><Coupons /></ProtectedRoute>} />
          <Route path="/partners" element={<ProtectedRoute id="partners"><Partners /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute id="tasks"><Tasks /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute id="settings"><Settings /></ProtectedRoute>} />
          <Route path="/help" element={<Help />} />
          <Route path="/reports" element={<ProtectedRoute id="reports"><Reports /></ProtectedRoute>} />
          <Route path="/ecommerce" element={<ProtectedRoute id="ecommerce"><Ecommerce /></ProtectedRoute>} />
          <Route path="/service" element={<ProtectedRoute id="service"><Service /></ProtectedRoute>} />
          <Route path="/llm" element={<ProtectedRoute id="llm"><LLM /></ProtectedRoute>} />
          <Route path="/automations" element={<ProtectedRoute id="automations"><Automations /></ProtectedRoute>} />
          <Route path="/companies" element={<ProtectedRoute id="companies"><UnderDevelopment title="Gestão Corporativa B2B" description="Gerenciamento de grandes contas e hierarquias empresariais." icon={Building2} color="#3b82f6" /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute id="documents"><UnderDevelopment title="Smart Documents" description="Editor de propostas com assinatura digital e nuvem." icon={FileText} color="#64748b" /></ProtectedRoute>} />
        </Routes>
      </main>
      {(hasPlanAccess('llm') || user?.funcao === 'developer') && <FloatingAIAssistant />}
    </div>
  );
}


function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <GoogleOAuthProvider clientId="mock-google-client-id-demo-only.apps.googleusercontent.com">
      <UserProvider>
        <OfflineSyncProvider>
          <ThemeProvider>
            <Router>
              <ScrollToTop />
              <AppContent />
            </Router>
          </ThemeProvider>
        </OfflineSyncProvider>
      </UserProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
