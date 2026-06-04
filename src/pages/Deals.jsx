import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, firebaseConfig } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, getDoc, updateDoc, increment, getDocs, where } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  ShoppingCart, Search, History, Loader2, Trash2, Calendar, Printer,
  X, Receipt, Package, User2, CreditCard, Banknote, Smartphone, QrCode,
  Eye, ArrowLeft, ClipboardList, Layers, Camera, Zap, ArrowUpDown, Check,
  AlertCircle, TrendingUp, DollarSign, Plus, Share2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import POSFlow from '../components/POSFlow';
import ReceiptView from '../components/ReceiptView';
import { decryptSensitiveFields, decryptData, decryptLegacySale } from '../utils/crypto';
import { emitirNfce, cancelarNfce } from '../utils/focusNfce';
import { saveFiscalToStorage } from '../utils/fiscalStorage';
import { Html5Qrcode } from 'html5-qrcode';
import { maskCurrency } from '../utils/formatters';

const fmt = v => ((Number(v) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const simplifyPaymentPolicy = (policy) => {
  const norm = String(policy || '').toLowerCase().trim();
  if (norm.includes('entrega')) return 'Entrega';
  if (norm.includes('link')) return 'Link';
  return 'Imediato';
};

const getDisplayStatus = (status, type) => {
  const normStatus = String(status || '').toLowerCase().trim();
  const normType = String(type || '').toLowerCase().trim();

  if (normStatus.includes('cancel')) {
    return 'cancelada';
  } else if (normStatus.includes('pagamento') || normStatus === 'pendente' || normStatus.includes('aguardando')) {
    return 'pendente - pagamento';
  } else if (normStatus.includes('entrega')) {
    return 'pendente - entrega';
  } else if (normStatus === 'concluido' || normStatus === 'concluida' || normStatus === 'aprovada' || normStatus === 'concluída' || normStatus === 'aprovado' || normStatus === 'entregue') {
    if (normType === 'entrega' && normStatus !== 'concluida' && normStatus !== 'entregue') {
      return 'pendente - entrega';
    } else {
      return 'concluida';
    }
  } else {
    if (normType === 'entrega' && normStatus !== 'concluida' && normStatus !== 'entregue') {
      return 'pendente - entrega';
    } else {
      return 'concluida';
    }
  }
};

const PAY_METHODS = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'credito', label: 'Cartão de Crédito' },
  { id: 'debito', label: 'Cartão de Débito' },
  { id: 'pix', label: 'PIX' },
  { id: 'alimentacao', label: 'Vale Alimentação' },
  { id: 'refeicao', label: 'Vale Refeição' },
  { id: 'link_pagamento', label: 'Link de Pagamento' }
];

const getSaleSummary = (items) => {
  if (!items || !items.length) return 'Sem itens';
  const summary = items.map(i => `${i.quantity}x ${i.nome}`).join(', ');
  const display = summary.length > 80 ? summary.substring(0, 80) + '...' : summary;
  return display;
};

// ── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status, type }) => {
  const key = getDisplayStatus(status, type);

  const cfg = {
    'concluida': { label: 'Concluída', bg: 'rgba(16,185,129,0.1)', color: '#059669', border: 'rgba(16,185,129,0.25)' },
    'cancelada': { label: 'Cancelada', bg: 'rgba(239,68,68,0.1)', color: '#dc2626', border: 'rgba(239,68,68,0.25)' },
    'pendente - pagamento': { label: 'Pendente - Pagamento', bg: 'rgba(245,158,11,0.1)', color: '#d97706', border: 'rgba(245,158,11,0.25)' },
    'pendente - entrega': { label: 'Pendente - Entrega', bg: 'rgba(59,130,246,0.1)', color: '#2563eb', border: 'rgba(59,130,246,0.25)' }
  }[key] || { label: 'Concluída', bg: 'rgba(16,185,129,0.1)', color: '#059669', border: 'rgba(16,185,129,0.25)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

// ── Type Badge ──────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const normType = String(type || 'balcao').toLowerCase().trim();
  const cfg = {
    balcao: { label: 'Balcão', bg: 'rgba(99,102,241,0.1)', color: '#6366f1', border: 'rgba(99,102,241,0.25)' },
    retirada: { label: 'Retirada', bg: 'rgba(245,158,11,0.1)', color: '#d97706', border: 'rgba(245,158,11,0.25)' },
    entrega: { label: 'Entrega', bg: 'rgba(16,185,129,0.1)', color: '#059669', border: 'rgba(16,185,129,0.25)' }
  }[normType] || { label: type, bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.25)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

// ── Sale Detail Modal ───────────────────────────────────────────────────────
const SaleDetailModal = ({ sale: propSale, company, integrations, onClose, products = [] }) => {
  const { t, currentTheme, isMobile } = useTheme();
  const { getTenantDoc, activeCompany, user } = useUser();

  const formatProductName = (name) => {
    if (!name) return '';
    const limit = isMobile ? 22 : 42;
    if (name.length <= limit) return name;
    const truncated = name.substring(0, limit);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      return name.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  };
  const [saleState, setSaleState] = useState(propSale);
  const sale = saleState;
  const [view, setView] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState(sale.items || []);
  const [saving, setSaving] = useState(false);
  const printRef = useRef();

  // Payment capture states for finalization
  const [localPayments, setLocalPayments] = useState(propSale.payments || []);
  const [payMethod, setPayMethod] = useState('dinheiro');
  const [payValue, setPayValue] = useState('');
  const [payCode, setPayCode] = useState('');

  const [payNumeroAutorizacao, setPayNumeroAutorizacao] = useState('');
  const [payBandeira, setPayBandeira] = useState('99');
  const [payCredenciadora, setPayCredenciadora] = useState('');
  const [payCnpjCredenciadora, setPayCnpjCredenciadora] = useState('');
  const [creditInstallments, setCreditInstallments] = useState(1);

  const isCurrentPaymentIntegrated = (() => {
    const isCard = ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod);
    const isPix = payMethod === 'pix';
    if (isCard) {
      return integrations?.cartao && integrations?.cartao !== 'inativo';
    }
    if (isPix) {
      return integrations?.tipoPix === '17' && (
        (integrations?.pixNaTela && integrations?.pixNaTela !== 'inativo') ||
        (integrations?.pixNaMaquininha && integrations?.pixNaMaquininha !== 'inativo')
      );
    }
    const isLink = payMethod === 'link_pagamento';
    if (isLink) {
      return integrations?.linkDePagamento && integrations?.linkDePagamento !== 'inativo';
    }
    return false;
  })();

  const isEverythingInactive = (() => {
    const cartaoInactive = !integrations?.cartao || integrations?.cartao === 'inativo';
    const linkInactive = !integrations?.linkDePagamento || integrations?.linkDePagamento === 'inativo';
    const boletoInactive = !integrations?.boleto || integrations?.boleto === 'inativo';
    const pixDynamicInactive = integrations?.tipoPix !== '17' || (
      (!integrations?.pixNaTela || integrations?.pixNaTela === 'inativo') &&
      (!integrations?.pixNaMaquininha || integrations?.pixNaMaquininha === 'inativo')
    );
    return cartaoInactive && linkInactive && boletoInactive && pixDynamicInactive;
  })();

  useEffect(() => {
    setSaleState(propSale);
    setLocalPayments(propSale.payments || []);
  }, [propSale]);

  const [showShareMenu, setShowShareMenu] = useState(false);

  // States for cancellation with supervisor authorization
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationJustification, setCancellationJustification] = useState('');
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadSupervisors = async () => {
    setLoadingSupervisors(true);
    try {
      const targetComp = activeCompany || user?.empresa || 'development';
      const qCompanyUsers = query(collection(db, 'users'), where('empresa', '==', targetComp));
      const companyUsersSnap = await getDocs(qCompanyUsers);
      let list = companyUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (targetComp !== 'development') {
        const qDevUsers = query(collection(db, 'users'), where('empresa', '==', 'development'));
        const devUsersSnap = await getDocs(qDevUsers);
        const devList = devUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list = [...list, ...devList];
      }

      const uniqueSupervisors = [];
      const seenIds = new Set();

      for (const u of list) {
        if (seenIds.has(u.id)) continue;
        seenIds.add(u.id);

        const decryptedFuncao = decryptData(u.funcao);
        const roleLower = String(decryptedFuncao || '').toLowerCase().trim();

        if (['responsavel', 'admin', 'developer'].includes(roleLower)) {
          uniqueSupervisors.push({
            id: u.id,
            nome: u.nome || 'Usuário sem nome',
            email: decryptData(u.email),
            funcao: decryptedFuncao
          });
        }
      }

      setSupervisors(uniqueSupervisors);
      if (uniqueSupervisors.length > 0) {
        setSelectedSupervisorId(uniqueSupervisors[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar supervisores:", err);
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const handleOpenCancelModal = () => {
    if (sale.status === 'cancelada') return alert('Esta venda já está cancelada.');

    // Verificar se o prazo de 7 dias expirou
    const saleDateVal = sale.createdAt || sale.dataCriacao || sale.data || sale.finalizedAt || sale.dataFinalizacao;
    if (saleDateVal) {
      const saleDate = new Date(saleDateVal);
      const diffTime = new Date() - saleDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        alert('O cancelamento da nota só é possível em até 7 dias após a venda.');
        return;
      }
    } else {
      alert('Não foi possível verificar a data da venda. Cancelamento indisponível.');
      return;
    }

    setCancellationJustification('');
    setSupervisorPassword('');
    loadSupervisors();
    setShowCancelModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!cancellationJustification || cancellationJustification.length < 15) {
      alert('A justificativa deve ter pelo menos 15 caracteres.');
      return;
    }

    // Verificar novamente por segurança
    const saleDateVal = sale.createdAt || sale.dataCriacao || sale.data || sale.finalizedAt || sale.dataFinalizacao;
    if (saleDateVal) {
      const saleDate = new Date(saleDateVal);
      const diffTime = new Date() - saleDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        alert('O cancelamento da nota só é possível em até 7 dias após a venda.');
        return;
      }
    } else {
      alert('Não foi possível verificar a data da venda. Cancelamento indisponível.');
      return;
    }

    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);
    if (!supervisor) {
      alert('Por favor, selecione um supervisor autorizador.');
      return;
    }
    if (!supervisorPassword) {
      alert('Por favor, digite a senha do supervisor.');
      return;
    }
    setCancelling(true);
    try {
      const tempAppName = `temp-auth-app-${Date.now()}`;
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      try {
        await signInWithEmailAndPassword(tempAuth, supervisor.email, supervisorPassword);
      } catch (authErr) {
        console.error("Auth error verifying supervisor:", authErr);
        throw new Error('Senha incorreta ou credenciais inválidas para o supervisor.');
      } finally {
        await tempApp.delete();
      }

      if (sale.status === 'cancelada') throw new Error('Esta venda já está cancelada.');

      if (sale.nfce?.reference) {
        const result = await cancelarNfce(sale.nfce.reference, integrations, cancellationJustification);
        if (!result.success) throw new Error(result.error || 'Erro ao cancelar na SEFAZ');
        alert('Nota cancelada com sucesso na SEFAZ!');
      }

      await updateDoc(getTenantDoc('sales', sale.id), {
        status: 'cancelada',
        cancelledAt: new Date().toISOString(),
        cancellationReason: cancellationJustification,
        cancelledBy: supervisor.nome,
        cancelledByEmail: supervisor.email
      });

      for (const item of sale.items) {
        if (item.id) {
          try {
            const itemRef = getTenantDoc('inventory', item.id);
            const itemSnap = await getDoc(itemRef);
            if (itemSnap.exists()) {
              const currentStock = Number(itemSnap.data().estoque || 0);
              const newStock = currentStock + item.quantity;
              const updatePayload = { estoque: newStock };
              if (newStock <= 0) {
                updatePayload.estoqueZeradoAt = itemSnap.data().estoqueZeradoAt || new Date().toISOString();
              } else {
                updatePayload.estoqueZeradoAt = null;
              }
              await updateDoc(itemRef, updatePayload);
              console.log(`[Cancelamento] Estoque do produto ${item.nome} (${item.id}) restaurado de ${currentStock} para ${newStock}`);
            }
          } catch (err) {
            console.error(`[Cancelamento] Erro ao restaurar estoque do produto ${item.nome}:`, err);
          }
        }
      }

      alert('Venda cancelada e estoque reposto com sucesso!');
      setShowCancelModal(false);
      onClose();
    } catch (err) {
      alert('Erro no cancelamento: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 4, // Higher scale for crystal-clear text quality
        useCORS: true,
        backgroundColor: '#fdf6e2'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `comprovante_${sale.id.slice(-6).toUpperCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar imagem.');
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 4, // Higher scale for crystal-clear text quality
        useCORS: true,
        backgroundColor: '#fdf6e2'
      });
      const imgData = canvas.toDataURL('image/png');

      const mmWidth = 80;
      const mmHeight = (canvas.height * mmWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [mmWidth, mmHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
      pdf.save(`comprovante_${sale.id.slice(-6).toUpperCase()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF.');
    }
  };

  const getShareText = () => {
    const clientName = sale.client?.nome || sale.cliente || sale.clientName || 'Consumidor';
    const totalVal = fmt(sale.total);
    const companyName = company.nomeFantasia || company.nome || 'Empresa';
    const keyVal = sale.nfce?.chave ? sale.nfce.chave.replace(/^NFe/, '') : '';
    let text = `*Comprovante de Compra - ${companyName}*\n`;
    text += `Pedido: #${sale.id.slice(-6).toUpperCase()}\n`;
    text += `Cliente: ${clientName}\n`;
    text += `Valor Total: R$ ${totalVal}\n`;
    if (keyVal) {
      text += `Chave NFC-e: ${keyVal}\n`;
    }
    text += `Obrigado pela preferência!`;
    return encodeURIComponent(text);
  };

  const handleShareTo = async (platform) => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 4,
        useCORS: true,
        backgroundColor: '#fdf6e2'
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `comprovante_${sale.id.slice(-6).toUpperCase()}.png`, { type: 'image/png' });

      const orderId = sale.id.slice(-6).toUpperCase();
      const textMessage = `Segue a nota fiscal da compra no valor de R$ ${fmt(sale.total)} referente ao pedido #${orderId}.`;

      // Copy image to clipboard
      let copiedToClipboard = false;
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const item = new ClipboardItem({ [file.type]: blob });
          await navigator.clipboard.write([item]);
          copiedToClipboard = true;
        } catch (clipErr) {
          console.warn("Failed to copy image to clipboard:", clipErr);
        }
      }

      // If native sharing of files is supported (e.g. mobile devices), use it
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Cupom de Venda`,
            text: textMessage
          });
          return;
        } catch (shareErr) {
          console.warn("Native sharing cancelled or not supported, using redirection fallback:", shareErr);
        }
      }

      if (platform === 'whatsapp') {
        const text = encodeURIComponent(textMessage);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
        if (copiedToClipboard) {
          alert('WhatsApp aberto!\n\nA imagem do cupom foi copiada para sua área de transferência. Basta colar (Ctrl+V ou Pressione e Cole) na conversa para enviar junto com a mensagem.');
        } else {
          alert('WhatsApp aberto!\n\nPor favor, envie o texto e anexe o cupom baixado.');
        }
      } else if (platform === 'email') {
        const companyName = company.nomeFantasia || company.nome || 'Empresa';
        const subject = encodeURIComponent(`Nota Fiscal de Compra - ${companyName}`);
        const bodyText = encodeURIComponent(`${textMessage}\n\n[A imagem do cupom foi copiada para a sua área de transferência. Você pode colá-la (Ctrl+V) no corpo do e-mail.]`);
        window.open(`mailto:?subject=${subject}&body=${bodyText}`, '_blank');
        if (copiedToClipboard) {
          alert('E-mail aberto!\n\nA imagem do cupom foi copiada para sua área de transferência. Cole (Ctrl+V) no corpo do e-mail.');
        }
      } else if (platform === 'instagram') {
        if (copiedToClipboard) {
          alert('Instagram aberto!\n\nA imagem do cupom foi copiada para sua área de transferência. Você pode colá-la nos seus Stories ou Directs junto com o texto:\n\n"' + textMessage + '"');
        } else {
          alert('Para compartilhar no Instagram:\n1. Baixe o cupom como Imagem.\n2. Compartilhe no Instagram.');
        }
        window.open('https://www.instagram.com/', '_blank');
      }
    } catch (e) {
      console.error('Erro ao compartilhar:', e);
      alert('Erro ao processar compartilhamento.');
    }
  };

  const handleShareWhatsApp = () => handleShareTo('whatsapp');
  const handleShareEmail = () => handleShareTo('email');
  const handleShareInstagram = () => handleShareTo('instagram');

  const handlePrint = () => {
    const win = window.open('', '', 'width=450,height=800');
    win.document.write(`
      <html><head><title>Impressão</title>
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: white; font-family: 'Courier New', monospace; width: 80mm; }
          .receipt-container { width: 80mm !important; box-shadow: none !important; margin: 0 !important; }
        </style>
      </head>
      <body>${printRef.current.innerHTML}</body>
      <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
      </html>`);
    win.document.close();
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const newTotal = editedItems.reduce((a, i) => a + (i.price * i.quantity), 0) - (sale.discount || 0) - (sale.promoDiscount || 0) + (sale.shipping || 0);
      await updateDoc(getTenantDoc('sales', sale.id), { items: editedItems, total: Math.max(0, newTotal) });
      setIsEditing(false);
      alert('Venda atualizada!');
    } catch (e) { alert('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleMarkDelivered = async () => {
    if (!window.confirm(sale.type === 'entrega' ? 'Confirmar entrega do pedido?' : 'Confirmar retirada do pedido?')) return;
    setSaving(true);
    try {
      await updateDoc(getTenantDoc('sales', sale.id), {
        status: 'concluida',
        deliveredAt: new Date().toISOString()
      });
      setSaleState(prev => ({
        ...prev,
        status: 'concluida',
        deliveredAt: new Date().toISOString()
      }));
      alert(sale.type === 'entrega' ? 'Entrega confirmada com sucesso!' : 'Retirada confirmada com sucesso!');
    } catch (e) {
      alert('Erro ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizePayment = async (finalPayments) => {
    if (!window.confirm('Confirmar recebimento e finalizar venda?')) return;
    setSaving(true);
    try {
      const updatedSale = {
        ...sale,
        payments: finalPayments,
        status: 'concluido'
      };

      let nfceResult = null;
      if (integrations && company && (sale.emitirNota || integrations.emissaoNotaFiscal === 'ativo')) {
        console.log('Emitindo NFC-e para venda concluída...');
        nfceResult = await emitirNfce(updatedSale, company, integrations, sale.id);
        if (nfceResult && !nfceResult.success) {
          alert(`⚠️ FALHA NA EMISSÃO: ${nfceResult.error || 'Erro na SEFAZ'}\n\nA venda será finalizada sem nota fiscal.`);
        }
      }

      await updateDoc(getTenantDoc('sales', sale.id), {
        payments: finalPayments,
        status: 'concluido',
        nfce: nfceResult || sale.nfce || null,
        finalizedAt: new Date().toISOString()
      });

      const finalizedSale = {
        ...updatedSale,
        nfce: nfceResult || sale.nfce || null,
        finalizedAt: new Date().toISOString()
      };

      setSaleState(finalizedSale);
      alert(nfceResult?.success ? 'Venda finalizada e NFC-e emitida!' : 'Venda finalizada!');

      setView('receipt');
      setTimeout(() => {
        handlePrint();
      }, 500);

    } catch (e) {
      alert('Erro ao finalizar.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };


  if (!sale) return null;
  const isPending = sale.status === 'pendente';

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{ zIndex: 10000, padding: isMobile ? 0 : '1rem' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: view === 'receipt' ? '594px' : (sale.isLegacy ? 440 : 634),
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '85vh',
          backgroundColor: t.bg,
          border: isMobile ? 'none' : `1px solid ${t.border}`,
          borderRadius: isMobile ? 0 : t.radius,
          boxShadow: t.shadowLarge,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0,
          fontFamily: "var(--sans)",
          transition: 'max-width 0.25s ease-in-out'
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '1rem 1.25rem', borderBottom: `1px solid ${t.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: t.bgSecondary,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Receipt size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: t.textMain }}>
                {sale.isLegacy ? `VENDA LEGADA #${sale.id.toUpperCase()}` : `VENDA #${sale.id.slice(-6).toUpperCase()}`}
              </div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 500, marginTop: 1 }}>
                {sale.isLegacy ? (
                  <span>
                    Criada: {new Date(sale.createdAt).toLocaleString('pt-BR')} · Concluída: {new Date(sale.dataFinalizacao).toLocaleString('pt-BR')}
                  </span>
                ) : (
                  <span>
                    {new Date(sale.createdAt).toLocaleString('pt-BR')} · Op: {sale.operator}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <StatusBadge status={sale.status} type={sale.type} />
            <motion.button
              onClick={onClose}
              className="modal-close-btn"
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={16} />
            </motion.button>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AnimatePresence mode="wait">
            {view === 'details' ? (
              <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Timeline de Status */}
                {(() => {
                  const steps = [];
                  steps.push({ label: 'Criada', desc: 'Pedido criado', done: true, current: false });

                  const normStatus = String(sale.status || '').toLowerCase().trim();
                  const isCancelled = normStatus.includes('cancel');
                  const isPaid = !isCancelled && !normStatus.includes('pendente - pagamento') && !normStatus.includes('pendente') && !normStatus.includes('aguardando');
                  const isDelivered = normStatus === 'concluida' || normStatus === 'concluído' || normStatus === 'entregue';

                  steps.push({
                    label: 'Pagamento',
                    desc: isPaid ? 'Pago' : 'Pendente - Pagamento',
                    done: isPaid || isCancelled,
                    current: !isPaid && !isCancelled
                  });

                  if (sale.type === 'entrega') {
                    steps.push({
                      label: 'Entrega',
                      desc: isDelivered ? 'Entregue' : (isPaid ? 'Pendente - Entrega' : 'Aguardando Pagamento'),
                      done: isDelivered || isCancelled,
                      current: isPaid && !isDelivered && !isCancelled
                    });
                  } else if (sale.type === 'retirada') {
                    steps.push({
                      label: 'Retirada',
                      desc: isDelivered ? 'Retirado' : (isPaid ? 'Pendente - Retirada' : 'Aguardando Pagamento'),
                      done: isDelivered || isCancelled,
                      current: isPaid && !isDelivered && !isCancelled
                    });
                  }

                  steps.push({
                    label: isCancelled ? 'Cancelado' : 'Concluído',
                    desc: isCancelled ? 'Pedido cancelado' : (isDelivered || (sale.type === 'balcao' && isPaid) ? 'Finalizado' : 'Aguardando finalização'),
                    done: isCancelled || isDelivered || (sale.type === 'balcao' && isPaid),
                    current: !isCancelled && !isDelivered && (sale.type !== 'balcao' && isPaid)
                  });

                  const lastDoneIdx = steps.reduce((acc, step, idx) => step.done ? idx : acc, 0);
                  const N = steps.length;
                  const startPct = 100 / (2 * N);
                  const activeWidthPct = (lastDoneIdx * 100) / N;

                  return (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      backgroundColor: t.bgSecondary,
                      borderRadius: 12,
                      border: `1px solid ${t.border}`,
                      position: 'relative',
                      marginBottom: '0.25rem'
                    }}>
                      {steps.map((step, idx) => {
                        const isStepDone = step.done;
                        const isStepCurrent = step.current;
                        
                        let dotColor = '#94a3b8';
                        let textColor = t.textSecondary;
                        if (isCancelled && idx === steps.length - 1) {
                          dotColor = '#ef4444';
                          textColor = '#ef4444';
                        } else if (isStepDone) {
                          dotColor = '#10b981';
                          textColor = '#10b981';
                        } else if (isStepCurrent) {
                          dotColor = t.accent || '#2563eb';
                          textColor = t.accent || '#2563eb';
                        }

                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 2 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              backgroundColor: isStepCurrent ? '#fff' : dotColor,
                              border: `3px solid ${dotColor}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: '0.65rem', color: isStepCurrent ? dotColor : '#fff',
                              boxShadow: isStepCurrent ? `0 0 10px ${dotColor}40` : 'none',
                              transition: 'all 0.2s'
                            }}>
                              {isStepDone ? '✓' : idx + 1}
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: textColor, marginTop: 6, textAlign: 'center' }}>
                              {step.label}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: t.textSecondary, marginTop: 2, textAlign: 'center', fontWeight: 500 }}>
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Linha de progresso de fundo */}
                      <div style={{
                        position: 'absolute',
                        top: 22,
                        left: `${startPct}%`,
                        right: `${startPct}%`,
                        height: 3,
                        backgroundColor: t.border,
                        zIndex: 1
                      }} />
                      
                      {/* Linha de progresso ativa */}
                      <div style={{
                        position: 'absolute',
                        top: 22,
                        left: `${startPct}%`,
                        width: `${activeWidthPct}%`,
                        height: 3,
                        backgroundColor: isCancelled ? '#ef4444' : '#10b981',
                        zIndex: 1.5,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  );
                })()}

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: (isMobile || sale.isLegacy) ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div style={{ padding: '0.875rem 1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Cliente</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${t.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User2 size={18} color={t.accent} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.875rem' }}>{sale.client?.nome || 'Consumidor'}</div>
                        <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500 }}>{sale.client?.cpf ? `CPF: ${sale.client.cpf}` : 'Sem identificação'}</div>
                        {sale.indicacao && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 6px', borderRadius: 4,
                            backgroundColor: t.accentSoft || 'rgba(59,130,246,0.1)', color: t.accent,
                            fontSize: '0.7rem', fontWeight: 700, marginTop: 4
                          }}>
                            Indicação: {sale.indicacao}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {!sale.isLegacy && (
                    <div style={{ padding: '0.875rem 1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Pagamento</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${t.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={18} color={t.accent} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.875rem', marginBottom: 4 }}>
                            {simplifyPaymentPolicy(sale.paymentPolicy)}
                          </div>
                          {sale.payments && sale.payments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                              {sale.payments.map((p, idx) => (
                                <div key={p.id || idx} style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>• {p.method}</span>
                                  <span style={{ fontWeight: 700, color: t.textMain }}>R$ {fmt(p.value)}</span>
                                  {p.code && <span style={{ fontSize: '0.68rem', color: t.textSecondary }}>({p.code})</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 500, marginBottom: 6 }}>
                              Sem pagamentos registrados
                            </div>
                          )}
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: t.accent }}>R$ {fmt(sale.total)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Products */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Produtos</div>
                    {isPending && !isEditing && (
                      <button onClick={() => setIsEditing(true)} style={{ fontSize: '0.7rem', fontWeight: 700, color: t.accent, background: `${t.accent}15`, border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}>EDITAR</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(isEditing ? editedItems : sale.items)?.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', backgroundColor: t.bgSecondary, borderRadius: 10, border: `1px solid ${t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${t.accent}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={16} color={t.accent} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: t.textMain, fontSize: '0.85rem' }}>{formatProductName(item.nome)}</div>
                            <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500 }}>{item.quantity}x · R$ {fmt(item.price)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button onClick={() => setEditedItems(editedItems.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>−</button>
                              <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center', color: t.textMain, fontSize: '0.85rem' }}>{item.quantity}</span>
                              <button onClick={() => setEditedItems(editedItems.map((it, idx) => idx === i ? { ...it, quantity: it.quantity + 1 } : it))} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: t.accent, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.875rem' }}>R$ {fmt(item.price * item.quantity)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial summary */}
                <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  {[
                    { label: 'Subtotal', value: `R$ ${fmt(sale.items?.reduce((a, i) => a + (i.price * i.quantity), 0) || 0)}`, color: t.textMain },
                    sale.discount > 0 && { label: 'Desconto Manual', value: `− R$ ${fmt(sale.discount)}`, color: t.danger },
                    sale.promoDiscount > 0 && { label: 'Desconto Promo', value: `− R$ ${fmt(sale.promoDiscount)}`, color: t.success },
                  ].filter(Boolean).map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: t.textSecondary, fontWeight: 600, fontSize: '0.82rem' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color, fontSize: '0.82rem' }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: `1px solid ${t.border}`, marginTop: '0.375rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain }}>Total da Venda</span>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: t.accent }}>R$ {fmt(sale.total)}</span>
                  </div>
                </div>
              </motion.div>
            ) : view === 'finalize_payment' ? (
              <motion.div key="finalize_payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr', gap: '1rem' }}>

                  {/* Left Column: Recebimento & Formas Adicionadas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Resumo de valores */}
                    <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Resumo de Recebimento</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: t.textSecondary, marginTop: 2 }}>
                        <span>Total do Pedido:</span>
                        <span style={{ fontWeight: 700, color: t.textMain }}>R$ {fmt(sale.total)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: t.success }}>
                        <span>Total Informado:</span>
                        <span style={{ fontWeight: 700 }}>R$ {fmt(localPayments.reduce((acc, p) => acc + (p.value || 0), 0))}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, color: t.accent, borderTop: `1px dashed ${t.border}`, paddingTop: 6, marginTop: 4 }}>
                        <span>Falta Receber:</span>
                        <span>R$ {fmt(Math.max(0, (sale.total || 0) - localPayments.reduce((acc, p) => acc + (p.value || 0), 0)))}</span>
                      </div>
                    </div>

                    {/* Lista de pagamentos */}
                    <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>Formas Adicionadas</div>
                      {localPayments.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: t.textSecondary, backgroundColor: t.bg, borderRadius: 8, border: `1px dashed ${t.border}`, fontSize: '0.75rem', fontWeight: 600 }}>
                          Nenhum pagamento registrado.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {localPayments.map((p, idx) => (
                            <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: t.bg, borderRadius: 8, border: `1px solid ${t.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                <CreditCard size={13} style={{ color: t.accent, flexShrink: 0 }} />
                                <span style={{ fontWeight: 700, fontSize: '0.75rem', color: t.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.method}</span>
                                {p.code && <span style={{ fontSize: '0.65rem', color: t.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>({p.code})</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.78rem', color: t.textMain }}>R$ {fmt(p.value)}</span>
                                <button
                                  onClick={() => setLocalPayments(localPayments.filter(x => x.id !== p.id))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, display: 'flex', alignItems: 'center', padding: 2 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Adicionar pagamento */}
                  <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: 12, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Adicionar Forma</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 700, color: t.textSecondary }}>FORMA *</label>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ height: 34, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: '0.75rem', backgroundColor: t.bg, color: t.textMain, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {PAY_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: payMethod === 'credito' ? '1fr 1fr' : '1fr',
                      gap: '0.5rem',
                      marginTop: 2
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: t.textSecondary }}>VALOR *</label>
                        <input
                          value={payValue}
                          onChange={e => setPayValue(maskCurrency(e.target.value))}
                          placeholder="R$ 0,00"
                          style={{ height: 34, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: '0.75rem', backgroundColor: t.bg, color: t.textMain, outline: 'none', textAlign: 'right', fontFamily: 'inherit' }}
                        />
                      </div>

                      {payMethod === 'credito' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.6rem', fontWeight: 700, color: t.textSecondary }}>PARCELAS *</label>
                          <select
                            value={creditInstallments}
                            onChange={e => setCreditInstallments(parseInt(e.target.value) || 1)}
                            style={{ height: 34, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: '0.75rem', backgroundColor: t.bg, color: t.textMain, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                              <option key={n} value={n}>{n}x</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const cleanVal = parseInt((payValue || '').replace(/\D/g, '')) || 0;
                        if (cleanVal <= 0) return alert('Informe um valor de pagamento maior que zero.');

                        const isCard = ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod);
                        const remaining = (sale.total || 0) - localPayments.reduce((acc, p) => acc + (p.value || 0), 0);
                        const finalVal = Math.min(cleanVal, remaining);
                        if (cleanVal > remaining) {
                          alert(`O valor adicionado excede o restante a pagar. Capping feito automaticamente para R$ ${fmt(remaining)}.`);
                        }

                        const finalTipoIntegra = isCurrentPaymentIntegrated ? '1' : '2';
                        const methodObj = PAY_METHODS.find(m => m.id === payMethod);

                        setLocalPayments([...localPayments, {
                          id: Date.now(),
                          method: methodObj.label + (payMethod === 'credito' && creditInstallments > 1 ? ` (${creditInstallments}x)` : ''),
                          methodId: methodObj.id,
                          value: finalVal,
                          code: '',
                          tipo_integracao: finalTipoIntegra,
                          bandeira_operadora: null,
                          numero_autorizacao: null,
                          cnpj_credenciadora: null,
                          credenciadora: null
                        }]);

                        setPayValue('');
                        setPayCode('');
                        setPayNumeroAutorizacao('');
                        setPayBandeira('99');
                        setPayCredenciadora('');
                        setPayCnpjCredenciadora('');
                        setCreditInstallments(1);
                      }}
                      style={{
                        height: 36,
                        border: 'none',
                        borderRadius: 8,
                        backgroundColor: t.accent,
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        marginTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: `0 4px 12px ${t.accent}33`,
                        transition: 'all 0.18s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1.0'; }}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                </div>
              </motion.div>
            ) : (
              <motion.div key="receipt" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '96mm', border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                  <div ref={printRef}><ReceiptView sale={sale} company={company} /></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: t.bgSecondary, borderTop: `1px solid ${t.border}`, display: 'flex', gap: '0.5rem' }}>
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} style={{ flex: 1, height: 36, backgroundColor: t.bg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.bgSecondary; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.bg; }}>Cancelar</button>
              <button onClick={handleSaveChanges} disabled={saving} style={{ flex: 1, height: 36, backgroundColor: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', boxShadow: `0 4px 12px ${t.accent}33`, transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '1.0'; }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar Alterações
              </button>
            </>
          ) : view === 'details' ? (
            <>
              <button className="deal-modal-btn" onClick={() => setView('receipt')} style={{ flex: 1, height: 36, backgroundColor: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}><ClipboardList size={14} /> Ver Cupom</button>
              {isPending && (
                <button className="deal-modal-btn" onClick={() => setView('finalize_payment')} disabled={saving} style={{ flex: 1.5, height: 36, backgroundColor: t.success, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '1.0'; }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Finalizar Pagamento
                </button>
              )}
              {sale.status === 'concluido' && !sale.isLegacy && (sale.type === 'entrega' || sale.type === 'retirada') && (
                <button
                  className="deal-modal-btn"
                  onClick={handleMarkDelivered}
                  disabled={saving}
                  style={{
                    flex: 1.5,
                    height: 36,
                    backgroundColor: t.success,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.18s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1.0'; }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {sale.type === 'entrega' ? 'Confirmar Entrega' : 'Confirmar Retirada'}
                </button>
              )}
              {(sale.status === 'concluido' || sale.status === 'concluida') && !sale.isLegacy && (
                <button className="deal-modal-btn" onClick={handleOpenCancelModal} disabled={saving} style={{ flex: 1, height: 36, backgroundColor: t.danger, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Cancelar Nota
                </button>
              )}
            </>
          ) : view === 'finalize_payment' ? (
            <>
              <button className="deal-modal-btn" onClick={() => setView('details')} style={{ flex: 1, height: 36, backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}><ArrowLeft size={14} /> Voltar</button>
              {(() => {
                const isFinalizeDisabled = (sale.total || 0) > localPayments.reduce((acc, p) => acc + (p.value || 0), 0) || saving;
                return (
                  <button
                    className="deal-modal-btn"
                    onClick={() => handleFinalizePayment(localPayments)}
                    disabled={isFinalizeDisabled}
                    style={{
                      flex: 1.5,
                      height: 36,
                      backgroundColor: isFinalizeDisabled ? t.bg : t.success,
                      color: isFinalizeDisabled ? t.textSecondary : '#fff',
                      border: isFinalizeDisabled ? `1px solid ${t.border}` : 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: isFinalizeDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.18s'
                    }}
                    onMouseEnter={e => { if (!isFinalizeDisabled) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { if (!isFinalizeDisabled) e.currentTarget.style.opacity = '1.0'; }}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar e Concluir
                  </button>
                );
              })()}
            </>
          ) : (
            <>
              <button className="deal-modal-btn" onClick={() => setView('details')} style={{ width: 36, height: 36, backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}><ArrowLeft size={14} /></button>
              <button className="deal-modal-btn" onClick={handlePrint} style={{ flex: 1, height: 36, backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}><Printer size={14} /> Imprimir</button>
              <div style={{ position: 'relative', flex: 1.2 }}>
                <button className="deal-modal-btn" onClick={() => setShowShareMenu(v => !v)} style={{ width: '100%', height: 36, backgroundColor: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.65)'; }} onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}><Share2 size={14} /> Compartilhar</button>
                {showShareMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10049 }} onClick={() => setShowShareMenu(false)} />
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                      backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radiusMedium,
                      boxShadow: t.shadowLarge, zIndex: 10050, overflow: 'hidden', minWidth: 180,
                      display: 'flex', flexDirection: 'column'
                    }}>
                      <button onClick={() => { handleDownloadPDF(); setShowShareMenu(false); }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', backgroundColor: 'transparent', color: t.textMain, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Baixar PDF</button>
                      <button onClick={() => { handleDownloadPNG(); setShowShareMenu(false); }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', backgroundColor: 'transparent', color: t.textMain, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Baixar Imagem (PNG)</button>
                      <button onClick={() => { handleShareWhatsApp(); setShowShareMenu(false); }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', backgroundColor: 'transparent', color: t.textMain, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>WhatsApp</button>
                      <button onClick={() => { handleShareInstagram(); setShowShareMenu(false); }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', backgroundColor: 'transparent', color: t.textMain, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Instagram</button>
                      <button onClick={() => { handleShareEmail(); setShowShareMenu(false); }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', backgroundColor: 'transparent', color: t.textMain, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>E-mail</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Cancellation Modal with Supervisor Authorization */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10100,
              padding: '1rem'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: t.bg,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'inherit'
              }}
            >
              {/* Header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${t.border}`, backgroundColor: t.bgSecondary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={18} color={t.danger} />
                  <span style={{ fontWeight: 700, color: t.textMain, fontSize: '0.95rem' }}>Autorizar Cancelamento</span>
                </div>
                <button onClick={() => setShowCancelModal(false)} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo do Cancelamento *</label>
                  <textarea
                    value={cancellationJustification}
                    onChange={e => setCancellationJustification(e.target.value)}
                    placeholder="Informe a justificativa com no mínimo 15 caracteres..."
                    style={{
                      width: '100%',
                      height: 70,
                      padding: '8px 12px',
                      border: `1px solid ${t.border}`,
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      backgroundColor: t.bgSecondary,
                      color: t.textMain,
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: cancellationJustification.length >= 15 ? t.success : t.textSecondary }}>
                    <span>Mínimo 15 caracteres</span>
                    <span>{cancellationJustification.length} caracteres</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supervisor Autorizador *</label>
                  {loadingSupervisors ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: t.textSecondary }}>
                      <Loader2 size={14} className="animate-spin" /> Carregando supervisores...
                    </div>
                  ) : supervisors.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: t.danger, fontWeight: 600 }}>
                      Nenhum supervisor encontrado (proprietário, admin ou developer).
                    </div>
                  ) : (
                    <select
                      value={selectedSupervisorId}
                      onChange={e => setSelectedSupervisorId(e.target.value)}
                      style={{
                        height: 38,
                        padding: '0 8px',
                        border: `1px solid ${t.border}`,
                        borderRadius: 8,
                        fontSize: '0.8rem',
                        backgroundColor: t.bgSecondary,
                        color: t.textMain,
                        outline: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      {supervisors.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome} ({s.funcao}) · {s.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha do Supervisor *</label>
                  <input
                    type="password"
                    value={supervisorPassword}
                    onChange={e => setSupervisorPassword(e.target.value)}
                    placeholder="Digite a senha para autorizar"
                    style={{
                      height: 38,
                      padding: '0 12px',
                      border: `1px solid ${t.border}`,
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      backgroundColor: t.bgSecondary,
                      color: t.textMain,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '0.75rem 1.25rem', backgroundColor: t.bgSecondary, borderTop: `1px solid ${t.border}`, display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  style={{
                    padding: '0 16px',
                    height: 36,
                    backgroundColor: t.bg,
                    color: t.textSecondary,
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    transition: 'all 0.18s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.bgSecondary; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.bg; }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancellation}
                  disabled={cancelling || supervisors.length === 0}
                  style={{
                    padding: '0 16px',
                    height: 36,
                    backgroundColor: (cancelling || supervisors.length === 0) ? t.bg : t.danger,
                    color: (cancelling || supervisors.length === 0) ? t.textSecondary : '#fff',
                    border: (cancelling || supervisors.length === 0) ? `1px solid ${t.border}` : 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: (cancelling || supervisors.length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: (cancelling || supervisors.length === 0) ? 'none' : `0 4px 12px ${t.danger}33`,
                    transition: 'all 0.18s'
                  }}
                  onMouseEnter={e => { if (!cancelling && supervisors.length > 0) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { if (!cancelling && supervisors.length > 0) e.currentTarget.style.opacity = '1.0'; }}
                >
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar Cancelamento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Deals Component ───────────────────────────────────────────────────
const Deals = () => {
  const { t, viewSettings } = useTheme();
  const { getTenantCollection, getTenantDoc, activeCompany, user } = useUser();

  const [activeTab, setActiveTab] = useState('pdv');
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [company, setCompany] = useState({});
  const [legacySales, setLegacySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  // Screen resize tracking for dynamic header filters
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sort & pagination
  const [sortOption, setSortOption] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showItemsMenu, setShowItemsMenu] = useState(false);
  const sortMenuRef = useRef(null);
  const itemsMenuRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = e => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false);
      if (itemsMenuRef.current && !itemsMenuRef.current.contains(e.target)) setShowItemsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock scroll when modal open
  useEffect(() => {
    document.body.style.overflow = selectedSale ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedSale]);

  useEffect(() => {
    const u1 = onSnapshot(query(getTenantCollection('sales'), orderBy('createdAt', 'desc')), s => {
      const decryptedSales = s.docs.map(d => {
        const rawData = { id: d.id, ...d.data() };
        if (rawData.partnerName) {
          rawData.partnerName = decryptData(rawData.partnerName);
        }
        if (rawData.client && rawData.client.telefone) {
          rawData.client.telefone = decryptData(rawData.client.telefone);
        }
        return rawData;
      });
      setSales(decryptedSales);
      setLoading(false);
    });
    const u2 = onSnapshot(getTenantCollection('inventory'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(getTenantCollection('contacts'), s => {
      setClients(s.docs.map(d => decryptSensitiveFields({ id: d.id, ...d.data() })));
    });
    const targetComp = activeCompany || user?.empresa || 'development';
    getDoc(doc(db, 'business', targetComp)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCompany({
          ...data,
          ambiente: data.ambiente ? (decryptData(data.ambiente) || 'homologacao') : 'homologacao',
          status: data.status ? (decryptData(data.status) || 'ativa') : 'ativa'
        });
      }
    });
    getDoc(getTenantDoc('company', 'integrations')).then(snap => snap.exists() && setIntegrations(snap.data()));
    const u4 = onSnapshot(query(getTenantCollection('legacy'), orderBy('createdAt', 'desc')), s => {
      const decryptedLegacy = s.docs.map(d => {
        const raw = { id: d.id, ...d.data() };
        return decryptLegacySale(raw);
      });
      setLegacySales(decryptedLegacy);
    }, err => {
      console.error("Erro legacy onSnapshot:", err);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const handleDelete = async (e, sale) => {
    e.stopPropagation();
    if (window.confirm('Excluir registro de venda e repor os produtos no estoque?')) {
      try {
        await deleteDoc(getTenantDoc('sales', sale.id));
        for (const item of (sale.items || [])) {
          if (item.id) {
            try {
              const itemRef = getTenantDoc('inventory', item.id);
              const itemSnap = await getDoc(itemRef);
              if (itemSnap.exists()) {
                const currentStock = Number(itemSnap.data().estoque || 0);
                const newStock = currentStock + item.quantity;
                const updatePayload = { estoque: newStock };
                if (newStock <= 0) {
                  updatePayload.estoqueZeradoAt = itemSnap.data().estoqueZeradoAt || new Date().toISOString();
                } else {
                  updatePayload.estoqueZeradoAt = null;
                }
                await updateDoc(itemRef, updatePayload);
                console.log(`[Exclusão] Estoque do produto ${item.nome} (${item.id}) restaurado de ${currentStock} para ${newStock}`);
              }
            } catch (err) {
              console.error(`[Exclusão] Erro ao repor estoque do produto ${item.nome} na exclusão:`, err);
            }
          }
        }
        alert('Venda excluída e estoque reposto com sucesso!');
      } catch (err) {
        console.error("Erro ao excluir venda:", err);
        alert('Erro ao excluir registro.');
      }
    }
  };

  const handleScan = (code) => {
    const foundSale = sales.find(s => s.id.toUpperCase().startsWith(code.toUpperCase()));
    const foundLegacy = legacySales.find(s => String(s.id || '').toUpperCase().startsWith(code.toUpperCase()));
    if (foundSale) { setSelectedSale(foundSale); setShowScanner(false); return; }
    if (foundLegacy) { setSelectedSale({ ...foundLegacy, isLegacy: true }); setShowScanner(false); return; }
    alert('Venda não encontrada: ' + code);
  };

  const sortList = (list) => [...list].sort((a, b) => {
    const sA = getDisplayStatus(a.status, a.type);
    const sB = getDisplayStatus(b.status, b.type);
    if (sA === 'pendente - pagamento' && sB !== 'pendente - pagamento') return -1;
    if (sA !== 'pendente - pagamento' && sB === 'pendente - pagamento') return 1;
    const dA = new Date(a.finalizedAt || a.createdAt || a.data || 0).getTime();
    const dB = new Date(b.finalizedAt || b.createdAt || b.data || 0).getTime();
    return sortOption === 'oldest' ? dA - dB : dB - dA;
  });

  const filteredSales = useMemo(() => sortList(sales.filter(s => {
    const ms = s.id.toLowerCase().includes(search.toLowerCase()) || (s.client?.nome || '').toLowerCase().includes(search.toLowerCase());
    const md = !filterDate || new Date(s.createdAt).toLocaleDateString() === new Date(filterDate).toLocaleDateString();
    const mt = !filterStatus || getDisplayStatus(s.status, s.type) === filterStatus;
    const mType = !filterType || (s.type || 'balcao').toLowerCase() === filterType.toLowerCase();
    return ms && md && mt && mType;
  })), [sales, search, filterDate, filterStatus, filterType, sortOption]);

  const filteredLegacy = useMemo(() => sortList(legacySales.filter(s => {
    const ms = String(s.id || '').toLowerCase().includes(search.toLowerCase()) || (s.cliente || s.clientName || '').toLowerCase().includes(search.toLowerCase());
    const md = !filterDate || new Date(s.data || s.createdAt || 0).toLocaleDateString() === new Date(filterDate).toLocaleDateString();
    const mt = !filterStatus || getDisplayStatus(s.status, s.type) === filterStatus;
    const mType = !filterType || (s.type || 'balcao').toLowerCase() === filterType.toLowerCase();
    return ms && md && mt && mType;
  })), [legacySales, search, filterDate, filterStatus, filterType, sortOption]);

  useEffect(() => setCurrentPage(1), [search, filterDate, filterStatus, filterType, itemsPerPage, sortOption, activeTab]);

  const currentList = activeTab === 'history' ? filteredSales : filteredLegacy;
  const totalItems = currentList.length;
  const paginatedList = itemsPerPage === 'all' ? currentList : currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Summary stats
  const totalRevenue = sales.filter(s => {
    const ds = getDisplayStatus(s.status, s.type);
    return ds === 'concluida' || ds === 'pendente - entrega';
  }).reduce((a, s) => a + (s.total || 0), 0);
  const todaySales = sales.filter(s => new Date(s.createdAt).toLocaleDateString() === new Date().toLocaleDateString());
  const pendingCount = sales.filter(s => getDisplayStatus(s.status, s.type) === 'pendente - pagamento').length;

  // Sort options
  const sortOpts = [
    { id: 'newest', label: 'Mais Recente' },
    { id: 'oldest', label: 'Mais Antigo' },
  ];

  // Items per page options
  const itemsOpts = [10, 25, 50, 100, 'all'];

  const tabs = [
    { id: 'pdv', label: 'Caixa', icon: ShoppingCart },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'legacy', label: 'Legado', icon: Layers },
  ];

  return (
    <div className="inventory-page max-w-[1600px] mx-auto">

      {/* ══════════ HEADER ══════════ */}
      <header className="crm-header-dynamic" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'nowrap', marginBottom: '2rem', width: '100%' }}>
        {/* Left Side: Title and Tabs */}
        <div className="crm-header-left-dynamic" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
          {windowWidth >= 1200 && (
            <h1 className="crm-page-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Vendas</h1>
          )}
          <div style={{ display: 'flex', gap: 4, backgroundColor: t.bg, padding: 4, borderRadius: t.radiusSmall, border: t.border, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {tabs.map(tab => (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(''); setFilterDate(''); setFilterStatus(''); setFilterType(''); setCurrentPage(1); }}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: t.radiusSmall,
                  backgroundColor: activeTab === tab.id ? t.accentSoft : 'transparent',
                  color: activeTab === tab.id ? t.accent : t.textSecondary,
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}>
                <tab.icon size={16} />
                {windowWidth >= 650 && tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Filters, Search, Sort & Stats */}
        <div className="crm-header-right-dynamic" style={{ flexWrap: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', flexGrow: 1 }}>
          {activeTab !== 'pdv' && (
            <>
              {/* Search */}
              <div className="crm-search-wrapper" style={{ position: 'relative', minWidth: 160, maxWidth: 260, flex: 1 }}>
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={16} />
                <input
                  style={{
                    width: '100%', height: 40, paddingLeft: 38, paddingRight: 38,
                    backgroundColor: t.bgSecondary, border: t.borderBold,
                    borderRadius: t.radiusSmall, fontSize: '0.85rem', color: t.textMain,
                    outline: 'none', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                    boxShadow: t.shadowSmall
                  }}
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button onClick={() => setShowScanner(true)} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: t.textSecondary,
                  cursor: 'pointer', display: 'flex'
                }}>
                  <Camera size={16} />
                </button>
              </div>

              {/* Date picker */}
              {windowWidth >= 1300 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: t.bgSecondary, border: t.borderBold, padding: '0 0.75rem', height: 40, borderRadius: t.radiusSmall, boxShadow: t.shadowSmall }}>
                  <Calendar size={15} color={t.textSecondary} />
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontWeight: 600, fontSize: '0.85rem', backgroundColor: 'transparent', color: t.textMain, fontFamily: 'inherit' }} />
                </div>
              )}

              {/* Status filter */}
              {windowWidth >= 850 && (
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
                  height: 40, padding: '0 0.75rem', border: t.borderBold, borderRadius: t.radiusSmall,
                  fontWeight: 600, fontSize: '0.85rem', outline: 'none', backgroundColor: t.bgSecondary,
                  color: filterStatus ? t.textMain : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: t.shadowSmall
                }}>
                  <option value="">Status</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="pendente - pagamento">Pendente - Pagamento</option>
                  <option value="pendente - entrega">Pendente - Entrega</option>
                </select>
              )}

              {/* Type filter */}
              {windowWidth >= 1000 && (
                <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
                  height: 40, padding: '0 0.75rem', border: t.borderBold, borderRadius: t.radiusSmall,
                  fontWeight: 600, fontSize: '0.85rem', outline: 'none', backgroundColor: t.bgSecondary,
                  color: filterType ? t.textMain : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: t.shadowSmall
                }}>
                  <option value="">Tipo de Venda</option>
                  <option value="balcao">Balcão</option>
                  <option value="retirada">Retirada</option>
                  <option value="entrega">Entrega</option>
                </select>
              )}

              {/* Sort dropdown */}
              {windowWidth >= 1150 && (
                <div style={{ position: 'relative' }} ref={sortMenuRef}>
                  <button onClick={() => { setShowSortMenu(v => !v); setShowItemsMenu(false); }} style={{
                    height: 40, padding: '0 1rem', border: t.borderBold, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    backgroundColor: showSortMenu ? t.accentSoft : t.bgSecondary,
                    color: showSortMenu ? t.accent : t.textSecondary,
                    cursor: 'pointer', borderRadius: t.radiusSmall,
                    fontSize: '0.85rem', transition: 'all 0.2s', minWidth: 130, fontFamily: 'inherit',
                    boxShadow: t.shadowSmall
                  }}>
                    <ArrowUpDown size={15} />
                    {sortOpts.find(o => o.id === sortOption)?.label || 'Ordenação'}
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowSortMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          style={{
                            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                            backgroundColor: t.bg, border: t.border, borderRadius: t.radiusMedium,
                            boxShadow: t.shadowLarge, zIndex: 50, overflow: 'hidden', minWidth: 140
                          }}
                        >
                          {sortOpts.map(opt => (
                            <button key={opt.id} onClick={() => { setSortOption(opt.id); setShowSortMenu(false); }} style={{
                              width: '100%', padding: '8px 1rem', textAlign: 'left',
                              backgroundColor: sortOption === opt.id ? t.accentSoft : 'transparent',
                              color: sortOption === opt.id ? t.accent : t.textMain,
                              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit'
                            }}>
                              {sortOption === opt.id && <Check size={12} />}
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Items per page */}
              {windowWidth >= 1450 && (
                <div style={{ position: 'relative' }} ref={itemsMenuRef}>
                  <button onClick={() => { setShowItemsMenu(v => !v); setShowSortMenu(false); }} style={{
                    height: 40, padding: '0 1rem', border: t.borderBold,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    backgroundColor: showItemsMenu ? t.accentSoft : t.bgSecondary,
                    color: showItemsMenu ? t.accent : t.textSecondary,
                    cursor: 'pointer', borderRadius: t.radiusSmall,
                    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', fontFamily: 'inherit',
                    boxShadow: t.shadowSmall
                  }}>
                    Qtd: {itemsPerPage === 'all' ? 'Todos' : itemsPerPage}
                  </button>
                  <AnimatePresence>
                    {showItemsMenu && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowItemsMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          style={{
                            position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                            backgroundColor: t.bg, border: t.border, borderRadius: t.radiusMedium,
                            boxShadow: t.shadowLarge, zIndex: 50, overflow: 'hidden', minWidth: 100
                          }}
                        >
                          {itemsOpts.map(opt => (
                            <button key={opt} onClick={() => { setItemsPerPage(opt === 'all' ? 'all' : Number(opt)); setShowItemsMenu(false); }} style={{
                              width: '100%', padding: '8px 1rem', textAlign: 'left',
                              backgroundColor: itemsPerPage === (opt === 'all' ? 'all' : Number(opt)) ? t.accentSoft : 'transparent',
                              color: itemsPerPage === (opt === 'all' ? 'all' : Number(opt)) ? t.accent : t.textMain,
                              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit'
                            }}>
                              {itemsPerPage === (opt === 'all' ? 'all' : Number(opt)) && <Check size={12} />}
                              {opt === 'all' ? 'Todos' : opt}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* ══════════ CONTENT ══════════ */}
      <AnimatePresence mode="wait">
        {/* PDV */}
        {activeTab === 'pdv' && (
          <motion.div key="pdv" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <POSFlow products={products} clients={clients} onFinish={() => setActiveTab('history')} />
          </motion.div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, backgroundColor: t.bg, border: t.border, borderRadius: t.radius }}>
                <Loader2 className="animate-spin" size={40} color={t.accent} />
                <span style={{ marginTop: '1rem', fontWeight: 600, color: t.textSecondary, fontSize: '0.875rem' }}>Carregando histórico...</span>
              </div>
            ) : (
              <>
                {/* Stats Cards Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                  {/* Card 1: Vendas Hoje */}
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: t.radiusInner || '16px',
                    backgroundColor: t.bg,
                    border: t.border || '1px solid #e2e8f0',
                    boxShadow: t.shadowSmall,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <TrendingUp size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendas Hoje</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: t.textMain, marginTop: '2px' }}>{todaySales.length}</span>
                    </div>
                    <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  </div>

                  {/* Card 2: Pendentes */}
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: t.radiusInner || '16px',
                    backgroundColor: t.bg,
                    border: t.border || '1px solid #e2e8f0',
                    boxShadow: t.shadowSmall,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <AlertCircle size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendentes</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: t.textMain, marginTop: '2px' }}>{pendingCount}</span>
                    </div>
                    <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  </div>

                  {/* Card 3: Faturamento Concluído */}
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: t.radiusInner || '16px',
                    backgroundColor: t.bg,
                    border: t.border || '1px solid #e2e8f0',
                    boxShadow: t.shadowSmall,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <DollarSign size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faturamento Concluído</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>R$ {fmt(totalRevenue)}</span>
                    </div>
                    <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  </div>
                </div>

                {filteredSales.length === 0 ? (
                  <EmptyState
                    title="Nenhuma venda encontrada"
                    description={search || filterDate || filterStatus ? 'Ajuste os filtros para encontrar o que procura.' : 'As vendas realizadas no PDV aparecerão aqui.'}
                    icon={History} color={t.accent}
                  />
                ) : (viewSettings?.deals || 'list') === 'grid' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                      {paginatedList.map(sale => (
                        <motion.div
                          key={sale.id}
                          whileHover={{ y: -4, scale: 1.01, borderColor: t.accent || '#2563eb', boxShadow: t.shadowHover }}
                          onClick={() => setSelectedSale(sale)}
                          style={{
                            backgroundColor: t.bg,
                            border: t.border || '1px solid #e2e8f0',
                            borderRadius: t.radiusInner || '14px',
                            padding: '1.5rem',
                            boxShadow: t.shadowSmall,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          {/* Top Row: Sale ID & Status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.04em' }}>
                              #{sale.id.substring(0, 8).toUpperCase()}
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <TypeBadge type={sale.type} />
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <StatusBadge status={sale.status} type={sale.type} />
                                {(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data) && (
                                  <span style={{ fontSize: '0.65rem', color: t.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {new Date(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Main Section: Client Info & Products */}
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '50%',
                              backgroundColor: t.bgSecondary || '#f1f5f9',
                              color: t.accent || '#2563eb',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <User2 size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontWeight: 800, color: t.textMain, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {sale.client?.nome || 'Consumidor Final'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: t.textSecondary, marginTop: '2px' }}>
                                {new Date(sale.createdAt || sale.dataCriacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>

                          {/* Items Details */}
                          <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            backgroundColor: t.bgSecondary || '#f8fafc',
                            border: t.border || '1px solid #e2e8f0',
                            fontSize: '0.8rem',
                            color: t.textSecondary,
                            fontWeight: 500,
                            lineHeight: 1.4
                          }}>
                            {getSaleSummary(sale.items)}
                          </div>

                          {/* Indicação tag */}
                          {sale.indicacao && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: '20px',
                              backgroundColor: `${t.accent}0d` || 'rgba(59,130,246,0.05)',
                              color: t.accent || '#2563eb',
                              border: `1px solid ${t.accent}20` || '1px solid rgba(59,130,246,0.15)',
                              fontSize: '0.72rem', fontWeight: 800, width: 'fit-content'
                            }}>
                              <span>INDICAÇÃO: {sale.indicacao}</span>
                            </div>
                          )}

                          {/* Bottom row: Cobrar action & Total */}
                          <div style={{
                            marginTop: 'auto',
                            paddingTop: '1rem',
                            borderTop: t.border || '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Pagamento</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.textMain, marginTop: '2px' }}>
                                {simplifyPaymentPolicy(sale.paymentPolicy)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Valor Total</span>
                              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: t.accent || '#2563eb', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                R$ {fmt(Math.min(sale.total || 0, 999999))}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div style={{ padding: '1.25rem 1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner || '14px', boxShadow: t.shadowSmall }}>
                      <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} setCurrentPage={setCurrentPage} />
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner || '14px', overflow: 'hidden', boxShadow: t.shadowSmall }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
                          {['Data / Hora', 'Cliente', 'Tipo', 'Pagamento', 'Total', 'Status'].map((h, i) => (
                            <th key={h} style={{
                              padding: '1rem 1.25rem', textAlign: i === 4 ? 'right' : i === 5 ? 'center' : 'left',
                              fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary,
                              textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedList.map(sale => (
                          <tr
                            key={sale.id}
                            onClick={() => setSelectedSale(sale)}
                            style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.2s ease-in-out' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '1rem 1.25rem' }}>
                              <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9rem' }}>
                                {new Date(sale.createdAt || sale.dataCriacao).toLocaleDateString('pt-BR')}
                                <span style={{ fontWeight: 500, color: t.textSecondary, fontSize: '0.8rem', marginLeft: 6 }}>
                                  {new Date(sale.createdAt || sale.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, marginTop: 2 }}>
                                #{sale.id.substring(0, 8).toUpperCase()}
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1.25rem' }}>
                              <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9rem' }}>{sale.client?.nome || 'Consumidor final'}</div>
                              {sale.indicacao && (
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 6,
                                  backgroundColor: 'rgba(59,130,246,0.1)', color: '#2563eb',
                                  fontSize: '0.72rem', fontWeight: 700, marginTop: 4
                                }}>
                                  Indicação: {sale.indicacao}
                                </div>
                              )}
                              <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500, marginTop: 2 }}>{getSaleSummary(sale.items)}</div>
                            </td>
                            <td style={{ padding: '1rem 1.25rem' }}>
                              <TypeBadge type={sale.type} />
                            </td>
                            <td style={{ padding: '1rem 1.25rem' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: t.textSecondary }}>{simplifyPaymentPolicy(sale.paymentPolicy)}</div>
                            </td>
                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 800, color: t.textMain, fontSize: '1rem', whiteSpace: 'nowrap' }}>R$ {fmt(Math.min(sale.total || 0, 999999))}</div>
                            </td>
                            <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <StatusBadge status={sale.status} type={sale.type} />
                                {(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data) && (
                                  <span style={{ fontSize: '0.68rem', color: t.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {new Date(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Deletado o botão de exclusão da lista de vendas */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '1.25rem 1.5rem', borderTop: 'none', backgroundColor: t.bg }}>
                      <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} setCurrentPage={setCurrentPage} />
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}        {/* LEGACY */}
        {activeTab === 'legacy' && (
          <motion.div key="legacy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {/* Legacy banner */}
            <div style={{
              marginBottom: '1.25rem', padding: '0.875rem 1.25rem',
              backgroundColor: `${t.accent}0a`, border: t.accent ? `1px solid ${t.accent}20` : '1px solid #bfdbfe',
              borderRadius: t.radiusInner || '12px', display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <Layers size={18} color={t.accent} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: t.accent }}>
                Estas vendas foram importadas do sistema legado e são apenas para consulta.
              </span>
            </div>

            {legacySales.length === 0 ? (
              <EmptyState title="Nenhum histórico legado" description="Importe o JSON nas configurações." icon={Layers} color={t.accent} />
            ) : filteredLegacy.length === 0 ? (
              <EmptyState title="Nenhuma venda encontrada" description="Ajuste os filtros para encontrar o que procura." icon={Search} color={t.textSecondary} />
            ) : (viewSettings?.dealsLegacy || 'list') === 'grid' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {paginatedList.map(sale => (
                    <motion.div
                      key={sale.id}
                      whileHover={{ y: -4, scale: 1.01, borderColor: t.accent || '#2563eb', boxShadow: t.shadowHover }}
                      onClick={() => setSelectedSale({ ...sale, isLegacy: true })}
                      style={{
                        backgroundColor: t.bg,
                        border: t.border || '1px solid #e2e8f0',
                        borderRadius: t.radiusInner || '14px',
                        padding: '1.5rem',
                        boxShadow: t.shadowSmall,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {/* Top Row: Sale ID & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, letterSpacing: '0.04em' }}>
                          #{String(sale.id).substring(0, 8).toUpperCase()}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <StatusBadge status={sale.status || 'concluido'} type={sale.type} />
                          {(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data) && (
                            <span style={{ fontSize: '0.65rem', color: t.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {new Date(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Section: Client Info & Products */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          backgroundColor: t.bgSecondary || '#f1f5f9',
                          color: t.accent || '#2563eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <User2 size={20} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontWeight: 800, color: t.textMain, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sale.client?.nome || sale.cliente || sale.clientName || 'Consumidor Final'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: t.textSecondary, marginTop: '2px' }}>
                            {new Date(sale.createdAt || sale.dataCriacao || sale.data || 0).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>

                      {/* Items Details */}
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        backgroundColor: t.bgSecondary || '#f8fafc',
                        border: t.border || '1px solid #e2e8f0',
                        fontSize: '0.8rem',
                        color: t.textSecondary,
                        fontWeight: 500,
                        lineHeight: 1.4
                      }}>
                        {getSaleSummary(sale.items)}
                      </div>

                      {/* Indicação tag */}
                      {sale.indicacao && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: '20px',
                          backgroundColor: `${t.accent}0d` || 'rgba(59,130,246,0.05)',
                          color: t.accent || '#2563eb',
                          border: `1px solid ${t.accent}20` || '1px solid rgba(59,130,246,0.15)',
                          fontSize: '0.72rem', fontWeight: 800, width: 'fit-content'
                        }}>
                          <span>INDICAÇÃO: {sale.indicacao}</span>
                        </div>
                      )}

                      {/* Bottom row: Value only (Payment removed for Legacy) */}
                      <div style={{
                        marginTop: 'auto',
                        paddingTop: '1rem',
                        borderTop: t.border || '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Valor Total</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: t.accent || '#2563eb', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            R$ {fmt(Math.min(sale.total || 0, 999999))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div style={{ padding: '1.25rem 1.5rem', backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner || '14px', boxShadow: t.shadowSmall }}>
                  <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} setCurrentPage={setCurrentPage} />
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: t.bg, border: t.border || '1px solid #e2e8f0', borderRadius: t.radiusInner || '14px', overflow: 'hidden', boxShadow: t.shadowSmall }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
                      {['Data / Hora', 'Cliente', 'Total', 'Status'].map((h, i) => (
                        <th key={h} style={{
                          padding: '1rem 1.25rem', textAlign: i === 2 ? 'right' : i === 3 ? 'center' : 'left',
                          fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary,
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.map(sale => (
                      <tr
                        key={sale.id}
                        onClick={() => setSelectedSale({ ...sale, isLegacy: true })}
                        style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.2s ease-in-out' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9rem' }}>
                            {new Date(sale.dataCriacao || sale.createdAt || sale.data || 0).toLocaleDateString('pt-BR')}
                            <span style={{ fontWeight: 500, color: t.textSecondary, fontSize: '0.8rem', marginLeft: 6 }}>
                              {new Date(sale.dataCriacao || sale.createdAt || sale.data || 0).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, marginTop: 2 }}>
                            #{String(sale.id).substring(0, 8).toUpperCase()}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9rem' }}>{sale.client?.nome || sale.cliente || sale.clientName || 'Consumidor final'}</div>
                          {sale.indicacao && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6,
                              backgroundColor: 'rgba(59,130,246,0.1)', color: '#2563eb',
                              fontSize: '0.72rem', fontWeight: 700, marginTop: 4
                            }}>
                              Indicação: {sale.indicacao}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500, marginTop: 2 }}>{getSaleSummary(sale.items)}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 800, color: t.textMain, fontSize: '1rem', whiteSpace: 'nowrap' }}>R$ {fmt(Math.min(sale.total || 0, 999999))}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <StatusBadge status={sale.status || 'concluido'} type={sale.type} />
                            {(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data) && (
                              <span style={{ fontSize: '0.68rem', color: t.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {new Date(sale.updatedAt || sale.finalizedAt || sale.dataFinalizacao || sale.createdAt || sale.dataCriacao || sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '1.25rem 1.5rem', borderTop: 'none', backgroundColor: t.bg }}>
                  <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} setCurrentPage={setCurrentPage} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ SCANNER MODAL ══════════ */}
      <AnimatePresence>
        {showScanner && (
          <div className="modal-overlay" onClick={() => setShowScanner(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{ width: '100%', maxWidth: 450, backgroundColor: t.bg, border: `1px solid ${t.border}`, overflow: 'hidden', padding: 0 }}
            >
              <div style={{ padding: '1.125rem 1.5rem', borderBottom: `1px solid ${t.border}`, backgroundColor: t.bgSecondary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={17} color="#fff" />
                  </div>
                  <div>
                    <span className="modal-title" style={{ fontSize: '1rem' }}>Escanear Cupom</span>
                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Busca automática de vendas</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => setShowScanner(false)}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={17} />
                </motion.button>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div id="reader" style={{ width: '100%', borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.border}`, backgroundColor: '#000' }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════ SALE DETAIL MODAL ══════════ */}
      <AnimatePresence>
        {selectedSale && (
          <SaleDetailModal
            sale={selectedSale}
            company={company}
            integrations={integrations}
            products={products}
            onClose={() => setSelectedSale(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Deals;

