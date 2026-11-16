import React, { useState, useEffect } from 'react';
import { Interaction, UserSession, GuiaItem } from '../types';
import { maskPII, maskCustomerName } from '../utils/piiMasking';
import { determineParticipantRole, isBotOrSystemText, isAgentText, isCustomerText } from '../utils/participantDetection';
import { 
  Building2, 
  Users, 
  PhoneCall, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar,
  ChevronRight,
  User,
  MessageSquare,
  Sparkles,
  Award,
  Filter,
  FileText,
  Trash2,
  ListTodo,
  Minimize2,
  Maximize2,
  Plus,
  HelpCircle,
  Undo2,
  X,
  Info,
  Sliders,
  RefreshCw,
  Search,
  UploadCloud,
  Layers,
  Cpu,
  Star,
  CheckSquare,
  ArrowRightLeft,
  Network,
  Play,
  ShieldCheck
} from 'lucide-react';

interface AnalisesAuditoriaProps {
  interactions: Interaction[];
  session: UserSession;
  onSelectCall: (call: Interaction) => void;
  onDeleteCall?: (id: string) => Promise<void>;
  onRefreshInteractions?: () => Promise<void>;
  activeCallId: string | null;
  bpos?: string[];
  guiaItens?: GuiaItem[];
}

export interface CustomPenalty {
  id: string;
  idx: number;
  text: string;
  reason: string;
  category: 'Processo' | 'Conhecimento' | 'Sistemas' | 'Experiência';
  score: number;
}

export interface ConfrontoItem {
  id: string;
  operador: string;
  customerName: string;
  dataHora: string;
  canal: 'audio' | 'chat';
  bpo: string;
  scoreAutoQA: number;
  scoreTradicional: number;
  diferenca: number;
  pilaresPrejudicados: string[];
  justificativaHumana: string;
  justificativaIA: string;
  statusCalibracao: string;
  parecerCalibracao: string;
}

export interface CalibrationStats {
  totalCorrelacionados: number;
  assertividadePercent: number;
  mediaScoreAutoQA: number;
  mediaScoreTradicional: number;
}

export default function AnalisesAuditoria({ 
  interactions, 
  session, 
  onSelectCall,
  onDeleteCall,
  onRefreshInteractions,
  activeCallId,
  bpos = ["BPO Alpha", "BPO Beta", "BPO Gamma"],
  guiaItens = []
}: AnalisesAuditoriaProps) {
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'confronto'>('individual');
  
  // States related to individual audits
  const [selectedBpo, setSelectedBpo] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>("all");
  const [localSearchTerm, setLocalSearchTerm] = useState<string>("");
  const [selectedCallIds, setSelectedCallIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);
  const [confirmModalState, setConfirmModalState] = useState<{ type: 'bulk' | 'clearAll'; title: string; message: string } | null>(null);

  const [reAuditingId, setReAuditingId] = useState<string | null>(null);
  const [reAuditingBatch, setReAuditingBatch] = useState<boolean>(false);
  const [reAuditToast, setReAuditToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [customPenaltiesMap, setCustomPenaltiesMap] = useState<Record<string, CustomPenalty[]>>({});
  const [overriddenStandardFailsMap, setOverriddenStandardFailsMap] = useState<Record<string, string[]>>({});
  const [checklistStatusOverrides, setChecklistStatusOverrides] = useState<Record<string, Record<number, 'conforme' | 'violado'>>>({});
  const [activeJustificationItemId, setActiveJustificationItemId] = useState<number | null>(null);
  const [editableJustifications, setEditableJustifications] = useState<Record<string, Record<number, string>>>({});

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [piiMaskingActive, setPiiMaskingActive] = useState<boolean>(true);
  const [penaltyModal, setPenaltyModal] = useState<{
    lineIdx: number;
    initialText: string;
    fullLineText: string;
  } | null>(null);

  const [customReason, setCustomReason] = useState("");
  const [customCategory, setCustomCategory] = useState<'Processo' | 'Conhecimento' | 'Sistemas' | 'Experiência'>('Experiência');
  const [customScore, setCustomScore] = useState<number>(15);
  const [customText, setCustomText] = useState("");
  const [selectedGuideItemId, setSelectedGuideItemId] = useState<string>("");

  // Map de progresso visual em tempo real para cada div de atendimento
  const [auditProgressMap, setAuditProgressMap] = useState<Record<string, {
    percent: number;
    stage: string;
    status: 'processing' | 'success' | 'error';
    error?: string;
  }>>({});
  const [batchStats, setBatchStats] = useState<{ current: number; total: number } | null>(null);

  const handleReAuditSingle = async (id: string) => {
    setReAuditingId(id);
    setReAuditToast(null);

    setAuditProgressMap(prev => ({
      ...prev,
      [id]: { percent: 15, stage: 'Iniciando extração do diálogo...', status: 'processing' }
    }));

    const timer1 = setTimeout(() => {
      setAuditProgressMap(prev => prev[id] ? ({
        ...prev,
        [id]: { percent: 45, stage: 'Processando com modelo Gemini (IA)...', status: 'processing' }
      }) : prev);
    }, 1000);

    const timer2 = setTimeout(() => {
      setAuditProgressMap(prev => prev[id] ? ({
        ...prev,
        [id]: { percent: 75, stage: 'Avaliando critérios e matriz de penalidades...', status: 'processing' }
      }) : prev);
    }, 2500);

    const timer3 = setTimeout(() => {
      setAuditProgressMap(prev => prev[id] ? ({
        ...prev,
        [id]: { percent: 90, stage: 'Consolidando laudo e calculando nota final...', status: 'processing' }
      }) : prev);
    }, 4200);

    try {
      const tid = session?.tenantId || 'system-global';
      const email = session?.userEmail || '';
      const res = await fetch(`/api/interactions/${id}/re-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tid,
          'x-user-email': email
        },
        body: JSON.stringify({ tenantId: tid, userEmail: email })
      });
      const data = await res.json();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (res.ok && data.success) {
        setAuditProgressMap(prev => ({
          ...prev,
          [id]: { percent: 100, stage: 'Auditoria Concluída! (100%)', status: 'success' }
        }));
        setReAuditToast({
          type: 'success',
          message: '🎉 Auditoria de IA processada e concluída com sucesso!'
        });
        if (onRefreshInteractions) {
          await onRefreshInteractions();
        }
        setTimeout(() => {
          setAuditProgressMap(prev => {
            const clone = { ...prev };
            delete clone[id];
            return clone;
          });
        }, 4000);
      } else {
        const errMsg = data.error || 'A quota de API de IA continua indisponível no momento. O atendimento permanece salvo como pendente.';
        setAuditProgressMap(prev => ({
          ...prev,
          [id]: { percent: 100, stage: 'Pendente de IA / Erro Quota', status: 'error', error: errMsg }
        }));
        setReAuditToast({
          type: 'error',
          message: errMsg
        });
        if (onRefreshInteractions) {
          await onRefreshInteractions();
        }
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      const errMsg = err.message || 'Falha de conexão com o servidor.';
      setAuditProgressMap(prev => ({
        ...prev,
        [id]: { percent: 100, stage: 'Erro de Comunicação', status: 'error', error: errMsg }
      }));
      setReAuditToast({
        type: 'error',
        message: `Erro na re-auditoria: ${errMsg}`
      });
    } finally {
      setReAuditingId(null);
    }
  };

  const handleReAuditBatch = async () => {
    setReAuditingBatch(true);
    setReAuditToast(null);

    const pendingTargets = interactions.filter(i => 
      i.auditStatus === 'pending' || 
      i.auditStatus === 'failed' || 
      i.evaluation?.summary?.includes('[Pendente de IA]')
    );

    if (pendingTargets.length === 0) {
      setReAuditToast({
        type: 'info',
        message: 'Nenhum atendimento pendente para auditar no momento.'
      });
      setReAuditingBatch(false);
      return;
    }

    setBatchStats({ current: 0, total: pendingTargets.length });
    let succeeded = 0;

    for (let idx = 0; idx < pendingTargets.length; idx++) {
      const item = pendingTargets[idx];
      setBatchStats({ current: idx + 1, total: pendingTargets.length });

      setAuditProgressMap(prev => ({
        ...prev,
        [item.id]: { percent: 25, stage: `Lote (${idx + 1}/${pendingTargets.length}): Enviando para IA...`, status: 'processing' }
      }));

      const timerA = setTimeout(() => {
        setAuditProgressMap(prev => prev[item.id] ? ({
          ...prev,
          [item.id]: { percent: 65, stage: `Lote (${idx + 1}/${pendingTargets.length}): Avaliando conformidades...`, status: 'processing' }
        }) : prev);
      }, 1200);

      try {
        const tid = session?.tenantId || 'system-global';
        const email = session?.userEmail || '';
        const res = await fetch(`/api/interactions/${item.id}/re-audit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tid,
            'x-user-email': email
          },
          body: JSON.stringify({ tenantId: tid, userEmail: email })
        });
        const data = await res.json();
        clearTimeout(timerA);

        if (res.ok && data.success) {
          succeeded++;
          setAuditProgressMap(prev => ({
            ...prev,
            [item.id]: { percent: 100, stage: 'Concluído 100%', status: 'success' }
          }));
        } else {
          setAuditProgressMap(prev => ({
            ...prev,
            [item.id]: { percent: 100, stage: 'Falha Quota / Pendente', status: 'error', error: data.error }
          }));
        }

        if (onRefreshInteractions) {
          await onRefreshInteractions();
        }
      } catch (err: any) {
        clearTimeout(timerA);
        setAuditProgressMap(prev => ({
          ...prev,
          [item.id]: { percent: 100, stage: 'Erro de conexão', status: 'error', error: err.message }
        }));
      }
    }

    setReAuditToast({
      type: succeeded > 0 ? 'success' : 'error',
      message: `🎉 Auditoria em lote finalizada! ${succeeded} de ${pendingTargets.length} atendimentos foram auditados com sucesso com a IA.`
    });
    setBatchStats(null);
    setReAuditingBatch(false);
  };

  // States related to Confronto / Calibration sub-tab
  const [confrontos, setConfrontos] = useState<ConfrontoItem[]>([]);
  const [calibrationStats, setCalibrationStats] = useState<CalibrationStats>({
    totalCorrelacionados: 0,
    assertividadePercent: 100,
    mediaScoreAutoQA: 0,
    mediaScoreTradicional: 0
  });
  const [selectedConfronto, setSelectedConfronto] = useState<ConfrontoItem | null>(null);
  const [loadingCalibracao, setLoadingCalibracao] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileSuccess, setFileSuccess] = useState("");

  // Raw file uploaded states for Column Mapping Dynamic Flow
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mappingBpo, setMappingBpo] = useState<string>(bpos[0] || "BPO Alpha");
  const [mappingIdCol, setMappingIdCol] = useState<string>("");
  const [mappingScoreCol, setMappingScoreCol] = useState<string>("");
  const [mappingScoreType, setMappingScoreType] = useState<'direct_score' | 'deduction'>('direct_score');

  const isBpoUser = session.role === 'bpo';

  const activeCall = interactions.find(item => item.id === activeCallId) || null;

  useEffect(() => {
    if (activeSubTab === 'confronto') {
      loadCalibracaoData();
    }
  }, [activeSubTab]);

  const loadCalibracaoData = async () => {
    setLoadingCalibracao(true);
    try {
      const tid = session?.tenantId || 'system-global';
      const email = session?.userEmail || '';
      const r = await fetch(`/api/confronto?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}`, {
        headers: {
          'x-tenant-id': tid,
          'x-user-email': email
        }
      });
      if (r.ok) {
        const data = await r.json();
        if (data.success) {
          setConfrontos(data.correlacoes || []);
          if (data.stats) {
            setCalibrationStats(data.stats);
          }
        }
      }
    } catch (err) {
      console.error("Erro loading calibration data:", err);
    } finally {
      setLoadingCalibracao(false);
    }
  };

  const getListItemStatus = (call: Interaction, item: GuiaItem) => {
    const callOverrides = checklistStatusOverrides[call.id] || {};
    if (callOverrides[item.id]) {
      return callOverrides[item.id];
    }

    const defaultFails = call.evaluation.criticalFails || [];
    const isViolatedByAi = defaultFails.some(fail => 
      fail.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
      fail.toLowerCase().includes(item.motivoSimplificado.toLowerCase())
    );

    return isViolatedByAi ? 'violado' : 'conforme';
  };

  const getViolationJustification = (call: Interaction, item: GuiaItem): string => {
    // 1. Verificar se há justificativa editada localmente/manualmente
    if (editableJustifications[call.id]?.[item.id] !== undefined) {
      return editableJustifications[call.id][item.id];
    }

    // 2. Tentar obter do objeto de avaliação retornado pelo BD/IA
    const justifications = (call.evaluation as any).failJustifications || {};
    if (justifications[item.motivoSimplificado]) return justifications[item.motivoSimplificado];
    if (justifications[item.motivoOriginal]) return justifications[item.motivoOriginal];

    // Substring match insensível case
    const keys = Object.keys(justifications);
    for (const k of keys) {
      if (k.toLowerCase().includes(item.motivoSimplificado.toLowerCase()) || 
          item.motivoSimplificado.toLowerCase().includes(k.toLowerCase()) ||
          k.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
          item.motivoOriginal.toLowerCase().includes(k.toLowerCase())) {
        return justifications[k];
      }
    }

    // Fallback amigável se a IA identificou mas sem chave correspondente robusta
    const defaultFails = call.evaluation.criticalFails || [];
    const matchedFail = defaultFails.find(fail => 
      fail.toLowerCase().includes(item.motivoOriginal.toLowerCase()) ||
      fail.toLowerCase().includes(item.motivoSimplificado.toLowerCase())
    );

    if (matchedFail) {
      return `Foi registrada inconformidade crítica no atendimento referente à diretriz: "${matchedFail}".`;
    }

    return "Apresentou inconformidade com os padrões operacionais exigidos pelo guia de monitoria.";
  };

  const updateViolationJustification = (callId: string, itemId: number, text: string) => {
    setEditableJustifications(prev => {
      const callMap = prev[callId] || {};
      return {
        ...prev,
        [callId]: {
          ...callMap,
          [itemId]: text
        }
      };
    });
  };

  useEffect(() => {
    setActiveJustificationItemId(null);
  }, [activeCallId]);

  const toggleChecklistStatus = (callId: string, itemId: number, targetStatus: 'conforme' | 'violado') => {
    setChecklistStatusOverrides(prev => {
      const callOverrides = prev[callId] || {};
      return {
        ...prev,
        [callId]: {
          ...callOverrides,
          [itemId]: targetStatus
        }
      };
    });

    // Se mudou para violado, sugerimos abrir a visualização da justificativa
    if (targetStatus === 'violado') {
      setActiveJustificationItemId(itemId);
    } else {
      if (activeJustificationItemId === itemId) {
        setActiveJustificationItemId(null);
      }
    }
  };

  const handleGuideItemSelectionChange = (itemId: string) => {
    setSelectedGuideItemId(itemId);
    if (!itemId) {
      setCustomReason("");
      return;
    }
    if (itemId === "custom") {
      setCustomReason("");
      return;
    }
    const gi = guiaItens.find(item => item.id === Number(itemId));
    if (gi) {
      setCustomReason(gi.motivoSimplificado);
      setCustomCategory(gi.bloco as any);
      setCustomScore(gi.scorePenalidade);
    }
  };

  useEffect(() => {
    if (penaltyModal) {
      setSelectedGuideItemId("");
      setCustomReason("");
      setCustomCategory("Experiência");
      setCustomScore(15);
    }
  }, [penaltyModal]);

  const matchHeuristic = (text: string, failDescription: string, idx: number): boolean => {
    const textLower = text.toLowerCase();
    const failLower = failDescription.toLowerCase();

    if (failLower.includes("protocolo")) {
      return textLower.includes("protocolo") || textLower.includes("número");
    }
    if (failLower.includes("personalizou") || failLower.includes("nome")) {
      return idx < 6 && (textLower.includes("chamo") || textLower.includes("como falo") || textLower.includes("sua conta"));
    }
    if (failLower.includes("insulto") || failLower.includes("grosseira") || failLower.includes("termo") || failLower.includes("milagre")) {
      return textLower.includes("milagre") || textLower.includes("perder meu tempo") || textLower.includes("desligar");
    }
    if (failLower.includes("desvio dênis") || failLower.includes("responde")) {
      return textLower.includes("deixou sem resposta") || textLower.includes("não respondeu");
    }
    if (failLower.includes("abandono") || failLower.includes("desligou") || failLower.includes("desconex")) {
      return textLower.includes("desligar a senhora") || textLower.includes("perder meu tempo");
    }
    return false;
  };

  // Dynamic Score Calculation
  const getCallScore = (call: Interaction) => {
    let finalVal = 100;
    let criticalFailTriggered = false;

    // 1. Initial AI check
    const rawFails = call.evaluation.criticalFails || [];
    const overriddenList = overriddenStandardFailsMap[call.id] || [];
    const activeFails = rawFails.filter(f => !overriddenList.includes(f));

    // 2. Map checklist status overrides
    guiaItens.forEach(item => {
      const status = getListItemStatus(call, item);
      if (status === 'violado') {
        if (item.relevancia === 'PÊNALTI (ERRO FATAL)' || item.scorePenalidade >= 100) {
          criticalFailTriggered = true;
        } else {
          finalVal -= item.scorePenalidade;
        }
      }
    });

    // Assess raw standard fails which might not be mapped in Guia Itens
    activeFails.forEach(failText => {
      const isMappedInGuia = guiaItens.some(gi => 
        failText.toLowerCase().includes(gi.motivoOriginal.toLowerCase()) ||
        failText.toLowerCase().includes(gi.motivoSimplificado.toLowerCase())
      );
      if (!isMappedInGuia) {
        if (failText.toLowerCase().includes("fatal") || failText.toLowerCase().includes("pênalti") || failText.toLowerCase().includes("zero")) {
          criticalFailTriggered = true;
        } else {
          finalVal -= 10; // Default penalty for raw AI flags
        }
      }
    });

    // 3. Custom penalty points
    const customPenalties = customPenaltiesMap[call.id] || [];
    customPenalties.forEach(cp => {
      finalVal -= cp.score;
    });

    if (criticalFailTriggered || finalVal < 0) {
      return 0;
    }
    return finalVal;
  };

  const getCallBlockScore = (call: Interaction, blockName: string) => {
    let totalBlockPenalty = 0;
    let totalItems = 0;
    let violatedItems = 0;

    const blockGuideItens = guiaItens.filter(g => g.bloco.toLowerCase() === blockName.toLowerCase());
    blockGuideItens.forEach(item => {
      totalItems++;
      const status = getListItemStatus(call, item);
      if (status === 'violado') {
        violatedItems++;
        totalBlockPenalty += item.scorePenalidade;
      }
    });

    const customs = customPenaltiesMap[call.id] || [];
    customs.forEach(cp => {
      if (cp.category.toLowerCase() === blockName.toLowerCase()) {
        totalBlockPenalty += cp.score;
      }
    });

    if (totalItems === 0) return 100;
    const directScore = 100 - totalBlockPenalty;
    return directScore < 0 ? 0 : directScore;
  };

  const handleToggleOverrideStandardFail = (failDescription: string) => {
    if (!activeCall) return;
    setOverriddenStandardFailsMap(prev => {
      const currentList = prev[activeCall.id] || [];
      const updated = currentList.includes(failDescription)
        ? currentList.filter(f => f !== failDescription)
        : [...currentList, failDescription];
      return { ...prev, [activeCall.id]: updated };
    });
  };

  const handleAddCustomPenalty = () => {
    if (!activeCall || !penaltyModal) return;
    const pReason = customReason.trim() || "Desvio operacional geral";
    const cp: CustomPenalty = {
      id: `custom-${Date.now()}`,
      idx: penaltyModal.lineIdx,
      text: customText.trim() || penaltyModal.initialText,
      reason: pReason,
      category: customCategory,
      score: customScore
    };

    setCustomPenaltiesMap(prev => {
      const list = prev[activeCall.id] || [];
      return { ...prev, [activeCall.id]: [...list, cp] };
    });

    // Also mark associated GuiaItem to violated in interactive checklist if there is a direct match
    if (selectedGuideItemId && selectedGuideItemId !== "custom") {
      const giNum = Number(selectedGuideItemId);
      toggleChecklistStatus(activeCall.id, giNum, 'violado');
    }

    setPenaltyModal(null);
  };

  const handleRemoveCustomPenalty = (callId: string, penaltyId: string) => {
    setCustomPenaltiesMap(prev => {
      const list = prev[callId] || [];
      return { ...prev, [callId]: list.filter(cp => cp.id !== penaltyId) };
    });
  };

  // CSV parsing engine
  const parseTraditionalCSV = (csvText: string) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) throw new Error("O arquivo está vazio ou mal estruturado.");

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes(',') ? ',' : '\t';

    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let currentVal = '';
      let insideQuotes = false;

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          values.push(currentVal.trim().replace(/^"|"$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^"|"$/g, ''));

      const rObj: any = {};
      headers.forEach((h, index) => {
        rObj[h] = values[index] || "";
      });
      rows.push(rObj);
    }
    return { headers, rows };
  };

  const processAndUploadTraditional = async (text: string) => {
    setFileError("");
    setFileSuccess("");
    try {
      const { headers, rows } = parseTraditionalCSV(text);
      if (rows.length === 0) {
        throw new Error("Nenhuma linha útil de dados identificada.");
      }

      setRawHeaders(headers);
      setRawRows(rows);

      // Guess sensible columns
      const guessIdCol = headers.find(h => ["id", "idligacao", "id_ligacao", "ligacao", "identificador", "callid", "key", "chave", "atendimento"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))) || headers[0];
      const guessScoreCol = headers.find(h => ["nota", "score", "pontos", "valor", "rating", "avaliacao", "resultado"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))) || headers[1] || headers[0];

      setMappingIdCol(guessIdCol);
      setMappingScoreCol(guessScoreCol);
      setFileSuccess("Planilha carregada. Configure o mapeamento das colunas abaixo para prosseguir.");
    } catch (e: any) {
      console.error(e);
      setFileError(`❌ Erro no carregamento: ${e.message || "Verifique se o delimitador é válido (, ou ;)"}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processAndUploadTraditional(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processAndUploadTraditional(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExecuteMappingAndUpload = async () => {
    if (!mappingIdCol || !mappingScoreCol) {
      setFileError("Por favor escolha as colunas de ID e Nota.");
      return;
    }

    setIsUploading(true);
    setFileError("");
    setFileSuccess("");

    try {
      // Standardize the CSV rows based on user mappings
      const standardizedRows = rawRows.map((r, idx) => {
        const idVal = String(r[mappingIdCol] || "").trim();
        const scoreVal = parseFloat(String(r[mappingScoreCol] || "100"));

        // If score is S, deduction = 100 - S (if final score is 85, deduction = 15 points)
        const deductionVal = mappingScoreType === "direct_score" ? (100 - scoreVal) : scoreVal;

        // Guess default values or find column equivalents
        const findValByKeys = (possibleKeys: string[]) => {
          for (const pk of possibleKeys) {
            const foundKey = Object.keys(r).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === pk.toLowerCase().replace(/[^a-z0-9]/g, ""));
            if (foundKey) return r[foundKey];
          }
          return "";
        };

        return {
          id: idVal || `TRAD-${Date.now()}-${idx}`,
          idLigacao: idVal,
          dataHora: String(findValByKeys(["datainteracao", "data_hora", "data", "date", "created_at"]) || new Date().toISOString()),
          funcionaria: String(findValByKeys(["atendente", "operador", "nome_atendente", "agente", "funcionario"]) || "Auditor Tradicional"),
          justificativaResposta: String(findValByKeys(["justificativa", "justificativa_resposta", "observacao", "comentarios"]) || "Simulada da planilha tradicional mapeada."),
          pilar: String(findValByKeys(["pilar", "bloco", "critério"]) || "Experiência"),
          detalheResposta: String(findValByKeys(["detalhe", "detalhe_resposta", "resposta"]) || `Nota monitoria confrontada: ${scoreVal}%`),
          pontosDeduzidos: deductionVal >= 0 ? deductionVal : 0,
          classificacao: deductionVal >= 100 ? "PÊNALTI (ERRO FATAL)" : deductionVal > 15 ? "CRÍTICA" : "LEVE",
          segmento: String(findValByKeys(["segmento", "canal", "channel"]) || "WHATSAPP"),
          assuntoMotivo: String(findValByKeys(["assunto", "motivo", "topic"]) || "SAC"),
          tabulacao: String(findValByKeys(["tabulacao", "categoria"]) || "Outros")
        };
      });

      const resp = await fetch('/api/monitoria-tradicional/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: standardizedRows })
      });

      if (resp.ok) {
        setFileSuccess(`🎉 Alinhamento realizado! ${standardizedRows.length} registros da prestadora ${mappingBpo} foram importados e relacionados aos atendimentos do Auto-QA por ID.`);
        setRawHeaders([]);
        setRawRows([]);
        await loadCalibracaoData();
      } else {
        throw new Error("Sinalização de erro retornado pelo servidor.");
      }
    } catch (e: any) {
      console.error(e);
      setFileError(`❌ Falha na importação: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const availableBpos = Array.from(
    new Set([...bpos, ...interactions.map(i => i.bpoName).filter(Boolean)])
  ).sort();

  // Filters for call listings
  const filteredCalls = interactions.filter(call => {
    // Autorização por tenant/BPO é feita no servidor; aqui só filtro de exibição.
    if (selectedBpo !== "all" && call.bpoName?.toLowerCase() !== selectedBpo.toLowerCase()) return false;
    if (channelFilter !== "all" && call.channel?.toLowerCase() !== channelFilter.toLowerCase()) return false;
    if (sentimentFilter !== "all" && call.sentiment?.toLowerCase() !== sentimentFilter.toLowerCase()) return false;

    const isPendingCall = call.auditStatus === 'pending' || call.auditStatus === 'failed' || call.evaluation?.summary?.includes('[Pendente de IA]');
    if (auditStatusFilter === "pending" && !isPendingCall) return false;
    if (auditStatusFilter === "completed" && isPendingCall) return false;

    if (localSearchTerm.trim() !== "") {
      const q = localSearchTerm.toLowerCase();
      const matchesSearch = 
        call.agentName.toLowerCase().includes(q) ||
        call.customerName.toLowerCase().includes(q) ||
        call.id.toLowerCase().includes(q) ||
        (call.genesysExternalId && call.genesysExternalId.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    return true;
  });

  const handleToggleSelectAll = () => {
    if (selectedCallIds.length === filteredCalls.length && filteredCalls.length > 0) {
      setSelectedCallIds([]);
    } else {
      setSelectedCallIds(filteredCalls.map(c => c.id));
    }
  };

  const handleToggleSelectId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCallIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteSelected = () => {
    if (selectedCallIds.length === 0) return;
    setConfirmModalState({
      type: 'bulk',
      title: 'Excluir Selecionados em Lote',
      message: `Tem certeza de que deseja excluir permanentemente as ${selectedCallIds.length} auditoria(s) selecionada(s) da base de dados e do histórico?`
    });
  };

  const handleClearAllDatabase = () => {
    setConfirmModalState({
      type: 'clearAll',
      title: 'Zerar / Limpar Todo o Banco de Dados',
      message: '⚠️ ATENÇÃO: Esta ação é irreversível e excluirá PERMANENTEMENTE todos os atendimentos e auditorias gravados na base de dados.'
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmModalState) return;
    const actionType = confirmModalState.type;
    setConfirmModalState(null);
    setIsDeletingBulk(true);

    try {
      const tid = session?.tenantId || 'system-global';
      const email = session?.userEmail || '';
      if (actionType === 'clearAll') {
        const res = await fetch('/api/interactions/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tid,
            'x-user-email': email
          },
          body: JSON.stringify({ tenantId: tid, userEmail: email })
        });
        if (res.ok) {
          setSelectedCallIds([]);
          setReAuditToast({ type: 'success', message: 'Base de auditorias zerada com sucesso!' });
          if (onRefreshInteractions) await onRefreshInteractions();
        } else {
          const errData = await res.json().catch(() => ({}));
          setReAuditToast({ type: 'error', message: errData.error || 'Falha ao limpar base.' });
        }
      } else if (actionType === 'bulk') {
        const res = await fetch('/api/interactions/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tid,
            'x-user-email': email
          },
          body: JSON.stringify({ ids: selectedCallIds, tenantId: tid, userEmail: email })
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setSelectedCallIds([]);
          setReAuditToast({ type: 'success', message: data.message || 'Auditorias selecionadas excluídas com sucesso!' });
          if (onRefreshInteractions) await onRefreshInteractions();
        } else {
          const errData = await res.json().catch(() => ({}));
          setReAuditToast({ type: 'error', message: errData.error || 'Falha na exclusão em lote.' });
        }
      }
    } catch (err: any) {
      console.error("Erro ao executar ação de exclusão:", err);
      setReAuditToast({ type: 'error', message: 'Erro de conexão com o servidor.' });
    } finally {
      setIsDeletingBulk(false);
      setTimeout(() => setReAuditToast(null), 4000);
    }
  };

  // Transcription Lines Renderer with highlighting capability
  const renderTranscriptionList = () => {
    if (!activeCall) return null;

    if (activeCall.transcript.trim() === "") {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50 mt-6 h-full min-h-[220px]">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3 border border-amber-150">
            <span className="text-xl">⚠️</span>
          </div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Diálogo Não Extraído / Vazio</h4>
          <p className="text-[11px] text-slate-500 max-w-[360px] leading-relaxed">
            O arquivo original importado de Genesys / planilha para esta ligação possui o histórico <code className="bg-slate-150 px-1 py-0.5 rounded text-rose-600 font-mono font-bold">"mensagens: []"</code> vazio. Portanto, não existem textos ou interações para este atendimento.
          </p>
        </div>
      );
    }

    const rawTranscriptText = activeCall.rawTranscript || activeCall.transcript;
    const finalTranscriptText = piiMaskingActive
      ? maskPII(rawTranscriptText).maskedText
      : rawTranscriptText;

    const lines = finalTranscriptText.split('\n');

    return lines.map((line, idx) => {
      // Extract exact timestamp if present at start of line e.g. [10:14:02]
      const timeMatch = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?|\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2})\]\s*/);
      const timestampStr = timeMatch ? timeMatch[1] : '';
      const lineWithoutTime = timeMatch ? line.substring(timeMatch[0].length) : line;

      const colonIndex = lineWithoutTime.indexOf(':');
      let header = "";
      let content = lineWithoutTime;
      if (colonIndex > -1) {
        header = lineWithoutTime.substring(0, colonIndex).trim();
        content = lineWithoutTime.substring(colonIndex + 1).trim();
      }

      // Check if `content` itself has an embedded sender prefix e.g. "BOT:", "Cliente:", "Atendente:", "Empresa:"
      let embeddedRole = "";
      const embeddedMatch = content.match(/^(bot|ura|casas\s+bahia|sistema|system|virtual|iva|atendente|operador|agente|cliente|consumidor|user):\s*/i);
      if (embeddedMatch) {
        embeddedRole = embeddedMatch[1].toLowerCase();
        content = content.substring(embeddedMatch[0].length).trim();
      }

      const contentLower = content.toLowerCase();
      const isSystemStatusLine = (
        contentLower.includes("cliente transferido") ||
        contentLower.includes("final do histórico") ||
        contentLower.includes("histórico de") ||
        contentLower.includes("transferência realizada") ||
        contentLower.includes("atendimento encerrado")
      );

      const headerLower = header.toLowerCase();
      const cleanHeader = headerLower.replace(/[\[\]]/g, '').trim();
      const agentNameLower = activeCall.agentName ? activeCall.agentName.toLowerCase() : "";
      const customerNameLower = activeCall.customerName ? activeCall.customerName.toLowerCase() : "";

      let isAgent = false;
      let isClient = false;
      let isBotOrSys = false;
      let displayName = "";

      // Prioridade Absoluta: Análise do Conteúdo da Mensagem (Resolve erros onde URA/Bot ou Agente é rotulado como Cliente)
      if (isBotOrSystemText(content) || isSystemStatusLine) {
        isBotOrSys = true;
        displayName = "BOT URA / SISTEMA";
      } else if (isAgentText(content)) {
        isAgent = true;
        displayName = activeCall.agentName && !activeCall.agentName.toLowerCase().includes("não identificado") ? activeCall.agentName : "Atendente Operacional";
      } else if (
        embeddedRole.includes("bot") ||
        embeddedRole.includes("ura") ||
        embeddedRole.includes("empresa") ||
        embeddedRole.includes("sistema") ||
        embeddedRole.includes("system") ||
        embeddedRole.includes("virtual") ||
        embeddedRole.includes("iva")
      ) {
        isBotOrSys = true;
        displayName = "BOT URA / SISTEMA";
      } else if (embeddedRole.includes("cliente") || embeddedRole.includes("consumidor") || embeddedRole.includes("user")) {
        isClient = true;
        const rawName = activeCall.customerName && !activeCall.customerName.toLowerCase().includes("não identificado") ? activeCall.customerName : "Cliente";
        displayName = piiMaskingActive ? maskCustomerName(rawName) : rawName;
      } else if (embeddedRole.includes("atendente") || embeddedRole.includes("operador") || embeddedRole.includes("agente")) {
        isAgent = true;
        displayName = activeCall.agentName && !activeCall.agentName.toLowerCase().includes("não identificado") ? activeCall.agentName : "Atendente Operacional";
      } else if (
        cleanHeader.includes("bot") ||
        cleanHeader.includes("ura") ||
        cleanHeader.includes("sistema") ||
        cleanHeader.includes("institucional") ||
        cleanHeader.includes("system") ||
        cleanHeader.includes("instituic") ||
        cleanHeader.includes("virtual") ||
        cleanHeader.includes("iva")
      ) {
        isBotOrSys = true;
        const botName = header.replace(/[\[\]]/g, '').replace(/bot\s*-\s*/gi, '').replace(/bot/gi, '').trim();
        const isCustNameInBot = customerNameLower && botName.toLowerCase().includes(customerNameLower);
        displayName = (botName && !isCustNameInBot) ? `BOT / URA (${botName})` : "BOT URA / SISTEMA";
      } else if (
        cleanHeader.includes("atendente") ||
        cleanHeader.includes("operador") ||
        cleanHeader.includes("agente") ||
        cleanHeader.includes("atend") ||
        cleanHeader.includes("oper")
      ) {
        isAgent = true;
        const extractedAgentInHeader = header.replace(/[\[\]]/g, '').replace(/atendente\s*-\s*/gi, '').replace(/atendente/gi, '').trim();
        if (extractedAgentInHeader && extractedAgentInHeader.length > 2 && !extractedAgentInHeader.toLowerCase().includes("não identificado")) {
          displayName = extractedAgentInHeader;
        } else if (activeCall.agentName && !activeCall.agentName.toLowerCase().includes("não identificado")) {
          displayName = activeCall.agentName;
        } else {
          displayName = extractedAgentInHeader || activeCall.agentName || "Atendente Operacional";
        }
      } else if (
        cleanHeader.includes("cliente") ||
        cleanHeader.includes("customer") ||
        cleanHeader.includes("consumidor") ||
        cleanHeader.includes("user") ||
        cleanHeader.includes("client")
      ) {
        // Se a mensagem for tipicamente do cliente ou não bateu com bot/agente
        isClient = true;
        const extractedCustInHeader = header.replace(/[\[\]]/g, '').replace(/cliente\s*-\s*/gi, '').replace(/cliente/gi, '').trim();
        if (extractedCustInHeader && extractedCustInHeader.length > 2) {
          displayName = piiMaskingActive ? maskCustomerName(extractedCustInHeader) : extractedCustInHeader;
        } else if (activeCall.customerName && !activeCall.customerName.toLowerCase().includes("não identificado")) {
          displayName = piiMaskingActive ? maskCustomerName(activeCall.customerName) : activeCall.customerName;
        } else {
          const rawC = extractedCustInHeader || activeCall.customerName || "Cliente";
          displayName = piiMaskingActive ? maskCustomerName(rawC) : rawC;
        }
      } else if (agentNameLower && (cleanHeader.includes(agentNameLower) || agentNameLower.includes(cleanHeader))) {
        isAgent = true;
        displayName = activeCall.agentName;
      } else if (customerNameLower && (cleanHeader.includes(customerNameLower) || customerNameLower.includes(cleanHeader))) {
        isClient = true;
        displayName = piiMaskingActive ? maskCustomerName(activeCall.customerName) : activeCall.customerName;
      } else {
        isBotOrSys = true;
        displayName = header ? header.toUpperCase().replace(/[\[\]]/g, '').trim() : "BOT URA / SISTEMA";
      }

      // Check for custom penalties linked to this line
      const linePenalties = (customPenaltiesMap[activeCall.id] || []).filter(cp => cp.idx === idx);

      // Check if standard critical fails apply to this line (only for Agent lines)
      const rawFails = activeCall.evaluation.criticalFails || [];
      const overriddenList = overriddenStandardFailsMap[activeCall.id] || [];
      const activeFails = rawFails.filter(f => !overriddenList.includes(f));
      const lineStandardFails = isAgent ? activeFails.filter(f => matchHeuristic(line, f, idx)) : [];

      return (
        <div 
          key={idx} 
          className={`group flex gap-2.5 p-3 rounded border transition-all text-left relative cursor-pointer ${
            isAgent 
              ? 'bg-indigo-50/20 border-indigo-100 hover:bg-indigo-50/40 hover:border-indigo-200' 
              : isClient 
                ? 'bg-slate-50/40 border-slate-150 hover:bg-slate-100/60' 
                : 'bg-stone-50/30 border-dashed border-slate-200 hover:bg-slate-100/40'
          }`}
          onDoubleClick={() => {
            setPenaltyModal({
              lineIdx: idx,
              initialText: line.substring(0, 80) + "...",
              fullLineText: line
            });
            setCustomText(line);
          }}
        >
          {/* Avatar visual identifier */}
          <div className="shrink-0">
            {isAgent ? (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-mono flex items-center justify-center text-[10px] font-bold" title="Atendente Operador">
                OP
              </div>
            ) : isClient ? (
              <div className="w-6 h-6 rounded-full bg-slate-750 text-white font-mono flex items-center justify-center text-[10px] font-bold" title="Consumidor">
                CX
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 font-mono flex items-center justify-center text-[10px] font-bold" title="Bot / URA / Automatizador">
                🤖
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
              <span className={isAgent ? 'text-indigo-600 font-black' : isClient ? 'text-slate-600 font-black' : 'text-slate-500 font-black'}>{displayName}</span>
              <div className="flex items-center gap-2">
                {timestampStr && (
                  <span className="text-[9px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    ⏰ {timestampStr}
                  </span>
                )}
                <span className="text-[9px]">Turno #{idx + 1}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-750 leading-relaxed break-words font-sans selection:bg-indigo-250 selection:text-indigo-900 pr-4 font-normal">
              {content}
            </p>

            {/* AI Warning Alerts & Critical Flaws attached under this line */}
            {lineStandardFails.map((failText, failIdx) => (
              <div key={failIdx} className="bg-amber-50 border border-amber-250 p-2 rounded text-[10px] text-slate-750 mt-1.5 font-sans relative flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>AI Alerta: <strong className="font-bold underline">{failText}</strong></span>
                </div>
                <button
                  onClick={() => handleToggleOverrideStandardFail(failText)}
                  className="p-1 px-1.5 rounded-sm text-[8px] bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 font-bold shrink-0 cursor-pointer uppercase"
                >
                  Anular Desvio
                </button>
              </div>
            ))}

            {/* Custom Interactive Penalties added by the human manager on turn doubleclick */}
            {linePenalties.map((cp) => (
              <div key={cp.id} className="bg-rose-50 border border-rose-150 p-2 rounded text-[10px] text-rose-800 mt-1.5 font-sans relative flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Divergência Humana [<strong>{cp.category}</strong>]: <strong>{cp.reason}</strong> • <span className="font-extrabold text-rose-700">-{cp.score} pts</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomPenalty(activeCall.id, cp.id)}
                  className="p-1 px-1.5 bg-white border border-rose-200 text-rose-700 text-[8.5px] font-bold rounded hover:bg-rose-100 transition-colors cursor-pointer shrink-0 uppercase"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {/* Prompt on Hover */}
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white border border-indigo-700 shadow-sm p-1 px-2 rounded text-[8px] font-black pointer-events-none uppercase tracking-wider flex items-center gap-1 z-10">
            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
            Double Click para Auditar desvios do OP
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200/70">
      {/* 1. Header Navigation and mode switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-50 pb-3 leading-none select-none">
        <div className="text-left font-sans">
          <h1 className="ds-heading">
            <Layers className="w-4.5 h-4.5 text-indigo-650" />
            <span>Painel de Análises & Calibração</span>
          </h1>
          <p className="ds-subtitle">Gestão de Auditoria Individual, Laudos Completos e Calibration Board com IA.</p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1.5 self-start md:self-auto border border-slate-200 select-none">
          <button
            onClick={() => setActiveSubTab('individual')}
            className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'individual' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Auditoria Individual
          </button>
          <button
            onClick={() => setActiveSubTab('confronto')}
            className={`p-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'confronto' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Confronto & Calibração
          </button>
        </div>
      </div>
      </div>

      {/* SUB-VIEW 1: INDIVIDUAL COMPLIANCE AUDIT */}
      {activeSubTab === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* COLUMN 1: SIDEBAR CALLS (4 cols) */}
          <div className="lg:col-span-4 ds-card flex flex-col p-4 space-y-4">
            
            {/* Toast Notification for Re-audits */}
            {reAuditToast && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fade-in ${
                reAuditToast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <span>{reAuditToast.message}</span>
                <button 
                  onClick={() => setReAuditToast(null)}
                  className="p-1 hover:bg-black/5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Batch Re-audit Action Banner for Pending Cases */}
            {(() => {
              const pendingCount = interactions.filter(i => i.auditStatus === 'pending' || i.auditStatus === 'failed' || i.evaluation?.summary?.includes('[Pendente de IA]')).length;
              if (pendingCount === 0) return null;
              return (
                <div className="bg-amber-50/90 border border-amber-250 p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-left">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                    <div className="text-[11px] text-amber-900 leading-snug">
                      <strong className="font-extrabold">{pendingCount} caso(s) pendentes de IA</strong>
                      <span className="block text-[9.5px] text-amber-700">Aguardando quota para auditar.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReAuditBatch}
                    disabled={reAuditingBatch}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    title="Processar todos os atendimentos pendentes de auditoria por falta de quota"
                  >
                    {reAuditingBatch ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Auditando...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current text-amber-300" />
                        <span>Auditar Lote</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" /> Fila de Chamadas
              </span>
              <span className="ds-badge ds-badge-neutral">
                {filteredCalls.length} registros
              </span>
            </div>

            {/* Quick Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Operador, ID, Cliente..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="ds-input pl-9 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Parceiro (BPO)</label>
                  <select
                    value={selectedBpo}
                    onChange={(e) => setSelectedBpo(e.target.value)}
                    disabled={isBpoUser}
                    className="ds-select w-full h-[34px] py-1"
                  >
                    <option value="all">Ver Todos</option>
                    {availableBpos.map(bpo => <option key={bpo} value={bpo}>{bpo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Canal</label>
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    className="ds-select w-full h-[34px] py-1"
                  >
                    <option value="all">Todos Canais</option>
                    <option value="audio">Voz (Áudio)</option>
                    <option value="chat">Chat (WhatsApp)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sentimento</label>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    className="ds-select w-full h-[34px] py-1"
                  >
                    <option value="all">Todos</option>
                    <option value="Positivo">Positivo 😊</option>
                    <option value="Neutro">Neutro 😐</option>
                    <option value="Negativo">Negativo 😡</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status IA</label>
                  <select
                    value={auditStatusFilter}
                    onChange={(e) => setAuditStatusFilter(e.target.value)}
                    className="ds-select w-full h-[34px] py-1 font-semibold"
                  >
                    <option value="all">Todos Status</option>
                    <option value="completed">Concluídos IA</option>
                    <option value="pending">⚠️ Pendentes Quota</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BARRA DE AÇÕES EM LOTE E SELEÇÃO */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px] select-none">
                <input
                  type="checkbox"
                  checked={filteredCalls.length > 0 && selectedCallIds.length === filteredCalls.length}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Selecionar Todos ({filteredCalls.length})</span>
              </label>

              <div className="flex items-center gap-2">
                {selectedCallIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteSelected}
                    disabled={isDeletingBulk}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir Selecionados ({selectedCallIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearAllDatabase}
                  disabled={isDeletingBulk || interactions.length === 0}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-bold text-[10px] rounded-lg flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
                  title="Zerar / Limpar todo o banco de dados de auditoria"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" />
                  <span>Limpar Base ({interactions.length})</span>
                </button>
              </div>
            </div>

            {/* List Stream */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredCalls.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500">Nenhum atendimento na base de auditorias.</p>
                  <p className="text-[11px] text-slate-400 mt-1">O banco de dados está limpo ou nenhum item corresponde ao filtro.</p>
                </div>
              ) : (
                filteredCalls.map(item => {
                  const isSelected = item.id === activeCallId;
                  const isChecked = selectedCallIds.includes(item.id);
                  const scoreComputed = getCallScore(item);
                  const isPending = item.auditStatus === 'pending' || item.auditStatus === 'failed' || item.evaluation?.summary?.includes('[Pendente de IA]');

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectCall(item)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-2 relative ${
                        isSelected 
                          ? 'bg-indigo-50/60 border-indigo-500 shadow-xs' 
                          : isPending
                            ? 'bg-amber-50/30 hover:bg-amber-50/60 border-amber-200'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectId(item.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className={`text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-md leading-none ${
                            item.channel === 'audio' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                          }`}>
                            {item.channel.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold font-mono">ID: {item.id.substring(0, 8)}</span>
                        </div>

                      <div className="flex items-center gap-1">
                        {onDeleteCall && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCall(item.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md p-1 transition-all cursor-pointer"
                            title="Excluir Auditoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">{item.agentName}</h4>
                      <p className="text-[10px] text-slate-500 truncate font-semibold">Cliente: {piiMaskingActive ? maskCustomerName(item.customerName) : item.customerName}</p>
                    </div>

                    {/* Visual Progress Bar on Processing Card */}
                    {(reAuditingId === item.id || auditProgressMap[item.id]) && (
                      <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-lg space-y-1.5 shadow-xs animate-fade-in">
                        <div className="flex items-center justify-between text-[9px] font-mono font-black text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {auditProgressMap[item.id]?.stage || 'Auditando com IA...'}
                            </span>
                          </span>
                          <span className="text-indigo-700 font-extrabold shrink-0">
                            {auditProgressMap[item.id]?.percent || 25}%
                          </span>
                        </div>

                        {/* Bar graphics */}
                        <div className="w-full h-2 bg-indigo-150 rounded-full overflow-hidden border border-indigo-200">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${
                              auditProgressMap[item.id]?.status === 'error'
                                ? 'bg-rose-500'
                                : auditProgressMap[item.id]?.status === 'success'
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse'
                            }`}
                            style={{ width: `${auditProgressMap[item.id]?.percent || 25}%` }}
                          />
                        </div>

                        {auditProgressMap[item.id]?.error && (
                          <p className="text-[8.5px] font-semibold text-rose-700 truncate pt-0.5">
                            ⚠️ {auditProgressMap[item.id]?.error}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Pending Audit Warning Badge and Play Action */}
                    {isPending && !auditProgressMap[item.id] && reAuditingId !== item.id && (
                      <div className="p-2 bg-amber-100/70 border border-amber-250 rounded-lg flex items-center justify-between gap-2 text-amber-900">
                        <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Pendente de IA</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReAuditSingle(item.id);
                          }}
                          disabled={reAuditingId === item.id || reAuditingBatch}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9.5px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0 uppercase tracking-wider"
                          title="Rodar auditoria do Gemini para este atendimento"
                        >
                          <Play className="w-3 h-3 fill-current text-amber-300" />
                          <span>Auditar (Play)</span>
                        </button>
                      </div>
                    )}

                    {item.semanticSimilarity !== undefined && !isPending && (
                      <div className="p-1.5 bg-indigo-50/50 border border-indigo-100/30 rounded flex items-center justify-between text-[8px] font-black tracking-tight text-indigo-750 uppercase font-mono leading-none">
                        <span className="flex items-center gap-1">
                          <Network className="w-2.5 h-2.5 text-indigo-500 shrink-0 animate-pulse" />
                          Coesão Vetorial AI:
                        </span>
                        <span>{item.semanticSimilarity}% similar</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/70 text-[9px] text-slate-400 font-semibold">
                      <span>BPO: <strong className="text-slate-700 font-bold uppercase">{item.bpoName}</strong></span>
                      <div className="flex items-center gap-1.5">
                        <span>CSAT: <strong className="text-slate-700 font-bold">{item.csat}/5 ★</strong></span>
                        <span className={`ds-badge leading-none ${
                          isPending ? 'bg-amber-100 text-amber-800 border-amber-200 font-bold' : scoreComputed >= 85 ? 'ds-badge-success' : scoreComputed >= 70 ? 'ds-badge-warning' : 'ds-badge-danger'
                        }`}>
                          {isPending ? 'Pendente' : `${scoreComputed} pt`}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute right-2 top-1 w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    )}
                  </div>
                );
              }))}
            </div>
          </div>

          {/* COLUMN 2: ACTIVE CALL ANALYSIS REPORT (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {activeCall ? (
              <div className="ds-card p-5 space-y-4 flex flex-col text-left">
                
                {/* Active Pending Call Banner */}
                {(activeCall.auditStatus === 'pending' || activeCall.auditStatus === 'failed' || activeCall.evaluation?.summary?.includes('[Pendente de IA]')) && (
                  <div className="bg-amber-50 border-2 border-amber-250 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-left shadow-2xs">
                    <div className="flex items-start gap-2.5 flex-1">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                          Atendimento Capturado — Pendente de Auditoria Cognitiva de IA
                        </h4>
                        <p className="text-[11px] text-amber-850 leading-relaxed">
                          {activeCall.auditError || "O atendimento foi gravado e enviado para a Auditoria, mas a análise automática não foi concluída. Clique no botão ao lado para auditar quando houver quota."}
                        </p>

                        {/* Detail Banner Visual Progress Bar */}
                        {(reAuditingId === activeCall.id || auditProgressMap[activeCall.id]) && (
                          <div className="mt-2 p-2.5 bg-white/95 border border-indigo-200 rounded-lg space-y-1 shadow-xs">
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-indigo-900">
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                                {auditProgressMap[activeCall.id]?.stage || 'Auditando com IA...'}
                              </span>
                              <span className="text-indigo-700 font-black">{auditProgressMap[activeCall.id]?.percent || 25}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden border border-indigo-200">
                              <div 
                                className="h-full transition-all duration-300 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse"
                                style={{ width: `${auditProgressMap[activeCall.id]?.percent || 25}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReAuditSingle(activeCall.id)}
                      disabled={reAuditingId === activeCall.id || reAuditingBatch}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50 uppercase tracking-wider"
                    >
                      {reAuditingId === activeCall.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Auditando...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current text-amber-300" />
                          <span>Rodar Auditoria Agora</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* HUD HEADER COMPONENT */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-150">
                  <div className="text-left">
                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Laudo Consolidado Auto-QA</span>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">
                      {activeCall.agentName} • <span className="text-indigo-650">{activeCall.bpoName}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Nota Ajustada</span>
                      <strong className="text-2xl font-mono font-black text-indigo-750">{getCallScore(activeCall)}pt</strong>
                    </div>

                    {/* Toggle Mascaramento PII/LGPD */}
                    <button
                      type="button"
                      onClick={() => setPiiMaskingActive(!piiMaskingActive)}
                      className={`p-1 px-2.5 font-bold text-[10px] rounded transition-all flex items-center gap-1.5 border cursor-pointer ${
                        piiMaskingActive
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      }`}
                      title="Alternar visibilidade de dados sensíveis LGPD"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{piiMaskingActive ? 'Mascaramento PII: ON' : 'Mascaramento PII: OFF'}</span>
                    </button>

                    {/* Standard Full Screen Button */}
                    <button
                      type="button"
                      onClick={() => setIsFullScreen(true)}
                      className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Tela Cheia</span>
                    </button>
                  </div>
                </div>

                {/* KPI BLOCKS COMPLIANCE */}
                <div className={`grid grid-cols-2 ${activeCall.semanticSimilarity !== undefined ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-2.5`}>
                  {['Processo', 'Conhecimento', 'Sistemas', 'Experiência'].map(bName => {
                    const blockCompliance = getCallBlockScore(activeCall, bName);
                    return (
                      <div key={bName} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded">
                        <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider leading-none">{bName}</span>
                        <span className={`text-xs font-mono font-extrabold block mt-1 leading-none ${
                          blockCompliance >= 85 ? 'text-emerald-600' : blockCompliance >= 70 ? 'text-amber-500' : 'text-rose-600'
                        }`}>
                          {blockCompliance}% compliance
                        </span>
                      </div>
                    );
                  })}
                  {activeCall.semanticSimilarity !== undefined && (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded flex flex-col justify-between">
                      <span className="text-[8px] font-bold text-indigo-700 uppercase block tracking-wider leading-none flex items-center gap-1">
                        <Network className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        Coesão AI (Embeddings)
                      </span>
                      <span className="text-xs font-mono font-extrabold block mt-1 text-indigo-850 leading-none">
                        {activeCall.semanticSimilarity}% similaridade
                      </span>
                    </div>
                  )}
                </div>

                {/* COLLAPSIBLE ACCORDION FOR DIALOGUE OR METHODOLOGY */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  
                  {/* Left Column: Direct Transcription with Select actions (7 cols) */}
                  <div className="xl:col-span-7 bg-white border border-slate-200 p-3 rounded flex flex-col space-y-3 shadow-inner max-h-[500px] overflow-y-auto">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 leading-none">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                        Anotações do Chat / Diálogo
                      </span>
                    </div>

                    <p className="text-[9px] text-slate-400 leading-normal">
                      👇 <strong>Dica do Supervisor:</strong> Duplo clique em qualquer caixa de diálogo do atendente operador para customizar desvios humanos ou overrides rápidos de IA.
                    </p>

                    <div className="space-y-3.5">
                      {renderTranscriptionList()}
                    </div>
                  </div>

                  {/* Right Column: IA Checklist Audit Indicators (5 cols) */}
                  <div className="xl:col-span-5 space-y-4">
                    
                    {/* Compliance Checklist status */}
                    <div className="bg-slate-50/50 border border-slate-200 p-3 rounded space-y-2.5 text-left">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-1.5 leading-none">
                        <ListTodo className="w-3.5 h-3.5 text-indigo-500" />
                        Checklist Unificado da Metodologia
                      </h4>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {guiaItens.map(item => {
                          const status = getListItemStatus(activeCall, item);
                          const isJustificationOpen = status === 'violado' && activeJustificationItemId === item.id;
                          return (
                            <div key={item.id} className={`flex flex-col p-2 bg-white border rounded text-[10px] gap-1.5 transition-all ${
                              status === 'violado' ? 'border-rose-200 shadow-3xs' : 'border-slate-150'
                            }`}>
                              <div 
                                className="flex-1 cursor-pointer select-none group"
                                onClick={() => {
                                  if (status === 'violado') {
                                    setActiveJustificationItemId(activeJustificationItemId === item.id ? null : item.id);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-extrabold text-slate-850 leading-tight block group-hover:text-indigo-600 transition-colors">
                                    {item.motivoSimplificado}
                                  </span>
                                  {status === 'violado' && (
                                    <span className="text-[7.5px] font-black text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-100 flex items-center gap-0.5 shrink-0 select-none">
                                      <Info className="w-2.5 h-2.5" />
                                      Laudo
                                    </span>
                                  )}
                                </div>
                                <span className="text-[8.5px] text-slate-400 font-mono block mt-0.5">Penalidade: -{item.scorePenalidade} pts</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleChecklistStatus(activeCall.id, item.id, 'conforme')}
                                  className={`px-2 py-0.5 rounded text-[8.5px] font-bold border transition-all cursor-pointer ${
                                    status === 'conforme'
                                      ? 'bg-emerald-50 border-emerald-250 text-emerald-700 shadow-3xs font-extrabold'
                                      : 'bg-slate-50 border-slate-150 text-slate-400 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  Conforme
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    toggleChecklistStatus(activeCall.id, item.id, 'violado');
                                  }}
                                  className={`px-2 py-0.5 rounded text-[8.5px] font-bold border transition-all cursor-pointer ${
                                    status === 'violado'
                                      ? 'bg-rose-50 border-rose-250 text-rose-700 shadow-3xs font-extrabold'
                                      : 'bg-slate-50 border-slate-150 text-slate-400 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  Violado
                                </button>
                              </div>

                              {/* Caixa de Justificativa com suporte a edição */}
                              {status === 'violado' && isJustificationOpen && (
                                <div className="mt-1.5 p-2 bg-rose-50/70 border border-rose-150 rounded text-[9.5px] text-rose-950 space-y-1.5">
                                  <div className="font-extrabold flex items-center gap-1 text-rose-950 uppercase tracking-wider text-[8px] leading-none mb-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                    Justificativa do Desvio:
                                  </div>
                                  <p className="italic leading-normal text-rose-900 bg-white/70 p-1.5 rounded border border-rose-100">
                                    "{getViolationJustification(activeCall, item)}"
                                  </p>
                                  <div className="flex flex-col gap-1.5 mt-2 pt-1 border-t border-rose-100/50">
                                    <span className="text-[7.5px] font-black text-rose-850 uppercase tracking-wide">Ajustar justificativa manualmente:</span>
                                    <input
                                      type="text"
                                      value={editableJustifications[activeCall.id]?.[item.id] !== undefined ? editableJustifications[activeCall.id][item.id] : getViolationJustification(activeCall, item)}
                                      onChange={(e) => updateViolationJustification(activeCall.id, item.id, e.target.value)}
                                      placeholder="Ex: Não seguiu o Book oficial das Empresa..."
                                      className="w-full px-2 py-1 text-[8.5px] bg-white border border-rose-200 rounded text-slate-850 focus:outline-none focus:border-rose-400 font-sans shadow-2xs"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI report justification summary */}
                    <div className="bg-slate-50 p-3 border border-slate-200 rounded space-y-1 text-left">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1 leading-none">
                        <Sparkles className="w-3.5 h-3.5" />
                        Parecer IA de Auto-QA
                      </span>
                      <p className="text-[10px] text-slate-600 font-mono leading-relaxed mt-1">{activeCall.evaluation.summary}</p>
                    </div>

                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 rounded border border-dashed border-slate-200 py-32 text-center text-slate-400 flex flex-col justify-center items-center lg:h-full">
                <PhoneCall className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">Selecione um Atendimento</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm px-6">Escolha um item de ligação na fila de chamadas à esquerda para visualizar laudos, transcrições analíticas e customizar penalidades de qualidade.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB-VIEW 2: CONFRONTO & MESA DE CALIBRAÇÃO (CALIBRATION BOARD) */}
      {activeSubTab === 'confronto' && (
        <div className="space-y-4">
          
          {/* Top Panel: Calibration Metrics Dashboard */}
          <div className="ds-card p-5 bg-white border border-slate-200 text-slate-800 shadow-3xs overflow-hidden relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-2 text-slate-900">
                <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Painel Executivo de Alinhamento e Calibração</h2>
              </div>
              <button
                onClick={loadCalibracaoData}
                disabled={loadingCalibracao}
                className="ds-btn-secondary py-1.5 px-3 text-[10px] uppercase font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCalibracao ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            
            <p className="text-[11px] text-slate-450 mt-2.5 leading-relaxed text-left font-medium">
              O motor regulatório do Auto-QA cruza as notas de auditoria geradas pela Inteligência Artificial contra as notas registradas nas monitorias físicas (humanas) dos BPOs. Mantemos acompanhamento em tempo real para auditorias alinhadas (limiar regulamentar oficial de desvio de no máximo 10 pontos).
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4.5">
              <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-lg text-left shadow-3xs">
                <span className="block text-[9px] text-amber-700 font-extrabold uppercase tracking-wider mb-0.5">Assertividade IA/Humana</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-mono font-black text-amber-800">{calibrationStats.assertividadePercent}%</span>
                </div>
                <span className="text-[8px] text-amber-600 font-semibold uppercase tracking-wider">Margem limite de ±10 pts</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-left shadow-3xs">
                <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-0.5">Interações Cruzadas</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-mono font-black text-slate-800">{calibrationStats.totalCorrelacionados}</span>
                </div>
                <span className="text-[8px] text-slate-405 font-semibold uppercase tracking-wider">Ligações Relacionadas</span>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-200 p-3.5 rounded-lg text-left shadow-3xs">
                <span className="block text-[9px] text-indigo-700 font-extrabold uppercase tracking-wider mb-0.5">Score Média Robô (Auto-QA)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-mono font-black text-indigo-800">{calibrationStats.mediaScoreAutoQA}</span>
                  <span className="text-[10px] text-indigo-500 font-bold">/100 pts</span>
                </div>
                <span className="text-[8px] text-indigo-600 font-semibold uppercase tracking-wider">Média IA totalizada</span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-lg text-left shadow-3xs">
                <span className="block text-[9px] text-emerald-700 font-extrabold uppercase tracking-wider mb-0.5">Média Físico (Humano)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-mono font-black text-emerald-800">{calibrationStats.mediaScoreTradicional}</span>
                  <span className="text-[10px] text-emerald-500 font-bold">/100 pts</span>
                </div>
                <span className="text-[8px] text-emerald-600 font-semibold uppercase tracking-wider">Média BPO tradicional</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMN 1: SPREADSHEET DROP & MAPPING FORM (5 cols) */}
            <div className="lg:col-span-5 ds-card p-5 space-y-4 text-left">
              <div className="border-b border-indigo-50 pb-2">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Registrar Planilha de Monitoria Física</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Suba relatórios tradicionais ou planilhas de calibragem do supervisor para correlacionar com notas IA.</span>
              </div>

              {/* Drag and drop Area */}
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all bg-slate-50/50 relative ${
                  isDragging ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-400 mb-1'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="spreadsheet-file-upload"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <span className="block text-xs font-bold text-slate-700">Arraste a planilha ou clique para selecionar</span>
                <span className="block text-[9px] text-slate-400 mt-1 font-mono">Aceita arquivos .CSV Delimitados por vírgula ou ponto-e-vírgula</span>
              </div>

              {/* MAPPINGS INTERACTIVE FORM CARD (TRIGGERS DYNAMICALLY AFTER PARSING SPREADSHEET HEADERS) */}
              {rawHeaders.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">Mapeamento Conversor de Colunas</span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal">
                    Identificamos <strong>{rawRows.length}</strong> registros. Vincule de qual parceiro pertencem, e aponte as colunas correspondentes:
                  </p>

                  <div className="space-y-3 text-xs text-slate-600">
                    {/* 1. BPO Selection */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Vincular Prestadora (BPO) desta Monitoria</span>
                      <select
                        value={mappingBpo}
                        onChange={(e) => setMappingBpo(e.target.value)}
                        className="ds-select w-full"
                      >
                        {bpos.map(bpo => <option key={bpo} value={bpo}>{bpo}</option>)}
                      </select>
                    </div>

                    {/* 2. Call ID Select */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Coluna do ID de Ligação (Chave de Pareamento)*</span>
                      <select
                        value={mappingIdCol}
                        onChange={(e) => setMappingIdCol(e.target.value)}
                        className="ds-select w-full"
                      >
                        <option value="">-- Escolher Coluna --</option>
                        {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    {/* 3. Rating Score Select */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Coluna da Nota de Monitoria/Score (Confronto)*</span>
                      <select
                        value={mappingScoreCol}
                        onChange={(e) => setMappingScoreCol(e.target.value)}
                        className="ds-select w-full"
                      >
                        <option value="">-- Escolher Coluna --</option>
                        {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    {/* 4. Mapping value calculation option */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Formato de Escala de Pontos da Coluna</span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setMappingScoreType("direct_score")}
                          className={`p-2 rounded-lg border text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                            mappingScoreType === "direct_score"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-3xs"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          Nota Final (0 a 100)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMappingScoreType("deduction")}
                          className={`p-2 rounded-lg border text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                            mappingScoreType === "deduction"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-3xs"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          Dedução / Penalização
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteMappingAndUpload}
                    disabled={isUploading || !mappingIdCol || !mappingScoreCol}
                    className="w-full mt-2 inline-flex items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs border-none"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                        <span>Mapeando, calibrando e salvando...</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 mr-1.5" />
                        <span>Processar e Confrontar</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Feedbacks of upload */}
              {fileError && <p className="p-2 bg-rose-50 border border-rose-150 text-rose-700 text-[10px] rounded font-bold leading-normal">{fileError}</p>}
              {fileSuccess && <p className="p-2 bg-emerald-50 border border-emerald-150 text-emerald-800 text-[10px] rounded font-bold leading-normal">{fileSuccess}</p>}
            </div>

            {/* COLUMN 2: ALIGNED CORRELATIONS GRID (7 cols) */}
            <div className="lg:col-span-7 ds-card p-5 space-y-4 text-left">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider block">Confrontos e Pareceres de Calibração</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Relações de monitoria IA contra monitoria supervisor. Selecione um para abrir a mesa de mediação.</span>
                </div>
                <span className="text-[10.5px] font-mono text-indigo-650 font-black">{confrontos.length} pareamentos</span>
              </div>

              {/* Horizontal List Stream */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {confrontos.map(item => {
                  const isS = selectedConfronto?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedConfronto(item)}
                      className={`p-3 rounded border cursor-pointer text-left transition-all relative flex flex-col justify-between space-y-2 ${
                        isS 
                          ? 'border-indigo-500 bg-indigo-50/10 shadow-3xs' 
                          : 'border-slate-150 bg-slate-50/30 hover:bg-slate-55'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] font-bold text-slate-400 font-mono">Ligação ID: {item.id.substring(0, 8)}</span>
                        <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded leading-none ${
                          item.statusCalibracao === 'Calibrado' 
                            ? 'bg-emerald-50 text-emerald-800' 
                            : 'bg-rose-50 text-rose-800'
                        }`}>
                          {item.statusCalibracao}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <strong className="text-[11px] font-black text-slate-850 block truncate uppercase">{item.operador}</strong>
                        <span className="text-[9.5px] text-slate-400 block font-semibold truncate leading-none">BPO: {item.bpo}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/50 text-[10px] text-center font-bold">
                        <div className="bg-indigo-50/50 p-1 rounded">
                          <span className="block text-[7.5px] text-indigo-600 uppercase tracking-widest leading-none font-black">Score Robô</span>
                          <strong className="text-indigo-850 font-mono block mt-1">{item.scoreAutoQA}</strong>
                        </div>
                        <div className="bg-slate-100 p-1 rounded">
                          <span className="block text-[7.5px] text-slate-600 uppercase tracking-widest leading-none font-bold">Score Supervisor</span>
                          <strong className="text-slate-800 font-mono block mt-1">{item.scoreTradicional}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {confrontos.length === 0 && (
                  <div className="md:col-span-2 text-center py-12 text-slate-400 italic text-[11px]">
                    Nenhum atendimento confrontado. Suba a planilha acima para vincular e mapear.
                  </div>
                )}
              </div>

              {/* MEDIATION PANEL - MESA DE CALIBRAÇÃO DETAILED BLOCK */}
              {selectedConfronto && (
                <div className="border border-indigo-150 bg-indigo-50/5 p-4 rounded-lg mt-4 text-left space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-black uppercase text-indigo-950 tracking-wider">Mesa de Calibração • ID {selectedConfronto.id.substring(0, 8)}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedConfronto(null)}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-100/50 border border-slate-200 p-2.5 rounded text-[10px] space-y-0.5 font-sans">
                      <span className="block text-[8px] font-black text-slate-450 uppercase mb-1 leading-none">Dados Pareados</span>
                      <div>Operador: <strong>{selectedConfronto.operador}</strong></div>
                      <div>Consumidor: <strong>{piiMaskingActive ? maskCustomerName(selectedConfronto.customerName || "Não Informado") : (selectedConfronto.customerName || "Não Informado")}</strong></div>
                      <div>BPO: <strong>{selectedConfronto.bpo}</strong></div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 p-2 bg-indigo-50/70 border border-indigo-150 rounded text-center">
                        <span className="block text-[8px] text-indigo-600 font-black uppercase tracking-wider">Robô Auto-QA</span>
                        <strong className="text-xl font-black text-indigo-800">{selectedConfronto.scoreAutoQA}</strong>
                      </div>
                      <div className="flex-1 p-2 bg-emerald-50/70 border border-emerald-150 rounded text-center">
                        <span className="block text-[8px] text-emerald-600 font-black uppercase tracking-wider">Humano Tradicional</span>
                        <strong className="text-xl font-black text-emerald-800">{selectedConfronto.scoreTradicional}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Summary Comparison */}
                  <div className="space-y-1 bg-yellow-50/55 border border-yellow-150 p-2.5 rounded text-[10px]">
                    <span className="block text-[8.5px] text-yellow-750 font-black uppercase tracking-wider flex items-center gap-1 leading-none">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" /> Parecer Executivo de Calibração:
                    </span>
                    <p className="text-yellow-900 font-bold leading-relaxed">{selectedConfronto.parecerCalibracao}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[8px] text-indigo-600 font-black uppercase tracking-wider">Parecer Auto-QA (IA):</span>
                    <p className="bg-indigo-50/20 border border-indigo-100 p-2 rounded text-slate-700 text-[10px] font-mono leading-relaxed">
                      "{selectedConfronto.justificativaIA}"
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* --- RE-AUDIT INTERATIVE TELA CHEIA OVERLAY --- */}
      {isFullScreen && activeCall && (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col text-slate-800 animate-fade-in font-sans">
          
          {/* HUD Top Bar */}
          <div className="bg-white border-b border-slate-200 p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs text-left">
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1 px-2.5 bg-indigo-600 text-white rounded text-[9.5px] font-sans font-black uppercase tracking-wider shadow-sm animate-pulse leading-none">
                  Modo Auditoria Tela Cheia
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none">Laudo ID: {activeCall.id}</span>
              </div>
              <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider mt-1.5 font-sans">
                Análise de Conformidade e Evidências • <span className="text-indigo-650 underline font-extrabold">{activeCall.agentName} ({activeCall.bpoName})</span>
              </h1>
            </div>

            <div className="flex items-center gap-5 justify-between shrink-0">
              <div className="text-left md:text-right">
                <span className="text-[9px] text-slate-400 block uppercase font-black tracking-widest leading-none">Score Metodológico Final</span>
                <div className="flex items-baseline mt-1 justify-start md:justify-end">
                  <span className="text-3xl font-mono font-black text-indigo-650 leading-none">{getCallScore(activeCall)}</span>
                  <span className="text-xs text-slate-500 font-semibold ml-0.5">/ 100 pt</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFullScreen(false)}
                className="p-2.5 px-4 bg-slate-150 hover:bg-slate-200 text-slate-700 border border-slate-255 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Minimize2 className="w-4 h-4 text-indigo-650" />
                <span>Fechar Tela Cheia</span>
              </button>
            </div>
          </div>

          {/* Grid Area */}
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 max-w-full p-4 md:p-6 gap-6 bg-slate-50 overflow-hidden min-h-0">
            {/* Left Area: Transcript */}
            <div className="xl:col-span-7 bg-white border border-slate-200 shadow-3xs rounded p-4 flex flex-col h-full overflow-hidden min-h-0 relative text-left">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3 shrink-0">
                <div className="flex items-center gap-2 text-slate-900">
                  <FileText className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Anotações da Conversa</h3>
                </div>
                <span className="text-[9px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                  Double Click para Auditorar canais do OP
                </span>
              </div>

              <p className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-150 mt-2 leading-relaxed">
                👉 <strong>Auditor:</strong> Caso identifique que a IA cometeu algum equívoco interpretativo, clique em <strong>Anular Desvio</strong> nos balões correspondentes. Para adicionar uma divergência humana, clique duas vezes nas falas do operador.
              </p>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 shadow-inner mt-4 min-h-0">
                {renderTranscriptionList()}
              </div>
            </div>

            {/* Right Area */}
            <div className="xl:col-span-5 flex flex-col gap-4 h-full overflow-hidden min-h-0 text-left">
              <div className="bg-white border border-slate-200 shadow-3xs p-4 rounded shrink-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Indicadores de Qualidade Atuais</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {['Processo', 'Conhecimento', 'Sistemas', 'Experiência'].map(bName => {
                    const bScore = getCallBlockScore(activeCall, bName);
                    return (
                      <div key={bName} className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <span className="block text-[8px] text-slate-450 font-black uppercase tracking-wider leading-none">{bName}</span>
                        <span className={`text-xs font-mono font-extrabold block mt-1.5 leading-none ${
                          bScore >= 85 ? 'text-emerald-600' : bScore >= 70 ? 'text-amber-500' : 'text-rose-600'
                        }`}>
                          {bScore}% compliance
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 shadow-3xs rounded p-4 flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="flex items-center justify-between border-b border-slate-150 pb-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-slate-900">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Diretrizes Auditadas da Metodologia</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-2.5 min-h-0 pb-1">
                  <div className="border border-slate-200 rounded divide-y divide-slate-150">
                    {guiaItens.map(item => {
                      const status = getListItemStatus(activeCall, item);
                      const isJustificationOpen = status === 'violado' && activeJustificationItemId === item.id;
                      return (
                        <div key={item.id} className="flex flex-col p-2.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex-1 pr-2 cursor-pointer select-none group"
                              onClick={() => {
                                if (status === 'violado') {
                                  setActiveJustificationItemId(activeJustificationItemId === item.id ? null : item.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800 block line-clamp-1 leading-tight group-hover:text-indigo-600 transition-colors">
                                  {item.motivoSimplificado}
                                </span>
                                {status === 'violado' && (
                                  <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center gap-0.5 shrink-0 select-none">
                                    <Info className="w-3 h-3" />
                                    Laudo
                                  </span>
                                )}
                              </div>
                              <span className="text-[9.5px] text-slate-400 font-mono">Penalidade: -{item.scorePenalidade} pts</span>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleChecklistStatus(activeCall.id, item.id, 'conforme')}
                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-all cursor-pointer ${
                                  status === 'conforme'
                                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700 shadow-3xs font-extrabold'
                                    : 'bg-slate-50 border-slate-150 text-slate-400 hover:bg-slate-100 font-medium'
                                }`}
                              >
                                Conforme
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  toggleChecklistStatus(activeCall.id, item.id, 'violado');
                                }}
                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-all cursor-pointer ${
                                  status === 'violado'
                                    ? 'bg-rose-50 border-rose-250 text-rose-700 shadow-3xs font-extrabold'
                                    : 'bg-slate-50 border-slate-150 text-slate-400 hover:bg-slate-100 font-medium'
                                }`}
                              >
                                Violado
                              </button>
                            </div>
                          </div>

                          {/* Caixa de Justificativa com suporte a edição */}
                          {status === 'violado' && isJustificationOpen && (
                            <div className="mt-2.5 p-3 bg-rose-50/70 border border-rose-150 rounded text-[10px] text-rose-950 space-y-2">
                              <div className="font-extrabold flex items-center gap-1 text-rose-950 uppercase tracking-wider text-[8.5px] leading-none mb-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                Justificativa do Desvio:
                              </div>
                              <p className="italic leading-relaxed text-rose-900 bg-white/70 p-2.5 rounded border border-rose-100">
                                "{getViolationJustification(activeCall, item)}"
                              </p>
                              <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-rose-100/50">
                                <span className="text-[8px] font-black text-rose-850 uppercase tracking-wide">Ajustar justificativa manualmente:</span>
                                <input
                                  type="text"
                                  value={editableJustifications[activeCall.id]?.[item.id] !== undefined ? editableJustifications[activeCall.id][item.id] : getViolationJustification(activeCall, item)}
                                  onChange={(e) => updateViolationJustification(activeCall.id, item.id, e.target.value)}
                                  placeholder="Modificar justificativa da infração..."
                                  className="w-full px-2.5 py-1.5 text-[9px] bg-white border border-rose-200 rounded text-slate-850 focus:outline-none focus:border-rose-400 font-sans shadow-2xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- POPUP DIALOG FORM: CONFIGURE PENALTY --- */}
      {penaltyModal && activeCall && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded shadow-lg max-w-md w-full p-5 text-left animate-fade-in relative font-sans text-slate-800">
            <button
              onClick={() => setPenaltyModal(null)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 animate-bounce" />
              <span>Declarar Evidência de Divergência</span>
            </h3>

            <div className="mt-3 space-y-3.5 text-xs text-slate-600">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passagem Identificada (Evidência)</span>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-250 rounded p-2 text-xs text-slate-800 placeholder-slate-405 focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Causa Raiz de Infração</span>
                <select
                  value={selectedGuideItemId}
                  onChange={(e) => handleGuideItemSelectionChange(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded p-1.5 text-xs text-slate-805 focus:ring-1 focus:ring-indigo-500 font-sans font-bold"
                >
                  <option value="">-- Selecionar desvio do guia de erros --</option>
                  {guiaItens.map(gi => (
                    <option key={gi.id} value={gi.id}>
                      [{gi.bloco}] {gi.motivoSimplificado} (-{gi.scorePenalidade} pts)
                    </option>
                  ))}
                  <option value="custom">Outro desvio livre...</option>
                </select>
              </div>

              {selectedGuideItemId === "custom" && (
                <div className="animate-fade-in">
                  <span className="block text-[9px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Descrever o Desvio Manual</span>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Ex: Falha em demonstrar escuta cortês..."
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metodologia pilar</span>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as any)}
                    disabled={selectedGuideItemId !== "custom" && selectedGuideItemId !== ""}
                    className="w-full bg-slate-50 disabled:opacity-80 border border-slate-250 rounded p-1.5 text-xs text-slate-705 font-bold focus:ring-1"
                  >
                    <option value="Experiência">Experiência</option>
                    <option value="Processo">Processo</option>
                    <option value="Conhecimento">Conhecimento</option>
                    <option value="Sistemas">Sistemas</option>
                  </select>
                </div>

                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Impacto de Score</span>
                  <select
                    value={customScore}
                    onChange={(e) => setCustomScore(Number(e.target.value))}
                    disabled={selectedGuideItemId !== "custom" && selectedGuideItemId !== ""}
                    className="w-full bg-slate-50 disabled:opacity-80 border border-slate-250 rounded p-1.5 text-xs text-slate-705 font-bold focus:ring-1"
                  >
                    <option value={5}>-5 pontos (Leve)</option>
                    <option value={10}>-10 pontos (Intermediária)</option>
                    <option value={15}>-15 pontos (Esperada)</option>
                    <option value={20}>-20 pontos (Severa)</option>
                    <option value={30}>-30 pontos (Crítica)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPenaltyModal(null)}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomPenalty}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
              >
                Registrar Penalidade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Clear Base & Bulk Delete */}
      {confirmModalState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{confirmModalState.title}</h3>
                <p className="text-[11px] text-slate-400 font-mono">Ação destrutiva no banco de dados</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {confirmModalState.message}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalState(null)}
                disabled={isDeletingBulk}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                disabled={isDeletingBulk}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {isDeletingBulk ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
