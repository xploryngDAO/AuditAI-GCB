import type { GuiaItem, MetodologiaBloco } from "../types";

/**
 * Núcleo da importação do Guia de Penalidades.
 *
 * A mesma função roda no navegador (prévia) e no servidor (aplicação), para que
 * o resumo visto pelo usuário seja igual ao que será gravado. Ela é pura: não
 * acessa rede, banco, DOM nem o documento original — recebe a grade já extraída
 * do CSV/XLSX e o estado atual do tenant.
 */

export const MAX_IMPORT_ROWS = 2000;

const MAX_WARNINGS = 24;
const MAX_FIELD_LENGTH = 1200;
const MAX_MOTIVE_PREVIEW = 120;
const BLOCK_COLORS = ["indigo", "emerald", "amber", "rose", "purple", "blue", "cyan"];

type CanonicalKey =
  | "id"
  | "bloco"
  | "escopo"
  | "subtenant"
  | "fila"
  | "gravidade"
  | "penalidade"
  | "motivo"
  | "motivoSimplificado"
  | "categoria"
  | "acao"
  | "observacao";

const COLUMN_LABELS: Record<CanonicalKey, string> = {
  id: "ID",
  bloco: "Bloco",
  escopo: "Escopo Alvo",
  subtenant: "Sub-tenant / BPO",
  fila: "Fila",
  gravidade: "Gravidade",
  penalidade: "Penalidade",
  motivo: "Motivo / Infração do Manual",
  motivoSimplificado: "Motivo Simplificado",
  categoria: "Categoria Estratégica",
  acao: "Ação",
  observacao: "Observação"
};

// Cabeçalhos aceitos depois de normalizados (sem acento, minúsculos e sem
// pontuação). A ordem importa apenas para desempate de colunas repetidas.
const HEADER_ALIASES: Record<CanonicalKey, string[]> = {
  id: ["id", "itens", "item", "items", "codigo", "cod", "numero", "n", "no"],
  bloco: ["bloco", "blocos", "blocometodologico", "blocometodologia", "pilar", "pilares"],
  escopo: ["escopoalvo", "escopo", "abrangencia", "ambito", "publicoalvo", "abrangenciaalvo"],
  subtenant: ["subtenant", "subtenantid", "subtenantbpo", "subtenantbpoalvo", "bpo", "bponame", "parceiro", "parceiros"],
  fila: ["fila", "filas", "filaalvo", "queue", "queuename"],
  gravidade: ["gravidade", "gravidadeepenalidade", "relevancia", "severidade", "impacto", "classificacao"],
  penalidade: ["penalidade", "penalidades", "score", "scorepenalidade", "pontos", "pontuacao", "deducao", "desconto"],
  motivo: [
    "motivo",
    "motivoinfracaodomanual",
    "motivoinfracao",
    "infracao",
    "motivooriginal",
    "descricao",
    "descricaododesvio",
    "desvio",
    "erro"
  ],
  motivoSimplificado: ["motivosimplificado", "motivoresumido", "resumo"],
  categoria: ["categoriaestrategica", "categoriaestrategicadodesvio"],
  acao: ["acao", "acaocorretiva", "acaorecomendada", "planodeacao", "planoacao", "correcao", "orientacao"],
  observacao: ["observacao", "observacoes", "obs", "nota", "notas", "comentario", "comentarios"]
};

const CANONICAL_KEYS = Object.keys(HEADER_ALIASES) as CanonicalKey[];

const DEFAULT_SCORE: Record<GuiaItem["relevancia"], number> = {
  LEVE: 2,
  MODERADA: 4,
  CRÍTICA: 10,
  "PÊNALTI (ERRO FATAL)": 100
};

export type GuiaImportStatus = "created" | "updated" | "skipped";

export type GuiaImportRowResult = {
  rowNumber: number;
  status: GuiaImportStatus;
  id?: number;
  motivo?: string;
  reason?: string;
};

export type GuiaImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  newBlocks: number;
};

export type GuiaImportPlan = {
  ok: boolean;
  error: string | null;
  guiaItens: GuiaItem[];
  blocos: MetodologiaBloco[];
  summary: GuiaImportSummary;
  detectedColumns: string[];
  warnings: string[];
  rows: GuiaImportRowResult[];
};

export type GuiaImportInput = {
  grid: unknown[][];
  guiaItens: GuiaItem[];
  blocos: MetodologiaBloco[];
  tenantId?: string;
  maxRows?: number;
};

function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return "";
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

function keyOf(value: unknown): string {
  return textOf(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function shortPreview(value: string): string {
  return value.length > MAX_MOTIVE_PREVIEW ? `${value.slice(0, MAX_MOTIVE_PREVIEW - 1)}…` : value;
}

function parseId(value: unknown): number | null {
  const text = textOf(value).replace(/^#\s*/, "");
  if (!text) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseGravity(value: string): { relevancia: GuiaItem["relevancia"]; known: boolean } {
  const key = keyOf(value);
  if (!key) return { relevancia: "MODERADA", known: false };
  if (key.includes("fatal") || key.includes("penalti") || key.includes("ncg")) {
    return { relevancia: "PÊNALTI (ERRO FATAL)", known: true };
  }
  if (key.includes("critic")) return { relevancia: "CRÍTICA", known: true };
  if (key.includes("moderad") || key.includes("media")) return { relevancia: "MODERADA", known: true };
  if (key.includes("leve") || key.includes("baixa")) return { relevancia: "LEVE", known: true };
  if (key === "grave") return { relevancia: "CRÍTICA", known: true };
  return { relevancia: "MODERADA", known: false };
}

function parsePenalty(value: string, relevancia: GuiaItem["relevancia"]): { value: number; explicit: boolean } {
  const text = textOf(value);
  const key = keyOf(text);
  if (!text) return { value: DEFAULT_SCORE[relevancia], explicit: false };
  if (text === "-" || text === "—") return { value: 0, explicit: true };
  if (key.includes("ncg") || key.includes("zera") || key.includes("fatal")) return { value: 100, explicit: true };
  if (["null", "na", "sempenalidade", "sempontuacao"].includes(key)) {
    return { value: 0, explicit: true };
  }
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return { value: DEFAULT_SCORE[relevancia], explicit: false };
  const numeric = Math.abs(Number(match[0].replace(",", ".")));
  return { value: Math.min(100, Math.round(numeric)), explicit: true };
}

function normalizeScope(value: string, fallback: string): string {
  const text = textOf(value);
  if (!text) return fallback;
  const key = keyOf(text);
  if (
    key === "todos" ||
    key === "todas" ||
    key === "global" ||
    key === "geral" ||
    key === "todasasfilas" ||
    key === "todasasfilasgeral" ||
    key === "todososbpos"
  ) {
    return fallback;
  }
  return text;
}

function parseScope(escopo: string, subtenant: string, fila: string): { subtenantId: string; queueName: string } {
  let sub = textOf(subtenant);
  let queue = textOf(fila);

  if (!sub && !queue && escopo) {
    const wholeKey = keyOf(escopo);
    if (
      wholeKey === "todos" ||
      wholeKey === "todas" ||
      wholeKey === "global" ||
      wholeKey === "geral" ||
      wholeKey.includes("todasasfilas")
    ) {
      return { subtenantId: "todos", queueName: "todas" };
    }

    for (const part of textOf(escopo).split(/\s*[/|;]\s*/).filter(Boolean)) {
      const partKey = keyOf(part);
      const cleaned = part.replace(/^(bpo|sub-?tenant|parceiro|fila|queue)\s*[:\-]\s*/i, "").trim();
      if (partKey.startsWith("fila") || partKey.startsWith("queue")) queue = cleaned;
      else if (partKey.startsWith("bpo") || partKey.startsWith("sub") || partKey.startsWith("parceiro")) sub = cleaned;
      else if (!sub) sub = cleaned;
      else if (!queue) queue = cleaned;
    }
  }

  return {
    subtenantId: normalizeScope(sub, "todos"),
    queueName: normalizeScope(queue, "todas")
  };
}

function slugifyBlock(value: string): string {
  return textOf(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

type HeaderInfo = {
  headerRow: number;
  columns: Map<CanonicalKey, number>;
  detected: string[];
};

function findHeaderRow(rows: unknown[][]): HeaderInfo | null {
  let best: HeaderInfo | null = null;
  const limit = Math.min(rows.length, 15);

  for (let index = 0; index < limit; index += 1) {
    const cells = Array.isArray(rows[index]) ? rows[index] : [];
    const columns = new Map<CanonicalKey, number>();
    cells.forEach((cell, columnIndex) => {
      const header = keyOf(cell);
      if (!header) return;
      for (const key of CANONICAL_KEYS) {
        if (!columns.has(key) && HEADER_ALIASES[key].includes(header)) columns.set(key, columnIndex);
      }
    });

    // Exige a coluna de motivo e ao menos mais uma coluna conhecida: evita
    // confundir uma linha de título com o cabeçalho de verdade.
    if (columns.has("motivo") && columns.size >= 2) {
      if (!best || columns.size > best.columns.size) {
        const detected: string[] = [];
        for (const key of CANONICAL_KEYS) {
          if (columns.has(key)) detected.push(COLUMN_LABELS[key]);
        }
        best = { headerRow: index, columns, detected };
      }
    }
  }

  return best;
}

function cellValue(cells: unknown[], columns: Map<CanonicalKey, number>, key: CanonicalKey): string {
  const index = columns.get(key);
  if (index === undefined) return "";
  return textOf(cells[index]);
}

export function planGuiaImport(input: GuiaImportInput): GuiaImportPlan {
  const guiaItens = Array.isArray(input.guiaItens) ? input.guiaItens.map((item) => ({ ...item })) : [];
  const blocos = Array.isArray(input.blocos) ? input.blocos.map((bloco) => ({ ...bloco })) : [];
  const warnings: string[] = [];
  const rows: GuiaImportRowResult[] = [];
  let suppressedWarnings = 0;

  const pushWarning = (message: string) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(message);
    else suppressedWarnings += 1;
  };

  const fail = (error: string): GuiaImportPlan => ({
    ok: false,
    error,
    guiaItens,
    blocos,
    summary: { total: 0, created: 0, updated: 0, skipped: 0, newBlocks: 0 },
    detectedColumns: [],
    warnings,
    rows
  });

  if (!Array.isArray(input.grid) || input.grid.length === 0) {
    return fail("Envie uma planilha com cabeçalho. Não foi possível encontrar linhas no arquivo.");
  }

  const header = findHeaderRow(input.grid);
  if (!header) {
    return fail(
      "Cabeçalho não reconhecido. Inclua a coluna \"Motivo/Infração do Manual\" e ao menos outra coluna (ID, Bloco, Gravidade, Penalidade ou Ação)."
    );
  }

  const dataRows = input.grid
    .slice(header.headerRow + 1)
    .map((cells, index) => ({
      cells: Array.isArray(cells) ? cells : [],
      rowNumber: header.headerRow + 2 + index
    }))
    .filter(({ cells }) => cells.some((cell) => textOf(cell) !== ""));

  const rowLimit = Math.max(1, Math.min(input.maxRows ?? MAX_IMPORT_ROWS, MAX_IMPORT_ROWS));
  const consideredRows = dataRows.slice(0, rowLimit);
  if (dataRows.length > rowLimit) {
    pushWarning(
      `A planilha tem ${dataRows.length} linhas; apenas as primeiras ${rowLimit} foram consideradas.`
    );
  }

  if (consideredRows.length === 0) {
    return {
      ok: true,
      error: null,
      guiaItens,
      blocos,
      summary: { total: 0, created: 0, updated: 0, skipped: 0, newBlocks: 0 },
      detectedColumns: header.detected,
      warnings: ["Nenhuma linha de dados encontrada abaixo do cabeçalho."],
      rows
    };
  }

  // Blocos: correspondência sem acento/caixa pelo nome; novos são criados com
  // peso 0 para não alterarem a soma dos pesos da metodologia.
  const blockByKey = new Map<string, MetodologiaBloco>();
  for (const bloco of blocos) blockByKey.set(keyOf(bloco.nome), bloco);
  const blockIds = new Set(blocos.map((bloco) => String(bloco.id)));
  const createdBlocks: MetodologiaBloco[] = [];

  const createBlock = (name: string): MetodologiaBloco => {
    const baseId = `bloco-${slugifyBlock(name) || "importado"}`;
    let id = baseId;
    let suffix = 2;
    while (blockIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const bloco: MetodologiaBloco = {
      id,
      nome: name.slice(0, 80),
      peso: 0,
      descricao: "Criado automaticamente pela importação do Guia de Penalidades.",
      cor: BLOCK_COLORS[blocos.length % BLOCK_COLORS.length],
      ativo: true
    };
    blocos.push(bloco);
    blockIds.add(id);
    blockByKey.set(keyOf(bloco.nome), bloco);
    createdBlocks.push(bloco);
    pushWarning(
      `Bloco "${bloco.nome}" criado automaticamente com peso 0%; ajuste o peso em "Blocos de Metodologia".`
    );
    return bloco;
  };

  const resolveBlockName = (raw: string): string => {
    const name = textOf(raw).slice(0, 80);
    if (!name) {
      if (blocos.length === 0) return createBlock("Processo").nome;
      return blocos[0].nome;
    }
    const existing = blockByKey.get(keyOf(name));
    if (existing) return existing.nome;
    return createBlock(name).nome;
  };

  const itemsById = new Map<number, GuiaItem>();
  const itemsByMotive = new Map<string, GuiaItem>();
  for (const item of guiaItens) {
    itemsById.set(Number(item.id), item);
    const motiveKey = keyOf(item.motivoOriginal);
    if (motiveKey && !itemsByMotive.has(motiveKey)) itemsByMotive.set(motiveKey, item);
  }

  const explicitIds = new Set<number>();
  for (const { cells } of consideredRows) {
    const id = parseId(cellValue(cells, header.columns, "id"));
    if (id !== null) explicitIds.add(id);
  }
  let nextId =
    Math.max(0, ...guiaItens.map((item) => Number(item.id) || 0), ...Array.from(explicitIds)) + 1;

  const seenFileIds = new Set<number>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let inferredPenaltyCount = 0;
  let missingBlockCount = 0;

  for (const { cells, rowNumber } of consideredRows) {
    const motive = cellValue(cells, header.columns, "motivo");
    if (!motive) {
      skipped += 1;
      const reason = "Motivo / infração vazio.";
      pushWarning(`Linha ${rowNumber}: ignorada porque o motivo/infração está vazio.`);
      rows.push({ rowNumber, status: "skipped", reason });
      continue;
    }

    const gravityRaw = cellValue(cells, header.columns, "gravidade");
    const gravity = parseGravity(gravityRaw);
    if (gravityRaw && !gravity.known) {
      pushWarning(`Linha ${rowNumber}: gravidade "${shortPreview(gravityRaw)}" não reconhecida; usando MODERADA.`);
    }

    const penaltyColumn = cellValue(cells, header.columns, "penalidade");
    const penaltySource =
      penaltyColumn || (/ncg|zera|[0-9]/.test(gravityRaw) ? gravityRaw : "");
    const penalty = parsePenalty(penaltySource, gravity.relevancia);

    const scopeRaw = cellValue(cells, header.columns, "escopo");
    const subtenantRaw = cellValue(cells, header.columns, "subtenant");
    const queueRaw = cellValue(cells, header.columns, "fila");
    const scopeProvided = Boolean(scopeRaw || subtenantRaw || queueRaw);
    const scope = parseScope(scopeRaw, subtenantRaw, queueRaw);

    const blockRaw = cellValue(cells, header.columns, "bloco");
    const simplified = cellValue(cells, header.columns, "motivoSimplificado");
    const category = cellValue(cells, header.columns, "categoria");
    const action = cellValue(cells, header.columns, "acao");
    const observation = cellValue(cells, header.columns, "observacao");

    const fileId = parseId(cellValue(cells, header.columns, "id"));
    if (fileId !== null) {
      if (seenFileIds.has(fileId)) {
        pushWarning(`Linha ${rowNumber}: ID #${fileId} repetido no arquivo; a última ocorrência prevalece.`);
      }
      seenFileIds.add(fileId);
    }

    const motiveKey = keyOf(motive);
    // O motivo é a chave mais confiável: planilhas reais repetem ou erram IDs
    // (o template atual tem o ID 48 duas vezes). O ID só decide quando o texto
    // ainda não existe, evitando renomear uma linha e duplicar outra.
    let target = motiveKey ? itemsByMotive.get(motiveKey) : undefined;
    if (!target && fileId !== null) target = itemsById.get(fileId);

    if (target) {
      if (fileId !== null && target.id !== fileId && motiveKey) {
        pushWarning(
          `Linha ${rowNumber}: motivo já cadastrado como #${target.id}; o ID #${fileId} do arquivo foi ignorado.`
        );
      }

      const next: GuiaItem = { ...target, motivoOriginal: motive };
      const previousMotiveKey = keyOf(target.motivoOriginal);
      if (gravityRaw) next.relevancia = gravity.relevancia;
      if (penalty.explicit) next.scorePenalidade = penalty.value;
      if (blockRaw) next.bloco = resolveBlockName(blockRaw);
      if (scopeProvided) {
        next.subtenantId = scope.subtenantId;
        next.queueName = scope.queueName;
      }
      if (simplified) next.motivoSimplificado = simplified;
      if (category) next.categoriaEstrategica = category;
      if (action) next.acaoCorretiva = action;
      if (observation) next.observacao = observation;
      if (!next.motivoSimplificado) next.motivoSimplificado = motive;
      if (!next.categoriaEstrategica) next.categoriaEstrategica = "Experiência";
      if (!next.tenantId && input.tenantId) next.tenantId = input.tenantId;

      const index = guiaItens.findIndex((item) => Number(item.id) === Number(target.id));
      if (index >= 0) guiaItens[index] = next;
      itemsById.set(next.id, next);
      if (previousMotiveKey && previousMotiveKey !== motiveKey && itemsByMotive.get(previousMotiveKey) === target) {
        itemsByMotive.delete(previousMotiveKey);
      }
      if (motiveKey) itemsByMotive.set(motiveKey, next);
      updated += 1;
      rows.push({ rowNumber, status: "updated", id: next.id, motivo: shortPreview(motive) });
      continue;
    }

    let id = fileId !== null ? fileId : nextId++;
    while (itemsById.has(id)) {
      // Defesa para dados legados: se o ID já existir, usa o próximo livre.
      id = nextId++;
    }

    let blockName: string;
    if (blockRaw) {
      blockName = resolveBlockName(blockRaw);
    } else {
      missingBlockCount += 1;
      blockName = resolveBlockName("");
    }

    const item: GuiaItem = {
      id,
      relevancia: gravity.relevancia,
      bloco: blockName,
      motivoOriginal: motive,
      motivoSimplificado: simplified || motive,
      categoriaEstrategica: category || "Experiência",
      scorePenalidade: penalty.value,
      observacao: observation || "",
      subtenantId: scopeProvided ? scope.subtenantId : "todos",
      queueName: scopeProvided ? scope.queueName : "todas"
    };
    if (!penalty.explicit) inferredPenaltyCount += 1;
    if (action) item.acaoCorretiva = action;
    if (input.tenantId) item.tenantId = input.tenantId;

    guiaItens.push(item);
    itemsById.set(item.id, item);
    if (motiveKey && !itemsByMotive.has(motiveKey)) itemsByMotive.set(motiveKey, item);
    created += 1;
    rows.push({ rowNumber, status: "created", id: item.id, motivo: shortPreview(motive) });
  }

  if (inferredPenaltyCount > 0) {
    pushWarning(
      `${inferredPenaltyCount} linha(s) sem penalidade explícita: o valor foi derivado da gravidade (2/4/10/100) e pode ser ajustado na tela.`
    );
  }
  if (missingBlockCount > 0) {
    pushWarning(
      `${missingBlockCount} linha(s) sem bloco: foi usado "${blocos[0]?.nome || "Processo"}". Ajuste na tela se necessário.`
    );
  }
  if (suppressedWarnings > 0) {
    warnings.push(`… e mais ${suppressedWarnings} aviso(s) não exibido(s).`);
  }

  return {
    ok: true,
    error: null,
    guiaItens,
    blocos,
    summary: {
      total: consideredRows.length,
      created,
      updated,
      skipped,
      newBlocks: createdBlocks.length
    },
    detectedColumns: header.detected,
    warnings,
    rows
  };
}

/** Modelo CSV (UTF-8 com BOM) para download na interface. */
export function buildGuiaTemplateCsv(items: GuiaItem[]): string {
  const header = [
    "ID",
    "Bloco",
    "Escopo Alvo",
    "Gravidade",
    "Penalidade",
    "Motivo/Infração do Manual",
    "Ação"
  ];
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const scopeOf = (item: GuiaItem) => {
    const sub = item.subtenantId && item.subtenantId !== "todos" ? `BPO: ${item.subtenantId}` : "";
    const queue = item.queueName && item.queueName !== "todas" ? `Fila: ${item.queueName}` : "";
    return [sub, queue].filter(Boolean).join(" / ") || "Todos";
  };
  const lines = items.map((item) =>
    [
      item.id,
      item.bloco,
      scopeOf(item),
      item.relevancia,
      item.scorePenalidade,
      item.motivoOriginal,
      item.acaoCorretiva || ""
    ]
      .map(escape)
      .join(";")
  );
  return `\uFEFF${[header.join(";"), ...lines].join("\r\n")}`;
}
