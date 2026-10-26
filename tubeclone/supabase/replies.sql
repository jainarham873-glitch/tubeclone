-- Focused migration for threaded comment replies on an existing Tubeclone project.
-- Run after supabase/creator.sql. Safe to rerun.

begin;

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

drop policy if exists "Users can create comments" on public.comments;
drop policy if exists "Authors and video editors can update comments" on public.comments;

create policy "Users can create comments"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Authors and video editors can update comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid() or public.can_manage_video(video_id))
  with check (user_id = auth.uid() or public.can_manage_video(video_id));

notify pgrst, 'reload schema';
commit;
