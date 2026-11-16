/**
 * Extrai a grade (linhas x colunas) de um arquivo enviado pelo usuário.
 *
 * CSV/TSV são decodificados por `guiaCsv` (UTF-8, UTF-16 ou Windows-1252) e
 * XLSX é lido no navegador pela biblioteca `read-excel-file`. A planilha nunca
 * vai para o servidor: apenas a grade já extraída, o que mantém o endpoint
 * independente de multipart e permite prévia antes de gravar.
 */

import readXlsxFile from "read-excel-file/browser";
import { decodeSpreadsheetText, parseDelimitedText } from "./guiaCsv.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function readGuiaSpreadsheet(file: File): Promise<unknown[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo muito grande. O limite para importação é de 10 MB.");
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
    const buffer = await file.arrayBuffer();
    const text = decodeSpreadsheetText(buffer);
    const delimiter = name.endsWith(".tsv") ? "\t" : undefined;
    return parseDelimitedText(text, delimiter);
  }

  if (name.endsWith(".xlsx")) {
    const sheets = await readXlsxFile(file);
    const sheet =
      sheets.find((candidate) =>
        candidate.data.some((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
      ) || sheets[0];
    const rows = sheet?.data ?? [];
    return rows.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell);
      })
    );
  }

  if (name.endsWith(".xls")) {
    throw new Error("O formato .xls antigo não é suportado. Salve a planilha como .xlsx ou .csv.");
  }

  throw new Error("Formato não suportado. Envie um arquivo .csv, .tsv ou .xlsx.");
}
