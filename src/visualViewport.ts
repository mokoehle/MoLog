/**
 * Sichtbarer Bereich des Bildschirms als CSS-Variablen.
 *
 * Auf dem iPhone verkleinert die Tastatur nicht das Layout, sondern verdeckt es nur. Screens mit
 * Eingabefeld (.screen-fit) richten sich deshalb nach dem tatsächlich sichtbaren Bereich:
 *   --vvh  Höhe des sichtbaren Bereichs (ohne Tastatur)
 *   --vvt  Abstand des sichtbaren Bereichs von oben (iOS verschiebt die Seite beim Fokussieren)
 *   <html data-keyboard="open|closed">
 *
 * iOS meldet Änderungen nicht immer zuverlässig (z. B. nach der Rückkehr aus dem Sperrbildschirm
 * oder einer Mitteilung). Dann standen die alten Werte und die Vorschläge lagen unter der Tastatur.
 * Deshalb wird zusätzlich bei Fokus, Eingabe und Rückkehr in die App nachgemessen.
 */
export function trackVisualViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement

  const update = () => {
    const height = vv.height
    // nie weiter nach unten verschieben, als der sichtbare Bereich zulässt
    const top = Math.max(0, Math.min(vv.offsetTop, window.innerHeight - height))
    root.style.setProperty('--vvh', `${height}px`)
    root.style.setProperty('--vvt', `${top}px`)
    // Tastatur offen, wenn deutlich weniger als die Fensterhöhe sichtbar ist
    root.dataset.keyboard = height < window.innerHeight * 0.8 ? 'open' : 'closed'
  }

  // Die Tastatur fährt animiert ein/aus – ein paarmal nachmessen, bis sie steht
  let timers: number[] = []
  const settle = () => {
    update()
    timers.forEach(clearTimeout)
    timers = [100, 300, 600, 1000].map((ms) => window.setTimeout(update, ms))
  }

  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  window.addEventListener('resize', settle)
  window.addEventListener('pageshow', settle)
  document.addEventListener('focusin', settle)
  document.addEventListener('focusout', settle)
  document.addEventListener('input', update)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') settle()
  })
  update()
}
