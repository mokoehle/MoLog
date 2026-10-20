import { useState } from 'react'
import type { Exercise, Measure } from '../db/schema'
import { findExact, matchSuggestions } from '../logic/search'

export interface ExerciseInput {
  name: string
  usesWeight: boolean
  measure: Measure
  parentId?: string
}

interface Props {
  /** Bestehende Übung bearbeiten; ohne → neue Übung anlegen. */
  exercise?: Exercise
  initialName: string
  exercises: Exercise[]
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: ExerciseInput) => void
}

/** Name und Einstellungen einer Übung – beim Anlegen und beim späteren Bearbeiten. */
export function ExerciseForm({ exercise, initialName, exercises, submitLabel, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initialName)
  const [usesWeight, setUsesWeight] = useState(exercise?.usesWeight ?? true)
  const [measure, setMeasure] = useState<Measure>(exercise?.measure ?? 'reps')
  const [parent, setParent] = useState<Exercise | null>(
    exercise?.parentId ? (exercises.find((e) => e.id === exercise.parentId) ?? null) : null,
  )
  const [parentQuery, setParentQuery] = useState('')

  // Nur Übungen ohne eigenen Parent als Basis anbieten (flache Hierarchie), nie sich selbst
  // und keine Übung, die schon Varianten von dieser hier hat.
  const hasVariants = !!exercise && exercises.some((e) => e.parentId === exercise.id)
  const roots = exercises.filter((e) => !e.parentId && e.id !== exercise?.id)
  const parentResults = matchSuggestions(roots, parentQuery).slice(0, 4)

  const trimmed = name.trim()
  const duplicate = findExact(
    exercises.filter((e) => e.id !== exercise?.id),
    trimmed,
  )

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onCancel}>
          ‹ Zurück
        </button>
        <span className="topbar-title">{exercise ? 'Übung bearbeiten' : 'Neue Übung'}</span>
      </header>

      <label className="field-label">Name</label>
      <input
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
      />
      {duplicate && <p className="muted small">Es gibt schon eine Übung „{duplicate.name}“.</p>}

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

      {!hasVariants && (
        <>
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
        </>
      )}

      <div className="spacer" />
      <button
        className="button button-primary"
        disabled={!trimmed || !!duplicate}
        onClick={() => onSubmit({ name: trimmed, usesWeight, measure, parentId: parent?.id })}
      >
        {submitLabel}
      </button>
    </div>
  )
}
