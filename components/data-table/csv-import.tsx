"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { CircleAlert, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/components/providers/lookups";
import { importCsv } from "@/lib/actions/csv";
import { CSV_FIELDS, guessMapping } from "@/lib/csv-fields";
import { cn } from "@/lib/utils";

const SKIP = "__skip__";

type Parsed = { headers: string[]; rows: Record<string, string>[]; fileName: string };

/** Upload → map columns (auto-guessed) → preview → import. */
export function CsvImportDialog({ entity, open, onOpenChange }: { entity: keyof typeof CSV_FIELDS; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { refresh } = useLookups();
  const fields = CSV_FIELDS[entity];
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setParsed(null);
    setMapping({});
    setResult(null);
  };

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (!headers.length) return toast.error("That file has no header row.");
        setParsed({ headers, rows: res.data, fileName: file.name });
        setMapping(guessMapping(headers, fields));
        setResult(null);
      },
      error: (err) => toast.error(err.message),
    });
  };

  const mapped = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((r) => Object.fromEntries(fields.map((f) => [f.key, mapping[f.key] ? (r[mapping[f.key]] ?? "") : ""])));
  }, [parsed, mapping, fields]);

  const missing = fields.filter((f) => f.required && !mapping[f.key]);
  const previewFields = fields.filter((f) => mapping[f.key]);

  const submit = async () => {
    setBusy(true);
    const r = await importCsv(entity, mapped);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setResult(r.data);
    if (r.data.inserted) {
      toast.success(`Imported ${r.data.inserted} row${r.data.inserted === 1 ? "" : "s"}`);
      void refresh();
      router.refresh();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Import {entity} from CSV</DialogTitle>
          <DialogDescription>
            {parsed ? `${parsed.fileName} · ${parsed.rows.length} rows. Match your columns to Hunt's fields.` : "The first row must be a header."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60svh] overflow-y-auto px-5 py-4">
          {!parsed ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) onFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-14 text-center transition-colors",
                dragging ? "border-brand bg-brand-soft" : "hover:bg-muted/50",
              )}
            >
              <FileSpreadsheet className="size-6 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium">Drop a .csv here, or click to choose</span>
              <span className="text-xs text-muted-foreground">
                Hunt fields: {fields.map((f) => f.label).join(", ")}
              </span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          ) : result ? (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{result.inserted}</span> imported
                {result.failed > 0 && (
                  <>
                    , <span className="font-medium text-destructive">{result.failed}</span> skipped
                  </>
                )}
                .
              </p>
              {result.errors.length > 0 && (
                <ul className="divide-y rounded-lg border text-xs">
                  {result.errors.map((e) => (
                    <li key={e.row} className="flex gap-3 px-3 py-2">
                      <span className="tabular shrink-0 text-muted-foreground">Line {e.row}</span>
                      <span className="text-destructive">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3">
                    <span className="text-[0.8125rem]">
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </span>
                    <Select value={mapping[f.key] ?? SKIP} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === SKIP ? "" : v }))}>
                      <SelectTrigger size="sm" className={cn("h-8 w-44", !mapping[f.key] && "text-muted-foreground")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don&apos;t import</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Preview · first 5 rows</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {previewFields.map((f) => (
                          <th key={f.key} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mapped.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {previewFields.map((f) => (
                            <td key={f.key} className="max-w-48 truncate px-2.5 py-1.5 whitespace-nowrap">
                              {r[f.key] || <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 items-center rounded-none border-t px-5 py-3">
          {missing.length > 0 && parsed && !result && (
            <span className="mr-auto flex items-center gap-1.5 text-xs text-destructive">
              <CircleAlert className="size-3.5" />
              Map {missing.map((f) => f.label).join(", ")}
            </span>
          )}
          {parsed && (
            <Button variant="ghost" onClick={reset}>
              {result ? "Import another" : "Choose another file"}
            </Button>
          )}
          {parsed && !result ? (
            <Button onClick={submit} disabled={busy || missing.length > 0 || !parsed.rows.length}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              Import {parsed.rows.length} rows
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
