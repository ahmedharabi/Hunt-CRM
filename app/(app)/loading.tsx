import { Skeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Neutral page skeleton: title, a toolbar and a block — close to every screen's shape. */
export default function Loading() {
  return (
    <Page className="space-y-6" aria-busy aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-7 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </Page>
  );
}
