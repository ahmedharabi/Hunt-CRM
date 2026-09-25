import Papa from "papaparse";

export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

function cell(v: unknown) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  return Papa.unparse({
    fields: columns.map((c) => c.header),
    data: rows.map((r) => columns.map((c) => cell(c.value(r)))),
  });
}

export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  // BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["﻿", toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** ms epoch → ISO string for exports */
export const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : "");
