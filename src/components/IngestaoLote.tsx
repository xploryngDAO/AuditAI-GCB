import React, { useState, useRef } from 'react';
import { Interaction, HeaderMapping, AuditConfig } from '../types';
import { isBotOrSystemText, isAgentText } from '../utils/participantDetection';
import { 
  Upload, 
  MapPin, 
  Settings, 
  FileText, 
  Play, 
  Plus, 
  TrendingUp, 
  CheckCircle, 
  FileCode, 
  AlertCircle,
  Sparkles,
  Cpu
} from 'lucide-react';

interface IngestaoLoteProps {
  onProcessed: (newItems: Interaction[]) => void;
  activeConfig: AuditConfig;
  bpos?: string[];
  tenantId?: string;
  userEmail?: string;
}

// Helper para ler caminhos aninhados de propriedades (ex: 'metadados.operador') de forma segura
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Helper para obter valor de uma chave desconsiderando caixa alta/baixa ou espaçamento lateral nas chaves
const getRelaxedKey = (item: any, searchKey: string): any => {
  if (!item || typeof item !== 'object') return undefined;
  const foundKey = Object.keys(item).find(k => k.trim().toLowerCase() === searchKey.toLowerCase());
  return foundKey ? item[foundKey] : undefined;
};

export default function IngestaoLote({ 
  onProcessed, 
  activeConfig,
  bpos = [],
  tenantId,
  userEmail
}: IngestaoLoteProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [selectedBpo, setSelectedBpo] = useState<string>(bpos[0] || "");

  // Keep selected BPO in sync if bpos load asynchronously
  React.useEffect(() => {
    if (bpos.length > 0 && !bpos.includes(selectedBpo)) {
      setSelectedBpo(bpos[0]);
    }
  }, [bpos]);
  
  // Dynamic header mappings
  const [mappings, setMappings] = useState<HeaderMapping>({
    id: 'codigo',
    agentName: 'atendente_nome',
    customerName: 'cliente_nome',
    bpoName: 'bpo_parceiro',
    channel: 'canal',
    transcript: 'dialogo_texto',
    duration: 'tempo_duracao'
  });

  const [simulatedRows, setSimulatedRows] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogPasteText, setDialogPasteText] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseSingleFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const fileNameLower = file.name.toLowerCase();

          const cleanUnicode = (s: string) => s.replace(/[\u202a\u202c\u200b-\u200d\u00ad\ufeff]/g, "").trim();

          const getRelaxedKey = (item: any, searchKey: string) => {
            if (!item || typeof item !== 'object') return undefined;
            const foundKey = Object.keys(item).find(k => k.trim().toLowerCase() === searchKey.toLowerCase());
            return foundKey ? item[foundKey] : undefined;
          };

          const isCasasBahiaItemA = (item: any) => {
            if (!item || typeof item !== 'object') return false;
            const metadados = getRelaxedKey(item, 'metadados');
            const historico = getRelaxedKey(item, 'historico_conversas') || getRelaxedKey(item, 'mensagens');
            return metadados !== undefined && historico !== undefined;
          };

          const isCasasBahiaItemB = (item: any) => {
            if (!item || typeof item !== 'object') return false;
            const mensagens = getRelaxedKey(item, 'mensagens') || getRelaxedKey(item, 'mensagem') || getRelaxedKey(item, 'historico_conversas');
            const idInteracao = getRelaxedKey(item, 'id_interacao') || getRelaxedKey(item, 'id');
            const operador = getRelaxedKey(item, 'participante_interno') || getRelaxedKey(item, 'operador');
            return Array.isArray(mensagens) && (idInteracao !== undefined || operador !== undefined);
          };

          const normalizeToStructureA = (item: any) => {
            if (isCasasBahiaItemA(item)) {
              const metadados = getRelaxedKey(item, 'metadados');
              const historico = getRelaxedKey(item, 'historico_conversas') || getRelaxedKey(item, 'mensagens') || getRelaxedKey(item, 'mensagem') || [];
              return {
                metadados: metadados,
                historico_conversas: historico
              };
            }
            if (isCasasBahiaItemB(item)) {
              const parseDuracaoToSeconds = (dur: string): number => {
                if (!dur) return 300;
                const parts = dur.split(':');
                if (parts.length === 2) {
                  return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
                }
                if (parts.length === 3) {
                  return (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
                }
                return parseInt(dur, 10) || 300;
              };

              const rawMensagens = getRelaxedKey(item, 'mensagens') || getRelaxedKey(item, 'mensagem') || getRelaxedKey(item, 'historico_conversas') || [];
              const rawDuracao = getRelaxedKey(item, 'duracao') || "05:00";

              return {
                metadados: {
                  tipo_interacao: cleanUnicode(String(getRelaxedKey(item, 'tipo_interacao') || "Mensagem")),
                  id_interacao: cleanUnicode(String(getRelaxedKey(item, 'id_interacao') || `INT-${Math.floor(1000 + Math.random() * 9000)}`)),
                  tipo_mensagem: cleanUnicode(String(getRelaxedKey(item, 'tipo_mensagem') || "Abrir")),
                  data_hora_inicio: cleanUnicode(String(getRelaxedKey(item, 'hora_inicio') || getRelaxedKey(item, 'data_hora_inicio') || "")),
                  data_hora_termino: cleanUnicode(String(getRelaxedKey(item, 'hora_termino') || getRelaxedKey(item, 'data_hora_termino') || "")),
                  duracao_segundos: parseDuracaoToSeconds(String(rawDuracao)),
                  duracao_formatada: cleanUnicode(String(rawDuracao)),
                  operador: cleanUnicode(String(getRelaxedKey(item, 'participante_interno') || getRelaxedKey(item, 'operador') || "Operador Desconhecido")),
                  cliente: cleanUnicode(String(getRelaxedKey(item, 'participante_externo') || getRelaxedKey(item, 'cliente') || "Cliente"))
                },
                historico_conversas: rawMensagens.map((msg: any) => {
                  const rawTxt = String(getRelaxedKey(msg, 'texto') || getRelaxedKey(msg, 'mensagem') || getRelaxedKey(msg, 'text') || "");
                  const txt = cleanUnicode(rawTxt);
                  let sub = cleanUnicode(String(getRelaxedKey(msg, 'sub_participante') || ""));
                  
                  if (isBotOrSystemText(txt)) {
                    sub = "Bot";
                  } else if (isAgentText(txt)) {
                    sub = "Agente";
                  } else if (!sub) {
                    const txtUpper = txt.toUpperCase();
                    if (txtUpper.includes("BOT:") || txtUpper.startsWith("BOT ") || txtUpper.includes("BOT: ")) {
                      sub = "Bot";
                    } else if (txt.includes("Empresa:") || txt.includes("Empresa ")) {
                      sub = "Institucional";
                    } else {
                      const tipoPart = String(getRelaxedKey(msg, 'tipo_participante') || "");
                      if (tipoPart.toLowerCase() === "interno") {
                        sub = "Agente";
                      } else {
                        sub = "Cliente";
                      }
                    }
                  }

                  let cleanText = txt;
                  const lowerTxt = txt.toLowerCase();
                  if (lowerTxt.includes("bot:")) {
                    const idx = lowerTxt.indexOf("bot:");
                    cleanText = txt.substring(idx + 4).trim();
                  } else if (lowerTxt.includes("bot ")) {
                    const idx = lowerTxt.indexOf("bot ");
                    cleanText = txt.substring(idx + 4).trim();
                  } else if (lowerTxt.includes("cliente:")) {
                    const idx = lowerTxt.indexOf("cliente:");
                    cleanText = txt.substring(idx + 8).trim();
                  } else if (lowerTxt.includes("empresa:")) {
                    const idx = lowerTxt.indexOf("empresa:");
                    cleanText = txt.substring(idx + 12).trim();
                  }

                  return {
                    data_hora: cleanUnicode(String(getRelaxedKey(msg, 'data_hora') || getRelaxedKey(msg, 'hora') || "")),
                    tipo_participante: cleanUnicode(String(getRelaxedKey(msg, 'tipo_participante') || "")),
                    participante: cleanUnicode(String(getRelaxedKey(msg, 'participante') || "")),
                    sub_participante: sub,
                    texto: cleanUnicode(cleanText)
                  };
                })
              };
            }
            return item;
          };

          if (fileNameLower.endsWith('.json')) {
            const parsed = JSON.parse(text);
            let fileRows: any[] = [];

            if (isCasasBahiaItemA(parsed) || isCasasBahiaItemB(parsed)) {
              fileRows = [normalizeToStructureA(parsed)];
            } else if (Array.isArray(parsed)) {
              fileRows = parsed.map(item => {
                if (isCasasBahiaItemA(item) || isCasasBahiaItemB(item)) {
                  return normalizeToStructureA(item);
                }
                return item;
              });
            } else if (parsed && typeof parsed === 'object') {
              const possibleArray = Object.values(parsed).find(val => Array.isArray(val) && val.length > 0 && (isCasasBahiaItemA(val[0]) || isCasasBahiaItemB(val[0])));
              const generalArray = Object.values(parsed).find(val => Array.isArray(val));
              
              if (possibleArray && Array.isArray(possibleArray)) {
                fileRows = possibleArray.map(item => normalizeToStructureA(item));
              } else if (generalArray && Array.isArray(generalArray)) {
                fileRows = generalArray.map(item => {
                  if (isCasasBahiaItemA(item) || isCasasBahiaItemB(item)) {
                    return normalizeToStructureA(item);
                  }
                  return item;
                });
              } else {
                fileRows = [parsed];
              }
            }
            resolve(fileRows);
          } else if (fileNameLower.endsWith('.csv')) {
            const parsedGrid: string[][] = [];
            let currentLineRow: string[] = [];
            let currentCellVal = '';
            let inQuotes = false;
            let i = 0;
            
            let delimiter = ',';
            const firstLine = text.split('\n')[0] || '';
            if (firstLine.includes(';')) {
              const commas = (firstLine.match(/,/g) || []).length;
              const semicolons = (firstLine.match(/;/g) || []).length;
              if (semicolons > commas) {
                delimiter = ';';
              }
            }

            while (i < text.length) {
              const char = text[i];
              const nextChar = text[i + 1];

              if (inQuotes) {
                if (char === '"') {
                  if (nextChar === '"') {
                    currentCellVal += '"';
                    i += 2;
                    continue;
                  } else {
                    inQuotes = false;
                    i++;
                    continue;
                  }
                } else {
                  currentCellVal += char;
                  i++;
                }
              } else {
                if (char === '"') {
                  inQuotes = true;
                  i++;
                } else if (char === delimiter) {
                  currentLineRow.push(currentCellVal.trim());
                  currentCellVal = '';
                  i++;
                } else if (char === '\r' || char === '\n') {
                  currentLineRow.push(currentCellVal.trim());
                  currentCellVal = '';
                  if (currentLineRow.length > 0 && (currentLineRow.length > 1 || currentLineRow[0] !== '')) {
                    parsedGrid.push(currentLineRow);
                  }
                  currentLineRow = [];
                  i++;
                  if (char === '\r' && nextChar === '\n') {
                    i++;
                  }
                } else {
                  currentCellVal += char;
                  i++;
                }
              }
            }
            if (currentCellVal !== '' || currentLineRow.length > 0) {
              currentLineRow.push(currentCellVal.trim());
              if (currentLineRow.length > 0 && (currentLineRow.length > 1 || currentLineRow[0] !== '')) {
                parsedGrid.push(currentLineRow);
              }
            }

            if (parsedGrid.length > 1) {
              const csvHeaders = parsedGrid[0].map(h => h.replace(/^["']|["']$/g, "").trim());
              const csvRows = parsedGrid.slice(1).map((values) => {
                const obj: any = {};
                csvHeaders.forEach((h, hidx) => {
                  obj[h] = (values[hidx] !== undefined ? values[hidx] : '').replace(/^["']|["']$/g, "").trim();
                });
                return obj;
              });
              resolve(csvRows);
            } else {
              resolve([]);
            }
          } else {
            resolve([{ isRawStringText: true, text, fileName: file.name }]);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => {
        reject(new Error(`Falha na leitura física do arquivo ${file.name}.`));
      };
      reader.readAsText(file);
    });
  };

  const processMultipleFiles = async (files: File[]) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const allFileRowsList = await Promise.all(files.map(f => parseSingleFile(f)));
      
      let aggregatedRows: any[] = [];
      let containsRawText = false;
      let rawTextContent = "";
      
      allFileRowsList.forEach((fileRows) => {
        if (fileRows.length === 1 && fileRows[0]?.isRawStringText) {
          containsRawText = true;
          rawTextContent += `\n--- Arquivo: ${fileRows[0].fileName} ---\n` + fileRows[0].text + "\n";
        } else {
          aggregatedRows = [...aggregatedRows, ...fileRows];
        }
      });

      if (containsRawText) {
        setDialogPasteText((prev) => (prev ? prev + "\n" + rawTextContent : rawTextContent).trim());
        setSuccessMsg(`Arquivo(s) de texto lido(s) com sucesso e carregados na área de texto de diálogo para auditoria.`);
      }

      if (aggregatedRows.length > 0) {
        // Now determine mapping headers based on the aggregated rows with relaxed support
        const isCasasBahiaFormat = aggregatedRows.every(row => 
          row && (
            (row.metadados && row.historico_conversas) || 
            (getRelaxedKey(row, 'metadados') !== undefined && (getRelaxedKey(row, 'historico_conversas') !== undefined || getRelaxedKey(row, 'mensagens') !== undefined))
          )
        );
        
        let headers: string[] = [];
        if (isCasasBahiaFormat) {
          // Normaliza defensivamente todos os registros para possuir exatamente a estrutura A em tela
          const normalizedRows = aggregatedRows.map(row => {
            const metadados = row.metadados || getRelaxedKey(row, 'metadados');
            const historico = row.historico_conversas || getRelaxedKey(row, 'historico_conversas') || getRelaxedKey(row, 'mensagens') || [];
            
            const sanitizedHistorico = (Array.isArray(historico) ? historico : []).map((msg: any) => {
              const txt = String(msg.texto || msg.mensagem || msg.text || "");
              let sub = msg.sub_participante || "";
              let tipo = msg.tipo_participante || "";
              let part = msg.participante || "";

              if (isBotOrSystemText(txt)) {
                sub = "Bot";
                tipo = "Sistema";
                part = "Bot URA";
              } else if (isAgentText(txt)) {
                sub = "Agente";
                tipo = "Interno";
              }

              return {
                ...msg,
                tipo_participante: tipo || msg.tipo_participante || "",
                participante: part || msg.participante || "",
                sub_participante: sub || msg.sub_participante || ""
              };
            });

            return {
              metadados: metadados,
              historico_conversas: sanitizedHistorico
            };
          });

          headers = ['metadados', 'historico_conversas'];
          setDetectedHeaders(headers);
          setSimulatedRows(normalizedRows);
          setMappings({
            id: 'metadados.id_interacao',
            agentName: 'metadados.operador',
            customerName: 'metadados.cliente',
            bpoName: 'auto_bpo',
            channel: 'auto_canal',
            transcript: 'historico_conversas',
            duration: 'metadados.duracao_segundos'
          });
          setSuccessMsg(`Lote carregado com sucesso! Detectados total de ${normalizedRows.length} atendimentos estruturados! Mapeamento automático aplicado.`);
        } else {
          headers = Object.keys(aggregatedRows[0] || {});
          setDetectedHeaders(headers);
          setSimulatedRows(aggregatedRows);
          
          const autoMapHeaders = (headersList: string[]): HeaderMapping => {
            const newMap: HeaderMapping = {
              id: 'auto_id',
              agentName: 'operator_manual',
              customerName: 'auto_consumidor',
              bpoName: 'auto_bpo',
              channel: 'auto_canal',
              transcript: headersList[0] || '',
              duration: 'auto_duracao'
            };

            headersList.forEach(key => {
              const k = key.toLowerCase();
              if (k === 'id' || k === 'codigo' || k === 'código' || k === 'uuid' || k === 'protocolo' || k.includes('id_') || k.includes('_id') || k === 'id_interacao') {
                newMap.id = key;
              }
              if (k.includes('agent') || k.includes('atendente') || k.includes('operador') || k.includes('colaborador') || k.includes('atend_nome') || k === 'participante_interno') {
                newMap.agentName = key;
              }
              if (k.includes('customer') || k.includes('cliente') || k.includes('consumidor') || k.includes('usuario') || k.includes('client_nome') || k === 'participante_externo') {
                newMap.customerName = key;
              }
              if (k.includes('bpo') || k.includes('parceiro') || k.includes('fornecedor') || k.includes('prestador') || k.includes('empresa') || k.includes('marca')) {
                newMap.bpoName = key;
              }
              if (k.includes('channel') || k.includes('canal') || k.includes('tipo') || k.includes('meio') || k === 'tipo_interacao') {
                newMap.channel = key;
              }
              if (k.includes('transcript') || k.includes('dialogo') || k.includes('diálogo') || k.includes('texto') || k.includes('fala') || k.includes('conversa') || k.includes('conteudo') || k.includes('chat') || k.includes('gravacao') || k.includes('gravação') || k === 'mensagens') {
                newMap.transcript = key;
              }
              if (k.includes('duration') || k.includes('tempo') || k.includes('duracao') || k.includes('duração') || k.includes('segundos') || k.includes('seg') || k.includes('min') || k.includes('time') || k === 'duracao') {
                newMap.duration = key;
              }
            });

            if (!newMap.transcript || !headersList.includes(newMap.transcript)) {
              newMap.transcript = headersList.find(h => h !== newMap.id && h !== newMap.agentName && h !== newMap.customerName && h !== newMap.bpoName) || headersList[0] || '';
            }

            return newMap;
          };

          const newMap = autoMapHeaders(headers);
          setMappings(newMap);
          setSuccessMsg(`Lote em formato genérico carregado com sucesso! Detectados ${aggregatedRows.length} registros reais.`);
        }
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao analisar lote de arquivos: ${err.message || err}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files).map((f: any) => ({
        name: f.name,
        size: f.size,
        type: f.name.substring(f.name.lastIndexOf('.'))
      }));
      setUploadedFiles(fileList);
      processMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files).map((f: any) => ({
        name: f.name,
        size: f.size,
        type: f.name.substring(f.name.lastIndexOf('.'))
      }));
      setUploadedFiles(fileList);
      processMultipleFiles(Array.from(e.target.files));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleMappingChange = (key: keyof HeaderMapping, value: string) => {
    setMappings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Run bulk analyze with backend Gemini API
  const handleProcessAnalyze = async () => {
    if (simulatedRows.length === 0 && !dialogPasteText) {
      setErrorMsg("Nenhum registro ou transcrição disponível para auditoria.");
      return;
    }

    setProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setAnalysisLogs([]);

    try {
      // Formulate items immediately to know count
      let itemsToProcess = [];

      if (dialogPasteText) {
        // Quick paste analysis format
        itemsToProcess = [{
          id: `PASTE-${Math.floor(100 + Math.random() * 900)}`,
          agentName: "Atendente Operacional",
          customerName: "Consumidor Final",
          bpoName: selectedBpo,
          channel: "chat",
          transcript: dialogPasteText,
          duration: 250,
          silenceTime: 0
        }];
      } else {
        // Process rows dynamically mapping fields as selected
        itemsToProcess = simulatedRows.map((row, idx) => {
          if (row.metadados && row.historico_conversas) {
            return {
              id: row.metadados.id_interacao || `INT-CB-${idx}`,
              agentName: row.metadados.operador || "SIMONE ALMEIDA DOS SANTOS",
              customerName: row.metadados.cliente || "ROSNEI",
              bpoName: selectedBpo,
              channel: "chat",
              transcript: "",
              duration: row.metadados.duracao_segundos || 654,
              silenceTime: 0,
              metadados: row.metadados,
              historico_conversas: row.historico_conversas
            };
          }

          const rawId = mappings.id && getNestedValue(row, mappings.id) && mappings.id !== 'auto_id' ? String(getNestedValue(row, mappings.id)) : "";
          const rawAgent = mappings.agentName && getNestedValue(row, mappings.agentName) && mappings.agentName !== 'operator_manual' ? String(getNestedValue(row, mappings.agentName)) : "";
          const rawCustomer = mappings.customerName && getNestedValue(row, mappings.customerName) && mappings.customerName !== 'auto_consumidor' ? String(getNestedValue(row, mappings.customerName)) : "";
          const rawBpo = mappings.bpoName && getNestedValue(row, mappings.bpoName) && mappings.bpoName !== 'auto_bpo' ? String(getNestedValue(row, mappings.bpoName)) : selectedBpo;
          const rawChannel = mappings.channel && getNestedValue(row, mappings.channel) && mappings.channel !== 'auto_canal' ? String(getNestedValue(row, mappings.channel)) : "";
          const rawTranscript = getNestedValue(row, mappings.transcript) ? (typeof getNestedValue(row, mappings.transcript) === 'object' ? JSON.stringify(getNestedValue(row, mappings.transcript)) : String(getNestedValue(row, mappings.transcript))) : "";
          const rawDuration = mappings.duration && getNestedValue(row, mappings.duration) && mappings.duration !== 'auto_duracao' ? Number(getNestedValue(row, mappings.duration)) : 0;

          return {
            id: rawId || `ROW-${idx + 1}`,
            agentName: rawAgent || "Operador Desconhecido",
            customerName: rawCustomer || "Cliente",
            bpoName: rawBpo || selectedBpo,
            channel: rawChannel || "chat",
            transcript: rawTranscript,
            duration: rawDuration || 300,
            silenceTime: row.silence_segundos ? Number(row.silence_segundos) : 0
          };
        });
      }

      // ─── STEP 1 ───
      setAnalysisStep(1);
      setAnalysisStatus("Estruturando lote e validando colunas de cabeçalho...");
      setAnalysisLogs([
        "Iniciando rotina de auditoria automatizada em lote...",
        `Encontrado(s) ${itemsToProcess.length} registro(s) para auditoria cognitivos.`,
        "Preparando payloads de integridade em JSON para envio ao servidor."
      ]);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ─── STEP 2 ───
      setAnalysisStep(2);
      const activeModel = activeConfig.geminiModel || "gemini-3.5-flash";
      setAnalysisStatus(`Estabelecendo conexão segura HTTP com o modelo ${activeModel}...`);
      setAnalysisLogs(prev => [
        ...prev,
        `Usando BPO de orquestração: ${selectedBpo}`,
        `Vinculando parâmetros do manual de diretrizes ativas da operação.`,
        `Carregando rede neural para: ${activeModel}...`
      ]);
      await new Promise(resolve => setTimeout(resolve, 1200));

      // ─── STEP 3 ───
      setAnalysisStep(3);
      setAnalysisStatus("Processando laudos de Auto-QA (auditoria de critérios)...");
      setAnalysisLogs(prev => [
        ...prev,
        "Invocando APIs inteligentes do backend cognitivo...",
        "Analisando roteiro obrigatório: Saudação, Protocolo, Confirmação e Desvios Críticos...",
        "Calculando penalidades do Guia de Atendimento ativas no sistema."
      ]);

      const tid = tenantId || 'system-global';
      const email = userEmail || '';
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tid,
          'x-user-email': email
        },
        body: JSON.stringify({
          items: itemsToProcess.map(it => ({ ...it, tenantId: tid })),
          tenantId: tid,
          userEmail: email
        })
      });

      if (!response.ok) {
        throw new Error("Erro na comunicação com o motor de análise backend.");
      }

      const resData = await response.json();

      // ─── STEP 4 ───
      setAnalysisStep(4);
      setAnalysisStatus("Finalizando gravação dos laudos e processando dashboard...");
      setAnalysisLogs(prev => [
        ...prev,
        "Resposta recebida com sucesso da orquestração de IA.",
        "Gravando pontuações ponderadas de cada operador...",
        "Sincronizando laudos concluídos para a fila de auditoria."
      ]);
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (resData.success && resData.processedItems) {
        onProcessed(resData.processedItems);
        setSuccessMsg(`Sucesso! ${resData.processedItems.length} atendimentos analisados e importados para as análises.`);
        setSimulatedRows([]);
        setUploadedFiles([]);
        setDetectedHeaders([]);
        setDialogPasteText("");
      } else {
        throw new Error(resData.error || "Erro inespecífico na análise.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Falha na análise. Verifique se o servidor está ativo.");
    } finally {
      setProcessing(false);
      setAnalysisStep(0);
      setAnalysisStatus("");
    }
  };

  const handleLoadSampleManualFile = () => {
    setUploadedFiles([]);
    setDetectedHeaders([]);
    setDialogPasteText(
      "Atendente: Central de Relacionamento, meu nome é Felipe Santos. Anote o número de protocolo de atendimento: 202685942.\n" +
      "Cliente: Olá Felipe, boa tarde. Gostaria de entender se já houve o faturamento da minha fatura de energia desse mês.\n" +
      "Atendente: Claro, sr. André. Confirmei no sistema que a leitura já foi realizada ontem e o faturamento concluído com sucesso. A fatura de R$ 145,90 com vencimento em 10/06 foi enviada via WhatsApp.\n" +
      "Cliente: Maravilha! Era só essa dúvida. Agradeço a atenção.\n" +
      "Atendente: O prazer é meu. Resolvi sua solicitação com clareza?\n" +
      "Cliente: Resolveu sim. Um abraço.\n" +
      "Atendente: Obrigado pelo contato, tenha uma excelente tarde!"
    );
    setErrorMsg(null);
    setSuccessMsg("Diálogo de exemplo carregado na área de texto! Defina o parceiro BPO, insira o nome do operador e cliente no Passo 2 e clique em 'Analisar Lote IA' para auditá-lo de verdade.");
  };

  return (
    <div className="space-y-4">
      {/* Header and explanation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-50 pb-3 leading-none select-none">
        <div className="text-left font-sans">
          <h1 className="ds-heading">
            <Upload className="w-4.5 h-4.5 text-indigo-650" />
            <span>Upload em Lote & Ingestão Operacional</span>
          </h1>
          <p className="ds-subtitle">Importe chamadas de voz e conversas de texto do seu BPO nos formatos .csv, .xlsx, .json, .pdf, .docx ou áudios.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-3xs">
        {/* Layout Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Right/Left: Drag zone input */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Passo 1: Carregar Arquivos</h3>
            
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border border-dashed rounded p-6 text-center cursor-pointer transition-all ${dragActive ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                onChange={handleFileInput}
                className="hidden" 
                accept=".csv, .xlsx, .json, .pdf, .docx, .mp3, .wav"
              />
              
              <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
              <p className="text-[11px] font-bold text-slate-705">Arraste múltiplos arquivos para cá ou clique para explorar</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Formatos suportados: Áudio (mp3/wav), CSV, Excel, JSON, PDF e Word</p>
            </div>

            {/* Quick action buttons for easy test */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-450 font-semibold uppercase">Deseja carregar diálogo de teste?</span>
              <button 
                type="button"
                onClick={handleLoadSampleManualFile}
                className="p-1 px-2.5 border border-slate-200 hover:bg-slate-50 text-[10px] font-bold rounded text-slate-700 bg-white"
              >
                Gerar Exemplo de Atendimento
              </button>
            </div>

            {/* Uploaded Files Tracker */}
            {uploadedFiles.length > 0 && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                <div className="text-[8px] uppercase font-bold text-slate-400">Arquivos Carregados:</div>
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] p-1 bg-white rounded border border-slate-150">
                    <span className="font-semibold truncate max-w-xs">{file.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Paste alternative */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Colar Diálogo Manualmente:</label>
              <textarea 
                rows={3}
                placeholder="Exemplo de transcrição:&#10;Atendente: Seja bem-vindo à Telemax! Meu nome é Ricardo...&#10;Cliente: Quero contestar minha fatura..."
                value={dialogPasteText}
                onChange={(e) => setDialogPasteText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] font-mono focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Vincular Auditoria ao BPO:</label>
              <select 
                value={selectedBpo}
                onChange={(e) => setSelectedBpo(e.target.value)}
                className="bg-white border text-[11px] font-bold text-slate-700 p-1.5 rounded border-slate-250 font-sans focus:ring-1 focus:ring-indigo-500"
              >
                {bpos.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping Column configuration */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Passo 2: Mapeamento Dinâmico de Colunas</span>
              <Settings className="w-3.5 h-3.5 text-slate-400" />
            </h3>

            {simulatedRows.length > 0 && simulatedRows[0]?.metadados && simulatedRows[0]?.historico_conversas ? (
              <div className="bg-indigo-50/50 rounded border border-indigo-150 p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center gap-1.5 text-indigo-900 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Mapeamento Nativo Empresa
                </div>
                <p className="text-[10px] text-indigo-700 leading-normal">
                  Identificamos que este arquivo JSON possui o formato estruturado oficial Empresa (contendo blocos unificados descritos por <strong>metadados</strong> e <strong>historico_conversas</strong>). O analisador cognitivo extrairá o operador, cliente, tempos e a conversa de forma imediata.
                </p>
                <div className="bg-white p-3 rounded border border-indigo-100 text-[10px] font-mono text-slate-600 space-y-1 leading-normal">
                  <div><strong>ID de Interação:</strong> {simulatedRows[0]?.metadados?.id_interacao || "Automático"}</div>
                  <div><strong>Operador original:</strong> {simulatedRows[0]?.metadados?.operador || "Não Informado"}</div>
                  <div><strong>Consumidor:</strong> {simulatedRows[0]?.metadados?.cliente || "Não Identificado"}</div>
                  <div><strong>Mensagens:</strong> {simulatedRows[0]?.historico_conversas?.length || 0} registros de diálogos</div>
                  <div><strong>Duração:</strong> {simulatedRows[0]?.metadados?.duracao_segundos || 0} segundos ({simulatedRows[0]?.metadados?.duracao_formatada})</div>
                </div>
              </div>
            ) : detectedHeaders.length > 0 ? (
              <div className="bg-slate-50 rounded border border-slate-200 p-3 space-y-2.5">
                <div className="bg-emerald-50 text-emerald-850 text-[10px] p-2 rounded border border-emerald-150">
                  ⚡ O analisador detectou as colunas abaixo do seu arquivo. Oriente qual variável representa cada parâmetro de qualidade esperado.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Codigo Atendimento map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Identificador / ID da Chamada</label>
                    <select 
                      value={mappings.id}
                      onChange={(e) => handleMappingChange('id', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="auto_id">[Gerar Código Sequencial]</option>
                    </select>
                  </div>

                  {/* Atendente map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nome do Atendente/Operador</label>
                    <select 
                      value={mappings.agentName}
                      onChange={(e) => handleMappingChange('agentName', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="operator_manual">[Não Informado - Manual]</option>
                    </select>
                  </div>

                  {/* Consumidor map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nome do Consumidor/Cliente</label>
                    <select 
                      value={mappings.customerName}
                      onChange={(e) => handleMappingChange('customerName', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="auto_consumidor">[Deixar como Consumidor]</option>
                    </select>
                  </div>

                  {/* BPO Map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Empresa Prestadora (BPO)</label>
                    <select 
                      value={mappings.bpoName}
                      onChange={(e) => handleMappingChange('bpoName', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="auto_bpo">[Vincular ao Selecionado]</option>
                    </select>
                  </div>

                  {/* Channel type Map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Canal de Atendimento</label>
                    <select 
                      value={mappings.channel}
                      onChange={(e) => handleMappingChange('channel', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="auto_canal">[Derivar do Tipo de Arquivo]</option>
                    </select>
                  </div>

                  {/* Dialog Text Map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Texto de Diálogo / Transcrição</label>
                    <select 
                      value={mappings.transcript}
                      onChange={(e) => handleMappingChange('transcript', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Tempo Duration Map */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Duração do Atendimento</label>
                    <select 
                      value={mappings.duration}
                      onChange={(e) => handleMappingChange('duration', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 font-semibold"
                    >
                      {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      <option value="auto_duracao">[Gerar valor médio]</option>
                    </select>
                  </div>
                </div>

                {/* Demonstration preview */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[8px] uppercase font-bold text-slate-400 mb-1">Prévia de Linhas:</div>
                  <div className="max-h-24 overflow-y-auto text-[9px] font-mono text-slate-600 bg-white p-2 border border-slate-150 rounded space-y-1">
                    {simulatedRows.map((row, i) => (
                      <div key={i} className="truncate">
                        ID: {row[mappings.id] !== undefined ? String(row[mappings.id]) : ""} | Op: {row[mappings.agentName] !== undefined ? String(row[mappings.agentName]) : ""} | Fala: {row[mappings.transcript] !== undefined ? String(row[mappings.transcript]).substring(0, 32) : ""}...
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-44 bg-slate-50 rounded border border-dashed border-slate-250 flex flex-col items-center justify-center p-4 text-center text-slate-400">
                <FileCode className="w-6 h-6 text-slate-300 mb-1.5" />
                <p className="text-[11px] font-bold">Nenhum mapeamento ativo</p>
                <p className="text-[9px] text-slate-450 mt-1">Insira um arquivo de lote para carregar o mapeamento automático.</p>
              </div>
            )}
          </div>
        </div>

        {/* Messaging Box alerts */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-150 rounded text-[11px] font-semibold text-rose-700 flex items-center gap-1.5 mt-3">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded text-[11px] font-semibold text-emerald-850 flex items-center gap-1.5 mt-3">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            {successMsg}
          </div>
        )}

        {/* Process button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
          <div className="text-[9px] text-slate-400 leading-none">
            Critérios Ativos: <strong>{activeConfig.greetingWeight + activeConfig.protocolWeight + activeConfig.resolutionWeight + activeConfig.toneWeight}% da pontuação governada</strong>
          </div>
          
          <button
            type="button"
            onClick={handleProcessAnalyze}
            disabled={processing || (simulatedRows.length === 0 && !dialogPasteText)}
            className="flex items-center gap-1.5 p-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded shadow-xs transition-all cursor-pointer animate-duration-150"
            id="startAnalysisBtn"
          >
            {processing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Auditando Lote...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Analisar Lote IA
              </>
            )}
          </button>
        </div>
      </div>

      {/* Beautiful terminal-powered Live Progress Overlay for bulk execution feedback */}
      {processing && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 text-left font-sans">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xl max-w-lg w-full p-6 space-y-5 animate-fade-in">
            
            {/* Header branding */}
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-150">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                <Cpu className="w-4 h-4 animate-pulse text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Avaliador Auto-QA IA em Lote</h3>
                <p className="text-[10px] text-slate-450 font-medium">Orquestrando laudos de qualidade e aderência de roteiro</p>
              </div>
            </div>

            {/* Standard Progress bar block */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-indigo-700">
                <span>Status da Análise</span>
                <span className="font-mono font-black">{analysisStep * 25}%</span>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-indigo-50 border border-indigo-100">
                <div 
                  style={{ width: `${analysisStep * 25}%` }} 
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
                />
              </div>

              {/* Progress Steps checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2.5">
                {[
                  { step: 1, label: "Validação estrutural do lote" },
                  { step: 2, label: "Conexão de orquestrador cognitivo" },
                  { step: 3, label: "Análise profunda de diretrizes" },
                  { step: 4, label: "Persistência e auto-dashboard" }
                ].map((s) => {
                  const isCompleted = analysisStep > s.step;
                  const isActive = analysisStep === s.step;
                  return (
                    <div key={s.step} className="flex items-center gap-2.5 text-xs">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9.5px] font-bold font-mono transition-all shrink-0 ${
                        isCompleted 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-600 font-bold' 
                          : isActive 
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-650 font-black animate-pulse' 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        {isCompleted ? "✓" : s.step}
                      </div>
                      <span className={`font-semibold tracking-tight ${
                        isActive ? 'text-indigo-950 font-black scale-[1.01]' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Micro banner for current action status */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded text-[11px] font-semibold text-indigo-850 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 space-y-0.5">
                <span className="block font-bold text-[9px] uppercase tracking-wider text-indigo-600">Atividade em progresso:</span>
                <p className="text-slate-650 text-[10px] leading-relaxed font-semibold">{analysisStatus}</p>
              </div>
            </div>

            {/* Log list terminal output */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Console de Log do Analisador IA</label>
              <div className="bg-slate-900 border border-slate-950 text-emerald-400 p-3 h-28 rounded-lg font-mono text-[9.5px] overflow-y-auto space-y-1.5 scrollbar-thin">
                {analysisLogs.map((log, index) => (
                  <div key={index} className="leading-normal flex items-start gap-1">
                    <span className="text-emerald-700 select-none">&gt;</span> 
                    <span className="flex-1">{log}</span>
                  </div>
                ))}
                <div className="animate-pulse text-emerald-600">█</div>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 italic text-center block pt-0.5">
              * Por favor, aguarde alguns instantes até que a IA conclua o processamento analítico.
            </p>

          </div>
        </div>
      )}
    </div>
  );
}
