/**
 * Deletes the embedded demo database and demo uploads. Stop `npm run dev`
 * first; the next start re-creates everything from the migrations and seed.
 * (While the app is running, use "Reset demo data" on the admin dashboard.)
 */
import { rmSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".demo-data");
for (const sub of ["pglite", "storage"]) rmSync(join(dir, sub), { recursive: true, force: true });
console.log("Demo data removed. Start the app to re-seed.");
