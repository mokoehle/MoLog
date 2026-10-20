import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Stat } from '../components/WorkoutDetail'
import type { Id } from '../db/schema'
import { fmtDuration, fmtRelative, plural } from '../logic/format'
import { loadAll, workoutTotals } from '../logic/stats'
import { applyUpdateIfIdle } from '../pwa'

interface Props {
  onStart: () => void
  onSettings: () => void
  onHistory: () => void
  onOpenWorkout: (id: Id) => void
}

const RECENT = 3

const WEEK = 7 * 86400000

export function Home({ onStart, onSettings, onHistory, onOpenWorkout }: Props) {
  // Startscreen = kein Training läuft → guter Moment für ein wartendes Update
  useEffect(() => {
    void applyUpdateIfIdle()
  }, [])

  const data = useLiveQuery(loadAll)
  if (!data) return null

  const week = data.workouts.filter((w) => w.startedAt >= Date.now() - WEEK)
  const weekSets = week.reduce((n, w) => n + workoutTotals(data, w.id).sets, 0)

  return (
    <div className="screen">
      <header className="home-header">
        <h1 className="app-title">MoLog</h1>
        <button className="icon-button" onClick={onSettings} aria-label="Einstellungen">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <button className="button button-primary button-huge" onClick={onStart}>
        Training starten
      </button>

      {data.workouts.length > 0 && (
        <>
          <h2 className="field-label">Letzte 7 Tage</h2>
          <div className="stat-tiles">
            <Stat label="Trainings" value={String(week.length)} />
            <Stat label="Sätze" value={String(weekSets)} />
          </div>
        </>
      )}

      <section>
        <h2 className="field-label">Letzte Trainings</h2>
        {data.workouts.length === 0 && <p className="muted">Noch keine Trainings.</p>}
        <ul className="card-list">
          {data.workouts.slice(0, RECENT).map((w) => {
            const totals = workoutTotals(data, w.id)
            return (
              <li key={w.id}>
                <button className="list-card" onClick={() => onOpenWorkout(w.id)}>
                  <span className="list-card-top">
                    <strong>{data.types.get(w.workoutTypeId)?.name}</strong>
                    <span className="muted">{fmtRelative(w.startedAt)}</span>
                  </span>
                  <span className="muted small">
                    {data.locations.get(w.locationId)?.name} · {plural(totals.exercises, 'Übung', 'Übungen')} ·{' '}
                    {plural(totals.sets, 'Satz', 'Sätze')} · {fmtDuration(w.endedAt! - w.startedAt)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {data.workouts.length > 0 && (
          <button className="button button-secondary history-button" onClick={onHistory}>
            Verlauf & Übungen ansehen
          </button>
        )}
      </section>
    </div>
  )
}
