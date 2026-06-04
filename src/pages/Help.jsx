import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, Video, FileText, Phone, Mail, Sparkles, Plus, Trash2, Loader2,
  Building2, Shield, Zap, Cpu, BookOpen, MessageSquare, Settings, Check,
  AlertCircle, ChevronDown, ChevronUp, Download, ExternalLink, Play,
  QrCode, Link2, UserCheck, Lock, Eye, EyeOff, FileSpreadsheet, History, Clock, Laptop, RefreshCw,
  Send, CreditCard, ShieldCheck, Search, Layers, X
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { encryptData } from '../utils/crypto';
import packageJson from '../../package.json';

const SCREENS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'deals', label: 'Vendas' },
  { id: 'inventory', label: 'Estoque' },
  { id: 'calendar', label: 'Agenda' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'service', label: 'Atendimentos' },
  { id: 'llm', label: 'Inteligência AI' },
  { id: 'automations', label: 'Automações' },
  { id: 'partners', label: 'Parceiros' },
  { id: 'coupons', label: 'Cupons' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'help', label: 'Ajuda' },
  { id: 'settings', label: 'Configurações' },
];

const Help = () => {
  const { user, activeCompany, companyData, subscription, getTenantDoc } = useUser();
  const { t, currentTheme } = useTheme();
  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
  const borderColor = t.border ? (t.border.split(' ')[2] || t.border) : '#cbd5e1';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [faqCategory, setFaqCategory] = useState('all');

  // Email and Plan Management States
  const [showPlanEmailModal, setShowPlanEmailModal] = useState(false);
  const [showCancelEmailModal, setShowCancelEmailModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedPlanForEmail, setSelectedPlanForEmail] = useState(null);
  const [planEmailMessage, setPlanEmailMessage] = useState('');
  const [cancelEmailMessage, setCancelEmailMessage] = useState('');
  const [helpEmailMessage, setHelpEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [showPersonalizedModal, setShowPersonalizedModal] = useState(false);
  const [selectedPersonalizedScreens, setSelectedPersonalizedScreens] = useState([]);

  const [faqSearchQuery, setFaqSearchQuery] = useState('');

  // Carregar tab pela URL caso fornecida
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      if (tab === 'system') {
        setActiveTab('dashboard'); // Redireciona a antiga aba system para o novo Dashboard Geral
      } else if (['dashboard', 'features', 'tutorials', 'plans'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  const handleSendPlanEmail = async () => {
    if (!selectedPlanForEmail) return;
    setSendingEmail(true);
    const subject = encodeURIComponent('Mudança de Plano CRM Master');
    const body = encodeURIComponent(
      `Solicitação de Mudança de Plano\n\nUsuário: ${user?.nome}\nCargo: ${user?.funcao}\nEmpresa: ${companyData?.nome || 'N/A'}\nE-mail: ${user?.email}\nPlano solicitado: ${selectedPlanForEmail}\n\nMensagem adicional:\n${planEmailMessage || 'Nenhuma mensagem adicional.'}`
    );
    window.location.href = `mailto:braynners.tech@braynner.com.br?subject=${subject}&body=${body}`;
    setTimeout(() => { setShowPlanEmailModal(false); setPlanEmailMessage(''); setSendingEmail(false); }, 500);
  };

  const handleSendCancelEmail = async () => {
    setSendingEmail(true);
    const subject = encodeURIComponent('Solicitação de Cancelamento de Assinatura');
    const body = encodeURIComponent(
      `Solicitação de Cancelamento\n\nUsuário: ${user?.nome}\nCargo: ${user?.funcao}\nEmpresa: ${companyData?.nome || 'N/A'}\nE-mail: ${user?.email}\n\nMotivo:\n${cancelEmailMessage || 'Não informado.'}`
    );
    window.location.href = `mailto:braynners.tech@braynner.com.br?subject=${subject}&body=${body}`;
    setTimeout(() => { setShowCancelEmailModal(false); setCancelEmailMessage(''); setSendingEmail(false); }, 500);
  };

  const handleSendHelpEmail = async () => {
    setSendingEmail(true);
    const subject = encodeURIComponent('Solicitação de Ajuda — CRM');
    const body = encodeURIComponent(
      `Pedido de Ajuda\n\nUsuário: ${user?.nome}\nCargo: ${user?.funcao}\nEmpresa: ${companyData?.nome || 'N/A'}\nE-mail: ${user?.email}\n\nRelato do Problema:\n${helpEmailMessage || 'Não informado.'}`
    );
    window.location.href = `mailto:braynners.tech@braynner.com.br?subject=${subject}&body=${body}`;
    setTimeout(() => { setShowHelpModal(false); setHelpEmailMessage(''); setSendingEmail(false); }, 500);
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

  const handleActivatePlan = async (planName) => {
    try {
      const planEncrypted = encryptData(planName);
      const statusEncrypted = encryptData('Ativa');
      await setDoc(getTenantDoc('company', 'subscription'), {
        plano: planEncrypted,
        status: statusEncrypted
      }, { merge: true });
      alert(`Plano ${planName} ativado com sucesso!`);
    } catch (e) {
      console.error(e);
      alert('Erro ao ativar o plano.');
    }
  };

  const handleSavePersonalized = async () => {
    try {
      const planEncrypted = encryptData('Personalizado');
      const statusEncrypted = encryptData('Ativa');
      await setDoc(getTenantDoc('company', 'subscription'), {
        plano: planEncrypted,
        status: statusEncrypted,
        telas: selectedPersonalizedScreens
      }, { merge: true });
      setShowPersonalizedModal(false);
      alert('Acessos personalizados salvos com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar acessos personalizados.');
    }
  };

  const togglePersonalizedScreen = (screenId) => {
    setSelectedPersonalizedScreens(prev =>
      prev.includes(screenId)
        ? prev.filter(s => s !== screenId)
        : [...prev, screenId]
    );
  };

  const handleOpenPersonalizedModal = () => {
    setSelectedPersonalizedScreens(subscription?.telas || []);
    setShowPersonalizedModal(true);
  };


  // Interactive Mockups States
  const [mockPixEnv, setMockPixEnv] = useState('producao');
  const [mockEmailRevealed, setMockEmailRevealed] = useState(false);
  const [mockCepMapped, setMockCepMapped] = useState(true);
  const [mockStatusEnv, setMockStatusEnv] = useState('producao');
  const [mockStatusState, setMockStatusState] = useState('ativa');

  // Interactive Mockup Timer for InfinityPay
  const [mockTimer, setMockTimer] = useState(299);
  useEffect(() => {
    const interval = setInterval(() => {
      setMockTimer(prev => (prev > 0 ? prev - 1 : 299));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatMockTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Tutorials State
  const [tutorials, setTutorials] = useState([]);
  const [loadingTutorials, setLoadingTutorials] = useState(true);
  const [submittingTutorial, setSubmittingTutorial] = useState(false);
  const [newTutorial, setNewTutorial] = useState({
    titulo: '',
    tipo: 'video', // 'video' | 'pdf' | 'texto'
    url: '',
    conteudo: ''
  });

  // Listen to tutorials in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tutorials'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTutorials(list);
      setLoadingTutorials(false);
    }, (err) => {
      console.error("Error fetching tutorials:", err);
      setLoadingTutorials(false);
    });

    return () => unsub();
  }, []);

  const handleAddTutorial = async (e) => {
    e.preventDefault();
    if (!newTutorial.titulo.trim()) {
      alert('Por favor, informe o título do tutorial.');
      return;
    }
    if (newTutorial.tipo !== 'texto' && !newTutorial.url.trim()) {
      alert('Por favor, insira o URL do recurso (YouTube ou Link PDF).');
      return;
    }

    setSubmittingTutorial(true);
    try {
      await addDoc(collection(db, 'tutorials'), {
        titulo: newTutorial.titulo,
        tipo: newTutorial.tipo,
        url: newTutorial.url,
        conteudo: newTutorial.conteudo,
        createdAt: new Date().toISOString(),
        createdBy: user?.nome || 'Developer'
      });
      setNewTutorial({ titulo: '', tipo: 'video', url: '', conteudo: '' });
      alert('Tutorial cadastrado com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao cadastrar tutorial.');
    }
    setSubmittingTutorial(false);
  };

  const handleDeleteTutorial = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este tutorial?')) {
      try {
        await deleteDoc(doc(db, 'tutorials', id));
        alert('Tutorial removido!');
      } catch (e) {
        console.error(e);
        alert('Erro ao remover tutorial.');
      }
    }
  };

  // Helper to extract YouTube video ID
  const getYoutubeEmbedUrl = (url) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  // FAQ List with Categories
  const FAQ_ITEMS = [
    // --- Categoria: PDV & PIX na Tela ---
    {
      category: "pdv_pix",
      question: "Como funciona o PIX direto na tela do computador?",
      answer: "O sistema agora suporta exibição de PIX diretamente na tela do PDV (configurado em 'Exibir na Tela' nas configurações de Integração PagBank). Isso ignora qualquer comunicação física com a maquininha (porta 443), abrindo o QR Code scannável real gerado pelo PagBank e a chave Copia e Cola dinâmicos. Em ambiente de Produção, a auto-aprovação fica desligada (o operador deve conferir a conta e confirmar manualmente, salvando com simulated: false). Em Homologação, ocorre auto-aprovação em 6 segundos para agilizar testes."
    },
    {
      category: "pdv_pix",
      question: "Minha maquininha de cartão não conecta ou não aparece no sistema",
      answer: "Certifique-se de que a maquininha está pareada com a mesma rede Wi-Fi que o seu computador/tablet ou conectada corretamente via USB/Serial. Vá na aba Integração, valide o IP do terminal cadastrado e certifique-se de que o software integrador PagBank (PlugPag) está em execução em segundo plano."
    },
    // --- Categoria: Integrações & Roteamento ---
    {
      category: "integrations",
      question: "O que é a Central de Roteamento de Pagamentos?",
      answer: "É um painel nas Configurações onde você escolhe para onde enviar cada pagamento do PDV: PIX (Simulador, Terminal, Tela PagBank, InfinityPay), Crédito (Simulador, Terminal, InfinityPay), Débito (Simulador, Terminal) e Link de Pagamento (Simulador, InfinityPay). Se o roteamento selecionado estiver desativado, o CRM realiza fallback seguro imediato para entrada manual de código (Simulador), prevenindo interrupções."
    },
    {
      category: "integrations",
      question: "Como funciona a cobrança por Link de Pagamento com a InfinityPay?",
      answer: "Ao selecionar 'Link de Pagamento' no PDV, o CRM faz uma chamada segura e gera um link na InfinityPay. É exibido um modal com cronômetro de 5 minutos, QR Code scannável e chave Copia e Cola. O PDV faz um polling automático a cada 3 segundos na API InfinityPay; assim que o cliente pagar, a venda é aprovada instantaneamente com registro do NSU e código da transação real."
    },
    {
      category: "integrations",
      question: "Como funciona a emissão de Nota Fiscal (NF-e/NFC-e)?",
      answer: "A emissão é atrelada à Focus NFE. Você precisa cadastrar seus tokens de Produção ou Homologação nos dados da Empresa na aba de Integração. O regime tributário (Simples Nacional, etc.) deve estar alinhado com a contabilidade corporativa. Caso ativado, o sistema enviará as faturas diretamente para processamento."
    },
    // --- Categoria: Dados & LGPD ---
    {
      category: "data_security",
      question: "Como funciona a mesclagem de 'Cidade / UF' nos dados da Empresa?",
      answer: "Os campos de Cidade e Estado foram agrupados em um único input denominado 'Cidade / UF' (Ex: Curitiba - PR). Quando alterado, o componente executa um parser automático inteligente: se houver um hífen ('-'), quebra e higieniza as strings correspondentes para cidade e estado antes de salvar no Firestore, mantendo a integridade."
    },
    {
      category: "data_security",
      question: "Por que não consigo editar o Responsável ou o E-mail de Contato da Empresa?",
      answer: "Por motivos de segurança contratual e proteção à privacidade (LGPD), os campos de 'Responsável' e 'E-mail de Contato' na aba Empresa são bloqueados permanentemente para edição. Além disso, o e-mail exibe uma máscara visual dinâmica (ex: br*****@gh***.com) que protege a leitura em tela para operadores normais."
    },
    {
      category: "data_security",
      question: "Como funciona a criptografia e LGPD nos campos de Responsável?",
      answer: "Ao criar ou editar um usuário corporativo com cargo 'Responsável', o CRM exibe dinamicamente campos obrigatórios de E-mail do Responsável e Telefone do Responsável. Por segurança de dados confidenciais, essas propriedades de contato do responsável são criptografadas (criptografia AES de nível militar) antes de serem salvas no Firestore e descriptografadas apenas no painel administrativo."
    },
    {
      category: "data_security",
      question: "Como o status financeiro de bloqueio é criptografado?",
      answer: "Para a segurança dos dados e conformidade do cliente, os dados do plano e status da assinatura ('Ativa', 'Bloqueada', etc.) são criptografados de ponta a ponta no Firestore. Isso impede visualizações maliciosas no banco de dados, protegendo informações financeiras da empresa."
    },
    // --- Categoria: Assinaturas & Suporte ---
    {
      category: "subscriptions",
      question: "Quem tem permissão para alterar o plano ou cancelar a assinatura?",
      answer: "Apenas usuários logados com a função 'responsavel' possuem permissões diretas para selecionar planos ou cancelar a assinatura no painel. Usuários com outros cargos/funções que clicam nessas ações serão redirecionados para o Modal Universal de Suporte para enviar uma solicitação formal."
    },
    {
      category: "subscriptions",
      question: "Como funciona o novo Modal Universal de Suporte?",
      answer: "Acessível a todos os usuários corporativos, ele captura de forma dinâmica o contexto do usuário (Nome, Cargo, Empresa ativa, E-mail) para compor um ticket padronizado. O modal fornece botões rápidos para copiar dados e redirecionar por 'mailto:' diretamente para abrir seu aplicativo de e-mail local pré-preenchido."
    },
    {
      category: "subscriptions",
      question: "Como o status financeiro de bloqueio é exibido e controlado?",
      answer: "O status do sistema possui uma coloração dinâmica: Vermelho para 'bloqueada', Amarelo para 'inativa', Verde para 'ativa' em ambiente de Produção, e Azul para 'ativa' em ambiente de Homologação. Além de serem salvos com segurança de forma criptografada no Firestore, esses status coloridos são sincronizados instantaneamente nas badges do perfil da barra lateral e no cabeçalho superior das configurações."
    },
    {
      category: "subscriptions",
      question: "O que é o ambiente 'Free Trial'?",
      answer: "O ambiente 'Free Trial' é um espaço de testes completo sem custos para novos clientes. Permite testar o CRM corporativo por tempo determinado com todos os recursos habilitados, sem risco de gerar faturamento tributário ou transações financeiras reais."
    },
    {
      category: "subscriptions",
      question: "Usuários comuns não conseguem acessar certos módulos. Por quê?",
      answer: "Se a empresa está em um plano 'Personalizado', apenas as telas e módulos explicitamente liberados pelo desenvolvedor (no modal de escolha de telas) estarão disponíveis para os demais usuários corporativos. O desenvolvedor é o único que possui privilégios para liberar ou bloquear recursos específicos."
    },
    // --- Categoria: Importador XLSX ---
    {
      category: "importer",
      question: "Como funciona o novo mapeamento de colunas em 2 colunas no Importador XLSX?",
      answer: "O modal de mapeamento do importador foi simplificado: removemos a poluição visual de visualizações prévias e linhas da planilha para focar estritamente no mapeamento de 2 colunas por linha (Dado A planilha vs Dado B banco de dados) com caixas de seleção com altura padrão de 40px, otimizando o fluxo e legibilidade."
    },
    {
      category: "importer",
      question: "Como funcionam os filtros dinâmicos de endereço (ViaCEP) no importador?",
      answer: "Ao selecionar uma coluna para o campo 'CEP', o sistema altera o autopreenchimento dinâmico: os campos de Logradouro, Bairro e Cidade - UF são automaticamente ocultados da interface de mapeamento e desmarcados. Durante a importação, o sistema busca e preenche esses dados automaticamente usando a API do ViaCEP de forma invisível."
    },
    {
      category: "importer",
      question: "O que acontece ao ignorar o campo 'Entrega mesmo endereço' na importação?",
      answer: "Se o campo 'Entrega mesmo endereço' for ignorado (ou seja, deixado como 'Ignorar campo'), o sistema assume que a entrega é feita no mesmo endereço principal (default true) e oculta dinamicamente todos os outros campos de entrega (CEP, logradouro, número, bairro, cidade-uf, complemento) da tela, limpando seus mapeamentos anteriores."
    },
    {
      category: "importer",
      question: "Quais são os novos campos de cliente suportados na importação?",
      answer: "Agora suportamos a importação de: Gênero (genero), Status (status), Data de Nascimento (dataNascimento com parser de datas), Fonte/Origem (fonte) e Indicação/Recomendação (indicacao). Todos esses novos campos inseridos na base de clientes contam com criptografia AES automática antes de serem gravados no Firestore, mantendo a consistência de segurança e LGPD."
    }
  ];

  const faqCategories = [
    { id: 'all', label: 'Todos', icon: BookOpen },
    { id: 'pdv_pix', label: 'PDV & PIX na Tela', icon: Laptop },
    { id: 'integrations', label: 'Integrações & Roteamento', icon: Link2 },
    { id: 'data_security', label: 'Dados & LGPD', icon: Lock },
    { id: 'subscriptions', label: 'Planos & Suporte', icon: Shield },
    { id: 'importer', label: 'Importador XLSX', icon: FileSpreadsheet }
  ];

  const filteredFaqs = faqCategory === 'all'
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter(item => item.category === faqCategory);

  return (
    <div className="help-page max-w-[1600px] mx-auto p-4" style={{ color: t.textMain }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Group 1: Title */}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Central de Ajuda</h1>
          </div>

          {/* Group 2: Tabs (center) */}
          <div style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', justifyContent: 'center', minWidth: '400px' }}>
            <nav style={{
              display: 'flex', gap: '4px',
              padding: '4px', backgroundColor: t.bgSecondary, borderRadius: t.radiusSmall,
              border: t.borderBold, boxShadow: t.shadowSmall
            }}>
              {[
                { id: 'dashboard', label: 'Painel Geral', icon: MessageSquare },
                { id: 'tutorials', label: 'Tutoriais e Mídias', icon: BookOpen },
                { id: 'plans', label: 'Planos de Assinatura', icon: CreditCard }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '8px 16px', border: 'none', borderRadius: t.radiusSmall,
                      backgroundColor: isActive ? t.accent : 'transparent',
                      color: isActive ? t.accentContrast : t.textSecondary,
                      fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      transition: 'all 0.2s', letterSpacing: '0.01em'
                    }}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Group 3: Right Spacer / Decorative Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '150px', justifyContent: 'flex-end' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              backgroundColor: t.accentSoft || 'rgba(37,99,235,0.1)', color: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <HelpCircle size={18} />
            </div>
          </div>

        </div>
      </header>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
        >
          {/* TABS: PAINEL GERAL (UNIFICADO) */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Diagnósticos Rápidos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                {/* Status do Sistema */}
                {(() => {
                  const amb = companyData?.ambiente || 'homologacao';
                  const statusCor = companyData?.status === 'bloqueada'
                    ? { cor: '#ef4444', label: 'Bloqueada', bg: '#fee2e2' }
                    : companyData?.status === 'inativa'
                      ? { cor: '#f59e0b', label: 'Inativa', bg: '#fef3c7' }
                      : amb === 'producao'
                        ? { cor: '#10b981', label: 'Ativo — Produção', bg: '#d1fae5' }
                        : { cor: '#3b82f6', label: 'Ativo — Homologação', bg: '#dbeafe' };

                  return (
                    <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldCheck size={20} color={statusCor.cor} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>STATUS DO SISTEMA</span>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px', borderRadius: '20px',
                        backgroundColor: statusCor.bg, color: statusCor.cor,
                        fontWeight: 800, fontSize: '0.85rem', width: 'fit-content'
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusCor.cor, flexShrink: 0 }} />
                        {statusCor.label}
                      </span>
                    </div>
                  );
                })()}

                {/* Versão */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={20} color={t.accent} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>VERSÃO / BUILD</span>
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: t.textMain }}>v{packageJson.version}</span>
                </div>

                {/* Infraestrutura */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={20} color={t.accent} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>INFRAESTRUTURA</span>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: t.textMain, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {companyData?.nome || activeCompany || '—'}
                  </span>
                </div>

                {/* Plano */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={20} color={t.accent} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>PLANO ATIVO</span>
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: t.textMain }}>{subscription?.plano || 'Básico'}</span>
                </div>

                {/* Contrato */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} color={t.accent} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>CONTRATO</span>
                  </div>
                  {subscription?.contractUrl ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button"
                        onClick={() => window.open(subscription.contractUrl, '_blank')}
                        style={{ background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                      ><FileText size={12} /> Ver Contrato</button>
                      {user?.funcao === 'developer' && (
                        <button type="button"
                          onClick={async () => {
                            const url = prompt('URL do contrato:', subscription.contractUrl || '');
                            if (url !== null) {
                              try {
                                await setDoc(getTenantDoc('company', 'subscription'), { contractUrl: url }, { merge: true });
                                alert('Contrato atualizado!');
                              } catch (e) { alert('Erro ao atualizar contrato.'); }
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: t.textSecondary, fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >Alterar</button>
                      )}
                    </div>
                  ) : user?.funcao === 'developer' ? (
                    <button type="button"
                      onClick={async () => {
                        const url = prompt('URL do contrato:');
                        if (url) {
                          try {
                            await setDoc(getTenantDoc('company', 'subscription'), { contractUrl: url }, { merge: true });
                            alert('Contrato salvo!');
                          } catch (e) { alert('Erro ao salvar contrato.'); }
                        }
                      }}
                      style={{ background: 'none', border: `1px dashed ${t.accent}`, borderRadius: t.radiusSmall, color: t.accent, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px' }}
                    ><Plus size={10} /> Adicionar</button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Não disponível</span>
                  )}
                </div>
                {/* WhatsApp */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={14} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>WHATSAPP CORPORATIVO</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                    Atendimento imediato para dúvidas ou faturamento.
                  </p>
                  <button
                    onClick={() => window.open('https://wa.me/5500000000000', '_blank')}
                    style={{
                      backgroundColor: '#22c55e', color: '#fff', padding: '6px 12px',
                      borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.75rem',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                      width: 'fit-content', marginTop: 'auto'
                    }}
                  >
                    Falar no WhatsApp
                  </button>
                </div>

                {/* E-mail / Suporte Ticket */}
                <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={14} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>ABRIR TICKET / E-MAIL</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                    Abra solicitações de suporte corporativo.
                  </p>
                  <button
                    onClick={() => {
                      setHelpEmailMessage('');
                      setShowHelpModal(true);
                    }}
                    style={{
                      backgroundColor: '#3b82f6', color: '#fff', padding: '6px 12px',
                      borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.75rem',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                      width: 'fit-content', marginTop: 'auto'
                    }}
                  >
                    Solicitar Ajuda
                  </button>
                </div>

                

                {/* Backup e Assinatura */}
                {(user?.funcao === 'responsavel' || user?.funcao === 'developer') && (
                  <div style={{ padding: '1.25rem', borderRadius: t.radiusInner || '16px', backgroundColor: t.bg || '#fff', border: t.border || '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: t.shadow }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.05em' }}>AÇÕES DE ASSINATURA</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                      Gerencie seu backup cadastral ou finalização.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                      <button
                        onClick={handleRequestBackup}
                        style={{
                          background: 'none', border: t.border || '1px solid #cbd5e1', padding: '6px 12px',
                          borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', color: t.textMain,
                          cursor: 'pointer', textAlign: 'center', flex: 1
                        }}
                      >
                        Backup
                      </button>
                      <button
                        onClick={() => {
                          setCancelEmailMessage('');
                          setShowCancelEmailModal(true);
                        }}
                        style={{
                          background: 'none', border: '1px solid #ef4444', padding: '4px 8px',
                          borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', color: '#ef4444',
                          cursor: 'pointer', textAlign: 'center', flex: 1
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* FAQ Central com busca (Largura Completa) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Barra de Busca Inteligente */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    backgroundColor: t.bg || '#fff',
                    border: t.border || '1px solid #cbd5e1',
                    borderRadius: '16px',
                    boxShadow: t.shadowSmall
                  }}>
                    <Search size={18} color={t.textSecondary} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
                    <input
                      type="text"
                      placeholder="Pesquise por dúvidas, integrações, termos contratuais ou problemas..."
                      value={faqSearchQuery}
                      onChange={e => setFaqSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '0 16px 0 48px',
                        backgroundColor: 'transparent',
                        color: t.textMain,
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Pills de Categoria */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {faqCategories.map(cat => {
                      const isCatActive = faqCategory === cat.id;
                      const CatIcon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setFaqCategory(cat.id);
                            setOpenFaqIndex(null);
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: '20px', border: t.border || '1px solid #cbd5e1',
                            backgroundColor: isCatActive ? t.accentSoft || 'rgba(37,99,235,0.08)' : 'transparent',
                            color: isCatActive ? t.accent : t.textSecondary,
                            fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            transition: 'all 0.2s', borderStyle: isCatActive ? 'solid' : 'dashed'
                          }}
                        >
                          <CatIcon size={12} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* FAQ List */}
                  {(() => {
                    const filteredFaqs = FAQ_ITEMS.filter(item => {
                      const matchesCategory = faqCategory === 'all' || item.category === faqCategory;
                      const matchesSearch = faqSearchQuery.trim() === '' || 
                        item.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
                        item.answer.toLowerCase().includes(faqSearchQuery.toLowerCase());
                      return matchesCategory && matchesSearch;
                    });

                    if (filteredFaqs.length === 0) {
                      return (
                        <div style={{
                          padding: '3rem', backgroundColor: t.bg || '#fff', borderRadius: '24px',
                          border: t.border || '1px solid #e2e8f0', textAlign: 'center', color: t.textSecondary
                        }}>
                          <AlertCircle size={36} style={{ opacity: 0.4, marginBottom: '0.75rem', marginLeft: 'auto', marginRight: 'auto' }} />
                          <p style={{ margin: 0, fontWeight: 600 }}>Nenhum resultado encontrado para a pesquisa ou categoria selecionada.</p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
                        {filteredFaqs.map((item, index) => {
                          const isOpen = openFaqIndex === item.question;
                          return (
                            <div
                              key={index}
                              style={{
                                backgroundColor: t.bg || '#fff',
                                border: t.border || '1px solid #e2e8f0',
                                borderRadius: '16px',
                                padding: '1.25rem 1.5rem',
                                boxShadow: t.shadow,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => setOpenFaqIndex(isOpen ? null : item.question)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
                                    backgroundColor: 'rgba(0,0,0,0.03)', color: t.textSecondary
                                  }}>
                                    {faqCategories.find(c => c.id === item.category)?.label || 'Geral'}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: t.textMain }}>{item.question}</span>
                                </div>
                                {isOpen ? <ChevronUp size={16} color={t.accent} /> : <ChevronDown size={16} color={t.textSecondary} />}
                              </div>
                              {isOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  style={{ marginTop: '1rem', fontSize: '0.85rem', color: t.textSecondary, lineHeight: 1.6 }}
                                >
                                  {item.answer}
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

            </div>
          )}

          {/* TABS: TUTORIAIS E MÍDIAS */}
          {activeTab === 'tutorials' && (
            <div style={{ display: 'grid', gridTemplateColumns: user?.funcao === 'developer' ? '1.2fr 2fr' : '1fr', gap: '2rem' }}>
              {/* Creator Panel (Developer Only) */}
              {user?.funcao === 'developer' && (
                <div style={{
                  backgroundColor: t.bg || '#fff',
                  border: t.border || '1px solid #e2e8f0',
                  borderRadius: '24px',
                  padding: '2rem',
                  boxShadow: t.shadow,
                  alignSelf: 'start'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Plus size={20} color={t.accent} />
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Adicionar Tutorial</h2>
                  </div>

                  <form onSubmit={handleAddTutorial} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="field-label">Título</label>
                      <input
                        type="text" required className="field-input"
                        placeholder="Ex: Como Conectar a Maquininha PagBank"
                        value={newTutorial.titulo}
                        onChange={e => setNewTutorial({ ...newTutorial, titulo: e.target.value })}
                        style={{ backgroundColor: t.bgSecondary, color: t.textMain, border: t.borderBold }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="field-label">Tipo de Recurso</label>
                      <select
                        className="field-input"
                        value={newTutorial.tipo}
                        onChange={e => setNewTutorial({ ...newTutorial, tipo: e.target.value, url: '', conteudo: '' })}
                        style={{ backgroundColor: t.bgSecondary, color: t.textMain, border: t.borderBold }}
                      >
                        <option value="video">Vídeo (YouTube)</option>
                        <option value="pdf">Documento (Link PDF)</option>
                        <option value="texto">Texto / Artigo Curto</option>
                      </select>
                    </div>

                    {newTutorial.tipo !== 'texto' ? (
                      <div className="form-group">
                        <label className="field-label">URL do Recurso</label>
                        <input
                          type="url" required className="field-input"
                          placeholder={newTutorial.tipo === 'video' ? "URL do vídeo do YouTube" : "Link direto do arquivo PDF"}
                          value={newTutorial.url}
                          onChange={e => setNewTutorial({ ...newTutorial, url: e.target.value })}
                          style={{ backgroundColor: t.bgSecondary, color: t.textMain, border: t.borderBold }}
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="field-label">Conteúdo do Artigo</label>
                        <textarea
                          rows={6} required className="field-input"
                          placeholder="Explicação textual e procedimentos passo a passo..."
                          value={newTutorial.conteudo}
                          onChange={e => setNewTutorial({ ...newTutorial, conteudo: e.target.value })}
                          style={{ backgroundColor: t.bgSecondary, color: t.textMain, border: t.borderBold, resize: 'none' }}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingTutorial}
                      style={{
                        backgroundColor: t.accent || '#2563eb', color: '#fff',
                        padding: '0.75rem', borderRadius: '12px', border: 'none',
                        fontWeight: 700, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        marginTop: '0.5rem'
                      }}
                    >
                      {submittingTutorial ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Salvar Tutorial
                    </button>
                  </form>
                </div>
              )}

              {/* Viewer Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Tutoriais Disponíveis</h2>
                  <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>{tutorials.length} materiais cadastrados</span>
                </div>

                {loadingTutorials ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={36} className="animate-spin" color={t.accent} />
                  </div>
                ) : tutorials.length === 0 ? (
                  <div style={{
                    padding: '3rem', backgroundColor: t.bg || '#fff', borderRadius: '24px',
                    border: t.border || '1px solid #e2e8f0', textAlign: 'center', color: t.textSecondary
                  }}>
                    <BookOpen size={48} style={{ opacity: 0.4, marginBottom: '1rem' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Nenhum material de tutorial publicado.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {tutorials.map(tut => (
                      <div
                        key={tut.id}
                        style={{
                          backgroundColor: t.bg || '#fff',
                          border: t.border || '1px solid #e2e8f0',
                          borderRadius: '24px',
                          padding: '1.5rem 2rem',
                          boxShadow: t.shadow,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                          position: 'relative'
                        }}
                      >
                        {/* Delete option for dev */}
                        {user?.funcao === 'developer' && (
                          <button
                            onClick={() => handleDeleteTutorial(tut.id)}
                            style={{
                              position: 'absolute', top: '1.5rem', right: '1.5rem',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ef4444', opacity: 0.6, transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            backgroundColor: tut.tipo === 'video' ? 'rgba(239, 68, 68, 0.1)' : tut.tipo === 'pdf' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: tut.tipo === 'video' ? '#ef4444' : tut.tipo === 'pdf' ? '#3b82f6' : '#10b981'
                          }}>
                            {tut.tipo === 'video' ? <Video size={20} /> : tut.tipo === 'pdf' ? <FileText size={20} /> : <BookOpen size={20} />}
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: t.textMain }}>{tut.titulo}</h3>
                            <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>Tipo: <strong style={{ textTransform: 'capitalize' }}>{tut.tipo === 'video' ? 'Vídeo' : tut.tipo}</strong> | Criado por: {tut.createdBy || 'Sistema'}</span>
                          </div>
                        </div>

                        {/* Rendering by Type */}
                        {tut.tipo === 'video' && tut.url && (
                          <div style={{
                            width: '100%', position: 'relative', paddingBottom: '56.25%',
                            height: 0, overflow: 'hidden', borderRadius: '16px',
                            backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.08)'
                          }}>
                            <iframe
                              src={getYoutubeEmbedUrl(tut.url)}
                              title={tut.titulo}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                            />
                          </div>
                        )}

                        {tut.tipo === 'pdf' && tut.url && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '1rem 1.5rem', backgroundColor: t.bgSecondary || '#f8fafc',
                            borderRadius: '16px', border: t.border || '1px solid #e2e8f0'
                          }}>
                            <FileText size={32} color="#ef4444" />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>Documento PDF</span>
                              <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>Clique no botão ao lado para ler o documento completo</span>
                            </div>
                            <button
                              onClick={() => window.open(tut.url, '_blank')}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                backgroundColor: t.accent || '#2563eb', color: '#fff',
                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              <ExternalLink size={14} /> Abrir PDF
                            </button>
                          </div>
                        )}

                        {tut.tipo === 'texto' && tut.conteudo && (
                          <div style={{
                            padding: '1.25rem 1.5rem', backgroundColor: t.bgSecondary || '#f8fafc',
                            borderRadius: '16px', border: t.border || '1px solid #e2e8f0',
                            fontSize: '0.9rem', color: t.textSecondary, lineHeight: 1.6,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {tut.conteudo}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TABS: PLANOS DE ASSINATURA */}
          {activeTab === 'plans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: t.textMain, marginBottom: '0.5rem' }}>Escolha o Plano Ideal para sua Empresa</h2>
                <p style={{ color: t.textSecondary, fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.5 }}>
                  Aumente seus limites, libere recursos de IA, automações e muito mais. A alteração de plano é imediata para desenvolvedores e sob solicitação por e-mail para administradores/responsáveis.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {[
                  { name: 'PDV', price: 'R$ 80', period: '/mês', desc: 'Gestão simplificada de vendas e PDV', color: '#14b8a6', features: ['Módulo PDV', 'Controle de Caixa', 'Relatórios Básicos', 'Suporte Padrão'] },
                  { name: 'Básico', price: 'R$ 100', period: '/mês', desc: 'Ideal para pequenas empresas em crescimento', color: '#2563eb', features: ['Módulo PDV & Contatos', 'Estoque Simples', 'Agenda de Compromissos', 'Suporte por E-mail'] },
                  { name: 'Intermediário', price: 'R$ 250', period: '/mês', desc: 'Recursos avançados de estoque e documentos', color: '#6366f1', features: ['Tudo do Básico', 'Estoque Avançado', 'Cupons & Parceiros', 'Suporte Prioritário'] },
                  { name: 'Premium', price: 'R$ 400', period: '/mês', desc: 'Acesso ilimitado e inteligência AI completa', color: '#f59e0b', features: ['Acesso Ilimitado', 'Inteligência AI Integrada', 'Automações Completas', 'Suporte VIP 24/7'] },
                  { name: 'Personalizado', price: 'A consultar', period: '', desc: 'Solução customizada sob demanda', color: '#8b5cf6', features: ['Telas Selecionáveis', 'Infraestrutura Dedicada', 'Integrações Customizadas', 'Gerente de Contas'] }
                ].map(plan => {
                  const isCurrent = subscription?.plano === plan.name;
                  return (
                    <motion.div
                      key={plan.name}
                      whileHover={{ y: -6, boxShadow: t.shadowLarge }}
                      style={{
                        backgroundColor: t.bg || '#fff',
                        border: `2px solid ${isCurrent ? plan.color : t.border || '#e2e8f0'}`,
                        borderRadius: '24px',
                        padding: '2rem 1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1.5rem',
                        position: 'relative',
                        boxShadow: t.shadowSmall,
                        transition: 'border-color 0.2s'
                      }}
                    >
                      {isCurrent && (
                        <span style={{
                          position: 'absolute', top: '12px', right: '12px',
                          backgroundColor: plan.color, color: '#fff',
                          padding: '3px 10px', borderRadius: '12px',
                          fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.05em'
                        }}>PLANO ATUAL</span>
                      )}
                      
                      <div>
                        <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: t.textMain, margin: '0 0 0.5rem 0' }}>{plan.name}</h3>
                        <p style={{ fontSize: '0.78rem', color: t.textSecondary, lineHeight: 1.4, margin: '0 0 1rem 0', minHeight: '40px' }}>{plan.desc}</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: `1px solid ${t.border || '#e2e8f0'}`, paddingTop: '1rem' }}>
                          {plan.features.map((feat, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: t.textSecondary }}>
                              <Check size={12} color={plan.color} strokeWidth={3} />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, fontSize: '1.5rem', color: plan.color, marginBottom: '1rem' }}>
                          {plan.price}
                          {plan.period && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary }}>{plan.period}</span>}
                        </div>

                        <button
                          onClick={() => {
                            if (isCurrent) return;
                            if (user?.funcao === 'developer') {
                              handleActivatePlan(plan.name);
                            } else {
                              setSelectedPlanForEmail(plan.name);
                              setPlanEmailMessage('');
                              setShowPlanEmailModal(true);
                            }
                          }}
                          disabled={isCurrent}
                          style={{
                            width: '100%',
                            height: '42px',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: isCurrent ? '#cbd5e1' : plan.color,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: isCurrent ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isCurrent ? 'none' : `0 4px 10px ${plan.color}30`,
                            transition: 'all 0.2s'
                          }}
                        >
                          {isCurrent ? 'Plano Atual' : user?.funcao === 'developer' ? 'Ativar Agora' : 'Solicitar Upgrade'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* MODAIS OVERLAYS */}
      <AnimatePresence>
        {/* Modal de E-mail de Planos */}
        {showPlanEmailModal && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                maxWidth: '500px', width: '100%', backgroundColor: t.bg || '#fff',
                padding: '2rem', borderRadius: '24px', border: t.border || '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: t.textMain }}>Solicitar Plano {selectedPlanForEmail}</h3>
                <button onClick={() => setShowPlanEmailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Sua solicitação de alteração de plano será enviada diretamente para o nosso faturamento corporativo por e-mail. Adicione alguma observação se desejar:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary }}>MENSAGEM ADICIONAL</label>
                <textarea
                  rows={4}
                  value={planEmailMessage}
                  onChange={e => setPlanEmailMessage(e.target.value)}
                  placeholder="Escreva detalhes da alteração, quantidade de caixas ou telas adicionais que precisa..."
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px', border: t.border || '1px solid #cbd5e1',
                    backgroundColor: t.bgSecondary || '#f8fafc', color: t.textMain, fontSize: '0.85rem', resize: 'none', outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowPlanEmailModal(false)}
                  style={{
                    padding: '8px 16px', border: t.border || '1px solid #cbd5e1', borderRadius: '8px',
                    backgroundColor: 'transparent', color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendPlanEmail}
                  disabled={sendingEmail}
                  style={{
                    padding: '8px 20px', border: 'none', borderRadius: '8px',
                    backgroundColor: t.accent || '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar Solicitação
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de E-mail de Cancelamento */}
        {showCancelEmailModal && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                maxWidth: '500px', width: '100%', backgroundColor: t.bg || '#fff',
                padding: '2rem', borderRadius: '24px', border: t.border || '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#ef4444' }}>Solicitar Cancelamento</h3>
                <button onClick={() => setShowCancelEmailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Lamentamos ver você partir. Para solicitar o cancelamento e a rescisão/finalização do contrato da sua assinatura corporativa, por favor informe o motivo abaixo:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary }}>MOTIVO DO CANCELAMENTO</label>
                <textarea
                  rows={4}
                  value={cancelEmailMessage}
                  onChange={e => setCancelEmailMessage(e.target.value)}
                  placeholder="Por favor, relate o motivo do cancelamento para nos ajudar a melhorar o CRM..."
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px', border: t.border || '1px solid #cbd5e1',
                    backgroundColor: t.bgSecondary || '#f8fafc', color: t.textMain, fontSize: '0.85rem', resize: 'none', outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelEmailModal(false)}
                  style={{
                    padding: '8px 16px', border: t.border || '1px solid #cbd5e1', borderRadius: '8px',
                    backgroundColor: 'transparent', color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >
                  Manter Assinatura
                </button>
                <button
                  type="button"
                  onClick={handleSendCancelEmail}
                  disabled={sendingEmail}
                  style={{
                    padding: '8px 20px', border: 'none', borderRadius: '8px',
                    backgroundColor: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Confirmar Envio
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Solicitação de Ajuda/Ticket */}
        {showHelpModal && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                maxWidth: '500px', width: '100%', backgroundColor: t.bg || '#fff',
                padding: '2rem', borderRadius: '24px', border: t.border || '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: t.textMain }}>Abrir Ticket de Suporte</h3>
                <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Descreva detalhadamente qual é a sua dúvida de operação, problema técnico ou sugestão de melhoria para que nossa equipe responda rapidamente:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary }}>RELATO DO PROBLEMA OU DÚVIDA</label>
                <textarea
                  rows={4}
                  value={helpEmailMessage}
                  onChange={e => setHelpEmailMessage(e.target.value)}
                  placeholder="Relate sua dúvida operacional ou problema com as novas telas em detalhes..."
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px', border: t.border || '1px solid #cbd5e1',
                    backgroundColor: t.bgSecondary || '#f8fafc', color: t.textMain, fontSize: '0.85rem', resize: 'none', outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  style={{
                    padding: '8px 16px', border: t.border || '1px solid #cbd5e1', borderRadius: '8px',
                    backgroundColor: 'transparent', color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSendHelpEmail}
                  disabled={!helpEmailMessage.trim() || sendingEmail}
                  style={{
                    padding: '8px 20px', border: 'none', borderRadius: '8px',
                    backgroundColor: helpEmailMessage.trim() ? (t.accent || '#2563eb') : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                    cursor: helpEmailMessage.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar Mensagem
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Personalização de Telas/Acessos */}
        {showPersonalizedModal && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                maxWidth: '600px', width: '100%', backgroundColor: t.bg || '#fff',
                padding: '2.5rem', borderRadius: '28px', border: t.border || '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: t.textMain }}>Módulos e Telas Liberadas (Personalizado)</h3>
                <button onClick={() => setShowPersonalizedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Selecione quais telas e funcionalidades do CRM Master estarão liberadas e acessíveis para os operadores sob este plano personalizado:
              </p>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
                maxHeight: '260px', overflowY: 'auto', padding: '1rem',
                backgroundColor: t.bgSecondary || '#f8fafc', borderRadius: '16px', border: t.border || '1px solid #e2e8f0'
              }}>
                {SCREENS.map(screen => {
                  const isChecked = selectedPersonalizedScreens.includes(screen.id);
                  return (
                    <label
                      key={screen.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer',
                        padding: '8px 12px', borderRadius: '10px',
                        backgroundColor: isChecked ? (t.accentSoft || 'rgba(37,99,235,0.08)') : 'transparent',
                        color: isChecked ? t.accent : t.textMain,
                        fontWeight: isChecked ? 700 : 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePersonalizedScreen(screen.id)}
                        style={{ accentColor: t.accent }}
                      />
                      {screen.label}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPersonalizedModal(false)}
                  style={{
                    padding: '10px 20px', border: t.border || '1px solid #cbd5e1', borderRadius: '10px',
                    backgroundColor: 'transparent', color: t.textMain, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePersonalized}
                  style={{
                    padding: '10px 24px', border: 'none', borderRadius: '10px',
                    backgroundColor: t.accent || '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  Salvar Configuração
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Help;
