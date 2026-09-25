"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "password-error" : undefined}
          className="h-9"
        />
        {state.error && (
          <p id="password-error" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" className="h-9 w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Unlock
        {!pending && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}
