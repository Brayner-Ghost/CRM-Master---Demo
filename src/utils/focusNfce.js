import CryptoJS from 'crypto-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// Chaves de decriptação — Settings.jsx usa a chave hardcoded, crypto.js usa a env var
const SETTINGS_KEY = 'crm-ultra-secret-key-2026';
const ENV_KEY = import.meta.env.VITE_ENCRYPTION_KEY || SETTINGS_KEY;

/**
 * Tenta decriptar com ambas as chaves possíveis
 */
const decryptToken = (ciphertext) => {
  if (!ciphertext) return '';
  // Tentar com a chave do Settings (que é usada para encriptar tokens)
  for (const key of [SETTINGS_KEY, ENV_KEY]) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, key);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 5) return result; // Token válido encontrado
    } catch {}
  }
  // Se nenhuma chave funcionou, retornar o valor original (pode já estar em plain text)
  return ciphertext;
};

/**
 * Emite uma NFC-e através da Cloud Function proxy para a API FocusNFE
 * Seguindo documentação: https://focusnfe.com.br/doc/?shell#nfce_campos-obrigatorios-de-uma-nfce
 * 
 * A chamada é feita via Cloud Function para evitar problemas de CORS,
 * já que o browser não pode chamar a API FocusNFE diretamente.
 */
export const emitirNfce = async (sale, company, integrations, saleId = null) => {
  try {
    const isProduction = integrations.ambiente === 'producao';
    const token = isProduction ? integrations.tokenProducao : integrations.tokenHomologacao;
    const decToken = decryptToken(token);

    console.log('=== TOKEN DEBUG ===');
    console.log('Ambiente:', integrations.ambiente);
    console.log('Token encriptado (raw):', token ? `${token.substring(0, 20)}...` : 'VAZIO');
    console.log('Token decriptado:', decToken ? `${decToken.substring(0, 5)}...` : 'VAZIO');
    console.log('Token === decToken?', token === decToken, '(se true, talvez não esteja encriptado)');
    console.log('===================');

    if (!decToken) throw new Error('Token FocusNFE não configurado.');

    // Gerar uma referência única para a FocusNFE (alfanumérico, obrigatório)
    const reference = `nfce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // --- Parsear cidade e UF do campo cidade/cidadeUf (formato: "Cidade / UF" ou "Cidade - UF") ---
    let municipio = '';
    let uf = '';
    const rawCidade = company.cidadeUf || company.cidade || company.municipio || '';
    if (rawCidade) {
      const parts = rawCidade.split(/\s*[\/\-]\s*/);
      if (parts.length > 1) {
        municipio = (parts[0] || '').trim();
        uf = (parts[1] || '').trim();
      } else {
        municipio = rawCidade.trim();
      }
    }
    // Fallbacks
    uf = uf || company.estado || company.uf || '';

    // --- Calcular totais iniciais ---
    // Valor total original (bruto) de todos os produtos
    const totalBrutoOriginalCents = sale.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Valor total após promoções (mas antes de cupom/desconto manual)
    const totalPosPromoCents = sale.items.reduce((acc, item) => acc + (item.promoPrice * item.quantity), 0);
    
    // Desconto originado por promoções (inclusive brindes)
    const totalPromoDiscountCents = totalBrutoOriginalCents - totalPosPromoCents;
    
    // Desconto manual/cupom
    const totalCouponManualDiscountCents = sale.discount || 0;
    
    // Desconto TOTAL a ser reportado na nota
    const totalGlobalDiscountCents = totalPromoDiscountCents + totalCouponManualDiscountCents;
    const shippingCents = sale.shipping || 0;

    // --- Mapear itens com distribuição de desconto e frete ---
    const activeDiscountMethod = sale.metodoDescontoNota || integrations.metodoDescontoNota || 'rateio';
    let distributedDiscountCents = 0;
    let distributedShippingCents = 0;
    const items = sale.items.map((item, index) => {
      // 1. Desconto da promoção para este item
      const itemPromoDiscountCents = (item.price - item.promoPrice) * item.quantity;
      
      // 2. Desconto do cupom/manual (proporcional ao valor PAGO após promo)
      let itemCouponDiscountCents = 0;
      if (totalCouponManualDiscountCents > 0 && totalPosPromoCents > 0) {
        // Apenas itens que ainda tem valor (não brindes 100%) recebem share do cupom
        const itemTotalPosPromoCents = item.promoPrice * item.quantity;
        itemCouponDiscountCents = Math.floor(totalCouponManualDiscountCents * (itemTotalPosPromoCents / totalPosPromoCents));
      }

      let itemDiscountTotalCents = itemPromoDiscountCents + itemCouponDiscountCents;
      
      // Ajuste no último item para evitar erros de arredondamento no total de descontos
      if (index === sale.items.length - 1) {
        itemDiscountTotalCents = totalGlobalDiscountCents - distributedDiscountCents;
      }
      
      distributedDiscountCents += itemDiscountTotalCents;
      const itemDiscountFinal = itemDiscountTotalCents / 100;

      // 3. Distribuição proporcional de Frete (proporcional ao valor bruto do item em relação ao bruto total)
      const valorBrutoItemCents = item.price * item.quantity;
      let itemShippingCents = 0;
      if (shippingCents > 0 && totalBrutoOriginalCents > 0) {
        itemShippingCents = Math.floor(shippingCents * (valorBrutoItemCents / totalBrutoOriginalCents));
      }
      
      // Ajuste no último item para frete
      if (index === sale.items.length - 1) {
        itemShippingCents = shippingCents - distributedShippingCents;
      }
      
      distributedShippingCents += itemShippingCents;
      const itemShippingFinal = itemShippingCents / 100;

      // Determine prices based on discount method
      let valorUnitario;
      let valorBrutoItem;
      let valorDescontoItem;

      if (activeDiscountMethod === 'valor_zerado') {
        const valorLiquidoItemCents = valorBrutoItemCents - itemDiscountTotalCents;
        valorUnitario = (valorLiquidoItemCents / item.quantity) / 100;
        valorBrutoItem = valorLiquidoItemCents / 100;
        valorDescontoItem = undefined;
      } else {
        valorUnitario = item.price / 100;
        valorBrutoItem = valorUnitario * item.quantity;
        valorDescontoItem = itemDiscountFinal > 0 ? itemDiscountFinal.toFixed(2) : undefined;
      }

      return {
        numero_item: String(index + 1),
        codigo_produto: item.id || item.sku || item.codigo || `PROD${index + 1}`,
        descricao: (item.nome || 'PRODUTO').substring(0, 120),
        codigo_ncm: (item.ncm || '').replace(/\D/g, '') || '00000000',
        cfop: '5102',
        unidade_comercial: item.unidade || 'UN',
        quantidade_comercial: item.quantity.toFixed(4),
        valor_unitario_comercial: valorUnitario.toFixed(4),
        unidade_tributavel: item.unidade || 'UN',
        quantidade_tributavel: item.quantity.toFixed(4),
        valor_unitario_tributavel: valorUnitario.toFixed(4),
        valor_bruto: valorBrutoItem.toFixed(2),
        valor_desconto: valorDescontoItem,
        valor_frete: itemShippingFinal > 0 ? itemShippingFinal.toFixed(2) : undefined,
        icms_origem: '0',
        icms_situacao_tributaria: integrations.regimeTributario === 'simples' ? '102' : '00',
        icms_aliquota: '0',
        icms_base_calculo: '0',
        icms_modalidade_base_calculo: '0'
      };
    });

    // --- Mapear pagamentos ---
    const paymentMap = {
      'dinheiro': '01',
      'cheque': '02',
      'cartao_credito': '03',
      'credito': '03',
      'cartao_debito': '04',
      'debito': '04',
      'alimentacao': '10',
      'refeicao': '11',
      'pix': integrations?.tipoPix || '20',
      'outros': '99'
    };

    const formas_pagamento = sale.payments
      .filter(p => !p.methodId?.startsWith('desconto'))
      .map(p => {
        const forma = paymentMap[p.methodId] || paymentMap[p.method?.toLowerCase()] || '99';
        const item = {
          forma_pagamento: forma,
          valor_pagamento: (p.value / 100).toFixed(2)
        };

        // Enviar dados de integração e cartão apenas para formas de pagamento de cartão/voucher (03, 04, 10, 11)
        if (['03', '04', '10', '11'].includes(forma)) {
          if (p.tipo_integracao) {
            item.tipo_integracao = String(p.tipo_integracao);
          }
          if (p.cnpj_credenciadora) {
            item.cnpj_credenciadora = String(p.cnpj_credenciadora).replace(/\D/g, '');
          }
          if (p.numero_autorizacao) {
            item.numero_autorizacao = String(p.numero_autorizacao);
          }
          if (p.bandeira_operadora && p.bandeira_operadora !== '99') {
            item.bandeira_operadora = String(p.bandeira_operadora);
          }
        }

        return item;
      });

    // --- Calcular troco ---
    const totalPayments = sale.payments
      .filter(p => !p.methodId?.startsWith('desconto'))
      .reduce((acc, p) => acc + (p.value || 0), 0);
    const troco = totalPayments > sale.total ? (totalPayments - sale.total) / 100 : 0;

    // --- Montar payload conforme documentação FocusNFE ---
    // Gerar data de emissão no formato ISO 8601 com timezone Brasil
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dataEmissao = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}-03:00`;

    const payload = {
      // === Campos obrigatórios da nota ===
      data_emissao: dataEmissao,
      natureza_operacao: 'VENDA AO CONSUMIDOR',
      tipo_documento: '1',                // 1 = Saída
      local_destino: '1',                 // 1 = Operação interna
      finalidade_emissao: '1',             // 1 = Normal
      consumidor_final: '1',               // 1 = Consumidor final
      presenca_comprador: '1',             // 1 = Presencial
      modalidade_frete: '9',               // 9 = Sem frete (balcão)

      cnpj_emitente: (company.cnpj || '').replace(/\D/g, ''),
      nome_emitente: company.nomeFantasia || company.nome || '',
      nome_fantasia_emitente: company.nomeFantasia || company.nome || '',
      inscricao_estadual_emitente: (company.ie || '').replace(/\D/g, ''),
      logradouro_emitente: company.logradouro || '',
      numero_emitente: company.numero || 'SN',
      bairro_emitente: company.bairro || '',
      municipio_emitente: municipio,
      uf_emitente: uf,
      cep_emitente: (company.cep || '').replace(/\D/g, ''),
      telefone_emitente: (company.telefone || '').replace(/\D/g, ''),

      valor_produtos: activeDiscountMethod === 'valor_zerado'
        ? ((totalBrutoOriginalCents - totalGlobalDiscountCents) / 100).toFixed(2)
        : (totalBrutoOriginalCents / 100).toFixed(2),
      valor_desconto: activeDiscountMethod === 'valor_zerado'
        ? undefined
        : (totalGlobalDiscountCents > 0 ? (totalGlobalDiscountCents / 100).toFixed(2) : undefined),
      valor_total: (sale.total / 100).toFixed(2),

      // === Itens ===
      items,

      // === Formas de pagamento ===
      formas_pagamento
    };

    // === Troco ===
    if (troco > 0) {
      payload.valor_troco = troco.toFixed(2);
    }

    // === Frete (se houver) ===
    if (sale.shipping && sale.shipping > 0) {
      payload.valor_frete = (sale.shipping / 100).toFixed(2);
      payload.modalidade_frete = '1'; // 1 = Contratação por conta do remetente (CIF)
    }

    // === Dados do destinatário (cliente) - opcional na NFC-e ===
    const isRetiradaOuEntrega = sale.type === 'retirada' || sale.type === 'entrega';
    if (!isRetiradaOuEntrega && sale.client?.cpf) {
      const cleanCpf = sale.client.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        payload.cpf_destinatario = cleanCpf;
        if (sale.client.nome) {
          payload.nome_destinatario = sale.client.nome;
        }
      } else if (cleanCpf.length === 14) {
        payload.cnpj_destinatario = cleanCpf;
        if (sale.client.nome) {
          payload.nome_destinatario = sale.client.nome;
        }
      }
    }

    // === Informações adicionais (opcional) ===
    payload.informacoes_adicionais_contribuinte = 'Venda emitida via sistema CRM.';

    // ============================================
    // LOG: Exibir payload no console antes do envio
    // ============================================
    console.log('=== FOCUSNFE NFC-e ENVIO ===');
    console.log('Ambiente:', isProduction ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO');
    console.log('Referência:', reference);
    console.log('Payload JSON:', JSON.stringify(payload, null, 2));
    console.log('============================');

    // === Enviar via Cloud Function (evita CORS) ===
    const emitirNfceFn = httpsCallable(functions, 'emitirNfce');

    const callResult = await emitirNfceFn({
      payload,
      reference,
      token: decToken,
      ambiente: integrations.ambiente,
      saleId // Passar o ID da venda para o Storage no backend
    });

    const responseData = callResult.data;

    // ============================================
    // LOG: Exibir resposta no console
    // ============================================
    console.log('=== FOCUSNFE NFC-e RESPOSTA ===');
    console.log('Cloud Function Response:', JSON.stringify(responseData, null, 2));
    console.log('===============================');

    // Extrair o resultado final (pode ser da consulta ou da resposta direta)
    const result = responseData.data || {};
    const initialData = responseData.initialData || {};

    if (responseData.success) {
      return {
        success: true,
        reference,
        status: result.status || initialData.status || 'processando_autorizacao',
        chave: result.chave_nfe || initialData.chave_nfe,
        protocolo: result.protocolo || initialData.protocolo,
        digestValue: result.digest_value || initialData.digest_value || null,
        numero: result.numero || initialData.numero,
        serie: result.serie || initialData.serie,
        urlPdf: result.caminho_danfe || result.caminho_pdf_danfe || initialData.caminho_danfe,
        urlXml: result.caminho_xml_nota_fiscal || initialData.caminho_xml_nota_fiscal,
        qrcodeUrl: result.qrcode_url || result.url_danfe_qrcode || initialData.qrcode_url || initialData.url_danfe_qrcode,
        urlConsulta: result.url_consulta_nf || initialData.url_consulta_nf || result.url_consulta || initialData.url_consulta || null,
        storageXmlUrl: result.storageXmlUrl || initialData.storageXmlUrl || null,
        storageQrUrl: result.storageQrUrl || initialData.storageQrUrl || null,
        error: null
      };
    } else {
      console.error('❌ Erro FocusNFE:', result);
      let errorMsg = 'Erro desconhecido na emissão da NFC-e.';
      if (result.mensagem) {
        errorMsg = result.mensagem;
      } else if (result.erros) {
        if (Array.isArray(result.erros)) {
          errorMsg = result.erros.map(e => e.mensagem || JSON.stringify(e)).join('; ');
        } else {
          errorMsg = JSON.stringify(result.erros);
        }
      } else if (result.codigo) {
        errorMsg = `Código ${result.codigo}: ${result.mensagem || 'Erro na validação'}`;
      }

      return {
        success: false,
        error: errorMsg,
        rawResponse: result
      };
    }
  } catch (error) {
    console.error('❌ Erro crítico na emissão da NFC-e:', error);
    // Tratar erro do Cloud Function
    let errorMessage = error.message;
    if (error.code === 'functions/internal') {
      errorMessage = `Erro no servidor: ${error.message}`;
    } else if (error.code === 'functions/invalid-argument') {
      errorMessage = `Dados inválidos: ${error.message}`;
    }
    return {
      success: false,
      error: errorMessage
    };
  }
};
/**
 * Cancela uma NFC-e emitida
 */
export const cancelarNfce = async (reference, integrations, justificativa = 'Cancelamento solicitado pelo cliente') => {
  try {
    const isProduction = integrations.ambiente === 'producao';
    const token = isProduction ? integrations.tokenProducao : integrations.tokenHomologacao;
    const decToken = decryptToken(token);

    if (!decToken) throw new Error('Token FocusNFE não configurado.');

    const cancelarNfceFn = httpsCallable(functions, 'cancelarNfce');
    const result = await cancelarNfceFn({
      reference,
      token: decToken,
      ambiente: integrations.ambiente,
      justificativa
    });

    return {
      success: result.data.success,
      data: result.data.data,
      error: !result.data.success ? (result.data.data.mensagem || 'Erro ao cancelar') : null
    };
  } catch (error) {
    console.error('Erro ao cancelar NFC-e:', error);
    return { success: false, error: error.message };
  }
};
