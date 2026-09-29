# MotorSpecs

Prototype of a Japanese used-vehicle export platform:

- **Public website** in English, Japanese and Arabic (RTL): vehicle catalogue, search and filters, detail pages, favourites, inquiries and price offers. Prices are FOB USD, or “Ask for price”.
- **Customer portal:** My Profile, My Account Info, My Favorites, Inquiry & Bid List, Reserved Vehicles, Purchased Vehicles.
- **Staff workspace** for the owner/admin and salespeople: dashboard, master customer database, assignment and reassignment, inquiry inbox, offers and quotations, follow-ups, reservations, sales and payments, shipping, documents, vehicle CMS, staff and roles, activity log, reports.

Built with **Next.js 16 + React 19 + TypeScript** and **Supabase** (PostgreSQL, Auth, Storage). All permissions are enforced in the database with **Row Level Security**.

See **[docs/PLAN.md](docs/PLAN.md)** for the sitemap, permission matrix, data model, workflow and folder structure.

> **Not deployed.** This is a local prototype. All people, companies, vehicles, prices and documents in the demo data are fictional. No real bank details are included anywhere.

---

## Quick start (demo mode, no credentials)

Requirements: Node.js 20.9+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

With no Supabase variables set, the app runs in **demo mode**. An embedded PostgreSQL ([PGlite](https://pglite.dev), WebAssembly) runs the **same SQL migrations, RLS policies and seed** as Supabase. Data persists in `.demo-data/` between restarts.

### Demo accounts

Use the one-click buttons on `/en/login` (customers) or `/admin/login` (staff). The password for every demo account is `MotorSpecsDemo!2026`.

| Account | Role | What to try |
|---|---|---|
| Kenji Mori (Demo Owner) | Owner / admin | Everything: assign customers, verify payments, staff, reports, private costs |
| Aiko Sato (Demo Sales) | Salesperson | Sees only Amara, Grace and Mohamed |
| Daniel Okoro (Demo Sales) | Salesperson | Sees Omar and Liam (Liam was reassigned from Aiko: history kept) |
| Amara Nwosu | Customer | Hiace reserved for her; accepted quotation |
| Omar Haddad | Customer (Arabic) | Land Cruiser purchased, shipping in transit, shared documents |
| Grace Wanjiru | Customer | Completed purchase |
| Liam Walsh | Customer | Pending counter-offer to accept or decline |
| Yuki Nakamura | Customer (Japanese) | Conversation handled by the owner as salesperson |
| Carlos Mendes | Customer | Brand-new, unassigned; his inquiry waits in the admin inbox |

**Account linking demo:** register a new account, open *My Account Info*, and enter the code `DEMO-LINK-2026`. That links the new login to the staff-created record for “Mohamed Farah”. The owner can also issue fresh codes on any unlinked customer page.

**Reset demo data:** use the *Demo data* panel on the admin dashboard, or stop the server and run `npm run demo:reset`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app (demo mode unless Supabase is configured) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:test` | **87 security and business-rule checks** against the real migrations (RLS per role, storage access, invite linking, one-reservation rule, MFA gating…) |
| `npm run db:seed:generate` | Regenerate `supabase/seed.sql` from `src/lib/demo/seed-data.ts` |
| `npm run demo:reset` | Delete the local demo database (server stopped) |

---

## Connecting a real Supabase project

1. **Create a project** at supabase.com (the Free plan is fine).
2. **Apply the migrations**, in filename order, from `supabase/migrations/`. Either:
   - Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - paste each file into **SQL Editor** and run them in order.

   Do **not** run `supabase/local/supabase_stubs.sql` on Supabase; it only exists for the embedded demo database.
3. **Storage:** migration `…600_storage.sql` creates the buckets `vehicle-photos` (public), `vehicle-internal` (private) and `customer-documents` (private), with a 10 MB limit and storage policies.
4. **Auth settings** (Dashboard → Authentication):
   - URL configuration: Site URL `https://your-domain` (or `http://localhost:3000`); add `…/auth/callback` to the redirect URLs.
   - Google: enable the provider and add your Google OAuth client ID and secret. The authorised redirect URI in Google Cloud is `https://<ref>.supabase.co/auth/v1/callback`.
   - Multi-factor: TOTP (authenticator app) is available by default.
5. **Environment:** copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Settings → API)
   - `DATABASE_URL` from Settings → Database → **Transaction pooler** (port 6543). This is a server-only secret.
6. **Create the owner account:** register on the website with the owner's email, then run in the SQL editor:

   ```sql
   update public.profiles set role = 'admin', is_owner = true, mfa_required = false
    where email = 'owner@yourcompany.com';
   delete from public.customers c
    where c.auth_user_id = (select id from public.profiles where email = 'owner@yourcompany.com')
      and not exists (select 1 from public.inquiries i where i.customer_id = c.id);
   ```

   Add salespeople afterwards from **Staff & roles**: they register first, then the owner grants access by email.
7. **Optional demo data** in a throwaway or staging project: run `supabase/seed.sql`. It creates the demo logins above. Remove everything later with `supabase/scripts/purge_demo_data.sql`, which never deletes non-demo rows.
8. `npm run dev`. The app switches to Supabase mode automatically when all three variables are set (or force it with `MOTORSPECS_MODE=supabase`).

### How the app talks to Supabase

- **Auth** (email, Google, MFA) and **Storage** use `@supabase/ssr` with the **publishable key** and the user's session cookies. Storage RLS therefore applies to every upload and download.
- **Data** goes through a direct Postgres connection (`DATABASE_URL`). For every request the server verifies the user's JWT (`auth.getClaims()`), opens a transaction, runs `set local role authenticated` and sets `request.jwt.claims`. This is the same mechanism PostgREST uses, so **every query is subject to RLS**. Anonymous visitors run as `anon`.
- The **service-role key is not used anywhere.** Staff accounts are granted by an admin through an RLS-checked function (`set_staff_role`) instead of an admin API.
- The auto-generated Data API isn't needed by the app. You may disable it (Settings → API) as defence in depth.

### Free → Pro

Nothing in the schema depends on the plan. On Pro you can add point-in-time recovery, schedule `select public.expire_reservations();` with `pg_cron`, raise storage limits, and use custom SMTP for auth emails. There's no migration or code change required.

---

## What works in demo mode vs. what needs Supabase

| Feature | Demo mode | Needs a connected Supabase project |
|---|---|---|
| Catalogue, search, filters, detail pages, 3 languages, RTL | ✓ | |
| Email + password sign-up and sign-in | ✓ (local accounts, no email sent) | Email confirmation emails |
| **Google sign-in** | Button shown, disabled | ✓ |
| Favourites, inquiries, offers, replies, accept/decline | ✓ | |
| Customer profile editing; read-only admin fields | ✓ (enforced by DB trigger) | |
| Account linking with one-time codes | ✓ | |
| Staff workspace: every module | ✓ | |
| Row Level Security and business rules | ✓ (same SQL, running in PGlite) | |
| Vehicle photo and document uploads | ✓ (stored in `.demo-data/storage`) | Supabase Storage with storage RLS, signed URLs, CDN for public photos |
| Vehicle photos for seeded stock | Generated “DEMO PHOTO” illustrations | Upload real photos |
| **Authenticator-app MFA** | Explained, verification simulated | ✓ Real TOTP enrol / verify (AAL2) |
| Multiple app instances / hosting | ✗ (single local process) | ✓ |
| Emails or WhatsApp notifications to customers | ✗ Not built yet | ✗ Not built yet |

---

## Security notes

- **RLS on every table.** A schema-hygiene test fails if any public table lacks it. Views that read base tables (`catalog_vehicles`, `staff_directory`) are read-only for API roles.
- **“Ask for price”:** the amount is never sent to the browser. The public catalogue view nulls it out, and anonymous users cannot read the `vehicles` table.
- **Private vs public:** internal cost and supplier live in `vehicle_private` (admin only). Auction sheets can go to the private `vehicle-internal` bucket. Customer documents are private and visible only when shared.
- **Protected fields** (customer ID, verification, status, assignment, payment amounts) are guarded by triggers, whatever the client sends.
- **Uploads:** 10 MB limit and a MIME allow-list, checked in the app (by file signature, not the browser-supplied type), in the storage bucket config and in DB constraints.
- **Audit:** an append-only `activity_log` records assignments, price/status changes, payments, documents, staff roles and invite use.
- **Staff MFA:** tick *Require MFA* on a staff member; the database withholds their staff rights until the session has AAL2.

## Known gaps / next steps

- “Forgot password” page (Supabase `resetPasswordForEmail`).
- Transactional email/WhatsApp notifications (new inquiry, quotation sent, payment verified).
- Admin interface translation (strings are already centralised in `src/lib/i18n/admin`).
- Image resizing/optimisation pipeline for uploaded photos, and drag-and-drop photo ordering.
- Invoice/quotation PDF generation from sale data (currently uploaded files).
- Real reference screenshots were not provided; the vehicle CMS follows the field list in the brief.
