import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LogoMark } from "@/components/brand/logo";
import { isAuthEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Unlock" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // APP_PASSWORD is read at request time, so this page must never be prerendered.
  await connection();
  if (!isAuthEnabled()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-[320px]">
        <LogoMark className="size-9" />
        <h1 className="mt-5 text-lg font-semibold tracking-tight">Unlock Hunt</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">This instance is password protected.</p>
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </main>
  );
}
