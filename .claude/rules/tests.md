# Testing Rules

## Type Safety
- Run `npx tsc --noEmit` before every commit
- Zero TypeScript errors is the minimum bar
- Use strict mode — no `any` types except when absolutely necessary (and document why)

## Manual Testing Checklist
Before marking any module complete, verify:
1. Mobile view (375px width) — touch-friendly targets, readable text
2. Desktop view (1440px width) — proper sidebar layout, tables readable
3. Dark mode — all text readable, no invisible elements
4. Create → Read → Update → Delete cycle works
5. Role-based access — staff cannot access restricted pages
6. File uploads — correct MIME type validation, size limits enforced
7. Currency formatting — ₹ symbol, Indian number format (1,00,000)

## PWA Testing
- Run `npm run build && npm start` to test production build
- Use Chrome Lighthouse → PWA audit (target: 90+)
- Test "Add to Home Screen" on Android Chrome
- Verify offline fallback page shows when disconnected

## Database Testing
- Verify RLS policies: log in as user from Org A, attempt to query Org B data (should return empty)
- Test cascade deletes (deleting org should clean up all related data)
- Verify unique constraints (duplicate room numbers in same org should fail)

## Performance
- Aim for < 3s First Contentful Paint on 3G
- Use Server Components to reduce client JS bundle
- Lazy-load heavy components (charts, calendar) with `next/dynamic`
