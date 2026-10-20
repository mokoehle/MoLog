import type { Id } from '../db/schema'
import { fmtDay, fmtDuration, fmtNum, fmtTime, plural, shortSet } from '../logic/format'
import { compareEntry, primaryMetric, workoutTotals, type AllData } from '../logic/stats'

interface Props {
  data: AllData
  workoutId: Id
  onOpenExercise: (exerciseId: Id) => void
}

/** Übersicht eines Trainings: Kennzahlen + Übungen in der gemachten Reihenfolge. */
export function WorkoutDetail({ data, workoutId, onOpenExercise }: Props) {
  const workout = data.workouts.find((w) => w.id === workoutId)
  if (!workout) return <p className="muted">Training nicht gefunden.</p>
  const totals = workoutTotals(data, workoutId)

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
              <button className="entry-card" onClick={() => onOpenExercise(entry.exerciseId)}>
                <span className="entry-index">{i + 1}</span>
                <span className="entry-body">
                  <span className="entry-title">
                    <strong>{ex?.name}</strong>
                    {entry.endedAt && <span className="muted">{fmtDuration(entry.endedAt - entry.startedAt)}</span>}
                  </span>
                  <span className="set-chips">
                    {sets.map((s) => (
                      <span key={s.id} className="set-chip">
                        {shortSet(s)}
                      </span>
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
              </button>
            </li>
          )
        })}
      </ol>
      {totals.entries.length === 0 && <p className="muted">{plural(0, 'Übung', 'Übungen')}</p>}
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
