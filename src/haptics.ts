import { getSettings } from './settings'

/**
 * Leichtes haptisches Feedback.
 *
 * iOS-Safari unterstützt navigator.vibrate nicht. Seit iOS 18 gibt aber das Umschalten
 * eines <input type="checkbox" switch> einen Haptik-Tick – das lösen wir unsichtbar aus.
 * Inoffizieller Trick, kann mit künftigen iOS-Versionen wegfallen. Auf Android: vibrate().
 */

const MIN_INTERVAL_MS = 25

let label: HTMLLabelElement | null = null
let lastTick = 0

function switchLabel() {
  if (!label) {
    label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
  }
  return label
}

export function haptic() {
  if (!getSettings().haptics) return
  const now = performance.now()
  if (now - lastTick < MIN_INTERVAL_MS) return
  lastTick = now
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
    else switchLabel().click()
  } catch {
    // Feedback ist optional
  }
}
