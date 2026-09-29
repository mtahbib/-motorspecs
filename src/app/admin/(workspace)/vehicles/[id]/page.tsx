import { ExternalLink, FileText, Lock, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraftVehicle, deleteVehicleMedia, makeCoverPhoto, setVehicleStatus, uploadVehicleMedia } from "@/app/admin/actions/vehicles";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Label, PageHeader, Panel } from "@/components/admin/kit";
import { Checklist, VEHICLE_FORM_ID, VehicleEditor, type PrivateInfo, type Translation, type VehicleRecord } from "@/components/admin/vehicle-editor";
import { Alert, DemoBadge, StatusBadge, buttonClass } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDateTime, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";
import { loadVehicleLookups } from "@/lib/queries/vehicles-admin";
import { vehicleMediaUrl } from "@/lib/storage/urls";

type Media = { id: string; kind: string; bucket: string; storage_path: string; is_public: boolean; sort_order: number; caption: string | null; mime_type: string | null };

export default async function EditVehiclePage({ params, searchParams }: PageProps<"/admin/vehicles/[id]">) {
  const viewer = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT;

  const data = await withDb(async (tx) => {
    const [vehicle] = await tx.query<VehicleRecord & { ref_no: string; slug: string; is_demo: boolean; updated_at: string; published_at: string | null }>(
      "select * from public.vehicles where id = $1",
      [id],
    );
    if (!vehicle) return null;
    const translations = await tx.query<Translation>("select locale, title, description, remarks from public.vehicle_translations where vehicle_id = $1", [id]);
    const features = (await tx.query<{ feature_code: string }>("select feature_code from public.vehicle_features where vehicle_id = $1", [id])).map((f) => f.feature_code);
    const [privateInfo] = viewer.isAdmin ? await tx.query<PrivateInfo>("select * from public.vehicle_private where vehicle_id = $1", [id]) : [];
    const media = await tx.query<Media>("select id, kind, bucket, storage_path, is_public, sort_order, caption, mime_type from public.vehicle_media where vehicle_id = $1 order by sort_order, created_at", [id]);
    const [{ blockers }] = await tx.query<{ blockers: string[] }>("select public.vehicle_publish_blockers($1) as blockers", [id]);
    const history = await tx.query<{ kind: string; at: string; text: string; by: string | null }>(
      `select 'status' as kind, h.changed_at as at, coalesce(h.from_status, '—') || ' → ' || h.to_status as text, (select display_name from public.profiles where id = h.changed_by) as by
         from public.vehicle_status_history h where h.vehicle_id = $1
       union all
       select 'price', p.changed_at, coalesce('USD ' || to_char(p.old_price_usd, 'FM999,999,990'), '—') || ' → ' || coalesce('USD ' || to_char(p.new_price_usd, 'FM999,999,990'), '—')
              || case when p.old_visibility is distinct from p.new_visibility then ' (' || coalesce(p.new_visibility, '') || ')' else '' end,
              (select display_name from public.profiles where id = p.changed_by)
         from public.vehicle_price_history p where p.vehicle_id = $1
       order by at desc limit 20`,
      [id],
    );
    const deals = await tx.query<{ kind: string; id: string; label: string; status: string }>(
      `select 'inquiry' as kind, i.id, i.ref_no || ' · ' || c.full_name as label, i.status from public.inquiries i join public.customers c on c.id = i.customer_id
        where i.vehicle_id = $1 and i.status not in ('lost', 'closed')
       union all
       select 'sale', s.id, s.sale_no || ' · ' || c.full_name, s.status from public.sales s join public.customers c on c.id = s.customer_id where s.vehicle_id = $1`,
      [id],
    );
    return { vehicle, translations, features, privateInfo: privateInfo ?? null, media, blockers, history, deals, lookups: await loadVehicleLookups(tx) };
  });
  if (!data) notFound();
  const v = data.vehicle;
  const status = v.status as keyof typeof t.status.vehicle;
  const photos = data.media.filter((m) => m.kind === "photo");
  const other = data.media.filter((m) => m.kind !== "photo");
  const tr = (l: string) => data.translations.find((x) => x.locale === l);
  const title = tr("en")?.title || v.ref_no;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/vehicles", label: "Vehicles" }}
        title={title}
        meta={
          <>
            <span className="num font-semibold text-ink">{v.ref_no}</span>
            <StatusBadge status={status} label={t.status.vehicle[status]} />
            {v.is_featured && <span className="inline-flex items-center gap-1 text-xs font-semibold text-warn"><Star className="size-3.5 fill-current" /> Featured</span>}
            {v.is_demo && <DemoBadge />}
            <span>· updated {formatDateTime(v.updated_at)}</span>
          </>
        }
        actions={
          status !== "draft" && status !== "archived" ? (
            <Link href={`/en/vehicles/${v.slug}`} target="_blank" className={buttonClass("secondary")}>
              <ExternalLink className="size-4" /> View on website
            </Link>
          ) : undefined
        }
      />
      {sp.created && <Alert tone="ok" className="mb-5">Draft saved. Add photos below, then publish when the checklist is complete.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={`Photos (${photos.length})`} id="sec-media">
            {photos.length === 0 ? (
              <p className="mb-4 text-sm text-muted">No photos yet. The first photo is used as the cover.</p>
            ) : (
              <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {photos.map((m, i) => (
                  <li key={m.id} className="group relative overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vehicleMediaUrl(m) ?? ""} alt={m.caption ?? ""} className="aspect-[16/10] w-full object-cover" />
                    <div className="absolute start-2 top-2 flex gap-1">
                      {i === 0 && <span className="rounded bg-brand px-1.5 text-[0.65rem] font-bold text-white uppercase">Cover</span>}
                      {!m.is_public && <span className="inline-flex items-center gap-0.5 rounded bg-ink px-1.5 text-[0.65rem] font-bold text-white uppercase"><Lock className="size-2.5" /> Private</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 bg-white px-2 py-1.5">
                      {i !== 0 ? (
                        <ActionForm action={makeCoverPhoto}>
                          <input type="hidden" name="mediaId" value={m.id} />
                          <SubmitButton variant="ghost" size="sm" pendingLabel="…">Make cover</SubmitButton>
                        </ActionForm>
                      ) : <span />}
                      <ActionForm action={deleteVehicleMedia} confirm="Remove this photo?">
                        <input type="hidden" name="mediaId" value={m.id} />
                        <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove photo"><Trash2 className="size-4" /></button>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {other.length > 0 && (
              <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
                {other.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileText className="size-4 text-muted" />
                    <a href={vehicleMediaUrl(m) ?? "#"} target="_blank" rel="noopener" className="flex-1 font-medium hover:text-brand">{m.caption ?? m.kind.replace("_", " ")}</a>
                    <span className="text-xs text-muted">{m.kind.replace("_", " ")} · {m.is_public ? "public" : "staff only"}</span>
                    <ActionForm action={deleteVehicleMedia} confirm="Remove this file?">
                      <input type="hidden" name="mediaId" value={m.id} />
                      <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove file"><Trash2 className="size-4" /></button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={uploadVehicleMedia} resetOnSuccess className="grid gap-3 rounded-xl bg-page p-4 sm:grid-cols-3">
              <input type="hidden" name="vehicleId" value={v.id} />
              <div>
                <Label htmlFor="m-kind">Type</Label>
                <select id="m-kind" name="kind" defaultValue="photo" className="input">
                  <option value="photo">Photos</option>
                  <option value="inspection_sheet">Inspection sheet</option>
                  <option value="auction_sheet">Auction sheet</option>
                  <option value="view360">360° images</option>
                  <option value="other">Other media</option>
                </select>
              </div>
              <div>
                <Label htmlFor="m-vis">Visibility</Label>
                <select id="m-vis" name="visibility" defaultValue="public" className="input">
                  <option value="public">Public (website)</option>
                  <option value="private">Staff only (private bucket)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="m-files">Files (max 12 × 10 MB)</Label>
                <input id="m-files" name="files" type="file" multiple required accept="image/jpeg,image/png,image/webp,application/pdf" className="input" />
              </div>
              <div className="sm:col-span-3"><SubmitButton pendingLabel="Uploading…">Upload</SubmitButton></div>
            </ActionForm>
          </Panel>

          <VehicleEditor
            vehicle={v}
            translations={data.translations}
            featureCodes={data.features}
            privateInfo={data.privateInfo}
            lookups={data.lookups}
            isAdmin={viewer.isAdmin}
          />
        </div>

        <aside>
          <div className="sticky top-4 flex flex-col gap-4">
            <Panel title="Publishing">
              <button type="submit" form={VEHICLE_FORM_ID} className={buttonClass("primary", "md", "w-full")}>Save changes</button>
              <div className="mt-4 flex flex-col gap-2">
                {(status === "draft" || status === "archived") && (
                  <ActionForm action={setVehicleStatus}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="status" value="published" />
                    <SubmitButton variant={data.blockers.length ? "secondary" : "dark"} className="w-full" pendingLabel="Publishing…">
                      Publish
                    </SubmitButton>
                    {data.blockers.length > 0 && <p className="mt-1 text-xs text-warn">Save your changes first, then complete the checklist below.</p>}
                  </ActionForm>
                )}
                {status === "published" && (
                  <>
                    <ActionForm action={setVehicleStatus}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="status" value="draft" />
                      <SubmitButton variant="secondary" className="w-full" pendingLabel="…">Unpublish (back to draft)</SubmitButton>
                    </ActionForm>
                    <ActionForm action={setVehicleStatus} confirm="Archive this listing? It disappears from the website.">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="status" value="archived" />
                      <SubmitButton variant="ghost" className="w-full" pendingLabel="…">Archive</SubmitButton>
                    </ActionForm>
                  </>
                )}
                {(status === "reserved" || status === "sold") && (
                  <p className="text-xs text-muted">{status === "reserved" ? "Reserved" : "Sold"} status is controlled by the reservation / sale. Release the reservation or cancel the sale to change it.</p>
                )}
                {status === "draft" && viewer.isAdmin && (
                  <ActionForm action={deleteDraftVehicle} confirm="Permanently delete this draft and its photos?">
                    <input type="hidden" name="id" value={v.id} />
                    <SubmitButton variant="ghost" size="sm" className="w-full text-danger" pendingLabel="…">Delete draft</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Panel>

            <Panel title="Checklist">
              <Checklist
                blockers={data.blockers}
                recommended={[
                  { label: "At least 6 photos", done: photos.length >= 6 },
                  { label: "Chassis number", done: !!v.chassis_no },
                  { label: "English description", done: !!tr("en")?.description },
                  { label: "Japanese translation", done: !!tr("ja")?.title },
                  { label: "Arabic translation", done: !!tr("ar")?.title },
                  { label: "Customs dimensions & M3", done: !!v.m3 },
                ]}
              />
            </Panel>

            {data.deals.length > 0 && (
              <Panel title="Deals on this vehicle">
                <ul className="flex flex-col gap-2 text-sm">
                  {data.deals.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <Link href={d.kind === "sale" ? `/admin/sales/${d.id}` : `/admin/inquiries/${d.id}`} className="truncate hover:text-brand">{d.label}</Link>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="History">
              <ul className="flex flex-col gap-2 text-xs">
                {data.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-semibold">{h.kind === "price" ? "Price" : "Status"}:</span> {h.text}
                    <p className="text-muted">{formatDateTime(h.at)}{h.by && ` · ${h.by}`}</p>
                  </li>
                ))}
              </ul>
              {v.fob_price_usd != null && <p className="mt-3 text-xs text-muted">Current FOB {formatUsd(v.fob_price_usd as number)}</p>}
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  );
}
