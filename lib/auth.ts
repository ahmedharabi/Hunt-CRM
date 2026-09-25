/**
 * Optional single-password gate. When APP_PASSWORD is unset the app is open.
 * The cookie stores a SHA-256 of the password (never the password itself),
 * so changing APP_PASSWORD invalidates every existing session.
 */
export const SESSION_COOKIE = "hunt_session";

export function isAuthEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

export async function sessionToken(password: string) {
  const bytes = new TextEncoder().encode(`hunt:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(token: string | undefined) {
  const password = process.env.APP_PASSWORD;
  if (!password) return true;
  if (!token) return false;
  const expected = await sessionToken(password);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
