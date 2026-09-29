import "server-only";
import { appMode } from "../config";
import type { DbDriver } from "./types";

let driver: DbDriver | undefined;

export async function getDriver(): Promise<DbDriver> {
  if (!driver) {
    driver =
      appMode === "supabase"
        ? (await import("./postgres-driver")).postgresDriver
        : (await import("./pglite-driver")).pgliteDriver;
  }
  return driver;
}

export { DbError } from "./types";
export type { DbClaims, Tx } from "./types";
