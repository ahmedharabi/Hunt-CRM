"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Download, FileJson, FlaskConical, ImageDown, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLookups } from "@/components/providers/lookups";
import { clearSampleData, fetchMissingLogos, importJsonBackup, resetAllData } from "@/lib/actions/misc";

function Row({ icon: Icon, title, description, children }: { icon: typeof Download; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.85} />
        <div>
          <p className="text-[0.84375rem] font-medium">{title}</p>
          <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pl-7 sm:pl-0">{children}</div>
    </div>
  );
}

export function DataSection({ hasSample, dataDir }: { hasSample: boolean; dataDir: string }) {
  const router = useRouter();
  const { refresh } = useLookups();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingJson, setPendingJson] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const done = () => {
    void refresh();
    router.refresh();
  };

  return (
    <div className="divide-y rounded-xl border bg-card px-4 py-4">
      <Row icon={FileJson} title="Export everything" description="A JSON file with every table — your portable backup.">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export/json" download>
            <Download data-icon="inline-start" />
            Export JSON
          </a>
        </Button>
      </Row>
      <Row icon={Upload} title="Restore from JSON" description="Replaces all current data with the backup's contents.">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setPendingJson({ name: f.name, text: await f.text() });
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload data-icon="inline-start" />
          Import JSON…
        </Button>
      </Row>
      <Row icon={Database} title="Download database" description={`The raw SQLite file. Daily snapshots are kept in ${dataDir}/backups.`}>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export/db" download>
            <Download data-icon="inline-start" />
            hunt.db
          </a>
        </Button>
      </Row>
      <Row icon={ImageDown} title="Company logos" description="Fetch the icon from each company's website, for companies that have a website but no logo.">
        <Button
          variant="outline"
          size="sm"
          disabled={busy === "logos"}
          onClick={async () => {
            setBusy("logos");
            const r = await fetchMissingLogos();
            setBusy(null);
            if (!r.ok) return toast.error(r.error);
            const { found, total } = r.data;
            if (total === 0) toast.info("Every company with a website already has a logo");
            else toast.success(`Found ${found} of ${total} logo${total === 1 ? "" : "s"}`);
            done();
          }}
        >
          {busy === "logos" && <LoaderCircle className="animate-spin" />}
          Fetch logos
        </Button>
      </Row>
      {hasSample && (
        <Row icon={FlaskConical} title="Remove sample data" description="Deletes every seeded row. Anything you created stays.">
          <Button
            variant="outline"
            size="sm"
            disabled={busy === "sample"}
            onClick={async () => {
              setBusy("sample");
              const r = await clearSampleData();
              setBusy(null);
              if (!r.ok) return toast.error(r.error);
              toast.success("Sample data removed");
              done();
            }}
          >
            {busy === "sample" && <LoaderCircle className="animate-spin" />}
            Remove sample data
          </Button>
        </Row>
      )}
      <Row icon={RotateCcw} title="Reset" description="Erase all data and start fresh. Download a backup first.">
        <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
          Reset everything…
        </Button>
      </Row>

      <AlertDialog open={!!pendingJson} onOpenChange={(o) => !o && setPendingJson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything currently in Hunt will be replaced with <span className="font-medium text-foreground">{pendingJson?.name}</span>. A snapshot of today&apos;s
              database is already in the backups folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!pendingJson) return;
                const r = await importJsonBackup(pendingJson.text);
                setPendingJson(null);
                if (!r.ok) return toast.error(r.error);
                const total = Object.values(r.data).reduce((a, b) => a + b, 0);
                toast.success(`Restored ${total.toLocaleString()} rows`);
                done();
              }}
            >
              Replace data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetOpen}
        onOpenChange={(o) => {
          setResetOpen(o);
          setConfirm("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase everything?</AlertDialogTitle>
            <AlertDialogDescription>
              Every company, contact, opportunity and activity will be deleted. Settings go back to defaults. Type <span className="font-mono font-medium text-foreground">reset</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="reset" aria-label='Type "reset" to confirm' className="h-9" autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirm !== "reset"}
              onClick={async () => {
                const r = await resetAllData(confirm);
                if (!r.ok) return toast.error(r.error);
                toast.success("All data erased");
                done();
                router.push("/");
              }}
            >
              Erase everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
