import { getSettings, updateSettings } from './settings'
import { pushConfigured, VAPID_PUBLIC_KEY } from './sync/config'
import { supabase } from './sync/sync'

/**
 * Pausen-Timer: Nach „Satz speichern“ kommt nach der eingestellten Zeit
 * eine iPhone-Mitteilung – auch bei geschlossener App / gesperrtem Handy. In der App selbst wird
 * bewusst nichts angezeigt.
 *
 * Web-Apps können auf iOS selbst keine Mitteilung für später einplanen. Deshalb merkt sich der
 * Server den Zeitpunkt (rest_timers) und schickt dann eine Push-Nachricht
 * (supabase/rest-timer.sql + supabase/functions/rest-push).
 */

// Bis wann die aktuelle Pause läuft – nur, um unnötige Abbrechen-Aufrufe zu sparen.
let runningUntil = 0

const active = () => {
  const s = getSettings()
  return s.restTimer && pushConfigured && !!supabase
}

/** Startet die Pause nach einem Satz. Ersetzt eine laufende Pause. */
export function startRest(message: string) {
  if (!active()) return
  const settings = getSettings()
  const seconds = settings.restAfterSet
  runningUntil = Date.now() + seconds * 1000
  // Ohne Netz klappt das nicht – dann kommt eben keine Mitteilung, gespeichert wird trotzdem alles.
  void supabase!
    .rpc('start_rest_timer', { p_seconds: seconds, p_title: 'Pause vorbei', p_body: message })
    .then(({ error }) => error && console.warn('Pausen-Timer:', error.message))
}

/** Bricht eine laufende Pause ab (Nächste Übung, Satz rückgängig, Training beendet) – dann kommt keine Mitteilung. */
export function cancelRest() {
  if (!active() || runningUntil < Date.now()) return
  runningUntil = 0
  void supabase!.rpc('cancel_rest_timer').then(({ error }) => error && console.warn('Pausen-Timer:', error.message))
}

// ---------- Push-Benachrichtigungen ----------

/** Kann dieses Gerät überhaupt Push? (iOS: nur als App auf dem Home-Bildschirm, ab iOS 16.4) */
export const pushSupported = () =>
  pushConfigured && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const base64UrlToBytes = (b64: string) => {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** Schaltet den Timer ein: fragt nach Erlaubnis, meldet das Gerät für Push an und speichert das beim Server. Muss per Fingertipp ausgelöst werden. */
export async function enablePush() {
  if (!pushSupported() || !supabase) throw new Error('Benachrichtigungen werden hier nicht unterstützt.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    throw new Error('Benachrichtigungen sind nicht erlaubt. In den iPhone-Einstellungen unter Mitteilungen freigeben.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }))
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) throw error
  updateSettings({ restTimer: true })
}

/** Schaltet den Timer aus und meldet das Gerät von Push ab. */
export async function disablePush() {
  updateSettings({ restTimer: false })
  if (!pushSupported() || !supabase) return
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
