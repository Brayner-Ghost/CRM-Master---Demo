import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Bot, HelpCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { buildAnalyticsAIContext } from '../utils/aiLocalAnalytics';

const FloatingAIAssistant = () => {
  const { t, currentTheme } = useTheme();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: 'Olá! Sou o Assistente AI. Como posso te ajudar com seu CRM hoje? Você pode me perguntar sobre produtos que precisam de atenção, itens mais vendidos, margens ou estoque.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  if (!user) return null; // Only show for logged in users

  const handleSend = async (overrideInput) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim()) return;

    const originalInput = textToSend;
    const newMsg = {
      id: Date.now(),
      role: 'user',
      content: originalInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    if (!overrideInput) setInput('');
    setIsTyping(true);

    try {
      const activeTenant = user?.empresa || 'development';
      let finalPrompt = originalInput;
      
      // Inject pre-computed local analytics context (saves thousands of tokens and runs locally)
      try {
        const localContext = await buildAnalyticsAIContext(activeTenant, originalInput);
        if (localContext) {
          finalPrompt = originalInput + localContext;
        }
      } catch (e) {
        console.error("Erro ao obter analítico do CRM na IA flutuante:", e);
      }

      const callAssistant = httpsCallable(functions, 'crmAssistant');
      const response = await callAssistant({
        prompt: finalPrompt,
        history: messages.slice(-6), // context history limit
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        tenantId: activeTenant
      });

      const { text } = response.data;
      
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Erro na IA flutuante:", error);
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro de conexão. Por favor, tente novamente.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10000, fontFamily: 'inherit' }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'absolute',
              bottom: '80px',
              right: 0,
              width: '380px',
              height: '520px',
              backgroundColor: t.bg,
              border: t.border,
              borderRadius: '24px',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3), 0 15px 25px -10px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: t.border,
              backgroundColor: t.bgSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: t.accent,
                  color: t.accentContrast,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: t.shadowSmall
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: t.textMain, margin: 0 }}>CRM Copilot AI</h4>
                  <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>Online e Conectado</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.textSecondary,
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex'
                }}
                className="hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              backgroundColor: t.bg,
            }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: msg.role === 'assistant' ? t.accentSoft : t.bgSecondary,
                    color: msg.role === 'assistant' ? t.accent : t.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: t.border,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {msg.role === 'assistant' ? <Sparkles size={14} /> : 'EU'}
                  </div>
                  <div style={{ maxWidth: '80%' }}>
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                      backgroundColor: msg.role === 'user' ? t.accent : t.bgSecondary,
                      color: msg.role === 'user' ? t.accentContrast : t.textMain,
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      lineHeight: 1.5,
                      boxShadow: t.shadowSmall,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                    <span style={{ fontSize: '0.6rem', color: t.textSecondary, marginTop: '4px', display: 'block', paddingLeft: '4px' }}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              {messages.length === 1 && !isTyping && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary, marginBottom: '4px' }}>Perguntas sugeridas:</span>
                  {[
                    "Quais produtos precisam de atenção?",
                    "O que os clientes estão mais comprando?",
                    "Como vender mais do produto [Digite o nome ou SKU]"
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (s.includes("[Digite o nome ou SKU]")) {
                          setInput("Como vender mais do produto ");
                        } else {
                          handleSend(s);
                        }
                      }}
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: '12px',
                        border: t.border,
                        backgroundColor: t.bgSecondary,
                        color: t.textMain,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = t.accentSoft}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                    >
                      <Sparkles size={12} style={{ color: t.accent }} />
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {isTyping && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifycontent: 'center', border: t.border }}>
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: t.bgSecondary, borderRadius: '4px 18px 18px 18px', border: t.border }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                          style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: t.accent }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <div style={{
              padding: '1rem',
              borderTop: t.border,
              backgroundColor: t.bgSecondary,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: t.bg,
                border: t.border,
                borderRadius: '16px',
                padding: '4px 8px 4px 12px',
              }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Pergunte sobre estoque, vendas..."
                  style={{
                    flex: 1,
                    height: '36px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: t.textMain
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: input.trim() ? t.accent : t.bgSecondary,
                    color: input.trim() ? t.accentContrast : t.textSecondary,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: input.trim() ? 'pointer' : 'default',
                    transition: 'all 0.2s'
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: isOpen ? t.textMain : t.accent,
          color: isOpen ? t.bg : t.accentContrast,
          border: 'none',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          position: 'relative'
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default FloatingAIAssistant;
