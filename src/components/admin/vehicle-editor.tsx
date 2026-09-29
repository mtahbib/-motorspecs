import { CheckCircle2, Circle, Lock, Star } from "lucide-react";
import { saveVehicle } from "@/app/admin/actions/vehicles";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldHint, Label, Panel } from "@/components/admin/kit";
import { LangTabs } from "@/components/admin/lang-tabs";
import { MakeModelSelect } from "@/components/admin/make-model-select";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/i18n/admin/en";

export type VehicleRecord = Record<string, string | number | boolean | null> & { id: string; status: string };
export type Translation = { locale: string; title: string | null; description: string | null; remarks: string | null };
export type PrivateInfo = {
  internal_cost_jpy: number | null; internal_cost_usd: number | null; supplier: string | null; auction_house: string | null;
  purchase_date: string | null; internal_notes: string | null;
};
export type Lookups = {
  makes: { id: number; name: string }[];
  models: { id: number; make_id: number; name: string }[];
  bodyTypes: { code: string }[];
  locations: { id: number; name: string }[];
  features: { code: string; category: string }[];
};

const en = getDictionary("en").vehicle;

export const VEHICLE_FORM_ID = "vehicle-form";

/**
 * The vehicle CMS form. Every field is optional for a draft; the publish
 * checklist (enforced again by the database) lists what is still needed.
 */
export function VehicleEditor({
  vehicle,
  translations,
  featureCodes,
  privateInfo,
  lookups,
  isAdmin,
}: {
  vehicle: VehicleRecord | null;
  translations: Translation[];
  featureCodes: string[];
  privateInfo: PrivateInfo | null;
  lookups: Lookups;
  isAdmin: boolean;
}) {
  const v = (key: string) => (vehicle?.[key] ?? "") as string | number;
  const tr = (locale: string) => translations.find((t) => t.locale === locale);
  const selectedFeatures = new Set(featureCodes);
  const num = (name: string, label: string, opts: { unit?: string; step?: string; min?: number; max?: number; hint?: string } = {}) => (
    <div>
      <Label htmlFor={`v-${name}`} optional>{label}{opts.unit && <span className="font-normal text-muted"> ({opts.unit})</span>}</Label>
      <input id={`v-${name}`} name={name} type="number" inputMode="decimal" step={opts.step ?? "1"} min={opts.min ?? 0} max={opts.max} defaultValue={v(name) as number} className="input num" />
      {opts.hint && <FieldHint>{opts.hint}</FieldHint>}
    </div>
  );
  const txt = (name: string, label: string, opts: { max?: number; placeholder?: string; hint?: string; upper?: boolean } = {}) => (
    <div>
      <Label htmlFor={`v-${name}`} optional>{label}</Label>
      <input id={`v-${name}`} name={name} maxLength={opts.max ?? 120} placeholder={opts.placeholder} defaultValue={v(name) as string} className={`input ${opts.upper ? "uppercase" : ""}`} />
      {opts.hint && <FieldHint>{opts.hint}</FieldHint>}
    </div>
  );
  const sel = (name: string, label: string, options: [string, string][]) => (
    <div>
      <Label htmlFor={`v-${name}`} optional>{label}</Label>
      <select id={`v-${name}`} name={name} defaultValue={String(v(name) ?? "")} className="input">
        <option value="">Not specified</option>
        {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
      </select>
    </div>
  );
  const months: [string, string][] = Array.from({ length: 12 }, (_, i) => [String(i + 1), new Date(Date.UTC(2020, i, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" })]);
  const byCategory = lookups.features.reduce<Record<string, string[]>>((acc, f) => ((acc[f.category] ??= []).push(f.code), acc), {});

  return (
    <ActionForm id={VEHICLE_FORM_ID} action={saveVehicle} className="flex flex-col gap-6">
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}

      <nav className="scrollbar-none sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-page/90 px-1 py-2 backdrop-blur lg:top-0" aria-label="Form sections">
        {["Identity", "Classification", "Specifications", "Customs", "Pricing", "Description", "Features", ...(isAdmin ? ["Private"] : [])].map((s) => (
          <a key={s} href={`#sec-${s.toLowerCase()}`} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted hover:text-ink">{s}</a>
        ))}
      </nav>

      <Panel title="Identity" id="sec-identity">
        <div className="grid gap-4 sm:grid-cols-3">
          {txt("ref_no", "Reference no.", { max: 30, placeholder: "Auto (e.g. MS24100)", hint: "Leave blank to generate", upper: true })}
          {txt("slug", "URL slug", { max: 120, placeholder: "Auto from year, make, model", hint: "Lowercase words and dashes" })}
          {txt("chassis_no", "Chassis number", { max: 40, upper: true })}
          {txt("model_code", "Model code", { max: 40, placeholder: "e.g. CBA-TRJ150W", upper: true })}
          {txt("engine_code", "Engine code", { max: 40, upper: true })}
          {txt("condition_grade", "Condition / auction grade", { max: 10, placeholder: "e.g. 4.5, R" })}
          <div className="sm:col-span-3">{txt("auction_sheet_ref", "Auction sheet reference", { max: 80 })}</div>
        </div>
      </Panel>

      <Panel title="Classification" id="sec-classification">
        <div className="grid gap-4 sm:grid-cols-3">
          <MakeModelSelect makes={lookups.makes} models={lookups.models} defaultMake={(vehicle?.make_id as number) ?? null} defaultModel={(vehicle?.model_id as number) ?? null} />
          {sel("body_type", "Body type", lookups.bodyTypes.map((b) => [b.code, en.bodyTypes[b.code as keyof typeof en.bodyTypes] ?? b.code]))}
          {sel("location_id", "Inventory location", lookups.locations.map((l) => [String(l.id), l.name]))}
          <div className="grid grid-cols-2 gap-2">
            {num("reg_year", "Reg. year", { min: 1950, max: 2100 })}
            {sel("reg_month", "Month", months)}
          </div>
          {num("manufacture_year", "Manufacture year", { min: 1950, max: 2100 })}
          <div className="sm:col-span-3">{txt("grade", "Grade / trim", { max: 120, placeholder: "e.g. TX-L Package" })}</div>
        </div>
      </Panel>

      <Panel title="Specifications" id="sec-specifications">
        <div className="grid gap-4 sm:grid-cols-3">
          {num("mileage_km", "Mileage", { unit: "km", hint: "For cars and trucks" })}
          {num("operating_hours", "Operating hours", { unit: "h", hint: "For machinery — leave mileage blank" })}
          {num("engine_cc", "Engine size", { unit: "cc", max: 30000 })}
          {sel("transmission", "Transmission", Object.entries(en.transmissionValues))}
          {sel("fuel", "Fuel", Object.entries(en.fuelValues))}
          {sel("drive", "Drive type", Object.entries(en.driveValues))}
          {sel("steering", "Steering", Object.entries(en.steeringValues))}
          {txt("exterior_color", "Exterior colour", { max: 60 })}
          {txt("interior_color", "Interior colour", { max: 60 })}
          {num("doors", "Doors", { max: 8 })}
          {num("seats", "Seats", { max: 60 })}
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold">
            <input type="checkbox" name="has_360_view" defaultChecked={!!vehicle?.has_360_view} className="size-4 accent-brand" /> 360° view available
          </label>
        </div>
      </Panel>

      <Panel title="Customs & shipping information" id="sec-customs">
        <div className="grid gap-4 sm:grid-cols-4">
          {num("length_mm", "Length", { unit: "mm" })}
          {num("width_mm", "Width", { unit: "mm" })}
          {num("height_mm", "Height", { unit: "mm" })}
          {num("m3", "Cubic measurement", { unit: "M3", step: "0.01", hint: "Used for freight quotes" })}
          {num("weight_kg", "Vehicle weight", { unit: "kg" })}
          {num("gross_weight_kg", "Gross weight", { unit: "kg" })}
          {num("max_load_kg", "Loading capacity", { unit: "kg" })}
          <div />
          {txt("tyre_front", "Tyre size (front)", { max: 40, placeholder: "e.g. 265/65R17" })}
          {txt("tyre_rear", "Tyre size (rear)", { max: 40 })}
        </div>
      </Panel>

      <Panel title="Pricing" id="sec-pricing">
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold">Price on the website</legend>
          <div className="flex flex-wrap gap-3">
            {[
              ["public", "Show FOB price (USD)"],
              ["ask", "“Ask for price” — hide the amount"],
            ].map(([val, text]) => (
              <label key={val} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-soft/50">
                <input type="radio" name="price_visibility" value={val} defaultChecked={(vehicle?.price_visibility ?? "public") === val} className="accent-brand" /> {text}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          {num("fob_price_usd", "FOB price", { unit: "USD", hint: "Kept internally even when hidden" })}
          {num("previous_price_usd", "Previous price", { unit: "USD", hint: "Shown struck through if higher" })}
          <label className="flex items-center gap-2 self-center text-sm font-semibold">
            <input type="checkbox" name="is_featured" defaultChecked={!!vehicle?.is_featured} className="size-4 accent-brand" />
            <Star className="size-4 text-warn" aria-hidden /> Featured on the homepage
          </label>
        </div>
      </Panel>

      <Panel title="Description & remarks" id="sec-description">
        <LangTabs
          tabs={[
            { key: "en", label: "English (required)" },
            { key: "ja", label: "日本語" },
            { key: "ar", label: "العربية" },
          ].map(({ key, label }) => ({
            key,
            label,
            content: (
              <div className="grid gap-3" lang={key} dir={key === "ar" ? "rtl" : "ltr"}>
                <div>
                  <Label htmlFor={`title_${key}`} optional={key !== "en"}>Title</Label>
                  <input id={`title_${key}`} name={`title_${key}`} maxLength={200} defaultValue={tr(key)?.title ?? ""} className="input" />
                </div>
                <div>
                  <Label htmlFor={`description_${key}`} optional>Description</Label>
                  <textarea id={`description_${key}`} name={`description_${key}`} rows={5} maxLength={10000} defaultValue={tr(key)?.description ?? ""} className="input" />
                </div>
                <div>
                  <Label htmlFor={`remarks_${key}`} optional>Remarks (condition notes, what is included)</Label>
                  <textarea id={`remarks_${key}`} name={`remarks_${key}`} rows={2} maxLength={4000} defaultValue={tr(key)?.remarks ?? ""} className="input" />
                </div>
                {key !== "en" && <FieldHint>Leave empty to show the English text (with a note) to {key === "ja" ? "Japanese" : "Arabic"} visitors.</FieldHint>}
              </div>
            ),
          }))}
        />
      </Panel>

      <Panel title="Features & options" id="sec-features">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byCategory).map(([category, codes]) => (
            <fieldset key={category}>
              <legend className="label-caps mb-2">{en.featureCategories[category as keyof typeof en.featureCategories]}</legend>
              <div className="flex flex-col gap-1.5">
                {codes.map((code) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="features" value={code} defaultChecked={selectedFeatures.has(code)} className="size-4 accent-brand" />
                    {en.featureNames[code as keyof typeof en.featureNames] ?? code}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Panel>

      {isAdmin && (
        <Panel title={<span className="inline-flex items-center gap-2"><Lock className="size-4 text-muted" /> Private purchase data (admin only)</span>} id="sec-private">
          <p className="mb-4 text-sm text-muted">Never shown on the website or to salespeople. Stored in a separate table protected by admin-only security rules.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="p-jpy" optional>Internal cost (JPY)</Label><input id="p-jpy" name="internal_cost_jpy" type="number" min={0} step="any" defaultValue={privateInfo?.internal_cost_jpy ?? ""} className="input num" /></div>
            <div><Label htmlFor="p-usd" optional>Internal cost (USD)</Label><input id="p-usd" name="internal_cost_usd" type="number" min={0} step="any" defaultValue={privateInfo?.internal_cost_usd ?? ""} className="input num" /></div>
            <div><Label htmlFor="p-date" optional>Purchase date</Label><input id="p-date" name="purchase_date" type="date" defaultValue={privateInfo?.purchase_date ?? ""} className="input" /></div>
            <div><Label htmlFor="p-supplier" optional>Supplier</Label><input id="p-supplier" name="supplier" maxLength={160} defaultValue={privateInfo?.supplier ?? ""} className="input" /></div>
            <div><Label htmlFor="p-auction" optional>Auction house</Label><input id="p-auction" name="auction_house" maxLength={160} defaultValue={privateInfo?.auction_house ?? ""} className="input" /></div>
            <div className="sm:col-span-3"><Label htmlFor="p-notes" optional>Internal notes</Label><textarea id="p-notes" name="internal_notes" rows={2} maxLength={5000} defaultValue={privateInfo?.internal_notes ?? ""} className="input" /></div>
          </div>
        </Panel>
      )}

      <div className="flex items-center gap-3 lg:hidden">
        <SubmitButton size="lg" pendingLabel="Saving…">{vehicle ? "Save changes" : "Save as draft"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function Checklist({ blockers, recommended }: { blockers: string[]; recommended: { label: string; done: boolean }[] }) {
  const required = Object.entries(adminT.blockers);
  return (
    <div>
      <p className="label-caps mb-2">Required to publish</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {required.map(([key, label]) => {
          const done = !blockers.includes(key);
          return (
            <li key={key} className={`flex items-start gap-2 ${done ? "text-muted" : "font-medium text-ink"}`}>
              {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Done" /> : <Circle className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Missing" />}
              {label}
            </li>
          );
        })}
      </ul>
      <p className="label-caps mt-4 mb-2">Recommended</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {recommended.map((r) => (
          <li key={r.label} className="flex items-start gap-2 text-muted">
            {r.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
