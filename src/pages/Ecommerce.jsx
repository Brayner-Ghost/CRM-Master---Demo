import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  ShoppingBag, ShoppingCart, TrendingUp, Percent, DollarSign, 
  RefreshCw, Search, Filter, Calendar, ChevronRight, Plus, X, 
  Truck, CreditCard, ArrowUpRight, Activity, Package, Settings, 
  Database, Sparkles, CheckCircle2, MapPin, Eye, AlertCircle 
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

// ── Subcomponent: Order Detail Modal ──────────────────────────────────────
const OrderDetailModal = ({ order, onClose, onUpdateStatus }) => {
  const { t } = useTheme();
  const [trackingCode, setTrackingCode] = useState(order.trackingCode || '');
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus || 'Pendente');
  const [shippingStatus, setShippingStatus] = useState(order.shippingStatus || 'Preparando');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateStatus(order.id, {
        paymentStatus,
        shippingStatus,
        trackingCode
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        style={{
          backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radiusMedium,
          width: '90%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: t.shadowLarge, position: 'relative', display: 'flex', flexDirection: 'column',
          fontFamily: "var(--sans)"
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: `1px solid ${t.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', backgroundColor: t.accentSoft, color: t.accent }}>
                {order.source || 'E-commerce'}
              </span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: t.textMain, margin: 0 }}>
                Pedido #{order.id.slice(0, 8).toUpperCase()}
              </h2>
            </div>
            <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: '2px 0 0 0' }}>
              Realizado em {new Date(order.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary,
            padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.bgSecondary, fontFamily: 'inherit'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Customer & Address Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: t.radiusSmall, border: `1px solid ${t.border}` }}>
              <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Activity size={12} /> Cliente
              </h3>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textMain, margin: '0 0 4px 0' }}>{order.customerName}</p>
              <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: '0 0 2px 0' }}>{order.customerEmail}</p>
              <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0 }}>{order.customerPhone}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: t.radiusSmall, border: `1px solid ${t.border}` }}>
              <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <MapPin size={12} /> Endereço de Entrega
              </h3>
              {order.shippingAddress ? (
                <>
                  <p style={{ fontSize: '0.78rem', color: t.textMain, margin: '0 0 2px 0', fontWeight: 600 }}>
                    {order.shippingAddress.street}, {order.shippingAddress.number}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: '0 0 2px 0' }}>
                    {order.shippingAddress.neighborhood} - {order.shippingAddress.city}/{order.shippingAddress.uf}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: t.textSecondary, margin: 0 }}>
                    CEP: {order.shippingAddress.cep}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0 }}>Não informado.</p>
              )}
            </div>
          </div>

          {/* Product Items Table */}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radiusSmall, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: t.bgSecondary, borderBottom: `1px solid ${t.border}`, color: t.textSecondary, fontWeight: 700 }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem' }}>Produto</th>
                  <th style={{ textAlign: 'center', padding: '0.6rem 1rem' }}>Qtd</th>
                  <th style={{ textAlign: 'right', padding: '0.6rem 1rem' }}>Preço Unit.</th>
                  <th style={{ textAlign: 'right', padding: '0.6rem 1rem' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === order.items.length - 1 ? 'none' : `1px solid ${t.border}`, color: t.textMain }}>
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent }}>
                        <Package size={16} />
                      </div>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>R$ {item.price.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>R$ {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Total Row */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem',
              padding: '1rem', borderTop: `1px solid ${t.border}`, backgroundColor: t.bgSecondary
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.textSecondary }}>VALOR TOTAL:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: t.accent }}>R$ {order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Settings Section (Status & Logistics) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Status de Pagamento</label>
              <select 
                value={paymentStatus} 
                onChange={e => setPaymentStatus(e.target.value)} 
                style={{
                  height: 38, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.8rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none', cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="Pendente">🟡 Pendente</option>
                <option value="Aprovado">🟢 Aprovado / Pago</option>
                <option value="Cancelado">🔴 Cancelado</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Status da Logística</label>
              <select 
                value={shippingStatus} 
                onChange={e => setShippingStatus(e.target.value)} 
                style={{
                  height: 38, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.8rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none', cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="Preparando">📦 Preparando Embalagem</option>
                <option value="Despachado">🚚 Despachado / Em Trânsito</option>
                <option value="Entregue">✅ Entregue ao Cliente</option>
              </select>
            </div>
          </div>

          {/* Tracking Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Código de Rastreamento</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={trackingCode}
                onChange={e => setTrackingCode(e.target.value.toUpperCase())}
                placeholder="Ex: BR123456789BR"
                style={{
                  flex: 1, height: 38, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.8rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: `1px solid ${t.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: t.bgSecondary
        }}>
          <button onClick={onClose} style={{
            height: 38, padding: '0 1.25rem', border: `1px solid ${t.border}`, borderRadius: 8,
            fontSize: '0.8rem', fontWeight: 700, backgroundColor: t.bg, color: t.textMain, cursor: 'pointer',
            fontFamily: 'inherit'
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            height: 38, padding: '0 1.5rem', border: 'none', borderRadius: 8,
            fontSize: '0.8rem', fontWeight: 700, backgroundColor: t.accent, color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
            opacity: saving ? 0.7 : 1, fontFamily: 'inherit'
          }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Salvar Alterações
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Page Component ───────────────────────────────────────────────────
const Ecommerce = () => {
  const { user, getTenantCollection, getTenantDoc } = useUser();
  const { t, currentTheme } = useTheme();

  // State Management
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Sync Simulation States
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [platform, setPlatform] = useState('shopify');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [autoSyncPrice, setAutoSyncPrice] = useState(false);

  // SVG Chart Hover State
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Real-time Database Listener
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubOrders = onSnapshot(
      query(getTenantCollection('orders'), orderBy('createdAt', 'desc')),
      (snap) => {
        setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    const unsubContacts = onSnapshot(getTenantCollection('contacts'), snap => {
      setContacts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInventory = onSnapshot(getTenantCollection('inventory'), snap => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubOrders();
      unsubContacts();
      unsubInventory();
    };
  }, [user]);

  // Order Update handler
  const handleUpdateOrderStatus = async (orderId, updatedFields) => {
    alert("Modo de Demonstração: A atualização de pedidos do e-commerce está desabilitada.");
    return;
  };

  // Sync simulation handler
  const handleStartSync = () => {
    alert("Modo de Demonstração: A sincronização com lojas externas está desabilitada.");
    return;
  };

  // Simulated Order Creator
  const handleSimulateOrder = async () => {
    alert("Modo de Demonstração: A simulação de novos pedidos está desabilitada.");
    return;
  };

  // KPI Calculations
  const calculatedStats = () => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.paymentStatus === 'Aprovado' || o.paymentStatus === 'Pago');
    const revenue = paidOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const avgTicket = totalOrders > 0 ? revenue / paidOrders.length || revenue / totalOrders : 0;
    
    return {
      revenue,
      totalOrders,
      avgTicket,
      convRate: totalOrders > 0 ? 2.4 + (totalOrders * 0.1) : 2.4
    };
  };

  const stats = calculatedStats();

  // Weekly sales SVG line chart data builder
  const getLast7DaysData = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      const dateStr = d.toISOString().split('T')[0];
      days.push({ label, dateStr, total: 0, count: 0 });
    }

    orders.forEach(order => {
      if (!order.createdAt) return;
      const orderDateStr = order.createdAt.split('T')[0];
      const dayObj = days.find(d => d.dateStr === orderDateStr);
      if (dayObj) {
        if (order.paymentStatus === 'Aprovado' || order.paymentStatus === 'Pago') {
          dayObj.total += Number(order.total || 0);
        }
        dayObj.count += 1;
      }
    });

    return days;
  };

  const chartData = getLast7DaysData();
  const maxVal = Math.max(...chartData.map(d => d.total), 200);

  // SVG Chart configurations
  const width = 540;
  const height = 180;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = chartData.map((d, i) => {
    const x = paddingLeft + (i * (chartWidth / 6));
    const y = height - paddingBottom - ((d.total / maxVal) * chartHeight);
    return { x, y, ...d };
  });

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  let areaD = '';
  if (points.length > 0) {
    areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  }

  // Filtering orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || 
                          o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? o.paymentStatus === filterStatus || o.shippingStatus === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '1.5rem', color: t.textMain, backgroundColor: t.bgMain, minHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Demo Warning Banner */}
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        borderRadius: t.radiusSmall,
        padding: '0.875rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#ef4444',
        fontSize: '0.85rem',
        fontWeight: 600
      }}>
        <AlertCircle size={18} />
        <span>Modo de Demonstração: O simulador de pedidos, a sincronização de catálogos e a alteração de status/rastreamento de pedidos do e-commerce estão desabilitados.</span>
      </div>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: t.textMain, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag style={{ color: t.accent }} /> E-commerce Integrado
          </h1>
          <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: '2px 0 0 0' }}>
            Gerencie pedidos em tempo real, configure sincronizações de estoque e acompanhe a receita online.
          </p>
        </div>
        <button 
          disabled={true}
          onClick={handleSimulateOrder}
          style={{
            height: 38, padding: '0 1.25rem', border: `1px solid #cbd5e1`, borderRadius: 8,
            fontSize: '0.82rem', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#94a3b8',
            cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem',
            transition: t.transition
          }}
        >
          <Sparkles size={14} />
          Simular Pedido da Loja
        </button>
      </div>

      {/* ── KPI STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Metric 1 */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: t.shadowHover }}
          style={{
            padding: '1.25rem', backgroundColor: t.bgCard, borderRadius: t.radiusMedium, border: `1px solid ${t.border}`,
            boxShadow: t.shadowSmall, position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center'
          }}
        >
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <DollarSign size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Receita Loja Virtual</h4>
            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: t.textMain, margin: '4px 0 0 0' }}>R$ {stats.revenue.toFixed(2)}</p>
          </div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: t.shadowHover }}
          style={{
            padding: '1.25rem', backgroundColor: t.bgCard, borderRadius: t.radiusMedium, border: `1px solid ${t.border}`,
            boxShadow: t.shadowSmall, position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center'
          }}
        >
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <ShoppingCart size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Total de Pedidos</h4>
            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: t.textMain, margin: '4px 0 0 0' }}>{stats.totalOrders}</p>
          </div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: t.shadowHover }}
          style={{
            padding: '1.25rem', backgroundColor: t.bgCard, borderRadius: t.radiusMedium, border: `1px solid ${t.border}`,
            boxShadow: t.shadowSmall, position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center'
          }}
        >
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Ticket Médio</h4>
            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: t.textMain, margin: '4px 0 0 0' }}>R$ {stats.avgTicket.toFixed(2)}</p>
          </div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: t.shadowHover }}
          style={{
            padding: '1.25rem', backgroundColor: t.bgCard, borderRadius: t.radiusMedium, border: `1px solid ${t.border}`,
            boxShadow: t.shadowSmall, position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center'
          }}
        >
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <Percent size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Taxa de Conversão</h4>
            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: t.textMain, margin: '4px 0 0 0' }}>{stats.convRate.toFixed(1)}%</p>
          </div>
        </motion.div>
      </div>

      {/* ── CONTROL CENTER GRID (Chart + Sync Console) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* Weekly Chart Card */}
        <div style={{
          backgroundColor: t.bgCard, border: `1px solid ${t.border}`, borderRadius: t.radiusMedium,
          padding: '1.5rem', boxShadow: t.shadowSmall, display: 'flex', flexDirection: 'column', gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: t.textMain, margin: 0 }}>Vendas Semanais</h3>
              <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: '2px 0 0 0' }}>Faturamento diário nos últimos 7 dias</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: t.textSecondary, fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.accent }}></span>
              Pedidos Pagos
            </div>
          </div>

          {/* SVG line chart */}
          <div style={{ position: 'relative', width: '100%', height: `${height}px`, marginTop: '0.5rem' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.accent} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={t.accent} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map(idx => {
                const yVal = paddingTop + (idx * (chartHeight / 4));
                return (
                  <line 
                    key={idx} x1={paddingLeft} y1={yVal} x2={width - paddingRight} y2={yVal} 
                    stroke={t.border} strokeWidth="1" strokeDasharray="4,4" 
                  />
                );
              })}

              {/* Vertical helper grid lines */}
              {points.map((p, i) => (
                <line 
                  key={i} x1={p.x} y1={paddingTop} x2={p.x} y2={height - paddingBottom} 
                  stroke={t.border} strokeWidth="1" strokeOpacity="0.5" 
                />
              ))}

              {/* Area path */}
              {areaD && <path d={areaD} fill="url(#chart-area-grad)" />}

              {/* Line path */}
              {pathD && (
                <path 
                  d={pathD} fill="none" stroke={t.accent} strokeWidth="3" 
                  strokeLinecap="round" strokeLinejoin="round" 
                />
              )}

              {/* Intersecting Dots */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle 
                    cx={p.x} cy={p.y} r="5" fill={t.bg} stroke={t.accent} strokeWidth="2.5" 
                    style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}

              {/* X Axis Labels */}
              {points.map((p, i) => (
                <text 
                  key={i} x={p.x} y={height - 6} textAnchor="middle" 
                  fill={t.textSecondary} fontSize="9" fontWeight="800"
                >
                  {p.label}
                </text>
              ))}

              {/* Y Axis Labels */}
              {[0, 1, 2, 3, 4].map(idx => {
                const fraction = 1 - (idx / 4);
                const value = Math.round(maxVal * fraction);
                const yVal = paddingTop + (idx * (chartHeight / 4)) + 3;
                return (
                  <text 
                    key={idx} x={paddingLeft - 8} y={yVal} textAnchor="end" 
                    fill={t.textSecondary} fontSize="9" fontWeight="800"
                  >
                    R${value}
                  </text>
                );
              })}
            </svg>

            {/* Simulated Tooltip */}
            <AnimatePresence>
              {hoveredPoint && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                  style={{
                    position: 'absolute', left: `${(hoveredPoint.x / width) * 100}%`, top: `${(hoveredPoint.y / height) * 100 - 45}%`,
                    transform: 'translateX(-50%)', backgroundColor: t.textMain, color: t.bg,
                    padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800,
                    pointerEvents: 'none', boxShadow: t.shadowLarge, zIndex: 10, whiteSpace: 'nowrap'
                  }}
                >
                  R$ {hoveredPoint.total.toFixed(2)} ({hoveredPoint.count} ped.)
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Catalog Sync Card */}
        <div style={{
          backgroundColor: t.bgCard, border: `1px solid ${t.border}`, borderRadius: t.radiusMedium,
          padding: '1.5rem', boxShadow: t.shadowSmall, display: 'flex', flexDirection: 'column', gap: '1rem'
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: t.textMain, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} style={{ color: t.accent }} /> Sincronização de Catálogo
            </h3>
            <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: '2px 0 0 0' }}>Conecte e atualize estoque com lojas externas</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
            
            {/* Platform Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.62rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Canal de Venda</label>
              <select 
                value={platform} 
                onChange={e => setPlatform(e.target.value)} 
                disabled={syncing}
                style={{
                  height: 36, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.78rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none', cursor: syncing ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="shopify">Shopify Store</option>
                <option value="woocommerce">WooCommerce Store</option>
                <option value="mercadolivre">Mercado Livre API</option>
              </select>
            </div>

            {/* Toggle Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.2rem' }}>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.78rem', color: t.textMain, cursor: syncing ? 'not-allowed' : 'pointer'
              }}>
                <span>Sincronizar estoque automaticamente</span>
                <input 
                  type="checkbox" 
                  checked={autoSyncStock} 
                  onChange={e => setAutoSyncStock(e.target.checked)} 
                  disabled={syncing}
                />
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.78rem', color: t.textMain, cursor: syncing ? 'not-allowed' : 'pointer'
              }}>
                <span>Sincronizar alteração de preços</span>
                <input 
                  type="checkbox" 
                  checked={autoSyncPrice} 
                  onChange={e => setAutoSyncPrice(e.target.checked)} 
                  disabled={syncing}
                />
              </label>
            </div>

            {/* Sync Progress Bar or Status */}
            {syncing && (
              <div style={{
                padding: '0.75rem', backgroundColor: t.bgSecondary, borderRadius: 8,
                border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary }}>
                  <span>Sincronizando...</span>
                  <RefreshCw size={12} className="animate-spin" style={{ color: t.accent }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: t.textMain, fontWeight: 600 }}>{syncStep}</div>
                <div style={{ width: '100%', height: '4px', backgroundColor: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.2 }}
                    style={{ height: '100%', backgroundColor: t.accent }}
                  />
                </div>
              </div>
            )}

            {!syncing && (
              <div style={{ fontSize: '0.7rem', color: t.textSecondary, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto' }}>
                <CheckCircle2 size={12} style={{ color: t.success }} />
                Última sincronização feita hoje às 20:11 (UTC-3)
              </div>
            )}

            {/* Action Sync Button */}
            <button
               onClick={handleStartSync}
               disabled={true}
               style={{
                 height: 38, border: 'none', borderRadius: 8,
                 backgroundColor: '#cbd5e1',
                 color: '#94a3b8',
                 fontSize: '0.8rem', fontWeight: 800, cursor: 'not-allowed',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                 transition: t.transition,
                 marginTop: 'auto'
               }}
             >
               <RefreshCw size={14} />
               Sincronizar Agora
             </button>

          </div>
        </div>
      </div>

      {/* ── ORDERS LIST SECTION ── */}
      <div style={{
        backgroundColor: t.bgCard, border: `1px solid ${t.border}`, borderRadius: t.radiusMedium,
        padding: '1.5rem', boxShadow: t.shadowSmall, display: 'flex', flexDirection: 'column', gap: '1rem'
      }}>
        
        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: t.textMain, margin: 0 }}>Pedidos Recentes</h3>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente ou ID..."
                style={{
                  height: 34, padding: '0 10px 0 30px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.78rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none', width: '200px'
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Filter size={14} style={{ color: t.textSecondary }} />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  height: 34, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: '0.78rem', backgroundColor: t.bgSecondary, color: t.textMain, outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="">Todos os status</option>
                <option value="Aprovado">Pago / Aprovado</option>
                <option value="Pendente">Pendente</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Preparando">Preparando</option>
                <option value="Despachado">Despachado</option>
                <option value="Entregue">Entregue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${t.border}`, color: t.textSecondary, fontWeight: 700 }}>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>ID Pedido</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Canal</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Cliente</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Data</th>
                <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Total</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>Pagamento</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>Logística</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr 
                  key={order.id} 
                  style={{ borderBottom: `1px solid ${t.border}`, color: t.textMain }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>
                    #{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem' }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 4,
                      backgroundColor: order.source === 'Shopify' ? '#e1f5fe' : order.source === 'WooCommerce' ? '#efebe9' : '#fbe9e7',
                      color: order.source === 'Shopify' ? '#0288d1' : order.source === 'WooCommerce' ? '#5d4037' : '#d84315'
                    }}>
                      {order.source || 'Shopify'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', fontWeight: 600 }}>
                    {order.customerName}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', color: t.textSecondary }}>
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : ''}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 750 }}>
                    R$ {order.total.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                      backgroundColor: (order.paymentStatus === 'Aprovado' || order.paymentStatus === 'Pago') ? t.successSoft : order.paymentStatus === 'Cancelado' ? t.dangerSoft : 'rgba(234, 179, 8, 0.12)',
                      color: (order.paymentStatus === 'Aprovado' || order.paymentStatus === 'Pago') ? t.success : order.paymentStatus === 'Cancelado' ? t.danger : '#b45309'
                    }}>
                      {order.paymentStatus === 'Aprovado' || order.paymentStatus === 'Pago' ? 'Pago' : order.paymentStatus}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      backgroundColor: order.shippingStatus === 'Entregue' ? t.successSoft : order.shippingStatus === 'Despachado' ? 'rgba(59, 130, 246, 0.12)' : t.accentSoft,
                      color: order.shippingStatus === 'Entregue' ? t.success : order.shippingStatus === 'Despachado' ? '#1d4ed8' : t.accent
                    }}>
                      {order.shippingStatus === 'Entregue' && <CheckCircle2 size={10} />}
                      {order.shippingStatus === 'Despachado' && <Truck size={10} />}
                      {order.shippingStatus || 'Preparando'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      style={{
                        padding: '4px 10px', border: `1px solid ${t.border}`, borderRadius: 6,
                        backgroundColor: t.bg, color: t.textMain, fontSize: '0.72rem', fontWeight: 700,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        transition: t.transition
                      }}
                      className="hover-scale"
                    >
                      <Eye size={12} />
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 0', color: t.textSecondary }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={24} style={{ color: t.textSecondary }} />
                      <span>Nenhum pedido de e-commerce encontrado.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DETAIL MODAL OVERLAY ── */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal 
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ecommerce;
