-- DJ MAX Ai — Supabase RLS schema
-- Run this SQL in your Supabase project's SQL Editor (once).
-- Then enable Google OAuth and Phone auth in Authentication → Providers.

-- ============================================================
-- PROFILES TABLE (extends auth.users with app-specific fields)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  phone text,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email, phone, name, avatar_url)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email, new.phone),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: current user's role
create or replace function public.current_role_is(r text)
returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = r);
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select using (public.current_role_is('admin'));

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.current_role_is('admin'))
  with check (public.current_role_is('admin'));

-- ============================================================
-- SESSIONS / PLAYLISTS / HISTORY (optional — per-user private)
-- ============================================================
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.user_sessions enable row level security;
drop policy if exists "sessions_self" on public.user_sessions;
create policy "sessions_self" on public.user_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "sessions_admin" on public.user_sessions;
create policy "sessions_admin" on public.user_sessions
  for select using (public.current_role_is('admin'));

-- ============================================================
-- MAKE YOURSELF ADMIN (run once after your first sign-up)
-- Replace the email below with the email you signed up with.
-- ============================================================
-- update public.profiles set role = 'admin' where email = 'you@example.com';

-- ============================================================
-- TITAN RADIO — manual OTP registration log (anon-writable)
-- Stores each user that completed the email-OTP gate, so the admin
-- (kobi@media-deal.co.il) has a permanent record of every entry.
-- ============================================================
create table if not exists public.radio_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  source text not null default 'gate',          -- 'gate' (home) or 'radio' (tab)
  otp text,                                     -- 6-digit code that was sent
  status text not null default 'pending'        -- 'pending' | 'verified'
    check (status in ('pending','verified')),
  user_agent text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists radio_users_email_idx on public.radio_users(email);
create index if not exists radio_users_status_idx on public.radio_users(status);

alter table public.radio_users enable row level security;

-- Anonymous insert (so the static client can log entries with the anon key).
drop policy if exists "radio_users_anon_insert" on public.radio_users;
create policy "radio_users_anon_insert" on public.radio_users
  for insert to anon, authenticated with check (true);

-- Anonymous self-update by email + otp (lets the gate flip pending → verified).
drop policy if exists "radio_users_anon_update" on public.radio_users;
create policy "radio_users_anon_update" on public.radio_users
  for update to anon, authenticated using (true) with check (true);

-- Admins can read every row in the dashboard.
drop policy if exists "radio_users_admin_read" on public.radio_users;
create policy "radio_users_admin_read" on public.radio_users
  for select using (public.current_role_is('admin'));

-- ============================================================
-- TITAN RADIO — submissions to user-built stations
-- ============================================================
create table if not exists public.radio_submissions (
  id uuid primary key default gen_random_uuid(),
  station_name text not null,
  station_frequency numeric(6,1) not null,
  from_name text,
  type text not null check (type in ('request','shoutout','message')),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.radio_submissions enable row level security;
drop policy if exists "radio_subs_anon_insert" on public.radio_submissions;
create policy "radio_subs_anon_insert" on public.radio_submissions
  for insert to anon, authenticated with check (true);
drop policy if exists "radio_subs_admin_read" on public.radio_submissions;
create policy "radio_subs_admin_read" on public.radio_submissions
  for select using (public.current_role_is('admin'));

-- ============================================================
-- REQUIRED DASHBOARD STEPS AFTER RUNNING THIS SQL:
-- 1. Authentication → Providers → Enable Google
--    - Paste your Google OAuth Client ID + Secret (from console.cloud.google.com)
-- 2. Authentication → Providers → Enable Phone
--    - Connect Twilio or MessageBird; for WhatsApp use Twilio's
--      WhatsApp Sandbox / Approved WA Sender.
-- 3. Authentication → URL Configuration → add your site URL
--    (e.g. https://djkobikobi.vercel.app).
-- 4. Settings → API → copy Project URL + anon public key into
--    the app (Settings → Auth).
-- ============================================================
