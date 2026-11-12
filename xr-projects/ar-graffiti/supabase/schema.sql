-- AR Graffiti · Phase 0 (prove anchoring) — Supabase schema
-- Paste this whole file into Supabase Dashboard > SQL Editor > New query > Run.
-- Safe to re-run: it only creates what's missing and replaces the policies.
--
-- Three tables:
--   anchors           one row per placed test marker (where it is + how it faces)
--   resolve_sessions  one row each time any phone tries to load a marker (did it appear, how long it took)
--   measurements      one row each time a tester marks the real X + facing dot (how far off the marker was)
--
-- Every signed-in user (each phone gets its own anonymous account) can read everything,
-- and can only write rows as themselves.

-- ───────────────────────────── anchors ─────────────────────────────
create table if not exists public.anchors (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  created_by              uuid not null default auth.uid() references auth.users (id) on delete cascade,

  label                   text not null,
  spot                    text,
  light                   text,
  anchor_type             text not null default 'terrain' check (anchor_type in ('terrain', 'wgs84')),

  latitude                double precision not null check (latitude between -90 and 90),
  longitude               double precision not null check (longitude between -180 and 180),
  altitude                double precision not null,          -- WGS84 metres of the X when placed
  altitude_above_terrain  double precision not null default 0, -- used for terrain anchors

  -- Rotation relative to East-Up-North, as Unity's ARCore Extensions reports it.
  eun_x                   double precision not null,
  eun_y                   double precision not null,
  eun_z                   double precision not null,
  eun_w                   double precision not null,
  heading_deg             double precision,                    -- compass bearing the marker faces (readability only)

  -- Localization quality on the placer's phone at the moment of saving.
  place_h_acc             double precision,
  place_v_acc             double precision,
  place_yaw_acc           double precision,

  platform                text,
  device_model            text,
  app_version             text
);

create index if not exists anchors_created_at_idx on public.anchors (created_at desc);

-- ───────────────────────────── resolve_sessions ─────────────────────────────
create table if not exists public.resolve_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anchor_id     uuid not null references public.anchors (id) on delete cascade,

  platform      text,
  device_model  text,
  app_version   text,
  spot          text,
  light         text,

  cold_start    boolean not null default false,  -- AR was reset before loading (lock time includes localizing from scratch)
  is_placer     boolean not null default false,  -- the placer's own automatic re-load right after saving
  success       boolean not null,
  state         text,                            -- e.g. Success, ErrorUnsupportedLocation, Success/NotTracking
  gate_met      boolean,                         -- localization reached the resolve gate before resolving
  gate_wait_s   double precision,                -- load tapped → localization good enough
  resolve_s     double precision,                -- resolve called → anchor tracking
  lock_s        double precision,                -- load tapped → marker visible (the brief's lock time)

  h_acc         double precision,                -- -1 = earth not tracking at that moment
  v_acc         double precision,
  yaw_acc       double precision
);

create index if not exists resolve_sessions_anchor_idx on public.resolve_sessions (anchor_id, created_at desc);

-- ───────────────────────────── measurements ─────────────────────────────
create table if not exists public.measurements (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anchor_id           uuid not null references public.anchors (id) on delete cascade,
  session_id          uuid references public.resolve_sessions (id) on delete set null,

  platform            text,
  device_model        text,
  spot                text,
  light               text,
  is_placer           boolean not null default false,

  horizontal_error_m  double precision not null check (horizontal_error_m >= 0),
  direction_known     boolean not null default true,
  east_error_m        double precision,   -- + = marker sits east of the real X
  north_error_m       double precision,   -- + = marker sits north of the real X
  vertical_error_m    double precision,   -- + = marker floats above the ground at the X
  yaw_error_deg       double precision,   -- + = marker turned clockwise (seen from above)
  camera_distance_m   double precision,

  h_acc               double precision,
  v_acc               double precision,
  yaw_acc             double precision,
  low_confidence      boolean not null default false,
  hours_since_placed  double precision
);

create index if not exists measurements_anchor_idx on public.measurements (anchor_id, created_at desc);

-- ───────────────────────────── row level security ─────────────────────────────
alter table public.anchors          enable row level security;
alter table public.resolve_sessions enable row level security;
alter table public.measurements     enable row level security;

drop policy if exists "read anchors"            on public.anchors;
drop policy if exists "insert own anchors"      on public.anchors;
drop policy if exists "delete own anchors"      on public.anchors;
drop policy if exists "read sessions"           on public.resolve_sessions;
drop policy if exists "insert own sessions"     on public.resolve_sessions;
drop policy if exists "read measurements"       on public.measurements;
drop policy if exists "insert own measurements" on public.measurements;

create policy "read anchors"        on public.anchors for select to authenticated using (true);
create policy "insert own anchors"  on public.anchors for insert to authenticated with check (created_by = (select auth.uid()));
create policy "delete own anchors"  on public.anchors for delete to authenticated using (created_by = (select auth.uid()));

create policy "read sessions"       on public.resolve_sessions for select to authenticated using (true);
create policy "insert own sessions" on public.resolve_sessions for insert to authenticated with check (user_id = (select auth.uid()));

create policy "read measurements"       on public.measurements for select to authenticated using (true);
create policy "insert own measurements" on public.measurements for insert to authenticated with check (user_id = (select auth.uid()));

-- Results are append-only: no update policies, so nobody (including the app) can edit a logged result.

grant select, insert, delete on public.anchors to authenticated;
grant select, insert         on public.resolve_sessions to authenticated;
grant select, insert         on public.measurements to authenticated;
