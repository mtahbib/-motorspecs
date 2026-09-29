import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { respondToOffer } from "@/app/actions/customer";
import { MessageThread } from "@/components/message-thread";
import { OfferCard } from "@/components/offer-card";
import { VehicleThumb } from "@/components/portal/inquiry-list";
import { CounterOfferForm, CustomerReplyForm } from "@/components/portal/reply-forms";
import { Button, StatusBadge } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getMyInquiry } from "@/lib/queries/portal";

export default async function InquiryDetailPage({ params }: PageProps<"/[locale]/account/inquiries/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const data = await withDb((tx) => getMyInquiry(tx, id, locale));
  if (!data) notFound();
  const { inquiry, messages, offers } = data;
  const closed = ["won", "lost", "closed"].includes(inquiry.status);
  const canCounter = !closed && inquiry.vehicle?.status === "published";

  const offerLabels = {
    kinds: t.offerKinds, statuses: t.offerStatus, validUntil: t.validUntil, freight: t.freight,
    insurance: t.insurance, inspection: t.inspection, total: t.total, incoterm: t.incoterm,
  };

  return (
    <div>
      <Link href={`/${locale}/account/inquiries`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden /> {t.inquiriesTitle}
      </Link>

      <div className="card mb-6 flex flex-wrap items-center gap-4 p-4">
        <VehicleThumb cover={inquiry.vehicle?.cover} className="h-16 w-24" />
        <div className="min-w-0 flex-1">
          <p className="num text-xs text-muted" dir="ltr">{inquiry.ref_no}</p>
          <h1 className="font-display text-xl font-bold leading-tight">
            {inquiry.vehicle ? (
              <Link href={`/${locale}/vehicles/${inquiry.vehicle.slug}`} className="hover:text-brand">{inquiry.vehicle.title}</Link>
            ) : (
              inquiry.subject
            )}
          </h1>
        </div>
        <StatusBadge status={inquiry.status} label={t.inquiryStatus[inquiry.status as keyof typeof t.inquiryStatus]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card flex flex-col p-4 sm:p-5">
          <h2 className="label-caps mb-4">{t.conversation}</h2>
          <MessageThread messages={messages} perspective="customer" locale={locale} labels={{ you: t.you, them: t.motorspecs, system: t.system }} />
          <div className="mt-5 border-t border-line pt-4">
            {closed ? (
              <p className="text-sm text-muted">{t.replyClosed}</p>
            ) : (
              <CustomerReplyForm inquiryId={inquiry.id} locale={locale} labels={{ placeholder: t.reply, send: dict.common.send }} />
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <h2 className="label-caps">{t.offers}</h2>
          {offers.length === 0 && <p className="text-sm text-muted">—</p>}
          {offers.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              locale={locale}
              labels={offerLabels}
              actions={
                o.status === "pending" && o.kind !== "customer_offer" ? (
                  <>
                    <form action={respondToOffer}>
                      <input type="hidden" name="offerId" value={o.id} />
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="decision" value="accept" />
                      <Button size="sm">{t.accept}</Button>
                    </form>
                    <form action={respondToOffer}>
                      <input type="hidden" name="offerId" value={o.id} />
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="decision" value="decline" />
                      <Button size="sm" variant="secondary">{t.decline}</Button>
                    </form>
                  </>
                ) : undefined
              }
            />
          ))}
          {canCounter && (
            <div className="card p-4">
              <p className="mb-2 text-sm font-semibold">{t.newOffer}</p>
              <CounterOfferForm inquiryId={inquiry.id} locale={locale} labels={{ amount: dict.inquiry.offerAmount, submit: dict.inquiry.submitOffer }} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
