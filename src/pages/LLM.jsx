import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Send, Sparkles, Zap, History, 
  Settings as SettingsIcon, Copy, RefreshCw, 
  Check, X, Database, Cpu, Search
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { buildAnalyticsAIContext } from '../utils/aiLocalAnalytics';
import { useUser } from '../context/UserContext';

const LLM = () => {
  const { t } = useTheme();
  const { user } = useUser();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: 'Olá! Sou seu assistente de Inteligência AI. Como posso ajudar com seu CRM hoje?', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Configurações do Modelo
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  
  // Métricas
  const [metrics, setMetrics] = useState({
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
    maxTokens: 1048576,
    modelName: 'Gemini 2.5 Flash'
  });

  const SUGGESTIONS = [
    "Quais produtos precisam de atenção?",
    "O que os clientes estão mais comprando?",
    "Como vender mais do produto [Digite o nome ou SKU]"
  ];

  const handleSend = async (overrideInput) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim()) return;
    
    const newMsg = { 
      id: Date.now(), 
      role: 'user', 
      content: textToSend, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, newMsg]);
    if (!overrideInput) setInput('');
    setIsTyping(true);

    try {
      const activeTenant = user?.empresa || 'development';
      let finalPrompt = textToSend;
      try {
        const localContext = await buildAnalyticsAIContext(activeTenant, textToSend);
        if (localContext) {
          finalPrompt = textToSend + localContext;
        }
      } catch (e) {
        console.error("Erro ao obter analítico do CRM:", e);
      }

       const callAssistant = httpsCallable(functions, 'crmAssistant');
      const response = await callAssistant({ 
        prompt: finalPrompt,
        history: messages.slice(-10), // Aumentado para 10 mensagens de contexto
        model: selectedModel,
        systemPrompt: systemPrompt,
        temperature: temperature,
        tenantId: activeTenant
      });
      
      const { text, usage, model } = response.data;
      
      const aiMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: text, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        usage: usage
      };
      
      setMessages(prev => [...prev, aiMsg]);
      if (usage) {
        setMetrics({
          ...usage,
          modelName: model
        });
      }
    } catch (error) {
      console.error("Erro na AI:", error);
      const errorMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Detalhe: ' + (error.message || 'Erro interno'), 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ 
      height: 'calc(100vh - 40px)', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: t.bgSecondary,
      padding: '1.5rem',
      gap: '1.25rem'
    }}>
      {/* Demo Warning Banner */}
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '8px',
        padding: '0.875rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#ef4444',
        fontSize: '0.85rem',
        fontWeight: 600,
        flexShrink: 0
      }}>
        <Sparkles size={18} />
        <span>Modo de Demonstração: O Assistente de IA do Gemini está rodando em modo de simulação local. Respostas reais do servidor de IA estão desabilitadas.</span>
      </div>

      <div style={{ 
        flex: 1,
        display: 'flex', 
        gap: '1.5rem',
        overflow: 'hidden'
      }}>
        {/* Esquerda: Chat Principal */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: t.bg,
        border: t.border,
        borderRadius: t.radius,
        overflow: 'hidden',
        boxShadow: t.shadow
      }}>
        {/* Header da AI */}
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          borderBottom: t.border,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.bg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', height: '40px', backgroundColor: t.accent, color: t.accentContrast,
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: t.shadowSmall
            }}>
              <Sparkles size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Inteligência AI</h2>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                {metrics.modelName} Ativo
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              style={{ 
              height: '36px', padding: '0 1rem', borderRadius: '8px', border: t.border,
              backgroundColor: showHistory ? t.accentSoft : t.bg, color: t.textMain, fontWeight: 600, fontSize: '0.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}>
              <History size={16} /> Histórico
            </button>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              style={{ 
                width: '36px', height: '36px', borderRadius: '8px', border: t.border,
                backgroundColor: showConfig ? t.accentSoft : t.bg, color: t.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
          
          {/* Overlay de Configuração */}
          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0, width: '280px',
                  backgroundColor: t.bg, borderLeft: t.border, zIndex: 10, padding: '1.5rem',
                  boxShadow: t.shadow
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: t.textMain }}>Configurações</h3>
                  <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowConfig(false)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: t.textSecondary }}>MODELO</label>
                    <select 
                      value={selectedModel} 
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: t.border, backgroundColor: t.bgSecondary, fontWeight: 600 }}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: t.textSecondary }}>CRIATIVIDADE (TEMP)</label>
                    <input 
                      type="range" min="0" max="1.5" step="0.1" 
                      value={temperature} 
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: t.accent }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, marginTop: '4px' }}>
                      <span>Preciso</span>
                      <span>{temperature}</span>
                      <span>Criativo</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: t.textSecondary }}>CONTEXTO DO SISTEMA</label>
                    <textarea 
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Ex: Responda como um analista de marketing..."
                      style={{ width: '100%', height: '100px', padding: '0.6rem', borderRadius: '8px', border: t.border, backgroundColor: t.bgSecondary, fontSize: '0.8rem', resize: 'none' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Overlay de Histórico */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: '280px',
                  backgroundColor: t.bg, borderRight: t.border, zIndex: 10, padding: '1.5rem',
                  boxShadow: t.shadow
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: t.textMain }}>Conversas Recentes</h3>
                  <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowHistory(false)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: t.accentSoft, border: `1px solid ${t.accent}`, cursor: 'pointer' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>Conversa Atual</div>
                    <div style={{ fontSize: '0.7rem', color: t.textSecondary }}>{messages.length} mensagens</div>
                  </div>
                  <button 
                    onClick={() => {
                      setMessages([{ id: 1, role: 'assistant', content: 'Chat reiniciado. Como posso ajudar?', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                      setShowHistory(false);
                    }}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: t.border, backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginTop: '1rem' }}
                  >
                    Novo Chat
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  display: 'flex', 
                  gap: '1.25rem',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '10px', 
                  backgroundColor: msg.role === 'assistant' ? t.accentSoft : t.bgSecondary,
                  color: msg.role === 'assistant' ? t.accent : t.textSecondary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: t.border, flexShrink: 0
                }}>
                  {msg.role === 'assistant' ? <Sparkles size={18} /> : <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>EU</div>}
                </div>
                
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ 
                    padding: '1.25rem', 
                    borderRadius: '16px',
                    border: t.border,
                    backgroundColor: msg.role === 'assistant' ? t.bg : t.accent,
                    color: msg.role === 'assistant' ? t.textMain : t.accentContrast,
                    fontWeight: 500,
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    boxShadow: t.shadowSmall,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 600 }}>{msg.time}</span>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <RefreshCw size={14} style={{ cursor: 'pointer', color: t.textSecondary }} onClick={() => handleSend(messages[messages.length-2]?.content)} />
                        <Check size={14} style={{ cursor: 'pointer', color: t.textSecondary }} />
                        <X size={14} style={{ cursor: 'pointer', color: t.textSecondary }} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '1.25rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: t.border }}>
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: '16px', border: t.border }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.accent }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div style={{ padding: '1.5rem', borderTop: t.border, backgroundColor: t.bg }}>
          {messages.length === 1 && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    if (s.includes("[Digite o nome ou SKU]")) {
                      setInput("Como vender mais do produto ");
                    } else {
                      handleSend(s);
                    }
                  }}
                  style={{
                    padding: '0.6rem 1rem', borderRadius: '10px', border: t.border,
                    backgroundColor: t.bgSecondary, color: t.textMain, fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = t.accentSoft}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            backgroundColor: t.bgSecondary, border: t.border, borderRadius: '16px',
            padding: '0.6rem 1rem'
          }}>
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Pergunte qualquer coisa sobre seu CRM..."
              style={{
                flex: 1, minHeight: '44px', maxHeight: '150px', border: 'none', backgroundColor: 'transparent',
                outline: 'none', fontWeight: 600, fontSize: '1rem', color: t.textMain, resize: 'none',
                paddingTop: '8px'
              }}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim()}
              style={{ 
                width: '44px', height: '44px', borderRadius: '12px', 
                backgroundColor: input.trim() ? t.accent : t.bgSecondary, 
                color: input.trim() ? t.accentContrast : t.textSecondary, 
                border: 'none', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default',
                boxShadow: input.trim() ? t.shadowSmall : 'none', transition: 'all 0.2s'
              }}
            >
              <Send size={20} />
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.65rem', color: t.textSecondary, marginTop: '0.75rem', fontWeight: 600 }}>
            A AI pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>

      {/* Direita: Insights e Status */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ 
          padding: '1.5rem', backgroundColor: t.bg, border: t.border, borderRadius: t.radius,
          boxShadow: t.shadowSmall
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: t.textMain, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color={t.accent} /> Sugestões Inteligentes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Otimizar Estoque', desc: '3 itens estão abaixo do mínimo e vendendo rápido.' },
              { label: 'Reativar Clientes', desc: '12 clientes não compram há mais de 60 dias.' },
              { label: 'Meta de Vendas', desc: 'Você está a 85% de atingir a meta semanal.' }
            ].map(item => (
              <div key={item.label} style={{ padding: '1rem', backgroundColor: t.bgSecondary, borderRadius: '12px', border: t.border }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: t.textMain, marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500, lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ 
          padding: '1.5rem', backgroundColor: t.bg, border: t.border, borderRadius: t.radius,
          boxShadow: t.shadowSmall, flex: 1
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: t.textMain, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="#8b5cf6" /> Status do Modelo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textSecondary }}>Tokens Usados (Total)</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>
                {metrics.totalTokens.toLocaleString()} / {metrics.maxTokens >= 1000000 ? '1M' : metrics.maxTokens.toLocaleString()}
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: t.bgSecondary, borderRadius: '4px', overflow: 'hidden', border: t.border }}>
              <div style={{ 
                width: `${Math.min((metrics.totalTokens / metrics.maxTokens) * 100, 100)}%`, 
                height: '100%', 
                backgroundColor: t.accent,
                transition: 'width 0.5s ease-out'
              }} />
            </div>
            
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: t.textSecondary, fontWeight: 600 }}>Prompt:</span>
                <span style={{ color: t.textMain, fontWeight: 600 }}>{metrics.promptTokens.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: t.textSecondary, fontWeight: 600 }}>Resposta:</span>
                <span style={{ color: t.textMain, fontWeight: 600 }}>{metrics.candidatesTokens.toLocaleString()}</span>
              </div>
              {metrics.cachedTokens > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Cache Economizado:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{metrics.cachedTokens.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: t.border, paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={16} color={t.textSecondary} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>Dados do CRM Conectados</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color={t.textSecondary} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.textMain }}>Memória Contextual (10 msgs)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default LLM;
