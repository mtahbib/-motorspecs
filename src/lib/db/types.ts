/** A connection (inside a transaction) that runs parameterised SQL. */
export interface Tx {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * JWT claims the database sees through auth.uid()/auth.jwt().
 * `null` = anonymous visitor (runs as the `anon` role).
 */
export type DbClaims = {
  sub: string;
  email?: string | null;
  role: "authenticated";
  aal: "aal1" | "aal2";
} | null;

export interface DbDriver {
  /**
   * Runs `fn` in a transaction as the `authenticated` (or `anon`) role with the
   * given claims, so every statement is subject to Row Level Security exactly
   * as it would be through Supabase's own APIs.
   */
  withClaims<T>(claims: DbClaims, fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export class DbError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "DbError";
  }
}
