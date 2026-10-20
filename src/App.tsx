import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from './db/db'
import type { Id } from './db/schema'
import { useEdgeSwipeBack } from './hooks/useEdgeSwipeBack'
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
 * Navigation über einen einfachen Stack. Unterste Ebene ist der Startscreen – oder, wenn ein
 * Training läuft, das Training selbst (offene Übung → Übung, sonst Übung wählen). Darüber lassen
 * sich Verlauf & Details öffnen, ohne das Training zu unterbrechen. Weil sich das laufende Training
 * aus den gespeicherten Daten ergibt, landet man nach einem Neustart automatisch wieder richtig.
 */
export function App() {
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const view = stack.at(-1)!
  const push = (v: View) => setStack((s) => [...s, v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const reset = (...views: View[]) => setStack([{ name: 'home' }, ...views])

  // Neue Ansicht → nach oben scrollen
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const live = useLiveQuery(async () => {
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

  // Vom linken Rand wischen = zurück (nicht im Training selbst, dort liegen die Slider)
  const canGoBack = stack.length > 1 && view.name !== 'start' && !(view.name === 'workout' && view.justFinished)
  useEdgeSwipeBack(canGoBack, back)

  if (!live) return null

  const openExercise = (id: Id) => push({ name: 'exercise', id })
  const openWorkout = (id: Id) => push({ name: 'workout', id })
  const openHistory = () => push({ name: 'history' })

  const overlay = (): ReactNode => {
    switch (view.name) {
      case 'start':
        return <StartWorkout onCancel={back} onStarted={() => reset()} />
      case 'settings':
        return <Settings onClose={back} />
      case 'history':
        return <History onBack={back} onOpenWorkout={openWorkout} onOpenExercise={openExercise} />
      case 'workout':
        return (
          <WorkoutView
            key={view.id}
            workoutId={view.id}
            justFinished={view.justFinished}
            onBack={view.justFinished ? () => reset() : back}
            onOpenExercise={openExercise}
          />
        )
      case 'exercise':
        return (
          <ExerciseDetail
            key={view.id}
            exerciseId={view.id}
            onBack={back}
            onOpenWorkout={openWorkout}
            onOpenExercise={openExercise}
          />
        )
      default:
        return null
    }
  }

  if (live.workout) {
    const id = live.workout.id
    const nav = {
      onOpenExercise: openExercise,
      onOpenHistory: openHistory,
      onFinished: (saved: boolean) => (saved ? reset({ name: 'workout', id, justFinished: true }) : reset()),
    }
    // Verlauf o. Ä. über dem laufenden Training
    if (view.name !== 'home' && view.name !== 'start') {
      return (
        <div className="with-banner">
          {overlay()}
          <button className="live-banner" onClick={() => reset()}>
            <span className="live-dot" /> Training läuft · Zurück zur Übung
          </button>
        </div>
      )
    }
    if (live.entry) return <ExerciseScreen key={live.entry.id} workout={live.workout} entry={live.entry} {...nav} />
    return <ExercisePicker workout={live.workout} {...nav} />
  }

  return (
    overlay() ?? (
      <Home
        onStart={() => push({ name: 'start' })}
        onSettings={() => push({ name: 'settings' })}
        onHistory={openHistory}
        onOpenWorkout={openWorkout}
      />
    )
  )
}
