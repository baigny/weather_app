# Supabase setup

## First-time migration (run once)

You have one migration: `migrations/001_initial.sql`. It creates `masjids`, `profiles` (admin/guest), RLS, and the signup trigger.

### Option A – From code (Supabase CLI)

1. Install Supabase CLI: `npm install -g supabase` (or use npx).
2. Link the project (one time):
   ```bash
   npx supabase link --project-ref lnsedgunmvgbdwthsjdx
   ```
   Use your project ref from the dashboard URL.
3. Run migrations:
   ```bash
   npm run db:migrate
   ```
   (Runs `supabase db push` and applies `001_initial.sql`.)

### Option B – From Supabase Dashboard

1. Open your project → **SQL Editor** → **New query**.
2. Copy the full contents of `migrations/001_initial.sql` and paste into the editor.
3. Click **Run**.

---

## After migration

1. **Auth**: In Dashboard → Authentication → Providers, enable Email (or others).
2. **Admins**: New signups get `role = guest`. To make someone admin:
   - In **Table Editor** → `public.profiles`, set `role` to `admin` for their row, or
   - In **SQL Editor** run:
     ```sql
     update public.profiles set role = 'admin' where id = 'USER_UUID_FROM_AUTH_USERS';
     ```
3. **Storage**: Create bucket `masjid-images` (Public). Add policies so the public can read, and only admins can upload/delete.
4. **Env**: Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (Project Settings → API).
