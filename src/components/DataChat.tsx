import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, ChatSession, Interaction, AuditConfig } from '../types';
import { 
  Send, 
  MessageSquare, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2,
  Lightbulb,
  Plus,
  Trash2,
  Edit3,
  Search,
  Bot,
  User,
  Clock,
  ChevronRight,
  Check,
  X,
  ShieldCheck,
  Server,
  Activity,
  Cpu,
  Copy,
  ArrowDown,
  CornerDownLeft,
  Share2,
  Layers,
  BarChart3,
  Users2,
  FileText,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Filter,
  TrendingUp,
  Award,
  HelpCircle,
  Hash
} from 'lucide-react';

interface DataChatProps {
  interactions: Interaction[];
  bpos?: string[];
  auditConfig?: AuditConfig | null;
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
  onClose?: () => void;
}

export const QUICK_PROMPTS_OPERATIONAL = [
  { text: "Quais operadores precisam de reciclagem urgente de postura?", category: "Operadores", icon: Users2 },
  { text: "Dê um resumo das falhas críticas de conformidade detectadas", category: "Compliance", icon: AlertTriangle },
  { text: "Qual BPO tem o melhor desempenho e quais são seus diferenciais?", category: "Ranking BPO", icon: BarChart3 },
  { text: "Quais são os principais gargalos identificados na jornada de atendimento?", category: "Processo", icon: Activity },
  { text: "Gere um plano de ação para elevar a conformidade de saudação e protocolo", category: "Plano de Ação", icon: Lightbulb }
];

export const QUICK_PROMPTS_SAAS_MASTER = [
  { text: "Qual o status das conexões de sistemas (Genesys STA, Zendesk e Webhooks)?", category: "Conectores", icon: Server },
  { text: "Quais provedores e modelos de IA estão alocados para cada Tenant?", category: "Modelos IA", icon: Cpu },
  { text: "Exiba a volumetria de chamadas de API e ingestões registradas este mês", category: "Volumetria", icon: Activity },
  { text: "Como funciona o isolamento de dados e credenciais entre os Tenants?", category: "Segurança", icon: ShieldCheck }
];

export default function DataChat({ 
  interactions,
  bpos = ["BPO Alpha", "BPO Beta", "BPO Gamma"],
  auditConfig,
  userEmail,
  userRole,
  tenantId,
  onClose
}: DataChatProps) {
  const isMasterAdmin = userEmail === 'master@admin.com' || userRole === 'superadmin';
  const quickPromptsList = isMasterAdmin ? QUICK_PROMPTS_SAAS_MASTER : QUICK_PROMPTS_OPERATIONAL;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'alerts'>('chats');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Invalida fetches antigos quando uma criação/exclusão/envio acontece, para
  // que uma lista stale não "ressuscite" um chat excluído ou apague uma resposta.
  const sessionsMutationRef = useRef(0);

  const activeProviderId = auditConfig?.activeProvider;
  const activeProviderCfg = activeProviderId ? auditConfig?.providers?.[activeProviderId] : undefined;
  const activeChatModel = activeProviderCfg?.chatModel
    || activeProviderCfg?.selectedModel
    || auditConfig?.chatModel
    || auditConfig?.globalModel
    || auditConfig?.geminiModel
    || 'Nenhum provedor ativo';

  // KPIs and operational diagnostics derived directly from active DB data
  const totalCalls = interactions.length;
  const avgScore = totalCalls > 0 ? Math.round(interactions.reduce((acc, i) => acc + i.score, 0) / totalCalls) : 0;
  const avgAdherence = totalCalls > 0 ? Math.round(interactions.reduce((acc, i) => acc + (i.scriptAdherence ?? 0), 0) / totalCalls) : 0;
  const totalCriticalCalls = interactions.filter(i => (i.score === 0) || ((i.evaluation?.criticalFails?.length ?? 0) > 0)).length;
  const criticalPercent = totalCalls > 0 ? Math.round((totalCriticalCalls / totalCalls) * 100) : 0;

  const bpoAverages = useMemo(() => {
    return bpos.map(bpo => {
      const items = interactions.filter(i => i.bpoName?.toLowerCase() === bpo.toLowerCase());
      const score = items.length > 0 ? Math.round(items.reduce((acc, i) => acc + i.score, 0) / items.length) : 0;
      const crits = items.filter(i => (i.score === 0) || ((i.evaluation?.criticalFails?.length ?? 0) > 0)).length;
      return { name: bpo, avg: score, count: items.length, crits };
    }).sort((a, b) => b.avg - a.avg);
  }, [bpos, interactions]);

  const leaderBpo = bpoAverages[0];
  const lowBpo = bpoAverages.find(b => b.avg < 75 && b.count > 0);

  const agentPerformance = useMemo(() => {
    return interactions.reduce((acc, item) => {
      if (!acc[item.agentName]) {
        acc[item.agentName] = { name: item.agentName, bpo: item.bpoName, scoreSum: 0, count: 0, criticals: 0 };
      }
      acc[item.agentName].scoreSum += item.score;
      acc[item.agentName].count += 1;
      acc[item.agentName].criticals += (item.evaluation?.criticalFails || []).length;
      return acc;
    }, {} as Record<string, { name: string; bpo: string; scoreSum: number; count: number; criticals: number }>);
  }, [interactions]);

  const underperformingAgent = useMemo(() => {
    const list = Object.values(agentPerformance) as Array<{ name: string; bpo: string; scoreSum: number; count: number; criticals: number }>;
    return list
      .map(a => ({ name: a.name, bpo: a.bpo, avg: Math.round(a.scoreSum / a.count), criticals: a.criticals, count: a.count }))
      .sort((a, b) => a.avg - b.avg)
      .find(a => a.avg < 75 || a.criticals > 0);
  }, [agentPerformance]);

  // Load chat sessions from API
  const fetchSessions = async () => {
    const mutationAtStart = sessionsMutationRef.current;
    try {
      const tid = tenantId || 'system-global';
      const email = userEmail || '';
      const res = await fetch(`/api/chats?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, {
        headers: {
          'x-tenant-id': tid,
          'x-user-email': email
        }
      });
      if (res.ok) {
        const data: ChatSession[] = await res.json();
        if (sessionsMutationRef.current !== mutationAtStart) return;
        const list = (Array.isArray(data) ? data : []).map(s => ({
          ...s,
          messages: Array.isArray(s.messages) ? s.messages : []
        }));
        setSessions(list);
        setActiveChatId(prev => {
          if (prev && list.some(s => s.id === prev)) return prev;
          return list[0]?.id || '';
        });
      }
    } catch (err) {
      console.error("Erro ao buscar sessões de chat:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [tenantId, userEmail]);

  const activeSession = sessions.find(s => s.id === activeChatId) || sessions[0];

  // Auto-scroll when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, loading]);

  // Handle scroll detection for scroll-to-bottom button
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 180);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Create New Chat
  const handleCreateNewChat = async () => {
    sessionsMutationRef.current += 1;
    const mutationAtStart = sessionsMutationRef.current;
    try {
      const tid = tenantId || 'system-global';
      const email = userEmail || '';
      const defaultTitle = isMasterAdmin ? `Consulta Governança (${sessions.length + 1})` : `Nova Análise de Dados (${sessions.length + 1})`;
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tid,
          'x-user-email': email
        },
        body: JSON.stringify({ title: defaultTitle, tenantId: tid, userEmail: email })
      });
      if (res.ok) {
        const data = await res.json();
        if (sessionsMutationRef.current !== mutationAtStart) return;
        setSessions(data.chats || []);
        if (data.chat) {
          setActiveChatId(data.chat.id);
        }
        showToast("Nova conversa criada!");
      }
    } catch (err) {
      console.error("Erro ao criar novo chat:", err);
    }
  };

  // Delete Chat Session
  const handleDeleteChat = async (idToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sessionsMutationRef.current += 1;
    const mutationAtStart = sessionsMutationRef.current;
    const remaining = sessions.filter(s => s.id !== idToDelete);
    const wasActive = activeChatId === idToDelete;

    // Remove imediatamente da UI; se o servidor recusar, o fetch abaixo restaura.
    setSessions(remaining);
    if (wasActive) setActiveChatId(remaining[0]?.id || '');

    try {
      const scope = tenantId || 'system-global';
      const res = await fetch(`/api/chats/${idToDelete}?tenantId=${encodeURIComponent(scope)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        // Não sobrescrever uma resposta de envio/nova conversa mais recente.
        if (sessionsMutationRef.current !== mutationAtStart) return;
        const updatedChats: ChatSession[] = Array.isArray(data.chats) ? data.chats : [];
        setSessions(updatedChats);
        if (wasActive) setActiveChatId(updatedChats[0]?.id || '');
        showToast("Conversa removida.");
      } else {
        if (sessionsMutationRef.current === mutationAtStart) await fetchSessions();
        showToast("Não foi possível excluir a conversa.");
      }
    } catch (err) {
      console.error("Erro ao excluir chat:", err);
      if (sessionsMutationRef.current === mutationAtStart) await fetchSessions();
    }
  };

  // Start Editing Title
  const handleStartEditingTitle = (session: ChatSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTitleId(session.id);
    setTempTitle(session.title);
  };

  // Save Title Edit
  const handleSaveTitle = async (sessionId: string) => {
    if (!tempTitle.trim()) {
      setEditingTitleId(null);
      return;
    }
    sessionsMutationRef.current += 1;
    const mutationAtStart = sessionsMutationRef.current;
    try {
      const scope = tenantId || 'system-global';
      const res = await fetch(`/api/chats/${sessionId}?tenantId=${encodeURIComponent(scope)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tempTitle.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (sessionsMutationRef.current === mutationAtStart) setSessions(data.chats || []);
      }
    } catch (err) {
      console.error("Erro ao renomear conversa:", err);
    } finally {
      setEditingTitleId(null);
    }
  };

  // Copy message text to clipboard
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Send Message
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    sessionsMutationRef.current += 1;
    const mutationAtStart = sessionsMutationRef.current;

    // If no active session, create one first
    let currentChatId = activeSession?.id;
    if (!currentChatId) {
      const tid = tenantId || 'system-global';
      const email = userEmail || '';
      const defaultTitle = textToSend.trim().substring(0, 30);
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tid,
            'x-user-email': email
          },
          body: JSON.stringify({ title: defaultTitle, tenantId: tid, userEmail: email })
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.chats || []);
          if (data.chat) {
            currentChatId = data.chat.id;
            setActiveChatId(currentChatId);
          }
        }
      } catch (e) {
        console.error("Erro ao criar chat antes do envio:", e);
      }
    }

    if (!currentChatId) return;

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Optimistic UI update
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: timeStr
    };

    setSessions(prevSessions => 
      prevSessions.map(s => {
        if (s.id === currentChatId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...(s.messages || []), userMsg]
          };
        }
        return s;
      })
    );

    setInput('');
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          chatId: currentChatId,
          userEmail,
          userRole,
          tenantId
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Falha no processamento da resposta (HTTP ${response.status}).`);
      }

      const data = await response.json();
      if (sessionsMutationRef.current !== mutationAtStart) return;
      if (Array.isArray(data.chats)) {
        setSessions(data.chats);
      } else if (data.chat) {
        setSessions(prev => prev.map(s => s.id === data.chat.id ? data.chat : s));
      }
      if (data.chatId) {
        setActiveChatId(data.chatId);
      }
    } catch (err: any) {
      console.error("Erro na requisição do chat:", err);
      const detail = err?.name === 'AbortError'
        ? "A resposta demorou mais que o limite de segurança."
        : (err?.message || "Falha de conexão.");
      const errorMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: isMasterAdmin
          ? `⚠️ **Aviso de Conexão (Governança SaaS)**: ${detail}\n\n*Os status da plataforma continuam preservados no banco de dados. Tente reenviar a mensagem.*`
          : `⚠️ **Aviso de Conexão**: ${detail}\n\n*Os seus dados e históricos continuam preservados. Tente reenviar a mensagem.*`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setSessions(prevSessions =>
        prevSessions.map(s => {
          if (s.id === currentChatId) {
            return {
              ...s,
              messages: [...(s.messages || []), errorMsg]
            };
          }
          return s;
        })
      );
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.messages || []).some(m => m.text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="w-full h-full min-h-0 bg-slate-50/50 overflow-hidden flex flex-col md:flex-row flex-1 font-sans relative">
      
      {/* TOAST FEEDBACK NOTIFICATION */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-fade-in border border-slate-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEFT SIDEBAR: CHAT SESSIONS & OPERATIONAL DIAGNOSTICS      */}
      {/* ========================================================= */}
      <aside className={`
        ${sidebarCollapsed ? 'hidden' : 'flex w-full md:w-80 lg:w-84'}
        shrink-0 bg-white border-r border-slate-200 flex-col h-full min-h-0 text-slate-700 z-20 shadow-2xs overflow-hidden
        ${mobileSidebarOpen ? '!flex fixed inset-0 z-50 w-full bg-white' : ''}
      `}>
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0 ${isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`}>
              {isMasterAdmin ? <ShieldCheck className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                {isMasterAdmin ? 'Copilot SaaS Master' : 'AuditaQA AI Copilot'}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {isMasterAdmin ? 'Infraestrutura & Plataforma' : 'Análise Cognitiva de CX & QA'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {mobileSidebarOpen && (
              <button 
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 md:hidden"
                title="Fechar menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button 
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 hidden md:flex transition-colors"
              title="Recolher painel lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={() => {
              handleCreateNewChat();
              setMobileSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3.5 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
              isMasterAdmin 
                ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800' 
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conversa</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-sans shadow-2xs transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher: Sessions vs Diagnostics */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1 text-[11px] font-bold shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setSidebarTab('chats')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              sidebarTab === 'chats' 
                ? 'bg-white text-indigo-700 font-extrabold shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Conversas ({sessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('alerts')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              sidebarTab === 'alerts' 
                ? 'bg-white text-indigo-700 font-extrabold shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {isMasterAdmin ? <Server className="w-3.5 h-3.5 text-purple-600" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
            <span>{isMasterAdmin ? 'Infra & Conectores' : 'Diagnósticos & KPIs'}</span>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
          {sidebarTab === 'chats' && (
            <>
              {filteredSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-sans space-y-2">
                  <div className="w-10 h-10 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="font-medium text-slate-600">
                    {searchTerm ? 'Nenhuma conversa encontrada para a busca.' : 'Nenhuma conversa iniciada.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Clique no botão acima para abrir um novo diálogo de análise.
                  </p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === activeSession?.id;
                  const isEditing = editingTitleId === session.id;
                  const lastMsg = (session.messages || [])[session.messages.length - 1];

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        setActiveChatId(session.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`
                        p-3 rounded-xl transition-all cursor-pointer border group relative flex flex-col gap-1.5
                        ${isActive 
                          ? (isMasterAdmin 
                              ? 'bg-purple-50/80 border-purple-200 text-purple-950 font-bold shadow-xs' 
                              : 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-bold shadow-xs') 
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80 text-slate-700 shadow-2xs'
                        }
                      `}
                    >
                      {/* Top row: Title + Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? (isMasterAdmin ? 'text-purple-600' : 'text-indigo-600') : 'text-slate-400'}`} />
                          
                          {isEditing ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTitle(session.id);
                                  if (e.key === 'Escape') setEditingTitleId(null);
                                }}
                                autoFocus
                                className="w-full bg-white border border-indigo-400 rounded-lg px-2 py-0.5 text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveTitle(session.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs truncate font-bold ${isActive ? (isMasterAdmin ? 'text-purple-950' : 'text-indigo-950') : 'text-slate-800'}`}>
                              {session.title}
                            </span>
                          )}
                        </div>

                        {isActive && !isEditing && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-tight shrink-0 ${
                            isMasterAdmin ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativa
                          </span>
                        )}

                        {/* Hover Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleStartEditingTitle(session, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                              title="Renomear conversa"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteChat(session.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Excluir conversa"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Sub-line summary */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="truncate max-w-[150px]">
                          {lastMsg ? lastMsg.text.replace(/[*#]/g, '').substring(0, 28) + "..." : "Conversa vazia"}
                        </span>
                        <span>{session.messages.length} msgs</span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: Proactive Alerts & Operational Health */}
          {sidebarTab === 'alerts' && (
            <div className="space-y-3">
              {isMasterAdmin ? (
                <>
                  {/* SaaS Infra Alert 1 */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                      <Server className="w-4 h-4 text-purple-600 shrink-0" />
                      Status dos Conectores
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      <strong className="text-slate-900">Genesys Cloud STA & Webhook:</strong> Conectores ativos e monitorados em tempo real na rota <code className="text-purple-700 font-mono text-[10px] bg-purple-50 px-1 py-0.5 rounded border border-purple-200">/api/genesys/webhook</code>.
                    </p>
                  </div>

                  {/* SaaS Infra Alert 2 */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Isolamento & PII LGPD
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      <strong className="text-slate-900">Proteção Ativa:</strong> Transcrições e gravações com mascaramento automático de CPF, cartões e dados pessoais antes da auditoria.
                    </p>
                  </div>

                  {/* SaaS Infra Alert 3 */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-xs">
                      <Cpu className="w-4 h-4 text-indigo-600 shrink-0" />
                      Modelos de IA Ativos
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Motor Primário: <strong className="text-slate-900">{activeChatModel}</strong>.<br />
                      Fallback Resiliente: <strong className="text-slate-900">OpenAI GPT-4o / Heurístico</strong>.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Operational Metric 1: Quality Score */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score Auto-QA</span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${avgScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {avgScore}/100 pt
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, avgScore))}%` }}
                      />
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Total de <strong className="text-slate-900">{totalCalls} atendimentos auditados</strong> com adesão média de <strong>{avgAdherence}%</strong>.
                    </p>
                  </div>

                  {/* Operational Metric 2: BPO Health */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                      Ranking de Parceiras
                    </div>
                    {leaderBpo && (
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Líder da operação: <strong className="text-emerald-700">{leaderBpo.name}</strong> ({leaderBpo.avg}/100 pt).
                      </p>
                    )}
                    {lowBpo ? (
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        ⚠️ A parceira <strong className="text-slate-900">{lowBpo.name}</strong> opera com média de <strong className="text-amber-700">{lowBpo.avg}/100</strong>.
                      </p>
                    ) : (
                      <p className="text-emerald-700 text-[11px] leading-relaxed flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Todas as parceiras estão operando na meta.
                      </p>
                    )}
                  </div>

                  {/* Operational Metric 3: Critical Fails */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      Falhas Críticas / Risco
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Taxa de casos com desvio grave: <strong className="text-rose-600">{criticalPercent}%</strong> ({totalCriticalCalls} chamadas com nota zero ou infração regulatória).
                    </p>
                  </div>
                </>
              )}

              {/* Quick Prompt Suggestions in sidebar */}
              <div className="pt-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sugestões Rápidas</div>
                <div className="space-y-1.5">
                  {quickPromptsList.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleSendMessage(qp.text);
                        setMobileSidebarOpen(false);
                      }}
                      disabled={loading}
                      className="w-full text-left p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl text-[11px] text-slate-700 font-medium leading-tight transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
                    >
                      <span className="line-clamp-2">{qp.text}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT MAIN WORKSPACE: ACTIVE CHAT CONVERSATION AREA */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative min-w-0 min-h-0">
        
        {/* Unified Top Executive Toolbar */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Toggle Sidebar when collapsed */}
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl transition-all hidden md:flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer"
                title="Expandir painel lateral de conversas"
              >
                <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                <span className="hidden lg:inline text-xs">Painel Lateral</span>
              </button>
            )}
            
            {/* Mobile Open Sidebar */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 md:hidden"
              title="Abrir histórico"
            >
              <MessageSquare className="w-4 h-4 text-indigo-600" />
            </button>

            {/* Brand / Assistant Identity */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0 ${isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`}>
              {isMasterAdmin ? <ShieldCheck className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {activeSession?.title || (isMasterAdmin ? 'Painel de Governança SaaS' : 'Auditoria Conversacional')}
                </h2>
                <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isMasterAdmin ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  {activeChatModel}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono hidden sm:block truncate">
                {isMasterAdmin ? 'Suporte Técnico e Infraestrutura Global' : `Base Ativa: ${totalCalls} chamadas auditadas • Score Médio: ${avgScore}/100 pt`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCreateNewChat()}
              className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isMasterAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              title="Iniciar nova conversa"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Novo Chat</span>
            </button>

            {activeSession && activeSession.messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const fullText = activeSession.messages.map(m => `[${m.timestamp}] ${m.sender === 'user' ? 'Você' : 'AuditaQA'}:\n${m.text}\n`).join('\n---\n\n');
                  navigator.clipboard.writeText(fullText);
                  showToast("Histórico completo copiado para a área de transferência!");
                }}
                className="px-3 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copiar transcrição completa da conversa"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline text-xs">Exportar</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 shadow-2xs ml-1"
                title="Fechar assistente de chat"
                id="closeChatDrawerBtn"
              >
                <span className="hidden sm:inline text-xs">Fechar Chat</span>
                <X className="w-4 h-4 text-slate-600" />
              </button>
            )}
          </div>
        </div>

        {/* Master Admin Notice Banner */}
        {isMasterAdmin && (
          <div className="px-4 py-2.5 bg-purple-50 text-purple-900 border-b border-purple-200 text-[11px] font-mono flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="truncate">
                <strong className="text-purple-950">Modo Governança SaaS Master:</strong> Consultas orientadas à integridade dos conectores, banco e infraestrutura global.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0">
              Multi-Tenant Isolado
            </span>
          </div>
        )}

        {/* Chat Message Scroll Area */}
        <div 
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 bg-slate-50/60 scroll-smooth relative"
        >
          {/* Welcome Screen when active conversation has no messages */}
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 text-center space-y-6">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-indigo-600 shadow-sm">
                <Bot className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {isMasterAdmin ? 'Assistente de Governança & Infraestrutura SaaS' : 'Como posso apoiar sua auditoria de qualidade hoje?'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                  {isMasterAdmin 
                    ? 'Faça diagnósticos sobre a integridade dos webhooks da Genesys Cloud, volumetria de requisições, modelos de IA e diretrizes de isolamento LGPD.' 
                    : `Estou conectado à base ativa com ${totalCalls} chamadas auditadas e ao Manual de Monitoria para responder sobre notas, BPOs, operadores e planos de ação.`}
                </p>
              </div>

              {/* 4 Feature Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {quickPromptsList.slice(0, 4).map((qp, idx) => {
                  const IconComp = qp.icon || Sparkles;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(qp.text)}
                      className="p-4 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-2xs transition-all text-left flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-600 rounded-lg transition-colors">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 uppercase tracking-wider">
                          {qp.category}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-950 leading-snug">
                        {qp.text}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeSession?.messages.map((m) => {
            const isUser = m.sender === 'user';
            const isCopied = copiedMessageId === m.id;

            return (
              <div 
                key={m.id} 
                className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start w-full group`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                  isUser ? 'bg-slate-800' : (isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600')
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : (isMasterAdmin ? <ShieldCheck className="w-4 h-4" /> : <Bot className="w-4 h-4" />)}
                </div>

                {/* Message Body & Metadata */}
                <div className={`flex flex-col space-y-1.5 max-w-2xl sm:max-w-3xl lg:max-w-4xl min-w-[260px] ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Sender & Timestamp Header */}
                  <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-slate-400">
                    <span className="font-bold text-slate-700">
                      {isUser ? 'Você' : (isMasterAdmin ? 'Copilot SaaS Master' : 'AuditaQA AI')}
                    </span>
                    <span>•</span>
                    <span>{m.timestamp}</span>
                  </div>

                  {/* Bubble Content */}
                  <div className={`
                    p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed space-y-2.5 shadow-xs w-full relative
                    ${isUser 
                      ? (isMasterAdmin ? 'bg-purple-600 text-white rounded-tr-none font-medium' : 'bg-indigo-600 text-white rounded-tr-none font-medium') 
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                    }
                  `}>
                    {renderStructuredMessage(m.text, isUser)}

                    {/* Footer Actions for Assistant Messages */}
                    {!isUser && (
                      <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>AuditaQA Intelligence • {activeChatModel}</span>
                        </div>
                        <button
                          onClick={() => handleCopyMessage(m.id, m.text)}
                          className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer text-xs font-medium"
                          title="Copiar resposta"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Bubble */}
          {loading && (
            <div className="flex gap-3.5 items-start max-w-md">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'
              }`}>
                {isMasterAdmin ? <ShieldCheck className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none text-xs sm:text-sm text-slate-700 shadow-xs flex items-center gap-3">
                <div className="flex space-x-1.5">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isMasterAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-mono text-xs text-slate-600">
                  {isMasterAdmin ? 'Consultando status de infraestrutura e governança...' : 'Correlacionando auditorias e diretrizes do manual...'}
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Scroll To Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-32 right-6 p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-full shadow-lg transition-all cursor-pointer z-20 flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowDown className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Rolar para o fim</span>
          </button>
        )}

        {/* Categorized Quick Suggestions Bar */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200/80 overflow-x-auto flex gap-2 shrink-0 scrollbar-none">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pr-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Sugestões:</span>
          </div>
          {quickPromptsList.map((qp, idx) => {
            const IconComp = qp.icon || Sparkles;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qp.text)}
                disabled={loading}
                className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-full text-xs text-slate-700 font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 shadow-2xs flex items-center gap-1.5 group"
              >
                <IconComp className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                <span>{qp.text}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Input Area */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600 focus-within:bg-white transition-all shadow-2xs">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={isMasterAdmin ? "Pergunte sobre conectores, APIs, provedores de IA, Tenants ou infraestrutura SaaS..." : "Pergunte sobre notas, BPOs, operadores ou peça um diagnóstico de conformidade..."}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                  }
                }
              }}
              disabled={loading}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-sans resize-none max-h-32 leading-relaxed"
              id="dataChatInput"
            />

            <button
              type="button"
              onClick={() => {
                handleSendMessage(input);
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                }
              }}
              disabled={!input.trim() || loading}
              className={`p-2.5 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed ${
                isMasterAdmin ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
              id="dataChatSendBtn"
              title="Enviar mensagem (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              <span>Pressione <strong>Enter</strong> para enviar, <strong>Shift+Enter</strong> para quebra de linha</span>
            </span>
            <span className="hidden sm:inline">
              {isMasterAdmin ? 'AuditaQA SaaS Master • Governança, Conectores & Infraestrutura Global' : 'AuditaQA • Respostas ancoradas na base ativa de auditorias'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

// -------------------------------------------------------------
// Advanced Structured Markdown & Formatting Parser with Tables
// -------------------------------------------------------------
function renderStructuredMessage(text: string, isUser: boolean) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{parseBolds(text, true)}</div>;
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushList = (keyPrefix: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-list`} className="space-y-1.5 my-2 pl-1">
          {currentList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-slate-700">
              <span className="text-indigo-600 font-bold leading-relaxed shrink-0">•</span>
              <span className="flex-1">{parseBolds(item, false)}</span>
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const flushTable = (keyPrefix: string) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(1);

      elements.push(
        <div key={`${keyPrefix}-table`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                {headerRow.map((col, colIdx) => (
                  <th key={colIdx} className="p-2.5 uppercase tracking-wider text-[10px] text-slate-500 font-mono">
                    {parseBolds(col.trim(), false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bodyRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="p-2.5 text-slate-700">
                      {parseBolds(cell.trim(), false)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Table line detection (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList(`table-flush-${idx}`);
      // Skip separator lines like |---|---|
      if (/^\|[-:\s|]+\|$/.test(trimmed)) {
        return;
      }
      const cells = trimmed.split("|").slice(1, -1);
      tableRows.push(cells);
      inTable = true;
      return;
    } else if (inTable) {
      flushTable(`tbl-${idx}`);
    }

    // Headings (###, ##, #)
    if (trimmed.startsWith("###")) {
      flushList(`h3-${idx}`);
      elements.push(
        <div key={`h3-${idx}`} className="mt-3.5 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
          <h4 className="font-bold text-xs sm:text-sm text-slate-900">
            {trimmed.replace(/^###\s*/, "")}
          </h4>
        </div>
      );
    } else if (trimmed.startsWith("##")) {
      flushList(`h2-${idx}`);
      elements.push(
        <div key={`h2-${idx}`} className="mt-4 mb-2 pb-1 border-b border-slate-100 flex items-center gap-2">
          <span className="w-2 h-4 bg-indigo-600 rounded-full" />
          <h3 className="font-bold text-sm sm:text-base text-slate-950">
            {trimmed.replace(/^##\s*/, "")}
          </h3>
        </div>
      );
    } else if (trimmed.startsWith("####")) {
      flushList(`h4-${idx}`);
      elements.push(
        <h5 key={`h4-${idx}`} className="font-bold text-xs text-indigo-950 mt-2.5 mb-1 uppercase tracking-wide">
          {trimmed.replace(/^####\s*/, "")}
        </h5>
      );
    } 
    // Unordered List Items (- or *)
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      currentList.push(trimmed.replace(/^[-*]\s*/, ""));
    }
    // Numbered Lists (1., 2., etc)
    else if (/^\d+\.\s/.test(trimmed)) {
      flushList(`num-${idx}`);
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`num-${idx}`} className="flex items-start gap-2.5 my-1.5 pl-1">
            <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <span className="text-slate-700 flex-1">{parseBolds(numMatch[2], false)}</span>
          </div>
        );
      }
    }
    // Blockquote or Callout (*Recomendação: ...*)
    else if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.includes("**")) {
      flushList(`callout-${idx}`);
      elements.push(
        <div key={`callout-${idx}`} className="my-2.5 p-3 bg-indigo-50/70 border-l-4 border-indigo-600 rounded-r-xl text-indigo-950 text-xs leading-relaxed">
          {trimmed.replace(/^\*|\*$/g, "")}
        </div>
      );
    }
    // Empty line
    else if (trimmed === "") {
      flushList(`empty-${idx}`);
    }
    // Standard Paragraph
    else {
      flushList(`p-${idx}`);
      elements.push(
        <p key={`p-${idx}`} className="text-slate-800 leading-relaxed">
          {parseBolds(trimmed, false)}
        </p>
      );
    }
  });

  flushList("final");
  flushTable("final");

  return elements;
}

// Helper to parse bold text **
function parseBolds(text: string, isUser: boolean = false) {
  const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <strong key={i} className={`font-bold ${isUser ? 'text-white' : 'text-slate-900'}`}>
          {part}
        </strong>
      );
    }
    return part;
  });
}
