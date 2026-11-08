-- Datenbankschema für Supabase (Gym-Tracker)
--
-- Einmalig im Supabase-Dashboard ausführen: SQL Editor → New query → Inhalt einfügen → Run.
--
-- Die Tabellen spiegeln das lokale Datenmodell der App (src/db/schema.ts).
-- Jede Zeile gehört genau einem Benutzer; Row Level Security sorgt dafür, dass jeder nur seine
-- eigenen Daten lesen und schreiben kann – unabhängig davon, was die App tut.
--
-- Sync-Spalten in jeder Tabelle:
--   updated_at  Zeitpunkt der letzten Änderung laut App (entscheidet bei Konflikten)
--   synced_at   wann die Zeile beim Server ankam – damit holt sich jedes Gerät nur Neues
--   deleted_at  gelöscht (bleibt als Markierung stehen, damit andere Geräte das Löschen mitbekommen)

-- ---------- Hilfsfunktion: synced_at bei jedem Schreiben setzen ----------

create or replace function public.set_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

-- ---------- Stammdaten ----------

create table public.locations (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  synced_at   timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz
);

create table public.workout_types (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  synced_at   timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz
);

create table public.exercise_groups (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  synced_at   timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz
);

create table public.exercises (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  group_id     uuid,
  equipment    text not null check (equipment in ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'other')),
  uses_weight  boolean not null,
  weight_step  numeric not null,
  measure      text not null check (measure in ('reps', 'seconds')),
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  synced_at    timestamptz not null default clock_timestamp(),
  deleted_at   timestamptz
);

-- ---------- Trainings ----------

create table public.workouts (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  location_id      uuid not null,
  workout_type_id  uuid not null,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  updated_at       timestamptz not null,
  synced_at        timestamptz not null default clock_timestamp(),
  deleted_at       timestamptz
);

create table public.entries (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id   uuid not null,
  exercise_id  uuid not null,
  position     integer not null,
  started_at   timestamptz not null,
  ended_at     timestamptz,
  updated_at   timestamptz not null,
  synced_at    timestamptz not null default clock_timestamp(),
  deleted_at   timestamptz
);

create table public.sets (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  entry_id      uuid not null,
  workout_id    uuid not null,
  exercise_id   uuid not null,
  position      integer not null,
  weight_kg     numeric,
  reps          integer,
  duration_sec  integer,
  logged_at     timestamptz not null,
  updated_at    timestamptz not null,
  synced_at     timestamptz not null default clock_timestamp(),
  deleted_at    timestamptz
);

-- Fremdschlüssel bewusst ohne Constraints: Die App lädt Zeilen in beliebiger Reihenfolge hoch
-- (z. B. ein Satz vor seiner Übung), und gelöscht wird über deleted_at statt per Cascade.

-- ---------- Trigger, Indizes, Zugriffsregeln für alle Tabellen ----------

do $$
declare
  t text;
begin
  foreach t in array array['locations', 'workout_types', 'exercise_groups', 'exercises', 'workouts', 'entries', 'sets']
  loop
    execute format('create trigger set_synced_at before insert or update on public.%I
                    for each row execute function public.set_synced_at()', t);

    -- "Was hat sich seit meinem letzten Abgleich geändert?" schnell beantworten
    execute format('create index %I on public.%I (user_id, synced_at)', t || '_user_synced', t);

    -- Zugriff nur für eingeloggte Benutzer (Projekt ist ohne "Automatically expose new tables" angelegt)
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);

    -- Row Level Security: nur eigene Zeilen
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "eigene Zeilen lesen" on public.%I for select to authenticated
                    using (user_id = (select auth.uid()))', t);
    execute format('create policy "eigene Zeilen anlegen" on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()))', t);
    execute format('create policy "eigene Zeilen ändern" on public.%I for update to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Hinweis: Es gibt absichtlich keine DELETE-Regel. Die App löscht nie direkt, sondern setzt deleted_at.
