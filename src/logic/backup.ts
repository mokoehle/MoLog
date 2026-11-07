import { db, deleteRows, SYNCED_TABLES, type SyncedTable } from '../db/db'
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
  const incoming: Record<SyncedTable, { id: string }[]> = {
    locations: d.locations,
    workoutTypes: d.workoutTypes,
    exerciseGroups: d.exerciseGroups ?? [],
    exercises: d.exercises,
    workouts: d.workouts,
    entries: d.entries,
    sets: d.sets,
  }
  const tables = SYNCED_TABLES.map((name) => db.table(name))
  await db.transaction('rw', [...tables, db.tombstones], async () => {
    for (const name of SYNCED_TABLES) {
      const table = db.table(name)
      const keep = new Set(incoming[name].map((r) => r.id))
      // Zeilen, die es nach dem Import nicht mehr gibt, als gelöscht melden (sonst kämen sie per Sync zurück)
      const removed = ((await table.toCollection().primaryKeys()) as string[]).filter((id) => !keep.has(id))
      await deleteRows(table, removed)
      await table.clear()
      // ohne updatedAt einfügen → wird als neue Änderung markiert und hochgeladen
      await table.bulkAdd(incoming[name].map(({ updatedAt: _u, ...row }: { updatedAt?: number; id: string }) => row))
    }
  })
}

