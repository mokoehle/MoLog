import { registerSW } from 'virtual:pwa-register'
import { db } from './db/db'

/**
 * Updates der App: Eine neue Version wird im Hintergrund geladen, aber erst übernommen
 * (Seite neu laden), wenn gerade kein Training läuft – nie mitten in einer Übung.
 */

let updatePending = false

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updatePending = true
    void applyUpdateIfIdle()
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    // Home-Bildschirm-Apps werden oft nur in den Hintergrund geschickt statt neu gestartet,
    // daher beim Zurückkehren in die App nach Updates schauen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  },
})

/** Übernimmt ein wartendes Update, sofern kein Training läuft. */
export async function applyUpdateIfIdle() {
  if (!updatePending) return
  const running = await db.workouts.filter((w) => !w.endedAt).count()
  if (running > 0) return
  updatePending = false
  await updateSW(true)
}
