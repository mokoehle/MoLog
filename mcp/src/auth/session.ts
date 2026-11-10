/**
 * Anmeldung wie in der App: per E-Mail-Code, mit dem eigenen Konto. Die Sitzung (Refresh-Token) liegt
 * lokal in ~/.config/molog-coach/session.json – nicht im Repo, nur für den eigenen Benutzer lesbar.
 * MOLOG_COACH_HOME setzt einen anderen Ordner (z. B. für ein zweites Konto).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../../src/sync/config.ts'

export const sessionDir = process.env.MOLOG_COACH_HOME ?? join(homedir(), '.config', 'molog-coach')
const sessionFile = join(sessionDir, 'session.json')

const read = (): Record<string, string> => {
  try {
    return JSON.parse(readFileSync(sessionFile, 'utf8'))
  } catch {
    return {}
  }
}

const write = (data: Record<string, string>) => {
  mkdirSync(sessionDir, { recursive: true, mode: 0o700 })
  writeFileSync(sessionFile, JSON.stringify(data), { mode: 0o600 })
  chmodSync(sessionFile, 0o600)
}

/** Speicher für supabase-js – hält die Sitzung aktuell, auch wenn der Refresh-Token rotiert. */
const fileStorage = {
  getItem: (key: string) => read()[key] ?? null,
  setItem: (key: string, value: string) => write({ ...read(), [key]: value }),
  removeItem: (key: string) => {
    const { [key]: _removed, ...rest } = read()
    write(rest)
  },
}

export function createUserClient(): SupabaseClient {
  const url = process.env.MOLOG_SUPABASE_URL ?? SUPABASE_URL
  const key = process.env.MOLOG_SUPABASE_KEY ?? SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase ist nicht konfiguriert (src/sync/config.ts).')
  return createClient(url, key, {
    auth: {
      storage: fileStorage,
      storageKey: 'molog-coach',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
}

export const NOT_LOGGED_IN = 'Nicht angemeldet. Im Ordner mcp/ einmal "npm run login" ausführen.'

/** Wirft eine verständliche Meldung, wenn keine gültige Sitzung da ist. */
export async function ensureUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error(NOT_LOGGED_IN)
  return data.user
}

export function clearSession() {
  if (existsSync(sessionFile)) rmSync(sessionFile)
}
