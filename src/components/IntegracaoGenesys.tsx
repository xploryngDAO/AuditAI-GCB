import React, { useState, useEffect } from 'react';
import { GenesysCreds, Interaction, GenesysRecurringConfig } from '../types';
import { maskCustomerName, maskPII } from '../utils/piiMasking';
import { 
  Network, 
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
  CheckCheck,
  CheckSquare,
  Square
} from 'lucide-react';

interface IntegracaoGenesysProps {
  onSyncComplete: (newItems: Interaction[]) => void;
  bpos?: string[];
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
}

export default function IntegracaoGenesys({ onSyncComplete, bpos, userEmail, userRole, tenantId }: IntegracaoGenesysProps) {
  const isMasterAdmin = userEmail === 'master@admin.com' || userRole === 'superadmin';
  const bpoOptions = (bpos && bpos.length > 0) ? bpos : [];

  const [creds, setCreds] = useState<GenesysCreds>({
    clientId: '',
    clientSecret: '',
    region: 'sa-east-1',
    autoSync: false,
    syncInterval: 15,
    searchTimeframe: '7d',
    hoursBack: 168,
    maxResults: 50,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [showSecret, setShowSecret] = useState(false);
  const [targetBpo, setTargetBpo] = useState<string>(bpoOptions[0] || '');
  const [mode, setMode] = useState<'auto' | 'single'>('auto');

  // Single conversation test fields
  const [conversationId, setConversationId] = useState('');
  const [communicationId, setCommunicationId] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [syncedLog, setSyncedLog] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [importedItems, setImportedItems] = useState<Interaction[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Modo Recorrente State
  const [recurringConfig, setRecurringConfig] = useState<GenesysRecurringConfig>({
    enabled: false,
    intervalMinutes: 60,
    targetBpo: bpoOptions[0] || '',
    totalCapturedCount: 0,
    logs: []
  });
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [triggeringRecurring, setTriggeringRecurring] = useState(false);

  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);

  // Queue Management & LGPD PII Masking State
  const [availableQueues, setAvailableQueues] = useState<string[]>(['Fila_SAC_Geral', 'Fila_Cancelamento', 'Fila_Ouvidoria']);
  const [queues, setQueues] = useState<string[]>(['Fila_SAC_Geral', 'Fila_Cancelamento', 'Fila_Ouvidoria']);
  const [queueSearchFilter, setQueueSearchFilter] = useState('');
  const [newQueueInput, setNewQueueInput] = useState('');
  const [piiMaskingEnabled, setPiiMaskingEnabled] = useState(true);
  const [piiTestInput, setPiiTestInput] = useState('Cliente solicitou alteração do CPF 123.456.789-00 e cartão 4532 1234 5678 9012. Contato pelo e-mail joao.silva@empresa.com e telefone (11) 98765-4321.');
  const [piiTestOutput, setPiiTestOutput] = useState<string | null>(null);
  const [loadingPiiTest, setLoadingPiiTest] = useState(false);
  const [savingQueues, setSavingQueues] = useState(false);
  const [queueSaveStatus, setQueueSaveStatus] = useState<string | null>(null);
  const [discoveringQueues, setDiscoveringQueues] = useState(false);
  const [discoverNotice, setDiscoverNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Helper to normalize queue list items to string names
  const normalizeQueues = (list: any[]): string[] => {
    if (!Array.isArray(list)) return [];
    return list.map(q => {
      if (typeof q === 'string') return q;
      if (typeof q === 'object' && q !== null) return q.name || q.id || String(q);
      return String(q);
    }).filter(Boolean);
  };

  useEffect(() => {
    const tid = tenantId || 'system-global';
    const email = userEmail || '';
    const headers = { 'x-tenant-id': tid, 'x-user-email': email };

    fetch(`/api/genesys/recurring?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, { headers })
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
      .catch(err => console.error("Erro ao carregar configuracao recorrente:", err));

    fetch(`/api/genesys/queues?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}&targetBpo=${encodeURIComponent(targetBpo)}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.availableQueues && Array.isArray(data.availableQueues) && data.availableQueues.length > 0) {
          setAvailableQueues(normalizeQueues(data.availableQueues));
        } else if (data.queues && Array.isArray(data.queues)) {
          setAvailableQueues(normalizeQueues(data.queues));
        }
        if (data.queues && Array.isArray(data.queues)) {
          setQueues(normalizeQueues(data.queues));
        }
        if (data.piiMaskingEnabled !== undefined) setPiiMaskingEnabled(data.piiMaskingEnabled);
      })
      .catch(err => console.error("Erro ao carregar filas do Genesys:", err));
  }, [tenantId, userEmail, targetBpo]);

  const handleSaveQueuesAndPII = async (updatedSelected?: string[], updatedAvailable?: string[], updatedPii?: boolean) => {
    const targetSelected = updatedSelected !== undefined ? normalizeQueues(updatedSelected) : normalizeQueues(queues);
    const targetAvail = updatedAvailable !== undefined ? normalizeQueues(updatedAvailable) : normalizeQueues(availableQueues);
    const targetPii = updatedPii !== undefined ? updatedPii : piiMaskingEnabled;
    setSavingQueues(true);
    setQueueSaveStatus(null);
    try {
      const res = await fetch('/api/genesys/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          queues: targetSelected, 
          availableQueues: targetAvail,
          targetBpo,
          piiMaskingEnabled: targetPii 
        })
      });
      const data = await res.json();
      if (data.success) {
        setQueues(normalizeQueues(data.queues));
        if (data.availableQueues) setAvailableQueues(normalizeQueues(data.availableQueues));
        setPiiMaskingEnabled(data.piiMaskingEnabled);
        setQueueSaveStatus(`✅ Configurações salvas: ${targetSelected.length} de ${targetAvail.length} filas ativas para captura.`);
        setTimeout(() => setQueueSaveStatus(null), 3500);
      } else {
        setQueueSaveStatus(`❌ Erro: ${data.error || 'Falha ao salvar'}`);
      }
    } catch (err: any) {
      setQueueSaveStatus(`❌ Erro: ${err.message}`);
    } finally {
      setSavingQueues(false);
    }
  };

  const handleToggleQueue = (q: string) => {
    const next = queues.includes(q) ? queues.filter(item => item !== q) : [...queues, q];
    setQueues(next);
    handleSaveQueuesAndPII(next, availableQueues, piiMaskingEnabled);
  };

  const handleSelectAllQueues = () => {
    const next = [...availableQueues];
    setQueues(next);
    handleSaveQueuesAndPII(next, availableQueues, piiMaskingEnabled);
  };

  const handleDeselectAllQueues = () => {
    const next: string[] = [];
    setQueues(next);
    handleSaveQueuesAndPII(next, availableQueues, piiMaskingEnabled);
  };

  const handleAddQueue = () => {
    if (!newQueueInput.trim()) return;
    const trimmed = newQueueInput.trim();
    const currentAvail = normalizeQueues(availableQueues);
    const nextAvail = currentAvail.includes(trimmed) ? currentAvail : [...currentAvail, trimmed];
    const currentSel = normalizeQueues(queues);
    const nextSel = currentSel.includes(trimmed) ? currentSel : [...currentSel, trimmed];
    
    setAvailableQueues(nextAvail);
    setQueues(nextSel);
    setNewQueueInput('');
    handleSaveQueuesAndPII(nextSel, nextAvail, piiMaskingEnabled);
  };

  const handleRemoveQueue = (qToRemove: string) => {
    const nextAvail = availableQueues.filter(q => q !== qToRemove);
    const nextSel = queues.filter(q => q !== qToRemove);
    setAvailableQueues(nextAvail);
    setQueues(nextSel);
    handleSaveQueuesAndPII(nextSel, nextAvail, piiMaskingEnabled);
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
      if (data.masked) {
        setPiiTestOutput(data.masked);
      }
    } catch (err) {
      console.error("Erro no teste de PII:", err);
    } finally {
      setLoadingPiiTest(false);
    }
  };

  const handleSaveGenesysConfig = async () => {
    setSavingConfig(true);
    setConfigSaveStatus(null);
    try {
      const res = await fetch('/api/genesys/config', {
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
        setConfigSaveStatus("✅ Credenciais e configurações salvas com sucesso no banco de dados!");
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

  const handleDiscoverQueues = async () => {
    if (!creds.clientId.trim() || !creds.clientSecret.trim()) {
      setDiscoverNotice({
        type: 'error',
        text: 'Preencha o Client ID e Client Secret antes de acionar a descoberta de filas.'
      });
      return;
    }
    setDiscoveringQueues(true);
    setDiscoverNotice(null);
    try {
      const res = await fetch('/api/genesys/queues/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBpo,
          creds: {
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            region: creds.region
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.region && (data.region.includes('sae1') || data.region.includes('sa-east'))) {
          setCreds(prev => ({ ...prev, region: 'sa-east-1' }));
        } else if (data.region && data.region.includes('mypurecloud.com')) {
          setCreds(prev => ({ ...prev, region: 'us-east-1' }));
        }
        
        const liveList = Array.isArray(data.availableQueues) 
          ? data.availableQueues 
          : (Array.isArray(data.queues) ? data.queues : []);

        if (liveList.length > 0) {
          const mergedAvail = Array.from(new Set([...availableQueues, ...liveList]));
          const mergedSel = Array.from(new Set([...queues, ...liveList]));
          setAvailableQueues(mergedAvail);
          setQueues(mergedSel);
          handleSaveQueuesAndPII(mergedSel, mergedAvail, piiMaskingEnabled);
          setDiscoverNotice({
            type: 'success',
            text: `Região detectada: ${data.region || 'sae1.pure.cloud'}. ${liveList.length} fila(s) ativa(s) identificada(s) e adicionada(s) para o ${targetBpo}!`
          });
        } else {
          setDiscoverNotice({
            type: 'success',
            text: `Autenticado com sucesso na região ${data.region || 'sae1.pure.cloud'}! Nenhuma fila adicional encontrada além das cadastradas.`
          });
        }
      } else {
        setDiscoverNotice({
          type: 'error',
          text: data.error || 'Não foi possível autenticar na API para descoberta de filas. Verifique as credenciais.'
        });
      }
    } catch (err: any) {
      setDiscoverNotice({
        type: 'error',
        text: `Erro ao descobrir filas: ${err.message}`
      });
    } finally {
      setDiscoveringQueues(false);
    }
  };

  const handleToggleRecurringMode = async (enabled: boolean) => {
    setLoadingRecurring(true);
    try {
      const res = await fetch('/api/genesys/recurring', {
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
      const res = await fetch('/api/genesys/recurring', {
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
      const res = await fetch('/api/genesys/recurring/trigger', {
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
      setSyncError(err.message || "Erro ao disparar varredura recorrente na Genesys Cloud.");
    } finally {
      setTriggeringRecurring(false);
    }
  };

  const handleToggleAutoSync = () => {
    setCreds(prev => ({ ...prev, autoSync: !prev.autoSync }));
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSuccessCount(null);
    setSyncError(null);

    if (!creds.clientId.trim() || !creds.clientSecret.trim()) {
      const err = "Por favor preencha o Genesys Client ID e Client Secret nos campos ao lado antes de sincronizar.";
      setSyncError(err);
      setSyncedLog([
        `[${new Date().toLocaleTimeString()}] [ERRO] ${err}`,
        `[${new Date().toLocaleTimeString()}] Acesse o portal Genesys Cloud (Admin > Integrations > OAuth) para obter suas credenciais Client Credentials.`
      ]);
      setSyncing(false);
      return;
    }

    const initialLog = [
      `[${new Date().toLocaleTimeString()}] Iniciando conexão com a Genesys Cloud Platform API...`,
      `[${new Date().toLocaleTimeString()}] Datacenter Selecionado: ${creds.region}`,
      `[${new Date().toLocaleTimeString()}] Solicitando autenticação OAuth2 (Client Credentials Grant)...`
    ];
    setSyncedLog(initialLog);

    try {
      const payload: any = {
        creds,
        targetBpo
      };

      if (mode === 'single') {
        if (!conversationId.trim() || !communicationId.trim()) {
          throw new Error("Por favor informe o Conversation ID e o Communication ID para buscar a transcrição individual.");
        }
        payload.conversationId = conversationId.trim();
        payload.communicationId = communicationId.trim();
      }

      const response = await fetch('/api/genesys/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
        setSyncError(data.error || "Falha na comunicação com a API da Genesys Cloud.");
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
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/80 rounded-2xl text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300 shrink-0">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-indigo-300 block tracking-wider">
                  Governança SaaS Master de Sistemas e Integrações
                </span>
                <h2 className="text-sm font-extrabold text-white">
                  Controle do Conector Genesys Cloud STA & Gateways
                </h2>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Gateway Ativo & Homologado
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Como administrador <strong>master@admin.com</strong>, você controla a disponibilidade dos conectores e sistemas de telefonia na plataforma AuditaQA. As empresas contratantes (Tenants) utilizam este conector para inserir suas credenciais OAuth privadas, mapear filas de atendimento e configurar a proteção de PII/LGPD em seus respectivos ambientes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-800/80 border border-indigo-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Sistemas Habilitados</span>
              <span className="text-xs font-bold text-emerald-400">Genesys Cloud STA v2 (Ativo)</span>
            </div>
            <div className="p-3 bg-slate-800/80 border border-indigo-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Status do Webhook Listener</span>
              <span className="text-xs font-bold text-indigo-300">Escuta Recorrente 200 OK</span>
            </div>
            <div className="p-3 bg-slate-800/80 border border-indigo-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Isolamento de Credenciais</span>
              <span className="text-xs font-bold text-amber-300">Chaves mantidas por Tenant</span>
            </div>
          </div>
        </div>
      )}

      {/* Banner Informativo sobre a API Speech & Text Analytics */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-4 rounded-xl text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-lg text-indigo-400 shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <span>Conector Nativo Genesys Cloud Platform API</span>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded text-[9px] font-mono">v2 / Speech & Text Analytics</span>
            </h2>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Captura automatizada de áudio e transcrições via <strong>Speech & Text Analytics API</strong> (<code className="text-indigo-200 font-mono text-[10px]">/transcripturl</code>) com OAuth2 Client Credentials grant e execução direta da matriz de regras do tenant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <a 
            href="https://developer.genesys.cloud/devapps/api-explorer" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Genesys API Explorer</span>
          </a>
        </div>
      </div>

      {/* CARD DO MODO RECORRENTE (CAPTURA DE HORA EM HORA) */}
      <div className="ds-card p-5 border-l-4 border-l-indigo-600 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/50 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Repeat className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span>Modo Recorrente (Agendamento Automático)</span>
                {recurringConfig.enabled ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Ativo de Hora em Hora
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                    Desativado
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                O servidor varre a fila da Genesys automaticamente a cada hora, identifica atendentes e consumidores e executa a auditoria por IA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => handleToggleRecurringMode(!recurringConfig.enabled)}
              disabled={loadingRecurring}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                recurringConfig.enabled
                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {loadingRecurring ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : recurringConfig.enabled ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Desativar Modo Recorrente</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Ativar Modo Recorrente (De hora em hora)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Métrica e Frequência do Agendamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Frequência de Captura</label>
            <select 
              value={recurringConfig.intervalMinutes || 60}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="ds-select w-full text-xs font-bold text-slate-800"
            >
              <option value={60}>A cada 1 Hora (60 min) [Recomendado]</option>
              <option value={30}>A cada 30 Minutos</option>
              <option value={120}>A cada 2 Horas</option>
              <option value={360}>A cada 6 Horas</option>
            </select>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Próxima Rodada Agendada</span>
            <span className="text-xs font-extrabold text-indigo-700 block mt-1">
              {recurringConfig.enabled && recurringConfig.nextRun ? (
                new Date(recurringConfig.nextRun).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              ) : (
                'Modo Pausado'
              )}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Casos Capturados no Ciclo</span>
            <span className="text-xs font-extrabold text-emerald-700 block mt-1">
              {recurringConfig.totalCapturedCount || 0} chamadas
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex flex-col justify-center">
            <button
              type="button"
              onClick={handleTriggerRecurringNow}
              disabled={triggeringRecurring}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {triggeringRecurring ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              )}
              <span>Disparar Rodada Agora</span>
            </button>
          </div>
        </div>

        {/* Logs do Agendador Recorrente */}
        {recurringConfig.logs && recurringConfig.logs.length > 0 && (
          <div className="p-3 bg-slate-950 rounded-lg text-slate-300 font-mono text-[10px] max-h-28 overflow-y-auto space-y-1 border border-slate-800">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Historico do Agendador de Fundo</span>
              <span>Último Status: {recurringConfig.lastRunStatus || 'Operacional'}</span>
            </div>
            {recurringConfig.logs.slice(0, 5).map((line, idx) => (
              <div key={idx} className="leading-relaxed border-b border-slate-900 pb-0.5 last:border-0">{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* SEÇÃO 2: GERENCIAMENTO DE FILAS & PROTEÇÃO DE DADOS (LGPD / PII) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CARD 1: GERENCIAMENTO DINÂMICO DE FILAS */}
        <div className="ds-card p-5 border-l-4 border-l-emerald-600 bg-white space-y-4 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-150 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-850 uppercase tracking-wide flex items-center gap-2">
                  <span>Filas de Atendimento Habilitadas</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    queues.length > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {queues.length} de {availableQueues.length} Selecionadas
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Operação atual: <strong>{targetBpo}</strong>. Apenas chamadas das filas ativas abaixo serão capturadas.
                </p>
              </div>
            </div>

            {/* Ações de Descoberta e Seleção Rápida */}
            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleSelectAllQueues}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Marcar todas as filas disponíveis"
              >
                <CheckCheck className="w-3 h-3 text-emerald-600" />
                <span>Todas</span>
              </button>

              <button
                type="button"
                onClick={handleDeselectAllQueues}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Desmarcar todas as filas"
              >
                <Square className="w-3 h-3 text-slate-500" />
                <span>Nenhuma</span>
              </button>

              <button
                type="button"
                onClick={handleDiscoverQueues}
                disabled={discoveringQueues}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${discoveringQueues ? 'animate-spin' : ''}`} />
                <span>Descobrir na API</span>
              </button>
            </div>
          </div>

          {discoverNotice && (
            <div className={`p-2.5 rounded-lg border text-xs font-medium ${
              discoverNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {discoverNotice.text}
            </div>
          )}

          {/* Barra de Pesquisa de Filas */}
          {availableQueues.length > 4 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queueSearchFilter}
                onChange={(e) => setQueueSearchFilter(e.target.value)}
                placeholder="Filtrar filas disponíveis..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
              {queueSearchFilter && (
                <button
                  type="button"
                  onClick={() => setQueueSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Cards Interativos de Seleção de Filas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
            {normalizeQueues(availableQueues)
              .filter(q => !queueSearchFilter.trim() || q.toLowerCase().includes(queueSearchFilter.toLowerCase()))
              .map((q) => {
                const isSelected = queues.includes(q);

                return (
                  <div 
                    key={q} 
                    onClick={() => handleToggleQueue(q)}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{q}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        isSelected ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isSelected ? '✓ Ativa' : 'Ignorada'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQueue(q)}
                        className="text-slate-300 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                        title="Remover fila do catálogo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

            {normalizeQueues(availableQueues).length === 0 && (
              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Nenhuma fila definida para o {targetBpo}. Adicione ou descubra na API.</span>
              </div>
            )}
          </div>

          {/* Adicionar nova fila */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Nome ou ID da Fila (ex: Fila_SAC_Premium, Queue_Chat_Vendas)"
              value={newQueueInput}
              onChange={(e) => setNewQueueInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddQueue(); }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="button"
              onClick={handleAddQueue}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Incluir Fila</span>
            </button>
          </div>

          {queueSaveStatus && (
            <div className="text-[11px] font-bold text-emerald-700 pt-1">
              {queueSaveStatus}
            </div>
          )}
        </div>

        {/* CARD 2: SEGURANÇA E MASCARAMENTO DE PII (LGPD) */}
        <div className="ds-card p-5 border-l-4 border-l-indigo-600 bg-white space-y-4 shadow-sm text-left">
          <div className="flex items-center justify-between border-b border-slate-150 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-850 uppercase tracking-wide flex items-center gap-2">
                  <span>Proteção e Mascaramento de Dados Sensíveis (LGPD)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    piiMaskingEnabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {piiMaskingEnabled ? 'Anonymization Ativa' : 'Desativado'}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Remove CPFs, cartões de crédito, e-mails e telefones antes do envio para modelos de IA.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !piiMaskingEnabled;
                setPiiMaskingEnabled(next);
                handleSaveQueuesAndPII(queues, availableQueues, next);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                piiMaskingEnabled
                  ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {piiMaskingEnabled ? 'Mascaramento Ativo' : 'Ativar LGPD Guard'}
            </button>
          </div>

          {/* Testador em Tempo Real de PII */}
          <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase">
              <span>Simulador de Anonymization (Teste LGPD)</span>
              <button
                type="button"
                onClick={handleRunPiiTest}
                disabled={loadingPiiTest}
                className="text-indigo-600 hover:text-indigo-800 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                {loadingPiiTest ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LockKeyhole className="w-3 h-3" />}
                <span>Testar Anonymization</span>
              </button>
            </div>

            <textarea
              rows={2}
              value={piiTestInput}
              onChange={(e) => setPiiTestInput(e.target.value)}
              placeholder="Digite um texto contendo CPF, Cartão ou E-mail para testar..."
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            />

            {piiTestOutput && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs font-mono text-emerald-900 space-y-1">
                <span className="block text-[9px] font-extrabold uppercase text-emerald-700">Resultado Mascarado (Sem Vazamentos de PII):</span>
                <p className="leading-snug">{piiTestOutput}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Coluna 1: Parâmetros OAuth2 e Filtros */}
        <div className="lg:col-span-1 ds-card p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Credenciais OAuth2</span>
            </h3>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Genesys Client ID</label>
            <input 
              type="text"
              value={creds.clientId}
              onChange={(e) => setCreds(prev => ({ ...prev, clientId: e.target.value }))}
              placeholder="ex: 12345678-abcd-1234-ef01-1234567890ab"
              className="ds-input font-mono text-[11px]"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Genesys Client Secret</label>
            <div className="relative">
              <input 
                type={showSecret ? "text" : "password"}
                value={creds.clientSecret}
                onChange={(e) => setCreds(prev => ({ ...prev, clientSecret: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••"
                className="ds-input font-mono text-[11px] pr-9"
              />
              <button 
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Region Datacenter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Região Datacenter (Environment)</label>
            <select 
              value={creds.region}
              onChange={(e) => setCreds(prev => ({ ...prev, region: e.target.value }))}
              className="ds-select w-full"
            >
              <option value="sa-east-1">sa-east-1 (América do Sul / São Paulo - sae1.pure.cloud)</option>
              <option value="us-east-1">us-east-1 (Americas East / N. Virginia - mypurecloud.com)</option>
              <option value="us-west-2">us-west-2 (Americas West / Oregon - usw2.pure.cloud)</option>
              <option value="us-east-2">us-east-2 (Americas East / Ohio - use2.usw2.pure.cloud)</option>
              <option value="cac1">cac1 (Canadá / Central - cac1.pure.cloud)</option>
              <option value="eu-west-1">eu-west-1 (Europa / Irlanda - mypurecloud.ie)</option>
              <option value="eu-central-1">eu-central-1 (Europa / Frankfurt - mypurecloud.de)</option>
              <option value="eu-west-2">eu-west-2 (Europa / Londres - euw2.pure.cloud)</option>
              <option value="ap-southeast-2">ap-southeast-2 (Ásia Pacífico / Sydney - mypurecloud.com.au)</option>
            </select>
          </div>

          {/* Target BPO */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Atribuir ao Parceiro BPO</label>
            <select 
              value={targetBpo}
              onChange={(e) => setTargetBpo(e.target.value)}
              className="ds-select w-full"
            >
              {bpoOptions.map((bpo) => (
                <option key={bpo} value={bpo}>{bpo}</option>
              ))}
            </select>
          </div>

          {/* Search Timeframe & Interval */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-700 uppercase">Janela de Busca (Intervalo API)</label>
              <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150">
                {creds.searchTimeframe === '24h' ? '24 Horas' : creds.searchTimeframe === '3d' ? '3 Dias' : creds.searchTimeframe === '7d' ? '7 Dias' : creds.searchTimeframe === '30d' ? '30 Dias' : creds.searchTimeframe === '90d' ? '90 Dias' : 'Personalizado'}
              </span>
            </div>

            <select 
              value={creds.searchTimeframe || '7d'}
              onChange={(e) => {
                const val = e.target.value as any;
                const hours = val === '24h' ? 24 : val === '3d' ? 72 : val === '7d' ? 168 : val === '30d' ? 720 : val === '90d' ? 2160 : 168;
                setCreds(prev => ({ ...prev, searchTimeframe: val, hoursBack: hours }));
              }}
              className="ds-select w-full"
            >
              <option value="24h">Últimas 24 Horas</option>
              <option value="3d">Últimos 3 Dias (72 horas)</option>
              <option value="7d">Últimos 7 Dias (Recomendado)</option>
              <option value="30d">Últimos 30 Dias (1 Mês)</option>
              <option value="90d">Últimos 90 Dias (Trimestral)</option>
              <option value="custom">📅 Período Personalizado (De / Até)</option>
            </select>

            {creds.searchTimeframe === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Data Inicial</label>
                  <input 
                    type="date"
                    value={creds.startDate || ''}
                    onChange={(e) => setCreds(prev => ({ ...prev, startDate: e.target.value }))}
                    className="ds-input text-[10px] h-[32px] py-1"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Data Final</label>
                  <input 
                    type="date"
                    value={creds.endDate || ''}
                    onChange={(e) => setCreds(prev => ({ ...prev, endDate: e.target.value }))}
                    className="ds-input text-[10px] h-[32px] py-1"
                  />
                </div>
              </div>
            )}

            <div className="pt-1">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Limite p/ Busca</label>
                <select
                  value={creds.maxResults || 50}
                  onChange={(e) => setCreds(prev => ({ ...prev, maxResults: Number(e.target.value) }))}
                  className="ds-select w-full h-[32px] text-[10px] py-1"
                >
                  <option value={20}>20 Chamadas</option>
                  <option value={50}>50 Chamadas</option>
                  <option value={100}>100 Chamadas</option>
                  <option value={200}>200 Chamadas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">Modo de Captura API</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  mode === 'auto'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Varredura / Lote</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  mode === 'single'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Search className="w-3 h-3" />
                <span>Por ConversationId</span>
              </button>
            </div>
          </div>

          {mode === 'single' && (
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg space-y-2 animate-fade-in">
              <span className="text-[10px] font-bold text-indigo-950 uppercase block">Captura Específica por IDs da API</span>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Conversation ID</label>
                <input 
                  type="text" 
                  value={conversationId}
                  onChange={(e) => setConversationId(e.target.value)}
                  placeholder="ex: c85d7f12-0921-4f22-9112-a18274d1a291"
                  className="ds-input font-mono text-[10px]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Communication ID</label>
                <input 
                  type="text" 
                  value={communicationId}
                  onChange={(e) => setCommunicationId(e.target.value)}
                  placeholder="ex: comm-8821a990-1120-4321"
                  className="ds-input font-mono text-[10px]"
                />
              </div>
            </div>
          )}

          {/* Toggle Sincronização Contínua */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              <span className="block text-[10px] font-bold text-slate-700 uppercase">Pull Agendado</span>
              <span className="block text-[9px] text-slate-400">Sincronização em segundo plano</span>
            </div>
            <button 
              type="button"
              onClick={handleToggleAutoSync}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${creds.autoSync ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${creds.autoSync ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Action to Save Configuration to Database */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {configSaveStatus && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-[10.5px] font-semibold animate-fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{configSaveStatus}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveGenesysConfig}
              disabled={savingConfig}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded text-xs font-extrabold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {savingConfig ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando no Banco...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Credenciais e Parâmetros</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Coluna 2: Console de Telemetria de Integração e Ações */}
        <div className="lg:col-span-2 ds-card p-4 flex flex-col justify-between">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Console de Execução e Logs da API Genesys</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                SDK OAuth2 & SpeechTextAnalytics
              </span>
            </div>

            {/* Terminal Window */}
            <div className="bg-slate-950 text-slate-200 font-mono text-[10px] p-3 rounded-lg flex-1 h-64 overflow-y-auto space-y-1.5 border border-slate-900 leading-relaxed shadow-inner">
              {syncedLog.map((log, idx) => {
                const isError = log.includes('[ERRO]');
                const isSuccess = log.includes('[SUCESSO]') || log.includes('concluída com sucesso');
                const isWarning = log.includes('[AVISO]');
                
                return (
                  <div 
                    key={idx} 
                    className={
                      isError 
                        ? 'text-rose-400 font-bold bg-rose-950/40 p-1 rounded border border-rose-900/50' 
                        : isSuccess 
                          ? 'text-emerald-400 font-bold' 
                          : isWarning 
                            ? 'text-amber-300' 
                            : 'text-slate-300'
                    }
                  >
                    {log}
                  </div>
                );
              })}

              {syncedLog.length === 0 && (
                <div className="text-slate-500 italic text-center py-20 uppercase tracking-wider font-semibold">
                  Aguardando acionamento da API da Genesys Cloud...
                </div>
              )}
            </div>

            {syncError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold leading-relaxed whitespace-pre-line">
                🚨 <strong>Aviso da Integração Genesys:</strong>
                <div className="mt-1 text-[11px] leading-relaxed">{syncError}</div>
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-100 mt-4 flex-wrap gap-2">
            <div>
              {successCount !== null && (
                <div className="flex items-center gap-1.5 p-1 px-3 bg-emerald-50 text-emerald-800 border border-emerald-250 text-[11px] font-bold rounded-lg uppercase">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+{successCount} interações capturadas e auditadas!</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="ds-btn-primary px-6 py-2"
              id="syncNowBtn"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processando API Genesys...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Sincronizar Agora com Genesys</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Tabela de Interações Importadas Recentes */}
      {importedItems.length > 0 && (
        <div className="ds-card p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Últimos Atendimentos Importados da Genesys API ({importedItems.length})</span>
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-2.5">ID / Origem</th>
                  <th className="p-2.5">Atendente</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Canal</th>
                  <th className="p-2.5 text-center">Nota Auto-QA</th>
                  <th className="p-2.5 text-center">Aderência Script</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {importedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-mono text-[10px] text-slate-600">
                      <span className="font-bold text-indigo-650 block">{item.id.substring(0, 16)}...</span>
                      <span className="text-[9px] text-slate-400">External: {item.genesysExternalId || item.id}</span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">{item.agentName}</td>
                    <td className="p-2.5 text-slate-600">{piiMaskingEnabled ? maskCustomerName(item.customerName) : item.customerName}</td>
                    <td className="p-2.5 uppercase text-[10px] font-bold text-slate-500">
                      {item.channel === 'audio' ? '🔊 Áudio / Voz' : '💬 Chat Texto'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-xs ${
                        item.score >= 80 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : item.score >= 50 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.score}/100
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-slate-700">
                      {item.scriptAdherence}%
                    </td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Auditado
                      </span>
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
