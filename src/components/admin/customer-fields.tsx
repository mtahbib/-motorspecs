import { Label } from "@/components/admin/kit";
import { COUNTRY_CODES, countryName } from "@/lib/format";

type CustomerValues = Partial<{
  full_name: string; company_name: string | null; email: string | null; phone: string | null; whatsapp: string | null;
  country_code: string | null; city: string | null; address_line: string | null; postal_code: string | null;
  destination_port: string | null; preferred_language: string; preferred_contact: string;
}>;

/** Contact/profile fields shared by the create and edit customer forms. */
export function CustomerFields({ values = {} }: { values?: CustomerValues }) {
  const countries = [...new Set([...COUNTRY_CODES, ...(values.country_code ? [values.country_code] : [])])]
    .map((c) => [c, countryName(c)] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const input = (name: keyof CustomerValues, label: string, opts: { required?: boolean; type?: string; max?: number } = {}) => (
    <div>
      <Label htmlFor={`c-${name}`} optional={!opts.required}>{label}</Label>
      <input id={`c-${name}`} name={name} type={opts.type ?? "text"} required={opts.required} maxLength={opts.max} defaultValue={(values[name] as string | null) ?? ""} className="input" />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {input("full_name", "Full name", { required: true, max: 160 })}
      {input("company_name", "Company", { max: 160 })}
      {input("email", "Email", { type: "email", max: 254 })}
      {input("phone", "Phone", { type: "tel", max: 40 })}
      {input("whatsapp", "WhatsApp", { type: "tel", max: 40 })}
      <div>
        <Label htmlFor="c-country" optional>Country</Label>
        <select id="c-country" name="country_code" defaultValue={values.country_code ?? ""} className="input">
          <option value="">—</option>
          {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {input("city", "City", { max: 120 })}
      {input("postal_code", "Postal code", { max: 20 })}
      <div className="sm:col-span-2">{input("address_line", "Address", { max: 300 })}</div>
      {input("destination_port", "Destination port", { max: 120 })}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="c-lang">Language</Label>
          <select id="c-lang" name="preferred_language" defaultValue={values.preferred_language ?? "en"} className="input">
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div>
          <Label htmlFor="c-contact">Contact by</Label>
          <select id="c-contact" name="preferred_contact" defaultValue={values.preferred_contact ?? "email"} className="input">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>
    </div>
  );
}
