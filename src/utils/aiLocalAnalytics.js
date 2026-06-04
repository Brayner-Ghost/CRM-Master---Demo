import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { decryptLegacySale } from './crypto';

export const runLocalCRMAnalytics = async (tenantId) => {
  const getPath = (col) => tenantId ? `business/${tenantId}/${col}` : col;
  
  try {
    // 1. Fetch products
    const productsSnap = await getDocs(collection(db, getPath('inventory')));
    const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.type !== 'promotion');

    // 2. Fetch sales
    const salesSnap = await getDocs(collection(db, getPath('sales')));
    const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Fetch legacy sales
    let legacySales = [];
    try {
      const legacySnap = await getDocs(collection(db, getPath('legacy')));
      legacySales = legacySnap.docs.map(docSnap => {
        const raw = { id: docSnap.id, ...docSnap.data() };
        return decryptLegacySale(raw);
      });
    } catch (e) {
      console.error("Error fetching legacy sales for AI analytics:", e);
    }

    // Combine all sales
    const allSales = [...sales, ...legacySales];

    // --- CALCULATIONS ---

    // A. Stock alert items (low stock or expiring soon)
    const lowStockItems = [];
    const expiringSoonItems = [];
    const today = new Date();
    
    products.forEach(p => {
      const stock = Number(p.estoque || 0);
      const minStock = Number(p.estoqueMinimo || 0);
      if (stock <= minStock) {
        lowStockItems.push({ sku: p.sku || p.id, nome: p.nome, estoque: stock, minimo: minStock });
      }
      
      if (p.validade) {
        const valDate = new Date(p.validade);
        const diffTime = valDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const alertDays = Number(p.alertaDias || 30);
        if (diffDays > 0 && diffDays <= alertDays) {
          expiringSoonItems.push({ sku: p.sku || p.id, nome: p.nome, validade: p.validade, diasRestantes: diffDays, estoque: stock });
        }
      }
    });

    // B. Sales Velocity & Best Sellers
    const productSalesCount = {};
    const productRevenue = {};
    
    allSales.forEach(sale => {
      if (sale.status === 'cancelada') return;
      const items = sale.items || [];
      items.forEach(item => {
        const key = item.sku || item.id || item.nome;
        productSalesCount[key] = (productSalesCount[key] || 0) + (Number(item.quantity) || 1);
        productRevenue[key] = (productRevenue[key] || 0) + ((Number(item.price) || 0) * (Number(item.quantity) || 1));
      });
    });

    // Match back to products to get proper names and details
    const salesPerformance = Object.keys(productSalesCount).map(key => {
      const prod = products.find(p => p.sku === key || p.id === key || p.nome === key);
      return {
        sku: prod?.sku || key,
        nome: prod?.nome || key,
        precoVenda: prod?.precoVenda || 0,
        precoCusto: prod?.precoCusto || 0,
        quantidadeVendida: productSalesCount[key],
        receitaDecimal: productRevenue[key] / 100,
        estoque: prod?.estoque || 0
      };
    }).sort((a, b) => b.quantidadeVendida - a.quantidadeVendida);

    // C. Determine Top Selling Items
    const topSellers = salesPerformance.slice(0, 5);

    // D. Velocity products needing immediate attention (selling fast but low stock)
    const velocityAlerts = salesPerformance
      .filter(sp => sp.estoque <= 5 && sp.quantidadeVendida > 2)
      .slice(0, 5);

    return {
      products,
      totalProducts: products.length,
      totalSales: allSales.length,
      lowStockCount: lowStockItems.length,
      expiringCount: expiringSoonItems.length,
      lowStockItems,
      expiringSoonItems,
      topSellers,
      velocityAlerts,
      salesPerformance
    };
  } catch (err) {
    console.error("Error running local CRM analytics:", err);
    return null;
  }
};

export const buildAnalyticsAIContext = async (tenantId, queryText) => {
  const analytics = await runLocalCRMAnalytics(tenantId);
  if (!analytics) return "";

  let context = `\n\n=== CONTEXTO ANALÍTICO DO CRM (Pre-computado localmente) ===\n`;
  context += `- Total de Produtos no Estoque: ${analytics.totalProducts}\n`;
  context += `- Total de Vendas Registradas: ${analytics.totalSales}\n`;
  
  // 1. Add alert metrics
  context += `- Itens com estoque baixo: ${analytics.lowStockCount}\n`;
  if (analytics.lowStockItems.length > 0) {
    context += `  Detalhe dos itens com baixo estoque:\n`;
    analytics.lowStockItems.slice(0, 10).forEach(item => {
      context += `  * SKU: ${item.sku} - ${item.nome} (Estoque: ${item.estoque}, Mínimo configurado: ${item.minimo})\n`;
    });
  }

  context += `- Itens próximos do vencimento: ${analytics.expiringCount}\n`;
  if (analytics.expiringSoonItems.length > 0) {
    context += `  Detalhe dos itens vencendo próximo:\n`;
    analytics.expiringSoonItems.slice(0, 10).forEach(item => {
      context += `  * SKU: ${item.sku} - ${item.nome} (Estoque: ${item.estoque}, Vence em: ${item.validade}, Dias restantes: ${item.diasRestantes})\n`;
    });
  }

  // 2. Add top sellers
  context += `- Produtos mais vendidos (Top 5):\n`;
  analytics.topSellers.forEach((item, idx) => {
    context += `  ${idx + 1}. SKU: ${item.sku} - ${item.nome} (Vendido: ${item.quantidadeVendida} un, Receita: R$ ${item.receitaDecimal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
  });

  // 3. Add products selling fast but low stock (high velocity alerts)
  context += `- Itens vendendo rápido e com estoque crítico (Alta Velocidade e Baixo Estoque): ${analytics.velocityAlerts.length}\n`;
  if (analytics.velocityAlerts.length > 0) {
    context += `  Detalhe dos itens com alta velocidade e baixo estoque (Atenção imediata):\n`;
    analytics.velocityAlerts.forEach(item => {
      context += `  * SKU: ${item.sku} - ${item.nome} (Estoque atual: ${item.estoque}, Vendido recentemente: ${item.quantidadeVendida} un)\n`;
    });
  }

  // 4. Search for product specific queries (Smart keyword-based matching)
  const cleanQuery = String(queryText).toLowerCase();
  
  // Extract significant words to search for matches
  const stopwords = ['preciso', 'vender', 'mais', 'produto', 'sobre', 'estoque', 'venda', 'promoção', 'preco', 'preço', 'como', 'atenção', 'atencao', 'comprando', 'clientes', 'quais', 'atenção', 'atençao', 'precisa', 'do', 'da', 'de', 'para', 'o', 'a', 'um', 'uma'];
  const keywords = cleanQuery
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g," ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w));

  const matchedProducts = analytics.products.filter(p => {
    const sku = (p.sku || '').toLowerCase();
    const nome = (p.nome || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    
    // Check if query contains the full SKU, name or ID
    if (sku && cleanQuery.includes(sku)) return true;
    if (nome && cleanQuery.includes(nome)) return true;
    if (id && cleanQuery.includes(id)) return true;
    
    // Or check if any significant keywords overlap
    if (keywords.length > 0) {
      return keywords.some(kw => nome.includes(kw) || sku.includes(kw));
    }
    return false;
  }).slice(0, 5); // Limit to 5 matches to avoid context bloat

  if (matchedProducts.length > 0) {
    context += `\n- PRODUTO(S) ESPECÍFICO(S) IDENTIFICADO(S) NA PERGUNTA:\n`;
    matchedProducts.forEach(matchedProduct => {
      const cost = Number(matchedProduct.precoCusto || 0) / 100;
      const price = Number(matchedProduct.precoVenda || 0) / 100;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      const performance = analytics.salesPerformance.find(sp => sp.sku === matchedProduct.sku || sp.nome === matchedProduct.nome || sp.sku === matchedProduct.id);

      context += `  * Produto: ${matchedProduct.nome}\n`;
      context += `    - SKU: ${matchedProduct.sku || matchedProduct.id}\n`;
      context += `    - Estoque Atual: ${matchedProduct.estoque} ${matchedProduct.unidade || 'UN'} (Mínimo: ${matchedProduct.estoqueMinimo || 0})\n`;
      context += `    - Preço de Custo: R$ ${cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      context += `    - Preço de Venda: R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      context += `    - Margem Bruta Local: ${margin.toFixed(1)}%\n`;
      context += `    - Total de Vendas Recentes: ${performance ? performance.quantidadeVendida : 0} un\n`;
      if (performance) {
        context += `    - Receita Recente Gerada: R$ ${performance.receitaDecimal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
    });
    
    context += `\nINSTRUÇÃO PARA O ASSISTENTE: Quando o usuário pedir para vender mais de algum produto identificado acima, analise a margem bruta dele, seu estoque e histórico de vendas. Sugira estratégias de precificação, sugestões de descontos/promoções (se a margem permitir) e abordagens de vendas baseadas nos dados reais.\n`;
  }

  context += `=== FIM DO CONTEXTO ANALÍTICO ===\n\n`;
  return context;
};

