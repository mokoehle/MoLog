import { db, newId } from '../db/db'
import { dependsOnLocation } from './equipment'
import type { Equipment, Exercise, ExerciseEntry, Id, Measure, WorkoutSet } from '../db/schema'

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

export async function createGroup(name: string) {
  const group = { id: newId(), name: name.trim(), createdAt: Date.now() }
  await db.exerciseGroups.add(group)
  return group
}

/** Alles an einer Übung, was man beim Anlegen/Bearbeiten einstellt. */
export interface ExerciseInput {
  name: string
  groupId?: Id
  equipment: Equipment
  usesWeight: boolean
  weightStep: number
  measure: Measure
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const ex: Exercise = { id: newId(), ...input, name: input.name.trim(), createdAt: Date.now() }
  if (!ex.groupId) delete ex.groupId
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

/**
 * Schließt die Übung ab. Übungen ohne Satz werden verworfen, damit keine leeren Einträge entstehen.
 * `atLastSet`: Ende = Zeitpunkt des letzten Satzes statt jetzt (für vergessene/abgebrochene Trainings).
 */
export async function finishExercise(entryId: Id, atLastSet = false) {
  await db.transaction('rw', db.entries, db.sets, async () => {
    const sets = await db.sets.where('entryId').equals(entryId).sortBy('loggedAt')
    if (sets.length === 0) await db.entries.delete(entryId)
    else await db.entries.update(entryId, { endedAt: atLastSet ? sets.at(-1)!.loggedAt : Date.now() })
  })
}

/** Zeitpunkt der letzten Aktivität im Training (letzter Satz, sonst Start der letzten Übung bzw. des Trainings). */
export async function lastActivity(workoutId: Id): Promise<number> {
  const [workout, entries, sets] = await Promise.all([
    db.workouts.get(workoutId),
    db.entries.where('workoutId').equals(workoutId).toArray(),
    db.sets.where('workoutId').equals(workoutId).toArray(),
  ])
  return Math.max(workout?.startedAt ?? 0, ...entries.map((e) => e.startedAt), ...sets.map((s) => s.loggedAt))
}

/**
 * Beendet das Training. Ein Training ohne Satz wird komplett verworfen. Gibt zurück, ob es gespeichert wurde.
 * `atLastActivity`: Ende = letzte Aktivität statt jetzt – sonst hätte ein vergessenes Training 14 h Dauer.
 */
export async function finishWorkout(workoutId: Id, atLastActivity = false): Promise<boolean> {
  const open = await db.entries.where('workoutId').equals(workoutId).filter((e) => !e.endedAt).toArray()
  for (const e of open) await finishExercise(e.id, atLastActivity)
  const setCount = await db.sets.where('workoutId').equals(workoutId).count()
  if (setCount === 0) {
    await db.transaction('rw', db.workouts, db.entries, async () => {
      await db.entries.where('workoutId').equals(workoutId).delete()
      await db.workouts.delete(workoutId)
    })
    return false
  }
  await db.workouts.update(workoutId, { endedAt: atLastActivity ? await lastActivity(workoutId) : Date.now() })
  return true
}

// ---------- Vorschläge ----------

/** Startwerte für eine Übung: der erste Satz vom letzten Mal, sonst Standardwerte. */
export async function getStartValues(exerciseId: Id, currentWorkoutId: Id): Promise<SetValues> {
  const first = (await previousSessions(exerciseId, currentWorkoutId, 1)).sessions[0]?.sets[0]
  if (!first) return DEFAULT_VALUES
  return {
    weightKg: first.weightKg ?? DEFAULT_VALUES.weightKg,
    reps: first.reps ?? DEFAULT_VALUES.reps,
    durationSec: first.durationSec ?? DEFAULT_VALUES.durationSec,
  }
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

/** Ändert Name/Einstellungen einer Übung. Bereits gespeicherte Sätze bleiben unverändert. */
export async function updateExercise(id: Id, input: ExerciseInput) {
  // groupId: undefined entfernt die Gruppe
  await db.exercises.update(id, { ...input, name: input.name.trim() })
}

/**
 * Tauscht die Übung eines laufenden Eintrags aus (z. B. falsch ausgewählt).
 * Schon gespeicherte Sätze wandern mit und werden an Gewicht/Wdh/Sekunden der neuen Übung angepasst.
 */
export async function changeEntryExercise(entryId: Id, exercise: Exercise) {
  await db.transaction('rw', db.entries, db.sets, async () => {
    await db.entries.update(entryId, { exerciseId: exercise.id })
    const sets = await db.sets.where('entryId').equals(entryId).toArray()
    for (const s of sets) {
      const amount = s.reps ?? s.durationSec
      await db.sets.update(s.id, {
        exerciseId: exercise.id,
        weightKg: exercise.usesWeight ? (s.weightKg ?? 0) : null,
        reps: exercise.measure === 'reps' ? amount : null,
        durationSec: exercise.measure === 'seconds' ? amount : null,
      })
    }
  })
}

/** Öffnet die zuletzt abgeschlossene Übung des Trainings wieder (z. B. zu früh auf "Nächste Übung" getippt). */
export async function reopenLastEntry(workoutId: Id) {
  const last = (await db.entries.where('workoutId').equals(workoutId).sortBy('position')).at(-1)
  if (last) await db.entries.update(last.id, { endedAt: undefined })
}

/**
 * Frühere Einheiten einer Übung vor dem aktuellen Training, neueste zuerst.
 * Bei Maschinen/Kabel zählen nur Einheiten im selben Gym (andere Maschine = andere Gewichte).
 * Gibt es dort noch keine, dienen andere Gyms als Schätzung – dann ist `otherLocation` gesetzt.
 */
export async function previousSessions(exerciseId: Id, currentWorkoutId: Id, limit: number) {
  const [exercise, current] = await Promise.all([db.exercises.get(exerciseId), db.workouts.get(currentWorkoutId)])
  const entries = (await db.entries.where('exerciseId').equals(exerciseId).sortBy('startedAt'))
    .reverse()
    .filter((e) => e.workoutId !== currentWorkoutId)

  const all: { entry: ExerciseEntry; sets: WorkoutSet[]; locationId?: Id }[] = []
  for (const entry of entries) {
    const sets = await db.sets.where('entryId').equals(entry.id).sortBy('position')
    if (sets.length) all.push({ entry, sets, locationId: (await db.workouts.get(entry.workoutId))?.locationId })
  }

  if (exercise && current && dependsOnLocation(exercise.equipment)) {
    const sameGym = all.filter((s) => s.locationId === current.locationId)
    if (sameGym.length) return { sessions: sameGym.slice(0, limit), otherLocation: false }
    return { sessions: all.slice(0, limit), otherLocation: all.length > 0 }
  }
  return { sessions: all.slice(0, limit), otherLocation: false }
}

/** Korrigiert einen gespeicherten Satz (z. B. vertippt). */
export async function updateSet(setId: Id, values: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSec'>) {
  await db.sets.update(setId, values)
}

/** Löscht einen Satz und nummeriert die übrigen Sätze der Übung neu durch. */
export async function deleteSet(setId: Id) {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(setId)
    if (!set) return
    await db.sets.delete(setId)
    const rest = await db.sets.where('entryId').equals(set.entryId).sortBy('position')
    for (const [i, s] of rest.entries()) if (s.position !== i) await db.sets.update(s.id, { position: i })
  })
}
