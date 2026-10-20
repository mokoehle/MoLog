import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { RulerSlider } from '../components/RulerSlider'
import { db } from '../db/db'
import type { ExerciseEntry, Workout, WorkoutSet } from '../db/schema'
import { finishExercise, getStartValues, logSet, undoLastSet, WEIGHT_STEP, type SetValues } from '../logic/workout'

interface Props {
  workout: Workout
  entry: ExerciseEntry
}

const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 })

export function describeSet(s: WorkoutSet) {
  const amount = s.reps !== null ? `${s.reps}` : `${s.durationSec} s`
  return s.weightKg !== null ? `${fmt(s.weightKg)} kg × ${amount}` : amount
}

export function ExerciseScreen({ workout, entry }: Props) {
  const [values, setValues] = useState<SetValues | null>(null)

  const data = useLiveQuery(async () => {
    const [exercise, sets] = await Promise.all([
      db.exercises.get(entry.exerciseId),
      db.sets.where('entryId').equals(entry.id).sortBy('position'),
    ])
    return { exercise, sets }
  }, [entry.id])

  // Startwerte: letzter Satz dieser Übung heute, sonst erster Satz vom letzten Mal.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sets = await db.sets.where('entryId').equals(entry.id).sortBy('position')
      const last = sets.at(-1)
      const start = await getStartValues(entry.exerciseId, workout.id)
      const v = last
        ? {
            weightKg: last.weightKg ?? start.weightKg,
            reps: last.reps ?? start.reps,
            durationSec: last.durationSec ?? start.durationSec,
          }
        : start
      if (!cancelled) setValues(v)
    })()
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.exerciseId, workout.id])

  if (!data?.exercise || !values) return null
  const { exercise, sets } = data
  const last = sets.at(-1)

  return (
    <div className="screen exercise-screen">
      <h1 className="exercise-title">{exercise.name}</h1>
      <div className="set-info">
        <span>
          Satz {sets.length + 1}
          {last && <> · zuletzt {describeSet(last)}</>}
        </span>
        {/* Bewusst hier oben statt bei den großen Buttons, damit sich deren Position nie verschiebt. */}
        {last && (
          <button className="link-button undo" onClick={() => undoLastSet(entry.id)}>
            Rückgängig
          </button>
        )}
      </div>

      <div className="sliders">
        {exercise.usesWeight && (
          <RulerSlider
            value={values.weightKg}
            onChange={(weightKg) => setValues((v) => v && { ...v, weightKg })}
            step={WEIGHT_STEP}
            min={0}
            max={400}
            majorEvery={4}
            unit="kg"
          />
        )}
        {exercise.measure === 'reps' ? (
          <RulerSlider
            value={values.reps}
            onChange={(reps) => setValues((v) => v && { ...v, reps })}
            step={1}
            min={1}
            max={100}
            majorEvery={5}
            unit="Wdh"
          />
        ) : (
          <RulerSlider
            value={values.durationSec}
            onChange={(durationSec) => setValues((v) => v && { ...v, durationSec })}
            step={5}
            min={5}
            max={600}
            majorEvery={6}
            unit="s"
          />
        )}
      </div>

      <div className="actions">
        <button className="button button-primary" onClick={() => logSet(entry, exercise, values)}>
          Satz speichern
        </button>
        <button className="button button-secondary" onClick={() => finishExercise(entry.id)}>
          Nächste Übung
        </button>
      </div>
    </div>
  )
}
