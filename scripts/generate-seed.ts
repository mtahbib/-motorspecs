/**
 * Regenerates supabase/seed.sql from src/lib/demo/seed-data.ts.
 * Usage: npm run db:seed:generate
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSeedSql } from "../src/lib/demo/seed-sql";

const target = join(process.cwd(), "supabase", "seed.sql");
writeFileSync(target, buildSeedSql("supabase"));
console.log(`Wrote ${target}`);
