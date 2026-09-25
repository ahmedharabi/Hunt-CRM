import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="mb-6 size-9" />
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">Nothing here</h1>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        This page doesn&apos;t exist, or the record it pointed to was deleted.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">
          <ArrowLeft data-icon="inline-start" />
          Back to dashboard
        </Link>
      </Button>
    </main>
  );
}
