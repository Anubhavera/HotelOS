# Security Rules

## Authentication
- Use Supabase Auth exclusively — no custom JWT or session handling
- All dashboard routes are protected via middleware (redirect to /login if unauthenticated)
- Role-based access: `owner`, `manager`, `staff`
  - **Owner:** Full access to all modules including settings, salaries, reports
  - **Manager:** Access to hotel, restaurant, expenses. No salary details, no org settings
  - **Staff:** Access to hotel check-in/out, restaurant orders only. Read-only for reports

## Data Access
- NEVER bypass Row-Level Security (RLS)
- NEVER use `supabase.auth.admin` in client code
- Always use the authenticated user's session to interact with Supabase
- The `org_id` must be derived from the user's membership, not from URL params or form data
- All database mutations go through Server Actions which validate org membership first

## File Uploads
- Maximum file size: 5MB for images, 10MB for PDFs
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Store files in org-specific buckets: `{org_id}/payment-proofs/`, `{org_id}/bill-proofs/`, `{org_id}/id-proofs/`
- Generate unique filenames using UUID to prevent overwrites

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (public, safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only, NEVER exposed to client
- Store all secrets in `.env.local` (git-ignored)

## Headers & CSP
- Set `X-Frame-Options: DENY` to prevent clickjacking
- Use `Content-Security-Policy` appropriate for Supabase origins
- Enable HTTPS only in production
