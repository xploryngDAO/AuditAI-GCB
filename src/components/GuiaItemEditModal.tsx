import React, { useState } from "react";
import { CheckCircle2, RefreshCw, X } from "lucide-react";
import type { GuiaItem, MetodologiaBloco } from "../types";

interface GuiaItemEditModalProps {
  item: GuiaItem;
  blocos: MetodologiaBloco[];
  availableBpos: string[];
  availableQueues: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: (fields: Partial<GuiaItem>) => void;
}

export default function GuiaItemEditModal({
  item,
  blocos,
  availableBpos,
  availableQueues,
  saving,
  onCancel,
  onSave
}: GuiaItemEditModalProps) {
  const [form, setForm] = useState({
    motivoOriginal: item.motivoOriginal,
    motivoSimplificado: item.motivoSimplificado || "",
    categoriaEstrategica: item.categoriaEstrategica || "",
    bloco: item.bloco,
    relevancia: item.relevancia,
    scorePenalidade: item.scorePenalidade,
    subtenantId: item.subtenantId || "todos",
    queueName: item.queueName || "todas",
    acaoCorretiva: item.acaoCorretiva || "",
    observacao: item.observacao || ""
  });

  const blockNames = Array.from(new Set([...blocos.map((bloco) => bloco.nome), form.bloco].filter(Boolean)));
  const bpoNames = Array.from(new Set(["todos", ...availableBpos, form.subtenantId].filter(Boolean)));
  const queueNames = Array.from(
    new Set(["todas", ...availableQueues, "SAC_VOZ_HUMANO", "RETENCAO_CHAT", form.queueName].filter(Boolean))
  );

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const canSave = form.motivoOriginal.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar motivo do Guia de Penalidades"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col text-left animate-fade-in"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Editar motivo #{item.id}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Ajuste os campos que não vieram completos na planilha ou atualize a regra.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            aria-label="Fechar edição"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto grow">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Motivo / Infração do Manual</label>
              <input
                type="text"
                value={form.motivoOriginal}
                onChange={(event) => update("motivoOriginal", event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Bloco Metodológico</label>
              <select
                value={form.bloco}
                onChange={(event) => update("bloco", event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {blockNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Motivo Simplificado</label>
              <input
                type="text"
                value={form.motivoSimplificado}
                onChange={(event) => update("motivoSimplificado", event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Categoria Estratégica</label>
              <input
                type="text"
                value={form.categoriaEstrategica}
                onChange={(event) => update("categoriaEstrategica", event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Gravidade</label>
              <select
                value={form.relevancia}
                onChange={(event) => update("relevancia", event.target.value as GuiaItem["relevancia"])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="LEVE">LEVE</option>
                <option value="MODERADA">MODERADA</option>
                <option value="CRÍTICA">CRÍTICA</option>
                <option value="PÊNALTI (ERRO FATAL)">PÊNALTI (ERRO FATAL)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Penalidade (pontos)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.scorePenalidade}
                onChange={(event) => update("scorePenalidade", Number(event.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Sub-tenant / BPO</label>
              <select
                value={form.subtenantId}
                onChange={(event) => update("subtenantId", event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {bpoNames.map((name) => (
                  <option key={name} value={name}>
                    {name === "todos" ? "Todos os BPOs (Global)" : name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Fila Alvo</label>
            <select
              value={form.queueName}
              onChange={(event) => update("queueName", event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {queueNames.map((name) => (
                <option key={name} value={name}>
                  {name === "todas" ? "Todas as Filas (Geral)" : name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Ação corretiva</label>
            <textarea
              rows={2}
              value={form.acaoCorretiva}
              onChange={(event) => update("acaoCorretiva", event.target.value)}
              placeholder="Ex: Orientar o operador e reforçar o script de confirmação de dados."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Observação</label>
            <textarea
              rows={2}
              value={form.observacao}
              onChange={(event) => update("observacao", event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() =>
              onSave({
                motivoOriginal: form.motivoOriginal.trim(),
                motivoSimplificado: form.motivoSimplificado.trim(),
                categoriaEstrategica: form.categoriaEstrategica.trim(),
                bloco: form.bloco,
                relevancia: form.relevancia,
                scorePenalidade: Number(form.scorePenalidade) || 0,
                subtenantId: form.subtenantId,
                queueName: form.queueName,
                acaoCorretiva: form.acaoCorretiva.trim(),
                observacao: form.observacao.trim()
              })
            }
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{saving ? "Salvando..." : "Salvar alterações"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
