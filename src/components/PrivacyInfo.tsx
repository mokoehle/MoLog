import type { ReactNode } from 'react'
import { PRIVACY_CONTACT, SUPABASE_REGION } from '../sync/config'

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="privacy-section">
    <h3 className="field-label">{title}</h3>
    {children}
  </section>
)

/** Datenschutzhinweise – bewusst kurz und in normaler Sprache. */
export function PrivacyInfo() {
  return (
    <div className="privacy">
      <p>
        Diese App ist ein privates, nicht-kommerzielles Projekt. Es gibt keine Werbung, kein Tracking, keine
        Analyse-Tools und es werden keine Inhalte von fremden Servern (z. B. Schriftarten) geladen.
      </p>

      <Section title="Verantwortlich">
        <p>
          Der Betreiber dieses privaten Projekts
          {PRIVACY_CONTACT ? (
            <>
              , erreichbar unter <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
            </>
          ) : (
            '.'
          )}
        </p>
      </Section>

      <Section title="Ohne Anmeldung">
        <p>
          Alle Trainingsdaten werden nur auf deinem Gerät gespeichert (im Speicher des Browsers bzw. der
          Home-Bildschirm-App) und verlassen es nicht. Löschst du die App, sind die Daten weg.
        </p>
      </Section>

      <Section title="Webseite (GitHub Pages)">
        <p>
          Die App wird über GitHub Pages (GitHub Inc., USA) ausgeliefert. Beim Aufruf verarbeitet GitHub technisch
          notwendige Daten wie deine IP-Adresse, z. B. in Server-Logs zur Sicherheit. Darauf habe ich keinen Einfluss.
          Rechtsgrundlage: berechtigtes Interesse am Betrieb der Seite (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </Section>

      <Section title="Mit Anmeldung (Synchronisieren)">
        <p>
          Meldest du dich freiwillig an, werden deine E-Mail-Adresse und deine Trainingsdaten (Übungen, Sätze, Gewichte,
          Gyms, Zeitpunkte) bei Supabase (Supabase Inc.)
          {SUPABASE_REGION ? ` auf Servern in ${SUPABASE_REGION}` : ''} gespeichert, damit sie gesichert sind und auf
          mehreren Geräten verfügbar werden. Nur du selbst kannst deine Daten abrufen.
        </p>
        <p>
          Den Anmelde-Code verschicke ich per E-Mail über Google Gmail (Google). Rechtsgrundlage ist die Bereitstellung
          der von dir gewünschten Funktion (Art. 6 Abs. 1 lit. b DSGVO).
        </p>
      </Section>

      <Section title="Pausen-Timer">
        <p>
          Schaltest du den Pausen-Timer ein, wird für dein Gerät eine Push-Adresse gespeichert und nach jedem Satz der
          Zeitpunkt des Pausenendes samt Übungsname, bis die Mitteilung verschickt ist. Zugestellt wird sie über den
          Push-Dienst von Apple. Ausschalten in den Einstellungen löscht die Push-Adresse.
        </p>
      </Section>

      <Section title="Speicherdauer & deine Rechte">
        <p>
          Die Daten bleiben gespeichert, bis du die Löschung verlangst. Du hast das Recht auf Auskunft, Berichtigung,
          Löschung, Einschränkung, Datenübertragbarkeit (Export gibt es direkt in den Einstellungen) und Widerspruch
          sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde.
          {PRIVACY_CONTACT && ' Für eine Löschung deines Kontos genügt eine kurze E-Mail.'}
        </p>
      </Section>

      <p className="muted small">Stand: November 2026</p>
    </div>
  )
}
