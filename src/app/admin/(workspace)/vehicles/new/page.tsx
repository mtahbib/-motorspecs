import { PageHeader, Panel } from "@/components/admin/kit";
import { Checklist, VEHICLE_FORM_ID, VehicleEditor } from "@/components/admin/vehicle-editor";
import { buttonClass } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { loadVehicleLookups } from "@/lib/queries/vehicles-admin";

export const metadata = { title: "New vehicle" };

export default async function NewVehiclePage() {
  const viewer = await requireStaff();
  const lookups = await withDb(loadVehicleLookups);
  return (
    <div>
      <PageHeader
        back={{ href: "/admin/vehicles", label: "Vehicles" }}
        title="New vehicle"
        description="Fill in what you know now — every field can be left empty for a draft. Photos can be added after the first save."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <VehicleEditor vehicle={null} translations={[]} featureCodes={[]} privateInfo={null} lookups={lookups} isAdmin={viewer.isAdmin} />
        <aside className="hidden lg:block">
          <div className="sticky top-4 flex flex-col gap-4">
            <Panel title="Save">
              <button type="submit" form={VEHICLE_FORM_ID} className={buttonClass("primary", "lg", "w-full")}>Save as draft</button>
              <p className="mt-2 text-xs text-muted">New vehicles are saved as drafts and are not visible on the website until published.</p>
            </Panel>
            <Panel title="Checklist">
              <Checklist blockers={["make", "model", "body_type", "year", "mileage", "title_en", "photo"]} recommended={[{ label: "At least 6 photos", done: false }, { label: "Japanese and Arabic descriptions", done: false }]} />
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  );
}
