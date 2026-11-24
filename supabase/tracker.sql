-- Схема облака трекера (применена миграцией tracker_sync).
-- Таблицы в закрытой схеме tracker_private; наружу доступны только RPC-функции,
-- каждая проверяет код синхронизации (в базе хранится лишь его sha256).
-- После применения задайте секрет для плановой функции Netlify:
--   insert into tracker_private.secrets (name, value) values ('cron', '<тот же, что TRACKER_CRON_SECRET>');

create schema if not exists tracker_private;
revoke all on schema tracker_private from public, anon, authenticated;

create table tracker_private.state (code_hash text primary key, data jsonb not null, rev bigint not null default 1, updated_at timestamptz not null default now());
create table tracker_private.push_subs (endpoint text primary key, code_hash text not null references tracker_private.state(code_hash) on delete cascade, subscription jsonb not null, created_at timestamptz not null default now());
create index on tracker_private.push_subs (code_hash);
create table tracker_private.reminders (code_hash text not null references tracker_private.state(code_hash) on delete cascade, id text not null, at timestamptz not null, title text not null, body text, url text, sent_at timestamptz, primary key (code_hash, id));
create index on tracker_private.reminders (at) where sent_at is null;
create table tracker_private.secrets (name text primary key, value text not null);
alter table tracker_private.state enable row level security;
alter table tracker_private.push_subs enable row level security;
alter table tracker_private.reminders enable row level security;
alter table tracker_private.secrets enable row level security;

create or replace function tracker_private.hash_code(p_code text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if p_code is null or length(p_code) < 20 or length(p_code) > 200 then
    raise exception 'bad sync code' using errcode = '22023';
  end if;
  return encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
end $$;

create or replace function public.tracker_pull(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r tracker_private.state;
begin
  select * into r from tracker_private.state where code_hash = tracker_private.hash_code(p_code);
  if not found then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'rev', r.rev, 'data', r.data, 'updated_at', r.updated_at);
end $$;

create or replace function public.tracker_push(p_code text, p_data jsonb, p_base_rev bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text := tracker_private.hash_code(p_code); r tracker_private.state;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'bad data' using errcode = '22023';
  end if;
  if pg_column_size(p_data) > 5 * 1024 * 1024 then
    raise exception 'data too large' using errcode = '54000';
  end if;
  select * into r from tracker_private.state where code_hash = h for update;
  if not found then
    insert into tracker_private.state (code_hash, data) values (h, p_data) returning * into r;
    return jsonb_build_object('ok', true, 'rev', r.rev, 'updated_at', r.updated_at);
  end if;
  if r.rev <> p_base_rev then
    return jsonb_build_object('ok', false, 'conflict', true, 'rev', r.rev, 'data', r.data, 'updated_at', r.updated_at);
  end if;
  update tracker_private.state set data = p_data, rev = rev + 1, updated_at = now()
   where code_hash = h returning * into r;
  return jsonb_build_object('ok', true, 'rev', r.rev, 'updated_at', r.updated_at);
end $$;

create or replace function public.tracker_set_reminders(p_code text, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare h text := tracker_private.hash_code(p_code); n integer;
begin
  if not exists (select 1 from tracker_private.state where code_hash = h) then
    raise exception 'unknown sync code' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'bad reminders' using errcode = '22023';
  end if;
  delete from tracker_private.reminders where code_hash = h and sent_at is null;
  insert into tracker_private.reminders (code_hash, id, at, title, body, url)
  select h, left(x->>'id', 200), (x->>'at')::timestamptz, left(x->>'title', 200), left(x->>'body', 500), left(x->>'url', 200)
    from jsonb_array_elements(p_items) x
   where (x->>'at')::timestamptz > now() - interval '5 minutes'
  on conflict (code_hash, id) do nothing;
  get diagnostics n = row_count;
  delete from tracker_private.reminders where code_hash = h and at < now() - interval '7 days';
  return n;
end $$;

create or replace function public.tracker_add_push(p_code text, p_sub jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h text := tracker_private.hash_code(p_code);
begin
  if not exists (select 1 from tracker_private.state where code_hash = h) then
    raise exception 'unknown sync code' using errcode = '28000';
  end if;
  if p_sub->>'endpoint' is null or left(p_sub->>'endpoint', 8) <> 'https://' then
    raise exception 'bad subscription' using errcode = '22023';
  end if;
  insert into tracker_private.push_subs (endpoint, code_hash, subscription)
  values (p_sub->>'endpoint', h, p_sub)
  on conflict (endpoint) do update set code_hash = excluded.code_hash, subscription = excluded.subscription;
  return true;
end $$;

create or replace function public.tracker_remove_push(p_code text, p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from tracker_private.push_subs where endpoint = p_endpoint and code_hash = tracker_private.hash_code(p_code);
  return found;
end $$;

create or replace function public.tracker_cron_due(p_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if p_secret is null or p_secret <> (select value from tracker_private.secrets where name = 'cron') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with due as (
    update tracker_private.reminders r set sent_at = now()
     where r.sent_at is null and r.at <= now() + interval '30 seconds'
     returning r.code_hash, r.id, r.at, r.title, r.body, r.url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'title', d.title, 'body', d.body, 'url', d.url,
           'subs', (select coalesce(jsonb_agg(p.subscription), '[]') from tracker_private.push_subs p where p.code_hash = d.code_hash))), '[]')
    into out
    from due d
   where d.at > now() - interval '30 minutes';   -- старые пропущенные не шлём
  return out;
end $$;

create or replace function public.tracker_cron_drop_push(p_secret text, p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select value from tracker_private.secrets where name = 'cron') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from tracker_private.push_subs where endpoint = p_endpoint;
  return found;
end $$;

revoke all on function tracker_private.hash_code(text) from public;
revoke all on function public.tracker_pull(text), public.tracker_push(text, jsonb, bigint),
  public.tracker_set_reminders(text, jsonb), public.tracker_add_push(text, jsonb),
  public.tracker_remove_push(text, text), public.tracker_cron_due(text),
  public.tracker_cron_drop_push(text, text) from public;
grant execute on function public.tracker_pull(text), public.tracker_push(text, jsonb, bigint),
  public.tracker_set_reminders(text, jsonb), public.tracker_add_push(text, jsonb),
  public.tracker_remove_push(text, text), public.tracker_cron_due(text),
  public.tracker_cron_drop_push(text, text) to anon, authenticated;
