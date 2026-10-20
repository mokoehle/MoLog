# MoLog

Minimalistischer Gym-Tracker als Progressive Web App fürs iPhone, gebaut, um im Training so wenig wie möglich am Handy zu hängen.

- **Schnelles Logging:** Ort → Trainingsart → Übung über Textfelder mit Vorschlägen (neue Einträge werden automatisch angelegt), dann Gewicht und Wiederholungen über große Slider.
- **Startet mit den Werten vom letzten Mal:** Der erste Satz übernimmt den ersten Satz vom letzten Mal, jeder weitere Satz übernimmt den vorherigen.
- **Offline-first:** Alle Daten liegen lokal im Browser (IndexedDB). Es gibt kein Backend und keinen Account.
- **Export/Import** als JSON für Backups und spätere Auswertungen.

## Tech-Stack

Vite · React · TypeScript · Dexie (IndexedDB) · vite-plugin-pwa · GitHub Pages

## Entwicklung

```bash
npm install
npm run dev
```

Der Dev-Server läuft auch im lokalen Netzwerk (`--host`), du kannst die App also im iPhone-Safari unter `http://<IP-des-Macs>:5173/MoLog/` öffnen.

## Auf dem iPhone installieren

1. Repo-Einstellungen → **Pages** → Source: **GitHub Actions**
2. Auf `main` pushen. Der Workflow baut und deployt die App automatisch.
3. `https://<github-user>.github.io/MoLog/` in Safari öffnen → Teilen → **Zum Home-Bildschirm**

## Datenmodell

Siehe [`src/db/schema.ts`](src/db/schema.ts). Kurzfassung:

| Tabelle         | Inhalt                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| `locations`     | Trainingsorte                                                           |
| `workoutTypes`  | Trainingsarten (Push, Pull, …)                                          |
| `exercises`     | Übungen inkl. `usesWeight`, `measure` (Wdh/Sekunden), optional `parentId` für Varianten |
| `workouts`      | Trainingseinheit mit Start/Ende                                         |
| `entries`       | Übung innerhalb eines Trainings mit Start/Ende (→ Übungsdauer)          |
| `sets`          | Einzelne Sätze mit Gewicht, Wdh bzw. Sekunden und Zeitstempel           |
