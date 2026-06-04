import * as XLSX from 'xlsx';
import { db, storage, functions } from '../firebase';
import { collection, getDocs, addDoc, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { encryptSensitiveFields, decryptSensitiveFields, encryptLegacySale } from './crypto';
import { validateCPF, validateCEP, maskCPF, maskCEP, maskCNPJ } from './formatters';

const buscaCepHelper = async (cep) => {
  const cleanCep = String(cep).replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();
    if (!data.erro) {
      return {
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidadeUf: `${data.localidade} - ${data.uf}`
      };
    }
  } catch (e) { console.error("Erro busca CEP helper:", e); }
  return null;
};

export const copyImageUrlToStorage = async (url, storageInstance, customPath = null) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

  if (url.startsWith("https://firebasestorage.googleapis.com/v0/b/rj-power-ltda-e9090.firebasestorage.app")) {
    return url;
  }

  try {
    if (customPath) {
      // 1. Try to guess the extension from the URL first to avoid an unnecessary fetch
      let ext = 'jpg';
      const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      if (match) {
        ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg'; // normalize jpeg to jpg
      }
      
      const guessedPath = `${customPath}.${ext}`;
      const guessedRef = ref(storageInstance, guessedPath);
      try {
        await getMetadata(guessedRef);
        const downloadUrl = await getDownloadURL(guessedRef);
        return downloadUrl; // Image already exists in storage!
      } catch (e) {
        // Not found with guessed extension, proceed to fetch
      }
      
      // Extract parameters from customPath to call backend
      const parts = customPath.split('/');
      const companyId = parts[1] || 'development';
      const sku = parts[2] || 'unknown';
      const letter = parts[3] ? parts[3].replace('imagens', '') : 'A';

      // 2. Call backend Cloud Function to download and save the image without CORS issues
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      await sleep(1000); // 1 second delay per request to avoid rate limit/blocking

      const copyFn = httpsCallable(functions, 'copyImageToStorage');
      const res = await copyFn({ url, companyId, sku, letter });
      if (res.data && res.data.success) {
        return res.data.downloadUrl;
      }
      throw new Error("Backend Cloud Function copyImageToStorage failed");
    } else {
      // Default behavior (if no customPath is specified)
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();

      let ext = 'jpg';
      const contentType = response.headers.get('content-type');
      if (contentType) {
        const parts = contentType.split('/');
        if (parts.length === 2) ext = parts[1];
      } else {
        const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
        if (match) ext = match[1];
      }

      const fileName = `imported_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const storageRef = ref(storageInstance, `products/${fileName}`);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    }
  } catch (err) {
    const isFetchError = err instanceof TypeError || String(err.message).includes('fetch') || String(err.message).includes('Fetch');
    if (isFetchError) {
      console.warn(`[CORS Fallback] Não foi possível copiar a imagem de ${url} para o Storage devido a restrições de CORS do site de origem. O link original será mantido e exibido normalmente no app.`);
    } else {
      console.error(`Erro ao copiar imagem de ${url} para o Storage:`, err);
    }
    return url;
  }
};

const isIgnoredValue = (val) => {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const clean = val.trim().toLowerCase();
    return clean === '' || clean === 'n/a' || clean === 'n\\a' || clean === 'na' || clean === '--nao informado' || clean === '--não informado';
  }
  return false;
};

export const exportCollectionToXLSX = async (collectionName, fileName, companyId = null, selectedColumns = null) => {
  if (collectionName === 'deals') collectionName = 'sales';
  try {
    const path = companyId ? `business/${companyId}/${collectionName}` : collectionName;
    const querySnapshot = await getDocs(collection(db, path));
    
    const data = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      let docData = docSnap.data();
      
      if (collectionName === 'contacts') {
        const contactId = docSnap.id;
        const fiscalRef = doc(db, `${path}/${contactId}/enderecofiscal`, 'default');
        const deliveryRef = doc(db, `${path}/${contactId}/enderecoentrega`, 'default');
        
        const [fiscalSnap, deliverySnap] = await Promise.all([
          getDoc(fiscalRef),
          getDoc(deliveryRef)
        ]);

        let fiscalData = {};
        let deliveryData = {};

        if (fiscalSnap.exists()) fiscalData = fiscalSnap.data();
        if (deliverySnap.exists()) deliveryData = deliverySnap.data();

        docData = {
          ...docData,
          cep: docData.cep || fiscalData.cep || '',
          logradouro: docData.logradouro || fiscalData.logradouro || '',
          numero: docData.numero || fiscalData.numero || '',
          bairro: docData.bairro || fiscalData.bairro || '',
          cidadeUf: docData.cidadeUf || fiscalData.cidadeUf || '',
          complemento: docData.complemento || fiscalData.complemento || '',
          entregaCep: docData.entregaCep || deliveryData.cep || '',
          entregaLogradouro: docData.entregaLogradouro || deliveryData.logradouro || '',
          entregaNumero: docData.entregaNumero || deliveryData.numero || '',
          entregaBairro: docData.entregaBairro || deliveryData.bairro || '',
          entregaCidadeUf: docData.entregaCidadeUf || deliveryData.cidadeUf || '',
          entregaComplemento: docData.entregaComplemento || deliveryData.complemento || ''
        };

        docData = decryptSensitiveFields(docData);
        
        if (docData.entregaMesmoEndereco === true || String(docData.entregaMesmoEndereco).toLowerCase() === 'true' || docData.entregaMesmoEndereco === 'SIM') {
          docData.entregaCep = '--nao disponivel--';
          docData.entregaLogradouro = '--nao disponivel--';
          docData.entregaNumero = '--nao disponivel--';
          docData.entregaBairro = '--nao disponivel--';
          docData.entregaCidadeUf = '--nao disponivel--';
          docData.entregaMesmoEndereco = 'SIM';
        } else {
          docData.entregaMesmoEndereco = 'NÃO';
        }
      }
      
      if (collectionName === 'sales') {
        const subtotalCents = docData.items?.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0) || docData.total || 0;
        
        const formattedItems = (docData.items || []).map(item => {
          const qty = item.quantity || 1;
          const priceDecimal = Number(item.price || 0) / 100;
          return `${item.nome || 'Produto'} (x${qty} - ${priceDecimal})`;
        }).join('; ');

        let formattedPayment = docData.metodoPagamento || '';
        if (docData.payments && docData.payments.length > 0) {
          formattedPayment = docData.payments.map(pay => {
            const payVal = Number(pay.value || 0) / 100;
            return `${pay.method || 'N/A'}: ${payVal}`;
          }).join('; ');
        }

        docData = {
          ...docData,
          valor: subtotalCents / 100,
          desconto: Number(docData.discount || docData.desconto || 0) / 100,
          frete: Number(docData.shipping || docData.frete || 0) / 100,
          total: Number(docData.total || 0) / 100,
          items: formattedItems,
          metodoPagamento: formattedPayment,
          clienteNome: docData.client?.nome || docData.clienteNome || docData.clientName || 'Consumidor'
        };
      }
      
      const cleanData = {};
      Object.keys(docData).forEach(key => {
        if (selectedColumns && !selectedColumns.includes(key)) {
          return;
        }
        const val = docData[key];
        if (val && typeof val === 'object' && val.seconds) {
          cleanData[key] = new Date(val.seconds * 1000).toLocaleString();
        } else {
          cleanData[key] = val;
        }
      });
      return cleanData;
    }));


    if (data.length === 0) {
      throw new Error('Nenhum dado encontrado para exportar.');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
    return true;
  } catch (error) {
    console.error("Erro na exportação:", error);
    throw error;
  }
};

export const getHeadersFromXLSX = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Get headers by reading the first row
        const headers = [];
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
          let hdr = "UNKNOWN " + C;
          if (cell && cell.t) hdr = XLSX.utils.format_cell(cell);
          headers.push(hdr);
        }
        resolve(headers);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

const safeParseDate = (value, dbField) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return null;
  }
  const isISO = dbField === 'createdAt' || dbField === 'dataFinalizacao';
  
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return isISO ? value.toISOString() : value.toISOString().split('T')[0];
    }
    return null;
  }
  
  if (typeof value === 'number' || (!isNaN(value) && Number(value) > 10000)) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(Number(value));
      const jsDate = new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H || 0, dateObj.M || 0, dateObj.S || 0));
      if (!isNaN(jsDate.getTime())) {
        return isISO ? jsDate.toISOString() : `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      }
    } catch (e) {}
    try {
      const date = new Date(Math.round((Number(value) - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return isISO ? date.toISOString() : date.toISOString().split('T')[0];
      }
    } catch (e) {}
  }
  
  if (typeof value === 'string' && value.trim()) {
    let str = value.trim();
    
    // 1. Try parsing directly via new Date first (only if it looks like an ISO format starting with a 4-digit year and no slashes)
    if (/^\d{4}/.test(str) && !str.includes('/')) {
      try {
        const parsedD = new Date(str);
        if (!isNaN(parsedD.getTime())) {
          return isISO ? parsedD.toISOString() : parsedD.toISOString().split('T')[0];
        }
      } catch (e) {}
    }

    // 2. Clean spaces and commas to normalize formats: e.g. "11/12/2025, 09:35:33" -> "11/12/2025 09:35:33"
    let cleanStr = str.replace(',', ' ').replace(/\s+/g, ' ').trim();

    // 3. Extract time if present (e.g. "09:35:33" or "15:32:21.000Z")
    let timeStr = '12:00:00';
    const timeMatch = cleanStr.match(/(\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[-+]\d{2}:?\d{2})?)/);
    if (timeMatch) {
      timeStr = timeMatch[1];
      // Strip time and key tags to isolate the raw date digits/delimiters
      cleanStr = cleanStr.replace(timeStr, '')
                         .replace(/[Tt]/g, '')
                         .replace(/[Zz]/g, '')
                         .replace(/\s+/g, ' ')
                         .trim();
      // Remove orphaned slashes from front or end if time extraction split them, e.g. "/05/2026"
      if (cleanStr.startsWith('/')) cleanStr = cleanStr.substring(1);
      if (cleanStr.endsWith('/')) cleanStr = cleanStr.substring(0, cleanStr.length - 1);
    }

    // 4. Parse the cleaned date string
    if (cleanStr.includes('/')) {
      const dateParts = cleanStr.split('/');
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        const isoCandidate = `${year}-${month}-${day}T${timeStr}`;
        try {
          const parsedD = new Date(isoCandidate);
          if (!isNaN(parsedD.getTime())) {
            return isISO ? parsedD.toISOString() : `${year}-${month}-${day}`;
          }
          const backupD = new Date(isoCandidate.replace('T', ' '));
          if (!isNaN(backupD.getTime())) {
            return isISO ? backupD.toISOString() : `${year}-${month}-${day}`;
          }
        } catch (e) {}
        try {
          const simpleD = new Date(`${year}-${month}-${day}T00:00:00Z`);
          if (!isNaN(simpleD.getTime())) {
            return isISO ? simpleD.toISOString() : `${year}-${month}-${day}`;
          }
        } catch (e) {}
      }
    } else if (cleanStr.includes('-')) {
      const dateParts = cleanStr.split('-');
      if (dateParts.length === 3) {
        let year, month, day;
        if (dateParts[0].length === 4) {
          year = dateParts[0];
          month = dateParts[1].padStart(2, '0');
          day = dateParts[2].padStart(2, '0');
        } else {
          day = dateParts[0].padStart(2, '0');
          month = dateParts[1].padStart(2, '0');
          year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        }
        const isoCandidate = `${year}-${month}-${day}T${timeStr}`;
        try {
          const parsedD = new Date(isoCandidate);
          if (!isNaN(parsedD.getTime())) {
            return isISO ? parsedD.toISOString() : `${year}-${month}-${day}`;
          }
        } catch (e) {}
      }
    }
  }
  
  return null;
};

export const importXLSXToCollection = async (file, collectionName, onProgress, mapping = null, companyId = null) => {
  if (collectionName === 'deals') collectionName = 'sales';
  const getPath = (name) => companyId ? `business/${companyId}/${name}` : name;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001, cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (jsonData.length === 0) {
          throw new Error('O arquivo está vazio.');
        }

        const existingDocs = { sku: {}, cpf: {}, email: {}, telefone: {}, nome: {}, saleId: {} };
        const querySnapshot = await getDocs(collection(db, getPath(collectionName)));
        querySnapshot.forEach(doc => {
          const d = doc.data();
          let plainD = d;
          if (collectionName === 'contacts') {
            plainD = decryptSensitiveFields(d);
            if (plainD.cpf) existingDocs.cpf[plainD.cpf] = doc.id;
            if (plainD.email) existingDocs.email[plainD.email.toLowerCase()] = doc.id;
            if (plainD.telefone) existingDocs.telefone[plainD.telefone.replace(/\D/g, '')] = doc.id;
            if (plainD.nome) existingDocs.nome[plainD.nome.toLowerCase().trim()] = doc.id;
          } else if (collectionName === 'inventory' && d.sku) {
            existingDocs.sku[d.sku] = doc.id;
          } else if (collectionName === 'sales' && d.id) {
            existingDocs.saleId[d.id] = doc.id;
          }
        });

        const partnerMap = {};
        if (collectionName === 'inventory') {
          try {
            const partnersSnap = await getDocs(collection(db, getPath('partners')));
            partnersSnap.forEach(docSnap => {
              const pData = docSnap.data();
              if (pData.name) {
                partnerMap[pData.name.toLowerCase().trim()] = docSnap.id;
              }
            });
          } catch (err) {
            console.error("Erro ao buscar parceiros para importação:", err);
          }
        }

        const batchSize = 50; // Lower batch size for safety with async tasks
        let addedCount = 0;
        let updatedCount = 0;
        let processedCount = 0;
        let invalidCpfCount = 0;
        let invalidCepCount = 0;
        let errors = [];

        const existingLegacyIds = new Set();
        if (collectionName === 'sales') {
          try {
            const legacySnapshot = await getDocs(collection(db, getPath('legacy')));
            legacySnapshot.forEach(docSnap => {
              existingLegacyIds.add(String(docSnap.id).toUpperCase());
            });
          } catch (err) {
            console.error("Erro ao buscar vendas legadas existentes:", err);
          }
        }
        for (let i = 0; i < jsonData.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = jsonData.slice(i, i + batchSize);

          await Promise.all(chunk.map(async (item, idx) => {
            try {
              let cleanItem = {};
              if (mapping) {
                Object.keys(mapping).forEach(dbField => {
                  const fileField = mapping[dbField];
                  if (fileField && item[fileField] !== undefined) {
                    let value = item[fileField];
                    if (['precoCusto', 'precoVenda', 'total', 'totalCost', 'desconto', 'precoPromocional', 'valor', 'frete'].includes(dbField)) {
                      const strVal = String(value).trim();
                      const hasSeparator = strVal.includes(',') || strVal.includes('.');
                      if (hasSeparator) {
                        let normalized = strVal.replace(/[^\d,.]/g, '');
                        if (normalized.includes(',') && normalized.includes('.')) {
                          const first = normalized.indexOf('.');
                          const last = normalized.indexOf(',');
                          if (first < last) normalized = normalized.replace(/\./g, '').replace(',', '.');
                          else normalized = normalized.replace(/,/g, '').replace(',', '.');
                        } else normalized = normalized.replace(',', '.');
                        value = Math.round(parseFloat(normalized) * 100);
                      } else {
                        value = Math.round((Number(strVal.replace(/[^\d.-]/g, '')) || 0) * 100);
                      }
                    }
                    else if (['estoque', 'estoqueMinimo', 'alertaDias'].includes(dbField)) value = Number(String(value).replace(/[^\d.-]/g, ''));
                    else if (dbField === 'images') value = typeof value === 'string' ? value.split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 4) : [value].filter(Boolean).slice(0, 4);
                    else if (dbField === 'ncm') {
                      value = String(value).replace(/\D/g, '');
                    }
                    else if (dbField === 'channels') {
                      const strVal = String(value).toLowerCase().trim();
                      const hasEcommerce = strVal.includes('ecommerce') || strVal.includes('e-commerce') || strVal.includes('virtual') || strVal.includes('site') || strVal.includes('online');
                      const hasPhysical = strVal.includes('fisico') || strVal.includes('físico') || strVal.includes('loja') || strVal.includes('balcao') || strVal.includes('balcão') || strVal.includes('physical');
                      value = {
                        ecommerce: hasEcommerce,
                        physical: hasPhysical || (!hasEcommerce && !hasPhysical)
                      };
                    }
                    else if (dbField === 'estoqueParceiros') {
                      const list = [];
                      if (typeof value === 'number') {
                        list.push({ partnerId: '', quantity: value });
                      } else if (value) {
                        const parts = String(value).split(',');
                        parts.forEach(part => {
                          const subParts = part.split(':');
                          if (subParts.length === 2) {
                            const pName = subParts[0].toLowerCase().trim();
                            const pQty = Number(subParts[1].replace(/[^\d.-]/g, '')) || 0;
                            const pId = partnerMap[pName] || '';
                            list.push({ partnerId: pId, quantity: pQty });
                          } else {
                            const pQty = Number(part.replace(/[^\d.-]/g, '')) || 0;
                            list.push({ partnerId: '', quantity: pQty });
                          }
                        });
                      }
                      value = list;
                    }
                    else if (dbField === 'entregaMesmoEndereco') {
                      const strVal = String(value).toLowerCase().trim();
                      value = ['sim', 'true', 'yes', '1', 's', 't'].includes(strVal);
                    }
                    else if (dbField === 'items') {
                      const list = [];
                      if (typeof value === 'string') {
                        const parts = value.split(';');
                        parts.forEach(part => {
                          const cleanPart = part.trim();
                          if (!cleanPart) return;
                          
                          let qty = 1;
                          let name = cleanPart;
                          let price = 0;
                          
                          const lastOpen = cleanPart.lastIndexOf('(');
                          const lastClose = cleanPart.lastIndexOf(')');
                          if (lastOpen !== -1 && lastClose > lastOpen) {
                            const inside = cleanPart.substring(lastOpen + 1, lastClose).trim();
                            const possibleName = cleanPart.substring(0, lastOpen).trim();
                            
                            // Check if the inside matches the pattern "x1 - 12" or "x1 - 149.9" or "x2 - R$ 10,00"
                            const match = inside.match(/x?(\d+)\s*[-*]\s*([\d,.]+)/i);
                            if (match) {
                              qty = parseInt(match[1], 10) || 1;
                              const priceStr = match[2];
                              price = Math.round(parseFloat(priceStr.replace(',', '.')) * 100) || 0;
                              name = possibleName;
                            }
                          }
                          
                          list.push({
                            id: '',
                            nome: name,
                            price: price,
                            quantity: qty
                          });
                        });
                      } else if (value) {
                        list.push({
                          id: '',
                          nome: String(value),
                          price: 0,
                          quantity: 1
                        });
                      }
                      value = list;
                    }
                    else if (dbField === 'dataNascimento' || dbField === 'validade' || dbField === 'data' || dbField === 'createdAt' || dbField === 'dataFinalizacao') {
                      value = safeParseDate(value, dbField);
                    }
                    cleanItem[dbField] = value;
                  }
                });
              } else {
                const { id, ...rest } = item;
                cleanItem = rest;
              }

              if (collectionName === 'inventory' && cleanItem.images && Array.isArray(cleanItem.images)) {
                const copiedImages = [];
                for (let i = 0; i < cleanItem.images.length; i++) {
                  const imgUrl = cleanItem.images[i];
                  if (imgUrl) {
                    const skuPart = cleanItem.sku ? String(cleanItem.sku).trim() : `prod_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                    const letter = String.fromCharCode(65 + i); // 0 -> A, 1 -> B, 2 -> C, etc.
                    const customPath = `inventory/${companyId}/${skuPart}/imagens${letter}`;
                    const copiedUrl = await copyImageUrlToStorage(imgUrl, storage, customPath);
                    copiedImages.push(copiedUrl);
                  }
                }
                cleanItem.images = copiedImages;
              }

              let targetId = null;
              if (collectionName === 'inventory' && cleanItem.sku) {
                targetId = existingDocs.sku[cleanItem.sku];
              } else if (collectionName === 'contacts') {
                // Validação e formatação prévia de CPF/CNPJ para evitar duplicados com formatos distintos
                if (cleanItem.cpf) {
                  const rawDoc = String(cleanItem.cpf).replace(/\D/g, '');
                  if (rawDoc.length === 11) {
                    const masked = maskCPF(rawDoc);
                    if (!validateCPF(masked)) {
                      invalidCpfCount++;
                      throw new Error(`CPF inválido: ${cleanItem.cpf}. Cliente ignorado.`);
                    }
                    cleanItem.cpf = masked;
                  } else if (rawDoc.length === 14) {
                    cleanItem.cpf = maskCNPJ(rawDoc);
                  } else if (rawDoc.length > 0) {
                    invalidCpfCount++;
                    throw new Error(`Documento CPF/CNPJ inválido (tamanho incorreto: ${rawDoc.length} dígitos): ${cleanItem.cpf}. Cliente ignorado.`);
                  }
                }

                const cpfMatch = cleanItem.cpf ? existingDocs.cpf[cleanItem.cpf] : null;
                const emailMatch = cleanItem.email ? existingDocs.email[cleanItem.email.toLowerCase()] : null;
                const phoneMatch = cleanItem.telefone ? existingDocs.telefone[cleanItem.telefone.replace(/\D/g, '')] : null;
                const nameMatch = cleanItem.nome ? existingDocs.nome[cleanItem.nome.toLowerCase().trim()] : null;

                targetId = cpfMatch || emailMatch || phoneMatch || nameMatch;

                if (collectionName === 'contacts') {

                  // Validação de CEP e Auto-preenchimento (ignora logradouro, bairro, cidadeUf da planilha para forçar busca do CEP)
                  if (cleanItem.cep) {
                    const masked = maskCEP(cleanItem.cep);
                    if (!validateCEP(masked)) {
                      cleanItem.cep = '';
                      invalidCepCount++;
                    } else {
                      cleanItem.cep = masked;
                      // Ignora campos vindos da planilha
                      cleanItem.logradouro = '';
                      cleanItem.bairro = '';
                      cleanItem.cidadeUf = '';

                      // Auto-preenche via busca do CEP
                      const addr = await buscaCepHelper(cleanItem.cep);
                      if (addr) {
                        cleanItem.logradouro = addr.logradouro || '';
                        cleanItem.bairro = addr.bairro || '';
                        cleanItem.cidadeUf = addr.cidadeUf || '';
                      }
                    }
                  }

                  // Lógica de Entrega - Caso tenha '--nao disponivel--' em qualquer campo de entrega, marca como mesmo do principal
                  const hasNaoDisponivel = [
                    cleanItem.entregaCep,
                    cleanItem.entregaLogradouro,
                    cleanItem.entregaNumero,
                    cleanItem.entregaBairro,
                    cleanItem.entregaCidadeUf,
                    cleanItem.entregaMesmoEndereco
                  ].some(val => {
                    if (typeof val === 'string') {
                      const normalized = val.toLowerCase().trim();
                      return normalized === '--nao disponivel--' || normalized === '--não disponível--';
                    }
                    return false;
                  });

                  if (hasNaoDisponivel) {
                    cleanItem.entregaMesmoEndereco = true;
                  }

                  if (cleanItem.entregaMesmoEndereco === undefined) cleanItem.entregaMesmoEndereco = true;

                  if (cleanItem.entregaMesmoEndereco) {
                    // Se for igual, limpa campos de entrega para não lixar o banco
                    cleanItem.entregaCep = '';
                    cleanItem.entregaLogradouro = '';
                    cleanItem.entregaNumero = '';
                    cleanItem.entregaBairro = '';
                    cleanItem.entregaCidadeUf = '';
                  } else if (cleanItem.entregaCep) {
                    // Se for diferente e tiver CEP de entrega, valida e auto-preenche (ignora campos de entrega da planilha)
                    const masked = maskCEP(cleanItem.entregaCep);
                    if (!validateCEP(masked)) {
                      cleanItem.entregaCep = '';
                      invalidCepCount++;
                    } else {
                      cleanItem.entregaCep = masked;
                      // Ignora campos de entrega vindos da planilha
                      cleanItem.entregaLogradouro = '';
                      cleanItem.entregaBairro = '';
                      cleanItem.entregaCidadeUf = '';

                      // Auto-preenche via busca de CEP
                      const addr = await buscaCepHelper(cleanItem.entregaCep);
                      if (addr) {
                        cleanItem.entregaLogradouro = addr.logradouro || '';
                        cleanItem.entregaBairro = addr.bairro || '';
                        cleanItem.entregaCidadeUf = addr.cidadeUf || '';
                      }
                    }
                  }

                  cleanItem = encryptSensitiveFields(cleanItem);
                }
              }
              
              if (collectionName === 'sales') {
                const createdAtStr = cleanItem.createdAt || cleanItem.dataFinalizacao || cleanItem.dataVenda || new Date().toISOString();
                const dataFinalizacaoStr = cleanItem.dataFinalizacao || cleanItem.createdAt || cleanItem.dataVenda || new Date().toISOString();

                cleanItem.createdAt = createdAtStr;
                cleanItem.dataFinalizacao = dataFinalizacaoStr;

                const dateMatch = createdAtStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                let isLegacy = false;
                if (dateMatch) {
                  const y = parseInt(dateMatch[1], 10);
                  const m = parseInt(dateMatch[2], 10);
                  isLegacy = y < 2026 || (y === 2026 && m <= 5);
                } else {
                  const saleDate = new Date(createdAtStr);
                  isLegacy = saleDate.getUTCFullYear() < 2026 || (saleDate.getUTCFullYear() === 2026 && saleDate.getUTCMonth() < 5);
                }

                const clientObj = {
                  nome: cleanItem.clienteNome || 'Consumidor',
                  cpf: '',
                  telefone: ''
                };
                let paymentList = [];
                if (cleanItem.metodoPagamento) {
                  const payParts = String(cleanItem.metodoPagamento).split(';');
                  payParts.forEach(payPart => {
                    const subPay = payPart.split(':');
                    if (subPay.length === 2) {
                      const method = subPay[0].trim();
                      const valStr = subPay[1].replace(/[^\d,.]/g, '').replace(',', '.');
                      const valCents = Math.round(parseFloat(valStr) * 100) || cleanItem.total || 0;
                      paymentList.push({ method, value: valCents });
                    } else {
                      paymentList.push({ method: payPart.trim(), value: cleanItem.total || 0 });
                    }
                  });
                }
                if (paymentList.length === 0) {
                  paymentList = [{
                    method: cleanItem.metodoPagamento || 'N/A',
                    value: cleanItem.total || 0
                  }];
                }

                const saleId = cleanItem.id || `VEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                const computedSubtotal = (cleanItem.items || []).reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                const finalSubtotal = cleanItem.valor || computedSubtotal || cleanItem.total || 0;
                const finalTotal = cleanItem.total || finalSubtotal || 0;

                if (isLegacy) {
                  const upperId = String(saleId).toUpperCase();
                  if (!existingLegacyIds.has(upperId)) {
                    const legacySaleObj = {
                      id: saleId,
                      createdAt: createdAtStr,
                      dataFinalizacao: dataFinalizacaoStr,
                      client: clientObj,
                      clientName: cleanItem.clienteNome || 'Consumidor',
                      operator: cleanItem.operator || 'Importador',
                      indicacao: cleanItem.indicacao || '',
                      items: cleanItem.items || [],
                      subtotal: finalSubtotal,
                      discount: cleanItem.desconto || 0,
                      shipping: cleanItem.frete || 0,
                      total: finalTotal,
                      totalCost: cleanItem.totalCost || 0,
                      payments: paymentList,
                      status: cleanItem.status || 'concluido',
                      observacoes: cleanItem.observacoes || '',
                      isLegacy: true,
                      importedAt: new Date().toISOString()
                    };

                    const encryptedSale = encryptLegacySale(legacySaleObj);
                    const legacyDocRef = doc(db, getPath('legacy'), saleId);
                    batch.set(legacyDocRef, encryptedSale);
                    addedCount++;
                    existingLegacyIds.add(upperId);
                  }
                  return;
                } else {
                  cleanItem.id = saleId;
                  cleanItem.client = clientObj;
                  cleanItem.payments = paymentList;
                  cleanItem.discount = cleanItem.desconto || 0;
                  cleanItem.shipping = cleanItem.frete || 0;
                  cleanItem.total = finalTotal;
                  
                  delete cleanItem.clienteNome;
                  delete cleanItem.metodoPagamento;
                  delete cleanItem.desconto;
                  delete cleanItem.frete;
                  delete cleanItem.valor;
                }
              }

              // Remove qualquer campo que tenha valor undefined, nulo, vazio, ou N/A para evitar erros e lixo no Firestore SDK
              Object.keys(cleanItem).forEach(key => {
                if (isIgnoredValue(cleanItem[key])) {
                  delete cleanItem[key];
                }
              });

              if (targetId) {
                const docRef = doc(db, getPath(collectionName), targetId);
                batch.update(docRef, { ...cleanItem, updatedAt: new Date().toISOString() });
                updatedCount++;

                if (collectionName === 'contacts') {
                  const sameAddr = cleanItem.entregaMesmoEndereco === true || String(cleanItem.entregaMesmoEndereco).toLowerCase() === 'true';
                  const fiscalAddr = {
                    cep: cleanItem.cep || '',
                    logradouro: cleanItem.logradouro || '',
                    numero: cleanItem.numero || '',
                    bairro: cleanItem.bairro || '',
                    cidadeUf: cleanItem.cidadeUf || '',
                    complemento: cleanItem.complemento || '',
                    updatedAt: new Date().toISOString()
                  };
                  const deliveryAddr = {
                    cep: (sameAddr ? cleanItem.cep : cleanItem.entregaCep) || '',
                    logradouro: (sameAddr ? cleanItem.logradouro : cleanItem.entregaLogradouro) || '',
                    numero: (sameAddr ? cleanItem.numero : cleanItem.entregaNumero) || '',
                    bairro: (sameAddr ? cleanItem.bairro : cleanItem.entregaBairro) || '',
                    cidadeUf: (sameAddr ? cleanItem.cidadeUf : cleanItem.entregaCidadeUf) || '',
                    complemento: (sameAddr ? cleanItem.complemento : cleanItem.entregaComplemento) || '',
                    updatedAt: new Date().toISOString()
                  };
                  const fiscalDocRef = doc(db, `${getPath(collectionName)}/${targetId}/enderecofiscal`, 'default');
                  const deliveryDocRef = doc(db, `${getPath(collectionName)}/${targetId}/enderecoentrega`, 'default');
                  batch.set(fiscalDocRef, fiscalAddr);
                  batch.set(deliveryDocRef, deliveryAddr);
                }
              } else {
                let newDocRef;
                if (collectionName === 'inventory') {
                  const sanitizeId = (id) => {
                    return String(id).trim().toUpperCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^A-Z0-9-]/g, '-');
                  };

                  const customId = (cleanItem.sku && String(cleanItem.sku).trim() !== '')
                    ? sanitizeId(cleanItem.sku)
                    : Math.random().toString(36).substring(2, 7).toUpperCase();

                  newDocRef = doc(collection(db, getPath('inventory')), customId);
                  cleanItem.sku = customId; // Sync SKU field with sanitized ID
                } else if (collectionName === 'sales' && cleanItem.id) {
                  newDocRef = doc(db, getPath('sales'), cleanItem.id);
                } else {
                  newDocRef = doc(collection(db, getPath(collectionName)));
                }
                
                const docData = {
                  ...cleanItem,
                  createdAt: cleanItem.createdAt || new Date().toISOString(),
                  importedAt: new Date().toISOString()
                };
                if (collectionName === 'inventory') {
                  docData.type = 'product';
                }

                batch.set(newDocRef, docData);
                addedCount++;

                if (collectionName === 'contacts') {
                  const sameAddr = cleanItem.entregaMesmoEndereco === true || String(cleanItem.entregaMesmoEndereco).toLowerCase() === 'true';
                  const fiscalAddr = {
                    cep: cleanItem.cep || '',
                    logradouro: cleanItem.logradouro || '',
                    numero: cleanItem.numero || '',
                    bairro: cleanItem.bairro || '',
                    cidadeUf: cleanItem.cidadeUf || '',
                    complemento: cleanItem.complemento || '',
                    updatedAt: new Date().toISOString()
                  };
                  const deliveryAddr = {
                    cep: (sameAddr ? cleanItem.cep : cleanItem.entregaCep) || '',
                    logradouro: (sameAddr ? cleanItem.logradouro : cleanItem.entregaLogradouro) || '',
                    numero: (sameAddr ? cleanItem.numero : cleanItem.entregaNumero) || '',
                    bairro: (sameAddr ? cleanItem.bairro : cleanItem.entregaBairro) || '',
                    cidadeUf: (sameAddr ? cleanItem.cidadeUf : cleanItem.entregaCidadeUf) || '',
                    complemento: (sameAddr ? cleanItem.complemento : cleanItem.entregaComplemento) || '',
                    updatedAt: new Date().toISOString()
                  };
                  const fiscalDocRef = doc(db, `${getPath(collectionName)}/${newDocRef.id}/enderecofiscal`, 'default');
                  const deliveryDocRef = doc(db, `${getPath(collectionName)}/${newDocRef.id}/enderecoentrega`, 'default');
                  batch.set(fiscalDocRef, fiscalAddr);
                  batch.set(deliveryDocRef, deliveryAddr);
                }
              }
            } catch (err) {
              errors.push({ row: i + idx + 1, message: err.message });
            }
          }));

          await batch.commit();
          processedCount += chunk.length;
          if (onProgress) onProgress(Math.round((processedCount / jsonData.length) * 100));
        }
        // Legacy sales are written directly into the subcollection /legacy during chunk batch processing.
        // No end-of-function writing to settings/rtdb_sales is required.

        resolve({
          added: addedCount,
          updated: updatedCount,
          errors,
          invalidCpfCount,
          invalidCepCount
        });
      } catch (error) {
        console.error("Erro na importação:", error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
