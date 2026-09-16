# LockedIn

Focus tracking for students — solo sessions, multiplayer Rooms, follows, and an opt-in Explore feed.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Auth, Postgres, Storage, Realtime)
- Tailwind CSS 4 + shadcn/ui + framer-motion

## Local setup

1. Copy env:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (production canonical origin, e.g. `https://your-domain.com`)

2. Apply all SQL migrations in `supabase/migrations/` to your Supabase project (SQL editor or CLI), in order (`00001` … latest).

3. Enable Auth providers in the Supabase dashboard:

- Email (with confirmations **on** for production)
- Google OAuth
- GitHub OAuth
- **Anonymous Sign-Ins** (required so guests can join rooms with a nickname without creating an account; only logged-in users can create rooms)

Redirect URL allowlist must include:

```
https://YOUR_DOMAIN/auth/callback
http://localhost:3000/auth/callback
```

4. Paste email templates from `emails/Signup.html` and `emails/ResetPassword.html` into Supabase Auth → Email Templates. Configure SMTP (Resend/SendGrid/etc.) for production.

5. Create public storage buckets if migrations did not (normally they do):

- `avatars`
- `post-cards`

6. Install and run:

```bash
npm install
npm run dev
```

## Deploy (Vercel)

1. Set the same `NEXT_PUBLIC_*` env vars in the Vercel project.
2. Confirm migrations are applied on the production Supabase project.
3. Set `NEXT_PUBLIC_SITE_URL` to the live domain (used for auth redirects, OG, sitemap).

## Product routes

| Route | Purpose |
|-------|---------|
| `/lockin` | Solo focus timer |
| `/rooms` | Create/join focus rooms |
| `/rooms/[code]` | Live room (invite URL auto-joins when signed in) |
| `/dashboard` | Stats + heatmap |
| `/explore` | Search + following feed |
| `/profile` | Edit profile + settings |
| `/u/[username]` | Public profile |
| `/privacy` / `/terms` | Legal |
| `/dev` | Developer Mode (GitHub repo stats) |

## Notes

- Guests can LOCK IN locally; cloud sync requires auth.
- New accounts get a provisional username and must claim a public handle.
- Focus calendars on other profiles are follower-gated.
- Block / report are available on public profiles and posts.
