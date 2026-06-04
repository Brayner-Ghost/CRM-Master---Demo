import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { maskPhone, maskCPF, validateCPF, maskCEP, obfuscateCPF, obfuscatePhone, obfuscateEmail, obfuscateCEP, obfuscateText } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { encryptSensitiveFields, decryptSensitiveFields, decryptLegacySale, decryptActiveSale } from '../utils/crypto';
import { Plus, Search, Filter, Phone, Download, Trash2, X, Users, Loader2, Check, MessageCircle, Edit3, Calendar } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const CLIENT_SENSITIVE_FIELDS = ['cpf', 'genero', 'telefone', 'email', 'dataNascimento', 'indicacao', 'fonte', 'status'];
const ADDRESS_SENSITIVE_FIELDS = ['cep', 'logradouro', 'numero', 'bairro', 'cidadeUf', 'complemento'];

const GENERIC_NAMES = [
  'CONSUMIDOR', 'CONSUMIDOR FINAL', 'CONSUMIDOR NAO IDENTIFICADO', 'CONSUMIDOR NÃO IDENTIFICADO',
  'CLIENTE', 'CLIENTE PDV', 'N/A', 'NÃO INFORMADO', 'NAO INFORMADO', 'IMPORTADOR'
];

const matchSaleToContact = (sale, contact) => {
  if (!sale || !contact) return false;
  const sc = sale.client || {};

  // 1. Match by ID
  if (contact.id && sc.id === contact.id) return true;

  // 2. Match by CPF
  const cCpf = (contact.cpf || '').replace(/\D/g, '');
  const sCpf = (sale.clienteCpf || sc.cpf || '').replace(/\D/g, '');
  if (cCpf && cCpf.length === 11 && cCpf === sCpf) return true;

  // 3. Match by Name (excluding generic names)
  const cName = (contact.nome || '').toUpperCase().trim();
  const sName = (sale.clienteNome || sale.clientName || sale.cliente || sc.nome || '').toUpperCase().trim();

  const isGeneric = GENERIC_NAMES.includes(cName) || GENERIC_NAMES.includes(sName);
  if (cName && cName.length > 3 && sName === cName && !isGeneric) return true;

  return false;
};

const isConcludedSale = (status) => {
  if (!status) return true;
  const norm = String(status).toLowerCase().trim();
  return ['concluido', 'concluida', 'aprovada', 'concluída', 'aprovado', 'pago'].includes(norm);
};

const Contacts = ({ sidebarState }) => {
  const { t, currentTheme, viewSettings, density } = useTheme();
  const rawScale = density / 100;

  const getStatusStyle = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'exclusao' || s === 'excluido') {
      return {
        backgroundColor: t.dangerSoft,
        color: t.danger,
        border: `1px solid ${t.danger}40`
      };
    } else if (s === 'inativo') {
      return {
        backgroundColor: t.bgSecondary,
        color: t.textSecondary,
        border: t.border
      };
    } else {
      // default / ativo
      return {
        backgroundColor: t.successSoft,
        color: t.success,
        border: `1px solid ${t.success}40`
      };
    }
  };

  const { addLog, getTenantCollection, getTenantDoc } = useUser();
  const [contacts, setContacts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // 'create' | 'view'
  const [selectedContact, setSelectedContact] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [revealSensitive, setRevealSensitive] = useState(false);

  const [formData, setFormData] = useState({
    nome: '', cpf: '', genero: 'não informado', telefone: '', email: '',
    dataNascimento: '',
    cep: '', logradouro: '', numero: '', bairro: '', cidadeUf: '',
    indicacao: '', fonte: 'balcao', status: 'ativo', entregaMesmoEndereco: true,
    entregaCep: '', entregaLogradouro: '', entregaNumero: '', entregaBairro: '',
    entregaCidadeUf: ''
  });
  const [contactSales, setContactSales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusFilterMenu, setShowStatusFilterMenu] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const modalScale = isMobile ? 1 : rawScale;
  const [dpiScale, setDpiScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      // Dynamic DPI scaling calculation
      const dpi = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      let scale = 1;
      if (width < 640) scale = 0.95;
      else if (dpi > 1.5) scale = 1.05;
      setDpiScale(scale);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateRange]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (modalMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [modalMode]);

  useEffect(() => {
    const unsubContacts = onSnapshot(query(getTenantCollection('contacts'), orderBy('nome')), (s) => {
      const data = s.docs.map(doc => {
        const rawData = { id: doc.id, ...doc.data() };
        return decryptSensitiveFields(rawData, [
          ...CLIENT_SENSITIVE_FIELDS,
          'cep', 'logradouro', 'numero', 'bairro', 'cidadeUf', 'complemento',
          'entregaCep', 'entregaLogradouro', 'entregaNumero', 'entregaBairro', 'entregaCidadeUf', 'entregaComplemento'
        ]);
      });
      setContacts(data);
      setLoading(false);
    });
    const unsubPartners = onSnapshot(getTenantCollection('partners'), (s) =>
      setPartners(s.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    let activeSales = [];
    let legacySales = [];
    const updateAllSales = () => {
      setAllSales([...activeSales, ...legacySales]);
    };

    const unsubSales = onSnapshot(getTenantCollection('sales'), (s) => {
      activeSales = s.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data() };
        return decryptActiveSale(raw);
      });
      updateAllSales();
    });

    const unsubLegacy = onSnapshot(getTenantCollection('legacy'), (s) => {
      legacySales = s.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data(), isLegacy: true };
        return decryptLegacySale(raw);
      });
      updateAllSales();
    });
    return () => { unsubContacts(); unsubPartners(); unsubSales(); unsubLegacy(); };
  }, []);

  const buscaCep = async (val, type = 'fiscal') => {
    const cleanCep = val.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (type === 'fiscal') {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidadeUf: `${data.localidade} - ${data.uf}`
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            entregaLogradouro: data.logradouro || prev.entregaLogradouro,
            entregaBairro: data.bairro || prev.entregaBairro,
            entregaCidadeUf: `${data.localidade} - ${data.uf}`
          }));
        }
      }
    } catch (e) { console.error(e); }
    setLoadingCep(false);
  };

  const startScanner = (mode) => {
    alert('Funcionalidade de scanner (Câmera) será integrada em breve.');
  };

  const openModal = async (mode, contact = null) => {
    setModalMode(mode);
    setRevealSensitive(false);
    if (mode === 'view' && contact) {
      setSelectedContact(contact);
      setFormData({ ...contact });
      setIsEditing(false);

      try {
        const fiscalSnap = await getDoc(getTenantDoc(`contacts/${contact.id}/enderecofiscal`, 'default'));
        const deliverySnap = await getDoc(getTenantDoc(`contacts/${contact.id}/enderecoentrega`, 'default'));

        let fiscalData = {};
        let deliveryData = {};

        if (fiscalSnap.exists()) fiscalData = decryptSensitiveFields(fiscalSnap.data(), ADDRESS_SENSITIVE_FIELDS);
        if (deliverySnap.exists()) deliveryData = decryptSensitiveFields(deliverySnap.data(), ADDRESS_SENSITIVE_FIELDS);

        setFormData(prev => ({
          ...prev,
          ...fiscalData,
          entregaCep: deliveryData.cep || '',
          entregaLogradouro: deliveryData.logradouro || '',
          entregaNumero: deliveryData.numero || '',
          entregaBairro: deliveryData.bairro || '',
          entregaCidadeUf: deliveryData.cidadeUf || '',
          entregaComplemento: deliveryData.complemento || ''
        }));
      } catch (err) { console.error(err); }
    } else {
      setSelectedContact(null);
      setFormData({
        nome: '', cpf: '', genero: 'não informado', telefone: '', email: '',
        dataNascimento: '',
        cep: '', logradouro: '', numero: '', bairro: '', cidadeUf: '', complemento: '',
        indicacao: '', fonte: 'balcao', status: 'ativo', entregaMesmoEndereco: true,
        entregaCep: '', entregaLogradouro: '', entregaNumero: '', entregaBairro: '',
        entregaCidadeUf: '', entregaComplemento: ''
      });
      setIsEditing(true);
    }
  };

  useEffect(() => {
    if (selectedContact && modalMode === 'view') {
      const mySales = allSales.filter(sale => matchSaleToContact(sale, selectedContact));

      // Sort by date (newest first)
      const sortedSales = [...mySales].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.dataFinalizacao || a.dataVenda || a.data || 0);
        const dateB = new Date(b.createdAt || b.dataFinalizacao || b.dataVenda || b.data || 0);
        return dateB - dateA;
      });

      setContactSales(sortedSales);
    }
  }, [selectedContact, modalMode, allSales]);

  const handleCpfBlur = () => {
    const val = formData.cpf || '';
    if (!val) return;
    if (!validateCPF(val)) {
      alert('CPF Inválido!');
      return;
    }
    const cleanVal = val.replace(/\D/g, '');
    const isDuplicate = contacts.some(c => {
      const dbVal = (c.cpf || '').replace(/\D/g, '');
      return dbVal === cleanVal && c.id !== selectedContact?.id;
    });
    if (isDuplicate) {
      alert(`Já existe um cliente cadastrado com o CPF: ${val}`);
    }
  };

  const handlePhoneBlur = () => {
    const val = formData.telefone || '';
    if (!val) return;
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal.length < 10) return;
    const isDuplicate = contacts.some(c => {
      const dbVal = (c.telefone || '').replace(/\D/g, '');
      return dbVal === cleanVal && c.id !== selectedContact?.id;
    });
    if (isDuplicate) {
      alert(`Já existe um cliente cadastrado com o telefone: ${val}`);
    }
  };

  const handleEmailBlur = () => {
    const val = formData.email || '';
    if (!val) return;
    const cleanVal = val.trim().toLowerCase();
    const isDuplicate = contacts.some(c => {
      const dbVal = (c.email || '').trim().toLowerCase();
      return dbVal === cleanVal && c.id !== selectedContact?.id;
    });
    if (isDuplicate) {
      alert(`Já existe um cliente cadastrado com o e-mail: ${val}`);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // CPF validation
    const cpfValue = formData.cpf || '';
    if (cpfValue) {
      if (!validateCPF(cpfValue)) return alert('CPF Inválido!');
      const cleanCpf = cpfValue.replace(/\D/g, '');
      const isCpfDuplicate = contacts.some(c => {
        const dbCpf = (c.cpf || '').replace(/\D/g, '');
        return dbCpf === cleanCpf && c.id !== selectedContact?.id;
      });
      if (isCpfDuplicate) return alert(`Já existe um cliente cadastrado com o CPF: ${cpfValue}`);
    }

    // Phone validation
    const phoneValue = formData.telefone || '';
    if (phoneValue) {
      const cleanPhone = phoneValue.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const isPhoneDuplicate = contacts.some(c => {
          const dbPhone = (c.telefone || '').replace(/\D/g, '');
          return dbPhone === cleanPhone && c.id !== selectedContact?.id;
        });
        if (isPhoneDuplicate) return alert(`Já existe um cliente cadastrado com o telefone: ${phoneValue}`);
      }
    }

    // Email validation
    const emailValue = formData.email || '';
    if (emailValue) {
      const cleanEmail = emailValue.trim().toLowerCase();
      const isEmailDuplicate = contacts.some(c => {
        const dbEmail = (c.email || '').trim().toLowerCase();
        return dbEmail === cleanEmail && c.id !== selectedContact?.id;
      });
      if (isEmailDuplicate) return alert(`Já existe um cliente cadastrado com o e-mail: ${emailValue}`);
    }

    setSaving(true);
    try {
      const {
        cep, logradouro, numero, bairro, cidadeUf, complemento,
        entregaCep, entregaLogradouro, entregaNumero, entregaBairro, entregaCidadeUf, entregaComplemento,
        ...mainFields
      } = formData;

      const mainData = {
        ...mainFields,
        cep: cep || '',
        logradouro: logradouro || '',
        numero: numero || '',
        bairro: bairro || '',
        cidadeUf: cidadeUf || '',
        complemento: complemento || '',
        entregaCep: entregaCep || cep || '',
        entregaLogradouro: entregaLogradouro || logradouro || '',
        entregaNumero: entregaNumero || numero || '',
        entregaBairro: entregaBairro || bairro || '',
        entregaCidadeUf: entregaCidadeUf || cidadeUf || '',
        entregaComplemento: entregaComplemento || complemento || '',
        updatedAt: new Date().toISOString()
      };

      const fiscalAddr = {
        cep: cep || '', logradouro: logradouro || '', numero: numero || '',
        bairro: bairro || '', cidadeUf: cidadeUf || '', complemento: complemento || '',
        updatedAt: new Date().toISOString()
      };

      const deliveryAddr = {
        cep: entregaCep || cep || '', logradouro: entregaLogradouro || logradouro || '', numero: entregaNumero || numero || '',
        bairro: entregaBairro || bairro || '', cidadeUf: entregaCidadeUf || cidadeUf || '', complemento: entregaComplemento || complemento || '',
        updatedAt: new Date().toISOString()
      };

      const ALL_CONTACT_SENSITIVE_FIELDS = [
        ...CLIENT_SENSITIVE_FIELDS,
        'cep', 'logradouro', 'numero', 'bairro', 'cidadeUf', 'complemento',
        'entregaCep', 'entregaLogradouro', 'entregaNumero', 'entregaBairro', 'entregaCidadeUf', 'entregaComplemento'
      ];

      const encryptedMain = encryptSensitiveFields(mainData, ALL_CONTACT_SENSITIVE_FIELDS);
      const encryptedFiscal = encryptSensitiveFields(fiscalAddr, ADDRESS_SENSITIVE_FIELDS);
      const encryptedDelivery = encryptSensitiveFields(deliveryAddr, ADDRESS_SENSITIVE_FIELDS);

      let contactId = selectedContact?.id;

      if (modalMode === 'create') {
        const docRef = await addDoc(getTenantCollection('contacts'), { ...encryptedMain, createdAt: new Date().toISOString() });
        contactId = docRef.id;
      } else {
        const { id, ...updateData } = encryptedMain;
        await updateDoc(getTenantDoc('contacts', id), updateData);
        addLog(`acessou cadastro de clientes e mudou os dados do ${formData.nome}`);
      }

      await setDoc(getTenantDoc(`contacts/${contactId}/enderecofiscal`, 'default'), encryptedFiscal);
      await setDoc(getTenantDoc(`contacts/${contactId}/enderecoentrega`, 'default'), encryptedDelivery);

      alert(modalMode === 'create' ? 'Contato cadastrado com sucesso!' : 'Alterações salvas com sucesso!');
      setModalMode(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar contato.');
    } finally {
      setSaving(false);
    }
  };

  const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const filteredContacts = contacts.filter(c => {
    const searchNormalized = normalize(searchQuery).trim();
    if (!searchNormalized && statusFilter === 'all' && !dateRange.start && !dateRange.end) return true;

    const matchesSearch = !searchNormalized ||
      normalize(c.nome).includes(searchNormalized) ||
      (c.cpf || '').includes(searchNormalized) ||
      normalize(c.fonte).includes(searchNormalized) ||
      (c.telefone || '').includes(searchNormalized);

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    let matchesDate = true;
    if (dateRange.start || dateRange.end) {
      const mySales = allSales.filter(sale => matchSaleToContact(sale, c));
      if (mySales.length === 0) matchesDate = false;
      else {
        matchesDate = mySales.some(s => {
          const sDate = new Date(s.createdAt || s.data).toISOString().split('T')[0];
          const start = dateRange.start || '1970-01-01';
          const end = dateRange.end || '9999-12-31';
          return sDate >= start && sDate <= end;
        });
      }
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalItems = filteredContacts.length;
  const startIndex = (currentPage - 1) * (itemsPerPage === 'all' ? totalItems : itemsPerPage);
  const endIndex = itemsPerPage === 'all' ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  const getContactStats = (contact) => {
    const mySales = allSales.filter(sale => matchSaleToContact(sale, contact) && isConcludedSale(sale.status));
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthSales = mySales.filter(s => {
      const d = new Date(s.createdAt || s.dataFinalizacao || s.dataVenda || s.data);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const yearSales = mySales.filter(s => {
      const d = new Date(s.createdAt || s.dataFinalizacao || s.dataVenda || s.data);
      return d.getFullYear() === currentYear;
    });

    const totalSpent = mySales.reduce((acc, s) => {
      const val = Number(s.total) || Number(s.valor) || 0;
      return acc + val;
    }, 0);
    return { monthCount: monthSales.length, yearCount: yearSales.length, totalSpent, totalCount: mySales.length };
  };

  useEffect(() => {
    if (modalMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [modalMode]);

  return (
    <div className="contacts-page max-w-[1600px] mx-auto">
      <header className={isMobile ? "" : "crm-header"} style={{ marginBottom: isMobile ? '2rem' : '0' }}>
        {isMobile ? (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0.5rem',
            marginTop: '-2.5rem', // Move up towards the main hamburger
            marginBottom: '1rem',
            position: 'relative',
            zIndex: 10
          }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: t.textMain,
              margin: 0,
              marginLeft: '3.5rem', // Give space for the fixed main hamburger menu
              letterSpacing: '-0.02em'
            }}>
              Contatos
            </h1>
            <button
              onClick={() => setMobileActionsOpen(true)}
              style={{
                background: t.accent,
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              <Filter size={20} />
            </button>
          </div>
        ) : (
          <>
            {/* Left Side: Title */}
            <div className="crm-header-left">
              <h1 className="crm-page-title">Contatos</h1>
            </div>

            {/* Right Side: Search, Filters & Action Button */}
            <div className="crm-header-right">
              {/* Search Bar */}
              <div className="crm-search-wrapper" style={{ position: 'relative', width: '280px' }}>
                <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={18} />
                <input
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 45px 0 45px',
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
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowStatusFilterMenu(!showStatusFilterMenu)}
                  style={{
                    height: '42px',
                    padding: '0 1.25rem',
                    border: t.borderBold,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: showStatusFilterMenu ? t.accentSoft : t.bgSecondary,
                    color: showStatusFilterMenu ? t.accent : t.textSecondary,
                    boxShadow: t.shadowSmall,
                    cursor: 'pointer',
                    borderRadius: t.radiusSmall,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Filter size={18} /> {statusFilter === 'all' ? 'Status' : statusFilter === 'ativo' ? 'Ativos' : statusFilter === 'inativo' ? 'Inativos' : statusFilter}
                </button>

                <AnimatePresence>
                  {showStatusFilterMenu && (
                    <>
                      <div
                        onClick={() => setShowStatusFilterMenu(false)}
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
                          position: 'absolute', top: '50px', right: 0, width: '200px',
                          backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                          zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          {[
                            { id: 'all', label: 'Todos Status' },
                            { id: 'ativo', label: 'Ativos' },
                            { id: 'inativo', label: 'Inativos' }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setStatusFilter(opt.id); setShowStatusFilterMenu(false); }}
                              style={{
                                padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: statusFilter === opt.id ? t.accentSoft : 'transparent',
                                color: statusFilter === opt.id ? t.accent : t.textMain,
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

              {/* Add Contact Button */}
              <button
                onClick={() => openModal('create')}
                style={{
                  backgroundColor: t.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  padding: '10px 24px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={20} /> Contato
              </button>
            </div>
          </>
        )}
      </header>

      {/* Mobile Actions Menu */}
      <AnimatePresence>
        {mobileActionsOpen && (
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setMobileActionsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                backgroundColor: t.bg,
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                boxShadow: '0 -10px 25px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Ações e Filtros</h3>
                <button onClick={() => setMobileActionsOpen(false)} style={{ background: 'none', border: 'none', color: t.textSecondary }}><X size={24} /></button>
              </div>

              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={18} />
                <input
                  style={{ width: '100%', height: '48px', padding: '0 12px 0 40px', borderRadius: t.radiusSmall, border: t.borderBold, backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '1rem' }}
                  placeholder="Buscar contato..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, border: t.borderBold, backgroundColor: t.bgSecondary, borderRadius: t.radiusSmall, padding: '0 1rem', height: '48px', display: 'flex', alignItems: 'center' }}>
                  <Filter size={18} color={t.textSecondary} style={{ marginRight: '8px' }} />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontWeight: 600, color: t.textMain }}
                  >
                    <option style={{ backgroundColor: t.bgSecondary, color: t.textMain }} value="all">Todos Status</option>
                    <option style={{ backgroundColor: t.bgSecondary, color: t.textMain }} value="ativo">Ativos</option>
                    <option style={{ backgroundColor: t.bgSecondary, color: t.textMain }} value="inativo">Inativos</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => { openModal('create'); setMobileActionsOpen(false); }}
                style={{
                  width: '100%', height: '54px', backgroundColor: t.accent, color: 'white',
                  border: 'none', borderRadius: t.radiusSmall, fontWeight: 600, fontSize: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                }}
              >
                <Plus size={20} /> Novo Contato
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="content">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-400" size={48} /></div>
        ) : contacts.length === 0 ? (
          <EmptyState title="Sua lista está vazia" description="Cadastre seus clientes para gerenciar vendas." icon={Users} color="#FFE600" />
        ) : paginatedContacts.length === 0 ? (
          <EmptyState title="Nenhum resultado" description="Sua busca ou filtro não retornou resultados." icon={Search} color={t.accent} />
        ) : (
          <div className="space-y-8">
            {viewSettings?.contacts === 'list' ? (
              <div style={{ backgroundColor: t.bg, border: t.borderBold, borderRadius: t.radiusMedium, overflowX: 'auto', boxShadow: t.shadowSmall }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Cliente</th>
                      {sidebarState === 'expanded' && (
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>CPF</th>
                      )}
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Contato</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Total Gasto</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Vendas (Qtd)</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Mês/Ano</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.map(c => {
                      const stats = getContactStats(c);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => openModal('view', c)}
                          style={{ borderBottom: t.border, cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600, color: t.textMain }}>{c.nome || 'Sem Nome'}</div>
                          </td>
                          {sidebarState === 'expanded' && (
                            <td style={{ padding: '1rem', color: t.textSecondary, fontWeight: 500 }}>{obfuscateCPF(c.cpf || '')}</td>
                          )}
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: t.textMain, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={14} /> {obfuscatePhone(c.telefone || '')}
                            </div>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', color: t.accent, fontWeight: 600 }}>
                            R$ {(stats.totalSpent / 100).toFixed(2).replace('.', ',')}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', color: t.textMain, fontWeight: 600 }}>
                            {stats.totalCount}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', color: t.textMain, fontWeight: 600 }}>
                            {stats.monthCount} / {stats.yearCount}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{
                              ...getStatusStyle(c.status),
                              padding: '4px 10px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              borderRadius: '100px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              {c.status || 'ativo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: isMobile ? '1rem' : '1.5rem'
              }}>
                <AnimatePresence mode="popLayout">
                  {paginatedContacts.map((c) => {
                    const stats = getContactStats(c);
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        layout
                        onClick={() => openModal('view', c)}
                        style={{
                          backgroundColor: t.bg,
                          border: t.borderBold,
                          boxShadow: t.shadowSmall,
                          padding: isMobile ? '1.25rem' : '1.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: isMobile ? '1rem' : '1.5rem',
                          position: 'relative',
                          transition: 'all 0.2s ease-in-out',
                          borderRadius: t.radiusMedium,
                          transform: `scale(${dpiScale})`,
                          transformOrigin: 'top center',
                          width: '100%'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = `scale(${dpiScale * 1.02})`;
                          e.currentTarget.style.boxShadow = t.shadow;
                          e.currentTarget.style.borderColor = t.accent;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = `scale(${dpiScale})`;
                          e.currentTarget.style.boxShadow = t.shadowSmall;
                          e.currentTarget.style.borderColor = t.borderBold;
                        }}
                      >
                        <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
                          <span style={{
                            ...getStatusStyle(c.status),
                            padding: '6px 12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            borderRadius: '100px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {c.status || 'ativo'}
                          </span>
                        </div>

                        <div className="flex items-center gap-5">
                          <div style={{ flex: 1, paddingRight: '3.5rem' }}>
                            <h3 style={{ fontWeight: 600, fontSize: '1.25rem', color: t.textMain, margin: 0, letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
                              {c.nome || 'Sem Nome'}
                            </h3>
                            {sidebarState === 'expanded' && (
                              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: t.textSecondary, margin: '4px 0 0 0' }}>
                                {obfuscateCPF(c.cpf || '') || 'CPF não informado'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', borderTop: t.border, paddingTop: '1.25rem' }}>
                          <div>
                            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Mês/Ano</p>
                            <p style={{ fontWeight: 600, color: t.textMain, fontSize: '1.1rem', margin: '0.25rem 0 0 0' }}>{stats.monthCount} / {stats.yearCount}</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Vendas (Qtd)</p>
                            <p style={{ fontWeight: 600, color: t.textMain, fontSize: '1.1rem', margin: '0.25rem 0 0 0' }}>{stats.totalCount}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Total Gasto</p>
                            <p style={{ fontWeight: 600, color: t.accent, fontSize: '1.1rem', margin: '0.25rem 0 0 0' }}>R$ {(stats.totalSpent / 100).toFixed(2).replace('.', ',')}</p>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                          backgroundColor: t.bgSecondary, border: t.border, padding: '0.85rem 1.25rem', marginTop: 'auto', borderRadius: t.radiusSmall
                        }}>
                          <div className="flex items-center gap-3">
                            <Phone size={18} color={t.textSecondary} />
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: t.textMain }}>
                              {c.telefone ? obfuscatePhone(c.telefone) : "Sem telefone"}
                            </span>
                          </div>
                          {c.telefone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank');
                              }}
                              style={{
                                width: '36px', height: '36px', border: 'none', backgroundColor: '#25d366', color: 'white',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px',
                                boxShadow: '0 4px 10px rgba(37,211,102,0.25)',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              <MessageCircle size={20} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            <div style={{ marginTop: '3rem' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalMode && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: isMobile ? '0' : '2rem'
          }}>
            <motion.div
              initial={{ scale: modalScale * 0.95, opacity: 0, y: 10 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.95, opacity: 0, y: 10 }}
              className="modal-content"
              style={{
                width: isMobile ? '100%' : '825px',
                maxWidth: '100%',
                height: isMobile ? '100%' : 'auto',
                maxHeight: isMobile ? '100%' : '95vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                backgroundColor: t.bg,
                border: isMobile ? 'none' : t.border,
                borderRadius: isMobile ? 0 : t.radius,
                boxShadow: t.shadowLarge
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: `1px solid var(--border)`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      {modalMode === 'create' ? 'Novo Cliente' : (isEditing ? 'Editar Cliente' : 'Detalhes do Cliente')}
                    </h3>
                  </div>
                </div>
                <motion.button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => { setModalMode(null); setIsEditing(false); }}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Form Content */}
              <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, backgroundColor: t.bg }}>
                <form id="contactForm" onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                    {/* Section 1: Dados Pessoais */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '14px', backgroundColor: t.accent, borderRadius: '2px' }} />
                        Dados Pessoais
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="field-label">Nome Completo *</label>
                          <input
                            required
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="Ex: JOÃO SILVA"
                            value={formData.nome}
                            onChange={e => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">CPF *</label>
                          <input
                            required
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="000.000.000-00"
                            value={isEditing ? formData.cpf : obfuscateCPF(formData.cpf || '')}
                            onChange={e => setFormData({ ...formData, cpf: maskCPF(e.target.value) })}
                            onBlur={handleCpfBlur}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Gênero</label>
                          <select
                            disabled={!isEditing}
                            className="field-input"
                            value={formData.genero || 'não informado'}
                            onChange={e => setFormData({ ...formData, genero: e.target.value })}
                          >
                            <option value="não informado">Não informado</option>
                            <option value="masculino">Masculino</option>
                            <option value="feminino">Feminino</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="field-label">Status</label>
                          <select
                            disabled={!isEditing}
                            className="field-input"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                            <option value="exclusao">Exclusão</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Comunicação */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '14px', backgroundColor: t.accent, borderRadius: '2px' }} />
                        Comunicação
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="field-label">Telefone</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="(00) 00000-0000"
                            value={isEditing ? formData.telefone : obfuscatePhone(formData.telefone || '')}
                            onChange={e => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                            onBlur={handlePhoneBlur}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">E-mail</label>
                          <input
                            disabled={!isEditing}
                            type="email"
                            className="field-input"
                            placeholder="exemplo@email.com"
                            value={isEditing ? formData.email : obfuscateEmail(formData.email || '')}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            onBlur={handleEmailBlur}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Data de Nascimento</label>
                          <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                            <input
                              disabled={!isEditing}
                              type="date"
                              className="field-input"
                              style={{ paddingLeft: '2.5rem' }}
                              value={formData.dataNascimento}
                              onChange={e => setFormData({ ...formData, dataNascimento: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Endereço Principal */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '14px', backgroundColor: t.accent, borderRadius: '2px' }} />
                        Endereço Principal
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div className="form-group">
                          <label className="field-label">CEP</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="00000-000"
                            value={isEditing ? formData.cep : obfuscateCEP(formData.cep || '')}
                            onChange={e => setFormData({ ...formData, cep: maskCEP(e.target.value) })}
                            onBlur={() => buscaCep(formData.cep)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Logradouro</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="Rua, Av, etc..."
                            value={formData.logradouro}
                            onChange={e => setFormData({ ...formData, logradouro: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Nº</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="123"
                            value={formData.numero}
                            onChange={e => setFormData({ ...formData, numero: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1.5fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="field-label">Bairro</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="Centro"
                            value={isEditing ? formData.bairro : obfuscateText(formData.bairro || '')}
                            onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Cidade/UF</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="São Paulo - SP"
                            value={isEditing ? formData.cidadeUf : obfuscateText(formData.cidadeUf || '')}
                            onChange={e => setFormData({ ...formData, cidadeUf: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Complemento</label>
                          <input
                            disabled={!isEditing}
                            className="field-input"
                            placeholder="Apto, Bloco, etc..."
                            value={isEditing ? formData.complemento : obfuscateText(formData.complemento || '')}
                            onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Logística e Origem */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '14px', backgroundColor: t.accent, borderRadius: '2px' }} />
                        Logística e Origem
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1.2fr', gap: '0.75rem', alignItems: 'end' }}>
                        <div className="form-group">
                          <label className="field-label">Fonte</label>
                          <select
                            disabled={!isEditing}
                            className="field-input"
                            value={formData.fonte}
                            onChange={e => setFormData({ ...formData, fonte: e.target.value })}
                          >
                            <option value="website">Website</option>
                            <option value="balcao">Balcão</option>
                            <option value="instagram">Instagram</option>
                            <option value="whatsapp">WhatsApp</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="field-label">Indicação</label>
                          <select
                            disabled={!isEditing}
                            className="field-input"
                            value={formData.indicacao}
                            onChange={e => setFormData({ ...formData, indicacao: e.target.value })}
                          >
                            <option value="">Direto (Sem Indicação)</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <button
                            type="button"
                            disabled={!isEditing}
                            onClick={() => setFormData(prev => ({ ...prev, entregaMesmoEndereco: !prev.entregaMesmoEndereco }))}
                            style={{
                              width: '100%',
                              height: '40px',
                              border: t.border,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0 0.875rem',
                              fontWeight: 600,
                              backgroundColor: formData.entregaMesmoEndereco ? t.accentSoft : (!isEditing ? t.bgSecondary : t.bg),
                              color: formData.entregaMesmoEndereco ? t.accent : t.textMain,
                              cursor: isEditing ? 'pointer' : 'default',
                              borderRadius: '12px',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                          >
                            <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', color: formData.entregaMesmoEndereco ? t.accent : t.textSecondary }}>ENTREGA IGUAL?</span>
                            <div style={{ width: '36px', height: '20px', backgroundColor: formData.entregaMesmoEndereco ? t.accent : '#cbd5e1', position: 'relative', borderRadius: '20px' }}>
                              <div style={{
                                width: '14px', height: '14px', backgroundColor: t.bg, position: 'absolute', top: '3px',
                                left: formData.entregaMesmoEndereco ? '19px' : '3px', transition: '0.2s', borderRadius: '50%'
                              }} />
                            </div>
                          </button>
                        </div>
                      </div>

                      {!formData.entregaMesmoEndereco && (
                        <div style={{ marginTop: '0.5rem', padding: '1rem', border: `1px dashed ${t.border}`, borderRadius: '8px' }}>
                          <h5 style={{ fontWeight: 700, marginBottom: '0.375rem', fontSize: '0.8rem', color: t.textMain, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Endereço de Entrega</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="form-group">
                              <label className="field-label">CEP</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="00000-000"
                                value={isEditing ? formData.entregaCep : obfuscateCEP(formData.entregaCep || '')}
                                onChange={e => setFormData({ ...formData, entregaCep: maskCEP(e.target.value) })}
                                onBlur={() => buscaCep(formData.entregaCep, 'entrega')}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Logradouro</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="Rua, Av, etc..."
                                value={formData.entregaLogradouro}
                                onChange={e => setFormData({ ...formData, entregaLogradouro: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Nº</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="123"
                                value={formData.entregaNumero}
                                onChange={e => setFormData({ ...formData, entregaNumero: e.target.value })}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1.5fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                              <label className="field-label">Bairro</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="Centro"
                                value={isEditing ? formData.entregaBairro : obfuscateText(formData.entregaBairro || '')}
                                onChange={e => setFormData({ ...formData, entregaBairro: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Cidade/UF</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="São Paulo - SP"
                                value={isEditing ? formData.entregaCidadeUf : obfuscateText(formData.entregaCidadeUf || '')}
                                onChange={e => setFormData({ ...formData, entregaCidadeUf: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Complemento</label>
                              <input
                                disabled={!isEditing}
                                className="field-input"
                                placeholder="Apto, Bloco, etc..."
                                value={isEditing ? formData.entregaComplemento : obfuscateText(formData.entregaComplemento || '')}
                                onChange={e => setFormData({ ...formData, entregaComplemento: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </form>

                {modalMode === 'view' && contactSales.length > 0 && (
                  <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em', color: t.textMain }}>
                      <Download size={18} /> Histórico de Compras
                    </h3>
                    <div style={{ border: t.border, boxShadow: t.shadowSmall, borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: t.bgSecondary, color: t.textSecondary, textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pedido</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contactSales.map(sale => (
                            <tr key={sale.id} style={{ borderBottom: t.border, fontWeight: 600, backgroundColor: t.bg }}>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: t.textMain }}>#{sale.id.slice(-6).toUpperCase()}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: t.textSecondary }}>{new Date(sale.createdAt || sale.data).toLocaleDateString()}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '4px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: sale.status === 'pago' ? '#f0fdf4' : sale.status === 'cancelado' ? '#fef2f2' : '#fefce8',
                                  color: sale.status === 'pago' ? '#10b981' : sale.status === 'cancelado' ? '#ef4444' : '#ca8a04'
                                }}>
                                  {sale.status || 'concluído'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: t.textMain }}>R$ {(Number(sale.total) / 100).toFixed(2).replace('.', ',')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1.25rem 1.5rem', borderTop: `1px solid var(--border)`, display: 'flex', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
                {modalMode === 'view' && !isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    style={{
                      height: '45px',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      backgroundColor: t.accent,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${t.accent}33`,
                      transition: 'all 0.2s'
                    }}
                  >
                    <Edit3 size={18} /> Editar Registro
                  </button>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: (modalMode === 'view' && isEditing) ? 'row' : 'column', gap: '0.75rem', alignItems: 'stretch' }}>
                    {modalMode === 'view' && isEditing && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Deseja realmente excluir permanentemente este cliente?')) {
                            await deleteDoc(getTenantDoc('contacts', selectedContact.id));
                            setModalMode(null);
                          }
                        }}
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
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                      >
                        <Trash2 size={16} /> Excluir Registro
                      </button>
                    )}

                    <button
                      form="contactForm"
                      type="submit"
                      disabled={saving}
                      style={{
                        height: '45px',
                        width: (modalMode === 'view' && isEditing) ? 'auto' : '100%',
                        flex: (modalMode === 'view' && isEditing) ? 1 : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        backgroundColor: '#22c55e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#16a34a'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(22, 197, 94, 0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22c55e'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)'; }}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      {modalMode === 'create' ? 'Criar Cliente' : 'Salvar Alterações'}
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

export default Contacts;
