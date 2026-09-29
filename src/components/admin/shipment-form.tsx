import { updateShipment } from "@/app/admin/actions/deals";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Label } from "@/components/admin/kit";
import { adminT } from "@/lib/i18n/admin/en";

export type ShipmentValues = {
  id: string; status: string; method: string | null; vessel_name: string | null; voyage_no: string | null; port_of_loading: string | null;
  port_of_discharge: string | null; etd: string | null; eta: string | null; bl_number: string | null; container_no: string | null;
};

export function ShipmentForm({ shipment, compact }: { shipment: ShipmentValues; compact?: boolean }) {
  const field = (name: string, label: string, value: string | null, type = "text", max = 120) => (
    <div>
      <Label htmlFor={`${name}-${shipment.id}`} optional>{label}</Label>
      <input id={`${name}-${shipment.id}`} name={name} type={type} defaultValue={value ?? ""} maxLength={max} className="input" />
    </div>
  );
  return (
    <ActionForm action={updateShipment} className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      <input type="hidden" name="shipmentId" value={shipment.id} />
      <div>
        <Label htmlFor={`status-${shipment.id}`}>Stage</Label>
        <select id={`status-${shipment.id}`} name="status" defaultValue={shipment.status} className="input">
          {Object.entries(adminT.status.shipment).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`method-${shipment.id}`} optional>Method</Label>
        <select id={`method-${shipment.id}`} name="method" defaultValue={shipment.method ?? ""} className="input">
          <option value="">—</option><option value="roro">RoRo</option><option value="container">Container</option>
        </select>
      </div>
      {field("vesselName", "Vessel", shipment.vessel_name)}
      {field("voyageNo", "Voyage", shipment.voyage_no, "text", 40)}
      {field("portOfLoading", "Port of loading", shipment.port_of_loading)}
      {field("portOfDischarge", "Port of discharge", shipment.port_of_discharge)}
      {field("etd", "ETD", shipment.etd, "date")}
      {field("eta", "ETA", shipment.eta, "date")}
      {field("blNumber", "B/L number", shipment.bl_number, "text", 60)}
      {field("containerNo", "Container no.", shipment.container_no, "text", 40)}
      <div className={compact ? "sm:col-span-2" : "sm:col-span-3"}>
        <Label htmlFor={`note-${shipment.id}`} optional>Update note (shown to the customer)</Label>
        <input id={`note-${shipment.id}`} name="note" maxLength={1000} className="input" placeholder="e.g. Vessel departed Yokohama" />
      </div>
      <div className={compact ? "sm:col-span-2" : "sm:col-span-3"}>
        <SubmitButton pendingLabel="Saving…">Save shipping update</SubmitButton>
      </div>
    </ActionForm>
  );
}
