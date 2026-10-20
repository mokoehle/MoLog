import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'dark' | 'light'

export interface Accent {
  id: string
  name: string
  /** Füllfarbe für Buttons und Akzente. */
  color: string
  /** Textfarbe für Links im hellen Modus (dunklere Variante, damit sie lesbar bleibt). */
  ink: string
}

export const ACCENTS: Accent[] = [
  { id: 'lime', name: 'Limette', color: '#c6f432', ink: '#4d6b00' },
  { id: 'orange', name: 'Orange', color: '#ff8a3d', ink: '#b34700' },
  { id: 'blue', name: 'Blau', color: '#4da3ff', ink: '#0062c4' },
  { id: 'pink', name: 'Pink', color: '#ff5c93', ink: '#c2124f' },
  { id: 'violet', name: 'Lila', color: '#a78bfa', ink: '#6d3fe0' },
  { id: 'mint', name: 'Mint', color: '#3ee0b0', ink: '#00805c' },
]

export interface Settings {
  theme: Theme
  accent: string
  /** Leichtes Vibrieren beim Bedienen der Slider. */
  haptics: boolean
}

const KEY = 'molog-settings'
const DEFAULTS: Settings = { theme: 'system', accent: 'lime', haptics: true }

// Einstellungen sind reine Darstellungs-Vorlieben pro Gerät, daher localStorage statt Datenbank.
function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // z. B. privater Modus – Einstellung gilt dann nur bis zum Neustart
  }
  applySettings()
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** Überträgt die Einstellungen auf <html> (data-theme + CSS-Variablen) und die Statusleiste. */
export function applySettings() {
  const root = document.documentElement
  const accent = ACCENTS.find((a) => a.id === current.accent) ?? ACCENTS[0]
  const dark = current.theme === 'dark' || (current.theme === 'system' && darkQuery.matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.setProperty('--accent', accent.color)
  root.style.setProperty('--accent-ink', dark ? accent.color : accent.ink)
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

darkQuery.addEventListener('change', applySettings)
