/**
 * Lädt alle Daten des angemeldeten Benutzers aus Supabase. Die Zugriffsregeln (RLS) sorgen dafür,
 * dass jeder nur seine eigenen Zeilen bekommt – der Server braucht deshalb keinen geheimen Schlüssel.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TABLES, toLocal } from '../../../src/sync/mapping.ts'
import type { Dataset, DatasetSource } from '../core/model.ts'

const PAGE = 1000 // Supabase liefert höchstens 1000 Zeilen pro Abfrage
/** Mehrere Tool-Aufrufe direkt hintereinander nutzen denselben Stand */
const CACHE_MS = 60_000

type Table = keyof typeof TABLES

async function fetchAll(client: SupabaseClient, table: Table) {
  const { remote, fields } = TABLES[table]
  const columns = fields.map(([, r]) => r).join(',')
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client
      .from(remote)
      .select(columns)
      .is('deleted_at', null)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`${remote}: ${error.message}`)
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < PAGE) return rows.map((r) => toLocal(table, r))
  }
}

export async function loadDataset(client: SupabaseClient): Promise<Dataset> {
  const [locations, workoutTypes, exerciseGroups, exercises, workouts, entries, sets] = await Promise.all(
    (['locations', 'workoutTypes', 'exerciseGroups', 'exercises', 'workouts', 'entries', 'sets'] as const).map((t) =>
      fetchAll(client, t),
    ),
  )
  return { locations, workoutTypes, exerciseGroups, exercises, workouts, entries, sets } as unknown as Dataset
}

/** Datenquelle mit kurzem Cache. `ensureUser` prüft vorher die Anmeldung. */
export function supabaseSource(client: SupabaseClient, ensureUser: () => Promise<void>): DatasetSource {
  let cached: { at: number; data: Promise<Dataset> } | undefined
  return async () => {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
    await ensureUser()
    const data = loadDataset(client)
    cached = { at: Date.now(), data }
    data.catch(() => (cached = undefined))
    return data
  }
}
