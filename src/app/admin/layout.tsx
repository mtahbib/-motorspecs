import type { Metadata } from "next";
import { bodyFont, displayFont } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Staff workspace · MotorSpecs", template: "%s · MotorSpecs staff" },
  robots: { index: false, follow: false },
};

// Separate root layout: the staff workspace is English-only for now
// (strings live in src/lib/i18n/admin so it can be translated later).
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" dir="ltr" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
