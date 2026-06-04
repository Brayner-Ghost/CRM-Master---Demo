import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, storage, auth } from '../firebase';
import { doc, getDoc, getDocs, setDoc, collection, onSnapshot, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Save, Upload, Info, Building2, Zap, CreditCard, Loader2,
  Users, Edit3, X, Check, Trash2, Plus, Shield, ShieldCheck,
  UserPlus, Layout, Monitor, Lock, Unlock, Smartphone, Cpu, Layers,
  Eye, EyeOff, Search, MapPin, Phone, Database, Download, FileSpreadsheet, Table,
  LayoutGrid, List, Contrast, Sun, Moon, CloudMoon, FileText, Mail,
  HelpCircle, AlertCircle, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportCollectionToXLSX, importXLSXToCollection } from '../utils/dataMigration';
import { maskPhone, maskCEP, maskCNPJ } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { decryptData, encryptData } from '../utils/crypto';
import packageJson from '../../package.json';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

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

const DATA_SOURCES = [
  { id: 'deals', label: 'Vendas (Oportunidades)', icon: <Zap size={20} />, color: '#f59e0b' },
  { id: 'inventory', label: 'Estoque (Produtos)', icon: <Layers size={20} />, color: '#3b82f6' },
  { id: 'contacts', label: 'Clientes (Contatos)', icon: <Users size={20} />, color: '#10b981' }
];

const IMPORT_FIELDS = {
  contacts: [
    { dbField: 'nome', label: 'Nome / Razão Social', required: true },
    { dbField: 'cpf', label: 'CPF / CNPJ' },
    { dbField: 'email', label: 'E-mail' },
    { dbField: 'telefone', label: 'Telefone' },
    { dbField: 'genero', label: 'Gênero' },
    { dbField: 'status', label: 'Status' },
    { dbField: 'dataNascimento', label: 'Data de Nascimento' },
    { dbField: 'fonte', label: 'Fonte / Origem' },
    { dbField: 'indicacao', label: 'Indicação / Recomendação' },
    { dbField: 'cep', label: 'CEP' },
    { dbField: 'logradouro', label: 'Logradouro' },
    { dbField: 'numero', label: 'Número' },
    { dbField: 'bairro', label: 'Bairro' },
    { dbField: 'cidadeUf', label: 'Cidade - UF' },
    { dbField: 'complemento', label: 'Complemento' },
    { dbField: 'entregaCep', label: 'CEP de Entrega' },
    { dbField: 'entregaLogradouro', label: 'Logradouro de Entrega' },
    { dbField: 'entregaNumero', label: 'Número de Entrega' },
    { dbField: 'entregaBairro', label: 'Bairro de Entrega' },
    { dbField: 'entregaCidadeUf', label: 'Cidade - UF de Entrega' },
    { dbField: 'entregaComplemento', label: 'Complemento de Entrega' },
    { dbField: 'entregaMesmoEndereco', label: 'Entrega mesmo endereço' }
  ],
  inventory: [
    { dbField: 'nome', label: 'Nome do Produto', required: true },
    { dbField: 'sku', label: 'SKU / Código' },
    { dbField: 'ncm', label: 'NCM' },
    { dbField: 'precoCusto', label: 'Preço de Custo' },
    { dbField: 'precoVenda', label: 'Preço de Venda', required: true },
    { dbField: 'estoque', label: 'Estoque Atual', required: true },
    { dbField: 'estoqueMinimo', label: 'Estoque Mínimo' },
    { dbField: 'validade', label: 'Data de Validade' },
    { dbField: 'alertaDias', label: 'Dias Alerta Validade' },
    { dbField: 'descricao', label: 'Descrição' },
    { dbField: 'categoria', label: 'Categoria' },
    { dbField: 'unidade', label: 'Unidade' },
    { dbField: 'channels', label: 'Canais de Venda' },
    { dbField: 'estoqueParceiros', label: 'Estoque Parceiros' },
    { dbField: 'images', label: 'Imagens (URLs)' }
  ],
  deals: [
    { dbField: 'id', label: 'ID da Venda' },
    { dbField: 'clienteNome', label: 'Nome do Cliente' },
    { dbField: 'metodoPagamento', label: 'Método de Pagamento' },
    { dbField: 'valor', label: 'Valor Subtotal' },
    { dbField: 'desconto', label: 'Desconto' },
    { dbField: 'frete', label: 'Frete' },
    { dbField: 'total', label: 'Valor Total', required: true },
    { dbField: 'totalCost', label: 'Valor Total Custo' },
    { dbField: 'items', label: 'Itens / Produtos', required: true },
    { dbField: 'operator', label: 'Operador' },
    { dbField: 'indicacao', label: 'Indicação' },
    { dbField: 'status', label: 'Status' },
    { dbField: 'observacoes', label: 'Observações' },
    { dbField: 'createdAt', label: 'Data de Criação' },
    { dbField: 'dataFinalizacao', label: 'Data de Finalização' }
  ]
};

const Settings = ({ onClose }) => {
  const { user, switchCompany, activeCompany, companyData, getTenantDoc, getTenantCollection } = useUser();
  const { t, currentTheme, setTheme, density, setDensity, viewSettings, setViewSettings, themes } = useTheme();
  const borderColor = t.border ? (t.border.split(' ')[2] || t.border) : '#e2e8f0';
  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
  const [activeTab, setActiveTab] = useState('empresa');
  const [loading, setLoading] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingRecursos, setIsEditingRecursos] = useState(false);
  const [isEditingFocusNfe, setIsEditingFocusNfe] = useState(false);
  const [isEditingN8n, setIsEditingN8n] = useState(false);
  const [isEditingPagbank, setIsEditingPagbank] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');

  // Data States
  const [company, setCompany] = useState({
    nome: '', nomeFantasia: '', cnpj: '', ie: '', cep: '',
    logradouro: '', numero: '', bairro: '', cidade: '', telefone: '', logoUrl: '',
    responsavel: '', ambiente: 'homologacao', status: 'ativa'
  });
  const [integrations, setIntegrations] = useState({
    tokenHomologacao: '', tokenProducao: '', ambiente: 'homologacao', regimeTributario: 'simples',
    plugpagAtivo: false,
    plugpagTipo: 'wifi',
    plugpagTerminalIp: '',
    plugpagTerminalNome: '',
    plugpagToken: '',
    plugpagPorta: '42007',
    plugpagAmbiente: 'homologacao',
    plugpagPixExibicao: 'maquininha',
    emissaoNotaFiscal: 'inativo',
    tipoPix: '20',
    pixNaTela: 'inativo',
    cartao: 'inativo',
    pixNaMaquininha: 'inativo',
    linkDePagamento: 'inativo',
    n8nAtendimentoAtivo: false,
    n8nWebhookUrl: ''
  });
  const [showTokenProducao, setShowTokenProducao] = useState(false);
  const [showTokenHomologacao, setShowTokenHomologacao] = useState(false);

  // PlugPag States
  const [plugpagDevices, setPlugpagDevices] = useState([]);
  const [testingPlugpag, setTestingPlugpag] = useState(false);
  const [searchingPlugpag, setSearchingPlugpag] = useState(false);
  const [showPlugpagToken, setShowPlugpagToken] = useState(false);
  const [comPorts, setComPorts] = useState(['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10']);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [customComMode, setCustomComMode] = useState(false);
  const [customDeviceMode, setCustomDeviceMode] = useState(false);
  const [users, setUsers] = useState([]);

  // Mercado Pago States
  const [mercadoPago, setMercadoPago] = useState({
    ativo: false,
    accessToken: '',
    publicKey: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    cartaoAtivo: true
  });
  const [isMercadoPagoEditing, setIsMercadoPagoEditing] = useState(false);
  const [showMercadoPagoSecrets, setShowMercadoPagoSecrets] = useState(false);
  const [tempMercadoPago, setTempMercadoPago] = useState(null);
  const [savingMercadoPago, setSavingMercadoPago] = useState(false);

  // Stone / Ton States
  const [stone, setStone] = useState({
    ativo: false,
    stoneCode: '',
    partnerApiKey: '',
    webhookUrl: '',
    pixAtivo: true,
    cartaoAtivo: true
  });
  const [isStoneEditing, setIsStoneEditing] = useState(false);
  const [showStoneSecrets, setShowStoneSecrets] = useState(false);
  const [tempStone, setTempStone] = useState(null);
  const [savingStone, setSavingStone] = useState(false);

  // Asaas States
  const [asaas, setAsaas] = useState({
    ativo: false,
    apiKey: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    boletoAtivo: true,
    cartaoAtivo: true
  });
  const [isAsaasEditing, setIsAsaasEditing] = useState(false);
  const [showAsaasSecrets, setShowAsaasSecrets] = useState(false);
  const [tempAsaas, setTempAsaas] = useState(null);
  const [savingAsaas, setSavingAsaas] = useState(false);

  // Banco do Brasil States
  const [bancoDoBrasil, setBancoDoBrasil] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    developerKey: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    boletoAtivo: true
  });
  const [isBancoDoBrasilEditing, setIsBancoDoBrasilEditing] = useState(false);
  const [showBancoDoBrasilSecrets, setShowBancoDoBrasilSecrets] = useState(false);
  const [tempBancoDoBrasil, setTempBancoDoBrasil] = useState(null);
  const [savingBancoDoBrasil, setSavingBancoDoBrasil] = useState(false);

  // Itau States
  const [itau, setItau] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    boletoAtivo: true
  });
  const [isItauEditing, setIsItauEditing] = useState(false);
  const [showItauSecrets, setShowItauSecrets] = useState(false);
  const [tempItau, setTempItau] = useState(null);
  const [savingItau, setSavingItau] = useState(false);

  // Banco Inter States
  const [bancoInter, setBancoInter] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    boletoAtivo: true
  });
  const [isBancoInterEditing, setIsBancoInterEditing] = useState(false);
  const [showBancoInterSecrets, setShowBancoInterSecrets] = useState(false);
  const [tempBancoInter, setTempBancoInter] = useState(null);
  const [savingBancoInter, setSavingBancoInter] = useState(false);

  // Nubank States
  const [nubank, setNubank] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    nupayAtivo: true
  });
  const [isNubankEditing, setIsNubankEditing] = useState(false);
  const [showNubankSecrets, setShowNubankSecrets] = useState(false);
  const [tempNubank, setTempNubank] = useState(null);
  const [savingNubank, setSavingNubank] = useState(false);

  // Caixa States
  const [caixa, setCaixa] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    ambiente: 'homologacao',
    pixAtivo: true,
    boletoAtivo: true
  });
  const [isCaixaEditing, setIsCaixaEditing] = useState(false);
  const [showCaixaSecrets, setShowCaixaSecrets] = useState(false);
  const [tempCaixa, setTempCaixa] = useState(null);
  const [savingCaixa, setSavingCaixa] = useState(false);



  // InfinityPay States
  const [infinityPay, setInfinityPay] = useState({
    ativo: false,
    handle: '',
    clientId: '',
    clientSecret: '',
    webhookSecret: '',
    ambiente: 'sandbox',
    pixAtivo: true,
    debitoAtivo: true,
    creditoAtivo: true,
    parcelamentoMaximo: 12,
    taxaPix: '',
    taxaDebito: '',
    taxaCredito: ''
  });
  const [isInfinityPayEditing, setIsInfinityPayEditing] = useState(false);
  const [showInfinityPaySecrets, setShowInfinityPaySecrets] = useState(false);
  const [tempInfinityPay, setTempInfinityPay] = useState(null);
  const [savingInfinityPay, setSavingInfinityPay] = useState(false);

  // Subscription State
  const [subscription, setSubscription] = useState(null);

  // Policies States
  const [policies, setPolicies] = useState({
    empresaCriacaoPermitida: ['developer'],
    empresaRequerCNPJ: true,
    empresaRequerResponsavel: true,
    usuarioCriacaoPermitida: ['admin', 'responsavel', 'developer'],
    usuarioRequerEmailVerificado: true,
    usuarioExpiracaoDias: 0,
    recursosBloqueaveisPorUsuario: true
  });
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Migration States
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [selectedImportSource, setSelectedImportSource] = useState('deals');
  const [selectedExportSource, setSelectedExportSource] = useState('deals');
  const [isImportHovered, setIsImportHovered] = useState(false);

  // Import Mapping States
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importSample, setImportSample] = useState({});
  const [importRows, setImportRows] = useState([]);
  const [importMapping, setImportMapping] = useState({});

  // Export Column Selection Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState([]);

  useEffect(() => {
    if (showMappingModal || showExportModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMappingModal, showExportModal]);

  // Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: '', email: '', funcao: 'colaborador', telas: [], allAccess: false
  });

  // Temporary states for canceling edits
  const [tempCompany, setTempCompany] = useState(null);
  const [tempIntegrations, setTempIntegrations] = useState(null);

  // User Details Modal States
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminPasswordForDelete, setAdminPasswordForDelete] = useState('');
  const [deletingUserInProgress, setDeletingUserInProgress] = useState(false);

  const cancelAllEdits = () => {
    setIsEditingCompany(false);
    setIsEditingRecursos(false);
    setIsEditingFocusNfe(false);
    setIsEditingN8n(false);
    setIsEditingPagbank(false);
    setIsInfinityPayEditing(false);
    setIsMercadoPagoEditing(false);
    setIsStoneEditing(false);
    setIsAsaasEditing(false);
    setIsBancoDoBrasilEditing(false);
    setIsItauEditing(false);
    setIsBancoInterEditing(false);
    setIsNubankEditing(false);
    setIsCaixaEditing(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setCompany({
        nome: '', nomeFantasia: '', cnpj: '', ie: '', cep: '',
        logradouro: '', numero: '', bairro: '', cidade: '', telefone: '', logoUrl: '',
        responsavel: '', ambiente: 'homologacao', status: 'ativa'
      });
      setIntegrations({
        tokenHomologacao: '', tokenProducao: '', ambiente: 'homologacao', regimeTributario: 'simples',
        plugpagAtivo: false,
        plugpagTipo: 'wifi',
        plugpagTerminalIp: '',
        plugpagTerminalNome: '',
        plugpagToken: '',
        plugpagPorta: '42007',
        plugpagAmbiente: 'homologacao',
        plugpagPixExibicao: 'maquininha',
        emissaoNotaFiscal: 'inativo',
        tipoPix: '20',
        pixNaTela: 'inativo',
        cartao: 'inativo',
        pixNaMaquininha: 'inativo',
        linkDePagamento: 'inativo',
        n8nAtendimentoAtivo: false,
        n8nWebhookUrl: ''
      });

      const targetComp = activeCompany || user?.empresa || 'development';
      const c = await getDoc(doc(db, 'business', targetComp));

      let companyDataMerged = {
        nome: '', nomeFantasia: '', cnpj: '', ie: '', cep: '',
        logradouro: '', numero: '', bairro: '', cidade: '', telefone: '', logoUrl: '',
        responsavel: '', ambiente: 'homologacao', status: 'ativa'
      };

      if (c.exists()) {
        const data = c.data();
        companyDataMerged = {
          ...companyDataMerged,
          nome: data.nome || '',
          nomeFantasia: data.nomeFantasia || '',
          cnpj: data.cnpj || '',
          ie: data.ie || '',
          cep: data.cep || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          telefone: data.telefone || '',
          logoUrl: data.logoUrl || '',
          responsavel: data.responsavel || '',
          ambiente: data.ambiente ? (decryptData(data.ambiente) || 'homologacao') : 'homologacao',
          status: data.status ? (decryptData(data.status) || 'ativa') : 'ativa'
        };
      }

      setCompany(companyDataMerged);

      const i = await getDoc(getTenantDoc('company', 'integrations'));
      if (i.exists()) setIntegrations(prev => ({ ...prev, ...i.data() }));

      const ip = await getDoc(getTenantDoc('settings', 'infinitypay'));
      if (ip.exists()) setInfinityPay(prev => ({ ...prev, ...ip.data() }));

      const mp = await getDoc(getTenantDoc('settings', 'mercadopago'));
      if (mp.exists()) setMercadoPago(prev => ({ ...prev, ...mp.data() }));
      const st = await getDoc(getTenantDoc('settings', 'stone'));
      if (st.exists()) setStone(prev => ({ ...prev, ...st.data() }));
      const as = await getDoc(getTenantDoc('settings', 'asaas'));
      if (as.exists()) setAsaas(prev => ({ ...prev, ...as.data() }));
      const bb = await getDoc(getTenantDoc('settings', 'bancodobrasil'));
      if (bb.exists()) setBancoDoBrasil(prev => ({ ...prev, ...bb.data() }));
      const it = await getDoc(getTenantDoc('settings', 'itau'));
      if (it.exists()) setItau(prev => ({ ...prev, ...it.data() }));
      const bi = await getDoc(getTenantDoc('settings', 'bancointer'));
      if (bi.exists()) setBancoInter(prev => ({ ...prev, ...bi.data() }));
      const nu = await getDoc(getTenantDoc('settings', 'nubank'));
      if (nu.exists()) setNubank(prev => ({ ...prev, ...nu.data() }));
      const cx = await getDoc(getTenantDoc('settings', 'caixa'));
      if (cx.exists()) setCaixa(prev => ({ ...prev, ...cx.data() }));
      const pol = await getDoc(getTenantDoc('settings', 'policies'));
      if (pol.exists()) setPolicies(prev => ({ ...prev, ...pol.data() }));
      const sub = await getDoc(getTenantDoc('company', 'subscription'));
      if (sub.exists()) {
        const sData = sub.data();
        setSubscription({
          ...sData,
          plano: decryptData(sData.plano) || 'Básico',
          status: sData.status ? (decryptData(sData.status) || sData.status) : 'Ativa'
        });
      }

    };
    loadData();

    // Listen for users belonging to the active company
    const targetComp = activeCompany || user?.empresa || 'development';
    const qUsers = query(collection(db, 'users'), where('empresa', '==', targetComp));
    const unsub = onSnapshot(qUsers, (s) => {
      setUsers(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen for companies if dev or system owner
    let unsubCompanies;
    if (user?.funcao === 'developer' || user?.empresa === 'development') {
      // 1. Escutar a coleção unificada 'business'
      unsubCompanies = onSnapshot(collection(db, 'business'), (s) => {
        setCompanies(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // 2. Migração automática de documentos antigos da coleção 'empresas' para 'business'
      const migrateOldEmpresas = async () => {
        try {
          const oldSnap = await getDocs(collection(db, 'empresas'));
          for (const docSnap of oldSnap.docs) {
            const data = docSnap.data();
            const companyId = docSnap.id;

            // Ignorar documentos vazios ou desnecessários
            if (!companyId) continue;

            const bDocRef = doc(db, 'business', companyId);
            const bDocSnap = await getDoc(bDocRef);
            if (!bDocSnap.exists()) {
              // Copia os metadados cadastrais diretamente para business/{companyId}
              await setDoc(bDocRef, {
                nome: data.nome || data.nomeFantasia || companyId,
                nomeFantasia: data.nomeFantasia || data.nome || '',
                cnpj: data.cnpj || '',
                responsavel: data.responsavel || '',
                email: data.email || '',
                createdAt: data.createdAt || new Date().toISOString()
              });
            }

            // Garante compatibilidade do arquivo settings/company das demais telas
            const sDocRef = doc(db, `business/${companyId}/settings`, 'company');
            const sDocSnap = await getDoc(sDocRef);
            if (!sDocSnap.exists()) {
              await setDoc(sDocRef, {
                nome: data.nome || data.nomeFantasia || companyId,
                nomeFantasia: data.nomeFantasia || data.nome || '',
                cnpj: data.cnpj || '',
                responsavel: data.responsavel || '',
                email: data.email || ''
              });
            }

            // Exclui o documento antigo da coleção redundante 'empresas'
            await deleteDoc(docSnap.ref);
          }
        } catch (err) {
          console.error("Erro na auto-migração de empresas:", err);
        }
      };
      migrateOldEmpresas();
    }

    return () => {
      unsub();
      if (unsubCompanies) unsubCompanies();
    };
  }, [user, activeCompany]);

  const handleStartEditCompany = () => {
    setTempCompany({ ...company });
    setIsEditingCompany(true);
  };

  const handleCancelEditCompany = () => {
    if (tempCompany) setCompany(tempCompany);
    setIsEditingCompany(false);
  };

  const handleStartEditRecursos = () => {
    setTempIntegrations({ ...integrations });
    setIsEditingRecursos(true);
  };

  const handleCancelEditRecursos = () => {
    if (tempIntegrations) setIntegrations(tempIntegrations);
    setIsEditingRecursos(false);
  };

  const handleStartEditFocusNfe = () => {
    setTempIntegrations({ ...integrations });
    setIsEditingFocusNfe(true);
  };

  const handleCancelEditFocusNfe = () => {
    if (tempIntegrations) setIntegrations(tempIntegrations);
    setIsEditingFocusNfe(false);
  };

  const handleStartEditN8n = () => {
    setTempIntegrations({ ...integrations });
    setIsEditingN8n(true);
  };

  const handleCancelEditN8n = () => {
    if (tempIntegrations) setIntegrations(tempIntegrations);
    setIsEditingN8n(false);
  };



  const handleStartEditPagbank = () => {
    setTempIntegrations({ ...integrations });
    setIsEditingPagbank(true);
  };

  const handleCancelEditPagbank = () => {
    if (tempIntegrations) setIntegrations(tempIntegrations);
    setIsEditingPagbank(false);
  };

  const handleSave = async (type) => {
    setLoading(true);
    try {
      if (type === 'company') {
        const targetComp = activeCompany || user?.empresa || 'development';
        const companyRef = doc(db, 'business', targetComp);
        const companySnap = await getDoc(companyRef);
        const existingCompany = companySnap.exists() ? companySnap.data() : {};
        const companyCreatedAt = existingCompany.createdAt || new Date().toISOString();
        const companyModifications = [...(existingCompany.modificacoes || []), new Date().toISOString()];

        const companyData = {
          nome: company.nome || '',
          nomeFantasia: company.nomeFantasia || '',
          cnpj: company.cnpj || '',
          ie: company.ie || '',
          cep: company.cep || '',
          logradouro: company.logradouro || '',
          numero: company.numero || '',
          bairro: company.bairro || '',
          cidade: company.cidade || '',
          telefone: company.telefone || '',
          logoUrl: company.logoUrl || '',
          responsavel: company.responsavel || '',
          ambiente: encryptData(company.ambiente || 'homologacao'),
          status: encryptData(company.status || 'ativa'),
          createdAt: companyCreatedAt,
          modificacoes: companyModifications
        };
        await setDoc(companyRef, companyData, { merge: true });
        setIsEditingCompany(false);
      } else if (type === 'integrations') {
        // Save company/integrations
        const intRef = getTenantDoc('company', 'integrations');
        const intSnap = await getDoc(intRef);
        const existingInt = intSnap.exists() ? intSnap.data() : {};
        const intCreatedAt = existingInt.createdAt || new Date().toISOString();
        const intModifications = [...(existingInt.modificacoes || []), new Date().toISOString()];

        const intData = {
          ...integrations,
          createdAt: intCreatedAt,
          modificacoes: intModifications
        };
        await setDoc(intRef, intData);
        setIsEditingRecursos(false);
        setIsEditingFocusNfe(false);
        setIsEditingN8n(false);
        setIsEditingPagbank(false);
      }
      alert('Configurações atualizadas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar as configurações.');
    }
    setLoading(false);
  };

  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const targetComp = activeCompany || user?.empresa || 'development';
    const sRef = ref(storage, `logos/${targetComp}/company`);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    setCompany({ ...company, logoUrl: url });
    setLoading(false);
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleOpenNewCompanyModal = () => {
    setNewCompanyCnpj('');
    setShowNewCompanyModal(true);
  };

  const handleOpenUserModal = () => {
    setNewUser({
      nome: '',
      email: '',
      funcao: 'colaborador',
      telas: [],
      allAccess: false
    });
    setShowUserModal(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (creatingUser) return;
    setCreatingUser(true);

    const randomPass = generateRandomPassword();
    let tempApp;
    try {
      const targetComp = activeCompany || user?.empresa || 'development';

      // Firebase configuration
      const firebaseConfig = {
        apiKey: "mock-demo-api-key-safe-to-expose",
        authDomain: "crm-master-demo.firebaseapp.com",
        projectId: "crm-master-demo",
        storageBucket: "crm-master-demo.appspot.com",
        messagingSenderId: "000000000000",
        appId: "1:000000000000:web:mockappid00000000"
      };

      // 1. Create a temporary Firebase app to create the user in Auth
      const tempAppName = `temp-auth-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      let uid;
      try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, newUser.email, randomPass);
        uid = userCredential.user.uid;
        await tempAuth.signOut();
      } catch (authErr) {
        console.error("Firebase Auth Error:", authErr);
        let errorMsg = 'Erro ao criar usuário no Firebase Auth.';
        if (authErr.code === 'auth/email-already-in-use') {
          errorMsg = 'Este e-mail já está em uso!';
        } else if (authErr.code === 'auth/invalid-email') {
          errorMsg = 'E-mail inválido!';
        } else if (authErr.code === 'auth/weak-password') {
          errorMsg = 'A senha gerada é muito fraca!';
        }
        alert(errorMsg);
        setCreatingUser(false);
        return;
      }

      // 2. Save user document in Firestore `/users/{uid}`
      await setDoc(doc(db, 'users', uid), {
        nome: newUser.nome,
        email: encryptData(newUser.email),
        funcao: encryptData(newUser.funcao),
        empresa: targetComp,
        active: encryptData('true'),
        allAccess: encryptData(newUser.allAccess ? 'true' : 'false'),
        requirePasswordChange: encryptData('true'),
        telas: newUser.telas,
        createdAt: new Date().toISOString()
      });

      // 3. Immediately trigger password reset email to their access email
      try {
        await sendPasswordResetEmail(auth, newUser.email);
      } catch (resetErr) {
        console.error("Error sending reset password email:", resetErr);
      }

      setShowUserModal(false);
      setNewUser({ nome: '', email: '', funcao: 'colaborador', telas: [], allAccess: false });
      alert('Usuário criado com sucesso! Um e-mail de redefinição de senha foi enviado.');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar usuário.');
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (e) {
          console.error("Error deleting temp app:", e);
        }
      }
      setCreatingUser(false);
    }
  };

  const togglePermission = (id) => {
    setNewUser(prev => {
      const telas = prev.telas.includes(id)
        ? prev.telas.filter(t => t !== id)
        : [...prev.telas, id];
      return { ...prev, telas, allAccess: telas.length === SCREENS.length };
    });
  };

  const toggleAllAccess = () => {
    setNewUser(prev => ({
      ...prev,
      allAccess: !prev.allAccess,
      telas: !prev.allAccess ? SCREENS.map(s => s.id) : []
    }));
  };

  const handleExport = async () => {
    if (selectedExportSource === 'contacts' && user?.funcao !== 'developer') {
      alert('Apenas desenvolvedores podem exportar dados de clientes.');
      return;
    }
    const fields = IMPORT_FIELDS[selectedExportSource] || [];
    setSelectedExportColumns(fields.map(f => f.dbField));
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    if (selectedExportColumns.length === 0) {
      alert('Selecione pelo menos uma coluna para exportar.');
      return;
    }
    setShowExportModal(false);
    setMigrationLoading(true);
    try {
      const companyId = activeCompany || user?.empresa || 'development';
      const label = DATA_SOURCES.find(s => s.id === selectedExportSource).label;
      await exportCollectionToXLSX(selectedExportSource, label, companyId, selectedExportColumns);
    } catch (e) {
      alert(e.message || 'Erro ao exportar dados.');
    } finally {
      setMigrationLoading(false);
    }
  };

  const closeExportModal = () => {
    setShowExportModal(false);
    setSelectedExportColumns([]);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Parse file to get headers and sample row
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (jsonData.length === 0) {
          alert('O arquivo está vazio.');
          return;
        }

        // Get headers
        const headers = [];
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
          let hdr = "UNKNOWN " + C;
          if (cell && cell.t) hdr = XLSX.utils.format_cell(cell);
          headers.push(hdr);
        }

        // First data row for preview
        const sampleRow = jsonData[0] || {};

        // Auto-map based on similar names
        const initialMapping = {};
        const fieldsForSource = IMPORT_FIELDS[selectedImportSource] || [];
        fieldsForSource.forEach(f => {
          // Find matching header
          const match = headers.find(h => {
            const cleanH = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            const cleanLabel = f.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            const cleanDbField = f.dbField.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return cleanH === cleanLabel || cleanH === cleanDbField || cleanLabel.includes(cleanH) || cleanDbField.includes(cleanH);
          });
          initialMapping[f.dbField] = match || '';
        });

        setImportFile(file);
        setImportHeaders(headers);
        setImportSample(sampleRow);
        setImportRows(jsonData.slice(0, 5));
        setImportMapping(initialMapping);
        setShowMappingModal(true);
      } catch (err) {
        alert('Erro ao ler arquivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  const handleConfirmImport = async () => {
    // Validate required fields
    const fieldsForSource = IMPORT_FIELDS[selectedImportSource] || [];
    const missingRequired = fieldsForSource.filter(f => f.required && !importMapping[f.dbField]);
    if (missingRequired.length > 0) {
      alert(`Por favor, mapeie os campos obrigatórios: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setShowMappingModal(false);
    setMigrationLoading(true);
    setMigrationProgress(0);

    try {
      const companyId = activeCompany || user?.empresa || 'development';
      const result = await importXLSXToCollection(importFile, selectedImportSource, (p) => setMigrationProgress(p), importMapping, companyId);

      const totalImported = (result.added || 0) + (result.updated || 0);
      let msg = `Sucesso! ${totalImported} registros foram importados (Adicionados: ${result.added || 0}, Atualizados: ${result.updated || 0}).`;
      if (result.invalidCpfCount > 0) msg += `\n⚠️ CPFs/CNPJs inválidos ignorados: ${result.invalidCpfCount}`;
      if (result.invalidCepCount > 0) msg += `\n⚠️ CEPs inválidos corrigidos/ignorados: ${result.invalidCepCount}`;
      if (result.errors && result.errors.length > 0) {
        msg += `\n\nErros em ${result.errors.length} linhas (veja console para detalhes).`;
        console.error("Erros de importação:", result.errors);
      }
      alert(msg);
    } catch (e) {
      alert(e.message || 'Erro ao importar dados. Verifique o formato do arquivo.');
    } finally {
      setMigrationLoading(false);
      setMigrationProgress(0);
      setImportFile(null);
      setImportHeaders([]);
      setImportSample({});
      setImportRows([]);
      setImportMapping({});
    }
  };

  const handleMappingChange = (dbField, value) => {
    setImportMapping(prev => {
      const updated = { ...prev, [dbField]: value };

      // Se acabou de mapear o CEP, limpa os campos de endereço direto
      if (dbField === 'cep' && value) {
        delete updated.logradouro;
        delete updated.bairro;
        delete updated.cidadeUf;
      }

      // Se desmarcou/ignorou "Entrega mesmo endereço", limpa campos de entrega
      if (dbField === 'entregaMesmoEndereco' && !value) {
        delete updated.entregaCep;
        delete updated.entregaLogradouro;
        delete updated.entregaNumero;
        delete updated.entregaBairro;
        delete updated.entregaCidadeUf;
        delete updated.entregaComplemento;
      }

      return updated;
    });
  };

  const closeMappingModal = () => {
    setShowMappingModal(false);
    setImportFile(null);
    setImportHeaders([]);
    setImportSample({});
    setImportRows([]);
    setImportMapping({});
  };

  const validateCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj == '') return false;
    if (cnpj.length != 14) return false;
    if (cnpj == "00000000000000" || cnpj == "11111111111111" || cnpj == "22222222222222" || cnpj == "33333333333333" || cnpj == "44444444444444" || cnpj == "55555555555555" || cnpj == "66666666666666" || cnpj == "77777777777777" || cnpj == "88888888888888" || cnpj == "99999999999999")
      return false;
    let tamanho = cnpj.length - 2
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;
    return true;
  };

  const handleCepBlur = async () => {
    const clean = company.cep.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCompany(prev => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: `${data.localidade} - ${data.uf}`
          }));
        }
      } catch (e) { console.error(e); }
    }
  };

  const fetchPlugpagDevices = async (type) => {
    setSearchingPlugpag(true);
    try {
      const targetType = type || integrations.plugpagTipo || 'wifi';
      const currentIp = integrations.plugpagTerminalIp || '';
      const currentName = integrations.plugpagTerminalNome || '';
      const res = await fetch(`http://localhost:5000/api/plugpag/devices?type=${targetType}&currentIp=${encodeURIComponent(currentIp)}&currentName=${encodeURIComponent(currentName)}`);
      const data = await res.json();
      if (data.success) {
        setPlugpagDevices(data.devices || []);
        if (data.comPorts && data.comPorts.length > 0) {
          setComPorts(data.comPorts);
        }
        if (data.pairedDevices) {
          setPairedDevices(data.pairedDevices);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar dispositivos no backend:', e);
    } finally {
      setSearchingPlugpag(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'integracoes') {
      if (integrations.plugpagTipo === 'wifi') {
        fetchPlugpagDevices('bluetooth').then(() => {
          fetchPlugpagDevices('wifi');
        });
      } else {
        fetchPlugpagDevices('bluetooth');
      }
    } else if (integrations.plugpagAtivo) {
      fetchPlugpagDevices(integrations.plugpagTipo);
    }
  }, [activeTab, integrations.plugpagAtivo, integrations.plugpagTipo]);

  useEffect(() => {
    if (integrations.plugpagTipo === 'bluetooth' && integrations.plugpagTerminalIp) {
      const isStandard = comPorts.includes(integrations.plugpagTerminalIp);
      if (!isStandard && integrations.plugpagTerminalIp.trim() !== '') {
        setCustomComMode(true);
      }
    }
  }, [integrations.plugpagTerminalIp, comPorts, integrations.plugpagTipo]);

  useEffect(() => {
    if (integrations.plugpagTipo === 'bluetooth' && integrations.plugpagTerminalNome) {
      const isKnown = pairedDevices.includes(integrations.plugpagTerminalNome) ||
        plugpagDevices.some(d => d.name === integrations.plugpagTerminalNome);
      if (!isKnown && integrations.plugpagTerminalNome.trim() !== '' && pairedDevices.length > 0) {
        setCustomDeviceMode(true);
      }
    }
  }, [integrations.plugpagTerminalNome, pairedDevices, plugpagDevices, integrations.plugpagTipo]);

  const testPlugpagConnection = async () => {
    setTestingPlugpag(true);
    try {
      const res = await fetch('http://localhost:5000/api/plugpag/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionType: integrations.plugpagTipo,
          terminalIp: integrations.plugpagTerminalIp,
          port: integrations.plugpagPorta,
          terminalName: integrations.plugpagTerminalNome,
          ambiente: integrations.plugpagAmbiente || 'homologacao'
        })
      });
      const data = await res.json();
      alert(data.message || 'Teste de conectividade concluído.');
    } catch (e) {
      alert('Erro ao testar conexão: verifique se o servidor backend está ativo na porta 5000.');
    } finally {
      setTestingPlugpag(false);
    }
  };

  const handleCompanyPasswordReset = async () => {
    if (!company.email) {
      alert('E-mail de contato da empresa não informado.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, company.email);
      alert(`E-mail de redefinição de senha enviado com sucesso para: ${company.email}`);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar e-mail de redefinição: ' + e.message);
    }
  };

  const handleOpenUserDetails = (u) => {
    const decryptedFuncao = decryptData(u.funcao);
    if (user?.funcao === 'admin' && decryptedFuncao === 'responsavel') {
      alert('Administradores não possuem permissão para visualizar ou alterar dados do responsável.');
      return;
    }

    const decryptedEmail = decryptData(u.email);
    const decryptedAllAccess = decryptData(u.allAccess) === 'true' || u.allAccess === true;
    const decryptedEmailContato = u.emailContato ? decryptData(u.emailContato) : '';
    const decryptedTelefone = u.telefone ? decryptData(u.telefone) : '';
    const decryptedActive = u.active ? (decryptData(u.active) === 'true' || u.active === true) : true;

    setSelectedUser({
      ...u,
      email: decryptedEmail,
      funcao: decryptedFuncao,
      allAccess: decryptedAllAccess,
      telas: u.telas || [],
      emailContato: decryptedEmailContato,
      telefone: decryptedTelefone,
      active: decryptedActive
    });
    setIsEditingUser(false);
    setShowDeleteConfirm(false);
    setAdminPasswordForDelete('');
    setShowUserDetailsModal(true);
  };

  const handleSaveUserDetails = async () => {
    if (!selectedUser.nome || !selectedUser.email || !selectedUser.funcao) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', selectedUser.id);

      const updateData = {
        nome: selectedUser.nome,
        email: encryptData(selectedUser.email),
        funcao: encryptData(selectedUser.funcao),
        active: encryptData(selectedUser.active ? 'true' : 'false'),
        allAccess: encryptData(selectedUser.allAccess ? 'true' : 'false'),
        telas: selectedUser.telas,
      };

      if (selectedUser.funcao === 'responsavel') {
        updateData.emailContato = encryptData(selectedUser.emailContato || '');
        updateData.telefone = encryptData(selectedUser.telefone || '');
      } else {
        updateData.emailContato = '';
        updateData.telefone = '';
      }

      await setDoc(userDocRef, updateData, { merge: true });

      alert('Usuário atualizado com sucesso!');
      setIsEditingUser(false);
      setShowUserDetailsModal(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar usuário.');
    }
  };

  const handleDeleteUserConfirmed = async () => {
    if (!adminPasswordForDelete) {
      alert('Por favor, insira sua senha.');
      return;
    }
    setDeletingUserInProgress(true);
    try {
      const currentUserEmail = auth.currentUser?.email;
      if (!currentUserEmail) {
        alert('E-mail do administrador logado não encontrado.');
        setDeletingUserInProgress(false);
        return;
      }

      const credential = EmailAuthProvider.credential(currentUserEmail, adminPasswordForDelete);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await deleteDoc(doc(db, 'users', selectedUser.id));

      alert('Usuário excluído com sucesso!');
      setShowUserDetailsModal(false);
      setSelectedUser(null);
      setIsEditingUser(false);
      setShowDeleteConfirm(false);
      setAdminPasswordForDelete('');
    } catch (e) {
      console.error(e);
      alert('Erro de confirmação de senha. Verifique sua senha e tente novamente.');
    } finally {
      setDeletingUserInProgress(false);
    }
  };

  const toggleSelectedUserPermission = (screenId) => {
    setSelectedUser(prev => {
      const telas = prev.telas.includes(screenId)
        ? prev.telas.filter(t => t !== screenId)
        : [...prev.telas, screenId];
      return { ...prev, telas, allAccess: telas.length === SCREENS.length };
    });
  };

  const toggleSelectedUserAllAccess = () => {
    setSelectedUser(prev => ({
      ...prev,
      allAccess: !prev.allAccess,
      telas: !prev.allAccess ? SCREENS.map(s => s.id) : []
    }));
  };

  const responsaveis = users.filter(u => {
    try {
      return decryptData(u.funcao) === 'responsavel';
    } catch (e) {
      return u.funcao === 'responsavel';
    }
  });

  const amb = company?.ambiente || integrations?.ambiente || 'homologacao';
  const statusCor = company?.status === 'bloqueada'
    ? { cor: '#ef4444', label: 'Bloqueada', bg: '#fee2e2' }
    : company?.status === 'inativa'
      ? { cor: '#f59e0b', label: 'Inativa', bg: '#fef3c7' }
      : amb === 'producao'
        ? { cor: '#10b981', label: 'Ativo — Produção', bg: '#d1fae5' }
        : { cor: '#3b82f6', label: 'Ativo — Homologação', bg: '#dbeafe' };

  return (
    <div className="settings-page max-w-[1600px] mx-auto p-4">
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Group 1: Title */}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Configurações</h1>
          </div>

          {/* Group 2: Tabs (center) */}
          <div style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', justifyContent: 'center', minWidth: '400px' }}>
            <nav style={{
              display: 'flex', gap: '4px',
              padding: '4px', backgroundColor: t.bgSecondary, borderRadius: t.radiusSmall,
              border: t.borderBold, boxShadow: t.shadowSmall
            }}>
              {[
                { id: 'empresa', label: 'Empresa', icon: Building2 },
                { id: 'integracoes', label: 'Integração', icon: Zap },
                { id: 'sistema', label: 'Sistema', icon: Monitor }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); cancelAllEdits(); }}
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

            {(user?.funcao === 'developer' || user?.empresa === 'development') && (
              <select
                value={activeCompany || ''}
                onChange={e => switchCompany(e.target.value)}
                style={{
                  height: '42px',
                  padding: '0 16px',
                  backgroundColor: t.bgSecondary,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  color: t.textMain,
                  outline: 'none',
                  fontWeight: 600,
                  boxShadow: t.shadowSmall,
                  cursor: 'pointer',
                  minWidth: '180px'
                }}
              >
                <option value="development">Development</option>
                {companies.filter(c => {
                  const cid = (c.id || '').toLowerCase();
                  const cname = (c.nome || '').toLowerCase();
                  const cfantasia = (c.nomeFantasia || '').toLowerCase();
                  return !cid.includes('development') && !cname.includes('development') && !cfantasia.includes('development');
                }).map(c => (
                  <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome || c.id}</option>
                ))}
              </select>
            )}
          </div>

          {/* Group 3: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(user?.funcao === 'developer' || user?.empresa === 'development') && (
              <button
                onClick={handleOpenNewCompanyModal}
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
                <Plus size={18} strokeWidth={3} /> Empresa
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                style={{
                  height: '42px',
                  width: '42px',
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  backgroundColor: t.bgSecondary,
                  color: t.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: t.shadowSmall
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="tab-content" style={{ minHeight: '400px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'empresa' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

                {/* ─── DADOS DA EMPRESA ─── */}
                <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '10px', display: 'flex' }}>
                        <Building2 size={18} />
                      </div>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Dados da Empresa</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {user?.funcao === 'developer' && (
                        !isEditingCompany ? (
                          <button
                            type="button"
                            onClick={handleStartEditCompany}
                            style={{
                              backgroundColor: t.accent, color: t.accentContrast,
                              padding: '0 1.25rem', height: '38px', fontWeight: 600,
                              border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                              fontSize: '0.875rem', transition: 'all 0.2s',
                              boxShadow: `0 4px 12px ${t.accent}25`
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            <Edit3 size={16} /> Editar
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={handleCancelEditCompany}
                              style={{
                                backgroundColor: '#ef4444', color: '#fff',
                                padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '0.875rem', transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              <X size={16} /> Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave('company')}
                              style={{
                                backgroundColor: '#10b981', color: '#fff',
                                padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '0.875rem', transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '100px', height: '100px', borderRadius: '15px',
                      backgroundColor: '#ffffff', border: '1px dashed #cbd5e1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative', flexShrink: 0
                    }}>
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: isDark ? 'brightness(0.8)' : 'none',
                            transition: 'filter 0.3s ease'
                          }}
                        />
                      ) : (
                        <Building2 size={40} color="#cbd5e1" />
                      )}
                      {isEditingCompany && (
                        <label style={{
                          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                          cursor: 'pointer', transition: '0.2s'
                        }} className="hover:opacity-100">
                          <Upload size={24} />
                          <input type="file" hidden onChange={handleLogo} />
                        </label>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem', flex: 1 }}>
                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '140px' }}>
                        <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Ambiente</label>
                        <select
                          disabled={!isEditingCompany || user?.funcao !== 'developer'}
                          className="field-input"
                          value={company.ambiente || 'homologacao'}
                          onChange={e => setCompany({ ...company, ambiente: e.target.value })}
                          style={{
                            height: '38px',
                            padding: '0 10px',
                            backgroundColor: (!isEditingCompany || user?.funcao !== 'developer') ? 'rgba(0, 0, 0, 0.08)' : t.bgSecondary || 'transparent',
                            color: t.textMain,
                            border: t.borderBold || '1px solid rgba(255,255,255,0.1)',
                            cursor: (!isEditingCompany || user?.funcao !== 'developer') ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="homologacao">Homologação</option>
                          <option value="producao">Produção</option>
                          <option value="freetrial">Free Trial</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '140px' }}>
                        <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Status da Empresa</label>
                        <select
                          disabled={!isEditingCompany || user?.funcao !== 'developer'}
                          className="field-input"
                          value={company.status || 'ativa'}
                          onChange={e => setCompany({ ...company, status: e.target.value })}
                          style={{
                            height: '38px',
                            padding: '0 10px',
                            backgroundColor: (!isEditingCompany || user?.funcao !== 'developer') ? 'rgba(0, 0, 0, 0.08)' : t.bgSecondary || 'transparent',
                            color: t.textMain,
                            border: t.borderBold || '1px solid rgba(255,255,255,0.1)',
                            cursor: (!isEditingCompany || user?.funcao !== 'developer') ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="ativa">Ativa</option>
                          <option value="inativa">Inativa</option>
                          <option value="bloqueada">Bloqueada</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="field-label">Razão Social</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.nome || ''}
                        onChange={e => setCompany({ ...company, nome: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Nome Fantasia</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.nomeFantasia || ''}
                        onChange={e => setCompany({ ...company, nomeFantasia: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        CNPJ {(company.cnpj || '').length >= 14 && (validateCNPJ(company.cnpj || '') ? <Check size={14} color={t.success || "#10b981"} /> : <X size={14} color={t.danger || "#ef4444"} />)}
                      </label>
                      <input
                        disabled={true}
                        className="field-input"
                        style={isEditingCompany && (company.cnpj || '').length === 18 && !validateCNPJ(company.cnpj || '') ? { borderColor: t.danger || '#ef4444' } : {}}
                        value={company.cnpj || ''}
                        placeholder="00.000.000/0000-00"
                        onChange={e => setCompany({ ...company, cnpj: maskCNPJ(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Inscrição Estadual</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.ie || ''}
                        onChange={e => setCompany({ ...company, ie: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Telefone</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.telefone || ''}
                        placeholder="(00) 00000-0000"
                        onChange={e => setCompany({ ...company, telefone: maskPhone(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">CEP</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          disabled={!isEditingCompany}
                          className="field-input"
                          value={company.cep}
                          placeholder="00000-000"
                          onChange={e => setCompany({ ...company, cep: maskCEP(e.target.value) })}
                          onBlur={handleCepBlur}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="field-label">Logradouro</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.logradouro || ''}
                        onChange={e => setCompany({ ...company, logradouro: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Número</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.numero || ''}
                        onChange={e => setCompany({ ...company, numero: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Bairro</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.bairro || ''}
                        onChange={e => setCompany({ ...company, bairro: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Cidade - UF</label>
                      <input
                        disabled={!isEditingCompany}
                        className="field-input"
                        value={company.cidade || ''}
                        placeholder="Cidade - UF"
                        onChange={e => setCompany({ ...company, cidade: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="field-label">Responsável</label>
                      {responsaveis.length > 1 ? (
                        <select
                          disabled={!isEditingCompany || user?.funcao !== 'developer'}
                          className="field-input"
                          value={company.responsavel || ''}
                          onChange={e => setCompany({ ...company, responsavel: e.target.value })}
                          style={{
                            height: '42px',
                            backgroundColor: (!isEditingCompany || user?.funcao !== 'developer') ? 'rgba(0, 0, 0, 0.08)' : t.bgSecondary || 'transparent',
                            color: t.textMain,
                            border: t.borderBold || '1px solid rgba(255,255,255,0.1)',
                            cursor: (!isEditingCompany || user?.funcao !== 'developer') ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="">Selecione o Responsável...</option>
                          {responsaveis.map(r => (
                            <option key={r.id} value={r.nome}>{r.nome}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          disabled={!isEditingCompany || user?.funcao !== 'developer'}
                          className="field-input"
                          value={company.responsavel || (responsaveis[0]?.nome || '')}
                          onChange={e => setCompany({ ...company, responsavel: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── GESTÃO DE EQUIPE ─── */}
                <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '10px', display: 'flex' }}>
                        <Users size={18} />
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Gestão de Equipe</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenUserModal}
                      style={{
                        backgroundColor: t.accent, color: t.accentContrast,
                        padding: '0 1.25rem', height: '38px', fontWeight: 600,
                        border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        fontSize: '0.875rem', transition: 'all 0.2s',
                        boxShadow: `0 4px 12px ${t.accent}25`
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <UserPlus size={16} /> Novo Usuário
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'left' }}>
                          <th style={{ padding: '1rem', color: t.textSecondary }}>Usuário</th>
                          <th style={{ padding: '1rem', color: t.textSecondary }}>Função</th>
                          <th style={{ padding: '1rem', color: t.textSecondary }}>Acessos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const decryptedEmail = decryptData(u.email);
                          const decryptedFuncao = decryptData(u.funcao);
                          const decryptedAllAccess = decryptData(u.allAccess) === 'true' || u.allAccess === true;

                          const getRoleLabel = (role) => {
                            const roles = {
                              gerente: 'Gerente',
                              supervisor: 'Supervisor',
                              estagiario: 'Estagiário',
                              vendedor: 'Vendedor',
                              colaborador: 'Colaborador',
                              parceiro: 'Parceiro',
                              admin: 'Administrador',
                              developer: 'Developer',
                              funcionario: 'Funcionário',
                              responsavel: 'Responsável'
                            };
                            return roles[role] || role;
                          };

                          const getRoleBadgeClass = (role) => {
                            switch (role) {
                              case 'admin':
                              case 'gerente':
                              case 'developer':
                              case 'responsavel':
                                return 'success';
                              case 'supervisor':
                                return 'info';
                              case 'estagiario':
                                return 'neutral';
                              case 'vendedor':
                                return 'warning';
                              case 'colaborador':
                              case 'funcionario':
                                return 'info';
                              case 'parceiro':
                                return 'neutral';
                              default:
                                return 'info';
                            }
                          };

                          return (
                            <tr
                              key={u.id}
                              onClick={() => handleOpenUserDetails(u)}
                              style={{
                                borderBottom: t.border || '1px solid #f1f5f9',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.bgSecondary}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td style={{ padding: '1.25rem 1rem' }}>
                                <div style={{ fontWeight: 700, color: t.textMain }}>{u.nome}</div>
                                <div style={{ fontSize: '0.85rem', color: t.textSecondary }}>{decryptedEmail}</div>
                              </td>
                              <td style={{ padding: '1.25rem 1rem' }}>
                                <span className={`status-badge ${getRoleBadgeClass(decryptedFuncao)}`}>
                                  {getRoleLabel(decryptedFuncao)}
                                </span>
                              </td>
                              <td style={{ padding: '1.25rem 1rem' }}>
                                <span style={{ fontSize: '0.85rem', color: t.textSecondary }}>
                                  {decryptedAllAccess ? 'Acesso Total' : `${u.telas?.length || 0} Telas`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'integracoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                {/* == SEÇÃO 1: SISTEMA == */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={18} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Recursos do Sistema</h2>
                      <p style={{ color: t.textSecondary, fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>Gestão de recursos internos e utilitários de dados</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
                    {/* Gestão de Recursos Card */}
                    <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LayoutGrid size={20} color="#fff" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Gestão de Recursos</h3>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {user?.funcao === 'developer' && (
                            !isEditingRecursos ? (
                              <button
                                type="button"
                                onClick={handleStartEditRecursos}
                                style={{
                                  backgroundColor: t.accent, color: t.accentContrast,
                                  padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                  border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                  fontSize: '0.875rem', transition: 'all 0.2s',
                                  boxShadow: `0 4px 12px ${t.accent}25`
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                              >
                                <Edit3 size={16} /> Editar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleCancelEditRecursos}
                                  style={{
                                    backgroundColor: '#ef4444', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <X size={16} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setLoading(true);
                                    try {
                                      await handleSave('integrations');
                                    } catch (e) { console.error(e); }
                                    setLoading(false);
                                  }}
                                  style={{
                                    backgroundColor: '#10b981', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                          <label className="field-label">Tipo de PIX</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.tipoPix || '20'}
                            onChange={e => setIntegrations({ ...integrations, tipoPix: e.target.value })}
                          >
                            <option value="20">20: PIX Estático (impresso/chave)</option>
                            <option value="17">17: PIX Dinâmico (TEF/gerado na hora)</option>
                            <option value="23">23: PIX Automático (recorrências)</option>
                          </select>
                        </div>

                        {integrations.tipoPix === '17' && (
                          <>
                            <div className="form-group">
                              <label className="field-label">Pix na Tela</label>
                              <select
                                disabled={!isEditingRecursos}
                                className="field-select"
                                value={integrations.pixNaTela || 'inativo'}
                                onChange={e => setIntegrations({ ...integrations, pixNaTela: e.target.value })}
                              >
                                <option value="inativo">Inativo</option>
                                <option value="pagbank">PagBank</option>
                                <option value="infinitypay">InfinityPay</option>
                                <option value="mercadopago">Mercado Pago</option>
                                <option value="asaas">Asaas</option>
                                <option value="bancodobrasil">Banco do Brasil</option>
                                <option value="itau">Itaú</option>
                                <option value="bancointer">Banco Inter</option>
                                <option value="nubank">Nubank</option>
                                <option value="caixa">Caixa</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="field-label">Pix na Maquininha</label>
                              <select
                                disabled={!isEditingRecursos}
                                className="field-select"
                                value={integrations.pixNaMaquininha || 'inativo'}
                                onChange={e => setIntegrations({ ...integrations, pixNaMaquininha: e.target.value })}
                              >
                                <option value="inativo">Inativo</option>
                                <option value="pagbank">PagBank (PlugPag)</option>
                                <option value="infinitypay">InfinityPay</option>
                                <option value="stone">Stone / Ton</option>
                              </select>
                            </div>
                          </>
                        )}

                        <div className="form-group">
                          <label className="field-label">Cartão</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.cartao || 'inativo'}
                            onChange={e => setIntegrations({ ...integrations, cartao: e.target.value })}
                          >
                            <option value="inativo">Inativo</option>
                            <option value="pagbank">PagBank (PlugPag)</option>
                            <option value="infinitypay">InfinityPay</option>
                            <option value="mercadopago">Mercado Pago</option>
                            <option value="stone">Stone / Ton</option>
                            <option value="asaas">Asaas</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="field-label">Link de Pagamento</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.linkDePagamento || 'inativo'}
                            onChange={e => setIntegrations({ ...integrations, linkDePagamento: e.target.value })}
                          >
                            <option value="inativo">Inativo</option>
                            <option value="pagbank">PagBank</option>
                            <option value="infinitypay">InfinityPay</option>
                            <option value="mercadopago">Mercado Pago</option>
                            <option value="stone">Stone / Ton</option>
                            <option value="asaas">Asaas</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="field-label">Boleto</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.boleto || 'inativo'}
                            onChange={e => setIntegrations({ ...integrations, boleto: e.target.value })}
                          >
                            <option value="inativo">Inativo</option>
                            <option value="asaas">Asaas</option>
                            <option value="bancodobrasil">Banco do Brasil</option>
                            <option value="itau">Itaú</option>
                            <option value="bancointer">Banco Inter</option>
                            <option value="nubank">Nubank</option>
                            <option value="caixa">Caixa</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="field-label">Emissão Nota Fiscal</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.emissaoNotaFiscal || 'inativo'}
                            onChange={e => setIntegrations({ ...integrations, emissaoNotaFiscal: e.target.value })}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                          </select>
                        </div>


                        <div className="form-group">
                          <label className="field-label">n8n Atendimentos</label>
                          <select
                            disabled={!isEditingRecursos}
                            className="field-select"
                            value={integrations.n8nAtendimentoAtivo ? 'ativo' : 'inativo'}
                            onChange={e => setIntegrations({ ...integrations, n8nAtendimentoAtivo: e.target.value === 'ativo' })}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto', padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>Habilite gateways de pagamento, emissão fiscal ou automações do n8n para uso imediato no sistema.</span>
                      </div>
                    </div>
                    {/* Export Card */}
                    <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Download size={20} color="#fff" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Exportador de Dados</h3>
                          <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Backup e relatórios estruturados</span>
                        </div>
                      </div>

                      <p style={{ color: t.textSecondary, fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                        Selecione uma das coleções principais abaixo para gerar e baixar instantaneamente uma planilha compacta no formato <strong>Excel (.xlsx)</strong> com todos os registros cadastrados.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {DATA_SOURCES.map(source => {
                          const isSelected = selectedExportSource === source.id;
                          return (
                            <motion.div
                              key={source.id}
                              onClick={() => setSelectedExportSource(source.id)}
                              whileHover={{ scale: 1.015 }}
                              whileTap={{ scale: 0.99 }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem',
                                borderRadius: t.radiusInner,
                                border: `1px solid ${isSelected ? source.color : t.border || '#cbd5e1'}`,
                                backgroundColor: isSelected ? `${source.color}08` : (t.bgSecondary || '#f8fafc'),
                                transition: 'all 0.2s', cursor: 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '10px',
                                  backgroundColor: `${source.color}15`, color: source.color,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {source.icon}
                                </div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain }}>{source.label}</span>
                              </div>
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                border: `2px solid ${isSelected ? source.color : '#cbd5e1'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: isSelected ? source.color : 'transparent',
                                transition: 'all 0.15s'
                              }}>
                                {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 'auto' }}>
                        <button
                          type="button"
                          disabled={migrationLoading}
                          onClick={handleExport}
                          style={{
                            width: '100%',
                            backgroundColor: t.accent, color: t.accentContrast,
                            padding: '0.875rem', fontWeight: 600,
                            border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            fontSize: '0.875rem', transition: 'all 0.2s',
                            boxShadow: `0 4px 12px ${t.accent}25`,
                            opacity: migrationLoading ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => { if (!migrationLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                          onMouseLeave={(e) => { if (!migrationLoading) { e.currentTarget.style.transform = 'translateY(0)'; } }}
                        >
                          {migrationLoading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
                          {migrationLoading ? 'Preparando arquivo...' : 'Exportar Planilha Excel'}
                        </button>
                      </div>
                    </div>
                    {/* Import Card */}
                    <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Upload size={20} color="#fff" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Importador Inteligente</h3>
                          <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Migração de planilhas facilitada</span>
                        </div>
                      </div>

                      <p style={{ color: t.textSecondary, fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                        Selecione a tabela de destino no CRM e carregue um arquivo correspondente. Nosso sistema guiará você no mapeamento das colunas.
                      </p>

                      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="field-label" style={{ fontWeight: 600, fontSize: '0.75rem', color: t.textSecondary }}>Tabela Destino</label>
                        <select
                          className="field-select"
                          value={selectedImportSource}
                          onChange={e => setSelectedImportSource(e.target.value)}
                          style={{ height: '38px', fontSize: '0.85rem' }}
                        >
                          {DATA_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>

                      <div
                        style={{
                          border: `2px dashed ${isImportHovered ? t.accent : t.border || '#cbd5e1'}`,
                          borderRadius: t.radiusInner,
                          padding: '2rem 1rem',
                          textAlign: 'center',
                          position: 'relative',
                          transition: 'all 0.2s',
                          backgroundColor: isImportHovered ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                          cursor: 'pointer',
                          marginBottom: '1.25rem'
                        }}
                        onMouseEnter={() => setIsImportHovered(true)}
                        onMouseLeave={() => setIsImportHovered(false)}
                      >
                        {migrationLoading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <Loader2 className="animate-spin" size={32} style={{ color: t.accent }} />
                            <div style={{ width: '100%', backgroundColor: t.bgSecondary, height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${migrationProgress}%` }}
                                style={{ height: '100%', backgroundColor: t.success || '#10b981' }}
                              />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.textMain }}>{migrationProgress}% Concluído</span>
                          </div>
                        ) : (
                          <>
                            <Upload size={32} style={{ margin: '0 auto 0.75rem', color: isImportHovered ? t.accent : (t.textSecondary || '#cbd5e1'), transition: 'color 0.2s' }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textMain, margin: '0 0 0.25rem' }}>Arraste seu arquivo Excel / CSV</p>
                            <p style={{ color: t.textSecondary, fontSize: '0.75rem', margin: 0 }}>ou clique para selecionar do computador</p>
                            <input
                              type="file"
                              accept=".xlsx, .csv"
                              onChange={handleImport}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                            />
                          </>
                        )}
                      </div>

                      <div style={{
                        marginTop: 'auto',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(37, 99, 235, 0.04)',
                        border: `1px solid rgba(37, 99, 235, 0.15)`,
                        borderRadius: t.radiusInner,
                        display: 'flex',
                        gap: '0.625rem',
                        alignItems: 'flex-start'
                      }}>
                        <Info style={{ color: t.accent, flexShrink: 0, marginTop: 1 }} size={16} />
                        <p style={{ fontSize: '0.775rem', color: t.textMain, lineHeight: 1.45, margin: 0 }}>
                          <strong>Dica:</strong> Para evitar erros, faça o download de um modelo na coluna ao lado e utilize-o como base para preencher os dados.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* == SEÇÃO 2: INTEGRAÇÕES == */}
                <div style={{ borderTop: t.border || '1px solid #e2e8f0', paddingTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={18} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Integrações de Serviços</h2>
                      <p style={{ color: t.textSecondary, fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>Conexões externas com APIs de Notas Fiscais e Atendimento</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    {/* ── Focus NFE Card ── */}
                    <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={20} color="#fff" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Emissão Focus NFE</h3>
                            <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Emissão de Notas Fiscais</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {user?.funcao === 'developer' && (
                            !isEditingFocusNfe ? (
                              <button
                                type="button"
                                onClick={handleStartEditFocusNfe}
                                style={{
                                  backgroundColor: t.accent, color: t.accentContrast,
                                  padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                  border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                  fontSize: '0.875rem', transition: 'all 0.2s',
                                  boxShadow: `0 4px 12px ${t.accent}25`
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                              >
                                <Edit3 size={16} /> Editar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleCancelEditFocusNfe}
                                  style={{
                                    backgroundColor: '#ef4444', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <X size={16} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSave('integrations')}
                                  style={{
                                    backgroundColor: '#10b981', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: Token Produção + Ambiente */}
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }}>
                          <div className="form-group">
                            <label className="field-label">Token Produção</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showTokenProducao ? "text" : "password"}
                                disabled={!isEditingFocusNfe}
                                className="field-input"
                                style={{ paddingRight: '3rem', pointerEvents: !isEditingFocusNfe ? 'none' : 'auto' }}
                                value={integrations.tokenProducao || ''}
                                onChange={e => setIntegrations({ ...integrations, tokenProducao: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => setShowTokenProducao(!showTokenProducao)}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: t.textSecondary,
                                  zIndex: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  transition: 'color 0.2s, transform 0.2s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = t.accent; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
                              >
                                {showTokenProducao ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select
                              disabled={!isEditingFocusNfe}
                              className="field-select"
                              value={integrations.ambiente}
                              onChange={e => setIntegrations({ ...integrations, ambiente: e.target.value })}
                            >
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Token Homologação + Regime Tributário */}
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }}>
                          <div className="form-group">
                            <label className="field-label">Token Homologação</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showTokenHomologacao ? "text" : "password"}
                                disabled={!isEditingFocusNfe}
                                className="field-input"
                                style={{ paddingRight: '3rem', pointerEvents: !isEditingFocusNfe ? 'none' : 'auto' }}
                                value={integrations.tokenHomologacao || ''}
                                onChange={e => setIntegrations({ ...integrations, tokenHomologacao: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => setShowTokenHomologacao(!showTokenHomologacao)}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: t.textSecondary,
                                  zIndex: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  transition: 'color 0.2s, transform 0.2s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = t.accent; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
                              >
                                {showTokenHomologacao ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Regime Tributário</label>
                            <select
                              disabled={!isEditingFocusNfe}
                              className="field-select"
                              value={integrations.regimeTributario}
                              onChange={e => setIntegrations({ ...integrations, regimeTributario: e.target.value })}
                            >
                              <option value="simples">Simples Nacional</option>
                              <option value="normal">Regime Normal</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* ── N8N Integration Card ── */}
                    <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                            background: 'linear-gradient(135deg, #FF6C37 0%, #E65A28 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Cpu size={20} color="#fff" />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>n8n Atendimentos</h3>
                            </div>
                            <p style={{ fontSize: '0.775rem', color: t.textSecondary, margin: 0, fontWeight: 500 }}>Integração via Webhooks In/Out</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>

                          {user?.funcao === 'developer' && (
                            !isEditingN8n ? (
                              <button
                                type="button"
                                onClick={handleStartEditN8n}
                                style={{
                                  backgroundColor: t.accent, color: t.accentContrast,
                                  padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                  border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                  fontSize: '0.875rem', transition: 'all 0.2s',
                                  boxShadow: `0 4px 12px ${t.accent}25`
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                              >
                                <Edit3 size={16} /> Editar
                              </button>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  type="button"
                                  onClick={handleCancelEditN8n}
                                  style={{
                                    backgroundColor: '#ef4444', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <X size={16} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSave('integrations')}
                                  style={{
                                    backgroundColor: '#10b981', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group">
                          <label className="field-label">URL do Webhook de Envio (Outbound - n8n)</label>
                          <input
                            type="text"
                            disabled={!isEditingN8n}
                            className="field-input"
                            placeholder="Cole a URL do webhook do seu fluxo do n8n"
                            value={integrations.n8nWebhookUrl || ''}
                            onChange={e => setIntegrations({ ...integrations, n8nWebhookUrl: e.target.value })}
                          />
                          <span style={{ fontSize: '0.75rem', color: t.textSecondary, display: 'block', marginTop: 4 }}>
                            O CRM fará um POST com a mensagem digitada pelo atendente para esta URL.
                          </span>
                        </div>

                        <div className="form-group">
                          <label className="field-label">URL do Webhook de Recebimento (Inbound - Configurar no n8n)</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              readOnly
                              className="field-input"
                              style={{ backgroundColor: t.bgSecondary, cursor: 'text' }}
                              value={`https://us-east4-crm-master-demo.cloudfunctions.net/n8nWebhook`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`https://us-east4-crm-master-demo.cloudfunctions.net/n8nWebhook`);
                                alert('Copiado!');
                              }}
                              style={{
                                padding: '0 1rem', height: '38px', backgroundColor: t.accent, color: t.accentContrast,
                                border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', fontSize: '0.8rem',
                                fontWeight: 600, flexShrink: 0
                              }}
                            >
                              Copiar
                            </button>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: t.textSecondary, display: 'block', marginTop: 4 }}>
                            Configure esta URL no n8n para enviar novas mensagens recebidas dos seus clientes para o CRM.
                          </span>
                        </div>
                      </div>

                      <div style={{
                        marginTop: '1.25rem', padding: '0.875rem 1rem', borderRadius: t.radiusInner,
                        backgroundColor: 'rgba(255, 108, 55, 0.05)', border: '1px solid rgba(255, 108, 55, 0.2)',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                      }}>
                        <Info size={18} color="#FF6C37" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                          <strong>Integração com n8n:</strong> Envie e receba mensagens sob demanda. Ao ativar, o sistema passa a utilizar os Webhooks configurados para o fluxo de atendimento em tempo real.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* == SEÇÃO 3: PAGAMENTOS == */}
                <div style={{ borderTop: t.border || '1px solid #e2e8f0', paddingTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={18} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Pagamentos e Gateways</h2>
                      <p style={{ color: t.textSecondary, fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>Configuração de meios de pagamento, Pix na tela e maquininhas</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    {/* ── PagBank PlugPag Card ── */}
                    <div style={{ gridColumn: 'span 2', padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 11,
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Smartphone size={20} color="#fff" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>PagBank (PlugPag)</h3>
                            <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Integração com Maquininha física</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {user?.funcao === 'developer' && (
                            !isEditingPagbank ? (
                              <button
                                type="button"
                                onClick={handleStartEditPagbank}
                                style={{
                                  backgroundColor: t.accent, color: t.accentContrast,
                                  padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                  border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                  fontSize: '0.875rem', transition: 'all 0.2s',
                                  boxShadow: `0 4px 12px ${t.accent}25`
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                              >
                                <Edit3 size={16} /> Editar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleCancelEditPagbank}
                                  style={{
                                    backgroundColor: '#ef4444', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <X size={16} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSave('integrations')}
                                  style={{
                                    backgroundColor: '#10b981', color: '#fff',
                                    padding: '0 1.25rem', height: '38px', fontWeight: 600,
                                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.875rem', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: '1.5rem' }}>
                        {/* Ativo / Inativo */}
                        <div className="form-group" style={{ gridColumn: 'span 1' }}>
                          <label className="field-label">Status da Integração</label>
                          <select
                            disabled={!isEditingPagbank}
                            className="field-select"
                            value={integrations.plugpagAtivo ? "ativo" : "inativo"}
                            onChange={e => setIntegrations({ ...integrations, plugpagAtivo: e.target.value === "ativo" })}
                          >
                            <option value="inativo">Inativo</option>
                            <option value="ativo">Ativo</option>
                          </select>
                        </div>

                        {/* Tipo de Conexão */}
                        <div className="form-group" style={{ gridColumn: 'span 1' }}>
                          <label className="field-label">Tipo de Conexão</label>
                          <select
                            disabled={!isEditingPagbank}
                            className="field-select"
                            value={integrations.plugpagTipo || 'wifi'}
                            onChange={e => {
                              const newType = e.target.value;
                              setIntegrations({ ...integrations, plugpagTipo: newType });
                              fetchPlugpagDevices(newType);
                            }}
                          >
                            <option value="wifi">WiFi / SmartPOS</option>
                            <option value="bluetooth">Bluetooth (Minizinha/Moderninha)</option>
                          </select>
                        </div>

                        {/* Ambiente de Transação */}
                        <div className="form-group" style={{ gridColumn: 'span 1' }}>
                          <label className="field-label">Ambiente do PlugPag</label>
                          <select
                            disabled={!isEditingPagbank}
                            className="field-select"
                            value={integrations.plugpagAmbiente || 'homologacao'}
                            onChange={e => setIntegrations({ ...integrations, plugpagAmbiente: e.target.value })}
                          >
                            <option value="homologacao">Homologação (Simulador)</option>
                            <option value="producao">Produção (Real)</option>
                          </select>
                        </div>

                        {/* Token de Integração */}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="field-label">Token de Integração (PagBank)</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPlugpagToken ? "text" : "password"}
                              disabled={!isEditingPagbank}
                              className="field-input"
                              style={{ paddingRight: '3rem', pointerEvents: !isEditingPagbank ? 'none' : 'auto' }}
                              placeholder="Insira o Token de Integração ou 'mock' para testes"
                              value={integrations.plugpagToken || ''}
                              onChange={e => setIntegrations({ ...integrations, plugpagToken: e.target.value })}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPlugpagToken(!showPlugpagToken)}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: t.textSecondary,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'auto'
                              }}
                            >
                              {showPlugpagToken ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        {/* Porta de comunicação */}
                        <div className="form-group" style={{ gridColumn: 'span 1' }}>
                          <label className="field-label">Porta do Serviço (Bridge)</label>
                          <input
                            disabled={!isEditingPagbank}
                            className="field-input"
                            placeholder="42007"
                            value={integrations.plugpagPorta !== undefined ? integrations.plugpagPorta : ''}
                            onChange={e => setIntegrations({ ...integrations, plugpagPorta: e.target.value })}
                          />
                        </div>

                        {integrations.plugpagTipo === 'wifi' ? (
                          <>
                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">IP do Terminal WiFi</label>
                              <input
                                disabled={!isEditingPagbank}
                                className="field-input"
                                placeholder="ex: 192.168.1.150"
                                value={integrations.plugpagTerminalIp || ''}
                                onChange={e => setIntegrations({ ...integrations, plugpagTerminalIp: e.target.value })}
                              />
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">Selecionar WiFi Descoberto</label>
                              <select
                                disabled={!isEditingPagbank}
                                className="field-select"
                                value={integrations.plugpagTerminalIp || ''}
                                onChange={e => {
                                  const selectedIp = e.target.value;
                                  const device = plugpagDevices.find(d => d.ip === selectedIp);
                                  setIntegrations({
                                    ...integrations,
                                    plugpagTerminalIp: selectedIp,
                                    plugpagTerminalNome: device ? device.name : ''
                                  });
                                }}
                              >
                                <option value="">Escolha um terminal da busca...</option>
                                {plugpagDevices.map((d, index) => (
                                  <option key={index} value={d.ip}>{d.name} ({d.status || 'Online'})</option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">Exibição do PIX Padrão</label>
                              <select
                                disabled={!isEditingPagbank}
                                className="field-select"
                                value={integrations.plugpagPixExibicao || 'maquininha'}
                                onChange={e => setIntegrations({ ...integrations, plugpagPixExibicao: e.target.value })}
                              >
                                <option value="maquininha">Exibir na Maquininha</option>
                                <option value="tela">Exibir na Tela</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Porta COM (1 col) */}
                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">Porta COM (Bluetooth)</label>
                              {customComMode ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                                  <input
                                    type="text"
                                    disabled={!isEditingPagbank}
                                    className="field-input"
                                    placeholder="ex: COM3"
                                    value={integrations.plugpagTerminalIp || ''}
                                    onChange={e => setIntegrations({ ...integrations, plugpagTerminalIp: e.target.value })}
                                  />
                                  {isEditingPagbank && (
                                    <button
                                      type="button"
                                      onClick={() => { setCustomComMode(false); setIntegrations({ ...integrations, plugpagTerminalIp: comPorts[0] || 'COM3' }); }}
                                      style={{
                                        padding: '0 0.875rem', backgroundColor: t.bgSecondary, color: t.textSecondary,
                                        border: t.border || '1px solid #cbd5e1', borderRadius: t.radiusSmall, cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center',
                                        height: '40px'
                                      }}
                                    >
                                      Lista
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <select
                                  disabled={!isEditingPagbank}
                                  className="field-select"
                                  value={integrations.plugpagTerminalIp || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'custom') {
                                      setCustomComMode(true);
                                      setIntegrations({ ...integrations, plugpagTerminalIp: '' });
                                    } else {
                                      setIntegrations({ ...integrations, plugpagTerminalIp: val });
                                    }
                                  }}
                                >
                                  <option value="">Selecione a Porta COM...</option>
                                  {comPorts.map((port, idx) => (
                                    <option key={idx} value={port}>{port}</option>
                                  ))}
                                  {isEditingPagbank && <option value="custom">Outra (Digitar Manual)...</option>}
                                </select>
                              )}
                            </div>

                            {/* Dispositivo Bluetooth (1 col) */}
                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">Dispositivo Bluetooth</label>
                              {customDeviceMode ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                                  <input
                                    type="text"
                                    disabled={!isEditingPagbank}
                                    className="field-input"
                                    placeholder="ex: Moderninha Pro 2-7722"
                                    value={integrations.plugpagTerminalNome || ''}
                                    onChange={e => setIntegrations({ ...integrations, plugpagTerminalNome: e.target.value })}
                                  />
                                  {isEditingPagbank && (
                                    <button
                                      type="button"
                                      onClick={() => { setCustomDeviceMode(false); setIntegrations({ ...integrations, plugpagTerminalNome: pairedDevices[0] || '' }); }}
                                      style={{
                                        padding: '0 0.875rem', backgroundColor: t.bgSecondary, color: t.textSecondary,
                                        border: t.border || '1px solid #cbd5e1', borderRadius: t.radiusSmall, cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center',
                                        height: '40px'
                                      }}
                                    >
                                      Lista
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <select
                                  disabled={!isEditingPagbank}
                                  className="field-select"
                                  value={integrations.plugpagTerminalNome || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'custom') {
                                      setCustomDeviceMode(true);
                                      setIntegrations({ ...integrations, plugpagTerminalNome: '' });
                                    } else {
                                      setIntegrations({ ...integrations, plugpagTerminalNome: val });
                                    }
                                  }}
                                >
                                  <option value="">Selecione o Dispositivo...</option>
                                  {pairedDevices.length > 0 && (
                                    <optgroup label="Dispositivos Pareados (Windows)">
                                      {pairedDevices.map((d, idx) => (
                                        <option key={`real-${idx}`} value={d}>{d}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="Dispositivos Descobertos">
                                    {plugpagDevices.filter(d => !pairedDevices.includes(d.name)).map((d, idx) => (
                                      <option key={`sim-${idx}`} value={d.name}>{d.name} ({d.signal || 'Excelente'})</option>
                                    ))}
                                  </optgroup>
                                  {isEditingPagbank && <option value="custom">Outro (Digitar Manual)...</option>}
                                </select>
                              )}
                            </div>

                            {/* Exibição do PIX (1 col) */}
                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="field-label">Exibição do PIX Padrão</label>
                              <select
                                disabled={!isEditingPagbank}
                                className="field-select"
                                value={integrations.plugpagPixExibicao || 'maquininha'}
                                onChange={e => setIntegrations({ ...integrations, plugpagPixExibicao: e.target.value })}
                              >
                                <option value="maquininha">Exibir na Maquininha</option>
                                <option value="tela">Exibir na Tela</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Botões de Ação para Conexão */}
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button
                          type="button"
                          onClick={() => fetchPlugpagDevices(integrations.plugpagTipo)}
                          disabled={searchingPlugpag}
                          style={{
                            flex: 1,
                            backgroundColor: t.bgSecondary,
                            color: t.textMain,
                            border: t.border || '1px solid #cbd5e1',
                            borderRadius: t.radiusSmall,
                            padding: '0 1rem',
                            height: '38px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          {searchingPlugpag ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                          {searchingPlugpag ? 'Buscando...' : 'Buscar Maquininhas'}
                        </button>

                        <button
                          type="button"
                          onClick={testPlugpagConnection}
                          disabled={testingPlugpag}
                          style={{
                            flex: 1,
                            backgroundColor: t.accentSoft || 'rgba(37,99,235,0.05)',
                            color: t.accent,
                            border: `1px solid ${t.accent}33`,
                            borderRadius: t.radiusSmall,
                            padding: '0 1rem',
                            height: '38px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          {testingPlugpag ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                          {testingPlugpag ? 'Testando...' : 'Testar Conexão'}
                        </button>
                      </div>

                      {/* Info box */}
                      <div style={{
                        marginTop: '1.25rem', padding: '0.875rem 1rem', borderRadius: t.radiusInner,
                        backgroundColor: 'rgba(0, 181, 116, 0.05)', border: '1px solid rgba(0, 181, 116, 0.2)',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                      }}>
                        <Info size={18} color="#00B574" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                          <strong>Comunicação Local Segura:</strong> A comunicação é realizada por meio do nosso backend seguro local, protegendo suas credenciais e contornando restrições de CORS e Mixed Content HTTPS. Não é necessário instalar nenhuma extensão para navegador!
                        </p>
                      </div>
                    </div>
                    {/* Banco do Brasil Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #FDF000 0%, #004B8D 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Building2 size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Banco do Brasil</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Cobrança Direta API BB</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isBancoDoBrasilEditing ? (
                                <button type="button"
                                  onClick={() => { setTempBancoDoBrasil({ ...bancoDoBrasil }); setIsBancoDoBrasilEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempBancoDoBrasil) setBancoDoBrasil(tempBancoDoBrasil); setIsBancoDoBrasilEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingBancoDoBrasil}
                                    onClick={async () => {
                                      setSavingBancoDoBrasil(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'bancodobrasil'), bancoDoBrasil);
                                        setIsBancoDoBrasilEditing(false);
                                        alert('Banco do Brasil salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Banco do Brasil.'); }
                                      setSavingBancoDoBrasil(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; }}
                                  >{savingBancoDoBrasil ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isBancoDoBrasilEditing} className="field-select"
                              value={bancoDoBrasil.ativo ? "ativo" : "inativo"}
                              onChange={e => setBancoDoBrasil({ ...bancoDoBrasil, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isBancoDoBrasilEditing} className="field-select"
                              value={bancoDoBrasil.ambiente || 'homologacao'}
                              onChange={e => setBancoDoBrasil({ ...bancoDoBrasil, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Client ID</label>
                            <input type="text" disabled={!isBancoDoBrasilEditing}
                              className="field-input"
                              value={bancoDoBrasil.clientId || ''}
                              onChange={e => setBancoDoBrasil({ ...bancoDoBrasil, clientId: e.target.value })} />
                          </div>

                          <div className="form-group">
                            <label className="field-label">Client Secret</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showBancoDoBrasilSecrets ? "text" : "password"} disabled={!isBancoDoBrasilEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={bancoDoBrasil.clientSecret || ''}
                                onChange={e => setBancoDoBrasil({ ...bancoDoBrasil, clientSecret: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowBancoDoBrasilSecrets(!showBancoDoBrasilSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showBancoDoBrasilSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="field-label">Developer Application Key</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showBancoDoBrasilSecrets ? "text" : "password"} disabled={!isBancoDoBrasilEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={bancoDoBrasil.developerKey || ''}
                                onChange={e => setBancoDoBrasil({ ...bancoDoBrasil, developerKey: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowBancoDoBrasilSecrets(!showBancoDoBrasilSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showBancoDoBrasilSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'boletoAtivo', label: 'Boleto Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isBancoDoBrasilEditing}
                              onClick={() => setBancoDoBrasil({ ...bancoDoBrasil, [method.key]: !bancoDoBrasil[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${bancoDoBrasil[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: bancoDoBrasil[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: bancoDoBrasil[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isBancoDoBrasilEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {bancoDoBrasil[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 75, 141, 0.06)', border: '1px solid rgba(0, 75, 141, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#004B8D" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Banco do Brasil:</strong> Emissão de boletos registrados e QR Code PIX através do portal de APIs de Negócios (Developers BB).
                          </p>
                        </div>
                      </div>
                    )}
                    {/* InfinityPay Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #00C2A8 0%, #00876f 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <CreditCard size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>InfinityPay</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>API de Adquirente</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isInfinityPayEditing ? (
                                <button type="button"
                                  onClick={() => { setTempInfinityPay({ ...infinityPay }); setIsInfinityPayEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempInfinityPay) setInfinityPay(tempInfinityPay); setIsInfinityPayEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingInfinityPay}
                                    onClick={async () => {
                                      setSavingInfinityPay(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'infinitypay'), infinityPay);
                                        setIsInfinityPayEditing(false);
                                        alert('InfinityPay salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações InfinityPay.'); }
                                      setSavingInfinityPay(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; }}
                                  >{savingInfinityPay ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isInfinityPayEditing} className="field-select"
                              value={infinityPay.ativo ? "ativo" : "inativo"}
                              onChange={e => setInfinityPay({ ...infinityPay, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isInfinityPayEditing} className="field-select"
                              value={infinityPay.ambiente || 'sandbox'}
                              onChange={e => setInfinityPay({ ...infinityPay, ambiente: e.target.value })}>
                              <option value="sandbox">Sandbox (Testes)</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                          <label className="field-label">Infinity Tag</label>
                          <input
                            type="text"
                            disabled={!isInfinityPayEditing}
                            className="field-input"
                            placeholder="ex: @minhaloja"
                            value={infinityPay.handle || ''}
                            onChange={e => setInfinityPay({ ...infinityPay, handle: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'debitoAtivo', label: 'Débito Ativo' },
                            { key: 'creditoAtivo', label: 'Crédito Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isInfinityPayEditing}
                              onClick={() => setInfinityPay({ ...infinityPay, [method.key]: !infinityPay[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${infinityPay[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: infinityPay[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: infinityPay[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isInfinityPayEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {infinityPay[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 194, 168, 0.06)', border: '1px solid rgba(0, 194, 168, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#00C2A8" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>InfinityPay:</strong> Integração direta com a adquirente InfinityPay para processamento de transações de crédito, débito e PIX direto no PDV.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Stone Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #00A650 0%, #005020 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Smartphone size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Stone / Ton</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Integração com Adquirente</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isStoneEditing ? (
                                <button type="button"
                                  onClick={() => { setTempStone({ ...stone }); setIsStoneEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempStone) setStone(tempStone); setIsStoneEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingStone}
                                    onClick={async () => {
                                      setSavingStone(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'stone'), stone);
                                        setIsStoneEditing(false);
                                        alert('Stone / Ton salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Stone.'); }
                                      setSavingStone(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingStone ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isStoneEditing} className="field-select"
                              value={stone.ativo ? "ativo" : "inativo"}
                              onChange={e => setStone({ ...stone, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Stone Code</label>
                            <input type="text" disabled={!isStoneEditing}
                              className="field-input" placeholder="Código Stone"
                              value={stone.stoneCode || ''}
                              onChange={e => setStone({ ...stone, stoneCode: e.target.value })} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Partner API Key</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showStoneSecrets ? "text" : "password"} disabled={!isStoneEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={stone.partnerApiKey || ''}
                                onChange={e => setStone({ ...stone, partnerApiKey: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowStoneSecrets(!showStoneSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showStoneSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'cartaoAtivo', label: 'Cartão Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isStoneEditing}
                              onClick={() => setStone({ ...stone, [method.key]: !stone[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${stone[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: stone[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: stone[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isStoneEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {stone[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 166, 80, 0.06)', border: '1px solid rgba(0, 166, 80, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#00A650" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Stone / Ton:</strong> Habilita a conciliação de recebíveis e automação de pagamentos da maquininha da rede Stone e Ton no PDV.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Asaas Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #0066FF 0%, #0033AA 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <FileText size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Asaas</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Contas e Cobranças</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isAsaasEditing ? (
                                <button type="button"
                                  onClick={() => { setTempAsaas({ ...asaas }); setIsAsaasEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempAsaas) setAsaas(tempAsaas); setIsAsaasEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingAsaas}
                                    onClick={async () => {
                                      setSavingAsaas(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'asaas'), asaas);
                                        setIsAsaasEditing(false);
                                        alert('Asaas salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Asaas.'); }
                                      setSavingAsaas(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingAsaas ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isAsaasEditing} className="field-select"
                              value={asaas.ativo ? "ativo" : "inativo"}
                              onChange={e => setAsaas({ ...asaas, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isAsaasEditing} className="field-select"
                              value={asaas.ambiente || 'homologacao'}
                              onChange={e => setAsaas({ ...asaas, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">API Key</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showAsaasSecrets ? "text" : "password"} disabled={!isAsaasEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={asaas.apiKey || ''}
                                onChange={e => setAsaas({ ...asaas, apiKey: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowAsaasSecrets(!showAsaasSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showAsaasSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX' },
                            { key: 'boletoAtivo', label: 'Boleto' },
                            { key: 'cartaoAtivo', label: 'Cartão' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isAsaasEditing}
                              onClick={() => setAsaas({ ...asaas, [method.key]: !asaas[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${asaas[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: asaas[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: asaas[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isAsaasEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {asaas[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 102, 255, 0.06)', border: '1px solid rgba(0, 102, 255, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#0066FF" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Asaas:</strong> Automação completa para emissão de cobranças recorrentes por boleto, cartão de crédito e PIX com webhook de liquidação em tempo real.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Mercado Pago Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #00A6EA 0%, #0084C7 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <CreditCard size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Mercado Pago</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>API de Vendas e Checkout</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isMercadoPagoEditing ? (
                                <button type="button"
                                  onClick={() => { setTempMercadoPago({ ...mercadoPago }); setIsMercadoPagoEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempMercadoPago) setMercadoPago(tempMercadoPago); setIsMercadoPagoEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingMercadoPago}
                                    onClick={async () => {
                                      setSavingMercadoPago(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'mercadopago'), mercadoPago);
                                        setIsMercadoPagoEditing(false);
                                        alert('Mercado Pago salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações do Mercado Pago.'); }
                                      setSavingMercadoPago(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingMercadoPago ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isMercadoPagoEditing} className="field-select"
                              value={mercadoPago.ativo ? "ativo" : "inativo"}
                              onChange={e => setMercadoPago({ ...mercadoPago, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isMercadoPagoEditing} className="field-select"
                              value={mercadoPago.ambiente || 'homologacao'}
                              onChange={e => setMercadoPago({ ...mercadoPago, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Access Token</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showMercadoPagoSecrets ? "text" : "password"} disabled={!isMercadoPagoEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={mercadoPago.accessToken || ''}
                                onChange={e => setMercadoPago({ ...mercadoPago, accessToken: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowMercadoPagoSecrets(!showMercadoPagoSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showMercadoPagoSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="field-label">Public Key</label>
                            <input type="text" disabled={!isMercadoPagoEditing}
                              className="field-input"
                              value={mercadoPago.publicKey || ''}
                              onChange={e => setMercadoPago({ ...mercadoPago, publicKey: e.target.value })} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'cartaoAtivo', label: 'Cartão Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isMercadoPagoEditing}
                              onClick={() => setMercadoPago({ ...mercadoPago, [method.key]: !mercadoPago[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${mercadoPago[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: mercadoPago[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: mercadoPago[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isMercadoPagoEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {mercadoPago[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 166, 234, 0.06)', border: '1px solid rgba(0, 166, 234, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#00A6EA" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Mercado Pago:</strong> Gateway para recebimento via PIX instantâneo na tela e checkout transparente de cartões de débito/crédito.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Itaú Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #FF6900 0%, #002D62 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Building2 size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Itaú</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Integração API Itaú Rede</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isItauEditing ? (
                                <button type="button"
                                  onClick={() => { setTempItau({ ...itau }); setIsItauEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempItau) setItau(tempItau); setIsItauEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingItau}
                                    onClick={async () => {
                                      setSavingItau(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'itau'), itau);
                                        setIsItauEditing(false);
                                        alert('Itaú salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Itaú.'); }
                                      setSavingItau(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingItau ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isItauEditing} className="field-select"
                              value={itau.ativo ? "ativo" : "inativo"}
                              onChange={e => setItau({ ...itau, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isItauEditing} className="field-select"
                              value={itau.ambiente || 'homologacao'}
                              onChange={e => setItau({ ...itau, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Client ID</label>
                            <input type="text" disabled={!isItauEditing}
                              className="field-input"
                              value={itau.clientId || ''}
                              onChange={e => setItau({ ...itau, clientId: e.target.value })} />
                          </div>

                          <div className="form-group">
                            <label className="field-label">Client Secret</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showItauSecrets ? "text" : "password"} disabled={!isItauEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={itau.clientSecret || ''}
                                onChange={e => setItau({ ...itau, clientSecret: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowItauSecrets(!showItauSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showItauSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'boletoAtivo', label: 'Boleto Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isItauEditing}
                              onClick={() => setItau({ ...itau, [method.key]: !itau[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${itau[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: itau[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: itau[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isItauEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {itau[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(255, 105, 0, 0.06)', border: '1px solid rgba(255, 105, 0, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#FF6900" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Itaú:</strong> Habilita a emissão direta de boletos Itaú de carteira rápida e geração de chaves PIX comerciais direto no PDV com liquidação.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Banco Inter Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #FF7A00 0%, #D45B00 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Building2 size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Banco Inter</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Cobrança API Banco Inter</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isBancoInterEditing ? (
                                <button type="button"
                                  onClick={() => { setTempBancoInter({ ...bancoInter }); setIsBancoInterEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempBancoInter) setBancoInter(tempBancoInter); setIsBancoInterEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingBancoInter}
                                    onClick={async () => {
                                      setSavingBancoInter(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'bancointer'), bancoInter);
                                        setIsBancoInterEditing(false);
                                        alert('Banco Inter salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Banco Inter.'); }
                                      setSavingBancoInter(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingBancoInter ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isBancoInterEditing} className="field-select"
                              value={bancoInter.ativo ? "ativo" : "inativo"}
                              onChange={e => setBancoInter({ ...bancoInter, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isBancoInterEditing} className="field-select"
                              value={bancoInter.ambiente || 'homologacao'}
                              onChange={e => setBancoInter({ ...bancoInter, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Client ID</label>
                            <input type="text" disabled={!isBancoInterEditing}
                              className="field-input"
                              value={bancoInter.clientId || ''}
                              onChange={e => setBancoInter({ ...bancoInter, clientId: e.target.value })} />
                          </div>

                          <div className="form-group">
                            <label className="field-label">Client Secret</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showBancoInterSecrets ? "text" : "password"} disabled={!isBancoInterEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={bancoInter.clientSecret || ''}
                                onChange={e => setBancoInter({ ...bancoInter, clientSecret: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowBancoInterSecrets(!showBancoInterSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showBancoInterSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'boletoAtivo', label: 'Boleto Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isBancoInterEditing}
                              onClick={() => setBancoInter({ ...bancoInter, [method.key]: !bancoInter[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${bancoInter[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: bancoInter[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: bancoInter[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isBancoInterEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {bancoInter[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(255, 122, 0, 0.06)', border: '1px solid rgba(255, 122, 0, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#FF7A00" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Banco Inter:</strong> Integração sem tarifas de boleto via API Pix e Conta PJ Digital corporativa homologada da Inter.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Nubank Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #820AD1 0%, #4C0677 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <CreditCard size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Nubank</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>Integração API Nu PJ</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isNubankEditing ? (
                                <button type="button"
                                  onClick={() => { setTempNubank({ ...nubank }); setIsNubankEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempNubank) setNubank(tempNubank); setIsNubankEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingNubank}
                                    onClick={async () => {
                                      setSavingNubank(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'nubank'), nubank);
                                        setIsNubankEditing(false);
                                        alert('Nubank salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Nubank.'); }
                                      setSavingNubank(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingNubank ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isNubankEditing} className="field-select"
                              value={nubank.ativo ? "ativo" : "inativo"}
                              onChange={e => setNubank({ ...nubank, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isNubankEditing} className="field-select"
                              value={nubank.ambiente || 'homologacao'}
                              onChange={e => setNubank({ ...nubank, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Client ID</label>
                            <input type="text" disabled={!isNubankEditing}
                              className="field-input"
                              value={nubank.clientId || ''}
                              onChange={e => setNubank({ ...nubank, clientId: e.target.value })} />
                          </div>

                          <div className="form-group">
                            <label className="field-label">Client Secret</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showNubankSecrets ? "text" : "password"} disabled={!isNubankEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={nubank.clientSecret || ''}
                                onChange={e => setNubank({ ...nubank, clientSecret: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowNubankSecrets(!showNubankSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showNubankSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX PJ' },
                            { key: 'nupayAtivo', label: 'NuPay Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isNubankEditing}
                              onClick={() => setNubank({ ...nubank, [method.key]: !nubank[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${nubank[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: nubank[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: nubank[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isNubankEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {nubank[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(130, 10, 209, 0.06)', border: '1px solid rgba(130, 10, 209, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#820AD1" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Nubank:</strong> Recebimento direto em conta jurídica Nu PJ com suporte a PIX corporativo e pagamentos por NuPay sem cartão.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Caixa Card */}
                    {(user?.funcao === 'developer' || user?.funcao === 'responsavel') && (
                      <div style={{ padding: '1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner, boxShadow: t.shadow, margin: 0, transition: 'box-shadow 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                              background: 'linear-gradient(135deg, #005CA9 0%, #F47A20 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Building2 size={20} color="#fff" />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Caixa</h3>
                              <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>API de Negócios CEF</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {user?.funcao === 'developer' && (
                              !isCaixaEditing ? (
                                <button type="button"
                                  onClick={() => { setTempCaixa({ ...caixa }); setIsCaixaEditing(true); }}
                                  style={{ backgroundColor: t.accent, color: t.accentContrast, padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                ><Edit3 size={16} /> Editar</button>
                              ) : (
                                <>
                                  <button type="button"
                                    onClick={() => { if (tempCaixa) setCaixa(tempCaixa); setIsCaixaEditing(false); }}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  ><X size={16} /> Cancelar</button>
                                  <button type="button" disabled={savingCaixa}
                                    onClick={async () => {
                                      setSavingCaixa(true);
                                      try {
                                        await setDoc(getTenantDoc('settings', 'caixa'), caixa);
                                        setIsCaixaEditing(false);
                                        alert('Caixa Econômica Federal salvo com sucesso!');
                                      } catch (e) { alert('Erro ao salvar configurações Caixa.'); }
                                      setSavingCaixa(false);
                                    }}
                                    style={{ backgroundColor: '#10b981', color: '#fff', padding: '0 1.25rem', height: '38px', fontWeight: 600, border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                  >{savingCaixa ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Integração</label>
                            <select disabled={!isCaixaEditing} className="field-select"
                              value={caixa.ativo ? "ativo" : "inativo"}
                              onChange={e => setCaixa({ ...caixa, ativo: e.target.value === "ativo" })}>
                              <option value="inativo">Inativo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="field-label">Ambiente</label>
                            <select disabled={!isCaixaEditing} className="field-select"
                              value={caixa.ambiente || 'homologacao'}
                              onChange={e => setCaixa({ ...caixa, ambiente: e.target.value })}>
                              <option value="homologacao">Homologação</option>
                              <option value="producao">Produção</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Client ID</label>
                            <input type="text" disabled={!isCaixaEditing}
                              className="field-input"
                              value={caixa.clientId || ''}
                              onChange={e => setCaixa({ ...caixa, clientId: e.target.value })} />
                          </div>

                          <div className="form-group">
                            <label className="field-label">Client Secret</label>
                            <div style={{ position: 'relative' }}>
                              <input type={showCaixaSecrets ? "text" : "password"} disabled={!isCaixaEditing}
                                className="field-input" style={{ paddingRight: '3rem' }}
                                value={caixa.clientSecret || ''}
                                onChange={e => setCaixa({ ...caixa, clientSecret: e.target.value })} />
                              <motion.button type="button" onClick={() => setShowCaixaSecrets(!showCaixaSecrets)}
                                whileHover={{ scale: 1.1, color: t.accent }}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: t.textSecondary, zIndex: 10 }}
                              >
                                {showCaixaSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          {[
                            { key: 'pixAtivo', label: 'PIX Ativo' },
                            { key: 'boletoAtivo', label: 'Boleto Ativo' }
                          ].map(method => (
                            <button key={method.key} type="button"
                              disabled={!isCaixaEditing}
                              onClick={() => setCaixa({ ...caixa, [method.key]: !caixa[method.key] })}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: t.radiusSmall,
                                border: `1px solid ${caixa[method.key] ? t.accent : t.border || '#cbd5e1'}`,
                                backgroundColor: caixa[method.key] ? (t.accentSoft || 'rgba(37,99,235,0.05)') : 'transparent',
                                color: caixa[method.key] ? t.accent : (t.textSecondary || '#64748b'),
                                cursor: isCaixaEditing ? 'pointer' : 'default',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              {caixa[method.key] ? <Check size={14} /> : <X size={14} />} {method.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '0.875rem 1rem', borderRadius: t.radiusInner, backgroundColor: 'rgba(0, 92, 169, 0.06)', border: '1px solid rgba(0, 92, 169, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <Info size={18} color="#005CA9" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: '0.8rem', color: t.textMain, lineHeight: 1.55, margin: 0 }}>
                            <strong>Caixa:</strong> Conecte-se de forma homologada às APIs de Negócios da Caixa Econômica Federal para registrar boletos bancários da rede CEF e PIX comercial.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'sistema' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                {/* Informações do Sistema */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={18} color={t.accent} /> Informações do Sistema
                  </h3>
                  <p style={{ color: t.textSecondary, fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                    Detalhes técnicos sobre sua infraestrutura e plano ativo.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    {/* Status do Sistema */}
                    <motion.div
                      whileHover={{ y: -5, scale: 1.01, boxShadow: t.shadowMedium || '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: t.radiusInner || '12px',
                        backgroundColor: t.bg,
                        border: t.border || '1px solid #e2e8f0',
                        borderLeft: `4px solid ${statusCor.cor}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        boxShadow: t.shadow,
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: `${statusCor.cor}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <ShieldCheck size={22} color={statusCor.cor} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                          STATUS DO SISTEMA
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                          <span style={{ position: 'relative', display: 'inline-flex', height: '8px', width: '8px', flexShrink: 0 }}>
                            <motion.span
                              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                              style={{
                                position: 'absolute',
                                display: 'inline-flex',
                                height: '100%',
                                width: '100%',
                                borderRadius: '9999px',
                                backgroundColor: statusCor.cor,
                                opacity: 0.75
                              }}
                            />
                            <span style={{
                              position: 'relative',
                              display: 'inline-flex',
                              borderRadius: '9999px',
                              height: '8px',
                              width: '8px',
                              backgroundColor: statusCor.cor
                            }} />
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {statusCor.label}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Versão */}
                    <motion.div
                      whileHover={{ y: -5, scale: 1.01, boxShadow: t.shadowMedium || '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: t.radiusInner || '12px',
                        backgroundColor: t.bg,
                        border: t.border || '1px solid #e2e8f0',
                        borderLeft: `4px solid ${t.accent || '#2563eb'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        boxShadow: t.shadow,
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: `${t.accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Cpu size={22} color={t.accent} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {packageJson.name.replace(/-root$/, '').toUpperCase().replace('-', ' ')}
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          v{packageJson.version}
                        </span>
                      </div>
                    </motion.div>

                    {/* Infraestrutura */}
                    <motion.div
                      whileHover={{ y: -5, scale: 1.01, boxShadow: t.shadowMedium || '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: t.radiusInner || '12px',
                        backgroundColor: t.bg,
                        border: t.border || '1px solid #e2e8f0',
                        borderLeft: `4px solid ${t.accent || '#2563eb'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        boxShadow: t.shadow,
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: `${t.accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Building2 size={22} color={t.accent} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                          INFRAESTRUTURA
                        </span>
                        <span
                          style={{ fontSize: '1rem', fontWeight: 800, color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={company?.nome || companyData?.nome || activeCompany || '—'}
                        >
                          {company?.nome || companyData?.nome || activeCompany || '—'}
                        </span>
                      </div>
                    </motion.div>

                    {/* Plano */}
                    <motion.div
                      whileHover={{ y: -5, scale: 1.01, boxShadow: t.shadowMedium || '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: t.radiusInner || '12px',
                        backgroundColor: t.bg,
                        border: t.border || '1px solid #e2e8f0',
                        borderLeft: `4px solid ${t.accent || '#2563eb'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        boxShadow: t.shadow,
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: `${t.accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <CreditCard size={22} color={t.accent} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                          PLANO ATIVO
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subscription?.plano || 'Não definido'}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* 1. Personalização de Interface (Temas) */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: t.text, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Contrast size={18} color={t.accent} /> Personalização de Interface
                  </h3>
                  <p style={{ color: t.textSecondary, fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                    Escolha o tema. Preferências salvas automaticamente.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {[
                      { id: 'clean', label: 'Clean (Padrão)', description: 'Interface clara e minimalista' },
                      { id: 'clear', label: 'Claro Clear', description: 'Focado em leitura e conforto visual' },
                      { id: 'beige', label: 'Bege Suave', description: 'Tons pasteis quentes e relaxantes' },
                      { id: 'highContrastLight', label: 'Alto Contraste Claro', description: 'Interface clara com máxima visibilidade' },
                      { id: 'dark', label: 'Dark (Escuro)', description: 'Ideal para ambientes com pouca luz' },
                      { id: 'dim', label: 'Dim (Azul Slate)', description: 'Focado em leitura e conforto visual' },
                      { id: 'midnight', label: 'Midnight', description: 'Preto absoluto para telas OLED' },
                      { id: 'highContrast', label: 'Alto Contraste', description: 'Máxima visibilidade e acessibilidade' }
                    ].map((themeOpt) => {
                      const isActive = currentTheme === themeOpt.id;
                      const optColors = themes[themeOpt.id] || themes.clean;
                      return (
                        <motion.button
                          key={themeOpt.id}
                          onClick={() => setTheme(themeOpt.id)}
                          whileHover={{ scale: 1.02, borderColor: t.accent || '#2563eb' }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            padding: '1rem',
                            borderRadius: t.radiusInner || '12px',
                            backgroundColor: isActive ? (t.accentSoft || 'rgba(37,99,235,0.05)') : (t.bgSecondary || '#f8fafc'),
                            border: `2px solid ${isActive ? (t.accent || '#2563eb') : borderColor}`,
                            cursor: 'pointer',
                            textAlign: 'left',
                            gap: '0.75rem',
                            position: 'relative',
                            transition: 'background-color 0.2s, border-color 0.2s',
                            boxShadow: isActive ? (t.shadowSmall || '0 4px 6px -1px rgba(0,0,0,0.05)') : 'none',
                            outline: 'none'
                          }}
                        >
                          {/* Mini Mockup Preview */}
                          <div style={{
                            width: '100%',
                            height: '80px',
                            borderRadius: t.radiusSmall || '8px',
                            backgroundColor: optColors.bgSecondary || '#f8fafc',
                            border: optColors.border || '1px solid #e2e8f0',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {/* Accent line top bar */}
                            <div style={{
                              height: '12px',
                              borderRadius: '4px',
                              backgroundColor: optColors.bg || '#ffffff',
                              border: optColors.border || '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 4px',
                              justifyContent: 'space-between'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '3px',
                                borderRadius: '1.5px',
                                backgroundColor: optColors.accent || '#2563eb'
                              }} />
                              <div style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: optColors.accent || '#2563eb'
                              }} />
                            </div>

                            {/* 2 panels side-by-side inside content area */}
                            <div style={{
                              flex: 1,
                              display: 'flex',
                              gap: '4px'
                            }}>
                              <div style={{
                                flex: 1,
                                borderRadius: '4px',
                                backgroundColor: optColors.bg || '#ffffff',
                                border: optColors.border || '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '4px',
                                justifyContent: 'space-between'
                              }}>
                                <div style={{ width: '10px', height: '2px', borderRadius: '1px', backgroundColor: optColors.accent || '#2563eb' }} />
                                <div style={{ width: '100%', height: '2px', borderRadius: '1px', backgroundColor: optColors.textSecondary || '#64748b', opacity: 0.2 }} />
                              </div>
                              <div style={{
                                flex: 1,
                                borderRadius: '4px',
                                backgroundColor: optColors.bg || '#ffffff',
                                border: optColors.border || '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '4px',
                                justifyContent: 'space-between'
                              }}>
                                <div style={{ width: '10px', height: '2px', borderRadius: '1px', backgroundColor: optColors.success || '#10b981' }} />
                                <div style={{ width: '100%', height: '2px', borderRadius: '1px', backgroundColor: optColors.textSecondary || '#64748b', opacity: 0.2 }} />
                              </div>
                            </div>
                          </div>

                          {/* Theme info */}
                          <div style={{ paddingRight: '20px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: t.textMain || '#0f172a', display: 'block', marginBottom: '2px' }}>
                              {themeOpt.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: t.textSecondary || '#64748b', display: 'block', lineHeight: '1.2' }}>
                              {themeOpt.description}
                            </span>
                          </div>

                          {/* Checkmark circle on active theme */}
                          {isActive && (
                            <div style={{
                              position: 'absolute',
                              bottom: '12px',
                              right: '12px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: t.accent || '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: `0 2px 4px ${t.accent}40`
                            }}>
                              <Check size={12} color={t.accentContrast || 'white'} />
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>


                {/* 3. Modo de Visualização */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layout size={18} color={t.accent} /> Modo de Visualização
                  </h3>
                  <p style={{ color: t.textSecondary, fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                    Escolha como as listas de produtos e clientes são exibidas.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {[
                      { id: 'inventory', label: 'Estoque (Produtos)', description: 'Visualização padrão na tela de estoque', currentVal: viewSettings?.inventory || 'grid' },
                      { id: 'contacts', label: 'Clientes (Contatos)', description: 'Visualização padrão na tela de contatos', currentVal: viewSettings?.contacts || 'grid' },
                      { id: 'deals', label: 'Vendas (Oportunidades)', description: 'Visualização padrão na tela de vendas', currentVal: viewSettings?.deals || 'list' },
                      { id: 'tasks', label: 'Tarefas', description: 'Visualização padrão na tela de tarefas', currentVal: viewSettings?.tasks || 'list' },
                      { id: 'service', label: 'Suporte / Tickets', description: 'Visualização padrão na tela de suporte', currentVal: viewSettings?.service || 'list' },
                      { id: 'coupons', label: 'Cupons', description: 'Visualização padrão na tela de cupons', currentVal: viewSettings?.coupons || 'list' },
                      { id: 'partners', label: 'Parceiros', description: 'Visualização padrão na tela de parceiros', currentVal: viewSettings?.partners || 'grid' }
                    ].map((mod) => (
                      <div
                        key={mod.id}
                        style={{
                          padding: '1.5rem',
                          borderRadius: t.radiusInner,
                          backgroundColor: t.bg || 'white',
                          border: t.border || '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.25rem',
                          boxShadow: t.shadow,
                          transition: 'box-shadow 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {mod.id === 'inventory' ? <Layers size={18} color="#8b5cf6" /> :
                            mod.id === 'contacts' ? <Users size={18} color="#8b5cf6" /> :
                              mod.id === 'deals' ? <Zap size={18} color="#f59e0b" /> :
                                mod.id === 'service' ? <Shield size={18} color="#06b6d4" /> :
                                  mod.id === 'coupons' ? <FileText size={18} color="#10b981" /> :
                                    mod.id === 'partners' ? <Building2 size={18} color="#3b82f6" /> :
                                      <Check size={18} color="#8b5cf6" />}
                          <span style={{ fontSize: '0.95rem', fontWeight: 900, color: t.textMain || '#0f172a' }}>
                            {mod.label}
                          </span>
                        </div>

                        {/* Segmented Control */}
                        <div style={{
                          display: 'flex',
                          gap: '4px',
                          backgroundColor: t.bgSecondary || '#f1f5f9',
                          padding: '4px',
                          borderRadius: t.radiusInner || '12px'
                        }}>
                          <motion.button
                            onClick={() => {
                              setViewSettings(mod.id, 'grid');
                              if (mod.id === 'deals') {
                                setViewSettings('dealsLegacy', 'grid');
                              }
                            }}
                            whileHover={{ scale: 1.02 }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: t.radiusSmall || '8px',
                              border: 'none',
                              backgroundColor: mod.currentVal === 'grid' ? (t.accent || '#2563eb') : 'transparent',
                              color: mod.currentVal === 'grid' ? (t.accentContrast || '#ffffff') : (t.textSecondary || '#64748b'),
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.15s'
                            }}
                          >
                            <LayoutGrid size={16} color={mod.currentVal === 'grid' ? (t.accentContrast || '#ffffff') : (t.textSecondary || '#64748b')} /> Grade
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setViewSettings(mod.id, 'list');
                              if (mod.id === 'deals') {
                                setViewSettings('dealsLegacy', 'list');
                              }
                            }}
                            whileHover={{ scale: 1.02 }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: t.radiusSmall || '8px',
                              border: 'none',
                              backgroundColor: mod.currentVal === 'list' ? (t.accent || '#2563eb') : 'transparent',
                              color: mod.currentVal === 'list' ? (t.accentContrast || '#ffffff') : (t.textSecondary || '#64748b'),
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.15s'
                            }}
                          >
                            <List size={16} color={mod.currentVal === 'list' ? (t.accentContrast || '#ffffff') : (t.textSecondary || '#64748b')} /> Lista
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>




                {/* Info Notice Banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: t.accentSoft || 'rgba(37,99,235,0.05)',
                  border: t.accent ? `1px solid ${t.accent}33` : '1px solid #bfdbfe',
                  padding: '1rem 1.25rem',
                  borderRadius: t.radiusInner || '16px'
                }}>
                  <Info size={18} color={t.accent || '#2563eb'} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: t.textMain || '#1e3a8a', lineHeight: '1.4' }}>
                    Nota: O tema e densidade são aplicados apenas ao seu usuário. Configurações da empresa ficam na aba <strong>Empresa</strong>.
                  </span>
                </div>

              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
          }}
          onClick={() => setShowUserModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '560px', maxWidth: '100%', maxHeight: '95vh',
              display: 'flex', flexDirection: 'column',
              padding: 0, overflow: 'hidden',
              border: t.border || '1px solid #e2e8f0',
              boxShadow: t.shadowLarge || '0 25px 50px -12px rgba(0,0,0,0.25)',
              borderRadius: t.radius,
              backgroundColor: t.bg
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: t.border || '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: t.bgSecondary,
              borderRadius: `${t.radius} ${t.radius} 0 0`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                  <UserPlus size={18} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Novo Usuário</h2>
              </div>
              <motion.button
                onClick={() => setShowUserModal(false)}
                className="modal-close-btn"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <form onSubmit={handleAddUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="field-label">Nome Completo <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required className="field-input" value={newUser.nome} onChange={e => setNewUser({ ...newUser, nome: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="field-label">E-mail de Acesso <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required type="email" className="field-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Função / Cargo <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className="field-select" value={newUser.funcao} onChange={e => setNewUser({ ...newUser, funcao: e.target.value })}>
                      <option value="admin">Administrador</option>
                      <option value="developer">Developer</option>
                      <option value="funcionario">Funcionário</option>
                      <option value="gerente">Gerente</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="estagiario">Estagiário</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="colaborador">Colaborador</option>
                      <option value="parceiro">Parceiro</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="field-label" style={{ margin: 0 }}>Acessos Permitidos</label>
                    <button
                      type="button"
                      onClick={toggleAllAccess}
                      style={{ fontSize: '0.8rem', color: t.accent || '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, outline: 'none' }}
                    >
                      {newUser.allAccess ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
                    maxHeight: '180px', overflowY: 'auto', padding: '0.75rem',
                    backgroundColor: t.bgSecondary, borderRadius: '10px', border: t.border || '1px solid #e2e8f0'
                  }}>
                    {SCREENS.map(screen => (
                      <label key={screen.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer',
                        padding: '6px 8px', borderRadius: '7px', backgroundColor: newUser.telas.includes(screen.id) ? t.accentSoft : 'transparent',
                        color: t.textMain, transition: '0.15s'
                      }}>
                        <input
                          type="checkbox"
                          checked={newUser.telas.includes(screen.id)}
                          onChange={() => togglePermission(screen.id)}
                        />
                        {screen.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingUser}
                  style={{
                    width: '100%', backgroundColor: t.accent, color: t.accentContrast,
                    padding: '0.75rem', height: '44px', fontWeight: 600,
                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontSize: '0.9rem', transition: 'all 0.2s',
                    boxShadow: `0 4px 12px ${t.accent}25`,
                    opacity: creatingUser ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => { if (!creatingUser) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { if (!creatingUser) e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {creatingUser ? <Loader2 className="animate-spin" size={16} /> : null}
                  {creatingUser ? 'Criando Usuário...' : 'Criar Usuário Autorizado'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Nova Empresa */}
      {showNewCompanyModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
          }}
          onClick={() => setShowNewCompanyModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '560px', maxWidth: '100%', maxHeight: '95vh',
              display: 'flex', flexDirection: 'column',
              padding: 0, overflow: 'hidden',
              border: t.border || '1px solid #e2e8f0',
              boxShadow: t.shadowLarge || '0 25px 50px -12px rgba(0,0,0,0.25)',
              borderRadius: t.radius,
              backgroundColor: t.bg
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: t.border || '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: t.bgSecondary,
              borderRadius: `${t.radius} ${t.radius} 0 0`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#d1fae5', color: '#059669', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                  <Building2 size={18} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>Nova Empresa</h2>
              </div>
              <motion.button
                type="button"
                onClick={() => setShowNewCompanyModal(false)}
                className="modal-close-btn"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (creatingCompany) return;
                setCreatingCompany(true);

                const companyName = e.target.nome.value;
                const cnpjVal = e.target.cnpj.value;

                if (!validateCNPJ(cnpjVal)) {
                  alert('CNPJ inválido! Por favor, insira um CNPJ válido.');
                  setCreatingCompany(false);
                  return;
                }

                const companyId = companyName
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "") // remove accents
                  .replace(/[^a-z0-9]/g, "-")      // replace special characters with -
                  .replace(/-+/g, "-")            // collapse multiple dashes
                  .replace(/^-|-$/g, "");         // trim dashes

                if (!companyId) {
                  alert('Nome da empresa inválido.');
                  setCreatingCompany(false);
                  return;
                }

                const businessDocRef = doc(db, 'business', companyId);

                try {
                  // Verificar se a empresa (pasta) já existe
                  const docSnap = await getDoc(businessDocRef);
                  if (docSnap.exists()) {
                    alert('Já existe uma empresa cadastrada com esse mesmo nome (mesmo nome de pasta)! Escolha outro nome.');
                    setCreatingCompany(false);
                    return;
                  }

                  const ambienteVal = e.target.ambiente.value;
                  const encryptedAmbiente = encryptData(ambienteVal);
                  const encryptedStatus = encryptData('ativa');

                  // 1. Criar o documento cadastral da empresa sob /business/{companyId}
                  await setDoc(businessDocRef, {
                    nome: companyName,
                    nomeFantasia: e.target.nomeFantasia.value,
                    cnpj: cnpjVal,
                    responsavel: e.target.responsavel.value,
                    email: e.target.email.value,
                    ambiente: encryptedAmbiente,
                    status: encryptedStatus,
                    createdAt: new Date().toISOString(),
                    modificacoes: [new Date().toISOString()]
                  });

                  // 2. Criar subdocumento settings/company para retrocompatibilidade com as demais telas do CRM
                  await setDoc(doc(db, `business/${companyId}/settings`, 'company'), {
                    nome: companyName,
                    nomeFantasia: e.target.nomeFantasia.value,
                    cnpj: cnpjVal,
                    responsavel: e.target.responsavel.value,
                    email: e.target.email.value,
                    ambiente: encryptedAmbiente,
                    status: encryptedStatus,
                    createdAt: new Date().toISOString(),
                    modificacoes: [new Date().toISOString()]
                  });

                  // 3. Criar o usuário administrador no Firebase Auth e Firestore vinculado à pasta da empresa
                  let tempApp;
                  const adminPassword = generateRandomPassword();
                  try {
                    // Configuração do Firebase para o app temporário
                    const firebaseConfig = {
                      apiKey: "mock-demo-api-key-safe-to-expose",
                      authDomain: "crm-master-demo.firebaseapp.com",
                      projectId: "crm-master-demo",
                      storageBucket: "crm-master-demo.appspot.com",
                      messagingSenderId: "000000000000",
                      appId: "1:000000000000:web:mockappid00000000"
                    };

                    const tempAppName = `temp-auth-company-${Date.now()}`;
                    tempApp = initializeApp(firebaseConfig, tempAppName);
                    const tempAuth = getAuth(tempApp);

                    const userCredential = await createUserWithEmailAndPassword(tempAuth, e.target.email.value, adminPassword);
                    const uid = userCredential.user.uid;
                    await tempAuth.signOut();

                    // Criar o documento sob /users/{uid}
                    await setDoc(doc(db, 'users', uid), {
                      nome: e.target.responsavel.value,
                      email: encryptData(e.target.email.value),
                      funcao: encryptData('responsavel'),
                      empresa: companyId,
                      allAccess: encryptData('true'),
                      active: encryptData('true'),
                      requirePasswordChange: encryptData('true'),
                      emailContato: encryptData(e.target.emailContato.value),
                      telefone: encryptData(e.target.telefoneResponsavel.value),
                      telas: SCREENS.map(s => s.id),
                      createdAt: new Date().toISOString()
                    });

                    // Trigger password reset email
                    try {
                      await sendPasswordResetEmail(auth, e.target.email.value);
                    } catch (resetErr) {
                      console.error("Error sending reset password email:", resetErr);
                    }

                    alert(`Empresa criada com sucesso!\n\nUm usuário administrador foi criado com o e-mail: ${e.target.email.value}. Um e-mail com instruções para definir a senha foi enviado.`);
                    setShowNewCompanyModal(false);
                  } catch (authErr) {
                    console.error("Firebase Auth Error for Company Admin:", authErr);
                    let errorMsg = 'Erro ao criar o usuário administrador no Firebase Auth.';
                    if (authErr.code === 'auth/email-already-in-use') {
                      errorMsg = 'O e-mail do responsável já está em uso!';
                    } else if (authErr.code === 'auth/invalid-email') {
                      errorMsg = 'E-mail do responsável inválido!';
                    }
                    alert(errorMsg);
                  } finally {
                    if (tempApp) {
                      try {
                        await deleteApp(tempApp);
                      } catch (e) {
                        console.error("Error deleting temp app:", e);
                      }
                    }
                  }
                } catch (err) {
                  console.error(err);
                  alert('Erro ao criar empresa');
                } finally {
                  setCreatingCompany(false);
                }
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Row 1 */}
                  <div className="form-group">
                    <label className="field-label">Nome Fantasia <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required name="nomeFantasia" className="field-input" placeholder="Nome Fantasia" />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Razão Social <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required name="nome" className="field-input" placeholder="Razão Social" />
                  </div>

                  {/* Row 2 */}
                  <div className="form-group">
                    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      CNPJ <span style={{ color: '#ef4444' }}>*</span> {(newCompanyCnpj || '').length >= 14 && (validateCNPJ(newCompanyCnpj || '') ? <Check size={14} color={t.success || "#10b981"} /> : <X size={14} color={t.danger || "#ef4444"} />)}
                    </label>
                    <input
                      required
                      name="cnpj"
                      className="field-input"
                      placeholder="00.000.000/0000-00"
                      value={newCompanyCnpj}
                      onChange={e => setNewCompanyCnpj(maskCNPJ(e.target.value))}
                      style={newCompanyCnpj.length === 18 && !validateCNPJ(newCompanyCnpj) ? { borderColor: t.danger || '#ef4444' } : {}}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Responsável <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required name="responsavel" className="field-input" placeholder="Nome do Responsável" />
                  </div>

                  {/* Row 3 */}
                  <div className="form-group">
                    <label className="field-label">E-mail de Acesso <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required type="email" name="email" className="field-input" placeholder="email@empresa.com" />
                  </div>
                  <div className="form-group">
                    <label className="field-label">E-mail de Contato <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required type="email" name="emailContato" className="field-input" placeholder="contato@empresa.com" />
                  </div>

                  {/* Row 4 */}
                  <div className="form-group">
                    <label className="field-label">Telefone do Responsável <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      name="telefoneResponsavel"
                      className="field-input"
                      placeholder="(00) 00000-0000"
                      onChange={e => e.target.value = maskPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Ambiente <span style={{ color: '#ef4444' }}>*</span></label>
                    <select required name="ambiente" className="field-select">
                      <option value="homologacao">Homologação</option>
                      <option value="producao">Produção</option>
                      <option value="freetrial">Free Trial</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingCompany}
                  style={{
                    width: '100%', backgroundColor: '#10b981', color: '#fff',
                    padding: '0.75rem', height: '44px', fontWeight: 600,
                    border: 'none', borderRadius: t.radiusSmall, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontSize: '0.9rem', transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    marginTop: '0.5rem',
                    opacity: creatingCompany ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => { if (!creatingCompany) e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { if (!creatingCompany) e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {creatingCompany ? <Loader2 className="animate-spin" size={16} /> : null}
                  {creatingCompany ? 'Criando Empresa...' : 'Criar Empresa'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* User Details Modal (Click to open, loads in read-only mode first) */}
      {showUserDetailsModal && selectedUser && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
          }}
          onClick={() => {
            if (!deletingUserInProgress) {
              setShowUserDetailsModal(false);
              setSelectedUser(null);
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '560px', maxWidth: '100%', maxHeight: '95vh',
              display: 'flex', flexDirection: 'column',
              padding: 0, overflow: 'hidden',
              border: t.border || '1px solid #e2e8f0',
              boxShadow: t.shadowLarge || '0 25px 50px -12px rgba(0,0,0,0.25)',
              borderRadius: t.radius,
              backgroundColor: t.bg
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: t.border || '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: t.bgSecondary,
              borderRadius: `${t.radius} ${t.radius} 0 0`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                  <Users size={18} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.textMain, margin: 0 }}>
                  {isEditingUser ? 'Editar Usuário' : 'Detalhes do Usuário'}
                </h2>
              </div>
              <motion.button
                onClick={() => {
                  setShowUserDetailsModal(false);
                  setSelectedUser(null);
                }}
                className="modal-close-btn"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {/* Check if self-management */}
              {selectedUser.id === (auth.currentUser?.uid || user?.id || user?.uid) ? (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  color: '#b45309',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Info size={16} />
                  Você não pode editar ou excluir seu próprio perfil através deste painel.
                </div>
              ) : null}

              {showDeleteConfirm ? (
                /* Password validation confirmation card */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '0.875rem',
                    lineHeight: '1.5'
                  }}>
                    <strong>⚠️ Exclusão Crítica:</strong> Tem certeza que deseja excluir o usuário <strong>{selectedUser.nome}</strong> permanentemente? Esta ação é irreversível e removerá todos os acessos vinculados.
                    <br /><br />
                    Para confirmar, insira a <strong>sua senha de login (usuário logado)</strong>:
                  </div>

                  <div className="form-group">
                    <label className="field-label">Sua Senha de Confirmação <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="password"
                      className="field-input"
                      placeholder="Senha do administrador logado"
                      value={adminPasswordForDelete}
                      onChange={e => setAdminPasswordForDelete(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setAdminPasswordForDelete('');
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: t.bgSecondary,
                        color: t.textMain,
                        border: t.border || '1px solid #cbd5e1',
                        borderRadius: t.radiusSmall,
                        height: '40px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deletingUserInProgress}
                      onClick={handleDeleteUserConfirmed}
                      style={{
                        flex: 1,
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: t.radiusSmall,
                        height: '40px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {deletingUserInProgress ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      Confirmar Exclusão
                    </button>
                  </div>
                </div>
              ) : (
                /* Regular form (Read-only or Edit mode) */
                <div>
                  {selectedUser.funcao === 'responsavel' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div className="form-group">
                        <label className="field-label">Nome Completo</label>
                        <input
                          disabled={!isEditingUser}
                          required
                          className="field-input"
                          value={selectedUser.nome}
                          onChange={e => setSelectedUser({ ...selectedUser, nome: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">E-mail de Acesso</label>
                        <input
                          disabled={!isEditingUser}
                          required
                          type="email"
                          className="field-input"
                          value={selectedUser.email}
                          onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">E-mail de Contato</label>
                        <input
                          disabled={!isEditingUser}
                          type="email"
                          className="field-input"
                          value={selectedUser.emailContato || ''}
                          onChange={e => setSelectedUser({ ...selectedUser, emailContato: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Telefone</label>
                        <input
                          disabled={!isEditingUser}
                          className="field-input"
                          value={selectedUser.telefone || ''}
                          placeholder="(00) 00000-0000"
                          onChange={e => setSelectedUser({ ...selectedUser, telefone: maskPhone(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Função / Cargo</label>
                        <select
                          disabled={!isEditingUser}
                          className="field-select"
                          value={selectedUser.funcao}
                          onChange={e => setSelectedUser({ ...selectedUser, funcao: e.target.value })}
                        >
                          <option value="admin">Administrador</option>
                          <option value="developer">Developer</option>
                          <option value="funcionario">Funcionário</option>
                          <option value="gerente">Gerente</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="estagiario">Estagiário</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="colaborador">Colaborador</option>
                          <option value="parceiro">Parceiro</option>
                          <option value="responsavel">Responsável</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="field-label">Status</label>
                        <select
                          disabled={!isEditingUser}
                          className="field-select"
                          value={selectedUser.active ? "ativo" : "inativo"}
                          onChange={e => setSelectedUser({ ...selectedUser, active: e.target.value === "ativo" })}
                        >
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div className="form-group">
                        <label className="field-label">Nome Completo</label>
                        <input
                          disabled={!isEditingUser}
                          required
                          className="field-input"
                          value={selectedUser.nome}
                          onChange={e => setSelectedUser({ ...selectedUser, nome: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">E-mail de Acesso</label>
                        <input
                          disabled={!isEditingUser}
                          required
                          type="email"
                          className="field-input"
                          value={selectedUser.email}
                          onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Função / Cargo</label>
                        <select
                          disabled={!isEditingUser}
                          className="field-select"
                          value={selectedUser.funcao}
                          onChange={e => setSelectedUser({ ...selectedUser, funcao: e.target.value })}
                        >
                          <option value="admin">Administrador</option>
                          <option value="developer">Developer</option>
                          <option value="funcionario">Funcionário</option>
                          <option value="gerente">Gerente</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="estagiario">Estagiário</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="colaborador">Colaborador</option>
                          <option value="parceiro">Parceiro</option>
                          <option value="responsavel">Responsável</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="field-label">Status</label>
                        <select
                          disabled={!isEditingUser}
                          className="field-select"
                          value={selectedUser.active ? "ativo" : "inativo"}
                          onChange={e => setSelectedUser({ ...selectedUser, active: e.target.value === "ativo" })}
                        >
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label className="field-label" style={{ margin: 0 }}>Acessos Permitidos</label>
                      {isEditingUser && (
                        <button
                          type="button"
                          onClick={toggleSelectedUserAllAccess}
                          style={{ fontSize: '0.8rem', color: t.accent || '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, outline: 'none' }}
                        >
                          {selectedUser.allAccess ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                      )}
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
                      maxHeight: '180px', overflowY: 'auto', padding: '0.75rem',
                      backgroundColor: t.bgSecondary, borderRadius: '10px', border: t.border || '1px solid #e2e8f0'
                    }}>
                      {SCREENS.map(screen => (
                        <label key={screen.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: isEditingUser ? 'pointer' : 'default',
                          padding: '6px 8px', borderRadius: '7px', backgroundColor: selectedUser.telas.includes(screen.id) ? t.accentSoft : 'transparent',
                          color: t.textMain, transition: '0.15s',
                          opacity: !isEditingUser && !selectedUser.telas.includes(screen.id) ? 0.5 : 1
                        }}>
                          <input
                            type="checkbox"
                            disabled={!isEditingUser}
                            checked={selectedUser.telas.includes(screen.id)}
                            onChange={() => toggleSelectedUserPermission(screen.id)}
                          />
                          {screen.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: t.border || '1px solid #e2e8f0', paddingTop: '1.25rem' }}>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {selectedUser.id !== (auth.currentUser?.uid || user?.id || user?.uid) && (
                        <>
                          {!isEditingUser ? (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await sendPasswordResetEmail(auth, selectedUser.email);
                                    alert(`E-mail de redefinição de senha enviado para: ${selectedUser.email}`);
                                  } catch (e) {
                                    console.error(e);
                                    alert('Erro ao enviar e-mail de redefinição: ' + e.message);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: t.bgSecondary,
                                  color: t.textMain,
                                  border: t.border || '1px solid #cbd5e1',
                                  borderRadius: t.radiusSmall,
                                  height: '42px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <Lock size={16} /> Redefinir Senha
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingUser(true)}
                                style={{
                                  flex: 1,
                                  backgroundColor: t.accent,
                                  color: t.accentContrast,
                                  border: 'none',
                                  borderRadius: t.radiusSmall,
                                  height: '42px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <Edit3 size={16} /> Editar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                style={{
                                  backgroundColor: '#ef4444',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: t.radiusSmall,
                                  height: '42px',
                                  padding: '0 1rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <Trash2 size={16} /> Excluir
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveUserDetails}
                                style={{
                                  flex: 1,
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: t.radiusSmall,
                                  height: '42px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <Check size={16} /> Salvar
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
      {/* ══════════ MAPPING MODAL ══════════ */}
      <AnimatePresence>
        {showMappingModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="modal-content"
              style={{
                width: '780px',
                maxWidth: '95vw',
                height: '80vh',
                maxHeight: '90vh',
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
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      Mapeamento de Colunas — {DATA_SOURCES.find(s => s.id === selectedImportSource)?.label}
                    </h3>
                  </div>
                </div>
                <motion.button
                  onClick={closeMappingModal}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Form Content */}
              <div style={{
                padding: '1.5rem',
                flex: 1,
                backgroundColor: t.bg,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                overflowY: 'auto'
              }}>

                <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: '0 0 0.5rem', lineHeight: 1.55 }}>
                  Mapeie as colunas do seu arquivo XLSX para os campos correspondentes no banco de dados. Os campos com <span style={{ color: t.danger }}>*</span> são obrigatórios.
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1.25rem 1rem'
                }}>
                  {(IMPORT_FIELDS[selectedImportSource] || [])
                    .filter(f => {
                      // Se CEP estiver mapeado, oculta Logradouro, Bairro e Cidade-UF
                      if (importMapping.cep) {
                        if (['logradouro', 'bairro', 'cidadeUf'].includes(f.dbField)) {
                          return false;
                        }
                      }
                      // Se "Entrega mesmo endereço" não estiver mapeado (ou seja, ignorado/falsy), oculta os campos de entrega
                      if (!importMapping.entregaMesmoEndereco) {
                        if (f.dbField.startsWith('entrega') && f.dbField !== 'entregaMesmoEndereco') {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map(f => (
                      <div key={f.dbField} className="form-group" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {f.label} {f.required && <span style={{ color: t.danger }}>*</span>}
                        </label>
                        <select
                          value={importMapping[f.dbField] || ''}
                          onChange={(e) => handleMappingChange(f.dbField, e.target.value)}
                          className="field-select"
                          style={{
                            width: '100%', height: '40px', padding: '0 0.75rem', borderRadius: t.radiusSmall,
                            border: t.borderBold || t.border, backgroundColor: t.bg, color: t.textMain, fontWeight: 600, outline: 'none'
                          }}
                        >
                          <option value="">(Ignorar campo)</option>
                          {importHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>

              </div>

              {/* Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                backgroundColor: t.bgSecondary,
                borderTop: t.border,
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: t.radiusSmall,
                    height: '42px',
                    width: '100%',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Upload size={16} /> Confirmar Importação
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showExportModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: '90%',
                maxWidth: '650px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
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
                    <Download size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      Colunas para Exportação — {DATA_SOURCES.find(s => s.id === selectedExportSource)?.label}
                    </h3>
                  </div>
                </div>
                <motion.button
                  onClick={closeExportModal}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Form Content */}
              <div style={{
                padding: '1.5rem',
                flex: 1,
                backgroundColor: t.bg,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                overflowY: 'auto'
              }}>
                <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: '0 0 0.5rem', lineHeight: 1.55 }}>
                  Selecione as colunas que deseja exportar para o arquivo Excel (.xlsx).
                </p>

                {/* Selecionar Todas */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.85rem',
                    borderRadius: t.radiusInner,
                    border: `1px dashed ${t.accent}`,
                    backgroundColor: `${t.accent}05`,
                    cursor: 'pointer',
                    marginBottom: '0.5rem',
                    userSelect: 'none'
                  }}
                  onClick={() => {
                    const fields = IMPORT_FIELDS[selectedExportSource] || [];
                    const allDbFields = fields.map(f => f.dbField);
                    const allChecked = fields.length > 0 && selectedExportColumns.length === fields.length;
                    if (allChecked) {
                      setSelectedExportColumns([]);
                    } else {
                      setSelectedExportColumns(allDbFields);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(IMPORT_FIELDS[selectedExportSource] || []).length > 0 && selectedExportColumns.length === (IMPORT_FIELDS[selectedExportSource] || []).length}
                    onChange={() => { }} // handled by onClick on parent
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: t.accent }}>Selecionar Todas as Colunas</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1rem'
                }}>
                  {(IMPORT_FIELDS[selectedExportSource] || []).map(f => {
                    const isChecked = selectedExportColumns.includes(f.dbField);
                    return (
                      <label
                        key={f.dbField}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '0.75rem',
                          borderRadius: t.radiusSmall,
                          border: `1px solid ${isChecked ? t.accent : t.border || '#cbd5e1'}`,
                          backgroundColor: isChecked ? `${t.accent}05` : (t.bgSecondary || '#f8fafc'),
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExportColumns([...selectedExportColumns, f.dbField]);
                            } else {
                              setSelectedExportColumns(selectedExportColumns.filter(col => col !== f.dbField));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: t.textMain }}>{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                backgroundColor: t.bgSecondary,
                borderTop: t.border,
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button
                  type="button"
                  onClick={handleConfirmExport}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: t.radiusSmall,
                    height: '42px',
                    width: '100%',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Download size={16} /> Confirmar Exportação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Settings;

