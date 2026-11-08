import { useState } from 'react'
import { disablePush, enablePush, pushSupported } from '../restTimer'
import { updateSettings, useSettings } from '../settings'
import { pushConfigured } from '../sync/config'
import { useSyncStatus } from '../sync/sync'

// 0:30 bis 5:00 in 15-s-Schritten, danach größere Sprünge
const DURATIONS = [...Array.from({ length: 19 }, (_, i) => 30 + i * 15), 360, 420, 480, 600]
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`

/** Einstellungen → Pausen-Timer: an/aus (= Mitteilungen erlauben) und Pausenzeiten. */
export function RestTimerSection() {
  const settings = useSettings()
  const account = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!pushConfigured) return null

  const toggle = async (on: boolean) => {
    setBusy(true)
    setMessage(null)
    try {
      if (on) await enablePush()
      else await disablePush()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  const durationRow = (label: string, key: 'restAfterSet' | 'restAfterExercise') => (
    <label className="settings-row settings-toggle">
      <span>{label}</span>
      <select
        className="settings-select"
        value={settings[key]}
        onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
      >
        {DURATIONS.map((s) => (
          <option key={s} value={s}>
            {fmt(s)}
          </option>
        ))}
      </select>
    </label>
  )

  const canEnable = pushSupported() && !!account.email
  const hint = !pushSupported()
    ? 'Funktioniert nur, wenn die App über „Zum Home-Bildschirm“ installiert ist.'
    : !account.email
      ? 'Dafür oben anmelden – die Mitteilung kommt über den Server.'
      : 'Mitteilung aufs iPhone, wenn die Pause vorbei ist – auch bei geschlossener App.'

  return (
    <>
      <label className="field-label">Pausen-Timer</label>
      <div className="settings-list">
        <label className="settings-row settings-toggle">
          <span>Pausen-Timer</span>
          <input
            type="checkbox"
            {...{ switch: '' }}
            className="toggle"
            checked={settings.restTimer}
            disabled={busy || (!canEnable && !settings.restTimer)}
            onChange={(e) => void toggle(e.target.checked)}
          />
        </label>
        {settings.restTimer && (
          <>
            {durationRow('Nach einem Satz', 'restAfterSet')}
            {durationRow('Nach einer Übung', 'restAfterExercise')}
          </>
        )}
      </div>
      <p className="muted small settings-hint">{hint}</p>
      {message && <p className="danger small">{message}</p>}
    </>
  )
}
