const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const creatorSql = readFileSync(path.join(__dirname, '..', 'supabase', 'creator.sql'), 'utf8');
const repliesSql = readFileSync(path.join(__dirname, '..', 'supabase', 'replies.sql'), 'utf8');
const studio = readFileSync(path.join(__dirname, '..', 'studio-page.js'), 'utf8');
const app = readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const adminPage = readFileSync(path.join(__dirname, '..', 'admin-page.js'), 'utf8');
const adminSql = readFileSync(path.join(__dirname, '..', 'supabase', 'admin.sql'), 'utf8');
const adminUserPage = readFileSync(path.join(__dirname, '..', 'admin-user-page.js'), 'utf8');

test('video deletion is restricted to owners and the two approved admin emails', () => {
  for (const email of ['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com']) assert.match(creatorSql, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(creatorSql, /create or replace function public\.soft_delete_video/);
  assert.match(creatorSql, /create or replace function public\.restore_video/);
  assert.match(creatorSql, /drop policy if exists "Owners and approved editors can update videos"/);
  assert.doesNotMatch(creatorSql, /create policy "Owners and approved editors can delete videos"/);
  assert.match(studio, /video\.owner_id === state\.user\.id \|\| isApprovedEditor\(\)/);
  assert.match(studio, /data-delete-video/);
  assert.match(studio, /rpc\('soft_delete_video'/);
});

test('comment replies use a same-video parent and authenticated RLS', () => {
  assert.match(creatorSql, /parent_id uuid references public\.comments\(id\) on delete cascade/);
  assert.match(creatorSql, /validate_comment_parent/);
  assert.match(creatorSql, /parent\.video_id = new\.video_id/);
  assert.match(creatorSql, /on public\.comments for insert[\s\S]*to authenticated/);
  assert.match(repliesSql, /add column if not exists parent_id/);
  assert.match(repliesSql, /notify pgrst, 'reload schema'/);
});

test('video creators can moderate comments on their videos and admins can moderate all content', () => {
  assert.match(creatorSql, /create policy "Authors and video editors can delete comments"/);
  assert.match(creatorSql, /user_id = auth\.uid\(\) or public\.can_manage_video\(video_id\)/);
  assert.match(app, /data-action="delete-comment"/);
  assert.match(app, /comment\.userId === state\.user\.id \|\| canManageCurrentVideo\(\)/);
  assert.match(adminPage, /arhamjaindhiraj@gmail\.com/);
  assert.match(adminPage, /data-admin-delete-video/);
  assert.match(adminPage, /data-admin-delete-comment/);
  assert.match(adminSql, /create or replace function public\.admin_list_users/);
  assert.match(adminSql, /create or replace function public\.admin_set_user_ban/);
  assert.match(adminSql, /delete_expires_at/);
  assert.match(adminUserPage, /admin_adjust_user_ban/);
  assert.match(adminUserPage, /0\.30/);
  assert.match(studio, /studio-analytics-list/);
  assert.match(studio, /studio-comments-list/);
});

test('home hero uses genre-specific destinations instead of a fixed travel action', () => {
  assert.match(app, /const heroSpots =/);
  assert.match(app, /state\.activeCategory !== 'All' && heroSpots\[state\.activeCategory\]/);
  assert.doesNotMatch(app, /setCategory\('Travel'\)/);
});

test('watch pages expose management only to the owner or approved admin', () => {
  assert.match(app, /watch-page-management/);
  assert.match(app, /Delete \/ manage in Creator Studio/);
  assert.match(app, /Delete \/ manage in Admin Dashboard/);
  assert.match(app, /const isOwner = Boolean\(state\.user && video\.ownerId === state\.user\.id\)/);
  assert.match(app, /toggle-comments/);
  assert.match(app, /hiddenComments/);
});
