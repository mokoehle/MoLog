import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from './db/db'
import { Home } from './screens/Home'
import { StartWorkout } from './screens/StartWorkout'
import { ExercisePicker } from './screens/ExercisePicker'
import { ExerciseScreen } from './screens/ExerciseScreen'
import { Summary } from './screens/Summary'
import { Settings } from './screens/Settings'

/**
 * Der Bildschirm ergibt sich aus den gespeicherten Daten:
 * laufendes Training + offene Übung → Übung, laufendes Training ohne offene Übung → Übung wählen.
 * So landet man nach einem App-Neustart automatisch wieder an der richtigen Stelle.
 */
export function App() {
  const [starting, setStarting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [summaryId, setSummaryId] = useState<string | null>(null)

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
  if (state.workout)
    return (
      <ExercisePicker
        workout={state.workout}
        onFinished={(saved) => setSummaryId(saved ? state.workout!.id : null)}
      />
    )
  if (summaryId) return <Summary workoutId={summaryId} onClose={() => setSummaryId(null)} />
  if (starting) return <StartWorkout onCancel={() => setStarting(false)} onStarted={() => setStarting(false)} />
  if (settingsOpen) return <Settings onClose={() => setSettingsOpen(false)} />
  return <Home onStart={() => setStarting(true)} onSettings={() => setSettingsOpen(true)} />
}
