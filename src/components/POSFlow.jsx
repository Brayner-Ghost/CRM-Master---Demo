import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { ShoppingCart, User2, UserPlus, Phone, MapPin, CreditCard, Trash2, Search, X, Check, ArrowRight, ShoppingBag, Smartphone, Banknote, QrCode, Loader2, Package, Plus, Minus, Ticket, Receipt, Utensils, Hash, Percent, Tag, AlertCircle, Sparkles, Printer, Handshake, Copy, Link2 } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, onSnapshot, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { emitirNfce } from '../utils/focusNfce';
import { saveFiscalToStorage } from '../utils/fiscalStorage';
import ReceiptView from './ReceiptView';
import { encryptData, decryptSensitiveFields, decryptData } from '../utils/crypto';

const fmt = v => ((Number(v) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Clean Modern CRM Design System Integration
const getNeoStyles = (t) => ({
  card: (color = t.card) => ({
    backgroundColor: color,
    border: t.border,
    boxShadow: t.shadowSmall,
    borderRadius: t.radius,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'all 0.2s'
  }),
  button: (color = t.accent, small = false) => ({
    backgroundColor: color,
    border: color === t.bg ? t.border : 'none',
    boxShadow: color !== t.bg ? t.shadowSmall : 'none',
    borderRadius: t.radiusSmall,
    padding: small ? '0.5rem' : '0.8rem 1.5rem',
    fontWeight: 600,
    fontSize: small ? '0.75rem' : '0.9rem',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s',
    color: color === t.bg ? t.text : 'white'
  }),
  input: {
    width: '100%',
    padding: '0.8rem 1rem',
    border: t.border,
    borderRadius: t.radiusSmall,
    fontWeight: 600,
    fontSize: '0.9rem',
    outline: 'none',
    backgroundColor: t.inputBg || t.bg,
    color: t.text,
    transition: 'border 0.2s'
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: t.textSecondary,
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
    display: 'block'
  }
});

const TYPE_LABELS = {
  parceiro: 'Parceiro Padrão',
  indicacao: 'Indicação / Afiliado',
  estrategico: 'Estratégico / B2B',
  revenda: 'Revenda Autorizada'
};

// Helper for currency mask (raw cents to formatted string)
const maskCurrency = (val) => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '');
  const num = parseInt(clean || '0') / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

// Helper for parsing masked string to raw cents
const parseCurrency = (str) => {
  const clean = str.replace(/\D/g, '');
  return parseInt(clean || '0');
};

const formatDisplayCurrency = (v) => (Number(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const maskCpf = (cpf) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 11) return cpf;
  return `${clean.substring(0, 3)}.***.***-${clean.substring(9)}`;
};

const maskPhoneObfuscated = (phone) => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 3)}****-${clean.substring(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.substring(0, 2)}) ****-${clean.substring(6)}`;
  }
  if (clean.length > 4) {
    return `(${clean.substring(0, 2)}) ...-${clean.substring(clean.length - 4)}`;
  }
  return phone;
};

const maskCpfInput = (val) => {
  const clean = (val || '').replace(/\D/g, '').substring(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

const maskPhoneInput = (val) => {
  const clean = (val || '').replace(/\D/g, '').substring(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
};

const getClientMeta = (c) => {
  const parts = [];
  if (c.telefone) {
    parts.push(`Wpp: ${maskPhoneObfuscated(c.telefone)}`);
  }
  if (c.cpf) {
    parts.push(`CPF: ${maskCpf(c.cpf)}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'Cliente';
};

const validarCpf = (cpf) => {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
};

const removeEmptyOrZero = (obj) => {
  if (obj === null || obj === undefined) return undefined;
  if (obj === "") return undefined;
  if (obj === 0) return undefined;
  if (obj === "0") return undefined;

  // Handle arrays
  if (Array.isArray(obj)) {
    const cleanedArr = obj
      .map(item => (typeof item === 'object' ? removeEmptyOrZero(item) : item))
      .filter(item => item !== undefined && item !== null && item !== "" && item !== 0 && item !== "0");
    return cleanedArr.length > 0 ? cleanedArr : undefined;
  }

  // Handle objects
  if (typeof obj === 'object') {
    if (obj instanceof Date || (obj && typeof obj.toDate === 'function')) {
      return obj;
    }
    const newObj = {};
    let hasKeys = false;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = removeEmptyOrZero(obj[key]);
        if (val !== undefined) {
          newObj[key] = val;
          hasKeys = true;
        }
      }
    }
    return hasKeys ? newObj : undefined;
  }

  return obj;
};

const POSFlow = ({ products, clients = [], onFinish }) => {
  const { user, getTenantCollection, getTenantDoc, activeCompany } = useUser();
  const { t, currentTheme, isMobile } = useTheme();
  const neoStyles = getNeoStyles(t);
  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [saleType, setSaleType] = useState('balcao');
  const [client, setClient] = useState({ nome: '', cpf: '', addNfce: false });
  const [cart, setCart] = useState([]);
  const [payments, setPayments] = useState([]);
  const [creditInstallments, setCreditInstallments] = useState(1);
  const [payTipoIntegra, setPayTipoIntegra] = useState('2'); // '2' = Manual (POS)
  const [payBandeira, setPayBandeira] = useState('99'); // '99' = Outros
  const [payNumeroAutorizacao, setPayNumeroAutorizacao] = useState('');
  const [payCredenciadora, setPayCredenciadora] = useState('');
  const [payCnpjCredenciadora, setPayCnpjCredenciadora] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [manualDiscountDetail, setManualDiscountDetail] = useState(null); // { type: 'perc', value: 10 } or { type: 'rs' }
  const [shipping, setShipping] = useState(0);
  const [shippingInput, setShippingInput] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [finalChange, setFinalChange] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [paymentPolicy, setPaymentPolicy] = useState('pago_no_balcao');
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [searchPartner, setSearchPartner] = useState('');
  const [isIdentifyingManual, setIsIdentifyingManual] = useState(false);
  const [manualClientData, setManualClientData] = useState({ nome: '', telefone: '', cpf: '', endereco: '', numero: '', bairro: '', cep: '', cidade: '', uf: '' });
  const [integrations, setIntegrations] = useState(null);
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCpf, setQuickCpf] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickStatus, setQuickStatus] = useState(null); // null | 'found' | 'not_found'
  const [quickName, setQuickName] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [isExtensionActive, setIsExtensionActive] = useState(false);

  const productSearchRef = useRef(null);
  const clientSearchRef = useRef(null);
  const partnerSearchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target)) {
        setSearchProduct('');
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target)) {
        setSearchClient('');
      }
      if (partnerSearchRef.current && !partnerSearchRef.current.contains(event.target)) {
        setSearchPartner('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // PlugPag States
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [showClientValidationModal, setShowClientValidationModal] = useState(false);
  const [validationMissingFields, setValidationMissingFields] = useState([]);
  const [validationClientData, setValidationClientData] = useState({ nome: '', telefone: '', cpf: '', endereco: '', numero: '', bairro: '', cep: '', cidade: '', uf: '' });
  const [terminalState, setTerminalState] = useState('idle'); // 'idle' | 'sending' | 'waiting_card' | 'processing' | 'success' | 'error'
  const [terminalAmount, setTerminalAmount] = useState(0);
  const [terminalInstallments, setTerminalInstallments] = useState(1);
  const [terminalErrorMsg, setTerminalErrorMsg] = useState('');
  const [terminalCardBrand, setTerminalCardBrand] = useState('');
  const [terminalAuthCode, setTerminalAuthCode] = useState('');
  const [showPixChoiceModal, setShowPixChoiceModal] = useState(false);
  const [showScreenPixModal, setShowScreenPixModal] = useState(false);
  const [screenPixTimer, setScreenPixTimer] = useState(300);
  const [screenPixCopied, setScreenPixCopied] = useState(false);
  const [screenPixLoading, setScreenPixLoading] = useState(false);
  const [screenPixAmount, setScreenPixAmount] = useState(0);
  const [screenPixCode, setScreenPixCode] = useState('');
  const [screenPixImageUrl, setScreenPixImageUrl] = useState('');
  const [screenPixApiLoading, setScreenPixApiLoading] = useState(false);

  // InfinityPay States
  const [showInfinityPayModal, setShowInfinityPayModal] = useState(false);
  const [infinityPayApiLoading, setInfinityPayApiLoading] = useState(false);
  const [infinityPayAmount, setInfinityPayAmount] = useState(0);
  const [infinityPayUrl, setInfinityPayUrl] = useState('');
  const [infinityPayQrCodeUrl, setInfinityPayQrCodeUrl] = useState('');
  const [infinityPayTimer, setInfinityPayTimer] = useState(300);
  const [infinityPayPaid, setInfinityPayPaid] = useState(false);
  const [infinityPayOrderNsu, setInfinityPayOrderNsu] = useState('');
  const [infinityPaySlug, setInfinityPaySlug] = useState('');
  const [infinityPayCopied, setInfinityPayCopied] = useState(false);

  const policies = [
    { id: 'pagamento_na_entrega', label: 'Pagamento na Entrega', isPaid: false },
    { id: 'pago_na_entrega', label: 'Pago na Entrega', isPaid: true },
    { id: 'pagamento_no_balcao', label: 'Pagamento no Balcão', isPaid: false },
    { id: 'pago_no_balcao', label: 'Pago no Balcão', isPaid: true },
    { id: 'pagamento_via_link', label: 'Pagamento via Link', isPaid: false },
    { id: 'pago_via_link', label: 'Pago via Link', isPaid: true },
  ];

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (saleType !== 'balcao') {
      if (!paymentPolicy.startsWith('pagamento_')) {
        setPaymentPolicy('pagamento_no_balcao');
      }
      const p = policies.find(x => x.id === paymentPolicy);
      if (p) setClient(prev => ({ ...prev, addNfce: p.isPaid }));
    } else {
      // Para balcão, resetar CPF e addNfce, e definir a política padrão como pago_no_balcao
      setPaymentPolicy('pago_no_balcao');
      setClient(prev => ({ ...prev, cpf: '', addNfce: false }));
    }
  }, [paymentPolicy, saleType]);

  // Verificar se a extensão Chrome de impressão está ativa
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'crm:extension-ready') {
        console.log('[CRM-Print] Extensão identificada como ativa!');
        setIsExtensionActive(true);
      }
    };
    window.addEventListener('message', handleMessage);
    // Ping para verificar se a extensão já está carregada
    window.postMessage({ type: 'crm:ping-extension' }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Impressão silenciosa automática de recibo na finalização da venda
  useEffect(() => {
    if (isSuccess && lastSale && companyData && isExtensionActive) {
      const timer = setTimeout(() => {
        const receiptEl = document.getElementById('receipt-to-print');
        if (receiptEl) {
          console.log('[CRM-Print] Disparando impressão automática de recibo:', lastSale.id);
          window.dispatchEvent(new CustomEvent('crm:print-receipt', {
            detail: {
              saleId: lastSale.id,
              html: receiptEl.innerHTML
            }
          }));
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, lastSale, companyData, isExtensionActive]);

  // Helper to approve/confirm the screen PIX payment
  const handleApproveScreenPix = (manual = false) => {
    setShowScreenPixModal(false);

    const method = payMethods.find(m => m.id === 'pix');
    const simulatedCode = 'PX-' + Math.floor(100000000 + Math.random() * 900000000);
    const isProd = integrations?.plugpagAmbiente === 'producao';
    const methodSuffix = isProd ? '(Tela)' : `(Tela - ${manual ? 'Manual' : 'Aprovado'})`;

    setPayments(prev => {
      const exists = prev.some(p => p.id === activeRowId);
      if (exists) {
        return prev.map(p => p.id === activeRowId ? {
          ...p,
          method: `${method.label} ${methodSuffix}`,
          value: screenPixAmount,
          code: simulatedCode,
          tipo_integracao: '1',
          simulated: !isProd
        } : p);
      } else {
        return [...prev, {
          id: Date.now(),
          method: `${method.label} ${methodSuffix}`,
          methodId: 'pix',
          value: screenPixAmount,
          code: simulatedCode,
          tipo_integracao: '1',
          simulated: !isProd
        }];
      }
    });

    setPayValue('');
    setPayCode('');

    const targetTier = 'vista';
    const satisfiedCombos = activePromos.filter(promo => {
      if (promo.promoType !== 'combo' || !promo.comboRules || promo.comboRules.length === 0) return false;
      const res = evaluateComboPromotions(promo, cart, null);
      return res.applies;
    });

    if (satisfiedCombos.length > 0 && targetTier && adjustedPromoTier !== targetTier) {
      const actionName = 'à vista';
      const promptConfirm = window.confirm(
        `Deseja aplicar o preço promocional para pagamento ${actionName} no carrinho?\n\n` +
        `Clique em OK para aplicar o preço promocional de ${actionName}.\n` +
        `Clique em Cancelar para manter o preço promocional atual.`
      );
      if (promptConfirm) {
        setAdjustedPromoTier(targetTier);
      }
    }
  };

  // Helper to approve/confirm the InfinityPay payment
  const handleApproveInfinityPay = (manual = false, simulatedNsu = '') => {
    setShowInfinityPayModal(false);

    const method = payMethods.find(m => m.id === payMethod) || { label: 'InfinityPay', id: payMethod };
    const simulatedCode = simulatedNsu || 'IP-' + Math.floor(100000000 + Math.random() * 900000000);
    const isProd = integrations?.infinitypayAmbiente === 'producao';
    const methodSuffix = isProd ? '(Online)' : `(Online - ${manual ? 'Manual' : 'Aprovado'})`;

    setPayments(prev => {
      const exists = prev.some(p => p.id === activeRowId);
      if (exists) {
        return prev.map(p => p.id === activeRowId ? {
          ...p,
          method: `${method.label} ${methodSuffix}`,
          value: infinityPayAmount,
          code: simulatedCode,
          tipo_integracao: '1',
          simulated: !isProd
        } : p);
      } else {
        return [...prev, {
          id: Date.now(),
          method: `${method.label} ${methodSuffix}`,
          methodId: payMethod,
          value: infinityPayAmount,
          code: simulatedCode,
          tipo_integracao: '1',
          simulated: !isProd
        }];
      }
    });

    setPayValue('');
    setPayCode('');

    const targetTier = ['pix', 'dinheiro'].includes(payMethod) ? 'vista' : 'cartao';
    const satisfiedCombos = activePromos.filter(promo => {
      if (promo.promoType !== 'combo' || !promo.comboRules || promo.comboRules.length === 0) return false;
      const res = evaluateComboPromotions(promo, cart, null);
      return res.applies;
    });

    if (satisfiedCombos.length > 0 && targetTier && adjustedPromoTier !== targetTier) {
      const actionName = targetTier === 'vista' ? 'à vista' : 'no cartão';
      const promptConfirm = window.confirm(
        `Deseja aplicar o preço promocional para pagamento ${actionName} no carrinho?\n\n` +
        `Clique em OK para aplicar o preço promocional de ${actionName}.\n` +
        `Clique em Cancelar para manter o preço promocional atual.`
      );
      if (promptConfirm) {
        setAdjustedPromoTier(targetTier);
      }
    }
  };

  // Helper to create order/link via InfinityPay Public API (routed through secure backend proxy)
  const handleCreateInfinityPayOrder = async (val) => {
    setInfinityPayAmount(val);
    setInfinityPayTimer(300);
    setInfinityPayPaid(false);
    setInfinityPayUrl('');
    setInfinityPayQrCodeUrl('');
    setInfinityPayApiLoading(true);
    setShowInfinityPayModal(true);

    const generatedNsu = 'IP-' + Date.now();
    setInfinityPayOrderNsu(generatedNsu);

    try {
      let rawHandle = integrations?.infinitypayTag || 'rj_power';
      let cleanHandle = rawHandle.replace('@', '').trim();
      if (!cleanHandle) {
        cleanHandle = 'rj_power';
      }

      const rawPhone = client?.telefone ? client.telefone.replace(/\D/g, '') : '';
      // Ensure phone number has a minimum length for a valid Brazilian DDD + Phone (10 or 11 digits)
      const phone_number = rawPhone.length >= 10 ? `+55${rawPhone}` : undefined;

      const customer = {
        name: (client?.nome && client.nome.trim()) ? client.nome.trim() : 'Cliente PDV',
        email: 'vendas@crm.com'
      };
      if (phone_number) {
        customer.phone_number = phone_number;
      }

      const payload = {
        handle: cleanHandle,
        order_nsu: String(generatedNsu),
        redirect_url: window.location.origin,
        customer,
        items: [{
          quantity: 1,
          price: val, // price in cents
          description: "VENDA PDV #" + generatedNsu.slice(-6).toUpperCase()
        }]
      };

      const response = await fetch('http://localhost:5000/api/infinitypay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload,
          ambiente: integrations?.infinitypayAmbiente || 'homologacao'
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        console.error("InfinitePay Reject:", resData);
        alert(resData.message || 'Falha ao processar pagamento com a InfinitePay.');
        setShowInfinityPayModal(false);
        return;
      }

      const ipData = resData.data;
      const checkoutUrl = ipData.url || ipData.checkout_url || ipData.checkoutUrl || ipData?.data?.url;

      if (!checkoutUrl) {
        console.error("InfinitePay Reject (missing URL):", ipData);
        alert('Falha ao obter URL de checkout da InfinitePay.');
        setShowInfinityPayModal(false);
        return;
      }

      setInfinityPayUrl(checkoutUrl);

      // Extract slug from the end of the URL
      const urlParts = checkoutUrl.split('/');
      const slug = urlParts[urlParts.length - 1] || '';
      setInfinityPaySlug(slug);

      // Generate a QR Code Image
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`;
      setInfinityPayQrCodeUrl(qrUrl);

    } catch (err) {
      console.error('Erro ao gerar InfinityPay:', err);
      alert('Erro de comunicação para gerar link InfinityPay.');
      setShowInfinityPayModal(false);
    } finally {
      setInfinityPayApiLoading(false);
    }
  };

  // InfinityPay Polling Effect (routed through backend proxy to avoid browser CORS errors)
  useEffect(() => {
    let interval;
    if (showInfinityPayModal && infinityPaySlug && !infinityPayPaid && integrations?.infinitypayAtivo) {
      interval = setInterval(async () => {
        try {
          let rawHandle = integrations?.infinitypayTag || 'rj_power';
          const cleanHandle = rawHandle.replace('@', '').trim();

          const checkRes = await fetch('http://localhost:5000/api/infinitypay/payment-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              handle: cleanHandle,
              order_nsu: infinityPayOrderNsu,
              slug: infinityPaySlug,
              ambiente: integrations?.infinitypayAmbiente || 'homologacao'
            })
          });

          const statusData = await checkRes.json();
          if (statusData && (statusData.status === 'paid' || statusData.state === 'paid')) {
            setInfinityPayPaid(true);
            clearInterval(interval);
            setTimeout(() => {
              handleApproveInfinityPay(false, statusData.transaction_nsu || '');
            }, 1000);
          }
        } catch (e) {
          console.warn('Erro ao verificar pagamento InfinitePay:', e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showInfinityPayModal, infinityPaySlug, infinityPayPaid, integrations, infinityPayOrderNsu]);

  // InfinityPay Timer Effect
  useEffect(() => {
    let timer;
    if (showInfinityPayModal && infinityPayTimer > 0) {
      timer = setInterval(() => {
        setInfinityPayTimer(prev => prev - 1);
      }, 1000);
    } else if (infinityPayTimer === 0 && showInfinityPayModal) {
      setShowInfinityPayModal(false);
      alert('Tempo limite para o link InfinityPay expirou.');
    }
    return () => clearInterval(timer);
  }, [showInfinityPayModal, infinityPayTimer]);

  // InfinityPay Homologação Auto-Approval Effect
  useEffect(() => {
    let approvalTimeout;
    if (showInfinityPayModal && integrations?.infinitypayAmbiente === 'homologacao') {
      approvalTimeout = setTimeout(() => {
        setInfinityPayPaid(true);
        setTimeout(() => {
          handleApproveInfinityPay(false, 'IP-HOMOL-' + Math.floor(100000 + Math.random() * 900000));
        }, 1500);
      }, 8000);
    }
    return () => clearTimeout(approvalTimeout);
  }, [showInfinityPayModal, integrations?.infinitypayAmbiente, infinityPayAmount]);

  // Helper to create screen PIX order via PagBank API
  const handleCreateScreenPixOrder = async (val) => {
    setScreenPixAmount(val);
    setScreenPixTimer(300);
    setScreenPixCopied(false);
    setScreenPixCode('');
    setScreenPixImageUrl('');
    setScreenPixApiLoading(true);
    setScreenPixLoading(true); // Default to waiting state
    setShowScreenPixModal(true);

    try {
      const response = await fetch('http://localhost:5000/api/plugpag/create-pix-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: val,
          token: integrations?.plugpagToken || 'mock',
          ambiente: integrations?.plugpagAmbiente || 'homologacao',
          clientName: client?.nome || '',
          clientCpf: client?.cpf || ''
        })
      });

      const data = await response.json();
      if (data.success) {
        setScreenPixCode(data.qrCodeText);
        setScreenPixImageUrl(data.qrCodeImageUrl);
      } else {
        alert(data.message || 'Erro ao gerar QR Code do PIX real.');
        setShowScreenPixModal(false);
      }
    } catch (err) {
      console.error('Erro ao gerar PIX:', err);
      alert('Erro de comunicação com o servidor local para gerar o PIX.');
      setShowScreenPixModal(false);
    } finally {
      setScreenPixApiLoading(false);
    }
  };

  // PIX screen timer effect
  useEffect(() => {
    let timer;
    if (showScreenPixModal && screenPixTimer > 0) {
      timer = setInterval(() => {
        setScreenPixTimer(prev => prev - 1);
      }, 1000);
    } else if (screenPixTimer === 0 && showScreenPixModal) {
      setShowScreenPixModal(false);
      alert('Tempo limite para o QR Code do PIX expirou.');
    }
    return () => clearInterval(timer);
  }, [showScreenPixModal, screenPixTimer]);

  // PIX screen auto-approval effect
  useEffect(() => {
    let approvalTimeout;
    if (showScreenPixModal) {
      if (integrations?.plugpagAmbiente === 'producao') {
        setScreenPixLoading(true);
      } else {
        setScreenPixLoading(true);
        approvalTimeout = setTimeout(() => {
          setScreenPixLoading(false);
          handleApproveScreenPix(false);
        }, 6000); // Auto-approve after 6 seconds
      }
    }
    return () => clearTimeout(approvalTimeout);
  }, [showScreenPixModal, integrations?.plugpagAmbiente]);

  const isDesktop = window.innerWidth >= 1200;

  // Payment Entry State
  const [payMethod, setPayMethod] = useState('dinheiro');
  const [payValue, setPayValue] = useState('');
  const [payCode, setPayCode] = useState('');

  const [activePromos, setActivePromos] = useState([]);
  const [declinedPromos, setDeclinedPromos] = useState([]);
  const [adjustedPromoTier, setAdjustedPromoTier] = useState(null); // 'vista', 'cartao', or null

  // Fetch active promotions on mount
  // Fetch active promotions with real-time updates
  useEffect(() => {
    const q = query(getTenantCollection('inventory'), where('type', '==', 'promotion'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = new Date();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        const start = p.dataInicio ? new Date(p.dataInicio) : null;
        const end = p.dataFim ? new Date(p.dataFim) : null;
        // Also check if status is active if we have that field
        return (!start || start <= now) && (!end || end >= now);
      });
      console.log("Active Promos Loaded:", all.length);
      setActivePromos(all);
    });
    return () => unsubscribe();
  }, []);

  // Fetch partners
  useEffect(() => {
    const unsub = onSnapshot(getTenantCollection('partners'), (snap) => {
      setPartners(snap.docs.map(d => {
        const rawData = { id: d.id, ...d.data() };
        return decryptSensitiveFields(rawData, ['tipo', 'email', 'telefone']);
      }));
    });
    return () => unsub();
  }, []);

  // Fetch integrations
  useEffect(() => {
    const docRef = getTenantDoc('company', 'integrations');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setIntegrations(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  const parseCurrency = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove R$, spaces, thousands separator (.) and replace decimal separator (,) with (.)
    const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
    // Convert to cents to match the rest of the app's financial logic
    return Math.round(parseFloat(clean) * 100) || 0;
  };

  const totalOriginal = cart.reduce((acc, i) => acc + ((i.originalPrice || i.precoVenda) * i.quantity), 0);
  const totalPromocional = cart.reduce((acc, i) => acc + (i.precoVenda * i.quantity), 0);
  const totalPromosAplicadas = Math.max(0, totalOriginal - totalPromocional);

  const totalDescontos = totalPromosAplicadas + couponDiscount + manualDiscount;
  const grandTotal = Math.max(0, totalOriginal - totalDescontos + shipping);
  const totalPaid = payments.reduce((a, p) => a + p.value, 0);
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
  const remaining = Math.max(0, grandTotal - totalPaid);
  const change = Math.max(0, totalPaid - grandTotal);
  // --- REDESIGN CUSTOM STATES & EFFECTS ---
  const [showAddPaymentDropdown, setShowAddPaymentDropdown] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const [manualDiscountInput, setManualDiscountInput] = useState('');
  const [manualDiscountType, setManualDiscountType] = useState('rs');

  // Dynamic manual discount recalculation
  useEffect(() => {
    const val = parseCurrency(manualDiscountInput);
    if (val <= 0) {
      setManualDiscount(0);
      setManualDiscountDetail(null);
      return;
    }
    if (manualDiscountType === 'rs') {
      setManualDiscount(val);
      setManualDiscountDetail({ type: 'rs' });
    } else {
      const perc = val / 10000;
      const calcDisc = Math.floor(totalPromocional * perc);
      setManualDiscount(calcDisc);
      setManualDiscountDetail({ type: 'perc', value: val / 100 });
    }
  }, [manualDiscountInput, manualDiscountType, totalPromocional]);

  // Shipping auto-reset when sale type is not entrega
  useEffect(() => {
    if (saleType !== 'entrega') {
      setShipping(0);
      setShippingInput('');
    }
  }, [saleType]);

  // Helper to add a new split payment row pre-filled with remaining balance
  const handleAddPaymentRow = (methodId) => {
    const method = payMethods.find(m => m.id === methodId);
    if (!method) return;
    const currentPaid = payments.reduce((acc, p) => acc + (p.value || 0), 0);
    const remainingValue = Math.max(0, grandTotal - currentPaid);

    setPayments(prev => [...prev, {
      id: Date.now() + Math.random(),
      methodId: method.id,
      method: method.label,
      value: remainingValue,
      installments: 1,
      code: '',
      tipo_integracao: '2',
      bandeira_operadora: null,
      cnpj_credenciadora: '',
      credenciadora: '',
      simulated: false
    }]);
  };


  // Recalcular desconto do cupom com base na forma de pagamento
  useEffect(() => {
    if (!appliedCoupon) {
      setCouponDiscount(0);
      return;
    }

    const c = appliedCoupon;
    const restricoes = c.restricoesPagamento || {};
    const methodsInSale = payments.map(p => p.methodId);

    // Verificar valor mínimo
    if (c.valorMinimo && (totalPromocional / 100) < c.valorMinimo) {
      setCouponDiscount(0);
      return;
    }

    // Procurar se algum método do pagamento tem uma restrição específica
    let valorParaCalculo = c.valor; // Default base

    // Se houver pagamentos, verificamos se algum deles tem uma regra específica no cupom
    if (payments.length > 0) {
      const match = methodsInSale.find(m => restricoes[m]);
      if (match) {
        valorParaCalculo = restricoes[match].valor;
      } else if (Object.keys(restricoes).length > 0) {
        // Se existem restrições mas nenhuma bateu, o valor base pode ser 0 ou o valor base original
        // No pedido anterior "senão valor será y", interpretamos que o valor base original é o fallback
        // Mas se o usuário quiser 0 para outros, ele não deve ter valor base original alto.
        valorParaCalculo = c.valor;
      }
    }

    let calcDisc = 0;
    if (c.tipo === 'porcentagem') {
      calcDisc = Math.floor(totalPromocional * (valorParaCalculo / 100));
    } else {
      calcDisc = valorParaCalculo * 100;
    }

    setCouponDiscount(calcDisc);
  }, [payments, appliedCoupon, totalPromocional]);

  // Recalcular carrinho ao mudar o tier promocional ativo
  useEffect(() => {
    setCart(prev => applyPromosToCart(prev));
  }, [adjustedPromoTier]);

  // Reversão automática ou sincronização do tier quando pagamentos mudarem
  useEffect(() => {
    if (payments.length === 0) {
      setAdjustedPromoTier(null);
      return;
    }

    if (adjustedPromoTier === 'vista') {
      const hasVista = payments.some(p => p.methodId === 'pix' || p.methodId === 'dinheiro');
      if (!hasVista) {
        const hasCard = payments.some(p => ['credito', 'debito', 'alimentacao', 'refeicao'].includes(p.methodId));
        setAdjustedPromoTier(hasCard ? 'cartao' : null);
      }
    } else if (adjustedPromoTier === 'cartao') {
      const hasCard = payments.some(p => ['credito', 'debito', 'alimentacao', 'refeicao'].includes(p.methodId));
      if (!hasCard) {
        const hasVista = payments.some(p => p.methodId === 'pix' || p.methodId === 'dinheiro');
        setAdjustedPromoTier(hasVista ? 'vista' : null);
      }
    }
  }, [payments]);

  const getAndGroups = (rules) => {
    if (!rules || rules.length === 0) return [];
    const groups = [];
    let currentGroup = [rules[0]];
    for (let i = 0; i < rules.length - 1; i++) {
      const operator = rules[i].operator;
      if (operator === 'E') {
        currentGroup.push(rules[i + 1]);
      } else {
        groups.push(currentGroup);
        currentGroup = [rules[i + 1]];
      }
    }
    groups.push(currentGroup);
    return groups;
  };

  const findMatchForGroup = (group, pool, startIndex = 0, assigned = []) => {
    if (startIndex === group.length) {
      return assigned;
    }
    const rule = group[startIndex];
    for (let idx = 0; idx < pool.length; idx++) {
      const unit = pool[idx];
      if (assigned.includes(unit)) continue;

      let matches = false;
      if (rule.type === 'product') {
        matches = (unit.id === rule.value);
      } else if (rule.type === 'category') {
        matches = Array.isArray(unit.categoria) && unit.categoria.includes(rule.value);
      }

      if (matches) {
        const result = findMatchForGroup(group, pool, startIndex + 1, [...assigned, unit]);
        if (result) return result;
      }
    }
    return null;
  };

  const evaluateComboPromotions = (promo, cartToCheck, tier) => {
    const rules = promo.comboRules;
    if (!rules || rules.length === 0) return { applies: false, triggerUnits: [], totalPromoPrice: 0, originalPriceSum: 0 };

    let pool = [];
    cartToCheck.filter(item => !item.isGift).forEach(item => {
      const originalPrice = item.originalPrice || item.precoVenda;
      for (let q = 0; q < item.quantity; q++) {
        pool.push({
          id: item.id,
          categoria: item.categoria,
          originalPrice: originalPrice,
          cartItem: item,
          unitId: `${item.id}_${q}_${Math.random()}`
        });
      }
    });

    let activeCards = [];
    const isNewStructure = rules && rules.some(r => r.isCardGroup !== undefined || Array.isArray(r.products));

    if (isNewStructure) {
      activeCards = rules.filter(card => card.products && card.products.length > 0);
    } else {
      // Legacy flat rules: Map them to active cards
      const orRules = rules.filter(r => r.group === 'or');
      const andRules = rules.filter(r => r.group !== 'or');

      andRules.forEach((rule, idx) => {
        activeCards.push({
          id: `legacy_and_${idx}`,
          requiredQty: 1,
          products: [rule.value]
        });
      });

      if (orRules.length > 0) {
        activeCards.push({
          id: `legacy_or`,
          requiredQty: 1,
          products: orRules.map(r => r.value)
        });
      }
    }

    if (activeCards.length === 0) {
      return { applies: false, triggerUnits: [], totalPromoPrice: 0, originalPriceSum: 0, matchCount: 0 };
    }

    const matchedComboUnits = [];
    let matchCount = 0;

    while (true) {
      let tempMatched = [];
      let poolCopy = [...pool];
      let satisfiedAllCards = true;

      for (const card of activeCards) {
        let matchedForThisCard = 0;
        const neededQty = Number(card.requiredQty || 1);

        for (let q = 0; q < neededQty; q++) {
          const idx = poolCopy.findIndex(unit => card.products.includes(unit.id));
          if (idx > -1) {
            tempMatched.push(poolCopy[idx]);
            poolCopy.splice(idx, 1); // remove from temp pool
            matchedForThisCard++;
          } else {
            break;
          }
        }

        if (matchedForThisCard < neededQty) {
          satisfiedAllCards = false;
          break;
        }
      }

      if (!satisfiedAllCards) {
        break; // can't satisfy all active cards anymore
      }

      matchCount++;
      matchedComboUnits.push(...tempMatched);
      pool = poolCopy; // commit used units
    }

    const applies = matchCount > 0;
    if (!applies) {
      return { applies: false, triggerUnits: [], totalPromoPrice: 0, originalPriceSum: 0, matchCount: 0 };
    }

    let singlePromoPrice = parseCurrency(promo.precoPromocional || '0');
    if ((tier === 'vista' || tier === null) && promo.precoPromocionalVista) {
      singlePromoPrice = typeof promo.precoPromocionalVista === 'string'
        ? parseCurrency(promo.precoPromocionalVista)
        : promo.precoPromocionalVista;
    } else if (tier === 'cartao' && promo.precoPromocionalCartao) {
      singlePromoPrice = typeof promo.precoPromocionalCartao === 'string'
        ? parseCurrency(promo.precoPromocionalCartao)
        : promo.precoPromocionalCartao;
    }

    const totalPromoPrice = singlePromoPrice * matchCount;
    const originalPriceSum = matchedComboUnits.reduce((acc, u) => acc + u.originalPrice, 0);

    return {
      applies: true,
      triggerUnits: matchedComboUnits,
      totalPromoPrice,
      originalPriceSum,
      matchCount
    };
  };

  const applyPromosToCart = (currentCart, declinedList = declinedPromos, tier = adjustedPromoTier) => {
    let updatedCart = [...currentCart];
    const nonGiftSubtotal = updatedCart.filter(i => !i.isGift).reduce((acc, i) => acc + ((i.originalPrice || i.precoVenda) * i.quantity), 0);

    // Reset prices to original and store originalPrice for display
    updatedCart = updatedCart.map(item => {
      if (item.isGift) return item;
      const original = products.find(p => p.id === item.id);
      const basePrice = original ? original.precoVenda : item.precoVenda;
      return {
        ...item,
        precoVenda: basePrice,
        originalPrice: basePrice
      };
    });

    activePromos.forEach(promo => {
      // 1. Check Date Validity
      const now = new Date();
      if (promo.dataInicio && new Date(promo.dataInicio) > now) return;
      if (promo.dataFim && new Date(promo.dataFim) < now) return;
      if (declinedList.includes(promo.id)) {
        updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id));
        return;
      }

      const selection = promo.produtosSelecionados || [];
      const catSelection = promo.categoriasSelecionadas || [];

      if (promo.promoType !== 'combo' && selection.length === 0 && catSelection.length === 0 && promo.promoType !== 'brinde') return;

      const isItemInPromo = (item) => {
        if (selection.includes(item.id)) return true;
        if (catSelection.length > 0 && Array.isArray(item.categoria)) {
          return item.categoria.some(c => catSelection.includes(c));
        }
        return false;
      };

      // 2. Check Stock (if limited)
      if (promo.limitadoEstoque) {
        const hasOut = selection.some(pid => {
          const p = products.find(x => x.id === pid);
          return !p || p.estoque <= 0;
        });
        if (hasOut) return;
      }

      const trigger = Number(promo.qtdGatilho) || 1;
      const matchingItems = updatedCart.filter(i => !i.isGift && isItemInPromo(i));
      const totalInSelection = matchingItems.reduce((acc, i) => acc + i.quantity, 0);

      console.log(`Checking Promo: ${promo.nome}`, { type: promo.promoType, trigger, totalInSelection });

      // Special handling for Gifts (Brindes)
      if (promo.promoType === 'brinde') {
        const minSpend = parseCurrency(promo.gastoMinimo || '0,00');
        const spendTrigger = minSpend > 0 && nonGiftSubtotal >= minSpend;
        const qtyTrigger = totalInSelection >= trigger && trigger > 0;

        const giftCount = (spendTrigger || qtyTrigger) ? 1 : 0;
        console.log(`Brinde Logic: giftCount=${giftCount}, brindeId=${promo.brindeId}`, { spendTrigger, qtyTrigger });

        if (giftCount > 0) {
          if (promo.brindesSelecionados && promo.brindesSelecionados.length > 0) {
            const activeGiftIds = promo.brindesSelecionados.map(b => b.productId);
            updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id && !activeGiftIds.includes(i.id)));

            promo.brindesSelecionados.forEach(giftItem => {
              const giftProduct = products.find(p => p.id === giftItem.productId);
              if (giftProduct) {
                const count = giftItem.quantity || 1;
                const giftPrice = parseCurrency(promo.precoPromocional);
                const giftIndex = updatedCart.findIndex(i => i.id === giftItem.productId && i.isGift && i.promoRef === promo.id);
                if (giftIndex > -1) {
                  updatedCart[giftIndex].quantity = count;
                  updatedCart[giftIndex].precoVenda = giftPrice;
                } else {
                  updatedCart.push({
                    ...giftProduct,
                    id: giftProduct.id,
                    quantity: count,
                    precoVenda: giftPrice,
                    originalPrice: giftProduct.precoVenda,
                    isGift: true,
                    promoRef: promo.id
                  });
                }
              }
            });
          } else if (promo.brindeId) {
            const giftProduct = products.find(p => p.id === promo.brindeId);
            if (giftProduct) {
              const giftIndex = updatedCart.findIndex(i => i.id === promo.brindeId && i.isGift && i.promoRef === promo.id);
              const giftPrice = parseCurrency(promo.precoPromocional);
              if (giftIndex > -1) {
                updatedCart[giftIndex].quantity = giftCount;
                updatedCart[giftIndex].precoVenda = giftPrice;
              } else {
                updatedCart.push({
                  ...giftProduct,
                  id: giftProduct.id,
                  quantity: giftCount,
                  precoVenda: giftPrice,
                  originalPrice: giftProduct.precoVenda,
                  isGift: true,
                  promoRef: promo.id
                });
              }
            }
          }
        } else {
          updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id));
        }
      } else {
        if (promo.promoType === 'combo' && promo.comboRules && promo.comboRules.length > 0) {
          const res = evaluateComboPromotions(promo, updatedCart, tier);
          if (res.applies) {
            // 1. Apply pricing discounts (if configured)
            let hasPricingDiscount = false;
            let singlePromoPrice = parseCurrency(promo.precoPromocional || '0');
            if ((tier === 'vista' || tier === null) && promo.precoPromocionalVista) {
              singlePromoPrice = typeof promo.precoPromocionalVista === 'string'
                ? parseCurrency(promo.precoPromocionalVista)
                : promo.precoPromocionalVista;
            } else if (tier === 'cartao' && promo.precoPromocionalCartao) {
              singlePromoPrice = typeof promo.precoPromocionalCartao === 'string'
                ? parseCurrency(promo.precoPromocionalCartao)
                : promo.precoPromocionalCartao;
            }
            if (singlePromoPrice > 0) {
              hasPricingDiscount = true;
            }

            if (hasPricingDiscount && res.originalPriceSum > 0) {
              const discountFactor = res.totalPromoPrice / res.originalPriceSum;
              updatedCart = updatedCart.map(item => {
                if (item.isGift) return item;

                const matchedUnitsForThisItem = res.triggerUnits.filter(u => u.id === item.id);
                const triggerQty = matchedUnitsForThisItem.length;
                if (triggerQty === 0) return item;

                const q = item.quantity;
                const originalPrice = item.originalPrice || item.precoVenda;

                const avgPrice = ((triggerQty * (originalPrice * discountFactor)) + ((q - triggerQty) * originalPrice)) / q;

                if (avgPrice < item.precoVenda) {
                  return {
                    ...item,
                    precoVenda: avgPrice
                  };
                }
                return item;
              });
            }

            // 2. Apply free gift (if configured)
            if (promo.brindesSelecionados && promo.brindesSelecionados.length > 0) {
              const activeGiftIds = promo.brindesSelecionados.map(b => b.productId);
              updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id && !activeGiftIds.includes(i.id)));

              promo.brindesSelecionados.forEach(giftItem => {
                const giftProduct = products.find(p => p.id === giftItem.productId);
                if (giftProduct) {
                  const giftCount = (giftItem.quantity || 1) * (res.matchCount || 1);
                  const giftIndex = updatedCart.findIndex(i => i.id === giftItem.productId && i.isGift && i.promoRef === promo.id);
                  const giftPrice = 0; // free gift (0 cents)

                  if (giftIndex > -1) {
                    updatedCart[giftIndex].quantity = giftCount;
                    updatedCart[giftIndex].precoVenda = giftPrice;
                  } else {
                    updatedCart.push({
                      ...giftProduct,
                      id: giftProduct.id,
                      quantity: giftCount,
                      precoVenda: giftPrice,
                      originalPrice: giftProduct.precoVenda,
                      isGift: true,
                      promoRef: promo.id
                    });
                  }
                }
              });
            } else if (promo.brindeId) {
              const giftProduct = products.find(p => p.id === promo.brindeId);
              if (giftProduct) {
                const giftCount = res.matchCount || 1;
                const giftIndex = updatedCart.findIndex(i => i.id === promo.brindeId && i.isGift && i.promoRef === promo.id);
                const giftPrice = 0; // free gift (0 cents)

                if (giftIndex > -1) {
                  updatedCart[giftIndex].quantity = giftCount;
                  updatedCart[giftIndex].precoVenda = giftPrice;
                } else {
                  updatedCart.push({
                    ...giftProduct,
                    id: giftProduct.id,
                    quantity: giftCount,
                    precoVenda: giftPrice,
                    originalPrice: giftProduct.precoVenda,
                    isGift: true,
                    promoRef: promo.id
                  });
                }
              }
            } else {
              updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id));
            }
          } else {
            // Clean up gift if combo does not apply
            updatedCart = updatedCart.filter(i => !(i.isGift && i.promoRef === promo.id));
          }
        } else {
          const applies = totalInSelection >= (promo.promoType === 'simples' ? 1 : trigger);

          if (applies) {
            let promoPrice = parseCurrency(promo.precoPromocional);
            if ((tier === 'vista' || tier === null) && promo.precoPromocionalVista) {
              promoPrice = parseCurrency(promo.precoPromocionalVista);
            } else if (tier === 'cartao' && promo.precoPromocionalCartao) {
              promoPrice = parseCurrency(promo.precoPromocionalCartao);
            }

            updatedCart = updatedCart.map(item => {
              if (item.isGift || !isItemInPromo(item)) return item;

              let newItem = { ...item };
              const originalPrice = newItem.originalPrice || newItem.precoVenda;

              if (promo.promoType === 'simples') {
                let specificPrice = promo.precosPromocionais?.[item.id];
                if ((tier === 'vista' || tier === null) && promo.precosPromocionaisVista?.[item.id] !== undefined && promo.precosPromocionaisVista?.[item.id] !== null) {
                  specificPrice = promo.precosPromocionaisVista[item.id];
                } else if (tier === 'cartao' && promo.precosPromocionaisCartao?.[item.id] !== undefined && promo.precosPromocionaisCartao?.[item.id] !== null) {
                  specificPrice = promo.precosPromocionaisCartao[item.id];
                }

                let itemPromoPrice = 0;
                if (specificPrice !== undefined && specificPrice !== null) {
                  itemPromoPrice = typeof specificPrice === 'number' ? specificPrice : parseCurrency(specificPrice);
                } else {
                  itemPromoPrice = promoPrice;
                }

                if (itemPromoPrice > 0 && itemPromoPrice < newItem.precoVenda) {
                  newItem.precoVenda = itemPromoPrice;
                }
              } else if (promo.promoType === 'combo') {
                const q = newItem.quantity;
                const inCombo = Math.floor(q / trigger) * trigger;
                const outCombo = q % trigger;
                const avgPrice = ((inCombo * promoPrice) + (outCombo * originalPrice)) / q;

                if (avgPrice < newItem.precoVenda) {
                  newItem.precoVenda = avgPrice;
                }
              }
              return newItem;
            });
          }
        }
      }
    });

    return updatedCart;
  };

  const addToCart = p => {
    const ex = cart.find(i => i.id === p.id && !i.isGift);
    const currentQty = ex ? ex.quantity : 0;
    if (currentQty >= p.estoque) {
      alert(`Estoque insuficiente! Apenas ${p.estoque} unidades disponíveis.`);
      return;
    }

    let newCart;
    if (ex) newCart = cart.map(i => (i.id === p.id && !i.isGift) ? { ...i, quantity: i.quantity + 1 } : i);
    else newCart = [...cart, { ...p, quantity: 1 }];

    setCart(applyPromosToCart(newCart));
  };

  const updateQty = (id, d, isGift = false, promoRef = null) => {
    if (isGift && d < 0) {
      const newList = [...declinedPromos];
      if (promoRef && !newList.includes(promoRef)) newList.push(promoRef);
      setDeclinedPromos(newList);
      setCart(prev => {
        const filtered = prev.filter(i => !(i.id === id && i.isGift && i.promoRef === promoRef));
        return applyPromosToCart(filtered, newList);
      });
      return;
    }
    if (isGift) return;
    let newCart = cart.map(i => {
      if (i.id === id && !i.isGift) {
        const next = i.quantity + d;
        if (next > i.estoque && d > 0) {
          alert(`Limite de estoque atingido (${i.estoque} un.)`);
          return i;
        }
        return { ...i, quantity: next };
      }
      return i;
    }).filter(i => i.quantity > 0);
    setCart(applyPromosToCart(newCart));
  };

  const removeFromCart = (id, isGift = false, promoRef = null) => {
    if (isGift) {
      const newList = [...declinedPromos];
      if (promoRef && !newList.includes(promoRef)) newList.push(promoRef);
      setDeclinedPromos(newList);
      setCart(prev => {
        const filtered = prev.filter(i => !(i.id === id && i.isGift && (promoRef ? i.promoRef === promoRef : true)));
        return applyPromosToCart(filtered, newList);
      });
      return;
    }
    const newCart = cart.filter(i => !(i.id === id && !i.isGift));
    setCart(applyPromosToCart(newCart));
  };

  const handleProductSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchProduct) {
      const firstMatch = products.find(p =>
        (p.nome?.toLowerCase().includes(searchProduct.toLowerCase()) || p.sku?.includes(searchProduct)) &&
        Number(p.estoque || 0) >= 1
      );
      if (firstMatch) {
        addToCart(firstMatch);
        setSearchProduct('');
      }
    }
  };

  const payMethods = [
    { id: 'dinheiro', label: 'Dinheiro', Icon: Banknote, needCode: false, color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
    { id: 'credito', label: 'Crédito', Icon: CreditCard, needCode: true, color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
    { id: 'debito', label: 'Débito', Icon: Smartphone, needCode: true, color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
    { id: 'pix', label: 'PIX', Icon: QrCode, needCode: true, color: '#06b6d4', bg: 'rgba(6,182,212,0.10)' },
    { id: 'link_pagamento', label: 'Link/Online', Icon: Link2, needCode: true, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    { id: 'alimentacao', label: 'Alimentação', Icon: Utensils, needCode: true, color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
    { id: 'refeicao', label: 'Refeição', Icon: Utensils, needCode: true, color: '#ec4899', bg: 'rgba(236,72,153,0.10)' },
    { id: 'desconto_rs', label: 'Desc. R$', Icon: Banknote, needCode: false, color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
    { id: 'desconto_perc', label: 'Desc. %', Icon: Percent, needCode: false, color: '#dc2626', bg: 'rgba(220,38,38,0.10)' }
  ];

  const handleAddPayment = () => {
    if (!payValue) return;
    const val = parseCurrency(payValue);
    if (val <= 0) return;

    if (payMethod === 'desconto_rs') {
      setManualDiscount(val);
      setManualDiscountDetail({ type: 'rs' });
      setPayValue('');
      return;
    }

    if (payMethod === 'desconto_perc') {
      const perc = val / 10000;
      const calcDisc = Math.floor(totalPromocional * perc);
      setManualDiscount(calcDisc);
      setManualDiscountDetail({ type: 'perc', value: val / 100 });
      setPayValue('');
      return;
    }

    const method = payMethods.find(m => m.id === payMethod);

    const targetTier = ['pix', 'dinheiro'].includes(payMethod)
      ? 'vista'
      : ['credito', 'debito', 'alimentacao', 'refeicao', 'link_pagamento'].includes(payMethod)
        ? 'cartao'
        : null;

    const satisfiedCombos = activePromos.filter(promo => {
      if (promo.promoType !== 'combo' || !promo.comboRules || promo.comboRules.length === 0) return false;
      const res = evaluateComboPromotions(promo, cart, null);
      return res.applies;
    });

    if (satisfiedCombos.length > 0 && targetTier && adjustedPromoTier !== targetTier) {
      const actionName = targetTier === 'vista' ? 'à vista' : 'no cartão';
      const promptConfirm = window.confirm(
        `Deseja aplicar o preço promocional para pagamento ${actionName} no carrinho?\n\n` +
        `Clique em OK para aplicar o preço promocional de ${actionName}.\n` +
        `Clique em Cancelar para manter o preço promocional atual.`
      );
      if (promptConfirm) {
        setAdjustedPromoTier(targetTier);
      }
    }

    // ─── CENTRAL ROUTING INTERCEPTORS ───

    // 1. Intercept PIX payments based on routing keys and dynamic settings
    if (payMethod === 'pix') {
      const isDynamicPix = integrations?.tipoPix === '17';
      if (isDynamicPix) {
        const screenProvider = integrations?.pixNaTela && integrations?.pixNaTela !== 'inativo';
        const maquininhaProvider = integrations?.pixNaMaquininha && integrations?.pixNaMaquininha !== 'inativo';

        if (screenProvider && maquininhaProvider) {
          setScreenPixAmount(val);
          setShowPixChoiceModal(true);
          return;
        } else if (maquininhaProvider) {
          if (integrations?.pixNaMaquininha === 'infinitypay' && integrations?.infinitypayAtivo) {
            handleCreateInfinityPayOrder(val);
            return;
          }
          if (integrations?.pixNaMaquininha === 'pagbank' && integrations?.plugpagAtivo) {
            setTerminalAmount(val);
            setTerminalInstallments(1);
            setTerminalState('idle');
            setTerminalErrorMsg('');
            setTerminalCardBrand('');
            setTerminalAuthCode('');
            setShowTerminalModal(true);
            return;
          }
        } else if (screenProvider) {
          if (integrations?.pixNaTela === 'pagbank' && integrations?.plugpagAtivo) {
            handleCreateScreenPixOrder(val);
            return;
          }
          if (integrations?.pixNaTela === 'infinitypay' && integrations?.infinitypayAtivo) {
            handleCreateInfinityPayOrder(val);
            return;
          }
        }
      }
      // Otherwise, falls through to manual operator confirmation (simulador)
    }

    // 2. Intercept Credit payments based on card settings
    if (payMethod === 'credito') {
      const isCardActive = integrations?.cartao && integrations?.cartao !== 'inativo';
      if (isCardActive) {
        if (integrations?.cartao === 'infinitypay' && integrations?.infinitypayAtivo) {
          handleCreateInfinityPayOrder(val);
          return;
        }
        if (integrations?.cartao === 'pagbank' && integrations?.plugpagAtivo) {
          setTerminalAmount(val);
          setTerminalInstallments(creditInstallments);
          setTerminalState('idle');
          setTerminalErrorMsg('');
          setTerminalCardBrand('');
          setTerminalAuthCode('');
          setShowTerminalModal(true);
          return;
        }
      }
      // Otherwise, falls through to manual card data entry
    }

    // 3. Intercept Debit payments based on card settings
    if (payMethod === 'debito') {
      const isCardActive = integrations?.cartao && integrations?.cartao !== 'inativo';
      if (isCardActive) {
        if (integrations?.cartao === 'pagbank' && integrations?.plugpagAtivo) {
          setTerminalAmount(val);
          setTerminalInstallments(1);
          setTerminalState('idle');
          setTerminalErrorMsg('');
          setTerminalCardBrand('');
          setTerminalAuthCode('');
          setShowTerminalModal(true);
          return;
        }
      }
      // Otherwise, falls through to manual card data entry
    }

    // 4. Intercept Link de Pagamento based on settings
    if (payMethod === 'link_pagamento') {
      const isLinkActive = integrations?.linkDePagamento && integrations?.linkDePagamento !== 'inativo';
      if (isLinkActive) {
        if (integrations?.linkDePagamento === 'infinitypay' && integrations?.infinitypayAtivo) {
          handleCreateInfinityPayOrder(val);
          return;
        }
      }
      // Otherwise, falls through to manual code entry
    }

    const isCard = ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod);
    const isPix = payMethod === 'pix';
    const isLink = payMethod === 'link_pagamento';
    const isCardOrPix = isCard || isPix;
    const isIntegrated = isCard
      ? (integrations?.cartao && integrations?.cartao !== 'inativo')
      : (isPix
        ? (integrations?.tipoPix === '17' && (
          (integrations?.pixNaTela && integrations?.pixNaTela !== 'inativo') ||
          (integrations?.pixNaMaquininha && integrations?.pixNaMaquininha !== 'inativo')
        ))
        : (isLink
          ? (integrations?.linkDePagamento && integrations?.linkDePagamento !== 'inativo')
          : false
        )
      );

    if (isCardOrPix && !isIntegrated && !isEverythingInactive) {
      if (isCard) {
        if (!payNumeroAutorizacao || !payNumeroAutorizacao.trim()) {
          alert('Por favor, informe o Código de Autorização / NSU / Código da Transação.');
          return;
        }
        if (!payBandeira || payBandeira.trim() === '') {
          alert('Por favor, selecione a bandeira do cartão.');
          return;
        }
        if (!payCredenciadora || !payCredenciadora.trim() || payCredenciadora === 'Outra') {
          alert('Por favor, informe a credenciadora/adquirente do cartão.');
          return;
        }
        const cleanCnpj = (payCnpjCredenciadora || '').replace(/\D/g, '');
        if (!cleanCnpj || cleanCnpj.length !== 14) {
          alert('Por favor, informe o CNPJ da credenciadora com 14 dígitos.');
          return;
        }
      }
    }

    if (method.needCode && !isCardOrPix && !payCode) {
      alert('Por favor, informe o código da transação.');
      return;
    }

    const finalTipoIntegra = isIntegrated ? '1' : '2';

    setPayments([...payments, {
      id: Date.now(),
      method: method.label + (payMethod === 'credito' && creditInstallments > 1 ? ` (${creditInstallments}x)` : ''),
      methodId: method.id,
      value: val,
      code: payNumeroAutorizacao || payCode || '',
      tipo_integracao: finalTipoIntegra,
      bandeira_operadora: ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) ? (payBandeira === '99' ? null : payBandeira) : null,
      numero_autorizacao: ['credito', 'debito', 'pix', 'alimentacao', 'refeicao'].includes(payMethod) ? payNumeroAutorizacao : null,
      cnpj_credenciadora: ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) ? payCnpjCredenciadora : null,
      credenciadora: ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) ? payCredenciadora : null
    }]);

    setPayValue('');
    setPayCode('');
    setPayNumeroAutorizacao('');
    setPayCredenciadora('');
    setPayCnpjCredenciadora('');
    setPayBandeira('99');
    setCreditInstallments(1);
  };

  const handleTerminalCharge = async () => {
    setTerminalState('sending');
    setTerminalErrorMsg('');
    try {
      // Direct bulletproof fetch from Firestore for freshest configurations
      const intSnap = await getDoc(getTenantDoc('company', 'integrations'));
      const activeIntegrations = intSnap.exists() ? intSnap.data() : integrations;

      const response = await fetch('http://localhost:5000/api/plugpag/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: terminalAmount,
          method: payMethod, // 'credito', 'debito' or 'pix'
          installments: payMethod === 'credito' ? terminalInstallments : 1,
          connectionType: activeIntegrations?.plugpagTipo || 'wifi',
          terminalIp: activeIntegrations?.plugpagTerminalIp || '',
          port: activeIntegrations?.plugpagPorta || '42007',
          terminalName: activeIntegrations?.plugpagTerminalNome || '',
          token: activeIntegrations?.plugpagToken || 'mock',
          ambiente: activeIntegrations?.plugpagAmbiente || 'homologacao'
        })
      });

      setTerminalState('waiting_card');

      const stateTimeout = setTimeout(() => {
        setTerminalState('processing');
      }, 1200);

      const data = await response.json();
      clearTimeout(stateTimeout);

      if (data.success) {
        setTerminalState('success');
        setTerminalCardBrand(data.cardBrand || 'VISA');
        setTerminalAuthCode(data.authorizationCode || '000000');

        const targetTier = ['credito', 'debito'].includes(payMethod) ? 'cartao' : null;
        const satisfiedCombos = activePromos.filter(promo => {
          if (promo.promoType !== 'combo' || !promo.comboRules || promo.comboRules.length === 0) return false;
          const res = evaluateComboPromotions(promo, cart, null);
          return res.applies;
        });

        if (satisfiedCombos.length > 0 && targetTier && adjustedPromoTier !== targetTier) {
          const actionName = 'no cartão';
          const promptConfirm = window.confirm(
            `Deseja aplicar o preço promocional para pagamento ${actionName} no carrinho?\n\n` +
            `Clique em OK para aplicar o preço promocional de ${actionName}.\n` +
            `Clique em Cancelar para manter o preço promocional atual.`
          );
          if (promptConfirm) {
            setAdjustedPromoTier(targetTier);
          }
        }

        setTimeout(() => {
          const method = payMethods.find(m => m.id === payMethod);
          setPayments(prev => {
            const exists = prev.some(p => p.id === activeRowId);
            if (exists) {
              return prev.map(p => p.id === activeRowId ? {
                ...p,
                method: `${method.label} (${data.cardBrand || 'VISA'})`,
                value: terminalAmount,
                code: data.authorizationCode || '000000',
                tipo_integracao: '1',
                simulated: !!data.simulated
              } : p);
            } else {
              return [...prev, {
                id: Date.now(),
                method: `${method.label} (${data.cardBrand || 'VISA'})`,
                methodId: method.id,
                value: terminalAmount,
                code: data.authorizationCode || '000000',
                tipo_integracao: '1',
                simulated: !!data.simulated
              }];
            }
          });
          setShowTerminalModal(false);
          setPayValue('');
          setPayCode('');
        }, 1500);
      } else {
        setTerminalState('error');
        setTerminalErrorMsg(data.message || 'Transação recusada pela maquininha.');
      }
    } catch (err) {
      setTerminalState('error');
      setTerminalErrorMsg('Erro de comunicação com o backend local na porta 5000.');
    }
  };

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) return;
    setLoading(true);
    try {
      const q = query(getTenantCollection('coupons'), where('codigo', '==', coupon.toUpperCase()), where('ativo', '==', true));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Cupom inválido ou expirado.');
        setCoupon('');
        return;
      }

      const c = snap.docs[0].data();
      const now = new Date();
      if (c.dataFim && new Date(c.dataFim) < now) {
        alert('Este cupom expirou.');
        setCoupon('');
        return;
      }

      if (c.valorMinimo && (totalPromocional / 100) < c.valorMinimo) {
        alert(`Este cupom exige um valor mínimo de compra de R$ ${c.valorMinimo.toFixed(2).replace('.', ',')}.`);
        setCoupon('');
        return;
      }

      setAppliedCoupon(c);
      setCoupon(c.codigo);
      alert(`Cupom ${c.codigo} validado!`);
    } catch (e) {
      console.error(e);
      alert('Erro ao validar cupom.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCoupon('');
  };

  const fetchCepForValidation = async (cep) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValidationClientData(prev => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf
        }));
      }
    } catch (e) { console.error('Erro ViaCEP:', e); }
    finally { setCepLoading(false); }
  };

  const saveValidationClient = async () => {
    if (!validationClientData.nome?.trim()) {
      alert('Nome é obrigatório.');
      return;
    }
    const cleanCpf = (validationClientData.cpf || '').replace(/\D/g, '');
    if (!cleanCpf) {
      alert('CPF é obrigatório.');
      return;
    }
    if (!validarCpf(cleanCpf)) {
      alert('CPF inválido.');
      return;
    }
    const cleanPhone = (validationClientData.telefone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      alert('Telefone é obrigatório.');
      return;
    }
    if (cleanPhone.length < 10) {
      alert('Telefone inválido (mínimo 10 dígitos com DDD).');
      return;
    }

    if (saleType === 'entrega') {
      if (!validationClientData.endereco?.trim()) {
        alert('Endereço (rua) é obrigatório.');
        return;
      }
      if (!validationClientData.numero?.trim()) {
        alert('Número é obrigatório.');
        return;
      }
      if (!validationClientData.bairro?.trim()) {
        alert('Bairro é obrigatório.');
        return;
      }
      if (!validationClientData.cep?.trim()) {
        alert('CEP é obrigatório.');
        return;
      }
      if (!validationClientData.cidade?.trim()) {
        alert('Cidade é obrigatória.');
        return;
      }
      if (!validationClientData.uf?.trim()) {
        alert('UF é obrigatória.');
        return;
      }
    }

    // Duplicate checks
    const isCpfDuplicate = clients.some(c => {
      const dbCpf = (c.cpf || '').replace(/\D/g, '');
      return dbCpf === cleanCpf && c.id !== client.id;
    });
    if (isCpfDuplicate) {
      alert(`Já existe um cliente cadastrado com o CPF: ${validationClientData.cpf}`);
      return;
    }

    const isPhoneDuplicate = clients.some(c => {
      const dbPhone = (c.telefone || '').replace(/\D/g, '');
      return dbPhone === cleanPhone && c.id !== client.id;
    });
    if (isPhoneDuplicate) {
      alert(`Já existe um cliente cadastrado com o telefone: ${validationClientData.telefone}`);
      return;
    }

    setLoading(true);
    try {
      const plainContact = {
        nome: validationClientData.nome.trim(),
        telefone: validationClientData.telefone.trim(),
        cpf: validationClientData.cpf.trim(),
        endereco: validationClientData.endereco ? validationClientData.endereco.trim() : null,
        logradouro: validationClientData.endereco ? validationClientData.endereco.trim() : null,
        numero: validationClientData.numero ? validationClientData.numero.trim() : null,
        bairro: validationClientData.bairro ? validationClientData.bairro.trim() : null,
        cep: validationClientData.cep ? validationClientData.cep.trim() : null,
        cidade: validationClientData.cidade ? validationClientData.cidade.trim() : null,
        uf: validationClientData.uf ? validationClientData.uf.trim().toUpperCase() : null,
        cidadeUf: (validationClientData.cidade && validationClientData.uf) ? `${validationClientData.cidade.trim()} - ${validationClientData.uf.trim().toUpperCase()}` : null,
        updatedAt: new Date().toISOString()
      };

      const encryptedContact = {
        ...plainContact,
        cpf: encryptData(plainContact.cpf),
        telefone: encryptData(plainContact.telefone),
        cep: plainContact.cep ? encryptData(plainContact.cep) : null,
        logradouro: plainContact.logradouro ? encryptData(plainContact.logradouro) : null,
        numero: plainContact.numero ? encryptData(plainContact.numero) : null,
        bairro: plainContact.bairro ? encryptData(plainContact.bairro) : null,
        cidadeUf: plainContact.cidadeUf ? encryptData(plainContact.cidadeUf) : null
      };

      let finalId = client.id;

      if (client.id) {
        const contactRef = getTenantDoc('contacts', client.id);
        await updateDoc(contactRef, encryptedContact);
      } else {
        const docRef = await addDoc(getTenantCollection('contacts'), {
          ...encryptedContact,
          createdAt: new Date().toISOString()
        });
        finalId = docRef.id;
      }

      const newLocalClient = {
        ...plainContact,
        id: finalId,
        addNfce: !!client.addNfce
      };
      setClient(newLocalClient);
      setShowClientValidationModal(false);
      alert('Dados do cliente salvos com sucesso!');

      // Proceed to finalize the sale with the updated client info
      await finalizeSale(newLocalClient);
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      alert('Erro ao salvar dados do cliente.');
    } finally {
      setLoading(false);
    }
  };

  const finalizeSale = async (overrideClient = null) => {
    const activeClient = overrideClient || client;
    const missing = [];
    if (saleType === 'retirada' || saleType === 'entrega') {
      if (!activeClient.nome?.trim()) missing.push('Nome');
      if (!activeClient.cpf?.trim()) missing.push('CPF');
      if (!activeClient.telefone?.trim()) missing.push('Telefone');

      if (saleType === 'entrega') {
        if (!activeClient.endereco?.trim() && !activeClient.logradouro?.trim()) missing.push('Endereço');
        if (!activeClient.numero?.trim()) missing.push('Número');
        if (!activeClient.bairro?.trim()) missing.push('Bairro');
        if (!activeClient.cep?.trim()) missing.push('CEP');
        const hasCidade = activeClient.cidade?.trim() || activeClient.cidadeUf?.split(' - ')[0]?.trim();
        const hasUf = activeClient.uf?.trim() || activeClient.cidadeUf?.split(' - ')[1]?.trim();
        if (!hasCidade) missing.push('Cidade');
        if (!hasUf) missing.push('UF');
      }
    }

    if (missing.length > 0) {
      setValidationMissingFields(missing);
      setValidationClientData({
        nome: activeClient.nome || '',
        cpf: activeClient.cpf || '',
        telefone: activeClient.telefone || '',
        endereco: activeClient.endereco || activeClient.logradouro || '',
        numero: activeClient.numero || '',
        bairro: activeClient.bairro || '',
        cep: activeClient.cep || '',
        cidade: activeClient.cidade || (activeClient.cidadeUf ? activeClient.cidadeUf.split(' - ')[0] : ''),
        uf: activeClient.uf || (activeClient.cidadeUf ? activeClient.cidadeUf.split(' - ')[1] : '')
      });
      setShowClientValidationModal(true);
      return;
    }

    if (cart.length === 0) return alert('Carrinho vazio!');

    const isPending = saleType !== 'balcao' && paymentPolicy.startsWith('pagamento_');
    if (!isPending && remaining > 0) return alert('Valor total não atingido!');

    if (saleType === 'entrega') {
      const addrSummary = `${activeClient.endereco || activeClient.logradouro}, Nº ${activeClient.numero}, ${activeClient.bairro}, ${activeClient.cidade || ''}/${activeClient.uf || ''} (CEP: ${activeClient.cep || ''})`;
      const confirmAddr = window.confirm(`CONFIRMAR ENDEREÇO DE ENTREGA:\n\n${addrSummary.toUpperCase()}\n\nOs dados de entrega estão corretos?`);
      if (!confirmAddr) return;
    }

    setLoading(true);
    try {
      const finalClient = {
        id: activeClient.id || null,
        nome: activeClient.nome || 'Consumidor não identificado',
        cpf: activeClient.cpf || null,
        addNfce: !!activeClient.addNfce,
        telefone: activeClient.telefone || null,
        endereco: activeClient.endereco || activeClient.logradouro || null,
        numero: activeClient.numero || null,
        bairro: activeClient.bairro || null,
        cep: activeClient.cep || null,
        cidade: activeClient.cidade || (activeClient.cidadeUf ? activeClient.cidadeUf.split(' - ')[0] : null),
        uf: activeClient.uf || (activeClient.cidadeUf ? activeClient.cidadeUf.split(' - ')[1] : null)
      };

      // Auto-save new client if not yet registered (safeguard)
      if (activeClient.nome && !activeClient.id) {
        try {
          const plainContact = {
            nome: activeClient.nome,
            telefone: activeClient.telefone || null,
            cpf: activeClient.cpf || null,
            endereco: activeClient.endereco || null,
            logradouro: activeClient.endereco || null,
            numero: activeClient.numero || null,
            bairro: activeClient.bairro || null,
            cep: activeClient.cep || null,
            cidade: activeClient.cidade || null,
            uf: activeClient.uf || null,
            cidadeUf: (activeClient.cidade && activeClient.uf) ? `${activeClient.cidade} - ${activeClient.uf}` : null
          };
          const encryptedContact = {
            ...plainContact,
            cpf: plainContact.cpf ? encryptData(plainContact.cpf) : null,
            telefone: plainContact.telefone ? encryptData(plainContact.telefone) : null,
            cep: plainContact.cep ? encryptData(plainContact.cep) : null,
            logradouro: plainContact.logradouro ? encryptData(plainContact.logradouro) : null,
            numero: plainContact.numero ? encryptData(plainContact.numero) : null,
            bairro: plainContact.bairro ? encryptData(plainContact.bairro) : null,
            cidadeUf: plainContact.cidadeUf ? encryptData(plainContact.cidadeUf) : null
          };
          const newContactRef = await addDoc(getTenantCollection('contacts'), {
            ...encryptedContact,
            createdAt: new Date().toISOString()
          });
          finalClient.id = newContactRef.id;
        } catch (err) {
          console.warn('Erro ao salvar novo contato:', err);
        }
      }

      const salesCol = getTenantCollection('sales');
      const saleDoc = doc(salesCol);
      const saleId = saleDoc.id;

      let nfceResult = null;
      const shouldEmitNfce = !isPending && (integrations?.emissaoNotaFiscal === 'ativo');

      console.log('=== FINALIZANDO VENDA ===');
      console.log('Tipo:', saleType, '| Pendente:', isPending, '| Emitir NFC-e:', shouldEmitNfce);

      if (shouldEmitNfce) {
        try {
          const compSnap = await getDoc(doc(db, 'business', activeCompany || user?.empresa || 'development'));
          const intSnap = await getDoc(getTenantDoc('company', 'integrations'));

          if (compSnap.exists() && intSnap.exists()) {
            const companyRaw = compSnap.data();
            const companyData = {
              ...companyRaw,
              ambiente: companyRaw.ambiente ? (decryptData(companyRaw.ambiente) || 'homologacao') : 'homologacao',
              status: companyRaw.status ? (decryptData(companyRaw.status) || 'ativa') : 'ativa'
            };
            const integrationsData = intSnap.data();

            const hasToken = integrationsData.ambiente === 'producao' ? integrationsData.tokenProducao : integrationsData.tokenHomologacao;

            if (integrationsData.emissaoNotaFiscal !== 'ativo') {
              console.log('Integracao FocusNFE inativa. Gerando apenas comprovante.');
            } else if (!hasToken) {
              console.warn('⚠️ Token FocusNFE não configurado. Venda será salva sem NFC-e.');
            } else {
              const tempSale = {
                items: cart.map(i => ({
                  ...i,
                  price: i.originalPrice || i.precoVenda,
                  promoPrice: i.precoVenda,
                  codigo: i.sku || i.codigo || i.id
                })),
                payments,
                total: grandTotal,
                discount: couponDiscount + manualDiscount,
                shipping,
                client: finalClient
              };

              console.log('Chamando emitirNfce...');
              nfceResult = await emitirNfce(tempSale, companyData, integrationsData, saleId);

              if (!nfceResult.success) {
                console.error('❌ Falha na emissão:', nfceResult.error);
                alert(`⚠️ FALHA NA EMISSÃO NFC-e: ${nfceResult.error || 'Erro na SEFAZ'}\n\nA venda será salva sem nota fiscal.`);
              } else {
                console.log('✅ NFC-e emitida com sucesso!', nfceResult);
              }
            }
          } else {
            console.warn('⚠️ Configurações de empresa/integração não encontradas.');
          }
        } catch (err) {
          console.error('Erro ao buscar settings para NFC-e:', err);
        }
      }


      const saleData = {
        type: saleType,
        paymentPolicy: saleType === 'balcao' ? 'imediato' : paymentPolicy,
        client: finalClient,
        items: cart.map(i => ({
          id: i.id || null,
          nome: i.nome || 'Produto Sem Nome',
          quantity: i.quantity || 1,
          price: i.originalPrice || i.precoVenda || 0,
          promoPrice: i.precoVenda || 0,
          isGift: !!i.isGift
        })),
        payments,
        total: grandTotal,
        discount: couponDiscount + manualDiscount,
        promoDiscount: totalPromosAplicadas,
        couponCode: appliedCoupon?.codigo || null,
        shipping,
        status: isPending ? 'pendente' : 'concluido',
        emitirNota: !!(nfceResult && nfceResult.success),
        nfce: nfceResult || null,
        operator: user?.nome || 'ADMIN',
        partnerId: selectedPartner?.id || null,
        partnerName: selectedPartner?.name || null,
        createdAt: new Date().toISOString()
      };

      // Clean the plain sale data (remove nulls, empty fields, 0 values recursively)
      const cleanedPlainSale = removeEmptyOrZero(saleData) || {};

      // Create an encrypted clone for Firestore saving
      const encryptedSaleData = JSON.parse(JSON.stringify(saleData));
      if (encryptedSaleData.partnerName) {
        encryptedSaleData.partnerName = encryptData(encryptedSaleData.partnerName);
      }
      if (encryptedSaleData.client && encryptedSaleData.client.telefone) {
        encryptedSaleData.client.telefone = encryptData(encryptedSaleData.client.telefone);
      }

      // Clean the encrypted sale data recursively
      const cleanedEncryptedSale = removeEmptyOrZero(encryptedSaleData) || {};

      await setDoc(saleDoc, cleanedEncryptedSale);

      const saleWithId = { ...cleanedPlainSale, id: saleId };
      setLastSale(saleWithId);

      // Incrementar pontos do parceiro se houver
      if (selectedPartner?.id) {
        try {
          await updateDoc(getTenantDoc('partners', selectedPartner.id), {
            pontos: increment(1)
          });
        } catch (err) {
          console.error("Erro ao incrementar pontos do parceiro:", err);
        }
      }

      // Deduzir estoque (Baixa automática)
      for (const item of cart) {
        if (item.id) {
          try {
            const itemRef = getTenantDoc('inventory', item.id);
            const itemSnap = await getDoc(itemRef);
            if (itemSnap.exists()) {
              const currentStock = Number(itemSnap.data().estoque || 0);
              const newStock = currentStock - item.quantity;
              const updatePayload = { estoque: newStock };
              if (newStock <= 0) {
                updatePayload.estoqueZeradoAt = itemSnap.data().estoqueZeradoAt || new Date().toISOString();
              } else {
                updatePayload.estoqueZeradoAt = null;
              }
              await updateDoc(itemRef, updatePayload);
              console.log(`[PDV] Estoque do produto ${item.nome} (${item.id}) atualizado de ${currentStock} para ${newStock}`);
            } else {
              console.warn(`[PDV] Produto ${item.nome} (${item.id}) não encontrado no inventário.`);
            }
          } catch (err) {
            console.error(`[PDV] Erro ao atualizar estoque do produto ${item.nome}:`, err);
          }
        }
      }

      // Salvar dados da empresa para o recibo
      const compSnap = await getDoc(doc(db, 'business', activeCompany || user?.empresa || 'development'));
      if (compSnap.exists()) {
        const companyRaw = compSnap.data();
        setCompanyData({
          ...companyRaw,
          ambiente: companyRaw.ambiente ? (decryptData(companyRaw.ambiente) || 'homologacao') : 'homologacao',
          status: companyRaw.status ? (decryptData(companyRaw.status) || 'ativa') : 'ativa'
        });
      }

      const change = Math.max(0, totalPaid - grandTotal);
      setFinalChange(change);
      setIsSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar venda.');
    } finally {
      setLoading(false);
    }
  };

  const resetSale = () => {
    setIsSuccess(false);
    setCart([]);
    setPayments([]);
    setClient({ nome: '', cpf: '', addNfce: false });
    setCouponDiscount(0);
    setAdjustedPromoTier(null);
    setAppliedCoupon(null);
    setManualDiscount(0);
    setManualDiscountDetail(null);
    setDeclinedPromos([]);
    setShipping(0);
    setShippingInput('');
    setPayValue('');
    setPayCode('');
    setIsIdentifyingManual(false);
    setManualClientData({ nome: '', telefone: '', cpf: '', endereco: '', numero: '', bairro: '', cep: '', cidade: '', uf: '' });
    setSearchProduct('');
    setSearchClient('');
    setManualDiscountInput('');
    setManualDiscountType('rs');
    setActiveRowId(null);
    setShowAddPaymentDropdown(false);
    setSelectedPartner(null);
    setSearchPartner('');
    setPaymentPolicy('pago_no_balcao');
    setSearchClient('');
    setSearchProduct('');
    setSelectedPartner(null);
    setSearchPartner('');
    setQuickPhone('');
    setQuickCpf('');
    setQuickSearch('');
    setQuickStatus(null);
    setQuickName('');
    setManualClientData({ nome: '', telefone: '', cpf: '', endereco: '', numero: '', bairro: '', cep: '', cidade: '', uf: '' });
  };

  const saleTypes = [
    { id: 'balcao', label: 'Balcão', Icon: ShoppingBag },
    { id: 'retirada', label: 'Retirada', Icon: MapPin },
    { id: 'entrega', label: 'Entrega', Icon: ArrowRight }
  ];

  const normalize = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const handleSelectClient = (c) => {
    const hasAddr = c.endereco?.trim() || c.logradouro?.trim();
    const hasNum = c.numero?.toString()?.trim();
    const hasBairro = c.bairro?.trim();
    const hasCep = c.cep?.trim();
    const hasCidade = c.cidade?.trim() || c.cidadeUf?.split(' - ')[0]?.trim();
    const hasUf = c.uf?.trim() || c.cidadeUf?.split(' - ')[1]?.trim();
    
    const clientAddrFilled = hasAddr && hasNum && hasBairro && hasCep && hasCidade && hasUf;

    setClient({
      ...c,
      endereco: c.endereco || c.logradouro || null,
      addNfce: false
    });
    setSearchClient('');

    if (saleType === 'entrega' && !clientAddrFilled) {
      alert('Este cliente não possui endereço completo salvo. Por favor, adicione os dados de entrega.');
      setValidationClientData({
        nome: c.nome || '',
        cpf: c.cpf || '',
        telefone: c.telefone || '',
        endereco: c.endereco || c.logradouro || '',
        numero: c.numero || '',
        bairro: c.bairro || '',
        cep: c.cep || '',
        cidade: c.cidade || (c.cidadeUf ? c.cidadeUf.split(' - ')[0] : ''),
        uf: c.uf || (c.cidadeUf ? c.cidadeUf.split(' - ')[1] : '')
      });
      setValidationMissingFields(['Endereço', 'Número', 'Bairro', 'CEP', 'Cidade', 'UF'].filter(f => {
        if (f === 'Endereço') return !hasAddr;
        if (f === 'Número') return !hasNum;
        if (f === 'Bairro') return !hasBairro;
        if (f === 'CEP') return !hasCep;
        if (f === 'Cidade') return !hasCidade;
        if (f === 'UF') return !hasUf;
        return false;
      }));
      setShowClientValidationModal(true);
    }
  };

  // Single-Input Lookup by phone or CPF
  const handleSingleSearch = (val, isEnter = false) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      setQuickStatus(null);
      return;
    }

    let found = null;
    if (cleaned.length >= 3) {
      found = clients.find(c => {
        const cPhone = (c.telefone || '').replace(/\D/g, '');
        const cCpf = (c.cpf || '').replace(/\D/g, '');

        const phoneMatch = cPhone.endsWith(cleaned) || cPhone === cleaned;
        const cpfMatch = cCpf.startsWith(cleaned) || cCpf === cleaned;
        return phoneMatch || cpfMatch;
      });
    }

    if (found) {
      handleSelectClient(found);
      setQuickStatus('found');
      setQuickSearch('');
    } else {
      if (isEnter || cleaned.length === 10 || cleaned.length === 11) {
        setQuickStatus('not_found');
      }
    }
  };

  const fetchCep = async (cep) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setManualClientData(prev => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf
        }));
      }
    } catch (e) { console.error('Erro ViaCEP:', e); }
    finally { setCepLoading(false); }
  };

  const filteredProducts = products.filter(p => p.type !== 'promotion' && (normalize(p.nome).includes(normalize(searchProduct)) || (p.sku || '').includes(searchProduct)) && Number(p.estoque || 0) >= 1);
  const filteredClients = searchClient ? clients.filter(c => {
    const qClean = searchClient.replace(/\D/g, '');
    const nameMatch = normalize(c.nome || '').includes(normalize(searchClient));
    const cpfMatch = qClean && (c.cpf || '').replace(/\D/g, '').includes(qClean);
    const phoneMatch = qClean && (c.telefone || '').replace(/\D/g, '').includes(qClean);
    return nameMatch || cpfMatch || phoneMatch;
  }) : [];
  const filteredPartners = searchPartner ? partners.filter(p => normalize(p.name).includes(normalize(searchPartner)) || normalize(p.tipo).includes(normalize(searchPartner))) : [];

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
    gap: '0.75rem',
    height: isMobile ? 'auto' : 'calc(100vh - 80px)',
    minHeight: isMobile ? 'auto' : '720px',
    overflow: isMobile ? 'visible' : 'auto',
    padding: '0.25rem 0'
  };


  return (
    <div style={{ position: 'relative', width: '100%', fontFamily: 'inherit', color: t.textMain }}>

      {/* ─── GRID PRINCIPAL DO PDV ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.25fr 1.15fr',
        gap: '1.25rem',
        alignItems: 'start',
        paddingTop: '0.5rem',
        minHeight: '80vh'
      }}>

        {/* ════════ COLUNA ESQUERDA: BUSCAR ITENS E CARRINHO ABAIXO ════════ */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          backgroundColor: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: '24px',
          padding: '1.5rem',
          boxShadow: t.shadowSmall,
          minWidth: 0,
          height: isMobile ? 'auto' : 'calc(100vh - 180px)',
          overflow: 'hidden'
        }}>

          {/* ── 1. Caixa de Buscar Itens e Catálogo de Produtos ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color={t.accent} /> Buscar Itens
                </h2>
                <span style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 550 }}>
                  Consulte e adicione itens ao carrinho
                </span>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: t.accent,
                backgroundColor: `${t.accent}0d`,
                padding: '4px 10px',
                borderRadius: '8px',
                border: `1px solid ${t.accent}20`
              }}>
                {products.filter(p => p.type !== 'promotion' && Number(p.estoque || 0) >= 1).length} Itens
              </span>
            </div>

            {/* Input de Busca de Produtos */}
            <div ref={productSearchRef} style={{ position: 'relative', width: '100%' }} className="crm-search-wrapper">
              <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textSecondary, pointerEvents: 'none' }} />
              <input
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                onKeyDown={handleProductSearchKeyDown}
                placeholder="Buscar por nome, SKU, código de barras... (Enter para adicionar)"
                style={{
                  width: '100%',
                  height: 44,
                  paddingLeft: 42,
                  paddingRight: searchProduct ? 36 : 14,
                  backgroundColor: t.bgSecondary || t.bg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 12,
                  fontWeight: 650,
                  fontSize: '0.85rem',
                  color: t.textMain,
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
              {searchProduct && (
                <button onClick={() => setSearchProduct('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, display: 'flex', alignItems: 'center' }}>
                  <X size={16} />
                </button>
              )}

              {/* Lista Elegante de Resultados de Busca de Produtos (Suspenso) */}
              {searchProduct.trim().length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 2000,
                  backgroundColor: t.bg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: '16px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  boxShadow: t.shadowLarge || '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: '1rem', fontSize: '0.78rem', color: t.textSecondary, textAlign: 'center' }}>
                      Nenhum produto encontrado para "{searchProduct}"
                    </div>
                  ) : (
                    filteredProducts.map(p => {
                      const isOut = (p.estoque || 0) === 0;
                      let productImg = '';
                      if (p.images) {
                        if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
                          productImg = p.images[0];
                        } else if (typeof p.images === 'string' && p.images.trim() !== '') {
                          productImg = p.images;
                        }
                      }
                      return (
                        <div
                          key={p.id}
                          onClick={() => { if (!isOut) { addToCart(p); setSearchProduct(''); } }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: t.bgSecondary || '#f8fafc',
                            border: `1px solid ${t.border}`,
                            borderRadius: '10px',
                            cursor: isOut ? 'not-allowed' : 'pointer',
                            opacity: isOut ? 0.6 : 1,
                            transition: 'all 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onMouseEnter={(e) => {
                            if (!isOut) {
                              e.currentTarget.style.borderColor = t.accent;
                              e.currentTarget.style.backgroundColor = `${t.accent}0a`;
                              const btn = e.currentTarget.querySelector('.add-btn');
                              if (btn) {
                                btn.style.backgroundColor = t.accent;
                                btn.style.color = '#ffffff';
                                btn.style.borderColor = t.accent;
                              }
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isOut) {
                              e.currentTarget.style.borderColor = t.border;
                              e.currentTarget.style.backgroundColor = t.bgSecondary || '#f8fafc';
                              const btn = e.currentTarget.querySelector('.add-btn');
                              if (btn) {
                                btn.style.backgroundColor = t.bg;
                                btn.style.color = t.accent;
                                btn.style.borderColor = t.border;
                              }
                            }
                          }}
                        >
                          {/* Image/Icon Container */}
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            backgroundColor: isOut ? '#e2e8f0' : (productImg ? '#ffffff' : `${t.accent}12`),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            border: `1px solid ${isOut ? '#cbd5e1' : (productImg ? `${t.border}` : `${t.accent}20`)}`,
                            boxShadow: productImg ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                            flexShrink: 0,
                            position: 'relative'
                          }}>
                            {productImg ? (
                              <img
                                src={productImg}
                                alt={p.nome}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  padding: '2px'
                                }}
                              />
                            ) : (
                              <Package size={18} style={{ color: isOut ? t.textSecondary : t.accent }} />
                            )}

                            {isOut && (
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '0.5rem',
                                fontWeight: 900,
                                textTransform: 'uppercase'
                              }}>
                                Falta
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 750,
                              color: t.textMain,
                              fontFamily: "'Outfit', sans-serif",
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textTransform: 'uppercase'
                            }} title={p.nome}>
                              {p.nome}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: t.accent, fontFamily: "'Outfit', sans-serif" }}>
                                R$ {fmt(p.precoVenda)}
                              </span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 650, color: t.textSecondary, fontFamily: "'Outfit', sans-serif" }}>
                                • Est: {p.estoque || 0}
                              </span>
                            </div>
                          </div>

                          {/* Plus Action Icon */}
                          {!isOut && (
                            <div
                              className="add-btn"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: t.bg,
                                border: `1px solid ${t.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: t.accent,
                                transition: 'all 0.2s',
                                flexShrink: 0
                              }}
                            >
                              <Plus size={14} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── 2. O Carrinho Fica Embaixo da Caixa de Busca ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '200px',
            overflow: 'hidden'
          }}>
            {/* Cart Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingCart size={15} style={{ color: t.accent }} />
                <span style={{ fontWeight: 800, fontSize: '0.78rem', color: t.textMain, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Carrinho / Sacola de Compras</span>
                {cart.length > 0 && (
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, backgroundColor: t.accent, color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                    {cart.reduce((a, i) => a + i.quantity, 0)} itens
                  </span>
                )}
              </div>
            </div>

            {/* Cart Items Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <AnimatePresence initial={false}>
                {cart.length === 0 ? (
                  <motion.div key="empty-cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 180, color: t.textSecondary, textAlign: 'center', padding: '1.5rem' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: t.bgSecondary || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', opacity: 0.8 }}>
                      <ShoppingBag size={18} style={{ color: t.textSecondary }} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.78rem', color: t.textMain }}>SACOLA VAZIA</span>
                    <p style={{ fontSize: '0.68rem', color: t.textSecondary, marginTop: 2, maxWidth: 180, lineHeight: 1.4 }}>
                      Busque itens e adicione-os ao carrinho para iniciar a venda.
                    </p>
                  </motion.div>
                ) : (
                  cart.map(item => {
                    const hasDiscount = item.originalPrice && item.precoVenda < item.originalPrice;
                    return (
                      <motion.div
                        key={item.id + (item.isGift ? '_g' : '')}
                        layout
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        style={{
                          backgroundColor: t.bg,
                          border: `1.5px solid ${t.border}`,
                          borderRadius: '16px',
                          padding: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                          position: 'relative',
                          transition: 'all 0.2s',
                          borderLeft: `4px solid ${item.isGift ? '#10b981' : t.accent}`
                        }}
                      >
                        {/* Card Header: Product Name & Remove button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              color: t.textMain,
                              textTransform: 'uppercase',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.nome}
                            </span>
                            {item.sku && (
                              <span style={{ fontSize: '0.6rem', color: t.textSecondary, display: 'block', marginTop: 2, fontWeight: 600 }}>
                                SKU: {item.sku}
                              </span>
                            )}
                            {item.isGift && (
                              <span style={{
                                fontSize: '0.58rem',
                                fontWeight: 900,
                                color: '#10b981',
                                backgroundColor: 'rgba(16,185,129,0.08)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-block',
                                marginTop: 4
                              }}>
                                BRINDE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id, item.isGift, item.promoRef)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: t.textSecondary,
                              opacity: 0.6,
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Card Body: Pricing info and Quantity selector */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                          {/* Quantity selector with custom colors */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  removeFromCart(item.id, item.isGift, item.promoRef);
                                } else {
                                  updateQty(item.id, -1, item.isGift, item.promoRef);
                                }
                              }}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                border: item.quantity === 1 ? '1px solid rgba(239, 68, 68, 0.2)' : `1px solid ${t.border}`,
                                backgroundColor: item.quantity === 1 ? 'rgba(239, 68, 68, 0.08)' : `${t.accent}0a`,
                                color: item.quantity === 1 ? '#ef4444' : t.accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 'bold'
                              }}
                            >
                              <Minus size={11} strokeWidth={2.5} />
                            </button>

                            <span style={{ width: 24, textAlign: 'center', fontSize: '0.8rem', fontWeight: 850, color: t.textMain }}>
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateQty(item.id, 1, item.isGift)}
                              disabled={item.isGift}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                border: `1px solid ${t.border}`,
                                backgroundColor: item.isGift ? t.bgSecondary : `${t.accent}0a`,
                                color: item.isGift ? t.textSecondary : t.accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: item.isGift ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 'bold'
                              }}
                            >
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          </div>

                          {/* Price display */}
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.62rem', color: t.textSecondary, fontWeight: 600 }}>
                              {item.quantity} x R$ {fmt(item.precoVenda)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 1 }}>
                              {hasDiscount && (
                                <span style={{ textDecoration: 'line-through', color: t.textSecondary, fontSize: '0.62rem' }}>
                                  R$ {fmt(item.originalPrice * item.quantity)}
                                </span>
                              )}
                              <span style={{ fontWeight: 900, fontSize: '0.85rem', color: item.isGift ? '#10b981' : t.textMain }}>
                                R$ {fmt(item.precoVenda * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── 3. Valor Total com itens adicionados ao carrinho em formato de Cards ── */}
          {cart.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginTop: '0.5rem',
              borderTop: `1px solid ${t.border}`,
              paddingTop: '0.75rem',
              flexShrink: 0
            }}>
              <div style={{
                backgroundColor: t.bgSecondary || '#f8fafc',
                border: `1.5px solid ${t.border}`,
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', lineHeight: 1.1 }}>
                  Total de Itens
                </span>
                <span style={{ fontWeight: 950, fontSize: '1.1rem', color: t.textMain, marginTop: 2 }}>
                  {cart.reduce((a, i) => a + i.quantity, 0)} Unidades
                </span>
              </div>
              <div style={{
                backgroundColor: `${t.accent}05`,
                border: `1.5px solid ${t.accent}20`,
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: t.accent, textTransform: 'uppercase', lineHeight: 1.1 }}>
                  Subtotal Sacola
                </span>
                <span style={{ fontWeight: 950, fontSize: '1.1rem', color: t.accent, marginTop: 2 }}>
                  R$ {fmt(totalOriginal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ════════ COLUNA DIREITA: IDENTIFICAR CLIENTE E FLUXO DE PAGAMENTO ════════ */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          minWidth: 0
        }}>

          {/* Card 1: Canal de Venda */}
          <div style={{
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: '24px',
            padding: '1.25rem',
            boxShadow: t.shadowSmall,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: t.bgSecondary || '#f1f5f9', padding: '4px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                {saleTypes.map(item => {
                  const isSelected = saleType === item.id;
                  const chMap = { balcao: '#6366f1', retirada: '#f59e0b', entrega: '#10b981' };
                  const color = chMap[item.id] || t.accent;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSaleType(item.id)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        border: 'none',
                        borderRadius: '9px',
                        backgroundColor: isSelected ? color : 'transparent',
                        color: isSelected ? '#fff' : t.textSecondary,
                        fontWeight: 750,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'all 0.2s'
                      }}
                    >
                      <item.Icon size={13} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Identificação do Cliente (Busca + Cadastro Rápido) + Indicação Parceiro */}
          <div style={{
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: '24px',
            padding: '1.25rem',
            boxShadow: t.shadowSmall,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: `1px solid ${t.border}`, paddingBottom: '0.5rem' }}>
              <UserPlus size={16} style={{ color: t.accent }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cliente & Parceiro / Indicação
              </span>
            </div>

            {/* Grid Empilhado: Identificar Cliente e Parceiro/Indicação */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Coluna 1: Identificação do Cliente */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="field-label" style={{ display: 'block', marginBottom: 5 }}>
                  {saleType === 'balcao' ? 'Identificar Cliente (Opcional)' : 'Identificar Cliente *'}
                </label>

                {client.nome ? (
                  /* Cliente Identificado */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    <div style={{
                      padding: '0.6rem 0.8rem',
                      backgroundColor: `${t.accent}05`,
                      border: `1.5px solid ${t.accent}20`,
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                          color: '#fff',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {client.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: t.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.nome.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: t.textSecondary, fontWeight: 600 }}>
                            {client.cpf ? maskCpf(client.cpf) : 'Consumidor Geral'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => { setClient({ nome: '', cpf: '', addNfce: false }); setSearchClient(''); setIsIdentifyingManual(false); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '4px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        Trocar
                      </button>
                    </div>

                    {/* Delivery Address display (sempre visível antes da confirmação para entrega) */}
                    {saleType === 'entrega' && (client.endereco || client.logradouro) && (
                      <div
                        onClick={() => {
                          setValidationClientData({
                            nome: client.nome || '',
                            cpf: client.cpf || '',
                            telefone: client.telefone || '',
                            endereco: client.endereco || client.logradouro || '',
                            numero: client.numero || '',
                            bairro: client.bairro || '',
                            cep: client.cep || '',
                            cidade: client.cidade || '',
                            uf: client.uf || ''
                          });
                          setValidationMissingFields([]);
                          setShowClientValidationModal(true);
                        }}
                        style={{
                          padding: '0.6rem 0.8rem',
                          backgroundColor: 'rgba(16,185,129,0.04)',
                          border: '1px solid rgba(16,185,129,0.15)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.08)';
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.04)';
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.15)';
                        }}
                        title="Clique para editar o endereço de entrega"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <MapPin size={12} style={{ color: '#10b981' }} />
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Endereço de Entrega
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textMain }}>
                          {client.endereco || client.logradouro}, nº {client.numero}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: t.textSecondary, fontWeight: 650 }}>
                          {client.bairro} — {client.cidade || ''} / {client.uf || ''}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: t.textSecondary, fontWeight: 600 }}>
                          CEP: {client.cep || ''}
                        </span>
                      </div>
                    )}
                  </div>
                ) : isIdentifyingManual ? (
                  /* Formulário Novo Cliente Inline */
                  <motion.div
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      backgroundColor: t.bgSecondary || t.bg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: '14px',
                      padding: '0.875rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      boxSizing: 'border-box',
                      width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textMain, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cadastrar Cliente</span>
                      <button onClick={() => setIsIdentifyingManual(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary }}><X size={14} /></button>
                    </div>

                    {/* Nome (Full Width) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input
                        value={manualClientData.nome}
                        onChange={e => setManualClientData({ ...manualClientData, nome: e.target.value })}
                        placeholder="Nome Completo *"
                        className="field-input"
                        style={{
                          height: 36,
                          padding: '0 10px',
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          backgroundColor: t.bg,
                          color: t.textMain,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Telefone e CPF (Side by Side) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <input
                          value={manualClientData.telefone}
                          onChange={e => setManualClientData({ ...manualClientData, telefone: maskPhoneInput(e.target.value) })}
                          placeholder="Telefone"
                          className="field-input"
                          style={{
                            height: 36,
                            padding: '0 10px',
                            fontSize: '0.78rem',
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            backgroundColor: t.bg,
                            color: t.textMain,
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <input
                          value={manualClientData.cpf || ''}
                          onChange={e => setManualClientData({ ...manualClientData, cpf: maskCpfInput(e.target.value) })}
                          placeholder="CPF"
                          className="field-input"
                          style={{
                            height: 36,
                            padding: '0 10px',
                            fontSize: '0.78rem',
                            borderRadius: 8,
                            border: `1px solid ${
                              manualClientData.cpf && manualClientData.cpf.replace(/\D/g, '').length === 11
                                ? (validarCpf(manualClientData.cpf) ? '#10b981' : '#ef4444')
                                : t.border
                            }`,
                            backgroundColor: t.bg,
                            color: t.textMain,
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    {/* Divisor Endereço */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Endereço (Opcional)</span>
                      <div style={{ flex: 1, borderTop: `1px dashed ${t.border}` }} />
                    </div>

                    {/* CEP e Número */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          value={manualClientData.cep}
                          onChange={e => {
                            const clean = e.target.value.replace(/\D/g, '').substring(0, 8);
                            const masked = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
                            setManualClientData({ ...manualClientData, cep: masked });
                            if (clean.length === 8) fetchCep(clean);
                          }}
                          placeholder="CEP"
                          className="field-input"
                          style={{
                            height: 36,
                            padding: '0 10px',
                            fontSize: '0.78rem',
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            backgroundColor: t.bg,
                            color: t.textMain,
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                        {cepLoading && (
                          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                            <Loader2 size={12} className="animate-spin" style={{ color: t.accent }} />
                          </div>
                        )}
                      </div>
                      <input
                        value={manualClientData.numero}
                        onChange={e => setManualClientData({ ...manualClientData, numero: e.target.value })}
                        placeholder="Nº"
                        className="field-input"
                        style={{
                          height: 36,
                          padding: '0 10px',
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          backgroundColor: t.bg,
                          color: t.textMain,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Rua / Endereço */}
                    <input
                      value={manualClientData.endereco}
                      onChange={e => setManualClientData({ ...manualClientData, endereco: e.target.value })}
                      placeholder="Rua / Endereço"
                      className="field-input"
                      style={{
                        height: 36,
                        padding: '0 10px',
                        fontSize: '0.78rem',
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        backgroundColor: t.bg,
                        color: t.textMain,
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />

                    {/* Bairro, Cidade e UF */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.6fr', gap: '0.4rem' }}>
                      <input
                        value={manualClientData.bairro}
                        onChange={e => setManualClientData({ ...manualClientData, bairro: e.target.value })}
                        placeholder="Bairro"
                        className="field-input"
                        style={{
                          height: 36,
                          padding: '0 10px',
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          backgroundColor: t.bg,
                          color: t.textMain,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        value={manualClientData.cidade}
                        onChange={e => setManualClientData({ ...manualClientData, cidade: e.target.value })}
                        placeholder="Cidade"
                        className="field-input"
                        style={{
                          height: 36,
                          padding: '0 10px',
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          backgroundColor: t.bg,
                          color: t.textMain,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        value={manualClientData.uf}
                        onChange={e => setManualClientData({ ...manualClientData, uf: e.target.value.toUpperCase().substring(0, 2) })}
                        placeholder="UF"
                        className="field-input"
                        style={{
                          height: 36,
                          padding: '0 10px',
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          backgroundColor: t.bg,
                          color: t.textMain,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!manualClientData.nome) return alert('Informe o nome do cliente.');

                        const phoneDigits = (manualClientData.telefone || '').replace(/\D/g, '');
                        if (phoneDigits && phoneDigits.length < 10) {
                          return alert('Telefone inválido (mínimo 10 dígitos com DDD).');
                        }

                        const cpfDigits = (manualClientData.cpf || '').replace(/\D/g, '');
                        if (cpfDigits) {
                          if (!validarCpf(cpfDigits)) {
                            return alert('CPF inválido. Por favor, verifique.');
                          }
                          const isCpfDuplicate = clients.some(c => {
                            const dbCpf = (c.cpf || '').replace(/\D/g, '');
                            return dbCpf === cpfDigits;
                          });
                          if (isCpfDuplicate) {
                            const existing = clients.find(c => (c.cpf || '').replace(/\D/g, '') === cpfDigits);
                            return alert(`CPF já cadastrado para o cliente: ${existing.nome.toUpperCase()}`);
                          }
                        }

                        if (saleType === 'entrega') {
                          if (!manualClientData.cep?.trim()) return alert('O CEP é obrigatório para entrega.');
                          if (!manualClientData.endereco?.trim()) return alert('O endereço (rua) é obrigatório para entrega.');
                          if (!manualClientData.numero?.trim()) return alert('O número é obrigatório para entrega.');
                          if (!manualClientData.bairro?.trim()) return alert('O bairro é obrigatório para entrega.');
                          if (!manualClientData.cidade?.trim()) return alert('A cidade é obrigatória para entrega.');
                          if (!manualClientData.uf?.trim()) return alert('O estado (UF) é obrigatório para entrega.');
                        }

                        setClient({
                          nome: manualClientData.nome,
                          telefone: manualClientData.telefone || '',
                          cpf: manualClientData.cpf || '',
                          endereco: manualClientData.endereco || '',
                          numero: manualClientData.numero || '',
                          bairro: manualClientData.bairro || '',
                          cep: manualClientData.cep || '',
                          cidade: manualClientData.cidade || '',
                          uf: manualClientData.uf || '',
                          addNfce: false
                        });
                        setIsIdentifyingManual(false);
                      }}
                      style={{
                        height: 36,
                        border: 'none',
                        borderRadius: 8,
                        backgroundColor: '#10b981',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 4,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                      onMouseLeave={e => e.currentTarget.style.opacity = 1}
                    >
                      Confirmar Cliente
                    </button>
                  </motion.div>
                ) : (
                  /* Campo de Busca de Cliente */
                  <div style={{ display: 'flex', gap: '0.4rem', position: 'relative' }}>
                    <div ref={clientSearchRef} style={{ flex: 1, position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textSecondary, pointerEvents: 'none' }} />
                      <input
                        value={searchClient}
                        onChange={e => setSearchClient(e.target.value)}
                        placeholder="CPF, nome, telefone..."
                        className="field-input"
                        style={{
                          height: 38,
                          paddingLeft: 30,
                          paddingRight: 10,
                          fontSize: '0.78rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <button
                      onClick={() => { setManualClientData({ nome: '', telefone: '', cpf: '', endereco: '', numero: '', bairro: '', cep: '', cidade: '', uf: '' }); setIsIdentifyingManual(true); }}
                      style={{
                        height: 38,
                        padding: '0 12px',
                        flexShrink: 0,
                        borderRadius: 10,
                        border: 'none',
                        background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Plus size={13} /> NOVO
                    </button>

                    {/* Clientes Dropdown (Posicionado com left:0, right:0 em relação ao parent row flex para evitar vazamento horizontal) */}
                    <AnimatePresence>
                      {searchClient.trim().length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 6,
                            backgroundColor: t.bg,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 12,
                            zIndex: 1500,
                            maxHeight: 180,
                            overflowY: 'auto',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                          }}
                        >
                          {filteredClients.length > 0 ? filteredClients.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleSelectClient(c)}
                              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', backgroundColor: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: t.textMain }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary || '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', color: '#fff', fontWeight: 900, fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: t.textMain, whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.nome.toUpperCase()}</div>
                                <div style={{ fontSize: '0.68rem', color: t.textSecondary, marginTop: '2px', fontWeight: 600 }}>{getClientMeta(c)}</div>
                              </div>
                            </button>
                          )) : (
                            <div style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  const cleanedSearch = searchClient.replace(/\D/g, '');
                                  const isPhone = cleanedSearch.length >= 10 && cleanedSearch.length <= 11;
                                  const isCpf = cleanedSearch.length === 11 && validarCpf(cleanedSearch);
                                  setManualClientData({ nome: isPhone || isCpf ? '' : searchClient, telefone: isPhone ? searchClient : '', cpf: isCpf ? searchClient : '', email: '', cep: '', endereco: '', numero: '', bairro: '', cidade: '', uf: '' });
                                  setSearchClient('');
                                  setIsIdentifyingManual(true);
                                }}
                                style={{ padding: '4px 10px', backgroundColor: t.accent, color: 'white', border: 'none', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: '0.65rem' }}
                              >
                                + Cadastrar "{searchClient}"
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Coluna 2: Indicação por Parceiro */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: `1px dashed ${t.border}`, paddingTop: '1rem' }}>
                <label className="field-label" style={{ display: 'block', marginBottom: 5 }}>
                  Identificação Parceiro
                </label>
                {selectedPartner ? (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: `${t.accent}05`,
                    border: `1.5px solid ${t.accent}20`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <Handshake size={14} style={{ color: t.accent }} />
                      <span style={{ fontWeight: 800, fontSize: '0.72rem', color: t.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedPartner.name.toUpperCase()} ({selectedPartner.tipo || 'Indicação'})
                      </span>
                    </div>
                    <button
                      onClick={() => { setSelectedPartner(null); setSearchPartner(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase' }}
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div ref={partnerSearchRef} style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textSecondary, pointerEvents: 'none' }} />
                    <input
                      value={searchPartner}
                      onChange={e => setSearchPartner(e.target.value)}
                      placeholder="Buscar parceiro ou indicação..."
                      className="field-input"
                      style={{
                        height: 38,
                        paddingLeft: 30,
                        paddingRight: 10,
                        fontSize: '0.78rem',
                        boxSizing: 'border-box'
                      }}
                    />
                    <AnimatePresence>
                      {searchPartner.trim().length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, backgroundColor: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 12, zIndex: 1500, maxHeight: 150, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                        >
                          {filteredPartners.length > 0 ? filteredPartners.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedPartner(p); setSearchPartner(''); }}
                              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', backgroundColor: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: t.textMain }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary || '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Handshake size={12} style={{ color: t.textSecondary, marginRight: 6 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name.toUpperCase()}</div>
                                <div style={{ fontSize: '0.62rem', color: t.textSecondary }}>{p.tipo || 'Parceiro'}</div>
                              </div>
                            </button>
                          )) : (
                            <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.68rem', color: t.textSecondary, fontWeight: 600 }}>
                              Nenhum parceiro encontrado
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Cupom & Frete (Taxa de entrega visível apenas para Entrega) */}
          <div style={{
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: '24px',
            padding: '1.25rem',
            boxShadow: t.shadowSmall,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>


            <div style={{ display: 'grid', gridTemplateColumns: saleType === 'entrega' ? '7fr 5fr' : '1fr', gap: '0.75rem' }}>
              {/* Cupom de Desconto */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label className="field-label">Cupom de Desconto</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <input
                    value={coupon}
                    onChange={e => setCoupon(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO"
                    disabled={!!appliedCoupon}
                    className="field-input"
                    style={{
                      flex: 1,
                      height: 44,
                      borderColor: appliedCoupon ? '#10b981' : undefined,
                      color: appliedCoupon ? '#10b981' : undefined
                    }}
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      style={{
                        height: 44,
                        padding: '0 12px',
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        border: 'none',
                        borderRadius: 12,
                        color: '#ef4444',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      style={{
                        height: 44,
                        padding: '0 12px',
                        backgroundColor: t.accentSoft,
                        border: 'none',
                        borderRadius: 12,
                        color: t.accent,
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      Aplicar
                    </button>
                  )}
                </div>
              </div>

              {/* Shipping (Frete) Input */}
              {saleType === 'entrega' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label className="field-label" style={{ textAlign: 'right' }}>Valor da Taxa de Entrega</label>
                  <input
                    value={shippingInput}
                    onChange={e => {
                      const raw = e.target.value;
                      const clean = raw.replace(/\D/g, '');
                      if (!clean || parseInt(clean) === 0) {
                        setShippingInput('');
                        setShipping(0);
                        return;
                      }
                      if (clean.length <= 5) {
                        const masked = maskCurrency(raw);
                        setShippingInput(masked);
                        const cents = parseInt(clean || '0');
                        setShipping(cents);
                      }
                    }}
                    placeholder="0,00"
                    className="field-input"
                    style={{
                      width: '50%',
                      alignSelf: 'flex-end',
                      height: 44,
                      textAlign: 'right'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Descrição dos Valores & Seleção de Formas de Pagamento */}
          <div style={{
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: '24px',
            padding: '1.25rem',
            boxShadow: t.shadowSmall,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {/* Descrição dos Valores (Tabela Resumo) */}
            <div style={{
              backgroundColor: t.bgSecondary || '#f8fafc',
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: t.textSecondary, fontWeight: 600 }}>
                <span>Subtotal Itens</span>
                <span style={{ color: t.textMain, fontWeight: 700 }}>R$ {fmt(totalOriginal)}</span>
              </div>

              {(totalPromosAplicadas + manualDiscount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>
                  <span>Promoções / Descontos</span>
                  <span style={{ fontWeight: 750 }}>− R$ {fmt(totalPromosAplicadas + manualDiscount)}</span>
                </div>
              )}

              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                  <span>Cupom ({appliedCoupon.codigo})</span>
                  <span style={{ fontWeight: 750 }}>− R$ {fmt(couponDiscount)}</span>
                </div>
              )}

              {saleType === 'entrega' && shipping > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: t.textSecondary, fontWeight: 600 }}>
                  <span>Taxa de Entrega / Frete</span>
                  <span style={{ color: t.textMain, fontWeight: 750 }}>+ R$ {fmt(shipping)}</span>
                </div>
              )}

              <div style={{ borderTop: `1px dashed ${t.border}`, marginTop: '0.4rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain, textTransform: 'uppercase' }}>Valor Total Geral</span>
                <span style={{ fontWeight: 950, fontSize: '1.15rem', color: t.accent }}>R$ {fmt(grandTotal)}</span>
              </div>
            </div>

            {/* Seleção de Formas de Pagamento (Lista Suspensa Unificada) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label" style={{ marginBottom: 0 }}>
                  Formas de Pagamento
                </label>
                {payments.length > 0 && (
                  <button type="button" onClick={() => setPayments([])}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase' }}
                  >
                    Limpar Tudo
                  </button>
                )}
              </div>

              {/* Linha de Inputs Unificada: Forma + Valor + Parcelas + ADD */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                {/* Lista Suspensa (Select) para Forma de Pagamento */}
                <select
                  value={payMethod}
                  onChange={e => {
                    setPayMethod(e.target.value);
                    setPayCode('');
                    setPayNumeroAutorizacao('');
                  }}
                  className="field-select"
                  style={{
                    height: 38,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    flex: 1.5,
                    minWidth: '120px'
                  }}
                >
                  {payMethods.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>

                {/* Input de Valor */}
                <div style={{ flex: 1.2, minWidth: '85px' }}>
                  <input
                    value={payValue}
                    onChange={e => setPayValue(maskCurrency(e.target.value))}
                    placeholder={payMethod.includes('perc') ? 'VALOR %' : 'VALOR R$'}
                    className="field-input"
                    style={{
                      height: 38,
                      fontSize: '0.8rem',
                      fontWeight: 750
                    }}
                  />
                </div>

                {/* Seleção de Parcelas (Apenas para Crédito) */}
                {payMethod === 'credito' && (
                  <select
                    value={creditInstallments}
                    onChange={e => setCreditInstallments(Number(e.target.value))}
                    className="field-select"
                    style={{
                      height: 38,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      width: 'auto',
                      minWidth: '65px'
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(x => (
                      <option key={x} value={x}>{x}x</option>
                    ))}
                  </select>
                )}

                {/* Botão ADD */}
                <motion.button
                  type="button"
                  onClick={handleAddPayment}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 2px 8px ${t.accent}25`
                  }}
                >
                  <Plus size={14} style={{ marginRight: 2 }} /> ADD
                </motion.button>
              </div>

              {/* Detalhes de Pagamento Manual (Exibe apenas se o método não possuir integração ativa) */}
              {['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) && !isCurrentPaymentIntegrated && !isEverythingInactive && (
                <div style={{ padding: '0.65rem', backgroundColor: t.bgSecondary || t.bg, border: `1.5px solid ${t.border}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="field-label" style={{ fontSize: '0.6rem', fontWeight: 800, display: 'block', marginBottom: 2 }}>
                    Dados da Transação Manual
                  </span>

                  {/* Grid de Inputs: Bandeira e Código/NSU */}
                  <div style={{ display: 'grid', gridTemplateColumns: ['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) ? '1fr 1fr' : '1fr', gap: '0.4rem' }}>
                    {['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) && (
                      <div>
                        <select
                          value={payBandeira}
                          onChange={e => setPayBandeira(e.target.value)}
                          className="field-select"
                          style={{ width: '100%', height: 34, padding: '0 4px', fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          <option value="">Selecione a Bandeira *</option>
                          <option value="99">Outra / Sem Integr.</option>
                          <option value="01">Visa</option>
                          <option value="02">Mastercard</option>
                          <option value="03">Amex</option>
                          <option value="04">Sorocred</option>
                          <option value="05">Diners</option>
                          <option value="06">Elo</option>
                          <option value="07">Hipercard</option>
                        </select>
                      </div>
                    )}
                    <input
                      value={payNumeroAutorizacao}
                      onChange={e => setPayNumeroAutorizacao(e.target.value)}
                      placeholder="Aut. / NSU / Código Transação *"
                      className="field-input"
                      style={{ width: '100%', height: 34, padding: '0 8px', fontSize: '0.72rem', fontWeight: 600 }}
                    />
                  </div>

                  {/* Dados de Credenciadora (Apenas para Cartões) */}
                  {['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.1rem' }}>
                      {/* Seleção de Credenciadora Padrão */}
                      <div>
                        <select
                          value={
                            ['STONE', 'PAGSEGURO', 'CIELO', 'REDE', 'GETNET', 'MERCADO PAGO'].includes((payCredenciadora || '').toUpperCase())
                              ? (payCredenciadora || '').toUpperCase()
                              : payCredenciadora ? 'OUTRA' : ''
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'OUTRA') {
                              setPayCredenciadora('Outra');
                              setPayCnpjCredenciadora('');
                            } else {
                              setPayCredenciadora(val);
                              const found = [
                                { name: 'STONE', cnpj: '16501555000157' },
                                { name: 'PAGSEGURO', cnpj: '08561701000101' },
                                { name: 'CIELO', cnpj: '02030493000157' },
                                { name: 'REDE', cnpj: '01425787000104' },
                                { name: 'GETNET', cnpj: '10440482000154' },
                                { name: 'MERCADO PAGO', cnpj: '10573521000191' }
                              ].find(x => x.name === val);
                              setPayCnpjCredenciadora(found ? found.cnpj : '');
                            }
                          }}
                          className="field-select"
                          style={{ width: '100%', height: 34, padding: '0 4px', fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          <option value="">Credenciadora / Adquirente *</option>
                          <option value="STONE">Stone</option>
                          <option value="PAGSEGURO">PagSeguro</option>
                          <option value="CIELO">Cielo</option>
                          <option value="REDE">Rede</option>
                          <option value="GETNET">Getnet</option>
                          <option value="MERCADO PAGO">Mercado Pago</option>
                          <option value="OUTRA">Outra (Digitar Manual)</option>
                        </select>
                      </div>

                      {/* Input de CNPJ Credenciadora */}
                      <input
                        value={payCnpjCredenciadora}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').substring(0, 14);
                          setPayCnpjCredenciadora(val);
                        }}
                        disabled={!!payCredenciadora && payCredenciadora !== 'Outra'}
                        placeholder="CNPJ Credenciadora *"
                        className="field-input"
                        style={{
                          width: '100%',
                          height: 34,
                          padding: '0 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: (payCredenciadora && payCredenciadora !== 'Outra') ? `${t.border}20` : 'transparent',
                          cursor: (payCredenciadora && payCredenciadora !== 'Outra') ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                  )}

                  {/* Se selecionou Outra Credenciadora, mostrar campo de digitação do nome */}
                  {['credito', 'debito', 'alimentacao', 'refeicao'].includes(payMethod) &&
                    !['STONE', 'PAGSEGURO', 'CIELO', 'REDE', 'GETNET', 'MERCADO PAGO'].includes((payCredenciadora || '').toUpperCase()) &&
                    payCredenciadora !== '' && (
                      <input
                        value={payCredenciadora}
                        onChange={e => setPayCredenciadora(e.target.value)}
                        placeholder="Nome da Credenciadora Manual *"
                        className="field-input"
                        style={{ width: '100%', height: 34, padding: '0 8px', fontSize: '0.72rem', fontWeight: 600, marginTop: '0.1rem' }}
                      />
                    )}
                </div>
              )}
            </div>

            {/* List of active payment rows */}
            {payments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                {payments.map((row, index) => {
                  const item = payMethods.find(m => m.id === row.methodId);
                  if (!item) return null;
                  const rowValueInCents = row.value || 0;
                  const isSelected = rowValueInCents > 0;
                  const IconComponent = item.Icon;
                  const isCredit = item.id === 'credito';
                  const isCardOrPix = ['credito', 'debito', 'pix', 'alimentacao', 'refeicao'].includes(item.id);

                  const hasIntegration = (item.id === 'pix' && (integrations?.routePix === 'infinitypay' || integrations?.routePix === 'pagbank_maquininha' || integrations?.routePix === 'pagbank_tela')) ||
                    (item.id === 'credito' && (integrations?.routeCredito === 'infinitypay' || integrations?.routeCredito === 'pagbank_maquininha')) ||
                    (item.id === 'debito' && (integrations?.routeDebito === 'pagbank_maquininha')) ||
                    (item.id === 'link_pagamento' && integrations?.routeLink === 'infinitypay');

                  const BRAND_LABELS = {
                    '01': 'Visa',
                    '02': 'Mastercard',
                    '03': 'Amex',
                    '04': 'Sorocred',
                    '05': 'Diners',
                    '06': 'Elo',
                    '07': 'Hipercard',
                    '99': 'Outra'
                  };

                  return (
                    <div key={row.id} style={{ border: `1px solid ${isSelected ? item.color : t.border}`, borderRadius: '10px', padding: '0.5rem', backgroundColor: isSelected ? `${item.color}03` : t.bg, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: isSelected ? item.color : t.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconComponent size={10} style={{ color: isSelected ? '#fff' : t.textSecondary }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '0.68rem', color: isSelected ? item.color : t.textMain }}>
                            {item.label} <span style={{ fontSize: '0.55rem', fontWeight: 600, color: t.textSecondary }}>#{index + 1}</span>
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {/* Static installments display */}
                          <span style={{ fontSize: '0.65rem', fontWeight: 750, color: t.textSecondary, padding: '2px 6px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 5, border: `1px solid ${t.border}` }}>
                            {row.installments || 1}x
                          </span>

                          {/* Static read-only value display */}
                          <span style={{ fontSize: '0.75rem', fontWeight: 850, color: t.textMain, minWidth: 70, textAlign: 'right', marginRight: 4 }}>
                            R$ {fmt(row.value)}
                          </span>

                          {hasIntegration && (
                            <button type="button"
                              onClick={() => {
                                setPayMethod(row.methodId);
                                setActiveRowId(row.id);
                                const val = row.value || 0;
                                if (val <= 0) return alert('Insira um valor.');

                                if (row.methodId === 'pix') {
                                  if (integrations?.routePix === 'infinitypay' && integrations?.infinitypayAtivo) handleCreateInfinityPayOrder(val);
                                  else if (integrations?.routePix === 'pagbank_tela') handleCreateScreenPixOrder(val);
                                  else { setTerminalAmount(val); setTerminalInstallments(1); setTerminalState('idle'); setTerminalErrorMsg(''); setTerminalCardBrand(''); setTerminalAuthCode(''); setShowTerminalModal(true); }
                                } else if (row.methodId === 'credito') {
                                  if (integrations?.routeCredito === 'infinitypay' && integrations?.infinitypayAtivo) handleCreateInfinityPayOrder(val);
                                  else { setTerminalAmount(val); setTerminalInstallments(row.installments || 1); setTerminalState('idle'); setTerminalErrorMsg(''); setTerminalCardBrand(''); setTerminalAuthCode(''); setShowTerminalModal(true); }
                                } else if (row.methodId === 'debito') {
                                  setTerminalAmount(val); setTerminalInstallments(1); setTerminalState('idle'); setTerminalErrorMsg(''); setTerminalCardBrand(''); setTerminalAuthCode(''); setShowTerminalModal(true);
                                } else if (row.methodId === 'link_pagamento') {
                                  if (integrations?.routeLink === 'infinitypay' && integrations?.infinitypayAtivo) handleCreateInfinityPayOrder(val);
                                }
                              }}
                              style={{ height: 26, width: 26, borderRadius: 5, border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Sparkles size={10} />
                            </button>
                          )}

                          <button type="button" onClick={() => setPayments(payments.filter(r => r.id !== row.id))}
                            style={{ height: 26, width: 26, borderRadius: 5, border: 'none', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>

                      {/* Read-only details banner */}
                      {isSelected && isCardOrPix && (
                        <div style={{
                          padding: '4px 8px',
                          backgroundColor: t.bgSecondary || 'rgba(0,0,0,0.02)',
                          border: `1px solid ${t.border}`,
                          borderRadius: 6,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.4rem',
                          marginTop: 2
                        }}>
                          {row.methodId === 'pix' ? (
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary }}>
                              <strong>CÓDIGO/NSU:</strong> {row.code || 'N/A'}
                            </span>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary }}>
                                <strong>CREDENCIADORA:</strong> {row.credenciadora || 'N/A'}
                              </span>
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary }}>
                                <strong>CNPJ:</strong> {row.cnpj_credenciadora || 'N/A'}
                              </span>
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary }}>
                                <strong>BANDEIRA:</strong> {BRAND_LABELS[row.bandeira_operadora] || 'Outra'}
                              </span>
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary }}>
                                <strong>NSU:</strong> {row.code || 'N/A'}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order status for delivery/retirada */}
            {saleType !== 'balcao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase' }}>Status do Pedido</span>
                <select value={paymentPolicy} onChange={e => setPaymentPolicy(e.target.value)}
                  style={{ width: '100%', height: 32, padding: '0 6px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: '0.72rem', outline: 'none', backgroundColor: t.bgSecondary || t.bg, color: t.textMain, cursor: 'pointer' }}
                >
                  {policies.filter(p => p.id.startsWith('pagamento_')).map(p => <option key={p.id} value={p.id}>{p.label.toUpperCase()}</option>)}
                </select>
              </div>
            )}

            {/* Horizontal Side-by-Side Footer Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
              {/* Remaining or Change indicators */}
              {!paymentPolicy.startsWith('pagamento_') && (remaining > 0 || change > 0) ? (
                <div style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: `1.5px solid ${remaining > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  backgroundColor: remaining > 0 ? 'rgba(239,68,68,0.02)' : 'rgba(16,185,129,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: '46px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, color: remaining > 0 ? '#ef4444' : '#10b981', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {remaining > 0 ? 'Falta Pagar' : 'Troco Cliente'}
                  </span>
                  <span style={{ fontWeight: 950, fontSize: '1.05rem', color: remaining > 0 ? '#ef4444' : '#10b981', marginTop: 2 }}>
                    R$ {fmt(remaining > 0 ? remaining : change)}
                  </span>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: `1.5px solid ${t.border}`,
                  backgroundColor: t.bgSecondary || '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: '46px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', lineHeight: 1.1 }}>
                    Total Pago
                  </span>
                  <span style={{ fontWeight: 950, fontSize: '1.05rem', color: t.textMain, marginTop: 2 }}>
                    R$ {fmt(totalPaid)}
                  </span>
                </div>
              )}

              {/* Finalize Button */}
              <motion.button
                type="button"
                disabled={loading || (!paymentPolicy.startsWith('pagamento_') && remaining > 0) || !cart.length}
                onClick={finalizeSale}
                whileHover={{ scale: (!loading && (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0) ? 1.02 : 1 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1.2,
                  height: 46,
                  borderRadius: '12px',
                  border: 'none',
                  background: (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : t.bgSecondary || '#f1f5f9',
                  color: (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0 ? 'white' : t.textSecondary,
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
                  opacity: (paymentPolicy.startsWith('pagamento_') || remaining === 0) && cart.length > 0 ? 1 : 0.5,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                Finalizar
              </motion.button>
            </div>
          </div>
        </div>

      </div>


      {showClientValidationModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '480px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: `1px solid ${t.border}`, paddingBottom: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User2 size={18} color="white" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: t.textMain, margin: 0 }}>Validar Dados do Cliente</h3>
                <span style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 600 }}>Tipo de Venda: <span style={{ textTransform: 'capitalize', color: t.accent }}>{saleType}</span></span>
              </div>
            </div>

            {/* Warning Message */}
            <div style={{ backgroundColor: '#ef44440a', border: '1px solid #ef444430', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', textAlign: 'left' }}>
              <AlertCircle size={16} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>Dados obrigatórios ausentes:</div>
                <div style={{ fontSize: '0.72rem', color: t.textMain, marginTop: 2, fontWeight: 500 }}>
                  Preencha os campos obrigatórios para prosseguir: <strong>{validationMissingFields.join(', ')}</strong>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px', textAlign: 'left' }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nome *</label>
                <input
                  value={validationClientData.nome}
                  onChange={e => setValidationClientData({ ...validationClientData, nome: e.target.value })}
                  placeholder="Nome do cliente"
                  className="field-input"
                  style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Nome') || validationMissingFields.includes('Identificação do Cliente') ? '#ef4444' : undefined }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
                {/* CPF */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>CPF *</label>
                  <input
                    value={validationClientData.cpf}
                    onChange={e => setValidationClientData({ ...validationClientData, cpf: maskCpfInput(e.target.value) })}
                    placeholder="000.000.000-00"
                    className="field-input"
                    style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('CPF') ? '#ef4444' : undefined }}
                  />
                </div>
                {/* Telefone */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Telefone *</label>
                  <input
                    value={validationClientData.telefone}
                    onChange={e => setValidationClientData({ ...validationClientData, telefone: maskPhoneInput(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="field-input"
                    style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Telefone') ? '#ef4444' : undefined }}
                  />
                </div>
              </div>

              {saleType === 'entrega' && (
                <>
                  <div style={{ borderTop: `1px dashed ${t.border}`, marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Endereço de Entrega</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                    {/* CEP */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>CEP *</label>
                      <input
                        value={validationClientData.cep}
                        onChange={e => {
                          const clean = e.target.value.replace(/\D/g, '').substring(0, 8);
                          const masked = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
                          setValidationClientData({ ...validationClientData, cep: masked });
                          if (clean.length === 8) fetchCepForValidation(clean);
                        }}
                        placeholder="00000-000"
                        className="field-input"
                        style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('CEP') ? '#ef4444' : undefined }}
                      />
                    </div>
                    {/* Endereço */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Rua / Endereço *</label>
                      <input
                        value={validationClientData.endereco}
                        onChange={e => setValidationClientData({ ...validationClientData, endereco: e.target.value })}
                        placeholder="Av. Paulista, etc."
                        className="field-input"
                        style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Endereço') ? '#ef4444' : undefined }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {/* Número */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Número *</label>
                      <input
                        value={validationClientData.numero}
                        onChange={e => setValidationClientData({ ...validationClientData, numero: e.target.value })}
                        placeholder="123"
                        className="field-input"
                        style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Número') ? '#ef4444' : undefined }}
                      />
                    </div>
                    {/* Bairro */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Bairro *</label>
                      <input
                        value={validationClientData.bairro}
                        onChange={e => setValidationClientData({ ...validationClientData, bairro: e.target.value })}
                        placeholder="Centro"
                        className="field-input"
                        style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Bairro') ? '#ef4444' : undefined }}
                      />
                    </div>
                    {/* UF */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>UF *</label>
                      <input
                        value={validationClientData.uf}
                        onChange={e => setValidationClientData({ ...validationClientData, uf: e.target.value.toUpperCase().substring(0, 2) })}
                        placeholder="SP"
                        className="field-input"
                        style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('UF') ? '#ef4444' : undefined }}
                      />
                    </div>
                  </div>

                  {/* Cidade */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Cidade *</label>
                    <input
                      value={validationClientData.cidade}
                      onChange={e => setValidationClientData({ ...validationClientData, cidade: e.target.value })}
                      placeholder="São Paulo"
                      className="field-input"
                      style={{ height: 38, fontSize: '0.82rem', borderColor: validationMissingFields.includes('Cidade') ? '#ef4444' : undefined }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.75rem' }}>
              <button
                onClick={() => setShowClientValidationModal(false)}
                style={{
                  flex: 1,
                  height: 38,
                  backgroundColor: 'transparent',
                  color: t.textSecondary,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Voltar ao Caixa
              </button>
              <button
                onClick={saveValidationClient}
                disabled={loading}
                style={{
                  flex: 1.5,
                  height: 38,
                  backgroundColor: t.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Salvar e Continuar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showTerminalModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '420px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              padding: '2rem',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Card Terminal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={18} color="white" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: t.textMain, margin: 0 }}>Terminal PagBank</h3>
            </div>

            {/* State Machine Views */}
            {terminalState === 'idle' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Valor do Pagamento</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 850, color: t.textMain, marginBottom: '1.5rem' }}>R$ {fmt(terminalAmount)}</div>

                {payMethod === 'credito' && (
                  <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Opções de Parcelamento</span>
                    <select
                      value={terminalInstallments}
                      onChange={e => setTerminalInstallments(Number(e.target.value))}
                      style={{ width: '100%', height: 42, padding: '0 10px', backgroundColor: t.bgSecondary, border: t.borderBold, borderRadius: t.radiusSmall, fontWeight: 600, fontSize: '0.9rem', color: t.textMain, outline: 'none', fontFamily: 'inherit' }}
                    >
                      <option value={1}>1x à Vista (Sem acréscimo)</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(x => (
                        <option key={x} value={x}>{x}x de R$ {fmt(Math.ceil(terminalAmount / x))}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    onClick={handleTerminalCharge}
                    style={{
                      height: 48,
                      border: 'none',
                      borderRadius: t.radiusSmall,
                      background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(0,181,116,0.25)'
                    }}
                  >
                    <Check size={18} /> Iniciar Cobrança
                  </button>
                  <button
                    onClick={() => setShowTerminalModal(false)}
                    style={{
                      height: 40,
                      border: t.borderBold,
                      borderRadius: t.radiusSmall,
                      backgroundColor: t.bgSecondary,
                      color: t.textMain,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Voltar ao PDV
                  </button>
                </div>
              </div>
            )}

            {terminalState === 'sending' && (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <Loader2 size={48} className="animate-spin" style={{ color: '#00B574' }} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.textMain, marginBottom: 8 }}>Enviando dados...</h4>
                <p style={{ fontSize: '0.82rem', color: t.textSecondary, margin: 0 }}>Enviando solicitação de R$ {fmt(terminalAmount)} para o terminal.</p>
              </div>
            )}

            {terminalState === 'waiting_card' && (
              <div style={{ padding: '1rem 0' }}>
                {/* NFC Wave Animation */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 80, marginBottom: '1.5rem', position: 'relative' }}>
                  <motion.div
                    animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(0,181,116,0.2)' }}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                    style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(0,181,116,0.3)' }}
                  />
                  <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#00B574', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <Smartphone size={24} color="white" />
                  </div>
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: t.textMain, marginBottom: 8 }}>Aproxime ou Insira</h4>
                <p style={{ fontSize: '0.85rem', color: t.textSecondary, marginBottom: '1.5rem' }}>Por favor, insira, passe ou aproxime o cartão do terminal PagBank.</p>

                <button
                  onClick={() => setShowTerminalModal(false)}
                  style={{
                    height: 38,
                    padding: '0 1.25rem',
                    border: t.borderBold,
                    borderRadius: t.radiusSmall,
                    backgroundColor: t.bgSecondary,
                    color: t.textMain,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Abortar Operação
                </button>
              </div>
            )}

            {terminalState === 'processing' && (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <Loader2 size={48} className="animate-spin" style={{ color: '#00B574' }} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.textMain, marginBottom: 8 }}>Processando Transação</h4>
                <p style={{ fontSize: '0.82rem', color: t.textSecondary, margin: 0 }}>Comunicando com a operadora... Não remova o cartão.</p>
              </div>
            )}

            {terminalState === 'success' && (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>
                  <Check size={32} strokeWidth={3} />
                </div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginBottom: 4 }}>Pagamento Aprovado!</h4>
                <p style={{ fontSize: '0.82rem', color: t.textSecondary, marginBottom: '1rem' }}>Venda autorizada com sucesso.</p>

                <div style={{ backgroundColor: t.bgSecondary, padding: '0.75rem', borderRadius: t.radiusSmall, border: t.border, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', textAlign: 'left' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block' }}>Bandeira</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textMain }}>{terminalCardBrand}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block' }}>Autorização</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: t.textMain }}>{terminalAuthCode}</span>
                  </div>
                </div>
              </div>
            )}

            {terminalState === 'error' && (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(239,68,68,0.3)' }}>
                  <X size={32} strokeWidth={3} />
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Erro no Pagamento</h4>
                <p style={{ fontSize: '0.85rem', color: t.textMain, fontWeight: 600, marginBottom: '1.5rem' }}>{terminalErrorMsg}</p>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleTerminalCharge}
                    style={{
                      flex: 1,
                      height: 40,
                      border: 'none',
                      borderRadius: t.radiusSmall,
                      backgroundColor: t.accent,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    Tentar Novamente
                  </button>
                  <button
                    onClick={() => setShowTerminalModal(false)}
                    style={{
                      flex: 1,
                      height: 40,
                      border: t.borderBold,
                      borderRadius: t.radiusSmall,
                      backgroundColor: t.bgSecondary,
                      color: t.textMain,
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    Voltar ao PDV
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showPixChoiceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '440px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              padding: '2.25rem',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0,181,116,0.2)' }}>
                <QrCode size={20} color="white" />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 850, color: t.textMain, margin: 0, letterSpacing: '-0.02em' }}>Opções de Exibição do PIX</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: t.textSecondary, marginBottom: '2rem', lineHeight: '1.5', fontWeight: 500 }}>
              Selecione onde deseja exibir o QR Code do PIX no valor de <strong style={{ color: t.textMain, fontWeight: 750 }}>R$ {fmt(screenPixAmount)}</strong> para escaneamento pelo cliente:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <button
                onClick={() => {
                  setShowPixChoiceModal(false);
                  setTerminalAmount(screenPixAmount);
                  setTerminalState('idle');
                  setTerminalErrorMsg('');
                  setTerminalCardBrand('');
                  setTerminalAuthCode('');
                  setShowTerminalModal(true);
                }}
                style={{
                  height: 54,
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)',
                  color: '#fff',
                  fontWeight: 750,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  boxShadow: '0 4px 14px rgba(0,181,116,0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Smartphone size={20} /> Exibir na Maquininha (Terminal)
              </button>

              <button
                onClick={() => {
                  setShowPixChoiceModal(false);
                  handleCreateScreenPixOrder(screenPixAmount);
                }}
                style={{
                  height: 54,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  backgroundColor: t.bgSecondary,
                  color: t.textMain,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                <QrCode size={20} /> Exibir na Tela do Computador (CRM)
              </button>

              <div style={{ height: '1px', backgroundColor: t.border, margin: '0.5rem 0' }}></div>

              <button
                onClick={() => setShowPixChoiceModal(false)}
                style={{
                  height: 40,
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  backgroundColor: 'transparent',
                  color: t.textSecondary,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar e Voltar ao PDV
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showScreenPixModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '460px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              padding: '2rem',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={18} color="white" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: t.textMain, margin: 0 }}>Checkout PIX na Tela</h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.bgSecondary, padding: '0.75rem 1.25rem', borderRadius: t.radiusSmall, border: t.border, marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', letterSpacing: '0.04em' }}>Valor a Pagar</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 850, color: t.textMain }}>R$ {fmt(screenPixAmount)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', letterSpacing: '0.04em' }}>Tempo Restante</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: screenPixTimer < 60 ? '#ef4444' : t.textMain }}>
                  {Math.floor(screenPixTimer / 60)}:{(screenPixTimer % 60) < 10 ? '0' : ''}{screenPixTimer % 60}
                </span>
              </div>
            </div>

            <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 1.5rem', border: t.borderBold, borderRadius: t.radiusSmall, backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              {screenPixApiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#00B574' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary }}>Gerando QR Code...</span>
                </div>
              ) : (
                <>
                  <motion.div
                    animate={{ y: [-70, 70] }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                    style={{
                      position: 'absolute',
                      left: '8%',
                      right: '8%',
                      height: '3px',
                      background: 'rgba(0, 181, 116, 0.75)',
                      boxShadow: '0 0 10px rgba(0, 181, 116, 0.8)',
                      borderRadius: '2px',
                      zIndex: 10
                    }}
                  />

                  {screenPixImageUrl ? (
                    <img
                      src={screenPixImageUrl}
                      alt="PIX QR Code"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <svg width="170" height="170" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
                      <rect width="100" height="100" fill="white" />
                      <rect x="0" y="0" width="30" height="30" fill="#000000" />
                      <rect x="5" y="5" width="20" height="20" fill="#ffffff" />
                      <rect x="9" y="9" width="12" height="12" fill="#00B574" />

                      <rect x="70" y="0" width="30" height="30" fill="#000000" />
                      <rect x="75" y="5" width="20" height="20" fill="#ffffff" />
                      <rect x="79" y="9" width="12" height="12" fill="#00B574" />

                      <rect x="0" y="70" width="30" height="30" fill="#000000" />
                      <rect x="5" y="75" width="20" height="20" fill="#ffffff" />
                      <rect x="9" y="79" width="12" height="12" fill="#00B574" />

                      <rect x="70" y="70" width="10" height="10" fill="#000000" />
                      <rect x="80" y="80" width="10" height="10" fill="#000000" />
                      <rect x="70" y="80" width="5" height="5" fill="#00B574" />
                      <rect x="90" y="70" width="10" height="10" fill="#00B574" />
                      <rect x="75" y="90" width="15" height="5" fill="#000000" />

                      <rect x="35" y="5" width="10" height="5" fill="#000000" />
                      <rect x="50" y="10" width="15" height="5" fill="#000000" />
                      <rect x="40" y="20" width="5" height="15" fill="#00B574" />
                      <rect x="55" y="20" width="10" height="10" fill="#000000" />

                      <rect x="5" y="35" width="15" height="10" fill="#000000" />
                      <rect x="25" y="40" width="10" height="5" fill="#000000" />
                      <rect x="0" y="50" width="5" height="15" fill="#000000" />
                      <rect x="10" y="55" width="15" height="10" fill="#00B574" />

                      <rect x="35" y="35" width="30" height="30" fill="#000000" />
                      <rect x="40" y="40" width="20" height="20" fill="#ffffff" />
                      <rect x="45" y="45" width="10" height="10" fill="#00B574" />

                      <rect x="70" y="35" width="10" height="15" fill="#000000" />
                      <rect x="85" y="40" width="10" height="10" fill="#00B574" />
                      <rect x="90" y="55" width="10" height="10" fill="#000000" />
                      <rect x="75" y="60" width="10" height="5" fill="#000000" />

                      <rect x="35" y="70" width="10" height="15" fill="#00B574" />
                      <rect x="50" y="75" width="15" height="10" fill="#000000" />
                      <rect x="40" y="90" width="25" height="10" fill="#000000" />

                      <circle cx="50" cy="50" r="14" fill="#ffffff" />
                      <polygon points="50,42 57,50 50,58 43,50" fill="#00B574" />
                      <polygon points="50,45 54,50 50,55 46,50" fill="#ffffff" />
                    </svg>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {screenPixLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ color: '#00B574' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: t.textSecondary }}>Aguardando pagamento pelo cliente...</span>
                </>
              ) : (
                <>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#10b981' }}>Pagamento Aprovado! Processando...</span>
                </>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 4, letterSpacing: '0.04em' }}>Pix Copia e Cola</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  readOnly
                  type="text"
                  value={screenPixApiLoading ? 'Carregando chave...' : (screenPixCode || 'Gerando chave...')}
                  style={{
                    flex: 1,
                    height: 38,
                    backgroundColor: t.bgSecondary,
                    border: t.border,
                    borderRadius: t.radiusSmall,
                    padding: '0 10px',
                    fontSize: '0.78rem',
                    color: t.textSecondary,
                    fontFamily: 'monospace',
                    outline: 'none',
                    textOverflow: 'ellipsis'
                  }}
                />
                <button
                  onClick={() => {
                    if (screenPixCode) {
                      navigator.clipboard.writeText(screenPixCode);
                      setScreenPixCopied(true);
                      setTimeout(() => setScreenPixCopied(false), 2000);
                    }
                  }}
                  style={{
                    height: 38,
                    width: 38,
                    backgroundColor: screenPixCopied ? '#10b981' : t.bgSecondary,
                    border: screenPixCopied ? 'none' : t.borderBold,
                    color: screenPixCopied ? 'white' : t.textMain,
                    borderRadius: t.radiusSmall,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="Copiar Pix Copia e Cola"
                >
                  {screenPixCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {integrations?.plugpagAmbiente === 'producao' ? (
              <div style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: `1px dashed rgba(59,130,246,0.3)`, borderRadius: t.radiusSmall, padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Recebimento via Tela (Produção)</span>
                <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                  Verifique o crédito em sua conta bancária / painel PagBank e clique em **Confirmar Recebimento Manual** para registrar a venda.
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'rgba(0,181,116,0.06)', border: `1px dashed rgba(0,181,116,0.3)`, borderRadius: t.radiusSmall, padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00B574', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Ambiente de Homologação</span>
                <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                  Para facilitar testes, esta transação simula um recebimento instantâneo e será **aprovada automaticamente** em 6 segundos.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => handleApproveScreenPix(true)}
                style={{
                  height: 42,
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Check size={16} /> Confirmar Recebimento Manual
              </button>
              <button
                onClick={() => setShowScreenPixModal(false)}
                style={{
                  height: 38,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  backgroundColor: t.bgSecondary,
                  color: t.textMain,
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar Operação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showInfinityPayModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '460px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
              padding: '2rem',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.accent || '#F43F5E' }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.textMain, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checkout InfinityPay</span>
              </div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                backgroundColor: infinityPayTimer < 60 ? 'rgba(239,68,68,0.1)' : t.bgSecondary,
                color: infinityPayTimer < 60 ? '#ef4444' : t.textSecondary,
                padding: '4px 10px',
                borderRadius: 12,
                border: t.border
              }}>
                {Math.floor(infinityPayTimer / 60)}:{(infinityPayTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <div style={{ backgroundColor: t.bgSecondary, padding: '1.25rem', borderRadius: t.radiusMedium, marginBottom: '1.5rem', border: t.border }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 4, letterSpacing: '0.04em' }}>Valor a Pagar</span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: t.accent || '#F43F5E' }}>R$ {fmt(infinityPayAmount)}</div>
              <span style={{ fontSize: '0.72rem', color: t.textSecondary, display: 'block', marginTop: 4 }}>ID: {infinityPayOrderNsu}</span>
            </div>

            <div style={{
              width: 220,
              height: 220,
              backgroundColor: 'white',
              borderRadius: t.radiusMedium,
              padding: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
              {infinityPayApiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: t.accent || '#F43F5E' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Gerando link...</span>
                </div>
              ) : infinityPayQrCodeUrl ? (
                <>
                  <img src={infinityPayQrCodeUrl} alt="QR Code de Pagamento" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  {infinityPayPaid && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: t.radiusMedium, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 54, height: 54, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>
                        <Check size={28} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Pagamento Confirmado!</span>
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>Erro ao carregar QR Code</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyEncoding: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {!infinityPayPaid ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ color: t.accent || '#F43F5E' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: t.textSecondary }}>Aguardando pagamento do cliente...</span>
                </>
              ) : (
                <>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#10b981' }}>Pagamento Aprovado! Processando...</span>
                </>
              )}
            </div>

            {infinityPayUrl && (
              <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 4, letterSpacing: '0.04em' }}>Link de Pagamento</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    readOnly
                    type="text"
                    value={infinityPayUrl}
                    style={{
                      flex: 1,
                      height: 38,
                      backgroundColor: t.bgSecondary,
                      border: t.border,
                      borderRadius: t.radiusSmall,
                      padding: '0 10px',
                      fontSize: '0.78rem',
                      color: t.textSecondary,
                      fontFamily: 'monospace',
                      outline: 'none',
                      textOverflow: 'ellipsis'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (infinityPayUrl) {
                        navigator.clipboard.writeText(infinityPayUrl);
                        setInfinityPayCopied(true);
                        setTimeout(() => setInfinityPayCopied(false), 2000);
                      }
                    }}
                    style={{
                      height: 38,
                      width: 38,
                      backgroundColor: infinityPayCopied ? '#10b981' : t.bgSecondary,
                      border: infinityPayCopied ? 'none' : t.borderBold,
                      color: infinityPayCopied ? 'white' : t.textMain,
                      borderRadius: t.radiusSmall,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Copiar Link de Pagamento"
                  >
                    {infinityPayCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}

            {integrations?.infinitypayAmbiente === 'producao' ? (
              <div style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: `1px dashed rgba(59,130,246,0.3)`, borderRadius: t.radiusSmall, padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Recebimento via InfinityPay (Produção)</span>
                <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                  O sistema está monitorando ativamente a liquidação na API InfinityPay. Se necessário, confirme em sua conta e clique em **Confirmar Recebimento Manual** para registrar a venda.
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'rgba(0,181,116,0.06)', border: `1px dashed rgba(0,181,116,0.3)`, borderRadius: t.radiusSmall, padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00B574', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Ambiente de Homologação</span>
                <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0, lineHeight: 1.4 }}>
                  Para facilitar testes, esta transação simula um recebimento online e será **aprovada automaticamente** em 8 segundos.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => handleApproveInfinityPay(true, infinityPayOrderNsu)}
                style={{
                  height: 42,
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  background: 'linear-gradient(135deg, #00B574 0%, #008A56 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Check size={16} /> Confirmar Recebimento Manual
              </button>
              <button
                onClick={() => setShowInfinityPayModal(false)}
                style={{
                  height: 38,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  backgroundColor: t.bgSecondary,
                  color: t.textMain,
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar Operação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isSuccess && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1.5rem' }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            style={{
              backgroundColor: t.bg,
              border: `1px solid ${t.border}`,
              width: '100%',
              maxWidth: '440px',
              borderRadius: t.radiusMedium,
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <div style={{ width: 70, height: 70, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>
              <Check size={36} strokeWidth={3} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: t.textMain, marginBottom: '0.25rem' }}>Venda Concluída!</h2>
            <p style={{ color: t.textSecondary, fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.82rem' }}>O registro foi salvo no banco de dados.</p>

            {finalChange > 0 && (
              <div style={{ backgroundColor: t.bgSecondary, padding: '1rem', borderRadius: t.radiusSmall, marginBottom: '1.25rem', border: t.border }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>Troco do Cliente</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 850, color: '#059669' }}>R$ {fmt(finalChange)}</div>
              </div>
            )}

            <div style={{ backgroundColor: t.bgSecondary, padding: '1rem 1.25rem', border: `2px dashed ${t.border}`, borderRadius: 10, marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center', letterSpacing: '0.08em' }}>— Resumo do Pedido —</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>
                <span>Itens ({cart.reduce((acc, i) => acc + i.quantity, 0)})</span>
                <span>R$ {fmt(totalOriginal)}</span>
              </div>

              {totalPromosAplicadas > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.78rem', color: t.accent, fontWeight: 650 }}>
                  <span>Desconto de Promos</span>
                  <span>− R$ {fmt(totalPromosAplicadas)}</span>
                </div>
              )}

              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.78rem', color: '#10b981', fontWeight: 650 }}>
                  <span>Cupom ({appliedCoupon.codigo})</span>
                  <span>− R$ {fmt(couponDiscount)}</span>
                </div>
              )}

              {manualDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.78rem', color: t.accent, fontWeight: 650 }}>
                  <span>Desconto Manual {manualDiscountDetail?.type === 'perc' ? `(${manualDiscountDetail.value}%)` : ''}</span>
                  <span>− R$ {fmt(manualDiscount)}</span>
                </div>
              )}

              {shipping > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.78rem', color: t.textMain, fontWeight: 650 }}>
                  <span>Frete / Taxas</span>
                  <span>+ R$ {fmt(shipping)}</span>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${t.border}`, margin: '8px 0 0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: t.textMain }}>TOTAL</span>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: t.textMain }}>R$ {fmt(grandTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const printContent = document.getElementById('receipt-to-print').innerHTML;
                  if (isExtensionActive) {
                    console.log('[CRM-Print] Enviando impressão silenciosa manual do recibo...');
                    window.dispatchEvent(new CustomEvent('crm:print-receipt', {
                      detail: {
                        saleId: lastSale?.id || 'manual',
                        html: printContent
                      }
                    }));
                  } else {
                    const win = window.open('', '', 'width=450,height=800');
                    win.document.write(`
                        <html>
                          <head>
                            <title>Impressão NFC-e</title>
                            <style>
                              @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                              @page { margin: 0; }
                              * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                              body { margin: 0; padding: 0; background-color: white; font-family: 'Courier New', Courier, monospace; width: 80mm; }
                              .receipt-container { width: 80mm !important; box-shadow: none !important; margin: 0 !important; }
                            </style>
                          </head>
                          <body>${printContent}</body>
                          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
                        </html>
                      `);
                    win.document.close();
                  }
                }}
                style={{
                  height: 44,
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Printer size={16} /> IMPRIMIR CUPOM
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={resetSale} style={{ flex: 1, height: 40, border: 'none', borderRadius: t.radiusSmall, backgroundColor: t.accent, color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>NOVA VENDA</button>
                <button onClick={onFinish} style={{ flex: 1, height: 40, border: t.borderBold, borderRadius: t.radiusSmall, backgroundColor: t.bgSecondary, color: t.textMain, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>HISTÓRICO</button>
              </div>
            </div>

            {/* Hidden Receipt for Printing */}
            <div style={{ display: 'none' }} id="receipt-to-print">
              {lastSale && companyData && <ReceiptView sale={lastSale} company={companyData} />}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default POSFlow;
