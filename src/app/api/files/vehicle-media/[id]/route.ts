import { withDb } from "@/lib/auth/session";
import { seedVehicles } from "@/lib/demo/seed-data";
import { renderSheetArt } from "@/lib/demo/vehicle-art";
import { getObject, type Bucket } from "@/lib/storage";

/**
 * Private vehicle media (auction sheets, internal photos). The media row is
 * read through RLS as the current user, so only staff get past this point;
 * in Supabase mode the storage download is also subject to storage RLS.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/vehicle-media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const media = await withDb(async (tx) => {
    const [row] = await tx.query<{ bucket: Bucket; storage_path: string; mime_type: string | null; ref_no: string }>(
      `select m.bucket, m.storage_path, m.mime_type, v.ref_no
         from public.vehicle_media m join public.vehicles v on v.id = m.vehicle_id where m.id = $1`,
      [id],
    );
    return row;
  }).catch(() => undefined);
  if (!media) return new Response("Not found", { status: 404 });

  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

  if (media.storage_path.startsWith("demo/")) {
    const vehicle = seedVehicles.find((v) => v.ref === media.ref_no);
    const svg = renderSheetArt({ ref: media.ref_no, title: vehicle?.en.title ?? media.ref_no, grade: vehicle?.conditionGrade, kind: "auction" });
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }

  const object = await getObject(media.bucket, media.storage_path);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(object.bytes), { headers: { ...headers, "Content-Type": media.mime_type ?? object.contentType } });
}
