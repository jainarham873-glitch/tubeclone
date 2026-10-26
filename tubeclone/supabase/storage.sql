-- Tubeclone public upload buckets.
-- Run supabase/schema.sql before this file, then run this file in the SQL Editor.
-- Public buckets make stored objects downloadable by anyone who has the URL.

begin;

-- Only configure the two buckets owned by this upload flow. Other buckets are untouched.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos', 'videos', true, 52428800, array['video/mp4', 'video/webm']::text[]),
  ('thumbnails', 'thumbnails', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Rerunnable policy replacement. These policies only apply to the two buckets above.
drop policy if exists "Authenticated users can insert video objects" on storage.objects;
drop policy if exists "Authenticated users can select video objects" on storage.objects;
drop policy if exists "Authenticated users can delete video objects" on storage.objects;
drop policy if exists "Authenticated users can insert thumbnail objects" on storage.objects;
drop policy if exists "Authenticated users can select thumbnail objects" on storage.objects;
drop policy if exists "Authenticated users can delete thumbnail objects" on storage.objects;

create policy "Authenticated users can insert video objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Authenticated users can select video objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Authenticated users can delete video objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Authenticated users can insert thumbnail objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Authenticated users can select thumbnail objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Authenticated users can delete thumbnail objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

commit;
