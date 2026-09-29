import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, supabaseConfig } from "./lib/config";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./lib/i18n/config";

const DEMO_COOKIE = "ms_demo_session";

function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";
  const isAdmin = firstSegment === "admin";
  const isAppRoute = isAdmin || ["api", "auth", "media"].includes(firstSegment);

  // 1. Public site and portal live under /en, /ja, /ar.
  if (!isAppRoute && !isLocale(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  if (isLocale(firstSegment) && request.cookies.get(LOCALE_COOKIE)?.value !== firstSegment) {
    response.cookies.set(LOCALE_COOKIE, firstSegment, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  // 2. Keep the Supabase session fresh (rotates cookies before rendering).
  let hasSession = false;
  if (isDemoMode) {
    hasSession = !!request.cookies.get(DEMO_COOKIE)?.value;
  } else {
    const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const keepLocale = response.cookies.get(LOCALE_COOKIE);
          response = NextResponse.next({ request });
          if (keepLocale) response.cookies.set(keepLocale);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    hasSession = !!data?.claims?.sub;
  }

  // 3. Optimistic gate for the staff workspace. Real authorisation happens in
  //    the page (requireStaff) and in the database (RLS).
  if (isAdmin && !hasSession && !pathname.startsWith("/admin/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico|robots.txt|sitemap.xml).*)"],
};

