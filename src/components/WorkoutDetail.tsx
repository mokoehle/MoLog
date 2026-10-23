import { useState } from 'react'
import type { Id } from '../db/schema'
import { fmtDay, fmtDuration, fmtNum, fmtTime, plural, shortSet } from '../logic/format'
import { compareEntry, primaryMetric, workoutTotals, type AllData } from '../logic/stats'
import { SetEditor } from './SetEditor'
import { Sheet } from './Sheet'

interface Props {
  data: AllData
  workoutId: Id
  onOpenExercise: (exerciseId: Id) => void
}

/** Übersicht eines Trainings: Kennzahlen + Übungen in der gemachten Reihenfolge. */
export function WorkoutDetail({ data, workoutId, onOpenExercise }: Props) {
  // Satz, der gerade bearbeitet wird (Antippen eines Satz-Chips)
  const [editSetId, setEditSetId] = useState<Id | null>(null)
  const workout = data.workouts.find((w) => w.id === workoutId)
  if (!workout) return <p className="muted">Training nicht gefunden.</p>
  const totals = workoutTotals(data, workoutId)

  const editing = (() => {
    for (const entry of totals.entries) {
      const sets = data.setsByEntry.get(entry.id) ?? []
      const i = sets.findIndex((s) => s.id === editSetId)
      if (i >= 0) return { set: sets[i], number: i + 1 }
    }
    return null
  })()
  const editingExercise = editing ? data.exercises.get(editing.set.exerciseId) : undefined

  return (
    <>
      <div className="detail-head">
        <h1 className="exercise-title">{data.types.get(workout.workoutTypeId)?.name}</h1>
        <p className="muted">
          {data.locations.get(workout.locationId)?.name} · {fmtDay(workout.startedAt)}
          <br />
          {fmtTime(workout.startedAt)} – {fmtTime(workout.endedAt!)} Uhr
        </p>
      </div>

      <div className="stat-tiles">
        <Stat label="Dauer" value={fmtDuration(workout.endedAt! - workout.startedAt)} />
        <Stat label="Übungen" value={String(totals.exercises)} />
        <Stat label="Sätze" value={String(totals.sets)} />
        {totals.volume > 0 && <Stat label="Volumen" value={`${fmtNum(totals.volume)} kg`} />}
      </div>

      <ol className="entry-list">
        {totals.entries.map((entry, i) => {
          const ex = data.exercises.get(entry.exerciseId)
          const sets = data.setsByEntry.get(entry.id) ?? []
          const cmp = compareEntry(data, entry)
          const metric = ex ? primaryMetric(ex) : null
          const delta = cmp?.previous !== undefined ? cmp.value - cmp.previous : 0
          return (
            <li key={entry.id}>
              {/* Name → Übung öffnen, Satz-Chips → Satz bearbeiten */}
              <div className="entry-card">
                <span className="entry-index">{i + 1}</span>
                <span className="entry-body">
                  <button className="entry-title" onClick={() => onOpenExercise(entry.exerciseId)}>
                    <strong>
                      {ex?.name} <span className="title-chevron">›</span>
                    </strong>
                    {entry.endedAt && <span className="muted">{fmtDuration(entry.endedAt - entry.startedAt)}</span>}
                  </button>
                  <span className="set-chips">
                    {sets.map((s) => (
                      <button key={s.id} className="set-chip" onClick={() => setEditSetId(s.id)}>
                        {shortSet(s)}
                      </button>
                    ))}
                  </span>
                  {cmp && metric && (
                    <span className="entry-compare">
                      {cmp.isRecord && <span className="badge">Bestwert</span>}
                      {cmp.isFirst && <span className="badge badge-muted">Zum ersten Mal</span>}
                      {cmp.previous !== undefined && delta !== 0 && (
                        <span className={delta > 0 ? 'trend up' : 'trend down'}>
                          {delta > 0 ? '▲' : '▼'} {fmtNum(Math.abs(delta))} {metric.unit} ggü. letztem Mal
                        </span>
                      )}
                      {cmp.previous !== undefined && delta === 0 && !cmp.isRecord && (
                        <span className="trend">wie letztes Mal</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      {totals.entries.length === 0 && <p className="muted">{plural(0, 'Übung', 'Übungen')}</p>}

      {editing && editingExercise && (
        <Sheet title={editingExercise.name} onClose={() => setEditSetId(null)}>
          <SetEditor
            set={editing.set}
            number={editing.number}
            exercise={editingExercise}
            onDone={() => setEditSetId(null)}
          />
        </Sheet>
      )}
    </>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
