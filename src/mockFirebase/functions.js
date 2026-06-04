export const getFunctions = (app, region) => {
  return {};
};

export const httpsCallable = (functions, name) => {
  return async (data) => {
    console.log(`Mock Functions: calling function "${name}" with data:`, data);
    
    if (name === 'crmAssistant') {
      const prompt = data.prompt ? data.prompt.toLowerCase() : '';
      let reply = "Olá! Como assistente de demonstração do CRM Master, posso ajudar você a explorar a plataforma. Note que os recursos reais de IA do Gemini estão simulados localmente nesta demo.";
      
      if (prompt.includes("produto") || prompt.includes("estoque")) {
        reply = "Analisando os dados em memória: observo que temos 3 itens com estoque baixo (como 'Camiseta Dry Fit' - restam 5 unidades). Recomendo criar uma campanha ou repor o estoque em breve.";
      } else if (prompt.includes("cliente") || prompt.includes("venda")) {
        reply = "Com base nos dados locais de vendas em memória, a taxa de conversão do e-commerce é de 2.8%. Os clientes mais ativos são 'Lucas Fernandes' e 'Mariana Alencar'.";
      } else if (prompt.includes("ajuda") || prompt.includes("como")) {
        reply = "Posso orientar você no uso do sistema. Você pode realizar vendas no PDV, cadastrar clientes no CRM e ver relatórios. Todas as alterações serão perdidas se a página for recarregada (F5).";
      } else if (prompt.includes("olá") || prompt.includes("oi") || prompt.includes("bom dia") || prompt.includes("boa tarde")) {
        reply = "Olá! Como posso ajudar você a testar o CRM Master hoje? Pergunte sobre nossos produtos, vendas ou como usar o sistema.";
      } else {
        reply = `Compreendo sua pergunta sobre "${data.prompt}". No modo de demonstração, simulo análises de estoque, métricas de vendas e informações do sistema. Fique à vontade para perguntar sobre esses tópicos!`;
      }
      
      return {
        data: {
          text: reply,
          usage: {
            promptTokens: 140,
            candidatesTokens: 110,
            totalTokens: 250
          },
          model: "gemini-2.5-flash (Simulado - Modo Demo)"
        }
      };
    }
    
    return { data: {} };
  };
};
