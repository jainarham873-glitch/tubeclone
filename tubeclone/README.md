# Tubeclone

A polished YouTube-style video discovery interface built as a dependency-free static app. It includes a responsive dark layout, search, category filtering, video detail modal, save/like/subscribe state, and optional Supabase authentication.

## Run it locally

This is a static app, so you do not need a build step.

```bash
cd /mnt/c/Users/abc/Downloads/tubeclone
python3 -m http.server 4173
```

Open <http://localhost:4173>.

Do not open `index.html` directly from `file://`; the local server is needed for the Supabase browser client and remote assets.

## Test the site on a phone with Netlify

Yes — this app works on HTTPS. The Supabase project URL and Cloudinary upload endpoint are already HTTPS, and the app is a static site with separate HTML pages. Netlify's generated `*.netlify.app` URL is HTTPS automatically, so it is suitable for testing the real mobile browser behavior.

### Fastest option: Netlify Drop

1. Open Netlify Drop and sign in: <https://app.netlify.com/drop>.
2. Drag the whole `/mnt/c/Users/abc/Downloads/tubeclone` folder into the drop area. Do not drag only one HTML file.
3. Open the generated `https://...netlify.app` URL on your phone.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to that HTTPS URL and add these redirect URLs:

   ```text
   https://YOUR-SITE.netlify.app/login.html
   https://YOUR-SITE.netlify.app/reset-password.html
   https://YOUR-SITE.netlify.app/**
   ```

   Use the exact `login.html` and `reset-password.html` entries for production-style testing. The wildcard is convenient for a temporary test site and preview paths.
5. Hard-refresh the phone browser after changing Supabase URL settings. Sign up or sign in, then test Upload, Creator Studio, comments, and the Admin Dashboard from an approved admin account.

To publish later changes with Netlify Drop, open the site's **Deploys** page and drag the updated project folder into the deploy drop area again.

### CLI option

Netlify CLI is not installed in this workspace yet. On your computer, from this folder, install it and deploy a draft preview:

```bash
npm install -g netlify-cli
netlify deploy --dir .
```

The first command prompts you to log in or create/link a site. A draft deploy gives you a temporary HTTPS URL for phone testing. When you are ready to publish the main site URL, use:

```bash
netlify deploy --prod --dir .
```

The included [`netlify.toml`](netlify.toml) sets the publish directory to the project root, so all separate HTML pages are included. Netlify's local state is kept under `.netlify/`, which is ignored and must not be committed.

### What must remain public versus secret

- `supabase-config.js` may contain the Supabase project URL and publishable/anon key; never put a `service_role` key there.
- `cloudinary-config.js` may contain the Cloudinary cloud name and unsigned upload preset; never put a Cloudinary API secret there.
- No Netlify environment variable is required for this current static client because the browser config files already contain the public client values.

## Connect Supabase — do this every time you set up a new environment

### 1. Create or open a Supabase project

1. Go to <https://supabase.com/dashboard> and create a project.
2. In **Project Settings → API**, copy the **Project URL** and the **Publishable key** (older projects may call this the `anon` key).
3. Never use the `service_role` key in this frontend. It bypasses Row Level Security and must stay server-side.

### 2. Add the database tables and security policies

1. Open **SQL Editor** in Supabase.
2. Paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. The script creates profiles, videos, watch history, saved videos, likes, and subscriptions, with Row Level Security policies for user-owned records.
4. It is safe to rerun: it runs in a transaction, does not drop tables or data, replaces the named policies, installs the profile trigger, and backfills missing profiles for existing auth users.

### 2b. Add Creator Studio permissions and comments

After `schema.sql`, run [`supabase/creator.sql`](supabase/creator.sql). It adds video pinning, comments, comment likes, soft-delete/recovery functions, and RLS policies. A video owner can edit/pin/soft-delete their own video and manage comments on that video. The two approved editor emails are `arhamjaindhiraj@gmail.com` and `jainarham873@gmail.com`; the database checks the authenticated JWT email, so the UI cannot grant access by itself.

### 2c. Add admin users, bans, and recovery

After `creator.sql`, run [`supabase/admin.sql`](supabase/admin.sql). It adds the admin user-list RPC, the `user_bans` table and ban RPCs, admin moderation queries, and the one-hour recovery policies. Run this before using `admin.html` or the user moderation pages.

### 2d. Upgrade an existing project for file types

If publishing reports **“Could not find the 'media_type' column of 'videos' in the schema cache”**, run `supabase/media.sql` in the existing project's SQL Editor:

```sql
begin;
alter table public.videos add column if not exists media_type text;
notify pgrst, 'reload schema';
commit;
```

This focused migration adds only the optional file-type field and requests a schema-cache reload. It does not change authentication, permissions, or existing records. Older rows are left `null`; the app infers their preview type from the file URL rather than labelling every document/image as a video. New projects get the field from `schema.sql` already. Refresh the app after applying the migration.

Until the migration is applied, both upload services recognize the specific missing-column error and retry **only the database insert**, omitting `media_type`. They reuse the URLs already uploaded, with the same owner and visibility. Auth/RLS, unrelated schema errors, and ambiguous network failures are not retried. The home feed also works without the column. An initial handled HTTP 400 can still appear in DevTools on an older schema; the SQL migration removes that cause permanently. The fallback does not recover orphaned Cloudinary files from uploads that failed before this fix.

### 3. Add the upload buckets and policies

1. After `schema.sql` succeeds, paste and run [`supabase/storage.sql`](supabase/storage.sql).
2. It idempotently configures the public `videos` bucket for `video/mp4` and `video/webm` up to 50 MiB, and the public `thumbnails` bucket for `image/jpeg`, `image/png`, and `image/webp` up to 5 MiB.
3. Upload object paths must start with the signed-in user's UUID, for example `<auth.uid()>/<unique-file-name>`. Authenticated users can insert, select, and delete only objects in their own first-level folder. There is intentionally no update policy; use unique object filenames.

**Public bucket warning:** public URLs are downloadable by anyone who has the URL, including objects that have no row in `videos`. The supported publishing flow is **PUBLIC** only. Do not treat `private` or `unlisted` video rows as secure while these public buckets are in use. This migration only changes the `videos` and `thumbnails` buckets and their named policies.

### 4. Add the browser keys

Edit [`supabase-config.js`](supabase-config.js):

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
};
```

Use the project URL exactly as shown above. Do **not** paste the REST API URL ending in `/rest/v1/`; the Supabase JavaScript client adds its own `/rest/v1` and `/auth/v1` paths. The app now strips those suffixes automatically if one was pasted by mistake.

The app reads those values when it starts. For a machine-local setup that should not modify the file, use the browser console instead:

```js
localStorage.setItem('tubeclone.supabase.url', 'https://YOUR_PROJECT_REF.supabase.co')
localStorage.setItem('tubeclone.supabase.anonKey', 'YOUR_PUBLISHABLE_OR_ANON_KEY')
location.reload()
```

### 5. Configure authentication

In **Authentication → Providers**, enable Email. Under **Authentication → Settings**, choose whether email confirmation is required. If confirmation is required, the user must open the confirmation email before sign-in and upload. In **Authentication → URL Configuration**, set the local **Site URL** to `http://localhost:4173` and add this **Redirect URL**:

```text
http://localhost:4173/**
```

The app uses **Supabase Auth** for email/password login, account creation, sessions, email confirmation, sign-out, and password recovery. The main entry point is `login.html`; `forgot-password.html` requests a recovery email and `reset-password.html` accepts the password change from a verified Supabase recovery link. `auth-service.js` keeps all auth operations in one small boundary, validates same-site redirects, verifies the recovery identity, and avoids showing whether a recovery email belongs to an account. The inline form on `upload.html` still signs in without navigating away, so the selected files are not lost.

Cloudinary is only the media provider, not a login provider. Both publishing services verify the user with `auth.getUser()` before transferring files and again before saving the post. There is no separate local-password authentication system; the mocks in `tests/` are test-only.

All app pages are now protected by `auth-gate.js`. A visitor who is not verified by Supabase Auth is redirected to `login.html` before the page is made visible; after sign-in, the safe requested page opens. The public exceptions are `login.html`, `forgot-password.html`, and `reset-password.html`.

#### Password recovery setup

1. In Supabase **Authentication → Providers**, enable Email. Keep email confirmation enabled for real accounts unless you have a specific reason not to.
2. In **Authentication → URL Configuration**, set the correct Site URL and add the exact reset callback for each environment. For local development with the usual server, add:

   ```text
   http://localhost:4173/reset-password.html
   http://127.0.0.1:4173/reset-password.html
   http://localhost:4174/reset-password.html
   http://127.0.0.1:4174/reset-password.html
   ```

   Add your deployed `https://your-domain/reset-password.html` separately. Use exact production paths rather than a broad wildcard where possible. The signup confirmation callback is `login.html`, so add the matching local and production `login.html` URLs too.
3. Supabase's default email service is for testing and may only deliver to authorized team addresses with strict, changeable rate limits. Configure custom SMTP before production; password recovery cannot work until Supabase can send the email.
4. Ask for a reset from `forgot-password.html`, open the newest message, and finish at `reset-password.html`. Reset links are single-use/expiring Supabase credentials; do not paste them into chat or screenshots. After a successful update, the recovery session is signed out before the user is asked to log in again.

### Video deletion permissions

An authenticated owner can edit, pin, and delete their own videos and can delete comments on their own videos. The approved admin emails `arhamjaindhiraj@gmail.com` and `jainarham873@gmail.com` can manage visible videos and comments owned by other users too. These permissions are enforced by Supabase RLS in `supabase/creator.sql`; the Studio and Admin Dashboard UI are not the security boundary. Video deletion is soft deletion: the record moves to a one-hour recovery queue instead of being hard-deleted. Cloudinary originals are not deleted from browser code because that would expose a Cloudinary API secret; signed server-side cleanup can be added later.

### Admin Console

`admin.html` is an admin-only moderation page. It is linked from the account drawer only for the two approved admin emails and is protected by a server-checked admin session plus Supabase RLS. Non-admins do not see the link and direct visits redirect back to the account page. The dashboard searches every user email, username, and display name, shows profile pictures and ban status, and opens `admin-user.html` for per-user video, comment, and ban controls. Admins can soft-delete/recover any video during the one-hour window, delete comments, issue timed bans such as `0.30` for 30 minutes, add or remove ban time, unban, or permanently ban a user.

For existing projects, run `supabase/admin.sql` after `supabase/creator.sql`. It adds recoverable video deletion, the `user_bans` table, admin user-list RPCs, ban management RPCs, and the RLS/policy updates used by the dashboard. The app sends active banned users to `banned.html`.

### Comment replies

Run `supabase/creator.sql` on a new project, or run the focused `supabase/replies.sql` migration on an existing project. It adds `comments.parent_id`, validates that a reply belongs to the same video, and keeps replies behind the same authenticated comment policies. The watch page renders replies in a threaded view. If an older project has not run the migration, existing top-level comments still load and the UI explains which migration is required before replying.

### 6. Add production URLs before deploying

When you deploy, add the exact production URL plus `/login.html` and `/reset-password.html` in Supabase **URL Configuration**. Also update any hosting provider environment/configuration with the same public URL and publishable key. Keep `service_role` out of frontend files, git, and client-side environment variables.

## Use Cloudinary for video and thumbnail media

Yes — Cloudinary replaces Supabase Storage for media while Supabase continues to handle authentication and the `videos` database rows. The app uses Cloudinary when both values in [`cloudinary-config.js`](cloudinary-config.js) are filled; if they are blank, it keeps the Supabase Storage upload fallback.

### Cloudinary setup

1. Create a Cloudinary account and open **Console Settings → Upload presets**.
2. Create an **unsigned** upload preset. Configure it to allow the formats you want to publish, and restrict the preset to the `tubeclone` folder or its subfolders where possible. The Cloudinary path accepts any non-empty file up to the client guard; playable video/audio files open in the player, images display in the player, and other files receive an open/download link.
3. Copy your Cloudinary **cloud name** and unsigned **upload preset name** into [`cloudinary-config.js`](cloudinary-config.js):

```js
window.CLOUDINARY_CONFIG = {
  cloudName: 'YOUR_CLOUD_NAME',
  unsignedUploadPreset: 'YOUR_UNSIGNED_PRESET',
  folder: 'tubeclone',
};
```

4. Hard-refresh the site and sign in. New uploads go directly to Cloudinary, then optimized delivery URLs are saved into `videos.video_url` and `videos.thumbnail_url` in Supabase.

The client calls Cloudinary's `auto/upload` endpoint for the main file and `image/upload` for the optional thumbnail. The app now allows any non-empty main file up to 2 GiB and image thumbnails up to 100 MiB in the Cloudinary path. Files larger than 100 MB are uploaded in 20 MB chunks with Cloudinary's resumable chunk headers. Your actual Cloudinary account plan and usage limits still apply, so a plan-level limit can be lower than the client guard. Unsigned presets are visible to browser users and can be abused, so keep the preset restrictive and rotate it if it is exposed. Never put a Cloudinary API secret in this project. For production, move to signed uploads through a backend when you need stronger control. Cloudinary's signed upload secret must remain server-side.

Cloudinary media is public in this current UI flow. The original asset is kept in Cloudinary, while the saved delivery URL adds automatic quality and format selection plus a display-size cap (`q_auto`, `f_auto`, and width limits). The browser then natively decodes the compressed format it receives; no custom client-side decompression step is needed. A failed database insert can leave an uploaded Cloudinary asset that must be removed from Cloudinary's Media Library; signed server-side cleanup can be added later.

## Signed-in upload flow

**Create** on the home page and **Upload** in Creator Studio open the standalone `upload.html` page (not a modal). Old `index.html#upload` links redirect there too. Run the usual static server and open `/upload.html` directly.

1. Select or drop one file. With Cloudinary configured, the client limit is 2 GiB for the main file and 100 MiB for image thumbnails; Cloudinary's account and preset restrictions still apply. With Cloudinary blank, the page shows the existing Supabase limits: MP4/WebM up to 50 MiB and JPG/PNG/WebP thumbnails up to 5 MiB.
2. Edit the suggested title, description, category, and optional thumbnail. The responsive page includes local video/audio/image previews, a generic preview for other files, character counters, and replace/remove controls. Files are not uploaded just by selecting them. Unpreviewable media does not block the form.
3. Choose **Review upload**. Sign in on the page if needed; this preserves your selection. Confirm that you have permission to share the file publicly, then choose **Publish**.
4. The existing upload service checks authentication, prepares the profile, transfers the files, inserts the public `videos` row, and returns it. Controls are disabled during publishing to prevent duplicate submissions. Progress shows service stages and per-file percentages only when available; it does not simulate progress or promise a time estimate.
5. On success, **View upload** opens the returned record in the watch page, **Manage in Studio** opens Creator Studio, and **Upload another** resets the form. On failure, the selected files and details remain available for an intentional retry. If media transferred before the failure, check your provider and Studio first to avoid duplicate/orphan assets. Supabase Storage cleanup and Cloudinary's existing manual-cleanup behavior are unchanged.

`upload-page.js` owns the upload UI and session handling; `upload-page.css` is scoped to that page. `cloudinary-service.js` and `upload-service.js` remain the publishing boundary. Browser object URLs are released when previews are replaced. A navigation warning protects unsaved selections, but files and draft text are **not persisted across a reload**. Cloudinary chunking does not implement resume after closing/reloading the page. Both storage paths support **PUBLIC** publishing only.

## Current implementation notes

- The feed is intentionally seeded with demo metadata and Unsplash thumbnails so the page is useful before a database is connected.
- Search, categories, saves, likes, subscriptions, and watch history work immediately with browser `localStorage`.
- When Supabase keys are present, the app loads public rows from `videos`, resolves channel names from `profiles`, and syncs signed-in saves, likes, subscriptions, and watch history to the matching tables. Without keys or rows, it safely keeps the demo feed.
- The “Create” button opens `upload.html`, where users select, preview, review, and publish. With Cloudinary configured, it uploads files through Cloudinary and saves the returned delivery URLs in the `videos` row. With Cloudinary blank, the older Supabase Storage path remains a fallback for MP4/WebM files.
- Cloudinary is the optional large-media provider: fill `cloudinary-config.js` to publish media to Cloudinary while keeping Supabase for auth and database rows. Large files use chunked uploads, and Cloudinary delivery transformations reduce the bytes sent to viewers.
- This setup covers the database and Storage contract for signed-in uploads. The UI now includes a full watch view, channel view, local comments, and the main library pages; additional backend tables can be added as those UI areas move from local fallback state to Supabase.

## Can Supabase be changed later?

Yes. The UI does not need to be rebuilt if the data layer changes. The replaceable boundary is concentrated in `app.js` and `upload-service.js`: feed loading, authentication, saved/liked/history sync, subscriptions, and uploads call Supabase there. The HTML/CSS user interface and local fallback state can stay in place while those calls are replaced with another backend such as Firebase, Appwrite, a custom API, or a different Postgres service. Keep the same small data contract (`profiles`, `videos`, `watch_history`, `saved_videos`, `video_likes`, and `subscriptions`) during a migration so the interface behavior remains stable.

The current UI pages are functional locally: **Home**, **Shorts**, **History**, **Watch later**, **Liked videos**, **Subscriptions**, **Playlists**, **Account**, **Creator Studio**, and the admin-only **Admin Dashboard** plus per-user `admin-user.html` view. Supabase-backed rows are used when the project is configured; local browser state remains the fallback when it is not. Playlists remain local UI state, while comments use Supabase when `creator.sql` is installed and local fallback otherwise.

The major pages now have separate HTML entry points: `history.html`, `watch-later.html`, `liked.html`, `subscriptions.html`, `playlists.html`, `account.html`, `shorts.html`, `studio.html`, `admin.html`, `admin-user.html`, `banned.html`, `upload.html`, `login.html`, `forgot-password.html`, and `reset-password.html`. The main home/watch experience remains in `index.html` while the shared data and visual conventions are being migrated page by page.

On `shorts.html`, the app now shows a vertical Shorts-style feed with full-video links, like, save, and share actions. Like/save changes persist to the same local library state used by the main feed.

On `account.html`, **Profile photo** accepts JPG, PNG, or WebP up to 2 MiB and stores a local preview in `tubeclone.account`. The main avatar and account drawer use that image after the app is refreshed. Cloudinary/Supabase profile-image storage can replace this local step later.

When `supabase/creator.sql` has been run, the watch page automatically uses the real `comments` and `comment_likes` tables for UUID-backed Supabase videos. If that migration is not present, it safely falls back to browser-local comments and likes.

## Troubleshooting

- **Missing `media_type` column / schema-cache error:** run `supabase/media.sql`, not the full starter schema, on an existing project. Refresh the page afterward. `video-records.js` provides a narrowly scoped compatibility retry for this exact error until the migration is applied.
- **Missing tables or profile errors:** run `schema.sql` first, confirm the `public` tables exist, then reload the app. It is safe to rerun the schema script.
- **Missing bucket or file-type/size errors:** run `storage.sql` after the schema and confirm the `videos` and `thumbnails` buckets have the expected limits and MIME types.
- **RLS upload denied:** sign in with a confirmed account and ensure every object path starts with that user's UUID followed by `/`. The storage policies do not permit another user's first-level folder.
- **Email confirmation or redirect problems:** confirm the email, check **Authentication → Settings**, and verify the localhost Site URL and `http://localhost:4173/**` redirect URL.
- **Password reset does not arrive:** check the Supabase Auth email provider, spam folder, authorized test recipients, rate limits, and the custom SMTP setup. Verify that the exact `/reset-password.html` URL is in the Redirect URLs allowlist.
- **Reset link says invalid or expired:** request a fresh link and use the newest email. Do not open a link after its hash has been removed or after it was already used. The app intentionally refuses to use a cached login as a substitute for a recovery session.

## Checks

```bash
node --check app.js
node --check upload-page.js
node --test tests/*.test.cjs
NODE_PATH=/tmp/agent-tmp/node_modules node --test tests/auth-page.browser.cjs
python3 -m http.server 4173
```

The `node --test` checks use mocks and do not verify live Supabase RLS or Storage policies. The HTTP server command is for a manual browser smoke check: sign in if configured, search for a title, change a category, open a card, save it, open the account dialog, and exercise the upload flow when its service is connected.

### Upload page browser tests

The optional `tests/upload-page.browser.cjs` suite uses Playwright and starts its own local server. It intercepts all backend requests, substitutes test-only config, and does **not** send real files to Cloudinary or Supabase. It covers navigation, drag/drop, validation, previews, in-page sign-in, publishing, failure/retry, duplicate prevention, provider fallback, and mobile layout.

If Playwright is already available, run `node --test tests/upload-page.browser.cjs`. Alternatively, install the test tooling outside the app (Linux example):

```bash
mkdir -p /tmp/tubeclone-browser-checks
npm install --prefix /tmp/tubeclone-browser-checks playwright
/tmp/tubeclone-browser-checks/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/tubeclone-browser-checks/node_modules node --test tests/upload-page.browser.cjs
```

Chromium may also require system libraries on a minimal Linux image. This tooling is for testing only; the app still has no build step or runtime npm dependency. Desktop/mobile visual captures are in `tests/upload-page-desktop.png` and `tests/upload-page-mobile.png`; their account-connection warning is the deliberate offline-preview state, not a live account test.
