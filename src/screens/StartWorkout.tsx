import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Autocomplete } from '../components/Autocomplete'
import { db, requestPersistentStorage } from '../db/db'
import type { Location } from '../db/schema'
import { createLocation, createWorkoutType, recencyRank, startWorkout } from '../logic/workout'

interface Props {
  onCancel: () => void
  onStarted: () => void
}

/** Schritt 1: Ort wählen, Schritt 2: Trainingsart wählen → Training läuft. */
export function StartWorkout({ onCancel, onStarted }: Props) {
  const [location, setLocation] = useState<Location | null>(null)

  const data = useLiveQuery(async () => {
    const [locations, types, workouts] = await Promise.all([
      db.locations.toArray(),
      db.workoutTypes.toArray(),
      db.workouts.toArray(),
    ])
    const locUsed = new Map<string, number>()
    const typeUsed = new Map<string, number>()
    for (const w of workouts) {
      locUsed.set(w.locationId, Math.max(locUsed.get(w.locationId) ?? 0, w.startedAt))
      typeUsed.set(w.workoutTypeId, Math.max(typeUsed.get(w.workoutTypeId) ?? 0, w.startedAt))
    }
    return { locations, types, locUsed, typeUsed }
  })
  if (!data) return null

  const locRank = recencyRank(data.locUsed)
  const typeRank = recencyRank(data.typeUsed)

  const begin = async (workoutTypeId: string) => {
    await startWorkout(location!.id, workoutTypeId)
    void requestPersistentStorage()
    onStarted()
  }

  return (
    <div className="screen screen-fit">
      <header className="topbar">
        <button className="link-button" onClick={location ? () => setLocation(null) : onCancel}>
          ‹ Zurück
        </button>
        <span className="topbar-title">{location ? location.name : 'Neues Training'}</span>
      </header>

      {!location ? (
        <Autocomplete
          key="location"
          label="Wo trainierst du?"
          placeholder="z. B. Gym oder Park"
          items={data.locations}
          initialSuggestions={[...data.locations].sort((a, b) => locRank(a) - locRank(b))}
          rank={locRank}
          centered
          onSelect={setLocation}
          onCreate={async (name) => setLocation(await createLocation(name))}
        />
      ) : (
        <Autocomplete
          key="type"
          label="Was trainierst du?"
          placeholder="z. B. Push, Pull, Legs"
          items={data.types}
          initialSuggestions={[...data.types].sort((a, b) => typeRank(a) - typeRank(b))}
          rank={typeRank}
          centered
          onSelect={(t) => begin(t.id)}
          onCreate={async (name) => begin((await createWorkoutType(name)).id)}
        />
      )}
    </div>
  )
}
