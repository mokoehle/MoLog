/**
 * MCP-Server mit allen Tools – unabhängig vom Transport. stdio (lokal) und später HTTP (Server)
 * erzeugen ihn nur mit einer anderen Datenquelle, z. B. je angemeldetem Benutzer.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  buildIndex,
  exerciseCatalog,
  exerciseProgress,
  findExercises,
  workoutDetail,
  workoutNear,
  workoutsBetween,
  workoutSummary,
  weeklyVolume,
} from './analysis.ts'
import type { DatasetSource } from './model.ts'
import { DAY, parseDay } from './time.ts'

const INSTRUCTIONS = `Krafttrainingsdaten aus der Gym-Tracker-App (MoLog) des angemeldeten Benutzers.
- Zeiten sind lokale Zeit mit Offset, wie Garmins startTimeLocal. Ein MoLog-Training gehört zu der Garmin-Krafttrainings-Aktivität, die zur selben Zeit begonnen hat (meist ±15 min); getStrengthWorkout mit "at" findet es direkt.
- Gewichte: Kurzhantel = Gewicht EINER Hantel, Langhantel = Gesamtgewicht, Maschine/Kabel = angezeigter Wert, Körpergewicht = nur Zusatzgewicht. Tonnage = Summe kg × Wdh.
- e1rmKg = geschätztes 1RM nach Epley, nur für Sätze mit 1–12 Wdh.
- region (legs/push/pull/core/other) wird aus dem Übungsnamen geschätzt – die App speichert keine Muskelgruppen. Auch RPE, RIR und Notizen werden nicht erfasst.
- legs.load: none / light (1–5 Beinsätze) / heavy (ab 6 Beinsätzen).`

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true })

const range = {
  from: z.string().optional().describe('Beginn, YYYY-MM-DD oder ISO-Zeitpunkt. Standard: vor 28 Tagen'),
  to: z.string().optional().describe('Ende (inklusive), YYYY-MM-DD oder ISO-Zeitpunkt. Standard: jetzt'),
}
const parseRange = (from?: string, to?: string, defaultDays = 28) => {
  const end = to ? parseDay(to, true) : Date.now()
  return { from: from ? parseDay(from) : end - defaultDays * DAY, to: end }
}

/** Fehler als Tool-Fehler zurückgeben statt den Server abstürzen zu lassen */
const safe =
  <A>(fn: (args: A) => Promise<unknown>) =>
  async (args: A) => {
    try {
      return json(await fn(args))
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  }

export function createServer(load: DatasetSource) {
  const server = new McpServer({ name: 'molog-coach', version: '0.1.0' }, { instructions: INSTRUCTIONS })
  const index = async () => buildIndex(await load())
  const readOnly = { readOnlyHint: true, openWorldHint: false }

  server.registerTool(
    'listStrengthWorkouts',
    {
      title: 'Krafttrainings auflisten',
      description:
        'Abgeschlossene Krafttrainings im Zeitraum, älteste zuerst: Start/Ende, Dauer, Trainingsart, Übungen mit allen Sätzen, Top-Satz und e1RM, Summen sowie Beinbelastung (legs.load). Gut, um Krafttage neben Läufe und Erholungsdaten zu legen.',
      inputSchema: range,
      annotations: readOnly,
    },
    safe(async ({ from, to }) => {
      const ix = await index()
      const r = parseRange(from, to)
      return workoutsBetween(ix, r.from, r.to).map((w) => workoutSummary(ix, w))
    }),
  )

  server.registerTool(
    'getStrengthWorkout',
    {
      title: 'Krafttraining im Detail',
      description:
        'Ein Training mit jedem Satz inklusive Uhrzeit, Pause davor (restSec) und e1RM. Entweder per id oder per Zeitpunkt "at" – dann wird das Training gefunden, das am nächsten an diesem Zeitpunkt liegt (z. B. Startzeit einer Garmin-Aktivität).',
      inputSchema: {
        id: z.string().optional().describe('id aus listStrengthWorkouts'),
        at: z.string().optional().describe('ISO-Zeitpunkt, z. B. startTimeLocal einer Garmin-Aktivität'),
        toleranceMin: z.number().optional().describe('maximaler Abstand für "at" in Minuten, Standard 90'),
      },
      annotations: readOnly,
    },
    safe(async ({ id, at, toleranceMin }) => {
      const ix = await index()
      if (id) {
        const w = ix.workoutById.get(id)
        if (!w) throw new Error(`Kein abgeschlossenes Training mit id ${id}`)
        return workoutDetail(ix, w)
      }
      if (!at) throw new Error('Bitte "id" oder "at" angeben.')
      const match = workoutNear(ix, parseDay(at), toleranceMin ?? 90)
      if (!match) return { match: null, hint: 'Kein MoLog-Training in der Nähe dieses Zeitpunkts.' }
      return { matchOffsetMin: match.offsetMin, ...workoutDetail(ix, match.workout) }
    }),
  )

  server.registerTool(
    'getExerciseProgress',
    {
      title: 'Fortschritt einer Übung',
      description:
        'Verlauf einer Übung (oder aller Übungen einer Gruppe, z. B. "Rudern") je Einheit: Top-Satz, e1RM, Wdh, Tonnage, alle Sätze sowie e1RM-Trend und Bestwert. Name darf ungenau sein.',
      inputSchema: {
        exercise: z.string().describe('Name der Übung oder Gruppe, z. B. "Kniebeuge"'),
        ...range,
      },
      annotations: readOnly,
    },
    safe(async ({ exercise, from, to }) => {
      const ix = await index()
      const matches = findExercises(ix, exercise)
      if (!matches.length) throw new Error(`Keine Übung gefunden für "${exercise}". listExercises zeigt alle Namen.`)
      const r = parseRange(from, to, 365)
      return matches.map((ex) => exerciseProgress(ix, ex, r.from, r.to))
    }),
  )

  server.registerTool(
    'getWeeklyStrengthVolume',
    {
      title: 'Wochenvolumen',
      description:
        'Volumen je ISO-Woche: Anzahl Trainings und je Region (Standard), Übung oder Gruppe die Sätze, Wdh und Tonnage. Arbeitssätze pro Woche sind das übliche Maß für Volumen pro Muskelgruppe.',
      inputSchema: {
        ...range,
        by: z.enum(['region', 'exercise', 'group']).optional().describe('Gruppierung, Standard "region"'),
      },
      annotations: readOnly,
    },
    safe(async ({ from, to, by }) => {
      const ix = await index()
      const r = parseRange(from, to, 56)
      return weeklyVolume(ix, r.from, r.to, by ?? 'region')
    }),
  )

  server.registerTool(
    'listExercises',
    {
      title: 'Alle Übungen',
      description: 'Alle Übungen mit Gruppe, geschätzter Region, Gerät, Anzahl Einheiten und letztem Datum.',
      inputSchema: {},
      annotations: readOnly,
    },
    safe(async () => exerciseCatalog(await index())),
  )

  return server
}
