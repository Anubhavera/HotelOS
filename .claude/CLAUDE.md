# HotelOS — Project Context & Rules

## What is this?
HotelOS is a multi-tenant SaaS platform for hotel chains and restaurants. It provides transparency in purchases, sales, and profits to owners and staff.

## Tech Stack
- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Styling:** Vanilla CSS with CSS Custom Properties (no Tailwind)
- **Auth & DB:** Supabase (PostgreSQL with Row-Level Security)
- **Storage:** Supabase Storage (payment proofs, bill images, ID documents)
- **Mobile:** Progressive Web App (installable via browser)
- **Hosting:** Vercel

## Architecture Principles
1. **Multi-tenancy via RLS:** Every data table has `org_id`. Supabase RLS policies enforce tenant isolation at the database level. Never trust client-supplied org_id — always derive from auth context.
2. **Server-first:** Use Server Components by default. Only add `"use client"` when you need interactivity (forms, modals, realtime).
3. **Server Actions for mutations:** All writes go through `src/lib/actions/*.ts` — no direct client-side Supabase inserts.
4. **Responsive-first:** Mobile layout (PWA for owners) is the primary target. Desktop (staff web) is secondary.

## File Structure Convention
- `src/app/(auth)/` — Login, register pages (no dashboard layout)
- `src/app/(dashboard)/` — All authenticated pages (sidebar + header layout)
- `src/components/ui/` — Reusable UI primitives (Button, Card, Modal, etc.)
- `src/components/{module}/` — Module-specific components (hotel, restaurant, etc.)
- `src/lib/actions/` — Server Actions (mutations)
- `src/lib/supabase/` — Supabase client configuration
- `src/hooks/` — Custom React hooks
- `src/types/` — TypeScript type definitions
- `supabase/migrations/` — SQL migration files (sequential numbering)

## Code Style
- Use `"use client"` directive only when necessary
- Prefer `async/await` over `.then()` chains
- Use Zod for form validation (when added)
- Format currency as INR (₹) using `Intl.NumberFormat('en-IN')`
- Format dates using `Intl.DateTimeFormat('en-IN')`
- Use CSS custom properties for theming (no hardcoded colors)

## Naming Conventions
- Components: PascalCase (`RoomCard.tsx`)
- Hooks: camelCase with `use` prefix (`useOrg.ts`)
- Server Actions: camelCase (`createBooking`)
- CSS classes: kebab-case (`room-card`, `status-badge`)
- DB tables: snake_case (`restaurant_orders`)
- TypeScript types: PascalCase (`Booking`, `Organization`)

## Security Rules
- NEVER expose Supabase service key on the client
- ALWAYS use RLS — no `service_role` key in browser code
- Validate all user inputs server-side before DB operations
- Sanitize file uploads (check MIME type, enforce size limits)
- Rate limit auth endpoints

## Current Client
- **Hotel:** Royal Hotels
- **Restaurant:** Royal Restaurant
