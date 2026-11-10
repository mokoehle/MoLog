/**
 * npm run demo – ruft alle Tools über einen echten MCP-Client mit den Beispieldaten auf und zeigt die Antworten.
 * Ohne Anmeldung und ohne Netz. Eignet sich auch als schneller Test nach Änderungen.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../core/server.ts'
import { fixture } from './fixture.ts'

const server = createServer(async () => fixture)
const client = new Client({ name: 'demo', version: '0' })
const [a, b] = InMemoryTransport.createLinkedPair()
await Promise.all([server.connect(a), client.connect(b)])

const calls: [string, Record<string, unknown>][] = [
  ['listExercises', {}],
  ['listStrengthWorkouts', { from: '2026-10-29', to: '2026-11-01' }],
  ['getStrengthWorkout', { at: '2026-11-05T17:52:00+01:00' }],
  ['getExerciseProgress', { exercise: 'kniebeuge', from: '2026-10-01', to: '2026-11-30' }],
  ['getWeeklyStrengthVolume', { from: '2026-10-19', to: '2026-11-08' }],
]

const only = process.argv[2]
for (const [name, args] of calls) {
  if (only && name !== only) continue
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as { type: string; text: string }[])[0].text
  console.log(`\n### ${name} ${JSON.stringify(args)}\n`)
  console.log(result.isError ? `FEHLER: ${text}` : JSON.stringify(JSON.parse(text), null, 2))
}
await client.close()
