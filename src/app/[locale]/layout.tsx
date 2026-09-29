import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { getViewer } from "@/lib/auth/session";
import { isDemoMode, siteUrl } from "@/lib/config";
import { arabicFont, bodyFont, displayFont, japaneseFont } from "@/lib/fonts";
import { dirFor, getDictionary, isLocale, locales } from "@/lib/i18n";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).meta;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.title, template: "%s · MotorSpecs" },
    description: t.description,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
    robots: isDemoMode ? { index: false, follow: false } : undefined,
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const viewer = await getViewer();

  const fontVars = [bodyFont.variable, displayFont.variable, locale === "ja" ? japaneseFont.variable : "", locale === "ar" ? arabicFont.variable : ""].join(" ");

  return (
    <html lang={locale} dir={dirFor(locale)} className={fontVars}>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
          {dict.common.skipToContent}
        </a>
        {isDemoMode && (
          <div className="bg-[repeating-linear-gradient(135deg,#1a2230_0_12px,#161d28_12px_24px)] px-4 py-1.5 text-center text-xs font-medium text-[#ffd28a]">
            {dict.common.demoBanner}
          </div>
        )}
        <SiteHeader locale={locale} dict={dict} viewer={viewer} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} demo={isDemoMode} />
      </body>
    </html>
  );
}
