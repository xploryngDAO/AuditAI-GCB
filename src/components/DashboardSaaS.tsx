import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Server, 
  Activity, 
  Cpu, 
  Users, 
  ShieldCheck, 
  BarChart3, 
  Zap, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  Globe, 
  Lock, 
  Clock, 
  ArrowUpRight, 
  HardDrive, 
  Layers, 
  Terminal,
  AlertTriangle,
  Key,
  Radio
} from 'lucide-react';

interface DashboardSaaSProps {
  userEmail?: string;
}

export default function DashboardSaaS({ userEmail = 'master@admin.com' }: DashboardSaaSProps) {
  const [loading, setLoading] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString('pt-BR'));

  // Metrics state
  const [telemetry, setTelemetry] = useState({
    totalTenants: 5,
    activeSubtenants: 3,
    totalUsers: 28,
    activeLogins24h: 19,
    totalApiRequests: 142850,
    apiSuccessRate: '99.85%',
    avgLatencyMs: 245,
    geminiTokensUsed: '4.2M',
    genesysAudioExtractedMb: '8,420 MB',
    activeConnectors: 4
  });

  // Recent SaaS Activity Logs
  const [activityLogs, setActivityLogs] = useState([
    { id: 'log-1', tenant: 'Ambiente Matriz', action: 'Execução Ingestão STA Genesys', system: 'Genesys Cloud STA', apiCalls: 124, status: '200 OK', timestamp: '10 min atrás', user: 'sistema.genesys@casasbahia.com' },
    { id: 'log-2', tenant: 'Ambiente Matriz', action: 'Auditoria de Voz com Gemini 3.5 Flash', system: 'Google Gemini API', apiCalls: 45, status: '200 OK', timestamp: '18 min atrás', user: 'auditor@casasbahia.com' },
    { id: 'log-3', tenant: 'Ambiente Matriz', action: 'Validação de Prompt e Calibração Few-Shot', system: 'Prompt Engine', apiCalls: 12, status: '200 OK', timestamp: '35 min atrás', user: 'gestor@casasbahia.com' },
    { id: 'log-4', tenant: 'Ambiente Matriz', action: 'Consulta ao Assistente de QA Chat', system: 'Chat LLM Orchestrator', apiCalls: 8, status: '200 OK', timestamp: '50 min atrás', user: 'supervisor@casasbahia.com' },
    { id: 'log-5', tenant: 'Ambiente Digital', action: 'Atualização de Credenciais Genesys OAuth', system: 'Genesys Connector', apiCalls: 2, status: '200 OK', timestamp: '1h atrás', user: 'admin@casasbahia.com' },
    { id: 'log-6', tenant: 'Ambiente Matriz', action: 'Consulta de Relatório de Sintonia PII', system: 'LGPD Masking Service', apiCalls: 67, status: '200 OK', timestamp: '2h atrás', user: 'master@casasbahia.com' }
  ]);

  // System Connectors Status
  const [systemStatuses, setSystemStatuses] = useState([
    { name: 'Google Gemini Pro / Flash API', category: 'Provedor de IA Principal', status: 'operacional', latency: '210ms', uptime: '99.98%', badge: 'Primary LLM' },
    { name: 'Genesys Cloud STA API Gateway', category: 'Integração de Telefonia/PABX', status: 'operacional', latency: '340ms', uptime: '99.90%', badge: 'Telephony Sync' },
    { name: 'OpenAI GPT-4o Connector', category: 'Provedor IA Secundário', status: 'operacional', latency: '410ms', uptime: '99.85%', badge: 'Fallback LLM' },
    { name: 'Motor de Mascaramento LGPD (PII)', category: 'Segurança & Privacidade', status: 'operacional', latency: '15ms', uptime: '100.0%', badge: 'Data Privacy' },
    { name: 'Firestore / Database Isolation Layer', category: 'Armazenamento Multi-Tenant', status: 'operacional', latency: '42ms', uptime: '100.0%', badge: 'DB Engine' }
  ]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLastRefreshed(new Date().toLocaleTimeString('pt-BR'));
      setLoading(false);
    }, 600);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-12">
      
      {/* HEADER BANNER SAAS SUPER ADMIN */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start gap-4 z-10">
          <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl text-indigo-300 shrink-0 shadow-inner">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider">
                🌐 SaaS Super Admin Control
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistemas 100% Operacionais
              </span>
            </div>
            <h1 className="text-xl font-black text-white mt-1">Painel Global de Telemetria e Uso da Plataforma</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Monitoramento exclusivo para o administrador master@admin.com. Acompanhe a volumetria de requisições de API, consumo de tokens de Inteligência Artificial, status dos conectores Genesys Cloud e atividades dos Tenants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Última Atualização</span>
            <span className="text-xs font-mono font-bold text-slate-200">{lastRefreshed}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Telemetria</span>
          </button>
        </div>
      </div>

      {/* PAINEL DE PRIVACIDADE E ISOLAMENTO BANCÁRIO */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-900 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Garantia de Isolamento de Dados Operacionais:</strong> Como Super Admin SaaS, seu painel exibe estritamente dados de consumo de infraestrutura, logs de sistema e volumetria de API. O conteúdo de ligações, áudios e auditorias permanece isolado para cada contratante (Tenant).
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-900 font-bold">
          <Lock className="w-3.5 h-3.5 text-amber-700" />
          <span>GDPR / LGPD Compliant</span>
        </div>
      </div>

      {/* METRIC CARDS TOP GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tenants Ativos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Tenants & Sub-Tenants</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{telemetry.totalTenants}</span>
            <span className="text-xs text-indigo-700 font-bold">({telemetry.activeSubtenants} Sub-Tenants BPO)</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Ambientes Isolados</span>
            <span className="text-emerald-600 font-bold font-mono">100% Ativos</span>
          </div>
        </div>

        {/* Card 2: Requisições Totais de API */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Volumetria de APIs (30d)</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{telemetry.totalApiRequests.toLocaleString('pt-BR')}</span>
            <span className="text-xs text-emerald-600 font-bold font-mono">+{telemetry.apiSuccessRate}</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Latência Média</span>
            <span className="text-slate-800 font-bold font-mono">{telemetry.avgLatencyMs} ms</span>
          </div>
        </div>

        {/* Card 3: Tokens de IA Processados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Tokens de IA Processados</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{telemetry.geminiTokensUsed}</span>
            <span className="text-xs text-purple-700 font-bold">Gemini & LLMs</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Modelos Ativos</span>
            <span className="text-purple-700 font-bold font-mono">Gemini 3.5 Flash / Pro</span>
          </div>
        </div>

        {/* Card 4: Telefonia & Genesys STA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Tráfego Genesys Cloud STA</span>
            <Radio className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{telemetry.genesysAudioExtractedMb}</span>
            <span className="text-xs text-blue-700 font-bold">Áudio Processado</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Conectores Conectados</span>
            <span className="text-emerald-600 font-bold font-mono">3 Filas Online</span>
          </div>
        </div>
      </div>

      {/* METRICAS DE REQUISIÇÕES POR SISTEMA / FERRAMENTA CONECTADA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REQUISIÇÕES POR FERRAMENTA / SISTEMA */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-150 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-indigo-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                Consumo de APIs por Sistema Integrado (Últimos 7 dias)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Telemetria Global
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {/* Sistema 1: Gemini AI API */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>Google Gemini Pro / Flash AI Engine</span>
                </span>
                <span className="font-mono text-indigo-700">82,400 reqs (57.6%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: '57.6%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Orquestração de Auditorias & Chat Assistente</span>
                <span>Latência: 210ms • Erros: 0.02%</span>
              </div>
            </div>

            {/* Sistema 2: Genesys Cloud STA API */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Genesys Cloud STA API Gateway (Recorrente)</span>
                </span>
                <span className="font-mono text-blue-700">41,200 reqs (28.8%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '28.8%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Extração Automática de Áudios e Transcrições</span>
                <span>Polling: 15 min • Status: 200 OK</span>
              </div>
            </div>

            {/* Sistema 3: Ingestão de Arquivos & Batch Audio */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Ingestão em Lote e Transcrição Áudio</span>
                </span>
                <span className="font-mono text-emerald-700">14,800 reqs (10.3%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: '10.3%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Processamento MP3/WAV/Text de Ingestão</span>
                <span>Taxa de Conversão: 99.9%</span>
              </div>
            </div>

            {/* Sistema 4: Autenticação & Sessões */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Autenticação Multi-Tenant & Token Sessions</span>
                </span>
                <span className="font-mono text-amber-700">4,450 reqs (3.3%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '3.3%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Sessões Isoladas de Admin e BPO</span>
                <span>0 Falhas de Segurança Detectadas</span>
              </div>
            </div>
          </div>
        </div>

        {/* STATUS EM TEMPO REAL DOS PROVEDORES & CONECTORES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-150 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-indigo-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                Health Check dos Conectores
              </h3>
            </div>
            <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              PING OK
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {systemStatuses.map((sys, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <strong className="text-xs text-slate-900">{sys.name}</strong>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                    {sys.badge}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{sys.category}</span>
                  <span className="text-slate-700 font-bold">{sys.latency} • Uptime {sys.uptime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* TABELA DE LOGS DE USO DOS TENANTS E USUÁRIOS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-150 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4.5 h-4.5 text-indigo-600" />
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                Logs de Uso e Execução dos Tenants & Sub-Tenants
              </h3>
              <p className="text-[11px] text-slate-500">
                Registro auditável de chamadas às APIs e ferramentas por usuário e tenant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Filtro:</span>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="24h">Últimas 24 Horas</option>
              <option value="7d">Últimos 7 Dias</option>
              <option value="30d">Últimos 30 Dias</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase text-[9px] tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3">Tenant / Sub-Tenant</th>
                <th className="py-2.5 px-3">Ação Executada</th>
                <th className="py-2.5 px-3">Sistema Integrado</th>
                <th className="py-2.5 px-3">Usuário Autenticado</th>
                <th className="py-2.5 px-3 text-center">Reqs API</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <strong className="text-slate-900 font-bold">{log.tenant}</strong>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800">{log.action}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[10px] font-mono font-bold">
                      {log.system}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{log.user}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{log.apiCalls}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[9px] font-mono font-bold">
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-400">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
