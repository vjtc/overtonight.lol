-- Run this in Supabase Dashboard > SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  created_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'general',
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  content text not null check (char_length(content) between 1 and 1500),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists chat_messages_channel_created_idx on public.chat_messages(channel, created_at);
alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "Profiles readable by signed in users" on public.profiles;
create policy "Profiles readable by signed in users" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Signed in users can read messages" on public.chat_messages;
create policy "Signed in users can read messages" on public.chat_messages for select to authenticated using (true);
drop policy if exists "Users can send as themselves" on public.chat_messages;
create policy "Users can send as themselves" on public.chat_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can edit own messages" on public.chat_messages;
create policy "Users can edit own messages" on public.chat_messages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own messages" on public.chat_messages;
create policy "Users can delete own messages" on public.chat_messages for delete to authenticated using (auth.uid() = user_id);
-- Enable Realtime for chat_messages in Dashboard > Database > Replication if not already enabled.
