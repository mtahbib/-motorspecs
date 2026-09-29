import Image from "next/image";
import { redirect } from "next/navigation";
import { demoSignIn } from "@/app/actions/auth";
import { SignInForm } from "@/components/site/auth-forms";
import { GoogleButton } from "@/components/site/auth-shell";
import { Alert, DemoBadge } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { DEMO_PASSWORD, seedUsers } from "@/lib/demo/seed-data";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Staff sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer?.isStaff) redirect("/admin");
  if (viewer?.needsMfa) redirect("/admin/mfa");
  const staff = seedUsers.filter((u) => u.role !== "customer");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-graphite p-10 text-white lg:flex">
        <Image src="/brand/motorspecs-logo-light.png" alt="MotorSpecs" width={1080} height={240} className="h-9 w-auto self-start" />
        <div>
          <div className="gauge-rule mb-6 w-40" />
          <p className="font-display text-4xl font-bold leading-tight">Customers, inventory and deals — in one place.</p>
          <p className="mt-3 max-w-md text-white/60">Inquiries, quotations, reservations, payments and shipping for every MotorSpecs customer.</p>
        </div>
        <p className="text-xs text-white/40">Access is restricted to MotorSpecs staff. Activity is logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-bold">Staff sign in</h1>
          <p className="mt-1 text-muted">{adminT.brand}</p>
          {sp.error === "not_staff" && (
            <Alert tone="warn" className="mt-5">This account does not have staff access. Customers can sign in on the website.</Alert>
          )}
          <div className="mt-6 flex flex-col gap-5">
            <GoogleButton locale="en" next="/admin" label="Continue with Google" disabledNote={isDemoMode ? "Google sign-in requires a connected Supabase project." : undefined} />
            <SignInForm locale="en" next="/admin" labels={{ email: "Email", password: "Password", submit: "Sign in" }} />
          </div>
          {isDemoMode && (
            <div className="card mt-8 p-5">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Demo staff accounts</p>
                <DemoBadge />
              </div>
              <p className="mt-0.5 text-xs text-muted">Password for all demo accounts: <code className="font-semibold">{DEMO_PASSWORD}</code></p>
              <div className="mt-3 flex flex-col gap-2">
                {staff.map((u) => (
                  <form key={u.id} action={demoSignIn}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="locale" value="en" />
                    <input type="hidden" name="next" value="/admin" />
                    <button className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-2.5 text-start hover:border-brand hover:bg-brand-soft/50">
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-xs font-semibold text-muted">{adminT.roles[u.role]}</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
