import type { ReactNode } from 'react'

interface Props {
  className: string
  onPress: () => void
  children: ReactNode
}

/**
 * Button, der auf dem iPhone einen Haptik-Tick auslösen soll.
 *
 * iOS-Safari vibriert nur, wenn der Finger wirklich einen <input type="checkbox" switch> umlegt
 * (per Code ausgelöste Klicks werden ignoriert). Deshalb ist der Button hier das <label> eines
 * unsichtbaren echten Schalters: Der Tipp legt den Schalter um, das löst onPress aus.
 */
export function HapticButton({ className, onPress, children }: Props) {
  return (
    <label className={`${className} haptic-button`} role="button">
      <input type="checkbox" {...{ switch: '' }} className="haptic-input" tabIndex={-1} onChange={onPress} />
      {children}
    </label>
  )
}
