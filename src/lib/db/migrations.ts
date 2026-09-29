import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

export function readStubsSql(): string {
  return readFileSync(join(root, "supabase", "local", "supabase_stubs.sql"), "utf8");
}

export function listMigrations(): { name: string; sql: string }[] {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}
