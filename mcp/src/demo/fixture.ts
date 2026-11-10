/**
 * Erfundene Beispieldaten (drei Wochen Push / Beine / Pull) – für die Demo und zum Testen ohne Konto.
 */
import type { Dataset, Exercise, ExerciseEntry, Workout, WorkoutSet } from '../core/model.ts'

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime()
let n = 0
const id = (prefix: string) => `${prefix}-${String(++n).padStart(3, '0')}`

const gym = { id: 'loc-1', name: 'Testgym', createdAt: at('2026-09-01', '12:00') }
const types = ['Push', 'Beine', 'Pull'].map((name, i) => ({ id: `type-${i}`, name, createdAt: gym.createdAt }))
const rudern = { id: 'grp-1', name: 'Rudern', createdAt: gym.createdAt }

const ex = (name: string, equipment: Exercise['equipment'], extra: Partial<Exercise> = {}): Exercise => ({
  id: id('ex'),
  name,
  equipment,
  usesWeight: equipment !== 'bodyweight',
  weightStep: equipment === 'dumbbell' ? 1 : 2.5,
  measure: 'reps',
  createdAt: gym.createdAt,
  ...extra,
})

const E = {
  bank: ex('Bankdrücken', 'barbell'),
  ohp: ex('Schulterdrücken', 'dumbbell'),
  dips: ex('Dips', 'bodyweight', { usesWeight: true }),
  squat: ex('Kniebeuge', 'barbell'),
  bulgarian: ex('Bulgarian Split Squat', 'dumbbell'),
  legExt: ex('Beinstrecker', 'machine'),
  plank: ex('Plank', 'bodyweight', { usesWeight: false, measure: 'seconds' }),
  pullups: ex('Klimmzüge', 'bodyweight', { usesWeight: true }),
  tbar: ex('T-Bar-Rudern', 'machine', { groupId: rudern.id }),
  cableRow: ex('Kabelrudern eng', 'cable', { groupId: rudern.id }),
}

type Plan = [Exercise, [kg: number | null, reps: number | null, sec?: number][]][]

const workouts: Workout[] = []
const entries: ExerciseEntry[] = []
const sets: WorkoutSet[] = []

/** Legt ein Training an: Sätze im Abstand von ~2,5 min, zwischen Übungen etwas mehr. */
function workout(date: string, time: string, type: number, plan: Plan) {
  const w: Workout = { id: id('wo'), locationId: gym.id, workoutTypeId: types[type].id, startedAt: at(date, time) }
  let t = w.startedAt + 3 * 60_000
  plan.forEach(([exercise, list], position) => {
    const entry: ExerciseEntry = { id: id('en'), workoutId: w.id, exerciseId: exercise.id, position, startedAt: t }
    list.forEach(([kg, reps, sec], i) => {
      t += (i === 0 ? 90 : 150 + ((i * 37) % 40)) * 1000
      sets.push({
        id: id('set'),
        entryId: entry.id,
        workoutId: w.id,
        exerciseId: exercise.id,
        position: i,
        weightKg: kg,
        reps,
        durationSec: sec ?? null,
        loggedAt: t,
      })
    })
    entry.endedAt = t + 60_000
    t += 120_000
    entries.push(entry)
  })
  w.endedAt = t
  workouts.push(w)
}

const x = (kg: number | null, reps: number, count: number) =>
  Array.from({ length: count }, () => [kg, reps] as [number | null, number])

;[0, 1, 2].forEach((week) => {
  const day = (d: number) => new Date(2026, 9, 19 + week * 7 + d).toLocaleDateString('sv-SE')
  workout(day(0), '18:10', 0, [
    [E.bank, x(80 + week * 2.5, 8 - week, 3)],
    [E.ohp, x(22 + week, 10, 3)],
    [E.dips, x(10, 10 + week, 3)],
  ])
  workout(day(3), '17:45', 1, [
    [E.squat, x(90 + week * 5, 6, 4)],
    [E.bulgarian, x(16 + week * 2, 10, 3)],
    [E.legExt, x(50, 12, 3)],
    [
      E.plank,
      [
        [null, null, 60 + week * 10],
        [null, null, 60 + week * 10],
      ],
    ],
  ])
  workout(day(5), '10:30', 2, [
    [E.pullups, x(week * 2.5, 8, 4)],
    [E.tbar, x(50 + week * 2.5, 10, 3)],
    [E.cableRow, x(60, 12, 3)],
  ])
})

export const fixture: Dataset = {
  locations: [gym],
  workoutTypes: types,
  exerciseGroups: [rudern],
  exercises: Object.values(E),
  workouts,
  entries,
  sets,
}
