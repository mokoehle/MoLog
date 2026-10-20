import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart } from '../components/LineChart'
import { Stat } from '../components/WorkoutDetail'
import type { Id } from '../db/schema'
import { fmtDuration, fmtNum, fmtShortDay, shortSet } from '../logic/format'
import { estimate1RM, loadAll, primaryMetric, totalReps } from '../logic/stats'

interface Props {
  exerciseId: Id
  onBack: () => void
  onOpenWorkout: (id: Id) => void
  onOpenExercise: (id: Id) => void
}

const DAY = 86400000

export function ExerciseDetail({ exerciseId, onBack, onOpenWorkout, onOpenExercise }: Props) {
  const data = useLiveQuery(loadAll)
  if (!data) return null
  const ex = data.exercises.get(exerciseId)
  if (!ex) return null

  const sessions = data.sessionsByExercise.get(ex.id) ?? []
  const metric = primaryMetric(ex)
  const parent = ex.parentId ? data.exercises.get(ex.parentId) : undefined
  const variants = data.variants.get(ex.id) ?? []

  const best = sessions.length ? Math.max(...sessions.map((s) => metric.value(s.sets))) : null
  const durations = sessions.filter((s) => s.entry.endedAt).map((s) => s.entry.endedAt! - s.entry.startedAt)
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
  const best1RM =
    ex.usesWeight && ex.measure === 'reps'
      ? Math.max(0, ...sessions.flatMap((s) => s.sets.map((x) => estimate1RM(x.weightKg ?? 0, x.reps ?? 0))))
      : 0

  // Wdh der letzten 30 Tage inkl. Varianten (z. B. alle Klimmzüge, egal ob mit Gewicht)
  const family = [ex, ...variants]
  const since = Date.now() - 30 * DAY
  const reps30 =
    ex.measure === 'reps'
      ? family
          .flatMap((e) => data.sessionsByExercise.get(e.id) ?? [])
          .filter((s) => s.workout.startedAt >= since)
          .reduce((n, s) => n + totalReps(s.sets), 0)
      : 0

  const points = sessions.map((s) => ({ t: s.workout.startedAt, v: metric.value(s.sets) }))

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onBack}>
          ‹ Zurück
        </button>
        <span className="topbar-title">Übung</span>
      </header>

      <div className="detail-head">
        <h1 className="exercise-title">{ex.name}</h1>
        <p className="muted">
          {ex.usesWeight ? 'Mit Gewicht' : 'Körpergewicht'} · {ex.measure === 'reps' ? 'Wiederholungen' : 'Sekunden'}
          {parent && (
            <>
              {' · Variante von '}
              <button className="inline-link" onClick={() => onOpenExercise(parent.id)}>
                {parent.name}
              </button>
            </>
          )}
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="muted">Diese Übung wurde noch nicht gemacht.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <Stat label={metric.label} value={`${fmtNum(best!)} ${metric.unit}`} />
            {best1RM > 0 && <Stat label="Geschätztes 1RM" value={`${fmtNum(best1RM)} kg`} />}
            <Stat label="Einheiten" value={String(sessions.length)} />
            {avgDuration !== null && <Stat label="Ø Dauer" value={fmtDuration(avgDuration)} />}
            {reps30 > 0 && (
              <Stat label={variants.length ? 'Wdh 30 Tage inkl. Varianten' : 'Wdh 30 Tage'} value={String(reps30)} />
            )}
          </div>

          {points.length >= 2 && (
            <section>
              <h2 className="field-label">{metric.label} pro Einheit</h2>
              <LineChart points={points} unit={metric.unit} />
            </section>
          )}
        </>
      )}

      {variants.length > 0 && (
        <section>
          <h2 className="field-label">Varianten</h2>
          <div className="filter-chips">
            {variants.map((v) => (
              <button key={v.id} className="chip" onClick={() => onOpenExercise(v.id)}>
                {v.name} ›
              </button>
            ))}
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <h2 className="field-label">Alle Einheiten</h2>
          <ul className="card-list">
            {[...sessions].reverse().map((s) => (
              <li key={s.entry.id}>
                <button className="list-card" onClick={() => onOpenWorkout(s.workout.id)}>
                  <span className="list-card-top">
                    <strong>{fmtShortDay(s.workout.startedAt)}</strong>
                    <span className="muted">
                      {data.types.get(s.workout.workoutTypeId)?.name}
                      {s.entry.endedAt && ` · ${fmtDuration(s.entry.endedAt - s.entry.startedAt)}`}
                    </span>
                  </span>
                  <span className="set-chips">
                    {s.sets.map((x) => (
                      <span key={x.id} className="set-chip">
                        {shortSet(x)}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
