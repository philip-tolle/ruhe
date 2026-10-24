# Ruhe – Meilenstein 8: Eigene Atemmuster

Stand: 24.10.2026. Ergänzt die Haupt-Spec (`2026-10-21-ruhe-design.md`, §3.3 Atmen).

## 1. Ziel und Rahmen

**Vom Nutzer:** „weitere geführte Meditationen und eigene Atemmuster“; die Meditationen kamen zuerst (Meilenstein 7). Für diesen Meilenstein: „Mach einfach mal und zieh bis zum Schluss durch“. Entwurf, Spec, Plan, Umsetzung, Review, Pull Request und Veröffentlichung laufen deshalb ohne Zwischenfragen; die Entscheidungen unten sind Annahmen des Entwurfs, die der Nutzer auf dem Handy prüft (Checkliste §10).

**Ziel:** Unter „Atmen“ eigene Rhythmen anlegen, benennen, ändern und löschen. Eine eigene Übung startet und läuft wie eine der sechs festen: gleiche Dauer-Auswahl, Atemgeräusch, Hintergrund, Blüte, Vibration, Statistik, Ruhe-Check-in, „Zuletzt genutzt“ und Backup.

**Erfolg:**
- Ein Muster ist in unter einer halben Minute angelegt und gestartet.
- Es übersteht Neuladen, Update und Backup mit Import auf einem anderen Gerät.
- Ein gelöschtes Muster hinterlässt keinen Fehler: Statistik und „Zuletzt genutzt“ bleiben benutzbar.

### Nicht-Ziele

- Keine frei zusammengesetzten Phasenlisten, kein eigener Text je Phase, kein Nachatmen und keine Wechselatmung. Es gibt genau vier Phasen in fester Reihenfolge (§2).
- Kein Ändern der sechs festen Übungen.
- Keine gemalten Motive oder Waschungen je eigenem Muster, keine neue Generierung, keine Kosten.
- Kein Teilen von Mustern (außer über das Backup), keine Vorlagen-Bibliothek.
- Kein „Ausprobieren“ im Editor: Gestartet wird aus der Liste.

## 2. Das Muster

Ein eigenes Muster hat einen Namen und vier Phasen in dieser Reihenfolge:

| Phase | Feld | Bereich | Standard |
|---|---|---|---|
| Einatmen | `inhale` | 2–15 s | 4 s |
| Halten (nach dem Einatmen) | `holdIn` | 0–20 s | 2 s |
| Ausatmen | `exhale` | 2–20 s | 6 s |
| Halten (nach dem Ausatmen) | `holdOut` | 0–20 s | 0 s |

- **Schritt:** 0,5 s. Werte sind immer Vielfache von 0,5 innerhalb des Bereichs.
- **Phasen mit 0 s entfallen.** 4-0-6-0 läuft als Einatmen 4 s und Ausatmen 6 s.
- **Name:** freier Text, vorn und hinten ohne Leerzeichen, höchstens 30 Zeichen. Leer heißt das Muster „Eigenes Muster“.
- **Kennung:** `eigen-` und 8 Hex-Zeichen (z. B. `eigen-3fa94c1d`). Sie entsteht beim Anlegen und ändert sich beim Bearbeiten nicht.
- **Beschreibung** (wie bei den festen Übungen, für Player und Liste): die Phasen über 0 s, mit „ · “ getrennt, Sekunden mit Komma. Zum Beispiel „Einatmen 4 s · Halten 2 s · Ausatmen 6 s“ oder „Einatmen 4,5 s · Ausatmen 5,5 s“.
- **Anzahl:** höchstens 6 eigene Muster. Beim sechsten verschwindet „Neues Muster“, stattdessen steht dort „Höchstens 6 eigene Muster.“
- **Atemstand im Ablauf:** Einatmen führt zu 1, Halten behält den Stand, Ausatmen führt zu 0. Ein Zyklus beginnt und endet bei 0, wie bei den festen Mustern.

## 3. „Atmen“

Unter den sechs Kacheln folgt der Abschnitt **„Eigene Muster“** mit einer Überschrift (h2) und einer Karte.

- **Ohne Muster:** Die Karte zeigt den Satz „Stell dir deinen eigenen Rhythmus zusammen.“ und den Knopf „Neues Muster“.
- **Mit Mustern:** je Muster eine Zeile, durch feine Goldlinien getrennt wie die „Aktivitäten“ auf „Heute“.
  - **Zeile:** Sie ist ein Knopf mit dem Namen „{Name} starten“. Er zeigt den Namen (Fraunces) und darunter leise die Beschreibung.
  - **Bearbeiten:** Rechts daneben steht ein eigener Knopf mit Stift-Symbol, Name „{Name} bearbeiten“, mindestens 48 × 48 px.
  - **Reihenfolge:** die des Anlegens.
- **Darunter:** der Knopf „Neues Muster“ (Umrissknopf), oder beim sechsten Muster der Hinweis.
- **Start:** mit der oben gewählten Dauer und dem gemeinsamen Hintergrundklang. Gemerkt wird `lastUsed = { kind: 'breath', pattern: <Kennung>, minutes }`, genau wie bei den Kacheln.

## 4. Editor

Der Editor ist ein Blatt (Sheet) wie die Timer-Einstellungen, mit der Überschrift „Neues Muster“ bzw. „Muster bearbeiten“. Zurück-Geste, Tippen daneben und Escape schließen ihn ohne Speichern.

- **Name:** Textfeld „Name“ mit Platzhalter „Eigenes Muster“ und `maxlength` 30.
- **Vier Regler:** einer je Phase, beschriftet „Einatmen“, „Halten nach dem Einatmen“, „Ausatmen“ und „Halten nach dem Ausatmen“.
  - **Aufbau:** je ein Knopf „−“ (Name „{Phase} kürzer“), der Wert („4 s“, „5,5 s“, „0 s“) und ein Knopf „+“ (Name „{Phase} länger“), alle Knöpfe mindestens 48 px.
  - **Grenzen:** An der Grenze ist der Knopf gesperrt (`disabled`).
  - **Ansage:** Der Wert steht in einem Element mit `aria-live="polite"`.
- **Vorschau:** „Ein Atemzug dauert 12 s, etwa 5 pro Minute.“
  - Die Zahl pro Minute ist 60 geteilt durch den Zyklus, auf eine Nachkommastelle gerundet, mit Komma und ohne „,0“.
- **Knöpfe:** „Speichern“ (Hauptknopf). Beim Bearbeiten zusätzlich „Löschen“ (Umrissknopf), mit Rückfrage über den vorhandenen Bestätigungsdialog:
  - Titel: „Muster löschen?“
  - Text: „„{Name}“ verschwindet aus der Liste. Deine bisherigen Sitzungen bleiben in der Statistik.“
  - Knöpfe: „Löschen“ und „Behalten“.
- **Nach dem Speichern bzw. Löschen** schließt das Blatt, und die Liste zeigt den neuen Stand.
- **Neues Muster** öffnet mit den Standardwerten aus §2 und leerem Namen. **Bearbeiten** öffnet mit den Werten des Musters.

## 5. Ablauf und Player

- **Ablauf:** Plan und Anzeige rechnen mit dem Muster selbst, nicht mehr mit einer festen Kennung. Für eigene Muster gilt dieselbe Berechnung wie für die festen: ganze Zyklen, der laufende Zyklus wird zu Ende geführt, das Atemgeräusch spielt bei Ein und Aus, Halten bleibt still.
- **Player:**
  - Titel: Name des Musters (Medientitel „Atmen · {Name}“).
  - Unter dem Titel: die Beschreibung.
  - Phasen-Text: „Einatmen“, „Halten“, „Ausatmen“.
- **Abschluss:** Statistik und Ruhe-Check-in wie bisher. Die Sitzung trägt `kind: 'breath'` und `ref = <Kennung>`.

## 6. „Heute“ und „Zuletzt genutzt“

- **Gemerktes eigenes Muster:**
  - Zusammenfassung: „{Name} · 3 Min“.
  - „Erneut starten“ startet es mit den gemerkten Minuten und den aktuellen Atem-Einstellungen.
  - Die Waschung der Karte ist die Farbe der Tageszeit, weil eigene Muster keine eigene Farbe haben.
- **Gelöschtes Muster:** Gilt als unbekannt, wie eine Meditation, die der Katalog nicht kennt. Die Karte bietet dann „Ankommen im Atem“ mit „Jetzt starten“ an.
- **Zeile „Atemübung“ in den „Aktivitäten“:** bleibt Kohärentes Atmen, 3 Minuten.

## 7. Daten

- **Speicherort:** `ruhe.v1` bekommt das Feld `breathPatterns`, eine Liste von `{ id, name, inhale, holdIn, exhale, holdOut }`.
  - Ohne eigene Muster fehlt das Feld, wie `lastUsed`.
  - `version` bleibt 1, ältere Stände laden unverändert.
- **Prüfung beim Laden:**
  - Ein ungültiges Muster entfällt einzeln, eine doppelte Kennung ebenso (das erste gilt). Der übrige Stand bleibt; Sitzungen und Einstellungen werden deshalb nie verworfen.
  - Ein Name, der kein Text ist, macht das Muster ungültig. Ein zu langer Name wird auf 30 Zeichen gekürzt.
  - Höchstens 50 Muster werden gelesen, der Rest entfällt (Schutz vor kaputten Daten). Die Grenze 6 gilt nur beim Anlegen.
- **`lastUsed` bei Atemübungen:** `pattern` ist eine feste Kennung oder hat die Form `eigen-` und 8 Hex-Zeichen. Ob es das Muster gibt, prüft erst die Anzeige.
- **Backup:**
  - **Export:** Er enthält `breathPatterns`, wenn es Muster gibt.
  - **Import:** Er fügt Muster mit unbekannter Kennung hinzu. Ein Muster mit bekannter Kennung bleibt, wie es auf dem Gerät ist; so verdoppelt ein zweiter Import nichts.
  - **Alte Backups** ohne das Feld importieren wie bisher.
- **Löschen:** Es entfernt nur das Muster. Sitzungen und `lastUsed` bleiben.

## 8. Fehler und Grenzfälle

- **Speichern scheitert** (Speicher voll): Der Stand bleibt im Speicher der App, und es gilt die vorhandene Meldung „saveFailed“ wie bei allen Änderungen.
- **Unbekanntes Muster beim Start:** etwa eine Kennung in „Zuletzt genutzt“, deren Muster es nicht mehr gibt. Dann startet nichts, die Karte zeigt den Ersatz (§6).
- **Sehr kurzer Zyklus** (2 + 2 = 4 s) und **sehr langer Zyklus** (75 s) laufen beide. Bei 1 Minute und 75 s Zyklus dauert die Übung einen Zyklus, also 75 s.
- **Große Schrift und 360 px:** Lange Namen brechen zwischen Wörtern um, und ein langes Wort bricht notfalls darin. Nichts läuft seitlich hinaus.
- **Regler:** Die Regler blockieren den Bildlauf des Blatts nicht.

## 9. Tests

- **Unit:**
  - Umwandlung in ein Atemmuster: Phasen, 0-s-Phasen entfallen, Beschreibung, Name-Ersatz.
  - Regler-Schritte und Grenzen.
  - Prüfung beim Laden: gültig, ungültig einzeln verworfen, doppelt, gekürzter Name, Obergrenze.
  - `lastUsed` mit eigener Kennung.
  - Backup: Export und Zusammenführen ohne Doppelte.
  - Vorschau-Text.
  - „Zuletzt genutzt“: Zusammenfassung, Start und Ersatz bei gelöschtem Muster.
  - Waschung der Tageszeit für eigene Muster.
  - Plan und Anzeige mit einem eigenen Muster, auch 4-0-6-0.
- **E2E:**
  - Anlegen, Liste, Start im Player (Titel, Beschreibung, Phasen-Text), Abschluss.
  - Bearbeiten, Löschen mit Rückfrage, Neuladen.
  - Höchstens 6.
  - „Zuletzt genutzt“ auf „Heute“, auch nach dem Löschen.
  - Zurück-Geste schließt ohne Speichern.
  - 360 px und 130 % Schrift: Knöpfe mindestens 48 px, nichts läuft seitlich hinaus.
- **Alle bisherigen Tests bleiben grün.**

## 10. Handy-Checkliste (für das README)

1. Unter „Atmen“ ein eigenes Muster anlegen (z. B. 4-4-6-2), benennen und speichern: Es steht unter „Eigene Muster“.
2. Es mit 1 Minute starten: Blüte, Text und Atemgeräusch folgen dem eigenen Rhythmus, Halten bleibt still.
3. Das Muster bearbeiten und dann löschen: Die Rückfrage erscheint, danach ist es weg; „Heute“ zeigt bei „Zuletzt genutzt“ wieder „Ankommen im Atem“.
4. Backup exportieren und wieder importieren: Die eigenen Muster sind da, nichts doppelt.
5. Mit großer Systemschrift: Editor und Liste passen, alle Knöpfe sind gut zu treffen.

## 11. Kosten

Keine. Es gibt keine neuen Bilder, keine Vertonung und keine Generierung.
