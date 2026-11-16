import test from "node:test";
import assert from "node:assert/strict";
import { decodeSpreadsheetText, detectDelimiter, parseDelimitedText } from "../src/utils/guiaCsv.ts";

function bytes(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

test("decodifica UTF-8 com acentos", () => {
  const encoded = new TextEncoder().encode("Ação;Observação");
  assert.equal(decodeSpreadsheetText(encoded.buffer as ArrayBuffer), "Ação;Observação");
});

test("decodifica Windows-1252 quando o arquivo não é UTF-8 válido", () => {
  // "Ação" em Windows-1252: A ç ã o
  assert.equal(decodeSpreadsheetText(bytes([0x41, 0xe7, 0xe3, 0x6f])), "Ação");
});

test("decodifica UTF-8 e UTF-16 com BOM", () => {
  assert.equal(decodeSpreadsheetText(bytes([0xef, 0xbb, 0xbf, 0x41, 0x42])), "AB");
  assert.equal(decodeSpreadsheetText(bytes([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00])), "AB");
});

test("detecta ponto e vírgula, vírgula e tabulação", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("a\tb\tc\n1\t2\t3"), "\t");
});

test("respeita delimitadores dentro de aspas ao detectar", () => {
  assert.equal(detectDelimiter('id;descricao\n1;"a,b,c"'), ";");
});

test("faz parsing de campos com aspas, ponto e vírgula e quebra de linha", () => {
  const grid = parseDelimitedText('id;motivo\n1;"Falou; pausou"\n2;"Primeira linha\nSegunda linha"');
  assert.deepEqual(grid[0], ["id", "motivo"]);
  assert.deepEqual(grid[1], ["1", "Falou; pausou"]);
  assert.equal(grid[2][1], "Primeira linha\nSegunda linha");
});

test("faz parsing de aspas escapadas e ignora linhas vazias", () => {
  const grid = parseDelimitedText('id;motivo\n1;"Falou ""oi"""\n\n2;Ok\n');
  assert.equal(grid[1][1], 'Falou "oi"');
  assert.equal(grid.length, 3);
  assert.equal(grid[2][1], "Ok");
});
