"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE, sessionToken } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const token = await sessionToken(password);
  if (!(await isValidSession(token))) {
    return { error: "That password doesn't match." };
  }
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // LAN access is plain http, so only require HTTPS when actually served over it.
    secure: process.env.NODE_ENV === "production" && process.env.HUNT_SECURE_COOKIE === "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Only allow same-site relative redirects.
  redirect((next.startsWith("/") && !next.startsWith("//") ? next : "/") as "/");
}
