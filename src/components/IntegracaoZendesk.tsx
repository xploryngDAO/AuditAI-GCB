import React, { useState, useEffect } from 'react';
import { ZendeskCreds, Interaction, ZendeskRecurringConfig } from '../types';
import { maskCustomerName, maskPII } from '../utils/piiMasking';
import { 
  MessageSquare, 
  Settings, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  HelpCircle, 
  Play,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Search,
  FileText,
  Server,
  Layers,
  ArrowRight,
  Database,
  Clock,
  Zap,
  Repeat,
  CalendarClock,
  AlertCircle,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Filter,
  Shield,
  LockKeyhole,
  PhoneCall,
  Globe,
  Radio,
  Info
} from 'lucide-react';

interface IntegracaoZendeskProps {
  onSyncComplete: (newItems: Interaction[]) => void;
  bpos?: string[];
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
}

export default function IntegracaoZendesk({ onSyncComplete, bpos, userEmail, userRole, tenantId }: IntegracaoZendeskProps) {
  const isMasterAdmin = userEmail === 'master@admin.com' || userRole === 'superadmin';
  const bpoOptions = (bpos && bpos.length > 0) ? bpos : [];

  const [creds, setCreds] = useState<ZendeskCreds>({
    subdomain: '',
    adminEmail: '',
    apiToken: '',
    oauthToken: '',
    authType: 'token',
    autoSync: false,
    syncInterval: 15,
    searchTimeframe: '7d',
    hoursBack: 168,
    maxResults: 50,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    lines: ['Linha_Principal_SAC', 'Linha_Atendimento_Voz', 'Suporte_Geral'],
    queues: ['Grupo_SAC', 'Grupo_N2_Retencao'],
    channelType: 'all'
  });

  const [showSecret, setShowSecret] = useState(false);
  const [targetBpo, setTargetBpo] = useState<string>(bpoOptions[0] || '');
  const [mode, setMode] = useState<'auto' | 'single'>('auto');

  // Single call/ticket test fields
  const [singleCallId, setSingleCallId] = useState('');
  const [singleTicketId, setSingleTicketId] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [syncedLog, setSyncedLog] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [importedItems, setImportedItems] = useState<Interaction[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Modo Recorrente State
  const [recurringConfig, setRecurringConfig] = useState<ZendeskRecurringConfig>({
    enabled: false,
    intervalMinutes: 60,
    creds: {
      subdomain: '',
      adminEmail: '',
      apiToken: '',
      authType: 'token'
    },
    targetBpo: bpoOptions[0] || '',
    lastRun: null,
    nextRun: null,
    lastRunStatus: null,
    totalCapturedCount: 0,
    logs: []
  });
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [triggeringRecurring, setTriggeringRecurring] = useState(false);

  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);

  // Lines/Queues Management & LGPD PII Masking State
  const [lines, setLines] = useState<string[]>(['Linha_Principal_SAC', 'Linha_Atendimento_Voz', 'Suporte_Geral']);
  const [newLineInput, setNewLineInput] = useState('');
  const [isDiscoveringLiveLines, setIsDiscoveringLiveLines] = useState(false);
  const [liveDiscoveryNotice, setLiveDiscoveryNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [piiMaskingEnabled, setPiiMaskingEnabled] = useState(true);
  const [piiTestInput, setPiiTestInput] = useState('Cliente solicitou alteração do CPF 123.456.789-00 e informou telefone (11) 98765-4321 no ticket Zendesk #84920.');
  const [piiTestOutput, setPiiTestOutput] = useState<string | null>(null);
  const [loadingPiiTest, setLoadingPiiTest] = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [lineSaveStatus, setLineSaveStatus] = useState<string | null>(null);

  const normalizeLines = (list: any[]): string[] => {
    if (!Array.isArray(list)) return [];
    return list.map(q => {
      if (typeof q === 'string') return q;
      if (typeof q === 'object' && q !== null) return q.name || q.id || q.number || String(q);
      return String(q);
    }).filter(Boolean);
  };

  useEffect(() => {
    const tid = tenantId || 'system-global';
    const email = userEmail || '';
    const headers = { 'x-tenant-id': tid, 'x-user-email': email };

    fetch(`/api/zendesk/recurring?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setRecurringConfig(data.config);
          if (data.config.targetBpo) {
            setTargetBpo(data.config.targetBpo);
          }
          if (data.config.creds) {
            setCreds(prev => ({
              ...prev,
              ...data.config.creds
            }));
          }
        }
      })
      .catch(err => console.error("Erro ao carregar configuracao recorrente Zendesk:", err));

    fetch(`/api/zendesk/queues?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.queues && Array.isArray(data.queues)) setLines(normalizeLines(data.queues));
        if (data.piiMaskingEnabled !== undefined) setPiiMaskingEnabled(data.piiMaskingEnabled);
      })
      .catch(err => console.error("Erro ao carregar linhas do Zendesk:", err));
  }, [tenantId, userEmail]);

  const handleSaveLinesAndPII = async (updatedLines?: string[], updatedPii?: boolean) => {
    const targetLines = updatedLines !== undefined ? normalizeLines(updatedLines) : normalizeLines(lines);
    const targetPii = updatedPii !== undefined ? updatedPii : piiMaskingEnabled;
    setSavingLines(true);
    setLineSaveStatus(null);
    try {
      const res = await fetch('/api/zendesk/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queues: targetLines, piiMaskingEnabled: targetPii })
      });
      const data = await res.json();
      if (data.success) {
        setLines(normalizeLines(data.queues));
        setPiiMaskingEnabled(data.piiMaskingEnabled);
        setLineSaveStatus("✅ Configurações de Linhas Zendesk e Proteção LGPD salvas com sucesso!");
        setTimeout(() => setLineSaveStatus(null), 3500);
      } else {
        setLineSaveStatus(`❌ Erro: ${data.error || 'Falha ao salvar'}`);
      }
    } catch (err: any) {
      setLineSaveStatus(`❌ Erro: ${err.message}`);
    } finally {
      setSavingLines(false);
    }
  };

  const handleAddLine = () => {
    if (!newLineInput.trim()) return;
    const trimmed = newLineInput.trim();
    const currentList = normalizeLines(lines);
    if (currentList.includes(trimmed)) return;
    const next = [...currentList, trimmed];
    setLines(next);
    setNewLineInput('');
    handleSaveLinesAndPII(next, piiMaskingEnabled);
  };

  const handleRemoveLine = (lineToRemove: string) => {
    const currentList = normalizeLines(lines);
    const next = currentList.filter(q => q !== lineToRemove);
    setLines(next);
    handleSaveLinesAndPII(next, piiMaskingEnabled);
  };

  const handleDiscoverLiveLines = async () => {
    if (!creds.subdomain?.trim() || (!creds.apiToken?.trim() && !creds.oauthToken?.trim())) {
      setLiveDiscoveryNotice({
        type: 'error',
        text: 'Preencha o Subdomínio e o Token de API do Zendesk antes de consultar as linhas ao vivo.'
      });
      return;
    }

    setIsDiscoveringLiveLines(true);
    setLiveDiscoveryNotice(null);
    try {
      const tid = tenantId || 'system-global';
      const res = await fetch('/api/integrations/discover-queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: 'zendesk',
          bpoName: targetBpo,
          creds: {
            subdomain: creds.subdomain,
            adminEmail: creds.adminEmail,
            apiToken: creds.apiToken,
            oauthToken: creds.oauthToken,
            authType: creds.authType
          },
          tenantId: tid
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.queues) && data.queues.length > 0) {
        const discovered = normalizeLines(data.queues);
        const merged = Array.from(new Set([...discovered, ...lines]));
        setLines(merged);
        handleSaveLinesAndPII(merged, piiMaskingEnabled);
        setLiveDiscoveryNotice({
          type: 'success',
          text: data.message || `✓ ${data.queues.length} linhas/grupos capturados em tempo real na API do Zendesk!`
        });
      } else {
        setLiveDiscoveryNotice({
          type: 'error',
          text: data.error || 'Nenhuma linha ou grupo foi retornado pela API do Zendesk.'
        });
      }
    } catch (err: any) {
      setLiveDiscoveryNotice({
        type: 'error',
        text: `Erro ao consultar API do Zendesk: ${err.message}`
      });
    } finally {
      setIsDiscoveringLiveLines(false);
    }
  };

  const handleRunPiiTest = async () => {
    if (!piiTestInput.trim()) return;
    setLoadingPiiTest(true);
    try {
      const res = await fetch('/api/pii/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: piiTestInput })
      });
      const data = await res.json();
      if (data.maskedText || data.masked) {
        setPiiTestOutput(data.maskedText || data.masked);
      }
    } catch (err) {
      console.error("Erro no teste de PII Zendesk:", err);
    } finally {
      setLoadingPiiTest(false);
    }
  };

  const handleSaveZendeskConfig = async () => {
    setSavingConfig(true);
    setConfigSaveStatus(null);
    try {
      const res = await fetch('/api/zendesk/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds,
          targetBpo,
          enabled: recurringConfig.enabled,
          intervalMinutes: recurringConfig.intervalMinutes
        })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setRecurringConfig(data.config);
        setConfigSaveStatus("✅ Credenciais e configurações do Zendesk salvas com sucesso!");
        setTimeout(() => setConfigSaveStatus(null), 4000);
      } else {
        setConfigSaveStatus(`❌ Erro ao salvar: ${data.error || 'Falha no servidor'}`);
      }
    } catch (err: any) {
      setConfigSaveStatus(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleRecurringMode = async (enabled: boolean) => {
    setLoadingRecurring(true);
    try {
      const res = await fetch('/api/zendesk/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          intervalMinutes: recurringConfig.intervalMinutes || 60,
          targetBpo,
          creds
        })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setRecurringConfig(data.config);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecurring(false);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    try {
      const res = await fetch('/api/zendesk/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: recurringConfig.enabled,
          intervalMinutes: minutes,
          targetBpo,
          creds
        })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setRecurringConfig(data.config);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerRecurringNow = async () => {
    setTriggeringRecurring(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/zendesk/recurring/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creds, targetBpo })
      });
      const data = await res.json();
      if (data.config) setRecurringConfig(data.config);
      if (data.success) {
        setSuccessCount(data.count || 0);
        if (data.syncedItems && data.syncedItems.length > 0) {
          setImportedItems(prev => [...data.syncedItems, ...prev]);
          onSyncComplete(data.syncedItems);
        } else {
          onSyncComplete([]);
        }
      } else {
        if (data.error) {
          setSyncError(data.error);
        }
      }
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || "Erro ao disparar varredura recorrente no Zendesk Talk.");
    } finally {
      setTriggeringRecurring(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSuccessCount(null);
    setSyncError(null);

    if (!creds.subdomain.trim() || (!creds.apiToken.trim() && !creds.oauthToken?.trim())) {
      const err = "Por favor preencha o Subdomínio do Zendesk e o API Token antes de sincronizar.";
      setSyncError(err);
      setSyncedLog([
        `[${new Date().toLocaleTimeString('pt-BR')}] [ERRO] ${err}`,
        `[${new Date().toLocaleTimeString('pt-BR')}] Acesse o Zendesk Admin Center > Apps and Integrations > APIs > Zendesk API para gerar seu Token.`
      ]);
      setSyncing(false);
      return;
    }

    const initialLog = [
      `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando conexão com a API do Zendesk Talk & Support...`,
      `[${new Date().toLocaleTimeString('pt-BR')}] Subdomínio: ${creds.subdomain}.zendesk.com`,
      `[${new Date().toLocaleTimeString('pt-BR')}] Solicitando autenticação via ${creds.authType === 'oauth' ? 'OAuth 2.0 Bearer' : 'API Token (Basic Auth)'}...`
    ];
    setSyncedLog(initialLog);

    try {
      const tid = tenantId || 'system-global';
      const payload: any = {
        creds,
        targetBpo,
        queues: lines,
        tenantId: tid
      };

      if (mode === 'single') {
        if (!singleCallId.trim() && !singleTicketId.trim()) {
          throw new Error("Por favor informe o Call ID ou o Ticket ID para buscar o atendimento individual no Zendesk.");
        }
        payload.callId = singleCallId.trim();
        payload.ticketId = singleTicketId.trim();
      }

      const response = await fetch('/api/zendesk/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tid
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.logs && Array.isArray(data.logs)) {
        setSyncedLog(data.logs);
      }

      if (response.ok && data.success) {
        setSuccessCount(data.count || 0);
        if (data.syncedItems && data.syncedItems.length > 0) {
          setImportedItems(prev => [...data.syncedItems, ...prev]);
          onSyncComplete(data.syncedItems);
        }
      } else {
        setSyncError(data.error || "Falha na comunicação com a API do Zendesk.");
      }
    } catch (err: any) {
      setSyncError(err.message);
      setSyncedLog(prev => [...prev, `[ERRO CRÍTICO] ${err.message}`]);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5 text-left animate-fade-in">
      {/* SEÇÃO EXCLUSIVA DE GOVERNANÇA SAAS PARA master@admin.com */}
      {isMasterAdmin && (
        <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/80 rounded-2xl text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-800/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-emerald-300 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-300 block tracking-wider">
                  Governança SaaS Master de Sistemas e Telefonia
                </span>
                <h2 className="text-sm font-extrabold text-white">
                  Controle do Conector Zendesk Talk & Support API v2
                </h2>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Conector Oficial Homologado
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Como administrador <strong>master@admin.com</strong>, você gerencia a integração universal do Zendesk Talk e Support. Os tenants e operadoras parceiras isolam suas chaves de API, linhas de atendimento telefônico e fluxos de chamadas com conformidade à LGPD.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-800/80 border border-emerald-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Suporte a Canais</span>
              <span className="text-xs font-bold text-emerald-400">Talk (Voz), Chat & Tickets</span>
            </div>
            <div className="p-3 bg-slate-800/80 border border-emerald-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Modo de Autenticação</span>
              <span className="text-xs font-bold text-indigo-300">API Token & OAuth 2.0</span>
            </div>
            <div className="p-3 bg-slate-800/80 border border-emerald-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Isolamento Multi-BPO</span>
              <span className="text-xs font-bold text-amber-300">Tenant-Isolated per Partner</span>
            </div>
          </div>
        </div>
      )}

      {/* Banner Informativo sobre a API Zendesk Talk */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-4 rounded-xl text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-emerald-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <span>Conector Nativo Zendesk Talk & Support API</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded text-[9px] font-mono">Talk API v2 / REST</span>
            </h2>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Captura automatizada de gravações de voz no <strong>Zendesk Talk</strong>, bilhetagem de chamadas, dados de agentes e transcrições de tickets de atendimento para auditoria por Inteligência Artificial (Auto-QA).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <a 
            href="https://developer.zendesk.com/documentation/voice/talk-api/getting-started/" 
            target="_blank" 
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Doc Talk API</span>
          </a>
        </div>
      </div>

      {/* Grid com Formulário de Credenciais e Modos de Disparo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* COLUNA ESQUERDA: Formulário de Credenciais Zendesk API */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Credenciais da API Zendesk
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">REST API v2</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Subdomínio */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                Subdomínio Zendesk <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <input 
                  type="text"
                  placeholder="suaempresa"
                  value={creds.subdomain}
                  onChange={(e) => setCreds(prev => ({ ...prev, subdomain: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-r-lg text-slate-500 text-xs font-mono">
                  .zendesk.com
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Exemplo: casasbahia (sem https://)</p>
            </div>

            {/* Tipo de Autenticação */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                Tipo de Autenticação
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreds(prev => ({ ...prev, authType: 'token' }))}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    creds.authType !== 'oauth'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>API Token (Recomendado)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreds(prev => ({ ...prev, authType: 'oauth' }))}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    creds.authType === 'oauth'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <LockKeyhole className="w-3.5 h-3.5" />
                  <span>OAuth 2.0 Bearer</span>
                </button>
              </div>
            </div>

            {/* Email de Administrador */}
            {creds.authType !== 'oauth' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Email do Administrador / Usuário API <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="email"
                  placeholder="admin@empresa.com.br"
                  value={creds.adminEmail}
                  onChange={(e) => setCreds(prev => ({ ...prev, adminEmail: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Token de API ou OAuth Token */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                {creds.authType === 'oauth' ? 'OAuth 2.0 Access Token' : 'Zendesk API Token'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type={showSecret ? "text" : "password"}
                  placeholder={creds.authType === 'oauth' ? "Bearer token..." : "••••••••••••••••••••••••••••••••"}
                  value={creds.authType === 'oauth' ? (creds.oauthToken || '') : creds.apiToken}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (creds.authType === 'oauth') {
                      setCreds(prev => ({ ...prev, oauthToken: val }));
                    } else {
                      setCreds(prev => ({ ...prev, apiToken: val }));
                    }
                  }}
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Janela Temporal e Quantidade Máxima */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Janela de Busca
                </label>
                <select 
                  value={creds.searchTimeframe || '7d'}
                  onChange={(e) => setCreds(prev => ({ ...prev, searchTimeframe: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="24h">Últimas 24 Horas</option>
                  <option value="3d">Últimos 3 Dias</option>
                  <option value="7d">Últimos 7 Dias (Padrão)</option>
                  <option value="30d">Últimos 30 Dias</option>
                  <option value="90d">Últimos 90 Dias</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Limite por Varredura
                </label>
                <input 
                  type="number"
                  min="1"
                  max="200"
                  value={creds.maxResults || 50}
                  onChange={(e) => setCreds(prev => ({ ...prev, maxResults: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Botão de Salvar Credenciais */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveZendeskConfig}
                disabled={savingConfig}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Salvando parâmetros...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Salvar Credenciais do Zendesk</span>
                  </>
                )}
              </button>
              {configSaveStatus && (
                <p className={`text-[11px] mt-2 font-bold ${configSaveStatus.includes('❌') ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {configSaveStatus}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Modo de Execução & Disparo Manual */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Execução & Captura de Atendimentos
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-mono font-bold">
                Auto-QA IA Ativo
              </span>
            </div>

            {/* Seleção de BPO Alvo */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                Atribuir ao Parceiro BPO
              </label>
              <select 
                value={targetBpo}
                onChange={(e) => setTargetBpo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {bpoOptions.length > 0 ? (
                  bpoOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))
                ) : (
                  <option value="BPO Principal">BPO Principal</option>
                )}
              </select>
            </div>

            {/* Alternador de Modo: Lote vs Chamada Única */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                Modo de Sincronização
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('auto')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'auto'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Captura em Lote (Talk API)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'single'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Atendimento Único (Teste)</span>
                </button>
              </div>
            </div>

            {/* Campos de Atendimento Único */}
            {mode === 'single' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Call ID (Zendesk Talk)
                  </label>
                  <input 
                    type="text"
                    placeholder="Ex: 89402102"
                    value={singleCallId}
                    onChange={(e) => setSingleCallId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Ticket ID (Suporte / Chat)
                  </label>
                  <input 
                    type="text"
                    placeholder="Ex: 349102"
                    value={singleTicketId}
                    onChange={(e) => setSingleTicketId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão de Disparo */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Conectando e Auditando via Zendesk API...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Sincronizar & Auditar Atendimentos Agora</span>
                </>
              )}
            </button>
            {syncError && (
              <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Falha na Sincronização:</span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-line">{syncError}</p>
                </div>
              </div>
            )}
            {successCount !== null && (
              <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Sucesso! {successCount} novo(s) atendimento(s) capturado(s) e auditados por IA.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SEÇÃO: GESTÃO DE LINHAS ZENDESK TALK & LGPD PII MASKING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Gestão de Linhas Telefônicas / Grupos */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Linhas Telefônicas & Grupos de Voz (Zendesk Talk)
                </h3>
                <p className="text-[10px] text-slate-400">Filtre quais números e grupos de atendimento serão auditados</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDiscoverLiveLines}
              disabled={isDiscoveringLiveLines}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Radio className={`w-3.5 h-3.5 ${isDiscoveringLiveLines ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isDiscoveringLiveLines ? 'Consultando...' : 'Descobrir ao Vivo na API'}</span>
            </button>
          </div>

          {liveDiscoveryNotice && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              liveDiscoveryNotice.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{liveDiscoveryNotice.text}</span>
            </div>
          )}

          {/* Tags de Linhas / Filas Cadastradas */}
          <div className="flex flex-wrap gap-2 min-h-[50px] p-3 bg-slate-50 border border-slate-200 rounded-xl">
            {lines.length > 0 ? (
              lines.map((line) => (
                <span 
                  key={line} 
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
                >
                  <PhoneCall className="w-3 h-3 text-emerald-600" />
                  <span>{line}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(line)}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                    title="Remover linha"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Nenhuma linha filtrada. Todas as chamadas serão capturadas.</span>
            )}
          </div>

          {/* Adição manual de Linha */}
          <div className="flex items-center gap-2">
            <input 
              type="text"
              placeholder="Adicionar nome de linha ou grupo (Ex: Linha_SAC_VIP)..."
              value={newLineInput}
              onChange={(e) => setNewLineInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLine()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
          {lineSaveStatus && (
            <p className="text-[11px] font-bold text-emerald-700">{lineSaveStatus}</p>
          )}
        </div>

        {/* Proteção LGPD e Mascaramento PII */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Proteção LGPD & Anonimização
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={piiMaskingEnabled} 
                onChange={(e) => {
                  setPiiMaskingEnabled(e.target.checked);
                  handleSaveLinesAndPII(lines, e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Mascara automaticamente CPFs, telefones, números de cartão de crédito e e-mails de clientes antes da análise da IA.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase">Testar Sanitizador PII:</span>
              <button
                type="button"
                onClick={handleRunPiiTest}
                disabled={loadingPiiTest}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                {loadingPiiTest ? 'Processando...' : 'Executar Teste'}
              </button>
            </div>
            <input 
              type="text"
              value={piiTestInput}
              onChange={(e) => setPiiTestInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {piiTestOutput && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-mono text-emerald-800">
                <span className="font-bold block text-[10px] uppercase text-emerald-900 mb-0.5">Texto Sanitizado:</span>
                {piiTestOutput}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SEÇÃO: MODO RECORRENTE AUTOMÁTICO (CRON BACKGROUND) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Modo Recorrente Automático (Zendesk Daemon)</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  recurringConfig.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {recurringConfig.enabled ? 'HABILITADO' : 'DESABILITADO'}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">Varredura automática e periódica na API do Zendesk Talk sem necessidade de intervenção humana</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={recurringConfig.enabled} 
                onChange={(e) => handleToggleRecurringMode(e.target.checked)}
                disabled={loadingRecurring}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <button
              type="button"
              onClick={handleTriggerRecurringNow}
              disabled={triggeringRecurring}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Repeat className={`w-3.5 h-3.5 ${triggeringRecurring ? 'animate-spin' : ''}`} />
              <span>Disparar Varredura Agora</span>
            </button>
          </div>
        </div>

        {/* Indicadores de Status do Cron */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Frequência da Varredura</span>
            <select 
              value={recurringConfig.intervalMinutes || 60}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700"
            >
              <option value="15">A cada 15 minutos</option>
              <option value="30">A cada 30 minutos</option>
              <option value="60">A cada 1 hora (Padrão)</option>
              <option value="120">A cada 2 horas</option>
            </select>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Última Execução</span>
            <span className="font-mono font-bold text-slate-800 text-[11px] block truncate">
              {recurringConfig.lastRun ? new Date(recurringConfig.lastRun).toLocaleString('pt-BR') : 'Nunca executado'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Próxima Rodada</span>
            <span className="font-mono font-bold text-emerald-700 text-[11px] block truncate">
              {recurringConfig.nextRun ? new Date(recurringConfig.nextRun).toLocaleTimeString('pt-BR') : 'Aguardando ativação'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Capturado no Daemon</span>
            <span className="font-mono font-extrabold text-slate-900 text-sm block">
              +{recurringConfig.totalCapturedCount || 0} chamadas
            </span>
          </div>
        </div>
      </div>

      {/* CONSOLE DE LOGS EM TEMPO REAL */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white shadow-md space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-bold text-[11px] uppercase tracking-wider">
              Console de Sincronização & Logs da API Zendesk
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSyncedLog([])}
            className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Limpar Console
          </button>
        </div>

        <div className="h-44 overflow-y-auto space-y-1.5 text-[11px] text-slate-300 pr-2 select-text">
          {syncedLog.length > 0 ? (
            syncedLog.map((logLine, idx) => (
              <div 
                key={idx} 
                className={`${
                  logLine.includes('[ERRO') || logLine.includes('❌') 
                    ? 'text-rose-400 font-bold' 
                    : logLine.includes('[SUCESSO') || logLine.includes('✅') 
                    ? 'text-emerald-400 font-bold' 
                    : logLine.includes('[CONFIG') 
                    ? 'text-indigo-300' 
                    : 'text-slate-300'
                }`}
              >
                {logLine}
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">Nenhum evento registrado ainda. Dispare uma sincronização manual ou ative o modo recorrente.</div>
          )}
        </div>
      </div>

      {/* TABELA DE INTERAÇÕES RECÉM IMPORTADAS */}
      {importedItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Atendimentos Capturados Nesta Sessão ({importedItems.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
              Disponíveis na aba Auditoria
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
                  <th className="p-2.5">ID Chamada</th>
                  <th className="p-2.5">Agente Zendesk</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Duração</th>
                  <th className="p-2.5">Score Auto-QA</th>
                  <th className="p-2.5">Sentimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-indigo-650 font-bold">{item.id}</td>
                    <td className="p-2.5 font-bold text-slate-800">{item.agentName}</td>
                    <td className="p-2.5 text-slate-600">{item.customerName}</td>
                    <td className="p-2.5 font-mono text-slate-500">{item.duration}s</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.score >= 85 ? 'bg-emerald-100 text-emerald-800' : item.score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.score}/100
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="font-bold text-slate-700">{item.sentiment}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
