# Backlog

Ideen und offene Punkte, nach und nach abzuarbeiten. Oben steht, was als Nächstes dran ist.

## Als Nächstes

### Supersätze / zwei Übungen im Wechsel
Oft laufen zwei Übungen abwechselnd, z. B. Shrugs und Bizeps-Curls am Trainingsende, um Zeit zu sparen (keine besonders hohe Intensität).
- In der Übung eine zweite Übung „im Wechsel“ dazunehmen. Danach wechselt die App nach jedem gespeicherten Satz automatisch zur anderen Übung, mit deren eigenen Startwerten.
- Die Daten bleiben zwei normale Übungen. Sie bekommen nur eine gemeinsame Kennung, damit Verlauf, Statistiken und Export unverändert funktionieren. Das braucht eine Dexie-Migration und eine neue Spalte in Supabase.
- Pausen-Timer: Er läuft erst nach dem Satz der zweiten Übung, also nach einer kompletten Runde.
- Offen: Wie sieht das in der Zusammenfassung und im Verlauf aus? Zum Beispiel als Klammer um beide Übungen.

### Neues Design (eigener Branch)
Die Oberfläche wirkt zu sehr nach Vibe-Coding. Die ganze UI wird überarbeitet. Vorher sammeln, was am meisten stört, und Apps mit einem Look, der gefällt.

## Coach & Integrationen

### Coach-Server auf dem Oracle-Server (Always Free)
Ziel: Den Coach jederzeit vom Handy aus nutzen können, auch wenn der Laptop aus ist.
- Machbar: Eine Always-Free-VM bei Oracle reicht dafür.
- Der MoLog-MCP-Server bekommt einen HTTP-Einstiegspunkt. Die Logik ist schon vom Transport getrennt (`mcp/src/core`).
- Nötig ist eine Anmeldung per OAuth, damit claude.ai und die Claude-Handy-App den Server als „Custom Connector“ einbinden können. Jeder Benutzer meldet sich mit dem eigenen App-Konto an, auch Freunde.
- Der Garmin-MCP-Server müsste ebenfalls dorthin ziehen. Dabei prüfen, ob der Garmin-Login von einer Server-IP aus stabil bleibt.
- HTTPS (eigene Domain oder Subdomain, z. B. über Caddy) und Updates einplanen.

### Pausen-Timer genauer machen
Die Mitteilung kommt teils spürbar später als nach den eingestellten 2 Minuten. Sie wird nicht per E-Mail verschickt, sondern per Web Push über Apple. Die Verzögerung kommt aus mehreren Stellen:
- Der Cron-Job in Supabase schaut nur alle 5 Sekunden nach.
- Die Edge Function braucht beim ersten Aufruf etwas Startzeit.
- Apple stellt die Mitteilung nicht immer sofort zu.

Ideen:
- Zuerst messen: Zeitstempel für „fällig“, „verschickt“ und „angekommen“ loggen, um zu sehen, woher die Verzögerung wirklich kommt.
- Nach dem Oracle-Umzug: Ein kleiner Dienst dort plant jeden Timer sekundengenau ein und schickt den Push direkt. Cron und Edge Function fallen dann weg.
- Notfalls doch eine dezente Restzeit in der App, z. B. klein in der Satz-Zeile. Das widerspricht aber dem Minimalismus, deshalb nur, wenn die Mitteilung nicht genau genug wird.

### Sätze zu Strava übertragen
Garmin lädt Gym-Sessions automatisch zu Strava hoch, ohne Sätze. Deshalb bleiben sie bisher privat.
- Die offizielle Strava-API erlaubt es, die Beschreibung einer Aktivität zu ändern. Die Übungen und Sätze aus MoLog landen dann in der Beschreibung der passenden Aktivität. Zugeordnet wird über die Startzeit.
- Ob die Aktivität danach öffentlich wird, bleibt deine Entscheidung. Auf Wunsch kann die App sie auch direkt öffentlich stellen.
- Läuft am besten auf dem Server, also nach dem Oracle-Umzug, entweder automatisch nach dem Training oder per Knopf in der App.
- Hinweis: Neue Strava-API-Apps sind anfangs nur für den eigenen Account freigeschaltet. Für Freunde braucht es eine Freigabe durch Strava.

### Sätze zu Garmin zurückschreiben
- Das geht nur über die inoffizielle Garmin-Connect-API. Sie kann jederzeit brechen, und Garmin sieht das nicht gern.
- Weg: Die vorhandene Kraft-Aktivität per Startzeit finden und dort die Sätze (Übung, Gewicht, Wdh) eintragen.
- Niedrigere Priorität als Strava, weil Strava eine offizielle API hat.

## Später / offen

- **Muskelgruppen pro Übung:** Sie ersetzen dann die Schätzung aus dem Namen im Coach-Server. Volumen pro Muskelgruppe wird auch in der App sichtbar.
- **Pausenzeit pro Übung:** Zum Beispiel kürzer bei Isolationsübungen. Die Standardzeit aus den Einstellungen bleibt.
- **RPE / Notizen pro Satz oder Übung:** Optional und unaufdringlich. Nur einbauen, wenn es wirklich genutzt wird.
- **Datenschutz:** Kontakt-Adresse eintragen (`PRIVACY_CONTACT` in `src/sync/config.ts`).
- **Umbenennen der App:** Name in Manifest, Startseite, README, Mail-Betreff, Repo/Pfad, Supabase-Site-URL und MCP-Server ändern.
- **Volumen pro Woche** als Auswertung in der App.
