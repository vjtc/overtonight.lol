# Enable live Overtonight chat (Supabase)

This project is a static website, so it cannot securely store accounts or broadcast messages by itself. The chat has been prepared to use Supabase Auth + Postgres + Realtime. **It will not become live until you create a Supabase project and add its public project URL/key.**

## 1. Create the backend
1. Create a project at https://supabase.com/ and wait for it to finish provisioning.
2. In Project Settings → API (or Connect), copy the Project URL and the publishable/anon key. Never use a `service_role` or secret key in website files.
3. Open `supabase-config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with those two values.
4. In Supabase → SQL Editor, run the complete contents of `supabase-setup.sql`.
5. In Supabase → Authentication → URL Configuration, add your deployed site URL to Site URL and Redirect URLs (for example `https://overtonight.lol/**`).
6. In Database → Replication / Publications, ensure `public.chat_messages` is enabled for Realtime. Supabase dashboard labels can vary.
7. Deploy the full folder to your static host. Test using two separate browser sessions/accounts.

## Included
- Email/password account registration and login through Supabase Auth (passwords are managed by Supabase, not stored in this site's own table).
- Unique username profiles.
- Live text messages across signed-in visitors and text channels.
- Database access policies so only signed-in users can read/send and users can update/delete their own messages.
- Inline edited indicator and message deletion sync for persisted messages.

## Important limits
This is a starter live chat, not a complete Discord replacement. Voice channels, DMs, server creation/invites, file uploads, moderation/admin tools, password reset UX, account verification UX, durable reaction syncing, and robust reply metadata still need implementation. Configure Supabase email verification and rate limits before opening it publicly. Do not place private service keys in frontend code. The website must be served over HTTPS (or localhost for development); opening `chat.html` directly as a `file://` URL is not supported for auth/realtime.
