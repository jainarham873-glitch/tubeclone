-- Upgrade an existing Tubeclone database without changing Auth, RLS, or data.
-- Run in the Supabase SQL Editor. Safe to rerun.
begin;

-- Leave older rows unknown rather than labelling every image/document as MP4.
-- The client infers a preview type from the URL when this field is null.
alter table public.videos
  add column if not exists media_type text;

notify pgrst, 'reload schema';
commit;
