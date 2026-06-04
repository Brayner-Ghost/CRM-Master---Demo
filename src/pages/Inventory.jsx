import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage, functions } from '../firebase';
import { collection, addDoc, setDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { Plus, Package, X, Loader2, Check, Sparkles, AlertTriangle, Calendar as CalendarIcon, Search, Camera, Trash2, Layers, Edit3, Globe, Store, Users, Zap, Gift, Save as SaveIcon, ArrowUpDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { maskSKU, maskNCM, maskCurrency } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Html5Qrcode } from 'html5-qrcode';
import { copyImageUrlToStorage } from '../utils/dataMigration';

const generateRandomId = () => Math.random().toString(36).substring(2, 7).toUpperCase();
const formatDisplayCurrency = (v) => (Number(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const Inventory = () => {
  const { t, currentTheme, viewSettings, density } = useTheme();
  const rawScale = density / 100;

  const isDark = ['dark', 'dim', 'midnight', 'highContrast'].includes(currentTheme);
  const warningColor = isDark ? '#fbbf24' : '#d97706';
  const warningSoftBg = isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb';

  const getAlertColors = (priority) => {
    if (priority === 2) {
      // Expired
      return {
        color: t.danger || '#ef4444',
        bg: t.dangerSoft || (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fff1f2'),
        border: isDark ? `${t.danger || '#ef4444'}50` : `${t.danger || '#ef4444'}30`
      };
    }
    if (priority === 1) {
      // Warning / near expiry
      let borderColor = 'rgba(217, 119, 6, 0.2)';
      if (isDark) {
        borderColor = 'rgba(245, 158, 11, 0.3)';
      } else if (currentTheme === 'beige') {
        borderColor = '#E6DBC9';
      }
      return {
        color: warningColor,
        bg: warningSoftBg,
        border: borderColor
      };
    }
    // Normal
    return {
      color: t.textSecondary || '#64748b',
      bg: t.bgSecondary || '#f8fafc',
      border: t.border || '1px solid #e2e8f0'
    };
  };

  const { user, addLog, getTenantCollection, getTenantDoc } = useUser();
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('estoque'); // 'estoque', 'promocoes', 'categorias'
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [giftSearchQuery, setGiftSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const addMenuRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const modalScale = isMobile ? 1 : rawScale;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside to close Novo menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initialProductState = {
    nome: '', sku: '', ncm: '', precoCusto: '', precoVenda: '',
    estoque: '', estoqueMinimo: '', validade: '', alertaDias: '30',
    descricao: '', categoria: [], unidade: 'UN',
    channels: { ecommerce: false, physical: true },
    estoqueParceiros: [], images: [],
    segmentoSimples: 'anexo_1',
    metodoDescontoNota: 'default'
  };

  const initialPromotionState = {
    nome: '', dataInicio: '', dataFim: '', produtosSelecionados: [], categoriasSelecionadas: [], precoPromocional: '',
    precoOriginal: '', descricao: '', mecanismo: 'simples', promoType: 'simples', qtdGatilho: '1', brindeId: '',
    gastoMinimo: '0,00', tipoUso: 'multiplo', limitadoEstoque: true,
    precoPromocionalVista: '', precoPromocionalCartao: '',
    comboRules: [
      { id: 1, name: 'Card 1 (OU)', requiredQty: 1, products: [], isCardGroup: true },
      { id: 2, name: 'Card 2 (OU)', requiredQty: 1, products: [], isCardGroup: true },
      { id: 3, name: 'Card 3 (OU)', requiredQty: 1, products: [], isCardGroup: true },
      { id: 4, name: 'Card 4 (OU)', requiredQty: 1, products: [], isCardGroup: true }
    ],
    metodoDescontoNota: 'default',
    precosPromocionais: {},
    precosPromocionaisVista: {},
    precosPromocionaisCartao: {},
    possuiBrinde: false,
    brindesSelecionados: []
  };

  const [newProduct, setNewProduct] = useState(initialProductState);
  const [newPromotion, setNewPromotion] = useState(initialPromotionState);
  const [comboRuleType, setComboRuleType] = useState('product'); // 'product' | 'category'


  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showItemsMenu, setShowItemsMenu] = useState(false);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsubInv = onSnapshot(query(getTenantCollection('inventory'), orderBy('nome')), (s) => {
      const all = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(all.filter(d => d.type !== 'promotion'));
      setPromotions(all.filter(d => d.type === 'promotion'));
      setLoading(false);
    });
    const unsubPart = onSnapshot(getTenantCollection('partners'), (s) =>
      setPartners(s.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    const unsubCats = onSnapshot(query(getTenantCollection('categories'), orderBy('name')), (s) => {
      setCategories(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubInv(); unsubPart(); unsubCats(); };
  }, [user]);

  useEffect(() => {
    if (!showScanner) return;

    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (result) => {
        if (scannerTarget === 'search') {
          setSearchQuery(result);
        } else if (scannerTarget === 'sku') {
          setNewProduct(prev => ({ ...prev, sku: maskSKU(result) }));
        }
        html5QrCode.stop().catch(e => console.error("Error stopping scanner", e));
        setShowScanner(false);
      },
      (err) => { }
    ).catch(err => {
      console.error("Error starting scanner", err);
      alert("Erro ao acessar a câmera. Certifique-se de dar as permissões necessárias.");
      setShowScanner(false);
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error("Scanner stop error", e));
      }
    };
  }, [showScanner, scannerTarget]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal || showCategoryModal || showScanner) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal, showCategoryModal, showScanner]);

  const handleGenerateAI = async () => {
    if (!newProduct.nome) {
      alert('Informe o nome do produto para gerar a descrição.');
      return;
    }
    setGeneratingAI(true);
    try {
      const genDesc = httpsCallable(functions, 'generateProductDescription');
      const result = await genDesc({ name: newProduct.nome, sku: newProduct.sku });
      setNewProduct({ ...newProduct, descricao: result.data });
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar descrição com IA.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const renderProductList = (items) => (
    <div style={{ backgroundColor: t.bg, border: t.borderBold, borderRadius: t.radiusMedium, overflowX: 'auto', boxShadow: t.shadowSmall }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
        <thead>
          <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Produto</th>
            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>SKU</th>
            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Categoria</th>
            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Preço</th>
            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase' }}>Estoque</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              onClick={() => openEdit(item)}
              style={{ borderBottom: t.border, cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <td style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 600, color: t.textMain }}>{item.nome}</div>
              </td>
              <td style={{ padding: '1rem', color: t.textSecondary, fontSize: '0.85rem' }}>{item.sku || '---'}</td>
              <td style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {Array.isArray(item.categoria) ? item.categoria.map(c => (
                    <span key={c} style={{ fontSize: '0.65rem', backgroundColor: t.bgSecondary, padding: '2px 6px', borderRadius: '4px', color: t.textSecondary }}>{c}</span>
                  )) : <span style={{ fontSize: '0.65rem', backgroundColor: t.bgSecondary, padding: '2px 6px', borderRadius: '4px', color: t.textSecondary }}>{item.categoria}</span>}
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: t.accent }}>
                R$ {formatDisplayCurrency(item.precoVenda)}
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <span style={{
                  fontWeight: 700,
                  color: Number(item.estoque) <= Number(item.estoqueMinimo) ? t.danger : t.textMain
                }}>
                  {item.estoque} {item.unidade}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const openEdit = (item) => {
    setEditingProduct(item.id);
    setIsLocked(true);
    setItemSearchQuery('');
    setGiftSearchQuery('');

    if (item.type === 'promotion') {
      setActiveTab('promocoes');
      setNewPromotion({
        nome: item.nome || '',
        dataInicio: item.dataInicio || '',
        dataFim: item.dataFim || '',
        produtosSelecionados: item.produtosSelecionados || [],
        categoriasSelecionadas: item.categoriasSelecionadas || [],
        precoPromocional: formatDisplayCurrency(item.precoPromocional),
        precoOriginal: formatDisplayCurrency(item.precoOriginal),
        precoPromocionalVista: item.precoPromocionalVista ? formatDisplayCurrency(item.precoPromocionalVista) : '',
        precoPromocionalCartao: item.precoPromocionalCartao ? formatDisplayCurrency(item.precoPromocionalCartao) : '',
        comboRules: (() => {
          if (item.comboRules && item.comboRules.some(r => r.isCardGroup || Array.isArray(r.products))) {
            return [1, 2, 3, 4].map(num => {
              const existing = item.comboRules.find(r => r.id === num);
              return existing ? { ...existing, products: existing.products || [] } : { id: num, name: `Card ${num} (OU)`, requiredQty: 1, products: [], isCardGroup: true };
            });
          }
          const orRules = (item.comboRules || []).filter(r => r.group === 'or');
          const andRules = (item.comboRules || []).filter(r => r.group !== 'or');
          return [
            { id: 1, name: 'Card 1 (OU)', requiredQty: 1, products: orRules.map(r => r.value), isCardGroup: true },
            { id: 2, name: 'Card 2 (OU)', requiredQty: 1, products: andRules[0] ? [andRules[0].value] : [], isCardGroup: true },
            { id: 3, name: 'Card 3 (OU)', requiredQty: 1, products: andRules[1] ? [andRules[1].value] : [], isCardGroup: true },
            { id: 4, name: 'Card 4 (OU)', requiredQty: 1, products: andRules.slice(2).map(r => r.value), isCardGroup: true }
          ];
        })(),
        descricao: item.descricao || '',
        mecanismo: (item.mecanismo === 'brinde' || item.promoType === 'brinde') ? 'combo' : (item.mecanismo || item.promoType || 'simples'),
        promoType: (item.promoType === 'brinde' || item.mecanismo === 'brinde') ? 'combo' : (item.promoType || item.mecanismo || 'simples'),
        qtdGatilho: String(item.qtdGatilho || '1'),
        brindeId: item.brindeId || '',
        possuiBrinde: item.possuiBrinde !== undefined ? item.possuiBrinde : (!!item.brindeId || (item.brindesSelecionados && item.brindesSelecionados.length > 0)),
        brindesSelecionados: item.brindesSelecionados || (item.brindeId ? [{ productId: item.brindeId, quantity: 1 }] : []),
        tipoUso: item.tipoUso || 'multiplo',
        limitadoEstoque: item.limitadoEstoque !== undefined ? item.limitadoEstoque : true,
        metodoDescontoNota: item.metodoDescontoNota || 'default',
        precosPromocionais: item.precosPromocionais ? Object.keys(item.precosPromocionais).reduce((acc, pid) => {
          acc[pid] = formatDisplayCurrency(item.precosPromocionais[pid]);
          return acc;
        }, {}) : {},
        precosPromocionaisVista: item.precosPromocionaisVista ? Object.keys(item.precosPromocionaisVista).reduce((acc, pid) => {
          acc[pid] = formatDisplayCurrency(item.precosPromocionaisVista[pid]);
          return acc;
        }, {}) : {},
        precosPromocionaisCartao: item.precosPromocionaisCartao ? Object.keys(item.precosPromocionaisCartao).reduce((acc, pid) => {
          acc[pid] = formatDisplayCurrency(item.precosPromocionaisCartao[pid]);
          return acc;
        }, {}) : {}
      });
    } else {
      setActiveTab('estoque');
      setNewProduct({
        ...item,
        precoCusto: formatDisplayCurrency(item.precoCusto),
        precoVenda: formatDisplayCurrency(item.precoVenda),
        categoria: Array.isArray(item.categoria) ? item.categoria : (item.categoria ? [item.categoria] : []),
        estoqueParceiros: item.estoqueParceiros || [],
        images: item.images?.map(url => ({ preview: url, file: null })) || [],
        segmentoSimples: item.segmentoSimples || 'anexo_1',
        metodoDescontoNota: item.metodoDescontoNota || 'default'
      });
    }
    setShowModal(true);
  };

  const generateRandomId = (length = 5) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'promocoes') {
      alert("Modo de Demonstração: A criação e edição de promoções estão desabilitadas.");
      return;
    }
    if (isLocked) {
      setIsLocked(false);
      return;
    }

    setSaving(true);
    try {
      if (activeTab === 'estoque') {
        const uploadedUrls = [];
        const cleanImages = (newProduct.images || []).filter(Boolean);
        for (const imgData of cleanImages) {
          if (imgData.file) {
            const storageRef = ref(storage, `products/${Date.now()}_${imgData.file.name}`);
            const snapshot = await uploadBytes(storageRef, imgData.file);
            const url = await getDownloadURL(snapshot.ref);
            uploadedUrls.push(url);
          } else if (imgData.preview) {
            const url = await copyImageUrlToStorage(imgData.preview, storage);
            uploadedUrls.push(url);
          }
        }

        const rawCusto = Number(newProduct.precoCusto.replace(/\D/g, ''));
        const rawVenda = Number(newProduct.precoVenda.replace(/\D/g, ''));
        const rawNcm = newProduct.ncm ? newProduct.ncm.replace(/\D/g, '') : '';

        const productData = {
          ...newProduct,
          type: 'product',
          images: uploadedUrls,
          precoCusto: rawCusto,
          precoVenda: rawVenda,
          ncm: rawNcm,
          estoque: Number(newProduct.estoque),
          estoqueMinimo: Number(newProduct.estoqueMinimo),
          alertaDias: Number(newProduct.alertaDias),
          segmentoSimples: newProduct.segmentoSimples || 'anexo_1',
          updatedAt: new Date().toISOString()
        };

        if (editingProduct) {
          await updateDoc(getTenantDoc('inventory', editingProduct), productData);
          addLog(`acessou cadastro de estoque e mudou os dados do ${newProduct.nome}`);
        } else {
          const customId = (newProduct.sku && newProduct.sku.trim() !== '')
            ? newProduct.sku.trim().toUpperCase()
            : generateRandomId();

          await setDoc(getTenantDoc('inventory', customId), {
            ...productData,
            sku: customId,
            createdAt: new Date().toISOString()
          });
          addLog(`cadastrou novo produto: ${newProduct.nome} com ID/SKU ${customId}`);
        }

        setNewProduct(initialProductState);
      } else {
        // Validation for Promotion
        if (newPromotion.promoType === 'combo') {
          const hasRules = newPromotion.comboRules && newPromotion.comboRules.some(card => card.products && card.products.length > 0);
          if (!hasRules) {
            alert('Por favor, adicione pelo menos um produto em algum dos 4 cards do combo.');
            setSaving(false);
            return;
          }
          if (newPromotion.possuiBrinde) {
            if (!newPromotion.brindesSelecionados || newPromotion.brindesSelecionados.length === 0) {
              alert('Por favor, adicione pelo menos um produto de brinde.');
              setSaving(false);
              return;
            }
          } else {
            const rawVista = newPromotion.precoPromocionalVista ? Number(newPromotion.precoPromocionalVista.replace(/\D/g, '')) : 0;
            const rawCartao = newPromotion.precoPromocionalCartao ? Number(newPromotion.precoPromocionalCartao.replace(/\D/g, '')) : 0;
            if (rawVista === 0 && rawCartao === 0) {
              alert('Por favor, defina pelo menos um preço promocional (À Vista ou No Cartão) para o combo.');
              setSaving(false);
              return;
            }
          }
        } else {
          // simples
          if (!newPromotion.produtosSelecionados || newPromotion.produtosSelecionados.length === 0) {
            alert('Por favor, selecione pelo menos um produto para a promoção.');
            setSaving(false);
            return;
          }
        }

        const rawPromo = newPromotion.precoPromocional ? Number(newPromotion.precoPromocional.replace(/\D/g, '')) : 0;
        const rawOriginal = newPromotion.precoOriginal ? Number(newPromotion.precoOriginal.replace(/\D/g, '')) : 0;
        const rawVista = newPromotion.precoPromocionalVista ? Number(newPromotion.precoPromocionalVista.replace(/\D/g, '')) : 0;
        const rawCartao = newPromotion.precoPromocionalCartao ? Number(newPromotion.precoPromocionalCartao.replace(/\D/g, '')) : 0;

        const precosPromocionaisRaw = {};
        if (newPromotion.precosPromocionais) {
          (newPromotion.produtosSelecionados || []).forEach(pid => {
            const val = newPromotion.precosPromocionais[pid];
            if (val) {
              precosPromocionaisRaw[pid] = Number(val.replace(/\D/g, ''));
            }
          });
        }

        const precosPromocionaisVistaRaw = {};
        if (newPromotion.precosPromocionaisVista) {
          Object.keys(newPromotion.precosPromocionaisVista).forEach(pid => {
            const val = newPromotion.precosPromocionaisVista[pid];
            if (val) {
              precosPromocionaisVistaRaw[pid] = Number(val.replace(/\D/g, ''));
            }
          });
        }

        const precosPromocionaisCartaoRaw = {};
        if (newPromotion.precosPromocionaisCartao) {
          Object.keys(newPromotion.precosPromocionaisCartao).forEach(pid => {
            const val = newPromotion.precosPromocionaisCartao[pid];
            if (val) {
              precosPromocionaisCartaoRaw[pid] = Number(val.replace(/\D/g, ''));
            }
          });
        }

        const promoData = {
          ...newPromotion,
          type: 'promotion',
          precoPromocional: rawPromo,
          precoOriginal: rawOriginal,
          precoPromocionalVista: rawVista,
          precoPromocionalCartao: rawCartao,
          comboRules: newPromotion.comboRules || [],
          qtdGatilho: Number(newPromotion.qtdGatilho) || 1,
          precosPromocionais: precosPromocionaisRaw,
          precosPromocionaisVista: precosPromocionaisVistaRaw,
          precosPromocionaisCartao: precosPromocionaisCartaoRaw,
          possuiBrinde: !!newPromotion.possuiBrinde,
          brindesSelecionados: newPromotion.possuiBrinde ? newPromotion.brindesSelecionados : [],
          brindeId: newPromotion.possuiBrinde && newPromotion.brindesSelecionados?.[0]?.productId ? newPromotion.brindesSelecionados[0].productId : '',
          updatedAt: new Date().toISOString()
        };

        if (editingProduct) {
          await updateDoc(getTenantDoc('inventory', editingProduct), promoData);
          addLog(`editou a promoção ${newPromotion.nome}`);
        } else {
          await addDoc(getTenantCollection('inventory'), { ...promoData, createdAt: new Date().toISOString() });
          addLog(`criou nova promoção: ${newPromotion.nome}`);
        }

        setNewPromotion(initialPromotionState);
      }

      setShowModal(false);
      setEditingProduct(null);
      alert(editingProduct ? 'Atualizado!' : 'Cadastrado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const getValidityStatus = (validade, alertaDias, estoque) => {
    if (!validade) return null;
    const expiryDate = new Date(validade);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Red: Expired AND has stock
    if (diffDays <= 0 && Number(estoque || 0) > 0) {
      return { label: 'Vencido', isAlert: true, priority: 2 };
    }
    // Orange: Near expiry
    if (diffDays <= (alertaDias || 30)) {
      return { label: diffDays <= 0 ? 'Vencido' : `Vence em ${diffDays} dias`, isAlert: true, priority: 1 };
    }

    return { label: new Date(validade).toLocaleDateString('pt-BR'), isAlert: false, priority: 0 };
  };

  const deleteItem = async (id) => {
    if (activeTab === 'promocoes') {
      alert("Modo de Demonstração: A exclusão de promoções está desabilitada.");
      return;
    }
    if (window.confirm("Excluir item permanentemente?")) {
      await deleteDoc(getTenantDoc('inventory', id));
      setShowModal(false);
    }
  };

  const sortedProducts = useMemo(() => {
    let list = [...products].filter(p =>
      p.nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(p.categoria) && p.categoria.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    return list.sort((a, b) => {
      const aStock = Number(a.estoque || 0);
      const bStock = Number(b.estoque || 0);
      const aMin = Number(a.estoqueMinimo || 0);
      const bMin = Number(b.estoqueMinimo || 0);

      // Custom default sort: validity -> low stock -> normal -> zerados
      if (sortOption === 'default') {
        const getProductGroup = (p) => {
          const stock = Number(p.estoque || 0);
          if (stock === 0) return 4; // Produtos zerados

          const valStatus = getValidityStatus(p.validade, p.alertaDias, p.estoque);
          const hasValidadeAlert = valStatus?.isAlert;
          if (hasValidadeAlert) return 1; // Validade

          const minStock = Number(p.estoqueMinimo || 0);
          if (stock <= minStock) return 2; // Estoque baixo

          return 3; // Demais produtos
        };

        const groupA = getProductGroup(a);
        const groupB = getProductGroup(b);
        if (groupA !== groupB) {
          return groupA - groupB;
        }
        return (a.nome || '').localeCompare(b.nome || '');
      }

      // 1. Zero stock always goes to the end for other options
      if (aStock === 0 && bStock !== 0) return 1;
      if (aStock !== 0 && bStock === 0) return -1;

      // 2. Sorting options
      if (sortOption === 'name-asc') return (a.nome || '').localeCompare(b.nome || '');
      if (sortOption === 'name-desc') return (b.nome || '').localeCompare(a.nome || '');
      if (sortOption === 'stock-asc') return aStock - bStock;
      if (sortOption === 'stock-desc') return bStock - aStock;
      if (sortOption === 'price-asc') return Number(a.precoVenda || 0) - Number(b.precoVenda || 0);
      if (sortOption === 'price-desc') return Number(b.precoVenda || 0) - Number(a.precoVenda || 0);

      if (sortOption === 'validity-asc') {
        const aVal = a.validade ? new Date(a.validade).getTime() : Infinity;
        const bVal = b.validade ? new Date(b.validade).getTime() : Infinity;

        // Priority for items near expiry or low stock
        const aAlert = (aVal - Date.now() < (a.alertaDias || 30) * 86400000) || (aStock <= aMin);
        const bAlert = (bVal - Date.now() < (b.alertaDias || 30) * 86400000) || (bStock <= bMin);

        if (aAlert && !bAlert) return -1;
        if (!aAlert && bAlert) return 1;

        return aVal - bVal;
      }

      if (sortOption === 'validity-desc') return new Date(b.validade || '0001-01-01') - new Date(a.validade || '0001-01-01');

      return (a.nome || '').localeCompare(b.nome || '');
    });
  }, [products, searchQuery, sortOption]);

  const updatePartnerStock = (idx, field, value) => {
    const updated = [...newProduct.estoqueParceiros];
    updated[idx] = { ...updated[idx], [field]: field === 'quantity' ? Number(value) : value };
    setNewProduct({ ...newProduct, estoqueParceiros: updated });
  };

  const removePartnerStock = (idx) => {
    setNewProduct({ ...newProduct, estoqueParceiros: newProduct.estoqueParceiros.filter((_, i) => i !== idx) });
  };

  const handleAddPartnerStock = () => {
    setNewProduct({ ...newProduct, estoqueParceiros: [...(newProduct.estoqueParceiros || []), { partnerId: '', quantity: 0 }] });
  };

  const handleDelete = () => deleteItem(editingProduct);

  const startScanner = (target) => {
    setScannerTarget(target);
    setShowScanner(true);
  };

  const handleAddCategory = async () => {
    alert("Modo de Demonstração: A criação de categorias está desabilitada.");
    return;
  };

  const filteredPromotions = useMemo(() => {
    const filtered = promotions.filter(p =>
      p.nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (sortOption === 'name-asc' || sortOption === 'default') return (a.nome || '').localeCompare(b.nome || '');
      if (sortOption === 'name-desc') return (b.nome || '').localeCompare(a.nome || '');
      if (sortOption === 'price-asc') return Number(a.precoPromocional || 0) - Number(b.precoPromocional || 0);
      if (sortOption === 'price-desc') return Number(b.precoPromocional || 0) - Number(a.precoPromocional || 0);
      return (a.nome || '').localeCompare(b.nome || '');
    });
  }, [promotions, searchQuery, sortOption]);

  const filteredCategories = useMemo(() => {
    const filtered = categories.filter(cat =>
      cat.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (sortOption === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [categories, searchQuery, sortOption]);

  const currentList = useMemo(() => {
    if (!searchQuery) {
      if (activeTab === 'estoque') return sortedProducts;
      if (activeTab === 'promocoes') return filteredPromotions;
      return filteredCategories;
    }
    // Global Search: Merge all results
    return [
      ...sortedProducts.map(p => ({ ...p, _displayType: 'estoque' })),
      ...filteredPromotions.map(p => ({ ...p, _displayType: 'promocoes' })),
      ...filteredCategories.map(p => ({ ...p, _displayType: 'categorias' }))
    ];
  }, [activeTab, searchQuery, sortedProducts, filteredPromotions, filteredCategories]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeTab, itemsPerPage, sortOption]);

  const totalItems = currentList.length;
  const paginatedList = itemsPerPage === 'all' ? currentList : currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderProductCard = (p) => {
    const validity = getValidityStatus(p.validade, p.alertaDias, p.estoque);
    const lowStock = p.estoque <= (p.estoqueMinimo || 0);
    const isExpiredWithStock = validity?.priority === 2;
    const isNearExpiry = validity?.priority === 1;

    let productImg = '/assets/SemImagemDisponivel.png';
    if (p.images) {
      if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
        productImg = p.images[0];
      } else if (typeof p.images === 'string' && p.images.trim() !== '') {
        productImg = p.images;
      }
    }

    const isPlaceholder = productImg.includes('SemImagemDisponivel.png');
    const alertColors = getAlertColors(validity?.priority || 0);

    let cardBg = t.bg;
    let cardBorder = t.border;
    if (isExpiredWithStock || isNearExpiry) {
      cardBg = alertColors.bg;
      cardBorder = `1.5px solid ${alertColors.border}`;
    } else if (p.estoque === 0) {
      cardBg = t.bgSecondary;
    }

    return (
      <motion.div
        layout
        key={p.id}
        style={{
          backgroundColor: cardBg,
          padding: '1.25rem',
          cursor: 'pointer',
          position: 'relative',
          opacity: p.estoque === 0 ? 0.7 : 1,
          border: cardBorder,
          borderRadius: t.radiusMedium,
          boxShadow: t.shadowSmall,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          minHeight: '340px'
        }}
        onClick={() => openEdit(p)}
        whileHover={{ y: -4, boxShadow: t.shadow }}
        transition={{ duration: 0.2 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ padding: '4px 10px', backgroundColor: t.bgSecondary, color: t.textSecondary, fontSize: '0.65rem', fontWeight: 600, borderRadius: t.radiusSmall, border: t.border, textTransform: 'uppercase' }}>
            {p.sku}
          </div>
          {validity?.isAlert && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: alertColors.color,
              backgroundColor: alertColors.bg,
              border: `1px solid ${alertColors.border}`,
              padding: '4px 10px',
              borderRadius: '100px',
              fontWeight: 700,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <AlertTriangle size={12} /> {validity.label}
            </div>
          )}
        </div>

        {/* Product Image */}
        <div style={{
          width: '100%',
          height: '140px',
          borderRadius: t.radiusSmall,
          overflow: 'hidden',
          backgroundColor: t.bgSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: t.border
        }}>
          <img
            src={productImg}
            alt={p.nome}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isPlaceholder ? 0.65 : 1
            }}
          />
        </div>

        <div>
          <h3 style={{ fontWeight: 600, fontSize: '1.05rem', color: t.textMain, margin: '0 0 4px 0', lineHeight: 1.3 }}>{p.nome}</h3>
          {p.validade && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: t.textSecondary, fontSize: '0.75rem', fontWeight: 500 }}>
              <CalendarIcon size={12} /> Validade: {new Date(p.validade).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: t.textSecondary, fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Estoque</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: p.estoque === 0 ? t.danger : (lowStock ? warningColor : t.textMain) }}>
              {p.estoque} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textSecondary }}>{p.unidade}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: t.textSecondary, fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Venda</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: t.accent }}>R$ {formatDisplayCurrency(p.precoVenda)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary }}>
          <span>Custo: R$ {formatDisplayCurrency(p.precoCusto)}</span>
          <span style={{ fontSize: '0.7rem', color: t.success }}>Lucro: R$ {formatDisplayCurrency(Number(p.precoVenda || 0) - Number(p.precoCusto || 0))}</span>
        </div>

        {p.estoque === 0 && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', backdropFilter: 'grayscale(1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: t.radiusMedium }}>
            <div style={{ backgroundColor: t.textMain, color: t.bg, padding: '6px 16px', fontWeight: 600, fontSize: '0.75rem', borderRadius: t.radiusSmall, boxShadow: t.shadow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Esgotado</div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderPromotionCard = (p) => (
    <motion.div
      layout
      key={p.id}
      style={{
        backgroundColor: t.bg,
        padding: '1.25rem',
        cursor: 'pointer',
        border: t.border,
        borderRadius: t.radiusMedium,
        boxShadow: t.shadowSmall,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}
      onClick={() => openEdit(p)}
      whileHover={{ y: -4, boxShadow: t.shadow }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ padding: '4px 10px', backgroundColor: t.accentSoft, color: t.accent, fontSize: '0.7rem', fontWeight: 600, borderRadius: t.radiusSmall, border: `1px solid ${t.accent}20` }}>
          {p.promoType?.toUpperCase()}
        </div>
        <Sparkles size={18} style={{ color: warningColor }} />
      </div>
      <h3 style={{ fontWeight: 600, fontSize: '1.1rem', color: t.textMain, margin: 0 }}>{p.nome}</h3>
      <p style={{ fontSize: '0.85rem', color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>{p.descricao}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 600, color: t.textMain }}>
            {(() => {
              if (p.promoType === 'simples' && p.precosPromocionais && Object.keys(p.precosPromocionais).length > 0) {
                const prices = Object.values(p.precosPromocionais).map(Number);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                if (minPrice === maxPrice) {
                  return `R$ ${formatDisplayCurrency(minPrice)}`;
                }
                return `R$ ${formatDisplayCurrency(minPrice)} - R$ ${formatDisplayCurrency(maxPrice)}`;
              }
              return `R$ ${formatDisplayCurrency(p.precoPromocional)}`;
            })()}
          </div>
          {(p.precoPromocionalVista || p.precoPromocionalCartao) && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>
              {p.precoPromocionalVista && <span style={{ color: t.success }}>À Vista: R$ {formatDisplayCurrency(p.precoPromocionalVista)}</span>}
              {p.precoPromocionalCartao && <span style={{ color: t.accent }}>Cartão: R$ {formatDisplayCurrency(p.precoPromocionalCartao)}</span>}
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary, backgroundColor: t.bgSecondary, padding: '4px 10px', borderRadius: t.radiusSmall, border: t.border }}>
          {p.produtosSelecionados?.length || 0} produtos
          {(p.categoriasSelecionadas?.length > 0) && (
            <span style={{ marginLeft: '4px' }}>| {p.categoriasSelecionadas.length} categorias</span>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderCategoryCard = (cat) => (
    <motion.div
      layout
      key={cat.id}
      style={{
        backgroundColor: t.bg,
        padding: '1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: t.border,
        borderRadius: t.radiusMedium,
        boxShadow: t.shadowSmall
      }}
      whileHover={{ scale: 1.01, boxShadow: t.shadow }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '10px', borderRadius: t.radiusSmall, display: 'flex' }}>
          <Layers size={18} />
        </div>
        <h3 style={{ fontWeight: 600, fontSize: '1.05rem', color: t.textMain }}>{cat.name}</h3>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          alert('Modo de Demonstração: A exclusão de categorias está desabilitada.');
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: t.danger,
          padding: '8px',
          borderRadius: t.radiusSmall,
          display: 'flex',
          transition: 'background 0.2s'
        }}
        className="hover:bg-red-50"
      >
        <Trash2 size={20} />
      </button>
    </motion.div>
  );

  return (
    <div className="inventory-page max-w-[1600px] mx-auto">
      {activeTab !== 'estoque' && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1.5px solid rgba(239, 68, 68, 0.25)',
          borderRadius: t.radiusSmall,
          padding: '0.875rem 1.25rem',
          marginTop: '1rem',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#ef4444',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <AlertTriangle size={18} />
          <span>Modo de Demonstração: A criação, edição e exclusão de {activeTab === 'promocoes' ? 'promoções' : 'categorias'} estão desabilitadas.</span>
        </div>
      )}
      <header className="crm-header">
        {/* Left Side: Title and Tabs */}
        <div className="crm-header-left">
          <h1 className="crm-page-title">Inventário</h1>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: t.bg, padding: '4px', borderRadius: t.radiusSmall, border: t.border, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {[
              { id: 'estoque', label: 'Estoque', icon: Package },
              { id: 'promocoes', label: 'Promoções', icon: Sparkles },
              { id: 'categorias', label: 'Categorias', icon: Layers }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSortOption('default'); }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: t.radiusSmall,
                  backgroundColor: activeTab === tab.id ? t.accentSoft : 'transparent',
                  color: activeTab === tab.id ? t.accent : t.textSecondary,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Search, Filters, Limits & Add button */}
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
              placeholder="Buscar por produto, SKU, categoria..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button
              onClick={() => startScanner('search')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '8px',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                borderRadius: t.radiusSmall
              }}
              className="hover:bg-slate-50"
              title="Escanear Código"
            >
              <Camera size={18} />
            </button>
          </div>

          {/* Sort Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              style={{
                height: '42px',
                padding: '0 1.25rem',
                border: t.borderBold,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: showSortMenu ? t.accentSoft : t.bgSecondary,
                color: showSortMenu ? t.accent : t.textSecondary,
                boxShadow: t.shadowSmall,
                cursor: 'pointer',
                borderRadius: t.radiusSmall,
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                minWidth: '160px'
              }}
            >
              <ArrowUpDown size={18} /> {
                sortOption === 'default' ? 'Ordenação' :
                  sortOption === 'name-asc' ? 'A-Z' :
                    sortOption === 'name-desc' ? 'Z-A' :
                      sortOption === 'stock-asc' ? 'Estoque ↑' :
                        sortOption === 'stock-desc' ? 'Estoque ↓' :
                          sortOption === 'validity-asc' ? 'Validade' :
                            sortOption === 'price-asc' ? 'Preço Promocional ↑' :
                              sortOption === 'price-desc' ? 'Preço Promocional ↓' : sortOption
              }
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <>
                  <div
                    onClick={() => setShowSortMenu(false)}
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
                      position: 'absolute', top: '50px', right: 0, width: '220px',
                      backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                      zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      {[
                        { id: 'default', label: 'Ordenação' },
                        { id: 'name-asc', label: 'A-Z' },
                        { id: 'name-desc', label: 'Z-A' },
                        { id: 'stock-asc', label: 'Estoque ↑' },
                        { id: 'stock-desc', label: 'Estoque ↓' },
                        { id: 'validity-asc', label: 'Validade' },
                        { id: 'price-asc', label: 'Preço Promocional ↑' },
                        { id: 'price-desc', label: 'Preço Promocional ↓' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => { setSortOption(opt.id); setShowSortMenu(false); }}
                          style={{
                            padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                            border: 'none', cursor: 'pointer',
                            backgroundColor: sortOption === opt.id ? t.accentSoft : 'transparent',
                            color: sortOption === opt.id ? t.accent : t.textMain,
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

          {/* Page Limit Menu */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: t.bgSecondary, border: t.borderBold, borderRadius: t.radiusSmall, height: '42px', boxShadow: t.shadowSmall, overflow: 'hidden' }}>
              <span style={{ color: t.textSecondary, fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', paddingLeft: '12px', borderRight: t.borderBold, height: '100%', display: 'flex', alignItems: 'center', paddingRight: '10px', backgroundColor: t.bg }}>Exibir</span>
              <button
                onClick={() => setShowItemsMenu(!showItemsMenu)}
                style={{
                  border: 'none',
                  fontWeight: 600,
                  color: t.textMain,
                  cursor: 'pointer',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.85rem',
                  height: '100%',
                  padding: '0 12px',
                  minWidth: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px'
                }}
              >
                <span>{itemsPerPage === 'all' ? 'Tudo' : itemsPerPage}</span>
                <span style={{ fontSize: '0.6rem', color: t.textSecondary }}>▼</span>
              </button>
            </div>

            <AnimatePresence>
              {showItemsMenu && (
                <>
                  <div
                    onClick={() => setShowItemsMenu(false)}
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
                      position: 'absolute', top: '50px', right: 0, width: '100px',
                      backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                      zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      {[10, 25, 50, 100, 'all'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => { setItemsPerPage(opt === 'all' ? 'all' : Number(opt)); setShowItemsMenu(false); }}
                          style={{
                            padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem',
                            border: 'none', cursor: 'pointer',
                            backgroundColor: itemsPerPage === opt ? t.accentSoft : 'transparent',
                            color: itemsPerPage === opt ? t.accent : t.textMain,
                            borderRadius: '6px', transition: 'all 0.2s'
                          }}
                        >
                          {opt === 'all' ? 'Tudo' : opt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Add Item Button & Dropdown */}
          <div style={{ position: 'relative' }} ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              style={{
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: t.radiusSmall,
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.3)'; }}
              className="hover:brightness-110"
            >
              <Plus size={20} /> Novo Item
            </button>
            <AnimatePresence>
              {showAddMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    backgroundColor: t.bgSecondary,
                    border: t.borderBold,
                    borderRadius: t.radiusMedium,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    width: '200px',
                    zIndex: 100,
                    overflow: 'hidden'
                  }}
                >
                  {[
                    { id: 'estoque', label: 'Produto', icon: Package },
                    { id: 'promocoes', label: 'Promoção', icon: Sparkles },
                    { id: 'categorias', label: 'Categoria', icon: Layers }
                  ].map((opt, idx) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setShowAddMenu(false);
                        if (opt.id === 'categorias') {
                          alert('Modo de Demonstração: A criação de categorias está desabilitada.');
                        } else if (opt.id === 'promocoes') {
                          alert('Modo de Demonstração: A criação de promoções está desabilitada.');
                        } else {
                          setActiveTab(opt.id);
                          setEditingProduct(null);
                          setIsLocked(false);
                          if (opt.id === 'estoque') setNewProduct(initialProductState);
                          else setNewPromotion(initialPromotionState);
                          setShowModal(true);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        borderBottom: idx === 2 ? 'none' : t.borderBold,
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontWeight: 500,
                        color: t.textMain,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bg}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <opt.icon size={18} style={{ color: t.textSecondary }} /> {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={48} /></div>
        ) : currentList.length === 0 && !searchQuery ? (
          <EmptyState title="Sua lista está vazia" description="Adicione seu primeiro item para gerenciar." icon={Package} color="#FFE600" />
        ) : paginatedList.length === 0 ? (
          <EmptyState title="Nenhum resultado" description="Sua busca ou filtros não retornaram itens." icon={Search} color={t.accent} />
        ) : (
          <>
            {viewSettings?.inventory === 'list' && activeTab === 'estoque' ? (
              renderProductList(paginatedList)
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {paginatedList.map(item => {
                  const type = item._displayType || activeTab;
                  if (type === 'estoque') return renderProductCard(item);
                  if (type === 'promocoes') return renderPromotionCard(item);
                  return renderCategoryCard(item);
                })}
              </div>
            )}

            {itemsPerPage !== 'all' && totalItems > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                setCurrentPage={setCurrentPage}
              />
            )}

            <div style={{ marginTop: '1.5rem', fontWeight: 600, fontSize: '0.85rem', color: t.textSecondary, textAlign: 'right' }}>
              Mostrando {paginatedList.length} de {totalItems} {activeTab}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <motion.div
              initial={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              className="modal-content"
              style={{
                width: '100%',
                maxWidth: (activeTab === 'estoque' || activeTab === 'promocoes') ? '1100px' : '800px',
                background: t.bg,
                border: t.border,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden'
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
                    {activeTab === 'estoque' ? <Package size={18} /> : <Zap size={18} />}
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      {editingProduct
                        ? (isLocked ? (activeTab === 'estoque' ? 'Detalhes do Produto' : 'Detalhes da Promoção') : (activeTab === 'estoque' ? 'Editar Produto' : 'Editar Promoção'))
                        : (activeTab === 'estoque' ? 'Novo Produto' : 'Nova Promoção')}
                    </h3>
                    <p className="modal-subtitle" style={{ margin: 0 }}>
                      {editingProduct ? `ID: ${editingProduct}` : 'Preencha os campos abaixo'}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => { setShowModal(false); setEditingProduct(null); setIsLocked(false); }}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Body */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, backgroundColor: t.bg }}>
                <form id="productForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {activeTab === 'estoque' ? (
                    <>
                      {/* 3-Column Split Layout */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.3fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>

                        {/* Column 1: Nome, SKU, NCM, Descrição */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div className="form-group">
                            <label className="field-label">Nome do Produto *</label>
                            <input
                              required
                              disabled={isLocked}
                              placeholder="Ex: CAMISETA OVERSIZED PRETA"
                              className="field-input"
                              value={newProduct.nome}
                              onChange={e => setNewProduct({ ...newProduct, nome: e.target.value.toUpperCase() })}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="field-label">SKU (Código) *</label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  required
                                  disabled={isLocked}
                                  maxLength={15}
                                  placeholder="PRD-000"
                                  className="field-input"
                                  style={{ paddingRight: isLocked ? '0.875rem' : '2.5rem' }}
                                  value={newProduct.sku}
                                  onChange={e => setNewProduct({ ...newProduct, sku: maskSKU(e.target.value) })}
                                />
                                {!isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => startScanner('sku')}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  >
                                    <Camera size={16} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="field-label">NCM</label>
                              <input
                                disabled={isLocked}
                                placeholder="0000.00.00"
                                className="field-input"
                                value={newProduct.ncm ? maskNCM(newProduct.ncm) : ''}
                                onChange={e => setNewProduct({ ...newProduct, ncm: maskNCM(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                              <label className="field-label" style={{ margin: 0 }}>Descrição do Produto</label>
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={handleGenerateAI}
                                  disabled={generatingAI}
                                  style={{
                                    backgroundColor: t.accentSoft, color: t.accent, border: 'none', borderRadius: '8px',
                                    padding: '4px 10px', fontWeight: 600, fontSize: '0.65rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase'
                                  }}
                                >
                                  {generatingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {generatingAI ? 'Gerando...' : 'Gerar com IA'}
                                </button>
                              )}
                            </div>
                            <textarea
                              disabled={isLocked}
                              placeholder="Detalhes técnicos, material, cuidados..."
                              className="field-textarea"
                              style={{ flex: 1, minHeight: '120px' }}
                              value={newProduct.descricao}
                              onChange={e => setNewProduct({ ...newProduct, descricao: e.target.value })}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="field-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.375rem', display: 'block' }}>Segmento Simples Nacional</label>
                            <select
                              disabled={isLocked}
                              className="field-select"
                              value={newProduct.segmentoSimples || 'anexo_1'}
                              onChange={e => setNewProduct({ ...newProduct, segmentoSimples: e.target.value })}
                              style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none', fontWeight: 600 }}
                            >
                              <option value="anexo_1">Comércio (Anexo I)</option>
                              <option value="anexo_2">Indústria (Anexo II)</option>
                              <option value="anexo_3">Prestação de Serviços (Anexo III)</option>
                              <option value="anexo_4">Prestação de Serviços (Anexo IV)</option>
                              <option value="anexo_5">Prestação de Serviços (Anexo V)</option>
                            </select>
                          </div>
                        </div>

                        {/* Column 2: Preços, Estoque, Validade & Canais */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="field-label">Preço de Custo</label>
                              <input
                                disabled={isLocked}
                                placeholder="R$ 0,00"
                                className="field-input"
                                value={newProduct.precoCusto}
                                onChange={e => setNewProduct({ ...newProduct, precoCusto: maskCurrency(e.target.value) })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Preço de Venda</label>
                              <input
                                disabled={isLocked}
                                placeholder="R$ 0,00"
                                className="field-input"
                                style={{ color: t.accent, fontWeight: 700 }}
                                value={newProduct.precoVenda}
                                onChange={e => setNewProduct({ ...newProduct, precoVenda: maskCurrency(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="field-label">Unidade</label>
                              <select
                                disabled={isLocked}
                                className="field-select"
                                value={newProduct.unidade}
                                onChange={e => setNewProduct({ ...newProduct, unidade: e.target.value })}
                              >
                                <option value="UN">UN</option>
                                <option value="KG">KG</option>
                                <option value="LT">LT</option>
                                <option value="PC">PC</option>
                                <option value="CX">CX</option>
                                <option value="MT">MT</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="field-label">Estoque</label>
                              <input
                                disabled={isLocked}
                                type="number"
                                className="field-input"
                                style={{ textAlign: 'center' }}
                                value={newProduct.estoque}
                                onChange={e => setNewProduct({ ...newProduct, estoque: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Alerta Mín.</label>
                              <input
                                disabled={isLocked}
                                type="number"
                                className="field-input"
                                style={{ textAlign: 'center', color: t.danger }}
                                value={newProduct.estoqueMinimo}
                                onChange={e => setNewProduct({ ...newProduct, estoqueMinimo: e.target.value })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="field-label">Data de Validade</label>
                              <div style={{ position: 'relative' }}>
                                <CalendarIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                                <input
                                  disabled={isLocked}
                                  type="date"
                                  className="field-input"
                                  style={{ paddingLeft: '2.5rem' }}
                                  value={newProduct.validade}
                                  onChange={e => setNewProduct({ ...newProduct, validade: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="field-label">Dias Alerta</label>
                              <input
                                disabled={isLocked}
                                type="number"
                                className="field-input"
                                style={{ textAlign: 'center' }}
                                value={newProduct.alertaDias}
                                onChange={e => setNewProduct({ ...newProduct, alertaDias: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="field-label">Canais de Disponibilidade</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => setNewProduct({ ...newProduct, channels: { ...newProduct.channels, ecommerce: !newProduct.channels?.ecommerce } })}
                                style={{
                                  flex: 1, height: '40px', backgroundColor: newProduct.channels?.ecommerce ? t.accentSoft : t.bg,
                                  color: newProduct.channels?.ecommerce ? t.accent : t.textSecondary,
                                  border: newProduct.channels?.ecommerce ? `1.5px solid ${t.accent}` : t.border,
                                  borderRadius: '12px', fontWeight: 600, fontSize: '0.8rem', cursor: isLocked ? 'default' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                                }}
                              >
                                <Globe size={16} style={{ color: '#3b82f6' }} /> E-Commerce
                              </button>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => setNewProduct({ ...newProduct, channels: { ...newProduct.channels, physical: !newProduct.channels?.physical } })}
                                style={{
                                  flex: 1, height: '40px', backgroundColor: newProduct.channels?.physical ? '#f0fdf4' : t.bg,
                                  color: newProduct.channels?.physical ? t.success : t.textSecondary,
                                  border: newProduct.channels?.physical ? `1.5px solid ${t.success}` : t.border,
                                  borderRadius: '12px', fontWeight: 600, fontSize: '0.8rem', cursor: isLocked ? 'default' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                                }}
                              >
                                <Store size={16} style={{ color: '#f97316' }} /> Loja Física
                              </button>
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                              <Layers size={14} style={{ color: t.accent }} /> CLASSIFICAÇÃO
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {categories.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: t.textSecondary, fontStyle: 'italic' }}>Nenhuma categoria disponível.</p>
                              ) : (
                                categories.map(cat => {
                                  const isSelected = Array.isArray(newProduct.categoria) && newProduct.categoria.includes(cat.name);
                                  return (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const current = Array.isArray(newProduct.categoria) ? newProduct.categoria : [];
                                        if (isSelected) {
                                          setNewProduct({ ...newProduct, categoria: current.filter(c => c !== cat.name) });
                                        } else {
                                          setNewProduct({ ...newProduct, categoria: [...current, cat.name] });
                                        }
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: isSelected ? t.accent : t.bg,
                                        color: isSelected ? '#fff' : t.textSecondary,
                                        border: isSelected ? 'none' : t.border,
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: isLocked ? 'default' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                        boxShadow: isSelected ? `0 4px 10px ${t.accent}20` : 'none'
                                      }}
                                    >
                                      {isSelected && <Check size={12} strokeWidth={3} />}
                                      {cat.name}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Imagens */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                          <label className="field-label" style={{ marginBottom: '0.25rem' }}>Imagens do Produto (Máx. 4)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[0, 1, 2, 3].map(idx => {
                              const img = newProduct.images?.[idx];
                              const hasImg = !!img;
                              const imgSrc = hasImg ? img.preview : '/assets/SemImagemDisponivel.png';

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    position: 'relative',
                                    aspectRatio: '1',
                                    border: hasImg ? t.border : '2px dashed var(--border)',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    backgroundColor: t.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: t.shadowSmall,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <img
                                    src={imgSrc}
                                    alt={`Imagem ${idx + 1}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: hasImg ? 1 : 0.6 }}
                                  />

                                  {!isLocked && hasImg && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...(newProduct.images || [])];
                                        updated[idx] = null;
                                        setNewProduct({ ...newProduct, images: updated });
                                      }}
                                      style={{
                                        position: 'absolute', top: '6px', right: '6px', backgroundColor: t.danger, color: '#fff',
                                        border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}

                                  {!isLocked && !hasImg && (
                                    <label
                                      style={{
                                        position: 'absolute', inset: 0, cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: 'rgba(0,0,0,0.02)', transition: 'all 0.2s'
                                      }}
                                      className="hover:bg-slate-100/50"
                                    >
                                      <Plus size={20} style={{ color: t.textSecondary }} />
                                      <span style={{ fontSize: '0.6rem', fontWeight: 600, color: t.textSecondary, marginTop: '4px', textTransform: 'uppercase' }}>Add</span>
                                      <input
                                        type="file"
                                        hidden
                                        accept="image/*"
                                        onChange={e => {
                                          const file = e.target.files[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              const updated = [...(newProduct.images || [])];
                                              updated[idx] = { file, preview: reader.result };
                                              setNewProduct({ ...newProduct, images: updated });
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>


                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Promo Type Selector */}
                      <div style={{ padding: '6px', backgroundColor: t.bgSecondary, border: t.border, borderRadius: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {[
                          { id: 'simples', icon: <Zap size={16} />, label: 'Preço Fixo' },
                          { id: 'combo', icon: <Layers size={16} />, label: 'Combo / Qtd' }
                        ].map(type => (
                          <button
                            key={type.id}
                            type="button"
                            disabled={isLocked}
                            onClick={() => setNewPromotion({ ...newPromotion, promoType: type.id, mechanism: type.id })}
                            style={{
                              padding: '8px',
                              backgroundColor: newPromotion.promoType === type.id ? t.bg : 'transparent',
                              color: newPromotion.promoType === type.id ? t.accent : t.textSecondary,
                              border: newPromotion.promoType === type.id ? t.border : 'none',
                              borderRadius: '10px',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              cursor: isLocked ? 'default' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: newPromotion.promoType === type.id ? t.shadowSmall : 'none'
                            }}
                          >
                            {type.icon} {type.label}
                          </button>
                        ))}
                      </div>

                      {newPromotion.promoType === 'simples' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                          {/* Row 1 & 2: Nome da Campanha e Validade na mesma linha */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: '1.25rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Nome da Campanha *</label>
                              <input
                                required
                                disabled={isLocked}
                                placeholder="Ex: BLACK FRIDAY 2024"
                                className="field-input"
                                value={newPromotion.nome}
                                onChange={e => setNewPromotion({ ...newPromotion, nome: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Data Início *</label>
                              <input
                                required
                                type="datetime-local"
                                disabled={isLocked}
                                className="field-input"
                                style={{ fontSize: '0.8rem' }}
                                value={newPromotion.dataInicio}
                                onChange={e => setNewPromotion({ ...newPromotion, dataInicio: e.target.value })}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Data Fim *</label>
                              <input
                                required
                                type="datetime-local"
                                disabled={isLocked}
                                className="field-input"
                                style={{ fontSize: '0.8rem' }}
                                value={newPromotion.dataFim}
                                onChange={e => setNewPromotion({ ...newPromotion, dataFim: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Row 3: Selecionar Produto (Lista geral suspensa) */}
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="field-label">Selecionar Produto</label>
                            <select
                              disabled={isLocked}
                              className="field-select"
                              style={{ height: '42px', width: '100%', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none', fontWeight: 600 }}
                              value=""
                              onChange={e => {
                                if (!e.target.value) return;
                                const pid = e.target.value;
                                if (!newPromotion.produtosSelecionados.includes(pid)) {
                                  setNewPromotion(prev => ({
                                    ...prev,
                                    produtosSelecionados: [...prev.produtosSelecionados, pid]
                                  }));
                                }
                                e.target.value = "";
                              }}
                            >
                              <option value="">Selecione o Produto...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.nome} (SKU: {p.sku})</option>
                              ))}
                            </select>
                          </div>

                          {/* Row 4: Produtos Escolhidos */}
                          <div style={{ padding: '1.25rem', backgroundColor: t.bgSecondary, border: t.border, borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: t.textMain, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                <Package size={16} style={{ color: t.accent }} /> Produtos Escolhidos
                              </h4>
                              <p style={{ fontSize: '0.75rem', color: t.textSecondary, margin: 0 }}>
                                Defina os preços promocionais para cada forma de pagamento.
                              </p>
                            </div>

                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                              {newPromotion.produtosSelecionados.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontStyle: 'italic', padding: '0.5rem 0' }}>
                                  Nenhum produto individual selecionado.
                                </div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: t.border, color: t.textSecondary, textAlign: 'left' }}>
                                      <th style={{ padding: '8px 4px', fontWeight: 600 }}>Produto</th>
                                      <th style={{ padding: '8px 4px', fontWeight: 600 }}>Custo</th>
                                      <th style={{ padding: '8px 4px', fontWeight: 600 }}>Venda</th>
                                      <th style={{ padding: '8px 4px', fontWeight: 600, width: '120px' }}>À Vista</th>
                                      <th style={{ padding: '8px 4px', fontWeight: 600, width: '120px' }}>No Cartão</th>
                                      <th style={{ padding: '8px 4px', width: '40px' }}></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {newPromotion.produtosSelecionados.map(pid => {
                                      const p = products.find(x => x.id === pid);
                                      if (!p) return null;
                                      return (
                                        <tr key={pid} style={{ borderBottom: t.border }}>
                                          <td style={{ padding: '8px 4px' }}>
                                            <div style={{ fontWeight: 600, color: t.textMain }}>{p.nome}</div>
                                            <div style={{ fontSize: '0.7rem', color: t.textSecondary }}>SKU: {p.sku}</div>
                                          </td>
                                          <td style={{ padding: '8px 4px', color: t.textSecondary }}>
                                            R$ {formatDisplayCurrency(p.precoCusto)}
                                          </td>
                                          <td style={{ padding: '8px 4px', fontWeight: 600, color: t.textMain }}>
                                            R$ {formatDisplayCurrency(p.precoVenda)}
                                          </td>
                                          <td style={{ padding: '8px 4px' }}>
                                            <input
                                              type="text"
                                              disabled={isLocked}
                                              placeholder="R$ 0,00"
                                              className="field-input"
                                              style={{
                                                height: '34px',
                                                padding: '0 8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                color: t.success,
                                                width: '110px'
                                              }}
                                              value={newPromotion.precosPromocionaisVista?.[pid] || ''}
                                              onChange={e => {
                                                const updatedPrices = { ...(newPromotion.precosPromocionaisVista || {}) };
                                                updatedPrices[pid] = maskCurrency(e.target.value);
                                                setNewPromotion({ ...newPromotion, precosPromocionaisVista: updatedPrices });
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '8px 4px' }}>
                                            <input
                                              type="text"
                                              disabled={isLocked}
                                              placeholder="R$ 0,00"
                                              className="field-input"
                                              style={{
                                                height: '34px',
                                                padding: '0 8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                color: t.success,
                                                width: '110px'
                                              }}
                                              value={newPromotion.precosPromocionaisCartao?.[pid] || ''}
                                              onChange={e => {
                                                const updatedPrices = { ...(newPromotion.precosPromocionaisCartao || {}) };
                                                updatedPrices[pid] = maskCurrency(e.target.value);
                                                setNewPromotion({ ...newPromotion, precosPromocionaisCartao: updatedPrices });
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                            {!isLocked && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updatedSelected = newPromotion.produtosSelecionados.filter(id => id !== pid);
                                                  const updatedPrices = { ...(newPromotion.precosPromocionais || {}) };
                                                  const updatedPricesVista = { ...(newPromotion.precosPromocionaisVista || {}) };
                                                  const updatedPricesCartao = { ...(newPromotion.precosPromocionaisCartao || {}) };
                                                  delete updatedPrices[pid];
                                                  delete updatedPricesVista[pid];
                                                  delete updatedPricesCartao[pid];
                                                  setNewPromotion({
                                                    ...newPromotion,
                                                    produtosSelecionados: updatedSelected,
                                                    precosPromocionais: updatedPrices,
                                                    precosPromocionaisVista: updatedPricesVista,
                                                    precosPromocionaisCartao: updatedPricesCartao
                                                  });
                                                }}
                                                style={{
                                                  height: '28px', width: '28px', backgroundColor: '#fee2e2', color: '#ef4444',
                                                  border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Row 1 & 2: Nome da Campanha e Validade na mesma linha */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: '1.25rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Nome da Campanha *</label>
                              <input
                                required
                                disabled={isLocked}
                                placeholder="Ex: COMBO REFRI + PIZZA"
                                className="field-input"
                                value={newPromotion.nome}
                                onChange={e => setNewPromotion({ ...newPromotion, nome: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Data Início</label>
                              <input type="datetime-local" className="field-input" style={{ fontSize: '0.8rem' }} value={newPromotion.dataInicio} onChange={e => setNewPromotion({ ...newPromotion, dataInicio: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Data Fim</label>
                              <input type="datetime-local" className="field-input" style={{ fontSize: '0.8rem' }} value={newPromotion.dataFim} onChange={e => setNewPromotion({ ...newPromotion, dataFim: e.target.value })} />
                            </div>
                          </div>

                          {/* Row 3: Construtor de Regras */}
                          <div style={{ border: t.border, padding: '1.25rem', borderRadius: '16px', backgroundColor: t.bgSecondary }}>
                            <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: t.textMain, margin: '0 0 1rem 0' }}>Montar Regras do Combo</h4>
                            <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: t.textSecondary }}>O combo é satisfeito se o cliente levar a quantidade especificada de itens em <strong>todos</strong> os cards ativos (AND divisorias). Dentro de cada card, os produtos são alternativos (OU).</p>

                            {/* 4 Cards Rules List */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                              {[0, 1, 2, 3].map(cardIdx => {
                                const card = (newPromotion.comboRules || [])[cardIdx];
                                if (!card) return null;
                                return (
                                  <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: t.border, padding: '1rem', borderRadius: '12px', backgroundColor: t.bg }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: t.textMain, textTransform: 'uppercase' }}>
                                        Card {cardIdx + 1} - Grupo OU
                                      </h5>
                                      {/* Quantity Input */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: t.textSecondary }}>Qtd. Itens:</label>
                                        <input
                                          type="number"
                                          disabled={isLocked}
                                          min="1"
                                          style={{ width: '45px', height: '24px', textAlign: 'center', borderRadius: '4px', border: t.border, fontSize: '0.75rem', fontWeight: 700, backgroundColor: t.bgSecondary, color: t.textMain }}
                                          value={card.requiredQty || 1}
                                          onChange={e => {
                                            const val = Math.max(1, parseInt(e.target.value) || 1);
                                            const updated = (newPromotion.comboRules || []).map(c => c.id === card.id ? { ...c, requiredQty: val } : c);
                                            setNewPromotion({ ...newPromotion, comboRules: updated });
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.65rem', color: t.textSecondary }}>Escolha {card.requiredQty || 1} produto(s) deste grupo.</p>

                                    {/* Product Selector for this Card */}
                                    <select
                                      disabled={isLocked}
                                      className="field-input"
                                      style={{ fontSize: '0.75rem', height: '34px', padding: '0 8px', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain }}
                                      value=""
                                      onChange={e => {
                                        if (!e.target.value) return;
                                        const pid = e.target.value;
                                        if (!card.products.includes(pid)) {
                                          const updatedProducts = [...card.products, pid];
                                          const updatedRules = (newPromotion.comboRules || []).map(c => c.id === card.id ? { ...c, products: updatedProducts } : c);
                                          setNewPromotion({ ...newPromotion, comboRules: updatedRules });
                                        }
                                        e.target.value = '';
                                      }}
                                    >
                                      <option value="">+ Adicionar Produto...</option>
                                      {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome} (SKU: {p.sku})</option>
                                      ))}
                                    </select>

                                    {/* Products inside this Card */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '80px', maxHeight: '150px', overflowY: 'auto' }}>
                                      {card.products.map(pid => {
                                        const p = products.find(x => x.id === pid);
                                        if (!p) return null;
                                        return (
                                          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '6px 8px', backgroundColor: t.bgSecondary, border: t.border, borderRadius: '8px' }}>
                                            {/* Move Left Button */}
                                            {cardIdx > 0 && (
                                              <button
                                                type="button"
                                                disabled={isLocked}
                                                title="Mover para card anterior"
                                                onClick={() => {
                                                  const newThisProducts = card.products.filter(id => id !== pid);
                                                  const prevCard = (newPromotion.comboRules || [])[cardIdx - 1];
                                                  const newPrevProducts = Array.from(new Set([...(prevCard.products || []), pid]));
                                                  const updatedRules = (newPromotion.comboRules || []).map((c, idx) => {
                                                    if (idx === cardIdx) return { ...c, products: newThisProducts };
                                                    if (idx === cardIdx - 1) return { ...c, products: newPrevProducts };
                                                    return c;
                                                  });
                                                  setNewPromotion({ ...newPromotion, comboRules: updatedRules });
                                                }}
                                                style={{ display: 'flex', color: t.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                              >
                                                <ArrowLeft size={12} />
                                              </button>
                                            )}

                                            <span style={{ flex: 1, fontWeight: 600, fontSize: '0.75rem', color: t.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>

                                            {/* Move Right Button */}
                                            {cardIdx < 3 && (
                                              <button
                                                type="button"
                                                disabled={isLocked}
                                                title="Mover para próximo card"
                                                onClick={() => {
                                                  const newThisProducts = card.products.filter(id => id !== pid);
                                                  const nextCard = (newPromotion.comboRules || [])[cardIdx + 1];
                                                  const newNextProducts = Array.from(new Set([...(nextCard.products || []), pid]));
                                                  const updatedRules = (newPromotion.comboRules || []).map((c, idx) => {
                                                    if (idx === cardIdx) return { ...c, products: newThisProducts };
                                                    if (idx === cardIdx + 1) return { ...c, products: newNextProducts };
                                                    return c;
                                                  });
                                                  setNewPromotion({ ...newPromotion, comboRules: updatedRules });
                                                }}
                                                style={{ display: 'flex', color: t.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                              >
                                                <ArrowRight size={12} />
                                              </button>
                                            )}

                                            {/* Delete */}
                                            <button
                                              type="button"
                                              disabled={isLocked}
                                              onClick={() => {
                                                const newThisProducts = card.products.filter(id => id !== pid);
                                                const updatedRules = (newPromotion.comboRules || []).map((c, idx) => idx === cardIdx ? { ...c, products: newThisProducts } : c);
                                                setNewPromotion({ ...newPromotion, comboRules: updatedRules });
                                              }}
                                              style={{ display: 'flex', color: t.danger, background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        );
                                      })}
                                      {card.products.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '0.5rem', color: t.textSecondary, fontSize: '0.7rem', fontStyle: 'italic' }}>
                                          Vazio
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Row 4: Preços Tiers e Possui Brinde no mesmo Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.2fr 1fr', gap: '1.25rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Preço à Vista (Pix/Dinheiro)</label>
                              <input
                                disabled={isLocked}
                                placeholder="R$ 0,00"
                                className="field-input"
                                style={{ color: t.success, fontWeight: 700 }}
                                value={newPromotion.precoPromocionalVista}
                                onChange={e => setNewPromotion({ ...newPromotion, precoPromocionalVista: maskCurrency(e.target.value) })}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Preço no Cartão</label>
                              <input
                                disabled={isLocked}
                                placeholder="R$ 0,00"
                                className="field-input"
                                style={{ color: t.success, fontWeight: 700 }}
                                value={newPromotion.precoPromocionalCartao}
                                onChange={e => setNewPromotion({ ...newPromotion, precoPromocionalCartao: maskCurrency(e.target.value) })}
                              />
                            </div>
                            {/* Possui Brinde Switch */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="field-label">Possui Brinde?</label>
                              <div style={{ display: 'flex', gap: '6px', height: '42px' }}>
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => setNewPromotion({ ...newPromotion, possuiBrinde: true })}
                                  style={{
                                    flex: 1,
                                    backgroundColor: newPromotion.possuiBrinde ? (t.successSoft || 'rgba(34, 197, 94, 0.1)') : t.bg,
                                    color: newPromotion.possuiBrinde ? (t.success || '#22c55e') : t.textSecondary,
                                    border: newPromotion.possuiBrinde ? `1.5px solid ${t.success || '#22c55e'}` : t.border,
                                    borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', cursor: isLocked ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                  }}
                                >
                                  SIM
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => setNewPromotion({ ...newPromotion, possuiBrinde: false, brindesSelecionados: [] })}
                                  style={{
                                    flex: 1,
                                    backgroundColor: !newPromotion.possuiBrinde ? (t.bgSecondary || '#f8fafc') : t.bg,
                                    color: !newPromotion.possuiBrinde ? (t.textMain || '#0f172a') : t.textSecondary,
                                    border: !newPromotion.possuiBrinde ? `1.5px solid ${t.border}` : t.border,
                                    borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', cursor: isLocked ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                  }}
                                >
                                  NÃO
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Conditional Brinde Fields */}
                          {newPromotion.possuiBrinde && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: t.border, padding: '1.25rem', borderRadius: '16px', backgroundColor: t.bgSecondary }}>
                              <h4 style={{ fontWeight: 600, fontSize: '0.85rem', color: t.textMain, margin: 0, textTransform: 'uppercase' }}>Produtos de Brinde (Ganhe)</h4>
                              
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="field-label" style={{ fontSize: '0.75rem' }}>Selecionar Brinde</label>
                                <select
                                  disabled={isLocked}
                                  className="field-select"
                                  style={{ height: '42px', width: '100%', borderRadius: t.radiusSmall, border: t.border, backgroundColor: t.bg, color: t.textMain, fontSize: '0.85rem', outline: 'none', fontWeight: 600 }}
                                  value=""
                                  onChange={e => {
                                    if (!e.target.value) return;
                                    const pid = e.target.value;
                                    const alreadyExists = (newPromotion.brindesSelecionados || []).some(b => b.productId === pid);
                                    if (!alreadyExists) {
                                      const updated = [...(newPromotion.brindesSelecionados || []), { productId: pid, quantity: 1 }];
                                      setNewPromotion({ ...newPromotion, brindesSelecionados: updated });
                                    }
                                    e.target.value = "";
                                  }}
                                >
                                  <option value="">+ Adicionar Brinde...</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome} (SKU: {p.sku})</option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(newPromotion.brindesSelecionados || []).map((giftItem, idx) => {
                                  const p = products.find(x => x.id === giftItem.productId);
                                  if (!p) return null;
                                  return (
                                    <div key={giftItem.productId} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '8px 12px', backgroundColor: t.bg, border: t.border, borderRadius: '10px' }}>
                                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.8rem', color: t.textMain }}>{p.nome}</span>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', color: t.textSecondary }}>Qtd. Ganhar:</label>
                                        <input
                                          type="number"
                                          disabled={isLocked}
                                          min="1"
                                          style={{ width: '50px', height: '26px', textAlign: 'center', borderRadius: '4px', border: t.border, fontSize: '0.75rem', fontWeight: 700, backgroundColor: t.bgSecondary, color: t.textMain }}
                                          value={giftItem.quantity || 1}
                                          onChange={e => {
                                            const val = Math.max(1, parseInt(e.target.value) || 1);
                                            const updated = (newPromotion.brindesSelecionados || []).map((b, i) => i === idx ? { ...b, quantity: val } : b);
                                            setNewPromotion({ ...newPromotion, brindesSelecionados: updated });
                                          }}
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const updated = (newPromotion.brindesSelecionados || []).filter((_, i) => i !== idx);
                                          setNewPromotion({ ...newPromotion, brindesSelecionados: updated });
                                        }}
                                        style={{ color: t.danger, background: 'none', border: 'none', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  );
                                })}
                                {(newPromotion.brindesSelecionados || []).length === 0 && (
                                  <div style={{ textAlign: 'center', padding: '1rem', color: t.textSecondary, fontSize: '0.75rem', fontStyle: 'italic' }}>
                                    Nenhum brinde adicionado ainda.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1.25rem 1.5rem', borderTop: `1px solid var(--border)`, display: 'flex', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
                {isLocked && editingProduct ? (
                  <button
                    type="button"
                    onClick={() => setIsLocked(false)}
                    className="modal-btn-primary"
                    style={{ background: t.accent, width: '100%' }}
                  >
                    <Edit3 size={18} /> Editar Registro
                  </button>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: editingProduct ? 'row' : 'column', gap: '0.75rem', alignItems: 'stretch' }}>
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        style={{
                          height: '45px', flex: 1, backgroundColor: t.bg, color: t.danger,
                          border: `1.5px solid ${t.danger}`, borderRadius: '12px',
                          fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.danger; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.bg; e.currentTarget.style.color = t.danger; }}
                      >
                        <Trash2 size={16} /> Excluir Registro
                      </button>
                    )}

                    <button
                      form="productForm"
                      type="submit"
                      disabled={saving}
                      style={{
                        height: '45px',
                        width: editingProduct ? 'auto' : '100%',
                        flex: editingProduct ? 1 : 'none',
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
                      {editingProduct ? 'Salvar Alterações' : (activeTab === 'estoque' ? 'Criar Produto' : 'Lançar Campanha')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <div className="modal-overlay">
            <motion.div
              initial={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{
                width: '100%',
                maxWidth: '500px',
                background: t.bg,
                border: t.border,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: `1px solid var(--border)`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    backgroundColor: t.accentSoft,
                    color: t.accent,
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex'
                  }}>
                    <Camera size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      Escanear Código
                    </h3>
                    <p className="modal-subtitle" style={{ margin: 0 }}>
                      Aponte para o código
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowScanner(false)}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div style={{ padding: '1.5rem', backgroundColor: t.bg }}>
                <div id="reader" style={{ border: t.border, borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000' }}></div>
                <div style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  backgroundColor: t.bgSecondary,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: t.textSecondary,
                  border: t.border
                }}>
                  <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Garanta boa iluminação para melhor leitura</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryModal && (
          <div className="modal-overlay">
            <motion.div
              initial={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{
                width: '100%',
                maxWidth: '375px',
                background: t.bg,
                border: t.border,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: `1px solid var(--border)`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    backgroundColor: t.accentSoft,
                    color: t.accent,
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex'
                  }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      Nova Categoria
                    </h3>
                  </div>
                </div>
                <motion.button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowCategoryModal(false)}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div style={{ padding: '1.5rem', backgroundColor: t.bg, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="field-label">Nome da Categoria</label>
                  <input
                    autoFocus
                    className="field-input"
                    placeholder="EX: BEBIDAS, LIMPEZA..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={loading}
                  style={{
                    height: '45px',
                    width: '100%',
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
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon size={16} />}
                  Salvar Categoria
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
