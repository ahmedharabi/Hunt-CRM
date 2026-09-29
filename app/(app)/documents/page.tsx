import { FileUser } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { AddDocumentButton } from "@/components/documents/documents-list";

export default function DocumentsPage() {
  return (
    // Phones show just the list here.
    <div className="hidden items-center justify-center rounded-xl border bg-card md:flex">
      <EmptyState
        icon={FileUser}
        title="Pick a document to preview it"
        description="Keep every version of your CV and cover letters here. Attach a CV to an application to see which one gets interviews."
        action={<AddDocumentButton size="default" />}
      />
    </div>
  );
}
