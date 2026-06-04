import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useUser } from './UserContext';
import { decryptData } from '../utils/crypto';

const ThemeContext = createContext();

export const themes = {
  clean: {
    border: '1px solid #e2e8f0',
    borderBold: '1px solid #e2e8f0',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    shadowLarge: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    shadowSmall: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#2563eb',
    accentSoft: '#eff6ff',
    accentContrast: '#fff',
    bg: '#fff',
    bgSecondary: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#64748b',
    headerBg: 'transparent',
    headerText: '#0f172a',
    weight: '900',
    tabBg: '#f1f5f9',
    tabActiveBg: '#fff',
    tabText: '#64748b',
    tabActiveText: '#2563eb',
    inputBg: '#fff',
    inputDisabledBg: '#f8fafc',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#2563eb',
    primaryLight: '#eff6ff',
    muted: '#64748b',
    card: '#ffffff',
    surface: '#ffffff',
    textLight: '#64748b',
    textMain: '#0f172a',
    background: '#f8fafc',
    bgMain: '#f8fafc',
    bgCard: '#ffffff',
    danger: '#ef4444',
    dangerSoft: '#fef2f2',
    success: '#10b981',
    successSoft: '#f0fdf4',
    accentLight: '#FFE600',
    radiusInner: '16px',
    shadowHover: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -6px rgba(0, 0, 0, 0.1)'
  },
  dark: {
    border: '1px solid #2e303a',
    borderBold: '1px solid #3f3f46',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
    shadowLarge: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    shadowSmall: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139, 92, 246, 0.1)',
    accentContrast: '#fff',
    bg: '#16171d',
    bgSecondary: '#0f1014',
    text: '#f3f4f6',
    textSecondary: '#9ca3af',
    headerBg: 'transparent',
    headerText: '#f3f4f6',
    weight: '900',
    tabBg: '#1f2028',
    tabActiveBg: '#2e303a',
    tabText: '#9ca3af',
    tabActiveText: '#c084fc',
    inputBg: '#1f2028',
    inputDisabledBg: '#0f1014',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#8b5cf6',
    primaryLight: 'rgba(139, 92, 246, 0.1)',
    muted: '#9ca3af',
    card: '#16171d',
    surface: '#16171d',
    textLight: '#9ca3af',
    textMain: '#f3f4f6',
    background: '#0f1014',
    bgMain: '#0f1014',
    bgCard: '#16171d',
    danger: '#f87171',
    dangerSoft: 'rgba(248, 113, 113, 0.1)',
    success: '#34d399',
    successSoft: 'rgba(52, 211, 153, 0.1)',
    accentLight: '#fbbf24',
    radiusInner: '16px',
    shadowHover: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -6px rgba(0, 0, 0, 0.2)'
  },
  dim: {
    border: '1px solid #38444d',
    borderBold: '1px solid #425364',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    shadowLarge: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
    shadowSmall: '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#1d9bf0',
    accentSoft: 'rgba(29, 155, 240, 0.1)',
    accentContrast: '#fff',
    bg: '#1c2938',
    bgSecondary: '#15202b',
    text: '#ffffff',
    textSecondary: '#8899a6',
    headerBg: 'transparent',
    headerText: '#fff',
    weight: '900',
    tabBg: '#192734',
    tabActiveBg: '#1d9bf0',
    tabText: '#8899a6',
    tabActiveText: '#fff',
    inputBg: '#192734',
    inputDisabledBg: '#15202b',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#1d9bf0',
    primaryLight: 'rgba(29, 155, 240, 0.1)',
    muted: '#8899a6',
    card: '#1c2938',
    surface: '#1c2938',
    textLight: '#8899a6',
    textMain: '#ffffff',
    background: '#15202b',
    bgMain: '#15202b',
    bgCard: '#1c2938',
    danger: '#f4212e',
    dangerSoft: 'rgba(244, 33, 46, 0.1)',
    success: '#00ba7c',
    successSoft: 'rgba(0, 186, 124, 0.1)',
    accentLight: '#1d9bf0',
    radiusInner: '16px',
    shadowHover: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
  },
  midnight: {
    border: '1px solid #1f1f1f',
    borderBold: '1px solid #333',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.6)',
    shadowLarge: '0 20px 25px -5px rgba(0, 0, 0, 0.8)',
    shadowSmall: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#3b82f6',
    accentSoft: 'rgba(59, 130, 246, 0.1)',
    accentContrast: '#fff',
    bg: '#0a0a0a',
    bgSecondary: '#000000',
    text: '#e2e8f0',
    textSecondary: '#64748b',
    headerBg: 'transparent',
    headerText: '#e2e8f0',
    weight: '900',
    tabBg: '#0f0f0f',
    tabActiveBg: '#1f1f1f',
    tabText: '#64748b',
    tabActiveText: '#3b82f6',
    inputBg: '#0f0f0f',
    inputDisabledBg: '#000000',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#3b82f6',
    primaryLight: 'rgba(59, 130, 246, 0.1)',
    muted: '#64748b',
    card: '#0a0a0a',
    surface: '#0a0a0a',
    textLight: '#64748b',
    textMain: '#e2e8f0',
    background: '#000000',
    bgMain: '#000000',
    bgCard: '#0a0a0a',
    danger: '#ef4444',
    dangerSoft: 'rgba(239, 68, 68, 0.1)',
    success: '#10b981',
    successSoft: 'rgba(16, 185, 129, 0.1)',
    accentLight: '#60a5fa',
    radiusInner: '16px',
    shadowHover: '0 20px 25px -5px rgba(0, 0, 0, 0.7)'
  },
  highContrast: {
    border: '2px solid #ffffff',
    borderBold: '3px solid #ffffff',
    shadow: 'none',
    shadowLarge: 'none',
    shadowSmall: 'none',
    radius: '0px',
    radiusMedium: '0px',
    radiusSmall: '0px',
    accent: '#ffff00',
    accentSoft: 'rgba(255, 255, 0, 0.2)',
    accentContrast: '#000',
    bg: '#000000',
    bgSecondary: '#000000',
    text: '#ffffff',
    textSecondary: '#ffff00',
    headerBg: '#000',
    headerText: '#fff',
    weight: '900',
    tabBg: '#000',
    tabActiveBg: '#ffff00',
    tabText: '#fff',
    tabActiveText: '#000',
    inputBg: '#000',
    inputDisabledBg: '#333',
    transition: 'none',
    primary: '#ffff00',
    primaryLight: 'rgba(255, 255, 0, 0.2)',
    muted: '#ffffff',
    card: '#000000',
    surface: '#000000',
    textLight: '#ffffff',
    textMain: '#ffffff',
    background: '#000000',
    bgMain: '#000000',
    bgCard: '#000000',
    danger: '#ff0000',
    dangerSoft: '#000',
    success: '#00ff00',
    successSoft: '#000',
    accentLight: '#ffff00',
    radiusInner: '0px',
    shadowHover: 'none'
  },
  clear: {
    border: '1px solid #d0d7de',
    borderBold: '1px solid #8c959f',
    shadow: '0 8px 24px rgba(140, 149, 159, 0.12)',
    shadowLarge: '0 16px 48px rgba(140, 149, 159, 0.2)',
    shadowSmall: '0 3px 6px rgba(140, 149, 159, 0.08)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#0969da',
    accentSoft: '#eff6ff',
    accentContrast: '#fff',
    bg: '#ffffff',
    bgSecondary: '#f6f8fa',
    text: '#1f2328',
    textSecondary: '#57606a',
    headerBg: 'transparent',
    headerText: '#1f2328',
    weight: '900',
    tabBg: '#f3f4f6',
    tabActiveBg: '#ffffff',
    tabText: '#57606a',
    tabActiveText: '#0969da',
    inputBg: '#ffffff',
    inputDisabledBg: '#f6f8fa',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#0969da',
    primaryLight: '#eff6ff',
    muted: '#57606a',
    card: '#ffffff',
    surface: '#ffffff',
    textLight: '#57606a',
    textMain: '#1f2328',
    background: '#f6f8fa',
    bgMain: '#f6f8fa',
    bgCard: '#ffffff',
    danger: '#cf222e',
    dangerSoft: '#ffebe9',
    success: '#1a7f37',
    successSoft: '#dafbe1',
    accentLight: '#0969da',
    radiusInner: '16px',
    shadowHover: '0 12px 32px rgba(140, 149, 159, 0.16)'
  },
  beige: {
    border: '1px solid #E6DBC9',
    borderBold: '1px solid #D6C7B1',
    shadow: '0 8px 24px rgba(141, 128, 117, 0.1)',
    shadowLarge: '0 16px 48px rgba(141, 128, 117, 0.15)',
    shadowSmall: '0 3px 6px rgba(141, 128, 117, 0.06)',
    radius: '32px',
    radiusMedium: '16px',
    radiusSmall: '12px',
    accent: '#B5825D',
    accentSoft: '#FAF3E8',
    accentContrast: '#fff',
    bg: '#FAF6EF',
    bgSecondary: '#F3EDE2',
    text: '#3E352F',
    textSecondary: '#8D8075',
    headerBg: 'transparent',
    headerText: '#3E352F',
    weight: '900',
    tabBg: '#EDE5D8',
    tabActiveBg: '#FAF6EF',
    tabText: '#8D8075',
    tabActiveText: '#B5825D',
    inputBg: '#FAF6EF',
    inputDisabledBg: '#F3EDE2',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    primary: '#B5825D',
    primaryLight: '#FAF3E8',
    muted: '#8D8075',
    card: '#FAF6EF',
    surface: '#FAF6EF',
    textLight: '#8D8075',
    textMain: '#3E352F',
    background: '#F3EDE2',
    bgMain: '#F3EDE2',
    bgCard: '#FAF6EF',
    danger: '#C05C55',
    dangerSoft: '#FBF1EF',
    success: '#6A8D73',
    successSoft: '#F2F6F3',
    accentLight: '#B5825D',
    radiusInner: '16px',
    shadowHover: '0 12px 32px rgba(141, 128, 117, 0.12)'
  },
  highContrastLight: {
    border: '2px solid #000000',
    borderBold: '3px solid #000000',
    shadow: 'none',
    shadowLarge: 'none',
    shadowSmall: 'none',
    radius: '0px',
    radiusMedium: '0px',
    radiusSmall: '0px',
    accent: '#000000',
    accentSoft: '#E5E5FF',
    accentContrast: '#FFFFFF',
    bg: '#FFFFFF',
    bgSecondary: '#FFFFFF',
    text: '#000000',
    textSecondary: '#000000',
    headerBg: 'transparent',
    headerText: '#000000',
    weight: '900',
    tabBg: '#FFFFFF',
    tabActiveBg: '#000000',
    tabText: '#000000',
    tabActiveText: '#FFFFFF',
    inputBg: '#FFFFFF',
    inputDisabledBg: '#CCCCCC',
    transition: 'none',
    primary: '#000000',
    primaryLight: '#E5E5FF',
    muted: '#000000',
    card: '#FFFFFF',
    surface: '#FFFFFF',
    textLight: '#000000',
    textMain: '#000000',
    background: '#FFFFFF',
    bgMain: '#FFFFFF',
    bgCard: '#FFFFFF',
    danger: '#FF0000',
    dangerSoft: '#FFE5E5',
    success: '#008000',
    successSoft: '#E5FFE5',
    accentLight: '#0000FF',
    radiusInner: '0px',
    shadowHover: 'none'
  }
};

export const ThemeProvider = ({ children }) => {
  const [company, setCompany] = useState({
    nome: '', nomeFantasia: '', cnpj: '', ie: '', cep: '',
    logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', telefone: '', logoUrl: '',
    tema: 'clean'
  });
  const [loading, setLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('crmTheme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'clean';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [density, setDensityState] = useState(100);
  const [viewSettings, setViewSettingsState] = useState(() => {
    const saved = localStorage.getItem('crmViewSettings');
    return saved ? JSON.parse(saved) : { inventory: 'grid', contacts: 'grid', tasks: 'list', coupons: 'grid', partners: 'grid', deals: 'list', dealsLegacy: 'list' };
  });

  const setViewSettings = (module, mode) => {
    setViewSettingsState(prev => {
      const next = { ...prev, [module]: mode };
      localStorage.setItem('crmViewSettings', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user, activeCompany, getTenantDoc } = useUser();
  const targetCompany = activeCompany || user?.empresa;

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('crmTheme')) {
        setCurrentTheme(e.matches ? 'dark' : 'clean');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!targetCompany) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'business', targetCompany), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompany({
          ...data,
          ambiente: data.ambiente ? (decryptData(data.ambiente) || 'homologacao') : 'homologacao',
          status: data.status ? (decryptData(data.status) || 'ativa') : 'ativa'
        });
        if (data.tema && themes[data.tema] && !localStorage.getItem('crmTheme')) {
          setCurrentTheme(data.tema);
        }
      } else if (targetCompany === 'development') {
        // Fallback para desenvolvimento
        setCompany({ nome: 'CRM MASTER', tema: 'clean' });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [targetCompany]);

  const t = useMemo(() => {
    const baseTheme = themes[currentTheme] || themes.clean;
    
    return {
      ...baseTheme,
      radius: '32px',
      radiusMedium: '16px',
      radiusSmall: '12px',
      radiusInner: '16px',
      scale: 1
    };
  }, [currentTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', t.accent);
    root.style.setProperty('--bg-main', t.bgSecondary);
    root.style.setProperty('--bg-card', t.bg);
    root.style.setProperty('--text-main', t.text);
    root.style.setProperty('--text-muted', t.textSecondary);
    root.style.setProperty('--border', t.border.split(' ')[2]);
    
    // Ajustes específicos da sidebar por tema
    if (currentTheme === 'dark') {
      root.style.setProperty('--sidebar-bg', '#09090b');
      root.style.setProperty('--sidebar-hover-bg', '#27272a');
      root.style.setProperty('--sidebar-text', '#9ca3af');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', t.accent);
    } else if (currentTheme === 'dim') {
      root.style.setProperty('--sidebar-bg', '#15202b');
      root.style.setProperty('--sidebar-hover-bg', '#2c3d52');
      root.style.setProperty('--sidebar-text', '#8899a6');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', t.accent);
    } else if (currentTheme === 'midnight') {
      root.style.setProperty('--sidebar-bg', '#000000');
      root.style.setProperty('--sidebar-hover-bg', '#262626');
      root.style.setProperty('--sidebar-text', '#64748b');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', t.accent);
    } else if (currentTheme === 'highContrast') {
      root.style.setProperty('--sidebar-bg', '#000000');
      root.style.setProperty('--sidebar-hover-bg', '#333333');
      root.style.setProperty('--sidebar-text', '#ffffff');
      root.style.setProperty('--sidebar-text-active', '#ffff00');
      root.style.setProperty('--sidebar-active-bg', 'rgba(255,255,0,0.2)');
    } else if (currentTheme === 'clear') {
      root.style.setProperty('--sidebar-bg', '#f8fafc');
      root.style.setProperty('--sidebar-hover-bg', '#e2e8f0');
      root.style.setProperty('--sidebar-text', '#64748b');
      root.style.setProperty('--sidebar-text-active', '#0969da');
      root.style.setProperty('--sidebar-active-bg', 'rgba(9,105,218,0.1)');
    } else if (currentTheme === 'beige') {
      root.style.setProperty('--sidebar-bg', '#2a221e');
      root.style.setProperty('--sidebar-hover-bg', '#4a3e37');
      root.style.setProperty('--sidebar-text', '#b8a99e');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', t.accent);
    } else if (currentTheme === 'highContrastLight') {
      root.style.setProperty('--sidebar-bg', '#ffffff');
      root.style.setProperty('--sidebar-hover-bg', '#000000');
      root.style.setProperty('--sidebar-text', '#000000');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', '#000000');
    } else {
      root.style.setProperty('--sidebar-bg', '#020617');
      root.style.setProperty('--sidebar-hover-bg', 'rgba(255, 255, 255, 0.09)');
      root.style.setProperty('--sidebar-text', '#94a3b8');
      root.style.setProperty('--sidebar-text-active', '#ffffff');
      root.style.setProperty('--sidebar-active-bg', t.accent);
    }
    
    root.style.setProperty('--radius-lg', '20px');
    root.style.setProperty('--radius-md', '14px');
    // sidebar-scale mantido para compat, mas sem zoom real na sidebar
    root.style.setProperty('--sidebar-scale', '1');
  }, [t, currentTheme]);

  const setDensity = async (value) => {
    // Zoom/Density purged. Always 100.
    setDensityState(100);
  };

  const setTheme = async (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
      localStorage.setItem('crmTheme', themeName);
      
      // Persistir no Firestore se houver usuário logado
      if (user?.id) {
        try {
          await updateDoc(doc(db, 'users', user.id), {
            theme: themeName
          });
        } catch (e) {
          console.error('Erro ao salvar tema no Firestore:', e);
        }
      }
    }
  };

  // Sincronizar tema do usuário logado
  useEffect(() => {
    if (user?.theme && user.theme !== currentTheme) {
      setCurrentTheme(user.theme);
      localStorage.setItem('crmTheme', user.theme);
    }
  }, [user?.theme]);

  return (
    <ThemeContext.Provider value={{ t, company, themes, loading, currentTheme, setTheme, isMobile, density, setDensity, viewSettings, setViewSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
