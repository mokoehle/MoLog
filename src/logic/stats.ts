import { db } from '../db/db'
import { dependsOnLocation } from './equipment'
import type { Exercise, ExerciseEntry, ExerciseGroup, Id, Location, Workout, WorkoutSet, WorkoutType } from '../db/schema'

/**
 * Auswertungen. Alle Daten werden einmal komplett geladen und im Speicher indiziert –
 * bei einem persönlichen Trainingslog sind das selbst nach Jahren nur einige tausend Zeilen.
 */

export interface Session {
  entry: ExerciseEntry
  workout: Workout
  sets: WorkoutSet[]
}

export interface AllData {
  workouts: Workout[] // neueste zuerst, nur abgeschlossene
  exercises: Map<Id, Exercise>
  locations: Map<Id, Location>
  types: Map<Id, WorkoutType>
  entriesByWorkout: Map<Id, ExerciseEntry[]> // nach Reihenfolge
  setsByEntry: Map<Id, WorkoutSet[]> // nach Reihenfolge
  /** Alle Einheiten einer Übung, älteste zuerst. */
  sessionsByExercise: Map<Id, Session[]>
  groups: Map<Id, ExerciseGroup>
  /** Übungen je Gruppe, alphabetisch */
  exercisesByGroup: Map<Id, Exercise[]>
}

const groupBy = <T, K>(rows: T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}

export async function loadAll(): Promise<AllData> {
  const [workouts, exercises, groups, locations, types, entries, sets] = await Promise.all([
    db.workouts.toArray(),
    db.exercises.toArray(),
    db.exerciseGroups.toArray(),
    db.locations.toArray(),
    db.workoutTypes.toArray(),
    db.entries.toArray(),
    db.sets.toArray(),
  ])
  const finished = workouts.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)
  const workoutById = new Map(finished.map((w) => [w.id, w]))

  const entriesByWorkout = groupBy(entries, (e) => e.workoutId)
  for (const list of entriesByWorkout.values()) list.sort((a, b) => a.position - b.position)
  const setsByEntry = groupBy(sets, (s) => s.entryId)
  for (const list of setsByEntry.values()) list.sort((a, b) => a.position - b.position)

  const sessionsByExercise = new Map<Id, Session[]>()
  for (const entry of [...entries].sort((a, b) => a.startedAt - b.startedAt)) {
    const workout = workoutById.get(entry.workoutId)
    const s = setsByEntry.get(entry.id)
    if (!workout || !s?.length) continue
    const list = sessionsByExercise.get(entry.exerciseId) ?? []
    list.push({ entry, workout, sets: s })
    sessionsByExercise.set(entry.exerciseId, list)
  }

  const exercisesByGroup = groupBy(
    exercises.filter((e) => e.groupId),
    (e) => e.groupId!,
  )
  for (const list of exercisesByGroup.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return {
    workouts: finished,
    exercises: new Map(exercises.map((e) => [e.id, e])),
    locations: new Map(locations.map((l) => [l.id, l])),
    types: new Map(types.map((t) => [t.id, t])),
    entriesByWorkout,
    setsByEntry,
    sessionsByExercise,
    groups: new Map(groups.map((g) => [g.id, g])),
    exercisesByGroup,
  }
}

// ---------- Kennzahlen ----------

/** Geschätztes 1-Wiederholungs-Maximum nach Epley. */
export const estimate1RM = (weight: number, reps: number) => (reps === 1 ? weight : weight * (1 + reps / 30))

export interface Metric {
  label: string
  unit: string
  value: (sets: WorkoutSet[]) => number
}

/**
 * Hauptkennzahl einer Übung, die über die Zeit verglichen wird:
 * mit Gewicht → schwerstes Gewicht, Körpergewicht → meiste Wdh in einem Satz, statisch → längste Haltezeit.
 */
export function primaryMetric(ex: Exercise): Metric {
  if (ex.measure === 'seconds')
    return { label: 'Längste Haltezeit', unit: 's', value: (s) => Math.max(...s.map((x) => x.durationSec ?? 0)) }
  if (ex.usesWeight)
    return { label: 'Schwerstes Gewicht', unit: 'kg', value: (s) => Math.max(...s.map((x) => x.weightKg ?? 0)) }
  return { label: 'Meiste Wdh in einem Satz', unit: 'Wdh', value: (s) => Math.max(...s.map((x) => x.reps ?? 0)) }
}

export const volume = (sets: WorkoutSet[]) => sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0)
export const totalReps = (sets: WorkoutSet[]) => sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)

export interface EntryComparison {
  /** Kennzahl dieser Einheit */
  value: number
  /** Kennzahl beim letzten Mal davor, falls vorhanden */
  previous?: number
  /** Neuer Bestwert gegenüber allen früheren Einheiten */
  isRecord: boolean
  isFirst: boolean
}

/** Vergleicht eine Übung in einem Training mit allen früheren Einheiten derselben Übung. */
export function compareEntry(data: AllData, entry: ExerciseEntry): EntryComparison | null {
  const ex = data.exercises.get(entry.exerciseId)
  const sets = data.setsByEntry.get(entry.id)
  if (!ex || !sets?.length) return null
  const metric = primaryMetric(ex)
  const value = metric.value(sets)
  const all = (data.sessionsByExercise.get(ex.id) ?? []).filter((s) => s.entry.startedAt < entry.startedAt)
  if (all.length === 0) return { value, isRecord: false, isFirst: true }
  // Maschinen/Kabel nur mit demselben Gym vergleichen – sonst gibt es keinen sinnvollen Vergleich
  const locationId = data.workouts.find((w) => w.id === entry.workoutId)?.locationId
  const earlier = dependsOnLocation(ex.equipment) ? all.filter((s) => s.workout.locationId === locationId) : all
  if (earlier.length === 0) return { value, isRecord: false, isFirst: false }
  const best = Math.max(...earlier.map((s) => metric.value(s.sets)))
  return { value, previous: metric.value(earlier.at(-1)!.sets), isRecord: value > best, isFirst: false }
}

export function workoutTotals(data: AllData, workoutId: Id) {
  const entries = (data.entriesByWorkout.get(workoutId) ?? []).filter((e) => data.setsByEntry.get(e.id)?.length)
  const sets = entries.flatMap((e) => data.setsByEntry.get(e.id) ?? [])
  return { exercises: entries.length, sets: sets.length, volume: volume(sets), entries }
}

/** Alle Einheiten aller Übungen einer Gruppe, älteste zuerst. */
export function groupSessions(data: AllData, groupId: Id): (Session & { exercise: Exercise })[] {
  return (data.exercisesByGroup.get(groupId) ?? [])
    .flatMap((exercise) => (data.sessionsByExercise.get(exercise.id) ?? []).map((s) => ({ ...s, exercise })))
    .sort((a, b) => a.entry.startedAt - b.entry.startedAt)
}
