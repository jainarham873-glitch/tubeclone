-- Admin moderation, user bans, and recoverable video deletion.
-- Run after schema.sql and creator.sql. Safe to rerun.

begin;

alter table public.videos add column if not exists deleted_at timestamptz;
alter table public.videos add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.videos add column if not exists delete_expires_at timestamptz;

create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_by uuid references auth.users(id) on delete set null,
  banned_until timestamptz,
  is_permanent boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_permanent or banned_until is not null)
);

alter table public.user_bans enable row level security;

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

create or replace function public.is_user_banned(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_bans
    where user_id = target_user_id
      and (is_permanent or banned_until > now())
  );
$$;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  video_count bigint,
  comment_count bigint,
  banned_until timestamptz,
  is_permanent boolean
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    u.id,
    u.email::text,
    p.username,
    p.display_name,
    p.avatar_url,
    u.created_at,
    count(distinct v.id) filter (where v.deleted_at is null) as video_count,
    count(distinct c.id) as comment_count,
    b.banned_until,
    coalesce(b.is_permanent, false) as is_permanent
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.videos v on v.owner_id = u.id
  left join public.comments c on c.user_id = u.id
  left join public.user_bans b on b.user_id = u.id
  where public.is_approved_editor()
  group by u.id, u.email, p.username, p.display_name, p.avatar_url, u.created_at, b.banned_until, b.is_permanent
  order by lower(coalesce(p.display_name, p.username, u.email::text));
$$;

create or replace function public.soft_delete_video(target_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner uuid;
begin
  select owner_id into target_owner
  from public.videos
  where id = target_video_id and deleted_at is null;

  if not found then
    raise exception 'Video not found or already deleted';
  end if;
  if not public.is_approved_editor() and (target_owner is null or target_owner <> auth.uid()) then
    raise exception 'You do not have permission to delete this video';
  end if;

  update public.videos
  set deleted_at = now(),
      deleted_by = auth.uid(),
      delete_expires_at = now() + interval '1 hour'
  where id = target_video_id;
  return true;
end;
$$;

create or replace function public.restore_video(target_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_deleted_at timestamptz;
  target_deleted_by uuid;
  target_expires_at timestamptz;
begin
  select deleted_at, deleted_by, delete_expires_at
  into target_deleted_at, target_deleted_by, target_expires_at
  from public.videos
  where id = target_video_id;

  if not found or target_deleted_at is null then
    raise exception 'Video is not in the deleted queue';
  end if;
  if target_expires_at is null or now() > target_expires_at then
    raise exception 'The one-hour recovery window has expired';
  end if;
  if not public.is_approved_editor() and target_deleted_by <> auth.uid() then
    raise exception 'Only the deleting owner or an approved admin can recover this video';
  end if;

  update public.videos
  set deleted_at = null, deleted_by = null, delete_expires_at = null
  where id = target_video_id;
  return true;
end;
$$;

create or replace function public.admin_set_user_ban(
  target_user_id uuid,
  duration_hours integer default 0,
  duration_minutes integer default 0,
  permanent boolean default false,
  ban_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  until_time timestamptz;
begin
  if not public.is_approved_editor() then
    raise exception 'Admin access required';
  end if;
  if duration_hours < 0 or duration_minutes < 0 or duration_minutes > 59 then
    raise exception 'Minutes must be between 0 and 59';
  end if;
  if not permanent and duration_hours = 0 and duration_minutes = 0 then
    raise exception 'Choose a ban duration or permanent ban';
  end if;

  until_time := case when permanent then null else now() + make_interval(hours => duration_hours, mins => duration_minutes) end;
  insert into public.user_bans (user_id, banned_by, banned_until, is_permanent, reason, updated_at)
  values (target_user_id, auth.uid(), until_time, permanent, ban_reason, now())
  on conflict (user_id) do update set
    banned_by = excluded.banned_by,
    banned_until = excluded.banned_until,
    is_permanent = excluded.is_permanent,
    reason = excluded.reason,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.admin_adjust_user_ban(target_user_id uuid, delta_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ban public.user_bans;
  next_until timestamptz;
begin
  if not public.is_approved_editor() then
    raise exception 'Admin access required';
  end if;
  select * into current_ban from public.user_bans where user_id = target_user_id;
  if not found then
    raise exception 'This user is not currently banned';
  end if;
  if current_ban.is_permanent then
    raise exception 'Permanent bans must be changed with Unban';
  end if;
  next_until := greatest(now(), current_ban.banned_until) + make_interval(mins => delta_minutes);
  if next_until <= now() then
    delete from public.user_bans where user_id = target_user_id;
  else
    update public.user_bans set banned_until = next_until, updated_at = now() where user_id = target_user_id;
  end if;
  return true;
end;
$$;

create or replace function public.admin_unban_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_editor() then
    raise exception 'Admin access required';
  end if;
  delete from public.user_bans where user_id = target_user_id;
  return true;
end;
$$;

grant execute on function public.is_user_banned(uuid) to anon, authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.soft_delete_video(uuid) to authenticated;
grant execute on function public.restore_video(uuid) to authenticated;
grant execute on function public.admin_set_user_ban(uuid, integer, integer, boolean, text) to authenticated;
grant execute on function public.admin_adjust_user_ban(uuid, integer) to authenticated;
grant execute on function public.admin_unban_user(uuid) to authenticated;

drop policy if exists "Public videos are viewable" on public.videos;
create policy "Public videos are viewable"
  on public.videos for select
  using ((deleted_at is null and visibility = 'public') or owner_id = auth.uid() or public.is_approved_editor());

drop policy if exists "Owners and approved editors can delete videos" on public.videos;
drop policy if exists "Users can delete their own videos" on public.videos;

drop policy if exists "Public comments are viewable" on public.comments;
create policy "Public comments are viewable"
  on public.comments for select
  using (public.is_approved_editor() or exists (
    select 1 from public.videos
    where public.videos.id = comments.video_id and public.videos.deleted_at is null
  ));

drop policy if exists "Users can read their own ban" on public.user_bans;
drop policy if exists "Admins can read bans" on public.user_bans;
create policy "Users can read their own ban"
  on public.user_bans for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can read bans"
  on public.user_bans for select
  to authenticated
  using (public.is_approved_editor());

notify pgrst, 'reload schema';
commit;
