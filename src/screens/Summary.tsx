import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { plural } from '../logic/format'
import { describeSet } from './ExerciseScreen'

interface Props {
  workoutId: string
  onClose: () => void
}

export function Summary({ workoutId, onClose }: Props) {
  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(workoutId)
    const entries = await db.entries.where('workoutId').equals(workoutId).sortBy('position')
    const items = await Promise.all(
      entries.map(async (e) => ({
        entry: e,
        exercise: await db.exercises.get(e.exerciseId),
        sets: await db.sets.where('entryId').equals(e.id).sortBy('position'),
      })),
    )
    return { workout, items }
  }, [workoutId])
  if (!data?.workout) return null

  const minutes = Math.round((data.workout.endedAt! - data.workout.startedAt) / 60000)

  return (
    <div className="screen">
      <h1 className="app-title">Geschafft 💪</h1>
      <p className="muted">
        {minutes} min · {plural(data.items.length, 'Übung', 'Übungen')} ·{' '}
        {plural(data.items.reduce((n, i) => n + i.sets.length, 0), 'Satz', 'Sätze')}
      </p>
      <ul className="summary">
        {data.items.map(({ entry, exercise, sets }) => (
          <li key={entry.id}>
            <strong>{exercise?.name}</strong>
            <span className="muted">
              {entry.endedAt ? `${Math.max(1, Math.round((entry.endedAt - entry.startedAt) / 60000))} min · ` : ''}
              {sets.map(describeSet).join(', ')}
            </span>
          </li>
        ))}
      </ul>
      <div className="spacer" />
      <button className="button button-primary" onClick={onClose}>
        Fertig
      </button>
    </div>
  )
}
