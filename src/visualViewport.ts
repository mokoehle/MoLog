/**
 * Sichtbarer Bereich des Bildschirms als CSS-Variablen.
 *
 * Auf dem iPhone verkleinert die Tastatur nicht das Layout, sondern verdeckt es nur. Screens mit
 * Eingabefeld (.screen-fit) richten sich deshalb nach dem tatsächlich sichtbaren Bereich:
 *   --vvh  Höhe des sichtbaren Bereichs (ohne Tastatur)
 *   --vvt  Abstand des sichtbaren Bereichs von oben (iOS verschiebt die Seite beim Fokussieren)
 *   <html data-keyboard="open|closed">
 */
export function trackVisualViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement

  const update = () => {
    root.style.setProperty('--vvh', `${vv.height}px`)
    root.style.setProperty('--vvt', `${vv.offsetTop}px`)
    // Tastatur offen, wenn deutlich weniger als die Fensterhöhe sichtbar ist
    root.dataset.keyboard = vv.height < window.innerHeight * 0.8 ? 'open' : 'closed'
  }

  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()
}
