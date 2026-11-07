import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie'
import type { Exercise, ExerciseEntry, ExerciseGroup, Location, Tombstone, Workout, WorkoutSet, WorkoutType } from './schema'

export const db = new Dexie('molog') as Dexie & {
  locations: EntityTable<Location, 'id'>
  workoutTypes: EntityTable<WorkoutType, 'id'>
  exerciseGroups: EntityTable<ExerciseGroup, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  workouts: EntityTable<Workout, 'id'>
  entries: EntityTable<ExerciseEntry, 'id'>
  sets: EntityTable<WorkoutSet, 'id'>
  tombstones: EntityTable<Tombstone, 'id'>
  /** Sync-Zustand: angemeldeter Benutzer, letzter Upload, Download-Stand je Tabelle */
  syncMeta: EntityTable<{ key: string; value: unknown }, 'key'>
}

// Nur indizierte Felder stehen hier; alle anderen werden trotzdem gespeichert.
db.version(1).stores({
  locations: 'id, name',
  workoutTypes: 'id, name',
  exercises: 'id, name, parentId',
  workouts: 'id, startedAt, workoutTypeId, locationId',
  entries: 'id, workoutId, exerciseId, startedAt',
  sets: 'id, entryId, workoutId, exerciseId, loggedAt',
})

// v2: Übungsgruppen statt "Variante von", dazu Gerät und Schrittweite pro Übung.
// Bisherige Basis-Übungen mit Varianten werden zu einer gleichnamigen Gruppe.
db.version(2)
  .stores({
    exerciseGroups: 'id, name',
    exercises: 'id, name, groupId',
  })
  .upgrade(async (tx) => {
    const exercises = tx.table('exercises')
    const all = await exercises.toArray()
    const parentIds = new Set(all.map((e) => e.parentId).filter(Boolean))
    const groupFor = new Map<string, string>()
    for (const e of all) {
      if (!parentIds.has(e.id)) continue
      const group = { id: crypto.randomUUID(), name: e.name, createdAt: e.createdAt }
      await tx.table('exerciseGroups').add(group)
      groupFor.set(e.id, group.id)
    }
    await exercises.toCollection().modify((e) => {
      const groupId = groupFor.get(e.parentId) ?? groupFor.get(e.id)
      if (groupId) e.groupId = groupId
      delete e.parentId
      e.equipment = e.usesWeight ? 'other' : 'bodyweight'
      e.weightStep = 2.5
    })
  })

/** Transaktionen des Syncs selbst markieren, damit eingespielte Server-Daten nicht als lokale Änderung gelten. */
const REMOTE = Symbol('remote')
export const markRemote = (tx: Transaction) => ((tx as unknown as Record<symbol, boolean>)[REMOTE] = true)
const isRemote = (tx: Transaction) => !!(tx as unknown as Record<symbol, boolean>)[REMOTE]

// v3: Cloud-Sync. Jede Zeile bekommt updatedAt, Löschungen werden als Tombstone festgehalten.
db.version(3)
  .stores({
    tombstones: 'id, deletedAt',
    syncMeta: 'key',
  })
  .upgrade(async (tx) => {
    markRemote(tx) // historisches Datum behalten, nicht "jetzt" eintragen
    const firstTimestamp: Record<string, string> = {
      locations: 'createdAt',
      workoutTypes: 'createdAt',
      exerciseGroups: 'createdAt',
      exercises: 'createdAt',
      workouts: 'startedAt',
      entries: 'startedAt',
      sets: 'loggedAt',
    }
    for (const [table, field] of Object.entries(firstTimestamp)) {
      await tx
        .table(table)
        .toCollection()
        .modify((row) => {
          row.updatedAt = row.endedAt ?? row[field] ?? Date.now()
        })
    }
  })

/** Tabellen, die mit der Cloud synchronisiert werden (Reihenfolge = Upload-Reihenfolge). */
export const SYNCED_TABLES = [
  'locations',
  'workoutTypes',
  'exerciseGroups',
  'exercises',
  'workouts',
  'entries',
  'sets',
] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

// ---------- Änderungen für den Sync erfassen ----------

const changeListeners = new Set<() => void>()
/** Wird nach jeder lokalen Änderung aufgerufen (der Sync plant daraufhin einen Upload). */
export const onLocalChange = (fn: () => void) => changeListeners.add(fn)
const notifyChange = (tx: Transaction) => tx.on('complete', () => changeListeners.forEach((fn) => fn()))

for (const name of SYNCED_TABLES) {
  const table = db.table(name)
  table.hook('creating', (_key, obj, tx) => {
    if (isRemote(tx)) return
    obj.updatedAt = Date.now()
    notifyChange(tx)
  })
  table.hook('updating', (_mods, _key, _obj, tx) => {
    if (isRemote(tx)) return
    notifyChange(tx)
    return { updatedAt: Date.now() }
  })
}

/**
 * Löscht Zeilen und merkt sich das für den Sync (Tombstone), damit das Löschen auch auf dem Server
 * und anderen Geräten ankommt. Alle Löschungen der App laufen hierüber.
 * Läuft in einer umgebenden Transaktion, muss diese `db.tombstones` mit einschließen.
 */
export async function deleteRows(table: Table, ids: string[]) {
  if (ids.length === 0) return
  const deletedAt = Date.now()
  await db.transaction('rw', table, db.tombstones, async (tx) => {
    await table.bulkDelete(ids)
    await db.tombstones.bulkPut(ids.map((id) => ({ id, table: table.name, deletedAt })))
    notifyChange(tx)
  })
}

export const newId = () => crypto.randomUUID()

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // nicht kritisch
  }
}
