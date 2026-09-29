import { isDemoMode, supabaseConfig } from "../config";

/**
 * Browser URL for vehicle media.
 * - Private media (vehicle-internal bucket) always go through
 *   /api/files/vehicle-media/:id, which checks the caller's rights first.
 * - Seeded demo photos (`demo/...`) are drawn on the fly by /media/demo.
 * - Public photos come straight from the public bucket (CDN) in Supabase mode.
 */
export function vehicleMediaUrl(media: { id?: string; bucket: string | null; storage_path: string | null }): string | null {
  if (!media.storage_path || !media.bucket) return null;
  if (media.bucket !== "vehicle-photos") return media.id ? `/api/files/vehicle-media/${media.id}` : null;
  if (media.storage_path.startsWith("demo/")) return `/media/${media.storage_path}`;
  return isDemoMode
    ? `/media/vehicle-photos/${media.storage_path}`
    : `${supabaseConfig.url}/storage/v1/object/public/vehicle-photos/${media.storage_path}`;
}
