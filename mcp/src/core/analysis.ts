/**
 * Auswertungen für den Coach – reine Funktionen auf einem Dataset, ohne Netz, ohne MCP.
 *
 * Gewichtskonventionen der App: Kurzhantel = Gewicht EINER Hantel, Langhantel = Gesamtgewicht,
 * Maschine/Kabel = angezeigter Wert, Körpergewicht = nur Zusatzgewicht.
 */
import type { Dataset, Exercise, ExerciseEntry, Id, Workout, WorkoutSet } from './model.ts'
import { isLegDayName, regionOf, type Region } from './regions.ts'
import { DAY, isoWeek, localDate, localIso, minutes, weekday } from './time.ts'

// ---------- Index ----------

export interface Index {
  /** abgeschlossene Trainings, älteste zuerst */
  workouts: Workout[]
  workoutById: Map<Id, Workout>
  exercises: Map<Id, Exercise>
  groupName: Map<Id, string>
  locationName: Map<Id, string>
  typeName: Map<Id, string>
  entriesByWorkout: Map<Id, ExerciseEntry[]>
  setsByEntry: Map<Id, WorkoutSet[]>
}

function groupBy<T>(rows: T[], key: (r: T) => Id) {
  const m = new Map<Id, T[]>()
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r])
  return m
}

export function buildIndex(ds: Dataset): Index {
  const workouts = ds.workouts.filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt)
  const entriesByWorkout = groupBy(ds.entries, (e) => e.workoutId)
  for (const l of entriesByWorkout.values()) l.sort((a, b) => a.position - b.position)
  const setsByEntry = groupBy(ds.sets, (s) => s.entryId)
  for (const l of setsByEntry.values()) l.sort((a, b) => a.position - b.position)
  return {
    workouts,
    workoutById: new Map(workouts.map((w) => [w.id, w])),
    exercises: new Map(ds.exercises.map((e) => [e.id, e])),
    groupName: new Map(ds.exerciseGroups.map((g) => [g.id, g.name])),
    locationName: new Map(ds.locations.map((l) => [l.id, l.name])),
    typeName: new Map(ds.workoutTypes.map((t) => [t.id, t.name])),
    entriesByWorkout,
    setsByEntry,
  }
}

// ---------- Kennzahlen ----------

const round = (n: number, step = 0.5) => Math.round(n / step) * step

/**
 * Geschätztes 1RM nach Epley – nur für 1–12 Wdh mit Gewicht aussagekräftig. Nicht bei Körpergewichtsübungen,
 * dort ist nur das Zusatzgewicht erfasst.
 */
export function e1rm(s: WorkoutSet, ex: Exercise): number | null {
  if (ex.equipment === 'bodyweight' || !s.weightKg || !s.reps || s.reps > 12) return null
  return s.reps === 1 ? s.weightKg : round(s.weightKg * (1 + s.reps / 30))
}

/** Kompakte Darstellung eines Satzes */
export function setValue(s: WorkoutSet) {
  return {
    ...(s.weightKg !== null && s.weightKg !== undefined ? { kg: s.weightKg } : {}),
    ...(s.reps !== null && s.reps !== undefined ? { reps: s.reps } : {}),
    ...(s.durationSec !== null && s.durationSec !== undefined ? { sec: s.durationSec } : {}),
  }
}

/** Satz als kurzer Text, z. B. "95kg×6", "12 Wdh", "60s" – spart Platz in Übersichten */
export function setText(s: WorkoutSet): string {
  const kg = s.weightKg !== null && s.weightKg !== undefined ? `${s.weightKg}kg` : ''
  if (s.durationSec !== null && s.durationSec !== undefined) return kg ? `${kg}×${s.durationSec}s` : `${s.durationSec}s`
  return kg ? `${kg}×${s.reps}` : `${s.reps} Wdh`
}

/** Bester Satz: höchstes Gewicht (bei Gleichstand mehr Wdh), sonst meiste Wdh bzw. längste Zeit. */
export function topSet(sets: WorkoutSet[]): WorkoutSet | undefined {
  const score = (s: WorkoutSet) => (s.weightKg ?? 0) * 10_000 + (s.reps ?? 0) * 10 + (s.durationSec ?? 0) / 100
  return [...sets].sort((a, b) => score(b) - score(a))[0]
}

const tonnage = (sets: WorkoutSet[]) =>
  round(
    sets.reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
    1,
  )
const reps = (sets: WorkoutSet[]) => sets.reduce((n, s) => n + (s.reps ?? 0), 0)
const seconds = (sets: WorkoutSet[]) => sets.reduce((n, s) => n + (s.durationSec ?? 0), 0)

export function exerciseInfo(ix: Index, ex: Exercise) {
  const group = ex.groupId ? ix.groupName.get(ex.groupId) : undefined
  return {
    name: ex.name,
    ...(group ? { group } : {}),
    region: regionOf(ex.name, group),
    equipment: ex.equipment,
    measure: ex.measure,
    usesWeight: ex.usesWeight,
  }
}

// ---------- Trainings ----------

export type LegLoad = 'none' | 'light' | 'heavy'

/** Ab so vielen Beinsätzen gilt ein Training als schwerer Beintag */
const HEAVY_LEG_SETS = 6

function workoutBlocks(ix: Index, w: Workout) {
  return (ix.entriesByWorkout.get(w.id) ?? [])
    .map((entry) => ({ entry, exercise: ix.exercises.get(entry.exerciseId), sets: ix.setsByEntry.get(entry.id) ?? [] }))
    .filter(
      (b): b is { entry: ExerciseEntry; exercise: Exercise; sets: WorkoutSet[] } => !!b.exercise && b.sets.length > 0,
    )
}

export function workoutSummary(ix: Index, w: Workout) {
  const blocks = workoutBlocks(ix, w)
  const all = blocks.flatMap((b) => b.sets)
  const type = ix.typeName.get(w.workoutTypeId)
  const legBlocks = blocks.filter((b) => exerciseInfo(ix, b.exercise).region === 'legs')
  const legSets = legBlocks.reduce((n, b) => n + b.sets.length, 0)
  const lastSet = all.reduce((t, s) => Math.max(t, s.loggedAt), 0)
  return {
    id: w.id,
    start: localIso(w.startedAt),
    end: localIso(w.endedAt!),
    weekday: weekday(w.startedAt),
    durationMin: minutes(w.endedAt! - w.startedAt),
    type,
    location: ix.locationName.get(w.locationId),
    totals: { exercises: blocks.length, sets: all.length, reps: reps(all), tonnageKg: tonnage(all) },
    legs: {
      load: (legSets === 0 ? 'none' : legSets >= HEAVY_LEG_SETS ? 'heavy' : 'light') as LegLoad,
      sets: legSets,
      typeSuggestsLegDay: isLegDayName(type),
      ...(legSets
        ? { lastLegSetAt: localIso(Math.max(...legBlocks.flatMap((b) => b.sets.map((s) => s.loggedAt)))) }
        : {}),
    },
    ...(lastSet ? { lastSetAt: localIso(lastSet) } : {}),
    exercises: blocks.map((b) => {
      const top = topSet(b.sets)!
      const best = Math.max(0, ...b.sets.map((s) => e1rm(s, b.exercise) ?? 0))
      return {
        name: b.exercise.name,
        region: exerciseInfo(ix, b.exercise).region,
        sets: b.sets.map(setText),
        top: setText(top),
        ...(best ? { e1rmKg: best } : {}),
      }
    }),
  }
}

/** Alle Sätze mit Uhrzeit und Pause davor – z. B. um sie in eine Garmin-Aktivität zu übertragen. */
export function workoutDetail(ix: Index, w: Workout) {
  const summary = workoutSummary(ix, w)
  let previous: number | undefined
  return {
    ...summary,
    exercises: workoutBlocks(ix, w).map((b) => ({
      ...exerciseInfo(ix, b.exercise),
      start: localIso(b.entry.startedAt),
      ...(b.entry.endedAt ? { end: localIso(b.entry.endedAt) } : {}),
      sets: b.sets.map((s) => {
        const restSec = previous ? Math.round((s.loggedAt - previous) / 1000) : undefined
        previous = s.loggedAt
        const est = e1rm(s, b.exercise)
        return {
          ...setValue(s),
          at: localIso(s.loggedAt),
          ...(restSec ? { restSec } : {}),
          ...(est ? { e1rmKg: est } : {}),
        }
      }),
    })),
  }
}

export function workoutsBetween(ix: Index, from: number, to: number) {
  return ix.workouts.filter((w) => w.startedAt >= from && w.startedAt <= to)
}

/** Training, das am nächsten an einem Zeitpunkt liegt (z. B. Start einer Garmin-Krafttrainings-Aktivität) */
export function workoutNear(ix: Index, at: number, toleranceMin: number) {
  const distance = (w: Workout) =>
    at >= w.startedAt && at <= w.endedAt! ? 0 : Math.min(Math.abs(at - w.startedAt), Math.abs(at - w.endedAt!))
  const best = [...ix.workouts].sort((a, b) => distance(a) - distance(b))[0]
  return best && distance(best) <= toleranceMin * 60_000
    ? { workout: best, offsetMin: minutes(best.startedAt - at) }
    : undefined
}

// ---------- Übungen ----------

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_]/g, ' ').trim()

/** Übungen, deren Name oder Gruppe zur Suche passt (exakter Treffer gewinnt) */
export function findExercises(ix: Index, query: string): Exercise[] {
  const q = normalize(query)
  const all = [...ix.exercises.values()]
  const exact = all.filter((e) => normalize(e.name) === q)
  if (exact.length) return exact
  const byGroup = all.filter((e) => e.groupId && normalize(ix.groupName.get(e.groupId) ?? '') === q)
  if (byGroup.length) return byGroup
  return all.filter(
    (e) => normalize(e.name).includes(q) || normalize(ix.groupName.get(e.groupId ?? '') ?? '').includes(q),
  )
}

export function exerciseProgress(ix: Index, ex: Exercise, from: number, to: number) {
  const sessions = workoutsBetween(ix, from, to).flatMap((w) =>
    (ix.entriesByWorkout.get(w.id) ?? [])
      .filter((e) => e.exerciseId === ex.id)
      .map((e) => ({ w, sets: ix.setsByEntry.get(e.id) ?? [] }))
      .filter((s) => s.sets.length),
  )
  const rows = sessions.map(({ w, sets }) => {
    const best = Math.max(0, ...sets.map((s) => e1rm(s, ex) ?? 0))
    return {
      date: localDate(w.startedAt),
      location: ix.locationName.get(w.locationId),
      sets: sets.length,
      top: setText(topSet(sets)!),
      ...(best ? { e1rmKg: best } : {}),
      ...(ex.measure === 'reps' ? { reps: reps(sets) } : { seconds: seconds(sets) }),
      ...(ex.usesWeight ? { tonnageKg: tonnage(sets) } : {}),
      allSets: sets.map(setText),
    }
  })
  const withE1rm = rows.filter((r) => r.e1rmKg)
  const bestE1rm = withE1rm.length ? withE1rm.reduce((a, b) => (b.e1rmKg! > a.e1rmKg! ? b : a)) : undefined
  return {
    exercise: exerciseInfo(ix, ex),
    sessions: rows.length,
    ...(withE1rm.length >= 2
      ? {
          e1rmTrend: {
            first: { date: withE1rm[0].date, kg: withE1rm[0].e1rmKg },
            last: { date: withE1rm.at(-1)!.date, kg: withE1rm.at(-1)!.e1rmKg },
            changeKg: round(withE1rm.at(-1)!.e1rmKg! - withE1rm[0].e1rmKg!),
          },
        }
      : {}),
    ...(bestE1rm ? { bestE1rm: { date: bestE1rm.date, kg: bestE1rm.e1rmKg } } : {}),
    history: rows,
  }
}

export function exerciseCatalog(ix: Index) {
  const stats = new Map<Id, { sessions: number; last: number }>()
  for (const w of ix.workouts)
    for (const e of ix.entriesByWorkout.get(w.id) ?? []) {
      if (!ix.setsByEntry.get(e.id)?.length) continue
      const s = stats.get(e.exerciseId) ?? { sessions: 0, last: 0 }
      stats.set(e.exerciseId, { sessions: s.sessions + 1, last: Math.max(s.last, w.startedAt) })
    }
  return [...ix.exercises.values()]
    .map((ex) => {
      const s = stats.get(ex.id)
      return { ...exerciseInfo(ix, ex), sessions: s?.sessions ?? 0, ...(s ? { lastDone: localDate(s.last) } : {}) }
    })
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'de'))
}

// ---------- Wochenvolumen ----------

export type VolumeGrouping = 'region' | 'exercise' | 'group'

export function weeklyVolume(ix: Index, from: number, to: number, by: VolumeGrouping) {
  const weeks = new Map<string, { start: string; workouts: Set<Id>; buckets: Map<string, WorkoutSet[]> }>()
  for (const w of workoutsBetween(ix, from, to)) {
    const { week, start } = isoWeek(w.startedAt)
    const bucket = weeks.get(week) ?? { start, workouts: new Set<Id>(), buckets: new Map() }
    weeks.set(week, bucket)
    for (const b of workoutBlocks(ix, w)) {
      const info = exerciseInfo(ix, b.exercise)
      const key = by === 'region' ? info.region : by === 'group' ? (info.group ?? info.name) : info.name
      bucket.workouts.add(w.id)
      bucket.buckets.set(key, [...(bucket.buckets.get(key) ?? []), ...b.sets])
    }
  }
  return [...weeks.entries()].map(([week, b]) => ({
    week,
    weekStart: b.start,
    workouts: b.workouts.size,
    [by]: Object.fromEntries(
      [...b.buckets.entries()]
        .sort((x, y) => y[1].length - x[1].length)
        .map(([key, sets]) => [
          key,
          {
            sets: sets.length,
            ...(reps(sets) ? { reps: reps(sets) } : {}),
            ...(tonnage(sets) ? { tonnageKg: tonnage(sets) } : {}),
            ...(seconds(sets) ? { seconds: seconds(sets) } : {}),
          },
        ]),
    ),
  }))
}

export const REGIONS: Region[] = ['legs', 'push', 'pull', 'core', 'other']
export { DAY }
