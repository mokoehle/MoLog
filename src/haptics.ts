import { getSettings } from './settings'

/**
 * Leichtes haptisches Feedback.
 *
 * iOS-Safari vibriert nicht über navigator.vibrate. Seit iOS 18 gibt aber das Umschalten
 * eines <input type="checkbox" switch> einen Haptik-Tick – das lösen wir unsichtbar aus.
 * Inoffizieller Trick, kann mit künftigen iOS-Versionen wegfallen. Sonst: vibrate().
 */

const MIN_INTERVAL_MS = 25

export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let lastTick = 0

export type HapticMethod = 'switch-hidden' | 'switch-offscreen' | 'vibrate'

/** Klickt ein unsichtbares Switch-Label an, das iOS mit einem Haptik-Tick quittiert. */
function switchTick(mode: 'hidden' | 'offscreen') {
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  if (mode === 'hidden') {
    label.style.display = 'none'
  } else {
    Object.assign(label.style, { position: 'fixed', left: '-100px', top: '0', opacity: '0', pointerEvents: 'none' })
  }
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  label.click()
  label.remove()
}

export function hapticWith(method: HapticMethod) {
  try {
    if (method === 'vibrate') navigator.vibrate?.(8)
    else switchTick(method === 'switch-hidden' ? 'hidden' : 'offscreen')
  } catch {
    // Feedback ist optional
  }
}

export function haptic() {
  if (!getSettings().haptics) return
  const now = performance.now()
  if (now - lastTick < MIN_INTERVAL_MS) return
  lastTick = now
  // Auf iOS nie vibrate() verwenden – es kann existieren, ohne etwas zu tun.
  hapticWith(isIOS ? 'switch-hidden' : typeof navigator.vibrate === 'function' ? 'vibrate' : 'switch-hidden')
}
