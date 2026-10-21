import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Autocomplete } from '../components/Autocomplete'
import { Sheet } from '../components/Sheet'
import { db } from '../db/db'
import type { Exercise, Workout } from '../db/schema'
import {
  createExercise,
  deleteWorkout,
  finishWorkout,
  recencyRank,
  reopenLastEntry,
  startExercise,
  suggestedExerciseIds,
} from '../logic/workout'
import { ExerciseForm } from './ExerciseForm'
import { WorkoutMenuRows, type WorkoutNav } from './ExerciseScreen'

interface Props extends WorkoutNav {
  workout: Workout
}

export function ExercisePicker({ workout, onFinished, onOpenHistory }: Props) {
  const [newName, setNewName] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  const data = useLiveQuery(async () => {
    const [exercises, groups, entries, type, location, suggestedIds, setCount] = await Promise.all([
      db.exercises.toArray(),
      db.exerciseGroups.toArray(),
      db.entries.toArray(),
      db.workoutTypes.get(workout.workoutTypeId),
      db.locations.get(workout.locationId),
      suggestedExerciseIds(workout.workoutTypeId, workout.id),
      db.sets.where('workoutId').equals(workout.id).count(),
    ])
    const lastUsed = new Map<string, number>()
    for (const e of entries) lastUsed.set(e.exerciseId, Math.max(lastUsed.get(e.exerciseId) ?? 0, e.startedAt))
    const here = entries.filter((e) => e.workoutId === workout.id).sort((a, b) => a.position - b.position)
    const lastHere = here.at(-1)
    const lastName = lastHere && exercises.find((e) => e.id === lastHere.exerciseId)?.name
    return { exercises, groups: new Map(groups.map((g) => [g.id, g.name])), lastUsed, type, location, suggestedIds, doneHere: here.length, lastName, setCount }
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
    setMenu(false)
    onFinished(await finishWorkout(workout.id))
  }

  const discard = async () => {
    if (data.setCount > 0 && !confirm(`Training mit ${data.setCount} Sätzen wirklich verwerfen?`)) return
    setMenu(false)
    await deleteWorkout(workout.id)
    onFinished(false)
  }

  if (newName !== null) {
    return (
      <ExerciseForm
        initialName={newName}
        submitLabel="Anlegen & starten"
        onCancel={() => setNewName(null)}
        onSubmit={async (input) => {
          setNewName(null)
          await choose(await createExercise(input))
        }}
      />
    )
  }

  return (
    <div className="screen screen-fit">
      <header className="topbar topbar-split">
        {data.doneHere > 0 ? (
          <button className="link-button" onClick={() => reopenLastEntry(workout.id)}>
            ‹ {data.lastName ?? 'Letzte Übung'}
          </button>
        ) : (
          <button className="link-button" onClick={discard}>
            ‹ Abbrechen
          </button>
        )}
        <button className="icon-button" onClick={() => setMenu(true)} aria-label="Menü">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>
      <p className="topbar-title">
        {data.type?.name} · {data.location?.name}
      </p>

      <Autocomplete
        label={data.doneHere === 0 ? 'Erste Übung' : `Übung ${data.doneHere + 1}`}
        placeholder="Übung suchen oder neu anlegen"
        items={data.exercises}
        initialSuggestions={initial}
        rank={rank}
        hint={(e) => (e.groupId ? data.groups.get(e.groupId) : undefined)}
        extraText={(e) => (e.groupId ? data.groups.get(e.groupId) : undefined)}
        onSelect={choose}
        onCreate={setNewName}
        centered
      />

      <button className="button button-secondary hide-with-keyboard" onClick={finish}>
        Training beenden
      </button>

      {menu && (
        <Sheet title="Menü" onClose={() => setMenu(false)}>
          <WorkoutMenuRows onHistory={onOpenHistory} onEnd={finish} onCancel={discard} />
        </Sheet>
      )}
    </div>
  )
}
