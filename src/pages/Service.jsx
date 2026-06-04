import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, Send, User, Phone, Camera,
  Clock, CheckCircle2, Loader2, Smile, Paperclip, RefreshCw,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { db, functions } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc, getDoc,
} from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { httpsCallable } from 'firebase/functions';

// ── Channel configuration ──────────────────────────────────────────────────
const CHANNELS = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', bg: 'rgba(37,211,102,0.12)' },
  instagram: { label: 'Instagram', color: '#E4405F', bg: 'rgba(228,64,95,0.12)' },
  sms:       { label: 'SMS',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

// ── Small helpers ──────────────────────────────────────────────────────────
const toDate = (ts) => ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);

const fmtTime = (ts) => {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const fmtRelative = (ts) => {
  const d = toDate(ts);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1)   return 'Agora';
  if (m < 60)  return `${m}m`;
  if (h < 24)  return `${h}h`;
  if (days === 1) return 'Ontem';
  if (days < 7)  return `${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const dateLabel = (ts) => {
  const d = toDate(ts);
  if (!d) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const yest  = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d); msgDay.setHours(0,0,0,0);
  if (msgDay.getTime() === today.getTime()) return 'Hoje';
  if (msgDay.getTime() === yest.getTime())  return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
};

// ── Channel icon component ─────────────────────────────────────────────────
const ChanIcon = ({ channel, size = 14 }) => {
  const color = CHANNELS[channel]?.color || '#64748b';
  if (channel === 'whatsapp') return <Phone size={size} color={color} />;
  if (channel === 'instagram') return <Camera size={size} color={color} />;
  return <MessageSquare size={size} color={color} />;
};

// ── Channel badge pill ─────────────────────────────────────────────────────
const ChanBadge = ({ channel }) => {
  const cfg = CHANNELS[channel] || CHANNELS.sms;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color,
      fontSize: '0.69rem', fontWeight: 700, letterSpacing: '0.04em',
    }}>
      <ChanIcon channel={channel} size={11} />
      {cfg.label}
    </span>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const Service = () => {
  const { getTenantCollection, getTenantDoc } = useUser();
  const { t } = useTheme();

  const [tab, setTab]               = useState('open');
  const [chanFilter, setChanFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [text, setText]             = useState('');
  const [chats, setChats]           = useState([]);
  const [msgs, setMsgs]             = useState([]);
  const [sending, setSending]       = useState(false);
  const [integrations, setIntegrations] = useState(null);
  const [directWhatsappStatus, setDirectWhatsappStatus] = useState('disconnected');

  // Load WhatsApp connection state
  useEffect(() => {
    const docRef = getTenantDoc('settings', 'whatsapp_connection');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDirectWhatsappStatus(docSnap.data().status || 'disconnected');
      } else {
        setDirectWhatsappStatus('disconnected');
      }
    });
    return unsub;
  }, []);

  // ── Load integrations configuration ───────────────────────────────
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = getTenantDoc('company', 'integrations');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setIntegrations(snap.data());
        }
      } catch (err) {
        console.error("Error loading integrations settings:", err);
      }
    };
    loadSettings();
  }, []);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // Focus input when chat opens
  useEffect(() => { if (selected) inputRef.current?.focus(); }, [selected?.id]);

  // ── Real-time chats list ────────────────────────────────────────────────
  useEffect(() => {
    const q = query(getTenantCollection('chats'), orderBy('lastTime', 'desc'));
    return onSnapshot(q, (snap) =>
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  // ── Real-time full message history ─────────────────────────────────────
  useEffect(() => {
    if (!selected) { setMsgs([]); return; }
    const chatDocRef = getTenantDoc('chats', selected.id);
    const q = query(collection(chatDocRef, 'messages'), orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (selected.unread > 0) {
        updateDoc(chatDocRef, { unread: 0 });
      }
    });
    return unsub;
  }, [selected?.id]);

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !selected || sending) return;

    setText('');
    setSending(true);
    try {
      // Save agent message to mock Firestore
      const chatDocRef = getTenantDoc('chats', selected.id);
      await addDoc(collection(chatDocRef, 'messages'), {
        text: trimmed,
        sender: 'agent',
        time: new Date().toISOString()
      });

      // Update last message in the chat list
      await updateDoc(chatDocRef, {
        lastMsg: trimmed,
        lastTime: new Date().toISOString()
      });

      // Simulate a client reply after 1.5 seconds
      setTimeout(async () => {
        let replyText = "Olá! Como esta é uma demonstração do CRM Master, o atendimento real não está ativo. Todas as interações são locais e redefinidas ao recarregar a página (F5).";
        
        const lowerTrimmed = trimmed.toLowerCase();
        if (lowerTrimmed.includes("oi") || lowerTrimmed.includes("olá") || lowerTrimmed.includes("tudo bem")) {
          replyText = "Olá! Tudo bem por aqui, e com você? Como posso te ajudar hoje?";
        } else if (lowerTrimmed.includes("preço") || lowerTrimmed.includes("preco") || lowerTrimmed.includes("valor") || lowerTrimmed.includes("quanto custa")) {
          replyText = "Você pode consultar os valores e estoques de todos os produtos na aba de Inventário ou simulando uma venda no PDV.";
        } else if (lowerTrimmed.includes("prazo") || lowerTrimmed.includes("entrega") || lowerTrimmed.includes("frete")) {
          replyText = "Os pedidos de entrega e retirada são simulados na aba de E-commerce. Você pode ver todos os detalhes lá!";
        }

        await addDoc(collection(chatDocRef, 'messages'), {
          text: replyText,
          sender: 'client',
          time: new Date().toISOString()
        });

        await updateDoc(chatDocRef, {
          lastMsg: replyText,
          lastTime: new Date().toISOString(),
          unread: 1
        });
      }, 1500);

    } catch (err) {
      console.error('Send error:', err);
      alert('Erro ao enviar mensagem simulada.');
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── Filtered chat list ─────────────────────────────────────────────────
  const filtered = useMemo(() => chats.filter(c => {
    if (c.status !== tab) return false;
    if (chanFilter !== 'all' && c.channel !== chanFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.name || '').toLowerCase().includes(s) || (c.phoneNumber || '').includes(s);
    }
    return true;
  }), [chats, tab, chanFilter, search]);

  // ── Messages grouped by date ───────────────────────────────────────────
  const grouped = useMemo(() => {
    const items = [];
    let cur = null;
    msgs.forEach(m => {
      const lbl = dateLabel(m.time);
      if (lbl !== cur) { cur = lbl; items.push({ type: 'sep', id: `sep_${lbl}`, label: lbl }); }
      items.push({ type: 'msg', ...m });
    });
    return items;
  }, [msgs]);

  // Counters
  const counts = useMemo(() => ({
    open:    chats.filter(c => c.status === 'open').length,
    pending: chats.filter(c => c.status === 'pending').length,
    closed:  chats.filter(c => c.status === 'closed').length,
  }), [chats]);

  const totalUnread = chats.reduce((a, c) => a + (c.unread || 0), 0);

  // ── Layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Demo Warning Banner */}
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderBottom: `1px solid rgba(239, 68, 68, 0.25)`,
        padding: '0.625rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#ef4444',
        fontSize: '0.85rem',
        fontWeight: 600,
        flexShrink: 0
      }}>
        <span>Modo de Demonstração: O envio e recebimento de mensagens são simulados locais. A criação de novos canais de atendimento está desabilitada.</span>
      </div>

      <div style={{ flex: 1, display: 'flex', backgroundColor: t.bgSecondary, overflow: 'hidden' }}>

      {/* ════════════════════ SIDEBAR ════════════════════ */}
      <div style={{
        width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
        backgroundColor: t.bg, borderRight: `1px solid ${t.border}`,
      }}>
        {/* Header */}
        <div style={{ padding: '1.125rem 1.125rem 0.875rem', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              {/* n8n premium icon */}
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, #FF6C37 0%, #E65A28 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquare size={17} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: t.textMain, lineHeight: 1.1 }}>Atendimentos</div>
                <div style={{ fontSize: '0.68rem', color: t.textSecondary, fontWeight: 600, letterSpacing: '0.04em' }}>via n8n</div>
              </div>
            </div>
            {totalUnread > 0 && (
              <div style={{
                backgroundColor: '#ef4444', color: '#fff', borderRadius: 20,
                padding: '1px 8px', fontSize: '0.7rem', fontWeight: 800,
              }}>
                {totalUnread}
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.625rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
            <input
              placeholder="Buscar por nome ou número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', height: 36, paddingLeft: 32, paddingRight: 10,
                backgroundColor: t.bgSecondary, border: `1px solid ${t.border}`,
                borderRadius: 9, fontSize: '0.8125rem', color: t.textMain,
                outline: 'none', fontFamily: 'inherit', fontWeight: 500,
              }}
            />
          </div>

          {/* Channel filter */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '0.5rem' }}>
            {[
              { id: 'all',       label: 'Todos',     color: t.accent },
              { id: 'whatsapp',  label: 'WhatsApp',  color: '#25D366' },
              { id: 'instagram', label: 'Instagram', color: '#E4405F' },
            ].map(ch => {
              const active = chanFilter === ch.id;
              return (
                <button key={ch.id} onClick={() => setChanFilter(ch.id)} style={{
                  flex: 1, height: 26, borderRadius: 7, fontSize: '0.69rem', fontWeight: 700,
                  border: `1px solid ${active ? ch.color : t.border}`,
                  backgroundColor: active ? `${ch.color}18` : 'transparent',
                  color: active ? ch.color : t.textSecondary, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {ch.label}
                </button>
              );
            })}
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'open',    label: 'Abertos',    ct: counts.open },
              { id: 'pending', label: 'Pendentes',  ct: counts.pending },
              { id: 'closed',  label: 'Finalizados', ct: counts.closed },
            ].map(s => {
              const active = tab === s.id;
              return (
                <button key={s.id} onClick={() => setTab(s.id)} style={{
                  flex: 1, height: 30, borderRadius: 8, fontSize: '0.7rem', fontWeight: 700,
                  border: `1px solid ${active ? t.accent : t.border}`,
                  backgroundColor: active ? t.accent : 'transparent',
                  color: active ? '#fff' : t.textSecondary, cursor: 'pointer', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  {s.label}
                  {s.ct > 0 && (
                    <span style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.bgSecondary,
                      color: active ? '#fff' : t.textSecondary,
                      borderRadius: 10, padding: '0 5px', fontSize: '0.63rem', fontWeight: 800,
                    }}>
                      {s.ct}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.375rem' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: t.textSecondary }}>
              <MessageSquare size={36} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.25 }} />
              <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nenhuma conversa encontrada</p>
            </div>
          ) : filtered.map(chat => {
            const isSel = selected?.id === chat.id;
            return (
              <motion.div
                key={chat.id}
                onClick={() => setSelected(chat)}
                whileHover={{ backgroundColor: `${t.accent}08` }}
                style={{
                  display: 'flex', gap: '0.625rem', padding: '0.75rem 0.625rem',
                  borderRadius: 11, cursor: 'pointer', marginBottom: 2,
                  backgroundColor: isSel ? `${t.accent}12` : 'transparent',
                  border: `1.5px solid ${isSel ? t.accent : 'transparent'}`,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Avatar + channel badge */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, backgroundColor: t.bgSecondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${t.border}`,
                  }}>
                    <User size={20} color={t.textSecondary} />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -4, right: -4, width: 19, height: 19,
                    borderRadius: '50%', backgroundColor: t.bg, border: `1.5px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ChanIcon channel={chat.channel} size={11} />
                  </div>
                </div>

                {/* Text info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                    <span style={{
                      fontWeight: 700, color: t.textMain, fontSize: '0.855rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140,
                    }}>
                      {chat.name || chat.phoneNumber}
                    </span>
                    <span style={{ fontSize: '0.67rem', color: t.textSecondary, fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>
                      {fmtRelative(chat.lastTime)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.78rem', margin: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: chat.unread > 0 ? t.textMain : t.textSecondary,
                    fontWeight: chat.unread > 0 ? 600 : 400,
                  }}>
                    {chat.lastMsg}
                  </p>
                </div>

                {/* Unread badge */}
                {chat.unread > 0 && (
                  <div style={{
                    width: 19, height: 19, borderRadius: '50%', backgroundColor: '#25D366',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.63rem', fontWeight: 800, flexShrink: 0, alignSelf: 'center',
                  }}>
                    {chat.unread > 9 ? '9+' : chat.unread}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════ CHAT AREA ════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Chat header */}
            <div style={{
              height: 66, padding: '0 1.25rem', backgroundColor: t.bg,
              borderBottom: `1px solid ${t.border}`, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Avatar */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, backgroundColor: t.bgSecondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${t.border}`,
                  }}>
                    <User size={19} color={t.textSecondary} />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -3, right: -3, width: 17, height: 17,
                    borderRadius: '50%', backgroundColor: t.bg, border: `1.5px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ChanIcon channel={selected.channel} size={10} />
                  </div>
                </div>

                {/* Name + badges */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9375rem' }}>
                      {selected.name || selected.phoneNumber}
                    </span>
                    <ChanBadge channel={selected.channel} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <span style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 500 }}>
                      {selected.phoneNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header actions */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <motion.button whileHover={{ scale: 1.04 }}
                  onClick={() => updateDoc(getTenantDoc('chats', selected.id), { status: 'pending' })}
                  style={{
                    height: 34, padding: '0 0.875rem', borderRadius: 9,
                    border: `1px solid ${t.border}`, backgroundColor: t.bg,
                    color: t.textSecondary, fontWeight: 600, fontSize: '0.8rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <Clock size={14} /> Pendente
                </motion.button>
                <motion.button whileHover={{ scale: 1.04 }}
                  onClick={() => { updateDoc(getTenantDoc('chats', selected.id), { status: 'closed' }); setSelected(null); }}
                  style={{
                    height: 34, padding: '0 0.875rem', borderRadius: 9,
                    border: 'none', backgroundColor: '#10b981',
                    color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <CheckCircle2 size={14} /> Finalizar
                </motion.button>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.375rem',
              backgroundColor: t.bgSecondary,
            }}>
              {grouped.map((item, idx) => {
                if (item.type === 'sep') {
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', margin: '0.875rem 0', color: t.textSecondary }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      <div style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                    </div>
                  );
                }

                const isAgent = item.sender === 'agent';
                return (
                  <motion.div
                    key={item.id || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      maxWidth: '66%', alignSelf: isAgent ? 'flex-end' : 'flex-start',
                      display: 'flex', flexDirection: 'column', gap: 3,
                    }}
                  >
                    <div style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: isAgent ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
                      backgroundColor: isAgent ? t.accent : t.bg,
                      color: isAgent ? '#fff' : t.textMain,
                      fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.45,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
                      border: isAgent ? 'none' : `1px solid ${t.border}`,
                      wordBreak: 'break-word',
                    }}>
                      {item.text}
                    </div>
                    <span style={{
                      fontSize: '0.65rem', color: t.textSecondary, fontWeight: 600,
                      alignSelf: isAgent ? 'flex-end' : 'flex-start',
                      paddingLeft: 3, paddingRight: 3,
                    }}>
                      {fmtTime(item.time)}{isAgent ? ' · Enviada' : ''}
                    </span>
                  </motion.div>
                );
              })}

              {grouped.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: t.textSecondary, fontWeight: 600 }}>
                    Nenhuma mensagem ainda
                  </p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{
              padding: '0.875rem 1.25rem', backgroundColor: t.bg,
              borderTop: `1px solid ${t.border}`, flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: t.bgSecondary, border: `1px solid ${t.border}`,
                borderRadius: 13, padding: '4px 4px 4px 10px',
              }}>
                <button style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: 7 }}>
                  <Smile size={19} />
                </button>
                <button style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: 7 }}>
                  <Paperclip size={19} />
                </button>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Digite sua mensagem… (Enter para enviar)"
                  disabled={sending}
                  style={{
                    flex: 1, border: 'none', backgroundColor: 'transparent',
                    outline: 'none', fontSize: '0.9rem', color: t.textMain,
                    fontFamily: 'inherit', fontWeight: 500, height: 38,
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: 9, border: 'none',
                    backgroundColor: (sending || !text.trim()) ? t.border : t.accent,
                    color: (sending || !text.trim()) ? t.textSecondary : '#fff',
                    cursor: (sending || !text.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.18s', flexShrink: 0,
                  }}
                >
                  {sending
                    ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Send size={17} />
                  }
                </motion.button>
              </div>
              <p style={{ fontSize: '0.67rem', color: t.textSecondary, marginTop: 5, fontWeight: 500 }}>
                Enviando via n8n · {CHANNELS[selected.channel]?.label || selected.channel}
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 40px rgba(37,211,102,0.28)',
            }}>
              <MessageSquare size={34} color="#fff" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: t.textMain, marginBottom: '0.5rem' }}>
                Selecione uma conversa
              </h2>
              <p style={{ color: t.textSecondary, fontSize: '0.875rem', maxWidth: 280, lineHeight: 1.55 }}>
                Escolha um atendimento na lista ao lado para ver o histórico completo e responder em tempo real via WhatsApp ou Instagram.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════ CONTACT PANEL ════════════════════ */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="info-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              width: 272, flexShrink: 0, borderLeft: `1px solid ${t.border}`,
              backgroundColor: t.bg, padding: '1.375rem',
              display: 'flex', flexDirection: 'column', gap: '1.125rem',
              overflowY: 'auto',
            }}
          >
            {/* Avatar */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 68, height: 68, borderRadius: 19, backgroundColor: t.bgSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${t.border}`, margin: '0 auto 0.75rem',
              }}>
                <User size={32} color={t.textSecondary} />
              </div>
              <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.9375rem', marginBottom: 3 }}>
                {selected.name || selected.phoneNumber}
              </div>
              <div style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 500, marginBottom: '0.5rem' }}>
                {selected.phoneNumber}
              </div>
              <ChanBadge channel={selected.channel} />
            </div>

            <div style={{ height: 1, backgroundColor: t.border }} />

            {/* Info grid */}
            {[
              { label: 'Status',    value: selected.status === 'open' ? 'Aberto' : selected.status === 'pending' ? 'Pendente' : 'Finalizado' },
              { label: 'Canal',     value: CHANNELS[selected.channel]?.label || selected.channel },
              { label: 'Abertura', value: toDate(selected.createdAt)?.toLocaleDateString('pt-BR') || '—' },
              { label: 'Última msg', value: fmtTime(selected.lastTime) || '—' },
              { label: 'Msgs recebidas', value: msgs.filter(m => m.sender === 'client').length },
              { label: 'Msgs enviadas',  value: msgs.filter(m => m.sender === 'agent').length },
            ].map(item => (
              <div key={item.label}>
                <label style={{
                  fontSize: '0.67rem', fontWeight: 700, color: t.textSecondary,
                  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3,
                }}>
                  {item.label}
                </label>
                <span style={{ fontSize: '0.875rem', color: t.textMain, fontWeight: 600 }}>
                  {item.value}
                </span>
              </div>
            ))}

            <div style={{ height: 1, backgroundColor: t.border }} />

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selected.status !== 'pending' && (
                <motion.button whileHover={{ scale: 1.02 }}
                  onClick={() => updateDoc(getTenantDoc('chats', selected.id), { status: 'pending' })}
                  style={{
                    width: '100%', height: 38, border: `1px solid ${t.border}`,
                    borderRadius: 10, backgroundColor: 'transparent',
                    color: t.textMain, fontWeight: 600, fontSize: '0.82rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <Clock size={15} /> Mover para Pendentes
                </motion.button>
              )}
              {selected.status !== 'open' && (
                <motion.button whileHover={{ scale: 1.02 }}
                  onClick={() => updateDoc(getTenantDoc('chats', selected.id), { status: 'open' })}
                  style={{
                    width: '100%', height: 38, border: `1px solid ${t.border}`,
                    borderRadius: 10, backgroundColor: 'transparent',
                    color: t.textMain, fontWeight: 600, fontSize: '0.82rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <RefreshCw size={15} /> Reabrir Atendimento
                </motion.button>
              )}
              <motion.button whileHover={{ scale: 1.02 }}
                onClick={() => { updateDoc(getTenantDoc('chats', selected.id), { status: 'closed' }); setSelected(null); }}
                style={{
                  width: '100%', height: 38, border: 'none',
                  borderRadius: 10, backgroundColor: '#10b981',
                  color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <CheckCircle2 size={15} /> Finalizar Atendimento
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default Service;
