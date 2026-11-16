import React, { useState, useEffect, useRef } from 'react';
import { AuditConfig, AIProviderId, AIProviderConfig } from '../types';
import { 
  Key, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Save, 
  Info,
  Sparkles,
  Network,
  Sliders,
  Database,
  Upload,
  FileText,
  CheckCircle,
  Zap,
  Bot,
  Building2,
  SlidersHorizontal
} from 'lucide-react';

interface GeminiConfigProps {
  config: AuditConfig | null;
  onUpdate: (updatedConfig: AuditConfig) => void;
  initialTenantId?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
}

interface ProviderMeta {
  id: AIProviderId;
  name: string;
  defaultBaseUrl: string;
  defaultModels: string[];
  defaultEmbeddingModels: string[];
  docUrl: string;
  requiresApiKey: boolean;
  description: string;
  badge: string;
  color: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModels: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'],
    defaultEmbeddingModels: ['gemini-embedding-2-preview', 'text-embedding-004'],
    docUrl: 'https://aistudio.google.com',
    requiresApiKey: true,
    description: 'Motor nativo com multimodalidade e suporte avançado a grandes contextos.',
    badge: 'Nativo',
    color: 'bg-indigo-50 border-indigo-200 text-indigo-700'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultEmbeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    docUrl: 'https://platform.openai.com',
    requiresApiKey: true,
    description: 'Padrão da indústria com raciocínio de alta precisão (GPT-4o, GPT-4o-mini, o1).',
    badge: 'Popular',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    defaultEmbeddingModels: ['claude-embedding-fallback', 'gemini-embedding-2-preview'],
    docUrl: 'https://console.anthropic.com',
    requiresApiKey: true,
    description: 'Líder em escrita humanizada, nuances operacionais e baixa taxa de alucinação.',
    badge: 'Alta Precisão',
    color: 'bg-amber-50 border-amber-200 text-amber-700'
  },
  {
    id: 'groq',
    name: 'Groq LPU',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'],
    defaultEmbeddingModels: ['text-embedding-3-small', 'bge-m3'],
    docUrl: 'https://console.groq.com',
    requiresApiKey: true,
    description: 'Aceleração em hardware LPU com latência ultra-baixa (Llama 3.3 70B, DeepSeek-R1 Distill).',
    badge: 'Ultra Fast',
    color: 'bg-red-50 border-red-200 text-red-700'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
    defaultEmbeddingModels: ['deepseek-embed', 'text-embedding-3-small'],
    docUrl: 'https://platform.deepseek.com',
    requiresApiKey: true,
    description: 'Modelos de alto custo-benefício e raciocínio profundo (DeepSeek-V3 e R1).',
    badge: 'Raciocínio R1',
    color: 'bg-blue-50 border-blue-200 text-blue-700'
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-auto'],
    defaultEmbeddingModels: ['text-embedding-3-small'],
    docUrl: 'https://platform.moonshot.cn',
    requiresApiKey: true,
    description: 'Especializado em janelas longas de contexto e análise documental contínua.',
    badge: 'Long Context',
    color: 'bg-purple-50 border-purple-200 text-purple-700'
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (GLM)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-4-air', 'glm-4-long'],
    defaultEmbeddingModels: ['embedding-2', 'text-embedding-3-small'],
    docUrl: 'https://open.bigmodel.cn',
    requiresApiKey: true,
    description: 'Série GLM-4 otimizada para diálogos estruturados e análises corporativas.',
    badge: 'Enterprise GLM',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-700'
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModels: ['meta/llama-3.1-408b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mistral-large-2-instruct', 'nvidia/neva-22b'],
    defaultEmbeddingModels: ['nvidia/embed-qa-4', 'snowflake/arctic-embed-m'],
    docUrl: 'https://build.nvidia.com',
    requiresApiKey: true,
    description: 'Microsserviços acelerados com Llama-3.1 408B, Mistral e Gemma.',
    badge: 'High Perf',
    color: 'bg-green-50 border-green-200 text-green-700'
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModels: ['grok-beta', 'grok-vision-beta', 'grok-2-1212', 'grok-2-vision-1212'],
    defaultEmbeddingModels: ['text-embedding-3-small'],
    docUrl: 'https://x.ai',
    requiresApiKey: true,
    description: 'Modelos Grok de última geração com alta velocidade de inferência.',
    badge: 'Grok 2',
    color: 'bg-stone-50 border-stone-200 text-stone-700'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-12b-2409', 'open-mistral-nemo'],
    defaultEmbeddingModels: ['mistral-embed'],
    docUrl: 'https://console.mistral.ai',
    requiresApiKey: true,
    description: 'Inteligência europeia aberta de alta eficiência e latência reduzida.',
    badge: 'Open Weight',
    color: 'bg-orange-50 border-orange-200 text-orange-700'
  },
  {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct', 'qwen2.5-32b-instruct'],
    defaultEmbeddingModels: ['text-embedding-v2', 'text-embedding-3-small'],
    docUrl: 'https://dashscope.aliyun.com',
    requiresApiKey: true,
    description: 'Ecossistema Qwen 2.5 de alta capacidade analítica de linguagem.',
    badge: 'Qwen 2.5',
    color: 'bg-sky-50 border-sky-200 text-sky-700'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local/Host)',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModels: [],
    defaultEmbeddingModels: [],
    docUrl: 'https://ollama.com',
    requiresApiKey: false,
    description: 'Captura dinamicamente todos os modelos instalados no seu Ollama (requer URL pública/Tunnel).',
    badge: 'Local / Privado',
    color: 'bg-zinc-100 border-zinc-300 text-zinc-800'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-001'],
    defaultEmbeddingModels: ['openai/text-embedding-3-small'],
    docUrl: 'https://openrouter.ai',
    requiresApiKey: true,
    description: 'Hub unificado para rotear requisições para centenas de modelos globais.',
    badge: 'Multi-Model Hub',
    color: 'bg-violet-50 border-violet-200 text-violet-700'
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
    defaultModels: ['mistralai/Mistral-7B-Instruct-v0.2', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'],
    defaultEmbeddingModels: ['BAAI/bge-m3', 'sentence-transformers/all-MiniLM-L6-v2'],
    docUrl: 'https://huggingface.co',
    requiresApiKey: true,
    description: 'Acesso direto aos endpoints de inferência e embeddings da comunidade HuggingFace.',
    badge: 'Open Source',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  }
];

function createDefaultProviderConfigs(): Record<AIProviderId, AIProviderConfig> {
  return {
    gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com', selectedModel: 'gemini-3.1-pro-preview', chatModel: 'gemini-3.5-flash' },
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', selectedModel: 'gpt-4o-mini', chatModel: 'gpt-4o-mini' },
    anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', selectedModel: 'claude-3-5-sonnet-20241022', chatModel: 'claude-3-5-haiku-20241022' },
    groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', selectedModel: 'llama-3.3-70b-versatile', chatModel: 'llama-3.1-8b-instant' },
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', selectedModel: 'deepseek-chat', chatModel: 'deepseek-chat' },
    moonshot: { apiKey: '', baseUrl: 'https://api.moonshot.cn/v1', selectedModel: 'moonshot-v1-8k', chatModel: 'moonshot-v1-8k' },
    zhipu: { apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', selectedModel: 'glm-4-flash', chatModel: 'glm-4-flash' },
    nvidia: { apiKey: '', baseUrl: 'https://integrate.api.nvidia.com/v1', selectedModel: 'meta/llama-3.1-70b-instruct', chatModel: 'meta/llama-3.1-8b-instruct' },
    xai: { apiKey: '', baseUrl: 'https://api.x.ai/v1', selectedModel: 'grok-beta', chatModel: 'grok-beta' },
    mistral: { apiKey: '', baseUrl: 'https://api.mistral.ai/v1', selectedModel: 'mistral-small-latest', chatModel: 'mistral-small-latest' },
    qwen: { apiKey: '', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', selectedModel: 'qwen-turbo', chatModel: 'qwen-turbo' },
    ollama: { apiKey: '', baseUrl: 'http://localhost:11434', selectedModel: '', chatModel: '' },
    openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', selectedModel: 'openai/gpt-4o-mini', chatModel: 'openai/gpt-4o-mini' },
    huggingface: { apiKey: '', baseUrl: 'https://api-inference.huggingface.co/v1', selectedModel: 'meta-llama/Llama-3.1-8B-Instruct', chatModel: 'meta-llama/Llama-3.1-8B-Instruct' }
  };
}

function buildProviderConfigs(loaded?: Partial<Record<AIProviderId, AIProviderConfig>>): Record<AIProviderId, AIProviderConfig> {
  const base = createDefaultProviderConfigs();
  if (!loaded) return base;
  for (const [pid, provider] of Object.entries(loaded)) {
    if (!provider) continue;
    const id = pid as AIProviderId;
    base[id] = {
      ...(base[id] || {}),
      ...provider,
      hasApiKey: provider.hasApiKey ?? Boolean(provider.apiKey)
    };
  }
  return base;
}

function firstConfiguredProvider(providers?: Partial<Record<AIProviderId, AIProviderConfig>>): AIProviderId | null {
  if (!providers) return null;
  for (const [pid, provider] of Object.entries(providers)) {
    const meta = PROVIDERS.find(p => p.id === pid);
    if (provider?.apiKey || provider?.hasApiKey || meta?.requiresApiKey === false) {
      return pid as AIProviderId;
    }
  }
  return null;
}

export default function GeminiConfig({ config, onUpdate, initialTenantId, userEmail = 'master@admin.com', isSuperAdmin = false }: GeminiConfigProps) {
  const isMasterAdmin = isSuperAdmin || userEmail === 'master@admin.com';
  // Navigation & UI States
  const [activeSubTab, setActiveSubTab] = useState<'model' | 'fewshot' | 'embeddings'>('model');
  const [activeProvider, setActiveProvider] = useState<AIProviderId>('gemini');
  const [embeddingProvider, setEmbeddingProvider] = useState<AIProviderId>('gemini');
  const [embeddingModel, setEmbeddingModel] = useState<string>('gemini-embedding-2-preview');
  
  // Tenant Selection for AI Configuration
  const initialScope = initialTenantId && initialTenantId !== 'system-global' ? initialTenantId : 'global_default';
  const [selectedTenantForAI, setSelectedTenantForAI] = useState<string>(initialScope);

  useEffect(() => {
    if (!initialTenantId) return;
    setSelectedTenantForAI(initialTenantId === 'system-global' ? 'global_default' : initialTenantId);
  }, [initialTenantId]);
  const [availableTenants, setAvailableTenants] = useState<{ id: string; name: string; isSubtenant?: boolean }[]>([
    { id: 'global_default', name: '🌐 Configuração SaaS Global (Padrão)' }
  ]);
  
  // Provider dynamic map state
  const [providerConfigs, setProviderConfigs] = useState<Record<AIProviderId, AIProviderConfig>>(createDefaultProviderConfigs);

  const [fewShotPrompt, setFewShotPrompt] = useState('');
  const [useEmbeddings, setUseEmbeddings] = useState(true);
  const [showKey, setShowKey] = useState(false);

  // Status & Fetching states
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchedModelsMap, setFetchedModelsMap] = useState<Record<string, string[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  
  // Saving states
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Ref hooks for local file uploads
  const calibInteractionsInputRef = useRef<HTMLInputElement>(null);
  const calibMonitoriaInputRef = useRef<HTMLInputElement>(null);

  // Calibration Ingestion States
  const [calibInteractions, setCalibInteractions] = useState<any[]>([]);
  const [calibMonitorias, setCalibMonitorias] = useState<any[]>([]);
  const [calibInteractionsName, setCalibInteractionsName] = useState('');
  const [calibMonitoriasName, setCalibMonitoriasName] = useState('');
  const [calibError, setCalibError] = useState<string | null>(null);
  const [calibSuccess, setCalibSuccess] = useState<string | null>(null);

  // On mount, restore cached fetched models map from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem('auditaqa_fetched_models_map');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          setFetchedModelsMap(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not load cached models map:", e);
    }
  }, []);

  // Fetch real list of created tenants & subtenants
  const fetchTenantsList = async () => {
    try {
      const res = await fetch(`/api/tenants?userEmail=${encodeURIComponent(userEmail || 'master@admin.com')}&role=${isMasterAdmin ? 'superadmin' : 'admin'}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.tenants || []);
        if (Array.isArray(list) && list.length > 0) {
          const formatted = [
            { id: 'global_default', name: '🌐 Configuração SaaS Global (Padrão)' },
            ...list.map((t: any) => ({
              id: t.id,
              name: t.isSubtenant 
                ? `  └─ 🏬 ${t.name} (Sub-Tenant)`
                : `🏢 ${t.name} ${t.id === 'system-global' ? '(Tenant Master)' : '(Client Tenant)'}`,
              isSubtenant: !!t.isSubtenant
            }))
          ];
          setAvailableTenants(formatted);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar lista de tenants para IA:", err);
    }
  };

  useEffect(() => {
    fetchTenantsList();
  }, [userEmail]);

  // Load initial settings on mounting or prop change
  useEffect(() => {
    if (config && (!selectedTenantForAI || selectedTenantForAI === 'global_default')) {
      const active = (config.activeProvider as AIProviderId) || firstConfiguredProvider(config.providers) || 'gemini';
      setActiveProvider(active);
      setEmbeddingProvider((config.embeddingProvider as AIProviderId) || active);
      setEmbeddingModel(config.embeddingModel || '');
      setFewShotPrompt(config.fewShotPrompt || '');
      setUseEmbeddings(config.useEmbeddings !== undefined ? config.useEmbeddings : true);
      setProviderConfigs(buildProviderConfigs(config.providers));
    }
  }, [config, selectedTenantForAI]);

  // Load tenant-specific or global config whenever selectedTenantForAI changes
  useEffect(() => {
    let isCurrent = true;
    const loadSelectedTenantConfig = async () => {
      if (!selectedTenantForAI || selectedTenantForAI === 'global_default') return;
      try {
        const res = await fetch(`/api/tenants/${selectedTenantForAI}/aiconfig`);
        if (res.ok) {
          const data = await res.json();
          const tenantCfg: AuditConfig = data.config || data;
          if (tenantCfg && isCurrent) {
            const active = (tenantCfg.activeProvider as AIProviderId) || firstConfiguredProvider(tenantCfg.providers) || 'gemini';
            setActiveProvider(active);
            setEmbeddingProvider((tenantCfg.embeddingProvider as AIProviderId) || active);
            setEmbeddingModel(tenantCfg.embeddingModel || '');
            setFewShotPrompt(tenantCfg.fewShotPrompt || '');
            setUseEmbeddings(tenantCfg.useEmbeddings !== undefined ? tenantCfg.useEmbeddings : true);
            setProviderConfigs(buildProviderConfigs(tenantCfg.providers));
          }
        }
      } catch (err) {
        console.warn("Erro ao carregar configurações de IA do tenant selecionado:", err);
      }
    };

    loadSelectedTenantConfig();
    return () => {
      isCurrent = false;
    };
  }, [selectedTenantForAI]);

  // Auto-validation effect
  useEffect(() => {
    let cancelled = false;
    const meta = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];
    const cfg = providerConfigs[activeProvider] || {};

    const runAutoFetchAndTest = async () => {
      if (meta.requiresApiKey && (!cfg.apiKey || cfg.apiKey.trim().length === 0) && !cfg.hasApiKey) {
        setConnectionStatus(null);
        return;
      }

      setLoadingModels(true);
      try {
        const testRes = await fetch('/api/config/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: activeProvider,
            apiKey: cfg.apiKey,
            baseUrl: cfg.baseUrl || meta.defaultBaseUrl,
            tenantId: selectedTenantForAI !== 'global_default' ? selectedTenantForAI : undefined
          })
        });

        if (!cancelled && testRes.ok) {
          const testData = await testRes.json();
          if (testData.success) {
            setConnectionStatus({
              success: true,
              latencyMs: testData.latencyMs,
              message: `⚡ Conexão ativa com ${meta.name}! Latência: ${testData.latencyMs}ms.`
            });
          } else {
            setConnectionStatus({
              success: false,
              message: testData.error || `Atenção: Verifique a chave de API ou URL base para ${meta.name}.`
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setConnectionStatus({
            success: false,
            message: `Falha na verificação: ${err.message || 'Sem resposta'}`
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingModels(false);
        }
      }
    };

    const timer = setTimeout(() => {
      runAutoFetchAndTest();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeProvider, providerConfigs[activeProvider]?.apiKey, providerConfigs[activeProvider]?.baseUrl]);

  const currentProviderMeta = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];
  const currentProviderConfig = providerConfigs[activeProvider] || {};
  const configuredProviderIds = PROVIDERS.filter((p) => {
    const provider = providerConfigs[p.id];
    if (!provider) return false;
    if (provider.apiKey?.trim() || provider.hasApiKey) return true;
    const customUrl = Boolean(provider.baseUrl?.trim()) && !/localhost|127\.0\.0\.1/i.test(provider.baseUrl || '');
    return p.requiresApiKey === false && customUrl;
  }).map(p => p.id);
  const hasConfiguredProvider = configuredProviderIds.length > 0;

  const updateActiveProviderField = (field: keyof AIProviderConfig, value: any) => {
    setProviderConfigs(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        [field]: value
      }
    }));
  };

  async function fetchDynamicModels(pId = activeProvider) {
    const meta = PROVIDERS.find(p => p.id === pId) || currentProviderMeta;
    const cfg = providerConfigs[pId] || {};

    setLoadingModels(true);
    setConnectionStatus(null);

    // Direct browser check for Ollama local instances
    if (pId === 'ollama') {
      const rawOllamaBase = (cfg.baseUrl || meta.defaultBaseUrl).trim().replace(/\/$/, '').replace(/\/v1$/, '').replace(/\/api$/, '');
      try {
        const directTagsRes = await fetch(`${rawOllamaBase}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(3500)
        });
        if (directTagsRes.ok) {
          const directTagsData = await directTagsRes.json();
          if (directTagsData.models && Array.isArray(directTagsData.models) && directTagsData.models.length > 0) {
            const localModels = directTagsData.models.map((m: any) => m.name || m.model);
            setFetchedModelsMap(prev => {
              const updated = { ...prev, ollama: localModels };
              try { localStorage.setItem('auditaqa_fetched_models_map', JSON.stringify(updated)); } catch(e){}
              return updated;
            });
            setConnectionStatus({
              success: true,
              message: `⚡ [Ollama Local Detectado] Capturados ${localModels.length} modelos instalados no seu Ollama (${rawOllamaBase})!`
            });
            setLoadingModels(false);
            return;
          }
        }
      } catch (localErr) {
        console.log("Consulta local Ollama fallback para backend...", localErr);
      }
    }

    try {
      const response = await fetch('/api/config/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: pId,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl || meta.defaultBaseUrl,
          tenantId: selectedTenantForAI !== 'global_default' ? selectedTenantForAI : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro ao consultar a API do provedor ${meta.name}`);
      }

      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        setFetchedModelsMap(prev => {
          const updated = { ...prev, [pId]: data.models };
          try { localStorage.setItem('auditaqa_fetched_models_map', JSON.stringify(updated)); } catch(e){}
          return updated;
        });

        if (!cfg.selectedModel || !data.models.includes(cfg.selectedModel)) {
          updateActiveProviderField('selectedModel', data.models[0]);
        }
        if (!cfg.chatModel || !data.models.includes(cfg.chatModel)) {
          updateActiveProviderField('chatModel', data.models[0]);
        }

        setConnectionStatus({
          success: true,
          message: `Modelos capturados com sucesso! (${data.models.length} modelos identificados)`
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        success: false,
        message: err.message || 'Falha ao buscar modelos'
      });
    } finally {
      setLoadingModels(false);
    }
  }

  async function testConnection() {
    setLoadingModels(true);
    setConnectionStatus(null);

    const cfg = providerConfigs[activeProvider] || {};
    if (currentProviderMeta.requiresApiKey && !cfg.apiKey?.trim() && !cfg.hasApiKey) {
      setConnectionStatus({
        success: false,
        message: `Configure uma chave de API para ${currentProviderMeta.name} antes de testar a conexão.`
      });
      setLoadingModels(false);
      return;
    }
    try {
      const response = await fetch('/api/config/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl || currentProviderMeta.defaultBaseUrl,
          tenantId: selectedTenantForAI !== 'global_default' ? selectedTenantForAI : undefined
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setConnectionStatus({
          success: true,
          latencyMs: data.latencyMs,
          message: `Conexão bem-sucedida com ${currentProviderMeta.name}! Latência: ${data.latencyMs}ms.`
        });
      } else {
        setConnectionStatus({
          success: false,
          message: data.error || 'Falha de autenticação ou endpoint inacessível.'
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        success: false,
        message: err.message || 'Falha ao comunicar com o servidor'
      });
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSaveStatus(null);

    try {
      // Salva apenas provedores realmente configurados. Chaves já existentes
      // não são reenviadas (o servidor preserva a chave mascarada).
      const configuredProviders: Partial<Record<AIProviderId, AIProviderConfig>> = {};
      for (const [pid, provider] of Object.entries(providerConfigs) as Array<[AIProviderId, AIProviderConfig]>) {
        const id = pid as AIProviderId;
        const meta = PROVIDERS.find(p => p.id === id);
        const hasKey = Boolean(provider.apiKey?.trim()) || Boolean(provider.hasApiKey);
        const keyless = meta?.requiresApiKey === false
          && Boolean(provider.baseUrl?.trim())
          && !/localhost|127\.0\.0\.1/i.test(provider.baseUrl || '');
        if (!hasKey && !keyless) continue;

        const clean: AIProviderConfig = { ...provider };
        delete clean.hasApiKey;
        if (!clean.apiKey?.trim()) delete clean.apiKey;
        const fetchedModels = fetchedModelsMap[id];
        if (Array.isArray(fetchedModels) && fetchedModels.length > 0) {
          clean.availableModels = fetchedModels;
        }
        configuredProviders[id] = clean;
      }

      if (!configuredProviders[activeProvider]) {
        throw new Error(`Configure e salve uma chave para o provedor ativo (${currentProviderMeta.name}) antes de continuar.`);
      }

      const isTenantSpecific = selectedTenantForAI && selectedTenantForAI !== 'global_default';
      const endpoint = isTenantSpecific
        ? `/api/tenants/${selectedTenantForAI}/aiconfig`
        : '/api/config/ai';

      const payload = {
        activeProvider,
        embeddingProvider: configuredProviders[embeddingProvider] ? embeddingProvider : activeProvider,
        embeddingModel,
        fewShotPrompt,
        useEmbeddings,
        providers: configuredProviders
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: payload, userEmail })
      });

      const data = await response.json();
      if (data.success && data.config) {
        if (!isTenantSpecific) {
          onUpdate(data.config);
        }
        const savedActive = (data.config.activeProvider as AIProviderId) || activeProvider;
        setActiveProvider(savedActive);
        setProviderConfigs(buildProviderConfigs(data.config.providers));
        const targetLabel = isTenantSpecific ? `Tenant [${selectedTenantForAI}]` : 'Configuração Global SaaS';
        setSaveStatus({
          type: 'success',
          message: `Provedores e modelos salvos com segurança para ${targetLabel}.`
        });
        setTimeout(() => setSaveStatus(null), 4500);
      } else {
        throw new Error(data.error || 'Falha ao salvar configurações.');
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Houve um erro ao persistir as configurações.'
      });
    } finally {
      setSavingSettings(false);
    }
  }

  // Calibration handlers
  const parseCSVRows = (text: string) => {
    const lines = text.split('\n');
    if (lines.length === 0) return [];
    const firstLine = lines[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));
    const rows: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values: string[] = [];
      let currentVal = '';
      let inQuotes = false;
      
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ""));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ""));
      if (values.length > 0) {
        const rowObj: any = {};
        headers.forEach((h, index) => {
          if (h) rowObj[h] = values[index] || '';
        });
        rows.push(rowObj);
      }
    }
    return rows;
  };

  const parseJSONContent = (text: string): any[] => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        if (parsed.id_interacao || parsed.id || parsed.metadados) return [parsed];
        for (const k of Object.keys(parsed)) {
          if (Array.isArray(parsed[k])) return parsed[k];
        }
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleCalibFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'interactions' | 'monitorias') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCalibError(null);
    setCalibSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        if (type === 'interactions') {
          const rows = file.name.toLowerCase().endsWith('.json') ? parseJSONContent(text) : parseCSVRows(text);
          setCalibInteractions(rows);
          setCalibInteractionsName(file.name);
          setCalibSuccess(`Sucesso: carregados ${rows.length} atendimentos.`);
        } else {
          const rows = file.name.toLowerCase().endsWith('.json') ? parseJSONContent(text) : parseCSVRows(text);
          setCalibMonitorias(rows);
          setCalibMonitoriasName(file.name);
          setCalibSuccess(`Sucesso: carregados ${rows.length} laudos de auditoria.`);
        }
      } catch (err: any) {
        setCalibError(`Falha ao ler arquivo: ${err.message}`);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const availableModelsForActive = fetchedModelsMap[activeProvider] || currentProviderConfig.availableModels || currentProviderMeta.defaultModels;
  const embeddingProviderMeta = PROVIDERS.find(p => p.id === embeddingProvider) || PROVIDERS[0];
  const fetchedEmbedModels = (fetchedModelsMap[embeddingProvider] || []).filter(m => /embed|bge|minilm|nomic|mxbai|vector|text-embedding/i.test(m));

  const availableEmbeddingModels = Array.from(new Set([
    ...embeddingProviderMeta.defaultEmbeddingModels,
    ...fetchedEmbedModels
  ]));

  return (
    <div className="space-y-6 text-left animate-fade-in" id="geminiConfigCleanRoot">
      
      {/* CABEÇALHO CLEAN COM SELETOR DE GOVERNANÇA DE TENANT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Central de Inteligência Artificial Multi-Provedor
              </h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                14 Provedores Suportados
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Conexão, captura dinâmica de modelos e orquestração de LLMs para Auto-QA e AI Data Chat.
            </p>
          </div>
        </div>

        {/* ALOCAÇÃO POR TENANT */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl self-stretch md:self-auto">
          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Governança de IA:</span>
            <select
              value={selectedTenantForAI}
              onFocus={fetchTenantsList}
              onChange={(e) => {
                // A carga dos valores é feita pelo efeito de selectedTenantForAI.
                // Não sobrescrever o config global com o efetivo do tenant.
                setSelectedTenantForAI(e.target.value);
              }}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-4"
            >
              {availableTenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SELEÇÃO MODERNA E COMPACTA DE PROVEDORES (CHIPS COM BADGES) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Selecione o Provedor e o Modelo Ativo
          </span>
          <span className="text-xs text-indigo-600 font-bold">
            {hasConfiguredProvider
              ? `Ativo: ${currentProviderMeta.name} • ${currentProviderConfig.selectedModel || 'modelo não definido'}`
              : 'Nenhum provedor ativo configurado'}
          </span>
        </div>

        {!hasConfiguredProvider && (
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
            Nenhum provedor configurado. Informe a chave de API de ao menos um provedor e clique em <strong>Salvar</strong>. O sistema não usará Gemini por padrão.
          </div>
        )}

        {hasConfiguredProvider && !configuredProviderIds.includes(activeProvider) && (
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
            O provedor selecionado ainda não tem chave configurada. Escolha um provedor com o selo <strong>Configurado</strong> ou informe a chave abaixo.
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {PROVIDERS.map((p) => {
            const isSelected = activeProvider === p.id;
            const isConfigured = configuredProviderIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProvider(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer shrink-0 ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{p.name}</span>
                {isConfigured && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                    isSelected ? 'bg-emerald-400/25 text-emerald-50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    Configurado
                  </span>
                )}
                <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                }`}>
                  {p.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-ABAS (MODELO & CHAVE / CALIBRAÇÃO / EMBEDDINGS) */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('model')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'model'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Credenciais &amp; Modelos</span>
        </button>

        {!isMasterAdmin && (
          <button
            type="button"
            onClick={() => setActiveSubTab('fewshot')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'fewshot'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Calibração Few-Shot</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveSubTab('embeddings')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'embeddings'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Embeddings Vetoriais</span>
        </button>
      </div>

      {/* CONTEÚDO DA SUB-ABA */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SUB-ABA 1: CREDENCIAIS & MODELOS */}
        {activeSubTab === 'model' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUNA 1: CREDENCIAIS E CONECTIVIDADE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    1. Parâmetros de Autenticação
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">{currentProviderMeta.name}</span>
              </div>

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    API Key / Chave de Acesso
                  </label>
                  {currentProviderConfig.hasApiKey && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      Chave já configurada
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={currentProviderConfig.apiKey || ''}
                    onChange={(e) => updateActiveProviderField('apiKey', e.target.value)}
                    placeholder={currentProviderConfig.hasApiKey
                      ? 'Deixe em branco para manter a chave salva...'
                      : (currentProviderMeta.requiresApiKey ? `Insira sua chave do ${currentProviderMeta.name}...` : 'Não requer chave (Ollama local)')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Endpoint Gateway / Base URL
                </label>
                <input
                  type="text"
                  value={currentProviderConfig.baseUrl || currentProviderMeta.defaultBaseUrl}
                  onChange={(e) => updateActiveProviderField('baseUrl', e.target.value)}
                  placeholder={currentProviderMeta.defaultBaseUrl}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              {/* BOTÕES DE TESTE E CAPTURA */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fetchDynamicModels(activeProvider)}
                  disabled={loadingModels}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {loadingModels ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                  <span>Capturar Modelos</span>
                </button>

                <button
                  type="button"
                  onClick={testConnection}
                  disabled={loadingModels}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Testar Conexão</span>
                </button>
              </div>

              {/* BANNER DE STATUS DA CONEXÃO */}
              {connectionStatus && (
                <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
                  connectionStatus.success 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {connectionStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{connectionStatus.message}</span>
                </div>
              )}
            </div>

            {/* COLUNA 2: SELEÇÃO DE MODELOS (AUTO-QA & DATA CHAT) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Alocação de Modelos
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">Inferência Operacional</span>
              </div>

              {/* Modelo de Auto-QA */}
              <div className="space-y-1.5 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Modelo Orquestrador de Auditoria (Auto-QA)</span>
                  </label>
                  <span className="text-[9px] px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-md">
                    Regras de Negócio
                  </span>
                </div>
                <select
                  value={currentProviderConfig.selectedModel || availableModelsForActive[0] || ''}
                  onChange={(e) => updateActiveProviderField('selectedModel', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer mt-1"
                >
                  {availableModelsForActive.map((m) => (
                    <option key={`orch-${m}`} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Modelo de Data Chat */}
              <div className="space-y-1.5 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Modelo do Assistente Virtual / AI Data Chat</span>
                  </label>
                  <span className="text-[9px] px-2 py-0.5 bg-cyan-100 text-cyan-800 font-bold rounded-md">
                    Interativo
                  </span>
                </div>
                <select
                  value={currentProviderConfig.chatModel || availableModelsForActive[0] || ''}
                  onChange={(e) => updateActiveProviderField('chatModel', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer mt-1"
                >
                  {availableModelsForActive.map((m) => (
                    <option key={`chat-${m}`} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* DICA INFORMATIVA */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl text-xs text-indigo-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  Isolamento por Provedor
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  As chaves e modelos são memorizados individualmente para cada provedor. Ao alternar de provedor, seus dados já configurados são preservados.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* SUB-ABA 2: CALIBRAÇÃO FEW-SHOT */}
        {activeSubTab === 'fewshot' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Diretrizes de Calibração Fina (Exemplos Few-Shot)
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Forneça exemplos de atendimentos reais emparelhados com laudos humanos para calibrar a precisão e diminuir alucinações.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2">
                <span className="block text-[11px] font-bold text-slate-700 uppercase">1. Atendimentos / Diálogos</span>
                <div 
                  onClick={() => calibInteractionsInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all bg-white hover:bg-slate-50 ${calibInteractions.length > 0 ? 'border-emerald-500' : 'border-slate-300'}`}
                >
                  <input 
                    ref={calibInteractionsInputRef}
                    type="file"
                    onChange={(e) => handleCalibFileChange(e, 'interactions')}
                    className="hidden"
                    accept=".json, .csv"
                  />
                  <Upload className={`w-5 h-5 mx-auto mb-1 ${calibInteractions.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="block text-xs font-semibold text-slate-700 truncate">
                    {calibInteractionsName || 'Carregar Atendimentos (JSON/CSV)'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2">
                <span className="block text-[11px] font-bold text-slate-700 uppercase">2. Laudos de Monitoria Humana</span>
                <div 
                  onClick={() => calibMonitoriaInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all bg-white hover:bg-slate-50 ${calibMonitorias.length > 0 ? 'border-emerald-500' : 'border-slate-300'}`}
                >
                  <input 
                    ref={calibMonitoriaInputRef}
                    type="file"
                    onChange={(e) => handleCalibFileChange(e, 'monitorias')}
                    className="hidden"
                    accept=".json, .csv"
                  />
                  <Upload className={`w-5 h-5 mx-auto mb-1 ${calibMonitorias.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="block text-xs font-semibold text-slate-700 truncate">
                    {calibMonitoriasName || 'Carregar Laudos Humanos (JSON/CSV)'}
                  </span>
                </div>
              </div>
            </div>

            {calibSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{calibSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                Editor de Contexto do Sistema (Prompt Grounding)
              </label>
              <textarea
                value={fewShotPrompt}
                onChange={(e) => setFewShotPrompt(e.target.value)}
                placeholder="Insira diretrizes complementares e exemplos Few-Shot estruturados..."
                className="w-full h-48 p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed shadow-inner"
                spellCheck="false"
              />
            </div>
          </div>
        )}

        {/* SUB-ABA 3: EMBEDDINGS */}
        {activeSubTab === 'embeddings' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-indigo-600" />
                Mapeamento por Vetores Semânticos (Embeddings)
              </h3>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={useEmbeddings}
                  onChange={(e) => setUseEmbeddings(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Provedor de Embeddings
                </label>
                <select
                  value={embeddingProvider}
                  onChange={(e) => {
                    const newP = e.target.value as AIProviderId;
                    setEmbeddingProvider(newP);
                    const meta = PROVIDERS.find(p => p.id === newP);
                    if (meta && meta.defaultEmbeddingModels.length > 0) {
                      setEmbeddingModel(meta.defaultEmbeddingModels[0]);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {PROVIDERS.map((p) => (
                    <option key={`emb-p-${p.id}`} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Modelo de Embedding Vetorial
                </label>
                <select
                  value={availableEmbeddingModels.includes(embeddingModel) ? embeddingModel : availableEmbeddingModels[0] || ''}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {availableEmbeddingModels.map((m) => (
                    <option key={`emb-m-${m}`} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Modelo Vetorial em Uso</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{embeddingProviderMeta.name} &gt; {embeddingModel}</span>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold font-mono">
                Cosine Similarity (0-100%)
              </span>
            </div>
          </div>
        )}

        {/* FEEDBACK DE SALVAMENTO */}
        {saveStatus && (
          <div className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
            saveStatus.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {/* BOTÃO PRINCIPAL DE SALVAR */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {savingSettings ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Salvando Parâmetros...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Parâmetros de IA</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
