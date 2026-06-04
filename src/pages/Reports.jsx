import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Edit3, Check, X,
  BarChart3, PieChart, Target, Zap, AlertCircle, Calendar, Tag,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp,
  Users, ShoppingCart, Activity, Loader2, BarChart2, Layers,
  CreditCard, Wallet, Receipt, RefreshCw, Save, Sliders,
  Percent, Calculator, FileSpreadsheet
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, updateDoc, getDocs
} from 'firebase/firestore';
import { decryptLegacySale, decryptActiveSale } from '../utils/crypto';
import * as XLSX from 'xlsx';

const parseFlexibleDate = (val) => {
  if (!val) return new Date(0);
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date(0) : val;
  if (typeof val === 'string' && val.trim()) {
    const str = val.trim();
    if (str.includes('/')) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = dateParts[2].length === 2 ? 2000 + parseInt(dateParts[2], 10) : parseInt(dateParts[2], 10);
        
        let hours = 12, minutes = 0, seconds = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0], 10) || 12;
          minutes = parseInt(timeParts[1], 10) || 0;
          seconds = parseInt(timeParts[2], 10) || 0;
        }
        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  const num = Number(val);
  if (!isNaN(num) && num > 10000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

// ──────────────────────────────────────
// Simples Nacional Tables & Calculations
// ──────────────────────────────────────
const SIMPLES_NACIONAL_TABLES = {
  anexo_1: {
    name: 'Comércio (Anexo I)',
    faixas: [
      { max: 180000, rate: 0.04, deducao: 0 },
      { max: 360000, rate: 0.073, deducao: 5940 },
      { max: 720000, rate: 0.095, deducao: 13860 },
      { max: 1800000, rate: 0.107, deducao: 22500 },
      { max: 3600000, rate: 0.143, deducao: 87300 },
      { max: 4800000, rate: 0.19, deducao: 378000 }
    ]
  },
  anexo_2: {
    name: 'Indústria (Anexo II)',
    faixas: [
      { max: 180000, rate: 0.045, deducao: 0 },
      { max: 360000, rate: 0.078, deducao: 5940 },
      { max: 720000, rate: 0.10, deducao: 13860 },
      { max: 1800000, rate: 0.112, deducao: 22500 },
      { max: 3600000, rate: 0.147, deducao: 85500 },
      { max: 4800000, rate: 0.30, deducao: 720000 }
    ]
  },
  anexo_3: {
    name: 'Prestação de Serviços (Anexo III)',
    faixas: [
      { max: 180000, rate: 0.06, deducao: 0 },
      { max: 360000, rate: 0.112, deducao: 9360 },
      { max: 720000, rate: 0.135, deducao: 17640 },
      { max: 1800000, rate: 0.16, deducao: 35640 },
      { max: 3600000, rate: 0.21, deducao: 125640 },
      { max: 4800000, rate: 0.33, deducao: 648000 }
    ]
  },
  anexo_4: {
    name: 'Prestação de Serviços (Anexo IV)',
    faixas: [
      { max: 180000, rate: 0.045, deducao: 0 },
      { max: 360000, rate: 0.09, deducao: 8100 },
      { max: 720000, rate: 0.102, deducao: 12420 },
      { max: 1800000, rate: 0.14, deducao: 39780 },
      { max: 3600000, rate: 0.22, deducao: 183780 },
      { max: 4800000, rate: 0.33, deducao: 828000 }
    ]
  },
  anexo_5: {
    name: 'Prestação de Serviços (Anexo V)',
    faixas: [
      { max: 180000, rate: 0.155, deducao: 0 },
      { max: 360000, rate: 0.18, deducao: 4500 },
      { max: 720000, rate: 0.195, deducao: 9900 },
      { max: 1800000, rate: 0.205, deducao: 17100 },
      { max: 3600000, rate: 0.23, deducao: 62100 },
      { max: 4800000, rate: 0.305, deducao: 540000 }
    ]
  }
};

const getFaixaAndCalculateDAS = (anexoKey, monthlyRevenue, rbt12, isAnexoVReduzido) => {
  const actualAnexoKey = (anexoKey === 'anexo_5' && isAnexoVReduzido) ? 'anexo_3' : anexoKey;
  const table = SIMPLES_NACIONAL_TABLES[actualAnexoKey];
  
  if (!table) return { error: 'Tabela inválida' };
  
  let faixaIndex = 0;
  for (let i = 0; i < table.faixas.length; i++) {
    if (rbt12 <= table.faixas[i].max) {
      faixaIndex = i;
      break;
    }
    if (i === table.faixas.length - 1) {
      faixaIndex = i;
    }
  }
  
  const selectedFaixa = table.faixas[faixaIndex];
  
  let effectiveRate = 0;
  if (rbt12 <= 0) {
    effectiveRate = table.faixas[0].rate;
  } else {
    effectiveRate = ((rbt12 * selectedFaixa.rate) - selectedFaixa.deducao) / rbt12;
  }
  
  if (effectiveRate < 0) effectiveRate = 0;
  
  const exceedsAbsoluteCeiling = rbt12 > 4800000;
  const exceedsSublimite = rbt12 > 3600000;
  
  const dasTax = monthlyRevenue * effectiveRate;
  
  return {
    faixa: faixaIndex + 1,
    nominalRate: selectedFaixa.rate,
    deducao: selectedFaixa.deducao,
    effectiveRate,
    dasTax,
    exceedsAbsoluteCeiling,
    exceedsSublimite,
    isReduced: (anexoKey === 'anexo_5' && isAnexoVReduzido),
    anexoName: (anexoKey === 'anexo_5' && isAnexoVReduzido) ? 'Anexo III (Fator R)' : table.name
  };
};

const SEGMENT_METADATA = [
  { id: 'anexo_1', name: 'Comércio (Anexo I)', baseRate: '4.0%', color: '#3b82f6', desc: 'Lojas, varejo, atacado e comércio geral.' },
  { id: 'anexo_2', name: 'Indústria (Anexo II)', baseRate: '4.5%', color: '#10b981', desc: 'Fábricas, confecção e atividades industriais.' },
  { id: 'anexo_3', name: 'Prestação de Serviços (Anexo III)', baseRate: '6.0%', color: '#8b5cf6', desc: 'Locação de bens, agências de viagens, escritórios de contabilidade, escolas, médicos, etc. — variando conforme o Fator R' },
  { id: 'anexo_4', name: 'Prestação de Serviços (Anexo IV)', baseRate: '4.5%', color: '#f59e0b', desc: 'Empresas de vigilância, limpeza, obras, advocacia.' },
  { id: 'anexo_5', name: 'Prestação de Serviços (Anexo V)', baseRate: '15.5%', color: '#ec4899', desc: 'Tecnologia, engenharia, publicidade, etc. — variando conforme o Fator R' }
];

// ──────────────────────────────────────
// Mini SVG Sparkline
// ──────────────────────────────────────
const Sparkline = ({ data = [], color = '#2563eb', width = 80, height = 36 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${pts} ${(data.length - 1) * step},${height}`;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ──────────────────────────────────────
// Metric Card
// ──────────────────────────────────────
const MetricCard = ({ title, value, unit = '', prefix = '', change, changeLabel, color, sparkData, icon: Icon, description, t, isMobile }) => {
  const isPositive = change >= 0;
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <div style={{
      backgroundColor: t.bg, border: t.border, borderRadius: '20px',
      padding: isMobile ? '1.1rem 1.25rem' : '1.5rem', boxShadow: t.shadow,
      display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem',
      transition: 'all 0.2s', cursor: 'default',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 100, height: 100,
        borderRadius: '50%', backgroundColor: color, opacity: 0.04, pointerEvents: 'none'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '8px',
              backgroundColor: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon size={15} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
          </div>
          <div style={{ fontSize: isMobile ? '1.35rem' : '1.7rem', fontWeight: 800, color: t.textMain, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: unit === '%' ? 1 : 0, maximumFractionDigits: 2 }) : value}{unit}
          </div>
          {description && (
            <div style={{ fontSize: '0.75rem', color: t.textSecondary, marginTop: '0.25rem' }}>{description}</div>
          )}
        </div>
        <Sparkline data={sparkData} color={color} />
      </div>
      {change !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            padding: '2px 8px', borderRadius: '20px',
            backgroundColor: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: isPositive ? '#10b981' : '#ef4444',
            fontSize: '0.75rem', fontWeight: 700
          }}>
            <ChangeIcon size={12} />
            {Math.abs(change)}%
          </div>
          {changeLabel && <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>{changeLabel}</span>}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────
// Expense Category Badge
// ──────────────────────────────────────
const CATEGORIES = [
  { id: 'operacional', label: 'Operacional', color: '#3b82f6' },
  { id: 'marketing', label: 'Marketing', color: '#ec4899' },
  { id: 'folha', label: 'Folha Salarial', color: '#8b5cf6' },
  { id: 'infraestrutura', label: 'Infraestrutura', color: '#f59e0b' },
  { id: 'impostos', label: 'Impostos', color: '#ef4444' },
  { id: 'fornecedores', label: 'Fornecedores', color: '#06b6d4' },
  { id: 'outros', label: 'Outros', color: '#64748b' },
];

const getCategoryConfig = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const STATUS_OPTIONS = [
  { id: 'pago', label: 'Pago', color: '#10b981' },
  { id: 'pendente', label: 'Pendente', color: '#f59e0b' },
  { id: 'atrasado', label: 'Atrasado', color: '#ef4444' },
];

const getStatusConfig = (id) => STATUS_OPTIONS.find(s => s.id === id) || STATUS_OPTIONS[1];

// ──────────────────────────────────────
// Reports Page
// ──────────────────────────────────────
const Reports = () => {
  const { user, activeCompany, companyData, subscription, getTenantCollection, addLog } = useUser();
  const { t, currentTheme } = useTheme();
  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);

  const [activeTab, setActiveTab] = useState('expenses');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1200);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Expenses State ──
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newExpense, setNewExpense] = useState({
    descricao: '',
    valor: '',
    categoria: 'operacional',
    status: 'pendente',
    vencimento: ''
  });

  // ── Metrics State (manually entered) ──
  const [metrics, setMetrics] = useState({
    mrr: 18500,
    ltv: 3720,
    cac: 450,
    churn: 2.4,
    clientes: 142,
    novosClientes: 18,
    burnRate: 12000,
    caixaMeses: 8,
    roiCampanhas: 3.2,
    ticketMedio: 130,
    margemBruta: 0,
    cogs: 0
  });
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [tempMetrics, setTempMetrics] = useState({ ...metrics });

  // ── Simulation State ──
  const [sim, setSim] = useState({
    precoMedio: 130,
    novosClientesMes: 18,
    churnProjetado: 2.4,
    crescimentoBase: 142
  });
  const [goals, setGoals] = useState([
    { id: 1, label: 'MRR Mensal', target: 25000, current: 18500, unit: 'R$' },
    { id: 2, label: 'Total de Clientes Ativos', target: 200, current: 142, unit: '' },
    { id: 3, label: 'Novos Clientes / Mês', target: 30, current: 18, unit: '' },
    { id: 4, label: 'Churn Rate', target: 1.0, current: 2.4, unit: '%', inverse: true },
  ]);
  const [editingGoal, setEditingGoal] = useState(null);

  // ── DAS Selections & Modes State ──
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedSectorToView, setSelectedSectorToView] = useState('anexo_1');
  const [concludedSales, setConcludedSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [products, setProducts] = useState([]);
  const [writeoffsHistory, setWriteoffsHistory] = useState([]);
  const [writeoffProduct, setWriteoffProduct] = useState('');
  const [writeoffQty, setWriteoffQty] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('vencido');
  const [isSubmittingWriteoff, setIsSubmittingWriteoff] = useState(false);
  const [openSegmentAccordion, setOpenSegmentAccordion] = useState(null);

  // Sync products and write-offs
  useEffect(() => {
    if (!user) return;
    const unsubInv = onSnapshot(getTenantCollection('inventory'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.type !== 'promotion'));
    });
    const unsubWoff = onSnapshot(query(getTenantCollection('stock_writeoffs'), orderBy('timestamp', 'desc')), (snap) => {
      setWriteoffsHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubInv(); unsubWoff(); };
  }, [user, activeCompany]);

  // Load active and legacy concluded sales
  useEffect(() => {
    if (!user) return;
    const fetchSalesDataForDAS = async () => {
      try {
        const [salesSnap, legacySnap] = await Promise.all([
          getDocs(getTenantCollection('sales')),
          getDocs(getTenantCollection('legacy'))
        ]);
        
        const currentSales = salesSnap.docs.map(d => {
          const raw = { id: d.id, ...d.data() };
          return decryptActiveSale(raw);
        });
        const legacyRaw = legacySnap.docs.map(d => decryptLegacySale({ id: d.id, ...d.data() }));
        
        const allConcluded = [...currentSales, ...legacyRaw]
          .filter(s => ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim()))
          .map(s => ({
            ...s,
            parsedDate: parseFlexibleDate(s.dataFinalizacao || s.finalizedAt || s.createdAt || s.dataVenda || s.data || 0)
          }));
        
        setConcludedSales(allConcluded);
        setLoadingSales(false);
      } catch (err) {
        console.error("Error fetching sales data for DAS:", err);
        setLoadingSales(false);
      }
    };
    
    fetchSalesDataForDAS();
  }, [user, activeCompany]);

  // Compute dynamic values based on selected month and year
  const getDerivedMonthlyDASValues = () => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const nextMonthStart = new Date(selectedYear, selectedMonth + 1, 1);
    
    // Concluded sales in the apuration month
    const monthlyConcluded = concludedSales.filter(s => s.parsedDate >= startOfMonth && s.parsedDate < nextMonthStart);
    
    // Product-to-segment lookup map
    const productSegmentMap = {};
    products.forEach(p => {
      if (p.id) productSegmentMap[p.id.toString().toUpperCase()] = p.segmentoSimples || 'anexo_1';
      if (p.sku) productSegmentMap[p.sku.toString().toUpperCase()] = p.segmentoSimples || 'anexo_1';
      if (p.nome) productSegmentMap[p.nome.toString().toUpperCase()] = p.segmentoSimples || 'anexo_1';
    });
    
    const derivedRevenues = {
      anexo_1: 0,
      anexo_2: 0,
      anexo_3: 0,
      anexo_4: 0,
      anexo_5: 0
    };
    
    monthlyConcluded.forEach(sale => {
      const items = sale.items || sale.produtos || [];
      const netTotal = Number(sale.total || sale.valor || 0) / 100;
      
      if (items.length > 0) {
        const grossSubtotal = items.reduce((sum, item) => {
          const price = Number(item.price || item.preco || item.value || item.precoVenda || 0);
          const qty = Number(item.quantity || item.quantidade || 1);
          return sum + (price * qty);
        }, 0) / 100;
        
        if (grossSubtotal > 0) {
          const ratio = netTotal / grossSubtotal;
          items.forEach(item => {
            const itemKey = (item.id || item.sku || item.nome || '').toString().toUpperCase();
            const segment = productSegmentMap[itemKey] || 'anexo_1';
            const price = Number(item.price || item.preco || item.value || item.precoVenda || 0) / 100;
            const qty = Number(item.quantity || item.quantidade || 1);
            derivedRevenues[segment] += (price * qty) * ratio;
          });
        } else {
          derivedRevenues.anexo_1 += netTotal;
        }
      } else {
        derivedRevenues.anexo_1 += netTotal;
      }
    });
    
    // Round segment revenues to 2 decimal places to avoid floating point precision issues
    Object.keys(derivedRevenues).forEach(key => {
      derivedRevenues[key] = Math.round(derivedRevenues[key] * 100) / 100;
    });
    
    // RBT12 window: preceding 12 months (excluding selected month)
    const rbt12Start = new Date(selectedYear - 1, selectedMonth, 1);
    const rbt12End = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    
    const rbt12Sales = concludedSales.filter(s => s.parsedDate >= rbt12Start && s.parsedDate <= rbt12End);
    const derivedRBT12 = Math.round(rbt12Sales.reduce((sum, s) => sum + (Number(s.total || s.valor || 0) / 100), 0) * 100) / 100;
    
    // Folha 12m window
    const rbt12Expenses = expenses.filter(e => {
      const d = parseFlexibleDate(e.vencimento || e.createdAt);
      return e.categoria === 'folha' && e.status === 'pago' && d >= rbt12Start && d <= rbt12End;
    });
    const derivedFolha12 = Math.round(rbt12Expenses.reduce((sum, e) => sum + (e.valor || 0), 0) * 100) / 100;
    
    const derivedActive = {
      anexo_1: derivedRevenues.anexo_1 > 0,
      anexo_2: derivedRevenues.anexo_2 > 0,
      anexo_3: derivedRevenues.anexo_3 > 0,
      anexo_4: derivedRevenues.anexo_4 > 0,
      anexo_5: derivedRevenues.anexo_5 > 0
    };
    
    const hasActive = Object.values(derivedActive).some(v => v);
    if (!hasActive) derivedActive.anexo_1 = true;
    
    return {
      rbt12: derivedRBT12,
      folha12: derivedFolha12,
      monthlyRevenues: derivedRevenues,
      activeSegments: derivedActive
    };
  };

  const derivedValues = getDerivedMonthlyDASValues();

  const activeDASInputs = {
    rbt12: Math.round(derivedValues.rbt12),
    folha12: Math.round(derivedValues.folha12),
    monthlyRevenues: derivedValues.monthlyRevenues,
    activeSegments: derivedValues.activeSegments
  };

  const totalFolhaAtual = expenses
    .filter(e => e.categoria === 'folha' && e.status === 'pago')
    .reduce((sum, e) => sum + (e.valor || 0), 0);

  const handleRegisterWriteoff = async (e) => {
    e.preventDefault();
    alert('Modo de Demonstração: O registro de baixa fiscal de estoque está desabilitado.');
    return;
  };

  const calculateAllDAS = () => {
    let totalRevenue = 0;
    let totalDASTax = 0;
    const segmentResults = {};
    
    const rbt12 = activeDASInputs.rbt12;
    const folha12 = activeDASInputs.folha12;
    const fatorR = rbt12 > 0 ? (folha12 / rbt12) : 0;
    const isAnexoVReduzido = fatorR >= 0.28;
    
    Object.keys(activeDASInputs.activeSegments).forEach(anexoKey => {
      const isActive = activeDASInputs.activeSegments[anexoKey];
      const monthlyRevenue = isActive ? (activeDASInputs.monthlyRevenues[anexoKey] || 0) : 0;
      
      if (isActive && monthlyRevenue > 0) {
        const res = getFaixaAndCalculateDAS(anexoKey, monthlyRevenue, rbt12, isAnexoVReduzido);
        segmentResults[anexoKey] = res;
        totalRevenue += monthlyRevenue;
        totalDASTax += res.dasTax || 0;
      } else {
        segmentResults[anexoKey] = {
          dasTax: 0,
          effectiveRate: 0,
          nominalRate: 0,
          deducao: 0,
          faixa: 1,
          isActive: false,
          exceedsAbsoluteCeiling: rbt12 > 4800000,
          exceedsSublimite: rbt12 > 3600000,
          anexoName: SEGMENT_METADATA.find(m => m.id === anexoKey)?.name || ''
        };
      }
    });
    
    const averageRate = totalRevenue > 0 ? (totalDASTax / totalRevenue) : 0;
    
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDASTax: Math.round(totalDASTax * 100) / 100,
      averageRate,
      segmentResults,
      fatorR,
      isAnexoVReduzido
    };
  };

  const dasResults = calculateAllDAS();

  // ── Export Month Sales to XLSX ──
  const exportMonthSales = async () => {
    try {
      const currentMonth = selectedMonth;
      const currentYear = selectedYear;
      const selectedDate = new Date(currentYear, currentMonth, 1);
      const monthName = selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

      const [salesSnap, legacySnap] = await Promise.all([
        getDocs(getTenantCollection('sales')),
        getDocs(getTenantCollection('legacy'))
      ]);

      const isCancelled = (status) => {
        const norm = String(status || '').toLowerCase().trim();
        return ['cancelado', 'cancelada'].includes(norm);
      };
      const isConcludedStatus = (status) => {
        const norm = String(status || '').toLowerCase().trim();
        return ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(norm);
      };

      const currentSales = salesSnap.docs.map(d => {
        const raw = { id: d.id, ...d.data() };
        return decryptActiveSale(raw);
      });
      const legacySales = legacySnap.docs.map(d => decryptLegacySale({ id: d.id, ...d.data() }));
      const allRaw = [...currentSales, ...legacySales];

      const monthSales = allRaw
        .map(s => ({
          ...s,
          parsedDate: parseFlexibleDate(s.dataFinalizacao || s.finalizedAt || s.createdAt || s.dataVenda || s.data || 0)
        }))
        .filter(s => {
          const d = s.parsedDate;
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear &&
            (isConcludedStatus(s.status) || isCancelled(s.status));
        })
        .sort((a, b) => a.parsedDate - b.parsedDate);

      if (monthSales.length === 0) {
        alert('Nenhuma venda encontrada para o mês atual.');
        return;
      }

      const concluded = monthSales.filter(s => isConcludedStatus(s.status));
      const cancelled = monthSales.filter(s => isCancelled(s.status));
      const totalConcluded = concluded.reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);
      const totalCancelled = cancelled.reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);

      const headerRow = ['Código', 'Data de Conclusão', 'Valor da Venda (R$)', 'Status'];
      const dataRows = monthSales.map(s => [
        s.id || s.codigo || '',
        s.parsedDate.toLocaleDateString('pt-BR'),
        Number((Number(s.total || s.valor || 0) / 100).toFixed(2)),
        s.status || ''
      ]);
      const blankRow = ['', '', '', ''];
      const totalsConcludedRow = ['TOTAL CONCLUÍDAS', `${concluded.length} vendas`, Number((totalConcluded / 100).toFixed(2)), ''];
      const totalsCancelledRow = ['TOTAL CANCELADAS', `${cancelled.length} vendas`, Number((totalCancelled / 100).toFixed(2)), ''];

      const wsData = [headerRow, ...dataRows, blankRow, totalsConcludedRow, totalsCancelledRow];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 18 }];

      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '1e3a5f' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
      const cancelledStyle = { fill: { fgColor: { rgb: 'FFD6D6' } }, font: { color: { rgb: 'C0392B' }, bold: true } };
      const concludedStyle = { fill: { fgColor: { rgb: 'E8F8F2' } }, font: { color: { rgb: '1a7a4a' } } };
      const totalConcludedStyle = { font: { bold: true, color: { rgb: '1a7a4a' }, sz: 11 }, fill: { fgColor: { rgb: 'C8F0DC' } } };
      const totalCancelledStyle = { font: { bold: true, color: { rgb: 'C0392B' }, sz: 11 }, fill: { fgColor: { rgb: 'FFB3B3' } } };

      const numCols = 4;
      const numRows = wsData.length;

      for (let R = 0; R < numRows; R++) {
        for (let C = 0; C < numCols; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
          if (R === 0) {
            ws[cellRef].s = headerStyle;
          } else if (R >= 1 && R <= dataRows.length) {
            ws[cellRef].s = isCancelled(monthSales[R - 1].status) ? cancelledStyle : concludedStyle;
          } else if (R === numRows - 2) {
            ws[cellRef].s = totalConcludedStyle;
          } else if (R === numRows - 1) {
            ws[cellRef].s = totalCancelledStyle;
          }
        }
      }

      // Currency format for Value column
      for (let R = 1; R <= dataRows.length; R++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (ws[ref]) { ws[ref].t = 'n'; ws[ref].z = 'R$ #,##0.00'; }
      }
      const totConcRef = XLSX.utils.encode_cell({ r: numRows - 2, c: 2 });
      const totCancRef = XLSX.utils.encode_cell({ r: numRows - 1, c: 2 });
      if (ws[totConcRef]) { ws[totConcRef].t = 'n'; ws[totConcRef].z = 'R$ #,##0.00'; }
      if (ws[totCancRef]) { ws[totCancRef].t = 'n'; ws[totCancRef].z = 'R$ #,##0.00'; }

      XLSX.utils.book_append_sheet(wb, ws, 'Vendas do Mês');
      const fileName = `Vendas_${monthName.replace(' de ', '_')}_${currentYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Erro ao exportar arquivo. Verifique o console.');
    }
  };
  const startOfMonth = new Date(selectedYear, selectedMonth, 1);
  const nextMonthStart = new Date(selectedYear, selectedMonth + 1, 1);
  const monthlyConcluded = concludedSales.filter(s => s.parsedDate >= startOfMonth && s.parsedDate < nextMonthStart);

  const totalServiceRevenue = (activeDASInputs.activeSegments.anexo_3 ? (activeDASInputs.monthlyRevenues.anexo_3 || 0) : 0) +
    (activeDASInputs.activeSegments.anexo_4 ? (activeDASInputs.monthlyRevenues.anexo_4 || 0) : 0) +
    (activeDASInputs.activeSegments.anexo_5 ? (activeDASInputs.monthlyRevenues.anexo_5 || 0) : 0);
  const issDiferencaTotal = totalServiceRevenue * (Number(companyData?.diferencaAliquotaServico || 0) / 100);

  // ── Load Expenses from Firestore ──
  useEffect(() => {
    if (!user) return;
    const colRef = getTenantCollection('expenses');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingExpenses(false);
    }, (err) => {
      console.error('Expenses listener error:', err);
      setLoadingExpenses(false);
    });
    return () => unsub();
  }, [user, activeCompany]);

  // ── Load Sales & Legacy Sales to calculate metrics dynamically ──
  useEffect(() => {
    if (!user) return;
    const fetchSalesData = async () => {
      try {
        const [salesSnap, legacySnap, contactsSnap] = await Promise.all([
          getDocs(getTenantCollection('sales')),
          getDocs(getTenantCollection('legacy')),
          getDocs(getTenantCollection('contacts'))
        ]);
        
        const currentSales = salesSnap.docs.map(d => {
          const raw = { id: d.id, ...d.data() };
          return decryptActiveSale(raw);
        });
        const legacyRaw = legacySnap.docs.map(d => decryptLegacySale({ id: d.id, ...d.data() }));
        const allContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const concludedSales = [...currentSales, ...legacyRaw]
          .filter(s => ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim()))
          .map(s => ({
            ...s,
            parsedDate: parseFlexibleDate(s.dataFinalizacao || s.finalizedAt || s.createdAt || s.dataVenda || s.data || 0)
          }));
        
        // Calculate MRR (current month's concluded sales revenue)
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        const monthlyConcluded = concludedSales.filter(s => s.parsedDate.getMonth() === currentMonth && s.parsedDate.getFullYear() === currentYear);
        const mrrVal = monthlyConcluded.reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);
        const mrrDec = mrrVal / 100;
        
        // Calculate Clientes (Active clients in the last 60 days)
        const clientLastPurchase = {};
        concludedSales.forEach(s => {
          const name = (s.client?.nome || s.cliente || s.clientName || s.clienteNome || '').toLowerCase().trim();
          if (name && name !== 'consumidor') {
            const saleTime = s.parsedDate.getTime();
            if (!clientLastPurchase[name] || saleTime > clientLastPurchase[name]) {
              clientLastPurchase[name] = saleTime;
            }
          }
        });
        allContacts.forEach(c => {
          const name = (c.nome || '').toLowerCase().trim();
          if (name && name !== 'consumidor' && !clientLastPurchase[name]) {
            clientLastPurchase[name] = 0;
          }
        });
        
        const sixtyDaysAgo = today.getTime() - 60 * 24 * 60 * 60 * 1000;
        let activeClientsCount = 0;
        Object.entries(clientLastPurchase).forEach(([name, lastTime]) => {
          if (lastTime >= sixtyDaysAgo) activeClientsCount++;
        });
        
        // Calculate Novos Clientes (first purchase in the current month)
        const clientFirstPurchase = {};
        concludedSales.forEach(s => {
          const name = (s.client?.nome || s.cliente || s.clientName || s.clienteNome || '').toLowerCase().trim();
          if (name && name !== 'consumidor') {
            const saleTime = s.parsedDate.getTime();
            if (!clientFirstPurchase[name] || saleTime < clientFirstPurchase[name]) {
              clientFirstPurchase[name] = saleTime;
            }
          }
        });
        
        const startOfMonth = new Date(currentYear, currentMonth, 1).getTime();
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();
        const newClientsCount = Object.values(clientFirstPurchase).filter(time => time >= startOfMonth && time <= endOfMonth).length;
        
        // Calculate Ticket Médio
        const ticketMedioDec = monthlyConcluded.length > 0 ? (mrrDec / monthlyConcluded.length) : 0;
        
        // Calculate Cost of Goods Sold (COGS) and Gross Profit for current month concluded sales
        const cogsVal = monthlyConcluded.reduce((acc, s) => {
          let cost = Number(s.totalCost || s.custo || s.precoCusto || 0);
          if (cost === 0) {
            const items = s.items || s.produtos || [];
            cost = items.reduce((sum, it) => sum + (Number(it.precoCusto || it.cost || 0) * Number(it.quantity || it.quantidade || 1)), 0);
          }
          return acc + cost;
        }, 0);
        const cogsDec = cogsVal / 100;
        const grossProfitDec = mrrDec - cogsDec;
        
        setMetrics(prev => ({
          ...prev,
          mrr: mrrDec,
          clientes: activeClientsCount,
          novosClientes: newClientsCount,
          ticketMedio: ticketMedioDec,
          margemBruta: grossProfitDec,
          cogs: cogsDec
        }));
        
        setSim(prev => ({
          ...prev,
          precoMedio: ticketMedioDec > 0 ? Math.round(ticketMedioDec) : prev.precoMedio,
          novosClientesMes: newClientsCount || prev.novosClientesMes,
          crescimentoBase: activeClientsCount || prev.crescimentoBase
        }));
        
        setGoals(prev => prev.map(g => {
          if (g.id === 1) return { ...g, current: Math.round(mrrDec) };
          if (g.id === 2) return { ...g, current: activeClientsCount };
          if (g.id === 3) return { ...g, current: newClientsCount };
          return g;
        }));
        
      } catch (err) {
        console.error("Error calculating dynamic metrics in Reports.jsx:", err);
      }
    };
    
    fetchSalesData();
  }, [user, activeCompany]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    alert('Modo de Demonstração: A criação de gastos e despesas está desabilitada.');
    return;
  };

  const handleDeleteExpense = async (id) => {
    alert('Modo de Demonstração: A exclusão de gastos e despesas está desabilitada.');
    return;
  };

  const handleToggleStatus = async (expense) => {
    alert('Modo de Demonstração: A alteração de status de despesas está desabilitada.');
    return;
  };

  // ── Filtered Expenses ──
  const filteredExpenses = expenses.filter(e => {
    if (filterCategory !== 'all' && e.categoria !== filterCategory) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  const totalGastos = expenses.reduce((s, e) => s + (e.valor || 0), 0);
  const totalPago = expenses.filter(e => e.status === 'pago').reduce((s, e) => s + (e.valor || 0), 0);
  const totalPendente = expenses.filter(e => e.status === 'pendente').reduce((s, e) => s + (e.valor || 0), 0);
  const totalAtrasado = expenses.filter(e => e.status === 'atrasado').reduce((s, e) => s + (e.valor || 0), 0);

  const categoryTotals = CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.categoria === cat.id).reduce((s, e) => s + (e.valor || 0), 0)
  })).filter(c => c.total > 0);

  // ── Projections ──
  const calcProjection = (months) => {
    let clients = sim.crescimentoBase;
    let totalRevenue = 0;
    for (let m = 0; m < months; m++) {
      const churned = Math.round(clients * (sim.churnProjetado / 100));
      clients = Math.max(0, clients - churned + sim.novosClientesMes);
      totalRevenue += clients * sim.precoMedio;
    }
    return { totalRevenue, finalClients: clients };
  };

  const proj6 = calcProjection(6);
  const proj12 = calcProjection(12);
  const proj24 = calcProjection(24);

  // Demo sparkline data
  const SPARK = {
    mrr: [12000, 13500, 14200, 15800, 16900, 18500],
    ltv: [2800, 3000, 3100, 3400, 3600, 3720],
    cac: [600, 580, 540, 500, 470, 450],
    churn: [3.8, 3.5, 3.1, 2.9, 2.6, 2.4],
    clients: [110, 116, 122, 128, 135, 142],
    roi: [2.1, 2.4, 2.7, 2.9, 3.0, 3.2],
  };

  // ────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────
  return (
    <div className="reports-page max-w-[1600px] mx-auto p-4" style={{ color: t.textMain }}>
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
        <span>Modo de Demonstração: O registro de despesas, a baixa fiscal de estoque e o ajuste de metas estão desabilitados.</span>
      </div>

      {/* ── HEADER ── */}
      <style>{`
        .tabs-nav::-webkit-scrollbar {
          display: none;
        }
        .tabs-nav {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>

          {/* Title */}
          <div style={{ width: isMobile ? '100%' : 'auto', textAlign: isMobile ? 'center' : 'left' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Relatórios & Métricas</h1>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            flex: 1,
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'center',
            width: '100%',
            overflow: 'hidden'
          }}>
            <nav className="tabs-nav" style={{
              display: 'flex',
              gap: '4px',
              padding: '4px',
              backgroundColor: t.bgSecondary,
              borderRadius: t.radiusSmall,
              border: t.borderBold,
              boxShadow: t.shadowSmall,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              flexWrap: 'nowrap',
              width: isMobile ? '100%' : 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              {[
                { id: 'expenses', label: 'Gastos & Despesas', icon: Receipt },
                { id: 'metrics', label: 'Métricas Avançadas', icon: BarChart3 },
                { id: 'das_calculator', label: 'Impostos & DAS', icon: Calculator },
                { id: 'projections', label: 'Simulações & Metas', icon: Target },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    padding: '8px 16px', border: 'none', borderRadius: t.radiusSmall,
                    backgroundColor: isActive ? t.accent : 'transparent',
                    color: isActive ? t.accentContrast : t.textSecondary,
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    transition: 'all 0.2s', letterSpacing: '0.01em', whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Export Button */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '180px', justifyContent: 'flex-end' }}>
              <button
                onClick={exportMonthSales}
                title="Exportar vendas do período selecionado em XLSX"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 16px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: 'white', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.35)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.35)'; }}
              >
                <FileSpreadsheet size={15} /> Exportar Período
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── TAB CONTENT ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
        >

          {/* ═══════════════════════════════════ */}
          {/* TAB: GASTOS & DESPESAS             */}
          {/* ═══════════════════════════════════ */}
          {activeTab === 'expenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? '0.75rem' : '1rem' }}>
                {[
                  { label: 'Total de Despesas', value: totalGastos, color: '#6366f1', icon: Wallet },
                  { label: 'Total Pago', value: totalPago, color: '#10b981', icon: Check },
                  { label: 'A Pagar', value: totalPendente, color: '#f59e0b', icon: AlertCircle },
                  { label: 'Em Atraso', value: totalAtrasado, color: '#ef4444', icon: TrendingDown },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} style={{
                      backgroundColor: t.bg, border: t.border, borderRadius: '20px',
                      padding: isMobile ? '1rem 1.1rem' : '1.25rem 1.5rem', boxShadow: t.shadow,
                      display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '8px',
                          backgroundColor: `${card.color}18`, color: card.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Icon size={16} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                      </div>
                      <div style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 800, color: card.color, letterSpacing: '-0.02em' }}>
                        R$ {card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category distribution bar */}
              {categoryTotals.length > 0 && (
                <div style={{
                  backgroundColor: t.bg, border: t.border, borderRadius: '20px',
                  padding: '1.5rem', boxShadow: t.shadow
                }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Distribuição por Categoria</h3>
                  <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
                    {categoryTotals.map(cat => (
                      <div key={cat.id} style={{
                        flex: cat.total / totalGastos,
                        backgroundColor: cat.color,
                        borderRadius: 99,
                        transition: 'flex 0.5s ease'
                      }} title={`${cat.label}: R$ ${cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                    {categoryTotals.map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: t.textSecondary }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cat.color }} />
                        <span style={{ fontWeight: 600 }}>{cat.label}</span>
                        <span>{((cat.total / totalGastos) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table Area */}
              <div style={{ backgroundColor: t.bg, border: t.border, borderRadius: '20px', padding: '1.5rem', boxShadow: t.shadow }}>

                {/* Table Header Row: filters + Add button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', fontWeight: 600, outline: 'none' }}>
                      <option value="all">Todas Categorias</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', fontWeight: 600, outline: 'none' }}>
                      <option value="all">Todos Status</option>
                      {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>{filteredExpenses.length} registro(s)</span>
                  </div>
                  <motion.button
                    onClick={() => setShowAddForm(!showAddForm)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '8px 18px', border: 'none', borderRadius: t.radiusSmall,
                      backgroundColor: t.accent, color: t.accentContrast,
                      fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
                    }}>
                    {showAddForm ? <X size={16} /> : <Plus size={16} />}
                    {showAddForm ? 'Cancelar' : 'Nova Despesa'}
                  </motion.button>
                </div>

                {/* Add Form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleAddExpense}
                      style={{
                        backgroundColor: t.bgSecondary, borderRadius: '14px',
                        padding: '1.25rem', marginBottom: '1rem',
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem',
                        border: t.border
                      }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary }}>Descrição *</label>
                        <input required value={newExpense.descricao} onChange={e => setNewExpense(p => ({ ...p, descricao: e.target.value }))}
                          placeholder="Ex: Aluguel, Nuvem, Salários..."
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary }}>Valor (R$) *</label>
                        <input required type="number" min="0" step="0.01" value={newExpense.valor} onChange={e => setNewExpense(p => ({ ...p, valor: e.target.value }))}
                          placeholder="0,00"
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary }}>Categoria</label>
                        <select value={newExpense.categoria} onChange={e => setNewExpense(p => ({ ...p, categoria: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none' }}>
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary }}>Status</label>
                        <select value={newExpense.status} onChange={e => setNewExpense(p => ({ ...p, status: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none' }}>
                          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary }}>Vencimento</label>
                        <input type="date" value={newExpense.vencimento} onChange={e => setNewExpense(p => ({ ...p, vencimento: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <motion.button type="submit" disabled={savingExpense}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          style={{
                            width: '100%', padding: '8px 12px', border: 'none', borderRadius: t.radiusSmall,
                            backgroundColor: '#10b981', color: '#fff',
                            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', outline: 'none'
                          }}>
                          {savingExpense ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          Salvar
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Expenses List */}
                {loadingExpenses ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: t.textSecondary, gap: '0.75rem' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    Carregando despesas...
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: t.textSecondary }}>
                    <Receipt size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nenhuma despesa encontrada</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Clique em "Nova Despesa" para adicionar seu primeiro registro</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: isMobile ? '0.75rem' : '0.5rem' }}>
                    {filteredExpenses.map((expense, idx) => {
                      const cat = getCategoryConfig(expense.categoria);
                      const sts = getStatusConfig(expense.status);
                      const isDeleting = deletingId === expense.id;
                      
                      if (isMobile) {
                        return (
                          <motion.div key={expense.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            whileHover={{ y: -2, boxShadow: t.shadowSmall }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              padding: '1.25rem',
                              borderRadius: '16px',
                              backgroundColor: t.bgSecondary,
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                              borderLeft: `4px solid ${cat.color}`,
                              boxShadow: t.shadowSmall,
                              position: 'relative',
                              transition: 'all 0.2s'
                            }}>
                            
                            {/* Row 1: Category Badge & Delete Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: cat.color,
                                backgroundColor: `${cat.color}15`,
                                border: `1px solid ${cat.color}30`,
                                padding: '2px 10px',
                                borderRadius: '20px',
                                letterSpacing: '0.04em'
                              }}>
                                {cat.label}
                              </span>
                              <button onClick={() => handleDeleteExpense(expense.id)} disabled={isDeleting}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#ef4444', opacity: isDeleting ? 0.5 : 0.6,
                                  padding: '6px', borderRadius: '8px', transition: 'all 0.2s', outline: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                  border: '1px solid rgba(239, 68, 68, 0.1)'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; }}>
                                {isDeleting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
                              </button>
                            </div>
                            
                            {/* Row 2: Description */}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: t.textMain }}>{expense.descricao}</div>
                              {expense.vencimento && (
                                <div style={{ fontSize: '0.75rem', color: t.textSecondary, marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Calendar size={13} style={{ opacity: 0.6 }} />
                                  <span>Vence em {expense.vencimento}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Separator */}
                            <div style={{ borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, margin: '0.25rem 0' }} />
                            
                            {/* Row 3: Status and Value */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <button onClick={() => handleToggleStatus(expense)}
                                title="Clique para alterar status"
                                style={{
                                  padding: '4px 14px', borderRadius: 99, border: `1px solid ${sts.color}30`,
                                  backgroundColor: `${sts.color}15`, color: sts.color,
                                  fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', outline: 'none',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sts.color }} />
                                {sts.label}
                              </button>
                              
                              <div style={{ fontWeight: 900, fontSize: '1.15rem', color: t.textMain }}>
                                R$ {(expense.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }
                      
                      // Desktop row view
                      return (
                        <motion.div key={expense.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          whileHover={{ x: 3, backgroundColor: t.bgSecondary }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.875rem 1.25rem', borderRadius: '12px',
                            backgroundColor: t.bgSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                            transition: 'all 0.2s'
                          }}>
                          {/* Category dot */}
                          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                          {/* Description */}
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: t.textMain }}>{expense.descricao}</div>
                            <div style={{ fontSize: '0.75rem', color: t.textSecondary }}>{cat.label}{expense.vencimento ? ` · Vence ${expense.vencimento}` : ''}</div>
                          </div>
                          {/* Status badge - clickable to cycle */}
                          <button onClick={() => handleToggleStatus(expense)}
                            title="Clique para alterar status"
                            style={{
                              padding: '4px 14px', borderRadius: 99, border: `1px solid ${sts.color}30`,
                              backgroundColor: `${sts.color}15`, color: sts.color,
                              fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', outline: 'none',
                              transition: 'all 0.2s',
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sts.color }} />
                            {sts.label}
                          </button>
                          {/* Value */}
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: t.textMain, minWidth: 110, textAlign: 'right' }}>
                            R$ {(expense.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          {/* Delete */}
                          <button onClick={() => handleDeleteExpense(expense.id)} disabled={isDeleting}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ef4444', opacity: isDeleting ? 0.5 : 0.6,
                              padding: '6px', borderRadius: '8px', transition: 'all 0.2s', outline: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: 'rgba(239, 68, 68, 0.02)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.02)'; }}>
                            {isDeleting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* TAB: MÉTRICAS AVANÇADAS            */}
          {/* ═══════════════════════════════════ */}
          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Edit Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: t.textMain }}>KPIs Corporativos em Tempo Real</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: t.textSecondary }}>Edite os valores para refletir os dados reais da empresa. As tendências são calculadas automaticamente.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingMetrics ? (
                    <>
                      <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setMetrics({ ...tempMetrics }); setEditingMetrics(false); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', border: 'none', borderRadius: t.radiusSmall, backgroundColor: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}>
                        <Save size={14} /> Salvar
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setTempMetrics({ ...metrics }); setEditingMetrics(false); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', border: t.border, borderRadius: t.radiusSmall, backgroundColor: 'transparent', color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}>
                        <X size={14} /> Cancelar
                      </motion.button>
                    </>
                  ) : (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setTempMetrics({ ...metrics }); setEditingMetrics(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', border: t.border, borderRadius: t.radiusSmall, backgroundColor: t.bgSecondary, color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}>
                      <Edit3 size={14} /> Editar Valores
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Edit Form (visible when editing) */}
              <AnimatePresence>
                {editingMetrics && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{
                      backgroundColor: t.bgSecondary, borderRadius: '16px', padding: '1.25rem',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem',
                      border: t.border
                    }}>
                    {[
                      { key: 'mrr', label: 'MRR (R$)', step: 100 },
                      { key: 'ltv', label: 'LTV (R$)', step: 50 },
                      { key: 'cac', label: 'CAC (R$)', step: 10 },
                      { key: 'churn', label: 'Churn Rate (%)', step: 0.1 },
                      { key: 'clientes', label: 'Clientes Ativos', step: 1 },
                      { key: 'novosClientes', label: 'Novos/Mês', step: 1 },
                      { key: 'burnRate', label: 'Burn Rate (R$)', step: 100 },
                      { key: 'caixaMeses', label: 'Runway (meses)', step: 1 },
                      { key: 'roiCampanhas', label: 'ROI Campanhas (x)', step: 0.1 },
                      { key: 'ticketMedio', label: 'Ticket Médio (R$)', step: 5 },
                      { key: 'margemBruta', label: 'Margem Bruta (R$)', step: 100 },
                      { key: 'cogs', label: 'Custo das Vendas (R$)', step: 100 },
                    ].map(field => (
                      <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary }}>{field.label}</label>
                        <input type="number" step={field.step} value={tempMetrics[field.key]}
                          onChange={e => setTempMetrics(p => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))}
                          style={{ padding: '8px 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none', fontWeight: 700 }} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: isMobile ? '0.75rem' : '1rem' }}>
                <MetricCard t={t} title="MRR" prefix="R$ " value={metrics.mrr} change={8.2} changeLabel="vs mês anterior"
                  color="#6366f1" sparkData={SPARK.mrr} icon={DollarSign}
                  description="Receita Recorrente Mensal" isMobile={isMobile} />
                <MetricCard t={t} title="Margem Bruta" prefix="R$ " value={metrics.margemBruta || 0} change={6.5} changeLabel="vs mês anterior"
                  color="#10b981" sparkData={[12000, 12500, 13000, 13200, 13800, metrics.margemBruta || 0]} icon={TrendingUp}
                  description="Lucro Bruto Mensal das Vendas" isMobile={isMobile} />
                <MetricCard t={t} title="Custo das Vendas" prefix="R$ " value={metrics.cogs || 0} change={-2.5} changeLabel="redução (bom)"
                  color="#ef4444" sparkData={[4500, 4800, 5000, 4800, 4600, metrics.cogs || 0]} icon={ShoppingCart}
                  description="Custo total das mercadorias vendidas" isMobile={isMobile} />
                <MetricCard t={t} title="LTV" prefix="R$ " value={metrics.ltv} change={5.1} changeLabel="vs mês anterior"
                  color="#8b5cf6" sparkData={SPARK.ltv} icon={TrendingUp}
                  description="Lifetime Value médio por cliente" isMobile={isMobile} />
                <MetricCard t={t} title="CAC" prefix="R$ " value={metrics.cac} change={-4.8} changeLabel="redução (bom)"
                  color="#ec4899" sparkData={SPARK.cac} icon={ShoppingCart}
                  description="Custo de Aquisição de Cliente" isMobile={isMobile} />
                <MetricCard t={t} title="LTV / CAC" value={(metrics.ltv / (metrics.cac || 1)).toFixed(1)} unit="x" change={9.5} changeLabel="eficiência cresceu"
                  color="#10b981" sparkData={[4.1, 5.0, 5.5, 6.2, 7.0, metrics.ltv / (metrics.cac || 1)]} icon={Zap}
                  description="Índice ideal: &gt; 3x" isMobile={isMobile} />
                <MetricCard t={t} title="Churn Rate" value={metrics.churn} unit="%" change={-8.5} changeLabel="queda (bom)"
                  color="#f59e0b" sparkData={SPARK.churn} icon={TrendingDown}
                  description="Taxa de evasão mensal de clientes" isMobile={isMobile} />
                <MetricCard t={t} title="Clientes Ativos" value={metrics.clientes} change={3.1} changeLabel="crescimento"
                  color="#3b82f6" sparkData={SPARK.clients} icon={Users}
                  description={`+${metrics.novosClientes} novos este mês`} isMobile={isMobile} />
                <MetricCard t={t} title="Burn Rate" prefix="R$ " value={metrics.burnRate} change={-2.0} changeLabel="controlado"
                  color="#ef4444" sparkData={[14000, 13500, 13000, 12700, 12200, metrics.burnRate]} icon={Activity}
                  description="Consumo de caixa mensal" isMobile={isMobile} />
                <MetricCard t={t} title="Runway" value={metrics.caixaMeses} unit=" meses" change={12.5} changeLabel="estabilidade"
                  color="#06b6d4" sparkData={[5, 5.5, 6, 6.5, 7.5, metrics.caixaMeses]} icon={Layers}
                  description="Meses de operação garantidos" isMobile={isMobile} />
                <MetricCard t={t} title="ROI Campanhas" value={metrics.roiCampanhas} unit="x" change={6.7} changeLabel="retorno cresceu"
                  color="#84cc16" sparkData={SPARK.roi} icon={BarChart2}
                  description="Retorno sobre investimento em marketing" isMobile={isMobile} />
                <MetricCard t={t} title="Ticket Médio" prefix="R$ " value={metrics.ticketMedio} change={2.3} changeLabel="vs mês anterior"
                  color="#f97316" sparkData={[110, 115, 118, 123, 128, metrics.ticketMedio]} icon={CreditCard}
                  description="Receita média por cliente ativo" isMobile={isMobile} />
              </div>

              {/* Insight Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {[
                  {
                    title: 'Eficiência de Crescimento',
                    value: metrics.ltv / (metrics.cac || 1) >= 3 ? '✅ Saudável' : '⚠️ Atenção',
                    desc: `LTV/CAC = ${(metrics.ltv / (metrics.cac || 1)).toFixed(1)}x. ${metrics.ltv / (metrics.cac || 1) >= 3 ? 'A operação está financeiramente eficiente.' : 'Considere aumentar o LTV ou reduzir o custo de aquisição.'}`,
                    color: metrics.ltv / (metrics.cac || 1) >= 3 ? '#10b981' : '#f59e0b'
                  },
                  {
                    title: 'Saúde do Churn',
                    value: metrics.churn <= 2 ? '✅ Excelente' : metrics.churn <= 5 ? '⚠️ Moderado' : '🚨 Crítico',
                    desc: `Taxa atual: ${metrics.churn}%/mês. ${metrics.churn <= 2 ? 'Retenção excelente — foco em expansão.' : 'Recomenda-se programas de retenção e CS proativo.'}`,
                    color: metrics.churn <= 2 ? '#10b981' : metrics.churn <= 5 ? '#f59e0b' : '#ef4444'
                  },
                  {
                    title: 'Sustentabilidade Operacional',
                    value: metrics.caixaMeses >= 12 ? '✅ Seguro' : metrics.caixaMeses >= 6 ? '⚠️ Atenção' : '🚨 Alerta',
                    desc: `${metrics.caixaMeses} meses de runway com burn rate atual de R$ ${metrics.burnRate.toLocaleString('pt-BR')}. ${metrics.caixaMeses >= 12 ? 'Operação em zona de conforto financeiro.' : 'Avalie captação ou redução de custos.'}`,
                    color: metrics.caixaMeses >= 12 ? '#10b981' : metrics.caixaMeses >= 6 ? '#f59e0b' : '#ef4444'
                  }
                ].map(card => (
                  <div key={card.title} style={{
                    backgroundColor: t.bg, border: `1px solid ${card.color}30`, borderRadius: '16px',
                    padding: '1.25rem', boxShadow: t.shadow
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>{card.title}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: card.color, marginBottom: '0.5rem' }}>{card.value}</div>
                    <div style={{ fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.5 }}>{card.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* TAB: CÁLCULO DE IMPOSTOS & DAS     */}
          {/* ═══════════════════════════════════ */}
          {activeTab === 'das_calculator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Period Selector & Mode Toggle Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem',
                backgroundColor: t.bgSecondary,
                borderRadius: '20px',
                border: t.border,
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: t.shadowSmall
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: t.textMain }}>Período de Apuração:</span>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: t.radiusSmall,
                      border: t.border,
                      backgroundColor: t.bg,
                      color: t.textMain,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: t.radiusSmall,
                      border: t.border,
                      backgroundColor: t.bg,
                      color: t.textMain,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  <button
                    onClick={exportMonthSales}
                    title="Exportar vendas do período selecionado em XLSX"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: t.radiusSmall,
                      border: 'none',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(22,163,74,0.35)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.45)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.35)'; }}
                  >
                    <FileSpreadsheet size={14} /> Exportar Vendas (XLSX)
                  </button>
                </div>
                

              </div>

              {loadingSales ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem', color: t.textSecondary, gap: '0.75rem' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  Processando dados fiscais e de estoque...
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: '1.5rem', alignItems: 'start' }}>
                    
                    {/* CONFIGURATION COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Faturamento Acumulado (RBT12) Panel */}
                      <div style={{ backgroundColor: t.bg, border: t.border, borderRadius: '20px', padding: '1.25rem', boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: `${t.accent}18`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Sliders size={14} />
                            </div>
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '0.825rem', color: t.textMain }}>Dados Acumulados (Últimos 12 Meses)</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: t.success, fontWeight: 700, padding: '2px 8px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                            ✓ Apuração Automática
                          </span>
                        </div>

                        {/* COMPACT SUMMARY VIEW (Auto mode) - HIGHLY compressed & ultra-modern */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                          <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: t.bgSecondary, border: t.border }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: t.textSecondary, display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Faturamento (RBT12)</span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: t.accent }}>R$ {activeDASInputs.rbt12.toLocaleString('pt-BR')}</span>
                          </div>
                          <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: t.bgSecondary, border: t.border }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: t.textSecondary, display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Folha Acumulada</span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: t.textMain }}>R$ {activeDASInputs.folha12.toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Segment Selection & Monthly Revenue */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textSecondary, margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Setores de Atuação da Empresa
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {/* Dropdown Select List */}
                          <div style={{ position: 'relative' }}>
                            <select
                              value={selectedSectorToView}
                              onChange={e => setSelectedSectorToView(e.target.value)}
                              style={{
                                width: '100%',
                                height: '42px',
                                padding: '0 12px',
                                borderRadius: t.radiusSmall,
                                border: t.border,
                                backgroundColor: t.bgSecondary,
                                color: t.textMain,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer',
                                boxShadow: t.shadowSmall
                              }}
                            >
                              {SEGMENT_METADATA.map(seg => {
                                const isActive = activeDASInputs.activeSegments[seg.id];
                                const hasRevenue = (activeDASInputs.monthlyRevenues[seg.id] || 0) > 0;
                                return (
                                  <option key={seg.id} value={seg.id}>
                                    {seg.name} (Base: {seg.baseRate}){isActive ? ' - Ativo' : ''}{hasRevenue ? ' (Tem Faturamento)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Render Active/Selected Sector Details */}
                          {(() => {
                            const seg = SEGMENT_METADATA.find(s => s.id === selectedSectorToView);
                            if (!seg) return null;
                            const isActive = activeDASInputs.activeSegments[seg.id];
                            const monthlyRevenue = activeDASInputs.monthlyRevenues[seg.id] || 0;
                            
                            return (
                              <div style={{
                                backgroundColor: isActive ? `${seg.color}08` : t.bg,
                                border: isActive ? `1px solid ${seg.color}` : t.border,
                                borderRadius: '16px',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                boxShadow: isActive ? 'none' : t.shadow,
                                transition: 'all 0.2s',
                                opacity: !isActive ? 0.6 : 1
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#64748b' }} />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: t.textMain }}>
                                      {isActive ? 'Setor Ativo no Mês' : 'Setor Inativo'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: `${seg.color}12`, color: seg.color }}>
                                    Alíquota Base: {seg.baseRate}
                                  </span>
                                </div>
                                
                                <div style={{ fontSize: '0.75rem', color: t.textSecondary, marginLeft: '0.2rem', lineHeight: 1.45 }}>
                                  {seg.desc}
                                </div>
                                
                                {isActive && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: t.textSecondary }}>Faturamento Automático Detectado</span>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: t.textMain }}>
                                      R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>

                    {/* RESULTS & BREAKDOWN COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Results Card (Luxurious Indigo/Purple Gradient) */}
                      <div style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#fff',
                        borderRadius: '24px',
                        padding: isMobile ? '1.25rem' : '1.75rem',
                        boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.3)',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        <div style={{
                          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
                          borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)', pointerEvents: 'none'
                        }} />
                        
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>GUIA DAS MENSAL ESTIMADA</span>
                          <h2 style={{ fontSize: isMobile ? '1.6rem' : '2.3rem', fontWeight: 800, margin: '0.2rem 0 0', letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                            R$ {(dasResults.totalDASTax + issDiferencaTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </h2>
                          {Number(companyData?.diferencaAliquotaServico || 0) > 0 && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.2rem', display: 'block' }}>
                              (DAS Federal: R$ {dasResults.totalDASTax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + ISS municipal: R$ {issDiferencaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Receita Declarada</span>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>R$ {dasResults.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Alíquota Efetiva Média</span>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{(dasResults.averageRate * 100).toFixed(2)}%</div>
                          </div>
                        </div>

                        {Number(companyData?.diferencaAliquotaServico || 0) > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Receita de Serviços</span>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>R$ {totalServiceRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Diferença Alíquota ({Number(companyData.diferencaAliquotaServico).toFixed(2)}%)</span>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>R$ {issDiferencaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RBT12 Visual Progress Bar with Sublimite */}
                      <div style={{ backgroundColor: t.bg, border: t.border, borderRadius: '20px', padding: '1.25rem 1.5rem', boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Progressão de Teto de Faturamento</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: t.accent }}>R$ {activeDASInputs.rbt12.toLocaleString('pt-BR')} / R$ 4,8M</span>
                        </div>
                        
                        <div style={{ position: 'relative', height: 16, backgroundColor: t.bgSecondary, borderRadius: 99, marginTop: '0.2', overflow: 'hidden' }}>
                          {/* Sublimite marker line (75%) */}
                          <div style={{
                            position: 'absolute',
                            left: '75%',
                            top: 0,
                            width: 2,
                            height: '100%',
                            backgroundColor: '#f59e0b',
                            zIndex: 2,
                            opacity: 0.8
                          }} title="Sublimite ICMS/ISS - R$ 3,6 Milhões" />
                          
                          {/* Progress fill */}
                          <div style={{
                            height: '100%',
                            borderRadius: 99,
                            background: activeDASInputs.rbt12 > 4800000 ? '#ef4444' : activeDASInputs.rbt12 > 3600000 ? 'linear-gradient(90deg, #3b82f6 0%, #f59e0b 100%)' : 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                            width: `${Math.min((activeDASInputs.rbt12 / 4800000) * 100, 100)}%`,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: t.textSecondary, marginTop: '0.05rem' }}>
                          <span>R$ 0</span>
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{isMobile ? 'Sub: R$ 3,6M' : 'Sublimite ISS/ICMS: R$ 3,6M (75%)'}</span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>Teto: R$ 4,8M</span>
                        </div>
                      </div>

                      {/* Fator R Analysis (if Anexo V is active) */}
                      {activeDASInputs.activeSegments.anexo_5 && (
                        <div style={{
                          backgroundColor: t.bg,
                          border: `1px solid ${dasResults.isAnexoVReduzido ? '#10b981' : '#f59e0b'}35`,
                          borderRadius: '16px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          boxShadow: t.shadow
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Zap size={14} style={{ color: dasResults.isAnexoVReduzido ? '#10b981' : '#f59e0b' }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textMain }}>Fator R (Anexo V)</span>
                            </div>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 99,
                              backgroundColor: dasResults.isAnexoVReduzido ? '#10b98115' : '#f59e0b15',
                              color: dasResults.isAnexoVReduzido ? '#10b981' : '#f59e0b'
                            }}>
                              Relação: {(dasResults.fatorR * 100).toFixed(1)}%
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '0.72rem', color: t.textSecondary, lineHeight: 1.4 }}>
                            {dasResults.isAnexoVReduzido ? (
                              <span>
                                🎉 **Acesso ao Anexo III Garantido!** Relação &ge; 28%. Alíquota nominal reduzida de **15.5% para 6.0%**!
                              </span>
                            ) : (
                              <span>
                                ⚠️ **Tributado no Anexo V (15.5%).** Sugestão: Pró-labore de **R$ {(activeDASInputs.rbt12 * 0.28 / 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês** para migrar ao Anexo III (6.0%).
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ceiling Warning Alerts */}
                      {activeDASInputs.rbt12 > 3600000 && (
                        <div style={{
                          backgroundColor: `${activeDASInputs.rbt12 > 4800000 ? '#ef4444' : '#f59e0b'}10`,
                          border: `1px solid ${activeDASInputs.rbt12 > 4800000 ? '#ef4444' : '#f59e0b'}30`,
                          borderRadius: '16px',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'flex-start',
                          boxShadow: t.shadow
                        }}>
                          <div style={{ color: activeDASInputs.rbt12 > 4800000 ? '#ef4444' : '#f59e0b', marginTop: '1px', flexShrink: 0 }}>
                            <AlertCircle size={15} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              color: activeDASInputs.rbt12 > 4800000 ? '#ef4444' : '#f59e0b'
                            }}>
                              {activeDASInputs.rbt12 > 4800000 ? 'Exclusão do Simples Nacional' : 'Sublimite Ultrapassado'}
                            </span>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: t.textSecondary, lineHeight: 1.35 }}>
                              {activeDASInputs.rbt12 > 4800000 ? (
                                <span>Faturamento acumulado de **R$ {activeDASInputs.rbt12.toLocaleString('pt-BR')}** ultrapassou o teto absoluto de **R$ 4,8M**. Migrar para Lucro Presumido/Real.</span>
                              ) : (
                                <span>Faturamento de **R$ {activeDASInputs.rbt12.toLocaleString('pt-BR')}** ultrapassou o sublimite de **R$ 3,6M**. ICMS e ISS devem ser pagos por fora do Simples.</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Detailed breakdown Accordions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textSecondary, margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Detalhamento de Cálculo por Setor
                        </h3>
                        
                        {Object.keys(activeDASInputs.activeSegments).map(anexoKey => {
                          const isActive = activeDASInputs.activeSegments[anexoKey];
                          const revenue = activeDASInputs.monthlyRevenues[anexoKey] || 0;
                          if (!isActive || revenue <= 0) return null;
                          
                          const result = dasResults.segmentResults[anexoKey];
                          const isExpanded = openSegmentAccordion === anexoKey;
                          const metadata = SEGMENT_METADATA.find(m => m.id === anexoKey);
                          
                          return (
                            <div key={anexoKey} style={{
                              backgroundColor: t.bg,
                              border: t.border,
                              borderRadius: '16px',
                              overflow: 'hidden',
                              boxShadow: t.shadow,
                              transition: 'all 0.2s'
                            }}>
                              {/* Accordion Header */}
                              <button
                                type="button"
                                onClick={() => setOpenSegmentAccordion(isExpanded ? null : anexoKey)}
                                style={{
                                  width: '100%',
                                  padding: '0.85rem 1rem',
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  color: t.textMain,
                                  outline: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: metadata.color }} />
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.825rem', color: t.textMain }}>{result.anexoName}</div>
                                    <div style={{ fontSize: '0.7rem', color: t.textSecondary }}>
                                      Faturamento: R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Alíquota Efetiva: {(result.effectiveRate * 100).toFixed(2)}%
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.875rem', color: metadata.color }}>
                                    R$ {result.dasTax.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  {isExpanded ? <ChevronUp size={14} style={{ color: t.textSecondary }} /> : <ChevronDown size={14} style={{ color: t.textSecondary }} />}
                                </div>
                              </button>
                              
                              {/* Accordion Content */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{
                                      borderTop: t.border,
                                      backgroundColor: t.bgSecondary,
                                      padding: '1rem',
                                      fontSize: '0.75rem',
                                      color: t.textSecondary,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.5rem'
                                    }}
                                  >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>Faixa Tributária:</span> {result.faixa}ª Faixa
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>Alíquota Nominal:</span> {(result.nominalRate * 100).toFixed(2)}%
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>Faturamento Acumulado (12m):</span> R$ {activeDASInputs.rbt12.toLocaleString('pt-BR')}
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>Parcela a Deduzir da Faixa:</span> R$ {result.deducao.toLocaleString('pt-BR')}
                                      </div>
                                    </div>
                                    
                                    <div style={{
                                      marginTop: '0.4rem',
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '8px',
                                      backgroundColor: t.bg,
                                      border: t.border,
                                      fontFamily: 'monospace',
                                      fontSize: '0.7rem',
                                      lineHeight: 1.4
                                    }}>
                                      <div style={{ fontWeight: 700, color: t.textMain, marginBottom: '0.2rem' }}>Fórmula da Alíquota Efetiva:</div>
                                      <div>((RBT12 × Alíquota Nominal) - Parcela a Deduzir) ÷ RBT12</div>
                                      <div style={{ color: t.accent, marginTop: '0.2rem' }}>
                                        = ((R$ {activeDASInputs.rbt12.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {result.nominalRate}) - R$ {result.deducao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) ÷ R$ {activeDASInputs.rbt12.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      <div style={{ fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                                        = {(result.effectiveRate * 100).toFixed(4)}% (Taxa Efetiva Real)
                                      </div>
                                    </div>
                                    
                                    <div style={{
                                      marginTop: '0.25rem',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontWeight: 700,
                                      color: t.textMain
                                    }}>
                                      <span>Imposto no Mês:</span>
                                      <span>R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {(result.effectiveRate * 100).toFixed(2)}% = R$ {result.dasTax.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                    </div>

                  </div>
                  
                  {/* Seção de Ajustes de Estoque & Baixas Fiscais */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                    
                    {/* Form Baixa */}
                    <div style={{
                      backgroundColor: t.bg,
                      border: t.border,
                      borderRadius: '20px',
                      padding: '1.5rem',
                      boxShadow: t.shadow,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '6px',
                          backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Trash2 size={14} />
                        </div>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain }}>Ajuste de Estoque por Baixa Fiscal</span>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: t.textSecondary }}>Baixe produtos vencidos ou para degustação sem gerar tributação no caixa/PDV</p>
                        </div>
                      </div>

                      <form onSubmit={handleRegisterWriteoff} style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        alignItems: 'flex-end',
                        width: '100%'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: isMobile ? '1 1 100%' : '2 1 200px', minWidth: '150px', width: '100%' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary }}>Produto</label>
                          <select
                            value={writeoffProduct}
                            onChange={e => setWriteoffProduct(e.target.value)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: t.radiusSmall,
                              border: t.border,
                              backgroundColor: t.bgSecondary,
                              color: t.textMain,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              outline: 'none',
                              height: '38px',
                              cursor: 'pointer',
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="">Selecione...</option>
                            {products.filter(p => Number(p.estoque || 0) >= 1).map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nome} ({p.estoque} {p.unidade || 'UN'})
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: isMobile ? '1 1 100%' : '1 1 80px', minWidth: '80px', width: '100%' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary }}>Quantidade</label>
                          <input
                            type="number"
                            min="1"
                            value={writeoffQty}
                            onChange={e => setWriteoffQty(e.target.value)}
                            placeholder="Ex: 5"
                            style={{
                              padding: '8px 12px',
                              borderRadius: t.radiusSmall,
                              border: t.border,
                              backgroundColor: t.bgSecondary,
                              color: t.textMain,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              outline: 'none',
                              height: '38px',
                              textAlign: 'center',
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: isMobile ? '1 1 100%' : '1.5 1 150px', minWidth: '120px', width: '100%' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary }}>Justificativa</label>
                          <select
                            value={writeoffReason}
                            onChange={e => setWriteoffReason(e.target.value)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: t.radiusSmall,
                              border: t.border,
                              backgroundColor: t.bgSecondary,
                              color: t.textMain,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              outline: 'none',
                              height: '38px',
                              cursor: 'pointer',
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="vencido">Produto Vencido (Perda)</option>
                            <option value="degustacao">Amostra / Degustação (Brinde)</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingWriteoff}
                          style={{
                            height: '38px',
                            padding: '0 12px',
                            border: 'none',
                            borderRadius: t.radiusSmall,
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            outline: 'none',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flex: isMobile ? '1 1 100%' : '1 1 140px',
                            minWidth: '130px',
                            width: '100%'
                          }}
                        >
                          {isSubmittingWriteoff ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Dar Baixa Fiscal
                        </button>
                      </form>
                    </div>

                    {/* List Baixas */}
                    <div style={{
                      backgroundColor: t.bg,
                      border: t.border,
                      borderRadius: '20px',
                      padding: '1.5rem',
                      boxShadow: t.shadow,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Histórico de Baixas do Período ({String(selectedMonth + 1).padStart(2, '0')}/{selectedYear})
                      </span>
                      
                      {writeoffsHistory.filter(w => w.month === selectedMonth && w.year === selectedYear).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: t.textSecondary, fontSize: '0.78rem', fontStyle: 'italic', border: `1px dashed ${t.border}`, borderRadius: '12px' }}>
                          Nenhuma baixa fiscal registrada neste período.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                          {writeoffsHistory
                            .filter(w => w.month === selectedMonth && w.year === selectedYear)
                            .map(woff => (
                              <div key={woff.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: t.bgSecondary,
                                borderRadius: '10px',
                                border: `1px solid ${t.border}`,
                                gap: '0.5rem'
                              }}>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{woff.productName}</div>
                                  <span style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    color: woff.reason === 'vencido' ? '#ef4444' : '#f59e0b',
                                    backgroundColor: woff.reason === 'vencido' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                  }}>
                                    {woff.reason === 'vencido' ? 'Vencido' : 'Degustação'}
                                  </span>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain }}>
                                    -{woff.quantity} UN
                                  </div>
                                  <div style={{ fontSize: '0.625rem', color: t.textSecondary }}>
                                    {new Date(woff.timestamp).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Sales Breakdown / Audit Section */}
                    <div style={{
                      backgroundColor: t.bg,
                      border: t.border,
                      borderRadius: '20px',
                      padding: '1.5rem',
                      boxShadow: t.shadow,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      gridColumn: isMobile ? 'span 1' : 'span 2',
                      marginTop: '1rem'
                    }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🔎 Auditoria e Detalhamento das Vendas do Período ({String(selectedMonth + 1).padStart(2, '0')}/{selectedYear})
                      </span>
                      <div style={{ fontSize: '0.75rem', color: t.textSecondary }}>
                        Esta tabela lista todas as vendas concluídas consideradas na apuração do faturamento deste período (totalizando R$ {monthlyConcluded.reduce((sum, s) => sum + (Number(s.total || s.valor || 0) / 100), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                      </div>
                      
                      {monthlyConcluded.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: t.textSecondary, fontSize: '0.78rem', fontStyle: 'italic', border: `1px dashed ${t.border}`, borderRadius: '12px' }}>
                          Nenhuma venda concluída registrada neste período.
                        </div>
                      ) : isMobile ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                          {monthlyConcluded.map(s => {
                            const totalPaid = Number(s.total || s.valor || 0) / 100;
                            const finalizedDateStr = s.dataFinalizacao || s.finalizedAt
                              ? new Date(s.dataFinalizacao || s.finalizedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—';
                            return (
                              <div key={s.id} style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                backgroundColor: t.bgSecondary,
                                border: t.border,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                boxShadow: t.shadowSmall
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.8rem', color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
                                    ID: {s.id}
                                  </span>
                                  <span style={{ fontWeight: 900, fontSize: '0.9rem', color: t.accent }}>
                                    R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: t.textSecondary }}>
                                  <span>Fim: {finalizedDateStr}</span>
                                  <span style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    color: '#059669',
                                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase'
                                  }}>
                                    {s.status}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: t.textSecondary, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`, paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                                  <span>Operador: {s.operator || 'Importador'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${t.border}`, textAlign: 'left', color: t.textSecondary }}>
                                <th style={{ padding: '8px' }}>ID da Venda</th>
                                <th style={{ padding: '8px' }}>Operador</th>
                                <th style={{ padding: '8px' }}>Data de Criação</th>
                                <th style={{ padding: '8px' }}>Data de Finalização</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Total Pago</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyConcluded.map(s => {
                                const totalPaid = Number(s.total || s.valor || 0) / 100;
                                return (
                                  <tr key={s.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                    <td style={{ padding: '8px', fontWeight: 600, color: t.textMain }}>{s.id}</td>
                                    <td style={{ padding: '8px' }}>{s.operator || 'Importador'}</td>
                                    <td style={{ padding: '8px' }}>{s.createdAt ? new Date(s.createdAt).toLocaleString('pt-BR') : '—'}</td>
                                    <td style={{ padding: '8px' }}>{s.dataFinalizacao || s.finalizedAt ? new Date(s.dataFinalizacao || s.finalizedAt).toLocaleString('pt-BR') : '—'}</td>
                                    <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, color: '#059669' }}>{s.status}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: t.accent }}>
                                      R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )}

            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* TAB: SIMULAÇÕES & METAS            */}
          {/* ═══════════════════════════════════ */}
          {activeTab === 'projections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>

                {/* Simulator Panel */}
                <div style={{ backgroundColor: t.bg, border: t.border, borderRadius: '20px', padding: '1.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: `${t.accent}18`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sliders size={16} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: t.textMain }}>Simulador de Receita</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: t.textSecondary }}>Ajuste os parâmetros para projetar o crescimento</p>
                    </div>
                  </div>

                  {[
                    { key: 'precoMedio', label: 'Ticket Médio', min: 10, max: 2000, step: 10, prefix: 'R$ ' },
                    { key: 'novosClientesMes', label: 'Novos Clientes / Mês', min: 0, max: 500, step: 1, suffix: ' clientes' },
                    { key: 'churnProjetado', label: 'Churn Projetado', min: 0, max: 30, step: 0.1, suffix: '%' },
                    { key: 'crescimentoBase', label: 'Base de Clientes Atual', min: 0, max: 5000, step: 1, suffix: ' clientes' },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: t.textSecondary }}>{field.label}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {field.prefix && <span style={{ fontSize: '0.85rem', fontWeight: 800, color: t.accent }}>{field.prefix}</span>}
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={sim[field.key]}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setSim(p => ({ ...p, [field.key]: isNaN(val) ? 0 : val }));
                            }}
                            style={{
                              width: '80px',
                              padding: '2px 8px',
                              borderRadius: t.radiusSmall || '6px',
                              border: t.border,
                              backgroundColor: t.bgSecondary,
                              color: t.accent,
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              textAlign: 'right',
                              outline: 'none',
                              fontFamily: 'inherit'
                            }}
                          />
                          {field.suffix && <span style={{ fontSize: '0.85rem', fontWeight: 800, color: t.accent }}>{field.suffix}</span>}
                        </div>
                      </div>
                      <input type="range" min={field.min} max={field.max} step={field.step}
                        value={sim[field.key]}
                        onChange={e => setSim(p => ({ ...p, [field.key]: parseFloat(e.target.value) }))}
                        style={{ width: '100%', accentColor: t.accent, cursor: 'pointer', height: 4 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: t.textSecondary, marginTop: '0.2rem' }}>
                        <span>{field.prefix || ''}{field.min}{field.suffix || ''}</span>
                        <span>{field.prefix || ''}{field.max.toLocaleString('pt-BR')}{field.suffix || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Projection Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: t.textMain }}>Projeções de Crescimento</h3>
                  {[
                    { label: '6 Meses', ...proj6, color: '#6366f1', months: 6 },
                    { label: '12 Meses', ...proj12, color: '#8b5cf6', months: 12 },
                    { label: '24 Meses', ...proj24, color: '#ec4899', months: 24 },
                  ].map(proj => {
                    const mrrProjected = proj.finalClients * sim.precoMedio;
                    return (
                      <motion.div key={proj.label}
                        whileHover={{ y: -2 }}
                        style={{
                          backgroundColor: t.bg, border: `1px solid ${proj.color}30`, borderRadius: '16px',
                          padding: '1.25rem', boxShadow: t.shadow
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Projeção {proj.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: proj.color, letterSpacing: '-0.02em' }}>
                              R$ {proj.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: t.textSecondary }}>Receita Total Acumulada</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: t.textMain }}>{proj.finalClients}</div>
                            <div style={{ fontSize: '0.72rem', color: t.textSecondary }}>clientes ao fim</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: proj.color, marginTop: '0.25rem' }}>R$ {mrrProjected.toLocaleString('pt-BR')}/mês</div>
                            <div style={{ fontSize: '0.72rem', color: t.textSecondary }}>MRR projetado</div>
                          </div>
                        </div>
                        {/* Progress bar showing client growth */}
                        <div style={{ height: 4, backgroundColor: `${proj.color}15`, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            backgroundColor: proj.color,
                            width: `${Math.min((proj.finalClients / (sim.crescimentoBase * 3 || 1)) * 100, 100)}%`,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Goals Section */}
              <div style={{ backgroundColor: t.bg, border: t.border, borderRadius: '20px', padding: '1.75rem', boxShadow: t.shadow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: t.textMain }}>Metas da Empresa</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: t.textSecondary }}>Acompanhe e edite as metas desejadas do negócio</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {goals.map(goal => {
                    const pct = goal.inverse
                      ? Math.max(0, Math.min(100, 100 - ((goal.current - goal.target) / (goal.target || 1)) * 100))
                      : Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
                    const reached = goal.inverse ? goal.current <= goal.target : goal.current >= goal.target;
                    const barColor = reached ? '#10b981' : pct > 65 ? '#f59e0b' : t.accent;
                    const isEditing = editingGoal === goal.id;

                    return (
                      <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: t.textMain }}>{goal.label}</span>
                            {reached && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 99 }}>✓ Meta atingida</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                            {isEditing ? (
                              isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', alignItems: 'flex-end', marginTop: '0.25rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', width: '100%' }}>
                                    <input type="number" defaultValue={goal.current} disabled
                                      id={`goal-current-${goal.id}`}
                                      style={{ width: 75, padding: '4px 8px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', outline: 'none', fontWeight: 700, opacity: 0.65, cursor: 'not-allowed' }} />
                                    <span style={{ color: t.textSecondary, fontSize: '0.8rem' }}>/</span>
                                    <input type="number" defaultValue={goal.target}
                                      id={`goal-target-${goal.id}`}
                                      style={{ width: 75, padding: '4px 8px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', outline: 'none', fontWeight: 700 }} />
                                    <span style={{ color: t.textSecondary, fontSize: '0.75rem' }}>{goal.unit}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button onClick={() => {
                                      const tgt = parseFloat(document.getElementById(`goal-target-${goal.id}`)?.value) || goal.target;
                                      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, target: tgt } : g));
                                      setEditingGoal(null);
                                    }}
                                      style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700 }}>
                                      <Check size={14} /> Salvar
                                    </button>
                                    <button onClick={() => setEditingGoal(null)}
                                      style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700 }}>
                                      <X size={14} /> Fechar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <input type="number" defaultValue={goal.current} disabled
                                    id={`goal-current-${goal.id}`}
                                    style={{ width: 80, padding: '4px 8px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', outline: 'none', fontWeight: 700, opacity: 0.65, cursor: 'not-allowed' }} />
                                  <span style={{ color: t.textSecondary, fontSize: '0.8rem' }}>/</span>
                                  <input type="number" defaultValue={goal.target}
                                    id={`goal-target-${goal.id}`}
                                    style={{ width: 80, padding: '4px 8px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem', outline: 'none', fontWeight: 700 }} />
                                  <span style={{ color: t.textSecondary, fontSize: '0.75rem' }}>{goal.unit}</span>
                                  <button onClick={() => {
                                    const tgt = parseFloat(document.getElementById(`goal-target-${goal.id}`)?.value) || goal.target;
                                    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, target: tgt } : g));
                                    setEditingGoal(null);
                                  }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 4, outline: 'none' }}>
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => setEditingGoal(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, outline: 'none' }}>
                                    <X size={16} />
                                  </button>
                                </>
                              )
                            ) : (
                              <>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: t.textMain }}>
                                  {goal.unit}{goal.current.toLocaleString('pt-BR')} / {goal.unit}{goal.target.toLocaleString('pt-BR')}
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: barColor }}>{pct.toFixed(0)}%</span>
                                <button onClick={() => setEditingGoal(goal.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, padding: 4, opacity: 0.6, outline: 'none', transition: 'opacity 0.2s' }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                                  <Edit3 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ height: 8, backgroundColor: `${barColor}15`, borderRadius: 99, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            style={{ height: '100%', borderRadius: 99, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Reports;
