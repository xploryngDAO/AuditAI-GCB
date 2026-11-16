import test from "node:test";
import assert from "node:assert/strict";
import type { GuiaItem, MetodologiaBloco } from "../src/types.ts";
import { buildGuiaTemplateCsv, planGuiaImport } from "../src/utils/guiaImport.ts";

const existing: GuiaItem[] = [
  {
    id: 1,
    relevancia: "LEVE",
    bloco: "Processo",
    motivoOriginal: "Cliente ansioso",
    motivoSimplificado: "Ansiedade",
    categoriaEstrategica: "Jornada",
    scorePenalidade: 2
  },
  {
    id: 2,
    relevancia: "MODERADA",
    bloco: "Experiência",
    motivoOriginal: "Não teve empatia",
    motivoSimplificado: "Frieza",
    categoriaEstrategica: "Comunicação",
    scorePenalidade: 5
  }
];

const blocks: MetodologiaBloco[] = [
  { id: "bloco-processo", nome: "Processo", peso: 50, descricao: "", cor: "indigo", ativo: true },
  { id: "bloco-experiencia", nome: "Experiência", peso: 50, descricao: "", cor: "purple", ativo: true }
];

function plan(grid: unknown[][], overrides: Partial<Parameters<typeof planGuiaImport>[0]> = {}) {
  return planGuiaImport({
    grid,
    guiaItens: existing,
    blocos: blocks,
    tenantId: "system-global",
    ...overrides
  });
}

test("cria linha completa, campo Ação e bloco novo com peso 0", () => {
  const result = plan([
    ["ID", "Bloco", "Escopo Alvo", "Gravidade", "Penalidade", "Motivo/Infração do Manual", "Ação"],
    ["3", "Qualidade", "BPO: AeC / Fila: SAC", "CRÍTICA", "10", "Não confirmou os dados", "Orientar e reciclar"]
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.summary, { total: 1, created: 1, updated: 0, skipped: 0, newBlocks: 1 });
  assert.deepEqual(result.detectedColumns.sort(), [
    "Ação",
    "Bloco",
    "Escopo Alvo",
    "Gravidade",
    "ID",
    "Motivo / Infração do Manual",
    "Penalidade"
  ].sort());

  const created = result.guiaItens[result.guiaItens.length - 1];
  assert.equal(created.id, 3);
  assert.equal(created.bloco, "Qualidade");
  assert.equal(created.relevancia, "CRÍTICA");
  assert.equal(created.scorePenalidade, 10);
  assert.equal(created.subtenantId, "AeC");
  assert.equal(created.queueName, "SAC");
  assert.equal(created.acaoCorretiva, "Orientar e reciclar");

  const newBlock = result.blocos.find((block) => block.nome === "Qualidade");
  assert.ok(newBlock);
  assert.equal(newBlock?.peso, 0);
  assert.match(result.warnings.join("\n"), /Bloco "Qualidade" criado automaticamente com peso 0%/);
});

test("atualiza por ID preservando campos ausentes no arquivo", () => {
  const result = plan([
    ["ID", "Motivo/Infração do Manual", "Gravidade"],
    ["1", "Cliente ansioso (novo texto)", "CRÍTICA"]
  ]);

  assert.equal(result.summary.updated, 1);
  const updated = result.guiaItens.find((item) => item.id === 1);
  assert.equal(updated?.motivoOriginal, "Cliente ansioso (novo texto)");
  assert.equal(updated?.relevancia, "CRÍTICA");
  assert.equal(updated?.scorePenalidade, 2);
  assert.equal(updated?.bloco, "Processo");
  assert.equal(updated?.categoriaEstrategica, "Jornada");
  assert.equal(updated?.motivoSimplificado, "Ansiedade");
  assert.equal(updated?.tenantId, "system-global");
});

test("sem ID, casa pelo motivo e mantém o ID existente", () => {
  const result = plan([
    ["Motivo", "Penalidade"],
    ["Não teve empatia", "7"]
  ]);

  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.created, 0);
  const updated = result.guiaItens.find((item) => item.id === 2);
  assert.equal(updated?.scorePenalidade, 7);
  assert.equal(updated?.relevancia, "MODERADA");
});

test("ID novo para motivo já existente é ignorado com aviso", () => {
  const result = plan([
    ["ID", "Motivo"],
    ["99", "Não teve empatia"]
  ]);

  assert.equal(result.summary.updated, 1);
  const updated = result.guiaItens.find((item) => item.motivoOriginal === "Não teve empatia");
  assert.equal(updated?.id, 2);
  assert.match(result.warnings.join("\n"), /ID #99 do arquivo foi ignorado/);
});

test("ID repetido no arquivo: a última ocorrência prevalece", () => {
  const result = plan([
    ["ID", "Motivo"],
    ["3", "Primeiro motivo"],
    ["3", "Segundo motivo"]
  ]);

  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.updated, 1);
  const item = result.guiaItens.find((entry) => entry.id === 3);
  assert.equal(item?.motivoOriginal, "Segundo motivo");
  assert.match(result.warnings.join("\n"), /ID #3 repetido no arquivo/);
});

test("normaliza penalidade: NCG, NULL e número negativo", () => {
  const result = plan([
    ["Motivo", "Gravidade", "Penalidade"],
    ["Fatal", "PÊNALTI (ERRO FATAL)", "NCG - Zera a monitoria"],
    ["Zero", "LEVE", "NULL"],
    ["Negativo", "MODERADA", "-2"]
  ]);

  const byMotive = new Map(result.guiaItens.map((item) => [item.motivoOriginal, item]));
  assert.equal(byMotive.get("Fatal")?.scorePenalidade, 100);
  assert.equal(byMotive.get("Fatal")?.relevancia, "PÊNALTI (ERRO FATAL)");
  assert.equal(byMotive.get("Zero")?.scorePenalidade, 0);
  assert.equal(byMotive.get("Negativo")?.scorePenalidade, 2);
});

test("normaliza gravidade com variações de caixa e acento", () => {
  const result = plan([
    ["Motivo", "Gravidade"],
    ["A", "critica"],
    ["B", "FATAL"],
    ["C", "Moderada"],
    ["D", "leve"]
  ]);

  const byMotive = new Map(result.guiaItens.map((item) => [item.motivoOriginal, item]));
  assert.equal(byMotive.get("A")?.relevancia, "CRÍTICA");
  assert.equal(byMotive.get("B")?.relevancia, "PÊNALTI (ERRO FATAL)");
  assert.equal(byMotive.get("C")?.relevancia, "MODERADA");
  assert.equal(byMotive.get("D")?.relevancia, "LEVE");
});

test("gravidade desconhecida cai em MODERADA com aviso", () => {
  const result = plan([
    ["Motivo", "Gravidade"],
    ["A", "Altíssima"]
  ]);

  const item = result.guiaItens.find((entry) => entry.motivoOriginal === "A");
  assert.equal(item?.relevancia, "MODERADA");
  assert.match(result.warnings.join("\n"), /gravidade "Altíssima" não reconhecida/);
});

test("sem motivo a linha é ignorada e não cria bloco", () => {
  const result = plan([
    ["ID", "Bloco", "Motivo"],
    ["9", "Bloco Fantasma", ""],
    ["10", "Processo", "Motivo válido"]
  ]);

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.summary.created, 1);
  assert.equal(result.blocos.some((block) => block.nome === "Bloco Fantasma"), false);
  assert.match(result.warnings.join("\n"), /Linha 2: ignorada/);
});

test("penalidade ausente é derivada da gravidade", () => {
  const result = plan([
    ["Motivo", "Gravidade"],
    ["Sem pontuação", "CRÍTICA"]
  ]);

  const item = result.guiaItens.find((entry) => entry.motivoOriginal === "Sem pontuação");
  assert.equal(item?.scorePenalidade, 10);
  assert.match(result.warnings.join("\n"), /1 linha\(s\) sem penalidade explícita/);
});

test("bloco existente casa sem acento e sem caixa; bloco novo é criado uma única vez", () => {
  const existingBlock = plan([
    ["Motivo", "Bloco"],
    ["A", "experiencia"]
  ]);
  const itemA = existingBlock.guiaItens.find((entry) => entry.motivoOriginal === "A");
  assert.equal(itemA?.bloco, "Experiência");
  assert.equal(existingBlock.summary.newBlocks, 0);

  const newBlock = plan([
    ["Motivo", "Bloco"],
    ["B", "Qualidade"],
    ["C", "qualidade"]
  ]);
  assert.equal(newBlock.summary.newBlocks, 1);
  const blocksByName = newBlock.blocos.filter((block) => block.nome.toLowerCase() === "qualidade");
  assert.equal(blocksByName.length, 1);
  assert.equal(newBlock.guiaItens.find((entry) => entry.motivoOriginal === "C")?.bloco, "Qualidade");
});

test("interpreta Escopo Alvo combinado e separado", () => {
  const combined = plan([
    ["Motivo", "Escopo Alvo"],
    ["Todos", "Todos"],
    ["BPO", "BPO: AeC / Fila: SAC"],
    ["Fila", "Fila: Retenção"]
  ]);
  const byMotive = new Map(combined.guiaItens.map((item) => [item.motivoOriginal, item]));
  assert.deepEqual(
    { sub: byMotive.get("Todos")?.subtenantId, queue: byMotive.get("Todos")?.queueName },
    { sub: "todos", queue: "todas" }
  );
  assert.deepEqual(
    { sub: byMotive.get("BPO")?.subtenantId, queue: byMotive.get("BPO")?.queueName },
    { sub: "AeC", queue: "SAC" }
  );
  assert.deepEqual(
    { sub: byMotive.get("Fila")?.subtenantId, queue: byMotive.get("Fila")?.queueName },
    { sub: "todos", queue: "Retenção" }
  );

  const separate = plan([
    ["Motivo", "Sub-tenant", "Fila"],
    ["Separado", "AeC", "SAC_VOZ_HUMANO"]
  ]);
  const item = separate.guiaItens.find((entry) => entry.motivoOriginal === "Separado");
  assert.equal(item?.subtenantId, "AeC");
  assert.equal(item?.queueName, "SAC_VOZ_HUMANO");
});

test("aceita o cabeçalho do template antigo do guia de atendimento", () => {
  const result = plan([
    ["Ítens", "Relevância", "Bloco", "Motivo Original", "Motivo Simplificado", "Categoria Estratégica", "Score", "Obs:"],
    ["1", "LEVE", "Processo", "Cliente ansioso", "Ansiedade", "Jornada", "2", ""]
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.created, 0);
  const item = result.guiaItens.find((entry) => entry.id === 1);
  assert.equal(item?.bloco, "Processo");
  assert.equal(item?.scorePenalidade, 2);
});

test("cabeçalho desconhecido falha sem alterar a matriz", () => {
  const result = plan([
    ["Foo", "Bar"],
    ["1", "2"]
  ]);

  assert.equal(result.ok, false);
  assert.match(String(result.error), /Cabeçalho não reconhecido/);
  assert.deepEqual(result.guiaItens, existing);
  assert.equal(result.summary.total, 0);
});

test("planilha sem linhas de dados é válida e não altera nada", () => {
  const result = plan([["Motivo", "Penalidade"]]);
  assert.equal(result.ok, true);
  assert.equal(result.summary.total, 0);
  assert.match(result.warnings.join("\n"), /Nenhuma linha de dados/);
});

test("grid vazio é rejeitado", () => {
  const result = plan([]);
  assert.equal(result.ok, false);
  assert.match(String(result.error), /cabeçalho/i);
});

test("gera modelo CSV com BOM, escopo e aspas quando necessário", () => {
  const csv = buildGuiaTemplateCsv([
    {
      id: 7,
      relevancia: "CRÍTICA",
      bloco: "Processo",
      motivoOriginal: "Não confirmou; encerrou",
      motivoSimplificado: "Encerramento",
      categoriaEstrategica: "Conduta",
      scorePenalidade: 10,
      subtenantId: "AeC",
      queueName: "SAC",
      acaoCorretiva: "Orientar; reciclar"
    }
  ]);

  assert.ok(csv.startsWith("\uFEFFID;Bloco;Escopo Alvo;Gravidade;Penalidade;Motivo/Infração do Manual;Ação"));
  assert.match(csv, /;BPO: AeC \/ Fila: SAC;/);
  assert.match(csv, /"Não confirmou; encerrou"/);
  assert.match(csv, /"Orientar; reciclar"/);
});
