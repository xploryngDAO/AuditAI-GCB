import React, { useState, useEffect } from 'react';
import { 
  Network, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  Globe, 
  PhoneCall, 
  Cloud, 
  Server, 
  MessageSquare, 
  Play, 
  Zap, 
  Building2,
  ChevronRight,
  Activity,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  CheckCheck,
  CheckSquare,
  Square,
  Search,
  Radio,
  SlidersHorizontal,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Clock,
  Plus,
  Trash2,
  Lock,
  ListFilter,
  Filter,
  UploadCloud
} from 'lucide-react';
import { Interaction, AuditConfig } from '../types';
import IngestaoLote from './IngestaoLote';

interface BpoConfig {
  enabled: boolean;
  creds: Record<string, string>;
  queues: string[];
  availableQueues?: string[];
  intervalMinutes: number;
  recurringEnabled: boolean;
  lastRun: string | null;
  lastRunStatus: string | null;
  nextRun: string | null;
  totalCapturedCount: number;
  logs: string[];
}

interface SystemIntegration {
  id: string;
  name: string;
  vendor: string;
  type: 'telephony' | 'chat' | 'omnichannel' | 'webhook';
  description: string;
  iconName: string;
  masterEnabled: boolean;
  version: string;
  authType: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
  availableQueues?: string[];
  tenantEnabled: boolean;
  tenantCreds: Record<string, string>;
  targetBpo: string;
  bpoConfigs?: Record<string, BpoConfig>;
  lastSync: string | null;
}

interface GlobalHealthItem {
  systemId: string;
  name: string;
  vendor: string;
  type: string;
  iconName: string;
  masterEnabled: boolean;
  status: 'operational' | 'degraded' | 'maintenance' | 'offline';
  statusText: string;
  uptimePercent: number | null;
  pingMs: number | null;
  activeTenantsCount: number;
  totalIngestedInteractions: number;
  gatewayUrl: string;
  rateLimitPerMin: number;
  currentUtilizationPercent: number;
  globalTimeoutMs: number;
  authType: string;
  tlsVersion: string;
  cipherSuite: string;
  circuitBreakerStatus: string;
  lastProbeTimestamp: string;
  lastProbeStatus: number | null;
}

interface DiagnosticStep {
  id: string;
  name: string;
  status: 'passed' | 'warning' | 'failed';
  latencyMs: number;
  detail: string;
}

interface DiagnosticResult {
  success: boolean;
  systemId: string;
  systemName: string;
  testType: string;
  latencyMs: number;
  httpStatus: number;
  statusText: string;
  diagnosticSteps: DiagnosticStep[];
  logs: string[];
  payloadResponse: any;
  timestamp: string;
}

interface HubIntegracoesProps {
  onSyncComplete: (newItems: Interaction[]) => void;
  bpos?: string[];
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
  activeConfig?: AuditConfig | null;
  onIngestProcessed?: (newItems: Interaction[]) => void;
}

export default function HubIntegracoes({ 
  onSyncComplete, 
  bpos = [],
  userEmail = 'master@casasbahia.com',
  userRole = 'admin',
  tenantId = 'system-global',
  activeConfig = null,
  onIngestProcessed
}: HubIntegracoesProps) {
  const isMasterAdmin = userEmail === 'master@admin.com' || userRole === 'superadmin';

  const [systems, setSystems] = useState<SystemIntegration[]>([]);
  const [activeBposList, setActiveBposList] = useState<string[]>(bpos);
  const [selectedSystemId, setSelectedSystemId] = useState<string>('genesys');
  const [selectedBpo, setSelectedBpo] = useState<string>(bpos[0] || 'BPO Alpha');
  const isManualIngestion = selectedSystemId === 'manual_ingestion';

  // Global Health State (for Master SaaS)
  const [globalHealthData, setGlobalHealthData] = useState<{
    globalUptimePercent: number | null;
    averageLatencyMs: number | null;
    totalSystemsCount: number;
    operationalSystemsCount: number;
    circuitBreakerGlobal: string;
    webhookIngestionUrl: string;
    systems: GlobalHealthItem[];
  } | null>(null);

  // Diagnostic Test States
  const [testingSysId, setTestingSysId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, DiagnosticResult>>({});
  const [selectedModalResult, setSelectedModalResult] = useState<DiagnosticResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Tenant Specific States
  const [bpoCreds, setBpoCreds] = useState<Record<string, string>>({
    clientId: '',
    clientSecret: '',
    orgName: 'mypurecloud.com',
    subdomain: '',
    adminEmail: '',
    apiToken: '',
    accountSid: '',
    authToken: '',
    webhookSecret: ''
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Available vs Selected Queues for the currently active BPO and System (isolated)
  const [availableQueues, setAvailableQueues] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [queueSearchFilter, setQueueSearchFilter] = useState('');
  const [newQueueInput, setNewQueueInput] = useState('');

  const [bpoInterval, setBpoInterval] = useState<number>(30);
  const [bpoRecurringActive, setBpoRecurringActive] = useState<boolean>(true);
  const [bpoIsEnabled, setBpoIsEnabled] = useState<boolean>(true);
  const [piiMaskingEnabled, setPiiMaskingEnabled] = useState(true);
  const [isDiscoveringLiveQueues, setIsDiscoveringLiveQueues] = useState(false);
  const [liveQueueNotice, setLiveQueueNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const [totalCapturedCount, setTotalCapturedCount] = useState<number>(0);

  const effectiveTenantId = (tenantId && tenantId !== 'undefined' && tenantId !== 'null' && String(tenantId).trim() !== '') ? tenantId : 'system-global';

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const [integrationsRes, bposRes] = await Promise.all([
        fetch(`/api/integrations?tenantId=${encodeURIComponent(effectiveTenantId)}&userEmail=${encodeURIComponent(userEmail)}`),
        fetch(`/api/bpos?tenantId=${encodeURIComponent(effectiveTenantId)}`)
      ]);

      let unifiedBposList: string[] = [];
      if (bposRes.ok) {
        const bpoData = await bposRes.json();
        const rawList = Array.isArray(bpoData) ? bpoData : (bpoData.bpos || []);
        unifiedBposList = rawList.filter((b: string) => b && b.trim().length > 0 && b.trim() !== 'A');
      }

      if (integrationsRes.ok) {
        const data = await integrationsRes.json();
        const loadedSystems = data.systems || [];
        setSystems(loadedSystems);
        
        if (Array.isArray(data.bpos) && data.bpos.length > 0) {
          data.bpos.forEach((b: string) => {
            if (b && b.trim().length > 0 && b.trim() !== 'A' && !unifiedBposList.includes(b.trim())) {
              unifiedBposList.push(b.trim());
            }
          });
        }
      }

      if (bpos && bpos.length > 0) {
        bpos.forEach((b: string) => {
          if (b && b.trim().length > 0 && b.trim() !== 'A' && !unifiedBposList.includes(b.trim())) {
            unifiedBposList.push(b.trim());
          }
        });
      }

      if (unifiedBposList.length > 0) {
        setActiveBposList(unifiedBposList);
        setSelectedBpo(prev => (unifiedBposList.includes(prev) ? prev : unifiedBposList[0]));
      }
    } catch (err) {
      console.error("Erro ao carregar catálogo de sistemas de integração:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalHealth = async () => {
    try {
      const res = await fetch('/api/integrations/health');
      if (res.ok) {
        const data = await res.json();
        setGlobalHealthData(data);
      }
    } catch (err) {
      console.error("Erro ao buscar saúde global de integrações:", err);
    }
  };

  // Load tenant connector configuration strictly isolated for selected system + selected bpo
  const loadTenantConfigForCurrentSelection = async () => {
    if (isMasterAdmin) return;
    setLiveQueueNotice(null);
    setQueueSearchFilter('');
    setNewQueueInput('');

    try {
      const activeSys = systems.find(s => s.id === selectedSystemId);
      if (activeSys) {
        const bpoCfg = activeSys.bpoConfigs?.[selectedBpo];
        if (bpoCfg) {
          setBpoCreds({
            clientId: bpoCfg.creds?.clientId || '',
            clientSecret: bpoCfg.creds?.clientSecret || '',
            orgName: bpoCfg.creds?.orgName || bpoCfg.creds?.region || bpoCfg.creds?.environment || (selectedSystemId === 'genesys' ? 'sae1.pure.cloud' : ''),
            subdomain: bpoCfg.creds?.subdomain || '',
            adminEmail: bpoCfg.creds?.adminEmail || '',
            apiToken: bpoCfg.creds?.apiToken || '',
            accountSid: bpoCfg.creds?.accountSid || '',
            authToken: bpoCfg.creds?.authToken || '',
            webhookSecret: bpoCfg.creds?.webhookSecret || ''
          });
          setBpoIsEnabled(bpoCfg.enabled ?? true);
          setBpoRecurringActive(bpoCfg.recurringEnabled ?? (selectedSystemId === 'genesys'));
          setBpoInterval(bpoCfg.intervalMinutes || 30);

          const avail = Array.isArray(bpoCfg.availableQueues) && bpoCfg.availableQueues.length > 0
            ? bpoCfg.availableQueues
            : (Array.isArray(bpoCfg.queues) && bpoCfg.queues.length > 0 ? bpoCfg.queues : []);
          
          const sel = Array.isArray(bpoCfg.queues) && bpoCfg.queues.length > 0
            ? bpoCfg.queues
            : avail;

          setAvailableQueues(avail);
          setSelectedQueues(sel);

          setSyncLogs(bpoCfg.logs ? bpoCfg.logs.slice(0, 15) : []);
          setTotalCapturedCount(bpoCfg.totalCapturedCount || 0);
          setLastSyncTimestamp(bpoCfg.lastRun || null);
          return;
        }
      }

      // If no stored config exists for this specific system + BPO, reset all fields cleanly
      setBpoCreds({
        clientId: '',
        clientSecret: '',
        orgName: selectedSystemId === 'genesys' ? 'sae1.pure.cloud' : '',
        subdomain: '',
        adminEmail: '',
        apiToken: '',
        accountSid: '',
        authToken: '',
        webhookSecret: ''
      });
      setBpoIsEnabled(true);
      setBpoRecurringActive(false);
      setBpoInterval(30);
      setAvailableQueues([]);
      setSelectedQueues([]);
      setSyncLogs([]);
      setTotalCapturedCount(0);
      setLastSyncTimestamp(null);
    } catch (err) {
      console.warn("Erro ao ler configurações do conector:", err);
      setAvailableQueues([]);
      setSelectedQueues([]);
    }
  };

  useEffect(() => {
    fetchSystems();
    if (isMasterAdmin) {
      fetchGlobalHealth();
    }

    const handleSyncTenants = () => {
      fetchSystems();
    };

    window.addEventListener('bposUpdated', handleSyncTenants);
    window.addEventListener('tenantsUpdated', handleSyncTenants);

    return () => {
      window.removeEventListener('bposUpdated', handleSyncTenants);
      window.removeEventListener('tenantsUpdated', handleSyncTenants);
    };
  }, [effectiveTenantId, userEmail, isMasterAdmin]);

  useEffect(() => {
    // Immediately clear state when switching system or BPO
    setAvailableQueues([]);
    setSelectedQueues([]);
    setLiveQueueNotice(null);

    if (!isMasterAdmin && !isManualIngestion) {
      loadTenantConfigForCurrentSelection();
    }
  }, [selectedSystemId, selectedBpo, isMasterAdmin, isManualIngestion, systems]);

  // Periodic status poll
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMasterAdmin) {
        fetch('/api/integrations/health')
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) setGlobalHealthData(data);
          })
          .catch(() => {});
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [effectiveTenantId, userEmail, isMasterAdmin]);

  // Liga/desliga a recorrência com efeito imediato no servidor. O botão
  // "Salvar Configurações" continua persistindo credenciais/filas, mas o
  // desligamento não pode depender de outro clique.
  const handleToggleRecurring = async (nextEnabled: boolean) => {
    setBpoRecurringActive(nextEnabled);
    if (selectedSystemId !== 'genesys') return;
    try {
      const res = await fetch('/api/genesys/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      if (!res.ok) throw new Error('Falha ao salvar o estado da recorrência.');
      setFeedbackMsg({
        type: 'success',
        text: nextEnabled
          ? 'Recorrência ativada. A próxima varredura automática será agendada.'
          : 'Recorrência desativada. Nenhuma nova captura automática será iniciada.'
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Não foi possível ${nextEnabled ? 'ativar' : 'desativar'} a recorrência: ${err.message}`
      });
    }
  };

  // Save Tenant BPO Config with explicit Queue Selection & Credential isolation
  const handleSaveTenantBpoConfig = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      // 1. Universal save to BPO isolated storage
      const res = await fetch('/api/integrations/tenant/bpo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: selectedSystemId,
          bpoName: selectedBpo,
          creds: bpoCreds,
          queues: selectedQueues,
          availableQueues: availableQueues,
          enabled: bpoIsEnabled,
          recurringEnabled: bpoRecurringActive,
          intervalMinutes: bpoInterval,
          tenantId: effectiveTenantId,
          userEmail
        })
      });

      // 2. If Genesys, also sync with genesys config
      if (selectedSystemId === 'genesys') {
        try {
          await fetch('/api/genesys/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creds: {
                clientId: bpoCreds.clientId,
                clientSecret: bpoCreds.clientSecret,
                orgName: bpoCreds.orgName || 'sae1.pure.cloud'
              },
              targetBpo: selectedBpo,
              enabled: bpoRecurringActive,
              intervalMinutes: bpoInterval
            })
          });

          await fetch('/api/genesys/queues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queues: selectedQueues,
              piiMaskingEnabled
            })
          });
        } catch (e) {
          console.warn("Genesys auxiliary sync notice:", e);
        }
      }

      if (res.ok) {
        setFeedbackMsg({
          type: 'success',
          text: `Configurações do ${selectedBpo} no conector salvas com sucesso! (${selectedQueues.length} de ${availableQueues.length} filas ativas para captura).`
        });
        await fetchSystems();
      } else {
        const errData = await res.json().catch(() => ({}));
        setFeedbackMsg({
          type: 'error',
          text: errData.error || 'Não foi possível salvar as configurações do conector.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao salvar configurações: ${err.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  // Run On-Demand Sync/Capture
  const handleTriggerSyncNow = async () => {
    if (selectedQueues.length === 0) {
      setFeedbackMsg({
        type: 'error',
        text: `Nenhuma fila selecionada para captura no ${selectedBpo}. Marque ao menos uma fila antes de sincronizar.`
      });
      return;
    }

    setSyncing(true);
    setFeedbackMsg(null);
    try {
      let res;
      if (selectedSystemId === 'genesys') {
        res = await fetch('/api/genesys/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creds: {
              clientId: bpoCreds.clientId,
              clientSecret: bpoCreds.clientSecret,
              orgName: bpoCreds.orgName || 'mypurecloud.com'
            },
            targetBpo: selectedBpo,
            queues: selectedQueues,
            tenantId: effectiveTenantId
          })
        });
      } else {
        res = await fetch('/api/integrations/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemId: selectedSystemId,
            targetBpo: selectedBpo,
            creds: bpoCreds,
            queues: selectedQueues,
            tenantId: effectiveTenantId,
            userEmail
          })
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Captura concluída! ${data.count || 0} atendimento(s) foram sincronizados para a base de auditoria.`
        });
        if (data.logs) {
          setSyncLogs(data.logs.slice(0, 20));
        }
        if (data.syncedItems && data.syncedItems.length > 0) {
          onSyncComplete(data.syncedItems);
        }
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.error || 'Falha ao executar sincronização sob demanda.'
        });
        if (data.logs) {
          setSyncLogs(data.logs.slice(0, 20));
        }
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao sincronizar: ${err.message}`
      });
    } finally {
      setSyncing(false);
    }
  };

  // Discover Live Queues via API and update catalog
  const handleDiscoverLiveQueues = async () => {
    setIsDiscoveringLiveQueues(true);
    setLiveQueueNotice(null);
    try {
      const res = await fetch('/api/integrations/discover-queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: selectedSystemId,
          bpoName: selectedBpo,
          creds: bpoCreds,
          tenantId: effectiveTenantId
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const liveFound = Array.isArray(data.availableQueues) 
          ? data.availableQueues 
          : (Array.isArray(data.queues) ? data.queues : []);
        
        const validLiveQueues = Array.from(new Set(liveFound.filter(Boolean)));
        setAvailableQueues(validLiveQueues);
        setSelectedQueues(validLiveQueues);

        // Update local systems state so switching between systems maintains fresh discovered queues
        setSystems(prev => prev.map(sys => {
          if (sys.id !== selectedSystemId) return sys;
          const bpoConfigs = { ...(sys.bpoConfigs || {}) };
          bpoConfigs[selectedBpo] = {
            ...(bpoConfigs[selectedBpo] || {}),
            creds: bpoCreds,
            availableQueues: validLiveQueues,
            queues: validLiveQueues,
            enabled: bpoIsEnabled,
            recurringEnabled: bpoRecurringActive,
            intervalMinutes: bpoInterval
          };
          return {
            ...sys,
            bpoConfigs
          };
        }));

        if (data.provider && (data.provider.includes('mypurecloud') || data.provider.includes('pure.cloud'))) {
          const match = data.provider.match(/\((.*?)\)/);
          if (match && match[1]) {
            setBpoCreds(prev => ({ ...prev, orgName: match[1], region: match[1] }));
          }
        }

        setLiveQueueNotice({
          type: 'success',
          text: data.message || `✓ Sucesso! ${validLiveQueues.length} fila(s) ativa(s) identificada(s) na API para o ${selectedBpo}. Todas foram selecionadas para captura.`
        });
      } else {
        setLiveQueueNotice({
          type: 'error',
          text: data.error || 'Não foi possível autenticar na API para descoberta de filas. Verifique as credenciais.'
        });
      }
    } catch (err: any) {
      setLiveQueueNotice({
        type: 'error',
        text: `Erro na descoberta de filas: ${err.message}`
      });
    } finally {
      setIsDiscoveringLiveQueues(false);
    }
  };

  // Queue Selection Controls
  const handleToggleQueue = (q: string) => {
    setSelectedQueues(prev => 
      prev.includes(q) ? prev.filter(item => item !== q) : [...prev, q]
    );
  };

  const handleSelectAllQueues = () => {
    setSelectedQueues([...availableQueues]);
  };

  const handleDeselectAllQueues = () => {
    setSelectedQueues([]);
  };

  const handleAddQueue = () => {
    if (!newQueueInput.trim()) return;
    const clean = newQueueInput.trim();
    const nextAvail = availableQueues.includes(clean) ? availableQueues : [...availableQueues, clean];
    const nextSel = selectedQueues.includes(clean) ? selectedQueues : [...selectedQueues, clean];
    
    setAvailableQueues(nextAvail);
    setSelectedQueues(nextSel);
    setNewQueueInput('');

    // Update in-memory systems structure
    setSystems(prev => prev.map(sys => {
      if (sys.id !== selectedSystemId) return sys;
      const bpoConfigs = { ...(sys.bpoConfigs || {}) };
      bpoConfigs[selectedBpo] = {
        ...(bpoConfigs[selectedBpo] || {}),
        availableQueues: nextAvail,
        queues: nextSel
      };
      return { ...sys, bpoConfigs };
    }));
  };

  const handleRemoveQueue = (queueToRemove: string) => {
    const nextAvail = availableQueues.filter(q => q !== queueToRemove);
    const nextSel = selectedQueues.filter(q => q !== queueToRemove);
    setAvailableQueues(nextAvail);
    setSelectedQueues(nextSel);

    // Update in-memory systems structure
    setSystems(prev => prev.map(sys => {
      if (sys.id !== selectedSystemId) return sys;
      const bpoConfigs = { ...(sys.bpoConfigs || {}) };
      bpoConfigs[selectedBpo] = {
        ...(bpoConfigs[selectedBpo] || {}),
        availableQueues: nextAvail,
        queues: nextSel
      };
      return { ...sys, bpoConfigs };
    }));
  };

  // Master Admin Test
  const handleRunDiagnosticTest = async (sysId: string) => {
    setTestingSysId(sysId);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/integrations/health/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: sysId,
          testType: 'full'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResults(prev => ({ ...prev, [sysId]: data }));
        fetchGlobalHealth();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.error || `Falha no teste do conector ${sysId}.`
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro de conexão ao testar conector: ${err.message}`
      });
    } finally {
      setTestingSysId(null);
    }
  };

  const handleToggleMasterGlobal = async (sysId: string, currentStatus: boolean) => {
    if (!isMasterAdmin) return;
    try {
      const res = await fetch('/api/integrations/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: sysId,
          masterEnabled: !currentStatus,
          userEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ type: 'success', text: data.message });
        fetchSystems();
        fetchGlobalHealth();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || "Erro ao alterar disponibilidade do sistema." });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || "Erro ao alterar status master." });
    }
  };

  const handleCopyWebhook = () => {
    const fullUrl = window.location.origin + '/api/integrations/webhook/ingest';
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'RefreshCw': return <RefreshCw className="w-5 h-5 text-indigo-600" />;
      case 'PhoneCall': return <PhoneCall className="w-5 h-5 text-emerald-600" />;
      case 'Cloud': return <Cloud className="w-5 h-5 text-amber-600" />;
      case 'Server': return <Server className="w-5 h-5 text-purple-600" />;
      case 'Network': return <Network className="w-5 h-5 text-cyan-600" />;
      case 'MessageSquare': return <MessageSquare className="w-5 h-5 text-blue-600" />;
      default: return <Globe className="w-5 h-5 text-rose-600" />;
    }
  };

  const getChannelBadge = (type: string) => {
    switch (type) {
      case 'telephony':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">Telefonia / Voz</span>;
      case 'chat':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-md">Chat & Tickets</span>;
      case 'webhook':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold rounded-md">API Webhook REST</span>;
      default:
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-md">Omnichannel</span>;
    }
  };

  // Systems List Fallback
  const defaultSystemsList: SystemIntegration[] = [
    {
      id: 'genesys',
      name: 'Genesys Cloud CX (PureCloud)',
      vendor: 'Genesys',
      type: 'telephony',
      description: 'Captura contínua de gravações e transcrições nativas do Speech & Text Analytics (STA).',
      iconName: 'RefreshCw',
      masterEnabled: true,
      version: 'v2.1',
      authType: 'oauth2',
      fields: [
        { key: 'clientId', label: 'OAuth Client ID', type: 'text', placeholder: 'ex: c1495c6b-xxxx-xxxx-xxxx' },
        { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', placeholder: '••••••••••••••••••••••••' },
        { key: 'orgName', label: 'Região AWS / Datacenter Genesys (Auto-detectada)', type: 'text', placeholder: 'Auto-detectar (sae1.pure.cloud / mypurecloud.com)' }
      ],
      tenantEnabled: true,
      tenantCreds: {},
      targetBpo: 'BPO Alpha',
      lastSync: null
    },
    {
      id: 'zendesk',
      name: 'Zendesk Talk & Support API',
      vendor: 'Zendesk',
      type: 'chat',
      description: 'Captura de tickets de suporte, chats e áudios de chamadas Zendesk Talk.',
      iconName: 'MessageSquare',
      masterEnabled: true,
      version: 'v2.0',
      authType: 'apikey',
      fields: [
        { key: 'subdomain', label: 'Subdomínio da Organização', type: 'text', placeholder: 'suaempresa.zendesk.com' },
        { key: 'adminEmail', label: 'E-mail do Administrador API', type: 'text', placeholder: 'admin@suaempresa.com.br' },
        { key: 'apiToken', label: 'Token de Acesso / API Key', type: 'password', placeholder: '••••••••••••••••••••••••' }
      ],
      tenantEnabled: false,
      tenantCreds: {},
      targetBpo: 'BPO Alpha',
      lastSync: null
    },
    {
      id: 'twilio',
      name: 'Twilio Flex & Voice',
      vendor: 'Twilio',
      type: 'telephony',
      description: 'Event Streams e Voice Insights para monitoramento de chamadas ativas e receptivas.',
      iconName: 'PhoneCall',
      masterEnabled: true,
      version: 'v2024-05',
      authType: 'apikey',
      fields: [
        { key: 'accountSid', label: 'Twilio Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
        { key: 'authToken', label: 'Auth Token / Secret', type: 'password', placeholder: '••••••••••••••••••••••••' }
      ],
      tenantEnabled: false,
      tenantCreds: {},
      targetBpo: 'BPO Alpha',
      lastSync: null
    },
    {
      id: 'amazon_connect',
      name: 'Amazon Connect & Contact Lens',
      vendor: 'AWS',
      type: 'omnichannel',
      description: 'Extração automática de transcrições de Contact Lens via Kinesis & EventBridge.',
      iconName: 'Cloud',
      masterEnabled: true,
      version: 'v1.4.0',
      authType: 'apikey',
      fields: [
        { key: 'instanceArn', label: 'Instance ARN', type: 'text', placeholder: 'arn:aws:connect:us-east-1:123456789012:instance/...' },
        { key: 'accessKeyId', label: 'AWS Access Key ID', type: 'text', placeholder: 'AKIAIOSFODNN7EXAMPLE' },
        { key: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password', placeholder: '••••••••••••••••••••••••' }
      ],
      tenantEnabled: false,
      tenantCreds: {},
      targetBpo: 'BPO Alpha',
      lastSync: null
    },
    {
      id: 'custom_webhook',
      name: 'Webhook REST Universal Customizado',
      vendor: 'AuditaQA Universal',
      type: 'webhook',
      description: 'Recepção via POST HTTP de JSONs e áudios de qualquer discador proprietário.',
      iconName: 'Globe',
      masterEnabled: true,
      version: 'v1.0.0',
      authType: 'webhook_secret',
      fields: [
        { key: 'endpointUrl', label: 'Endpoint de Ingestão', type: 'text', placeholder: 'https://sua-empresa.auditaqa.app/api/integrations/webhook/ingest' },
        { key: 'webhookSecret', label: 'Chave HMAC de Assinatura', type: 'password', placeholder: 'whsec_••••••••••••••••' }
      ],
      tenantEnabled: true,
      tenantCreds: {},
      targetBpo: 'BPO Alpha',
      lastSync: null
    }
  ];

  const availableSystems = systems;
  const currentSelectedSystem = availableSystems.find(s => s.id === selectedSystemId) || availableSystems[0];

  // -------------------------------------------------------------
  // RENDERIZAÇÃO: MODO 1: MASTER SAAS ADMIN (master@admin.com)
  // -------------------------------------------------------------
  if (isMasterAdmin) {
    const displaySystems = globalHealthData?.systems || availableSystems.map(s => ({
      systemId: s.id,
      name: s.name,
      vendor: s.vendor,
      type: s.type,
      iconName: s.iconName,
      masterEnabled: s.masterEnabled,
      status: s.masterEnabled ? 'operational' as const : 'maintenance' as const,
      statusText: s.masterEnabled ? 'Habilitado (sem sonda remota)' : 'Em Manutenção',
      uptimePercent: null,
      pingMs: null,
      activeTenantsCount: 1,
      totalIngestedInteractions: 0,
      gatewayUrl: `https://api.${s.id}.cloud`,
      rateLimitPerMin: 300,
      currentUtilizationPercent: 24,
      globalTimeoutMs: 5000,
      authType: s.authType || 'oauth2',
      tlsVersion: 'TLS 1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      circuitBreakerStatus: 'CLOSED',
      lastProbeTimestamp: new Date().toISOString(),
      lastProbeStatus: null
    }));

    const activeCount = displaySystems.filter(s => s.masterEnabled).length;
    const avgLatency = globalHealthData?.averageLatencyMs ?? null;

    return (
      <div className="flex flex-col gap-4 text-left animate-fade-in lg:h-full lg:min-h-0 lg:overflow-hidden" id="hubIntegracoesMasterRoot">
        {/* CABEÇALHO CLEAN E MODERNO */}
        <div className="shrink-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Hub Multissistemas & Saúde Global
                </h2>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                  {activeCount} de {displaySystems.length} Conectores Ativos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Governança da infraestrutura, monitoramento de latência e testes de conectividade sem vínculo a dados privados de tenants.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                fetchGlobalHealth();
                fetchSystems();
              }}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Atualizar Status</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK MSG */}
        {feedbackMsg && (
          <div className={`shrink-0 p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between animate-fade-in ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* 3 MÉTRICAS ESSENCIAIS */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SLA de Disponibilidade</span>
              <span className="text-lg font-bold text-emerald-600">99.98%</span>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Latência Média de Resposta</span>
              <span className="text-sm font-bold text-slate-500">{avgLatency === null ? 'Não instrumentada' : `${avgLatency} ms`}</span>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Segurança & Criptografia</span>
              <span className="text-lg font-bold text-slate-800">TLS 1.3 / mTLS</span>
            </div>
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* GRADE DE CONECTORES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Conectores Homologados ({displaySystems.length})
            </h3>
            <span className="text-xs text-slate-400">
              Clique em <strong>Testar Conexão</strong> para executar a verificação instantânea
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displaySystems.map(sys => {
              const isTesting = testingSysId === sys.systemId;
              const lastTest = testResults[sys.systemId];

              return (
                <div 
                  key={`clean-card-${sys.systemId}`}
                  className={`bg-white border rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                    sys.masterEnabled ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                          {renderIcon(sys.iconName)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">{sys.name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium">{sys.vendor}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                        sys.masterEnabled 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sys.masterEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {sys.masterEnabled ? 'Operacional' : 'Pausado'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      {getChannelBadge(sys.type)}
                      <span className="text-[11px] font-bold text-slate-600 font-mono">
                        {sys.pingMs === null ? 'Não instrumentada' : `~${sys.pingMs} ms`}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px] font-mono text-slate-600 truncate" title={sys.gatewayUrl}>
                      <span className="text-slate-400">Gateway: </span>
                      <span className="font-semibold">{sys.gatewayUrl}</span>
                    </div>

                    {lastTest && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Teste OK ({lastTest.latencyMs}ms)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedModalResult(lastTest)}
                          className="text-[10px] font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                        >
                          Ver Detalhes
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunDiagnosticTest(sys.systemId)}
                      disabled={isTesting}
                      className="flex-1 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Testando...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Testar Conexão</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMasterGlobal(sys.systemId, sys.masterEnabled)}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                        sys.masterEnabled
                          ? 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200 hover:border-rose-200'
                          : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                      }`}
                      title={sys.masterEnabled ? 'Pausar este conector para toda a plataforma' : 'Liberar este conector para a plataforma'}
                    >
                      {sys.masterEnabled ? 'Pausar' : 'Liberar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* WEBHOOK REST */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Endpoint Webhook REST Universal</span>
              <span className="px-2 py-0.2 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">
                POST / Ingestão Direta
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Utilize para enviar gravações ou transcrições de qualquer discador externo com autenticação via cabeçalho HMAC.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <code className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 flex-1 sm:flex-initial">
              /api/integrations/webhook/ingest
            </code>
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {copiedWebhook ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Copiar URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* MODAL DETALHES DO TESTE */}
        {selectedModalResult && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Diagnóstico: {selectedModalResult.systemName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedModalResult(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Status HTTP:</span>
                  <span className="font-bold text-emerald-700">{selectedModalResult.httpStatus} {selectedModalResult.statusText}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Tempo de Resposta Total:</span>
                  <span className="font-bold text-indigo-700">{selectedModalResult.latencyMs} ms</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Etapas Inspecionadas:</span>
                <div className="space-y-1.5">
                  {selectedModalResult.diagnosticSteps.map(step => (
                    <div key={step.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">{step.name}</span>
                      <span className="font-mono text-indigo-600 font-bold">{step.latencyMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedModalResult(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZAÇÃO: MODO 2: TENANT MASTER & SUB-TENANTS (ex: master@casasbahia.com)
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 text-left animate-fade-in lg:h-full lg:min-h-0 lg:overflow-hidden" id="hubIntegracoesTenantRoot">
      
      {/* CABEÇALHO DO TENANT MASTER */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                Hub de Integrações & Captura por Sub-Tenant
              </h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                Ambiente Isolado: {effectiveTenantId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Conecte discadores e ferramentas de mensageria, defina chaves de acesso por parceiro/BPO e configure a rotina de captura automática para auditoria.
            </p>
          </div>
        </div>

        {/* CONTROLES DE CAPTURA RÁPIDA */}
        {!isManualIngestion && (
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={handleTriggerSyncNow}
            disabled={syncing}
            className="flex-1 md:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Capturando Casos...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Capturar Agora</span>
              </>
            )}
          </button>
        </div>
        )}
      </div>

      {/* MENSAGENS DE FEEDBACK */}
      {feedbackMsg && (
        <div className={`shrink-0 p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between animate-fade-in ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* SELETORES: SISTEMA + SUB-TENANT (BPO) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* COLUNA ESQUERDA: SELETOR FIXO DE SISTEMA + SUB-TENANT */}
        <div className="md:col-span-4 flex flex-col gap-3 lg:min-h-0 lg:pr-1">
          <div className="shrink-0 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Selecione o Sistema
            </h3>
            <span className="text-[10px] text-slate-400 font-mono font-bold">
              {loading ? 'Carregando...' : `${availableSystems.length} Disponíveis`}
            </span>
          </div>

          {/* CARD DE SUB-TENANT / BPO ATIVO — no topo para acesso imediato */}
          <div className="shrink-0 bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Sub-Tenant / BPO Ativo</span>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold">
                {activeBposList.length} BPOs
              </span>
            </div>
            <select
              value={selectedBpo}
              onChange={(e) => {
                setSelectedBpo(e.target.value);
                setFeedbackMsg({
                  type: 'success',
                  text: `Alternado para a sub-tenant ${e.target.value}. As credenciais e filas foram atualizadas para esta operação.`
                });
              }}
              className="w-full px-3 py-2 bg-indigo-50/40 border border-indigo-200 rounded-xl text-xs font-extrabold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {activeBposList.map(bpo => (
                <option key={bpo} value={bpo}>🏢 {bpo}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 leading-snug">
              Credenciais, filas e recorrência isoladas por operação.
            </p>
          </div>

          <div className="space-y-1.5 lg:min-h-0 lg:overflow-y-auto lg:pr-0.5">
            {/* OPÇÃO ESPECIAL: INGESTÃO MANUAL (não é um sistema do Hub) */}
            <button
              type="button"
              onClick={() => setSelectedSystemId('manual_ingestion')}
              className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isManualIngestion
                  ? 'bg-amber-50/80 border-amber-500 shadow-xs'
                  : 'bg-white border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/30'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-white rounded-xl border border-amber-100 shrink-0">
                  <UploadCloud className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs font-bold truncate ${isManualIngestion ? 'text-amber-950' : 'text-slate-800'}`}>
                    Ingestão Manual
                  </h4>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Sem integração • upload de arquivos
                  </span>
                </div>
              </div>
              {isManualIngestion && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
            </button>

            {loading && availableSystems.length === 0 && (
              <div className="space-y-2" role="status" aria-label="Carregando conectores">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-2xl border border-slate-200 bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && availableSystems.length === 0 && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-white text-center">
                <Network className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                <p className="text-[11px] font-bold text-slate-600">Nenhum conector disponível.</p>
                <p className="text-[10px] text-slate-400 mt-1">Use a Ingestão Manual ou peça ao master para habilitar um sistema.</p>
              </div>
            )}

            {availableSystems.map(sys => {
              const isSelected = selectedSystemId === sys.id;

              return (
                <button
                  key={`sys-btn-${sys.id}`}
                  type="button"
                  onClick={() => setSelectedSystemId(sys.id)}
                  className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-white rounded-xl border border-slate-100 shrink-0">
                      {renderIcon(sys.iconName)}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                        {sys.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {sys.vendor} • {sys.type}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COLUNA DIREITA: ÚNICA ÁREA COM SCROLL VERTICAL */}
        <div className="md:col-span-8 flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">

          {isManualIngestion ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <IngestaoLote
                onProcessed={onIngestProcessed || onSyncComplete}
                activeConfig={activeConfig || ({
                  greetingWeight: 20,
                  protocolWeight: 20,
                  resolutionWeight: 30,
                  toneWeight: 30,
                  expectedScript: "",
                  criticalDeviations: []
                } as AuditConfig)}
                bpos={activeBposList}
                tenantId={effectiveTenantId}
                userEmail={userEmail}
              />
            </div>
          ) : !currentSelectedSystem ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs" role="status">
              <RefreshCw className="w-6 h-6 text-indigo-500 mx-auto mb-3 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Carregando conectores do Hub...</p>
              <p className="text-[11px] text-slate-400 mt-1">A lista de sistemas vem do servidor; nenhum dado provisório é exibido.</p>
            </div>
          ) : (
            <>
          
          {/* PAINEL PRINCIPAL DE CREDENCIAIS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            
            {/* CABEÇALHO DO FORMULÁRIO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                  {renderIcon(currentSelectedSystem.iconName)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {currentSelectedSystem.name}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-md shadow-3xs">
                      {selectedBpo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentSelectedSystem.description}
                  </p>
                </div>
              </div>

              {/* SWITCH ATIVO/INATIVO */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className="text-xs font-medium text-slate-500">Recorrência:</span>
                <button
                  type="button"
                  onClick={() => handleToggleRecurring(!bpoRecurringActive)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bpoRecurringActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {bpoRecurringActive ? 'Ativa & Agendada' : 'Desativada'}
                </button>
              </div>
            </div>

            {/* CAMPOS DINÂMICOS DE CREDENCIAIS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  Credenciais de Acesso & Autenticação ({selectedBpo})
                </span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Criptografia AES-256
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentSelectedSystem.fields.map(field => {
                  const isPassword = field.type === 'password';
                  const showPass = !!showSecrets[field.key];

                  return (
                    <div key={`field-${field.key}`} className={currentSelectedSystem.fields.length === 1 ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {field.label}
                      </label>
                      <div className="relative">
                        <input
                          type={isPassword && !showPass ? 'password' : 'text'}
                          value={bpoCreds[field.key] || ''}
                          onChange={(e) => setBpoCreds({ ...bpoCreds, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        {isPassword && (
                          <button
                            type="button"
                            onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showPass })}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO DE FILAS & SKILLS COM SELEÇÃO ATIVA */}
            <div className="space-y-3.5 pt-4 border-t border-slate-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ListFilter className="w-4 h-4 text-indigo-600" />
                    Filas & Skills de Atendimento
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    selectedQueues.length > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {selectedQueues.length} de {availableQueues.length} Selecionadas para Captura
                  </span>
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAllQueues}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Selecionar todas as filas disponíveis"
                  >
                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                    <span>Marcar Todas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAllQueues}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Desmarcar todas as filas"
                  >
                    <Square className="w-3 h-3 text-slate-500" />
                    <span>Desmarcar Todas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscoverLiveQueues}
                    disabled={isDiscoveringLiveQueues}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3 h-3 ${isDiscoveringLiveQueues ? 'animate-spin' : ''}`} />
                    <span>Descobrir Filas na API</span>
                  </button>
                </div>
              </div>

              {liveQueueNotice && (
                <div className={`p-3 rounded-xl border text-xs font-medium ${
                  liveQueueNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {liveQueueNotice.text}
                </div>
              )}

              {/* BARRA DE PESQUISA / FILTRO DE FILAS */}
              {availableQueues.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={queueSearchFilter}
                    onChange={(e) => setQueueSearchFilter(e.target.value)}
                    placeholder="Filtrar filas disponíveis pelo nome..."
                    className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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

              {/* LISTA / GRID DE FILAS INTERATIVAS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {availableQueues
                  .filter(q => !queueSearchFilter.trim() || q.toLowerCase().includes(queueSearchFilter.toLowerCase()))
                  .map((queue) => {
                    const isSelected = selectedQueues.includes(queue);

                    return (
                      <div
                        key={`queue-item-${queue}`}
                        onClick={() => handleToggleQueue(queue)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                          isSelected
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-3xs'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className={`text-xs font-mono font-bold truncate ${
                            isSelected ? 'text-emerald-950' : 'text-slate-700'
                          }`}>
                            {queue}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isSelected 
                              ? 'bg-emerald-200/70 text-emerald-900' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isSelected ? '✓ Captura Ativa' : 'Ignorada'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveQueue(queue)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remover do catálogo desta sub-tenant"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {availableQueues.length === 0 && (
                  <div className="sm:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Nenhuma fila catalogada para o {selectedBpo}. Clique em "Descobrir Filas na API" ou adicione manualmente abaixo.</span>
                  </div>
                )}

                {availableQueues.length > 0 && availableQueues.filter(q => !queueSearchFilter.trim() || q.toLowerCase().includes(queueSearchFilter.toLowerCase())).length === 0 && (
                  <div className="sm:col-span-2 p-3 text-center text-slate-400 text-xs italic">
                    Nenhuma fila corresponde à busca "{queueSearchFilter}".
                  </div>
                )}
              </div>

              {/* INPUT PARA INCLUSÃO MANUAL DE NOVA FILA */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newQueueInput}
                  onChange={(e) => setNewQueueInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddQueue()}
                  placeholder="Nome ou ID de nova fila (ex: Fila_Chat_SAC_02)..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddQueue}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir Fila</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                🔒 Apenas atendimentos originados das filas com status <strong>"✓ Captura Ativa"</strong> serão importados e avaliados pela IA para o <strong>{selectedBpo}</strong>.
              </p>
            </div>

            {/* RECORRÊNCIA E LGPD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              
              {/* RECORRÊNCIA */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Varredura Recorrente
                  </span>
                  <input
                    type="checkbox"
                    checked={bpoRecurringActive}
                    onChange={(e) => handleToggleRecurring(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Intervalo de captura automática em segundo plano:
                </p>
                <select
                  value={bpoInterval}
                  onChange={(e) => setBpoInterval(Number(e.target.value))}
                  disabled={!bpoRecurringActive}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value={5}>A cada 5 minutos</option>
                  <option value={15}>A cada 15 minutos</option>
                  <option value={30}>A cada 30 minutos (Recomendado)</option>
                  <option value={60}>A cada 1 hora</option>
                </select>
              </div>

              {/* MASCARAMENTO PII */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Proteção LGPD / PII
                  </span>
                  <input
                    type="checkbox"
                    checked={piiMaskingEnabled}
                    onChange={(e) => setPiiMaskingEnabled(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Oculta CPFs, cartões bancários e números de telefone durante a ingestão do áudio e texto.
                </p>
                <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Filtro Ativo na API
                </span>
              </div>
            </div>

            {/* BOTÕES DE SALVAR */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Total de casos capturados desta sub-tenant: <strong>{totalCapturedCount}</strong>
              </span>

              <button
                type="button"
                onClick={handleSaveTenantBpoConfig}
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Configurações</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* HISTÓRICO RECENTE DE SINCRONIZAÇÃO */}
          {syncLogs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  Logs de Execução Recente da Integração
                </span>
                {lastSyncTimestamp && (
                  <span className="text-[10px] text-slate-400">
                    Última rodada: {new Date(lastSyncTimestamp).toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>

              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                {syncLogs.map((log, idx) => (
                  <div key={`log-${idx}`} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

            </>
          )}

        </div>
      </div>
    </div>
  );
}
