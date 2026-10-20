import type { ExportFile } from '../db/schema'
import { equipmentInfo } from './equipment'

/**
 * CSV mit einer Zeile pro Satz – flach und selbsterklärend, z. B. zum Auswerten mit einer KI
 * oder in Excel/Numbers. Dezimalpunkt statt -komma, damit Zahlen eindeutig sind.
 */

const COLUMNS = [
  'datum',
  'ort',
  'trainingsart',
  'training_nr',
  'uebung_nr',
  'uebung',
  'gruppe',
  'geraet',
  'uebung_start',
  'uebung_ende',
  'uebung_dauer_min',
  'satz_nr',
  'gewicht_kg',
  'wiederholungen',
  'sekunden',
] as const

const pad = (n: number) => String(n).padStart(2, '0')
export const localDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const localTime = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function cell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv({ data }: ExportFile): string {
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))
  const locations = byId(data.locations)
  const types = byId(data.workoutTypes)
  const exercises = byId(data.exercises)
  const groups = byId(data.exerciseGroups ?? [])
  const entries = byId(data.entries)

  const workouts = [...data.workouts].sort((a, b) => a.startedAt - b.startedAt)
  const workoutNr = new Map(workouts.map((w, i) => [w.id, i + 1]))
  const workoutById = byId(workouts)

  // Sortiert nach Training, Übung, Satz. Zeiten gibt es bewusst nur pro Übung (Start/Ende),
  // weil Sätze oft gesammelt nach der Übung eingetragen werden.
  const sets = [...data.sets]
    .filter((s) => workoutById.has(s.workoutId) && entries.has(s.entryId))
    .sort(
      (a, b) =>
        workoutById.get(a.workoutId)!.startedAt - workoutById.get(b.workoutId)!.startedAt ||
        entries.get(a.entryId)!.position - entries.get(b.entryId)!.position ||
        a.position - b.position,
    )

  const lines = [COLUMNS.join(',')]
  for (const s of sets) {
    const w = workoutById.get(s.workoutId)!
    const entry = entries.get(s.entryId)!
    const ex = exercises.get(s.exerciseId)
    const row = [
      localDate(w.startedAt),
      locations.get(w.locationId)?.name,
      types.get(w.workoutTypeId)?.name,
      workoutNr.get(w.id),
      entry.position + 1,
      ex?.name,
      ex?.groupId ? groups.get(ex.groupId)?.name : null,
      ex ? equipmentInfo(ex.equipment).label : null,
      localTime(entry.startedAt),
      entry.endedAt ? localTime(entry.endedAt) : null,
      entry.endedAt ? Math.round((entry.endedAt - entry.startedAt) / 6000) / 10 : null,
      s.position + 1,
      s.weightKg,
      s.reps,
      s.durationSec,
    ]
    lines.push(row.map(cell).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}
