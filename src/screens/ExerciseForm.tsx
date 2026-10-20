import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { Equipment, Exercise, ExerciseGroup, Measure } from '../db/schema'
import { EQUIPMENT, equipmentInfo, WEIGHT_STEPS } from '../logic/equipment'
import { fmtNum } from '../logic/format'
import { findExact, matchSuggestions, normalize } from '../logic/search'
import { createGroup, type ExerciseInput } from '../logic/workout'

interface Props {
  /** Bestehende Übung bearbeiten; ohne → neue Übung anlegen. */
  exercise?: Exercise
  initialName: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: ExerciseInput) => void
}

/** Gewählte Gruppe: vorhandene oder eine, die beim Speichern neu angelegt wird. */
type GroupChoice = { group: ExerciseGroup } | { newName: string } | null

/** Name und Einstellungen einer Übung – beim Anlegen und beim späteren Bearbeiten. */
export function ExerciseForm({ exercise, initialName, submitLabel, onCancel, onSubmit }: Props) {
  const data = useLiveQuery(async () => ({
    groups: await db.exerciseGroups.toArray(),
    exercises: await db.exercises.toArray(),
  }))

  const [name, setName] = useState(initialName)
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell')
  const [usesWeight, setUsesWeight] = useState(exercise?.usesWeight ?? true)
  const [weightStep, setWeightStep] = useState(exercise?.weightStep ?? 2.5)
  const [measure, setMeasure] = useState<Measure>(exercise?.measure ?? 'reps')
  const [choice, setChoice] = useState<GroupChoice | undefined>(undefined) // undefined = noch unverändert
  const [groupQuery, setGroupQuery] = useState('')

  if (!data) return null

  const initialGroup = exercise?.groupId ? data.groups.find((g) => g.id === exercise.groupId) : undefined
  const group: GroupChoice = choice === undefined ? (initialGroup ? { group: initialGroup } : null) : choice

  const trimmed = name.trim()
  const duplicate = findExact(
    data.exercises.filter((e) => e.id !== exercise?.id),
    trimmed,
  )

  // Passende Gruppe vorschlagen, wenn ihr Name im Übungsnamen vorkommt ("Rudern Kurzhantel" → Rudern)
  const nameWords = normalize(trimmed).split(/[\s-]+/)
  const suggestedGroup = !group
    ? data.groups.find((g) => normalize(g.name).split(/\s+/).every((w) => nameWords.includes(w)))
    : undefined

  const gq = groupQuery.trim()
  const groupResults = gq ? matchSuggestions(data.groups, gq).slice(0, 4) : []
  const groupExact = gq ? findExact(data.groups, gq) : undefined

  const pickEquipment = (id: Equipment) => {
    const info = equipmentInfo(id)
    setEquipment(id)
    setUsesWeight(info.usesWeight)
    setWeightStep(info.step)
  }

  const submit = async () => {
    let groupId: string | undefined
    if (group && 'group' in group) groupId = group.group.id
    if (group && 'newName' in group) groupId = (await createGroup(group.newName)).id
    onSubmit({ name: trimmed, groupId, equipment, usesWeight, weightStep, measure })
  }

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

      <label className="field-label">Gruppe (optional)</label>
      {group ? (
        <button className="chip active" onClick={() => setChoice(null)}>
          {'group' in group ? group.group.name : `${group.newName} (neu)`} ✕
        </button>
      ) : (
        <>
          {suggestedGroup && (
            <button className="chip" onClick={() => setChoice({ group: suggestedGroup })}>
              + Zur Gruppe „{suggestedGroup.name}“
            </button>
          )}
          <input
            className="text-input text-input-small"
            value={groupQuery}
            onChange={(e) => setGroupQuery(e.target.value)}
            placeholder="z. B. Rudern, Bankdrücken, Klimmzüge"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <ul className="suggestions">
            {groupResults.map((g) => (
              <li key={g.id}>
                <button className="suggestion" onClick={() => setChoice({ group: g })}>
                  {g.name}
                </button>
              </li>
            ))}
            {gq && !groupExact && (
              <li>
                <button className="suggestion suggestion-create" onClick={() => setChoice({ newName: gq })}>
                  + Gruppe „{gq}“ anlegen
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      <label className="field-label">Gerät</label>
      <div className="choice-grid">
        {EQUIPMENT.map((e) => (
          <button key={e.id} className={equipment === e.id ? 'chip active' : 'chip'} onClick={() => pickEquipment(e.id)}>
            {e.label}
          </button>
        ))}
      </div>

      <label className="field-label">Gewicht</label>
      <div className="segmented">
        <button className={usesWeight ? 'active' : ''} onClick={() => setUsesWeight(true)}>
          {equipment === 'bodyweight' ? 'Mit Zusatzgewicht' : 'Mit Gewicht'}
        </button>
        <button className={!usesWeight ? 'active' : ''} onClick={() => setUsesWeight(false)}>
          Ohne
        </button>
      </div>

      {usesWeight && (
        <>
          <label className="field-label">Schrittweite am Slider</label>
          <div className="choice-grid">
            {WEIGHT_STEPS.map((s) => (
              <button key={s} className={weightStep === s ? 'chip active' : 'chip'} onClick={() => setWeightStep(s)}>
                {fmtNum(s)} kg
              </button>
            ))}
          </div>
        </>
      )}

      <label className="field-label">Zählen in</label>
      <div className="segmented">
        <button className={measure === 'reps' ? 'active' : ''} onClick={() => setMeasure('reps')}>
          Wiederholungen
        </button>
        <button className={measure === 'seconds' ? 'active' : ''} onClick={() => setMeasure('seconds')}>
          Sekunden (statisch)
        </button>
      </div>

      <div className="spacer" />
      <button className="button button-primary" disabled={!trimmed || !!duplicate} onClick={submit}>
        {submitLabel}
      </button>
    </div>
  )
}
