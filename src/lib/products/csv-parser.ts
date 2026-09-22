/**
 * RFC 4180-compliant CSV parser and serializer.
 * Zero-dependency, safe against formula injection and prototype pollution.
 */

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

export interface ParsedCsvRow {
  rowNumber: number; // 1-indexed CSV line number (header is row 1)
  data: Record<string, string>;
  rawValues: string[];
}

export interface ParsedCsvResult {
  headers: string[];
  rows: ParsedCsvRow[];
}

/**
 * Parses raw CSV text into RFC 4180 compliant rows.
 */
export function parseCsv(csvText: string): ParsedCsvResult {
  if (!csvText || typeof csvText !== "string") {
    return { headers: [], rows: [] };
  }

  // Strip UTF-8 BOM if present
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  
  // Normalize Windows \r\n and legacy Mac \r to \n while tracking in character iteration
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        // Lookahead for escaped quote ""
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRecord.push(currentField);
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (i + 1 < len && text[i + 1] === "\n") {
          i++; // Skip \n in \r\n
        }
        currentRecord.push(currentField);
        currentField = "";
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      } else if (char === "\n") {
        currentRecord.push(currentField);
        currentField = "";
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remainder if any
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  // Filter out trailing empty rows
  const nonEmptyRecords = records.filter(
    (record) => record.length > 0 && record.some((cell) => cell.trim().length > 0)
  );

  if (nonEmptyRecords.length === 0) {
    return { headers: [], rows: [] };
  }

  // Header row is row 1
  const rawHeaders = nonEmptyRecords[0].map((h) => h.trim());
  const headers = rawHeaders;

  const rows: ParsedCsvRow[] = [];
  for (let r = 1; r < nonEmptyRecords.length; r++) {
    const rawValues = nonEmptyRecords[r];
    const data: Record<string, string> = Object.create(null); // Prevent prototype pollution

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      const val = c < rawValues.length ? rawValues[c].trim() : "";
      if (header) {
        data[header] = val;
      }
    }

    rows.push({
      rowNumber: r + 1, // Row 1 is header
      data,
      rawValues,
    });
  }

  return { headers, rows };
}

/**
 * Escapes formula characters to protect against CSV / spreadsheet formula injection.
 */
export function sanitizeFormulaValue(value: string): string {
  if (!value) return value;
  const firstChar = value.charAt(0);
  if (FORMULA_PREFIXES.has(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Serializes headers and 2D row array into an RFC 4180 CSV string,
 * automatically applying spreadsheet formula injection escaping.
 */
export function serializeCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const formatCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "";
    let str = sanitizeFormulaValue(String(val));
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(headers.map(formatCell).join(","));

  for (const row of rows) {
    lines.push(row.map(formatCell).join(","));
  }

  return lines.join("\r\n");
}
