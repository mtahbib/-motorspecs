import { ButtonLink } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";

// Rendered inside the locale layout; the locale is not available here, so the
// English copy is used and the layout still provides the correct direction.
export default function NotFound() {
  const t = getDictionary("en").common;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="num font-display text-7xl font-bold text-brand/25">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">{t.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{t.notFoundBody}</p>
      <ButtonLink href="/" className="mt-6">{t.goHome}</ButtonLink>
    </div>
  );
}
