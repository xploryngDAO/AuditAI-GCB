import React, { useState, useMemo } from 'react';
import { Interaction, UserSession, GuiaItem } from '../types';
import { 
  Building2, 
  Users, 
  PhoneCall, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  BarChart4,
  Smile,
  Activity,
  Layers,
  Sparkles,
  Filter,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Radio,
  Zap,
  HelpCircle,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface DashboardGeralProps {
  interactions: Interaction[];
  session: UserSession;
  bpos?: string[];
  guiaItens?: GuiaItem[];
  onNavigateToAudit?: (interactionId?: string) => void;
}

export default function DashboardGeral({ 
  interactions, 
  session, 
  bpos = ["BPO Alpha", "BPO Beta", "BPO Gamma"],
  guiaItens = [],
  onNavigateToAudit
}: DashboardGeralProps) {
  const [selectedBpo, setSelectedBpo] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all"); // all, 7d, 30d
  const [riskFilter, setRiskFilter] = useState<string>("all"); // all, high, medium, low
  const [activeTab, setActiveTab] = useState<'geral' | 'bpos' | 'falhas' | 'sentimento'>('geral');

  const isBpoUser = session.role === 'bpo';
  const userBpo = session.bpoName;

  // Extract all unique BPOs dynamically
  const availableBpos = useMemo(() => {
    return Array.from(
      new Set([...bpos, ...interactions.map(i => i.bpoName).filter(Boolean)])
    ).sort();
  }, [bpos, interactions]);

  // Filter interactions based on selections
  const filteredInteractions = useMemo(() => {
    return interactions.filter(item => {
      // Autorização por tenant/BPO é feita no servidor; aqui só filtro de exibição.
      if (selectedBpo !== "all" && item.bpoName?.toLowerCase() !== selectedBpo.toLowerCase()) return false;
      if (channelFilter !== "all" && item.channel?.toLowerCase() !== channelFilter.toLowerCase()) return false;
      
      if (timeFilter === "7d") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(item.date) >= sevenDaysAgo;
      }
      if (timeFilter === "30d") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(item.date) >= thirtyDaysAgo;
      }

      if (riskFilter === "critical") {
        const isCritical = (item.score ?? 0) === 0 || ((item.evaluation?.criticalFails?.length ?? 0) > 0);
        if (!isCritical) return false;
      } else if (riskFilter === "warning") {
        const isWarning = (item.score ?? 0) > 0 && (item.score ?? 0) < 70;
        if (!isWarning) return false;
      } else if (riskFilter === "excellent") {
        if ((item.score ?? 0) < 90) return false;
      }

      return true;
    });
  }, [interactions, isBpoUser, userBpo, selectedBpo, channelFilter, timeFilter, riskFilter]);

  // KPI Calculations
  const totalVolume = filteredInteractions.length;
  
  const avgAutoQAScore = totalVolume > 0 
    ? Math.round(filteredInteractions.reduce((acc, curr) => acc + (curr.score ?? 0), 0) / totalVolume)
    : 0;

  const avgScriptAdherence = totalVolume > 0
    ? Math.round(filteredInteractions.reduce((acc, curr) => acc + (curr.scriptAdherence ?? 0), 0) / totalVolume)
    : 0;

  const totalCriticalCalls = filteredInteractions.filter(
    curr => (curr.score ?? 0) === 0 || ((curr.evaluation?.criticalFails?.length ?? 0) > 0)
  ).length;
  
  const criticalPercent = totalVolume > 0 ? Math.round((totalCriticalCalls / totalVolume) * 100) : 0;

  const avgDurationSeconds = totalVolume > 0
    ? Math.round(filteredInteractions.reduce((acc, curr) => acc + (curr.duration ?? 0), 0) / totalVolume)
    : 0;

  const csatEvaluated = filteredInteractions.filter(
    (curr) => typeof curr.csat === 'number' && Number.isFinite(curr.csat) && curr.csat > 0
  );
  const csatVolume = csatEvaluated.length;

  const avgCsat = csatVolume > 0
    ? Number((csatEvaluated.reduce((acc, curr) => acc + curr.csat, 0) / csatVolume).toFixed(1))
    : 0;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  // Comparative aggregates per BPO
  const bposForBreakdown = useMemo(() => {
    return availableBpos.filter(bpo => {
      if (selectedBpo !== "all") return bpo.toLowerCase() === selectedBpo.toLowerCase();
      return true;
    });
  }, [availableBpos, selectedBpo]);

  const bpoPerfData = useMemo(() => {
    return bposForBreakdown.map(bpo => {
      const bpoCalls = filteredInteractions.filter(item => item.bpoName?.toLowerCase() === bpo.toLowerCase());
      const bpoVol = bpoCalls.length;
      const bpoAvgScore = bpoVol > 0 
        ? Math.round(bpoCalls.reduce((acc, curr) => acc + (curr.score ?? 0), 0) / bpoVol)
        : 0;
      const bpoAvgAdher = bpoVol > 0
        ? Math.round(bpoCalls.reduce((acc, curr) => acc + (curr.scriptAdherence ?? 0), 0) / bpoVol)
        : 0;
      const bpoCrits = bpoCalls.filter(curr => (curr.score ?? 0) === 0 || ((curr.evaluation?.criticalFails?.length ?? 0) > 0)).length;
      const bpoCsatCalls = bpoCalls.filter(
        (curr) => typeof curr.csat === 'number' && Number.isFinite(curr.csat) && curr.csat > 0
      );
      const bpoAvgCsat = bpoCsatCalls.length > 0
        ? Number((bpoCsatCalls.reduce((acc, curr) => acc + curr.csat, 0) / bpoCsatCalls.length).toFixed(1))
        : 0;

      return {
        name: bpo,
        "Score Auto-QA": bpoAvgScore,
        "Adesão Script": bpoAvgAdher,
        "Volume Ligações": bpoVol,
        "Taxa de Críticas (%)": bpoVol > 0 ? Math.round((bpoCrits / bpoVol) * 100) : 0,
        "Violadas (Nota ZERO)": bpoCrits,
        "Média CSAT": bpoAvgCsat
      };
    }).sort((a, b) => b["Score Auto-QA"] - a["Score Auto-QA"]);
  }, [bposForBreakdown, filteredInteractions]);

  // Sentiment Distribution
  const posCount = filteredInteractions.filter(item => item.sentiment?.toLowerCase() === 'positivo').length;
  const negCount = filteredInteractions.filter(item => item.sentiment?.toLowerCase() === 'negativo').length;
  const neuCount = Math.max(0, totalVolume - posCount - negCount);

  const sentimentPieData = [
    { name: 'Positivo', value: posCount, color: '#10b981', percentage: totalVolume > 0 ? Math.round((posCount / totalVolume) * 100) : 0 },
    { name: 'Neutro', value: neuCount, color: '#f59e0b', percentage: totalVolume > 0 ? Math.round((neuCount / totalVolume) * 100) : 0 },
    { name: 'Negativo', value: negCount, color: '#ef4444', percentage: totalVolume > 0 ? Math.round((negCount / totalVolume) * 100) : 0 }
  ].filter(item => item.value > 0);

  // Timeline data
  const timelineData = useMemo(() => {
    const datesMap: Record<string, { count: number; totalScore: number; totalAdher: number; crits: number }> = {};
    const sorted = [...filteredInteractions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(item => {
      const d = new Date(item.date);
      const label = isNaN(d.getTime()) ? 'Recente' : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!datesMap[label]) {
        datesMap[label] = { count: 0, totalScore: 0, totalAdher: 0, crits: 0 };
      }
      datesMap[label].count += 1;
      datesMap[label].totalScore += (item.score ?? 0);
      datesMap[label].totalAdher += (item.scriptAdherence ?? 0);
      if ((item.score ?? 0) === 0 || ((item.evaluation?.criticalFails?.length ?? 0) > 0)) {
        datesMap[label].crits += 1;
      }
    });

    return Object.keys(datesMap).map(label => ({
      data: label,
      "Score Médio": Math.round(datesMap[label].totalScore / datesMap[label].count),
      "Adesão Média": Math.round(datesMap[label].totalAdher / datesMap[label].count),
      "Falhas": datesMap[label].crits,
      "Volume": datesMap[label].count
    }));
  }, [filteredInteractions]);

  // Top Critical Offenses extracted from evaluation
  const topInfractions = useMemo(() => {
    const counts: Record<string, { count: number; bpos: Set<string> }> = {};

    filteredInteractions.forEach(item => {
      if (item.evaluation?.criticalFails && Array.isArray(item.evaluation.criticalFails)) {
        item.evaluation.criticalFails.forEach(fail => {
          if (!fail) return;
          if (!counts[fail]) {
            counts[fail] = { count: 0, bpos: new Set() };
          }
          counts[fail].count += 1;
          if (item.bpoName) counts[fail].bpos.add(item.bpoName);
        });
      }
    });

    return Object.entries(counts)
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        bpoCount: data.bpos.size,
        percentage: totalVolume > 0 ? Math.round((data.count / totalVolume) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredInteractions, totalVolume]);

  // Channel breakdown
  const voiceInteractions = filteredInteractions.filter(i => i.channel === 'audio');
  const chatInteractions = filteredInteractions.filter(i => i.channel === 'chat');

  const voiceAvgScore = voiceInteractions.length > 0 
    ? Math.round(voiceInteractions.reduce((acc, curr) => acc + (curr.score ?? 0), 0) / voiceInteractions.length) 
    : 0;

  const chatAvgScore = chatInteractions.length > 0 
    ? Math.round(chatInteractions.reduce((acc, curr) => acc + (curr.score ?? 0), 0) / chatInteractions.length) 
    : 0;

  // Best & Worst performing BPO
  const leaderBpo = bpoPerfData.length > 0 ? bpoPerfData[0] : null;

  return (
    <div className="space-y-6 text-left animate-fade-in" id="dashboardGeralRoot">
      
      {/* CABEÇALHO + ABAS FIXOS NO TOPO DURANTE O SCROLL */}
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200/70 space-y-3">
      {/* 1. CABEÇALHO COM CONTROLES AVANÇADOS E FILTROS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                Dashboard Executivo & Inteligência de Auto-QA
              </h2>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold">
                {totalVolume} Atendimentos Analisados
              </span>
              {leaderBpo && (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-600" /> Líder: {leaderBpo.name} ({leaderBpo["Score Auto-QA"]}pt)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidação analítica de conformidade regulatória, qualidade de atendimento e adesão a roteiros por parceiro.
            </p>
          </div>
        </div>

        {/* FILTROS ESTRUTURADOS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Parceiro / BPO</label>
            <select
              value={selectedBpo}
              onChange={(e) => setSelectedBpo(e.target.value)}
              disabled={isBpoUser}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">Todos os BPOs ({availableBpos.length})</option>
              {availableBpos.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Canal</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">Todos os Canais</option>
              <option value="audio">Voz (Ligação)</option>
              <option value="chat">WhatsApp / Chat</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Período</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">Histórico Completo</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtro de Risco</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">Todos os Níveis</option>
              <option value="critical">🚨 Falhas Críticas / Zero</option>
              <option value="warning">⚠️ Em Alerta (&lt;70)</option>
              <option value="excellent">⭐ Excelente (&ge;90)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ABAS DE VISÃO — mantidas visíveis junto com os filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('geral')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'geral'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart4 className="w-3.5 h-3.5" />
          <span>Visão Comparativa & Tendências</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bpos')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'bpos'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Ranking & Performance por BPO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('falhas')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'falhas'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Matriz de Desvios & Riscos ({topInfractions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sentimento')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sentimento'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Smile className="w-3.5 h-3.5" />
          <span>Sentimento & Canais</span>
        </button>
      </div>
      </div>

      {/* 2. KPIS PRINCIPAIS (6 CARDS AMPLIADOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* CARD 1: SCORE AUTO-QA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score Auto-QA</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-indigo-600">{avgAutoQAScore}</span>
              <span className="text-xs text-slate-400 font-sans font-semibold">/ 100 pt</span>
            </div>
            {/* Mini barra de progresso visual */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, avgAutoQAScore))}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Qualidade consolidada
            </span>
          </div>
        </div>

        {/* CARD 2: ADESÃO A ROTEIROS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Adesão a Roteiros</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-600">{avgScriptAdherence}%</span>
              <span className="text-xs text-slate-400 font-sans font-semibold">conformidade</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, avgScriptAdherence))}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Compliance com diretrizes
            </span>
          </div>
        </div>

        {/* CARD 3: FALHAS CRÍTICAS / NOTA ZERO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Falhas Críticas</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-rose-600">{criticalPercent}%</span>
              <span className="text-xs text-slate-400 font-sans font-semibold">({totalCriticalCalls} chamadas)</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, criticalPercent))}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-500" /> Risco Procon & Erro Fatal
            </span>
          </div>
        </div>

        {/* CARD 4: VOLUME TOTAL */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume Auditado</span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-xl">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-slate-900">{totalVolume}</span>
              <span className="text-xs text-slate-400 font-sans font-semibold">casos</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-bold">
              <span className="text-indigo-600 font-mono">{voiceInteractions.length} Voz</span>
              <span>•</span>
              <span className="text-emerald-600 font-mono">{chatInteractions.length} Chat</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
              100% monitoramento digital
            </span>
          </div>
        </div>

        {/* CARD 5: TMA MÉDIO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TMA Médio</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-slate-900">{formatDuration(avgDurationSeconds)}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(10, (avgDurationSeconds / 600) * 100))}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" /> Tempo em linha / contato
            </span>
          </div>
        </div>

        {/* CARD 6: CSAT ESTIMADO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CSAT Estimado IA</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
              <Smile className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-amber-600">
                {csatVolume > 0 ? avgCsat.toFixed(1).replace('.', ',') : '—'}
              </span>
              <span className="text-xs text-slate-400 font-sans font-semibold">/ 5,0 ⭐</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${csatVolume > 0 ? Math.min(100, (avgCsat / 5) * 100) : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 font-medium flex items-center gap-1">
              <Smile className="w-3 h-3 text-amber-500" />
              {csatVolume > 0
                ? `Percepção do cliente em ${csatVolume} atendimento${csatVolume > 1 ? 's' : ''} avaliado${csatVolume > 1 ? 's' : ''}`
                : 'Sem atendimentos com CSAT avaliado'}
            </span>
          </div>
        </div>

      </div>

      {/* 4. CONTEÚDO DINÂMICO CONFORME A SUB-ABA SELECIONADA */}

      {/* ABA GERAL: GRÁFICOS PRINCIPAIS AMPLIADOS */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* GRÁFICO 1: DESEMPENHO COMPARATIVO POR BPO (7 COLS) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart4 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Qualidade e Aderência por Parceiro BPO
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Auto-QA vs Script</span>
              </div>

              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bpoPerfData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="bold" />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} fontWeight="bold" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      labelStyle={{ fontWeight: 'bold', color: '#818cf8' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 10 }} />
                    <Bar dataKey="Score Auto-QA" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={28} />
                    <Bar dataKey="Adesão Script" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO 2: EVOLUÇÃO TEMPORAL (5 COLS) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Tendência Temporal de Qualidade
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Score & Adesão
                </span>
              </div>

              <div className="w-full h-[280px]">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorAdher" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="data" stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <YAxis domain={[40, 100]} stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Score Médio" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScore)" />
                      <Area type="monotone" dataKey="Adesão Média" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAdher)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-20 text-slate-400 text-xs italic">
                    Nenhum dado temporal registrado no período.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* PAINEL INFERIOR: RESUMO BPO E DESTAQUES DE DESVIOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* TABELA RESUMO DE BPOS (7 COLS) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Consolidado de Performance por BPO
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{bpoPerfData.length} Operações</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="pb-2">BPO / Operação</th>
                      <th className="pb-2 text-center">Volume</th>
                      <th className="pb-2 text-center">Score QA</th>
                      <th className="pb-2 text-center">Adesão</th>
                      <th className="pb-2 text-center">Nota Zero</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bpoPerfData.map((row, idx) => {
                      const isTop = idx === 0 && row["Score Auto-QA"] >= 80;
                      const hasHighCrits = row["Taxa de Críticas (%)"] > 15;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                            {isTop && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span>{row.name}</span>
                          </td>
                          <td className="py-2.5 text-center font-mono text-slate-600">
                            {row["Volume Ligações"]}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row["Score Auto-QA"] >= 85 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : row["Score Auto-QA"] >= 70 
                                  ? 'bg-amber-50 text-amber-700' 
                                  : 'bg-rose-50 text-rose-700'
                            }`}>
                              {row["Score Auto-QA"]}pt
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-mono text-emerald-700 font-bold">
                            {row["Adesão Script"]}%
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row["Violadas (Nota ZERO)"] > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {row["Violadas (Nota ZERO)"]}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              hasHighCrits 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : row["Score Auto-QA"] >= 80 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {hasHighCrits ? 'Atenção' : row["Score Auto-QA"] >= 80 ? 'Excelente' : 'Regular'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TOP INFRAÇÕES DO GUIA DE PENALIDADES (5 COLS) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Maiores Desvios de Roteiro (Top Falhas)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                  Ofensores
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {topInfractions.length > 0 ? (
                  topInfractions.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="truncate max-w-[240px] text-slate-900">{item.motivo}</span>
                        <span className="text-rose-600 font-mono">{item.count} ocorrências ({item.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-rose-500 h-full rounded-full" 
                          style={{ width: `${Math.min(100, item.percentage * 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Identificado em {item.bpoCount} BPO(s) parceiro(s)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    Nenhum desvio crítico registrado na amostra filtrada.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ABA BPOS: VISÃO DETALHADA DE OPERAÇÕES */}
      {activeTab === 'bpos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bpoPerfData.map((bpo, idx) => {
              const score = bpo["Score Auto-QA"];
              const adher = bpo["Adesão Script"];
              const volume = bpo["Volume Ligações"];
              const crits = bpo["Violadas (Nota ZERO)"];
              
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{bpo.name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium">Operação Parceira</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                        score >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        score >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {score}pt
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Adesão ao Roteiro</span>
                        <strong className="text-emerald-700 font-mono text-sm">{adher}%</strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Volume Total</span>
                        <strong className="text-slate-800 font-mono text-sm">{volume} ligações</strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Falhas Críticas</span>
                        <strong className={`font-mono text-sm ${crits > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {crits} ocorrências
                        </strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">CSAT Estimado</span>
                        <strong className="text-amber-600 font-mono text-sm">{bpo["Média CSAT"] > 0 ? `${bpo["Média CSAT"]} ⭐` : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="text-[10px] font-bold">Taxa de Risco: {bpo["Taxa de Críticas (%)"]}%</span>
                    {onNavigateToAudit && (
                      <button
                        type="button"
                        onClick={() => onNavigateToAudit()}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver Auditorias</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA FALHAS: DETALHAMENTO DE DESVIOS E RISCO PROCON */}
      {activeTab === 'falhas' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Matriz Completa de Desvios e Infrações Regulatórias
              </h3>
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              {totalCriticalCalls} Atendimentos com Apontamento
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topInfractions.map((inf, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{inf.motivo}</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-bold shrink-0">
                    {inf.count} casos ({inf.percentage}%)
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  Infração recorrente no processo operacional. Impacta negativamente a conformidade e a nota final do operador.
                </p>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Presente em {inf.bpoCount} operação(ões)</span>
                  <span className="text-rose-600 font-bold font-mono">Penalidade Gravíssima</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA SENTIMENTO & CANAIS */}
      {activeTab === 'sentimento' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* DONUT DE SENTIMENTO (6 COLS) */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smile className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Distribuição de Sentimento do Cliente
                </h3>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 pt-2">
              <div className="w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sentimentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sentimentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5 w-full sm:w-[220px]">
                {sentimentPieData.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </span>
                    <strong className="font-mono text-slate-900">{item.value} ({item.percentage}%)</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COMPARAÇÃO POR CANAL: VOZ VS CHAT (6 COLS) */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Performance por Canal (Voz vs WhatsApp)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-indigo-600" />
                    <strong className="text-xs text-slate-900">Voz (Ligação)</strong>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">
                    {voiceInteractions.length} chamadas
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Score Auto-QA Médio</span>
                  <span className="text-2xl font-bold font-mono text-indigo-700">{voiceAvgScore}pt</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Transcrição automática de áudio com detecção de silêncio e tom de voz.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <strong className="text-xs text-slate-900">WhatsApp / Chat</strong>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                    {chatInteractions.length} mensagens
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Score Auto-QA Médio</span>
                  <span className="text-2xl font-bold font-mono text-emerald-700">{chatAvgScore}pt</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Análise textual de conversas digitais e tempo de resposta do atendente.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
