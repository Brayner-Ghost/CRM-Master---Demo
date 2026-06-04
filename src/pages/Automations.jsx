import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, Plus, Zap, Trash2, Edit3, 
  Bell, Mail, MessageSquare, Database, 
  ArrowRight, Clock, ChevronRight, Settings,
  Sparkles, ShieldAlert, Calendar, Check, Send, Loader2,
  X, AlertTriangle, Play, HelpCircle, ArrowDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { doc, getDoc, setDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { decryptData } from '../utils/crypto';

const Automations = () => {
  const { t, currentTheme } = useTheme();
  const { user } = useUser();
  const tenantId = user?.empresa || 'development';

  const [activeTab, setActiveTab] = useState('ia'); // ia, geral, whatsapp, instagram
  const [whatsappStatus, setWhatsappStatus] = useState({ status: 'disconnected', qr: null, number: '', name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Post-Sales Automations State
  const [posSalesConfig, setPosSalesConfig] = useState({
    enabled: true,
    scheduleType: 'weekday', // 'weekday' | 'days_interval'
    weekdays: [1, 2, 3, 4, 5], // 1=Segunda, 2=Terça, etc.
    daysInterval: 7,
    firstPurchaseTemplate: 'Olá {nome}! Obrigado por realizar sua primeira compra no CRM Master. Seu pedido de ID {venda_id} no valor de R$ {total} foi concluído com sucesso. Esperamos ver você novamente em breve!',
    returningTemplate: 'Olá {nome}! Ficamos muito felizes em ver você de volta! Agradecemos pela preferência. Seu novo pedido de ID {venda_id} no valor de R$ {total} foi concluído. Obrigado pelo retorno!'
  });
  const [processedMessages, setProcessedMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // General Automations State loaded from Firestore
  const [automations, setAutomations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);

  // Block Builder Modal State
  const [autoName, setAutoName] = useState('');
  const [autoTrigger, setAutoTrigger] = useState('estoque_baixo');
  const [autoConditionField, setAutoConditionField] = useState('estoque');
  const [autoConditionOperator, setAutoConditionOperator] = useState('<');
  const [autoConditionValue, setAutoConditionValue] = useState('10');
  const [autoAction, setAutoAction] = useState('notificar_admin');
  const [autoColor, setAutoColor] = useState('#ef4444');

  // AI & ML Rules State
  const [aiRules, setAiRules] = useState({
    ignoreZeroStock30Days: true,
    zeroStockDaysThreshold: 30,
    minProfitMarginEnabled: true,
    minProfitMargin: 15,
    expiringSoonPriorityEnabled: true,
    expiringDaysThreshold: 30,
    velocityPriorityEnabled: true
  });

  // Default seeded automations if none found in DB
  const defaultAutomations = [
    { id: '1', name: 'Boas-vindas WhatsApp', trigger: 'novo_contato', conditionField: 'tipo', conditionOperator: '==', conditionValue: 'Lead', action: 'enviar_whatsapp', status: 'active', color: '#10b981' },
    { id: '2', name: 'Alerta de Estoque Baixo', trigger: 'estoque_baixo', conditionField: 'estoque', conditionOperator: '<', conditionValue: '5', action: 'notificar_admin', status: 'active', color: '#ef4444' },
    { id: '3', name: 'Follow-up de Venda', trigger: 'venda_concluida', conditionField: 'total', conditionOperator: '>', conditionValue: '100', action: 'enviar_email', status: 'paused', color: '#3b82f6' },
  ];

  // Load everything on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Load AI rules
        const aiRulesRef = doc(db, `business/${tenantId}/settings/ai_rules`);
        const aiSnap = await getDoc(aiRulesRef);
        if (aiSnap.exists()) {
          setAiRules(prev => ({ ...prev, ...aiSnap.data() }));
        }

        // 2. Load general automations
        const autoRef = doc(db, `business/${tenantId}/settings/automations`);
        const autoSnap = await getDoc(autoRef);
        if (autoSnap.exists() && autoSnap.data().list) {
          setAutomations(autoSnap.data().list);
        } else {
          // Seed defaults
          await setDoc(autoRef, { list: defaultAutomations });
          setAutomations(defaultAutomations);
        }

        // 3. Load Post-Sales config
        const posRef = doc(db, `business/${tenantId}/settings/pos_vendas`);
        const posSnap = await getDoc(posRef);
        if (posSnap.exists()) {
          setPosSalesConfig(prev => ({ ...prev, ...posSnap.data() }));
        }
      } catch (e) {
        console.error("Erro ao carregar dados de automações do Firestore:", e);
      } finally {
        setIsLoading(false);
      }
    };
    if (tenantId) fetchData();
  }, [tenantId]);

  // Listen to local WhatsApp connection state in Firestore
  useEffect(() => {
    if (activeTab !== 'whatsapp') return;
    const docRef = doc(db, `business/${tenantId}/settings/whatsapp_connection`);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setWhatsappStatus(docSnap.data());
      } else {
        setWhatsappStatus({ status: 'disconnected', qr: null, number: '', name: '' });
      }
    }, (err) => {
      console.warn("Could not listen to WhatsApp status, Firestore path might not be created yet:", err);
    });
    return unsub;
  }, [activeTab, tenantId]);

  const handleConnectWhatsapp = async () => {
    alert('Modo de Demonstração: A conexão de WhatsApp está desabilitada.');
    return;
  };

  const handleDisconnectWhatsapp = async () => {
    alert('Modo de Demonstração: A desconexão de WhatsApp está desabilitada.');
    return;
  };

  // Toast helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Save AI Rules to Firestore
  const handleSaveAiRules = async () => {
    alert('Modo de Demonstração: O salvamento das regras de IA está desabilitado.');
    return;
  };

  const getFirstName = (fullName) => {
    if (!fullName) return 'Cliente';
    const first = fullName.trim().split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const handleSavePosSalesConfig = async () => {
    alert('Modo de Demonstração: O salvamento da configuração de pós-vendas está desabilitado.');
    return;
  };

  const processPostSales = async () => {
    setIsProcessing(true);
    try {
      const salesSnap = await getDocs(getTenantCollection('sales'));
      const rawSales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const allSales = rawSales.map(sale => {
        const decrypted = { ...sale };
        if (decrypted.client) {
          decrypted.client = {
            ...decrypted.client,
            nome: decrypted.client.nome ? (decryptData(decrypted.client.nome) || decrypted.client.nome) : '',
            telefone: decrypted.client.telefone ? (decryptData(decrypted.client.telefone) || decrypted.client.telefone) : '',
            cpf: decrypted.client.cpf ? (decryptData(decrypted.client.cpf) || decrypted.client.cpf) : ''
          };
        }
        return decrypted;
      });

      const concluded = allSales.filter(s => s.status === 'concluido');

      let filtered = [];
      if (posSalesConfig.scheduleType === 'weekday') {
        filtered = concluded.filter(sale => {
          if (!sale.createdAt) return false;
          const date = new Date(sale.createdAt);
          const day = date.getDay();
          return posSalesConfig.weekdays.includes(day);
        });
      } else {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - posSalesConfig.daysInterval);
        filtered = concluded.filter(sale => {
          if (!sale.createdAt) return false;
          const date = new Date(sale.createdAt);
          return date >= limitDate;
        });
      }

      const messages = [];

      for (const sale of filtered) {
        if (!sale.client?.telefone) continue;

        const customerPhone = sale.client.telefone.replace(/\D/g, '');
        if (!customerPhone) continue;

        const saleDate = new Date(sale.createdAt || 0);
        const previousSales = concluded.filter(s => {
          if (s.id === sale.id) return false;
          const sPhone = s.client?.telefone ? s.client.telefone.replace(/\D/g, '') : '';
          const sDate = new Date(s.createdAt || 0);
          return sPhone === customerPhone && sDate < saleDate;
        });

        const isFirstPurchase = previousSales.length === 0;
        const firstName = getFirstName(sale.client.nome);

        const template = isFirstPurchase 
          ? posSalesConfig.firstPurchaseTemplate 
          : posSalesConfig.returningTemplate;

        const totalFormatted = (Number(sale.total || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const messageText = template
          .replace(/{nome}/g, firstName)
          .replace(/{total}/g, totalFormatted)
          .replace(/{venda_id}/g, sale.id.slice(-6).toUpperCase())
          .replace(/{compras_qtd}/g, String(previousSales.length + 1));

        messages.push({
          saleId: sale.id,
          date: sale.createdAt,
          clientName: sale.client.nome || 'Consumidor',
          firstName,
          phone: customerPhone,
          total: sale.total,
          type: isFirstPurchase ? 'first' : 'return',
          message: messageText
        });
      }

      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setProcessedMessages(messages);
    } catch (e) {
      console.error("Erro ao processar pós-vendas:", e);
      alert("Erro ao processar histórico de vendas.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pos_vendas' && tenantId) {
      processPostSales();
    }
  }, [activeTab, tenantId, posSalesConfig.scheduleType, posSalesConfig.weekdays, posSalesConfig.daysInterval]);

  // Save Automations List to Firestore
  const saveAutomationsToDb = async (updatedList) => {
    try {
      const docRef = doc(db, `business/${tenantId}/settings/automations`);
      await setDoc(docRef, { list: updatedList });
      setAutomations(updatedList);
    } catch (e) {
      console.error("Erro ao persistir automações no Firestore:", e);
    }
  };

  // Toggle single automation status
  const handleToggleStatus = async (id) => {
    alert('Modo de Demonstração: A alteração de status de automações está desabilitada.');
    return;
  };

  // Delete an automation
  const handleDeleteAutomation = async (id) => {
    alert('Modo de Demonstração: A exclusão de automações está desabilitada.');
    return;
  };

  // Open modal for editing
  const handleOpenEdit = (auto) => {
    setEditingAutomation(auto);
    setAutoName(auto.name);
    setAutoTrigger(auto.trigger);
    setAutoConditionField(auto.conditionField);
    setAutoConditionOperator(auto.conditionOperator);
    setAutoConditionValue(auto.conditionValue);
    setAutoAction(auto.action);
    setAutoColor(auto.color);
    setIsModalOpen(true);
  };

  // Open modal for new
  const handleOpenCreate = () => {
    setEditingAutomation(null);
    setAutoName('');
    setAutoTrigger('estoque_baixo');
    setAutoConditionField('estoque');
    setAutoConditionOperator('<');
    setAutoConditionValue('10');
    setAutoAction('notificar_admin');
    setAutoColor('#ef4444');
    setIsModalOpen(true);
  };

  // Save changes from Block modal
  const handleSaveBlockAutomation = async (e) => {
    e.preventDefault();
    alert('Modo de Demonstração: A criação e edição de automações estão desabilitadas.');
    return;
  };

  // Trigger helper humanizations
  const humanizeTrigger = (t) => {
    const map = {
      novo_contato: 'Se um novo contato for cadastrado',
      estoque_baixo: 'Se o estoque físico de um produto estiver crítico',
      venda_concluida: 'Quando uma venda for concluída com sucesso',
      estoque_zerado: 'Quando o estoque físico de um item zerar'
    };
    return map[t] || t;
  };

  const humanizeCondition = (field, op, val) => {
    const fields = { estoque: 'Estoque', precoVenda: 'Preço Venda', margemLucro: 'Margem de Lucro', total: 'Valor Total Venda' };
    return `${fields[field] || field} ${op} ${val}`;
  };

  const humanizeAction = (a) => {
    const map = {
      enviar_whatsapp: 'Enviar mensagem no WhatsApp do cliente',
      notificar_admin: 'Notificar Admin / Gerente do CRM',
      enviar_email: 'Enviar notificação automática de e-mail',
      filtrar_ia: 'Ocultar item de análises gerais da IA',
      priorizar_venda: 'Priorizar produto para queima de estoque na IA'
    };
    return map[a] || a;
  };

  const tabs = [
    { id: 'ia', label: 'IA & Machine Learning', icon: Cpu },
    { id: 'geral', label: 'Geral (Auto-Flow)', icon: Zap },
    { id: 'pos_vendas', label: 'Pós-Vendas', icon: MessageSquare },
    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: MessageSquare }
  ];

  return (
    <div style={{ fontFamily: 'inherit' }}>
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
        <AlertTriangle size={18} />
        <span>Modo de Demonstração: A criação, edição e exclusão de automações e regras estão desabilitadas.</span>
      </div>

      {/* Dynamic Theme Page Header (Standardized CSS with system style) */}
      <header className="crm-header" style={{
        backgroundColor: t.bgSecondary,
        padding: '0.75rem 1.25rem',
        borderRadius: t.radiusMedium,
        border: t.border,
        marginBottom: '2rem'
      }}>
        {/* Left: Title & Sub-tabs */}
        <div className="crm-header-left">
          <h1 className="crm-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={24} style={{ color: t.accent }} /> Automações
          </h1>
          <div style={{ display: 'flex', gap: 4, backgroundColor: t.bg, padding: 4, borderRadius: t.radiusSmall, border: t.border, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '6px 12px', border: 'none', borderRadius: t.radiusSmall,
                    backgroundColor: isActive ? t.accentSoft : 'transparent',
                    color: isActive ? t.accent : t.textSecondary,
                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
                  }}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="crm-header-right">
          {activeTab === 'geral' && (
            <button 
              disabled={true}
              onClick={handleOpenCreate}
              style={{ 
                height: '38px', padding: '0 1rem', backgroundColor: '#cbd5e1', color: '#94a3b8',
                border: 'none', borderRadius: t.radiusSmall, fontWeight: 600, fontSize: '0.8rem',
                cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: t.shadowSmall, transition: 'all 0.2s'
              }}
            >
              <Plus size={16} /> Nova Automação
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
              backgroundColor: '#10b981', color: '#fff', padding: '1rem 1.5rem',
              borderRadius: '12px', boxShadow: t.shadow, display: 'flex', alignItems: 'center', gap: '10px',
              fontWeight: 600, fontSize: '0.9rem'
            }}
          >
            <Check size={18} /> {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tab Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: t.accent }} />
        </div>
      ) : (
        <div style={{ minHeight: '400px' }}>
          {/* TAB 1: IA & ML RULES */}
          {activeTab === 'ia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Mecanismo de Ajuste da IA e Machine Learning</h3>
                  <p style={{ fontSize: '0.8rem', color: t.textSecondary, margin: 0, fontWeight: 500 }}>
                    Configure regras comportamentais estruturadas para o Gemini. A IA usará estas diretrizes estritas ao processar dados de estoque e formular propostas de vendas.
                  </p>
                </div>
              </div>

              {/* Grid of Blocks (Standard card design system style) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* Block: Estoque Zerado */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem', padding: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Database size={13} /> Filtro de Dados
                      </span>
                      {/* Toggle */}
                      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={aiRules.ignoreZeroStock30Days}
                          onChange={(e) => setAiRules(prev => ({ ...prev, ignoreZeroStock30Days: e.target.checked }))}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: aiRules.ignoreZeroStock30Days ? t.accent : '#cbd5e1',
                          transition: '0.3s', borderRadius: '24px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                            transform: aiRules.ignoreZeroStock30Days ? 'translateX(20px)' : 'none'
                          }} />
                        </span>
                      </label>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Ignorar Estoque Zerado</h4>
                    <p style={{ fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.4, margin: 0 }}>
                      Ignora automaticamente das consultas gerais da IA produtos sem estoque físico há mais de X dias, a menos que solicitado de forma explícita.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border }}>
                    <Clock size={15} color={t.textSecondary} />
                    <span style={{ fontSize: '0.8rem', color: t.textMain, fontWeight: 700 }}>Remover se zerado há:</span>
                    <input 
                      type="number" 
                      value={aiRules.zeroStockDaysThreshold}
                      onChange={(e) => setAiRules(prev => ({ ...prev, zeroStockDaysThreshold: Number(e.target.value) }))}
                      disabled={!aiRules.ignoreZeroStock30Days}
                      style={{
                        width: '45px', padding: '4px', borderRadius: '6px', border: t.border,
                        backgroundColor: t.bg, color: t.textMain, fontWeight: 700, textAlign: 'center', outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 600 }}>dias</span>
                  </div>
                </div>

                {/* Block: Margem de Lucro Crítica */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem', padding: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={13} /> Regra de Negócio
                      </span>
                      {/* Toggle */}
                      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={aiRules.minProfitMarginEnabled}
                          onChange={(e) => setAiRules(prev => ({ ...prev, minProfitMarginEnabled: e.target.checked }))}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: aiRules.minProfitMarginEnabled ? '#f59e0b' : '#cbd5e1',
                          transition: '0.3s', borderRadius: '24px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                            transform: aiRules.minProfitMarginEnabled ? 'translateX(20px)' : 'none'
                          }} />
                        </span>
                      </label>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Segurança de Margem</h4>
                    <p style={{ fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.4, margin: 0 }}>
                      Impede e alerta a IA para que ela nunca sugira descontos ou promoções para produtos que possuam margem bruta de lucro inferior ao mínimo tolerado.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border }}>
                    <ShieldAlert size={15} color={t.textSecondary} />
                    <span style={{ fontSize: '0.8rem', color: t.textMain, fontWeight: 700 }}>Margem mínima de:</span>
                    <input 
                      type="number" 
                      value={aiRules.minProfitMargin}
                      onChange={(e) => setAiRules(prev => ({ ...prev, minProfitMargin: Number(e.target.value) }))}
                      disabled={!aiRules.minProfitMarginEnabled}
                      style={{
                        width: '45px', padding: '4px', borderRadius: '6px', border: t.border,
                        backgroundColor: t.bg, color: t.textMain, fontWeight: 700, textAlign: 'center', outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 600 }}>%</span>
                  </div>
                </div>

                {/* Block: Vencimento Prioritário */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem', padding: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} /> Foco Comercial
                      </span>
                      {/* Toggle */}
                      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={aiRules.expiringSoonPriorityEnabled}
                          onChange={(e) => setAiRules(prev => ({ ...prev, expiringSoonPriorityEnabled: e.target.checked }))}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: aiRules.expiringSoonPriorityEnabled ? '#ef4444' : '#cbd5e1',
                          transition: '0.3s', borderRadius: '24px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                            transform: aiRules.expiringSoonPriorityEnabled ? 'translateX(20px)' : 'none'
                          }} />
                        </span>
                      </label>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Priorizar Lote Expirando</h4>
                    <p style={{ fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.4, margin: 0 }}>
                      Orienta a IA do CRM a priorizar ativamente sugestões de queima de estoque e campanhas de liquidação para itens com vencimento próximo.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border }}>
                    <Calendar size={15} color={t.textSecondary} />
                    <span style={{ fontSize: '0.8rem', color: t.textMain, fontWeight: 700 }}>Vencendo em menos de:</span>
                    <input 
                      type="number" 
                      value={aiRules.expiringDaysThreshold}
                      onChange={(e) => setAiRules(prev => ({ ...prev, expiringDaysThreshold: Number(e.target.value) }))}
                      disabled={!aiRules.expiringSoonPriorityEnabled}
                      style={{
                        width: '45px', padding: '4px', borderRadius: '6px', border: t.border,
                        backgroundColor: t.bg, color: t.textMain, fontWeight: 700, textAlign: 'center', outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 600 }}>dias</span>
                  </div>
                </div>

                {/* Block: Giro de Estoque */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem', padding: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={13} /> Machine Learning
                      </span>
                      {/* Toggle */}
                      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={aiRules.velocityPriorityEnabled}
                          onChange={(e) => setAiRules(prev => ({ ...prev, velocityPriorityEnabled: e.target.checked }))}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: aiRules.velocityPriorityEnabled ? '#3b82f6' : '#cbd5e1',
                          transition: '0.3s', borderRadius: '24px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                            transform: aiRules.velocityPriorityEnabled ? 'translateX(20px)' : 'none'
                          }} />
                        </span>
                      </label>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Giro e Reposição</h4>
                    <p style={{ fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.4, margin: 0 }}>
                      Habilita o motor de análise de giro local (velocidade de vendas) para que a IA recomende reposição rápida de estoque assim que os itens atingirem níveis críticos.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border }}>
                    <Check size={15} color="#3b82f6" />
                    <span style={{ fontSize: '0.8rem', color: t.textMain, fontWeight: 700 }}>
                      {aiRules.velocityPriorityEnabled ? 'Análise de Velocidade Local Ativa' : 'Análise de Velocidade Local Inativa'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  onClick={handleSaveAiRules}
                  disabled={isSaving}
                  style={{
                    height: '44px', padding: '0 1.5rem', backgroundColor: t.accent, color: t.accentContrast,
                    border: 'none', borderRadius: t.radiusSmall, fontWeight: 700, fontSize: '0.85rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: t.shadowSmall, transition: 'all 0.2s'
                  }}
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
                  Salvar Configurações da IA
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL AUTOMATIONS LIST */}
          {activeTab === 'geral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {automations.map((auto, index) => (
                  <motion.div
                    key={auto.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="card"
                    style={{
                      padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '2rem',
                      position: 'relative', overflow: 'hidden'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', 
                      backgroundColor: auto.color 
                    }} />

                    {/* Left: Info */}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: t.textMain, marginBottom: '0.75rem' }}>{auto.name}</h3>
                      
                      {/* Blocks Flow Representation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                          backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border,
                          fontSize: '0.75rem', fontWeight: 600, color: t.textMain
                        }}>
                          <Clock size={13} style={{ color: t.accent }} />
                          <span style={{ color: t.textSecondary }}>SE:</span> {humanizeTrigger(auto.trigger)}
                        </div>
                        <ArrowRight size={14} style={{ color: t.textSecondary }} />
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                          backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border,
                          fontSize: '0.75rem', fontWeight: 600, color: t.textMain
                        }}>
                          <ShieldAlert size={13} style={{ color: '#f59e0b' }} />
                          <span style={{ color: t.textSecondary }}>E:</span> {humanizeCondition(auto.conditionField, auto.conditionOperator, auto.conditionValue)}
                        </div>
                        <ArrowRight size={14} style={{ color: t.textSecondary }} />
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                          backgroundColor: t.bgSecondary, borderRadius: '8px', border: t.border,
                          fontSize: '0.75rem', fontWeight: 600, color: t.textMain
                        }}>
                          <Zap size={13} style={{ color: auto.color }} />
                          <span style={{ color: t.textSecondary }}>ENTÃO:</span> {humanizeAction(auto.action)}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: t.textSecondary, marginBottom: '0.25rem', letterSpacing: '0.04em' }}>STATUS</div>
                        <button
                          onClick={() => handleToggleStatus(auto.id)}
                          style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', 
                            borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                            backgroundColor: auto.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                            color: auto.status === 'active' ? '#10b981' : '#64748b',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ 
                            width: '6px', height: '6px', borderRadius: '50%', 
                            backgroundColor: auto.status === 'active' ? '#10b981' : '#64748b' 
                          }} />
                          {auto.status === 'active' ? 'ATIVO' : 'PAUSADO'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button 
                          onClick={() => handleOpenEdit(auto)}
                          style={{ 
                            width: '38px', height: '38px', borderRadius: '10px', border: t.border,
                            backgroundColor: t.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: t.textMain, transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bg}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteAutomation(auto.id)}
                          style={{ 
                            width: '38px', height: '38px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)',
                            backgroundColor: 'rgba(239,68,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#ef4444', transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

              </div>

              {/* Templates Block */}
              <div style={{ 
                padding: '2rem', border: `2px dashed ${t.border.split('#')[1] ? '#' + t.border.split('#')[1] : t.border}`, borderRadius: t.radiusMedium,
                textAlign: 'center', backgroundColor: t.bg
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, marginBottom: '0.75rem' }}>Precisa de inspiração?</h3>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Alerta Compra Crítica', trigger: 'estoque_baixo', field: 'estoque', op: '<', val: '2', action: 'notificar_admin', color: '#f59e0b' },
                    { name: 'Alerta Venda VIP', trigger: 'venda_concluida', field: 'total', op: '>', val: '500', action: 'enviar_whatsapp', color: '#10b981' }
                  ].map(temp => (
                    <button
                      key={temp.name}
                      onClick={async () => {
                        const updated = [...automations, { ...temp, id: String(Date.now()), status: 'active' }];
                        await saveAutomationsToDb(updated);
                        triggerToast("Template de automação carregado!");
                      }}
                      style={{ 
                        padding: '8px 16px', backgroundColor: t.bgSecondary, border: t.border, borderRadius: '10px',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: t.textMain, transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.accentSoft; e.currentTarget.style.borderColor = t.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.bgSecondary; e.currentTarget.style.borderColor = t.border; }}
                    >
                      Carregar: {temp.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: POST-SALES AUTO-FLOW */}
          {activeTab === 'pos_vendas' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* CONFIGURATION COLUMN */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Regras do Auto-Flow Pós-Vendas</h3>
                    <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0 }}>Defina gatilhos e templates de mensagens.</p>
                  </div>
                </div>

                <div style={{ borderTop: t.border, paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Schedule Type Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                      Modo de Agendamento
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setPosSalesConfig(prev => ({ ...prev, scheduleType: 'weekday' }))}
                        style={{
                          flex: 1, height: '38px', borderRadius: '8px', border: posSalesConfig.scheduleType === 'weekday' ? `2px solid ${t.accent}` : t.border,
                          backgroundColor: posSalesConfig.scheduleType === 'weekday' ? t.accentSoft : 'transparent',
                          color: posSalesConfig.scheduleType === 'weekday' ? t.accent : t.textSecondary,
                          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Dias da Semana
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosSalesConfig(prev => ({ ...prev, scheduleType: 'days_interval' }))}
                        style={{
                          flex: 1, height: '38px', borderRadius: '8px', border: posSalesConfig.scheduleType === 'days_interval' ? `2px solid ${t.accent}` : t.border,
                          backgroundColor: posSalesConfig.scheduleType === 'days_interval' ? t.accentSoft : 'transparent',
                          color: posSalesConfig.scheduleType === 'days_interval' ? t.accent : t.textSecondary,
                          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Últimos X Dias
                      </button>
                    </div>
                  </div>

                  {/* Conditional Schedule Fields */}
                  {posSalesConfig.scheduleType === 'weekday' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                        Executar nos Dias da Semana
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dayLabel, idx) => {
                          const isSelected = posSalesConfig.weekdays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const newWeekdays = isSelected
                                  ? posSalesConfig.weekdays.filter(d => d !== idx)
                                  : [...posSalesConfig.weekdays, idx];
                                setPosSalesConfig(prev => ({ ...prev, weekdays: newWeekdays }));
                              }}
                              style={{
                                width: '32px', height: '32px', borderRadius: '8px', border: isSelected ? `2px solid ${t.accent}` : t.border,
                                backgroundColor: isSelected ? t.accent : 'transparent',
                                color: isSelected ? t.accentContrast : t.textSecondary,
                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s'
                              }}
                              title={['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][idx]}
                            >
                              {dayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                        Período Histórico (Últimos X Dias)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={posSalesConfig.daysInterval}
                          onChange={(e) => setPosSalesConfig(prev => ({ ...prev, daysInterval: parseInt(e.target.value) || 1 }))}
                          style={{
                            width: '80px', height: '38px', padding: '0 8px', borderRadius: '8px',
                            border: t.border, backgroundColor: t.bg, color: t.textMain,
                            fontWeight: 700, fontSize: '0.9rem', textAlign: 'center', outline: 'none'
                          }}
                        />
                        <span style={{ fontSize: '0.85rem', color: t.textSecondary, fontWeight: 500 }}>
                          Buscar vendas concluídas nos últimos {posSalesConfig.daysInterval} dias
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Template 1: Primeira Compra */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                      Modelo: Primeira Compra
                    </label>
                    <textarea
                      value={posSalesConfig.firstPurchaseTemplate}
                      onChange={(e) => setPosSalesConfig(prev => ({ ...prev, firstPurchaseTemplate: e.target.value }))}
                      rows="4"
                      placeholder="Template para novos clientes..."
                      style={{
                        width: '100%', padding: '10px', borderRadius: '8px',
                        border: t.border, backgroundColor: t.bg, color: t.textMain,
                        fontSize: '0.85rem', fontWeight: 600, resize: 'vertical', outline: 'none', lineHeight: 1.4
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {['{nome}', '{total}', '{venda_id}'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setPosSalesConfig(prev => ({
                              ...prev,
                              firstPurchaseTemplate: prev.firstPurchaseTemplate + ' ' + tag
                            }));
                          }}
                          style={{
                            padding: '2px 8px', borderRadius: '4px', border: t.border, backgroundColor: t.bgSecondary,
                            color: t.textSecondary, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template 2: Cliente Retorno */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                      Modelo: Cliente Retorno
                    </label>
                    <textarea
                      value={posSalesConfig.returningTemplate}
                      onChange={(e) => setPosSalesConfig(prev => ({ ...prev, returningTemplate: e.target.value }))}
                      rows="4"
                      placeholder="Template para clientes recorrentes..."
                      style={{
                        width: '100%', padding: '10px', borderRadius: '8px',
                        border: t.border, backgroundColor: t.bg, color: t.textMain,
                        fontSize: '0.85rem', fontWeight: 600, resize: 'vertical', outline: 'none', lineHeight: 1.4
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {['{nome}', '{total}', '{venda_id}', '{compras_qtd}'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setPosSalesConfig(prev => ({
                              ...prev,
                              returningTemplate: prev.returningTemplate + ' ' + tag
                            }));
                          }}
                          style={{
                            padding: '2px 8px', borderRadius: '4px', border: t.border, backgroundColor: t.bgSecondary,
                            color: t.textSecondary, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={handleSavePosSalesConfig}
                    disabled={isSaving}
                    style={{
                      height: '42px', width: '100%', backgroundColor: t.accent, color: t.accentContrast,
                      border: 'none', borderRadius: t.radiusSmall, fontWeight: 700, fontSize: '0.85rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: t.shadowSmall, transition: 'all 0.2s', marginTop: '0.5rem'
                    }}
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Salvar Configurações
                  </button>

                </div>
              </div>

              {/* GENERATED MESSAGES COLUMN */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#10b98115', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Mensagens de Pós-Vendas</h3>
                      <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0 }}>Fila gerada automaticamente.</p>
                    </div>
                  </div>

                  <button
                    onClick={processPostSales}
                    disabled={isProcessing}
                    style={{
                      height: '32px', padding: '0 0.75rem', backgroundColor: t.bgSecondary, color: t.textMain,
                      border: t.border, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Recalcular
                  </button>
                </div>

                <div style={{ borderTop: t.border, paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '680px', overflowY: 'auto' }}>
                  {isProcessing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '10px' }}>
                      <Loader2 size={30} className="animate-spin" style={{ color: t.accent }} />
                      <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 600 }}>Processando histórico de vendas...</span>
                    </div>
                  ) : processedMessages.length === 0 ? (
                    <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: t.textSecondary, backgroundColor: t.bgSecondary, borderRadius: '12px', border: `1px dashed ${t.border.split('#')[1] ? '#' + t.border.split('#')[1] : t.border}` }}>
                      <AlertTriangle size={24} style={{ color: '#f59e0b', marginBottom: '8px' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: t.textMain, marginBottom: '4px' }}>Nenhuma mensagem qualificada</div>
                      <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                        Nenhuma venda concluída com telefone atende aos filtros configurados.
                      </p>
                    </div>
                  ) : (
                    processedMessages.map((msg, idx) => (
                      <div
                        key={msg.saleId || idx}
                        style={{
                          backgroundColor: t.bgSecondary, borderRadius: '12px', border: t.border, padding: '1rem',
                          display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.85rem' }}>{msg.clientName}</div>
                            <div style={{ fontSize: '0.7rem', color: t.textSecondary, marginTop: '2px', fontWeight: 500 }}>
                              Wpp: {msg.phone} · Venda: {msg.saleId.slice(-6).toUpperCase()} · R$ {(Number(msg.total || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900,
                            backgroundColor: msg.type === 'first' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: msg.type === 'first' ? '#10b981' : '#3b82f6'
                          }}>
                            {msg.type === 'first' ? '1ª COMPRA' : 'RETORNO'}
                          </span>
                        </div>

                        <div style={{
                          backgroundColor: t.bg, borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem',
                          color: t.textMain, border: t.border, lineHeight: 1.4, whiteSpace: 'pre-wrap', fontStyle: 'italic'
                        }}>
                          {msg.message}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => {
                              let formattedPhone = msg.phone.replace(/\D/g, '');
                              if (formattedPhone.length === 11 && !formattedPhone.startsWith('55')) {
                                formattedPhone = '55' + formattedPhone;
                              }
                              const wppUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg.message)}`;
                              window.open(wppUrl, '_blank');
                            }}
                            style={{
                              height: '32px', padding: '0 0.85rem', backgroundColor: '#25d366', color: '#fff',
                              border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(37,211,102,0.2)'
                            }}
                          >
                            <MessageSquare size={13} fill="currentColor" /> Enviar WhatsApp
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: DIRECT WHATSAPP CONNECTION */}
          {activeTab === 'whatsapp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={22} style={{ color: '#10b981' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Integração de Dispositivo WhatsApp Direct</h3>
                  <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, fontWeight: 500 }}>
                    Conecte seu WhatsApp corporativo diretamente ao CRM Master usando o QR Code. Isso permite receber mensagens e responder de forma 100% direta, sincronizada em tempo real com o Atendimentos.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                {(whatsappStatus.status === 'disconnected' || !whatsappStatus.status) && (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: t.bgSecondary, border: t.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>
                        <MessageSquare size={36} />
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', border: `3px solid ${t.bgSecondary}` }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Dispositivo Desconectado</h4>
                      <p style={{ fontSize: '0.85rem', color: t.textSecondary, lineHeight: 1.5, margin: 0, maxWidth: '400px' }}>
                        Nenhum aparelho conectado no momento. Ao conectar o WhatsApp, você poderá gerenciar atendimentos e responder clientes diretamente de sua conta.
                      </p>
                    </div>
                    <button
                      onClick={handleConnectWhatsapp}
                      style={{
                        padding: '0.6rem 2.5rem', backgroundColor: t.accent, color: t.accentContrast,
                        border: 'none', borderRadius: t.radiusSmall, fontWeight: 700, fontSize: '0.85rem',
                        cursor: 'pointer', boxShadow: t.shadowSmall, transition: 'all 0.2s'
                      }}
                    >
                      Conectar WhatsApp
                    </button>
                  </div>
                )}

                {whatsappStatus.status === 'connecting' && (
                  <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <Loader2 size={48} className="animate-spin" style={{ color: t.accent }} />
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Inicializando Sessão</h4>
                      <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0 }}>
                        Por favor, aguarde alguns segundos enquanto preparamos a conexão do WhatsApp...
                      </p>
                    </div>
                  </div>
                )}

                {whatsappStatus.status === 'qrcode' && whatsappStatus.qr && (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.5rem 0' }}>Aponte a Câmera do WhatsApp</h4>
                      <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
                        Abra o WhatsApp no seu celular ➔ Configurações ➔ Aparelhos Conectados ➔ Conectar um Aparelho e aponte para o QR Code abaixo:
                      </p>
                    </div>

                    <div style={{ 
                      backgroundColor: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'inline-block' 
                    }}>
                      <img src={whatsappStatus.qr} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>
                      <AlertTriangle size={14} /> O QR Code expira e atualiza automaticamente se não for escaneado.
                    </div>

                    <button
                      onClick={handleDisconnectWhatsapp}
                      style={{
                        padding: '0.5rem 1.5rem', backgroundColor: t.bgSecondary, color: t.textMain,
                        border: t.border, borderRadius: t.radiusSmall, fontWeight: 700, fontSize: '0.8rem',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      Cancelar Conexão
                    </button>
                  </div>
                )}

                {whatsappStatus.status === 'connected' && (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <MessageSquare size={36} />
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#10b981', border: `3px solid ${t.bgSecondary}` }} />
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.75rem 0' }}>Dispositivo Conectado</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                        <span style={{ color: t.textMain, fontWeight: 700 }}>Nome: <span style={{ fontWeight: 500, color: t.textSecondary }}>{whatsappStatus.name}</span></span>
                        <span style={{ color: t.textMain, fontWeight: 700 }}>Número: <span style={{ fontWeight: 500, color: t.textSecondary }}>+{whatsappStatus.number}</span></span>
                      </div>
                    </div>

                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', 
                      backgroundColor: 'rgba(16,185,129,0.08)', padding: '6px 16px', borderRadius: '20px',
                      fontSize: '0.8rem', fontWeight: 700 
                    }}>
                      <Check size={14} /> Integração activa e pronta para uso!
                    </div>

                    <button
                      onClick={handleDisconnectWhatsapp}
                      style={{
                        padding: '0.6rem 2.5rem', backgroundColor: '#ef4444', color: '#fff',
                        border: 'none', borderRadius: t.radiusSmall, fontWeight: 700, fontSize: '0.85rem',
                        cursor: 'pointer', boxShadow: '0 2px 4px rgba(239,68,68,0.2)', transition: 'all 0.2s'
                      }}
                    >
                      Desconectar Dispositivo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── MODAL: BLOCK-PROGRAMMING AUTOMATION BUILDER (Framer motion animated overlay) ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem', backgroundColor: 'rgba(2,6,23,0.55)', backdropFilter: 'blur(4px)'
          }}>
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 15 }}
              className="card"
              style={{
                width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
                padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem',
                border: t.border, boxShadow: t.shadow
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: t.textMain, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} style={{ color: autoColor }} /> 
                  {editingAutomation ? 'Programação do Bloco' : 'Criar Novo Bloco Auto-Flow'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'none', border: 'none', color: t.textSecondary,
                    cursor: 'pointer', padding: '6px', borderRadius: '50%'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Block Programming Form */}
              <form onSubmit={handleSaveBlockAutomation} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Rule Name input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                    Nome do Bloco de Automação
                  </label>
                  <input
                    type="text"
                    required
                    value={autoName}
                    onChange={(e) => setAutoName(e.target.value)}
                    placeholder="Ex: Alerta de Liquidação Rápida"
                    style={{
                      width: '100%', height: '42px', padding: '0 0.85rem', borderRadius: '8px',
                      border: t.border, backgroundColor: t.bgSecondary, color: t.textMain,
                      fontSize: '0.9rem', fontWeight: 600, outline: 'none'
                    }}
                  />
                </div>

                {/* VISUAL BLOCKS FLOW CONTAINER */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  
                  {/* BLOCK 1: GATILHO (IF) */}
                  <div style={{ 
                    width: '100%', backgroundColor: t.bgSecondary, border: `1px solid ${t.border.split('#')[1] ? '#' + t.border.split('#')[1] : t.border}`, 
                    borderLeft: `5px solid ${autoColor}`, borderRadius: '12px', padding: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                      <Clock size={14} style={{ color: t.accent }} /> SE OCORRER ESTE GATILHO...
                    </div>
                    <select
                      value={autoTrigger}
                      onChange={(e) => setAutoTrigger(e.target.value)}
                      style={{
                        width: '100%', height: '38px', padding: '0 0.5rem', borderRadius: '6px',
                        border: t.border, backgroundColor: t.bg, color: t.textMain,
                        fontWeight: 600, fontSize: '0.85rem', outline: 'none'
                      }}
                    >
                      <option value="estoque_baixo">Estoque Físico Estiver Crítico (Estoque &lt; Mínimo)</option>
                      <option value="novo_contato">Novo Contato For Cadastrado no CRM</option>
                      <option value="venda_concluida">Venda For Concluída no PDV</option>
                      <option value="estoque_zerado">Estoque de um Item Zerar</option>
                    </select>
                  </div>

                  <ArrowDown size={18} style={{ color: t.textSecondary }} />

                  {/* BLOCK 2: CONDIÇÃO (AND) */}
                  <div style={{ 
                    width: '100%', backgroundColor: t.bgSecondary, border: `1px solid ${t.border.split('#')[1] ? '#' + t.border.split('#')[1] : t.border}`, 
                    borderLeft: `5px solid #f59e0b`, borderRadius: '12px', padding: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                      <ShieldAlert size={14} style={{ color: '#f59e0b' }} /> E SE ESTA CONDIÇÃO FOR SATISFEITA...
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '8px' }}>
                      {/* Condition Field Selector */}
                      <select
                        value={autoConditionField}
                        onChange={(e) => setAutoConditionField(e.target.value)}
                        style={{
                          height: '38px', padding: '0 0.4rem', borderRadius: '6px',
                          border: t.border, backgroundColor: t.bg, color: t.textMain,
                          fontWeight: 600, fontSize: '0.8rem', outline: 'none'
                        }}
                      >
                        <option value="estoque">Qtd. Estoque</option>
                        <option value="precoVenda">Preço de Venda</option>
                        <option value="margemLucro">Margem Lucro</option>
                        <option value="total">Valor Venda</option>
                      </select>

                      {/* Condition Operator Selector */}
                      <select
                        value={autoConditionOperator}
                        onChange={(e) => setAutoConditionOperator(e.target.value)}
                        style={{
                          height: '38px', padding: '0 0.4rem', borderRadius: '6px',
                          border: t.border, backgroundColor: t.bg, color: t.textMain,
                          fontWeight: 600, fontSize: '0.8rem', outline: 'none'
                        }}
                      >
                        <option value="<">&lt; (Menor)</option>
                        <option value=">">&gt; (Maior)</option>
                        <option value="==">== (Igual)</option>
                      </select>

                      {/* Condition Value input */}
                      <input
                        type="text"
                        value={autoConditionValue}
                        onChange={(e) => setAutoConditionValue(e.target.value)}
                        style={{
                          height: '38px', padding: '0 0.5rem', borderRadius: '6px',
                          border: t.border, backgroundColor: t.bg, color: t.textMain,
                          fontWeight: 700, fontSize: '0.85rem', outline: 'none', textAlign: 'center'
                        }}
                      />
                    </div>
                  </div>

                  <ArrowDown size={18} style={{ color: t.textSecondary }} />

                  {/* BLOCK 3: AÇÃO (THEN) */}
                  <div style={{ 
                    width: '100%', backgroundColor: t.bgSecondary, border: `1px solid ${t.border.split('#')[1] ? '#' + t.border.split('#')[1] : t.border}`, 
                    borderLeft: `5px solid #10b981`, borderRadius: '12px', padding: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                      <Zap size={14} style={{ color: '#10b981' }} /> ENTÃO EXECUTAR ESTA AÇÃO...
                    </div>
                    <select
                      value={autoAction}
                      onChange={(e) => {
                        setAutoAction(e.target.value);
                        // Auto update accent colors based on action type
                        const colors = {
                          enviar_whatsapp: '#10b981',
                          notificar_admin: '#ef4444',
                          enviar_email: '#3b82f6',
                          filtrar_ia: '#64748b',
                          priorizar_venda: '#8b5cf6'
                        };
                        setAutoColor(colors[e.target.value] || '#ef4444');
                      }}
                      style={{
                        width: '100%', height: '38px', padding: '0 0.5rem', borderRadius: '6px',
                        border: t.border, backgroundColor: t.bg, color: t.textMain,
                        fontWeight: 600, fontSize: '0.85rem', outline: 'none'
                      }}
                    >
                      <option value="notificar_admin">Notificar Administração / Gerente do CRM</option>
                      <option value="enviar_whatsapp">Enviar Mensagem WhatsApp de Marketing</option>
                      <option value="enviar_email">Enviar E-mail Automatizado</option>
                      <option value="filtrar_ia">Ignorar / Ocultar Item das Análises Gerais da IA</option>
                      <option value="priorizar_venda">Priorizar Item para Liquidação / Promoção na IA</option>
                    </select>
                  </div>
                </div>

                {/* Block Color/Style Customizer */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                    Cor Temática do Bloco
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAutoColor(c)}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c,
                          border: autoColor === c ? `3px solid ${t.textMain}` : 'none',
                          cursor: 'pointer', transition: 'transform 0.15s'
                        }}
                        className="hover:scale-105"
                      />
                    ))}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: t.border, paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      height: '42px', padding: '0 1.25rem', backgroundColor: 'transparent',
                      color: t.textMain, border: t.border, borderRadius: t.radiusSmall,
                      fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{
                      height: '42px', padding: '0 1.5rem', backgroundColor: t.accent,
                      color: t.accentContrast, border: 'none', borderRadius: t.radiusSmall,
                      fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {editingAutomation ? 'Atualizar Bloco' : 'Salvar Bloco de Automação'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Automations;
