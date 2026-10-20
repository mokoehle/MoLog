import { useState } from 'react'
import type { Exercise, Measure } from '../db/schema'
import { matchSuggestions } from '../logic/search'
import { createExercise } from '../logic/workout'

interface Props {
  name: string
  exercises: Exercise[]
  onCancel: () => void
  onCreated: (exercise: Exercise) => void
}

/** Einmalige Einstellungen beim Anlegen einer neuen Übung. */
export function NewExercise({ name, exercises, onCancel, onCreated }: Props) {
  const [usesWeight, setUsesWeight] = useState(true)
  const [measure, setMeasure] = useState<Measure>('reps')
  const [parent, setParent] = useState<Exercise | null>(null)
  const [parentQuery, setParentQuery] = useState('')

  // Nur Übungen ohne eigenen Parent als Basis anbieten, damit die Hierarchie flach bleibt.
  const roots = exercises.filter((e) => !e.parentId)
  const parentResults = matchSuggestions(roots, parentQuery).slice(0, 4)

  const create = async () => {
    onCreated(await createExercise({ name, usesWeight, measure, parentId: parent?.id }))
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onCancel}>
          ‹ Zurück
        </button>
        <span className="topbar-title">Neue Übung</span>
      </header>

      <h1 className="exercise-title">{name}</h1>

      <label className="field-label">Gewicht</label>
      <div className="segmented">
        <button className={usesWeight ? 'active' : ''} onClick={() => setUsesWeight(true)}>
          Mit Gewicht
        </button>
        <button className={!usesWeight ? 'active' : ''} onClick={() => setUsesWeight(false)}>
          Körpergewicht
        </button>
      </div>

      <label className="field-label">Zählen in</label>
      <div className="segmented">
        <button className={measure === 'reps' ? 'active' : ''} onClick={() => setMeasure('reps')}>
          Wiederholungen
        </button>
        <button className={measure === 'seconds' ? 'active' : ''} onClick={() => setMeasure('seconds')}>
          Sekunden (statisch)
        </button>
      </div>

      <label className="field-label">Variante von (optional)</label>
      {parent ? (
        <button className="chip" onClick={() => setParent(null)}>
          {parent.name} ✕
        </button>
      ) : (
        <>
          <input
            className="text-input text-input-small"
            value={parentQuery}
            onChange={(e) => setParentQuery(e.target.value)}
            placeholder="z. B. Klimmzüge"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <ul className="suggestions">
            {parentResults.map((e) => (
              <li key={e.id}>
                <button className="suggestion" onClick={() => setParent(e)}>
                  {e.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="spacer" />
      <button className="button button-primary" onClick={create}>
        Anlegen & starten
      </button>
    </div>
  )
}
