import React from "react";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  X
} from "lucide-react";
import type { GuiaImportPlan } from "../utils/guiaImport";

interface GuiaImportModalProps {
  fileName: string;
  plan: GuiaImportPlan;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onDownloadTemplate: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-indigo-50 text-indigo-700 border-indigo-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200"
};

const STATUS_LABEL: Record<string, string> = {
  created: "Novo",
  updated: "Atualizado",
  skipped: "Ignorado"
};

export default function GuiaImportModal({
  fileName,
  plan,
  saving,
  onCancel,
  onConfirm,
  onDownloadTemplate
}: GuiaImportModalProps) {
  const actionable = plan.summary.created + plan.summary.updated;
  const previewRows = plan.rows.slice(0, 60);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Prévia da importação do Guia de Penalidades"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col text-left animate-fade-in"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Importar Guia de Penalidades
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[520px]">
                {fileName} · confira o resumo antes de aplicar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            aria-label="Fechar prévia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto grow">
          {!plan.ok ? (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider">Não foi possível ler a matriz</p>
                <p className="text-xs leading-relaxed">{plan.error}</p>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  Use o modelo abaixo para conferir os nomes das colunas. A planilha atual não foi alterada.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { label: "Linhas lidas", value: plan.summary.total, style: "bg-slate-50 border-slate-200 text-slate-800" },
                  { label: "Novos", value: plan.summary.created, style: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                  { label: "Atualizados", value: plan.summary.updated, style: "bg-indigo-50 border-indigo-200 text-indigo-800" },
                  { label: "Ignorados", value: plan.summary.skipped, style: "bg-amber-50 border-amber-200 text-amber-800" },
                  { label: "Blocos novos", value: plan.summary.newBlocks, style: "bg-purple-50 border-purple-200 text-purple-800" }
                ].map((card) => (
                  <div key={card.label} className={`border rounded-xl p-3 text-center ${card.style}`}>
                    <span className="block text-[9px] font-black uppercase tracking-wider opacity-80">{card.label}</span>
                    <span className="text-xl font-black">{card.value}</span>
                  </div>
                ))}
              </div>

              {plan.detectedColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colunas lidas:</span>
                  {plan.detectedColumns.map((column) => (
                    <span
                      key={column}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600"
                    >
                      {column}
                    </span>
                  ))}
                </div>
              )}

              {plan.warnings.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Avisos da importação
                    </span>
                  </div>
                  <ul className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {plan.warnings.map((warning, index) => (
                      <li key={index} className="text-[11px] leading-snug text-amber-900">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.summary.newBlocks > 0 && (
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 text-[11px] text-purple-900 leading-relaxed">
                  Os blocos novos entram em <strong>Blocos de Metodologia</strong> com peso 0% para não alterar a
                  soma dos pesos. Ajuste o peso depois de concluir a importação.
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <th className="p-2.5 w-16 text-center">Linha</th>
                        <th className="p-2.5 w-24">Status</th>
                        <th className="p-2.5 w-16">ID</th>
                        <th className="p-2.5">Motivo / Infração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-semibold">
                            Nenhuma linha de dados para importar.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row) => (
                          <tr key={`${row.rowNumber}-${row.id ?? "sem-id"}`} className="text-[11px]">
                            <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">{row.rowNumber}</td>
                            <td className="p-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${STATUS_STYLE[row.status]}`}
                                title={row.reason}
                              >
                                {STATUS_LABEL[row.status]}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-[10px] text-slate-500">
                              {row.id ? `#${row.id}` : "—"}
                            </td>
                            <td className="p-2.5 text-slate-700 font-semibold">
                              {row.motivo || "—"}
                              {row.reason && <span className="block text-[10px] text-amber-700 font-normal">{row.reason}</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {plan.rows.length > previewRows.length && (
                  <div className="bg-slate-50 border-t border-slate-200 p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">
                    +{plan.rows.length - previewRows.length} linha(s) não exibida(s)
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Campos vazios na planilha são preservados (em linhas existentes) ou preenchidos com o padrão
                (em linhas novas). Depois de importar, use o lápis em cada linha para ajustar o que faltar.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar modelo CSV</span>
          </button>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!plan.ok || saving || actionable === 0}
              onClick={onConfirm}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
              <span>{saving ? "Aplicando..." : actionable > 0 ? `Aplicar ${actionable} linha(s)` : "Nada para aplicar"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
