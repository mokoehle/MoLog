import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, ExerciseEntry, ExerciseGroup, Location, Workout, WorkoutSet, WorkoutType } from './schema'

export const db = new Dexie('molog') as Dexie & {
  locations: EntityTable<Location, 'id'>
  workoutTypes: EntityTable<WorkoutType, 'id'>
  exerciseGroups: EntityTable<ExerciseGroup, 'id'>
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
