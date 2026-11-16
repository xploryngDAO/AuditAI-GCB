/**
 * Leitura de CSV/TSV sem dependência externa.
 *
 * O template do guia é exportado pelo Excel em Windows-1252 e separado por
 * ponto e vírgula; por isso o texto é decodificado com detecção de BOM/UTF-8 e
 * fallback para Windows-1252, e o delimitador é detectado pelas primeiras
 * linhas em vez de assumido.
 */

export function decodeSpreadsheetText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return "";

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  try {
    // `fatal` garante que bytes inválidos em UTF-8 não virem caracteres de
    // substituição silenciosos: nesse caso o arquivo é Windows-1252.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 5);

  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const line of lines) {
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && char in counts) counts[char] += 1;
    }
  }

  const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return winner && winner[1] > 0 ? winner[0] : ";";
}

export function parseDelimitedText(text: string, delimiter?: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const separator = delimiter || detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((value) => value.trim() !== "")) rows.push(row.map((value) => value.trim()));
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === separator) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\r" || char === "\n") {
      pushRow();
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      continue;
    }

    cell += char;
  }

  pushRow();
  return rows;
}
