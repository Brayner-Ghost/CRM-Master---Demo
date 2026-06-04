import React, { useState, useEffect } from 'react';
import { addDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import { Plus, Trash2, X, Handshake, Phone, Mail, Loader2, Check, Edit3, Search, Filter, UserPlus, Briefcase, Store, Zap } from 'lucide-react';
import { maskPhone } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { encryptSensitiveFields, decryptSensitiveFields, decryptLegacySale, decryptActiveSale } from '../utils/crypto';

import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const PARTNER_SENSITIVE_FIELDS = ['tipo', 'email', 'telefone'];

const Partners = () => {
  const { user, getTenantCollection, getTenantDoc } = useUser();
  const [partners, setPartners] = useState([]);
  const [concludedSalesCount, setConcludedSalesCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', tipo: 'indicacao', telefone: '', email: '', pontos: 0 });

  const { t, currentTheme, isMobile, viewSettings } = useTheme();
  const [editingId, setEditingId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const TYPE_LABELS = {
    parceiro: 'Parceiro Padrão',
    indicacao: 'Indicação / Afiliado',
    estrategico: 'Estratégico / B2B',
    revenda: 'Revenda Autorizada',
    indicacao_alerta: 'Indicação Alerta'
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filterTipo, setFilterTipo] = useState('todos');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    if (!user) return;
    let activeSales = [];
    let legacySales = [];

    const updatePoints = () => {
      const counts = {};
      const allSales = [...activeSales, ...legacySales];
      allSales.forEach(s => {
        const status = String(s.status || '').toLowerCase().trim();
        if (['concluido', 'concluida', 'aprovada', 'concluída'].includes(status)) {
          const indicacaoClean = String(s.indicacao || s.partnerName || '').trim().toLowerCase();
          if (indicacaoClean) {
            counts[indicacaoClean] = (counts[indicacaoClean] || 0) + 1;
          }
        }
      });
      setConcludedSalesCount(counts);
    };

    const unsubSales = onSnapshot(getTenantCollection('sales'), (s) => {
      activeSales = s.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data() };
        return decryptActiveSale(raw);
      });
      updatePoints();
    }, err => {
      console.error("Erro ao escutar vendas:", err);
    });

    const unsubLegacy = onSnapshot(getTenantCollection('legacy'), (s) => {
      legacySales = s.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data(), isLegacy: true };
        return decryptLegacySale(raw);
      });
      updatePoints();
    }, err => {
      console.error("Erro ao escutar legado:", err);
    });

    return () => {
      unsubSales();
      unsubLegacy();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(getTenantCollection('partners'), orderBy('name')), (s) => {
      const decrypted = s.docs.map(doc => {
        const rawData = { id: doc.id, ...doc.data() };
        return decryptSensitiveFields(rawData, PARTNER_SENSITIVE_FIELDS);
      });
      setPartners(decrypted);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showModal]);

  const removeAccents = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredPartners = partners.filter(p => {
    const matchesSearch = removeAccents(p.name || '').includes(removeAccents(searchTerm)) ||
      removeAccents(p.email || '').includes(removeAccents(searchTerm));
    const matchesTipo = filterTipo === 'todos' || p.tipo === filterTipo;
    return matchesSearch && matchesTipo;
  });

  const paginatedPartners = itemsPerPage === 'all'
    ? filteredPartners
    : filteredPartners.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenModal = (partner = null) => {
    try {
      if (partner) {
        setEditingId(partner.id);
        setNewPartner({
          name: partner.name || '',
          tipo: partner.tipo || 'indicacao',
          telefone: partner.telefone || '',
          email: partner.email || '',
          pontos: concludedSalesCount[String(partner.name || '').trim().toLowerCase()] || 0,
          ...partner
        });
        setIsReadOnly(true);
      } else {
        setEditingId(null);
        setNewPartner({ name: '', tipo: 'indicacao', telefone: '', email: '', pontos: 0 });
        setIsReadOnly(false);
      }
      setShowModal(true);
    } catch (err) {
      console.error("Erro ao abrir modal:", err);
    }
  };

  const handlePhoneBlur = () => {
    const val = newPartner.telefone || '';
    if (!val) return;
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal.length < 10) return;
    const isDuplicate = partners.some(p => {
      const dbVal = (p.telefone || '').replace(/\D/g, '');
      return dbVal === cleanVal && p.id !== editingId;
    });
    if (isDuplicate) {
      alert(`Já existe um parceiro cadastrado com o telefone: ${val}`);
    }
  };

  const handleEmailBlur = () => {
    const val = newPartner.email || '';
    if (!val) return;
    const cleanVal = val.trim().toLowerCase();
    const isDuplicate = partners.some(p => {
      const dbVal = (p.email || '').trim().toLowerCase();
      return dbVal === cleanVal && p.id !== editingId;
    });
    if (isDuplicate) {
      alert(`Já existe um parceiro cadastrado com o e-mail: ${val}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    // Phone validation
    const phoneValue = newPartner.telefone || '';
    if (phoneValue) {
      const cleanPhone = phoneValue.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const isPhoneDuplicate = partners.some(p => {
          const dbPhone = (p.telefone || '').replace(/\D/g, '');
          return dbPhone === cleanPhone && p.id !== editingId;
        });
        if (isPhoneDuplicate) return alert(`Já existe um parceiro cadastrado com o telefone: ${phoneValue}`);
      }
    }

    // Email validation
    const emailValue = newPartner.email || '';
    if (emailValue) {
      const cleanEmail = emailValue.trim().toLowerCase();
      const isEmailDuplicate = partners.some(p => {
        const dbEmail = (p.email || '').trim().toLowerCase();
        return dbEmail === cleanEmail && p.id !== editingId;
      });
      if (isEmailDuplicate) return alert(`Já existe um parceiro cadastrado com o e-mail: ${emailValue}`);
    }

    setSaving(true);
    try {
      const encryptedPartner = encryptSensitiveFields(newPartner, PARTNER_SENSITIVE_FIELDS);
      if (editingId) {
        const { id, ...updateData } = encryptedPartner;
        await updateDoc(getTenantDoc('partners', editingId), {
          ...updateData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(getTenantCollection('partners'), {
          ...encryptedPartner,
          createdAt: new Date().toISOString()
        });
      }
      setShowModal(false);
      setNewPartner({ name: '', tipo: 'indicacao', telefone: '', email: '', pontos: 0 });
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar parceiro.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Excluir este parceiro permanentemente?')) {
      try {
        await deleteDoc(getTenantDoc('partners', id));
        setShowModal(false);
      } catch (err) {
        alert('Erro ao excluir parceiro.');
      }
    }
  };

  return (
    <div className="partners-page max-w-[1600px] mx-auto p-4">
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Group 1: Title & Count */}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Parceiros</h1>
          </div>

          {/* Group 2: Search & Filter */}
          <div style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', justifyContent: 'center', minWidth: '400px' }}>
            <div style={{ flex: 1, position: 'relative', maxWidth: '400px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={18} />
              <input
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 16px 0 45px',
                  backgroundColor: t.bgSecondary,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  color: t.textMain,
                  outline: 'none',
                  fontWeight: 600,
                  boxShadow: t.shadowSmall,
                  transition: 'all 0.2s'
                }}
                placeholder="Buscar parceiro..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{
                  height: '42px',
                  padding: '0 1.25rem',
                  border: t.borderBold,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: showFilterMenu ? t.accentSoft : t.bgSecondary,
                  color: showFilterMenu ? t.accent : t.textSecondary,
                  boxShadow: t.shadowSmall,
                  cursor: 'pointer',
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                <Filter size={18} /> {filterTipo === 'todos' ? 'Filtros' : `Tipo: ${TYPE_LABELS[filterTipo] || filterTipo}`}
              </button>

              <AnimatePresence>
                {showFilterMenu && (
                  <>
                    <div
                      onClick={() => setShowFilterMenu(false)}
                      style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 40,
                        backgroundColor: 'rgba(0,0,0,0)',
                        cursor: 'default'
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute', top: '50px', right: 0, width: '250px',
                        backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                        zIndex: 50, padding: '0.75rem', borderRadius: t.radiusSmall
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem', color: t.textSecondary, letterSpacing: '0.05em', paddingLeft: '0.5rem' }}>Tipo de Parceiro</div>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'todos', label: 'Todos os Tipos' },
                          { id: 'parceiro', label: 'Parceiro Padrão' },
                          { id: 'indicacao', label: 'Indicação / Afiliado' },
                          { id: 'estrategico', label: 'Estratégico / B2B' },
                          { id: 'revenda', label: 'Revenda Autorizada' },
                          { id: 'indicacao_alerta', label: 'Indicação Alerta' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setFilterTipo(opt.id); setShowFilterMenu(false); setCurrentPage(1); }}
                            style={{
                              padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                              border: 'none', cursor: 'pointer',
                              backgroundColor: filterTipo === opt.id ? t.accentSoft : 'transparent',
                              color: filterTipo === opt.id ? t.accent : t.textMain,
                              borderRadius: '8px', transition: 'all 0.2s'
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Group 3: Add Button */}
          <button
            onClick={() => handleOpenModal()}
            style={{
              backgroundColor: t.accent,
              color: t.accentContrast,
              padding: '0 1.5rem',
              height: '42px',
              fontWeight: 600,
              border: 'none',
              borderRadius: t.radiusSmall,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
              boxShadow: `0 4px 15px ${t.accent}33`
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${t.accent}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 15px ${t.accent}33`; }}
          >
            <Plus size={18} strokeWidth={3} /> Parceiro
          </button>
        </div>
      </header>

      <div className="content">
        {!loading && filteredPartners.length === 0 ? (
          <EmptyState
            title="Nenhum parceiro encontrado"
            description="Comece criando seu primeiro parceiro estratégico para expandir sua rede de negócios."
            icon={Handshake}
            color="#FFE600"
            onClick={() => handleOpenModal()}
          />
        ) : (
          <>
            {(viewSettings?.partners || 'grid') === 'list' ? (
              <div style={{ backgroundColor: t.bg, border: t.borderBold, borderRadius: t.radiusMedium, overflow: 'hidden', boxShadow: t.shadowSmall, marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
                      {['Parceiro', 'Tipo', 'WhatsApp', 'E-mail', 'Pontos'].map((h, i) => (
                        <th key={h} style={{
                          padding: '1rem 1.25rem', textAlign: i === 4 ? 'center' : 'left',
                          fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary,
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPartners.map((p) => {
                      const isLight = ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme);
                      const typeColors = {
                        parceiro:         { text: isLight ? '#1e40af' : '#93c5fd', border: isLight ? '#bfdbfe' : 'rgba(59,130,246,0.3)' },
                        indicacao:        { text: isLight ? '#166534' : '#86efac', border: isLight ? '#bbf7d0' : 'rgba(34,197,94,0.3)' },
                        estrategico:      { text: isLight ? '#6b21a8' : '#d8b4fe', border: isLight ? '#e9d5ff' : 'rgba(168,85,247,0.3)' },
                        revenda:          { text: isLight ? '#9a3412' : '#fdba74', border: isLight ? '#fed7aa' : 'rgba(249,115,22,0.3)' },
                        indicacao_alerta: { text: isLight ? '#9f1239' : '#fda4af', border: isLight ? '#fecdd3' : 'rgba(225,29,72,0.3)' }
                      };
                      const colors = typeColors[p.tipo] || typeColors.parceiro;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleOpenModal(p)}
                          style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: t.textMain, fontSize: '0.9rem' }}>
                            {p.name}
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                              color: colors.text, border: `1px solid ${colors.border}`,
                              padding: '2px 10px', borderRadius: '20px', letterSpacing: '0.05em'
                            }}>
                              {TYPE_LABELS[p.tipo] || p.tipo}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: t.textMain, fontWeight: 600 }}>
                            {p.telefone || '—'}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: t.textSecondary }}>
                            {p.email || '—'}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontSize: '0.9rem', color: '#f59e0b', fontWeight: 800 }}>
                            ★ {concludedSalesCount[String(p.name || '').trim().toLowerCase()] || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <AnimatePresence>
                  {paginatedPartners.map((p) => {
                  const isLight = ['clean', 'clear', 'beige', 'highContrastLight'].includes(currentTheme);
                  const typeColors = {
                    parceiro:         { bg: isLight ? '#eff6ff' : 'rgba(59,130,246,0.12)',  text: isLight ? '#1e40af' : '#93c5fd', border: isLight ? '#bfdbfe' : 'rgba(59,130,246,0.3)',  icon: isLight ? '#3b82f6' : '#60a5fa', iconComp: Handshake },
                    indicacao:        { bg: isLight ? '#f0fdf4' : 'rgba(34,197,94,0.12)',   text: isLight ? '#166534' : '#86efac', border: isLight ? '#bbf7d0' : 'rgba(34,197,94,0.3)',   icon: isLight ? '#22c55e' : '#4ade80', iconComp: UserPlus },
                    estrategico:      { bg: isLight ? '#faf5ff' : 'rgba(168,85,247,0.12)',  text: isLight ? '#6b21a8' : '#d8b4fe', border: isLight ? '#e9d5ff' : 'rgba(168,85,247,0.3)',  icon: isLight ? '#a855f7' : '#c084fc', iconComp: Briefcase },
                    revenda:          { bg: isLight ? '#fffaf0' : 'rgba(249,115,22,0.12)',  text: isLight ? '#9a3412' : '#fdba74', border: isLight ? '#fed7aa' : 'rgba(249,115,22,0.3)',  icon: isLight ? '#f97316' : '#fb923c', iconComp: Store },
                    indicacao_alerta: { bg: isLight ? '#fff1f2' : 'rgba(225,29,72,0.12)',   text: isLight ? '#9f1239' : '#fda4af', border: isLight ? '#fecdd3' : 'rgba(225,29,72,0.3)',   icon: isLight ? '#e11d48' : '#fb7185', iconComp: Zap }
                  };
                  const colors = typeColors[p.tipo] || typeColors.parceiro;
                  const points = concludedSalesCount[String(p.name || '').trim().toLowerCase()] || 0;

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -5, boxShadow: t.shadowHover, borderLeftColor: colors.icon }}
                      onClick={() => handleOpenModal(p)}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: t.bg || '#ffffff',
                        border: t.border || '1px solid #e2e8f0',
                        borderLeft: `4px solid ${colors.icon}`,
                        padding: '1.5rem',
                        boxShadow: t.shadow || '0 4px 6px -1px rgba(0,0,0,0.05)',
                        position: 'relative',
                        borderRadius: t.radiusInner || '12px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '12px',
                          backgroundColor: 'transparent', color: colors.icon,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${colors.border}`,
                          boxShadow: 'none'
                        }}>
                          <colors.iconComp size={22} />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                            color: colors.text, backgroundColor: 'transparent',
                            border: `1px solid ${colors.border}`,
                            padding: '0 12px', borderRadius: '20px', letterSpacing: '0.05em',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            height: '26px'
                          }}>
                            {TYPE_LABELS[p.tipo] || p.tipo}
                          </span>
                          {(points > 0 || p.tipo === 'indicacao') && (
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600, color: colors.text,
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px'
                            }}>
                              <span style={{ color: '#f59e0b' }}>★</span> {points} pontos
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: t.textMain, marginBottom: '0.5rem' }}>{p.name}</h3>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            )}

            <div style={{ marginTop: '2rem' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredPartners.length}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{
                width: isMobile ? '100%' : '600px',
                maxWidth: '100%',
                maxHeight: '95vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                border: t.border,
                boxShadow: t.shadowLarge,
                borderRadius: t.radius,
                backgroundColor: t.bg
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: t.border,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: t.bgSecondary,
                borderRadius: `${t.radius} ${t.radius} 0 0`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                    <Handshake size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      {editingId ? (isReadOnly ? 'Detalhes do Parceiro' : 'Editar Parceiro') : 'Novo Parceiro'}
                    </h3>
                  </div>
                </div>
                <motion.button
                  onClick={() => { setShowModal(false); setEditingId(null); setIsReadOnly(false); }}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Form Content */}
              <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, backgroundColor: t.bg }}>
                <form id="partnerForm" onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                    {/* Row 1: Name & Type */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">Nome Completo / Razão Social *</label>
                        <input
                          type="text"
                          required
                          disabled={isReadOnly}
                          value={newPartner.name}
                          onChange={e => setNewPartner({ ...newPartner, name: e.target.value.toUpperCase() })}
                          placeholder="EX: EMPRESA ESTRATÉGICA LTDA"
                          className="field-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="field-label">Tipo de Parceiro *</label>
                        <select
                          disabled={isReadOnly}
                          value={newPartner.tipo}
                          onChange={e => setNewPartner({ ...newPartner, tipo: e.target.value })}
                          className="field-select"
                        >
                          <option value="parceiro">Parceiro Padrão</option>
                          <option value="indicacao">Indicação / Afiliado</option>
                          <option value="estrategico">Estratégico / B2B</option>
                          <option value="revenda">Revenda Autorizada</option>
                          <option value="indicacao_alerta">Indicação Alerta</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Contact Details & Points */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 100px', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">E-mail de Contato</label>
                        <div style={{ position: 'relative' }}>
                          <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                          <input
                            disabled={isReadOnly}
                            type="email"
                            value={newPartner.email}
                            onChange={e => setNewPartner({ ...newPartner, email: e.target.value.toLowerCase() })}
                            onBlur={handleEmailBlur}
                            placeholder="email@parceiro.com"
                            className="field-input"
                            style={{ paddingLeft: '2.5rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="field-label">WhatsApp</label>
                        <div style={{ position: 'relative' }}>
                          <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                          <input
                            disabled={isReadOnly}
                            value={newPartner.telefone}
                            onChange={e => setNewPartner({ ...newPartner, telefone: maskPhone(e.target.value) })}
                            onBlur={handlePhoneBlur}
                            placeholder="(00) 00000-0000"
                            className="field-input"
                            style={{ paddingLeft: '2.5rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="field-label">Pontos</label>
                        <input
                          disabled={true}
                          type="number"
                          value={concludedSalesCount[String(newPartner.name || '').trim().toLowerCase()] || 0}
                          className="field-input"
                          style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}
                        />
                      </div>
                    </div>

                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderTop: t.border,
                backgroundColor: t.bgSecondary,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {isReadOnly && editingId ? (
                  <button
                    type="button"
                    onClick={() => setIsReadOnly(false)}
                    style={{
                      width: '100%',
                      height: '45px',
                      backgroundColor: t.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: `0 4px 12px ${t.accent}33`,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                  >
                    <Edit3 size={16} /> Editar Registro
                  </button>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: editingId ? 'row' : 'column', gap: '0.75rem', alignItems: 'stretch' }}>
                    {editingId && (
                      <button
                        type="button"
                        onClick={() => handleDelete(editingId)}
                        style={{
                          height: '45px',
                          flex: 1,
                          backgroundColor: '#fee2e2',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fecaca'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      >
                        <Trash2 size={16} /> Excluir Registro
                      </button>
                    )}

                    <button
                      form="partnerForm"
                      type="submit"
                      disabled={saving}
                      style={{
                        height: '45px',
                        width: editingId ? 'auto' : '100%',
                        flex: editingId ? 1 : 'none',
                        backgroundColor: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#16a34a'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(22, 197, 94, 0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22c55e'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)'; }}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      {editingId ? 'Salvar Alterações' : 'Cadastrar Parceiro'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Partners;
