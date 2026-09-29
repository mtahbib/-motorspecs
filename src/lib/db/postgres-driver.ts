/**
 * Supabase-mode database access.
 *
 * Connects with DATABASE_URL (use Supabase's *transaction pooler* URL, port
 * 6543) and, for every unit of work, switches to the `authenticated`/`anon`
 * role with the verified JWT claims of the current user — the same mechanism
 * PostgREST uses. Row Level Security therefore applies to every query, and the
 * connection itself never bypasses it for application data.
 */
import postgres from "postgres";
import { PG_TYPES, identity, timestampToIso, toNumber } from "./parsers";
import { DbError, type DbClaims, type DbDriver, type Tx } from "./types";

const globalForPg = globalThis as unknown as { __motorspecsSql?: postgres.Sql };

function getSql(): postgres.Sql {
  if (!globalForPg.__motorspecsSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForPg.__motorspecsSql = postgres(url, {
      // Required for Supabase's transaction pooler (Supavisor).
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connection: { TimeZone: "UTC", application_name: "motorspecs-web" },
      types: {
        bigint: { to: PG_TYPES.INT8, from: [PG_TYPES.INT8], serialize: String, parse: toNumber },
        numeric: { to: PG_TYPES.NUMERIC, from: [PG_TYPES.NUMERIC], serialize: String, parse: toNumber },
        date: { to: PG_TYPES.DATE, from: [PG_TYPES.DATE], serialize: String, parse: identity },
        timestamptz: {
          to: PG_TYPES.TIMESTAMPTZ,
          from: [PG_TYPES.TIMESTAMPTZ, PG_TYPES.TIMESTAMP],
          serialize: String,
          parse: timestampToIso,
        },
      },
    });
  }
  return globalForPg.__motorspecsSql;
}

export const postgresDriver: DbDriver = {
  async withClaims(claims: DbClaims, fn) {
    const sql = getSql();
    try {
      return (await sql.begin(async (conn) => {
        await conn.unsafe("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
        await conn.unsafe(claims ? "set local role authenticated" : "set local role anon");
        const tx: Tx = {
          async query<T>(text: string, params: unknown[] = []) {
            try {
              return (await conn.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[];
            } catch (err) {
              const e = err as { message: string; code?: string };
              throw new DbError(e.message, e.code);
            }
          },
        };
        return fn(tx);
      })) as Awaited<ReturnType<typeof fn>>;
    } catch (err) {
      if (err instanceof DbError) throw err;
      const e = err as { message: string; code?: string };
      throw new DbError(e.message, e.code);
    }
  },
};
