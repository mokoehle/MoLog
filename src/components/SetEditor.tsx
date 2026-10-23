import { useState } from 'react'
import type { Exercise, WorkoutSet } from '../db/schema'
import { deleteSet, updateSet } from '../logic/workout'
import { RulerSlider } from './RulerSlider'

interface Props {
  set: WorkoutSet
  exercise: Exercise
  /** Nummer des Satzes (1-basiert) für die Überschrift */
  number: number
  onDone: () => void
}

/** Einen gespeicherten Satz korrigieren oder löschen – mit denselben Slidern wie im Training. */
export function SetEditor({ set, exercise, number, onDone }: Props) {
  // Gewicht/Wdh/Sekunden wie gespeichert; fehlende Werte (z. B. Übung nachträglich umgestellt) sinnvoll vorbelegen
  const [weightKg, setWeightKg] = useState(set.weightKg ?? 0)
  const [reps, setReps] = useState(set.reps ?? 10)
  const [durationSec, setDurationSec] = useState(set.durationSec ?? 30)

  const save = async () => {
    await updateSet(set.id, {
      weightKg: exercise.usesWeight ? weightKg : null,
      reps: exercise.measure === 'reps' ? reps : null,
      durationSec: exercise.measure === 'seconds' ? durationSec : null,
    })
    onDone()
  }

  const remove = async () => {
    if (!confirm(`Satz ${number} löschen?`)) return
    await deleteSet(set.id)
    onDone()
  }

  return (
    <div className="set-editor">
      <p className="field-label">Satz {number} bearbeiten</p>
      {exercise.usesWeight && (
        <RulerSlider
          value={weightKg}
          onChange={setWeightKg}
          step={exercise.weightStep}
          min={0}
          max={400}
          majorEvery={Math.max(1, Math.round(10 / exercise.weightStep))}
          unit="kg"
        />
      )}
      {exercise.measure === 'reps' ? (
        <RulerSlider value={reps} onChange={setReps} step={1} min={1} max={100} majorEvery={5} unit="Wdh" />
      ) : (
        <RulerSlider value={durationSec} onChange={setDurationSec} step={5} min={5} max={600} majorEvery={6} unit="s" />
      )}
      <div className="actions">
        <button className="button button-primary" onClick={save}>
          Speichern
        </button>
        <button className="link-button danger" onClick={remove}>
          Satz löschen
        </button>
      </div>
    </div>
  )
}
