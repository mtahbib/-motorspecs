import { Heart, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import type { Viewer } from "@/lib/auth/session";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader({ locale, dict, viewer }: { locale: Locale; dict: Dictionary; viewer: Viewer | null }) {
  const t = dict.common;
  const nav = [
    { href: `/${locale}/vehicles`, label: t.stock },
    { href: `/${locale}#how-it-works`, label: t.howToBuy },
  ];
  const isCustomer = viewer?.role === "customer";

  const accountLinks = viewer ? (
    <>
      {isCustomer ? (
        <>
          <Link href={`/${locale}/account/favorites`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
            <Heart className="size-4" aria-hidden />
            <span className="lg:sr-only">{dict.portal.nav.favorites}</span>
          </Link>
          <Link href={`/${locale}/account`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
            <UserRound className="size-4" aria-hidden />
            {t.myAccount}
          </Link>
        </>
      ) : (
        <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
          <LayoutDashboard className="size-4" aria-hidden />
          {t.adminWorkspace}
        </Link>
      )}
      <form action={signOut}>
        <input type="hidden" name="next" value={`/${locale}`} />
        <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          <span className="lg:sr-only">{t.signOut}</span>
        </button>
      </form>
    </>
  ) : (
    <>
      <Link href={`/${locale}/login`} className="rounded-lg px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
        {t.signIn}
      </Link>
      <Link href={`/${locale}/register`} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
        {t.register}
      </Link>
    </>
  );

  return (
    <header className="relative z-30 bg-graphite text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:h-[72px]">
        <Link href={`/${locale}`} className="shrink-0" aria-label="MotorSpecs">
          <Image src="/brand/motorspecs-logo-light.png" alt="MotorSpecs" width={1080} height={240} priority className="h-8 w-auto lg:h-9" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-[0.95rem] font-medium text-white/80 hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto hidden items-center gap-3 lg:flex">
          <Suspense>
            <LanguageSwitcher locale={locale} label={t.language} />
          </Suspense>
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <div className="flex items-center gap-1">{accountLinks}</div>
        </div>
        <div className="ms-auto lg:hidden">
          <MobileMenu label="Menu">
            <nav className="flex flex-col gap-1" aria-label="Main">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2.5 font-medium text-white/85 hover:bg-white/10">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="my-3 h-px bg-white/10" />
            <div className="flex flex-col gap-1">{accountLinks}</div>
            <div className="mt-4">
              <Suspense>
                <LanguageSwitcher locale={locale} label={t.language} />
              </Suspense>
            </div>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
