"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/admin/action-helpers";

/** Demo mode only: wipe the embedded database and re-run migrations + seed. */
export async function resetDemoData(): Promise<ActionResult> {
  if (!isDemoMode) return { error: "Only available in demo mode." };
  await requireAdmin();
  const { resetDemoDb, getDemoDb } = await import("@/lib/db/pglite-driver");
  await resetDemoDb();
  await getDemoDb().ready;
  revalidatePath("/", "layout");
  return { ok: true, message: "Demo data restored. Your session is still signed in as the demo owner." };
}
