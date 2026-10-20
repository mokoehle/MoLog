import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db/db'
import type { Id } from './db/schema'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { ExercisePicker } from './screens/ExercisePicker'
import { ExerciseScreen } from './screens/ExerciseScreen'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { StartWorkout } from './screens/StartWorkout'
import { WorkoutView } from './screens/WorkoutView'

type View =
  | { name: 'home' }
  | { name: 'start' }
  | { name: 'settings' }
  | { name: 'history' }
  | { name: 'workout'; id: Id; justFinished?: boolean }
  | { name: 'exercise'; id: Id }

/**
 * Läuft ein Training, ergibt sich der Bildschirm aus den gespeicherten Daten
 * (offene Übung → Übung, sonst Übung wählen) – so landet man nach einem Neustart wieder richtig.
 * Außerhalb eines Trainings navigiert ein einfacher Verlauf-Stack zwischen den Ansichten.
 */
export function App() {
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const view = stack.at(-1)!
  const push = (v: View) => setStack((s) => [...s, v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const home = () => setStack([{ name: 'home' }])

  // Neue Ansicht → nach oben scrollen
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const state = useLiveQuery(async () => {
    const workout = await db.workouts
      .orderBy('startedAt')
      .reverse()
      .filter((w) => !w.endedAt)
      .first()
    if (!workout) return { workout: null, entry: null }
    const entry = await db.entries
      .where('workoutId')
      .equals(workout.id)
      .filter((e) => !e.endedAt)
      .first()
    return { workout, entry: entry ?? null }
  })

  if (!state) return null

  if (state.workout && state.entry) return <ExerciseScreen workout={state.workout} entry={state.entry} />
  if (state.workout) {
    const id = state.workout.id
    return (
      <ExercisePicker
        workout={state.workout}
        onFinished={(saved) => setStack(saved ? [{ name: 'home' }, { name: 'workout', id, justFinished: true }] : [{ name: 'home' }])}
      />
    )
  }

  switch (view.name) {
    case 'start':
      return <StartWorkout onCancel={back} onStarted={home} />
    case 'settings':
      return <Settings onClose={back} />
    case 'history':
      return (
        <History
          onBack={back}
          onOpenWorkout={(id) => push({ name: 'workout', id })}
          onOpenExercise={(id) => push({ name: 'exercise', id })}
        />
      )
    case 'workout':
      return (
        <WorkoutView
          key={view.id}
          workoutId={view.id}
          justFinished={view.justFinished}
          onBack={view.justFinished ? home : back}
          onOpenExercise={(id) => push({ name: 'exercise', id })}
        />
      )
    case 'exercise':
      return (
        <ExerciseDetail
          key={view.id}
          exerciseId={view.id}
          onBack={back}
          onOpenWorkout={(id) => push({ name: 'workout', id })}
          onOpenExercise={(id) => push({ name: 'exercise', id })}
        />
      )
    default:
      return (
        <Home
          onStart={() => push({ name: 'start' })}
          onSettings={() => push({ name: 'settings' })}
          onHistory={() => push({ name: 'history' })}
          onOpenWorkout={(id) => push({ name: 'workout', id })}
        />
      )
  }
}
