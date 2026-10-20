import { db, newId } from '../db/db'
import type { Exercise, ExerciseEntry, Id, Measure, WorkoutSet } from '../db/schema'

export const WEIGHT_STEP = 2.5

export interface SetValues {
  weightKg: number
  reps: number
  durationSec: number
}

const DEFAULT_VALUES: SetValues = { weightKg: 20, reps: 10, durationSec: 30 }

// ---------- Stammdaten ----------

export async function createLocation(name: string) {
  const loc = { id: newId(), name: name.trim(), createdAt: Date.now() }
  await db.locations.add(loc)
  return loc
}

export async function createWorkoutType(name: string) {
  const type = { id: newId(), name: name.trim(), createdAt: Date.now() }
  await db.workoutTypes.add(type)
  return type
}

export async function createExercise(input: {
  name: string
  usesWeight: boolean
  measure: Measure
  parentId?: Id
}): Promise<Exercise> {
  const ex: Exercise = {
    id: newId(),
    name: input.name.trim(),
    usesWeight: input.usesWeight,
    measure: input.measure,
    createdAt: Date.now(),
    ...(input.parentId ? { parentId: input.parentId } : {}),
  }
  await db.exercises.add(ex)
  return ex
}

// ---------- Ablauf eines Trainings ----------

export async function startWorkout(locationId: Id, workoutTypeId: Id) {
  const workout = { id: newId(), locationId, workoutTypeId, startedAt: Date.now() }
  await db.workouts.add(workout)
  return workout
}

export async function startExercise(workoutId: Id, exerciseId: Id) {
  const position = await db.entries.where('workoutId').equals(workoutId).count()
  const entry: ExerciseEntry = { id: newId(), workoutId, exerciseId, position, startedAt: Date.now() }
  await db.entries.add(entry)
  return entry
}

export async function logSet(entry: ExerciseEntry, exercise: Exercise, values: SetValues) {
  const position = await db.sets.where('entryId').equals(entry.id).count()
  const set: WorkoutSet = {
    id: newId(),
    entryId: entry.id,
    workoutId: entry.workoutId,
    exerciseId: entry.exerciseId,
    position,
    weightKg: exercise.usesWeight ? values.weightKg : null,
    reps: exercise.measure === 'reps' ? values.reps : null,
    durationSec: exercise.measure === 'seconds' ? values.durationSec : null,
    loggedAt: Date.now(),
  }
  await db.sets.add(set)
  return set
}

export async function undoLastSet(entryId: Id) {
  const sets = await db.sets.where('entryId').equals(entryId).sortBy('position')
  const last = sets.at(-1)
  if (last) await db.sets.delete(last.id)
}

/** Schließt die Übung ab. Übungen ohne Satz werden verworfen, damit keine leeren Einträge entstehen. */
export async function finishExercise(entryId: Id) {
  await db.transaction('rw', db.entries, db.sets, async () => {
    const count = await db.sets.where('entryId').equals(entryId).count()
    if (count === 0) await db.entries.delete(entryId)
    else await db.entries.update(entryId, { endedAt: Date.now() })
  })
}

/** Beendet das Training. Ein Training ohne Satz wird komplett verworfen. Gibt zurück, ob es gespeichert wurde. */
export async function finishWorkout(workoutId: Id): Promise<boolean> {
  const open = await db.entries.where('workoutId').equals(workoutId).filter((e) => !e.endedAt).toArray()
  for (const e of open) await finishExercise(e.id)
  const setCount = await db.sets.where('workoutId').equals(workoutId).count()
  if (setCount === 0) {
    await db.transaction('rw', db.workouts, db.entries, async () => {
      await db.entries.where('workoutId').equals(workoutId).delete()
      await db.workouts.delete(workoutId)
    })
    return false
  }
  await db.workouts.update(workoutId, { endedAt: Date.now() })
  return true
}

// ---------- Vorschläge ----------

/** Startwerte für eine Übung: der erste Satz vom letzten Mal, sonst Standardwerte. */
export async function getStartValues(exerciseId: Id, currentWorkoutId: Id): Promise<SetValues> {
  const entries = (await db.entries.where('exerciseId').equals(exerciseId).sortBy('startedAt')).reverse()
  for (const entry of entries) {
    if (entry.workoutId === currentWorkoutId) continue
    const sets = await db.sets.where('entryId').equals(entry.id).sortBy('position')
    const first = sets[0]
    if (first) {
      return {
        weightKg: first.weightKg ?? DEFAULT_VALUES.weightKg,
        reps: first.reps ?? DEFAULT_VALUES.reps,
        durationSec: first.durationSec ?? DEFAULT_VALUES.durationSec,
      }
    }
  }
  return DEFAULT_VALUES
}

/**
 * Übungen, die beim letzten Training derselben Art gemacht wurden (in der damaligen Reihenfolge),
 * ohne die im aktuellen Training bereits erledigten.
 */
export async function suggestedExerciseIds(workoutTypeId: Id, currentWorkoutId: Id): Promise<Id[]> {
  const done = new Set(
    (await db.entries.where('workoutId').equals(currentWorkoutId).toArray()).map((e) => e.exerciseId),
  )
  const previous = (await db.workouts.where('workoutTypeId').equals(workoutTypeId).sortBy('startedAt'))
    .reverse()
    .filter((w) => w.id !== currentWorkoutId && w.endedAt)
    .at(0)
  if (!previous) return []
  const entries = await db.entries.where('workoutId').equals(previous.id).sortBy('position')
  return entries.map((e) => e.exerciseId).filter((id) => !done.has(id))
}

/** Rangfolge nach letzter Nutzung (kleiner = zuletzt genutzt), für die Sortierung von Vorschlägen. */
export function recencyRank(lastUsed: Map<Id, number>) {
  return (item: { id: Id }) => -(lastUsed.get(item.id) ?? 0)
}

/** Löscht ein Training samt Übungen und Sätzen. */
export async function deleteWorkout(workoutId: Id) {
  await db.transaction('rw', db.workouts, db.entries, db.sets, async () => {
    await db.sets.where('workoutId').equals(workoutId).delete()
    await db.entries.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}
