/**
 * Demo-mode database: an embedded PostgreSQL (PGlite, WebAssembly) that runs
 * the real Supabase migrations, RLS policies and demo seed. Data persists in
 * `.demo-data/pglite` between restarts; `npm run demo:reset` wipes it.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { buildSeedSql } from "../demo/seed-sql";
import { listMigrations, readStubsSql } from "./migrations";
import { PG_TYPES, identity, timestampToIso, toNumber } from "./parsers";
import { DbError, type DbClaims, type DbDriver, type Tx } from "./types";

export const DEMO_DATA_DIR = join(process.cwd(), ".demo-data");

type DemoDbState = { db: PGlite; ready: Promise<void> };

const globalForDemo = globalThis as unknown as { __motorspecsDemoDb?: DemoDbState };

function createDemoDb(): DemoDbState {
  const inMemory = process.env.DEMO_DB_IN_MEMORY === "true";
  const dataDir = join(DEMO_DATA_DIR, "pglite");
  if (!inMemory) mkdirSync(DEMO_DATA_DIR, { recursive: true });

  const db = new PGlite(inMemory ? undefined : dataDir, {
    parsers: {
      [PG_TYPES.INT8]: toNumber,
      [PG_TYPES.NUMERIC]: toNumber,
      [PG_TYPES.DATE]: identity,
      [PG_TYPES.TIMESTAMP]: timestampToIso,
      [PG_TYPES.TIMESTAMPTZ]: timestampToIso,
    },
  });

  const ready = (async () => {
    await db.exec("set timezone = 'UTC'");
    await db.exec("create schema if not exists demo_meta; create table if not exists demo_meta.migrations (name text primary key, applied_at timestamptz not null default now());");
    const applied = new Set(
      (await db.query<{ name: string }>("select name from demo_meta.migrations")).rows.map((r) => r.name),
    );
    const fresh = applied.size === 0;
    if (fresh) {
      await db.exec(readStubsSql());
    }
    for (const m of listMigrations()) {
      if (applied.has(m.name)) continue;
      try {
        await db.exec(m.sql);
      } catch (err) {
        throw new Error(`Demo DB: migration ${m.name} failed: ${(err as Error).message}`);
      }
      await db.query("insert into demo_meta.migrations (name) values ($1)", [m.name]);
    }
    if (fresh) {
      await db.exec(buildSeedSql("stub"));
    }
  })();

  return { db, ready };
}

export function getDemoDb(): DemoDbState {
  if (!globalForDemo.__motorspecsDemoDb) {
    globalForDemo.__motorspecsDemoDb = createDemoDb();
  }
  return globalForDemo.__motorspecsDemoDb;
}

/** Deletes the persisted demo database; the next request re-seeds it. */
export async function resetDemoDb() {
  const state = globalForDemo.__motorspecsDemoDb;
  globalForDemo.__motorspecsDemoDb = undefined;
  if (state) {
    await state.ready.catch(() => undefined);
    await state.db.close();
  }
  rmSync(join(DEMO_DATA_DIR, "pglite"), { recursive: true, force: true });
  rmSync(join(DEMO_DATA_DIR, "storage"), { recursive: true, force: true });
}

function wrap(tx: Transaction): Tx {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      try {
        const res = await tx.query<T>(sql, params as never[]);
        return res.rows;
      } catch (err) {
        const e = err as { message: string; code?: string };
        throw new DbError(e.message, e.code);
      }
    },
  };
}

export const pgliteDriver: DbDriver = {
  async withClaims(claims: DbClaims, fn) {
    const { db, ready } = getDemoDb();
    await ready;
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
      await tx.exec(claims ? "set local role authenticated" : "set local role anon");
      return fn(wrap(tx));
    });
  },
};

/**
 * Trusted access for demo-mode authentication only (reading/writing the local
 * auth.users stub). Never used for application data.
 */
export async function withDemoSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { db, ready } = getDemoDb();
  await ready;
  return db.transaction(async (tx) => fn(wrap(tx)));
}

export function demoDbExists() {
  return existsSync(join(DEMO_DATA_DIR, "pglite"));
}
