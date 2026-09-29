import { isDemoMode } from "@/lib/config";
import { getObject } from "@/lib/storage";

/**
 * Demo mode only: serves photos uploaded to the local `vehicle-photos` store
 * (in Supabase mode the public bucket URL is used directly).
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/vehicle-photos/[...path]">) {
  if (!isDemoMode) return new Response("Not found", { status: 404 });
  const { path } = await ctx.params;
  const object = await getObject("vehicle-photos", path.join("/"));
  if (!object || !object.contentType.startsWith("image/")) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
