import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Building2, 
  Network, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  CheckCircle, 
  Users, 
  Layers, 
  TrendingUp, 
  Activity, 
  ExternalLink,
  Plus,
  RefreshCw,
  Lock,
  Cpu,
  BarChart2
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  active: boolean;
  adminEmail: string;
  parentId?: string | null;
  isSubtenant?: boolean;
  bpoName?: string;
  plan?: string;
  createdAt?: string;
}

interface SystemIntegration {
  id: string;
  name: string;
  masterEnabled: boolean;
  vendor: string;
}

interface TenantMetric {
  tenantId: string;
  interactionsCount: number;
  usersCount: number;
  configuredConnectors: number;
  totalConnectors: number;
}

interface SaasMasterDashboardProps {
  onNavigate: (tab: string, subTab?: string) => void;
  onSelectTenantForAI?: (tenantId: string) => void;
  userEmail?: string;
}

export default function SaasMasterDashboard({
  onNavigate,
  onSelectTenantForAI,
  userEmail = 'master@admin.com'
}: SaasMasterDashboardProps) {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [systems, setSystems] = useState<SystemIntegration[]>([]);
  const [metrics, setMetrics] = useState<TenantMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [resTenants, resSystems, resMetrics] = await Promise.all([
        fetch(`/api/tenants?userEmail=${encodeURIComponent(userEmail)}`),
        fetch(`/api/integrations?userEmail=${encodeURIComponent(userEmail)}`),
        fetch('/api/saas/metrics')
      ]);

      if (resTenants.ok) {
        const dTenants = await resTenants.json();
        setTenants(dTenants.tenants || []);
      }

      if (resSystems.ok) {
        const dSystems = await resSystems.json();
        setSystems(dSystems.systems || []);
      }

      if (resMetrics.ok) {
        const dMetrics = await resMetrics.json();
        setMetrics(dMetrics.tenants || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Dashboard Master SaaS:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [userEmail]);

  const mainTenants = tenants.filter(t => !t.parentId && !t.isSubtenant);
  const subTenants = tenants.filter(t => t.parentId || t.isSubtenant);
  const activeSystems = systems.filter(s => s.masterEnabled);
  const metricsByTenant = new Map<string, TenantMetric>(metrics.map(metric => [metric.tenantId, metric]));

  return (
    <div className="space-y-6 text-left animate-fade-in" id="saasMasterDashboard">
      
      {/* 1. SAAS MASTER HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/70 p-6 rounded-2xl text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl text-indigo-300 shrink-0">
              <Globe className="w-7 h-7 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold text-indigo-300 tracking-wider px-2 py-0.5 bg-indigo-500/20 rounded border border-indigo-500/30">
                  Painel do Administrador Master SaaS
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Plataforma Ativa
                </span>
              </div>
              <h1 className="text-lg font-extrabold text-white mt-1 tracking-tight">
                Governança Global de Tenants & Sistemas AuditaQA
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('bpos')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Tenant / Sub-tenant</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Como administrador <strong>master@admin.com</strong>, você gerencia a infraestrutura multi-tenant, libera conectores de telefonia para as operações, configura modelos de Inteligência Artificial e audita a segurança e os acessos de todas as empresas contratantes e parceiras BPO de forma isolada.
        </p>
      </div>

      {/* 2. KPIS GLOBAIS DA PLATAFORMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: TENANTS MATRIZ */}
        <div 
          onClick={() => onNavigate('bpos')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tenants Matriz</span>
            <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{mainTenants.length}</span>
            <span className="text-[10px] text-emerald-600 font-bold">Empresas Contratantes</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">Ex: GCB (tenant-casas-bahia)</span>
        </div>

        {/* KPI 2: SUB-TENANTS / PARCEIRAS BPO */}
        <div 
          onClick={() => onNavigate('bpos')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-Tenants / BPOs</span>
            <div className="p-2 bg-emerald-50 text-emerald-650 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{subTenants.length}</span>
            <span className="text-[10px] text-emerald-600 font-bold">Ambientes Isolados</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">BPO Alpha, BPO Beta, Parceiros</span>
        </div>

        {/* KPI 3: HUB DE CONECTORES */}
        <div 
          onClick={() => onNavigate('configuracoes', 'integracoes')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conectores de Telefonia</span>
            <div className="p-2 bg-cyan-50 text-cyan-650 rounded-xl group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{activeSystems.length} / {systems.length}</span>
            <span className="text-[10px] text-cyan-600 font-bold">Disponíveis</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">Genesys, Twilio, Amazon, Avaya</span>
        </div>

        {/* KPI 4: PROVEDORES DE IA */}
        <div 
          onClick={() => onNavigate('configuracoes', 'ia')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Engine de IA</span>
            <div className="p-2 bg-purple-50 text-purple-650 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-slate-900">Gemini 3.6</span>
            <span className="text-[10px] text-purple-600 font-bold">Flash & Pro</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">Suporte Multimodal e PII LGPD</span>
        </div>

      </div>

      {/* 3. ATALHOS DIRETOS DAS SEÇÕES DE CONFIGURAÇÃO */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Módulos de Governança e Configuração Unificada
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* SEÇÃO 1: TENANTS */}
          <div 
            onClick={() => onNavigate('bpos')}
            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Tenants & Sub-Tenants
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gestão unificada de empresas contratantes e suas parceiras BPO com isolamento de dados.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
              <span>Acessar Gestão</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* SEÇÃO 2: HUB DE INTEGRAÇÕES & SAÚDE GLOBAL */}
          <div 
            onClick={() => onNavigate('configuracoes', 'integracoes')}
            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl w-fit group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-cyan-600 transition-colors">
                Hub Multissistemas & Saúde Global
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Monitore a saúde global, latências e execute testes diagnósticos para Genesys, Zendesk, Twilio, Connect, Avaya, Cisco e Webhooks.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-cyan-600">
              <span>Saúde Global & Testes</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* SEÇÃO 3: GESTÃO DE ACESSOS */}
          <div 
            onClick={() => onNavigate('configuracoes', 'acessos')}
            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Gestão Global de Acessos
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Criação e gerenciamento de permissões para SuperAdmins, Admins de Tenant e BPOs.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>Gerenciar Usuários</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* SEÇÃO 4: CONFIGURAÇÃO DE IA */}
          <div 
            onClick={() => onNavigate('configuracoes', 'ia')}
            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl w-fit group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                Modelos de IA & Prompts
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ajuste fino de chaves, temperatura e prompts de auditoria por tenant.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600">
              <span>Configurar IA</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </div>

      {/* 4. VISÃO DETALHADA DOS TENANTS & SUB-TENANTS REGISTRADOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              Visão Unificada de Ambientes (Tenants & Sub-Tenants)
            </h3>
            <p className="text-xs text-slate-500">
              Relação completa de empresas contratantes e sub-ambientes operacionais com status e controle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bpos')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Gerenciar na Tela Completa</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
            <p>Carregando inventário global de tenants...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="p-3">Nome / Tenant ID</th>
                  <th className="p-3">Tipo de Ambiente</th>
                  <th className="p-3">CNPJ</th>
                  <th className="p-3">Email Administrador</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações de Governança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map(t => {
                  const isMain = !t.parentId && !t.isSubtenant;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{t.id}</div>
                      </td>
                      <td className="p-3">
                        {isMain ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                            Tenant Matriz
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                            Sub-Tenant BPO ({t.bpoName || 'Parceira'})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{t.cnpj || '—'}</td>
                      <td className="p-3 font-mono text-slate-700">{t.adminEmail}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectTenantForAI) onSelectTenantForAI(t.id);
                              onNavigate('configuracoes', 'ia');
                            }}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Configurar IA
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. INVENTÁRIO OPERACIONAL AGREGADO POR TENANT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                Inventário Operacional Agregado por Tenant / Sub-tenant
              </h3>
              <p className="text-xs text-slate-500">
                Contadores reais disponíveis no estado da plataforma. Custos, tokens, uptime e latência só serão exibidos quando houver observabilidade configurada.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold rounded-md flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            Dados agregados, sem PII
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                <th className="p-3">Tenant / Sub-tenant</th>
                <th className="p-3">Atendimentos Registrados</th>
                <th className="p-3">Usuários Cadastrados</th>
                <th className="p-3">Conectores Configurados</th>
                <th className="p-3">Tokens e Custos de IA</th>
                <th className="p-3 text-right">Latência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {tenants.map((t) => {
                const metric = metricsByTenant.get(t.id);
                return (
                  <tr key={`telemetry-${t.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono">
                      <span className="font-bold text-slate-800">{t.name}</span>
                      <span className="block text-[10px] text-slate-400">{t.id}</span>
                    </td>
                    <td className="p-3 font-bold text-indigo-700">
                      {(metric?.interactionsCount || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-slate-700">
                      {metric?.usersCount || 0}
                    </td>
                    <td className="p-3 font-bold text-cyan-700">
                      {metric ? `${metric.configuredConnectors} / ${metric.totalConnectors}` : '—'}
                    </td>
                    <td className="p-3 text-slate-500">
                      Não instrumentado
                    </td>
                    <td className="p-3 text-right text-slate-500">
                      Não instrumentada
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
