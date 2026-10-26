-- Tubeclone starter schema.
-- Run this in Supabase SQL Editor after creating a project.
-- Never expose a service_role key in the browser.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  thumbnail_url text,
  video_url text,
  media_type text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  delete_expires_at timestamptz,
  category text not null default 'All',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now()
);

alter table public.videos
  add column if not exists media_type text;

alter table public.videos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists delete_expires_at timestamptz;

create table if not exists public.watch_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.saved_videos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.video_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.subscriptions (
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, channel_id),
  check (subscriber_id <> channel_id)
);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.watch_history enable row level security;
alter table public.saved_videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.subscriptions enable row level security;

-- Public feed: only public videos are readable. Owners can manage their own uploads.
create or replace function public.is_approved_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'arhamjaindhiraj@gmail.com',
    'jainarham873@gmail.com'
  );
$$;

drop policy if exists "Public videos are viewable" on public.videos;
drop policy if exists "Users can create their own videos" on public.videos;
drop policy if exists "Users can update their own videos" on public.videos;
drop policy if exists "Users can delete their own videos" on public.videos;
drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can create their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Users manage their watch history" on public.watch_history;
drop policy if exists "Users manage their saved videos" on public.saved_videos;
drop policy if exists "Users manage their likes" on public.video_likes;
drop policy if exists "Users manage their subscriptions" on public.subscriptions;

create policy "Public videos are viewable"
  on public.videos for select
  using ((deleted_at is null and visibility = 'public') or owner_id = auth.uid() or public.is_approved_editor());

create policy "Users can create their own videos"
  on public.videos for insert
  with check (owner_id = auth.uid());

create policy "Users can update their own videos"
  on public.videos for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can create their profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update their profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users manage their watch history"
  on public.watch_history for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their saved videos"
  on public.saved_videos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their likes"
  on public.video_likes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their subscriptions"
  on public.subscriptions for all
  using (subscriber_id = auth.uid())
  with check (subscriber_id = auth.uid());

-- Create a profile row automatically whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Creator')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for users that existed before this trigger was installed.
insert into public.profiles (id, username, display_name)
select
  u.id,
  'user_' || replace(u.id::text, '-', ''),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), 'Creator')
from auth.users as u
on conflict (id) do nothing;

notify pgrst, 'reload schema';
commit;
