import "server-only";
import type { Lookups } from "@/components/admin/vehicle-editor";
import type { Tx } from "../db";

export async function loadVehicleLookups(tx: Tx): Promise<Lookups> {
  return {
    makes: await tx.query("select id, name from public.makes order by sort_order, name"),
    models: await tx.query("select id, make_id, name from public.models order by name"),
    bodyTypes: await tx.query("select code from public.body_types order by sort_order"),
    locations: await tx.query("select id, name from public.locations order by name"),
    features: await tx.query("select code, category from public.features order by sort_order"),
  };
}
