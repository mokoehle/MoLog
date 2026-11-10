# MoLog

Minimalistischer Gym-Tracker als Progressive Web App fürs iPhone. Gebaut für ein Ziel: jeden Satz in Sekunden loggen und dann das Handy wieder weglegen.

Keine Werbung, kein Abo, kein Tracking. Die App läuft offline, und ohne Anmeldung bleiben alle Daten auf dem Gerät. Wer möchte, meldet sich an und synchronisiert in die Cloud.

## Funktionen

### Im Training
- **Wenige Eingaben:** Ort → Trainingsart → Übung, jeweils über ein Textfeld mit Vorschlägen. Was es noch nicht gibt, wird beim ersten Eintippen angelegt.
- **Passende Vorschläge:** Bei leerem Feld stehen die Übungen vom letzten Training derselben Art oben, in der damaligen Reihenfolge.
- **Lineal-Slider** für Gewicht und Wiederholungen (bzw. Sekunden bei Halteübungen), angelehnt an den iOS-Timer: wischen, mit Schwung, und ein Tipp links oder rechts ändert den Wert um genau einen Schritt.
- **Startwerte vom letzten Mal:** Der erste Satz übernimmt den ersten Satz der letzten Einheit, jeder weitere Satz den vorherigen. Meist reicht ein Tipp auf „Satz speichern“.
- **„Letztes Mal: vor 3 Tagen ›“** steht unter dem Übungsnamen. Ein Tipp darauf zeigt die Sätze der letzten Einheiten.
- **Pausen-Timer (optional):** Nach jedem Satz kommt nach der eingestellten Pause eine iPhone-Mitteilung, auch bei geschlossener App. In der App selbst läuft bewusst kein Countdown. Bei „Nächste Übung“ wird die Pause abgebrochen.
- **Nichts geht verloren:** Jeder Satz wird sofort gespeichert. Nach einem Absturz oder Neustart landet man wieder in der laufenden Übung.
- **Flexibel:** Übung nachträglich wechseln oder bearbeiten, zur vorigen Übung zurückspringen, letzten Satz rückgängig machen, frühere Sätze korrigieren oder löschen. Verlauf und Statistiken lassen sich öffnen, ohne das Training zu unterbrechen.

### Übungen
- **Gruppen:** z. B. *Rudern* mit *T-Bar-Rudern*, *Kabelrudern eng* und *Kurzhantelrudern*. Geloggt wird immer die konkrete Übung, ausgewertet werden kann auch die ganze Gruppe.
- **Geräte-Typ** (Langhantel, Kurzhantel, Kabel, Maschine, Körpergewicht) mit passender **Schrittweite** für den Slider, z. B. 1 kg bei Kurzhanteln. Die Schrittweite lässt sich pro Übung anpassen.
- **Wiederholungen oder Sekunden**, mit Gewicht, Zusatzgewicht oder ohne.
- **Gym-abhängig:** Bei Maschinen und Kabelzügen beziehen sich Startwerte und Vergleiche auf dasselbe Gym, denn eine andere Maschine heißt andere Gewichte.

### Auswertung
- **Zusammenfassung nach dem Training:** alle Übungen in der gemachten Reihenfolge, mit Dauer, Sätzen, Volumen und Vergleich zum letzten Mal, inklusive Bestwerten.
- **Verlauf:** Trainings nach Monat, filterbar nach Trainingsart. Übungen nach Gruppen, sortierbar und durchsuchbar.
- **Übungs-Details:** Bestwert, geschätztes 1RM, Ø Dauer pro Einheit und ein Verlaufsdiagramm.
- **Export** als CSV (eine Zeile pro Satz, z. B. zum Auswerten mit einer KI) oder als JSON-Backup.

### Konto & Sync (optional)
- **Anmeldung per E-Mail-Code**, ohne Passwort.
- **Automatischer Sync:** Die App bleibt offline-first. Änderungen werden im Hintergrund abgeglichen, sobald Netz da ist, und vorhandene lokale Daten werden bei der ersten Anmeldung übernommen.
- **Datenschutz:** Jeder sieht nur seine eigenen Daten (Row Level Security). Die Datenschutzhinweise stehen in den Einstellungen.

### Darstellung
Hell, Dunkel oder wie das System, dazu sechs Akzentfarben.

## Tech-Stack

| Bereich | Technik |
| --- | --- |
| UI | React 19 · TypeScript · reines CSS (keine UI-Bibliothek) |
| Build | Vite |
| Daten | IndexedDB über [Dexie](https://dexie.org), offline-first |
| PWA | vite-plugin-pwa (Service Worker, Manifest, Updates) |
| Cloud | [Supabase](https://supabase.com): Postgres mit RLS, Login per E-Mail-Code, Edge Function + pg_cron für Web Push |
| KI-Schnittstelle | MCP-Server (`@modelcontextprotocol/sdk`), läuft direkt mit Node |
| Hosting | GitHub Pages über GitHub Actions |

## Entwicklung

```bash
npm install
npm run dev
```

Der Dev-Server ist auch im lokalen Netzwerk erreichbar. Auf dem iPhone (gleiches WLAN) einfach `http://<IP-des-Macs>:5173/MoLog/` in Safari öffnen.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server mit Hot Reload |
| `npm run build` | Typecheck + Produktions-Build nach `dist/` |
| `npm run preview` | Produktions-Build lokal ansehen |
| `npm run icons` | App-Icons in `public/` neu erzeugen |

## Installation auf dem iPhone

1. Im Repo unter **Settings → Pages** bei Source **GitHub Actions** auswählen (nur einmalig nötig).
2. Auf `main` pushen. Der Workflow baut die App und deployt sie automatisch.
3. `https://<github-user>.github.io/MoLog/` in **Safari** öffnen → Teilen → **Zum Home-Bildschirm**.

Push-Mitteilungen gibt es auf dem iPhone nur in der Home-Bildschirm-App (ab iOS 16.4), nicht im normalen Safari-Tab.

**Updates:** Die App holt sich neue Versionen selbst. Beim Öffnen wird ein Update sofort übernommen. Ist die App schon offen, wartet das Update, bis kein Training mehr läuft. Welche Version installiert ist, steht unten in den Einstellungen.

## Eigenes Supabase-Projekt (optional)

Ohne Supabase läuft die App rein lokal. Sind in [`src/sync/config.ts`](src/sync/config.ts) URL und Key eingetragen, erscheinen Anmeldung und Sync.

1. Projekt anlegen und [`supabase/schema.sql`](supabase/schema.sql) im SQL-Editor ausführen.
2. **Authentication:** Login per E-Mail aktivieren. In den Mail-Vorlagen „Magic link“ und „Confirm signup“ `{{ .Token }}` statt des Links einfügen, damit ein Code ankommt. Die Site URL auf die GitHub-Pages-Adresse setzen.
3. Project URL und **publishable** Key in `src/sync/config.ts` eintragen. Beide sind öffentlich gedacht, den Secret Key niemals.

**Pausen-Timer (Web Push):**

1. VAPID-Schlüssel erzeugen: `npx web-push generate-vapid-keys`. Den öffentlichen Schlüssel in `src/sync/config.ts` und in `supabase/functions/rest-push/index.ts` (`APP_PUBLIC_KEY`) eintragen.
2. Die Edge Function `rest-push` mit „Verify JWT“ aus deployen und die Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` (`mailto:…`) setzen.
3. [`supabase/rest-timer.sql`](supabase/rest-timer.sql) ausführen, vorher die Projekt-URL im Cron-Job anpassen. Ein pg_cron-Job prüft dann alle 5 Sekunden, ob eine Pause abgelaufen ist, und ruft dafür die Function auf.

## Coach-Schnittstelle (MCP-Server)

Unter [`mcp/`](mcp/) liegt ein [MCP-Server](https://modelcontextprotocol.io), über den ein KI-Assistent wie Claude die eigenen Krafttrainingsdaten lesen kann, zum Beispiel als Sportcoach zusammen mit Garmin-Daten. Der Server liest nur und meldet sich mit dem normalen App-Konto an. Jeder sieht also nur seine eigenen Daten, auch wenn Freunde den Server mit ihrem Konto nutzen.

**Einrichten** (Node ≥ 22.18, Cloud-Sync muss in der App aktiv sein):

```bash
cd mcp
npm install
npm run login        # E-Mail-Adresse des App-Kontos + Code aus der Mail
```

Die Sitzung liegt danach in `~/.config/molog-coach/` und nicht im Repo. Mit `npm run login -- --logout` wird sie wieder gelöscht. Anschließend den Server bei Claude Code eintragen:

```bash
claude mcp add --scope user molog-coach -- node /pfad/zu/MoLog/mcp/src/stdio.ts
```

Bei Claude Desktop kommt derselbe Befehl (`node` + Pfad zu `mcp/src/stdio.ts`) in die `claude_desktop_config.json`.

**Tools:**

| Tool | Liefert |
| --- | --- |
| `listStrengthWorkouts` | Trainings im Zeitraum mit Start/Ende, allen Sätzen, Top-Satz, e1RM, Summen und Beinbelastung (`legs.load`: none / light / heavy ab 6 Beinsätzen) |
| `getStrengthWorkout` | Ein Training mit jedem Satz inkl. Uhrzeit und Pause davor, per `id` oder per Zeitpunkt `at`, z. B. der Startzeit einer Garmin-Aktivität |
| `getExerciseProgress` | Verlauf einer Übung oder Gruppe: Top-Satz, e1RM (Epley), Tonnage je Einheit, Trend und Bestwert |
| `getWeeklyStrengthVolume` | Sätze, Wdh und Tonnage je ISO-Woche, gruppiert nach Region, Übung oder Gruppe |
| `listExercises` | Alle Übungen mit Gruppe, Region, Gerät, Anzahl Einheiten und letztem Datum |

Zeiten werden als lokale Zeit mit Offset ausgegeben, wie Garmins `startTimeLocal`. Darüber lassen sich Training und Garmin-Aktivität zuordnen. Die App speichert keine RPE, Notizen oder Muskelgruppen. Die Region (`legs`, `push`, `pull`, `core`, `other`) wird deshalb aus dem Übungsnamen geschätzt.

**Beispiel** (`npm run demo` zeigt alle Tools mit erfundenen Daten, ohne Anmeldung):

```jsonc
// getStrengthWorkout {"at": "2026-11-05T17:52:00+01:00"}  (gekürzt)
{
  "matchOffsetMin": -7,
  "start": "2026-11-05T17:45:00+01:00",
  "end": "2026-11-05T18:26:41+01:00",
  "durationMin": 42,
  "type": "Beine",
  "totals": { "exercises": 4, "sets": 12, "reps": 90, "tonnageKg": 4800 },
  "legs": { "load": "heavy", "sets": 10, "typeSuggestsLegDay": true, "lastLegSetAt": "2026-11-05T18:18:04+01:00" },
  "exercises": [
    {
      "name": "Kniebeuge", "region": "legs", "equipment": "barbell",
      "sets": [
        { "kg": 100, "reps": 6, "at": "2026-11-05T17:49:30+01:00", "e1rmKg": 120 },
        { "kg": 100, "reps": 6, "at": "2026-11-05T17:52:37+01:00", "restSec": 187, "e1rmKg": 120 }
      ]
    }
  ]
}

// getExerciseProgress {"exercise": "kniebeuge"}  (gekürzt)
{
  "exercise": { "name": "Kniebeuge", "region": "legs", "equipment": "barbell" },
  "sessions": 3,
  "e1rmTrend": { "first": { "date": "2026-10-22", "kg": 108 }, "last": { "date": "2026-11-05", "kg": 120 }, "changeKg": 12 },
  "history": [{ "date": "2026-11-05", "sets": 4, "top": "100kg×6", "e1rmKg": 120, "reps": 24, "tonnageKg": 2400 }]
}

// getWeeklyStrengthVolume {"by": "region"}  (eine Woche)
{
  "week": "2026-W45", "weekStart": "2026-11-02", "workouts": 3,
  "region": {
    "legs": { "sets": 10, "reps": 90, "tonnageKg": 4800 },
    "pull": { "sets": 10, "reps": 98, "tonnageKg": 3970 },
    "push": { "sets": 9, "reps": 84, "tonnageKg": 2610 },
    "core": { "sets": 2, "seconds": 160 }
  }
}
```

**Aufbau:** Die Auswertung ([`mcp/src/core/`](mcp/src/core/)) kennt weder Netz noch Transport. Sie bekommt nur eine Datenquelle. `src/stdio.ts` verbindet sie mit Supabase und stdio. Ein späterer HTTP-Betrieb, etwa auf einem eigenen Server und mit Login je Benutzer, braucht nur einen weiteren Einstiegspunkt mit anderem Transport. Datentypen und Tabellen-Mapping kommen direkt aus der App (`src/db/schema.ts`, `src/sync/mapping.ts`), damit nichts auseinanderläuft. Node führt den TypeScript-Code direkt aus, es gibt keinen Build-Schritt. `npm run check` prüft die Typen.

## Projektstruktur

```
src/
├── db/            Datenmodell (schema.ts) und Datenbank inkl. Migrationen (db.ts)
├── logic/         Logik ohne UI: Training, Auswertung, Suche, Export, Formatierung
├── components/    Wiederverwendbare Bausteine (Slider, Autocomplete, Diagramm, Sheet …)
├── screens/       Die einzelnen Bildschirme
├── sync/          Supabase-Zugang, Login und Sync
├── App.tsx        Navigation
├── pwa.ts         Service Worker & Update-Logik
├── restTimer.ts   Pausen-Timer (Push-Anmeldung, Start/Abbruch)
└── styles.css     Gesamtes Styling inkl. Hell/Dunkel
public/push-sw.js  Zeigt Push-Mitteilungen an (Teil des Service Workers)
supabase/          Datenbankschema, Pausen-Timer-SQL und Edge Function
mcp/               MCP-Server für KI-Coaches (liest die eigenen Trainingsdaten)
```

Logik und Oberfläche sind bewusst getrennt. So lässt sich die App später in eine native Hülle (Capacitor) packen oder in SwiftUI nachbauen, ohne Daten oder Logik neu zu erfinden.

## Datenmodell

Vollständig dokumentiert in [`src/db/schema.ts`](src/db/schema.ts). Alle Zeitstempel sind Unix-Millisekunden.

| Tabelle | Inhalt |
| --- | --- |
| `locations` | Trainingsorte |
| `workoutTypes` | Trainingsarten (Push, Pull, Legs …) |
| `exerciseGroups` | Übungsgruppen (Sammelbegriffe wie „Rudern“, werden nie direkt geloggt) |
| `exercises` | Konkrete Übungen: Gruppe, Gerät, Schrittweite, mit/ohne Gewicht, Wdh oder Sekunden |
| `workouts` | Trainingseinheit mit Ort, Art, Start und Ende |
| `entries` | Eine Übung innerhalb eines Trainings, mit Reihenfolge, Start und Ende (→ Übungsdauer) |
| `sets` | Einzelne Sätze mit Gewicht, Wiederholungen bzw. Sekunden |

Dazu kommen `tombstones` (gelöschte Einträge, damit Löschungen synchronisiert werden) und `syncMeta`. In Supabase heißen die Tabellen gleich, nur in snake_case.

Änderungen am Datenmodell laufen über Dexie-Versionen mit Migration in [`src/db/db.ts`](src/db/db.ts), damit vorhandene Daten erhalten bleiben.

## Bekannte iOS-Eigenheiten

- **Höhe in Home-Bildschirm-Apps:** iOS 26 macht installierte Web-Apps mit transparenter Statusleiste um die Höhe der Statusleiste zu kurz (WebKit-Bug 301108), unten entsteht eine Lücke. Gelöst über die CSS-Variable `--app-h`, Details als Kommentar in `styles.css`.
- **Tastatur:** Sie verdeckt das Layout, statt es zu verkleinern. Eingabe-Screens richten sich deshalb nach dem sichtbaren Bereich (`src/visualViewport.ts`). iOS meldet diesen nicht immer zuverlässig, deshalb wird zusätzlich bei Fokus, Eingabe und Rückkehr in die App nachgemessen.
- **Mitteilungen:** Web-Apps können keine Mitteilung für später einplanen. Den Zeitpunkt merkt sich deshalb der Server, der dann per Web Push schickt.
- **Vibration:** Safari unterstützt keine Vibrations-Schnittstelle (`navigator.vibrate`). Für echte Haptik beim Slider bräuchte es eine native Hülle.

## Ausblick

- Überarbeitetes Design
- Muskelgruppen pro Übung (ersetzen dann die Namens-Schätzung im MCP-Server)
- MCP-Server per HTTP auf einem eigenen Server, damit er auch vom Handy aus nutzbar ist
- Weitere Auswertungen in der App (Volumen pro Woche)
- Optional: native Hülle über Capacitor für Haptik und Apple Health (z. B. Herzfrequenz von der Uhr)
