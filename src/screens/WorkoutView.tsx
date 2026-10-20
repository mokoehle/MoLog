import { useLiveQuery } from 'dexie-react-hooks'
import { WorkoutDetail } from '../components/WorkoutDetail'
import type { Id } from '../db/schema'
import { loadAll } from '../logic/stats'
import { deleteWorkout } from '../logic/workout'

interface Props {
  workoutId: Id
  /** Direkt nach dem Training: "Fertig"-Button statt Zurück/Löschen. */
  justFinished?: boolean
  onBack: () => void
  onOpenExercise: (id: Id) => void
}

export function WorkoutView({ workoutId, justFinished, onBack, onOpenExercise }: Props) {
  const data = useLiveQuery(loadAll)
  if (!data) return null

  const remove = async () => {
    if (!confirm('Dieses Training mit allen Sätzen löschen?')) return
    await deleteWorkout(workoutId)
    onBack()
  }

  return (
    <div className="screen">
      {justFinished ? (
        <p className="done-banner">Geschafft 💪</p>
      ) : (
        <header className="topbar">
          <button className="link-button" onClick={onBack}>
            ‹ Zurück
          </button>
          <span className="topbar-title">Training</span>
        </header>
      )}

      <WorkoutDetail data={data} workoutId={workoutId} onOpenExercise={onOpenExercise} />

      <div className="spacer" />
      {justFinished ? (
        <button className="button button-primary" onClick={onBack}>
          Fertig
        </button>
      ) : (
        <button className="link-button danger" onClick={remove}>
          Training löschen
        </button>
      )}
    </div>
  )
}
