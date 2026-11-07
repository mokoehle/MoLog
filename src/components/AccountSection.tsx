import { useState } from 'react'
import { cloudConfigured } from '../sync/config'
import { sendCode, signOut, syncNow, useSyncStatus, verifyCode } from '../sync/sync'
import { fmtRelative, fmtTime } from '../logic/format'

/** Konto & Cloud-Sync in den Einstellungen: Anmelden per E-Mail-Code, Sync-Status, Abmelden. */
export function AccountSection() {
  const status = useSyncStatus()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!cloudConfigured) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  if (status.email) {
    const line =
      status.state === 'syncing'
        ? 'Synchronisiere …'
        : status.state === 'offline'
          ? 'Offline – wird nachgeholt, sobald Netz da ist'
          : status.state === 'error'
            ? `Fehler beim Abgleich: ${status.error}`
            : status.lastSyncAt
              ? `Gesichert ${fmtRelative(status.lastSyncAt)}, ${fmtTime(status.lastSyncAt)} Uhr`
              : 'Angemeldet'
    return (
      <>
        <label className="field-label">Konto & Cloud</label>
        <div className="settings-list">
          <div className="settings-row settings-info">
            <strong>{status.email}</strong>
            <span className={status.state === 'error' ? 'danger small' : 'muted small'}>{line}</span>
          </div>
          <button className="settings-row" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>
            Jetzt synchronisieren
          </button>
          <button
            className="settings-row"
            onClick={() => {
              if (confirm('Abmelden? Deine Daten bleiben auf diesem Gerät und in der Cloud.')) void run(signOut)
            }}
          >
            Abmelden
          </button>
        </div>
        {message && <p className="danger small">{message}</p>}
      </>
    )
  }

  return (
    <>
      <label className="field-label">Konto & Cloud</label>
      <div className="account-box">
        <p className="muted small">
          Deine Daten liegen bisher nur auf diesem Gerät. Melde dich an, um sie in der Cloud zu sichern und auf
          anderen Geräten zu nutzen. Vorhandene Trainings werden dabei automatisch übernommen.
        </p>
        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await sendCode(email.trim())
                setStep('code')
              })
            }}
          >
            <input
              className="text-input text-input-small"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="E-Mail-Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="button button-primary" disabled={busy || !email.includes('@')}>
              {busy ? 'Sende …' : 'Code per E-Mail senden'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => verifyCode(email.trim(), code.trim()))
            }}
          >
            <p className="small">Code an {email} gesendet. Schau auch im Spam-Ordner nach.</p>
            <input
              className="text-input code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button className="button button-primary" disabled={busy || code.length < 6}>
              {busy ? 'Prüfe …' : 'Anmelden'}
            </button>
            <button type="button" className="link-button" onClick={() => setStep('email')}>
              Andere E-Mail-Adresse
            </button>
          </form>
        )}
        {message && <p className="danger small">{message}</p>}
      </div>
    </>
  )
}
