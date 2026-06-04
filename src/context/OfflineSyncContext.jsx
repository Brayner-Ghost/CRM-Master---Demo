import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { doc, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useUser } from './UserContext';
import { encryptData, decryptData } from '../utils/crypto';
import { offlineSalesStore, companySettingsStore, productsStore } from '../utils/offlineDb';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const OfflineSyncContext = createContext(null);

export const useOfflineSync = () => useContext(OfflineSyncContext);

const removeEmptyOrZero = (obj) => {
  if (obj === null || obj === undefined) return undefined;
  if (obj === "") return undefined;
  if (obj === 0) return undefined;
  if (obj === "0") return undefined;

  if (Array.isArray(obj)) {
    const cleanedArr = obj
      .map(item => (typeof item === 'object' ? removeEmptyOrZero(item) : item))
      .filter(item => item !== undefined && item !== null && item !== "" && item !== 0 && item !== "0");
    return cleanedArr.length > 0 ? cleanedArr : undefined;
  }

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

export const OfflineSyncProvider = ({ children }) => {
  const { user, getTenantCollection, getTenantDoc, activeCompany } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'info' | 'error' }

  // Atualiza contagem de pendentes periodicamente
  const updatePendingCount = async () => {
    try {
      const sales = await offlineSalesStore.getAll();
      setPendingCount(sales.length);
    } catch (e) {
      console.warn("Erro ao ler vendas locais no IndexedDB:", e);
    }
  };

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Exibe toast temporário
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  // Função centralizada de sincronização
  const syncOfflineQueue = async () => {
    if (isSyncing || !navigator.onLine || !user) return;

    try {
      const offlineSales = await offlineSalesStore.getAll();
      if (offlineSales.length === 0) return;

      setIsSyncing(true);
      showToast(`Sincronizando ${offlineSales.length} venda(s) offline...`, 'info');

      // Carrega empresa e integrações do cache local ou Firestore
      const targetComp = activeCompany || user?.empresa || 'development';
      let company = null;
      let integrations = null;

      try {
        const compSnap = await getDoc(doc(db, 'business', targetComp));
        if (compSnap.exists()) {
          const raw = compSnap.data();
          company = {
            ...raw,
            ambiente: raw.ambiente ? (decryptData(raw.ambiente) || 'homologacao') : 'homologacao',
            status: raw.status ? (decryptData(raw.status) || 'ativa') : 'ativa'
          };
        }
        const intSnap = await getDoc(getTenantDoc('company', 'integrations'));
        if (intSnap.exists()) {
          integrations = intSnap.data();
        }
      } catch (e) {
        console.warn("Sincronização online: Buscando configurações no IndexedDB local...", e);
        company = await companySettingsStore.get('company_data');
        integrations = await companySettingsStore.get('integrations');
      }

      if (!company) {
        throw new Error("Dados da empresa indisponíveis para sincronização.");
      }

      const emitirNfceFn = httpsCallable(functions, 'emitirNfce');

      for (const sale of offlineSales) {
        try {
          console.log(`[Sync Worker] Processando venda local: ${sale.id}`);

          let finalNfce = sale.nfce;

          // Se a venda deve emitir NFC-e e a nota local está em contingência
          if (sale.emitirNota && sale.nfce && sale.nfce.isOfflineContingency && integrations) {
            const hasToken = integrations.ambiente === 'producao' ? integrations.tokenProducao : integrations.tokenHomologacao;
            const decToken = hasToken ? (decryptData(hasToken) || hasToken) : null;

            if (decToken && integrations.emissaoNotaFiscal === 'ativo') {
              // Reconstrói o payload FocusNFe para contingência
              const reference = sale.nfce.reference || `nfce_${Date.now()}`;
              
              // Reconstrói e formata itens conforme Layout Focus NFe
              const items = sale.items.map((item, index) => {
                const isProduction = integrations.ambiente === 'producao';
                const icmsSit = integrations.regimeTributario === 'simples' ? '102' : '00';
                return {
                  numero_item: String(index + 1),
                  codigo_produto: item.id || `PROD${index + 1}`,
                  descricao: (item.nome || 'PRODUTO').substring(0, 120),
                  codigo_ncm: '00000000', // Padrão genérico de NCM se ausente
                  cfop: '5102',
                  unidade_comercial: 'UN',
                  quantidade_comercial: Number(item.quantity).toFixed(4),
                  valor_unitario_comercial: Number(item.promoPrice || item.price).toFixed(4),
                  unidade_tributavel: 'UN',
                  quantidade_tributavel: Number(item.quantity).toFixed(4),
                  valor_unitario_tributavel: Number(item.promoPrice || item.price).toFixed(4),
                  valor_bruto: Number((item.price) * item.quantity / 100).toFixed(2),
                  icms_origem: '0',
                  icms_situacao_tributaria: icmsSit,
                  icms_aliquota: '0',
                  icms_base_calculo: '0',
                  icms_modalidade_base_calculo: '0'
                };
              });

              const paymentMap = {
                'dinheiro': '01',
                'credito': '03',
                'debito': '04',
                'pix': integrations?.tipoPix || '20',
                'outros': '99'
              };

              const formas_pagamento = sale.payments.map(p => ({
                forma_pagamento: paymentMap[p.methodId] || '99',
                valor_pagamento: Number(p.value / 100).toFixed(2)
              }));

              const payload = {
                // Atributos Obrigatórios da SEFAZ para Contingência Offline
                tipo_emissao: '9',
                justificativa_contingencia: 'Instabilidade na conexao de rede no terminal de venda',
                data_contingencia: sale.nfce.data_contingencia || new Date().toISOString(),
                data_emissao: sale.nfce.data_contingencia || new Date().toISOString(),

                natureza_operacao: 'VENDA AO CONSUMIDOR',
                tipo_documento: '1',
                local_destino: '1',
                finalidade_emissao: '1',
                consumidor_final: '1',
                presenca_comprador: '1',
                modalidade_frete: '9',

                cnpj_emitente: (company.cnpj || '').replace(/\D/g, ''),
                nome_emitente: company.nomeFantasia || company.nome || '',
                nome_fantasia_emitente: company.nomeFantasia || company.nome || '',
                inscricao_estadual_emitente: (company.ie || '').replace(/\D/g, ''),
                logradouro_emitente: company.logradouro || '',
                numero_emitente: company.numero || 'SN',
                bairro_emitente: company.bairro || '',
                municipio_emitente: (() => {
                  const raw = company.cidadeUf || company.cidade || company.municipio || '';
                  const parts = raw.split(/\s*[\/\-]\s*/);
                  return (parts[0] || '').trim();
                })(),
                uf_emitente: (() => {
                  const raw = company.cidadeUf || company.cidade || company.municipio || '';
                  const parts = raw.split(/\s*[\/\-]\s*/);
                  const parsedUf = parts.length > 1 ? (parts[1] || '').trim() : '';
                  return parsedUf || company.estado || company.uf || '';
                })(),
                cep_emitente: (company.cep || '').replace(/\D/g, ''),

                valor_produtos: Number(sale.total / 100).toFixed(2),
                valor_total: Number(sale.total / 100).toFixed(2),
                items,
                formas_pagamento
              };

              console.log(`[Sync Worker] Enviando NFC-e em contingência offline. Ref: ${reference}`);
              
              const res = await emitirNfceFn({
                payload,
                reference,
                token: decToken,
                ambiente: integrations.ambiente,
                saleId: sale.id
              });

              if (res.data && res.data.success) {
                const details = res.data.data || {};
                finalNfce = {
                  success: true,
                  reference,
                  status: details.status || 'autorizado',
                  chave: details.chave_nfe,
                  protocolo: details.protocolo,
                  digestValue: details.digest_value || null,
                  numero: details.numero,
                  serie: details.serie,
                  urlPdf: details.caminho_danfe || details.caminho_pdf_danfe,
                  urlXml: details.caminho_xml_nota_fiscal,
                  qrcodeUrl: details.qrcode_url || details.url_danfe_qrcode,
                  storageXmlUrl: details.storageXmlUrl || null,
                  storageQrUrl: details.storageQrUrl || null,
                  tipo_emissao: 9
                };
                console.log(`[Sync Worker] NFC-e autorizada pós-contingência! Chave: ${details.chave_nfe}`);
              } else {
                console.warn(`[Sync Worker] Falha no retorno FocusNFe para ref ${reference}. Mantendo contingência local.`);
              }
            }
          }

          // Monta e criptografa payload de venda para Firestore central
          const serverCol = getTenantCollection('sales');
          const saleDoc = doc(serverCol, sale.id);

          const encryptedSaleData = JSON.parse(JSON.stringify({
            ...sale,
            nfce: finalNfce,
            isOffline: undefined // Remove tag local para ficar limpo no Firestore
          }));

          if (encryptedSaleData.observacao) {
            encryptedSaleData.observacao = encryptData(encryptedSaleData.observacao);
          }
          if (encryptedSaleData.partnerName) {
            encryptedSaleData.partnerName = encryptData(encryptedSaleData.partnerName);
          }
          if (encryptedSaleData.client) {
            encryptedSaleData.client = {
              ...encryptedSaleData.client,
              cpf: encryptData(encryptedSaleData.client.cpf),
              telefone: encryptData(encryptedSaleData.client.telefone)
            };
          }

          const cleanedEncryptedSale = removeEmptyOrZero(encryptedSaleData) || {};

          // 1. Salvar venda no Firestore
          await setDoc(saleDoc, cleanedEncryptedSale);

          // 2. Decrementar estoque central no Firestore
          for (const item of sale.items) {
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
                  console.log(`[Sync Worker] Estoque do produto ${item.nome} (${item.id}) atualizado de ${currentStock} para ${newStock}`);
                } else {
                  console.warn(`[Sync Worker] Produto ${item.nome} (${item.id}) não encontrado no inventário.`);
                }
              } catch (err) {
                console.error(`[Sync Worker] Erro ao atualizar estoque do produto ${item.nome}:`, err);
              }
            }
          }

          // 3. Incrementar pontos do parceiro se aplicável
          if (sale.partnerId) {
            try {
              await updateDoc(getTenantDoc('partners', sale.partnerId), {
                pontos: increment(1)
              });
            } catch (err) {
              console.warn("Erro ao pontuar parceiro na sincronização:", err);
            }
          }

          // 4. Deletar do IndexedDB local
          await offlineSalesStore.delete(sale.id);

          showToast(`Venda #${sale.id.slice(-6).toUpperCase()} sincronizada e registrada com sucesso!`, 'success');
        } catch (saleErr) {
          console.error(`Erro ao sincronizar venda individual ${sale.id}:`, saleErr);
        }
      }

      await updatePendingCount();
    } catch (e) {
      console.error("[Sync Worker] Erro geral de sincronização:", e);
      showToast('Falha na sincronização em segundo plano das vendas offline.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Escuta evento de volta da conexão
  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, [user, activeCompany]);

  // Efeito para checagem de sincronização automática a cada 60s se online
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        syncOfflineQueue();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, activeCompany, isSyncing]);

  return (
    <OfflineSyncContext.Provider value={{ syncOfflineQueue, isSyncing, pendingCount }}>
      {children}
      
      {/* Toast Notification Container */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          borderRadius: '12px',
          backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          maxWidth: '380px',
          transition: 'all 0.3s ease'
        }}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <Loader2 size={18} className="animate-spin" />}
          <div>{toast.message}</div>
        </div>
      )}
    </OfflineSyncContext.Provider>
  );
};
