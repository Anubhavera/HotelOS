# HotelOS

Next.js 15 / Supabase hotel and restaurant workspace. Install with `npm ci`, set
public Supabase credentials in an ignored `.env.local`, then run `npm run dev`.
Use `npm run type-check` and `npm run build` before shipping.

## Database changes

Apply migrations in numeric order in a separate synthetic Supabase project first.
No migrations in this repository are applied by the app build. Back up production
before migration work. Migration 006 restricts organization membership creation,
privileged edits and salary access; review and remove any unauthorized memberships
created while the previous unrestricted INSERT policy was installed. The new
policy cannot identify or remove those historical accounts for you.

Registration uses `create_owner_organization` to commit organization and owner
membership together. With email confirmation enabled, sign in after verification
to complete pending setup. Staff register using “Join an existing organization”; an
owner adds their verified email using `add_org_member`, without changing the
owner's browser session or exposing a service-role key.

Migration 007 rejects overlapping active room bookings and cross-organization
room references, and updates room occupancy within the booking transaction.
Before applying it, review existing bookings for overlaps, inverted date windows
and mismatched room/organization references. Existing invalid rows cause the
migration to fail instead of silently dropping business data.
Restaurant KOT creation now uses `create_restaurant_order` so the header and all
menu items commit together, using the database's menu prices.

## Synthetic database tests

Install PostgreSQL server binaries and `psql`, then run:

```
PG_BINDIR=/usr/lib/postgresql/18/bin python3 tests/run_database.py
```

The runner creates and stops a disposable cluster with a Unix socket only,
applies all migrations, and uses synthetic users. It does not connect to an
existing database. Tests cover tenant self-enrollment, owner-only staff addition,
privileged writes/salary visibility, retry-safe setup, booking overlap and atomic
room state, and restaurant item failure rollback/price tampering.

These checks do not replace an authenticated Supabase integration test, mobile
UI/PWA review or production migration review. Other historical browser mutations
still exist; this change does not claim every write uses a Server Action.
