import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingCart, CheckSquare,
  Settings, Box, Ticket, Handshake, CalendarDays,
  ShoppingBag, ChevronDown, ChevronLeft, ChevronRight, MessageSquare, Bot,
  Cpu, LogOut, Zap, Menu, X, Sun, Moon, Shield, Building, CloudMoon, Eye,
  Contrast, Palette, Droplet, LayoutGrid, List, HelpCircle, TrendingUp
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { decryptData } from '../utils/crypto';

const Sidebar = ({ sidebarState, setSidebarState }) => {
  const { user, hasPermission, loading, logout, activeCompany, subscription } = useUser();
  const { t, currentTheme, setTheme, company: companyTheme, viewSettings, setViewSettings } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMobileVisible, setIsMobileVisible] = useState(false);
  const isExpanded = sidebarState === 'expanded';
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [hoveredEl, setHoveredEl] = useState(null);

  const location = useLocation();
  const currentPath = location.pathname;

  const getActiveModuleKey = () => {
    if (currentPath.includes('/inventory')) return 'inventory';
    if (currentPath.includes('/contacts')) return 'contacts';
    if (currentPath.includes('/tasks')) return 'tasks';
    if (currentPath.includes('/coupons')) return 'coupons';
    if (currentPath.includes('/partners')) return 'partners';
    if (currentPath.includes('/deals')) return 'deals';
    return null;
  };

  const activeModuleKey = getActiveModuleKey();

  const isSidebarLight = ['clear', 'highContrastLight'].includes(currentTheme);
  const sidebarTextColor = isSidebarLight ? '#0f172a' : '#ffffff';
  const sidebarMutedColor = isSidebarLight ? '#64748b' : 'rgba(255,255,255,0.6)';
  const sidebarBorderColor = isSidebarLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  const sidebarProfileBg = isSidebarLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)';
  const [cats, setCats] = useState({ geral: true, auto: true, outros: true });
  const popupRef = useRef(null);
  const [activeCompanyData, setActiveCompanyData] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const targetComp = activeCompany || user?.empresa || 'development';
    if (targetComp === 'development') {
      setActiveCompanyData({
        nome: 'Development Core',
        nomeFantasia: 'Development',
        ambiente: 'homologacao',
        status: 'ativa'
      });
      return;
    }

    const unsub = onSnapshot(doc(db, 'business', targetComp), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const decryptedAmbiente = data.ambiente ? (decryptData(data.ambiente) || data.ambiente) : 'homologacao';
        const decryptedStatus = data.status ? (decryptData(data.status) || data.status) : 'ativa';
        setActiveCompanyData({
          ...data,
          nome: data.nome || '',
          nomeFantasia: data.nomeFantasia || '',
          ambiente: decryptedAmbiente,
          status: decryptedStatus
        });
      } else {
        setActiveCompanyData({
          nome: 'Empresa',
          nomeFantasia: targetComp,
          ambiente: 'homologacao',
          status: 'ativa'
        });
      }
    }, (err) => {
      console.error("Error listening to business doc:", err);
    });

    return () => unsub();
  }, [activeCompany, user?.empresa]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileVisible(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowProfileCard(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleLogout = () => {
    if (window.confirm('Tem certeza que deseja sair do sistema?')) {
      logout();
    }
  };
  const NavItem = ({ to, icon, label, id }) => {
    const { hasPermission, hasPlanAccess } = useUser();

    if (!hasPermission(id)) return null;

    const isLocked = !hasPlanAccess(id);

    return (
      <NavLink
        to={to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isLocked ? 'plan-locked' : ''}`}
        onClick={() => isMobile && setIsMobileVisible(false)}
        style={{
          outline: (currentTheme === 'highContrast') ? '1px solid transparent' : 'none',
          border: (currentTheme === 'highContrast') ? '1px solid transparent' : 'none',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (currentTheme === 'highContrast') {
            e.currentTarget.style.outline = '3px solid #ffff00';
            e.currentTarget.style.outlineOffset = '-3px';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (currentTheme === 'highContrast') {
            e.currentTarget.style.outline = '1px solid transparent';
            e.currentTarget.style.outlineOffset = '0';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon}
          {isLocked && (
            <div style={{
              position: 'absolute', top: -6, right: -6, backgroundColor: '#fbbf24',
              borderRadius: '50%', padding: '2px', border: '1px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Zap size={10} color="white" fill="white" />
            </div>
          )}
        </div>
        {(isExpanded || isMobileVisible) && (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {label}
            {isLocked && (
              <span style={{
                fontSize: '10px', backgroundColor: '#fbbf24', color: '#78350f',
                padding: '2px 6px', borderRadius: '6px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.02em', marginLeft: '8px'
              }}>
                PRO
              </span>
            )}
          </span>
        )}
      </NavLink>
    );
  };

  const sidebarClass = `sidebar ${isMobile ? (isMobileVisible ? 'mobile-visible shadow-2xl' : 'mobile-hidden') : (isExpanded ? 'expanded' : 'collapsed')} ${loading ? 'opacity-50 pointer-events-none' : ''}`;
  const currentStatus = isOffline ? 'offline' : (activeCompanyData?.status || 'ativa');

  return (
    <>
      {isMobile && (
        <button
          className={`menu-toggle ${isMobileVisible ? 'is-active' : ''}`}
          onClick={() => setIsMobileVisible(!isMobileVisible)}
          style={{ display: isMobileVisible ? 'none' : 'flex' }}
        >
          <Menu size={24} />
        </button>
      )}

      {isMobileVisible && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileVisible(false)}
        />
      )}

      <aside className={sidebarClass}>
        <div className="sidebar-logo" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 0',
          gap: '12px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: (isExpanded || isMobileVisible) ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <Zap
              size={26}
              color={t.accent}
              fill={t.accent}
              style={{
                flexShrink: 0,
                filter: `drop-shadow(0 0 10px ${t.accent}55)`
              }}
            />
            {(isExpanded || isMobileVisible) && (
              <span style={{
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: t.accent,
                fontSize: '1rem',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
              }}>
                CRM MASTER
              </span>
            )}
          </div>
          {!isMobile && isExpanded && (
            <button
              onClick={() => setSidebarState('collapsed')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = t.accent;
                e.currentTarget.style.backgroundColor = isSidebarLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = t.textSecondary;
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Recolher Sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {!isMobile && !isExpanded && (
            <button
              onClick={() => setSidebarState('expanded')}
              style={{
                background: 'transparent',
                border: 'none',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
                transition: 'all 0.2s',
                marginTop: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = t.accent;
                e.currentTarget.style.backgroundColor = isSidebarLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = t.textSecondary;
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Expandir Sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}
          {(isExpanded || isMobileVisible) && activeCompanyData && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              padding: '0 1.25rem',
              marginTop: '4px'
            }}>
              {/* Company Name */}
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: sidebarTextColor,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                opacity: 0.9,
                marginBottom: '6px'
              }}>
                {activeCompanyData.nomeFantasia || activeCompanyData.nome || 'Development'}
              </span>

              {/* Status and Environment Badges */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                {/* Environment Badge */}
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  letterSpacing: '0.03em',
                  backgroundColor: activeCompanyData.ambiente === 'producao'
                    ? (isSidebarLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(239, 68, 68, 0.15)')
                    : activeCompanyData.ambiente === 'freetrial'
                      ? (isSidebarLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(234, 179, 8, 0.15)')
                      : (isSidebarLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(59, 130, 246, 0.15)'),
                  color: activeCompanyData.ambiente === 'producao'
                    ? (isSidebarLight ? '#dc2626' : '#f87171')
                    : activeCompanyData.ambiente === 'freetrial'
                      ? (isSidebarLight ? '#d97706' : '#facc15')
                      : (isSidebarLight ? '#2563eb' : '#60a5fa'),
                  border: activeCompanyData.ambiente === 'producao'
                    ? (isSidebarLight ? '1px solid rgba(220, 38, 38, 0.2)' : '1px solid rgba(239, 68, 68, 0.3)')
                    : activeCompanyData.ambiente === 'freetrial'
                      ? (isSidebarLight ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid rgba(234, 179, 8, 0.3)')
                      : (isSidebarLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(59, 130, 246, 0.3)'),
                }}>
                  {activeCompanyData.ambiente === 'producao' ? 'Produção' : activeCompanyData.ambiente === 'freetrial' ? 'Free Trial' : 'Homologação'}
                </span>

                {/* Status Badge */}
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  letterSpacing: '0.03em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: currentStatus === 'offline'
                    ? (isSidebarLight ? 'rgba(71, 85, 105, 0.1)' : 'rgba(100, 116, 139, 0.15)')
                    : currentStatus === 'ativa'
                      ? (isSidebarLight ? 'rgba(22, 163, 74, 0.1)' : 'rgba(34, 197, 94, 0.15)')
                      : currentStatus === 'inativa'
                        ? (isSidebarLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(234, 179, 8, 0.15)')
                        : (isSidebarLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(239, 68, 68, 0.15)'),
                  color: currentStatus === 'offline'
                    ? (isSidebarLight ? '#475569' : '#94a3b8')
                    : currentStatus === 'ativa'
                      ? (isSidebarLight ? '#16a34a' : '#4ade80')
                      : currentStatus === 'inativa'
                        ? (isSidebarLight ? '#d97706' : '#facc15')
                        : (isSidebarLight ? '#dc2626' : '#f87171'),
                  border: currentStatus === 'offline'
                    ? (isSidebarLight ? '1px solid rgba(71, 85, 105, 0.2)' : '1px solid rgba(100, 116, 139, 0.3)')
                    : currentStatus === 'ativa'
                      ? (isSidebarLight ? '1px solid rgba(22, 163, 74, 0.2)' : '1px solid rgba(34, 197, 94, 0.3)')
                      : currentStatus === 'inativa'
                        ? (isSidebarLight ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid rgba(234, 179, 8, 0.3)')
                        : (isSidebarLight ? '1px solid rgba(220, 38, 38, 0.2)' : '1px solid rgba(239, 68, 68, 0.3)'),
                }}>
                  {/* Status Indicator Dot */}
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: currentStatus === 'offline'
                      ? (isSidebarLight ? '#475569' : '#94a3b8')
                      : currentStatus === 'ativa'
                        ? (isSidebarLight ? '#16a34a' : '#22c55e')
                        : currentStatus === 'inativa'
                          ? (isSidebarLight ? '#d97706' : '#eab308')
                          : (isSidebarLight ? '#dc2626' : '#ef4444'),
                    display: 'inline-block'
                  }} />
                  {currentStatus === 'offline' ? 'Offline' : (currentStatus === 'ativa' ? 'Ativa' : (currentStatus === 'inativa' ? 'Inativa' : 'Bloqueada'))}
                </span>

                {/* Plan Badge */}
                {subscription?.plano && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    letterSpacing: '0.03em',
                    backgroundColor: subscription.plano === 'PDV'
                      ? (isSidebarLight ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.15)')
                      : subscription.plano === 'Básico'
                        ? (isSidebarLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.15)')
                        : subscription.plano === 'Intermediário'
                          ? (isSidebarLight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.15)')
                          : subscription.plano === 'Premium'
                            ? (isSidebarLight ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)')
                            : (isSidebarLight ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.15)'),
                    color: subscription.plano === 'PDV'
                      ? (isSidebarLight ? '#0d9488' : '#2dd4bf')
                      : subscription.plano === 'Básico'
                        ? (isSidebarLight ? '#2563eb' : '#60a5fa')
                        : subscription.plano === 'Intermediário'
                          ? (isSidebarLight ? '#4f46e5' : '#818cf8')
                          : subscription.plano === 'Premium'
                            ? (isSidebarLight ? '#d97706' : '#fbbf24')
                            : (isSidebarLight ? '#7c3aed' : '#a78bfa'),
                    border: subscription.plano === 'PDV'
                      ? (isSidebarLight ? '1px solid rgba(20, 184, 166, 0.2)' : '1px solid rgba(20, 184, 166, 0.3)')
                      : subscription.plano === 'Básico'
                        ? (isSidebarLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(37, 99, 235, 0.3)')
                        : subscription.plano === 'Intermediário'
                          ? (isSidebarLight ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.3)')
                          : subscription.plano === 'Premium'
                            ? (isSidebarLight ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(245, 158, 11, 0.3)')
                            : (isSidebarLight ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(139, 92, 246, 0.3)'),
                  }}>
                    {subscription.plano}
                  </span>
                )}
              </div>
            </div>
          )}
          {isMobile && isMobileVisible && (
            <button
              onClick={() => setIsMobileVisible(false)}
              style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}
            >
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {/* GERAL */}
          <div className="category-group">
            {(isExpanded || isMobileVisible) && (
              <div className="category-header" style={{ color: sidebarMutedColor }} onClick={() => setCats({ ...cats, geral: !cats.geral })}>
                Geral {cats.geral ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            )}
            <div className={`category-content ${(cats.geral || !isExpanded) ? 'open' : 'closed'}`}>
              <NavItem to="/" id="dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
              <NavItem to="/contacts" id="contacts" icon={<Users size={20} />} label="Contatos" />
              <NavItem to="/deals" id="deals" icon={<ShoppingCart size={20} />} label="Vendas" />
              <NavItem to="/inventory" id="inventory" icon={<Box size={20} />} label="Estoque" />
              <NavItem to="/calendar" id="calendar" icon={<CalendarDays size={20} />} label="Agenda" />
              <NavItem to="/tasks" id="tasks" icon={<CheckSquare size={20} />} label="Tarefas" />
              <NavItem to="/ecommerce" id="ecommerce" icon={<ShoppingBag size={20} />} label="E-commerce" />
            </div>
          </div>

          {/* AUTOMAÇÃO */}
          <div className="category-group">
            {(isExpanded || isMobileVisible) && (
              <div className="category-header" style={{ color: sidebarMutedColor }} onClick={() => setCats({ ...cats, auto: !cats.auto })}>
                Automação {cats.auto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            )}
            <div className={`category-content ${(cats.auto || !isExpanded) ? 'open' : 'closed'}`}>
              <NavItem to="/service" id="service" icon={<MessageSquare size={20} />} label="Atendimentos" />
              <NavItem to="/llm" id="llm" icon={<Bot size={20} />} label="Inteligência AI" />
              <NavItem to="/automations" id="automations" icon={<Cpu size={20} />} label="Automações" />
            </div>
          </div>

          {/* OUTROS */}
          <div className="category-group">
            {(isExpanded || isMobileVisible) && (
              <div className="category-header" style={{ color: sidebarMutedColor }} onClick={() => setCats({ ...cats, outros: !cats.outros })}>
                Outros {cats.outros ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            )}
            <div className={`category-content ${(cats.outros || !isExpanded) ? 'open' : 'closed'}`}>
              <NavItem to="/partners" id="partners" icon={<Handshake size={20} />} label="Parceiros" />
              <NavItem to="/coupons" id="coupons" icon={<Ticket size={20} />} label="Cupons" />
              <NavItem to="/reports" id="reports" icon={<TrendingUp size={20} />} label="Relatórios" />
              <NavItem to="/help" id="help" icon={<HelpCircle size={20} />} label="Ajuda" />
              <NavItem to="/settings" id="settings" icon={<Settings size={20} />} label="Configurações" />
            </div>
          </div>
        </nav>

        {/* FOOTER PERFIL */}
        <div className="sidebar-footer" style={{ borderTop: `1px solid ${sidebarBorderColor}` }}>
          {showProfileCard && (
            <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowProfileCard(false)}>
              <div
                ref={popupRef}
                className="profile-card-modal"
                onClick={e => e.stopPropagation()}
                style={{
                  backgroundColor: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.98)',
                  borderRadius: t.radius || '32px',
                  padding: '2rem',
                  width: '95%',
                  maxWidth: isMobile ? '380px' : '700px',
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6)',
                  border: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme)
                    ? '1px solid rgba(0, 0, 0, 0.1)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#0f172a' : '#ffffff',
                  backdropFilter: 'blur(20px)',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '2rem',
                  alignItems: 'stretch'
                }}>
                  {/* Coluna Esquerda: Temas e Modo de Visualização */}
                  <div style={{
                    flex: isMobile ? '1' : '1.3',
                    display: 'flex',
                    flexDirection: 'column',
                    order: isMobile ? 2 : 1,
                    gap: '1.25rem'
                  }}>
                    {/* Todos os 8 Temas do Sistema */}
                    <div>
                      <span style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.75rem',
                        textAlign: isMobile ? 'center' : 'left'
                      }}>
                        Personalização do Tema
                      </span>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        backgroundColor: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.25)',
                        borderRadius: t.radiusMedium || '16px',
                        padding: '6px',
                        gap: '6px'
                      }}>
                        {[
                          { id: 'clean', name: 'Clean', icon: Sun, color: '#2563eb', bg: '#ffffff', iconColor: '#2563eb' },
                          { id: 'clear', name: 'Clear', icon: Droplet, color: '#0969da', bg: '#ffffff', iconColor: '#0969da' },
                          { id: 'beige', name: 'Beige', icon: Palette, color: '#B5825D', bg: '#FAF6EF', iconColor: '#B5825D' },
                          { id: 'highContrastLight', name: 'HC L.', icon: Contrast, color: '#000000', bg: '#FFFFFF', iconColor: '#000000' },
                          { id: 'dark', name: 'Dark', icon: Moon, color: '#8b5cf6', bg: '#16171d', iconColor: '#c084fc' },
                          { id: 'dim', name: 'Dim', icon: CloudMoon, color: '#1d9bf0', bg: '#1c2938', iconColor: '#1d9bf0' },
                          { id: 'midnight', name: 'Midnight', icon: Zap, color: '#3b82f6', bg: '#0a0a0a', iconColor: '#3b82f6' },
                          { id: 'highContrast', name: 'HC D.', icon: Eye, color: '#ffff00', bg: '#000000', iconColor: '#ffff00' }
                        ].map((opt) => {
                          const isActive = currentTheme === opt.id;
                          const isHovered = hoveredEl === `theme-${opt.id}`;
                          const IconComponent = opt.icon;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setTheme(opt.id)}
                              onMouseEnter={() => setHoveredEl(`theme-${opt.id}`)}
                              onMouseLeave={() => setHoveredEl(null)}
                              title={opt.name}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px 4px',
                                borderRadius: t.radiusSmall || '12px',
                                border: `2px solid ${isActive ? opt.color : (isHovered ? opt.color : 'transparent')}`,
                                cursor: 'pointer',
                                backgroundColor: isActive
                                  ? (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#ffffff' : 'rgba(255,255,255,0.08)')
                                  : 'transparent',
                                color: isActive ? opt.iconColor : (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8'),
                                transform: isHovered ? 'translateY(-3px) scale(1.08)' : 'translateY(0) scale(1)',
                                boxShadow: isHovered ? `0 6px 12px ${opt.color}22` : 'none',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                gap: '4px',
                                outline: 'none'
                              }}
                            >
                              <IconComponent size={18} />
                              <span style={{
                                fontSize: '8px',
                                fontWeight: isActive ? 800 : 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                width: '100%',
                                textAlign: 'center'
                              }}>
                                {opt.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Modo de Visualização Rápido (Grade vs Lista) */}
                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.75rem',
                        textAlign: isMobile ? 'center' : 'left'
                      }}>
                        Modo de Visualização Geral
                      </span>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        backgroundColor: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.25)',
                        borderRadius: t.radiusMedium || '16px',
                        padding: '6px',
                        gap: '6px'
                      }}>
                        {(() => {
                          const isAllGrid = viewSettings?.inventory === 'grid' &&
                                            viewSettings?.contacts === 'grid' &&
                                            viewSettings?.tasks === 'grid' &&
                                            viewSettings?.coupons === 'grid' &&
                                            viewSettings?.partners === 'grid' &&
                                            viewSettings?.deals === 'grid';
                          const isAllList = viewSettings?.inventory === 'list' &&
                                            viewSettings?.contacts === 'list' &&
                                            viewSettings?.tasks === 'list' &&
                                            viewSettings?.coupons === 'list' &&
                                            viewSettings?.partners === 'list' &&
                                            viewSettings?.deals === 'list';
                          return (
                            <>
                              <button
                                onClick={() => {
                                  setViewSettings('inventory', 'grid');
                                  setViewSettings('contacts', 'grid');
                                  setViewSettings('tasks', 'grid');
                                  setViewSettings('coupons', 'grid');
                                  setViewSettings('partners', 'grid');
                                  setViewSettings('deals', 'grid');
                                  setViewSettings('dealsLegacy', 'grid');
                                }}
                                onMouseEnter={() => setHoveredEl('view-grid')}
                                onMouseLeave={() => setHoveredEl(null)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  padding: '10px',
                                  borderRadius: t.radiusSmall || '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: isAllGrid
                                    ? (t.accent || '#2563eb')
                                    : 'transparent',
                                  color: isAllGrid
                                    ? (t.accentContrast || '#ffffff')
                                    : (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8'),
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  transform: hoveredEl === 'view-grid' && !isAllGrid ? 'translateY(-2px)' : 'translateY(0)',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                              >
                                <LayoutGrid size={16} /> Grade
                              </button>

                              <button
                                onClick={() => {
                                  setViewSettings('inventory', 'list');
                                  setViewSettings('contacts', 'list');
                                  setViewSettings('tasks', 'list');
                                  setViewSettings('coupons', 'list');
                                  setViewSettings('partners', 'list');
                                  setViewSettings('deals', 'list');
                                  setViewSettings('dealsLegacy', 'list');
                                }}
                                onMouseEnter={() => setHoveredEl('view-list')}
                                onMouseLeave={() => setHoveredEl(null)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  padding: '10px',
                                  borderRadius: t.radiusSmall || '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: isAllList
                                    ? (t.accent || '#2563eb')
                                    : 'transparent',
                                  color: isAllList
                                    ? (t.accentContrast || '#ffffff')
                                    : (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8'),
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  transform: hoveredEl === 'view-list' && !isAllList ? 'translateY(-2px)' : 'translateY(0)',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                              >
                                <List size={16} /> Lista
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Modo de Visualização da Tela Atual (se houver correspondência de rota) */}
                    {activeModuleKey && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <span style={{
                          display: 'block',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: '0.5rem',
                          textAlign: isMobile ? 'center' : 'left'
                        }}>
                          Modo na Tela Atual ({activeModuleKey === 'inventory' ? 'Estoque' :
                            activeModuleKey === 'contacts' ? 'Clientes' :
                              activeModuleKey === 'tasks' ? 'Tarefas' :
                                activeModuleKey === 'coupons' ? 'Cupons' :
                                  activeModuleKey === 'partners' ? 'Parceiros' :
                                    activeModuleKey === 'deals' ? 'Vendas' : 'Esta Tela'})
                        </span>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          backgroundColor: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.25)',
                          borderRadius: t.radiusMedium || '16px',
                          padding: '6px',
                          gap: '6px'
                        }}>
                          <button
                            onClick={() => {
                              setViewSettings(activeModuleKey, 'grid');
                              if (activeModuleKey === 'deals') {
                                setViewSettings('dealsLegacy', 'grid');
                              }
                            }}
                            onMouseEnter={() => setHoveredEl('view-curr-grid')}
                            onMouseLeave={() => setHoveredEl(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: t.radiusSmall || '12px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: (viewSettings?.[activeModuleKey] === 'grid')
                                ? (t.accent || '#2563eb')
                                : 'transparent',
                              color: (viewSettings?.[activeModuleKey] === 'grid')
                                ? (t.accentContrast || '#ffffff')
                                : (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8'),
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              transform: hoveredEl === 'view-curr-grid' && viewSettings?.[activeModuleKey] !== 'grid' ? 'translateY(-2px)' : 'translateY(0)',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                          >
                            <LayoutGrid size={14} /> Grade
                          </button>

                          <button
                            onClick={() => {
                              setViewSettings(activeModuleKey, 'list');
                              if (activeModuleKey === 'deals') {
                                setViewSettings('dealsLegacy', 'list');
                              }
                            }}
                            onMouseEnter={() => setHoveredEl('view-curr-list')}
                            onMouseLeave={() => setHoveredEl(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: t.radiusSmall || '12px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: (viewSettings?.[activeModuleKey] === 'list')
                                ? (t.accent || '#2563eb')
                                : 'transparent',
                              color: (viewSettings?.[activeModuleKey] === 'list')
                                ? (t.accentContrast || '#ffffff')
                                : (['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8'),
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              transform: hoveredEl === 'view-curr-list' && viewSettings?.[activeModuleKey] !== 'list' ? 'translateY(-2px)' : 'translateY(0)',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                          >
                            <List size={14} /> Lista
                          </button>
                        </div>
                      </div>
                    )}


                  </div>



                  {/* Coluna Direita: Perfil, Empresa e Sair */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    order: isMobile ? 1 : 2,
                    gap: '1.5rem'
                  }}>
                    <div>
                      {/* Informações Básicas do Usuário */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.25rem' }}>
                        <div className="avatar" style={{
                          width: '80px',
                          height: '80px',
                          fontSize: '2rem',
                          marginBottom: '0.75rem',
                          boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)',
                          backgroundColor: t.accent || '#2563eb',
                          color: currentTheme === 'highContrast' ? '#000000' : '#ffffff'
                        }}>
                          {(user?.nome || 'U')[0]}
                        </div>
                        <div style={{ width: '100%' }}>
                          <span style={{
                            display: 'block',
                            fontWeight: 800,
                            color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#0f172a' : '#ffffff',
                            fontSize: '1.2rem',
                            marginBottom: '0.25rem'
                          }}>
                            {user?.nome || 'Usuário'}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            backgroundColor: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                            padding: '4px 12px',
                            borderRadius: '20px'
                          }}>
                            <Shield size={11} /> {user?.funcao || 'Membro'}
                          </span>
                        </div>
                      </div>

                      {/* Informações da Empresa Ativa */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '12px 16px',
                        background: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                        borderRadius: t.radiusMedium || '16px',
                        border: `1px solid ${['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                        width: '100%'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8' }}>
                          <Building size={14} />
                          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organização / Empresa</span>
                        </div>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#0f172a' : '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px'
                        }}>
                          {activeCompanyData?.nome || companyTheme?.nome || user?.empresa || 'Empresa'}
                        </span>
                        {activeCompanyData?.nomeFantasia && activeCompanyData?.nomeFantasia !== activeCompanyData?.nome && (
                          <span style={{ fontSize: '11px', color: ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme) ? '#475569' : '#94a3b8' }}>
                            {activeCompanyData.nomeFantasia}
                          </span>
                        )}

                        {/* Modo (Ambiente) e Status Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                           {activeCompanyData?.ambiente && (
                             <span style={{
                               fontSize: '9px',
                               fontWeight: 900,
                               textTransform: 'uppercase',
                               padding: '2px 8px',
                               borderRadius: '12px',
                               backgroundColor: activeCompanyData.ambiente === 'producao'
                                 ? 'rgba(239, 68, 68, 0.12)'
                                 : activeCompanyData.ambiente === 'freetrial'
                                   ? 'rgba(16, 185, 129, 0.12)'
                                   : 'rgba(59, 130, 246, 0.12)',
                               color: activeCompanyData.ambiente === 'producao'
                                 ? '#ef4444'
                                 : activeCompanyData.ambiente === 'freetrial'
                                   ? '#10b981'
                                   : '#3b82f6'
                             }}>
                               {activeCompanyData.ambiente === 'producao'
                                 ? 'Produção'
                                 : activeCompanyData.ambiente === 'freetrial'
                                   ? 'Free Trial'
                                   : 'Homologação'}
                             </span>
                           )}
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: activeCompanyData?.status === 'bloqueada'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : activeCompanyData?.status === 'inativa'
                                ? 'rgba(234, 179, 8, 0.12)'
                                : activeCompanyData?.status === 'offline'
                                  ? 'rgba(100, 116, 139, 0.12)'
                                  : 'rgba(16, 185, 129, 0.12)',
                            color: activeCompanyData?.status === 'bloqueada'
                              ? '#ef4444'
                              : activeCompanyData?.status === 'inativa'
                                ? '#eab308'
                                : activeCompanyData?.status === 'offline'
                                  ? '#64748b'
                                  : '#10b981'
                          }}>
                            {activeCompanyData?.status === 'offline' ? 'Offline' : (activeCompanyData?.status === 'ativa' ? 'Ativa' : (activeCompanyData?.status === 'inativa' ? 'Inativa' : (activeCompanyData?.status === 'bloqueada' ? 'Bloqueada' : 'Ativa')))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Sair do Sistema */}
                    <button
                      className="btn-cancel"
                      onMouseEnter={() => setHoveredEl('logout-btn')}
                      onMouseLeave={() => setHoveredEl(null)}
                      style={{
                        width: '100%',
                        padding: '0.85rem',
                        borderRadius: t.radiusMedium || '16px',
                        fontSize: '0.85rem',
                        gap: '10px',
                        fontWeight: 700,
                        transform: hoveredEl === 'logout-btn' ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: hoveredEl === 'logout-btn' ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        outline: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 'auto'
                      }}
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> Sair do Sistema
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="user-profile-container"
            style={{
              background: sidebarProfileBg,
              border: currentTheme === 'highContrast'
                ? '2px solid #ffffff'
                : currentTheme === 'highContrastLight'
                  ? '2px solid #000000'
                  : `1px solid ${sidebarBorderColor}`
            }}
            onClick={() => setShowProfileCard(!showProfileCard)}>
            <div className="avatar" style={{
              backgroundColor: t.accent,
              width: '30px',
              height: '30px',
              fontSize: '0.85rem',
              color: currentTheme === 'highContrast' ? '#000000' : '#ffffff',
              fontWeight: 900
            }}>{(user?.nome || 'U')[0]}</div>
            {(isExpanded || isMobileVisible) && (
              <>
                <div className="user-info-text">
                  <span className="user-name" style={{ color: sidebarTextColor, fontWeight: 600, fontSize: '0.8rem' }}>{user?.nome || 'Usuário'}</span>
                  <span className="user-role" style={{ color: sidebarMutedColor, fontSize: '0.65rem' }}>{user?.funcao || 'Membro'}</span>
                </div>
                <button className="logout-inline-btn" style={{ color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleLogout(); }}>
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
