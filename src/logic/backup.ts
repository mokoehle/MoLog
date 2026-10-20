import { db } from '../db/db'
import { SCHEMA_VERSION, type ExportFile } from '../db/schema'
import { localDate, toCsv } from './csv'

export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'molog',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: {
      locations: await db.locations.toArray(),
      workoutTypes: await db.workoutTypes.toArray(),
      exerciseGroups: await db.exerciseGroups.toArray(),
      exercises: await db.exercises.toArray(),
      workouts: await db.workouts.toArray(),
      entries: await db.entries.toArray(),
      sets: await db.sets.toArray(),
    },
  }
}

/** Gibt eine Datei weiter: auf dem iPhone über das Teilen-Menü (z. B. „In Dateien sichern“), sonst als Download. */
export async function shareFile(file: File) {
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

const today = () => localDate(Date.now())

export async function downloadExport() {
  const data = await exportAll()
  await shareFile(new File([JSON.stringify(data, null, 2)], `molog-export-${today()}.json`, { type: 'application/json' }))
}

export async function downloadCsv() {
  const csv = toCsv(await exportAll())
  // BOM, damit Excel die Umlaute korrekt erkennt
  await shareFile(new File(['\uFEFF' + csv], `molog-saetze-${today()}.csv`, { type: 'text/csv' }))
}

/** Ersetzt alle vorhandenen Daten durch den Inhalt der Datei. */
export async function importAll(text: string) {
  const file = JSON.parse(text) as ExportFile
  if (file.app !== 'molog' || !file.data) throw new Error('Keine MoLog-Exportdatei')
  if (file.schemaVersion !== SCHEMA_VERSION) throw new Error(`Datei hat Version ${file.schemaVersion}, die App erwartet ${SCHEMA_VERSION}`)
  const d = file.data
  await db.transaction('rw', [db.locations, db.workoutTypes, db.exerciseGroups, db.exercises, db.workouts, db.entries, db.sets], async () => {
    await Promise.all([
      db.locations.clear(),
      db.workoutTypes.clear(),
      db.exerciseGroups.clear(),
      db.exercises.clear(),
      db.workouts.clear(),
      db.entries.clear(),
      db.sets.clear(),
    ])
    await db.locations.bulkAdd(d.locations)
    await db.workoutTypes.bulkAdd(d.workoutTypes)
    await db.exerciseGroups.bulkAdd(d.exerciseGroups ?? [])
    await db.exercises.bulkAdd(d.exercises)
    await db.workouts.bulkAdd(d.workouts)
    await db.entries.bulkAdd(d.entries)
    await db.sets.bulkAdd(d.sets)
  })
}
