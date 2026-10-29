# Ruhe – Meilenstein 11: Abend-Logbuch (Design)

Stand: 29.10.2026 · Etappe C des Energie-Ausbaus (Übersicht: Spec M9 §1) · baut auf M10 „Morgen-Start“ (main 6411446) auf.

## 1. Ziel & Rahmen

Ein kurzer, geführter Abschluss des Tages: sehen, was Energie gegeben und was sie gekostet hat, prüfen, was aus dem Morgen geworden ist, eine Erkenntnis festhalten und einen kleinen Schritt für morgen mitnehmen. Sonntags kommt ein Blick auf die ganze Woche dazu. Das dient dem Ziel des Nutzers, seine Energie hochzuhalten und sich stetig weiterzuentwickeln.

**Vom Nutzer entschieden (Brainstorming 29.10.2026):**

1. **Bausteine:**
   - Energie-Bilanz: Geber und Räuber, dazu ein Abend-Check-in.
   - Tagesrückblick.
   - Gelerntes und Wachstum.
   - Kein eigener Schritt zum Abschalten.
2. **Energie-Bilanz:** Stichworte zum Antippen, je Seite. Eigene Stichworte kommen dazu und werden gemerkt.
3. **Platz:**
   - Ab 18 Uhr steht oben auf „Heute“ die Karte „Tag abschließen“.
   - Danach steht dort ein Fazit „Dein Abend“.
   - Zusätzlich ist das Logbuch im Reiter „Energie“ jederzeit startbar.
4. **Tagesrückblick:** Er greift den Morgen-Start auf.
   - Big Domino „geschafft?“ mit demselben Haken wie auf „Heute“.
   - Intention in drei Stufen: kaum, teils, ganz.
   - Ohne Morgen-Start entfällt der Schritt.
5. **Wachstum:**
   - Zwei Sätze: „Was hast du heute gelernt?“ und „Was machst du morgen 1 % besser?“.
   - Der 1-%-Satz erscheint am nächsten Morgen im Morgen-Start.
6. **Wochenrückblick:**
   - Sonntags hängt das Logbuch eine Wochenseite an: stärkste Geber und Räuber, Big Dominos geschafft, Erkenntnisse der Woche, Fokus für nächste Woche.
   - Den Fokus greift der Morgen-Start auf.
   - Jederzeit nachlesbar unter „Deine Woche“.
7. **Dauer:** eine Variante, etwa 3 Minuten (sonntags etwa 5). Jeder Schritt lässt sich überspringen.
8. **Ansatz:** ein geführter Ablauf im Vollbild wie der Morgen-Start (Ansatz A). Er nutzt dessen Rahmen und Eingabe-Bausteine.
9. **Entwürfe:** Artifact „Abend-Logbuch Entwürfe“ (https://claude.ai/artifact/YVBdSgGdX7ttFhWBrYWSau), freigegeben mit „Passt, weiter“. Die Texte dort sind Beispiele. Wörtlich gelten die Texte dieser Spec.
10. **Abschnitte 1–4** des Designs (Ablauf und Ansicht, Inhalte und Texte, Daten und Logik, Technik und Tests) wurden wie vorgestellt freigegeben.

### Erfolgskriterien

- Das Logbuch dauert etwa 3 Minuten, sonntags etwa 5. Jeder Schritt lässt sich mit einem Tipp überspringen.
- Ab 18 Uhr steht „Tag abschließen“ oben auf „Heute“. Nach dem Logbuch steht dort bis 3:59 „Dein Abend“.
- Der Big-Domino-Haken im Rückblick ist derselbe wie auf „Heute“.
- Am nächsten Morgen zeigt der Morgen-Start den 1-%-Satz von gestern und, falls gesetzt, den Wochenfokus.
- Sonntags zeigt das Logbuch die Woche: Top 3 Geber und Räuber, Big Dominos, Erkenntnisse.
- Der Abend-Check-in landet wie jeder Check-in in Akku und Wochenraster.
- Alle neuen Daten überstehen Neuladen, Backup und Import. Alte Daten bleiben gültig.
- Der Morgen-Start verhält sich nach dem Umbau des gemeinsamen Rahmens unverändert. Seine Tests bleiben grün.

### Nicht-Ziele (Etappe C)

- Keine Stimme, keine Push-Benachrichtigungen, kein Server. Die Erinnerung läuft über Wecker oder Kalender (README).
- Kein Schritt zum Abschalten, keine Einschlaf-Meditation im Ablauf.
- Kein Bearbeiten früherer Tage und keine Liste aller früheren Logbücher. Nachlesbar ist nur die Wochenauswertung.
- Keine eigenen Prinzipien und keine Buch-Erkenntnisse (M12).
- Keine Serie, die bei einem verpassten Tag reißt. Gezählt wird nur „an n der letzten 7 Tage“.
- Das Logbuch zählt nicht als Meditation.
- Keine neuen Bilder: Die Karten nutzen das vorhandene Motiv `vorschlag-abend`.

### Quellen und Recht

Es gelten die Regeln von M9 §1 („Quellen und Recht“). Stichworte, Sätze und Fokus sind persönlich. Sie liegen nur lokal auf dem Gerät: nie im Repo, nie in Tests mit echten Daten, nie in Logs und nie in der Medien-Anzeige.

## 2. Was man sieht

### 2.1 „Heute“

Von oben nach unten: Begrüßung, **Abend- bzw. Morgen-Karten**, „Dein Akku“ (M9), „Vorschlag des Tages“, übrige Karten wie bisher.

Welche Karten oben stehen (Ortszeit; „Logbuch-Tag“ nach §4.3):

| Zeit | ohne Logbuch-Eintrag für den Logbuch-Tag | mit Logbuch-Eintrag |
|---|---|---|
| 4:00–10:59 | wie M10: „Guten Morgen“ bzw. „Dein Tag“ | wie M10 |
| 11:00–17:59 | wie M10: „Dein Tag“, falls Morgen-Eintrag | „Dein Abend“ (ersetzt „Dein Tag“) |
| 18:00–23:59 | „Tag abschließen“, darunter „Dein Tag“ (falls Morgen-Eintrag) | „Dein Abend“ (ersetzt „Dein Tag“) |
| 0:00–3:59 | „Tag abschließen“ | „Dein Abend“ |

Zwischen 0:00 und 3:59 gibt es nach M10 kein „Dein Tag“, weil der Kalendertag schon gewechselt hat. Das bleibt so.

**Karte „Tag abschließen“**
- Kleinüberschrift „Tag abschließen“, Titel „Wie war dein Tag?“, Satz „Bilanz ziehen, Gelerntes festhalten, morgen 1 % besser.“
- Motiv `vorschlag-abend` (80 px, `alt=""`).
- Ein gefüllter Knopf „Starten · 3 Min“. Ist der Logbuch-Tag ein Sonntag, heißt er „Mit Wochenrückblick · 5 Min“.
- Goldrand wie die Morgen-Karte.

**Karte „Dein Abend“**
- Kleinüberschrift „Dein Abend“, Titel „Tag abgeschlossen“, Motiv `vorschlag-abend` (64 px, `alt=""`), Goldrand.
- Die folgenden Zeilen erscheinen nur, wenn ausgefüllt:
  - „Hat Energie gegeben“ mit den Stichworten als Marken
  - „Hat Energie gekostet“ mit den Stichworten als Marken
  - „Big Domino geschafft: {Text}“ bzw. „Big Domino offen: {Text}“, nach dem Morgen-Eintrag des Logbuch-Tages
  - „Gelernt: {Satz}“
  - „Morgen 1 % besser: {Satz}“
  - „Wochenfokus: {Wort}“
- Ist nichts davon da, steht unter dem Titel „Logbuch erledigt.“
- Zuletzt die Zeile „Logbuch an {n} der letzten 7 Tage“.
- Die Marken für Geber und Räuber unterscheiden sich in Farbe und Helligkeit. Die Bedeutung trägt immer die Überschrift. Alle Texte erreichen mindestens 4,5:1 in allen drei Stimmungen.

Beide Karten rechnen beim Fortsetzen der App neu, über die Minuten-Uhr `appNow()` (M9 R15). Der Wechsel um 18:00, 0:00 und 4:00 geschieht also ohne Neuladen.

### 2.2 Reiter „Energie“

**Karte „Abend-Logbuch“**
- Sie steht direkt unter der Karte „Morgen-Start“.
- Kleinüberschrift „Abend-Logbuch“, Titel „Tag abschließen“, Satz „Jederzeit Bilanz ziehen.“, Knopf „Starten“.
- Gibt es für den Logbuch-Tag schon einen Eintrag, steht statt des Satzes „Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.“

**„Deine Woche“** bekommt unten den Abschnitt „Wochenrückblick“. Er erscheint, sobald es unter dem Logbuch-Tag und den sechs Tagen davor mindestens einen Logbuch-Eintrag gibt. Inhalt wie die Wochenseite (§2.3, Schritt 7), aber ohne Eingabe. Gibt es einen gültigen Wochenfokus (§4.3), steht darunter „Wochenfokus: {Wort}“.

### 2.3 Der Ablauf

Der Ablauf ist ein Vollbild mit dem Dialognamen „Abend-Logbuch“, gezeichnet wie der Morgen-Start (Himmel der aktuellen Stimmung).

**Kopfzeile:**
- links „×“ mit dem Namen „Abend-Logbuch beenden“
- in der Mitte die Fortschrittspunkte mit dem Namen „Schritt {i} von {n}“
- rechts „Überspringen“

Bei jedem Schrittwechsel erhält die Überschrift des neuen Schritts den Fokus.

**Beenden:** „×“, die Zurück-Geste und Escape öffnen die Rückfrage „Abend-Logbuch beenden?“ mit „Beenden“ und „Weiter machen“, wie beim Morgen-Start. Im Abschluss schließt „Fertig“ ohne Rückfrage.

**Schritte.** Der Logbuch-Tag, der Sonntag und das Vorhandensein des Rückblicks werden beim Öffnen festgelegt und gelten bis zum Schließen.

| # | Schritt | wann |
|---|---|---|
| 1 | Check-in | immer |
| 2 | Geber | immer |
| 3 | Räuber | immer |
| 4 | Rückblick | nur, wenn der Morgen-Eintrag des Logbuch-Tages einen Big Domino oder eine Intention hat |
| 5 | Gelernt | immer |
| 6 | 1 % besser | immer |
| 7 | Woche | nur, wenn der Logbuch-Tag ein Sonntag ist |
| danach | Abschluss | immer, ohne Punkt |

Die Punkte zählen nur die vorhandenen Schritte. Sonntags mit Rückblick sind es 7, an einem Werktag ohne Morgen-Start 5.

**1 · Check-in**
- Kleinüberschrift „Check-in“, Titel „Wie voll sind deine Akkus jetzt?“, Zeile „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
- Vier Reihen wie im Check-in-Blatt (M9 §3.3).
- „Weiter“ ist aktiv, wenn alle vier gesetzt sind. Es speichert sofort einen normalen Energie-Check-in.

**2 · Geber**
- Kleinüberschrift „Energie-Bilanz“, Titel „Was hat dir heute Energie gegeben?“, Zeile „Tipp alles an, was passt.“
- **„Deine Stichworte“:** Die Gruppe erscheint nur, wenn es eigene gibt. Darin bis zu 8 eigene Stichworte (§4.3), neueste zuerst.
- **„Vorschläge“:** die 12 Stichworte aus §3.1, darunter der Knopf „+ Eigenes“.
- **Antippen:** Jedes Stichwort ist ein Umschalter (`aria-pressed`). Gewählt zeigt es einen Haken und eine Füllung.
- **„+ Eigenes“:** Es öffnet in der Gruppe ein Feld „Eigenes Stichwort“ (bis 30 Zeichen) mit dem Knopf „Hinzufügen“. Enter fügt ebenfalls hinzu.
  - Das neue Stichwort wird gewählt und steht danach vorn unter „Deine Stichworte“.
  - Gleicht es einem vorhandenen Stichwort (Groß- und Kleinschreibung egal), wird das vorhandene gewählt.
- **Obergrenze:** höchstens 20 gewählte Stichworte. Danach sind „+ Eigenes“ und nicht gewählte Stichworte gesperrt.
- Über „Weiter“ steht „{n} gewählt“ bzw. „1 gewählt“ bzw. „Nichts gewählt“. Die Zeile ändert sich nur beim Antippen und wird dann angesagt.
- „Weiter“ ist immer aktiv, auch ohne Auswahl.

**3 · Räuber**
- Wie Geber, mit dem Titel „Was hat dich heute Energie gekostet?“ und den Stichworten der Räuber-Liste.
- Eigene Stichworte werden je Seite getrennt gemerkt.

**4 · Rückblick**
- Kleinüberschrift „Rückblick“, Titel „Was ist aus deinem Morgen geworden?“
- **Block „Big Domino“:** nur, wenn einer gesetzt ist.
  - Kleinüberschrift „Big Domino“, darunter der Text.
  - Knopf „Geschafft“ als Umschalter (`aria-pressed`, mit Haken, wenn gesetzt).
  - Er schaltet sofort `dominoDone` am Morgen-Eintrag des Logbuch-Tages, genau wie der Haken auf „Dein Tag“.
- **Block „Intention“:** nur, wenn eine gesetzt ist.
  - Kleinüberschrift „Intention“, darunter der Satz vom Morgen (M10: „Heute will ich {Wort} sein.“).
  - Darunter „Wie gut ist es dir gelungen?“ als Radiogruppe mit „kaum“, „teils“ und „ganz“.
  - Ein zweiter Tipp auf die gewählte Stufe nimmt die Wahl zurück.

**5 · Gelernt**
- Kleinüberschrift „Gelernt“, Titel „Was hast du heute gelernt?“, Zeile „Eine Erkenntnis, ein Satz reicht.“
- Mehrzeiliges Feld mit dem Namen „Was hast du heute gelernt?“, Platzhalter „z. B. Pausen machen mich schneller.“
- Bis 120 Zeichen, Zähler „{n} / 120“. Eingabe über den Eingabe-Helfer aus M10 (Kürzen nur der Einfügung, Zeilenumbruch wird Leerzeichen).

**6 · 1 % besser**
- Kleinüberschrift „Wachstum“, Titel „Was machst du morgen 1 % besser?“, Zeile „Klein und konkret. Der Morgen-Start erinnert dich daran.“
- Feld wie bei Gelernt, mit dem Platzhalter „z. B. Erst der Big Domino, dann Mails.“
- Bis 80 Zeichen, Zähler „{n} / 80“.

**7 · Woche** (nur sonntags)
- Kleinüberschrift „Wochenrückblick“, Titel „Deine Woche“, Zeile „{T. Monat} bis {T. Monat} · Logbuch an {n} Tagen“, zum Beispiel „23. Oktober bis 29. Oktober · Logbuch an 5 Tagen“.
- **Block „Energie-Bilanz der Woche“**, zwei Spalten:
  - „Geber“ und „Räuber“, je die Top 3 als „{Stichwort} · {n}×“
  - Ist eine Spalte leer: „Noch keine Angaben.“
- **Block „Big Dominos“:**
  - „{a} von {b} geschafft“.
  - Darunter sieben kleine Balken für die Tage, von alt nach neu: gefüllt = geschafft, halb = offen, leer = kein Big Domino. Die Balken sind Schmuck (`aria-hidden`), die Zahl trägt die Aussage.
  - Ohne Big Domino in der Woche: „Diese Woche ohne Big Domino.“ ohne Balken.
- **Block „Gelernt“:** alle Sätze der Woche, neueste zuerst. Ohne Sätze entfällt der Block.
- **„Dein Fokus für nächste Woche“** als Überschrift einer Wortwahl wie bei der Intention (M10 `WordPicker`):
  - „Vorschläge“ aus §3.2 und „Deine Wörter“ (eigene, bis 3, neueste zuerst).
  - Feld „Eigenes Wort“ mit dem Platzhalter „oder eigenes Wort“, bis 40 Zeichen.
- Die Wochenseite rechnet die Angaben dieses Durchgangs schon mit ein (Geber, Räuber, Gelernt des heutigen Logbuch-Tages), auch wenn sie noch nicht gespeichert sind.

**Abschluss**
- Motiv `vorschlag-abend` (96 px), Kleinüberschrift „Tag abgeschlossen“, Titel „Gute Nacht.“, Zeile „Lass den Tag hier liegen. Morgen geht es weiter.“
- Darunter die Zusammenfassung mit denselben Zeilen und Regeln wie die Karte „Dein Abend“ (§2.1), ohne Zählzeile.
- Ein gefüllter Knopf „Fertig“ schließt den Ablauf.
- **Klangschale:** Beim Erreichen des Abschlusses erklingt ein Anschlag der Klangschale wie im Morgen-Start, aber leiser (halbe Lautstärke). Der Anschlag gehört in den Tipp, der zum Abschluss führt.
- **Speichern:** Beim Erreichen des Abschlusses wird der Eintrag gespeichert, auch wenn alles übersprungen wurde (§4.2).

### 2.4 Morgen-Start

Im Schritt „Intention“ (M10) steht über der Kleinüberschrift ein Kasten:
- „Gestern vorgenommen“ mit dem 1-%-Satz aus dem Logbuch des Vortags (§4.3).
- „Wochenfokus“ mit dem gültigen Wochenfokus (§4.3).

Jede Zeile erscheint nur, wenn es den Wert gibt. Gibt es keinen, entfällt der Kasten. Er ist reiner Text ohne Bedienelemente und hat Goldrand wie im Entwurf.

## 3. Inhalte

### 3.1 Stichworte

**Gegeben (12):** Bewegung · Draußen · Gute Gespräche · Fokus-Arbeit · Erfolg · Guter Schlaf · Gutes Essen · Musik · Lernen · Pause · Familie · Lachen

**Gekostet (12):** Wenig Schlaf · Bildschirm · Meetings · Konflikt · Zeitdruck · Unterbrechungen · Grübeln · Schweres Essen · Lärm · Viel Sitzen · Alkohol · Nachrichten

Reihenfolge wie hier. Eigene Stichworte: getrimmt, 1–30 Zeichen.

### 3.2 Fokus-Vorschläge

Dranbleiben · Mehr Schlaf · Mehr Bewegung · Weniger Bildschirm · Erst das Wichtige · Mehr Pausen

Eigene Fokus-Wörter: getrimmt, 1–40 Zeichen.

## 4. Daten und Logik

### 4.1 Speicher

In `localStorage['ruhe.v1']`; `version` bleibt 1. Neu ist die freiwillige Liste `evenings`. Sie fehlt, solange sie leer ist, und ist nach `day` sortiert.

```ts
interface EveningEntry {
  day: string                  // Logbuch-Tag 'YYYY-MM-DD' (§4.3); je Tag höchstens ein Eintrag
  at: string                   // ISO-Zeitpunkt, an dem der Abschluss erreicht wurde
  gave?: string[]              // 1–20 Stichworte, je getrimmt 1–30 Zeichen, ohne Doppelte (Groß/klein egal)
  cost?: string[]              // wie gave
  intentionScore?: 'kaum' | 'teils' | 'ganz'
  learned?: string             // getrimmt, 1–120 Zeichen
  better?: string              // getrimmt, 1–80 Zeichen
  weekFocus?: string           // getrimmt, 1–40 Zeichen; nur an einem Sonntag als Logbuch-Tag
}
```

**Laden:**
- Jeder Eintrag wird einzeln geprüft. Ungültige Einträge (ohne gültigen `day` oder `at`) fallen weg, die übrigen bleiben.
- Zu lange Texte werden gekürzt (in Code-Punkten, wie M10), leere entfallen.
- In Listen fallen leere und doppelte Stichworte weg, nach 20 ist Schluss. Eine leere Liste entfällt.
- Ein unbekannter `intentionScore` entfällt. Ein `weekFocus` an einem Tag, der kein Sonntag ist, entfällt.
- Gibt es zwei Einträge für einen Tag, gilt der mit dem späteren `at`.

### 4.2 Speichern

- **Wann:** Beim Erreichen des Abschlusses, auch wenn alle Schritte übersprungen wurden. Der Tag ist der beim Öffnen festgelegte Logbuch-Tag.
- **Zweiter Durchgang am selben Logbuch-Tag:** Er ersetzt den Eintrag.
- **Was sofort gespeichert wird:**
  - Der Check-in aus Schritt 1 ist ein normaler `energyCheckins`-Eintrag (M9).
  - Der Haken im Rückblick ist `dominoDone` am Morgen-Eintrag des Logbuch-Tages (M10 `toggleDomino(day)`).
- **Beenden vor dem Abschluss:** Es entsteht kein Logbuch-Eintrag. Check-in und Haken bleiben.

### 4.3 Abgeleitete Werte (reine Funktionen, `now` als Eingabe)

- **`logbookDay(now)`:** der Kalendertag von `now`. Vor 4:00 ist es der Vortag. Gerechnet wird im Kalender, sodass Zeitumstellungstage richtig zählen.
- **`isSunday(day)`:** ob ein Logbuch-Tag ein Sonntag ist.
- **`eveningCard(evenings, now)`:**
  - `null` von 4:00 bis 10:59;
  - sonst `'dein-abend'`, wenn es einen Eintrag für `logbookDay(now)` gibt;
  - sonst `'tag-abschliessen'` von 18:00 bis 3:59;
  - sonst `null`.
  - „Heute“ zeigt bei `'dein-abend'` kein „Dein Tag“ (§2.1).
- **`hasReview(mornings, day)`:** ob der Morgen-Eintrag von `day` einen Big Domino oder eine Intention hat.
- **`eveningSteps(hasReview, sunday)`:** die Schrittliste nach §2.3.
- **`ownTags(evenings, side)`:**
  - die Stichworte einer Seite, die nicht in der Liste von §3.1 stehen (Groß- und Kleinschreibung egal);
  - neueste zuerst, ohne Doppelte, höchstens 8;
  - Schreibweise des jüngsten Vorkommens.
- **`ownFocus(evenings)`:** wie `ownTags` für `weekFocus` gegen §3.2, höchstens 3.
- **`weekReview(evenings, mornings, day, draft?)`:** über `day` und die sechs Tage davor. `draft` ersetzt den Eintrag von `day`.
  - **Geber und Räuber:** je Stichwort die Zahl der Tage, an denen es gewählt war. Sortiert nach Zahl, dann nach dem jüngsten Tag, dann alphabetisch (`localeCompare('de')`). Ausgegeben werden die Top 3.
  - **Big Dominos:** je Tag `'geschafft' | 'offen' | 'keiner'` aus den Morgen-Einträgen, dazu `a` (geschafft) und `b` (gesetzt).
  - **Gelernt:** alle `learned`, neueste zuerst.
  - **`days`:** die Zahl der Tage mit Logbuch-Eintrag (inklusive `draft`).
- **`morningReminder(evenings, now)`:**
  - **`better`:** aus dem Eintrag für den Kalendertag vor `dayKey(now)`.
  - **`weekFocus`:** aus dem jüngsten Eintrag mit `weekFocus`, dessen Tag 1 bis 7 Tage vor `dayKey(now)` liegt.
  - Ein am Sonntag gesetzter Fokus gilt also von Montag bis einschließlich zum nächsten Sonntag.
- **`eveningCount(evenings, now)`:** die Zahl der Tage mit Eintrag unter `logbookDay(now)` und den sechs Tagen davor.
- **`eveningCountLine(n)`:** „Logbuch an {n} der letzten 7 Tage“.

### 4.4 Backup und Import

- `evenings` gehört ins Backup.
- **Import:** Er führt je Tag zusammen. Bei gleichem Tag gilt der spätere `at`, und ein gleicher Eintrag zählt nicht als neu.
- **Meldung:** Neue Logbuch-Einträge zählen in die bestehende Energie-Meldung („Dazu {n} neue Energie-Einträge.“, M9).
- Ein altes Backup ohne `evenings` lässt die Logbuch-Einträge des Geräts unverändert.

### 4.5 Statistik

Das Logbuch zählt nicht in Sitzungen, Minuten, Serie, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in. Der Abend-Check-in zählt wie jeder Energie-Check-in.

## 5. Technik

| Teil | Ort | Inhalt |
|---|---|---|
| Inhalte | `src/lib/evening/words.ts` | Listen aus §3.1/§3.2, Grenzen `TAG_MAX = 30`, `TAGS_MAX = 20`, `LEARNED_MAX = 120`, `BETTER_MAX = 80`, `FOCUS_MAX = 40` |
| Logik | `src/lib/evening/logic.ts` | Funktionen aus §4.3, `EVENING_FROM = 18`, Tagesgrenze 4 Uhr (aus M10 `MORNING_FROM`) |
| Daten | `src/lib/stats/schema.ts`, `persist.ts`, `backup.ts`, `store.svelte.ts` | `EveningEntry`, `parseEvening(s)`, `withEvening(data, input, now)`, `mergeEvenings`, `saveEvening(input)` |
| Gemeinsamer Rahmen | `src/components/flow/FlowFrame.svelte` | Kopfzeile (×, Punkte, Überspringen), Rückfrage beim Beenden, Ebene mit Zurück-Geste und Escape, Fokus auf die Überschrift beim Schrittwechsel, Doppeltipp-Schutz der Kopfknöpfe |
| Ablauf-Zustand | `src/lib/ui/evening-ui.svelte.ts` | offen, Logbuch-Tag, Sonntag, Schritte, Schritt, Entwurf der Eingaben, Rückfrage |
| Oberfläche | `src/components/evening/…` | `EveningFlow` (Vollbild im `FlowFrame`), je ein Baustein pro Schritt, `TagPicker` (Mehrfachwahl mit eigenen Stichworten), `EveningDone`, `EveningTodayCard`, `EveningStartCard`, `WeekReview` |
| Einbau | `Heute.svelte`, `Energie.svelte`, `WeekCard.svelte`, `App.svelte`, `IntentionStep.svelte` | Karten, Wochenabschnitt, Ablauf an der App-Wurzel außerhalb von `inert`, Kasten im Morgen-Start |

**Gemeinsamer Rahmen.**
- `MorningFlow` (M10) wird auf `FlowFrame` umgestellt. Was den Morgen-Start mit Playern verbindet (verborgen während Übung oder Meditation, `morningPlayerClosed`), bleibt in `MorningFlow`.
- Wiederverwendet werden `CheckinStep` (mit wählbarem Titel), `WordPicker`, der Eingabe-Helfer `limitedInput` und `playChime` (mit wählbarer Lautstärke).
- Bauteile, die beide Abläufe nutzen, ziehen von `src/components/morning/` nach `src/components/flow/`.

**Kein Player im Abend-Ablauf.** Er startet weder Übung noch Meditation. Die Übergabe-Logik von M10 wird dafür nicht gebraucht.

**„Jetzt“:** Alle Ansichten rechnen mit der Minuten-Uhr `appNow()` (M9 R15).

**Keine Kosten:** keine Bild- oder Sprach-Generierung.

## 6. Grenzfälle

| Fall | Erwartung |
|---|---|
| App wird um 18:02 aus dem Hintergrund fortgesetzt | „Tag abschließen“ erscheint ohne Neuladen |
| Logbuch um 23:50 begonnen, Abschluss um 0:05 | Eintrag gehört zum Vortag (Logbuch-Tag beim Öffnen); „Dein Abend“ steht bis 3:59 |
| Logbuch um 3:58 begonnen, Abschluss um 4:02 | Eintrag gehört zum Vortag; ab 4:00 zeigt „Heute“ den Morgen |
| Montag 0:30, Logbuch des Sonntags | mit Wochenseite; Wochenfokus gilt ab dem Montagmorgen |
| Logbuch um 14:00 aus „Energie“ | „Dein Abend“ ersetzt ab sofort „Dein Tag“ |
| Kein Morgen-Start an diesem Tag | kein Rückblick-Schritt, 5 Punkte (sonntags 6) |
| Morgen-Start nur mit Intention | Rückblick zeigt nur den Intention-Block |
| Haken im Rückblick gesetzt, dann beendet | Haken bleibt, kein Logbuch-Eintrag |
| Zweiter Durchgang am selben Logbuch-Tag | ersetzt den Eintrag; die Wochenzählung zählt den Tag einmal |
| Eigenes Stichwort „bewegung“ | wählt den Vorschlag „Bewegung“, kein Doppel |
| 20 Stichworte gewählt | übrige Stichworte und „+ Eigenes“ gesperrt, gewählte lassen sich abwählen |
| 30-Zeichen-Stichwort ohne Leerzeichen, 360 px, 130 % Schrift | bricht um, kein seitliches Scrollen (Ablauf, Karte, Wochenseite) |
| Zeitumstellung in der Woche | genau sieben Kalendertage, Tagesgrenze 4 Uhr bleibt |
| Neuladen mitten im Ablauf | Ablauf ist zu; Check-in und Haken bleiben; kein Logbuch-Eintrag |
| Backup zweimal importiert | keine Doppelten, keine Meldung über neue Logbuch-Einträge beim zweiten Mal |

## 7. Tests

- **Unit, `tests/unit/evening-logic.test.ts` (TZ Europe/Berlin):**
  - `logbookDay` an 3:59, 4:00, 0:00, an beiden Umstellungstagen
  - `eveningCard` an 3:59, 4:00, 10:59, 11:00, 17:59, 18:00, 0:30, mit und ohne Eintrag
  - `eveningSteps` mit und ohne Rückblick bzw. Sonntag
  - `ownTags` und `ownFocus`: Doppelte, Groß- und Kleinschreibung, Grenzen 8 und 3, Vorschläge ausgeschlossen
  - `weekReview`: Rangfolge mit Gleichstand, `draft` ersetzt den Tag, Dominos, Woche über die Umstellung
  - `morningReminder`: Vortag, Fokus 1 und 7 Tage alt sowie 0 und 8 Tage alt
  - `eveningCount`
- **Unit, Daten:**
  - Laden kaputter, doppelter und zu langer Einträge; Listen mit Doppelten und mehr als 20 Einträgen; `weekFocus` an einem Werktag
  - `withEvening` ersetzt den Eintrag
  - Import ohne Doppelte, neuerer `at` gewinnt, altes Backup, Meldung zählt mit
- **Browser:**
  - `evening-ui`: Schrittliste festgelegt beim Öffnen, Weiter und Überspringen, Abschluss speichert und spielt die Klangschale, Beenden speichert nichts
  - `TagPicker`: Umschalten, Eigenes hinzufügen, Doppel, Grenze 20
  - `FlowFrame`: Rückfrage, Escape, Fokus
- **E2E, `tests/e2e/abend.spec.ts`** (`page.clock.setFixedTime` erlaubt, weil im Abend-Ablauf kein Programm läuft; M9 R1 gilt weiter für alles mit Programmen):
  - Karte um 20:00 sichtbar, um 17:59 nicht, um 0:30 noch, um 4:00 nicht mehr
  - ganzer Ablauf mit Morgen-Eintrag: Check-in, Geber mit eigenem Stichwort, Räuber, Haken und Stufe im Rückblick, Gelernt, 1 % besser
  - danach „Dein Abend“ mit allen Angaben, gespeicherter Eintrag, Check-in und `dominoDone`
  - Sonntag: Wochenseite mit Top 3 aus vorbereiteten Einträgen, Fokus wählen; „Deine Woche“ zeigt den Wochenrückblick
  - nächster Morgen: Kasten „Gestern vorgenommen“ und „Wochenfokus“ im Intention-Schritt
  - Beenden mit Rückfrage: kein Eintrag, Check-in bleibt; Zurück-Geste und Escape wie „×“
  - Doppeltipp auf „Weiter“ und „Fertig“ trifft nichts darunter
  - 360 px und 130 % ohne seitliches Scrollen
  - Backup exportieren und importieren
- **E2E, bestehende Tests:**
  - `morgen.spec.ts` und `morgen-heute.spec.ts` bleiben nach dem Umbau des Rahmens ohne inhaltliche Änderung grün.
  - Tests, die Karten auf „Heute“ zählen oder ordnen, bekommen eine feste Uhrzeit.
  - Ein zusätzlicher Lauf der ganzen Suite mit Abend-Ortszeit (wie M10 R12) zeigt, dass die Abend-Karte nichts stört.

## 8. Abnahme (Handy-Checkliste Meilenstein 11)

1. Ab 18 Uhr steht „Tag abschließen“ oben auf „Heute“, auch wenn die App im Hintergrund war; vor 18 Uhr nicht.
2. Das Logbuch dauert etwa 3 Minuten, jeder Schritt lässt sich überspringen.
3. Geber und Räuber antippen, ein eigenes Stichwort anlegen. Beim nächsten Mal steht es vorn.
4. Der Rückblick zeigt den Big Domino vom Morgen. „Geschafft“ hakt ihn auch auf „Heute“ ab.
5. Nach dem Abschluss mit Klangschale zeigt „Heute“ „Dein Abend“, bis 3:59 Uhr.
6. Am nächsten Morgen steht „Gestern vorgenommen“ im Morgen-Start.
7. Sonntags kommt die Wochenseite, und der gewählte Fokus steht ab Montag im Morgen-Start.
8. Der Wochenrückblick steht auch unter „Energie“ → „Deine Woche“.
9. Backup exportieren und importieren: Logbuch-Einträge bleiben, nichts doppelt.
10. Eine Wecker-Erinnerung für den Abend ist nach README eingerichtet.

## 9. Annahmen

- 18:00 als Beginn des Abend-Fensters und 4:00 als Tagesgrenze passen zum Tagesrhythmus des Nutzers. Die Werte stehen als Konstanten in `logic.ts`.
- Eigene Stichworte und Fokus-Wörter werden aus den Einträgen abgeleitet, nicht als Einstellung gespeichert.
- Die Klangschale im Abschluss ist erwünscht, leiser als am Morgen. Ist sie nicht geladen, bleibt es still, ohne Hinweis.
- Der Wochenrückblick folgt der Kalenderwoche nicht. Er umfasst immer den Logbuch-Tag und die sechs Tage davor.
