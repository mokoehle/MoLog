import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Workout } from '../db/schema'
import { fmtDay, fmtTime, plural } from '../logic/format'
import { deleteWorkout, finishWorkout, lastActivity } from '../logic/workout'

interface Props {
  workout: Workout
  onContinue: () => void
  onFinished: (saved: boolean) => void
}

/** Nach einem Neustart der App mit offenem Training: fortsetzen, beenden oder verwerfen? */
export function ResumePrompt({ workout, onContinue, onFinished }: Props) {
  const info = useLiveQuery(async () => {
    const [type, location, sets, last] = await Promise.all([
      db.workoutTypes.get(workout.workoutTypeId),
      db.locations.get(workout.locationId),
      db.sets.where('workoutId').equals(workout.id).count(),
      lastActivity(workout.id),
    ])
    return { type, location, sets, last }
  }, [workout.id])
  if (!info) return null

  const discard = async () => {
    if (info.sets > 0 && !confirm(`Training mit ${info.sets} Sätzen wirklich verwerfen?`)) return
    await deleteWorkout(workout.id)
    onFinished(false)
  }

  return (
    <div className="screen resume">
      <div className="spacer" />
      <div className="resume-body">
        <p className="field-label">Training läuft noch</p>
        <h1 className="exercise-title">{info.type?.name}</h1>
        <p className="muted">
          {info.location?.name} · {fmtDay(workout.startedAt)}, {fmtTime(workout.startedAt)} Uhr
          <br />
          {plural(info.sets, 'Satz', 'Sätze')} · zuletzt aktiv um {fmtTime(info.last)} Uhr
        </p>
      </div>
      <div className="spacer" />
      <div className="actions">
        <button className="button button-primary" onClick={onContinue}>
          Fortsetzen
        </button>
        <button className="button button-secondary" onClick={async () => onFinished(await finishWorkout(workout.id, true))}>
          Beenden
        </button>
        <button className="link-button danger" onClick={discard}>
          Verwerfen
        </button>
      </div>
    </div>
  )
}
