---
name: Supabase integration
description: SmartQueue's Supabase connection and browser-security boundary.
---

SmartQueue connects directly to Supabase with the official browser SDK because this workspace had no usable managed Supabase integration. Browser configuration must contain only the project URL and public anon key. Queue mutations and cross-user queue calculations belong in narrow identity-checking PostgreSQL RPCs protected by RLS; never put a service-role key in frontend code.

**Why:** The app requires durable Auth, PostgreSQL, and Realtime behavior, while no managed Supabase connector was available in the workspace.

**How to apply:** Preserve this boundary when adding SmartQueue features: direct browser reads must obey RLS, and writes or aggregate reads requiring broader visibility should use a checked SQL function.
