# Code Review Command

When asked to review code, follow this checklist:

## Security
- [ ] No Supabase service key exposed in client code
- [ ] RLS policies cover all CRUD operations on the table
- [ ] File uploads validate MIME type and size
- [ ] Server Actions validate org membership before mutations
- [ ] No SQL injection vectors (use parameterized queries)

## Performance
- [ ] Server Components used where possible (no unnecessary "use client")
- [ ] Images use `next/image` with proper sizing
- [ ] Heavy components lazy-loaded with `next/dynamic`
- [ ] No N+1 queries — use joins or batch fetches

## Accessibility
- [ ] All interactive elements have labels or aria-labels
- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Keyboard navigation works (tab order, enter to submit)
- [ ] Loading and error states communicated to screen readers

## Code Quality
- [ ] No `any` types without documented reason
- [ ] Consistent naming conventions (see CLAUDE.md)
- [ ] No hardcoded strings that should be constants
- [ ] Error boundaries around data-fetching components
- [ ] Currency formatted as INR, dates formatted for Indian locale
