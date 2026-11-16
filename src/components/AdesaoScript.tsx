import React, { useState } from 'react';
import { Interaction, GuiaItem, UserSession } from '../types';
import { 
  CheckCircle, 
  AlertTriangle, 
  Award, 
  Building2, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  SlidersHorizontal,
  BookOpen,
  ArrowUpRight,
  PhoneCall,
  Clock,
  Sparkles
} from 'lucide-react';

interface AdesaoScriptProps {
  interactions: Interaction[];
  session: UserSession;
  guiaItens: GuiaItem[];
  bpos?: string[];
  onSelectCall?: (call: Interaction) => void;
  setActiveTab?: (tab: any) => void;
}

export default function AdesaoScript({
  interactions,
  session,
  guiaItens,
  bpos = ["BPO Alpha", "BPO Beta", "BPO Gamma"],
  onSelectCall,
  setActiveTab
}: AdesaoScriptProps) {
  const [activePane, setActivePane] = useState<'geral' | 'blocos' | 'operador' | 'bpo'>('geral');
  const [selectedBpoFilter, setSelectedBpoFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Interactive expansion states
  const [activeOverallBlock, setActiveOverallBlock] = useState<string | null>(null);
  const [expandedOccurrenceId, setExpandedOccurrenceId] = useState<number | null>(null);
  const [expandedMotiveId, setExpandedMotiveId] = useState<number | null>(null);
  const [expandedOperatorName, setExpandedOperatorName] = useState<string | null>(null);
  const [expandedBpoName, setExpandedBpoName] = useState<string | null>(null);

  const isBpoUser = session.role === 'bpo';

  // Available BPOs dynamically extracted
  const availableBpos = Array.from(
    new Set([...bpos, ...interactions.map(i => i.bpoName).filter(Boolean)])
  ).sort();

  // Filter interactions based on view permissions
  const filteredInteractions = interactions.filter(i => {
    // Autorização por tenant/BPO é feita no servidor; aqui só filtro de exibição.
    if (selectedBpoFilter !== 'all' && i.bpoName?.toLowerCase() !== selectedBpoFilter.toLowerCase()) return false;
    return true;
  });

  // Standard blocks
  const blocks = ['Processo', 'Conhecimento', 'Sistemas', 'Experiência'];

  // Helper to calculate adherence of a single call to a block
  const getBlockAdherence = (call: Interaction, blockName: string) => {
    if (call.score === 100 || call.scriptAdherence === 100) return 100;
    
    let score = 100;
    
    // Check checklist items that belong conceptually to specific blocks
    // We only penalize if the evaluation checklist explicitly marks them as false (not undefined/missing)
    if (blockName === 'Processo') {
      if (call.evaluation.protocolInformed === false) score -= 20;
      if (call.evaluation.resolutionConfirmed === false) score -= 30;
    }
    if (blockName === 'Experiência') {
      if (call.evaluation.greetingPassed === false) score -= 20;
      if (call.evaluation.professionalTone === false) score -= 30;
    }

    // Check dynamic guide infractions mapped to this interaction
    const blockItems = guiaItens.filter(g => g.bloco.toLowerCase() === blockName.toLowerCase());
    const fails = call.evaluation.criticalFails || [];

    fails.forEach(fail => {
      const match = blockItems.find(it => 
        fail.toLowerCase().includes(it.motivoOriginal.toLowerCase()) ||
        fail.toLowerCase().includes(it.motivoSimplificado.toLowerCase()) ||
        fail.toLowerCase().includes(`(id ${it.id})`) ||
        fail.toLowerCase().includes(`(id: ${it.id})`)
      );
      if (match) {
        score -= match.scorePenalidade;
      }
    });

    return Math.max(0, score);
  };

  // 1. Overall script adherence average
  const overallAdherence = filteredInteractions.length > 0 
    ? Math.round(filteredInteractions.reduce((acc, c) => acc + c.scriptAdherence, 0) / filteredInteractions.length)
    : 0;

  // Calculate averages *by block*
  const blockStats = blocks.map(block => {
    const blockItems = guiaItens.filter(g => g.bloco.toLowerCase() === block.toLowerCase());
    
    let sum = 0;
    let count = 0;
    let totalCriticalFailures = 0;

    filteredInteractions.forEach(call => {
      const adherence = getBlockAdherence(call, block);
      sum += adherence;
      count += 1;

      // Count failures in this block
      const fails = call.evaluation.criticalFails || [];
      fails.forEach(fail => {
        const hasMatch = blockItems.some(it => 
          fail.toLowerCase().includes(it.motivoOriginal.toLowerCase()) ||
          fail.toLowerCase().includes(it.motivoSimplificado.toLowerCase()) ||
          fail.toLowerCase().includes(`(id ${it.id})`) ||
          fail.toLowerCase().includes(`(id: ${it.id})`)
        );
        if (hasMatch) {
          totalCriticalFailures += 1;
        }
      });
    });

    return {
      name: block,
      avg: count > 0 ? Math.round(sum / count) : 100,
      failuresCount: totalCriticalFailures,
      totalItems: blockItems.length
    };
  });

  // Calculate averages *by operator*
  const operatorStats = filteredInteractions.reduce((acc, call) => {
    if (searchTerm && !call.agentName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return acc;
    }

    if (!acc[call.agentName]) {
      acc[call.agentName] = {
        name: call.agentName,
        bpo: call.bpoName,
        count: 0,
        overallSum: 0,
        blocksSum: { Processo: 0, Conhecimento: 0, Sistemas: 0, Experiência: 0 } as Record<string, number>
      };
    }

    acc[call.agentName].count += 1;
    acc[call.agentName].overallSum += call.scriptAdherence;
    
    blocks.forEach(b => {
      acc[call.agentName].blocksSum[b] += getBlockAdherence(call, b);
    });

    return acc;
  }, {} as Record<string, { name: string; bpo: string; count: number; overallSum: number; blocksSum: Record<string, number> }>);

  // Convert to array and calculate averages
  const sortedOperators = Object.values(operatorStats).map(op => {
    const opBlocks: Record<string, number> = {};
    blocks.forEach(b => {
      opBlocks[b] = Math.round(op.blocksSum[b] / op.count);
    });

    return {
      name: op.name,
      bpo: op.bpo,
      count: op.count,
      overall: Math.round(op.overallSum / op.count),
      blocks: opBlocks
    };
  }).sort((a, b) => a.overall - b.overall); // Lowest adherence first

  // Calculate averages *by BPO*. Para BPO usamos os rótulos presentes nos dados
  // já autorizados pelo servidor (o bpoName da sessão pode divergir do rótulo).
  const bposListToCompare = isBpoUser
    ? Array.from(new Set(filteredInteractions.map(c => c.bpoName).filter(Boolean)))
    : bpos;
  const bpoStats = bposListToCompare.map(bpoName => {
    const bpoCalls = filteredInteractions.filter(c => c.bpoName.toLowerCase() === bpoName.toLowerCase());
    const overallAvg = bpoCalls.length > 0 
      ? Math.round(bpoCalls.reduce((sum, c) => sum + c.scriptAdherence, 0) / bpoCalls.length)
      : 100;

    const opBlocks: Record<string, number> = {};
    blocks.forEach(b => {
      const blockSum = bpoCalls.reduce((sum, c) => sum + getBlockAdherence(c, b), 0);
      opBlocks[b] = bpoCalls.length > 0 ? Math.round(blockSum / bpoCalls.length) : 100;
    });

    return {
      name: bpoName,
      callsCount: bpoCalls.length,
      overall: overallAvg,
      blocks: opBlocks
    };
  }).sort((a, b) => a.overall - b.overall);

  return (
    <div className="space-y-4 font-sans text-slate-800">
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200/70 space-y-4">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-50 pb-3 leading-none select-none">
        <div className="text-left font-sans">
          <h1 className="ds-heading">
            <Award className="w-4.5 h-4.5 text-indigo-650" />
            <span>Adesão ao Script de Atendimento</span>
          </h1>
          <p className="ds-subtitle">Painel quantitativo de complacência metodológica e blocos regulatórios do Guia de Penalidades.</p>
        </div>
        
        <div className="flex gap-3 shrink-0 self-start md:self-auto">
          <div className="bg-slate-50 border border-slate-200 p-2.5 px-4 rounded-xl text-center shadow-3xs">
            <span className="block text-[8px] text-slate-455 uppercase font-bold tracking-widest leading-none">Média Geral de Adesão</span>
            <span className="text-lg font-black font-mono text-indigo-650 leading-none block mt-1">{overallAdherence}%</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-2.5 px-4 rounded-xl text-center shadow-3xs">
            <span className="block text-[8px] text-slate-455 uppercase font-bold tracking-widest leading-none">Lotes Analisados</span>
            <span className="text-lg font-black font-mono text-indigo-650 leading-none block mt-1">{filteredInteractions.length} chamadas</span>
          </div>
        </div>
      </div>

      {/* Pane sub-navigation and filters */}
      <div className="bg-white border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl shadow-3xs select-none">
        {/* Buttons */}
        <div className="bg-slate-100 p-1.5 rounded-xl flex flex-wrap gap-1 border border-slate-200 self-start lg:self-auto">
          <button
            onClick={() => setActivePane('geral')}
            className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activePane === 'geral' 
                ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            1. Visão Geral
          </button>
          <button
            onClick={() => setActivePane('blocos')}
            className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activePane === 'blocos' 
                ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            2. Visão por Bloco
          </button>
          <button
            onClick={() => setActivePane('operador')}
            className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activePane === 'operador' 
                ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            3. Visão por Operador
          </button>
          {!isBpoUser && (
            <button
              onClick={() => setActivePane('bpo')}
              className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activePane === 'bpo' 
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              4. Visão por Parceiro BPO
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mr-1">
          {activePane === 'operador' && (
            <input 
              type="text"
              placeholder="Filtrar operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-250 p-1 px-2.5 rounded text-xs text-slate-705 focus:outline-none focus:ring-1 focus:ring-indigo-600 w-44"
            />
          )}

          {!isBpoUser && (
            <select
              value={selectedBpoFilter}
              onChange={(e) => setSelectedBpoFilter(e.target.value)}
              className="bg-white border border-slate-250 p-1 px-2 text-xs rounded font-bold text-slate-705 focus:ring-1 focus:ring-indigo-600 cursor-pointer"
            >
              <option value="all">Filtro BPO: Todos</option>
              {availableBpos.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      </div>

      {/* RENDER PANE 1: VISÃO GERAL */}
      {activePane === 'geral' && (
        <div className="w-full">
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-3xs">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4 flex items-center gap-1.5 uppercase">
              <SlidersHorizontal className="w-4 h-4 text-indigo-650" />
              Adesão Média por Bloco de Regulamento (Clique em um bloco para ver detalhes)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blockStats.map(block => {
                const isExpanded = activeOverallBlock === block.name;
                return (
                  <div 
                    key={block.name} 
                    onClick={() => setActiveOverallBlock(isExpanded ? null : block.name)}
                    className={`p-4 border rounded-xl transition-all cursor-pointer select-none space-y-2 text-left ${
                      isExpanded 
                        ? 'bg-indigo-50/20 border-indigo-300 shadow-3xs' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-755 font-extrabold font-sans text-sm">{block.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-indigo-650 text-sm font-black">{block.avg}%</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-650" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden relative shadow-3xs">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          block.avg >= 85 ? 'bg-emerald-500' :
                          block.avg >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${block.avg}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-455 font-bold uppercase tracking-wider">
                      <span>{block.totalItems} Motivos Mapeados</span>
                      <span className={block.failuresCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}>
                        {block.failuresCount} Desvios Registrados
                      </span>
                    </div>

                    {/* Expandable sub-view for mapped criteria and occurrences counts */}
                    {isExpanded && (
                      <div 
                        className="bg-white border text-left border-dashed border-slate-200 p-3.5 rounded-lg mt-3.5 animate-fade-in space-y-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-widest pb-1.5 border-b border-slate-100">
                          <span>Critérios Cadastrados</span>
                          <span>Ocorrências Recorrentes</span>
                        </div>
                        <div className="divide-y divide-slate-105 max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
                          {guiaItens.filter(g => g.bloco.toLowerCase() === block.name.toLowerCase()).length === 0 ? (
                            <p className="text-center py-4 text-slate-400 italic text-[11px]">Nenhuma diretriz associada a este bloco no Guia de Penalidades.</p>
                          ) : (
                            guiaItens.filter(g => g.bloco.toLowerCase() === block.name.toLowerCase()).map(item => {
                              const occurrences = filteredInteractions.reduce((count, call) => {
                                const fails = call.evaluation.criticalFails || [];
                                const hasFail = fails.some(f => 
                                  f.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
                                  f.toLowerCase().includes(item.motivoSimplificado.toLowerCase()) ||
                                  f.toLowerCase().includes(`(id ${item.id})`) ||
                                  f.toLowerCase().includes(`(id: ${item.id})`)
                                );
                                return hasFail ? count + 1 : count;
                              }, 0);

                              const isMotiveExpanded = expandedMotiveId === item.id;

                              const callsWithFail = filteredInteractions.filter(call => {
                                const fails = call.evaluation.criticalFails || [];
                                return fails.some(f => 
                                  f.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
                                  f.toLowerCase().includes(item.motivoSimplificado.toLowerCase()) ||
                                  f.toLowerCase().includes(`(id ${item.id})`) ||
                                  f.toLowerCase().includes(`(id: ${item.id})`)
                                );
                              });

                              return (
                                <div key={item.id} className="pt-2 pb-2">
                                  <div 
                                    onClick={(e) => {
                                      if (occurrences > 0) {
                                        e.stopPropagation();
                                        setExpandedMotiveId(isMotiveExpanded ? null : item.id);
                                      }
                                    }}
                                    className={`flex items-start justify-between text-[11px] gap-2 font-medium p-1.5 rounded-lg transition-all ${
                                      occurrences > 0 ? 'cursor-pointer hover:bg-slate-100' : ''
                                    } ${isMotiveExpanded ? 'bg-indigo-50/40 border border-indigo-100/50' : ''}`}
                                  >
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="font-extrabold text-slate-800 leading-tight block">
                                        {item.motivoOriginal}
                                      </span>
                                      <span className="text-[9px] text-slate-455 font-black uppercase mt-0.5 block tracking-wider font-mono">
                                        Gravidade: <span className="text-indigo-650">{item.relevancia}</span> (-{item.scorePenalidade} pts)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {occurrences > 0 ? (
                                        <div className="flex items-center gap-1">
                                          <span className="bg-rose-50 border border-rose-100 text-rose-600 font-extrabold px-1.5 py-0.5 rounded-full text-[9.5px] shrink-0 font-mono">
                                            {occurrences} desvios
                                          </span>
                                          {isMotiveExpanded ? (
                                            <ChevronUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-mono text-[9.5px] shrink-0">0 desvios</span>
                                      )}
                                    </div>
                                  </div>

                                  {isMotiveExpanded && occurrences > 0 && (
                                    <div className="bg-slate-50 border border-slate-200/65 p-2.5 rounded-lg mt-2 space-y-2 text-left animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                      <p className="text-[9.5px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1 leading-none py-0.5">
                                        <Building2 className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                                        <span>Desvios por Parceiro e Operador</span>
                                      </p>
                                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                        {callsWithFail.map(call => (
                                          <div key={call.id} className="bg-white border border-slate-150 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-3xs">
                                            <div>
                                              <div className="flex items-center gap-1 text-[10.5px] font-extrabold text-slate-800">
                                                <span className="text-[8.5px] font-black uppercase bg-indigo-55 border border-indigo-120 text-indigo-700 px-1.5 py-0.2 rounded">
                                                  {call.bpoName}
                                                </span>
                                                <span className="text-slate-350">•</span>
                                                <User className="w-3 h-3 text-indigo-400 shrink-0" />
                                                <span>{call.agentName}</span>
                                              </div>
                                              <p className="text-[9px] text-slate-455 mt-0.5 leading-none flex items-center gap-1.5 font-bold">
                                                <span>LOTE: {call.id.substring(0, 8).toUpperCase()}...</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{new Date(call.date).toLocaleString('pt-BR')}</span>
                                              </p>
                                            </div>
                                            {onSelectCall && setActiveTab && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onSelectCall(call);
                                                  setActiveTab('analises');
                                                }}
                                                className="text-[8.5px] font-black text-indigo-650 uppercase tracking-widest mt-auto hover:text-indigo-850 flex items-center gap-1 cursor-pointer border border-indigo-100 hover:bg-indigo-50/50 p-1 px-2 rounded transition-all bg-white font-mono"
                                              >
                                                <span>Laudo</span>
                                                <ArrowUpRight className="w-2.5 h-2.5 text-indigo-650 shrink-0" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* RENDER PANE 2: VISÃO POR BLOCO */}
      {activePane === 'blocos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {blockStats.map(b => (
              <div key={b.name} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-3xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black block mb-0.5">Bloco Metodologia</span>
                  <h4 className="text-xs font-black text-slate-800 font-sans">{b.name}</h4>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-black text-slate-900 leading-none">{b.avg}%</span>
                    <span className="text-[10.5px] text-slate-450 font-bold uppercase">Adesão</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5 shadow-3xs">
                    <div 
                      className={`h-full rounded-full ${b.avg >= 85 ? 'bg-emerald-500' : b.avg >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${b.avg}%` }} 
                    />
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-mono flex justify-between uppercase">
                  <span>{b.totalItems} diretrizes</span>
                  <span className={b.failuresCount > 0 ? 'text-rose-500 font-bold' : ''}>{b.failuresCount} desvios</span>
                </div>
              </div>
            ))}
          </div>

          {/* Table showing list of recorded GuiaItem deviations and their occurrences count */}
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-3xs">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-3.5 uppercase">
              Ocorrência e Frequência de Desvios por Item do Guia (Clique na linha com desvios para detalhar)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="ds-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="ds-table-th w-16 text-center">ID</th>
                    <th className="ds-table-th w-36">Bloco</th>
                    <th className="ds-table-th w-32">Criticidade</th>
                    <th className="ds-table-th">Descrição da Diretriz Violada</th>
                    <th className="ds-table-th w-32 text-center">Lote Auditado</th>
                    <th className="ds-table-th w-32 text-right">Penalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {guiaItens.map(item => {
                    // Check how many times this specific item was violated in the filtered queue
                    const occurrences = filteredInteractions.reduce((count, call) => {
                      const fails = call.evaluation.criticalFails || [];
                      const hasFail = fails.some(f => 
                        f.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
                        f.toLowerCase().includes(item.motivoSimplificado.toLowerCase()) ||
                        f.toLowerCase().includes(`(id ${item.id})`) ||
                        f.toLowerCase().includes(`(id: ${item.id})`)
                      );
                      return hasFail ? count + 1 : count;
                    }, 0);

                    const isExpanded = expandedOccurrenceId === item.id;

                    return (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => occurrences > 0 && setExpandedOccurrenceId(isExpanded ? null : item.id)}
                          className={`text-[11px] select-none transition-colors ${
                            occurrences > 0 
                              ? 'bg-rose-50/10 cursor-pointer hover:bg-rose-50/25 font-semibold text-slate-800' 
                              : 'text-slate-500'
                          } ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                        >
                          <td className="ds-table-td font-mono text-slate-400 text-center">
                            <span className="p-1 bg-slate-50 border border-slate-250 rounded font-bold font-mono">#{item.id}</span>
                          </td>
                          <td className="ds-table-td font-bold">{item.bloco}</td>
                          <td className="ds-table-td">
                            <span className={`inline-block p-1 px-2.5 rounded-full font-black text-[8px] uppercase tracking-wider ${
                              item.relevancia.includes('FATAL') ? 'bg-rose-100 text-rose-800 border border-rose-220' :
                              item.relevancia === 'CRÍTICA' ? 'bg-amber-100 text-amber-805 border border-amber-250' :
                              item.relevancia === 'MODERADA' ? 'bg-indigo-100 text-indigo-800 border border-indigo-150' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.relevancia}
                            </span>
                          </td>
                          <td className="ds-table-td">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-805 leading-snug">{item.motivoOriginal}</span>
                              {occurrences > 0 && (isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-650 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-bounce" />)}
                            </div>
                            {item.observacao && <span className="text-[9.5px] text-slate-455 mt-1 block font-medium font-sans italic">{item.observacao}</span>}
                          </td>
                          <td className="ds-table-td text-center">
                            {occurrences > 0 ? (
                              <span className="p-1 px-3 bg-rose-50 text-rose-650 border border-rose-200 rounded-full font-bold font-mono text-[10px]">
                                {occurrences} desvios
                              </span>
                            ) : (
                              <span className="text-slate-350 text-[10px] font-mono font-bold">0</span>
                            )}
                          </td>
                          <td className="ds-table-td text-right font-mono font-bold text-slate-700">
                            -{item.scorePenalidade} pts
                          </td>
                        </tr>

                        {/* Interactive breakdown of occurrences by partner BPO and operator */}
                        {isExpanded && occurrences > 0 && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="bg-slate-50 border-t border-b border-slate-200 p-4">
                              <div className="animate-fade-in space-y-4 text-left">
                                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5 leading-none">
                                  <Building2 className="w-4 h-4 text-indigo-650" />
                                  <span>Detalhamento Completo de Ocorrências por Parceiro e Operadores</span>
                                </h4>
                                
                                <div className="space-y-4">
                                  {bpos.map(bpo => {
                                    // Filter interactions for this BPO that had this specific fail
                                    const bpoCallsWithFail = filteredInteractions.filter(call => {
                                      if (call.bpoName.toLowerCase() !== bpo.toLowerCase()) return false;
                                      const fails = call.evaluation.criticalFails || [];
                                      return fails.some(f => 
                                        f.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
                                        f.toLowerCase().includes(item.motivoSimplificado.toLowerCase()) ||
                                        f.toLowerCase().includes(`(id ${item.id})`) ||
                                        f.toLowerCase().includes(`(id: ${item.id})`)
                                      );
                                    });

                                    if (bpoCallsWithFail.length === 0) return null;

                                    return (
                                      <div key={bpo} className="border border-slate-200 bg-white rounded-xl p-4 shadow-3xs space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                          <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4 text-indigo-650 shrink-0" />
                                            {bpo}
                                          </span>
                                          <span className="bg-rose-50 border border-rose-100 text-rose-600 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full font-mono">
                                            {bpoCallsWithFail.length} desvios registrados
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {bpoCallsWithFail.map(call => {
                                            const hasCritical = (call.evaluation.criticalFails?.length ?? 0) > 0;
                                            return (
                                              <div 
                                                key={call.id}
                                                className="bg-slate-50/50 border border-slate-150 rounded-lg p-3 hover:border-indigo-300 transition-all text-left flex flex-col justify-between space-y-3"
                                              >
                                                <div>
                                                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-1.5">
                                                    <span className="font-mono text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 border rounded-md">
                                                      ID: {call.id.substring(0, 8).toUpperCase()}...
                                                    </span>
                                                    <span className={`text-[9.5px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                                                      call.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                      call.score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-650 border-rose-100'
                                                    }`}>
                                                      Score {call.score}
                                                    </span>
                                                  </div>

                                                  <p className="text-[10px] text-slate-505 leading-none mb-2 font-bold flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                    <span>{call.agentName}</span>
                                                    <span className="text-slate-350 mx-1">•</span>
                                                    <Clock className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                                                    <span>{new Date(call.date).toLocaleString('pt-BR')}</span>
                                                  </p>
                                                  
                                                  <p className="text-[10.5px] text-slate-600 leading-relaxed italic line-clamp-2 pl-2 border-l-2 border-indigo-200">
                                                    "{call.evaluation.summary}"
                                                  </p>
                                                </div>

                                                {onSelectCall && setActiveTab && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onSelectCall(call);
                                                      setActiveTab('analises');
                                                    }}
                                                    className="text-[9px] font-black text-indigo-650 uppercase tracking-widest mt-auto hover:text-indigo-850 flex items-center gap-1 self-start cursor-pointer border border-indigo-100 hover:bg-indigo-50/50 p-1 px-2.5 rounded-md transition-all bg-white font-mono"
                                                  >
                                                    <span>Inspecionar no Laudo</span>
                                                    <ArrowUpRight className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER PANE 3: VISÃO POR OPERADOR (Now supports click-to-expand with full audited interaction lists) */}
      {activePane === 'operador' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs">
          <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3.5 uppercase">
            Adesão ao Script por Operador (Clique na linha do operador para expandir atendimentos auditados)
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-150">
            <table className="ds-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-550 uppercase tracking-widest text-center">
                  <th className="ds-table-th text-left w-64">Nome do Operador</th>
                  <th className="ds-table-th text-left w-36">Parceiro BPO</th>
                  <th className="ds-table-th">Processo Adh.</th>
                  <th className="ds-table-th">Conhecimento Adh.</th>
                  <th className="ds-table-th">Sistemas Adh.</th>
                  <th className="ds-table-th">Experiência Adh.</th>
                  <th className="ds-table-th">Adesão Total</th>
                  <th className="ds-table-th w-20">Volume</th>
                  <th className="ds-table-th w-10 text-right">Expandir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {sortedOperators.map(op => {
                  const isExpanded = expandedOperatorName === op.name;
                  return (
                    <React.Fragment key={op.name}>
                      <tr 
                        onClick={() => setExpandedOperatorName(isExpanded ? null : op.name)}
                        className={`hover:bg-slate-50/50 text-[11px] text-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                      >
                        {/* Operator */}
                        <td className="ds-table-td text-left font-extrabold text-slate-900 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-indigo-650" />
                          <span>{op.name}</span>
                        </td>

                        {/* BPO */}
                        <td className="ds-table-td text-left font-bold text-slate-455 uppercase tracking-tight text-[10px]">
                          {op.bpo}
                        </td>

                        {/* Processo */}
                        <td className="ds-table-td font-mono font-black">
                          <span className={op.blocks.Processo < 75 ? 'text-rose-600' : 'text-slate-705'}>
                            {op.blocks.Processo}%
                          </span>
                        </td>

                        {/* Conhecimento */}
                        <td className="ds-table-td font-mono font-black">
                          <span className={op.blocks.Conhecimento < 75 ? 'text-rose-600' : 'text-slate-705'}>
                            {op.blocks.Conhecimento}%
                          </span>
                        </td>

                        {/* Sistemas */}
                        <td className="ds-table-td font-mono font-black">
                          <span className={op.blocks.Sistemas < 75 ? 'text-rose-600' : 'text-slate-705'}>
                            {op.blocks.Sistemas}%
                          </span>
                        </td>

                        {/* Experiência */}
                        <td className="ds-table-td font-mono font-black">
                          <span className={op.blocks.Experiência < 75 ? 'text-rose-600' : 'text-slate-705'}>
                            {op.blocks.Experiência}%
                          </span>
                        </td>

                        {/* Overall */}
                        <td className="ds-table-td font-mono">
                          <span className={`p-1 px-2.5 font-black rounded-lg text-[10.5px] border ${
                            op.overall >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            op.overall >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-rose-50 text-rose-650 border border-rose-100'
                          }`}>
                            {op.overall}%
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="ds-table-td font-mono text-slate-455 font-bold whitespace-nowrap">{op.count} chamadas</td>

                        {/* Action status expansion icon */}
                        <td className="ds-table-td text-right">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-650" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </td>
                      </tr>

                      {/* Expanded Section showing all audited calls */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50 border-t border-b border-slate-200 p-4">
                            <div className="animate-fade-in text-left space-y-3.5">
                              <h4 className="text-[10px] font-black uppercase text-slate-455 tracking-widest flex items-center gap-1.5 leading-none">
                                <PhoneCall className="w-4 h-4 text-indigo-650" />
                                <span>Atendimentos Auditados pelo Auto-QA de {op.name}</span>
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredInteractions.filter(c => c.agentName === op.name).map(call => {
                                  const hasCritical = (call.evaluation.criticalFails?.length ?? 0) > 0;
                                  return (
                                    <div 
                                      key={call.id}
                                      className="bg-white border border-slate-150 rounded-xl p-4 hover:border-indigo-300 transition-all text-left flex flex-col justify-between space-y-3 shadow-3xs"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-2 mb-2">
                                          <span className="font-mono text-[9.5px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                            LOTE: {call.id.substring(0, 8).toUpperCase()}...
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {hasCritical && (
                                              <span className="text-[8px] font-black uppercase bg-rose-50 text-rose-650 px-1.5 py-0.5 rounded border border-rose-100">
                                                Alerta QA
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded border ${
                                              call.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                              call.score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-650 border-rose-100'
                                            }`}>
                                              Score {call.score}
                                            </span>
                                          </div>
                                        </div>

                                        <p className="text-[10px] text-slate-455 leading-normal mb-1.5 font-bold flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                                          <span>{new Date(call.date).toLocaleString('pt-BR')}</span>
                                          <span className="text-slate-350 mx-1">•</span>
                                          <span className="text-slate-500">{call.channel.toUpperCase()}</span>
                                        </p>
                                        
                                        <p className="text-[11px] text-slate-655 leading-relaxed italic line-clamp-2 pl-2 border-l-2 border-indigo-200">
                                          "{call.evaluation.summary}"
                                        </p>
                                      </div>

                                      {onSelectCall && setActiveTab && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectCall(call);
                                            setActiveTab('analises');
                                          }}
                                          className="text-[9.5px] font-black text-indigo-650 uppercase tracking-widest mt-auto hover:text-indigo-850 flex items-center gap-1.5 self-start cursor-pointer border border-indigo-100 hover:bg-indigo-50/50 p-1.5 px-3 rounded-lg transition-all"
                                        >
                                          <span>Inspecionar no Laudo</span>
                                          <ArrowUpRight className="w-3 h-3 text-indigo-600" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {sortedOperators.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold text-xs">
                      Nenhum operador com os qualificadores correntes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER PANE 4: VISÃO POR PARCEIRO BPO (Now supports click-to-expand list of partner-auditations) */}
      {activePane === 'bpo' && !isBpoUser && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs">
          <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3.5 uppercase">
            Adesão ao Script Comparativa por Parceiras BPO (Clique na linha da parceira para expandir atendimentos)
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-150">
            <table className="ds-table text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="ds-table-th text-left w-64">Parceiro BPO</th>
                  <th className="ds-table-th">Processo Avg</th>
                  <th className="ds-table-th">Conhecimento Avg</th>
                  <th className="ds-table-th">Sistemas Avg</th>
                  <th className="ds-table-th">Experiência Avg</th>
                  <th className="ds-table-th">Adesão Consolidada</th>
                  <th className="ds-table-th w-28">Volume Total</th>
                  <th className="ds-table-th w-10 text-right">Expandir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-semibold text-slate-705">
                {bpoStats.map(bpo => {
                  const isExpanded = expandedBpoName === bpo.name;
                  return (
                    <React.Fragment key={bpo.name}>
                      <tr 
                        onClick={() => setExpandedBpoName(isExpanded ? null : bpo.name)}
                        className={`hover:bg-slate-50/50 text-[11.5px] cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                      >
                        {/* BPO Name */}
                        <td className="ds-table-td text-left font-black text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-650" />
                          <span>{bpo.name}</span>
                        </td>

                        {/* Processo */}
                        <td className="ds-table-td font-mono">{bpo.blocks.Processo}%</td>

                        {/* Conhecimento */}
                        <td className="ds-table-td font-mono">{bpo.blocks.Conhecimento}%</td>

                        {/* Sistemas */}
                        <td className="ds-table-td font-mono">{bpo.blocks.Sistemas}%</td>

                        {/* Experiência */}
                        <td className="ds-table-td font-mono">{bpo.blocks.Experiência}%</td>

                        {/* Overall */}
                        <td className="ds-table-td">
                          <span className={`p-1 px-3 font-bold font-mono rounded-lg border ${
                            bpo.overall >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-100 font-black' :
                            bpo.overall >= 70 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {bpo.overall}%
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="ds-table-td font-mono text-slate-455 font-bold whitespace-nowrap">{bpo.callsCount} chamadas</td>

                        {/* Action expansion arrow icon */}
                        <td className="ds-table-td text-right">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-650" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </td>
                      </tr>

                      {/* Segmented Audit list expansion inside BPO view */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 border-t border-b border-slate-200 p-4">
                            <div className="animate-fade-in text-left space-y-3.5">
                              <h4 className="text-[10px] font-black uppercase text-slate-455 tracking-widest flex items-center gap-1.5 leading-none">
                                <Building2 className="w-4 h-4 text-indigo-650" />
                                <span>Monitoramento Qualitativo - {bpo.name}</span>
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredInteractions.filter(c => c.bpoName.toLowerCase() === bpo.name.toLowerCase()).map(call => {
                                  const hasCritical = (call.evaluation.criticalFails?.length ?? 0) > 0;
                                  return (
                                    <div 
                                      key={call.id}
                                      className="bg-white border border-slate-150 rounded-xl p-4 hover:border-indigo-300 transition-all text-left flex flex-col justify-between space-y-3 shadow-3xs"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-2 mb-2">
                                          <span className="font-mono text-[9.5px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                            ID: {call.id.substring(0, 8).toUpperCase()}...
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {hasCritical && (
                                              <span className="text-[8px] font-black uppercase bg-rose-50 text-rose-650 px-1.5 py-0.5 rounded border border-rose-100">
                                                Crítico
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                                              call.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                              call.score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-650 border-rose-100'
                                            }`}>
                                              Score {call.score}
                                            </span>
                                          </div>
                                        </div>

                                        <p className="text-[10px] text-slate-455 leading-normal mb-1.5 font-bold">
                                          👤 <strong>Operador:</strong> {call.agentName} <span className="text-slate-350 mx-1">•</span> 📅 <strong>Data:</strong> {new Date(call.date).toLocaleString('pt-BR')}
                                        </p>
                                        
                                        <p className="text-[11px] text-slate-655 leading-relaxed italic line-clamp-2 pl-2 border-l-2 border-indigo-200">
                                          "{call.evaluation.summary}"
                                        </p>
                                      </div>

                                      {onSelectCall && setActiveTab && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectCall(call);
                                            setActiveTab('analises');
                                          }}
                                          className="text-[9.5px] font-black text-indigo-650 uppercase tracking-widest mt-auto hover:text-indigo-850 flex items-center gap-1.5 self-start cursor-pointer border border-indigo-100 hover:bg-indigo-50/50 p-1.5 px-3 rounded-lg transition-all"
                                        >
                                          <span>Inspecionar no Laudo</span>
                                          <ArrowUpRight className="w-3 h-3 text-indigo-600" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
