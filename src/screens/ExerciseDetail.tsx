import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { LineChart } from '../components/LineChart'
import { Stat } from '../components/WorkoutDetail'
import type { Id } from '../db/schema'
import { fmtDuration, fmtNum, fmtShortDay, shortSet } from '../logic/format'
import { dependsOnLocation, equipmentInfo } from '../logic/equipment'
import { estimate1RM, loadAll, primaryMetric, totalReps } from '../logic/stats'

interface Props {
  exerciseId: Id
  onBack: () => void
  onOpenWorkout: (id: Id) => void
  onOpenGroup: (id: Id) => void
}

const DAY = 86400000

export function ExerciseDetail({ exerciseId, onBack, onOpenWorkout, onOpenGroup }: Props) {
  const data = useLiveQuery(loadAll)
  // Gym-Filter bei Maschinen/Kabel; undefined = automatisch das zuletzt genutzte Gym
  const [gymChoice, setGymChoice] = useState<Id | undefined>(undefined)
  if (!data) return null
  const ex = data.exercises.get(exerciseId)
  if (!ex) return null

  const allSessions = data.sessionsByExercise.get(ex.id) ?? []
  // Gyms, in denen die Übung gemacht wurde – zuletzt genutztes zuerst
  const gyms = [...new Set([...allSessions].reverse().map((s) => s.workout.locationId))]
  const showGymFilter = dependsOnLocation(ex.equipment) && gyms.length > 1
  const gym = showGymFilter ? (gymChoice ?? gyms[0]) : undefined
  const sessions = gym ? allSessions.filter((s) => s.workout.locationId === gym) : allSessions
  const metric = primaryMetric(ex)
  const group = ex.groupId ? data.groups.get(ex.groupId) : undefined

  const best = sessions.length ? Math.max(...sessions.map((s) => metric.value(s.sets))) : null
  const durations = sessions.filter((s) => s.entry.endedAt).map((s) => s.entry.endedAt! - s.entry.startedAt)
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
  const best1RM =
    ex.usesWeight && ex.measure === 'reps'
      ? Math.max(0, ...sessions.flatMap((s) => s.sets.map((x) => estimate1RM(x.weightKg ?? 0, x.reps ?? 0))))
      : 0

  const since = Date.now() - 30 * DAY
  const reps30 =
    ex.measure === 'reps'
      ? sessions.filter((s) => s.workout.startedAt >= since).reduce((n, s) => n + totalReps(s.sets), 0)
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
          {equipmentInfo(ex.equipment).label}
          {ex.usesWeight && ` · ${fmtNum(ex.weightStep)}-kg-Schritte`} ·{' '}
          {ex.measure === 'reps' ? 'Wiederholungen' : 'Sekunden'}
        </p>
        {group && (
          <button className="chip" onClick={() => onOpenGroup(group.id)}>
            Gruppe: {group.name} ›
          </button>
        )}
      </div>

      {showGymFilter && (
        <div className="filter-chips">
          {gyms.map((id) => (
            <button key={id} className={gym === id ? 'chip active' : 'chip'} onClick={() => setGymChoice(id)}>
              {data.locations.get(id)?.name}
            </button>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="muted">Diese Übung wurde noch nicht gemacht.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <Stat label={metric.label} value={`${fmtNum(best!)} ${metric.unit}`} />
            {best1RM > 0 && <Stat label="Geschätztes 1RM" value={`${Math.round(best1RM)} kg`} />}
            <Stat label="Einheiten" value={String(sessions.length)} />
            {avgDuration !== null && <Stat label="Ø Dauer" value={fmtDuration(avgDuration)} />}
            {reps30 > 0 && (
              <Stat label="Wdh 30 Tage" value={String(reps30)} />
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
