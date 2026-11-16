import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Interaction, AuditConfig, UserSession } from './types';
import { nextActiveCallId } from './utils/callSelection';
import DashboardGeral from './components/DashboardGeral';
import AnalisesAuditoria from './components/AnalisesAuditoria';
import ConfigMetodologia from './components/ConfigMetodologia';
import DataChat from './components/DataChat';
import HubIntegracoes from './components/HubIntegracoes';
import GestaoBPOs from './components/GestaoBPOs';
import GestaoAcessos from './components/GestaoAcessos';
import AdesaoScript from './components/AdesaoScript';
import GestaoTenants from './components/GestaoTenants';
import SaasMasterDashboard from './components/SaasMasterDashboard';
import { 
  Building2, 
  BarChart3, 
  SlidersHorizontal, 
  Bot, 
  Database,
  RefreshCw,
  Sparkles,
  Lock,
  Compass,
  LogIn,
  Mail,
  Key,
  LogOut,
  UserCheck,
  AlertTriangle,
  Info,
  Users,
  Award,
  Menu,
  X,
  ShieldCheck,
  Settings,
  Globe,
  MessageSquare
} from 'lucide-react';
import GeminiConfig from './components/GeminiConfig';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'saas_master' | 'dashboard' | 'analises' | 'ingestao' | 'metodologia' | 'chat' | 'bpos' | 'adesao' | 'acessos' | 'configuracoes'>('saas_master');
  const [configSubTab, setConfigSubTab] = useState<'ia' | 'acessos' | 'integracoes' | 'tenants'>('ia');
  const [selectedTenantForAI, setSelectedTenantForAI] = useState<string>('system-global');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Real full-stack state pulled from Node.js backend
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [auditConfig, setAuditConfig] = useState<AuditConfig | null>(null);
  const [bpos, setBpos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Authentication & session states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loggedInUser, setLoggedInUser] = useState<{ email: string; role: 'admin' | 'bpo'; bpoName: string | null } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // RBAC standard session
  const [session, setSession] = useState<UserSession>({
    role: 'admin',
    bpoName: null
  });

  const [resetting, setResetting] = useState(false);

  // --- Custom sandboxed overlay states to avoid window.alert and window.confirm ---
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Sync interactions from server
  const fetchInteractions = async (bpoToFetch?: string | null, tenantIdToFetch?: string | null, emailToFetch?: string | null) => {
    try {
      const tid = tenantIdToFetch || loggedInUser?.tenantId || session.tenantId || 'system-global';
      const email = emailToFetch || loggedInUser?.email || session.userEmail || '';
      let url = `/api/interactions?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`;
      const bpo = bpoToFetch !== undefined ? bpoToFetch : session.bpoName;
      if (bpo && bpo !== 'all') {
        url += `&bpoName=${encodeURIComponent(bpo)}`;
      }
      
      const res = await fetch(url, {
        headers: {
          'x-tenant-id': encodeURIComponent(tid),
          'x-user-email': encodeURIComponent(email)
        }
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data)) {
            setInteractions(data);
            setActiveCallId((previousId) => nextActiveCallId(previousId, data));
          }
        }
      }
    } catch (err) {
      console.warn("Sincronização temporária de atendimentos com o servidor:", err);
    }
  };

  // Sync config from server
  const fetchConfig = async (tenantIdToFetch?: string | null, emailToFetch?: string | null) => {
    try {
      const tid = tenantIdToFetch || loggedInUser?.tenantId || session.tenantId || 'system-global';
      const email = emailToFetch || loggedInUser?.email || session.userEmail || '';
      const res = await fetch(`/api/config?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, {
        headers: {
          'x-tenant-id': tid
        }
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json().catch(() => null);
          if (data) setAuditConfig(data);
        }
      }
    } catch (err) {
      console.warn("Falha ao baixar metodologias do servidor:", err);
    }
  };

  // Sync BPOs list from server
  const fetchBpos = async (tenantIdToFetch?: string | null) => {
    try {
      const tid = tenantIdToFetch || loggedInUser?.tenantId || session.tenantId || 'system-global';
      const res = await fetch(`/api/bpos?tenantId=${encodeURIComponent(tid)}`, {
        headers: {
          'x-tenant-id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBpos(data);
      }
    } catch (err) {
      console.error("Erro ao buscar parceiros BPO no servidor.", err);
    }
  };

  // Check for saved session on mount and load lists if verified
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const saved = localStorage.getItem('auditaqa_user_session');
      if (saved) {
        try {
          JSON.parse(saved);
          const sessionResponse = await fetch('/api/session');
          if (!sessionResponse.ok) throw new Error('Sessão expirada');
          const { user: parsed } = await sessionResponse.json();
          setLoggedInUser(parsed);
          setIsAuthenticated(true);
          const currentSess: UserSession = { 
            role: parsed.role, 
            bpoName: parsed.bpoName,
            tenantId: parsed.tenantId || 'system-global' 
          };
          setSession(currentSess);
          if (parsed.role === 'superadmin') {
            setActiveTab('saas_master');
            setConfigSubTab('tenants');
          } else {
            setActiveTab('dashboard');
            setConfigSubTab('acessos');
          }
          
          await Promise.all([
            fetchInteractions(parsed.bpoName, parsed.tenantId, parsed.email),
            fetchConfig(parsed.tenantId, parsed.email),
            fetchBpos(parsed.tenantId)
          ]);
        } catch (e) {
          localStorage.removeItem('auditaqa_user_session');
        }
      }
      // Sem sessão: nao chamar endpoints autenticados aqui (gerava 401 no console
      // antes do login). BPOs/config/interactions sao carregados apos autenticar.
      setLoading(false);
    };
    init();
  }, []);

  // Listen for global BPO or Tenant updates to refresh dropdowns and state in real-time
  useEffect(() => {
    const handleSync = () => {
      const activeTenantId = loggedInUser?.tenantId || session.tenantId || 'system-global';
      fetchBpos(activeTenantId);
      fetchInteractions(session.bpoName, activeTenantId, loggedInUser?.email);
    };
    window.addEventListener('bposUpdated', handleSync);
    window.addEventListener('tenantsUpdated', handleSync);
    return () => {
      window.removeEventListener('bposUpdated', handleSync);
      window.removeEventListener('tenantsUpdated', handleSync);
    };
  }, [loggedInUser, session]);

  // Periodic background refresh to pull newly captured and audited cases in real-time
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      const activeTenantId = loggedInUser?.tenantId || session.tenantId || 'system-global';
      fetchInteractions(session.bpoName, activeTenantId, loggedInUser?.email);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loggedInUser, session]);

  // Prevent background scroll when AI Data Chat is open
  useEffect(() => {
    if (isChatOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isChatOpen]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLoggedInUser(data.user);
        setIsAuthenticated(true);
        const newSessionObj: UserSession = { 
          role: data.user.role, 
          bpoName: data.user.bpoName,
          tenantId: data.user.tenantId || 'system-global'
        };
        setSession(newSessionObj);
        localStorage.setItem('auditaqa_user_session', JSON.stringify(data.user));
        if (data.user.role === 'superadmin') {
          setActiveTab('saas_master');
          setConfigSubTab('tenants');
        } else {
          setActiveTab('dashboard');
          setConfigSubTab('acessos');
        }

        // Fetch data based on logged in user's privilege immediately
        setLoading(true);
        await Promise.all([
          fetchInteractions(data.user.bpoName, data.user.tenantId, data.user.email),
          fetchConfig(data.user.tenantId, data.user.email),
          fetchBpos(data.user.tenantId)
        ]);
        setLoading(false);
      } else {
        setLoginError(data.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      setLoginError("Não foi possível conectar ao servidor local. Verifique se o sistema está em execução (INSTALAR.bat ou INICIAR.bat) e tente novamente.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = () => {
    void fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('auditaqa_user_session');
    setLoggedInUser(null);
    setIsAuthenticated(false);
    setSession({ role: 'admin', bpoName: null, tenantId: 'system-global' });
    setAuditConfig(null);
    setInteractions([]);
    setActiveCallId(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setActiveTab('dashboard');
  };

  // Reset database state
  const handleResetDatabase = async () => {
    setConfirmModal({
      title: "Redefinir Banco de Dados",
      message: "Deseja redefinir todo o banco de dados do SaaS, restaurando as interações, BPOs padrão e excluindo os usuários cadastrados secundários?",
      onConfirm: async () => {
        setResetting(true);
        try {
          const res = await fetch('/api/interactions/clear', { method: 'POST' });
          if (res.ok) {
            await Promise.all([fetchInteractions(), fetchBpos()]);
            setAlertModal({
              title: "Banco Redefinido",
              message: "O banco de dados do SaaS foi restaurado com sucesso para os dados padrão iniciais."
            });
          }
        } catch (err) {
          console.error(err);
        } finally {
          setResetting(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleSelectCall = (call: Interaction) => {
    setActiveCallId(call.id);
  };

  const handleDeleteCall = async (id: string) => {
    setConfirmModal({
      title: "Excluir Atendimento Auditado",
      message: `Tem certeza absoluta de que deseja excluir permanentemente o atendimento com ID ${id} da base de dados e do histórico? Esta ação é irreversível e atualizará todos os indicadores.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/interactions/${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setInteractions(prev => prev.filter(item => item.id !== id));
            if (activeCallId === id) {
              setActiveCallId(null);
            }
            setAlertModal({
              title: "Atendimento Removido",
              message: "O atendimento selecionado foi excluído com sucesso do seu banco de dados."
            });
          } else {
            const data = await res.json();
            setAlertModal({
              title: "Erro ao Excluir",
              message: data.error || "Houve uma falha ao tentar remover o registro."
            });
          }
        } catch (err) {
          console.error("Erro ao deletar atendimento:", err);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Callback when uploader processes a batch
  const handleNewProcessedItems = (newItems: Interaction[]) => {
    setInteractions(prev => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setActiveCallId(newItems[0].id);
    }
    setActiveTab('analises');
  };

  // Callback for Genesys / Hub Integracoes sync
  const handleGenesysSyncComplete = async (syncedItems: Interaction[]) => {
    const targetBpo = syncedItems && syncedItems.length > 0 ? syncedItems[0].bpoName : session.bpoName;
    const tid = loggedInUser?.tenantId || session.tenantId || 'system-global';
    const email = loggedInUser?.email || session.userEmail || '';
    
    await fetchInteractions(targetBpo, tid, email);
    if (syncedItems && syncedItems.length > 0) {
      setActiveCallId(syncedItems[0].id);
    }
    setActiveTab('analises');
  };

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-650 mb-3"></div>
        <p className="text-xs font-mono text-slate-400">Restaurando sessão segura...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        loginSubmitting={loginSubmitting}
        handleLoginSubmit={handleLoginSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-800">
      
      {/* 1. LEFT SIDEBAR (only visible on desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 justify-between z-40">
        
        {/* Sidebar Header with Brand */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold font-mono tracking-tighter text-sm shrink-0 shadow-xs">
              QA
            </div>
            <h1 className="text-md font-bold tracking-tight text-slate-900 font-sans">
              AUDITA<span className="font-light opacity-50 underline text-indigo-600">QA</span>
            </h1>
          </div>
        </div>

        {/* Sidebar Navigation items */}
        <div className="flex-1 py-5 px-3.5 space-y-1 overflow-y-auto">
          {loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin' ? (
            <>
              {/* MASTER 1. VISÃO GERAL SAAS */}
              <button
                onClick={() => setActiveTab('saas_master')}
                className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                  activeTab === 'saas_master'
                    ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                <span>Visão Geral Master SaaS</span>
              </button>

              {/* MASTER 2. CONFIGURAÇÕES (Hub Multissistemas, Tenants, Acessos e IA) */}
              <button
                onClick={() => {
                  setActiveTab('configuracoes');
                  setConfigSubTab('acessos');
                }}
                className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                  activeTab === 'configuracoes'
                    ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>Configurações</span>
              </button>
            </>
          ) : (
            <>
              {/* 1. DASHBOARD */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span>Dashboard</span>
              </button>

              {/* 2. METODOLOGIA */}
              {session.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('metodologia')}
                  className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                    activeTab === 'metodologia'
                      ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Metodologia</span>
                </button>
              )}

              {/* 3. AUDITORIA */}
              <button
                onClick={() => setActiveTab('analises')}
                className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                  activeTab === 'analises'
                    ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Compass className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                <span>Auditoria</span>
              </button>

              {/* 6. RESUMO */}
              <button
                onClick={() => setActiveTab('adesao')}
                className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                  activeTab === 'adesao'
                    ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span>Resumo</span>
              </button>

              {/* 7. CONFIGURAÇÕES */}
              {session.role === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab('configuracoes');
                    setConfigSubTab('acessos');
                  }}
                  className={`w-full py-2 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                    activeTab === 'configuracoes'
                      ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span>Configurações</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="mb-3.5">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Usuário Autenticado:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-slate-700 truncate max-w-[130px] block">{loggedInUser?.email}</span>
              <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold font-mono uppercase shrink-0 ${
                loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin' 
                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                  : loggedInUser?.role === 'admin' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin' ? 'SaaS Super' : loggedInUser?.role === 'admin' ? 'Master' : 'BPO'}
              </span>
            </div>
            {loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin' ? (
              <span className="block text-[10px] font-bold text-purple-600 truncate mt-1">🌐 Painel Global de Tenants</span>
            ) : (
              <span className="block text-[10px] font-bold text-emerald-700 truncate mt-1">🏢 Tenant: {loggedInUser?.tenantId || '-'}</span>
            )}
            {loggedInUser?.bpoName && (
              <span className="block text-[10px] text-slate-400 truncate mt-0.5">Parceira: {loggedInUser.bpoName}</span>
            )}
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>

      </aside>

      {/* 2. MOBILE TOP HEADER (only visible on mobile/tablet) */}
      <header className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 text-slate-655 hover:bg-slate-50 rounded transition-all focus:outline-none cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5 animate-pulse" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center text-white font-bold font-mono tracking-tighter text-xs">
              QA
            </div>
            <span className="text-xs font-bold text-slate-900 tracking-wider">
              AUDITA<span className="text-indigo-600 font-light">QA</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded uppercase">
            {loggedInUser?.role === 'admin' ? 'Admin' : 'BPO'}
          </span>
          <button
            onClick={handleLogout}
            className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 text-[10px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      </header>

      {/* 3. MOBILE SIDEBAR DRAWER (slide-in overlay) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 cursor-pointer"
            />
            
            {/* Drawer Sheet */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="lg:hidden fixed top-0 bottom-0 left-0 w-72 bg-white border-r border-slate-200 z-55 flex flex-col justify-between"
            >
              <div>
                {/* Header inside Mobile Drawer */}
                <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center text-white font-bold font-mono tracking-tighter text-xs">
                      QA
                    </div>
                    <span className="text-xs font-bold text-slate-900 tracking-wider">
                      AUDITA<span className="text-indigo-600 font-light">QA</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-55 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Navigation List */}
                <div className="py-4 px-3 space-y-1 overflow-y-auto">
                  {loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin' ? (
                    <>
                      {/* MASTER 1. VISÃO GERAL SAAS */}
                      <button
                        onClick={() => {
                          setActiveTab('saas_master');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                          activeTab === 'saas_master'
                            ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        <span>Visão Geral Master SaaS</span>
                      </button>

                      {/* MASTER 2. CONFIGURAÇÕES (Hub Multissistemas, Tenants, Acessos e IA) */}
                      <button
                        onClick={() => {
                          setActiveTab('configuracoes');
                          setConfigSubTab('acessos');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                          activeTab === 'configuracoes'
                            ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>Configurações</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 1. DASHBOARD */}
                      <button
                        onClick={() => {
                          setActiveTab('dashboard');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                          activeTab === 'dashboard'
                            ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                        <span>Dashboard</span>
                      </button>

                      {/* 2. METODOLOGIA */}
                      {session.role === 'admin' && (
                        <button
                          onClick={() => {
                            setActiveTab('metodologia');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                            activeTab === 'metodologia'
                              ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                          <span>Metodologia</span>
                        </button>
                      )}

                      {/* 3. AUDITORIA */}
                      <button
                        onClick={() => {
                          setActiveTab('analises');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                          activeTab === 'analises'
                            ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        <span>Auditoria</span>
                      </button>

                      {/* 6. RESUMO */}
                      <button
                        onClick={() => {
                          setActiveTab('adesao');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                          activeTab === 'adesao'
                            ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>Resumo</span>
                      </button>

                      {/* 7. CONFIGURAÇÕES */}
                      {session.role === 'admin' && (
                        <button
                          onClick={() => {
                            setActiveTab('configuracoes');
                            setIsMobileMenuOpen(false);
                            setConfigSubTab('acessos');
                          }}
                          className={`w-full py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-3 rounded transition-all border-l-2 cursor-pointer ${
                            activeTab === 'configuracoes'
                              ? 'text-indigo-650 border-indigo-600 bg-indigo-50/50'
                              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <Settings className="w-3.5 h-3.5 shrink-0" />
                          <span>Configurações</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Drawer Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="mb-3">
                  <span className="block text-[8px] uppercase font-bold text-slate-400">Usuário:</span>
                  <span className="text-xs font-bold text-slate-700 truncate block">{loggedInUser?.email}</span>
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 4. MAIN CONTENT WORKSPACE AREA */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeTab === 'chat' ? 'h-screen overflow-hidden' : ''}`}>
        
        {/* Main Content scrollable container */}
        <main className={`flex-1 w-full focus:outline-none transition-all ${
          activeTab === 'chat' 
            ? 'max-w-none p-2 sm:p-3 md:p-4 flex flex-col min-h-0 h-full overflow-hidden' 
            : 'max-w-7xl mx-auto p-4 md:p-6 pb-12'
        }`}>
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider animate-pulse">
                Carregando dados da Auditoria...
              </p>
            </div>
          ) : (
            <div className={`animate-fade-in transition-all ${activeTab === 'chat' ? 'flex-1 flex flex-col min-h-0 h-full w-full' : ''}`}>
              {/* Privacy/Inspection notice for master@admin.com in tenant operational views */}
              {(loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin') && activeTab !== 'saas_master' && activeTab !== 'configuracoes' && activeTab !== 'bpos' && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4.5 rounded-2xl shadow-md border border-indigo-800/80 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                        <span>Modo de Inspeção Operacional de Tenant</span>
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] uppercase font-mono px-2 py-0.5 rounded-md">
                          SuperAdmin Inspection
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Você está inspecionando os dados operacionais da tenant ativa. Os conteúdos sensíveis são isolados via governança bancária.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('saas_master')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm"
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-200" />
                    <span>Voltar ao Painel Master SaaS</span>
                  </button>
                </div>
              )}

              {activeTab === 'saas_master' && (
                <SaasMasterDashboard 
                  onNavigate={(tab, sub) => {
                    setActiveTab(tab as any);
                    if (sub) setConfigSubTab(sub as any);
                  }}
                  onSelectTenantForAI={(tenantId) => {
                    setSelectedTenantForAI(tenantId);
                    setActiveTab('configuracoes');
                    setConfigSubTab('ia');
                  }}
                  userEmail={loggedInUser?.email}
                />
              )}

              {/* Block master@admin.com from inspecting private tenant calls */}
              {(loggedInUser?.email === 'master@admin.com' || loggedInUser?.role === 'superadmin') && 
               ['dashboard', 'analises', 'adesao', 'ingestao', 'metodologia'].includes(activeTab) ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5 max-w-3xl mx-auto my-12 shadow-sm">
                  <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 text-indigo-650 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
                      Isolamento de Dados de Atendimentos & Privacidade LGPD
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xl mx-auto">
                      O perfil <strong>master@admin.com</strong> atua estritamente na governança da infraestrutura SaaS, conectores de API e gestão de instâncias. Conteúdos de áudio, transcrições de chamadas, pontuações de agentes e laudos de auditorias das Tenants são <strong>estritamente privados</strong> e protegidos por isolamento tenant-isolation.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left space-y-2 max-w-lg mx-auto text-xs">
                    <span className="font-bold text-slate-800 block">Como SuperAdmin SaaS, você acompanha:</span>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li><strong>Saúde e Latência das APIs:</strong> No Hub Multissistemas.</li>
                      <li><strong>Consumo e Custos de IA por Tenant:</strong> Na Visão Geral Master SaaS.</li>
                      <li><strong>Gestão de Empresas Contratantes:</strong> Em Tenants & Sub-Tenants.</li>
                      <li><strong>Controle de Acessos Globais:</strong> Em Configurações &gt; Gestão de Acessos.</li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('saas_master')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Ir para Visão Geral Master SaaS</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <DashboardGeral 
                      interactions={interactions} 
                      session={session} 
                      bpos={bpos}
                      guiaItens={auditConfig?.guiaItens || []}
                    />
                  )}

                  {activeTab === 'analises' && (
                    <AnalisesAuditoria 
                      interactions={interactions} 
                      session={session} 
                      onSelectCall={handleSelectCall}
                      onDeleteCall={handleDeleteCall}
                      onRefreshInteractions={fetchInteractions}
                      activeCallId={activeCallId}
                      bpos={bpos}
                      guiaItens={auditConfig?.guiaItens || []}
                    />
                  )}

                  {activeTab === 'adesao' && auditConfig && (
                    <AdesaoScript 
                      interactions={interactions} 
                      session={session} 
                      guiaItens={auditConfig.guiaItens || []}
                      bpos={bpos}
                      onSelectCall={handleSelectCall}
                      setActiveTab={setActiveTab}
                    />
                  )}

                  {activeTab === 'metodologia' && auditConfig && (
                    <ConfigMetodologia 
                      config={auditConfig} 
                      onUpdate={(up) => setAuditConfig(up)} 
                      tenantId={loggedInUser?.tenantId || session.tenantId || 'system-global'}
                      userEmail={loggedInUser?.email || session.userEmail}
                      userRole={loggedInUser?.role || session.role}
                    />
                  )}
                </>
              )}

              {activeTab === 'bpos' && (
                <GestaoTenants 
                  userEmail={loggedInUser?.email}
                  userRole={loggedInUser?.role}
                  onBposChange={fetchBpos}
                  onSelectTenantForAI={(tenantId) => {
                    setSelectedTenantForAI(tenantId);
                    setActiveTab('configuracoes');
                    setConfigSubTab('ia');
                  }}
                />
              )}

              {activeTab === 'chat' && (
                <div className="w-full h-full flex-1 flex flex-col min-h-0 animate-fade-in">
                  <DataChat 
                    interactions={interactions} 
                    bpos={bpos}
                    auditConfig={auditConfig}
                    userEmail={loggedInUser?.email}
                    userRole={loggedInUser?.role}
                    tenantId={loggedInUser?.tenantId || session.tenantId || 'system-global'}
                  />
                </div>
              )}





              {activeTab === 'configuracoes' && (
                <div className={`space-y-6 ${configSubTab === 'integracoes' ? 'lg:flex lg:flex-col lg:h-[calc(100vh-4.5rem)] lg:min-h-0 lg:space-y-4 lg:overflow-hidden' : ''}`}>
                  {/* Navegação de Sub-abas de Configuração */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs shrink-0">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                      <Settings className="w-5 h-5 text-indigo-650" />
                      <div>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Painel de Configurações</h2>
                        <p className="text-[10px] text-slate-400 font-mono">Gerencie credenciais de IA, acessos de operadoras e integrações API ativas</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {loggedInUser?.role === 'superadmin' && (
                        <button
                          onClick={() => setConfigSubTab('ia')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            configSubTab === 'ia'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Central de Inteligência Artificial</span>
                        </button>
                      )}

                      <button
                        onClick={() => setConfigSubTab('acessos')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          configSubTab === 'acessos'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Gestão de Acessos</span>
                      </button>

                      <button
                        onClick={() => setConfigSubTab('integracoes')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          configSubTab === 'integracoes'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Hub Multissistemas & Saúde Global</span>
                      </button>

                      {(loggedInUser?.role === 'admin' || loggedInUser?.role === 'superadmin') && (
                        <button
                          onClick={() => setConfigSubTab('tenants')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            configSubTab === 'tenants'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Tenants (Ambientes)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Renderização da Sub-aba Ativa */}
                  <div className={`animate-fade-in ${configSubTab === 'integracoes' ? 'flex-1 min-h-0' : ''}`}>
                    {configSubTab === 'ia' && loggedInUser?.role === 'superadmin' && (
                      <GeminiConfig 
                        config={auditConfig} 
                        onUpdate={(up) => setAuditConfig(up)} 
                        initialTenantId={selectedTenantForAI}
                        userEmail={loggedInUser?.email}
                        isSuperAdmin={loggedInUser?.role === 'superadmin'}
                      />
                    )}

                    {configSubTab === 'acessos' && (
                      <GestaoAcessos 
                        bpos={bpos} 
                        session={session} 
                      />
                    )}

                    {configSubTab === 'integracoes' && (
                      <HubIntegracoes 
                        onSyncComplete={handleGenesysSyncComplete} 
                        bpos={bpos}
                        userEmail={loggedInUser?.email}
                        userRole={loggedInUser?.role}
                        tenantId={loggedInUser?.tenantId || session.tenantId || 'system-global'}
                        activeConfig={auditConfig}
                        onIngestProcessed={handleNewProcessedItems}
                      />
                    )}

                    {configSubTab === 'tenants' && (loggedInUser?.role === 'admin' || loggedInUser?.role === 'superadmin') && (
                      <GestaoTenants 
                        userEmail={loggedInUser?.email}
                        userRole={loggedInUser?.role}
                        onBposChange={fetchBpos}
                        onSelectTenantForAI={(tenantId) => {
                          setSelectedTenantForAI(tenantId);
                          setConfigSubTab('ia');
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        
      </div>

      {/* Floating Chat Button for All Pages */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        id="floatingChatBtn"
        title="AI Data Chat"
      >
        <div className="relative">
          <Bot className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out font-bold text-xs uppercase tracking-wide whitespace-nowrap">
          AI Data Chat
        </span>
      </button>

      {/* Slide-over Drawer for AI Data Chat */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop shadow-glass overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 cursor-pointer"
            />
            {/* Drawer container - FULL SCREEN 100% WIDTH & HEIGHT */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 210 }}
              className="fixed inset-0 w-screen h-screen bg-white z-55 flex flex-col overflow-hidden"
            >
              {/* Chat view area - FULL SCREEN NO EXTRA MARGINS */}
              <div className="flex-1 overflow-hidden bg-white flex flex-col min-h-0 h-full w-full">
                <DataChat 
                  interactions={interactions} 
                  bpos={bpos}
                  auditConfig={auditConfig}
                  userEmail={loggedInUser?.email}
                  userRole={loggedInUser?.role}
                  tenantId={loggedInUser?.tenantId || session.tenantId || 'system-global'}
                  onClose={() => setIsChatOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* State-based Custom Confirm Dialog for iFrame Sandbox Compatibility */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded shadow-lg max-w-md w-full p-5 text-left animate-fade-in">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold cursor-pointer transition-colors"
              >
                Confirmar Ação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State-based Custom Alert Dialog */}
      {alertModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded shadow-lg max-w-sm w-full p-5 text-left animate-fade-in">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-650 shrink-0" />
              {alertModal.title}
            </h3>
            <p className="text-xs text-slate-550 mt-3 leading-relaxed">
              {alertModal.message}
            </p>
            <div className="flex items-center justify-end mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold cursor-pointer transition-colors"
              >
                Ok, Entendi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
