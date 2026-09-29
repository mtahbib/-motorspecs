import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";

export function SiteFooter({ locale, dict, demo }: { locale: Locale; dict: Dictionary; demo: boolean }) {
  const t = dict.common;
  return (
    <footer className="mt-20 bg-graphite text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Image src="/brand/motorspecs-logo-light.png" alt="MotorSpecs" width={1080} height={240} className="h-8 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{t.footerTagline}</p>
          {demo && <p className="mt-4 max-w-md rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-[#ffd28a]">{t.footerDemoNote}</p>}
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Footer">
          <Link className="hover:text-white" href={`/${locale}/vehicles`}>{t.stock}</Link>
          <Link className="hover:text-white" href={`/${locale}#how-it-works`}>{t.howToBuy}</Link>
          <Link className="hover:text-white" href={`/${locale}/account`}>{t.myAccount}</Link>
        </nav>
        <div className="flex flex-col gap-2 text-sm">
          <Link className="hover:text-white" href="/admin">{t.adminWorkspace}</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/45 sm:px-6">
          © {new Date().getFullYear()} MotorSpecs. {t.footerRights}
        </p>
      </div>
    </footer>
  );
}
