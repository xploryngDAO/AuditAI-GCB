export interface InteractionEvaluation {
  greetingPassed: boolean;
  protocolInformed: boolean;
  resolutionConfirmed: boolean;
  professionalTone: boolean;
  summary: string;
  criticalFails: string[];
  improvements: string[];
  failJustifications?: Record<string, string>;
}

export interface Interaction {
  id: string;
  agentName: string;
  bpoName: string; // e.g., "BPO Alpha", "BPO Beta"
  customerName: string;
  rawCustomerName?: string;
  channel: 'audio' | 'chat';
  date: string;
  duration: number; // in seconds
  silenceTime: number; // in seconds (for audio)
  score: number; // 0 - 100 auto QA score
  csat: number; // estimated CSAT (1 to 5 stars)
  sentiment: 'Positivo' | 'Neutro' | 'Negativo';
  transcript: string;
  rawTranscript?: string;
  scriptAdherence: number; // 0 - 100 percentage
  evaluation: InteractionEvaluation;
  genesysExternalId?: string; // present if synced from Genesys
  genesysQueueName?: string; // Genesys Queue/Fila identifier
  semanticSimilarity?: number; // 0 - 100% semantic matching with ideal script
  auditStatus?: 'completed' | 'pending' | 'failed';
  auditError?: string;
  tenantId?: string;
  piiMasked?: boolean;
}

export interface GuiaItem {
  id: number;
  relevancia: 'LEVE' | 'MODERADA' | 'CRÍTICA' | 'PÊNALTI (ERRO FATAL)';
  bloco: string; // e.g., Processo, Conhecimento, Sistemas, Experiência
  motivoOriginal: string;
  motivoSimplificado: string;
  categoriaEstrategica: string;
  scorePenalidade: number; // points deducted (e.g. 2, 3, 5, or 100 for zera)
  observacao?: string;
  acaoCorretiva?: string; // orientação/ação esperada para o desvio (opcional)
  tenantId?: string;
  subtenantId?: string; // sub-tenant ID or BPO name, or 'todos'
  queueName?: string; // queue/fila name or 'todas'
}

export interface MonitoriaTradicional {
  id: string; // matches interaction UUID
  dataHora: string;
  funcionaria: string;
  justificativaResposta: string;
  pilar: string;
  detalheResposta: string;
  pontosDeduzidos: number;
  classificacao: string;
  idLigacao: string;
  segmento: string;
  assuntoMotivo: string;
  tabulacao: string;
}

export interface BookItem {
  id: string;
  name: string;
  theme: string;
  content: string;
  channel: 'todos' | 'audio' | 'chat';
  fileType: string;
  uploadDate: string;
  isFallback?: boolean;
  fallbackReason?: string;
  tenantId?: string;
  subtenantId?: string; // sub-tenant ID or BPO name, or 'todos'
  queueName?: string; // queue/fila name or 'todas'
}

export type AIProviderId = 
  | 'gemini' 
  | 'openai' 
  | 'anthropic' 
  | 'groq'
  | 'deepseek' 
  | 'moonshot' 
  | 'zhipu' 
  | 'nvidia' 
  | 'xai' 
  | 'mistral' 
  | 'qwen' 
  | 'ollama' 
  | 'openrouter' 
  | 'huggingface';

export interface AIProviderConfig {
  apiKey?: string;
  hasApiKey?: boolean;
  baseUrl?: string;
  selectedModel?: string;
  chatModel?: string;
  embeddingModel?: string;
  availableModels?: string[];
  availableEmbeddingModels?: string[];
}

export interface MetodologiaBloco {
  id: string;
  nome: string;
  peso: number; // e.g., 25 (%)
  descricao: string; // e.g., "Aderência aos processos e regras operacionais da marca"
  cor?: string; // "indigo" | "emerald" | "amber" | "rose" | "purple" | "blue" | "cyan"
  ativo: boolean;
}

export interface AuditConfig {
  greetingWeight: number;
  protocolWeight: number;
  resolutionWeight: number;
  toneWeight: number;
  expectedScript: string;
  criticalDeviations: string[];
  bookContent?: string; // NOVO: book de atendimento text
  books?: BookItem[]; // NOVO: lista de books segmentados por tema/canal
  guiaItens?: GuiaItem[]; // NOVO: motivos do guia de atendimento
  blocos?: MetodologiaBloco[]; // NOVO: Blocos customizáveis da Metodologia por Tenant
  geminiApiKey?: string;
  geminiModel?: string;
  globalModel?: string;
  orchestratorModel?: string;
  chatModel?: string;
  fewShotPrompt?: string;
  useEmbeddings?: boolean;
  
  // Multi-provider configuration
  activeProvider?: AIProviderId;
  embeddingProvider?: AIProviderId;
  embeddingModel?: string;
  providers?: Partial<Record<AIProviderId, AIProviderConfig>>;
}

export interface GenesysQueue {
  id: string;
  name: string;
  active: boolean;
  description?: string;
  capturedCount?: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  cnpj?: string;
  active: boolean;
  adminEmail: string;
  createdAt: string;
  parentId?: string | null; // null for top-level Tenants (e.g. Empresa), or parent tenant ID for Sub-tenants (BPO partners)
  isSubtenant?: boolean;
  bpoName?: string; // Associated BPO partner name if sub-tenant
  plan?: 'enterprise' | 'pro' | 'basic';
  aiConfig?: Partial<AuditConfig>; // Per-tenant LLM/AI configuration override
}

export interface UserSession {
  role: 'superadmin' | 'admin' | 'bpo';
  bpoName: string | null; // restricts read scope for BPO users
  tenantId?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  loading?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  tenantId?: string;
}

export interface HeaderMapping {
  id: string;
  agentName: string;
  customerName: string;
  bpoName: string;
  channel: string;
  transcript: string;
  duration: string;
}

export interface GenesysCreds {
  clientId: string;
  clientSecret: string;
  region?: string;
  environment?: string;
  autoSync?: boolean;
  syncInterval?: number; // in minutes
  hoursBack?: number; // e.g. 24, 72, 168, 720, 2160
  searchTimeframe?: '24h' | '3d' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  queues?: string[];
}

export interface GenesysRecurringConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g. 60 for 1 hour
  creds: GenesysCreds;
  targetBpo: string;
  lastRun: string | null;
  nextRun: string | null;
  lastRunStatus: string | null;
  totalCapturedCount: number;
  logs: string[];
  queues?: GenesysQueue[];
  piiMaskingEnabled?: boolean;
  tenantId?: string;
}

export interface ZendeskCreds {
  subdomain: string;
  adminEmail: string;
  apiToken: string;
  oauthToken?: string;
  authType?: 'token' | 'oauth';
  autoSync?: boolean;
  syncInterval?: number; // in minutes
  hoursBack?: number; // e.g. 24, 72, 168, 720, 2160
  searchTimeframe?: '24h' | '3d' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  lines?: string[];
  queues?: string[];
  channelType?: 'voice' | 'chat' | 'messaging' | 'all';
}

export interface ZendeskRecurringConfig {
  enabled: boolean;
  intervalMinutes: number;
  creds: ZendeskCreds;
  targetBpo: string;
  lastRun: string | null;
  nextRun: string | null;
  lastRunStatus: string | null;
  totalCapturedCount: number;
  logs: string[];
  lines?: string[];
  queues?: string[];
  piiMaskingEnabled?: boolean;
  tenantId?: string;
}

export interface TwilioCreds {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
  workspaceSid?: string;
  webhookSecret?: string;
  autoSync?: boolean;
  syncInterval?: number;
  hoursBack?: number;
  searchTimeframe?: '24h' | '3d' | '7d' | '30d' | '90d' | 'custom';
  maxResults?: number;
  queues?: string[];
  phoneNumbers?: string[];
}

export interface AmazonConnectCreds {
  instanceArn?: string;
  instanceId?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  s3BucketName?: string;
  autoSync?: boolean;
  syncInterval?: number;
  hoursBack?: number;
  searchTimeframe?: '24h' | '3d' | '7d' | '30d' | '90d' | 'custom';
  maxResults?: number;
  queues?: string[];
  contactLensEnabled?: boolean;
}

export interface AvayaCreds {
  pabxServerHost: string;
  apiPort?: string;
  sipTrunkUser?: string;
  apiSecret: string;
  orgUnit?: string;
  tlsVerify?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  hoursBack?: number;
  maxResults?: number;
  skillsOrVdns?: string[];
  skills?: string[];
}

export interface CiscoCreds {
  orgId: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  region?: string;
  autoSync?: boolean;
  syncInterval?: number;
  hoursBack?: number;
  maxResults?: number;
  entryPointsOrQueues?: string[];
  queues?: string[];
}

export interface UniversalWebhookConfig {
  endpointUrl: string;
  webhookSecret: string;
  authHeaderKey?: string;
  expectedSignatureHeader?: string;
  fieldMapping?: {
    interactionIdKey?: string;
    transcriptKey?: string;
    audioUrlKey?: string;
    agentNameKey?: string;
    customerNameKey?: string;
    bpoNameKey?: string;
    channelKey?: string;
    durationKey?: string;
    queueKey?: string;
    tenantKey?: string;
  };
  samplePayload?: string;
  recentLogs?: {
    id: string;
    timestamp: string;
    status: 'success' | 'error' | 'rejected';
    ip?: string;
    interactionId?: string;
    message: string;
    payloadSnippet?: string;
  }[];
}

