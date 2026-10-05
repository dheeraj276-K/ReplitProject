# SmartQueue

SmartQueue lets people join a service queue remotely, follow their place in line, and cancel an eligible token. Administrators manage services and operate queues from a live dashboard.

## Features

- Supabase email/password registration, login, logout, and password recovery
- User profile with editable contact and optional personal fields
- Public service directory with live queue counts and serving token
- Daily sequential tokens generated atomically in PostgreSQL
- Duplicate active-token protection and daily service limits
- Dynamic queue position and estimated waiting time
- User token status, cancellation, and paginated history
- Admin dashboard, queue actions, statistics, service management, and user directory
- PostgreSQL row-level security and realtime token status changes
- Responsive user and administrator screens

## Technology

- React, TypeScript, Vite, Tailwind CSS
- Supabase Auth, PostgreSQL, Row Level Security, PostgREST RPC, and Realtime
- The browser uses only the Supabase URL and public anon key; no service-role key is used by the app

## Supabase setup

1. Create a Supabase project.
2. In **Project Settings → API**, copy the project URL and the public anon key.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the app's environment. `.env.example` lists the required names. Do not add a service-role key to a `VITE_` variable or to frontend code.
4. Open the Supabase **SQL Editor** and run `supabase/migrations/202610050001_smartqueue.sql`. It creates the schema, RLS rules, token RPCs, realtime publication entry, and four sample services. It does not create sample people.
5. In **Authentication → Providers**, enable Email. Choose whether email confirmation is required.
6. In **Authentication → URL Configuration**, add the app's development URL and published URL to the site URL / redirect allow list. Include `/reset-password` as an allowed redirect path.
7. Restart the app after adding environment variables. Until the two public Supabase values are set and the migration has run, SmartQueue displays a setup message rather than simulating queue data.

## Environment variables

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key; database access is restricted by RLS | No |

The anon key is intended for a browser. RLS is the security boundary. Never expose a Supabase service-role key in the app.

## Administrator setup

1. Register a normal account through SmartQueue.
2. In Supabase **Table Editor → profiles**, find that account's profile row and copy its `id`.
3. In the SQL Editor, promote only that account:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'REPLACE_WITH_THE_PROFILE_UUID'::uuid;
   ```

4. Sign out and back in so the app reloads the updated role. The admin route is guarded both by the app and by database policies/RPC checks.

Never grant administrator status through user-editable signup metadata. New profiles are always created with the `user` role.

## Local development

From the workspace root:

```sh
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/smartqueue run dev
```

Copy `.env.example` to `.env` for local Vite use, then fill in the two public values. In Replit, set the same environment variables in the app's environment settings instead. The app is a web artifact and reads `VITE_` values at build time.

## Database and API

The migration is the source of truth for the Supabase schema. Core tables:

- `profiles`: one row per Auth user; role is `user` or `admin`
- `services`: active service definitions, token prefix, service duration, and daily cap
- `tokens`: daily token number, owner, service, status, and lifecycle timestamps
- `token_counters`: atomic per-service/per-day sequence counters

Queue position and wait estimates are calculated from current token states, not stored as stale values. The token sequence is allocated with an `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` counter operation inside the generation function. A partial unique index prevents multiple active tokens for one user and service.

RPC operations:

- `public_service_overview()` — active services, queue size, and serving token
- `generate_token(p_service_id)` — validates the user/service/cap, allocates a unique daily number, and returns live queue information
- `user_token_details(p_token_id)` — returns the caller's permitted current queue snapshot
- `cancel_token(p_token_id)` — cancels an eligible token owned by the caller
- `admin_call_next(p_service_id)` — completes the previous serving token, skips an unclaimed call, and calls the next waiting token
- `admin_set_token_status(p_token_id, p_status)` — validates an administrator status transition
- `admin_dashboard_summary()` — returns daily counts and average wait

The frontend reads profile, service, history, and admin queue rows through Supabase's RLS-protected PostgREST API. Authenticated changes to token state go through the RPC functions.

## Checks and testing

Run the workspace type checks:

```sh
pnpm --filter @workspace/smartqueue run typecheck
pnpm run typecheck
```

The database regression checks are in `supabase/tests/queue_invariants.sql`. Run them only against a development/test Supabase project after applying the migration; they require pgTAP and roll back their fixture users, service, and tokens. They cover profile creation, token allocation, duplicate prevention, queue position, cancellation, admin actions, and token RLS.

After Supabase is configured, use separate normal-user and administrator accounts to verify signup/login/logout, password recovery, profile updates, service browsing, token generation, per-service duplicate prevention, status updates, cancellation, history filters, and admin service/queue actions. To check concurrency, issue multiple `generate_token` calls for the same service at once from separate authenticated sessions; numbers must be distinct. Confirm a normal account cannot read another user's profile/token or invoke admin operations. The auth screens still require a live Supabase project for end-to-end verification.

## Deployment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the chosen host's build environment before publishing. Add the development and published app URLs to Supabase Auth's redirect allow list. Publish the SmartQueue web artifact from Replit, or build the static frontend for another host:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/smartqueue run build
```

The example uses the root preview path. Replit's managed workflow supplies `PORT` and `BASE_PATH`; for a manual local run or build, set `BASE_PATH` to the deployment prefix and choose an available `PORT`. The generated static files are written to `artifacts/smartqueue/dist/public`. Apply the same SQL migration to the Supabase project used by the deployment. Supabase Auth redirect URLs and environment values must match that deployment.

## GitHub

Run these commands from the workspace root after reviewing the files and confirming `.env` is not staged:

```sh
git init
git add .
git status --short
git commit -m "Initial SmartQueue application"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Do not commit `.env` files or private keys. `.env.example` is safe to commit.

## Known setup requirements and future work

- A Supabase project, its public URL/key, Auth provider settings, and SQL migration must be configured before accounts or queue actions can persist.
- Email delivery, production SMTP, and the domain's Auth redirect allow list are managed in Supabase.
- The initial deployment is a single-organization queue. Organization/tenant separation, SMS/email notifications, configurable service hours and time zones, and automated expiry scheduling can be added when the operating model is known.
