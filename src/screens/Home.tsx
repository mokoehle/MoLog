import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { plural } from '../logic/format'

interface Props {
  onStart: () => void
  onSettings: () => void
}

const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

export function Home({ onStart, onSettings }: Props) {
  const recent = useLiveQuery(async () => {
    const workouts = (await db.workouts.orderBy('startedAt').reverse().limit(10).toArray()).filter((w) => w.endedAt)
    return Promise.all(
      workouts.map(async (w) => ({
        workout: w,
        type: await db.workoutTypes.get(w.workoutTypeId),
        location: await db.locations.get(w.locationId),
        exercises: await db.entries.where('workoutId').equals(w.id).count(),
        sets: await db.sets.where('workoutId').equals(w.id).count(),
      })),
    )
  })

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

      <section className="recent">
        <h2 className="field-label">Letzte Trainings</h2>
        {recent?.length === 0 && <p className="muted">Noch keine Trainings.</p>}
        <ul>
          {recent?.map(({ workout, type, location, exercises, sets }) => (
            <li key={workout.id} className="recent-item">
              <span>
                <strong>{type?.name}</strong> · {location?.name}
              </span>
              <span className="muted">
                {dateFmt.format(workout.startedAt)} · {plural(exercises, 'Übung', 'Übungen')} · {plural(sets, 'Satz', 'Sätze')} ·{' '}
                {Math.round((workout.endedAt! - workout.startedAt) / 60000)} min
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
