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
Migration008 preserves same-organization pre-booking room reassignment and locks
both rooms in a consistent order. Booking mutations own occupancy; browser checkout
and check-in no longer send a later independent room update.
Migration009 enforces the app’s existing one-workspace-per-account model. Review
any historical multiple-workspace memberships before applying it. Invited staff
keep their assigned workspace during first-login setup; accounts cannot be added
to a second workspace without an explicit future workspace-switching feature.
Duplicate hotel names get unique organization slugs, and failed setup signs out
locally so the user can retry sign-in.
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

## Dependency security patches

Use Node 20.9 or newer (Node 22 LTS is used for verification). Next.js stays
on 15.5.27 with matching ESLint tooling. Its pinned PostCSS and optional Sharp
dependencies are overridden to tested patched versions 8.5.28 and 0.35.4;
remove these overrides only when the framework resolves equally patched
versions itself. The lockfile also refreshes compatible Nano ID and ws releases.
`npm run test:dependencies` exercises the actual Next image optimizer with a PNG input
and PNG, JPEG, WebP and AVIF outputs and the PostCSS parse/transform pipeline.
It runs entirely offline and does not connect to Supabase.

The historical `npm run lint` command currently opens ESLint setup because
this repository has no ESLint configuration. It is not a completed lint gate;
type-check and production-build checks are available independently.

Build-tool dependencies also receive compatible security refreshes: Babel 7,
HumanFS 0.16, Baseline Browser Mapping 2, Browserslist 4, fast-uri 3 and js-yaml 4.
Brace Expansion overrides retain each existing major (1.1.21, 2.1.7, 5.0.12).
Serialize JavaScript is overridden to 7.0.5 after verifying that its CommonJS
callable API and worker-option serialization remain compatible with the actual
Workbox/Rollup Terser consumer. Its Node 20 requirement fits the app's existing
Node 20.9 minimum. The offline dependency suite now checks legitimate option
roundtrips, spoofed RegExp/Date input handling, bounded array-like serialization,
and actual production service-worker generation and lifecycle registration.
No Workbox/Rollup plugin upgrade is needed for this tested override.
Unpatched Braces 3.0.3 remains in development/build tooling; other full-audit
findings cascade from it. Production-only audit is clear at verification time.
