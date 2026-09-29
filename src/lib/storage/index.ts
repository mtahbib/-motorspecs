import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { isDemoMode } from "../config";

export type Bucket = "vehicle-photos" | "vehicle-internal" | "customer-documents";

const DEMO_STORAGE = join(process.cwd(), ".demo-data", "storage");

function demoPath(bucket: Bucket, path: string) {
  const safe = normalize(path).replace(/^(\.\.(\/|\\|$))+/, "");
  if (safe.includes("..")) throw new Error("invalid path");
  return join(DEMO_STORAGE, bucket, safe);
}

/**
 * Uploads an object. In Supabase mode this runs with the signed-in user's
 * session, so the storage RLS policies decide whether the upload is allowed.
 */
export async function putObject(bucket: Bucket, path: string, bytes: Uint8Array, contentType: string) {
  if (isDemoMode) {
    const file = demoPath(bucket, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta`, JSON.stringify({ contentType }));
    return;
  }
  const { createSupabaseServerClient } = await import("../supabase/server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

/** Reads an object as the signed-in user (storage RLS applies in Supabase mode). */
export async function getObject(bucket: Bucket, path: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (isDemoMode) {
    try {
      const file = demoPath(bucket, path);
      const bytes = await readFile(file);
      const meta = JSON.parse(await readFile(`${file}.meta`, "utf8").catch(() => "{}")) as { contentType?: string };
      return { bytes, contentType: meta.contentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  const { createSupabaseServerClient } = await import("../supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
}

/** Short-lived signed URL for a private object (Supabase mode only). */
export async function signedUrl(bucket: Bucket, path: string, seconds = 60): Promise<string | null> {
  if (isDemoMode) return null;
  const { createSupabaseServerClient } = await import("../supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds, { download: true });
  return error ? null : data.signedUrl;
}

export async function removeObject(bucket: Bucket, path: string) {
  if (isDemoMode) {
    const file = demoPath(bucket, path);
    await rm(file, { force: true });
    await rm(`${file}.meta`, { force: true });
    return;
  }
  const { createSupabaseServerClient } = await import("../supabase/server");
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(bucket).remove([path]);
}

export { vehicleMediaUrl } from "./urls";

/** Validates an uploaded file's real type from its first bytes (not the client-sent MIME type). */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (cleaned || "file").slice(-120);
}
