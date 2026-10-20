import { useLiveQuery } from 'dexie-react-hooks'
import { Stat } from '../components/WorkoutDetail'
import { db } from '../db/db'
import type { Id } from '../db/schema'
import { equipmentInfo } from '../logic/equipment'
import { fmtNum, fmtRelative, fmtShortDay, plural, shortSet } from '../logic/format'
import { groupSessions, loadAll, primaryMetric, totalReps, volume } from '../logic/stats'

interface Props {
  groupId: Id
  onBack: () => void
  onOpenExercise: (id: Id) => void
  onOpenWorkout: (id: Id) => void
}

const DAY = 86400000

/** Übersicht einer Übungsgruppe: alle zugehörigen Übungen und Kennzahlen über alle zusammen. */
export function GroupDetail({ groupId, onBack, onOpenExercise, onOpenWorkout }: Props) {
  const data = useLiveQuery(loadAll)
  if (!data) return null
  const group = data.groups.get(groupId)
  if (!group) return null

  const exercises = data.exercisesByGroup.get(groupId) ?? []
  const sessions = groupSessions(data, groupId)
  const recent = sessions.filter((s) => s.workout.startedAt >= Date.now() - 30 * DAY)
  const recentSets = recent.flatMap((s) => s.sets)

  const rename = async () => {
    const name = prompt('Neuer Name der Gruppe', group.name)?.trim()
    if (name) await db.exerciseGroups.update(groupId, { name })
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onBack}>
          ‹ Zurück
        </button>
        <span className="topbar-title">Gruppe</span>
      </header>

      <div className="detail-head">
        <h1 className="exercise-title">{group.name}</h1>
        <p className="muted">
          {plural(exercises.length, 'Übung', 'Übungen')} ·{' '}
          <button className="inline-link" onClick={rename}>
            Umbenennen
          </button>
        </p>
      </div>

      {sessions.length > 0 && (
        <div className="stat-tiles">
          <Stat label="Einheiten gesamt" value={String(sessions.length)} />
          <Stat label="Sätze 30 Tage" value={String(recentSets.length)} />
          {totalReps(recentSets) > 0 && <Stat label="Wdh 30 Tage" value={String(totalReps(recentSets))} />}
          {volume(recentSets) > 0 && <Stat label="Volumen 30 Tage" value={`${fmtNum(volume(recentSets))} kg`} />}
        </div>
      )}

      <section>
        <h2 className="field-label">Übungen</h2>
        <ul className="card-list">
          {exercises.map((ex) => {
            const s = data.sessionsByExercise.get(ex.id) ?? []
            const metric = primaryMetric(ex)
            const best = s.length ? Math.max(...s.map((x) => metric.value(x.sets))) : null
            return (
              <li key={ex.id}>
                <button className="list-card" onClick={() => onOpenExercise(ex.id)}>
                  <span className="list-card-top">
                    <strong>{ex.name}</strong>
                    {best !== null && (
                      <span className="muted">
                        {fmtNum(best)} {metric.unit}
                      </span>
                    )}
                  </span>
                  <span className="muted small">
                    {equipmentInfo(ex.equipment).label} ·{' '}
                    {s.length ? `${plural(s.length, 'Mal', 'Mal')} · zuletzt ${fmtRelative(s.at(-1)!.workout.startedAt)}` : 'noch nie gemacht'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {sessions.length > 0 && (
        <section>
          <h2 className="field-label">Letzte Einheiten</h2>
          <ul className="card-list">
            {[...sessions]
              .reverse()
              .slice(0, 15)
              .map((s) => (
                <li key={s.entry.id}>
                  <button className="list-card" onClick={() => onOpenWorkout(s.workout.id)}>
                    <span className="list-card-top">
                      <strong>{s.exercise.name}</strong>
                      <span className="muted">{fmtShortDay(s.workout.startedAt)}</span>
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
