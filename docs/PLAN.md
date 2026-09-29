# MotorSpecs — prototype plan

Japanese used-vehicle export platform: public catalogue, customer portal, and a staff workspace for the owner and salespeople.

**Stack:** Next.js 16 (App Router, React 19, TypeScript, Tailwind v4) · Supabase Free (PostgreSQL, Auth, Storage) · SQL migrations with Row Level Security.

---

## 1. Sitemap

### Public website — `/en`, `/ja`, `/ar` (Arabic is right-to-left)

| Route | Purpose |
|---|---|
| `/[locale]` | Home: search, featured and new arrivals, how buying works |
| `/[locale]/vehicles` | Catalogue with keyword, make/model, body, year, price, mileage, transmission, fuel, steering, drive filters, sorting, pagination |
| `/[locale]/vehicles/[slug]` | Vehicle detail: gallery, specifications, customs data, features, description (English fallback), inquiry / offer panel, favourite |
| `/[locale]/login`, `/[locale]/register` | Email + password, Google (Supabase), demo accounts (demo mode) |

### Customer portal — `/[locale]/account`

| Route | Section |
|---|---|
| `/account` | Overview (counts, latest conversations, sales contact) |
| `/account/profile` | **My Profile** (editable contact and delivery fields) |
| `/account/account` | **My Account Info** (customer ID, verification: read-only) + link an existing record with a one-time code |
| `/account/favorites` | **My Favorites** |
| `/account/inquiries`, `/account/inquiries/[id]` | **Inquiry & Bid List**: conversation, offers, accept/decline quotations, new offer |
| `/account/reserved` | **Reserved Vehicles** |
| `/account/purchased` | **Purchased Vehicles**: totals, payments (read-only), shipping tracker, shared documents |

### Staff workspace — `/admin` (English, strings in `src/lib/i18n/admin`)

| Route | Module |
|---|---|
| `/admin` | Dashboard: replies needed, follow-ups, reservations expiring, payments to verify, shipments |
| `/admin/customers`, `/new`, `/[id]` | Master customer database, create before sign-up, assignment + history, portal link code, notes, deals, documents, activity |
| `/admin/inquiries`, `/[id]` | Inquiry inbox (needs reply / unassigned / open / closed) and conversation: reply, internal notes, quotation, reserve, convert to sale |
| `/admin/offers` | Offers and quotations |
| `/admin/tasks` | Follow-up tasks |
| `/admin/reservations` | Active holds: extend, release, convert to sale, expire overdue |
| `/admin/sales`, `/[id]` | Sales, payments (record → verify / void), shipping, sale documents, close-out |
| `/admin/shipping` | Shipping and export board |
| `/admin/documents` | Customer-specific documents (private storage, share toggle) |
| `/admin/vehicles`, `/new`, `/[id]` | Vehicle listing CMS with sections, checklist, media, publishing |
| `/admin/staff` | Staff and roles, MFA requirement, permission matrix (admin only) |
| `/admin/activity` | Activity trail |
| `/admin/reports` | Sales, collections, pipeline, team, stock aging (admin only) |
| `/admin/security`, `/admin/mfa`, `/admin/login` | Authenticator-app MFA and staff sign-in |

---

## 2. Role and permission matrix

Enforced in PostgreSQL (RLS policies, guard triggers, SECURITY DEFINER functions), not just by hiding buttons.

| Capability | Owner / Admin | Salesperson | Customer |
|---|---|---|---|
| Customer records | All | Assigned to them | Own only |
| Create customer | ✓ (assign to anyone) | ✓ (forced to themselves) | — (self sign-up) |
| Assign / reassign customer | ✓ (history kept) | ✗ | ✗ |
| Edit profile fields | ✓ | Assigned | Own permitted fields only |
| Customer ID, verification, status, tags, email | ✓ | Assigned | Read-only |
| Conversations | All | Assigned customers | Own (never internal notes) |
| Internal notes | ✓ | Assigned | ✗ |
| Quotations / counter-offers | ✓ | Assigned | Accept / decline / new offer on own |
| Reservations, sales | ✓ | Assigned | Read own |
| Record payment | ✓ | Assigned (status “recorded”) | Read own |
| Verify / void payment | ✓ | ✗ | ✗ |
| Shipping updates | ✓ | Assigned | Read own (customer-visible events) |
| Documents | ✓ | Assigned; upload / share | Only files explicitly shared |
| Vehicle listings | ✓ | ✓ | Published, reserved and sold listings (plus ones they have deals on) |
| Private cost / supplier / margin | ✓ | ✗ | ✗ |
| Staff, roles, MFA requirement, reports | ✓ | ✗ | ✗ |
| Activity log | All (append-only) | Own actions + assigned customers | ✗ |

The owner flag cannot be removed and the owner cannot be demoted. When a staff profile has `mfa_required`, **all** staff permissions switch off in the database until the session is AAL2 (authenticator-app code).

---

## 3. Database relationships

```
auth.users 1─1 profiles (role: admin | sales | customer, is_owner, mfa_required)
    │                     │
    │ (verified link)     ├── assigned_staff_id ──┐
    ▼                     │                       │
customers ◄───────────────┘   customer_assignments (history: from → to, by, reason, when)
  │  customer_invites (sha-256 hashed one-time link codes)
  │
  ├── favorites ──────────────► vehicles ─1─1─ vehicle_private (admin only: cost, supplier)
  │                               ├── vehicle_translations (en / ja / ar)
  ├── inquiries ──► vehicle       ├── vehicle_features ──► features
  │     ├── messages              ├── vehicle_media (public bucket / private bucket)
  │     ├── internal_notes        ├── vehicle_price_history, vehicle_status_history
  │     ├── offers (customer offer / counter-offer / quotation)
  │     └── tasks (follow-ups)    makes ─< models · body_types · locations
  │
  ├── reservations ─► vehicle    (unique: ONE active reservation per vehicle)
  │     └── sales ─► vehicle     (unique: ONE non-cancelled sale per vehicle)
  │           ├── payments       (recorded → verified | void; never deleted)
  │           ├── shipments ──< shipment_events (timestamped stages)
  │           └── documents      (private bucket, {customer_id}/{document_id}/{file})
  │
  └── activity_log               (append-only; written only by triggers / definer functions)
```

Child rows carry a `customer_id` copied from their parent by trigger, so RLS reduces to “can this user access this customer?”. Staff reassignment changes one column; every conversation, deal and document stays with the customer.

---

## 4. Customer-to-sale workflow

1. **Sign up** (email or Google) → a trigger creates the profile and a fresh customer record. Existing records are never matched by email or phone.
2. **Complete profile** → browse → **save favourites**.
3. **Inquiry or offer** (`create_inquiry` RPC) → routed to the customer's salesperson. If the customer is unassigned, it waits in the admin's **Unassigned** inbox; the admin assigns the customer.
4. Salesperson **replies**, adds **internal notes**, schedules **follow-ups**, sends a **quotation** (FOB, CFR or CIF with freight, insurance and inspection).
5. Customer **accepts** (`respond_to_offer`) → salesperson **reserves** the vehicle (one active hold; it shows as *Reserved* on the website).
6. **Convert to sale** (`convert_reservation_to_sale`) → vehicle *Sold*, shipment opened, inquiry *Won*.
7. **Payments**: sales records, admin verifies. Sale status moves *awaiting → partially paid → paid* automatically.
8. **Shipping stages**: booked → at port → in transit → arrived → released. Each stage is a timestamped event visible to the customer, and the sale moves to *shipping / delivered*.
9. **Documents** (proforma, invoice, B/L, export certificate…) are uploaded privately and **shared** when ready.
10. **Complete** the sale.

**Pre-existing customers:** staff create the record, then issue a one-time link code (hashed, expires in 14 days, 5 failed attempts per hour). After registering, the customer enters the code; their new empty record is merged into the historical one.

---

## 5. Folder structure

```
supabase/
  migrations/            SQL schema → auth helpers → business rules → RLS → RPCs → storage
  seed.sql               demo seed for a Supabase project (generated)
  scripts/purge_demo_data.sql
  local/supabase_stubs.sql   auth/storage stand-ins for the embedded demo database only
  config.toml            Supabase CLI (local) settings
scripts/
  test-db.ts             RLS & business-rule test suite (87 checks)
  generate-seed.ts       regenerates supabase/seed.sql
  demo-reset.ts
src/
  proxy.ts               locale redirect, Supabase session refresh, admin gate
  app/
    [locale]/            public site + customer portal (root layout per locale)
    admin/               staff workspace (own root layout)
      (workspace)/       authenticated modules
      actions/           staff server actions
    actions/             auth + customer server actions
    api/files/           authorised file downloads
    media/               demo placeholder images, demo-mode uploads
    auth/callback/       Supabase OAuth / email callback
  components/            ui kit, site, portal, admin
  lib/
    db/                  driver interface: PGlite (demo) or postgres.js (Supabase), both RLS-enforced
    auth/                session → viewer (role, customer, MFA state)
    queries/             catalogue, portal, admin reads
    i18n/                en / ja / ar dictionaries, admin strings
    storage/             Supabase Storage or local disk
    demo/                seed data (single source), SQL builder, placeholder art and PDFs
```
