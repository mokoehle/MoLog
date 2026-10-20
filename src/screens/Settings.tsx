import { useRef, useState } from 'react'
import { downloadCsv, downloadExport, importAll } from '../logic/backup'
import { ACCENTS, updateSettings, useSettings, type Theme } from '../settings'

interface Props {
  onClose: () => void
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
]

export function Settings({ onClose }: Props) {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onImport = async (file: File) => {
    if (!confirm('Alle aktuellen Daten werden durch die Datei ersetzt. Fortfahren?')) return
    try {
      await importAll(await file.text())
      setMessage('Import erfolgreich')
    } catch (e) {
      setMessage(`Import fehlgeschlagen: ${(e as Error).message}`)
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onClose}>
          ‹ Zurück
        </button>
        <span className="topbar-title">Einstellungen</span>
      </header>

      <label className="field-label">Darstellung</label>
      <div className="segmented">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={settings.theme === t.id ? 'active' : ''}
            onClick={() => updateSettings({ theme: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="field-label">Akzentfarbe</label>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            className={settings.accent === a.id ? 'swatch active' : 'swatch'}
            style={{ background: a.color }}
            aria-label={a.name}
            onClick={() => updateSettings({ accent: a.id })}
          />
        ))}
      </div>

      <label className="field-label">Daten</label>
      <div className="settings-list">
        <button className="settings-row" onClick={downloadCsv}>
          Als CSV exportieren (z. B. für KI-Analyse)
        </button>
        <button className="settings-row" onClick={downloadExport}>
          Backup exportieren (JSON)
        </button>
        <button className="settings-row" onClick={() => fileRef.current?.click()}>
          Backup importieren
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void onImport(f)
          }}
        />
      </div>
      {message && <p className="muted">{message}</p>}
    </div>
  )
}
