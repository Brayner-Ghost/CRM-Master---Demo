/**
 * Utility functions for masking and formatting input strings.
 */

export const maskPhone = (value) => {
  if (!value) return "";
  let v = String(value).replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  
  if (v.length > 10) {
    return `(${v.substring(0, 2)}) ${v.substring(2, 3)} ${v.substring(3, 7)}-${v.substring(7, 11)}`;
  } else if (v.length > 6) {
    return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6, 10)}`;
  } else if (v.length > 2) {
    return `(${v.substring(0, 2)}) ${v.substring(2, 6)}`;
  } else if (v.length > 0) {
    return `(${v.substring(0, 2)}`;
  }
  return v;
};

export const maskCEP = (value) => {
  if (!value) return "";
  let v = String(value).replace(/\D/g, "");
  if (v.length > 8) v = v.substring(0, 8);
  if (v.length > 5) {
    return `${v.substring(0, 5)}-${v.substring(5, 8)}`;
  }
  return v;
};

export const maskCPF = (value) => {
  if (!value) return "";
  let v = String(value).replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  
  if (v.length > 9) {
    return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9, 11)}`;
  } else if (v.length > 6) {
    return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}`;
  } else if (v.length > 3) {
    return `${v.substring(0, 3)}.${v.substring(3, 6)}`;
  }
  return v;
};

export const validateCPF = (cpf) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf === '' || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let add = 0;
  for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
  let rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9))) return false;
  add = 0;
  for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
  rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(10))) return false;
  return true;
};

export const validateCEP = (cep) => {
  if (!cep) return false;
  const v = String(cep).replace(/\D/g, "");
  return v.length === 8;
};

export const maskCurrency = (value) => {
  if (!value && value !== 0) return "";
  let v = String(value).replace(/\D/g, "");
  let number = parseFloat(v) / 100;
  if (isNaN(number)) return "";
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Returns only numbers and comma, e.g. "1.250,00"
export const maskMoneyOnly = (value) => {
  if (!value && value !== 0) return "";
  let v = String(value).replace(/\D/g, "");
  let number = parseFloat(v) / 100;
  if (isNaN(number)) return "";
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const maskPercentOnly = (value) => {
  if (!value && value !== 0) return "";
  let v = String(value).replace(/\D/g, "");
  let number = parseFloat(v) / 100;
  if (isNaN(number)) return "";
  if (number > 100) number = 100;
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const maskCNPJ = (value) => {
  if (!value) return "";
  let v = String(value).replace(/\D/g, "");
  if (v.length > 14) v = v.substring(0, 14);
  if (v.length > 12) {
    return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}-${v.substring(12, 14)}`;
  } else if (v.length > 8) {
    return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}`;
  } else if (v.length > 5) {
    return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}`;
  } else if (v.length > 2) {
    return `${v.substring(0, 2)}.${v.substring(2, 5)}`;
  }
  return v;
};

export const maskNCM = (value) => {
  if (!value) return "";
  let v = String(value).replace(/\D/g, "");
  if (v.length > 8) v = v.substring(0, 8);
  if (v.length > 6) {
    return `${v.substring(0, 4)}.${v.substring(4, 6)}.${v.substring(6, 8)}`;
  } else if (v.length > 4) {
    return `${v.substring(0, 4)}.${v.substring(4, 6)}`;
  }
  return v;
};

export const maskSKU = (value) => {
  if (!value) return "";
  return String(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").substring(0, 15);
};

/**
 * Obfuscation functions for privacy
 */

export const obfuscateCPF = (cpf) => {
  if (!cpf) return "";
  const v = cpf.replace(/\D/g, "");
  if (v.length < 11) return cpf;
  // Format: ***.456.***-10
  return `***.${v.substring(3, 6)}.***-${v.substring(9, 11)}`;
};

export const obfuscateEmail = (email) => {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const show = user.substring(0, 3);
  return `${show}***@${domain}`;
};

export const obfuscatePhone = (phone) => {
  if (!phone) return "";
  const v = phone.replace(/\D/g, "");
  if (v.length < 10) return phone;
  // Format: (11) 9 ****-1234
  const ddd = v.substring(0, 2);
  const prefix = v.length === 11 ? v.substring(2, 3) + ' ' : "";
  const last4 = v.substring(v.length - 4);
  return `(${ddd}) ${prefix}****-${last4}`;
};

export const obfuscateCEP = (cep) => {
  if (!cep) return "";
  const v = cep.replace(/\D/g, "");
  if (v.length < 8) return cep;
  // Format: 12***-***
  return `${v.substring(0, 2)}***-***`;
};

export const obfuscateText = (text) => {
  if (!text) return "";
  const clean = text.trim();
  if (clean.length <= 2) return "**";
  return `${clean.substring(0, 2)}***`;
};
