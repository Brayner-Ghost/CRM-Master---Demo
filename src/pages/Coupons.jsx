import React, { useState, useEffect } from 'react';
import { addDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { Plus, Search, Filter, Trash2, X, Ticket, Calendar, UserCheck, Hash, Check, Loader2, Edit3, Tag, CreditCard, AlertCircle } from 'lucide-react';
import { maskPercentOnly, maskMoneyOnly } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';

import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const Coupons = () => {
  const { user, getTenantCollection, getTenantDoc } = useUser();
  const { currentTheme, t, isMobile, density, viewSettings } = useTheme();
  const rawScale = density / 100;
  const modalScale = isMobile ? 1 : rawScale;

  const [coupons, setCoupons] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    codigo: '', valor: 0, discount: '', tipo: 'porcentagem',
    dataInicio: '', dataFim: '', eIndicacao: false, parceiroId: '',
    limiteUsos: '', apenasPrimeiraCompra: false, ativo: true,
    valorMinimo: 0, discountMinimo: '', restricoesPagamento: {}
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal]);

  useEffect(() => {
    if (!user) return;
    const unsubCoupons = onSnapshot(query(getTenantCollection('coupons'), orderBy('codigo')), (s) => {
      setCoupons(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    const unsubPartners = onSnapshot(getTenantCollection('partners'), (s) =>
      setPartners(s.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    return () => { unsubCoupons(); unsubPartners(); };
  }, [user]);

  const removeAccents = (str) => {
    return str?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || '';
  };

  const filteredCoupons = coupons.filter(c => {
    const matchesSearch = removeAccents(c.codigo).includes(removeAccents(searchTerm)) ||
      removeAccents(partners.find(p => p.id === c.parceiroId)?.name || '').includes(removeAccents(searchTerm));
    const matchesTipo = filterTipo === 'todos' || c.tipo === filterTipo;
    const matchesStatus = filterStatus === 'todos' || (filterStatus === 'ativo' ? c.ativo !== false : c.ativo === false);
    return matchesSearch && matchesTipo && matchesStatus;
  });

  const paginatedCoupons = itemsPerPage === 'all'
    ? filteredCoupons
    : filteredCoupons.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [saving, setSaving] = useState(false);

  const handleOpenModal = (coupon = null) => {
    try {
      if (coupon) {
        setEditingId(coupon.id);

        let displayDiscount = '';
        if (coupon.discount) {
          displayDiscount = coupon.discount;
        } else if (coupon.tipo === 'porcentagem') {
          displayDiscount = `${coupon.valor || 0}%`;
        } else {
          displayDiscount = `R$ ${coupon.valor || 0}`;
        }

        setNewCoupon({
          codigo: coupon.codigo || '',
          valor: coupon.valor || 0,
          discount: displayDiscount,
          tipo: coupon.tipo || 'porcentagem',
          dataInicio: coupon.dataInicio || '',
          dataFim: coupon.dataFim || '',
          eIndicacao: coupon.eIndicacao || false,
          parceiroId: coupon.parceiroId || '',
          limiteUsos: coupon.limiteUsos || '',
          apenasPrimeiraCompra: coupon.apenasPrimeiraCompra || false,
          ativo: coupon.ativo !== false,
          valorMinimo: coupon.valorMinimo || 0,
          discountMinimo: coupon.valorMinimo ? `R$ ${coupon.valorMinimo}` : '',
          restricoesPagamento: coupon.restricoesPagamento || {}
        });
        setIsReadOnly(true);
      } else {
        setEditingId(null);
        setNewCoupon({
          codigo: '', valor: 0, discount: '', tipo: 'porcentagem',
          dataInicio: '', dataFim: '', eIndicacao: false, parceiroId: '',
          limiteUsos: '', apenasPrimeiraCompra: false, ativo: true,
          valorMinimo: 0, discountMinimo: '',
          restricoesPagamento: {}
        });
        setIsReadOnly(true); // Always read-only in demo mode!
      }
      setShowModal(true);
    } catch (err) {
      console.error("Erro ao abrir modal de cupom:", err);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    alert('Modo de Demonstração: A criação e edição de cupons/promoções estão desabilitadas.');
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    alert('Modo de Demonstração: A exclusão de cupons/promoções está desabilitada.');
  };

  return (
    <div className="coupons-page max-w-[1600px] mx-auto p-4">
      {/* Demo Warning Banner */}
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        borderRadius: t.radiusSmall,
        padding: '0.875rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#ef4444',
        fontSize: '0.85rem',
        fontWeight: 600
      }}>
        <AlertCircle size={18} />
        <span>Modo de Demonstração: A criação, edição e exclusão de cupons estão desabilitadas.</span>
      </div>

      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Group 1: Title & Count */}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Cupons</h1>
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
                placeholder="Buscar cupom..."
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
                <Filter size={18} /> Filtros {(filterTipo !== 'todos' || filterStatus !== 'todos') && '(Ativo)'}
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
                        position: 'absolute', top: '50px', right: 0, width: '280px',
                        backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                        zIndex: 50, padding: '1.5rem', borderRadius: t.radiusSmall
                      }}
                    >
                      <div className="space-y-6">
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem', color: t.textSecondary, letterSpacing: '0.5px' }}>Tipo de Desconto</div>
                          <div className="flex flex-col gap-1">
                            {['todos', 'porcentagem', 'fixo'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => { setFilterTipo(opt); setCurrentPage(1); }}
                                style={{
                                  padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                                  border: 'none', cursor: 'pointer',
                                  backgroundColor: filterTipo === opt ? t.accentSoft : 'transparent',
                                  color: filterTipo === opt ? t.accent : t.textMain,
                                  borderRadius: '8px', transition: 'all 0.2s'
                                }}
                              >
                                {opt === 'todos' ? 'Todos os Tipos' : (opt === 'porcentagem' ? 'Porcentagem (%)' : 'Valor Fixo (R$)')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem', color: t.textSecondary, letterSpacing: '0.5px' }}>Status</div>
                          <div className="flex flex-col gap-1">
                            {['todos', 'ativo', 'inativo'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => { setFilterStatus(opt); setCurrentPage(1); }}
                                style={{
                                  padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                                  border: 'none', cursor: 'pointer',
                                  backgroundColor: filterStatus === opt ? t.accentSoft : 'transparent',
                                  color: filterStatus === opt ? t.accent : t.textMain,
                                  borderRadius: '8px', transition: 'all 0.2s'
                                }}
                              >
                                {opt === 'todos' ? 'Todos os Status' : (opt === 'ativo' ? 'Apenas Ativos' : 'Apenas Inativos')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Group 3: Add Button (Disabled in Demo Mode) */}
          <button
            disabled={true}
            style={{
              backgroundColor: '#cbd5e1',
              color: '#94a3b8',
              padding: '0 1.5rem',
              height: '42px',
              fontWeight: 600,
              border: 'none',
              borderRadius: t.radiusSmall,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <Plus size={18} strokeWidth={3} /> Cupom
          </button>
        </div>
      </header>

      <div className="content">
        {!loading && filteredCoupons.length === 0 ? (
          <EmptyState
            title="Nenhum cupom ativo"
            description="Crie seu primeiro cupom de desconto para impulsionar suas vendas e fidelizar clientes."
            icon={Tag}
            color={t.accent}
            onClick={() => handleOpenModal()}
          />
        ) : (
          <>
            {(viewSettings?.coupons || 'grid') === 'list' ? (
              <div style={{ backgroundColor: t.bg, border: t.borderBold, borderRadius: t.radiusMedium, overflow: 'hidden', boxShadow: t.shadowSmall, marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
                      {['Código', 'Desconto', 'Tipo', 'Parceiro', 'Validade', 'Usos', 'Status'].map((h, i) => (
                        <th key={h} style={{
                          padding: '1rem 1.25rem', textAlign: i === 5 || i === 6 ? 'center' : 'left',
                          fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary,
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCoupons.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => handleOpenModal(c)}
                        style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', opacity: c.ativo === false ? 0.6 : 1, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: t.textMain, fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          {c.codigo}
                          {c.apenasPrimeiraCompra && (
                            <span style={{
                              fontSize: '0.6rem', backgroundColor: t.accentSoft, color: t.accent,
                              padding: '2px 6px', borderRadius: '4px', fontWeight: 600, marginLeft: '8px'
                            }}>
                              1ª Compra
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: t.accent, fontSize: '0.95rem' }}>
                          {c.tipo === 'porcentagem' ? (c.discount || `${c.valor}%`) : `R$ ${c.valor}`}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: t.textSecondary, fontWeight: 600 }}>
                          {c.tipo === 'porcentagem' ? 'Porcentagem' : 'Valor Fixo'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: t.textMain, fontWeight: 600 }}>
                          {partners.find(p => p.id === c.parceiroId)?.name || 'Campanha Geral'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: t.textSecondary }}>
                          {c.dataFim ? new Date(c.dataFim).toLocaleDateString('pt-BR') : 'Sem expiração'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontSize: '0.85rem', color: t.textMain, fontWeight: 600 }}>
                          {c.usos || 0} / {c.limiteUsos || '∞'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                            padding: '3px 8px', borderRadius: '20px',
                            backgroundColor: c.ativo !== false ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: c.ativo !== false ? '#10b981' : '#ef4444',
                            border: `1px solid ${c.ativo !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            {c.ativo !== false ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '1.5rem',
                padding: '0.5rem'
              }}>
                <AnimatePresence>
                  {paginatedCoupons.map((c) => (
                    <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -5, boxShadow: currentTheme === 'dark' ? '0 20px 25px -5px rgba(0, 0, 0, 0.4)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    onClick={() => handleOpenModal(c)}
                    className="cursor-pointer"
                    style={{
                      backgroundColor: t.bg,
                      border: t.border,
                      padding: '0',
                      boxShadow: t.shadow,
                      position: 'relative',
                      borderRadius: t.radiusSmall,
                      opacity: c.ativo === false ? 0.6 : 1,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Top Decorative Bar */}
                    <div style={{ height: '6px', background: c.ativo !== false ? t.accent : t.danger }} />

                    <div style={{ padding: '1.5rem', position: 'relative' }}>
                      {/* Ticket Cut-outs (Decorative) */}
                      <div style={{ position: 'absolute', left: '-10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', borderRadius: '50%', background: t.bgSecondary, borderRight: t.border }} />
                      <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', borderRadius: '50%', background: t.bgSecondary, borderLeft: t.border }} />

                      <div className="flex justify-between items-start mb-4">
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '12px',
                          backgroundColor: c.ativo !== false ? `${t.accent}10` : `${t.danger}10`,
                          color: c.ativo !== false ? t.accent : t.danger,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${c.ativo !== false ? `${t.accent}20` : `${t.danger}20`}`
                        }}>
                          <Ticket size={22} />
                        </div>
                        <div style={{
                          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                          color: c.ativo !== false ? t.success : t.danger,
                          backgroundColor: c.ativo !== false ? `${t.success}10` : `${t.danger}10`,
                          padding: '0 12px', borderRadius: '30px', letterSpacing: '0.05em',
                          border: `1px solid ${c.ativo !== false ? `${t.success}20` : `${t.danger}20`}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: '24px', minWidth: '75px'
                        }}>
                          {c.ativo !== false ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: t.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                          }}>
                            Código Promocional
                          </div>
                          {c.apenasPrimeiraCompra && (
                            <span style={{
                              fontSize: '0.6rem', backgroundColor: t.accentSoft, color: t.accent,
                              padding: '2px 6px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase'
                            }}>
                              1ª COMPRA
                            </span>
                          )}
                        </div>
                        <h3 style={{
                          fontSize: '1.5rem',
                          fontWeight: 600,
                          color: t.textMain,
                          margin: 0,
                          letterSpacing: '-0.03em',
                          fontFamily: 'monospace'
                        }}>
                          {c.codigo}
                        </h3>
                      </div>

                      <div style={{
                        borderTop: `1px dashed ${currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                        margin: '1rem 0',
                        position: 'relative'
                      }}>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.5rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: t.accent, lineHeight: 1 }}>
                            {c.tipo === 'porcentagem' ? (c.discount || `${c.valor}%`) : `R$ ${c.valor}`}
                          </div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary, marginTop: '4px', textTransform: 'uppercase' }}>
                            {c.tipo === 'porcentagem' ? 'Desconto no Total' : 'Valor Fixo'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: t.textMain }}>
                            {partners.find(p => p.id === c.parceiroId)?.name || 'Geral'}
                          </div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary }}>
                            {c.parceiroId ? 'Parceiro' : 'Campanha'}
                          </div>
                        </div>
                      </div>

                      {c.restricoesPagamento && Object.keys(c.restricoesPagamento).length > 0 && (
                        <div style={{
                          marginTop: '1rem', padding: '0.5rem', backgroundColor: t.bgSecondary,
                          borderRadius: '8px', border: t.border
                        }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: t.textSecondary, marginBottom: '4px', textTransform: 'uppercase' }}>
                            Regras por Pagamento:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {Object.entries(c.restricoesPagamento).map(([method, data]) => (
                              <span key={method} style={{
                                fontSize: '0.6rem', fontWeight: 600, backgroundColor: t.bg,
                                border: t.border, padding: '1px 5px', borderRadius: '4px'
                              }}>
                                {method.toUpperCase()}: {data.discount}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Info Strip */}
                    <div style={{
                      backgroundColor: t.bgSecondary,
                      padding: '0.75rem 1.5rem',
                      borderTop: t.border,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      fontSize: '0.75rem',
                      color: t.textSecondary,
                      fontWeight: 600
                    }}>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {c.dataFim ? new Date(c.dataFim).toLocaleDateString('pt-BR') : 'Sem expiração'}
                      </div>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                      <div className="flex items-center gap-1">
                        <UserCheck size={14} />
                        {c.usos || 0}/{c.limiteUsos || '∞'} usos
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            )}

            <div style={{ marginTop: '3rem' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredCoupons.length}
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
            onClick={() => { setShowModal(false); setEditingId(null); setIsReadOnly(false); }}
          >
            <motion.div
              initial={{ scale: modalScale * 0.9, opacity: 0, y: 20 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.9, opacity: 0, y: 20 }}
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
                    <Ticket size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      {editingId ? (isReadOnly ? 'Detalhes do Cupom' : 'Editar Cupom') : 'Novo Cupom'}
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
                <form id="couponForm" onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                    {/* Row 1: Code */}
                    <div className="form-group">
                      <label className="field-label">Código do Cupom *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={newCoupon.codigo}
                        onChange={e => setNewCoupon({ ...newCoupon, codigo: e.target.value.toUpperCase() })}
                        placeholder="Ex: NATAL2024"
                        className="field-input"
                        style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}
                      />
                    </div>

                    {/* Row 2: Dates */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">Data de Início</label>
                        <input
                          type="date"
                          disabled={isReadOnly}
                          value={newCoupon.dataInicio}
                          onChange={e => setNewCoupon({ ...newCoupon, dataInicio: e.target.value })}
                          className="field-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Data de Expiração</label>
                        <input
                          type="date"
                          disabled={isReadOnly}
                          value={newCoupon.dataFim}
                          onChange={e => setNewCoupon({ ...newCoupon, dataFim: e.target.value })}
                          className="field-input"
                        />
                      </div>
                    </div>

                    {/* Row 3: Discount Type, Value, Minimum Value */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">Tipo de Desconto</label>
                        <select
                          disabled={isReadOnly}
                          value={newCoupon.tipo}
                          onChange={e => setNewCoupon({ ...newCoupon, tipo: e.target.value, discount: '' })}
                          className="field-select"
                        >
                          <option value="porcentagem">Porcentagem (%)</option>
                          <option value="fixo">Valor Fixo (R$)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="field-label">Valor do Desconto *</label>
                        <input
                          required
                          disabled={isReadOnly}
                          value={newCoupon.discount}
                          onChange={e => setNewCoupon({
                            ...newCoupon,
                            discount: newCoupon.tipo === 'porcentagem' ? maskPercentOnly(e.target.value) : maskMoneyOnly(e.target.value)
                          })}
                          placeholder={newCoupon.tipo === 'porcentagem' ? '0%' : 'R$ 0,00'}
                          className="field-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Valor Mínimo Compra</label>
                        <input
                          disabled={isReadOnly}
                          value={newCoupon.discountMinimo}
                          onChange={e => setNewCoupon({
                            ...newCoupon,
                            discountMinimo: maskMoneyOnly(e.target.value)
                          })}
                          placeholder="R$ 0,00"
                          className="field-input"
                        />
                      </div>
                    </div>

                    {/* Row 4: First purchase only, status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">Apenas Primeira Compra?</label>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => setNewCoupon({ ...newCoupon, apenasPrimeiraCompra: !newCoupon.apenasPrimeiraCompra })}
                          className="field-input"
                          style={{
                            fontWeight: 600,
                            backgroundColor: newCoupon.apenasPrimeiraCompra ? t.accentSoft : 'transparent',
                            color: newCoupon.apenasPrimeiraCompra ? t.accent : t.textSecondary,
                            cursor: isReadOnly ? 'default' : 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.backgroundColor = newCoupon.apenasPrimeiraCompra ? `${t.accent}25` : (currentTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)');
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.backgroundColor = newCoupon.apenasPrimeiraCompra ? t.accentSoft : 'transparent';
                              e.currentTarget.style.transform = 'none';
                            }
                          }}
                        >
                          {newCoupon.apenasPrimeiraCompra ? 'SIM' : 'NÃO'}
                        </button>
                      </div>
                      <div className="form-group">
                        <label className="field-label">Status do Cupom</label>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => setNewCoupon({ ...newCoupon, ativo: !newCoupon.ativo })}
                          className="field-input"
                          style={{
                            fontWeight: 600,
                            backgroundColor: newCoupon.ativo
                              ? (currentTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#f0fdf4')
                              : (currentTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'),
                            color: newCoupon.ativo ? '#10b981' : '#ef4444',
                            border: 'none',
                            cursor: isReadOnly ? 'default' : 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.backgroundColor = newCoupon.ativo
                                ? (currentTheme === 'dark' ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7')
                                : (currentTheme === 'dark' ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2');
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.backgroundColor = newCoupon.ativo
                                ? (currentTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#f0fdf4')
                                : (currentTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2');
                              e.currentTarget.style.transform = 'none';
                            }
                          }}
                        >
                          {newCoupon.ativo ? 'Cupom Ativo' : 'Cupom Inativo'}
                        </button>
                      </div>
                    </div>

                    {/* Row 5: Limit uses, partner link */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">
                          Cota (Limite de Usos) {editingId && <span style={{ color: t.accent }}>— {newCoupon.usos || 0} já usados</span>}
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Hash size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                          <input
                            type="number"
                            disabled={isReadOnly}
                            value={newCoupon.limiteUsos}
                            onChange={e => setNewCoupon({ ...newCoupon, limiteUsos: e.target.value })}
                            placeholder="Ex: 100"
                            className="field-input"
                            style={{ paddingLeft: '2.5rem' }}
                          />
                        </div>
                        <p style={{ fontSize: '0.65rem', color: t.textSecondary, marginTop: '4px', fontWeight: 600 }}>
                          Vazio para uso ilimitado. O cupom expira ao atingir a cota.
                        </p>
                      </div>
                      <div className="form-group">
                        <label className="field-label">Vincular a Parceiro</label>
                        <select
                          disabled={isReadOnly}
                          value={newCoupon.parceiroId}
                          onChange={e => setNewCoupon({ ...newCoupon, parceiroId: e.target.value })}
                          className="field-select"
                        >
                          <option value="">CAMPANHA GERAL (SEM PARCEIRO)</option>
                          {partners.map(p => <option key={p.id} value={p.id}>{p.name?.toUpperCase() || 'SEM NOME'}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Payment Restriction Box */}
                    <div style={{
                      padding: '1.25rem',
                      backgroundColor: t.bg,
                      borderRadius: '16px',
                      border: t.border,
                      marginTop: '0.5rem',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                      transition: 'all 0.3s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <CreditCard size={18} style={{ color: t.accent }} />
                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: t.textMain }}>Regras por Forma de Pagamento</h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="field-label">Forma de Pagamento</label>
                          <select
                            id="new-restriction-method"
                            disabled={isReadOnly}
                            className="field-select"
                          >
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">Pix</option>
                            <option value="credito">Cartão de Crédito</option>
                            <option value="debito">Cartão de Débito</option>
                            <option value="alimentacao">Vale Alimentação</option>
                            <option value="refeicao">Vale Refeição</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="field-label">Valor do Desconto</label>
                          <input
                            id="new-restriction-value"
                            disabled={isReadOnly}
                            placeholder={newCoupon.tipo === 'porcentagem' ? '0%' : 'R$ 0,00'}
                            onKeyUp={(e) => {
                              if (newCoupon.tipo === 'porcentagem') e.target.value = maskPercentOnly(e.target.value);
                              else e.target.value = maskMoneyOnly(e.target.value);
                            }}
                            className="field-input"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => {
                            const m = document.getElementById('new-restriction-method').value;
                            let vStr = document.getElementById('new-restriction-value').value;
                            if (!vStr) return;

                            if (newCoupon.tipo === 'porcentagem') vStr = maskPercentOnly(vStr);
                            else vStr = maskMoneyOnly(vStr);

                            let val = 0;
                            if (newCoupon.tipo === 'porcentagem') {
                              val = parseInt(vStr.replace(/\D/g, ''));
                            } else {
                              val = parseInt(vStr.replace(/\D/g, '')) / 100;
                            }

                            setNewCoupon({
                              ...newCoupon,
                              restricoesPagamento: {
                                ...newCoupon.restricoesPagamento,
                                [m]: { valor: val, discount: vStr }
                              }
                            });
                            document.getElementById('new-restriction-value').value = '';
                          }}
                          style={{
                            height: '40px',
                            padding: '0 1.25rem',
                            backgroundColor: isReadOnly ? t.bgSecondary : t.accent,
                            color: isReadOnly ? t.textSecondary : '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            cursor: isReadOnly ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: isReadOnly ? 'none' : `0 4px 12px ${t.accent}33`,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.filter = 'brightness(1.1)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = `0 6px 16px ${t.accent}44`;
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isReadOnly) {
                              e.currentTarget.style.filter = 'none';
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = `0 4px 12px ${t.accent}33`;
                            }
                          }}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                          Adicionar
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(newCoupon.restricoesPagamento || {}).map(([method, data]) => (
                          <div key={method} style={{
                            padding: '6px 12px',
                            backgroundColor: t.accentSoft,
                            border: `1.5px solid ${t.accent}20`,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                            transition: 'all 0.2s'
                          }}>
                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: t.accent, textTransform: 'uppercase' }}>
                              {method === 'credito' ? 'CRÉDITO' : method === 'debito' ? 'DÉBITO' : method.toUpperCase()}:
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: t.textMain }}>
                              {newCoupon.tipo === 'porcentagem'
                                ? (data.discount.includes('%') ? data.discount : `${data.discount}%`)
                                : (data.discount.includes('R$') ? data.discount : `R$ ${data.discount}`)
                              }
                            </span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...newCoupon.restricoesPagamento };
                                  delete updated[method];
                                  setNewCoupon({ ...newCoupon, restricoesPagamento: updated });
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                  borderRadius: '50%',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                        {Object.keys(newCoupon.restricoesPagamento || {}).length === 0 && (
                          <p style={{ fontSize: '0.75rem', color: t.textSecondary, fontStyle: 'italic', margin: 0 }}>
                            Nenhuma regra configurada. O cupom usará o valor base para todas as formas de pagamento.
                          </p>
                        )}
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
                    onClick={() => alert('Modo de Demonstração: A edição de cupons está desabilitada.')}
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
                      form="couponForm"
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
                      {editingId ? 'Salvar Alterações' : 'Criar Novo Cupom'}
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

export default Coupons;
