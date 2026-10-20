import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Autocomplete } from '../components/Autocomplete'
import { db } from '../db/db'
import type { Exercise, Workout } from '../db/schema'
import { finishWorkout, recencyRank, startExercise, suggestedExerciseIds } from '../logic/workout'
import { NewExercise } from './NewExercise'

interface Props {
  workout: Workout
  onFinished: (saved: boolean) => void
}

export function ExercisePicker({ workout, onFinished }: Props) {
  const [newName, setNewName] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const [exercises, entries, type, location, suggestedIds] = await Promise.all([
      db.exercises.toArray(),
      db.entries.toArray(),
      db.workoutTypes.get(workout.workoutTypeId),
      db.locations.get(workout.locationId),
      suggestedExerciseIds(workout.workoutTypeId, workout.id),
    ])
    const lastUsed = new Map<string, number>()
    for (const e of entries) lastUsed.set(e.exerciseId, Math.max(lastUsed.get(e.exerciseId) ?? 0, e.startedAt))
    const doneHere = entries.filter((e) => e.workoutId === workout.id).length
    return { exercises, lastUsed, type, location, suggestedIds, doneHere }
  }, [workout.id])
  if (!data) return null

  const byId = new Map(data.exercises.map((e) => [e.id, e]))
  const rank = recencyRank(data.lastUsed)
  const suggested = data.suggestedIds.map((id) => byId.get(id)).filter((e): e is Exercise => !!e)
  // Leeres Feld: erst die Übungen vom letzten Training dieser Art, dann zuletzt genutzte.
  const initial = [
    ...suggested,
    ...[...data.exercises].filter((e) => !suggested.includes(e)).sort((a, b) => rank(a) - rank(b)),
  ]

  const choose = (exercise: Exercise) => startExercise(workout.id, exercise.id)

  const finish = async () => {
    const saved = await finishWorkout(workout.id)
    onFinished(saved)
  }

  if (newName !== null) {
    return (
      <NewExercise
        name={newName}
        exercises={data.exercises}
        onCancel={() => setNewName(null)}
        onCreated={(ex) => {
          setNewName(null)
          void choose(ex)
        }}
      />
    )
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="topbar-title">
          {data.type?.name} · {data.location?.name}
        </span>
      </header>

      <Autocomplete
        label={data.doneHere === 0 ? 'Erste Übung' : `Übung ${data.doneHere + 1}`}
        placeholder="Übung suchen oder neu anlegen"
        items={data.exercises}
        initialSuggestions={initial}
        rank={rank}
        hint={(e) => (e.parentId ? byId.get(e.parentId)?.name : undefined)}
        onSelect={choose}
        onCreate={setNewName}
      />

      <div className="spacer" />
      <button className="button button-secondary" onClick={finish}>
        Training beenden
      </button>
    </div>
  )
}
