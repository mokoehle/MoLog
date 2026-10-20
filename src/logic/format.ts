import type { WorkoutSet } from '../db/schema'

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const fmtNum = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 })

export function describeSet(s: WorkoutSet) {
  const amount = s.reps !== null ? `${s.reps}` : `${s.durationSec} s`
  return s.weightKg !== null ? `${fmtNum(s.weightKg)} kg × ${amount}` : amount
}

/** Für Satz-Chips: "80 kg × 8", "12 Wdh", "45 s" – Einheiten immer dabei, damit nichts verwechselt wird. */
export function shortSet(s: WorkoutSet) {
  if (s.weightKg !== null) return `${fmtNum(s.weightKg)} kg × ${s.reps ?? `${s.durationSec} s`}`
  return s.reps !== null ? `${s.reps} Wdh` : `${s.durationSec} s`
}

export function fmtDuration(ms: number) {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

export const fmtDay = (t: number) => dayFmt.format(t)
export const fmtShortDay = (t: number) => shortDayFmt.format(t)
export const fmtDate = (t: number) => dateFmt.format(t)
export const fmtMonth = (t: number) => monthFmt.format(t)
export const fmtTime = (t: number) => timeFmt.format(t)

/** "heute", "gestern", "vor 3 Tagen", sonst Datum */
export function fmtRelative(t: number) {
  const startOfDay = (x: number) => new Date(x).setHours(0, 0, 0, 0)
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 86400000)
  if (days === 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return fmtDate(t)
}
