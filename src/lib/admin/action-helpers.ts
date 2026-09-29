import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, withDb, type Viewer } from "../auth/session";
import { DbError, type Tx } from "../db";

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> } | undefined;

/** Turns database errors (RLS / trigger messages) into readable text for staff. */
export function describeError(err: unknown): string {
  if (err instanceof DbError) {
    if (err.code === "42501" && /row-level security/i.test(err.message)) return "You don't have permission to do that.";
    if (err.code === "23505") return err.message.includes("duplicate key") ? "That value is already in use." : capitalise(err.message);
    return capitalise(err.message);
  }
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    return `${issue.path.join(".") || "Input"}: ${issue.message}`;
  }
  console.error(err);
  return "Something went wrong. Please try again.";
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Standard wrapper for staff server actions: checks the session, runs the work
 * inside one RLS-enforced transaction, revalidates the given paths and maps
 * errors to a message the form can show.
 */
export async function staffAction(
  work: (tx: Tx, viewer: Viewer) => Promise<string | void | { message?: string; data?: Record<string, string> }>,
  revalidate: string[] = [],
): Promise<ActionResult> {
  const viewer = await requireStaff();
  try {
    const result = await withDb((tx) => work(tx, viewer));
    for (const path of revalidate) revalidatePath(path);
    if (typeof result === "string") return { ok: true, message: result };
    return { ok: true, message: result?.message ?? "Saved", data: result?.data };
  } catch (err) {
    return { error: describeError(err) };
  }
}

// --- Form parsing helpers ------------------------------------------------------
// Missing form fields arrive as null; treat them as empty text.
export const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : (v ?? "")), z.string().max(max)).transform((v) => (v === "" ? null : v));
export const requiredText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : (v ?? "")), z.string().min(1, "is required").max(max));
export const optionalInt = (min = 0, max = 10_000_000) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable());
export const optionalNumber = (min = 0, max = 100_000_000) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(min).max(max).nullable());
export const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.enum(values).nullable());
export const optionalUuid = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.uuid().nullable());
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === "1", z.boolean());

export function formObject(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k)]));
}
