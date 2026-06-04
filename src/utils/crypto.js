import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'crm-ultra-secret-key-2026';

/**
 * Encrypts a string using AES
 */
export const encryptData = (data) => {
  if (!data) return "";
  try {
    return CryptoJS.AES.encrypt(String(data), SECRET_KEY).toString();
  } catch (e) {
    console.error("Encryption error:", e);
    return data;
  }
};

/**
 * Decrypts a string using AES
 */
export const decryptData = (ciphertext) => {
  if (!ciphertext) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext; // Return ciphertext if decryption fails (e.g. not encrypted)
  } catch (e) {
    // If it's not encrypted data, AES.decrypt might throw or return empty
    return ciphertext;
  }
};

/**
 * Encrypts sensitive fields in an object
 */
export const encryptSensitiveFields = (obj, fields = [
  'cpf', 'telefone', 'email', 'genero', 'dataNascimento', 'indicacao', 'fonte', 'status',
  'cep', 'logradouro', 'numero', 'bairro', 'cidadeUf', 'complemento',
  'entregaCep', 'entregaLogradouro', 'entregaNumero', 'entregaBairro', 'entregaCidadeUf', 'entregaComplemento'
]) => {
  const newObj = { ...obj };
  fields.forEach(field => {
    if (newObj[field]) {
      newObj[field] = encryptData(newObj[field]);
    }
  });
  return newObj;
};

/**
 * Decrypts sensitive fields in an object
 */
export const decryptSensitiveFields = (obj, fields = [
  'cpf', 'telefone', 'email', 'genero', 'dataNascimento', 'indicacao', 'fonte', 'status',
  'cep', 'logradouro', 'numero', 'bairro', 'cidadeUf', 'complemento',
  'entregaCep', 'entregaLogradouro', 'entregaNumero', 'entregaBairro', 'entregaCidadeUf', 'entregaComplemento'
]) => {
  const newObj = { ...obj };
  fields.forEach(field => {
    if (newObj[field]) {
      newObj[field] = decryptData(newObj[field]);
    }
  });
  return newObj;
};

/**
 * Encrypts sensitive fields in a legacy sale object
 */
export const encryptLegacySale = (sale) => {
  if (!sale) return sale;
  const newSale = { ...sale };
  if (newSale.cliente) newSale.cliente = encryptData(newSale.cliente);
  if (newSale.clientName) newSale.clientName = encryptData(newSale.clientName);
  if (newSale.operator) newSale.operator = encryptData(newSale.operator);
  if (newSale.indicacao) newSale.indicacao = encryptData(newSale.indicacao);
  if (newSale.observacoes) newSale.observacoes = encryptData(newSale.observacoes);
  
  if (newSale.client) {
    newSale.client = {
      ...newSale.client,
      nome: encryptData(newSale.client.nome),
      cpf: encryptData(newSale.client.cpf),
      telefone: encryptData(newSale.client.telefone)
    };
  }
  return newSale;
};

/**
 * Decrypts sensitive fields in a legacy sale object
 */
export const decryptLegacySale = (sale) => {
  if (!sale) return sale;
  const newSale = { ...sale };
  if (newSale.cliente) newSale.cliente = decryptData(newSale.cliente);
  if (newSale.clientName) newSale.clientName = decryptData(newSale.clientName);
  if (newSale.operator) newSale.operator = decryptData(newSale.operator);
  if (newSale.indicacao) newSale.indicacao = decryptData(newSale.indicacao);
  if (newSale.partnerName) newSale.partnerName = decryptData(newSale.partnerName);
  if (newSale.observacoes) newSale.observacoes = decryptData(newSale.observacoes);
  
  if (newSale.client) {
    newSale.client = {
      ...newSale.client,
      nome: decryptData(newSale.client.nome),
      cpf: decryptData(newSale.client.cpf),
      telefone: decryptData(newSale.client.telefone)
    };
  }
  return newSale;
};

/**
 * Decrypts sensitive fields in an active sale object
 */
export const decryptActiveSale = (sale) => {
  if (!sale) return sale;
  const newSale = { ...sale };
  if (newSale.operator) newSale.operator = decryptData(newSale.operator);
  if (newSale.observacao) newSale.observacao = decryptData(newSale.observacao);
  if (newSale.partnerName) newSale.partnerName = decryptData(newSale.partnerName);
  if (newSale.indicacao) newSale.indicacao = decryptData(newSale.indicacao);
  
  if (newSale.client) {
    newSale.client = { ...newSale.client };
    if (newSale.client.nome) newSale.client.nome = decryptData(newSale.client.nome);
    if (newSale.client.cpf) newSale.client.cpf = decryptData(newSale.client.cpf);
    if (newSale.client.telefone) newSale.client.telefone = decryptData(newSale.client.telefone);
  }
  return newSale;
};

