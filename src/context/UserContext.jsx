import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { db, auth, getTenantPath } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, limit, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';

const UserContext = createContext();

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'crm-ultra-secret-key-2026';

const decrypt = (val) => {
  if (!val || typeof val !== 'string') return val;
  try {
    const bytes = CryptoJS.AES.decrypt(val, SECRET_KEY);
    const original = bytes.toString(CryptoJS.enc.Utf8);
    return original || val;
  } catch (e) { return val; }
};

const PLAN_FEATURES = {
  'PDV': ['dashboard', 'deals', 'inventory', 'settings'],
  'Básico': ['dashboard', 'contacts', 'deals', 'inventory', 'calendar', 'tasks', 'partners', 'coupons', 'settings'],
  'Intermediário': ['dashboard', 'contacts', 'deals', 'inventory', 'calendar', 'tasks', 'partners', 'coupons', 'settings', 'ecommerce', 'documents', 'llm'],
  'Premium': ['dashboard', 'contacts', 'deals', 'inventory', 'calendar', 'tasks', 'partners', 'coupons', 'settings', 'ecommerce', 'documents', 'llm', 'automations', 'service', 'companies', 'reports'],
  'Personalizado': 'all' // Permite qualquer tela, validação apenas por permissão de usuário
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState(() => {
    return localStorage.getItem('activeCompany') || null;
  });
  const [subscription, setSubscription] = useState({ plano: 'Básico', status: 'Ativa' });
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    // A assinatura agora deve ser carregada após sabermos a empresa do usuário, 
    // mas se quisermos uma assinatura global, mantemos. 
    // O usuário disse: "empresa x antes dos dados", então assinatura deve ser por empresa.
    let unsubUserDoc = null;
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        if (unsubUserDoc) unsubUserDoc();
        unsubUserDoc = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const isActive = data.active === undefined || decrypt(data.active) === 'true' || data.active === true;

            if (!isActive) {
              signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

            const decryptedTelas = decrypt(data.telas);
            let decodedTelas = [];
            try {
              if (typeof decryptedTelas === 'string') {
                if (decryptedTelas.startsWith('[') || decryptedTelas.startsWith('{')) {
                  decodedTelas = JSON.parse(decryptedTelas);
                } else if (decryptedTelas.includes(',')) {
                  decodedTelas = decryptedTelas.split(',').map(t => t.trim());
                } else if (decryptedTelas) {
                  decodedTelas = [decryptedTelas];
                }
              } else if (Array.isArray(data.telas)) {
                decodedTelas = data.telas;
              }
            } catch (e) {
              decodedTelas = Array.isArray(data.telas) ? data.telas : [];
            }

            const empresaId = data.empresa || 'development';

            const requirePasswordChangeDecrypted = decrypt(data.requirePasswordChange) === 'true';
            let requirePasswordChange = requirePasswordChangeDecrypted;

            // Check if there was a temporary password and if they logged in with something else
            if (requirePasswordChange && data.temporaryPassword) {
              const tempPass = decrypt(data.temporaryPassword);
              const typedPass = sessionStorage.getItem('temp_login_pass');
              if (tempPass && tempPass !== '') {
                if (typedPass) {
                  if (typedPass !== tempPass) {
                    // Password was reset/changed via link!
                    requirePasswordChange = false;
                    // Update the Firestore document to clear the temporary requirement
                    const docRef = doc(db, 'users', authUser.uid);
                    updateDoc(docRef, {
                      requirePasswordChange: CryptoJS.AES.encrypt('false', SECRET_KEY).toString(),
                      temporaryPassword: ''
                    }).catch(err => console.error("Error updating requirePasswordChange:", err));
                  }
                  // Clear the temporary typed password from session storage
                  sessionStorage.removeItem('temp_login_pass');
                }
              }
            }
            
            setUser({
              id: authUser.uid,
              nome: data.nome,
              email: decrypt(data.email),
              funcao: decrypt(data.funcao),
              empresa: empresaId,
              allAccess: decrypt(data.allAccess) === 'true' || data.allAccess === true,
              requirePasswordChange: requirePasswordChange,
              telas: decodedTelas,
              theme: data.theme || 'clean',
              density: data.density || 100,
              createdAt: data.createdAt
            });
            if (!activeCompany) {
              setActiveCompany(empresaId);
              localStorage.setItem('activeCompany', empresaId);
            }
          } else {
            setUser({ id: authUser.uid, email: authUser.email, nome: authUser.email.split('@')[0], empresa: 'development', funcao: "admin", allAccess: true, telas: [] });
          }
          setLoading(false);
        });
      } else {
        if (unsubUserDoc) unsubUserDoc();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const targetCompany = activeCompany || user.empresa;
    const unsubSub = onSnapshot(doc(db, getTenantPath(targetCompany, 'company'), 'subscription'), (doc) => {
      if (doc.exists()) {
        const subData = doc.data();
        setSubscription({
          ...subData,
          plano: decrypt(subData.plano) || 'Básico',
          status: subData.status ? (decrypt(subData.status) || subData.status) : 'Ativa'
        });
      } else if (targetCompany === 'development') {
        setSubscription({ plano: 'Premium', status: 'Ativa' });
      } else {
        // Fallback para empresas sem documento de assinatura
        setSubscription({ plano: 'Básico', status: 'Ativa' });
      }
    });

    return () => unsubSub();
  }, [user, activeCompany]);

  useEffect(() => {
    if (!user) {
      setCompanyData(null);
      return;
    }
    
    const targetCompany = activeCompany || user.empresa;
    const companyDocRef = doc(db, 'business', targetCompany);
    
    let unsubCompany = null;
    
    let companyInfo = {
      nome: '',
      status: 'ativa',
      ambiente: 'homologacao',
      responsavel: '',
      responsavelEmail: '',
      responsavelTelefone: '',
      email: '',
      telefone: ''
    };

    const updateCompanyState = () => {
      setCompanyData({ ...companyInfo });
    };

    unsubCompany = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        companyInfo.nome = data.nome || '';
        companyInfo.status = data.status ? decrypt(data.status) : 'ativa';
        companyInfo.ambiente = data.ambiente ? decrypt(data.ambiente) : 'homologacao';
        companyInfo.email = data.email || '';
        companyInfo.telefone = data.telefone || '';
        companyInfo.responsavel = data.responsavel || '';

        // Asynchronously check and migrate old company documents
        (async () => {
          try {
            const companyDocRefOld = doc(db, `business/${targetCompany}/company`, 'company');
            const companySnapOld = await getDoc(companyDocRefOld);
            
            const aboutDocRefOld = doc(db, `business/${targetCompany}/company`, 'about');
            const aboutSnapOld = await getDoc(aboutDocRefOld);
            
            let oldData = {};
            let hasOldData = false;
            
            if (companySnapOld.exists()) {
              oldData = { ...oldData, ...companySnapOld.data() };
              hasOldData = true;
            }
            if (aboutSnapOld.exists()) {
              oldData = { ...oldData, ...aboutSnapOld.data() };
              hasOldData = true;
            }
            
            if (hasOldData) {
              console.log(`Migrating old company data for ${targetCompany}...`);
              const mergedData = { ...oldData, ...data };
              if (mergedData.ambiente && !String(mergedData.ambiente).startsWith('U2FsdGV')) {
                mergedData.ambiente = CryptoJS.AES.encrypt(String(mergedData.ambiente), SECRET_KEY).toString();
              }
              if (mergedData.status && !String(mergedData.status).startsWith('U2FsdGV')) {
                mergedData.status = CryptoJS.AES.encrypt(String(mergedData.status), SECRET_KEY).toString();
              }
              
              await setDoc(companyDocRef, mergedData, { merge: true });
              
              if (companySnapOld.exists()) {
                await deleteDoc(companyDocRefOld);
              }
              if (aboutSnapOld.exists()) {
                await deleteDoc(aboutDocRefOld);
              }
              console.log(`Migration completed for ${targetCompany}!`);
            }
          } catch (e) {
            console.error("Error migrating company subcollection data:", e);
          }
        })();
      } else {
        companyInfo.nome = targetCompany === 'development' ? 'DEVELOPMENT' : '';
        companyInfo.status = 'ativa';
        companyInfo.ambiente = 'homologacao';
      }
      updateCompanyState();
    });

    return () => {
      if (unsubCompany) unsubCompany();
    };
  }, [user, activeCompany]);

  const login = async (email, password) => {
    try {
      sessionStorage.setItem('temp_login_pass', password);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isActive = data.active === undefined || decrypt(data.active) === 'true' || data.active === true;
        if (!isActive) {
          await signOut(auth);
          sessionStorage.removeItem('temp_login_pass');
          return { success: false, error: 'Sua conta está desativada. Entre em contato com o suporte.' };
        }

        // Intercept logic for double password reset bug
        if (data.temporaryPassword) {
          const tempPass = decrypt(data.temporaryPassword);
          if (tempPass && tempPass !== '') {
            if (password === tempPass) {
              // Logged in with temporary password: keep requirePasswordChange as 'true'
              await updateDoc(docRef, {
                requirePasswordChange: CryptoJS.AES.encrypt('true', SECRET_KEY).toString()
              });
            } else {
              // Logged in with a redefined/changed password: clear requirement and temp password
              await updateDoc(docRef, {
                requirePasswordChange: CryptoJS.AES.encrypt('false', SECRET_KEY).toString(),
                temporaryPassword: ''
              });
            }
          }
        }
      }
      return { success: true };
    } catch (e) {
      console.error("Login Error:", e);
      sessionStorage.removeItem('temp_login_pass');
      return { success: false, error: e.message };
    }
  };

  const addLog = async (action) => {
    if (!user) return;
    try {
      await addDoc(collection(db, getTenantPath(user.empresa, 'company/about/userlogs')), {
        userId: user.id,
        userName: user.nome,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (e) { console.error("Log error:", e); }
  };

  const logout = async () => {
    if (user) await addLog('saiu do sistema');
    await signOut(auth);
    localStorage.removeItem('activeCompany');
    sessionStorage.removeItem('session_logged');
    window.location.href = './';
  };

  useEffect(() => {
    if (user && !loading) {
      // Check if we already logged this session to avoid duplicates on re-renders
      const sessionLogged = sessionStorage.getItem('session_logged');
      if (!sessionLogged) {
        addLog('acessou o sistema');
        sessionStorage.setItem('session_logged', 'true');
      }
    }
  }, [user, loading]);

  const hasPlanAccess = (screenId) => {
    if (!user) return false;
    // Central de Ajuda é acessível em todos os planos
    if (screenId === 'help') return true;
    
    // Se estiver na empresa 'development', tem acesso total a tudo
    if (activeCompany === 'development' || (user.empresa === 'development' && activeCompany === 'development')) return true;
    
    const currentPlan = subscription?.plano || 'Básico';
    if (currentPlan === 'Personalizado') {
      const allowedScreens = subscription?.telas || [];
      return allowedScreens.includes(screenId);
    }
    
    const allowedScreens = PLAN_FEATURES[currentPlan] || [];
    return allowedScreens.includes(screenId);
  };

  const hasPermission = (screenId) => {
    if (!user) return false;
    // Central de Ajuda é permitida para todos
    if (screenId === 'help') return true;
    
    // Se estiver na empresa 'development' e for admin/dev, tem acesso total
    if ((activeCompany === 'development' || user.empresa === 'development') && (user.funcao === 'developer' || user.funcao === 'admin')) return true;

    // Caso tenha a flag de acesso total
    if (user.allAccess === true) return true;

    // Caso contrário, valida se a tela está na lista permitida
    return user.telas && user.telas.includes(screenId);
  };

  const switchCompany = (companyId) => {
    if (user?.funcao === 'developer' || user?.empresa === 'development') {
      setActiveCompany(companyId);
      localStorage.setItem('activeCompany', companyId);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      loading, 
      subscription, 
      companyData,
      activeCompany,
      switchCompany,
      hasPlanAccess, 
      hasPermission, 
      addLog, 
      logout, 
      login,
      getTenantCollection: (name) => collection(db, getTenantPath(activeCompany || user?.empresa || 'development', name)),
      getTenantDoc: (name, id) => doc(db, getTenantPath(activeCompany || user?.empresa || 'development', name), id)
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
