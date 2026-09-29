import { seedVehicles } from "@/lib/demo/seed-data";
import { renderSheetArt, renderVehicleArt } from "@/lib/demo/vehicle-art";

/** Public placeholder photos for seeded demo vehicles: /media/demo/{ref}/{n}.svg */
export async function GET(_request: Request, ctx: RouteContext<"/media/demo/[...path]">) {
  const { path } = await ctx.params;
  const [ref, file] = path;
  const vehicle = seedVehicles.find((v) => v.ref === ref);
  if (!vehicle || !file) return new Response("Not found", { status: 404 });

  let svg: string | null = null;
  if (file === "inspection.svg") {
    svg = renderSheetArt({ ref, title: vehicle.en.title, grade: vehicle.conditionGrade, kind: "inspection" });
  } else {
    const n = Number(/^(\d+)\.svg$/.exec(file)?.[1]);
    if (n >= 1 && n <= 12) {
      svg = renderVehicleArt({ body: vehicle.body, color: vehicle.colorHex, ref, view: n, label: vehicle.en.title });
    }
  }
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
