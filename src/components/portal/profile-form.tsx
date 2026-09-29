"use client";

import { useFormAction } from "@/lib/use-form-action";
import { updateProfile } from "@/app/actions/customer";
import { Alert, Button, Field } from "@/components/ui";
import type { MyCustomer } from "@/lib/queries/portal";

type Labels = Record<
  | "fullName" | "company" | "phone" | "whatsapp" | "country" | "city" | "address" | "postalCode" | "destinationPort"
  | "preferredLanguage" | "preferredContact" | "save" | "saving" | "optional",
  string
>;

export function ProfileForm({
  locale,
  customer,
  labels,
  countries,
  contactValues,
  languages,
}: {
  locale: string;
  customer: MyCustomer;
  labels: Labels;
  countries: [string, string][];
  contactValues: Record<string, string>;
  languages: [string, string][];
}) {
  const { state, pending, onSubmit } = useFormAction(updateProfile);
  const err = (k: string) => state?.fieldErrors?.[k];
  const text = (name: keyof MyCustomer, label: string, opts: { optional?: boolean; type?: string; max?: number; ltr?: boolean; auto?: string } = {}) => (
    <Field label={label} htmlFor={name} optional={opts.optional ? labels.optional : undefined} error={err(name)}>
      <input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        defaultValue={(customer[name] as string | null) ?? ""}
        required={!opts.optional}
        maxLength={opts.max}
        autoComplete={opts.auto}
        dir={opts.ltr ? "ltr" : undefined}
        className="input"
        aria-invalid={!!err(name)}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      <input type="hidden" name="locale" value={locale} />
      {text("full_name", labels.fullName, { max: 160, auto: "name" })}
      {text("company_name", labels.company, { optional: true, max: 160, auto: "organization" })}
      {text("phone", labels.phone, { optional: true, type: "tel", max: 40, ltr: true, auto: "tel" })}
      {text("whatsapp", labels.whatsapp, { optional: true, type: "tel", max: 40, ltr: true })}
      <Field label={labels.country} htmlFor="country_code" optional={labels.optional}>
        <select id="country_code" name="country_code" defaultValue={customer.country_code ?? ""} className="input">
          <option value="">—</option>
          {countries.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </Field>
      {text("city", labels.city, { optional: true, max: 120, auto: "address-level2" })}
      <div className="sm:col-span-2">{text("address_line", labels.address, { optional: true, max: 300, auto: "street-address" })}</div>
      {text("postal_code", labels.postalCode, { optional: true, max: 20, ltr: true, auto: "postal-code" })}
      {text("destination_port", labels.destinationPort, { optional: true, max: 120 })}
      <Field label={labels.preferredLanguage} htmlFor="preferred_language">
        <select id="preferred_language" name="preferred_language" defaultValue={customer.preferred_language} className="input">
          {languages.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </Field>
      <Field label={labels.preferredContact} htmlFor="preferred_contact">
        <select id="preferred_contact" name="preferred_contact" defaultValue={customer.preferred_contact} className="input">
          {Object.entries(contactValues).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? labels.saving : labels.save}</Button>
        {state?.ok && <Alert tone="ok" className="py-2">{state.message}</Alert>}
        {state?.error && <Alert tone="danger" className="py-2">{state.error}</Alert>}
      </div>
    </form>
  );
}
