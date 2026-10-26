-- Creator controls and comments.
-- Run after schema.sql. This is safe to rerun and never stores an API secret.

begin;

alter table public.videos add column if not exists pinned boolean not null default false;
alter table public.videos add column if not exists deleted_at timestamptz;
alter table public.videos add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.videos add column if not exists delete_expires_at timestamptz;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create or replace function public.validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments parent
    where parent.id = new.parent_id and parent.video_id = new.video_id
  ) then
    raise exception 'A comment reply must belong to the same video as its parent';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_parent_video_check on public.comments;
create trigger comments_parent_video_check
  before insert or update of video_id, parent_id on public.comments
  for each row execute procedure public.validate_comment_parent();

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

create or replace function public.can_manage_video(target_video_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.videos
    where id = target_video_id and owner_id = auth.uid()
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'arhamjaindhiraj@gmail.com',
    'jainarham873@gmail.com'
  );
$$;

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

grant execute on function public.soft_delete_video(uuid) to authenticated;
grant execute on function public.restore_video(uuid) to authenticated;

drop policy if exists "Public videos are viewable" on public.videos;
create policy "Public videos are viewable"
  on public.videos for select
  using ((deleted_at is null and visibility = 'public') or owner_id = auth.uid() or public.is_approved_editor());

drop policy if exists "Users can update their own videos" on public.videos;
drop policy if exists "Users can delete their own videos" on public.videos;
drop policy if exists "Owners and approved editors can delete videos" on public.videos;
drop policy if exists "Owners and approved editors can update videos" on public.videos;

create policy "Owners and approved editors can update videos"
  on public.videos for update
  using (public.can_manage_video(id) and deleted_at is null)
  with check (public.can_manage_video(id) and deleted_at is null);

drop policy if exists "Public comments are viewable" on public.comments;
drop policy if exists "Users can create comments" on public.comments;
drop policy if exists "Authors and video editors can update comments" on public.comments;
drop policy if exists "Authors and video editors can delete comments" on public.comments;
drop policy if exists "Public comment likes are viewable" on public.comment_likes;
drop policy if exists "Users can like comments" on public.comment_likes;
drop policy if exists "Users can remove their comment likes" on public.comment_likes;

create policy "Public comments are viewable"
  on public.comments for select
  using (public.is_approved_editor() or exists (
    select 1 from public.videos
    where public.videos.id = comments.video_id and public.videos.deleted_at is null
  ));

create policy "Users can create comments"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Authors and video editors can update comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid() or public.can_manage_video(video_id))
  with check (user_id = auth.uid() or public.can_manage_video(video_id));

create policy "Authors and video editors can delete comments"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid() or public.can_manage_video(video_id));

create policy "Public comment likes are viewable"
  on public.comment_likes for select
  using (true);

create policy "Users can like comments"
  on public.comment_likes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can remove their comment likes"
  on public.comment_likes for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
commit;
