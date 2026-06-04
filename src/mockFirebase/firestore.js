// Initial base mock data
const initialData = {
  "users": {
    "demo-user-123": {
      nome: "Usuário Demonstrativo",
      email: "demo@crmmaster.com",
      funcao: "responsavel",
      empresa: "demo-company",
      allAccess: true,
      telas: ["dashboard", "contacts", "deals", "inventory", "calendar", "tasks", "partners", "coupons", "settings", "ecommerce", "documents", "llm", "automations", "service", "companies", "reports"],
      active: true,
      theme: "clean",
      density: 100
    }
  },
  "business": {
    "demo-company": {
      nome: "CRM Master Demo Corp",
      status: "ativa",
      ambiente: "homologacao",
      email: "contato@crmmaster.com",
      telefone: "(11) 99999-9999"
    }
  },
  "business/demo-company/company": {
    "subscription": {
      plano: "Premium",
      status: "Ativa"
    }
  },
  "business/demo-company/inventory": {
    "prod-1": { nome: "Camiseta Dry Fit Premium", sku: "TSHIRT-DRY-01", precoVenda: 8990, precoCusto: 3500, estoque: 5, estoqueMinimo: 10, unidade: "UN", categoria: ["Roupas", "Masculino"], ativo: true, createdAt: new Date().toISOString() },
    "prod-2": { nome: "Tênis Running Ultralight", sku: "SHOES-RUN-02", precoVenda: 34990, precoCusto: 15000, estoque: 15, estoqueMinimo: 5, unidade: "UN", categoria: ["Calçados"], ativo: true, createdAt: new Date().toISOString() },
    "prod-3": { nome: "Jaqueta Corta Vento Slim", sku: "JACKET-WIND-03", precoVenda: 22990, precoCusto: 9000, estoque: 2, estoqueMinimo: 8, unidade: "UN", categoria: ["Roupas", "Inverno"], ativo: true, createdAt: new Date().toISOString() },
    "prod-4": { nome: "Calça Jogger Moletom", sku: "PANTS-JOGGER-04", precoVenda: 14990, precoCusto: 6000, estoque: 25, estoqueMinimo: 5, unidade: "UN", categoria: ["Roupas"], ativo: true, createdAt: new Date().toISOString() },
    "prod-5": { nome: "Boné Ajustável Esportivo", sku: "CAP-SPORT-05", precoVenda: 5990, precoCusto: 2000, estoque: 40, estoqueMinimo: 10, unidade: "UN", categoria: ["Acessórios"], ativo: true, createdAt: new Date().toISOString() }
  },
  "business/demo-company/contacts": {
    "client-1": { nome: "Lucas Fernandes", email: "lucas.fer@yahoo.com.br", telefone: "(11) 98765-1234", cpf: "123.456.789-00", cep: "05422-000", rua: "Rua dos Pinheiros", numero: "450", bairro: "Pinheiros", cidade: "São Paulo", uf: "SP", active: true },
    "client-2": { nome: "Mariana Alencar", email: "mariana.alencar@gmail.com", telefone: "(21) 97654-3210", cpf: "987.654.321-11", cep: "22021-001", rua: "Av. Atlântica", numero: "1800", bairro: "Copacabana", cidade: "Rio de Janeiro", uf: "RJ", active: true },
    "client-3": { nome: "Bruno Silveira", email: "bruno.silv@outlook.com", telefone: "(31) 99876-5432", cpf: "456.789.123-22", cep: "30140-060", rua: "Rua Bahia", numero: "89", bairro: "Savassi", cidade: "Belo Horizonte", uf: "MG", active: true }
  },
  "business/demo-company/sales": {
    "sale-1": {
      id: "sale-1",
      client: { nome: "Lucas Fernandes", telefone: "(11) 98765-1234", cpf: "123.456.789-00" },
      items: [{ id: "prod-1", name: "Camiseta Dry Fit Premium", quantity: 2, price: 8990, precoCusto: 3500, subtotal: 17980 }],
      total: 17980,
      totalCost: 7000,
      paymentMethod: "pix",
      status: "concluido",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    "sale-2": {
      id: "sale-2",
      client: { nome: "Mariana Alencar", telefone: "(21) 97654-3210", cpf: "987.654.321-11" },
      items: [{ id: "prod-2", name: "Tênis Running Ultralight", quantity: 1, price: 34990, precoCusto: 15000, subtotal: 34990 }],
      total: 34990,
      totalCost: 15000,
      paymentMethod: "cartao_credito",
      status: "concluido",
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
    }
  },
  "business/demo-company/legacy": {
    "legacy-1": { id: "legacy-1", status: "concluido", total: 2450000, totalCost: 1050000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).toISOString() },
    "legacy-2": { id: "legacy-2", status: "concluido", total: 2800000, totalCost: 1200000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 15).toISOString() },
    "legacy-3": { id: "legacy-3", status: "concluido", total: 2200000, totalCost: 950000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 15).toISOString() },
    "legacy-4": { id: "legacy-4", status: "concluido", total: 3150000, totalCost: 1300000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 4, 15).toISOString() },
    "legacy-5": { id: "legacy-5", status: "concluido", total: 1980000, totalCost: 800000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 15).toISOString() },
    "legacy-6": { id: "legacy-6", status: "concluido", total: 2640000, totalCost: 1120000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 15).toISOString() },
    "legacy-7": { id: "legacy-7", status: "concluido", total: 3300000, totalCost: 1450000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 7, 15).toISOString() },
    "legacy-8": { id: "legacy-8", status: "concluido", total: 2950000, totalCost: 1280000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 8, 15).toISOString() },
    "legacy-9": { id: "legacy-9", status: "concluido", total: 2100000, totalCost: 900000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 9, 15).toISOString() },
    "legacy-10": { id: "legacy-10", status: "concluido", total: 2720000, totalCost: 1180000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 10, 15).toISOString() },
    "legacy-11": { id: "legacy-11", status: "concluido", total: 2500000, totalCost: 1000000, createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 15).toISOString() }
  },
  "business/demo-company/tasks": {
    "task-1": { name: "Enviar proposta para Lucas", description: "Follow up da venda pendente", deadline: new Date(Date.now() + 86400000).toISOString().split("T")[0], priority: "high", status: "pending", createdAt: new Date().toISOString() },
    "task-2": { name: "Reposição de estoque", description: "Fazer pedido de Camisetas Dry Fit", deadline: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0], priority: "medium", status: "pending", createdAt: new Date().toISOString() }
  },
  "business/demo-company/calendar": {
    "cal-1": { title: "Reunião de Alinhamento", start: new Date(Date.now() + 3600000 * 4).toISOString(), end: new Date(Date.now() + 3600000 * 5).toISOString(), description: "Reunião comercial", allDay: false }
  },
  "business/demo-company/coupons": {
    "coupon-1": { codigo: "BEMVINDO10", valor: 10, discount: "10%", tipo: "porcentagem", ativo: true, limiteUsos: 100, usos: 12, dataInicio: new Date().toISOString().split("T")[0], dataFim: null }
  },
  "business/demo-company/partners": {
    "partner-1": { name: "Influenciador Tech", email: "influencer@tech.com", telefone: "(11) 91111-2222", active: true }
  },
  "business/demo-company/chats": {
    "chat-1": { name: "Lucas Fernandes", phoneNumber: "5511987651234", channel: "whatsapp", status: "open", lastTime: new Date().toISOString(), lastMsg: "Olá, gostaria de saber se meu pedido foi despachado.", unread: 1, createdAt: new Date().toISOString() }
  },
  "business/demo-company/chats/chat-1/messages": {
    "msg-1": { text: "Olá! Como posso ajudar você hoje?", sender: "agent", time: new Date(Date.now() - 600000).toISOString() },
    "msg-2": { text: "Olá, gostaria de saber se meu pedido foi despachado.", sender: "client", time: new Date().toISOString() }
  },
  "business/demo-company/expenses": {
    "exp-1": { descricao: "Servidor Cloud AWS", valor: 450.00, categoria: "infraestrutura", status: "pago", vencimento: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString() },
    "exp-2": { descricao: "Licença Softwares", valor: 120.00, categoria: "operacional", status: "pendente", vencimento: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0], createdAt: new Date().toISOString() }
  },
  "business/demo-company/settings": {
    "ai_rules": {
      ignoreZeroStock30Days: true,
      zeroStockDaysThreshold: 30,
      minProfitMarginEnabled: true,
      minProfitMargin: 15,
      expiringSoonPriorityEnabled: true,
      expiringDaysThreshold: 30,
      velocityPriorityEnabled: true
    },
    "automations": {
      list: [
        { id: "1", name: "Alerta de Estoque Baixo", trigger: "estoque_baixo", conditionField: "estoque", conditionOperator: "<", conditionValue: "5", action: "notificar_admin", status: "active", color: "#ef4444" }
      ]
    },
    "pos_vendas": {
      enabled: true,
      scheduleType: "weekday",
      weekdays: [1, 2, 3, 4, 5],
      daysInterval: 7,
      firstPurchaseTemplate: "Olá {nome}! Obrigado por realizar sua primeira compra no CRM Master. Seu pedido no valor de R$ {total} foi concluído.",
      returningTemplate: "Olá {nome}! Que bom ver você de volta! Seu novo pedido no valor de R$ {total} foi concluído."
    }
  },
  "tutorials": {
    "tut-1": {
      titulo: "Como Mudar o Tema Visual e Visualização",
      tipo: "texto",
      url: "",
      conteudo: "Mudar o tema visual e a densidade de visualização do CRM Master é simples e melhora muito a sua produtividade.\n\nPasso a Passo para alterar o tema:\n1. No menu lateral esquerdo, clique no seu perfil de usuário (onde aparece seu nome e foto/avatar no rodapé).\n2. Um modal de Perfil e Personalização se abrirá na tela.\n3. Na seção \"Personalização do Tema\", selecione um dos 8 temas disponíveis:\n   • Clean (Tema Claro Clássico)\n   • Clear (Azul Suave)\n   • Beige (Tons Pastéis Confortáveis)\n   • HC L. (Alto Contraste Claro)\n   • Dark (Tema Escuro Clássico)\n   • Dim (Azul Escuro / Modo Noturno Intermediário)\n   • Midnight (Preto Profundo Elegante)\n   • HC D. (Alto Contraste Escuro)\n4. O tema será aplicado instantaneamente em toda a plataforma.\n\nPasso a Passo para alterar o Modo de Visualização (Grade vs Lista):\n1. No mesmo modal de perfil, localize a seção \"Modo de Visualização Geral\" ou \"Modo na Tela Atual\".\n2. Selecione a opção \"Grade\" ou \"Lista\".\n3. Isso modificará as visualizações de cadastros, vendas e tabelas de acordo com a sua preferência.",
      createdAt: new Date().toISOString(),
      createdBy: "Sistema"
    },
    "tut-2": {
      titulo: "Como Visualizar e Imprimir Comprovantes / Cupons",
      tipo: "texto",
      url: "",
      conteudo: "Você pode visualizar, baixar e imprimir comprovantes não-fiscais ou cupons de todas as vendas registradas no sistema.\n\nComo visualizar um comprovante:\n1. Vá até a tela \"Vendas\" (Deals) no menu lateral.\n2. Na aba \"Histórico\", você verá a lista de vendas concluídas ou pendentes.\n3. Localize a venda desejada e clique no ícone de \"Visualizar\" (ou clique na linha da venda).\n4. O modal de Detalhes da Venda será exibido.\n5. No rodapé ou no topo do modal de detalhes, clique em \"Imprimir\" ou altere a visualização para \"Recibo\".\n6. O comprovante detalhado com os produtos, quantidades, forma de pagamento e total será gerado.\n\nComo baixar e compartilhar o comprovante:\n• PNG ou PDF: Clique em \"Baixar PNG\" ou \"Baixar PDF\" para obter uma imagem de alta resolução ou arquivo do comprovante pronto para impressão física.\n• Enviar ao Cliente: Clique em \"Compartilhar\" para abrir links rápidos de envio direto por WhatsApp ou E-mail com o texto padrão pré-formatado contendo os detalhes do pedido e a imagem do comprovante.",
      createdAt: new Date().toISOString(),
      createdBy: "Sistema"
    },
    "tut-3": {
      titulo: "Como Registrar Vendas e Emitir Nota Fiscal (NFC-e)",
      tipo: "texto",
      url: "",
      conteudo: "O CRM Master permite que você realize vendas rápidas via PDV e emita a Nota Fiscal de Consumidor Eletrônica (NFC-e) automaticamente de forma integrada.\n\nPasso a Passo para criar uma venda e emitir a nota:\n1. Acesse o módulo de \"Vendas\" (Deals) no menu lateral.\n2. Clique na aba \"Iniciar PDV\" ou \"Nova Venda\".\n3. Na interface de PDV:\n   • Selecione os produtos clicando sobre eles na lista à esquerda ou digitando no campo de busca.\n   • Ajuste a quantidade dos itens no carrinho à direita.\n   • Opcional: Clique em \"Selecionar Cliente\" e digite o CPF do cliente para que saia na Nota Fiscal.\n4. Clique no botão verde \"Ir para Pagamento\".\n5. Selecione a forma de pagamento (Dinheiro, PIX, Cartão de Crédito/Débito) e o valor pago.\n6. Certifique-se de que a opção \"Emitir Nota Fiscal (NFC-e)\" está ativada.\n7. Clique em \"Finalizar Venda\".\n8. O sistema irá processar a venda e fará a comunicação automática com a SEFAZ através da API FocusNFE, gerando o protocolo da nota e o link da DANFE.\n9. O cupom fiscal formatado será exibido na tela para impressão.",
      createdAt: new Date().toISOString(),
      createdBy: "Sistema"
    }
  }
};

// Global in-memory database that resets on page refresh
let localDatabase = JSON.parse(JSON.stringify(initialData));

// Reactive listeners
const subscribers = [];

const notify = (collectionPath, docPath = null) => {
  subscribers.forEach(sub => {
    if (sub.type === 'collection' && sub.path === collectionPath) {
      const docs = getDocumentsForPath(sub.path, sub.constraints);
      sub.callback(makeQuerySnapshot(docs));
    }
    if (sub.type === 'doc' && sub.path === docPath) {
      const parts = docPath.split('/');
      const docId = parts.pop();
      const colPath = parts.join('/');
      const docData = (localDatabase[colPath] && localDatabase[colPath][docId]) || null;
      sub.callback(makeDocumentSnapshot(docId, docData));
    }
  });
};

const getDocumentsForPath = (path, constraints = []) => {
  const docsMap = localDatabase[path] || {};
  let docsList = Object.entries(docsMap).map(([id, data]) => ({ id, ...data }));

  // Apply constraints
  constraints.forEach(c => {
    if (c.type === 'where') {
      const { field, operator, value } = c;
      docsList = docsList.filter(doc => {
        const val = doc[field];
        if (operator === '==') return val === value;
        if (operator === '!=') return val !== value;
        if (operator === '>') return val > value;
        if (operator === '>=') return val >= value;
        if (operator === '<') return val < value;
        if (operator === '<=') return val <= value;
        if (operator === 'array-contains') return Array.isArray(val) && val.includes(value);
        return true;
      });
    }
  });

  // Apply orderBy
  const orderConstraint = constraints.find(c => c.type === 'orderBy');
  if (orderConstraint) {
    const { field, direction } = orderConstraint;
    docsList.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (typeof valA === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return direction === 'asc' ? (valA - valB) : (valB - valA);
    });
  }

  // Apply limit
  const limitConstraint = constraints.find(c => c.type === 'limit');
  if (limitConstraint) {
    docsList = docsList.slice(0, limitConstraint.limit);
  }

  return docsList;
};

const makeDocumentSnapshot = (id, data) => {
  return {
    id,
    exists: () => data !== null && data !== undefined,
    data: () => data,
    get: (field) => data ? data[field] : undefined
  };
};

const makeQuerySnapshot = (docsList) => {
  const docs = docsList.map(doc => makeDocumentSnapshot(doc.id, doc));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb)
  };
};

// Resolver helper for serverTimestamp and increment
const resolveFields = (currentDoc, newFields) => {
  if (typeof newFields !== 'object' || newFields === null) return newFields;
  const resolved = { ...newFields };
  for (const [key, val] of Object.entries(newFields)) {
    if (val && typeof val === 'object') {
      if (val._type === 'increment') {
        const currentVal = Number(currentDoc?.[key] || 0);
        resolved[key] = currentVal + val.value;
      } else if (val._type === 'serverTimestamp') {
        resolved[key] = new Date().toISOString();
      } else {
        resolved[key] = resolveFields(currentDoc?.[key], val);
      }
    }
  }
  return resolved;
};

// Firestore Core APIs
export const initializeFirestore = (app, config) => {
  return {};
};

export const getFirestore = (app) => {
  return {};
};

export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

export const collection = (first, second) => {
  let path = "";
  if (typeof first === "object" && first !== null && first.type === "doc") {
    path = `${first.path}/${second}`;
  } else {
    path = second;
  }
  return { type: 'collection', path };
};

export const doc = (first, second, third) => {
  let path = "";
  if (typeof first === "object" && first !== null && !first.type) {
    if (third !== undefined) {
      const colPath = typeof second === "string" ? second : second.path;
      path = `${colPath}/${third}`;
    } else {
      path = second;
    }
  } else {
    const colPath = first.path;
    path = `${colPath}/${second}`;
  }
  const parts = path.split('/');
  const id = parts.pop();
  const collectionPath = parts.join('/');
  return { type: 'doc', path, collectionPath, id };
};

export const query = (collectionRef, ...constraints) => {
  return {
    type: 'query',
    collectionPath: collectionRef.path,
    path: collectionRef.path,
    constraints: constraints.filter(c => c !== undefined && c !== null)
  };
};

export const where = (field, operator, value) => {
  return { type: 'where', field, operator, value };
};

export const orderBy = (field, direction) => {
  return { type: 'orderBy', field, direction };
};

export const limit = (n) => {
  return { type: 'limit', limit: n };
};

export const getDoc = async (docRef) => {
  const parts = docRef.path.split('/');
  const docId = parts.pop();
  const colPath = parts.join('/');
  const docData = (localDatabase[colPath] && localDatabase[colPath][docId]) || null;
  return makeDocumentSnapshot(docId, docData);
};

export const getDocs = async (ref) => {
  const colPath = ref.type === 'query' ? ref.collectionPath : ref.path;
  const docs = getDocumentsForPath(colPath, ref.constraints);
  return makeQuerySnapshot(docs);
};

export const addDoc = async (collectionRef, data) => {
  const colPath = collectionRef.path;
  const id = `doc-${Math.random().toString(36).substr(2, 9)}`;
  if (!localDatabase[colPath]) {
    localDatabase[colPath] = {};
  }
  const resolved = resolveFields(null, data);
  localDatabase[colPath][id] = resolved;
  console.log("Mock Firestore: addDoc", colPath, id, resolved);
  notify(colPath, `${colPath}/${id}`);
  return { id, path: `${colPath}/${id}` };
};

export const setDoc = async (docRef, data, options) => {
  const { path, collectionPath, id } = docRef;
  if (!localDatabase[collectionPath]) {
    localDatabase[collectionPath] = {};
  }
  const currentDoc = localDatabase[collectionPath][id];
  const resolved = resolveFields(currentDoc, data);
  if (options && options.merge) {
    localDatabase[collectionPath][id] = {
      ...(currentDoc || {}),
      ...resolved
    };
  } else {
    localDatabase[collectionPath][id] = resolved;
  }
  console.log("Mock Firestore: setDoc", path, resolved);
  notify(collectionPath, path);
};

export const updateDoc = async (docRef, data) => {
  const { path, collectionPath, id } = docRef;
  if (!localDatabase[collectionPath]) {
    localDatabase[collectionPath] = {};
  }
  const currentDoc = localDatabase[collectionPath][id] || {};
  const resolved = resolveFields(currentDoc, data);
  localDatabase[collectionPath][id] = {
    ...currentDoc,
    ...resolved
  };
  console.log("Mock Firestore: updateDoc", path, resolved);
  notify(collectionPath, path);
};

export const deleteDoc = async (docRef) => {
  const { path, collectionPath, id } = docRef;
  if (localDatabase[collectionPath] && localDatabase[collectionPath][id]) {
    delete localDatabase[collectionPath][id];
  }
  console.log("Mock Firestore: deleteDoc", path);
  notify(collectionPath, path);
};

export const increment = (n) => ({ _type: 'increment', value: n });
export const serverTimestamp = () => ({ _type: 'serverTimestamp' });

export const writeBatch = (db) => {
  const operations = [];
  return {
    set: (docRef, data, options) => {
      operations.push({ op: 'set', docRef, data, options });
    },
    update: (docRef, data) => {
      operations.push({ op: 'update', docRef, data });
    },
    delete: (docRef) => {
      operations.push({ op: 'delete', docRef });
    },
    commit: async () => {
      for (const op of operations) {
        if (op.op === 'set') {
          await setDoc(op.docRef, op.data, op.options);
        } else if (op.op === 'update') {
          await updateDoc(op.docRef, op.data);
        } else if (op.op === 'delete') {
          await deleteDoc(op.docRef);
        }
      }
    }
  };
};

export const onSnapshot = (ref, onNext, onError) => {
  const sub = {
    type: ref.type,
    path: ref.path,
    constraints: ref.constraints || [],
    callback: onNext
  };
  subscribers.push(sub);

  // Emit initial state
  setTimeout(() => {
    if (ref.type === 'doc') {
      const parts = ref.path.split('/');
      const docId = parts.pop();
      const colPath = parts.join('/');
      const docData = (localDatabase[colPath] && localDatabase[colPath][docId]) || null;
      onNext(makeDocumentSnapshot(docId, docData));
    } else {
      const colPath = ref.type === 'query' ? ref.collectionPath : ref.path;
      const docs = getDocumentsForPath(colPath, ref.constraints);
      onNext(makeQuerySnapshot(docs));
    }
  }, 0);

  return () => {
    const idx = subscribers.indexOf(sub);
    if (idx !== -1) subscribers.splice(idx, 1);
  };
};
