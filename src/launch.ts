/**
 * Wurde die App gerade frisch gestartet (z. B. nach dem Rauswischen aus der App-Übersicht)?
 *
 * sessionStorage überlebt ein Neuladen der Seite (z. B. durch ein Update), wird aber geleert,
 * wenn die App beendet wird. Wechselt man nur in den Hintergrund, läuft die Seite ohnehin weiter.
 */
const KEY = 'molog-session'

function detect() {
  try {
    const fresh = !sessionStorage.getItem(KEY)
    sessionStorage.setItem(KEY, '1')
    return fresh
  } catch {
    return false
  }
}

export const isFreshLaunch = detect()
