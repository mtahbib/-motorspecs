"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkbox, describeError, optionalEnum, optionalInt, optionalNumber, staffAction, text, type ActionResult,
} from "@/lib/admin/action-helpers";
import { requireStaff, withDb } from "@/lib/auth/session";
import { uploadLimits } from "@/lib/config";
import { slugify } from "@/lib/demo/seed-sql";
import type { Tx } from "@/lib/db";
import { putObject, removeObject, sniffMime, type Bucket } from "@/lib/storage";

const vehicleSchema = z.object({
  id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
  // Identity
  ref_no: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z0-9-]{2,30}$/, "use letters, numbers and dashes").or(z.literal(""))),
  slug: z.preprocess((v) => (typeof v === "string" ? slugify(v) : v), z.string().max(120)),
  chassis_no: text(40),
  model_code: text(40),
  engine_code: text(40),
  condition_grade: text(10),
  auction_sheet_ref: text(80),
  // Classification
  make_id: optionalInt(1, 32767),
  model_id: optionalInt(1),
  new_model: text(80),
  body_type: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[a-z_]+$/).nullable()),
  location_id: optionalInt(1, 32767),
  reg_year: optionalInt(1950, 2100),
  reg_month: optionalInt(1, 12),
  manufacture_year: optionalInt(1950, 2100),
  grade: text(120),
  // Specifications
  mileage_km: optionalInt(0, 5_000_000),
  operating_hours: optionalInt(0, 500_000),
  engine_cc: optionalInt(0, 30000),
  transmission: optionalEnum(["AT", "MT", "CVT", "AMT", "other"]),
  fuel: optionalEnum(["petrol", "diesel", "hybrid", "plugin_hybrid", "electric", "lpg", "other"]),
  drive: optionalEnum(["2WD", "4WD", "AWD"]),
  steering: optionalEnum(["RHD", "LHD"]),
  exterior_color: text(60),
  interior_color: text(60),
  doors: optionalInt(0, 8),
  seats: optionalInt(0, 60),
  has_360_view: checkbox,
  // Customs
  length_mm: optionalInt(0, 30000),
  width_mm: optionalInt(0, 5000),
  height_mm: optionalInt(0, 6000),
  m3: optionalNumber(0, 1000),
  weight_kg: optionalInt(0, 100000),
  gross_weight_kg: optionalInt(0, 100000),
  max_load_kg: optionalInt(0, 100000),
  tyre_front: text(40),
  tyre_rear: text(40),
  // Pricing
  price_visibility: z.enum(["public", "ask"]),
  fob_price_usd: optionalNumber(1, 9_999_999),
  previous_price_usd: optionalNumber(1, 9_999_999),
  is_featured: checkbox,
  // Private (admin only)
  internal_cost_jpy: optionalNumber(0, 10_000_000_000),
  internal_cost_usd: optionalNumber(0, 100_000_000),
  supplier: text(160),
  auction_house: text(160),
  purchase_date: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  internal_notes: text(5000),
});

const LOCALES = ["en", "ja", "ar"] as const;

async function saveVehicleRecord(tx: Tx, formData: FormData, isAdmin: boolean): Promise<string> {
  const raw = Object.fromEntries(Object.keys(vehicleSchema.shape).map((k) => [k, formData.get(k) ?? ""]));
  const d = vehicleSchema.parse(raw);
  if (d.price_visibility === "public" && d.fob_price_usd == null) {
    throw new Error("A public price needs a FOB amount — or choose “Ask for price”");
  }
  if (d.mileage_km != null && d.operating_hours != null) {
    throw new Error("Enter either mileage (vehicles) or operating hours (machinery), not both");
  }

  // Optional "new model" typed by staff when the model list lacks it.
  let modelId = d.model_id;
  if (!modelId && d.new_model && d.make_id) {
    const [m] = await tx.query<{ id: number }>(
      `insert into public.models (make_id, name, slug) values ($1, $2, $3)
       on conflict (make_id, slug) do update set name = excluded.name returning id`,
      [d.make_id, d.new_model, slugify(d.new_model) || "model"],
    );
    modelId = m.id;
  }
  if (modelId && d.make_id) {
    const [ok] = await tx.query("select 1 from public.models where id = $1 and make_id = $2", [modelId, d.make_id]);
    if (!ok) throw new Error("The model does not belong to the selected make");
  }

  const cols = {
    chassis_no: d.chassis_no, model_code: d.model_code, engine_code: d.engine_code, condition_grade: d.condition_grade,
    auction_sheet_ref: d.auction_sheet_ref, make_id: d.make_id, model_id: modelId, body_type: d.body_type, location_id: d.location_id,
    reg_year: d.reg_year, reg_month: d.reg_month, manufacture_year: d.manufacture_year, grade: d.grade, mileage_km: d.mileage_km,
    operating_hours: d.operating_hours, engine_cc: d.engine_cc, transmission: d.transmission, fuel: d.fuel, drive: d.drive,
    steering: d.steering, exterior_color: d.exterior_color, interior_color: d.interior_color, doors: d.doors, seats: d.seats,
    has_360_view: d.has_360_view, length_mm: d.length_mm, width_mm: d.width_mm, height_mm: d.height_mm, m3: d.m3,
    weight_kg: d.weight_kg, gross_weight_kg: d.gross_weight_kg, max_load_kg: d.max_load_kg, tyre_front: d.tyre_front,
    tyre_rear: d.tyre_rear, price_visibility: d.price_visibility, fob_price_usd: d.fob_price_usd,
    previous_price_usd: d.previous_price_usd, is_featured: d.is_featured,
  };
  const names = Object.keys(cols);
  const values = Object.values(cols);

  let id = d.id;
  if (id) {
    const sets = names.map((n, i) => `${n} = $${i + 2}`).join(", ");
    const extra: string[] = [];
    const params: unknown[] = [id, ...values];
    if (d.ref_no) { params.push(d.ref_no); extra.push(`ref_no = $${params.length}`); }
    if (d.slug) { params.push(d.slug); extra.push(`slug = $${params.length}`); }
    const rows = await tx.query(`update public.vehicles set ${[sets, ...extra].join(", ")} where id = $1 returning id`, params);
    if (!rows.length) throw new Error("Vehicle not found");
  } else {
    const [seq] = await tx.query<{ ref: string }>("select 'MS' || nextval('public.vehicle_ref_seq')::text as ref");
    const ref = d.ref_no || seq.ref;
    const make = d.make_id ? (await tx.query<{ name: string }>("select name from public.makes where id = $1", [d.make_id]))[0]?.name : "";
    const model = modelId ? (await tx.query<{ name: string }>("select name from public.models where id = $1", [modelId]))[0]?.name : "";
    const slug = d.slug || slugify(`${d.reg_year ?? ""} ${make} ${model} ${ref}`) || slugify(ref);
    const [row] = await tx.query<{ id: string }>(
      `insert into public.vehicles (ref_no, slug, status, ${names.join(", ")}) values ($1, $2, 'draft', ${names.map((_, i) => `$${i + 3}`).join(", ")}) returning id`,
      [ref, slug, ...values],
    );
    id = row.id;
  }

  // Translations: one row per language; English is the fallback.
  for (const locale of LOCALES) {
    const title = String(formData.get(`title_${locale}`) ?? "").trim().slice(0, 200) || null;
    const description = String(formData.get(`description_${locale}`) ?? "").trim().slice(0, 10000) || null;
    const remarks = String(formData.get(`remarks_${locale}`) ?? "").trim().slice(0, 4000) || null;
    if (!title && !description && !remarks) {
      await tx.query("delete from public.vehicle_translations where vehicle_id = $1 and locale = $2", [id, locale]);
    } else {
      await tx.query(
        `insert into public.vehicle_translations (vehicle_id, locale, title, description, remarks) values ($1, $2, $3, $4, $5)
         on conflict (vehicle_id, locale) do update set title = excluded.title, description = excluded.description, remarks = excluded.remarks`,
        [id, locale, title, description, remarks],
      );
    }
  }

  // Features: replace the set.
  const features = formData.getAll("features").map(String).filter((f) => /^[a-z0-9_]{1,40}$/.test(f)).slice(0, 80);
  await tx.query("delete from public.vehicle_features where vehicle_id = $1", [id]);
  if (features.length) {
    await tx.query(
      "insert into public.vehicle_features (vehicle_id, feature_code) select $1, code from public.features where code = any($2::text[])",
      [id, `{${features.join(",")}}`],
    );
  }

  // Private purchase data: admin only (RLS enforces this too).
  if (isAdmin) {
    await tx.query(
      `insert into public.vehicle_private (vehicle_id, internal_cost_jpy, internal_cost_usd, supplier, auction_house, purchase_date, internal_notes, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, auth.uid())
       on conflict (vehicle_id) do update set internal_cost_jpy = excluded.internal_cost_jpy, internal_cost_usd = excluded.internal_cost_usd,
         supplier = excluded.supplier, auction_house = excluded.auction_house, purchase_date = excluded.purchase_date,
         internal_notes = excluded.internal_notes, updated_by = auth.uid()`,
      [id, d.internal_cost_jpy, d.internal_cost_usd, d.supplier, d.auction_house, d.purchase_date, d.internal_notes],
    );
  }
  return id!;
}

export async function saveVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  const isNew = !formData.get("id");
  let id: string;
  try {
    id = await withDb((tx) => saveVehicleRecord(tx, formData, viewer.isAdmin));
  } catch (err) {
    return { error: describeError(err) };
  }
  if (isNew) redirect(`/admin/vehicles/${id}?created=1`);
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/admin/vehicles/${id}`);
  revalidatePath("/admin/vehicles");
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
}

export async function setVehicleStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z.object({ id: z.uuid(), status: z.enum(["draft", "published", "archived"]) }).parse({ id: formData.get("id"), status: formData.get("status") });
    await tx.query("update public.vehicles set status = $2 where id = $1", [d.id, d.status]);
    return { published: "Published — now visible on the website", draft: "Moved back to draft (hidden from the website)", archived: "Archived" }[d.status];
  }, ["/admin/vehicles", "/"]);
}

export async function deleteDraftVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  try {
    const id = z.uuid().parse(formData.get("id"));
    const removed = await withDb(async (tx) => {
      const media = await tx.query<{ bucket: Bucket; storage_path: string }>("select bucket, storage_path from public.vehicle_media where vehicle_id = $1", [id]);
      const rows = await tx.query("delete from public.vehicles where id = $1 and status = 'draft' returning id", [id]);
      if (!rows.length) throw new Error(viewer.isAdmin ? "Only drafts can be deleted — archive published vehicles instead" : "Only the owner/admin can delete drafts");
      return media;
    });
    for (const m of removed) if (!m.storage_path.startsWith("demo/")) await removeObject(m.bucket, m.storage_path).catch(() => undefined);
  } catch (err) {
    return { error: describeError(err) };
  }
  redirect("/admin/vehicles?deleted=1");
}

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------
const mediaSchema = z.object({
  vehicleId: z.uuid(),
  kind: z.enum(["photo", "inspection_sheet", "auction_sheet", "view360", "other"]),
  visibility: z.enum(["public", "private"]),
});

export async function uploadVehicleMedia(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = mediaSchema.parse({ vehicleId: formData.get("vehicleId"), kind: formData.get("kind"), visibility: formData.get("visibility") });
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Choose at least one file");
    if (files.length > uploadLimits.maxPhotosPerUpload) throw new Error(`Upload at most ${uploadLimits.maxPhotosPerUpload} files at a time`);
    const bucket: Bucket = d.visibility === "public" ? "vehicle-photos" : "vehicle-internal";
    const allowed = d.kind === "photo" || d.kind === "view360" ? uploadLimits.photoMimeTypes : uploadLimits.documentMimeTypes;
    const [{ max }] = await tx.query<{ max: number }>("select coalesce(max(sort_order), 0)::int as max from public.vehicle_media where vehicle_id = $1", [d.vehicleId]);

    const prepared: { path: string; bytes: Uint8Array; mime: string }[] = [];
    for (const [i, file] of files.entries()) {
      if (file.size > uploadLimits.maxBytes) throw new Error(`${file.name} is larger than 10 MB`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = sniffMime(bytes);
      if (!mime || !(allowed as readonly string[]).includes(mime)) throw new Error(`${file.name}: unsupported file type`);
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[mime];
      const path = `${d.vehicleId}/${randomUUID()}.${ext}`;
      await tx.query(
        `insert into public.vehicle_media (vehicle_id, kind, bucket, storage_path, is_public, sort_order, mime_type, size_bytes)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [d.vehicleId, d.kind, bucket, path, d.visibility === "public", max + i + 1, mime, bytes.length],
      );
      prepared.push({ path, bytes, mime });
    }
    for (const p of prepared) await putObject(bucket, p.path, p.bytes, p.mime);
    return `${prepared.length} file${prepared.length === 1 ? "" : "s"} uploaded`;
  }, ["/admin/vehicles", "/"]);
}

export async function deleteVehicleMedia(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const id = z.uuid().parse(formData.get("mediaId"));
    const [m] = await tx.query<{ bucket: Bucket; storage_path: string }>("delete from public.vehicle_media where id = $1 returning bucket, storage_path", [id]);
    if (!m) throw new Error("File not found");
    if (!m.storage_path.startsWith("demo/")) await removeObject(m.bucket, m.storage_path);
    return "File removed";
  }, ["/admin/vehicles", "/"]);
}

export async function makeCoverPhoto(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const id = z.uuid().parse(formData.get("mediaId"));
    await tx.query(
      `update public.vehicle_media set sort_order = (select coalesce(min(sort_order), 0) - 1 from public.vehicle_media m2
         where m2.vehicle_id = vehicle_media.vehicle_id) where id = $1`,
      [id],
    );
    return "Cover photo updated";
  }, ["/admin/vehicles", "/"]);
}
