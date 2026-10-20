import { db } from '../db/db'
import { SCHEMA_VERSION, type ExportFile } from '../db/schema'

export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'molog',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: {
      locations: await db.locations.toArray(),
      workoutTypes: await db.workoutTypes.toArray(),
      exercises: await db.exercises.toArray(),
      workouts: await db.workouts.toArray(),
      entries: await db.entries.toArray(),
      sets: await db.sets.toArray(),
    },
  }
}

/** Speichert den Export als Datei, auf dem iPhone über das Teilen-Menü (z. B. „In Dateien sichern“). */
export async function downloadExport() {
  const data = await exportAll()
  const date = new Date().toISOString().slice(0, 10)
  const file = new File([JSON.stringify(data, null, 2)], `molog-export-${date}.json`, {
    type: 'application/json',
  })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ersetzt alle vorhandenen Daten durch den Inhalt der Datei. */
export async function importAll(text: string) {
  const file = JSON.parse(text) as ExportFile
  if (file.app !== 'molog' || !file.data) throw new Error('Keine MoLog-Exportdatei')
  if (file.schemaVersion > SCHEMA_VERSION) throw new Error('Datei stammt aus einer neueren App-Version')
  const d = file.data
  await db.transaction('rw', [db.locations, db.workoutTypes, db.exercises, db.workouts, db.entries, db.sets], async () => {
    await Promise.all([
      db.locations.clear(),
      db.workoutTypes.clear(),
      db.exercises.clear(),
      db.workouts.clear(),
      db.entries.clear(),
      db.sets.clear(),
    ])
    await db.locations.bulkAdd(d.locations)
    await db.workoutTypes.bulkAdd(d.workoutTypes)
    await db.exercises.bulkAdd(d.exercises)
    await db.workouts.bulkAdd(d.workouts)
    await db.entries.bulkAdd(d.entries)
    await db.sets.bulkAdd(d.sets)
  })
}
