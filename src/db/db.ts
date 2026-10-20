import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, ExerciseEntry, Location, Workout, WorkoutSet, WorkoutType } from './schema'

export const db = new Dexie('molog') as Dexie & {
  locations: EntityTable<Location, 'id'>
  workoutTypes: EntityTable<WorkoutType, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  workouts: EntityTable<Workout, 'id'>
  entries: EntityTable<ExerciseEntry, 'id'>
  sets: EntityTable<WorkoutSet, 'id'>
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
