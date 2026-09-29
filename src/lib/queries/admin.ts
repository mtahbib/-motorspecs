import "server-only";
import type { Tx } from "../db";

/** Shared admin lookups. Every query runs under the staff member's RLS context. */

export type StaffOption = { id: string; display_name: string; role: "admin" | "sales" };

export async function listStaffOptions(tx: Tx) {
  return tx.query<StaffOption>("select id, display_name, role from public.staff_directory order by role, display_name");
}

export type VehicleOption = { id: string; ref_no: string; title: string | null; status: string; fob_price_usd: number | null };

export async function listVehicleOptions(tx: Tx, statuses = ["published", "reserved"]) {
  return tx.query<VehicleOption>(
    `select v.id, v.ref_no, v.status, v.fob_price_usd,
            (select t.title from public.vehicle_translations t where t.vehicle_id = v.id and t.locale = 'en') as title
       from public.vehicles v where v.status = any($1::text[]) order by v.ref_no desc`,
    [`{${statuses.join(",")}}`],
  );
}

export const vehicleTitleSql = (alias: string) =>
  `coalesce((select t.title from public.vehicle_translations t where t.vehicle_id = ${alias}.vehicle_id and t.locale = 'en'), '')`;
