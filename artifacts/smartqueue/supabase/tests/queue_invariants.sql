-- Run only against a development/test Supabase project with pgTAP enabled.
-- All fixture writes roll back at the end of the test.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth;
select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token
)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated',
   'smartqueue-test-user-101@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Queue Test One","phone":"+15550000101"}'::jsonb, now(), now(), ''),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated',
   'smartqueue-test-user-102@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Queue Test Two","phone":"+15550000102"}'::jsonb, now(), now(), '')
on conflict (id) do nothing;

insert into public.services (
  id, name, description, department, prefix,
  average_service_time_minutes, max_daily_tokens, is_active
)
values (
  '00000000-0000-4000-8000-000000000201',
  'SmartQueue Test Service', 'Disposable test fixture', 'Testing', 'T', 5, 20, true
)
on conflict (id) do nothing;

update public.profiles set role = 'admin'
where id = '00000000-0000-4000-8000-000000000102';

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-8000-000000000101'),
  'user',
  'signup trigger creates a non-admin profile'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
create temporary table smartqueue_test_tokens (
  first_token jsonb,
  second_token jsonb,
  called_token jsonb
);
insert into smartqueue_test_tokens (first_token)
select public.generate_token('00000000-0000-4000-8000-000000000201');

select is(
  (select first_token ->> 'token_number' from smartqueue_test_tokens),
  'T001',
  'first token uses the configured prefix and starts at 001'
);

select throws_ok(
  $$select public.generate_token('00000000-0000-4000-8000-000000000201')$$,
  'P0001',
  'You already have an active token for this service.',
  'a user cannot create a second active token for the same service'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
update smartqueue_test_tokens
set second_token = public.generate_token('00000000-0000-4000-8000-000000000201');

select isnt(
  (select first_token ->> 'token_number' from smartqueue_test_tokens),
  (select second_token ->> 'token_number' from smartqueue_test_tokens),
  'different users receive distinct sequential token numbers'
);
select is(
  (select (second_token ->> 'queue_position')::integer from smartqueue_test_tokens),
  2,
  'queue position counts earlier waiting tickets'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select is(
  public.cancel_token((select (first_token ->> 'id')::uuid from smartqueue_test_tokens)),
  true,
  'an owner can cancel their waiting token'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select is(
  (public.user_token_details((select (second_token ->> 'id')::uuid from smartqueue_test_tokens))
    ->> 'queue_position')::integer,
  1,
  'queue position updates after an earlier token is cancelled'
);

update smartqueue_test_tokens
set called_token = public.admin_call_next('00000000-0000-4000-8000-000000000201');
select is(
  (select called_token ->> 'status' from smartqueue_test_tokens),
  'CALLED',
  'an administrator can call the next waiting token'
);

select is(
  public.admin_set_token_status(
    (select (second_token ->> 'id')::uuid from smartqueue_test_tokens),
    'SERVING'
  ),
  true,
  'an administrator can start serving a called token'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config(
  'smartqueue.test.other_token_id',
  (select second_token ->> 'id' from smartqueue_test_tokens),
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.tokens
    where id = current_setting('smartqueue.test.other_token_id')::uuid),
  0,
  'row-level security hides another user’s token'
);
reset role;

select * from finish();
rollback;
