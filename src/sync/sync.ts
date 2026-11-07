import { createClient, type Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db, markRemote, onLocalChange, SYNCED_TABLES, type SyncedTable } from '../db/db'
import { cloudConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { TABLES, toLocal, toRemote } from './mapping'

/**
 * Cloud-Sync mit Supabase. Die App bleibt offline-first: Alles wird zuerst lokal gespeichert,
 * der Sync gleicht im Hintergrund ab, sobald man angemeldet ist und Netz hat.
 *
 * Ablauf eines Abgleichs:
 *  1. Herunterladen: alles, was seit dem letzten Abgleich beim Server angekommen ist (synced_at).
 *     Lokal neuere Änderungen bleiben dabei erhalten (die jüngere Änderung gewinnt).
 *  2. Hochladen: alle lokal geänderten Zeilen (updatedAt) und Löschungen (Tombstones).
 */

export const supabase = cloudConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

// ---------- Status für die Anzeige ----------

export interface SyncStatus {
  email: string | null
  state: 'off' | 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncAt: number | null
  error?: string
}

let status: SyncStatus = { email: null, state: 'off', lastSyncAt: null }
const listeners = new Set<() => void>()
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

// ---------- Sync-Metadaten (lokal) ----------

const getMeta = async <T>(key: string, fallback: T): Promise<T> =>
  ((await db.syncMeta.get(key))?.value as T | undefined) ?? fallback
const setMeta = (key: string, value: unknown) => db.syncMeta.put({ key, value })

// ---------- Herunterladen ----------

const PAGE = 1000

async function pull(table: SyncedTable) {
  const remote = TABLES[table].remote
  let cursor = await getMeta<string>(`cursor:${remote}`, '1970-01-01T00:00:00Z')
  for (;;) {
    const { data, error } = await supabase!.from(remote).select('*').gt('synced_at', cursor).order('synced_at').limit(PAGE)
    if (error) throw error
    if (!data.length) return

    const local = db.table(table)
    await db.transaction('rw', local, db.tombstones, db.syncMeta, async (tx) => {
      markRemote(tx)
      for (const row of data) {
        const current = (await local.get(row.id)) as { updatedAt?: number } | undefined
        const remoteUpdated = Date.parse(row.updated_at)
        // Lokal jüngere Änderung (noch nicht hochgeladen) gewinnt
        if (current && (current.updatedAt ?? 0) > remoteUpdated) continue
        if (row.deleted_at) await local.delete(row.id)
        else await local.put(toLocal(table, row))
      }
      cursor = data.at(-1)!.synced_at
      await setMeta(`cursor:${remote}`, cursor)
    })
    if (data.length < PAGE) return
  }
}

// ---------- Hochladen ----------

const CHUNK = 500

async function push() {
  const since = await getMeta<number>('lastPush', 0)
  const startedAt = Date.now()

  for (const table of SYNCED_TABLES) {
    const rows = (await db.table(table).toArray()).filter((r) => (r.updatedAt ?? 0) >= since)
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase!.from(TABLES[table].remote).upsert(rows.slice(i, i + CHUNK).map((r) => toRemote(table, r)))
      if (error) throw error
    }
  }

  // Löschungen: auf dem Server nur markieren (deleted_at), damit andere Geräte es mitbekommen
  const tombstones = await db.tombstones.toArray()
  for (const t of tombstones) {
    const table = t.table as SyncedTable
    // Zeile wurde inzwischen wieder angelegt (z. B. per Backup-Import) → Löschung ist hinfällig
    if (!(await db.table(table).get(t.id))) {
      const at = new Date(t.deletedAt).toISOString()
      const { error } = await supabase!.from(TABLES[table].remote).update({ deleted_at: at, updated_at: at }).eq('id', t.id)
      if (error) throw error
    }
    await db.tombstones.delete(t.id)
  }

  await setMeta('lastPush', startedAt)
}

// ---------- Abgleich ----------

let running: Promise<void> | null = null
let again = false

/** Gleicht jetzt ab (oder direkt nach einem laufenden Abgleich noch einmal). */
export function syncNow(): Promise<void> {
  if (!supabase || !status.email) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      if (!navigator.onLine) {
        setStatus({ state: 'offline' })
        return
      }
      setStatus({ state: 'syncing', error: undefined })
      try {
        for (const table of SYNCED_TABLES) await pull(table)
        await push()
        setStatus({ state: 'idle', lastSyncAt: Date.now() })
      } catch (e) {
        const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
        setStatus({ state: navigator.onLine ? 'error' : 'offline', error: message })
        return
      }
    } while (again)
  })().finally(() => (running = null))
  return running
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Nach lokalen Änderungen kurz warten und dann gesammelt hochladen. */
function scheduleSync(delay = 2000) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

// ---------- Anmeldung ----------

/** Schritt 1: Code an die E-Mail-Adresse schicken. */
export async function sendCode(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

/** Schritt 2: Code prüfen → angemeldet. */
export async function verifyCode(email: string, code: string) {
  const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

/** Abmelden. Vorher noch alles hochladen, lokale Daten bleiben auf dem Gerät. */
export async function signOut() {
  await syncNow()
  await supabase!.auth.signOut()
}

/**
 * Neue Anmeldung: Gehören die lokalen Daten einem anderen Konto, werden sie entfernt, bevor die
 * Daten des neuen Kontos geladen werden. Bei der allerersten Anmeldung bleiben sie und werden hochgeladen.
 */
async function onSignedIn(session: Session) {
  const previous = await getMeta<string | null>('userId', null)
  if (previous && previous !== session.user.id) {
    await db.transaction('rw', [...SYNCED_TABLES.map((t) => db.table(t)), db.tombstones, db.syncMeta], async (tx) => {
      markRemote(tx)
      for (const t of SYNCED_TABLES) await db.table(t).clear()
      await db.tombstones.clear()
      await db.syncMeta.clear()
    })
  }
  await setMeta('userId', session.user.id)
  setStatus({ email: session.user.email ?? '', state: 'idle' })
  await syncNow()
}

/** Beim App-Start einmal aufrufen. */
export function startSync() {
  if (!supabase) return

  supabase.auth.onAuthStateChange((event, session) => {
    // Callback darf nicht direkt auf Supabase warten → entkoppeln
    setTimeout(() => {
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) void onSignedIn(session!)
      if (event === 'SIGNED_OUT') setStatus({ email: null, state: 'off', lastSyncAt: null })
    })
  })

  onLocalChange(() => scheduleSync())
  window.addEventListener('online', () => scheduleSync(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0)
  })
}
