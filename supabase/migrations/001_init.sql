-- ShahabGram custom-auth schema. Run in Supabase SQL editor or via Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  display_name text not null,
  bio text,
  avatar_url text,
  language text not null default 'fa' check (language in ('fa', 'en')),
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_username_ci_idx on public.users (lower(username));

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions(user_id);
create index if not exists sessions_expiry_idx on public.sessions(expires_at);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group', 'channel')),
  title text not null,
  description text,
  slug text,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  owner_id uuid not null references public.users(id) on delete restrict,
  direct_key text,
  avatar_url text,
  last_message_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists conversations_slug_ci_idx on public.conversations(lower(slug)) where slug is not null;
create unique index if not exists conversations_direct_key_idx on public.conversations(direct_key) where direct_key is not null;
create index if not exists conversations_owner_idx on public.conversations(owner_id);
create index if not exists conversations_last_message_idx on public.conversations(last_message_at desc nulls last);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_message_id uuid,
  left_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id) where left_at is null;
create index if not exists conversation_members_conversation_idx on public.conversation_members(conversation_id) where left_at is null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  client_id text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create unique index if not exists messages_sender_client_idx on public.messages(sender_id, client_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create or replace function public.touch_conversation_on_message() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.conversations set last_message_at = new.created_at, updated_at = now() where id = new.conversation_id; return new; end; $$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages for each row execute function public.touch_conversation_on_message();

create or replace function public.is_conversation_member(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_members where conversation_id = p_id and user_id = auth.uid() and left_at is null)
$$;
create or replace function public.is_conversation_admin(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_members where conversation_id = p_id and user_id = auth.uid() and role in ('owner','admin') and left_at is null)
$$;
create or replace function public.is_conversation_owner(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversations where id = p_id and owner_id = auth.uid() and deleted_at is null)
$$;
revoke all on function public.is_conversation_member(uuid) from public;
revoke all on function public.is_conversation_admin(uuid) from public;
revoke all on function public.is_conversation_owner(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated, service_role;
grant execute on function public.is_conversation_admin(uuid) to authenticated, service_role;
grant execute on function public.is_conversation_owner(uuid) to authenticated, service_role;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists users_select_authenticated on public.users;
create policy users_select_authenticated on public.users for select to authenticated using (id = auth.uid());
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select to authenticated using (public.is_conversation_member(id) or owner_id = auth.uid() or (visibility = 'public' and deleted_at is null));
drop policy if exists conversations_insert_owner on public.conversations;
create policy conversations_insert_owner on public.conversations for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists conversations_update_admin on public.conversations;
create policy conversations_update_admin on public.conversations for update to authenticated using (public.is_conversation_admin(id)) with check (public.is_conversation_admin(id));
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id) or user_id = auth.uid());
drop policy if exists conversation_members_insert on public.conversation_members;
create policy conversation_members_insert on public.conversation_members for insert to authenticated with check (
  public.is_conversation_admin(conversation_id)
  or public.is_conversation_owner(conversation_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.visibility = 'public' and c.deleted_at is null
    )
  )
);
drop policy if exists conversation_members_update on public.conversation_members;
create policy conversation_members_update on public.conversation_members for update to authenticated
  using (public.is_conversation_admin(conversation_id))
  with check (public.is_conversation_admin(conversation_id));
drop policy if exists conversation_members_delete on public.conversation_members;
create policy conversation_members_delete on public.conversation_members for delete to authenticated
  using (public.is_conversation_admin(conversation_id) or user_id = auth.uid());
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender on public.messages for update to authenticated using (sender_id = auth.uid() and public.is_conversation_member(conversation_id)) with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
drop policy if exists messages_delete_sender on public.messages;
create policy messages_delete_sender on public.messages for delete to authenticated using (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

alter table public.messages replica identity full;
alter table public.conversation_members replica identity full;
alter table public.conversations replica identity full;
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']::text[])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists avatars_authenticated_insert on storage.objects;
create policy avatars_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_authenticated_update on storage.objects;
create policy avatars_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_authenticated_delete on storage.objects;
create policy avatars_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
