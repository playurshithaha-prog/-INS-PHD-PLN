# NQ EDGE

A private NQ/MNQ trading workspace for New York session preparation, discretionary execution checks, and trade review. Account observations and gamma context are entered manually. The app submits no orders.

## Cloud workspace

Use the existing checkout at `/workspace/INS-10K-PLN`. The project uses Node 24 in the cloud workspace. Install with `npm ci --cache /tmp/nq-edge-npm` and start with `npm run dev -- --hostname 0.0.0.0`. Open the cloud environment's HTTP port 3000 preview when configured.

With no public Supabase settings, the app opens in visibly labeled demo mode. Sample trades and edits stay in the current browser. Demo mode uses the real New York clock. A blocked execution check can still be recorded for review. Demo data is separate from private Supabase data.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx playwright install chromium`, followed by `npm run e2e` after a successful build. To use installed Chromium, set `PLAYWRIGHT_CHROMIUM_PATH` to its executable.

## Vercel and Supabase

1. Push the approved application branch to GitHub and import the repository into Vercel as a Next.js project with Node 24.
2. Create a Supabase project and run [the initial migration](supabase/001_workspace.sql) in its SQL editor. This creates an API-owned workspace table and a private screenshot bucket.
3. In Supabase Authentication, disable public sign-ups and create or invite the intended user. Enable email/password for the app's sign-in form.
4. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY`. Use the project's secret key or legacy service-role key for the server-only setting. Configure the production deployment URL in Supabase Auth.
5. Deploy, sign in with the seeded user, and complete onboarding. Verify that a second user cannot read the first user's workspace or screenshot paths. Verify save, reload, deletion, and account approval with a fresh account observation and known rule configuration.

## Risk assumptions

- Phidias Fall Edition amounts, dates, and contract limits are provisional user references. Enter the rules version, verification date, and applicable limits from your account agreement. The app requires confirmation before granting approvals in competition mode.
- EOD trailing uses the higher of the manually supplied eligible EOD baseline and eligible recorded closes, and applies the optional floor cap. Same-day closes become eligible on the next New York date. Cushion is measured against current equity. Entering an incorrect manual balance or baseline can produce incorrect results.
- NQ equals 10 MNQ for combined exposure. Round-trip slippage is entered in ticks and commission in dollars per contract. The daily budget deducts realized journal losses and reported open risk. Keep the journal and account observations current and enter existing exposure before running the gate.
- Account approval and risk estimates depend on entered data. Broker rules and order execution remain external. Remaining weekdays exclude weekends and do not model exchange holidays.
- The discipline score uses explicit evidence fields. Risk contributes 35 points, setup evidence 30, a calm pre-entry emotional state 20, preparation 7, and a reviewed journal entry with notes 8.

## Implementation scope

The application supports one configurable account per workspace. The journal groups manually entered fills into closed trades and imports one closed trade per CSV row. CSV files require offset-aware timestamps. Screenshot references are included in JSON exports. Private images can be opened individually from the associated record. Detaching a screenshot removes the reference, and workspace deletion removes the user's stored images. The initial database migration stores validated workspace records as versioned JSON; a normalized relational schema and an independent order ledger are future work.
