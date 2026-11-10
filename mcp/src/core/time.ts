/**
 * Zeitangaben. Ausgegeben wird lokale Zeit mit Offset (z. B. 2026-11-03T18:05:00+01:00), so wie Garmin
 * "startTimeLocal" liefert. Maßgeblich ist die Zeitzone des Prozesses – auf einem Server TZ=Europe/Berlin setzen.
 */

const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')

export function localIso(ms: number): string {
  const d = new Date(ms)
  const offset = -d.getTimezoneOffset()
  const local = new Date(ms + offset * 60_000).toISOString().slice(0, 19)
  return `${local}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`
}

/** Lokales Datum YYYY-MM-DD */
export const localDate = (ms: number) => localIso(ms).slice(0, 10)

/** Wochentag, kurz und deutsch */
export const weekday = (ms: number) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(ms).getDay()]

/** "YYYY-MM-DD" → Beginn bzw. Ende dieses Tages (lokal) in ms; volle ISO-Zeitpunkte werden direkt übernommen. */
export function parseDay(value: string, end = false): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return end ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime()
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`Ungültiges Datum: ${value}`)
  return ms
}

export const DAY = 86_400_000

/** ISO-Woche (Montag–Sonntag), z. B. { week: '2026-W45', start: '2026-11-02' } */
export function isoWeek(ms: number): { week: string; start: string } {
  const d = new Date(ms)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  // Donnerstag derselben Woche bestimmt das Jahr der ISO-Woche
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3)
  const jan4 = new Date(thursday.getFullYear(), 0, 4)
  const firstMonday = new Date(jan4.getFullYear(), 0, 4 - ((jan4.getDay() + 6) % 7))
  const n = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * DAY)) + 1
  return { week: `${thursday.getFullYear()}-W${pad(n)}`, start: localDate(monday.getTime()) }
}

export const minutes = (ms: number) => Math.round(ms / 60_000)
