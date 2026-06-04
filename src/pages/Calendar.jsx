import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  Plus, ChevronLeft, ChevronRight, Clock, MapPin, AlignLeft, 
  Calendar as CalendarIcon, Trash2, X, Edit3, Check, Loader2, 
  Settings2, Search, Filter, ChevronDown, Globe, RefreshCw
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

const getEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getHolidaysForYear = (yr) => {
  const easter = getEaster(yr);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  
  const sextaSanta = new Date(easter);
  sextaSanta.setDate(easter.getDate() - 2);
  
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  
  return [
    {
      id: `holiday-${yr}-ano-novo`,
      title: 'Confraternização Universal',
      start: `${yr}-01-01T00:00`,
      end: `${yr}-01-01T23:59`,
      description: 'Feriado Nacional - Ano Novo',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-carnaval`,
      title: 'Carnaval',
      start: `${formatDate(carnaval)}T00:00`,
      end: `${formatDate(carnaval)}T23:59`,
      description: 'Feriado Nacional - Carnaval',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-sexta-santa`,
      title: 'Sexta-feira Santa',
      start: `${formatDate(sextaSanta)}T00:00`,
      end: `${formatDate(sextaSanta)}T23:59`,
      description: 'Feriado Nacional - Paixão de Cristo',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-tiradentes`,
      title: 'Tiradentes',
      start: `${yr}-04-21T00:00`,
      end: `${yr}-04-21T23:59`,
      description: 'Feriado Nacional - Tiradentes',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-dia-trabalho`,
      title: 'Dia do Trabalhador',
      start: `${yr}-05-01T00:00`,
      end: `${yr}-05-01T23:59`,
      description: 'Feriado Nacional - Dia do Trabalho',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-corpus-christi`,
      title: 'Corpus Christi',
      start: `${formatDate(corpusChristi)}T00:00`,
      end: `${formatDate(corpusChristi)}T23:59`,
      description: 'Feriado Nacional - Corpus Christi',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-independencia`,
      title: 'Independência do Brasil',
      start: `${yr}-09-07T00:00`,
      end: `${yr}-09-07T23:59`,
      description: 'Feriado Nacional - Independência do Brasil',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-nossa-senhora`,
      title: 'Nossa Senhora Aparecida',
      start: `${yr}-10-12T00:00`,
      end: `${yr}-10-12T23:59`,
      description: 'Feriado Nacional - Padroeira do Brasil',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-finados`,
      title: 'Finados',
      start: `${yr}-11-02T00:00`,
      end: `${yr}-11-02T23:59`,
      description: 'Feriado Nacional - Dia de Finados',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-proclamacao`,
      title: 'Proclamação da República',
      start: `${yr}-11-15T00:00`,
      end: `${yr}-11-15T23:59`,
      description: 'Feriado Nacional - Proclamação da República',
      source: 'holiday',
      isHoliday: true
    },
    {
      id: `holiday-${yr}-natal`,
      title: 'Natal',
      start: `${yr}-12-25T00:00`,
      end: `${yr}-12-25T23:59`,
      description: 'Feriado Nacional - Natal',
      source: 'holiday',
      isHoliday: true
    }
  ];
};

const getEventStyles = (title, t) => {
  const lower = title.toLowerCase();
  if (
    lower.includes('trabalho') || 
    lower.includes('mãe') || 
    lower.includes('corpo') || 
    lower.includes('pai') || 
    lower.includes('natal') || 
    lower.includes('ano novo') || 
    lower.includes('confraternização') || 
    lower.includes('tiradentes') || 
    lower.includes('independência') || 
    lower.includes('finados') || 
    lower.includes('carnaval') || 
    lower.includes('santa') || 
    lower.includes('aparecida') || 
    lower.includes('república') ||
    lower.includes('proclamação')
  ) {
    return {
      bg: t.accentSoft || 'rgba(62, 85, 133, 0.15)',
      color: t.accent || '#3e5585',
      border: `1px solid ${t.accent || '#3e5585'}30`
    };
  }
  if (
    lower.includes('mayo') || 
    lower.includes('memorial') || 
    lower.includes('thanksgiving') || 
    lower.includes('veterans') || 
    lower.includes('halloween')
  ) {
    return {
      bg: t.successSoft || 'rgba(83, 98, 60, 0.15)',
      color: t.success || '#53623c',
      border: `1px solid ${t.success || '#53623c'}30`
    };
  }
  return {
    bg: t.primaryLight || 'rgba(77, 116, 224, 0.15)',
    color: t.primary || '#4d74e0',
    border: `1px solid ${t.primary || '#4d74e0'}30`
  };
};

const Calendar = () => {
  const { user, getTenantCollection, getTenantDoc } = useUser();
  const { t, currentTheme, isMobile, density } = useTheme();
  
  const [events, setEvents] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month'
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', description: '' });
  const [googleToken, setGoogleToken] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('todos'); // 'todos', 'internal', 'google'
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [minhasAgendasOpen, setMinhasAgendasOpen] = useState(true);
  const [outrasAgendasOpen, setOutrasAgendasOpen] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  
  const [bookingPages, setBookingPages] = useState([]);
  const [showCreatePageForm, setShowCreatePageForm] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageDuration, setNewPageDuration] = useState(30);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(getTenantCollection('calendar'), (s) => {
      setEvents(s.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'internal' })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(getTenantCollection('bookingPages'), (s) => {
      setBookingPages(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [user]);

  const handleCreateBookingPage = async (e) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;
    try {
      await addDoc(getTenantCollection('bookingPages'), {
        title: newPageTitle,
        duration: Number(newPageDuration),
        createdAt: new Date().toISOString()
      });
      setNewPageTitle('');
      setShowCreatePageForm(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar página de agendamento.');
    }
  };

  const login = useGoogleLogin({
    onSuccess: tokenResponse => {
      setGoogleToken(tokenResponse.access_token);
      fetchGoogleEvents(tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events'
  });

  const fetchGoogleEvents = async (token) => {
    setIsSyncing(true);
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.items) {
        const formatted = data.items.map(item => ({
          id: item.id,
          title: item.summary,
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          description: item.description || '',
          source: 'google',
          htmlLink: item.htmlLink
        }));
        setGoogleEvents(formatted);
      }
    } catch (err) {
      console.error('Erro ao buscar eventos do Google:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const createGoogleEvent = async (eventData, token) => {
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: eventData.title,
          description: eventData.description,
          start: { dateTime: new Date(eventData.start).toISOString() },
          end: { dateTime: new Date(eventData.end).toISOString() }
        })
      });
      return await response.json();
    } catch (err) {
      console.error('Erro ao criar evento no Google:', err);
      throw err;
    }
  };

  const currentYr = currentDate.getFullYear();
  const holidayEvents = showHolidays ? [
    ...getHolidaysForYear(currentYr - 1),
    ...getHolidaysForYear(currentYr),
    ...getHolidaysForYear(currentYr + 1)
  ] : [];

  const allEvents = [...events, ...googleEvents, ...holidayEvents];
  
  const filteredEvents = allEvents.filter(e => {
    const matchesSearch = !searchTerm || 
      (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (e.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = filterSource === 'todos' || e.source === filterSource;
    return matchesSearch && matchesSource;
  });

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const calendarDays = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthLastDay - i, current: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, current: true, date: new Date(year, month, i) });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, current: false, date: new Date(year, month + 1, i) });
  }

  const changeDate = (offset) => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'day') {
      nextDate.setDate(currentDate.getDate() + offset);
    } else if (viewMode === 'week') {
      nextDate.setDate(currentDate.getDate() + offset * 7);
    } else {
      nextDate.setMonth(currentDate.getMonth() + offset);
    }
    setCurrentDate(nextDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleOpenModal = (event = null, initialDate = null) => {
    if (event) {
      if (event.source === 'google') {
        window.open(event.htmlLink, '_blank');
        return;
      }
      setEditingId(event.id);
      setNewEvent({ ...event });
      setIsReadOnly(true);
      setSyncToGoogle(false);
    } else {
      setEditingId(null);
      const start = initialDate ? new Date(initialDate) : new Date();
      start.setHours(new Date().getHours() + 1, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      
      setNewEvent({ 
        title: '', 
        start: start.toISOString().slice(0, 16), 
        end: end.toISOString().slice(0, 16), 
        description: '' 
      });
      setIsReadOnly(false);
      setSyncToGoogle(googleToken ? true : false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    try {
      if (syncToGoogle && googleToken) {
        await createGoogleEvent(newEvent, googleToken);
        await fetchGoogleEvents(googleToken);
      }

      if (editingId) {
        await updateDoc(getTenantDoc('calendar', editingId), { 
          ...newEvent, 
          updatedAt: new Date().toISOString() 
        });
      } else {
        await addDoc(getTenantCollection('calendar'), { 
          ...newEvent, 
          createdAt: new Date().toISOString() 
        });
      }
      setShowModal(false);
      setNewEvent({ title: '', start: '', end: '', description: '' });
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar evento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Excluir este compromisso permanentemente?')) {
      try {
        await deleteDoc(getTenantDoc('calendar', id));
        setShowModal(false);
      } catch (err) {
        alert('Erro ao excluir compromisso.');
      }
    }
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };
  
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const formattedMonthYear = capitalize(currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }));

  return (
    <div className="calendar-page w-full flex flex-col overflow-hidden" style={{ color: t.textMain, fontFamily: "inherit", height: 'calc(100vh - 55px)', padding: '0.25rem 1.25rem 0.5rem 1.25rem' }}>
      
      {/* ══════════ HEADER ══════════ */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Group 1: Title & Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Agenda</h1>
            
            {/* Prev, Hoje, Next Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: t.bgSecondary, padding: '4px 8px', borderRadius: t.radiusSmall, border: t.borderBold }}>
              <button 
                onClick={() => changeDate(-1)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', color: t.textSecondary }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surface}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={goToToday}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 14px', 
                  fontSize: '0.9rem', fontWeight: 600, color: t.textMain, borderRadius: t.radiusSmall,
                  fontFamily: 'inherit', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surface}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {formattedMonthYear}
              </button>
              <button 
                onClick={() => changeDate(1)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', color: t.textSecondary }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surface}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Group 2: Search, Filters, View Mode, Config, +Event */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Search */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={16} />
              <input
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px 0 40px',
                  backgroundColor: t.bgSecondary,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  color: t.textMain,
                  outline: 'none',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                placeholder="Buscar evento..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{
                  height: '42px',
                  padding: '0 1.25rem',
                  border: t.borderBold,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: showFilterMenu ? t.accentSoft : t.bgSecondary,
                  color: showFilterMenu ? t.accent : t.textSecondary,
                  cursor: 'pointer',
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                <Filter size={16} /> 
                <span>{filterSource === 'todos' ? 'Fontes' : filterSource === 'internal' ? 'CRM Interno' : 'Google Agenda'}</span>
              </button>
              
              <AnimatePresence>
                {showFilterMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowFilterMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute', top: '48px', right: 0, width: '180px',
                        backgroundColor: t.surface, border: t.border, boxShadow: t.shadow,
                        zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem', color: t.textSecondary, letterSpacing: '0.05em', paddingLeft: '0.5rem' }}>Filtrar Fonte</div>
                      {[
                        { id: 'todos', label: 'Todas as Fontes' },
                        { id: 'internal', label: 'CRM Interno' },
                        { id: 'google', label: 'Google Agenda' }
                      ].map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setFilterSource(src.id); setShowFilterMenu(false); }}
                          style={{
                            width: '100%', padding: '8px 12px', textAlign: 'left',
                            backgroundColor: filterSource === src.id ? t.primaryLight : 'transparent',
                            color: filterSource === src.id ? t.primary : t.textMain,
                            border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                            borderRadius: '4px', transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={e => filterSource !== src.id && (e.currentTarget.style.backgroundColor = t.bgSecondary)}
                          onMouseLeave={e => filterSource !== src.id && (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {src.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* View Mode Selector */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowViewMenu(v => !v)}
                style={{
                  height: '42px', 
                  padding: '0 1.25rem', 
                  border: t.borderBold, 
                  borderRadius: t.radiusSmall, 
                  backgroundColor: t.bgSecondary, 
                  color: t.textMain, 
                  fontWeight: 600, 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surface}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
              >
                <span>{viewMode === 'day' ? 'Dia' : viewMode === 'week' ? 'Semana' : 'Mês'}</span>
                <ChevronDown size={14} />
              </button>
              
              <AnimatePresence>
                {showViewMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowViewMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute', top: '48px', right: 0,
                        backgroundColor: t.surface, border: t.border, borderRadius: t.radiusSmall,
                        boxShadow: t.shadow, zIndex: 50, overflow: 'hidden', minWidth: 120, padding: '0.5rem'
                      }}
                    >
                      {[
                        { id: 'day', label: 'Dia' },
                        { id: 'week', label: 'Semana' },
                        { id: 'month', label: 'Mês' }
                      ].map(mode => (
                        <button 
                          key={mode.id} 
                          onClick={() => { setViewMode(mode.id); setShowViewMenu(false); }} 
                          style={{
                            width: '100%', padding: '8px 12px', textAlign: 'left',
                            backgroundColor: viewMode === mode.id ? t.primaryLight : 'transparent',
                            color: viewMode === mode.id ? t.primary : t.textMain,
                            border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                            borderRadius: '4px', fontFamily: 'inherit',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={e => viewMode !== mode.id && (e.currentTarget.style.backgroundColor = t.bgSecondary)}
                          onMouseLeave={e => viewMode !== mode.id && (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Settings (Configuração) Button */}
            <button 
              onClick={() => setShowSettingsModal(true)}
              style={{ 
                height: '42px', width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.bgSecondary, border: t.borderBold, borderRadius: t.radiusSmall,
                color: t.textSecondary, cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surface}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
            >
              <Settings2 size={18} />
            </button>

            {/* + Novo Evento button */}
            <button 
              onClick={() => handleOpenModal()}
              style={{ 
                height: '42px', 
                padding: '0 1.25rem', 
                backgroundColor: t.primary, 
                color: '#fff', 
                fontWeight: 600, 
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: t.radiusSmall,
                boxShadow: t.shadowSmall,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.primaryDark || t.primary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = t.primary}
            >
              <Plus size={16} />
              <span>Novo evento</span>
            </button>

          </div>
        </div>
      </header>

      {/* ══════════ MAIN CALENDAR CONTENT ══════════ */}
      <main className="flex-1 flex flex-col min-w-0" style={{ overflow: 'hidden' }}>
        
        {/* Calendar Body */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {loading ? (
            <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-500" size={48} /></div>
          ) : viewMode === 'month' ? (
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', 
              height: '100%', minHeight: '650px', backgroundColor: t.surface, 
              border: t.border, borderBottom: 'none', borderRight: 'none', overflow: 'hidden'
            }}>
              {calendarDays.map((d, i) => {
                const dateStr = d.date.toISOString().split('T')[0];
                const dayEvents = filteredEvents.filter(e => e.start?.startsWith(dateStr));
                const today = isToday(d.date);
                const isCurrentMonth = d.current;
                
                const isFirstRow = i < 7;
                const weekdayLabel = isFirstRow ? ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'][i] : null;

                // format for 1st of the month: "1 mai."
                const getDayLabelStr = (dateVal) => {
                  const dayVal = dateVal.getDate();
                  if (dayVal === 1) {
                    const monthName = dateVal.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
                    return `1 ${monthName}`;
                  }
                  return dayVal.toString();
                };
                
                const dayNumLabel = getDayLabelStr(d.date);

                return (
                  <div 
                    key={d.date.toISOString()}
                    onClick={() => handleOpenModal(null, d.date)}
                    style={{ 
                      backgroundColor: isCurrentMonth ? t.surface : t.bgSecondary,
                      borderRight: t.border,
                      borderBottom: t.border,
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      cursor: 'pointer',
                      position: 'relative',
                      minHeight: '100px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isCurrentMonth ? t.surface : t.bgSecondary}
                  >
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      alignSelf: 'center', 
                      marginTop: '2px',
                      marginBottom: '4px' 
                    }}>
                      {weekdayLabel && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 600, 
                          color: today ? t.primary : t.textLight, 
                          textTransform: 'uppercase',
                          marginBottom: '2px'
                        }}>
                          {weekdayLabel}
                        </span>
                      )}
                      {today ? (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          width: '24px', 
                          height: '24px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: t.primary,
                          color: '#ffffff',
                          borderRadius: '50%'
                        }}>
                          {dayNumLabel}
                        </span>
                      ) : (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 500, 
                          color: isCurrentMonth ? t.textMain : t.textLight 
                        }}>
                          {dayNumLabel}
                        </span>
                      )}
                    </div>
                    
                    {/* Event pills inside the cell */}
                    <div className="overflow-hidden space-y-1" style={{ flex: 1 }}>
                      {dayEvents.map(e => {
                        const styles = getEventStyles(e.title, t);
                        return (
                          <div 
                            key={e.id} 
                            onClick={(ev) => { ev.stopPropagation(); handleOpenModal(e); }}
                            style={{ 
                              backgroundColor: styles.bg, 
                              color: styles.color,
                              padding: '2px 8px', 
                              fontSize: '0.7rem', 
                              fontWeight: 600, 
                              borderRadius: '4px', 
                              whiteSpace: 'nowrap',
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              border: styles.border,
                              transition: 'filter 0.2s'
                            }}
                            onMouseEnter={ev => ev.currentTarget.style.filter = 'brightness(1.15)'}
                            onMouseLeave={ev => ev.currentTarget.style.filter = 'none'}
                          >
                            {e.source === 'google' ? <Globe size={10} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: t.primary }} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              height: '100%', backgroundColor: t.surface, borderRadius: t.radiusMedium || '8px',
              border: t.border, overflow: 'hidden',
              display: 'flex', flexDirection: 'column' 
            }}>
              {/* Timeline Header */}
              <div style={{ display: 'flex', borderBottom: t.border, backgroundColor: t.surface }}>
                <div style={{ width: '80px', borderRight: t.border }} />
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${viewMode === 'week' ? 7 : 1}, 1fr)`, flex: 1 }}>
                  {(viewMode === 'week' ? (() => {
                    const start = new Date(currentDate);
                    start.setDate(currentDate.getDate() - currentDate.getDay());
                    return Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(start);
                      d.setDate(start.getDate() + i);
                      return d;
                    });
                  })() : [currentDate]).map((d) => (
                    <div key={d.toISOString()} style={{ 
                      padding: '1rem 0.5rem', textAlign: 'center', 
                      borderRight: (viewMode === 'week') ? t.border : 'none',
                      backgroundColor: isToday(d) ? t.bgSecondary : 'transparent'
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: isToday(d) ? t.primary : t.textLight, letterSpacing: '0.05em' }}>{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: isToday(d) ? t.primary : t.textMain }}>{d.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrollable Time Grid */}
              <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                <div style={{ display: 'flex', height: '1440px', position: 'relative' }}>
                  {/* Hours scale */}
                  <div style={{ width: '80px', borderRight: t.border, backgroundColor: t.surface, position: 'sticky', left: 0, zIndex: 5 }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={`hour-${h}`} style={{ 
                        height: '60px', borderBottom: t.border, padding: '8px',
                        fontSize: '0.65rem', fontWeight: 600, color: t.textLight, textAlign: 'right'
                      }}>
                        {`${h.toString().padStart(2, '0')}:00`}
                      </div>
                    ))}
                  </div>

                  {/* Days columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${viewMode === 'week' ? 7 : 1}, 1fr)`, flex: 1, position: 'relative' }}>
                    {(viewMode === 'week' ? (() => {
                      const start = new Date(currentDate);
                      start.setDate(currentDate.getDate() - currentDate.getDay());
                      return Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(start);
                        d.setDate(start.getDate() + i);
                        return d;
                      });
                    })() : [currentDate]).map((d, colIdx) => {
                      const dateStr = d.toISOString().split('T')[0];
                      const dayEvents = filteredEvents.filter(e => e.start?.startsWith(dateStr));
                      
                      return (
                        <div key={colIdx} style={{ 
                          position: 'relative', borderRight: (viewMode === 'week' && colIdx < 6) ? t.border : 'none' 
                        }} onClick={() => handleOpenModal(null, d)}>
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} style={{ height: '60px', borderBottom: t.border }} />
                          ))}
                          
                          {/* Events positioning */}
                          {dayEvents.map(e => {
                            const start = new Date(e.start);
                            const end = new Date(e.end);
                            const top = (start.getHours() * 60 + start.getMinutes());
                            const duration = Math.max(30, (end.getTime() - start.getTime()) / (1000 * 60));
                            const styles = getEventStyles(e.title, t);
                            
                            return (
                              <div
                                key={e.id}
                                onClick={(ev) => { ev.stopPropagation(); handleOpenModal(e); }}
                                style={{
                                  position: 'absolute',
                                  top: `${top}px`,
                                  left: '4px',
                                  right: '4px',
                                  height: `${duration}px`,
                                  backgroundColor: styles.bg,
                                  color: styles.color,
                                  border: styles.border,
                                  borderRadius: '8px',
                                  padding: '8px',
                                  zIndex: 10,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                  transition: 'filter 0.2s'
                                }}
                                onMouseEnter={ev => ev.currentTarget.style.filter = 'brightness(1.15)'}
                                onMouseLeave={ev => ev.currentTarget.style.filter = 'none'}
                              >
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}>{e.title}</div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8 }}>
                                  {`${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`}
                                </div>
                              </div>
                            );
                          })}

                          {/* Current time indicator */}
                          {isToday(d) && (
                            <div style={{
                              position: 'absolute',
                              top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`,
                              left: 0, right: 0,
                              height: '2px',
                              backgroundColor: '#ef4444',
                              zIndex: 20,
                              pointerEvents: 'none'
                            }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', marginLeft: '-4px', marginTop: '-3px', boxShadow: `0 0 0 4px rgba(239, 68, 68, 0.2)` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══════════ CONFIG (SETTINGS) MODAL ══════════ */}
      <AnimatePresence>
        {showSettingsModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{ 
                maxWidth: '540px', width: '100%', backgroundColor: t.surface || t.bg, 
                borderRadius: t.radius || '16px', boxShadow: t.shadowLarge, overflow: 'hidden',
                border: t.border,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                maxHeight: '95vh'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: t.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: t.textMain }}>Configurações da Agenda</h2>
                <motion.button 
                  onClick={() => setShowSettingsModal(false)} 
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={18} />
                </motion.button>
              </div>
              
              {/* Modal Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. Páginas de agendamento */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.textMain, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <span>Páginas de agendamento</span>
                    <Plus 
                      size={16} 
                      onClick={() => setShowCreatePageForm(true)} 
                      style={{ cursor: 'pointer', color: t.primary }} 
                    />
                  </div>
                  
                  {showCreatePageForm && (
                    <form 
                      onSubmit={handleCreateBookingPage}
                      style={{ 
                        backgroundColor: t.bgSecondary, 
                        border: `1.5px solid ${t.primary}`, 
                        padding: '0.75rem', 
                        borderRadius: t.radiusSmall, 
                        marginBottom: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textMain }}>Nova Página de Agendamento</div>
                      
                      <input 
                        placeholder="Título (ex: Reunião Comercial)"
                        value={newPageTitle}
                        onChange={e => setNewPageTitle(e.target.value)}
                        required
                        style={{ 
                          width: '100%', height: '32px', border: t.borderBold, borderRadius: '4px',
                          padding: '0 0.5rem', fontSize: '0.75rem', outline: 'none',
                          backgroundColor: t.surface, color: t.textMain,
                          fontFamily: 'inherit'
                        }}
                      />
                      
                      <select
                        value={newPageDuration}
                        onChange={e => setNewPageDuration(Number(e.target.value))}
                        style={{ 
                          width: '100%', height: '32px', border: t.borderBold, borderRadius: '4px',
                          padding: '0 0.5rem', fontSize: '0.75rem', outline: 'none',
                          backgroundColor: t.surface, color: t.textMain,
                          fontFamily: 'inherit'
                        }}
                      >
                        <option value={15}>15 minutos</option>
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                      </select>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button 
                          type="submit" 
                          style={{ 
                            flex: 1, height: '28px', backgroundColor: t.primary, color: '#fff', 
                            border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem', 
                            cursor: 'pointer', fontFamily: 'inherit'
                          }}
                        >
                          Criar
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { setShowCreatePageForm(false); setNewPageTitle(''); }}
                          style={{ 
                            flex: 1, height: '28px', backgroundColor: 'transparent', color: t.textSecondary, 
                            border: t.borderBold, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem', 
                            cursor: 'pointer', fontFamily: 'inherit'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                  
                  {bookingPages.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: t.textSecondary, backgroundColor: t.bgSecondary, padding: '0.75rem', borderRadius: t.radiusSmall, border: t.border }}>
                      Nenhuma página de agendamento criada. Toque no "+" para criar.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                      {bookingPages.map(page => (
                        <div 
                          key={page.id} 
                          style={{ 
                            fontSize: '0.75rem', color: t.textMain, backgroundColor: t.bgSecondary, 
                            padding: '0.65rem 0.75rem', borderRadius: t.radiusSmall, border: t.border,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontWeight: 600 }}>{page.title}</div>
                            <div style={{ fontSize: '0.65rem', color: t.textSecondary }}>{page.duration} min | Ativo</div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/book/${page.id}`);
                                alert('Link de agendamento copiado!');
                              }}
                              style={{ 
                                background: 'none', border: 'none', cursor: 'pointer', color: t.primary,
                                fontSize: '0.65rem', fontWeight: 600, padding: 0, fontFamily: 'inherit'
                              }}
                            >
                              Copiar
                            </button>
                            <span style={{ color: t.textLight || '#ccc', fontSize: '0.65rem' }}>|</span>
                            <button 
                              onClick={async () => {
                                if (window.confirm('Excluir esta página de agendamento?')) {
                                  await deleteDoc(getTenantDoc('bookingPages', page.id));
                                }
                              }}
                              style={{ 
                                background: 'none', border: 'none', cursor: 'pointer', color: '#f28b82',
                                fontSize: '0.65rem', fontWeight: 600, padding: 0, fontFamily: 'inherit'
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Minhas agendas */}
                <div>
                  <div 
                    onClick={() => setMinhasAgendasOpen(!minhasAgendasOpen)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.textMain, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', cursor: 'pointer' }}
                  >
                    <span>Minhas agendas</span>
                    <ChevronDown size={16} style={{ transform: minhasAgendasOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                  </div>
                  
                  {minhasAgendasOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                      {[
                        { name: 'CRM Interno', color: t.primary, checked: true },
                        { name: 'Google Agenda', color: '#4285F4', checked: !!googleToken }
                      ].map(c => (
                        <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <div style={{ 
                            width: '16px', height: '16px', borderRadius: '3px', border: c.checked ? `2px solid ${c.color}` : `2px solid ${t.textLight}`,
                            backgroundColor: c.checked ? c.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}>
                            {c.checked && <Check size={10} color="#fff" strokeWidth={4} />}
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary }}>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Outras agendas */}
                <div>
                  <div 
                    onClick={() => setOutrasAgendasOpen(!outrasAgendasOpen)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.textMain, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', cursor: 'pointer' }}
                  >
                    <span>Outras agendas</span>
                    <ChevronDown size={16} style={{ transform: outrasAgendasOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                  </div>
                  
                  {outrasAgendasOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <div 
                          style={{ 
                            width: '16px', height: '16px', borderRadius: '3px', 
                            border: showHolidays ? '2px solid #53623c' : `2px solid ${t.textLight || '#ccc'}`,
                            backgroundColor: showHolidays ? '#53623c' : 'transparent', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          {showHolidays && <Check size={10} color="#fff" strokeWidth={4} />}
                        </div>
                        <input 
                          type="checkbox" 
                          checked={showHolidays} 
                          onChange={e => setShowHolidays(e.target.checked)} 
                          style={{ display: 'none' }} 
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary, userSelect: 'none' }}>
                          Feriados
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 4. Conectar Google Agenda */}
                <div style={{ marginTop: '0.5rem', borderTop: t.border, paddingTop: '1.25rem' }}>
                  <button 
                    onClick={() => { googleToken ? fetchGoogleEvents(googleToken) : login(); setShowSettingsModal(false); }}
                    disabled={isSyncing}
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: googleToken ? `${t.primary}15` : t.primary,
                      color: googleToken ? t.primary : '#fff',
                      border: googleToken ? `1px solid ${t.primary}` : 'none',
                      borderRadius: t.radiusSmall,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                    {googleToken ? (isSyncing ? 'Sincronizando...' : 'Atualizar Google Agenda') : 'Conectar com Google Agenda'}
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════ EVENT MODAL ══════════ */}
      <AnimatePresence>
        {showModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justify: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
              style={{ 
                maxWidth: '480px', width: '100%', backgroundColor: t.surface || t.bg, 
                borderRadius: t.radius || '16px', boxShadow: t.shadowLarge, overflow: 'hidden',
                border: t.border,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                maxHeight: '95vh'
              }}
            >
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: t.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: t.textMain }}>{editingId ? 'Detalhes do evento' : 'Novo evento'}</h2>
                <motion.button
                  onClick={() => setShowModal(false)}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={18} />
                </motion.button>
              </div>
              
              <div style={{ padding: '1.5rem' }}>
                <form id="eventForm" onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary, marginBottom: '0.35rem' }}>Título</label>
                    <input 
                      placeholder="Adicione um título"
                      value={newEvent.title}
                      onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      required
                      disabled={isReadOnly}
                      style={{ 
                        width: '100%', height: '40px', border: t.borderBold, borderRadius: t.radiusSmall,
                        padding: '0 0.75rem', fontWeight: 500, fontSize: '0.9rem', outline: 'none',
                        backgroundColor: isReadOnly ? t.bgSecondary : t.surface,
                        color: t.textMain,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary, marginBottom: '0.35rem' }}>Início</label>
                      <input 
                        type="datetime-local"
                        value={newEvent.start}
                        onChange={e => setNewEvent({...newEvent, start: e.target.value})}
                        required
                        disabled={isReadOnly}
                        style={{ 
                          width: '100%', height: '40px', border: t.borderBold, borderRadius: t.radiusSmall,
                          padding: '0 0.5rem', fontWeight: 500, fontSize: '0.85rem', outline: 'none',
                          backgroundColor: isReadOnly ? t.bgSecondary : t.surface,
                          color: t.textMain,
                          fontFamily: 'inherit',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary, marginBottom: '0.35rem' }}>Término</label>
                      <input 
                        type="datetime-local"
                        value={newEvent.end}
                        onChange={e => setNewEvent({...newEvent, end: e.target.value})}
                        required
                        disabled={isReadOnly}
                        style={{ 
                          width: '100%', height: '40px', border: t.borderBold, borderRadius: t.radiusSmall,
                          padding: '0 0.5rem', fontWeight: 500, fontSize: '0.85rem', outline: 'none',
                          backgroundColor: isReadOnly ? t.bgSecondary : t.surface,
                          color: t.textMain,
                          fontFamily: 'inherit',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: t.textSecondary, marginBottom: '0.35rem' }}>Descrição</label>
                    <textarea 
                      placeholder="Adicione uma descrição..."
                      value={newEvent.description}
                      onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      disabled={isReadOnly}
                      rows="3"
                      style={{ 
                        width: '100%', border: t.borderBold, borderRadius: t.radiusSmall, padding: '0.75rem', 
                        fontWeight: 500, fontSize: '0.9rem', resize: 'none', outline: 'none',
                        backgroundColor: isReadOnly ? t.bgSecondary : t.surface,
                        color: t.textMain,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  
                  {googleToken && !editingId && (
                    <label style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', 
                      borderRadius: t.radiusSmall, border: syncToGoogle ? `1.5px solid ${t.primary}` : t.border, 
                      backgroundColor: syncToGoogle ? t.primaryLight : 'transparent', transition: 'all 0.2s' 
                    }}>
                      <div style={{ 
                        width: '18px', height: '18px', borderRadius: '4px', border: syncToGoogle ? `2px solid ${t.primary}` : `2px solid ${t.textLight}`,
                        backgroundColor: syncToGoogle ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {syncToGoogle && <Check size={12} color="#ffffff" strokeWidth={4} />}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={syncToGoogle} 
                        onChange={e => setSyncToGoogle(e.target.checked)}
                        className="hidden"
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: syncToGoogle ? t.primary : t.textSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Globe size={14} /> Sincronizar com Google Agenda
                      </span>
                    </label>
                  )}
                </form>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: t.border, display: 'flex', gap: '0.75rem', backgroundColor: t.bgSecondary }}>
                {newEvent.isHoliday ? (
                  <button 
                    onClick={() => setShowModal(false)} 
                    style={{ 
                      flex: 1, height: '36px', backgroundColor: t.primary, color: '#ffffff',
                      border: 'none', borderRadius: '18px', fontWeight: 600, cursor: 'pointer',
                      fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = t.primaryDark || t.primary}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = t.primary}
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    {!isReadOnly ? (
                      <button 
                        form="eventForm" 
                        type="submit" 
                        disabled={saving} 
                        style={{ 
                          flex: 1, height: '36px', backgroundColor: t.primary, color: '#ffffff', 
                          border: 'none', borderRadius: '18px', fontWeight: 600, cursor: 'pointer', 
                          fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.primaryDark || t.primary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = t.primary}
                      >
                        {saving ? <Loader2 className="animate-spin m-auto" size={18} /> : 'Salvar'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIsReadOnly(false)} 
                        style={{ 
                          flex: 1, height: '36px', backgroundColor: 'transparent', color: t.primary,
                          border: t.borderBold, borderRadius: '18px', fontWeight: 600, cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        Editar
                      </button>
                    )}
                    {editingId && (
                      <button 
                        onClick={() => handleDelete(editingId)} 
                        style={{ 
                          width: '36px', height: '36px', backgroundColor: 'transparent', color: '#f28b82', 
                          border: `1px solid #fee2e2`, borderRadius: '50%', cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(242, 139, 130, 0.15)'; e.currentTarget.style.borderColor = '#f28b82'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Calendar;
