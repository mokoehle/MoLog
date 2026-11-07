import type { SyncedTable } from '../db/db'

/**
 * Übersetzung zwischen lokalen Zeilen (camelCase, Zeitstempel in ms) und den Supabase-Tabellen
 * (snake_case, timestamptz). Die Spalten entsprechen supabase/schema.sql.
 */

/** time: ms ↔ timestamptz · number: Postgres-numeric (kann als Text ankommen) */
type Kind = 'plain' | 'time' | 'number'
type Field = [local: string, remote: string, kind: Kind]

const common: Field[] = [
  ['id', 'id', 'plain'],
  ['updatedAt', 'updated_at', 'time'],
]

export const TABLES: Record<SyncedTable, { remote: string; fields: Field[] }> = {
  locations: {
    remote: 'locations',
    fields: [...common, ['name', 'name', 'plain'], ['createdAt', 'created_at', 'time']],
  },
  workoutTypes: {
    remote: 'workout_types',
    fields: [...common, ['name', 'name', 'plain'], ['createdAt', 'created_at', 'time']],
  },
  exerciseGroups: {
    remote: 'exercise_groups',
    fields: [...common, ['name', 'name', 'plain'], ['createdAt', 'created_at', 'time']],
  },
  exercises: {
    remote: 'exercises',
    fields: [
      ...common,
      ['name', 'name', 'plain'],
      ['groupId', 'group_id', 'plain'],
      ['equipment', 'equipment', 'plain'],
      ['usesWeight', 'uses_weight', 'plain'],
      ['weightStep', 'weight_step', 'number'],
      ['measure', 'measure', 'plain'],
      ['createdAt', 'created_at', 'time'],
    ],
  },
  workouts: {
    remote: 'workouts',
    fields: [
      ...common,
      ['locationId', 'location_id', 'plain'],
      ['workoutTypeId', 'workout_type_id', 'plain'],
      ['startedAt', 'started_at', 'time'],
      ['endedAt', 'ended_at', 'time'],
    ],
  },
  entries: {
    remote: 'entries',
    fields: [
      ...common,
      ['workoutId', 'workout_id', 'plain'],
      ['exerciseId', 'exercise_id', 'plain'],
      ['position', 'position', 'plain'],
      ['startedAt', 'started_at', 'time'],
      ['endedAt', 'ended_at', 'time'],
    ],
  },
  sets: {
    remote: 'sets',
    fields: [
      ...common,
      ['entryId', 'entry_id', 'plain'],
      ['workoutId', 'workout_id', 'plain'],
      ['exerciseId', 'exercise_id', 'plain'],
      ['position', 'position', 'plain'],
      ['weightKg', 'weight_kg', 'number'],
      ['reps', 'reps', 'plain'],
      ['durationSec', 'duration_sec', 'plain'],
      ['loggedAt', 'logged_at', 'time'],
    ],
  },
}

type Row = Record<string, unknown>

/** Lokal optionale Felder (fehlen statt null). Alle anderen null-Werte haben Bedeutung, z. B. weightKg = null. */
const OPTIONAL = new Set(['groupId', 'endedAt'])

export function toRemote(table: SyncedTable, row: Row): Row {
  const out: Row = { deleted_at: null }
  for (const [local, remote, kind] of TABLES[table].fields) {
    const v = row[local]
    out[remote] = v === undefined || v === null ? null : kind === 'time' ? new Date(v as number).toISOString() : v
  }
  return out
}

export function toLocal(table: SyncedTable, row: Row): Row {
  const out: Row = {}
  for (const [local, remote, kind] of TABLES[table].fields) {
    const v = row[remote]
    if (v === null || v === undefined) {
      if (!OPTIONAL.has(local)) out[local] = null
      continue
    }
    out[local] = kind === 'time' ? Date.parse(v as string) : kind === 'number' ? Number(v) : v
  }
  return out
}
