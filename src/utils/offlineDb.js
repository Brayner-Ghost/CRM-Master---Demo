const DB_NAME = 'crm_offline_db';
const DB_VERSION = 1;

/**
 * Abre a conexão com o banco de dados IndexedDB
 */
export const openDb = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Catálogo de produtos cacheado para pesquisa offline
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      // Fila de vendas pendentes realizadas offline
      if (!db.objectStoreNames.contains('offline_sales')) {
        db.createObjectStore('offline_sales', { keyPath: 'id' });
      }

      // Informações da empresa e integrações
      if (!db.objectStoreNames.contains('company_settings')) {
        db.createObjectStore('company_settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
};

/**
 * Operações com a store de PRODUTOS
 */
export const productsStore = {
  // Salva ou atualiza a lista completa de produtos
  saveAll: async (products) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('products', 'readwrite');
      const store = transaction.objectStore('products');

      // Limpa os antigos primeiro
      store.clear();

      products.forEach((prod) => {
        if (prod.id) {
          store.put(prod);
        }
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Retorna todos os produtos
  getAll: async () => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('products', 'readonly');
      const store = transaction.objectStore('products');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  // Atualiza estoque de um único produto localmente
  updateStock: async (productId, quantityDeducted) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('products', 'readwrite');
      const store = transaction.objectStore('products');
      const getReq = store.get(productId);

      getReq.onsuccess = () => {
        const prod = getReq.result;
        if (prod) {
          prod.estoque = (prod.estoque || 0) - quantityDeducted;
          const putReq = store.put(prod);
          putReq.onsuccess = () => resolve(prod);
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }
};

/**
 * Operações com a store de VENDAS OFFLINE (offline_sales)
 */
export const offlineSalesStore = {
  // Salva uma nova venda na fila offline
  save: async (sale) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_sales', 'readwrite');
      const store = transaction.objectStore('offline_sales');
      const request = store.put(sale);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Retorna todas as vendas na fila offline
  getAll: async () => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_sales', 'readonly');
      const store = transaction.objectStore('offline_sales');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  // Deleta uma venda da fila após ser sincronizada
  delete: async (saleId) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_sales', 'readwrite');
      const store = transaction.objectStore('offline_sales');
      const request = store.delete(saleId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
};

/**
 * Operações com a store de SETTINGS da Empresa
 */
export const companySettingsStore = {
  // Salva dados da empresa e integrações
  save: async (key, data) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('company_settings', 'readwrite');
      const store = transaction.objectStore('company_settings');
      const request = store.put({ key, value: data });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Recupera dados
  get: async (key) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('company_settings', 'readonly');
      const store = transaction.objectStore('company_settings');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }
};
