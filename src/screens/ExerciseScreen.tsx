import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Autocomplete } from '../components/Autocomplete'
import { RulerSlider } from '../components/RulerSlider'
import { Sheet } from '../components/Sheet'
import { db } from '../db/db'
import { haptic } from '../haptics'
import type { ExerciseEntry, Id, Workout } from '../db/schema'
import { describeSet, fmtRelative, shortSet } from '../logic/format'
import {
  changeEntryExercise,
  createExercise,
  deleteWorkout,
  finishExercise,
  finishWorkout,
  getStartValues,
  logSet,
  previousSessions,
  undoLastSet,
  updateExercise,
  WEIGHT_STEP,
  type SetValues,
} from '../logic/workout'
import { ExerciseForm } from './ExerciseForm'

export interface WorkoutNav {
  onOpenExercise: (id: Id) => void
  onOpenHistory: () => void
  onFinished: (saved: boolean) => void
}

interface Props extends WorkoutNav {
  workout: Workout
  entry: ExerciseEntry
}

type Form = { mode: 'new'; name: string } | { mode: 'edit' }

export function ExerciseScreen({ workout, entry, onOpenExercise, onOpenHistory, onFinished }: Props) {
  const [values, setValues] = useState<SetValues | null>(null)
  const [sheet, setSheet] = useState<'menu' | 'change' | null>(null)
  const [form, setForm] = useState<Form | null>(null)

  const data = useLiveQuery(async () => {
    const [exercise, sets, exercises, previous] = await Promise.all([
      db.exercises.get(entry.exerciseId),
      db.sets.where('entryId').equals(entry.id).sortBy('position'),
      db.exercises.toArray(),
      previousSessions(entry.exerciseId, workout.id, 3),
    ])
    return { exercise, sets, exercises, previous }
  }, [entry.id, entry.exerciseId])

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
  const { exercise, sets, exercises, previous } = data
  const last = sets.at(-1)
  const lastTime = previous[0]

  const endWorkout = async () => {
    setSheet(null)
    onFinished(await finishWorkout(workout.id))
  }

  const discard = async () => {
    const count = await db.sets.where('workoutId').equals(workout.id).count()
    if (count > 0 && !confirm(`Training mit ${count} Sätzen wirklich verwerfen?`)) return
    setSheet(null)
    await deleteWorkout(workout.id)
    onFinished(false)
  }

  if (form) {
    return (
      <ExerciseForm
        exercise={form.mode === 'edit' ? exercise : undefined}
        initialName={form.mode === 'edit' ? exercise.name : form.name}
        exercises={exercises}
        submitLabel={form.mode === 'edit' ? 'Speichern' : 'Anlegen & wechseln'}
        onCancel={() => setForm(null)}
        onSubmit={async (input) => {
          if (form.mode === 'edit') await updateExercise(exercise.id, input)
          else await changeEntryExercise(entry.id, await createExercise(input))
          setForm(null)
        }}
      />
    )
  }

  return (
    <div className="screen exercise-screen">
      <header className="exercise-header">
        <button className="title-button" onClick={() => setSheet('change')} aria-label="Übung wechseln oder bearbeiten">
          <h1 className="exercise-title">{exercise.name}</h1>
          <span className="title-chevron">▾</span>
        </button>
        <button className="icon-button" onClick={() => setSheet('menu')} aria-label="Menü">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {lastTime && (
        <p className="last-time">
          <span className="muted">Letztes Mal ({fmtRelative(lastTime.entry.startedAt)}):</span>{' '}
          {lastTime.sets.map((s, i) => (
            <span key={s.id} className="nowrap">
              {i > 0 && ' · '}
              {shortSet(s)}
            </span>
          ))}
        </p>
      )}

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
        <button
          className="button button-primary"
          onClick={() => {
            haptic()
            void logSet(entry, exercise, values)
          }}
        >
          Satz speichern
        </button>
        <button className="button button-secondary" onClick={() => finishExercise(entry.id)}>
          Nächste Übung
        </button>
      </div>

      {sheet === 'change' && (
        <Sheet title="Übung wechseln" onClose={() => setSheet(null)}>
          <button
            className="settings-row sheet-row"
            onClick={() => {
              setSheet(null)
              setForm({ mode: 'edit' })
            }}
          >
            „{exercise.name}“ bearbeiten (Name, Gewicht, Variante)
          </button>
          {sets.length > 0 && (
            <p className="muted small">Die {sets.length} gespeicherten Sätze werden in die neue Übung übernommen.</p>
          )}
          <Autocomplete
            label="Stattdessen"
            placeholder="Andere Übung suchen"
            items={exercises.filter((e) => e.id !== exercise.id)}
            initialSuggestions={[]}
            autoFocus={false}
            onSelect={async (ex) => {
              await changeEntryExercise(entry.id, ex)
              setSheet(null)
            }}
            onCreate={(name) => {
              setSheet(null)
              setForm({ mode: 'new', name })
            }}
          />
        </Sheet>
      )}

      {sheet === 'menu' && (
        <Sheet title="Menü" onClose={() => setSheet(null)}>
          <h3 className="field-label">{exercise.name} – letzte Einheiten</h3>
          {previous.length === 0 && <p className="muted small">Zum ersten Mal dabei.</p>}
          <ul className="card-list">
            {previous.map((p) => (
              <li key={p.entry.id} className="mini-session">
                <span className="muted small">{fmtRelative(p.entry.startedAt)}</span>
                <span className="set-chips">
                  {p.sets.map((s) => (
                    <span key={s.id} className="set-chip">
                      {shortSet(s)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <WorkoutMenuRows
            onExercise={() => onOpenExercise(exercise.id)}
            exerciseName={exercise.name}
            onHistory={onOpenHistory}
            onEnd={endWorkout}
            onCancel={discard}
          />
        </Sheet>
      )}
    </div>
  )
}

/** Gemeinsame Menüpunkte während eines Trainings. */
export function WorkoutMenuRows(props: {
  exerciseName?: string
  onExercise?: () => void
  onHistory: () => void
  onEnd: () => void
  onCancel?: () => void
}) {
  return (
    <div className="settings-list sheet-actions">
      {props.onExercise && (
        <button className="settings-row" onClick={props.onExercise}>
          Verlauf von „{props.exerciseName}“ ›
        </button>
      )}
      <button className="settings-row" onClick={props.onHistory}>
        Alle Trainings & Übungen ›
      </button>
      <button className="settings-row" onClick={props.onEnd}>
        Training beenden
      </button>
      {props.onCancel && (
        <button className="settings-row danger-row" onClick={props.onCancel}>
          Training verwerfen
        </button>
      )}
    </div>
  )
}
