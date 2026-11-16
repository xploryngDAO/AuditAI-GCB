import React, { useState, useEffect } from 'react';
import { Interaction, UserSession } from '../types';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Award, 
  PhoneCall, 
  Info, 
  AlertTriangle,
  Sparkles,
  Search,
  CheckCircle,
  TrendingUp,
  Lock,
  Users,
  UserPlus,
  UserX,
  Key
} from 'lucide-react';

interface GestaoBPOsProps {
  interactions: Interaction[];
  bpos: string[];
  session: UserSession;
  onBposChanged: () => void;
}

export default function GestaoBPOs({ 
  interactions, 
  bpos, 
  session, 
  onBposChanged 
}: GestaoBPOsProps) {
  const [newBpoName, setNewBpoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = session.role === 'admin';

  // --- Modal emulation for iframe compatibility ---
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // User management has been moved to the dedicated GestaoAcessos tab.

  // Handle registering a new BPO
  const handleAddBpo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg("Apenas administradores do sistema SaaS podem cadastrar novas parceiras BPO.");
      return;
    }

    const cleanName = newBpoName.trim();
    if (!cleanName) {
      setErrorMsg("O nome da empresa BPO não pode ser vazio.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/bpos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`BPO "${cleanName}" cadastrado com sucesso!`);
        setNewBpoName("");
        onBposChanged(); // Trigger reload in parent App
      } else {
        setErrorMsg(data.error || "Ocorreu um erro ao cadastrar o BPO.");
      }
    } catch (err) {
      setErrorMsg("Ocorreu uma falha na comunicação com o servidor.");
    } finally {
      setSaving(false);
    }
  };

  // Handle removing a BPO
  const handleDeleteBpo = async (name: string) => {
    if (!isAdmin) {
      setAlertModal({
        title: "Acesso Negado",
        message: "Apenas administradores do sistema SaaS podem remover parceiras BPO."
      });
      return;
    }

    setConfirmModal({
      title: "Excluir Parceira BPO",
      message: `Deseja remover as regras de BPO para o parceiro "${name}"? Isso não removerá os atendimentos já salvos no banco, mas impedirá novas vinculações e revogará contas de acessos associadas a esta BPO.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bpos/${encodeURIComponent(name)}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            onBposChanged(); // Trigger reload in parent App
          } else {
            const data = await res.json();
            setAlertModal({
              title: "Erro na Exclusão",
              message: data.error || "Ocorreu um erro ao excluir o BPO da base de dados."
            });
          }
        } catch (err) {
          setAlertModal({
            title: "Erro de Conexão",
            message: "Falha de rede ao tentar excluir o BPO."
          });
        }
        setConfirmModal(null);
      }
    });
  };

  // Combine BPOs from props and BPOs found in interactions
  const allBpos = Array.from(
    new Set([...bpos, ...interactions.map(i => i.bpoName).filter(Boolean)])
  ).sort();

  // Filter BPOs list
  const filteredBpos = allBpos.filter(b => 
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4" id="gestaoBpoRoot">
      
      {/* Intro section */}
      <div className="bg-white border border-slate-200 p-4 rounded text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Gestão das Empresas Parceiras (BPOs Terceirizados)</h2>
          </div>
          <span className="text-[10px] bg-slate-100 font-mono p-1 px-2 border rounded font-bold text-slate-500">
            Total Cadastrados: {bpos.length} BPOs
          </span>
        </div>
        <p className="text-[10px] text-slate-400">
          Gerencie as fornecedoras credenciadas que prestam serviços de central de relacionamento. Adicione novas empresas para disponibilizar a importação de lotes, filtros do dashboard geral, relatórios de auto-auditoria heurística e discussões de plano de ação cognitivo no chat IA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Registration form on the left (or lock overlay if BPO role) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded p-4 text-left relative overflow-hidden flex flex-col justify-between h-full min-h-[320px]">
            
            {!isAdmin && (
              <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-3xs flex flex-col items-center justify-center p-4 text-center z-13">
                <Lock className="w-8 h-8 text-amber-500 mb-2" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Acesso Restrito ao Admin</h4>
                <p className="text-[10px] text-slate-400 max-w-[240px] mt-1">
                  Seu login atual é de operador terceirizado (Role: BPO). Apenas administradores do portal SaaS "AuditaQA" têm permissão para cadastrar novas fornecedoras.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-50 pb-1.5">
                <span>Cadastrar Nova Fornecedora</span>
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
              </h3>

              <form onSubmit={handleAddBpo} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nome Social do BPO</label>
                  <input 
                    type="text"
                    value={newBpoName}
                    onChange={(e) => setNewBpoName(e.target.value)}
                    placeholder="Ex: BPO Alpha, BPO Beta, Parceiro SAC..."
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs font-sans text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    disabled={saving}
                    required
                    id="newBpoNameInput"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Insira a abreviação comercial que será identificada nos cabeçalhos das planilhas de áudio carregados na ingestão.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-2 bg-rose-50 border border-rose-150 text-rose-700 text-[10px] rounded font-bold leading-normal">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="p-2 bg-emerald-50 border border-emerald-150 text-emerald-850 text-[10px] rounded font-bold leading-normal flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !newBpoName.trim()}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  id="submitAddBpoBtn"
                >
                  {saving ? "Salvando no SaaS..." : "Cadastrar Empresa BPO"}
                </button>
              </form>
            </div>

            <div className="text-[9px] text-slate-450 leading-relaxed p-2.5 bg-indigo-50/40 rounded border border-indigo-100/30 mt-4">
              📌 <strong>Regra de Integração:</strong> Cadastrar o nome correto evita erros de conciliação ao processar arquivos CSV/XLSX na aba de Ingestão de Lotes.
            </div>
          </div>
        </div>

        {/* Dynamic Interactive List of active BPOs & computed metrics */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded p-4 text-left flex flex-col h-full min-h-[320px]">
            
            {/* Header / Search bar */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 flex-wrap gap-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Lista de Fornecedoras Ativas e Indicadores
              </h3>
              
              <div className="relative w-44">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por nome..."
                  className="w-full bg-slate-50 border border-slate-250 rounded pl-7 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>
            </div>

            <div className="space-y-2 flex-grow overflow-y-auto max-h-[380px] pr-0.5">
              {filteredBpos.map(bpo => {
                // Compute quality stats for this BPO dynamically
                const bpoCalls = interactions.filter(i => i.bpoName.toLowerCase() === bpo.toLowerCase());
                const totalCalls = bpoCalls.length;
                
                const avgScore = totalCalls > 0 
                  ? Math.round(bpoCalls.reduce((acc, i) => acc + i.score, 0) / totalCalls) 
                  : 0;

                const criticalCount = bpoCalls.reduce((acc, i) => acc + (i.evaluation.criticalFails?.length || 0), 0);

                return (
                  <div 
                    key={bpo} 
                    className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-indigo-200 transition-colors"
                  >
                    
                    {/* BPO core info */}
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-700 mt-0.5">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{bpo}</span>
                          <span className="text-[8px] px-1 bg-white border rounded font-bold font-mono text-slate-450 uppercase">
                            Ativo
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <PhoneCall className="w-3 h-3 text-slate-400" />
                            {totalCalls} chamadas auditadas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quality indicators & Actions */}
                    <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-start border-t border-slate-100 sm:border-t-0 pt-2 sm:pt-0">
                      
                      {/* Score metric block */}
                      <div className="text-right min-w-[125px]">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Média Auto-QA</span>
                        <div className="flex items-center justify-end gap-1">
                          <Award className={`w-3.5 h-3.5 ${avgScore >= 80 ? 'text-emerald-500' : avgScore >= 65 ? 'text-amber-500' : 'text-rose-500'}`} />
                          <span className={`text-xs font-mono font-extrabold ${avgScore >= 80 ? 'text-slate-800' : avgScore >= 65 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {totalCalls > 0 ? `${avgScore} / 100 pt` : "N/A"}
                          </span>
                        </div>
                        {totalCalls > 0 && (
                          <div className="w-full max-w-[100px] bg-slate-200 h-1.5 rounded overflow-hidden mt-1 ml-auto">
                            <div 
                              className={`h-full rounded transition-all duration-500 ${avgScore >= 80 ? 'bg-emerald-500' : avgScore >= 65 ? 'bg-amber-400' : 'bg-rose-500'}`}
                              style={{ width: `${avgScore}%` }} 
                            />
                          </div>
                        )}
                        {criticalCount > 0 && (
                          <span className="text-[8.5px] text-rose-600 bg-rose-50 px-1 border border-rose-100 rounded font-black mt-1 inline-block">
                            {criticalCount} desvios críticos
                          </span>
                        )}
                      </div>

                      {/* Line divider */}
                      <span className="hidden sm:inline-block h-6 w-[1px] bg-slate-200 mx-1" />

                      {/* Delete actions (prevent deleting system defaults or restricted if BPO role) */}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteBpo(bpo)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded cursor-pointer transition-colors"
                          title="Remover BPO do SaaS"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="p-1.5 opacity-30 text-slate-300" title="Apenas administrador pode excluir">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}

              {filteredBpos.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50 rounded border border-dashed border-slate-200">
                  Nenhuma empresa parceira coincide com sua pesquisa.
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* User control has been moved out to dedicated GestaoAcessos tab */}

    {/* State-based Custom Confirm Dialog for iFrame Sandbox Compatibility */}
    {confirmModal && (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded shadow-lg max-w-md w-full p-5 text-left animate-fade-in">
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            {confirmModal.title}
          </h3>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {confirmModal.message}
          </p>
          <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmModal.onConfirm}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold cursor-pointer transition-colors"
            >
              Confirmar Exclusão
            </button>
          </div>
        </div>
      </div>
    )}

    {/* State-based Custom Alert Dialog */}
    {alertModal && (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded shadow-lg max-w-sm w-full p-5 text-left animate-fade-in">
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-650 shrink-0" />
            {alertModal.title}
          </h3>
          <p className="text-xs text-slate-550 mt-3 leading-relaxed">
            {alertModal.message}
          </p>
          <div className="flex items-center justify-end mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAlertModal(null)}
              className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold cursor-pointer transition-colors"
            >
              Ok, Entendi
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
