import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Demo-mode session cookie: `<base64url(payload)>.<hmac>`.
 * Signed with DEMO_SESSION_SECRET, or a random secret generated once and kept
 * in .demo-data/ (never committed).
 */
export const DEMO_SESSION_COOKIE = "ms_demo_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type DemoSession = { uid: string; aal: "aal1" | "aal2"; exp: number };

let cachedSecret: string | undefined;

function secret(): string {
  if (process.env.DEMO_SESSION_SECRET) return process.env.DEMO_SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  const dir = join(process.cwd(), ".demo-data");
  const file = join(dir, "session-secret");
  if (existsSync(file)) {
    cachedSecret = readFileSync(file, "utf8").trim();
  } else {
    mkdirSync(dir, { recursive: true });
    cachedSecret = randomBytes(32).toString("hex");
    writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeDemoSession(uid: string, aal: "aal1" | "aal2"): { value: string; maxAge: number } {
  const payload: DemoSession = { uid, aal, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { value: `${data}.${sign(data)}`, maxAge: MAX_AGE_SECONDS };
}

export function decodeDemoSession(value: string | undefined): DemoSession | null {
  if (!value) return null;
  const [data, mac] = value.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as DemoSession;
    if (!payload.uid || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
