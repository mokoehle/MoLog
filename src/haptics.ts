/**
 * Haptisches Feedback (Slider-Striche, Satz speichern).
 *
 * In der Web-App auf dem iPhone derzeit wirkungslos: iOS-Safari kennt navigator.vibrate nicht,
 * und der frühere Trick über <input type="checkbox" switch> reagiert nur noch auf echte
 * Berührungen (getestet auf iOS, Okt. 2026). Auf Android vibriert es.
 *
 * Bei einem Wechsel zu Capacitor hier @capacitor/haptics einbauen (ImpactStyle.Light),
 * dann vibrieren alle Aufrufstellen automatisch.
 */

const MIN_INTERVAL_MS = 25
let lastTick = 0

export function haptic() {
  if (typeof navigator.vibrate !== 'function') return
  const now = performance.now()
  if (now - lastTick < MIN_INTERVAL_MS) return
  lastTick = now
  navigator.vibrate(8)
}
