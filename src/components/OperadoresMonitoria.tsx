import React, { useState } from 'react';
import { Interaction, UserSession } from '../types';
import { 
  Users, 
  Search, 
  Building2, 
  AlertTriangle, 
  User, 
  ChevronDown, 
  ChevronUp, 
  PhoneCall, 
  Sparkles,
  ArrowUpRight 
} from 'lucide-react';

interface OperadoresMonitoriaProps {
  interactions: Interaction[];
  session: UserSession;
  onSelectCall: (call: Interaction) => void;
  setActiveTab: (tab: 'dashboard' | 'ingestao' | 'metodologia' | 'chat' | 'bpos' | 'operadores' | 'adesao' | 'configuracoes') => void;
  bpos?: string[];
}

export default function OperadoresMonitoria({
  interactions,
  session,
  onSelectCall,
  setActiveTab,
  bpos = ["BPO Alpha", "BPO Beta", "BPO Gamma"]
}: OperadoresMonitoriaProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedBpo, setSelectedBpo] = useState<string>("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const isBpoUser = session.role === 'bpo';
  const effectiveBpo = isBpoUser ? session.bpoName : selectedBpo;

  const availableBpos = Array.from(
    new Set([...bpos, ...interactions.map(i => i.bpoName).filter(Boolean)])
  ).sort();

  // Group by Agent for drill-down
  const agentDrilldown = interactions.reduce((acc, item) => {
    const agentName = item.agentName || "Operador Desconhecido";
    const bpoName = item.bpoName || "Não Informado";

    // RBAC Filter
    if (isBpoUser && session.bpoName && bpoName.toLowerCase() !== session.bpoName.toLowerCase()) {
      return acc;
    }

    if (!acc[agentName]) {
      acc[agentName] = {
        name: agentName,
        bpo: bpoName,
        scoreSum: 0,
        count: 0,
        criticalCount: 0,
        calls: []
      };
    }
    acc[agentName].scoreSum += (item.score ?? 0);
    acc[agentName].count += 1;
    if ((item.evaluation?.criticalFails?.length ?? 0) > 0) {
      acc[agentName].criticalCount += (item.evaluation.criticalFails?.length ?? 0);
    }
    acc[agentName].calls.push(item);
    return acc;
  }, {} as Record<string, { name: string; bpo: string; scoreSum: number; count: number; criticalCount: number; calls: Interaction[] }>);

  // Filter list
  const agentsList = Object.values(agentDrilldown).filter(agent => {
    if (selectedBpo !== "all" && agent.bpo.toLowerCase() !== selectedBpo.toLowerCase()) {
      return false;
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return agent.name.toLowerCase().includes(search) || agent.bpo.toLowerCase().includes(search);
    }
    return true;
  });

  // Sort: Lowest average score first (since they are "sob monitoria" / under monitoring)
  const sortedAgents = agentsList.sort((a, b) => (a.scoreSum / a.count) - (b.scoreSum / b.count));

  const handleInspectCall = (call: Interaction) => {
    onSelectCall(call);
    setActiveTab('dashboard');
  };

  return (
    <div className="space-y-4">
      {/* Header and explanation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-50 pb-3 leading-none select-none">
        <div className="text-left font-sans">
          <h1 className="ds-heading">
            <Users className="w-4.5 h-4.5 text-indigo-650" />
            <span>Painel de Operadores sob Monitoria</span>
          </h1>
          <p className="ds-subtitle">Visão de todos os operadores de BPO integrados ao sistema, focada prioritariamente em scores do Auto-QA.</p>
        </div>
        <div className="flex gap-3 shrink-0 self-start md:self-auto">
          <div className="bg-slate-50 border border-slate-200 p-2.5 px-4 rounded-xl text-center shadow-3xs flex items-center gap-2 font-sans">
            <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Total Monitorados:</span>
            <strong className="text-lg font-black font-mono text-indigo-650 leading-none">{sortedAgents.length}</strong>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 rounded">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] uppercase font-bold text-slate-600 font-sans">Pesquisa e Segmentação</span>
        </div>

        <div className="flex gap-2.5 flex-1 max-w-xl self-stretch justify-end">
          {/* Search Input */}
          <div className="relative flex-1">
            <input 
              type="text"
              placeholder="Pesquisar operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded px-2.5 py-1 text-xs font-semibold text-slate-705 focus:outline-none focus:ring-1 focus:ring-indigo-650"
            />
          </div>

          {/* BPO Dropdown */}
          {!isBpoUser && (
            <div className="w-48">
              <select 
                value={selectedBpo} 
                onChange={(e) => setSelectedBpo(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded px-2 py-1 text-xs font-semibold text-slate-705 focus:outline-none focus:ring-1 focus:ring-indigo-650"
              >
                <option value="all">Todas as Parceiras</option>
                {availableBpos.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Operators List Accordion */}
      <div className="bg-white border border-slate-200 rounded divide-y divide-slate-150 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-2 px-4 grid grid-cols-12 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
          <div className="col-span-4">Operador / Parceira BPO</div>
          <div className="col-span-2 text-center">Score Auto-QA</div>
          <div className="col-span-2 text-center">Adesão Script</div>
          <div className="col-span-2 text-center">Desvios Registrados</div>
          <div className="col-span-1 text-center">Chamadas</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>

        {sortedAgents.map(agent => {
          const avgScore = Math.round(agent.scoreSum / agent.count);
          const totalAtendimentos = agent.count;
          const isCritical = avgScore < 70;
          const isExcellent = avgScore >= 85;
          const isExpanded = expandedAgent === agent.name;
          
          // Script adherence average
          const avgAdherence = Math.round(agent.calls.reduce((acc, c) => acc + c.scriptAdherence, 0) / agent.count);

          return (
            <div key={agent.name} className={`transition-colors ${isExpanded ? 'bg-indigo-50/10' : 'hover:bg-slate-50/50'}`}>
              {/* Row Header */}
              <div 
                onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                className="p-3 px-4 grid grid-cols-12 items-center cursor-pointer text-xs font-semibold text-slate-700"
              >
                {/* Name */}
                <div className="col-span-4 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-705 font-bold uppercase text-[10px] border border-indigo-100">
                    {agent.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 font-sans flex items-center gap-1.5 break-all">
                      {agent.name}
                      {isCritical && (
                        <span className="p-0.5 px-1 bg-rose-50 text-[8px] font-black text-rose-600 rounded uppercase tracking-wider animate-pulse border border-rose-100">Alerta QA</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5 text-slate-300" />
                      {agent.bpo}
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="col-span-2 text-center">
                  <span className={`inline-block text-[11px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                    isCritical ? 'bg-rose-50 text-rose-650 border-rose-100' :
                    isExcellent ? 'bg-emerald-50 text-emerald-650 border-emerald-100' :
                    'bg-amber-50 text-amber-650 border-amber-100'
                  }`}>
                    {avgScore} / 100
                  </span>
                </div>

                {/* Script Adherence */}
                <div className="col-span-2 text-center font-mono font-bold text-slate-705">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px]">{avgAdherence}%</span>
                    <div className="w-12 bg-slate-100 h-1 rounded overflow-hidden hidden sm:block">
                      <div className="bg-indigo-600 h-full" style={{ width: `${avgAdherence}%` }} />
                    </div>
                  </div>
                </div>

                {/* Critical Errors */}
                <div className="col-span-2 text-center font-mono">
                  {agent.criticalCount > 0 ? (
                    <span className="p-0.5 px-2 bg-rose-50 text-rose-600 border border-rose-105 rounded font-bold text-[9px] flex items-center gap-1 justify-center w-max mx-auto">
                      <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                      {agent.criticalCount} ocor.
                    </span>
                  ) : (
                    <span className="text-[9.5px] text-slate-400 font-sans italic">Nenhum</span>
                  )}
                </div>

                {/* Call Count */}
                <div className="col-span-1 text-center font-mono font-bold text-slate-800">
                  {totalAtendimentos}
                </div>

                {/* Expand icon */}
                <div className="col-span-1 text-right text-slate-400 flex items-center justify-end gap-1.5">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-650" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Row Expanded: Calls List */}
              {isExpanded && (
                <div className="bg-slate-50/50 p-4 border-t border-b border-dashed border-slate-200">
                  <h4 className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
                    Atendimentos Auditaços de {agent.name}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {agent.calls.map(call => {
                      const hasCritical = (call.evaluation.criticalFails?.length ?? 0) > 0;
                      return (
                        <div 
                          key={call.id}
                          className="bg-white border border-slate-200 rounded p-3 hover:border-indigo-300 transition-all text-left flex flex-col justify-between space-y-3 shadow-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
                              <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                ID: {call.id.substring(0, 8)}...
                              </span>
                              <div className="flex items-center gap-1">
                                {hasCritical && (
                                  <span className="text-[8px] font-extrabold uppercase bg-rose-50 text-rose-650 px-1.5 py-0.2 rounded border border-rose-100">
                                    Crítico
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                  call.score >= 80 ? 'bg-emerald-50 text-emerald-600' :
                                  call.score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-650'
                                }`}>
                                  QA {call.score}
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 leading-normal mb-1.5">
                              📅 <strong>Data:</strong> {new Date(call.date).toLocaleString('pt-BR')} • 🏷️ <strong>Nível:</strong> {call.channel.toUpperCase()}
                            </p>
                            
                            <p className="text-[11px] text-slate-650 leading-relaxed italic line-clamp-2">
                              "{call.evaluation.summary}"
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInspectCall(call)}
                            className="text-[9.5px] font-black text-indigo-650 uppercase tracking-widest mt-auto hover:text-indigo-850 flex items-center gap-1 self-start cursor-pointer border border-indigo-100 hover:bg-indigo-50/50 p-1 px-2.5 rounded transition-all"
                          >
                            Inspecionar no Laudo
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sortedAgents.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Nenhum operador encontrado com os termos de pesquisa atuais.
          </div>
        )}
      </div>
    </div>
  );
}
