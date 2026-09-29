/**
 * Runtime mode.
 *
 * - `demo`     : no credentials needed. Uses an embedded PostgreSQL (PGlite)
 *                running the same migrations, RLS policies and seed as Supabase,
 *                plus a local file store and cookie-based demo logins.
 * - `supabase` : a real Supabase project (Auth + Storage) and its Postgres
 *                database through DATABASE_URL.
 *
 * Supabase mode is chosen automatically when all required variables are set.
 * Set MOTORSPECS_MODE to force a mode.
 */
export type AppMode = "demo" | "supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function resolveMode(): AppMode {
  const forced = process.env.MOTORSPECS_MODE ?? process.env.NEXT_PUBLIC_MOTORSPECS_MODE;
  if (forced === "demo" || forced === "supabase") return forced;
  return supabaseUrl && supabaseKey && process.env.DATABASE_URL ? "supabase" : "demo";
}

export const appMode: AppMode = resolveMode();
export const isDemoMode = appMode === "demo";

export const supabaseConfig = { url: supabaseUrl, publishableKey: supabaseKey };

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Upload limits shared by UI validation and server checks (DB/storage enforce them too). */
export const uploadLimits = {
  maxBytes: 10 * 1024 * 1024,
  documentMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  photoMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxPhotosPerUpload: 12,
} as const;

export function assertSupabaseConfigured() {
  if (appMode === "supabase" && (!supabaseUrl || !supabaseKey || !process.env.DATABASE_URL)) {
    throw new Error(
      "MOTORSPECS_MODE=supabase requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and DATABASE_URL. See .env.example.",
    );
  }
}
