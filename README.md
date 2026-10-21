# MoLog

Minimalistischer Gym-Tracker als Progressive Web App fürs iPhone. Gebaut für ein Ziel: jeden Satz in Sekunden loggen und dann das Handy wieder weglegen.

Keine Werbung, kein Abo, kein Account. Die App läuft offline, und alle Daten bleiben auf dem Gerät.

## Funktionen

### Im Training
- **Wenige Eingaben:** Ort → Trainingsart → Übung, jeweils über ein Textfeld mit Vorschlägen. Was es noch nicht gibt, wird beim ersten Eintippen angelegt.
- **Passende Vorschläge:** Bei leerem Feld stehen die Übungen vom letzten Training derselben Art oben, in der damaligen Reihenfolge.
- **Lineal-Slider** für Gewicht und Wiederholungen (bzw. Sekunden bei Halteübungen), angelehnt an den iOS-Timer: wischen, mit Schwung, und ein Tipp links oder rechts ändert den Wert um genau einen Schritt.
- **Startwerte vom letzten Mal:** Der erste Satz übernimmt den ersten Satz der letzten Einheit, jeder weitere Satz den vorherigen. Meist reicht ein Tipp auf „Satz speichern“.
- **„Letztes Mal: 80 kg × 8 · 80 kg × 8 · …“** steht direkt unter dem Übungsnamen.
- **Nichts geht verloren:** Jeder Satz wird sofort gespeichert. Nach einem Absturz oder Neustart landet man wieder in der laufenden Übung.
- **Flexibel:** Übung nachträglich wechseln oder bearbeiten, zur vorigen Übung zurückspringen, letzten Satz rückgängig machen. Verlauf und Statistiken lassen sich öffnen, ohne das Training zu unterbrechen.

### Übungen
- **Gruppen:** z. B. *Rudern* mit *T-Bar-Rudern*, *Kabelrudern eng* und *Kurzhantelrudern*. Geloggt wird immer die konkrete Übung, ausgewertet werden kann auch die ganze Gruppe.
- **Geräte-Typ** (Langhantel, Kurzhantel, Kabel, Maschine, Körpergewicht) mit passender **Schrittweite** für den Slider, z. B. 1 kg bei Kurzhanteln. Die Schrittweite lässt sich pro Übung anpassen.
- **Wiederholungen oder Sekunden**, mit Gewicht, Zusatzgewicht oder ohne.

### Auswertung
- **Zusammenfassung nach dem Training:** alle Übungen in der gemachten Reihenfolge, mit Dauer, Sätzen, Volumen und Vergleich zum letzten Mal, inklusive Bestwerten.
- **Verlauf:** Trainings nach Monat, filterbar nach Trainingsart. Übungen nach Gruppen, sortierbar.
- **Übungs-Details:** Bestwert, geschätztes 1RM, Ø Dauer pro Einheit und ein Verlaufsdiagramm.
- **Export** als CSV (eine Zeile pro Satz, z. B. zum Auswerten mit einer KI) oder als JSON-Backup.

### Darstellung
Hell, Dunkel oder wie das System, dazu sechs Akzentfarben.

## Tech-Stack

| Bereich | Technik |
| --- | --- |
| UI | React 19 · TypeScript · reines CSS (keine UI-Bibliothek) |
| Build | Vite |
| Daten | IndexedDB über [Dexie](https://dexie.org), offline-first |
| PWA | vite-plugin-pwa (Service Worker, Manifest, Updates) |
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

**Updates:** Die App holt sich neue Versionen selbst. Beim Öffnen wird ein Update sofort übernommen. Ist die App schon offen, wartet das Update, bis kein Training mehr läuft. Welche Version installiert ist, steht unten in den Einstellungen.

## Projektstruktur

```
src/
├── db/            Datenmodell (schema.ts) und Datenbank inkl. Migrationen (db.ts)
├── logic/         Logik ohne UI: Training, Auswertung, Suche, Export, Formatierung
├── components/    Wiederverwendbare Bausteine (Slider, Autocomplete, Diagramm, Sheet …)
├── screens/       Die einzelnen Bildschirme
├── App.tsx        Navigation
├── pwa.ts         Service Worker & Update-Logik
└── styles.css     Gesamtes Styling inkl. Hell/Dunkel
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

Änderungen am Datenmodell laufen über Dexie-Versionen mit Migration in [`src/db/db.ts`](src/db/db.ts), damit vorhandene Daten erhalten bleiben.

## Bekannte iOS-Eigenheiten

- **Höhe in Home-Bildschirm-Apps:** iOS 26 macht installierte Web-Apps mit transparenter Statusleiste um die Höhe der Statusleiste zu kurz (WebKit-Bug 301108), unten entsteht eine Lücke. Gelöst über die CSS-Variable `--app-h`, Details als Kommentar in `styles.css`.
- **Tastatur:** Sie verdeckt das Layout, statt es zu verkleinern. Eingabe-Screens richten sich deshalb nach dem sichtbaren Bereich (`src/visualViewport.ts`).
- **Vibration:** Safari unterstützt keine Vibrations-Schnittstelle (`navigator.vibrate`). Für echte Haptik beim Slider bräuchte es eine native Hülle.

## Ausblick

- Cloud-Sync mit Login, damit die Daten nicht nur auf dem Gerät liegen
- Weitere Auswertungen (Volumen pro Woche, Muskelgruppen)
- Optional: native Hülle über Capacitor für Haptik und Apple Health (z. B. Herzfrequenz von der Uhr)
