-- Pausen-Timer: Push-Benachrichtigung, wenn die Pause vorbei ist.
--
-- Einmalig im Supabase-Dashboard ausführen: SQL Editor → New query → Inhalt einfügen → Run.
-- Vorher die Edge Function "rest-push" anlegen (supabase/functions/rest-push/index.ts).
--
-- Ablauf: Die App ruft nach einem Satz start_rest_timer(120, …) auf. Alle 5 Sekunden prüft ein
-- Cron-Job, ob ein Timer fällig ist, und ruft dann die Edge Function auf. Die schickt die Push-Nachricht.
-- Die App greift nie direkt auf die Tabellen zu, nur über die Funktionen unten (immer für den eigenen Nutzer).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Geräte, die Push-Nachrichten empfangen (ein Eintrag pro Gerät/Browser)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Höchstens ein laufender Pausen-Timer pro Nutzer
create table if not exists public.rest_timers (
  user_id uuid primary key references auth.users on delete cascade,
  fire_at timestamptz not null,
  title   text not null,
  body    text not null
);
create index if not exists rest_timers_fire_at on public.rest_timers (fire_at);

-- Kein direkter Zugriff aus der App; RLS ohne Policies = alles gesperrt
alter table public.push_subscriptions enable row level security;
alter table public.rest_timers enable row level security;
revoke all on public.push_subscriptions, public.rest_timers from anon, authenticated;

-- ---------- Funktionen für die App (nur angemeldet, nur eigene Daten) ----------

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.start_rest_timer(p_seconds int, p_title text, p_body text)
returns void language sql security definer set search_path = '' as $$
  insert into public.rest_timers (user_id, fire_at, title, body)
  values (auth.uid(), now() + make_interval(secs => least(greatest(p_seconds, 5), 3600)), left(p_title, 100), left(p_body, 200))
  on conflict (user_id) do update
    set fire_at = excluded.fire_at, title = excluded.title, body = excluded.body;
$$;

create or replace function public.cancel_rest_timer()
returns void language sql security definer set search_path = '' as $$
  delete from public.rest_timers where user_id = auth.uid();
$$;

revoke execute on function
  public.save_push_subscription(text, text, text),
  public.remove_push_subscription(text),
  public.start_rest_timer(int, text, text),
  public.cancel_rest_timer()
from public, anon;
grant execute on function
  public.save_push_subscription(text, text, text),
  public.remove_push_subscription(text),
  public.start_rest_timer(int, text, text),
  public.cancel_rest_timer()
to authenticated;

-- ---------- Alle 5 Sekunden: fällige Timer an die Edge Function geben ----------
-- (ruft die Function nur auf, wenn wirklich ein Timer fällig ist)

select cron.schedule(
  'rest-timer-push',
  '5 seconds',
  $$
  select net.http_post(
    url := 'https://efaflnwpraspvwgyanxt.supabase.co/functions/v1/rest-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  where exists (select 1 from public.rest_timers where fire_at <= now());
  $$
);
