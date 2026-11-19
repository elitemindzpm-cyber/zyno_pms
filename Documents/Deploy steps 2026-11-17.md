# Production deploy: 17 Nov 2026

## What production has today

- The production site (property-management.zynotechnologies.com) serves an older build. It still has the
  "Reset GL from PDCs" dialog and the fixed "Admin User" name. None of the changes below are on it yet.
- Production and localhost use the same Supabase project. The database changes made today are already live
  for production: no database migration is needed for them.

## Code to deploy (nested repository, branch main)

Modified (19 source files):
- src/components/app-shell.tsx: sign-in check; shows the real name or "Not signed in"
- src/components/finance-module.tsx: "Not signed in" and "could not be read" messages; Reset GL button removed; Chart of Accounts tree includes ledger GLs
- src/components/finance/deposits-guarantees.tsx: Kahramaa and guarantee vouchers read from the database; one load at a time
- src/components/finance/pdc-management.tsx: seed PDC blocks removed; unique IDs for renewal rows; cancellation date
- src/components/finance/property-wise-pnl.tsx: banner states; unbilled notice hidden without a read
- src/components/leasing-module.tsx: customer master loads all rows, live refresh, duplicate-safe list
- src/lib/app-data-context.tsx: lease tenant and property from the database first
- src/lib/auth-guards.ts: demo sessions no longer accepted; leftover demo sessions cleared
- src/lib/console-config.tsx: Finance Reports menu
- src/lib/db-collection.ts: no reads or writes without a session; unique realtime channel names
- src/lib/db-keyed-cache.ts: no uploads without a session; silent background sync; browser cache purge after migration
- src/lib/finance/finance-cache-migration.ts: purge after a clean migration
- src/lib/finance/finance-store.tsx: ledger loaded in parallel pages; voucher list read in full; one load at a time; ledger state
- src/lib/finance/pdcService.ts: cancellation date stored in returned_date
- src/lib/proc-invoices-api.ts: unique realtime channel names
- src/lib/supabase.ts: reads ledger GLs and sub-ledger parents
- src/routes/api.db.ts: server errors returned as JSON with their message
- src/routes/leasing.create.tsx, src/routes/prop-mgr.leasing.tsx: renewal default 0%; end date one term less one day

New (scripts, already run against the live database; not needed to run again):
- scripts/finance/2026-11-16-*.cjs, 2026-11-17-*.cjs
- scripts/finance/hidden-party-loan-sub-ledgers.json (restore list for the hidden accounts)

Do not commit:
- scripts/finance/lease-customer-candidates.xlsx (tenant names)
- .env (already ignored by git)

## Steps

1. Typecheck: passed today (0 errors).
2. Production build: passed on 17 Nov 2026 (`vite build`, exit 0, built in about 36 seconds).
3. Commit on main, with the attribution lines in the commit message. Do not rewrite history: the repository
   is connected to Lovable, and pushes to this branch sync there (see AGENTS.md).
4. Push: `git -C "E:/Port/Property Management System/one-platform-many-smiles" push origin main`
   (run by you; pushes from this session have been blocked before).
5. Deploy: the repository has no deploy step (the CI workflow only builds). Deploy production from wherever
   property-management.zynotechnologies.com is hosted, using this commit.

## Checks after deploy (signed in as an admin on production)

- Signed out: opening /admin/finance sends you to the sign-in page.
- Signed in: the sidebar shows your name, not "Admin User".
- Property P&L: unbilled notice about QR 13,950; October portfolio revenue QR 1,965,992.65.
- Trial balance: QR 13,009,915.65 on both sides.
- Deposits & Guarantees: 762 rows; Kahramaa deposits listed (the 98 extra rows still need review).
- Chart of Accounts: Bank shows 12000001 and 12000002; Advance to Vendors and Rent to Landlord listed.
- Customer master: all customers listed; a new customer appears without a reload.
- Payroll sync: saves when signed in; shows a sign-in message when not.
- PDC cancel: the dialog asks for a cancellation date.
- Finance page: no "Reset GL from PDCs" button.

## Rollback

Use `git revert <commit>` and push. Do not reset or force-push: that rewrites history that Lovable syncs.
The database changes are not reverted by a code rollback. Reversing them needs new scripts.
