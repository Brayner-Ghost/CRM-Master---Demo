import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { decryptLegacySale, decryptActiveSale, decryptSensitiveFields } from '../utils/crypto';
import { useUser } from '../context/UserContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Users, DollarSign, Package, Tag, Calendar,
  ArrowUpRight, Clock, CheckCircle2, XCircle, Cake,
  ShoppingBag, AlertTriangle, ChevronDown, Loader2, Filter, Info,
  TrendingUp, History, MessageSquare, Zap, UserPlus, MapPin,
  Settings, Save, X, ArrowUp, ArrowDown, Maximize2, Minimize2, Trash2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '../components/LoadingScreen';


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

const Dashboard = () => {
  const { t, currentTheme } = useTheme();
  const { user, getTenantCollection, getTenantDoc } = useUser();
  
  
  const [isEditing, setIsEditing] = useState(false);
  const [locationInfo, setLocationInfo] = useState({ city: 'Carregando...', timezone: '' });
  
  const DEFAULT_LAYOUT = [
    { id: 'stat_cards', type: 'stats', label: 'Indicadores Rápidos', visible: true, width: 'full' },
    { id: 'yearly_profit', type: 'full_chart', label: 'Lucro, Receita e Custo Mensal (Histrograma 1 Ano)', visible: true, width: 'full' },
    { id: 'sales_evolution', type: 'grid_2', label: 'Evolução de Vendas', visible: true, width: 'full' },
    { id: 'product_performance', type: 'grid_3', label: 'Desempenho de Produtos', visible: true, width: 'full' },
    { id: 'inventory_customers', type: 'grid_3_alt', label: 'Estoque e Clientes', visible: true, width: 'full' },
    { id: 'referrals', type: 'full_chart', label: 'Ranking de Indicações', visible: true, width: 'full' },
    { id: 'history_birthdays', type: 'grid_2_1', label: 'Histórico e Aniversários', visible: true, width: 'full' }
  ];

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [referralMonthFilter, setReferralMonthFilter] = useState('all');

  const [data, setData] = useState({
    stats: [],
    salesSummary: {
      dayCount: 0, dayTotal: 0,
      concluded: 0, concludedTotal: 0,
      pending: 0, pendingTotal: 0,
      canceled: 0,
      totalCount: 0, totalAmount: 0
    },
    financialSummary: {
      revendaTotal: 0,
      custoAcumulado: 0,
      itensLoja: 0,
      itensParceiro: 0,
      variedade: 0
    },
    birthdays: [],
    activeCoupons: [],
    lastSales: [],
    lowStock: [],
    expiringSoon: [],
    customerStatus: { active: 0, inactive: 0 },
    profit: { monthly: 0, total: 0 },
    systemAlerts: [],
    charts: {
      topSold: [],
      leastSold: [],
      monthlyPerformance: [],
      dailyEvolution: [],
      referrals: [],
      referralsMonths: [],
      yearlyProfit: []
    }
  });

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Try a CORS-friendly geolocation service first
        const response = await fetch('https://freeipapi.com/api/json');
        if (response.ok) {
          const data = await response.json();
          setLocationInfo({
            city: data.cityName || 'Desconhecido',
            region: data.regionName || '',
            timezone: data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
          });
          return;
        }
      } catch (err) {
        console.warn("freeipapi failed, falling back to ipapi.co...", err);
      }

      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setLocationInfo({
          city: data.city || 'Desconhecido',
          region: data.region || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
      } catch (e) {
        setLocationInfo({ city: 'São Paulo', region: 'SP', timezone: 'America/Sao_Paulo' });
      }
    };
    fetchLocation();
  }, []);

  const saveLayout = async (newLayout) => {
    if (!user?.id) return;
    try {
      await updateDoc(getTenantDoc('users', user.id), {
        dashboardLayout: JSON.stringify(newLayout)
      });
      setIsEditing(false);
    } catch (e) {
      console.error("Save layout error:", e);
      alert("Erro ao salvar layout.");
    }
  };

  const moveItem = (index, direction) => {
    const newLayout = [...layout];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newLayout.length) return;
    [newLayout[index], newLayout[newIndex]] = [newLayout[newIndex], newLayout[index]];
    setLayout(newLayout);
  };

  const toggleWidth = (index) => {
    const newLayout = [...layout];
    newLayout[index].width = newLayout[index].width === 'full' ? 'half' : 'full';
    setLayout(newLayout);
  };

  const formatCurrency = (val) => {
    return (Number(val || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };


  const fetchData = async () => {
    try {
      setLoading(true);

      const [salesSnap, contactsSnap, inventorySnap, couponsSnap, legacySnap, partnersSnap, userSnap] = await Promise.all([
        getDocs(query(getTenantCollection('sales'), orderBy('createdAt', 'desc'))),
        getDocs(getTenantCollection('contacts')),
        getDocs(getTenantCollection('inventory')),
        getDocs(getTenantCollection('coupons')),
        getDocs(getTenantCollection('legacy')),
        getDocs(getTenantCollection('partners')),
        user?.id ? getDoc(getTenantDoc('users', user.id)) : Promise.resolve(null)
      ]);

      if (userSnap?.exists()) {
        const userData = userSnap.data();
        if (userData.dashboardLayout) {
          try {
            const parsed = JSON.parse(userData.dashboardLayout);
            // Filter out any items that are no longer in DEFAULT_LAYOUT
            const merged = parsed.filter(item => DEFAULT_LAYOUT.some(def => def.id === item.id));
            DEFAULT_LAYOUT.forEach(defItem => {
              if (!merged.some(m => m.id === defItem.id)) {
                merged.push(defItem);
              }
            });
            setLayout(merged);
          } catch (e) { console.error("Parse layout error:", e); }
        }
      }

      const currentSales = salesSnap.docs.map(d => {
        const raw = { id: d.id, ...d.data() };
        return decryptActiveSale(raw);
      });
      const allContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allInventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allProducts = allInventory.filter(p => p.type !== 'promotion');
      const allCoupons = couponsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const legacyRaw = legacySnap.docs.map(docSnap => {
        const raw = { id: docSnap.id, ...docSnap.data() };
        return decryptLegacySale(raw);
      });
      const isConcluded = (status) => {
        const norm = String(status || '').toLowerCase().trim();
        return ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(norm);
      };

      const legacySales = legacyRaw.filter(s => isConcluded(s.status));

      const allSales = [...currentSales, ...legacySales]
        .filter(s => isConcluded(s.status))
        .map(s => ({
          ...s,
          parsedDate: parseFlexibleDate(s.dataFinalizacao || s.finalizedAt || s.createdAt || s.dataVenda || s.data || 0)
        }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let filteredSales = allSales;
      if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start) : new Date(0);
        const end = dateRange.end ? new Date(dateRange.end) : new Date();
        end.setHours(23, 59, 59, 999);
        filteredSales = allSales.filter(s => s.parsedDate >= start && s.parsedDate <= end);
      }

      const todaySales = allSales.filter(s => s.parsedDate >= today);

      const PARTNER_SENSITIVE_FIELDS = ['tipo', 'email', 'telefone'];
      const allPartners = partnersSnap.docs.map(d => {
        const rawData = { id: d.id, ...d.data() };
        return decryptSensitiveFields(rawData, PARTNER_SENSITIVE_FIELDS);
      });

      const summaryStats = {
        clients: allContacts.length,
        sales: allSales.length,
        coupons: allCoupons.filter(c => c.status === 'ativo').length,
        products: allProducts.length
      };

      const targetSales = (dateRange.start || dateRange.end) ? filteredSales : todaySales;
      const salesSummary = {
        dayCount: todaySales.length,
        dayTotal: todaySales.reduce((acc, s) => acc + (Number(s.total || s.valor || 0)), 0),
        concluded: targetSales.filter(s => ['concluido', 'concluida', 'Aprovada', 'concluída'].includes(s.status)).length,
        concludedTotal: targetSales.filter(s => ['concluido', 'concluida', 'Aprovada', 'concluída'].includes(s.status)).reduce((acc, s) => acc + (Number(s.total || s.valor || 0)), 0),
        pending: targetSales.filter(s => s.status === 'pendente').length,
        pendingTotal: targetSales.filter(s => s.status === 'pendente').reduce((acc, s) => acc + (Number(s.total || s.valor || 0)), 0),
        canceled: targetSales.filter(s => ['cancelado', 'cancelada'].includes(s.status)).length,
        totalCount: targetSales.length,
        totalAmount: targetSales.reduce((acc, s) => acc + (Number(s.total || s.valor || 0)), 0)
      };

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const concludedSales = allSales.filter(s => isConcluded(s.status));

      const revenueToday = concludedSales.filter(s => s.parsedDate >= startOfToday).reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);
      const revenueWeek = concludedSales.filter(s => s.parsedDate >= startOfWeek).reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);
      const revenueMonth = concludedSales.filter(s => s.parsedDate >= startOfMonth).reduce((acc, s) => acc + Number(s.total || s.valor || 0), 0);

      const financialSummary = {
        revendaTotal: allProducts.reduce((acc, p) => {
          const qty = Number(p.estoque || 0) + (p.estoqueParceiros || []).reduce((a, ep) => a + Number(ep.quantity || 0), 0);
          return acc + (qty * Number(p.precoVenda || 0));
        }, 0),
        custoAcumulado: allProducts.reduce((acc, p) => {
          const qty = Number(p.estoque || 0) + (p.estoqueParceiros || []).reduce((a, ep) => a + Number(ep.quantity || 0), 0);
          return acc + (qty * Number(p.precoCusto || 0));
        }, 0),
        itensLoja: allProducts.reduce((acc, p) => acc + Number(p.estoque || 0), 0),
        itensParceiro: allProducts.reduce((acc, p) => acc + (p.estoqueParceiros || []).reduce((a, ep) => a + Number(ep.quantity || 0), 0), 0),
        variedade: allProducts.length,
        revenueToday,
        revenueWeek,
        revenueMonth
      };

      const birthdays = allContacts.filter(c => {
        if (!c.dataNascimento) return false;
        const bDay = new Date(c.dataNascimento);
        const nextBday = new Date(today.getFullYear(), bDay.getMonth(), bDay.getDate());
        if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
        const diff = nextBday - today;
        return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
      }).sort((a, b) => {
        const da = new Date(a.dataNascimento);
        const db = new Date(b.dataNascimento);
        return da.getMonth() - db.getMonth() || da.getDate() - db.getDate();
      }).slice(0, 10);

      const activeCoupons = allCoupons.filter(c => c.status === 'ativo').slice(0, 10);
      const lastSales = allSales.filter(s => !s.isLegacy).slice(0, 8);

      // Low Stock & Velocity Alerts calculation
      const sixtyDaysAgo = today.getTime() - 60 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = today.getTime() - 30 * 24 * 60 * 60 * 1000;

      const salesLast60Days = allSales.filter(s => 
        s.parsedDate.getTime() >= sixtyDaysAgo && 
        ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())
      );

      const sales30dMap = {};
      const sales60dMap = {};

      salesLast60Days.forEach(s => {
        const isWithin30d = s.parsedDate.getTime() >= thirtyDaysAgo;
        const items = s.items || s.produtos || [];
        items.forEach(it => {
          const name = it.nome || it.name || it.produto || 'Desconhecido';
          const qty = Number(it.quantity || it.quantidade || 1);
          
          sales60dMap[name] = (sales60dMap[name] || 0) + qty;
          if (isWithin30d) {
            sales30dMap[name] = (sales30dMap[name] || 0) + qty;
          }
        });
      });

      const systemAlerts = [];
      const lowStockAlerts = [];

      allProducts.forEach(p => {
        const qty = Number(p.estoque || 0) + (p.estoqueParceiros || []).reduce((a, ep) => a + Number(ep.quantity || 0), 0);
        const name = p.nome || p.name || 'Sem nome';
        
        const sales30 = sales30dMap[name] || 0;
        const sales60 = sales60dMap[name] || 0;
        
        // 1. Expiration check for systemAlerts (validade próxima) - only if stock is available (qty > 0)
        if (p.validade && qty > 0) {
          const exp = new Date(p.validade);
          const diff = exp - today;
          const daysToExpire = Math.ceil(diff / (24 * 60 * 60 * 1000));
          if (daysToExpire <= 60) { // within 60 days
            systemAlerts.push({
              id: `exp-${p.id}`,
              type: 'expiry',
              title: 'Validade Próxima',
              description: `Produto "${name.toUpperCase()}" com ${qty} un. vence em ${daysToExpire} dias (${new Date(p.validade).toLocaleDateString('pt-BR')})`,
              severity: daysToExpire <= 10 ? 'high' : 'medium',
              date: p.validade,
              sales60
            });
          }
        }

        // Rule: if stock is 0 and no sales in last 60 days, do NOT show
        if (qty === 0 && sales60 === 0) {
          return;
        }

        const dailyVelocity = sales30 / 30;
        const threshold = Number(p.estoqueMinimo || p.estoqueAlerta || 5);
        let isLowAlert = false;
        let riskReason = '';

        if (qty <= threshold) {
          isLowAlert = true;
          riskReason = qty === 0 ? 'Sem estoque' : 'Estoque baixo';
        }

        // 2. High-Sales stock risk check (risco de baixo estoque por vendas altas) - only if qty > 0
        if (qty > 0 && dailyVelocity > 0) {
          const daysRemaining = qty / dailyVelocity;
          if (daysRemaining <= 7) {
            isLowAlert = true;
            riskReason = `Risco alto: acaba em ${Math.ceil(daysRemaining)} dias`;
            systemAlerts.push({
              id: `velocity-${p.id}`,
              type: 'velocity_risk',
              title: 'Risco de Ruptura',
              description: `Produto "${name.toUpperCase()}" tem saída alta (${sales30} un/mês). Estoque atual (${qty} un) deve durar apenas ~${Math.ceil(daysRemaining)} dias.`,
              severity: daysRemaining <= 3 ? 'high' : 'medium',
              sales60
            });
          }
        }

        // 3. Low stock threshold alert - only if qty > 0 and qty <= threshold
        if (qty > 0 && qty <= threshold) {
          const alreadyHasVelocityRisk = systemAlerts.some(a => a.id === `velocity-${p.id}`);
          if (!alreadyHasVelocityRisk) {
            systemAlerts.push({
              id: `lowstock-${p.id}`,
              type: 'low_stock',
              title: 'Estoque Baixo',
              description: `Produto "${name.toUpperCase()}" está com estoque crítico (${qty} un). Mínimo recomendado: ${threshold} un.`,
              severity: qty <= 2 ? 'high' : 'medium',
              sales60
            });
          }
        }

        if (isLowAlert) {
          lowStockAlerts.push({
            ...p,
            totalEstoque: qty,
            sales30,
            sales60,
            reason: riskReason
          });
        }
      });

      // Sort lowStockAlerts so that lowest stock comes first
      lowStockAlerts.sort((a, b) => {
        const ta = Number(a.estoque || 0) + (a.estoqueParceiros || []).reduce((acc, ep) => acc + Number(ep.quantity || 0), 0);
        const tb = Number(b.estoque || 0) + (b.estoqueParceiros || []).reduce((acc, ep) => acc + Number(ep.quantity || 0), 0);
        return ta - tb;
      });
      const lowStock = lowStockAlerts.slice(0, 10);

      // Sort systemAlerts based on high-sales risk (sales in last 60 days) and severity
      systemAlerts.sort((a, b) => {
        const scoreA = (a.sales60 || 0) + (a.severity === 'high' ? 1000 : 0);
        const scoreB = (b.sales60 || 0) + (b.severity === 'high' ? 1000 : 0);
        return scoreB - scoreA;
      });

      const expiringSoon = allProducts.filter(p => {
        if (!p.validade) return false;
        const exp = new Date(p.validade);
        const diff = exp - today;
        return diff > 0 && diff <= 60 * 24 * 60 * 60 * 1000;
      }).sort((a, b) => new Date(a.validade) - new Date(b.validade)).slice(0, 10);

      const getSaleCostAndRevenue = (s) => {
        const revenue = Number(s.total || s.valor || 0);
        let cost = Number(s.totalCost || s.custo || s.precoCusto || 0);
        if (cost === 0) {
          const items = s.items || s.produtos || [];
          items.forEach(it => {
            cost += Number(it.precoCusto || it.cost || 0) * Number(it.quantity || it.quantidade || 1);
          });
        }
        return { revenue, cost, profit: revenue - cost };
      };

      // Profit Calculation (Monthly)
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      let monthlyProfit = 0;
      allSales.filter(s => s.parsedDate.getMonth() === currentMonth && s.parsedDate.getFullYear() === currentYear && ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())).forEach(s => {
        const { profit } = getSaleCostAndRevenue(s);
        monthlyProfit += profit;
      });

      // Daily Evolution (Current Month)
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        total: 0
      }));

      allSales.filter(s => s.parsedDate.getMonth() === currentMonth && s.parsedDate.getFullYear() === currentYear && ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())).forEach(s => {
        const d = s.parsedDate.getDate();
        if (dailyData[d - 1]) {
          dailyData[d - 1].total += Number(s.total || s.valor || 0);
        }
      });

      // First and last purchase dates per client across allSales (current + legacy), respecting purchase status 'concluido'
      const clientFirstPurchase = {};
      const clientLastPurchase = {};
      
      concludedSales.forEach(s => {
        const name = (s.client?.nome || s.cliente || s.clientName || s.clienteNome || '').toLowerCase().trim();
        if (name && name !== 'consumidor') {
          const saleTime = s.parsedDate.getTime();
          
          if (!clientFirstPurchase[name] || saleTime < clientFirstPurchase[name]) {
            clientFirstPurchase[name] = saleTime;
          }
          if (!clientLastPurchase[name] || saleTime > clientLastPurchase[name]) {
            clientLastPurchase[name] = saleTime;
          }
        }
      });

      // Ensure all contacts are in clientLastPurchase even if no sales exist
      allContacts.forEach(c => {
        const name = (c.nome || '').toLowerCase().trim();
        if (name && name !== 'consumidor' && !clientLastPurchase[name]) {
          clientLastPurchase[name] = 0;
          clientFirstPurchase[name] = 0;
        }
      });

      // Calculate Novos Clientes count based on dateRange or current month
      let newClientsCount = 0;
      if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start).getTime() : 0;
        const end = dateRange.end ? new Date(dateRange.end).setHours(23, 59, 59, 999) : Infinity;
        newClientsCount = Object.values(clientFirstPurchase).filter(time => time >= start && time <= end).length;
      } else {
        const start = new Date(currentYear, currentMonth, 1).getTime();
        const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();
        newClientsCount = Object.values(clientFirstPurchase).filter(time => time >= start && time <= end).length;
      }

      // Calculate customerStatus (Active vs Inactive) based on dateRange or last 60 days
      let activeCount = 0;
      let inactiveCount = 0;

      if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start).getTime() : 0;
        const end = dateRange.end ? new Date(dateRange.end).setHours(23, 59, 59, 999) : Infinity;
        
        const activeSet = new Set();
        filteredSales.filter(s => ['concluido', 'concluida', 'Aprovada', 'concluída'].includes(s.status)).forEach(s => {
          const name = (s.client?.nome || s.cliente || s.clientName || s.clienteNome || '').toLowerCase().trim();
          if (name && name !== 'consumidor') {
            activeSet.add(name);
          }
        });
        
        activeCount = activeSet.size;
        inactiveCount = Math.max(0, Object.keys(clientLastPurchase).length - activeCount);
      } else {
        const sixtyDaysAgoTime = today.getTime() - 60 * 24 * 60 * 60 * 1000;
        Object.entries(clientLastPurchase).forEach(([name, lastTime]) => {
          if (lastTime >= sixtyDaysAgoTime) {
            activeCount++;
          } else {
            inactiveCount++;
          }
        });
      }

      const customerStatus = {
        active: activeCount,
        inactive: inactiveCount
      };

      // Best & Least Sold side-by-side monthly intelligence
      const currentMonthSales = allSales.filter(s => 
        s.parsedDate.getMonth() === currentMonth && 
        s.parsedDate.getFullYear() === currentYear && 
        ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())
      );

      let prevMonth = currentMonth - 1;
      let prevYear = currentYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear = currentYear - 1;
      }

      const prevMonthSales = allSales.filter(s => 
        s.parsedDate.getMonth() === prevMonth && 
        s.parsedDate.getFullYear() === prevYear && 
        ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())
      );

      const currentProdMap = {};
      currentMonthSales.forEach(s => {
        const items = s.items || s.produtos || [];
        items.forEach(it => {
          const name = it.nome || it.name || it.produto || 'Desconhecido';
          currentProdMap[name] = (currentProdMap[name] || 0) + Number(it.quantity || it.quantidade || 1);
        });
      });

      const prevProdMap = {};
      prevMonthSales.forEach(s => {
        const items = s.items || s.produtos || [];
        items.forEach(it => {
          const name = it.nome || it.name || it.produto || 'Desconhecido';
          prevProdMap[name] = (prevProdMap[name] || 0) + Number(it.quantity || it.quantidade || 1);
        });
      });

      // Top Sold comparison (Current vs Previous month)
      const topCurrent = Object.entries(currentProdMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topPrev = Object.entries(prevProdMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topProductNames = Array.from(new Set([
        ...topCurrent.map(([name]) => name),
        ...topPrev.map(([name]) => name)
      ])).slice(0, 6);

      const topSold = topProductNames.map(name => ({
        name,
        current: currentProdMap[name] || 0,
        prev: prevProdMap[name] || 0
      }));

      // Least Sold comparison (Current vs Previous month) - only products sold in at least one of the months
      const leastCurrent = Object.entries(currentProdMap)
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5);
      const leastPrev = Object.entries(prevProdMap)
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5);
      const leastProductNames = Array.from(new Set([
        ...leastCurrent.map(([name]) => name),
        ...leastPrev.map(([name]) => name)
      ])).slice(0, 6);

      const leastSold = leastProductNames.map(name => ({
        name,
        current: currentProdMap[name] || 0,
        prev: prevProdMap[name] || 0
      }));

      const monthData = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        monthData[key] = { name: key, total: 0, count: 0 };
      }

      allSales.filter(s => ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(String(s.status || '').toLowerCase().trim())).forEach(s => {
        const key = s.parsedDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        if (monthData[key]) {
          monthData[key].total += Number(s.total || s.valor || 0);
          monthData[key].count += 1;
        }
      });

      const partnersMap = {};
      partnersSnap.docs.forEach(d => {
        const p = d.data();
        partnersMap[d.id] = { name: p.name, type: p.type || 'parceiro' };
      });

      // Dynamic list of months for the selector
      const availableMonthsMap = {};
      concludedSales.forEach(s => {
        if (s.parsedDate && !isNaN(s.parsedDate.getTime()) && s.parsedDate.getFullYear() > 2000) {
          const y = s.parsedDate.getFullYear();
          const m = s.parsedDate.getMonth();
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const label = s.parsedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
          const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
          availableMonthsMap[key] = capitalizedLabel;
        }
      });
      const referralsMonths = Object.entries(availableMonthsMap)
        .map(([key, label]) => {
          const [year, month] = key.split('-').map(Number);
          return { key, label, year, month };
        })
        .sort((a, b) => b.year - a.year || b.month - a.month);

      const refCountMap = {};
      concludedSales.forEach(s => {
        const refName = String(s.partnerName || s.indicacao || '').trim().toLowerCase();
        if (refName) {
          refCountMap[refName] = (refCountMap[refName] || 0) + 1;
        }
      });

      let targetReferralSales = concludedSales;
      if (referralMonthFilter !== 'all') {
        const [year, month] = referralMonthFilter.split('-').map(Number);
        targetReferralSales = concludedSales.filter(s => {
          return s.parsedDate.getFullYear() === year && s.parsedDate.getMonth() === month;
        });
      }

      const refCountMapFiltered = {};
      targetReferralSales.forEach(s => {
        const refName = String(s.partnerName || s.indicacao || '').trim().toLowerCase();
        if (refName) {
          refCountMapFiltered[refName] = (refCountMapFiltered[refName] || 0) + 1;
        }
      });

      const athletes = allPartners.filter(p => p.tipo === 'atleta' || p.tipo === 'indicacao_alerta');
      const athletePoints = athletes.reduce((acc, curr) => {
        const points = refCountMap[String(curr.name || '').trim().toLowerCase()] || 0;
        return acc + points;
      }, 0);
      
      const partnerPoints = allPartners.filter(p => p.tipo !== 'atleta' && p.tipo !== 'indicacao_alerta').reduce((acc, curr) => {
        const points = refCountMap[String(curr.name || '').trim().toLowerCase()] || 0;
        return acc + points;
      }, 0);

      const statCards = [
        { label: 'Lucro Mensal', value: formatCurrency(monthlyProfit), icon: TrendingUp, color: '#10b981', isCurrency: true },
        { label: 'Pontos Parceiros', value: partnerPoints, icon: Users, color: '#3b82f6' },
        { label: 'Pontos Atletas', value: athletePoints, icon: Zap, color: '#f59e0b' },
        { label: 'Novos Clientes', value: newClientsCount, icon: UserPlus, color: '#8b5cf6' }
      ];

      const refMap = {};
      allPartners.forEach(p => {
        const typeLabel = (p.tipo === 'atleta' || p.tipo === 'indicacao_alerta') ? ' (Atleta)' : ' (Parceiro)';
        let displayName = p.name || '';
        if (displayName.length > 18) {
          displayName = displayName.substring(0, 16) + '..';
        }
        const points = refCountMapFiltered[String(p.name || '').trim().toLowerCase()] || 0;
        refMap[displayName + typeLabel] = points;
      });
      const referrals = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

      // Past 12 Months Histogram Calculation for Revenue, Cost, and Profit
      const past12Months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getMonth()}-${d.getFullYear()}`;
        const nameRaw = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
        past12Months.push({
          key,
          name,
          revenue: 0,
          cost: 0,
          profit: 0
        });
      }

      allSales.filter(s => {
        const statusClean = String(s.status || '').toLowerCase().trim();
        return ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado'].includes(statusClean);
      }).forEach(s => {
        const key = `${s.parsedDate.getMonth()}-${s.parsedDate.getFullYear()}`;
        const monthObj = past12Months.find(m => m.key === key);
        if (monthObj) {
          const { revenue, cost, profit } = getSaleCostAndRevenue(s);
          monthObj.revenue += revenue;
          monthObj.cost += cost;
          monthObj.profit += profit;
        }
      });

      const yearlyProfit = past12Months.map(m => ({
        name: m.name,
        Receita: Number((m.revenue / 100).toFixed(2)),
        Custo: Number((m.cost / 100).toFixed(2)),
        Lucro: Number((m.profit / 100).toFixed(2))
      }));

      setData({
        stats: statCards,
        salesSummary,
        financialSummary,
        birthdays,
        activeCoupons,
        lastSales,
        lowStock,
        expiringSoon,
        customerStatus,
        profit: { monthly: monthlyProfit },
        systemAlerts,
        charts: {
          topSold,
          leastSold,
          monthlyPerformance: Object.values(monthData),
          dailyEvolution: dailyData,
          referrals,
          referralsMonths,
          yearlyProfit
        }
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, referralMonthFilter]);

  const Card = ({ children, style = {} }) => (
    <div style={{
      backgroundColor: t.card,
      borderRadius: t.radius,
      padding: '1.5rem',
      boxShadow: t.shadow,
      border: t.border,
      ...style
    }}>
      {children}
    </div>
  );

  const SectionHeader = ({ title, icon: Icon, color = t.accent }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
      <div style={{
        padding: '10px',
        borderRadius: '12px',
        backgroundColor: `${color}15`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={20} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: t.textMain, margin: 0 }}>{title}</h3>
    </div>
  );

  if (loading) return <LoadingScreen message="Carregando Analytics..." />;

  const LayoutControl = ({ index }) => (
    <div style={{
      position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 10,
      backgroundColor: t.bg, padding: '6px', borderRadius: '12px', border: t.border,
      boxShadow: t.shadowSmall
    }}>
      <button onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMain }} title="Mover para cima"><ArrowUp size={14}/></button>
      <button onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMain }} title="Mover para baixo"><ArrowDown size={14}/></button>
      <button onClick={(e) => { e.stopPropagation(); toggleWidth(index); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.accent }} title="Mudar tamanho">
        {layout[index].width === 'full' ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
      </button>
      <button onClick={(e) => { e.stopPropagation(); const nl = [...layout]; nl[index].visible = false; setLayout(nl); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Ocultar"><Trash2 size={14}/></button>
    </div>
  );

  return (
    <div style={{ padding: '0.25rem 0.75rem', backgroundColor: t.bgSecondary, minHeight: '100vh', color: t.textMain }}>
      {/* Standardized Header (Matching Inventory.jsx) */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: t.textMain, margin: 0, letterSpacing: '-0.02em' }}>Dashboard Analytics</h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', border: t.border, backgroundColor: t.bg, color: t.textMain, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', boxShadow: t.shadowSmall }}>
                  <Settings size={16} /> Personalizar
                </button>
              ) : (
                <>
                  <button onClick={() => saveLayout(layout)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', boxShadow: t.shadowSmall }}>
                    <Save size={16} /> Salvar Layout
                  </button>
                  <button onClick={() => { setIsEditing(false); fetchData(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', border: t.border, backgroundColor: t.bg, color: t.textMain, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', boxShadow: t.shadowSmall }}>
                    <X size={16} /> Cancelar
                  </button>
                  <button onClick={() => setLayout(DEFAULT_LAYOUT)} style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Resetar</button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              backgroundColor: t.bg, border: t.border, padding: '0.6rem 1.25rem', borderRadius: t.radiusSmall, boxShadow: t.shadowSmall, display: 'flex', alignItems: 'center', gap: '0.75rem'
            }}>
              <Calendar size={18} color={t.accent} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.textMain }}>{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{
              backgroundColor: t.bg, border: t.border, padding: '0.6rem 1.25rem', borderRadius: t.radiusSmall, boxShadow: t.shadowSmall, display: 'flex', alignItems: 'center', gap: '0.75rem'
            }}>
              <MapPin size={18} color={t.accent} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.textMain }}>{locationInfo.city}, {locationInfo.region}</span>
                <span style={{ fontWeight: 500, fontSize: '0.6rem', color: t.textSecondary }}>{locationInfo.timezone}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(12, 1fr)', 
          gap: '2.5rem' 
        }}>
          {layout.filter(item => item.visible).map((item, index) => {
            const gridSpan = item.width === 'full' ? 'span 12' : 'span 6';
            
            return (
              <div key={item.id} className="layout-item" style={{ 
                gridColumn: gridSpan, 
                position: 'relative',
                transition: 'all 0.3s ease'
              }}>
                {isEditing && <LayoutControl index={index} />}
                {isEditing && <div className="edit-overlay" />}
                
                {item.id === 'stat_cards' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    {data.stats.map((item, i) => (
                      <div key={`${item.id}-${i}-${item.label}`} style={{ minWidth: 0 }}>
                        <Card style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                              <span style={{ fontSize: item.isCurrency ? '1.5rem' : '2rem', fontWeight: 600, color: t.textMain, letterSpacing: '-0.02em' }}>{item.value}</span>
                            </div>
                            <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: `${item.color}15`, color: item.color }}>
                              <item.icon size={24} />
                            </div>
                          </div>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', backgroundColor: `${item.color}20` }}>
                            <div style={{ width: '100%', height: '100%', backgroundColor: item.color }} />
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}



                {item.id === 'yearly_profit' && (
                  <Card>
                    <SectionHeader title="Lucro, Receita e Custo Mensal (Histrograma 1 Ano)" icon={DollarSign} color="#10b981" />
                    <div style={{ height: '350px', marginTop: '1rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.charts.yearlyProfit} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 11, fill: t.textMain }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 11, fill: t.textSecondary }} tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: t.shadowLg }} formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontWeight: 600 }} />
                          <Bar dataKey="Receita" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Custo" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Lucro" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {item.id === 'sales_evolution' && (
                  <div style={{ display: 'grid', gridTemplateColumns: item.width === 'full' ? '1fr 1fr' : '1fr', gap: '2rem' }}>
                    <Card>
                      <SectionHeader title="Resumo de Vendas (Intervalo)" icon={Calendar} color={t.accent} />
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.7rem', color: t.textSecondary, marginBottom: '6px' }}>INÍCIO</label>
                          <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: t.border, fontWeight: 500, outline: 'none', fontSize: '0.9rem' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.7rem', color: t.textSecondary, marginBottom: '6px' }}>FIM</label>
                          <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: t.border, fontWeight: 500, outline: 'none', fontSize: '0.9rem' }} />
                        </div>
                        <button onClick={() => setDateRange({ start: '', end: '' })} style={{ padding: '10px 20px', backgroundColor: t.textMain, color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '12px', height: '42px' }}>Limpar</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        {[
                          { label: 'Hoje', val: data.salesSummary.dayCount, amt: data.salesSummary.dayTotal, col: '#3b82f6' },
                          { label: 'Concluídas', val: data.salesSummary.concluded, amt: data.salesSummary.concludedTotal, col: '#10b981' },
                          { label: 'Pendentes', val: data.salesSummary.pending, amt: data.salesSummary.pendingTotal, col: '#f59e0b' },
                          { label: 'Total Filtro', val: data.salesSummary.totalCount, amt: data.salesSummary.totalAmount, col: t.accent }
                        ].map((s, i) => (
                          <div key={`sales-stat-${i}-${s.label}`} style={{ padding: '1rem', borderRadius: '16px', backgroundColor: `${s.col}08`, border: `1px solid ${s.col}15` }}>
                            <div style={{ fontWeight: 600, fontSize: '0.7rem', color: t.textSecondary, marginBottom: '4px' }}>{s.label}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: t.textMain }}>{s.val}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.col }}>{formatCurrency(s.amt)}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Evolução de Vendas (Mês Atual)" icon={TrendingUp} color="#10b981" />
                      <div style={{ height: '280px', marginTop: '1rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.charts.dailyEvolution}>
                            <defs>
                              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.border} />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: t.textSecondary }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: t.textSecondary }} tickFormatter={(v) => `R$${v / 1000}k`} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: t.shadowLg }} labelFormatter={(v) => `Dia ${v}`} formatter={(v) => [formatCurrency(v), 'Total']} />
                            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                )}

                {item.id === 'product_performance' && (
                  <div style={{ display: 'grid', gridTemplateColumns: item.width === 'full' ? '1fr 1fr 1fr' : '1fr', gap: '2rem' }}>
                    <Card>
                      <SectionHeader title="Produtos Mais Vendidos" icon={TrendingUp} color="#10b981" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.charts.topSold.map((p, i) => (
                          <div key={`top-sold-${p.name}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.75rem', borderRadius: t.radiusSmall, backgroundColor: t.bgSecondary }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: t.textMain }}>{p.name.toUpperCase()}</span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                              <span style={{ color: t.textSecondary }}>Mês Anterior: <strong style={{ color: t.textMain }}>{p.prev} un</strong></span>
                              <span style={{ color: '#10b981' }}>Mês Atual: <strong>{p.current} un</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Produtos Menos Vendidos" icon={AlertTriangle} color="#f59e0b" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.charts.leastSold.map((p, i) => (
                          <div key={`least-sold-${p.name}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.75rem', borderRadius: t.radiusSmall, backgroundColor: t.bgSecondary, border: t.border }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: t.textMain }}>{p.name.toUpperCase()}</span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                              <span style={{ color: t.textSecondary }}>Mês Anterior: <strong style={{ color: t.textMain }}>{p.prev} un</strong></span>
                              <span style={{ color: '#f59e0b' }}>Mês Atual: <strong>{p.current} un</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Cupons Ativos" icon={Tag} color="#8b5cf6" />
                      <div className="space-y-3">
                        {data.activeCoupons.map((c, i) => (
                          <div key={`coupon-${c.codigo}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: t.radiusSmall, border: t.border }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#5b21b6' }}>{c.codigo}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>{c.tipo === 'percentual' ? `${c.valor}%` : formatCurrency(c.valor)} de desconto</span>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#7c3aed' }}>{c.usos || 0}/{c.cota || '∞'}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}

                {item.id === 'inventory_customers' && (
                  <div style={{ display: 'grid', gridTemplateColumns: item.width === 'full' ? '1fr 1fr 1fr' : '1fr', gap: '2rem' }}>
                    <Card>
                      <SectionHeader title="Status de Clientes" icon={Users} color="#2563eb" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: '18px', backgroundColor: t.accentSoft, border: `1px solid ${t.accent}20`, textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.7rem', color: t.accent, textTransform: 'uppercase' }}>Ativos</div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: t.accent, marginTop: '4px' }}>{data.customerStatus.active}</div>
                        </div>
                        <div style={{ padding: '1.25rem', borderRadius: '18px', backgroundColor: t.bgSecondary, border: t.border, textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.7rem', color: t.textSecondary, textTransform: 'uppercase' }}>Inativos</div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, marginTop: '4px' }}>{data.customerStatus.inactive}</div>
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Resumo de Estoque" icon={Package} color="#f59e0b" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                          { label: 'Hoje', val: formatCurrency(data.financialSummary.revenueToday || 0) },
                          { label: 'Semana', val: formatCurrency(data.financialSummary.revenueWeek || 0) },
                          { label: 'Mês', val: formatCurrency(data.financialSummary.revenueMonth || 0) }
                        ].map((s, i) => (
                          <div key={`fin-summary-${i}-${s.label}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', backgroundColor: `${t.pending}15`, border: `1px solid ${t.pending}30` }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.pending }}>{s.label}:</span>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.pending }}>{s.val}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Baixo Estoque" icon={AlertTriangle} color="#ef4444" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '180px' }}>
                        {data.lowStock.map((p, i) => {
                          const total = Number(p.estoque || 0) + (p.estoqueParceiros || []).reduce((a, ep) => a + Number(ep.quantity || 0), 0);
                          return (
                            <div key={`low-stock-${p.id || i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: '12px', backgroundColor: `${t.danger}15`, border: `1px solid ${t.danger}30` }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.danger }}>{p.nome}</span>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.danger }}>{total} un</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                )}

                {item.id === 'referrals' && (
                  <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          padding: '10px',
                          borderRadius: '12px',
                          backgroundColor: `${t.accent}15`,
                          color: t.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Users size={20} />
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Ranking de Indicações (Atletas e Parceiros)</h3>
                      </div>
                      
                      {/* Filtro de Mês/Ano */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} color={t.textSecondary} />
                        <select
                          value={referralMonthFilter}
                          onChange={(e) => setReferralMonthFilter(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: t.border,
                            backgroundColor: t.bg,
                            color: t.textMain,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            outline: 'none',
                            cursor: 'pointer',
                            boxShadow: t.shadowSmall
                          }}
                        >
                          <option value="all">Todo o Período</option>
                          {data.charts.referralsMonths && data.charts.referralsMonths.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ height: '350px', marginTop: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {data.charts.referrals && data.charts.referrals.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.charts.referrals} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={t.border} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: t.textSecondary }} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: t.textMain }} width={170} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: t.shadowLg }} formatter={(v) => [`${v} pontos`, 'Pontuação']} />
                            <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                              {data.charts.referrals.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index < 3 ? t.accent : '#94a3b8'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem 1rem', color: t.textSecondary }}>
                          <Users size={48} color={t.accent} style={{ marginBottom: '1rem', opacity: 0.7 }} />
                          <span style={{ fontWeight: 750, fontSize: '0.9rem', color: t.textMain }}>Nenhuma indicação registrada ainda.</span>
                          <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Pontuações de parceiros e atletas aparecerão aqui conforme as vendas indicadas forem concluídas.</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {item.id === 'history_birthdays' && (
                  <div style={{ display: 'grid', gridTemplateColumns: item.width === 'full' ? '2fr 1fr' : '1fr', gap: '2rem' }}>
                    <Card>
                      <SectionHeader title="Últimas Vendas" icon={History} color="#10b981" />
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: `2px solid ${t.bgSecondary}` }}>
                              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.7rem', color: t.textSecondary }}>DATA</th>
                              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.7rem', color: t.textSecondary }}>CLIENTE</th>
                              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.7rem', color: t.textSecondary }}>STATUS</th>
                              <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.7rem', color: t.textSecondary }}>TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.lastSales.map((s, i) => (
                              <tr key={`sale-${s.id || i}`} style={{ borderBottom: `1px solid ${t.bgSecondary}` }}>
                                <td style={{ padding: '12px 8px', fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                                <td style={{ padding: '12px 8px', fontSize: '0.85rem', fontWeight: 600, color: t.textMain }}>{s.client?.nome || s.cliente || s.clientName || 'Consumidor'}</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', backgroundColor: `${s.status === 'concluido' ? '#10b981' : '#f59e0b'}15`, color: s.status === 'concluido' ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>{s.status}</span>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: t.textMain }}>{formatCurrency(s.total || s.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                    <Card>
                      <SectionHeader title="Próximos Aniversários" icon={Cake} color="#ec4899" />
                      <div className="space-y-4">
                        {data.birthdays.map((b, i) => (
                          <div key={`bday-${b.id || i}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', backgroundColor: `${t.accent}15`, border: `1px solid ${t.accent}30` }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cake size={20}/></div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: t.textMain }}>{b.nome}</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary }}>{new Date(b.dataNascimento).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      <style>{`
        .layout-item { transition: all 0.3s ease; }
        .edit-overlay { 
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(37, 99, 235, 0.05); 
          border: 2px dashed #2563eb; 
          border-radius: 24px; 
          pointer-events: none; 
          z-index: 5;
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Dashboard;

