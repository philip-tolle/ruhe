# Meilenstein 11: Abend-Logbuch – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein geführtes Abend-Logbuch (~3 Min, sonntags ~5) aus Abend-Check-in, Energie-Gebern und -Räubern, Rückblick auf den Morgen, „Gelernt“, „1 % besser“ und sonntags einer Wochenseite. Dazu kommen die Karten „Tag abschließen“ / „Dein Abend“ auf „Heute“, die Karte „Abend-Logbuch“ und der Wochenrückblick im Reiter „Energie“ und ein Erinnerungskasten im Morgen-Start.

**Architecture:**
- **Daten:** eine neue, freiwillige Liste `evenings` in `ruhe.v1`, ein Eintrag je Logbuch-Tag. Prüfen, Speichern und Zusammenführen folgen dem Muster von `mornings` (M10). `sortByDay` und das Zusammenführen je Tag werden dafür generisch.
- **Logik:** reine Funktionen mit `now` bzw. `day` als Parameter in `src/lib/evening/logic.ts`. Listen und Grenzen stehen in `src/lib/evening/words.ts`.
- **Gemeinsamer Rahmen:** Kopfzeile, Rückfrage, Zurück-Geste, Escape und Fokus wandern aus `MorningFlow` in `src/components/flow/FlowFrame.svelte`. `CheckinStep` und `WordPicker` ziehen nach `src/components/flow/` und verlieren ihre Bindung an `morningUi`. Der Morgen-Start verhält sich danach unverändert.
- **Ablauf:** ein Vollbild `EveningFlow` an der App-Wurzel mit Zustand in `src/lib/ui/evening-ui.svelte.ts`. Er startet keinen Player.

**Tech Stack:** Svelte 5 (Runes), TypeScript, Vitest (unit/browser), Playwright (Pixel 7, 412 px; 360-px-Tests setzen den Viewport).

**Spec:** `docs/superpowers/specs/2026-10-29-ruhe-m11-abend-logbuch-design.md`

## Global Constraints

- **Zeiten (Ortszeit):**
  - Tagesgrenze 4:00: Vor 4:00 ist der Logbuch-Tag der Vortag (`DAY_START = MORNING_FROM = 4`).
  - Karte „Tag abschließen“ von 18:00 bis 3:59 (`EVENING_FROM = 18`), solange es für den Logbuch-Tag keinen Eintrag gibt.
  - „Dein Abend“ ab dem Eintrag bis 3:59 des folgenden Morgens, außer 4:00–10:59 (dort gilt M10 unverändert).
  - Logbuch-Tag, Sonntag und Rückblick werden beim Öffnen des Ablaufs festgelegt und gelten bis zum Schließen.
- **Datenstand:**
  - `localStorage['ruhe.v1']`, `version` bleibt 1.
  - `evenings?: EveningEntry[]` fehlt, solange leer, und ist nach `day` sortiert.
  - Je Tag höchstens ein Eintrag; bei zwei gilt der mit späterem `at`. Ein zweiter Durchgang am selben Logbuch-Tag ersetzt den Eintrag.
- **Längen** (Code-Punkte, getrimmt, zu lang wird gekürzt, leer entfällt):
  - Stichwort 30 (`TAG_MAX`), höchstens 20 je Seite (`TAGS_MAX`), ohne Doppelte (Vergleich mit `toLowerCase()`).
  - Gelernt 120 (`LEARNED_MAX`), 1 % besser 80 (`BETTER_MAX`), Wochenfokus 40 (`FOCUS_MAX`).
  - `weekFocus` nur an einem Sonntag als Logbuch-Tag. `intentionScore` nur `'kaum' | 'teils' | 'ganz'`.
- **Sofort gespeichert:** der Check-in (normaler `energyCheckins`-Eintrag) und der Haken im Rückblick (`toggleDomino(day)` aus M10). Alles andere erst beim Erreichen des Abschlusses, auch wenn alles übersprungen wurde.
- **Überspringen** verwirft die Eingabe des aktuellen Schritts (Geber → `gave`, Räuber → `cost`, Rückblick → `intentionScore`, Gelernt → `learned`, 1 % besser → `better`, Woche → `weekFocus`). Der Haken bleibt.
- **Statistik:** Das Logbuch zählt nicht in Sitzungen, Minuten, Serie, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in. Der Abend-Check-in zählt wie jeder Check-in.
- **Backup:** `evenings` im Export; Import je Tag (späteres `at` gewinnt, gleicher Eintrag zählt nicht), neue zählen in `addedEnergy`.
- **„Jetzt“:** Jede neue Ansicht rechnet mit `appNow()` aus `src/lib/ui/tageszeit.svelte.ts`, nie mit einem bloßen `new Date()` im `$derived`.
- **Doppeltipps:** Knöpfe, die an der Stelle eines gerade verschwundenen Knopfs erscheinen, sind mit `tapArming()` geschützt (`src/lib/ui/arming.svelte.ts`). Karten-Knöpfe werden neu scharf, wenn `eveningUi.open` wechselt.
- **E2E:** Im Abend-Ablauf läuft kein Programm, `page.clock.setFixedTime` ist dort erlaubt. Für alles mit Programmen gilt weiter M9 R1 (Echtzeit, kein `page.clock` dazu).
- **Klangschale:** `playChime` mit halber Lautstärke des Morgens (`0.4` statt `0.8`), im Tipp, der zum Abschluss führt.
- **Motiv:** nur das vorhandene `vorschlag-abend` (Karte 80 px, „Dein Abend“ 64 px, Abschluss 96 px, `alt=""`).
- **Privatsphäre:** Stichworte, Sätze und Fokus nur lokal. Tests nur mit erfundenen Daten. Keine Logs, keine Medien-Anzeige.
- **Kosten:** keine Generierung von Bild oder Stimme.
- **Stichworte** (Spec §3.1, Reihenfolge wie hier):
  - `GAVE_TAGS`: Bewegung, Draußen, Gute Gespräche, Fokus-Arbeit, Erfolg, Guter Schlaf, Gutes Essen, Musik, Lernen, Pause, Familie, Lachen
  - `COST_TAGS`: Wenig Schlaf, Bildschirm, Meetings, Konflikt, Zeitdruck, Unterbrechungen, Grübeln, Schweres Essen, Lärm, Viel Sitzen, Alkohol, Nachrichten
  - `FOCUS_SUGGESTIONS` (§3.2): Dranbleiben, Mehr Schlaf, Mehr Bewegung, Weniger Bildschirm, Erst das Wichtige, Mehr Pausen
- **Texte der Oberfläche** (wörtlich, aus Spec §2):
  - **„Heute“, Karte „Tag abschließen“:**
    - Kleinüberschrift „Tag abschließen“, Titel „Wie war dein Tag?“, Satz „Bilanz ziehen, Gelerntes festhalten, morgen 1 % besser.“
    - Knopf „Starten · 3 Min“, an einem Sonntag als Logbuch-Tag „Mit Wochenrückblick · 5 Min“.
  - **„Heute“, Karte „Dein Abend“ (und Zusammenfassung im Abschluss):**
    - Kleinüberschrift „Dein Abend“, Titel „Tag abgeschlossen“.
    - Zeilen „Hat Energie gegeben“, „Hat Energie gekostet“, „Big Domino geschafft: {Text}“ / „Big Domino offen: {Text}“, „Gelernt: {Satz}“, „Morgen 1 % besser: {Satz}“, „Wochenfokus: {Wort}“.
    - Ohne Angaben „Logbuch erledigt.“; Zählung „Logbuch an {n} der letzten 7 Tage“ (nur auf der Karte).
  - **Reiter „Energie“:**
    - Karte: Kleinüberschrift „Abend-Logbuch“, Titel „Tag abschließen“, Satz „Jederzeit Bilanz ziehen.“, Knopf „Starten“. Mit Eintrag: „Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.“
    - „Deine Woche“: Abschnitt „Wochenrückblick“, darunter „Wochenfokus: {Wort}“.
  - **Ablauf, allgemein:**
    - Dialogname „Abend-Logbuch“, „×“ mit dem Namen „Abend-Logbuch beenden“, Fortschritt „Schritt {i} von {n}“, „Überspringen“, „Weiter“.
    - Rückfrage „Abend-Logbuch beenden?“ mit „Beenden“ / „Weiter machen“.
  - **Check-in:** „Check-in“, „Wie voll sind deine Akkus jetzt?“, „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
  - **Geber / Räuber:**
    - Kleinüberschrift „Energie-Bilanz“, Titel „Was hat dir heute Energie gegeben?“ / „Was hat dich heute Energie gekostet?“, Zeile „Tipp alles an, was passt.“
    - Gruppen „Deine Stichworte“, „Vorschläge“; Knopf „+ Eigenes“; Feld „Eigenes Stichwort“ mit Knopf „Hinzufügen“.
    - Zählzeile „Nichts gewählt“ / „1 gewählt“ / „{n} gewählt“.
  - **Rückblick:**
    - „Rückblick“, „Was ist aus deinem Morgen geworden?“
    - Block „Big Domino“ mit Knopf „Geschafft“; Block „Intention“ mit „Heute will ich {Wort} sein.“, „Wie gut ist es dir gelungen?“, Stufen „kaum“, „teils“, „ganz“.
  - **Gelernt:** „Gelernt“, „Was hast du heute gelernt?“, „Eine Erkenntnis, ein Satz reicht.“, Platzhalter „z. B. Pausen machen mich schneller.“, Zähler „{n} / 120“.
  - **1 % besser:** „Wachstum“, „Was machst du morgen 1 % besser?“, „Klein und konkret. Der Morgen-Start erinnert dich daran.“, Platzhalter „z. B. Erst der Big Domino, dann Mails.“, Zähler „{n} / 80“.
  - **Woche:**
    - „Wochenrückblick“, „Deine Woche“, Zeile „{T. Monat} bis {T. Monat} · Logbuch an {n} Tagen“ (bei n = 1 „an 1 Tag“).
    - Blöcke „Energie-Bilanz der Woche“ mit „Geber“ / „Räuber“ und Zeilen „{Stichwort} · {n}×“, leer „Noch keine Angaben.“
    - „Big Dominos“ mit „{a} von {b} geschafft“, ohne Big Domino „Diese Woche ohne Big Domino.“; „Gelernt“.
    - „Dein Fokus für nächste Woche“ mit Gruppen „Vorschläge“ / „Deine Wörter“, Feld „Eigenes Wort“, Platzhalter „oder eigenes Wort“.
  - **Abschluss:** „Tag abgeschlossen“, „Gute Nacht.“, „Lass den Tag hier liegen. Morgen geht es weiter.“, Knopf „Fertig“.
  - **Morgen-Start, Intention:** Kasten mit „Gestern vorgenommen“ und „Wochenfokus“.

## Review Focus

1. **Bestehende Tests am Abend:** `heute.spec.ts` (NOW 20:00), `ich.spec.ts` (20:00), `tageszeit.spec.ts` (20:00), `karten.spec.ts` (Abendzeiten) und `morgen.spec.ts` (23:58) sehen jetzt die Karte „Tag abschließen“ mit gefülltem Knopf. Alles Bestehende muss sich wie vorher verhalten. Tests, die Karten, Überschriften oder gefüllte Knöpfe zählen oder ordnen, werden auf ihren Bereich eingegrenzt oder zählen die neue Karte mit, ohne Prüfungen zu streichen. Im Reiter „Energie“ steht die neue Karte immer (Task 5 und 6).
2. **Logbuch über 0:00 oder 4:00:** Ein Logbuch, das um 23:50 oder am Montag um 0:30 beginnt und nach 0:00 bzw. 4:00 endet, gehört zum beim Öffnen festgelegten Tag. Die Wochenseite erscheint am Montag um 0:30 für den Sonntag. „Heute“ zeigt um 0:30 „Dein Abend“, ab 4:00 den Morgen (Task 4 und 6).
3. **Doppeltipp nach dem Schließen:** „Beenden“ in der Rückfrage und „Fertig“ im Abschluss liegen nach dem Schließen über „Starten · 3 Min“ (Heute) bzw. „Starten“ (Energie). Ein schneller zweiter Tipp darf den Ablauf nicht wieder öffnen (Task 5 und 6).
4. **Haken im Rückblick:** „Geschafft“ zeigt den aktuellen Stand von `dominoDone` aus dem Speicher, schaltet sofort und bleibt nach dem Beenden. „Dein Tag“ und „Dein Abend“ zeigen danach denselben Stand (Task 5).
5. **Lange Eingaben ohne Leerzeichen:** Stichworte mit 30 Zeichen, Sätze mit 120/80 und ein Fokus mit 40 Zeichen brechen im Ablauf, auf „Dein Abend“ und in der Wochenauswertung um. Bei 360 px und 130 % scrollt nichts seitlich (Task 5 und 6).

---

### Task 1: Stichworte und Logbuch-Einträge speichern, laden, sichern

**Files:**
- Create: `src/lib/evening/words.ts`
- Modify:
  - `src/lib/stats/summary.ts`
  - `src/lib/stats/schema.ts`
  - `src/lib/stats/persist.ts`
  - `src/lib/stats/backup.ts`
  - `src/lib/stats/store.svelte.ts`
- Test:
  - `tests/unit/evening-words.test.ts` (neu)
  - `tests/unit/stats-schema.test.ts`
  - `tests/unit/stats-persist.test.ts`
  - `tests/unit/stats-backup.test.ts`
  - `tests/browser/stats-store.test.ts`

**Interfaces:**
- Consumes: `clipText`, `parseList`, `isDayKey`, `isIsoTime` (`schema.ts`); `dayKey` (`summary.ts`); `appNow()`; Muster `withMorning` / `mergeMornings` (M10).
- Produces, in `words.ts`:
  - `GAVE_TAGS`, `COST_TAGS`, `FOCUS_SUGGESTIONS: readonly string[]` (Global Constraints)
  - `TAG_MAX = 30`, `TAGS_MAX = 20`, `LEARNED_MAX = 120`, `BETTER_MAX = 80`, `FOCUS_MAX = 40`
  - `type TagSide = 'gave' | 'cost'`, `tagsOf(side: TagSide): readonly string[]`
- Produces, in `summary.ts`: `isSunday(day: string): boolean` (Kalendertag `JJJJ-MM-TT`, lokal gerechnet).
- Produces, in `schema.ts`:
  - `type IntentionScore = 'kaum' | 'teils' | 'ganz'`, `INTENTION_SCORES: readonly IntentionScore[]`, `isIntentionScore(v: unknown): v is IntentionScore`
  - `interface EveningEntry { day: string; at: string; gave?: string[]; cost?: string[]; intentionScore?: IntentionScore; learned?: string; better?: string; weekFocus?: string }`
  - `interface EveningInput { day: string; gave?: readonly string[]; cost?: readonly string[]; intentionScore?: IntentionScore | null; learned?: string; better?: string; weekFocus?: string }`
  - `AppData.evenings?: EveningEntry[]`
  - `cleanTags(raw: unknown): string[]`: nur Strings, `clipText(…, TAG_MAX)`, leere weg, Doppelte weg (erstes Vorkommen bleibt), höchstens `TAGS_MAX`.
  - `sortByDay<T extends { day: string }>(list: readonly T[]): T[]` (bisher nur für `MorningEntry`; Aufrufer unverändert)
- Produces, in `persist.ts`: `withEvening(data: AppData, input: EveningInput, now: Date): AppData`. Tag `input.day`, `at = now.toISOString()`; ersetzt einen Eintrag desselben Tags; Regeln aus den Global Constraints; leere Listen und Texte entfallen.
- Produces, in `backup.ts`: `evenings` im Export; `mergeBackup` führt sie je Tag zusammen. `mergeMornings` wird zu `mergeByDay<T extends { day: string; at: string }>` und dient beiden Listen. `addedEnergy` zählt neue Logbuch-Einträge mit.
- Produces, in `store.svelte.ts`: `saveEvening(input: EveningInput): EveningEntry` (mit `appNow()`, gibt den gespeicherten Eintrag des Tages zurück).

- [ ] **Step 1: Failing tests:**
  - **`evening-words.test.ts`:** je 12 Stichworte in der Reihenfolge der Global Constraints, 6 Fokus-Vorschläge, keine Doppelten (Vergleich klein geschrieben), jedes ≤ `TAG_MAX` bzw. ≤ `FOCUS_MAX`; `tagsOf('cost')[0] === 'Wenig Schlaf'`.
  - **`stats-schema.test.ts`:**
    - „Logbuch-Einträge werden einzeln geprüft“: `day: '2026-02-30'` und `at: 'gestern'` entfallen, die übrigen bleiben.
    - `gave: ['Bewegung', ' bewegung ', '', 42, 'x'.repeat(40)]` ergibt `['Bewegung', 'x'.repeat(30)]`; 25 verschiedene Stichworte ergeben 20; `gave: []` entfällt.
    - `intentionScore: 'sehr'` entfällt; `learned` mit 150 Zeichen wird auf 120 gekürzt; `better: '  '` entfällt.
    - `weekFocus` an `2026-11-01` (Sonntag) bleibt, an `2026-11-02` entfällt.
    - Zwei Einträge für einen Tag ergeben den mit späterem `at`; die Liste ist nach `day` sortiert; leer fehlt sie.
  - **`stats-persist.test.ts`:**
    - `withEvening` legt `{ day: '2026-10-29', gave: ['Bewegung'], better: 'Früher ins Bett' }` mit `at` = `now` an; `sessions` bleibt unverändert.
    - Ein zweiter Aufruf mit demselben `day` ersetzt ihn (alte Felder sind weg).
    - `intentionScore: null`, leere Listen und leere Texte erscheinen nicht im Eintrag; `weekFocus` an einem Donnerstag entfällt.
  - **`stats-backup.test.ts`:**
    - Der Export enthält `evenings`.
    - Import: neuer Tag zählt 1 in `addedEnergy`; derselbe Eintrag noch einmal zählt 0; ein neuerer Eintrag desselben Tags ersetzt und zählt 1; ein älterer ändert nichts.
    - Ein altes Backup ohne `evenings` lässt die des Geräts unverändert. Die bestehenden Morgen-Tests bleiben grün.
  - **`stats-store.test.ts`:** `saveEvening` speichert in `localStorage`, gibt den Eintrag zurück und erzeugt keine Sitzung.
- [ ] **Step 2:** `npx vitest run tests/unit/evening-words.test.ts tests/unit/stats-schema.test.ts tests/unit/stats-persist.test.ts tests/unit/stats-backup.test.ts` und `npx vitest run --project browser tests/browser/stats-store.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `parseEvening` / `parseEvenings` nach dem Muster von `parseMorning` / `parseMornings`; `withEvening` nach `withMorning`.
- [ ] **Step 4:** dieselben Tests, `npm test`, `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: Logbuch-Einträge speichern, prüfen und sichern`.

### Task 2: Logik des Abend-Logbuchs

**Files:**
- Create:
  - `src/lib/evening/logic.ts`
  - `src/lib/evening/steps.ts`
- Modify: `src/lib/morning/logic.ts` (nur die neue Funktion `intentionSentence`)
- Test:
  - `tests/unit/evening-logic.test.ts` (neu, `process.env.TZ = 'Europe/Berlin'` in der ersten Zeile)
  - `tests/unit/morning-logic.test.ts`

**Interfaces:**
- Consumes: `EveningEntry`, `MorningEntry`, `isSunday`, `dayKey`; Listen aus Task 1; `MORNING_FROM`, `MORNING_UNTIL`.
- Produces, in `steps.ts`:
  - `type EveningStep = 'checkin' | 'geber' | 'raeuber' | 'rueckblick' | 'gelernt' | 'besser' | 'woche' | 'abschluss'`
  - `eveningSteps(review: boolean, sunday: boolean): EveningStep[]`: die Eingabeschritte in Spec-Reihenfolge, ohne `'abschluss'`.
- Produces, in `morning/logic.ts`: `intentionSentence(word: string): string` → `Heute will ich ${word} sein.`
- Produces, in `evening/logic.ts`:
  - `EVENING_FROM = 18`
  - `shiftDay(day: string, delta: number): string` (Kalender, nicht Millisekunden)
  - `logbookDay(now: Date): string`
  - `eveningEntry(evenings: readonly EveningEntry[], day: string): EveningEntry | null` (bei zwei der mit späterem `at`)
  - `eveningCard(evenings: readonly EveningEntry[], now: Date): 'tag-abschliessen' | 'dein-abend' | null` (Spec §4.3)
  - `hasReview(mornings: readonly MorningEntry[], day: string): boolean`
  - `ownTags(evenings: readonly EveningEntry[], side: TagSide): string[]` (≤ 8), `ownFocus(evenings: readonly EveningEntry[]): string[]` (≤ 3)
  - `interface TagCount { tag: string; count: number }`, `type DominoDay = 'geschafft' | 'offen' | 'keiner'`
  - `interface WeekReview { from: string; to: string; days: number; gave: TagCount[]; cost: TagCount[]; dominos: DominoDay[]; dominoDone: number; dominoSet: number; learned: string[] }`
  - `weekReview(evenings: readonly EveningEntry[], mornings: readonly MorningEntry[], day: string, draft?: EveningEntry): WeekReview` (`dominos` hat 7 Einträge, alt → neu)
  - `weekRangeLine(review: WeekReview): string`, `tagCountLine(t: TagCount): string`, `dominoLine(review: WeekReview): string | null` (`null` bei `dominoSet === 0`; die Ansicht zeigt dann „Diese Woche ohne Big Domino.“)
  - `morningReminder(evenings: readonly EveningEntry[], now: Date): { better: string | null; weekFocus: string | null }`
  - `eveningCount(evenings: readonly EveningEntry[], now: Date): number`, `eveningCountLine(n: number): string`
  - `chosenLine(n: number): string`

- [ ] **Step 1: Failing tests (`evening-logic.test.ts`):**
  - `logbookDay`: 29.10. 3:59 → `'2026-10-28'`, 4:00 → `'2026-10-29'`, 0:00 → Vortag; an den Umstellungstagen (29.3.2026 und 25.10.2026) 3:30 → Vortag, 4:30 → derselbe Tag.
  - `shiftDay('2026-10-25', -1) === '2026-10-24'`, `shiftDay('2026-03-29', 1) === '2026-03-30'`, `shiftDay('2026-12-31', 1) === '2027-01-01'`.
  - `eveningCard` ohne Eintrag: 3:59 → `'tag-abschliessen'`, 4:00 → `null`, 10:59 → `null`, 11:00 → `null`, 17:59 → `null`, 18:00 → `'tag-abschliessen'`, 0:30 → `'tag-abschliessen'`. Mit Eintrag des Logbuch-Tages: 14:00, 20:00 und 0:30 → `'dein-abend'`, 8:00 → `null`.
  - `eveningSteps(false, false)` → `['checkin','geber','raeuber','gelernt','besser']`; `eveningSteps(true, true)` → alle sieben Eingabeschritte.
  - `hasReview`: Morgen-Eintrag mit `domino` → true, nur `intention` → true, nur `gratitude` → false, anderer Tag → false.
  - `ownTags`: Vorschläge (auch klein geschrieben) ausgeschlossen, Doppelte in anderer Schreibweise einmal (Schreibweise des jüngsten), neueste zuerst, höchstens 8; getrennt je Seite. `ownFocus` höchstens 3.
  - `weekReview` über 7 Tage bis `day`:
    - Zählung je Tag, Rangfolge Zahl → jüngster Tag → `localeCompare('de')`, Top 3.
    - `draft` ersetzt den Eintrag von `day` (auch ohne gespeicherten Eintrag) und zählt in `days`.
    - Einträge vor `day − 6` zählen nicht.
    - `dominos`: geschafft / offen / keiner aus den Morgen-Einträgen, `dominoDone` und `dominoSet` passend.
    - `learned` neueste zuerst.
    - Eine Woche über die Zeitumstellung (`day = '2026-10-25'`) umfasst genau 19.–25.10.
  - `weekRangeLine` → `'23. Oktober bis 29. Oktober · Logbuch an 5 Tagen'`, bei `days = 1` `'… · Logbuch an 1 Tag'`; `tagCountLine({ tag: 'Bewegung', count: 4 })` → `'Bewegung · 4×'`; `dominoLine` → `'4 von 6 geschafft'` bzw. `null`.
  - `morningReminder` am 30.10. um 7:00: `better` aus dem Eintrag `'2026-10-29'`; `weekFocus` aus einem Sonntag 1 bzw. 7 Tage zurück vorhanden, 0 bzw. 8 Tage zurück `null`; der jüngste gewinnt.
  - `eveningCount` zählt Tage mit Eintrag unter `logbookDay(now)` und den 6 Tagen davor; `eveningCountLine(5)` → `'Logbuch an 5 der letzten 7 Tage'`.
  - `chosenLine(0/1/3)` → `'Nichts gewählt'` / `'1 gewählt'` / `'3 gewählt'`.
  - **`morning-logic.test.ts`:** `intentionSentence('sanft mit mir') === 'Heute will ich sanft mit mir sein.'`.
- [ ] **Step 2:** `npx vitest run tests/unit/evening-logic.test.ts tests/unit/morning-logic.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:** Monatsnamen als feste Liste (Januar … Dezember), nicht `Intl`. `shiftDay` über `new Date(y, m - 1, d + delta)`.
- [ ] **Step 4:** dieselben Tests, `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: Logik des Abend-Logbuchs`.

### Task 3: Gemeinsamer Ablauf-Rahmen (Umbau, Morgen-Start unverändert)

**Files:**
- Create: `src/components/flow/FlowFrame.svelte`
- Move (mit `git mv`) und anpassen:
  - `src/components/morning/CheckinStep.svelte` → `src/components/flow/CheckinStep.svelte`
  - `src/components/morning/WordPicker.svelte` → `src/components/flow/WordPicker.svelte`
- Modify:
  - `src/components/morning/MorningFlow.svelte`
  - `src/components/morning/IntentionStep.svelte`, `GratitudeStep.svelte` (Importpfade; `IntentionStep` nutzt `intentionSentence`)
  - `src/lib/morning/limited-input.ts` (Option `onEnter`)
  - `src/lib/audio/chime.ts` (Lautstärke)
- Test:
  - `tests/browser/flow-frame.test.ts` (neu)
  - `tests/browser/limited-input.test.ts`, `tests/browser/chime.test.ts`
  - bestehend, ohne inhaltliche Änderung: `tests/browser/morning-ui.test.ts`, `tests/browser/intention-step.test.ts`, `tests/e2e/morgen.spec.ts`, `tests/e2e/morgen-heute.spec.ts`

**Interfaces:**
- Produces, `FlowFrame.svelte`, Props:
  - `label: string` (Dialogname), `closeLabel: string`, `confirmTitle: string`
  - `steps: readonly string[]` (Eingabeschritte), `step: string` (aktueller Schritt; nicht in `steps` = Abschluss: ohne Punkte und „Überspringen“)
  - `hidden?: boolean` (Morgen: während eines Players; verborgen und `inert`, Ebene bleibt)
  - `confirming: boolean` (`$bindable`)
  - `onSkip: () => void`, `onClose: () => void` (schließt sofort)
  - `children: Snippet`
  - Verhalten aus `MorningFlow`: Ebene per `openLayer` (Zurück vor dem Abschluss → Ebene neu öffnen und Rückfrage; im Abschluss → `onClose`), Escape und „×“ wie Zurück, Rückfrage `ConfirmDialog` mit „Beenden“ / „Weiter machen“, Fokus auf `[data-step-title]` bei jedem Schrittwechsel, nach „Weiter machen“ und wenn `hidden` endet, „Überspringen“ mit `tapArming()`. Die gemeinsamen Schritt-Stile (`.step`, `.content`, `.head`, `.kicker`, `.title`, `.lead`, `.foot`) ziehen aus `MorningFlow` mit.
- Produces, `flow/CheckinStep.svelte`, Props: `title: string`, `onSaved: (levels: Record<EnergyArea, EnergyLevel>) => void`. Speichert den Check-in selbst (`saveCheckin`, `energyUi.resetSkip = 0`) und ruft dann `onSaved`. Kein Import von `morning-ui` mehr.
- Produces, `flow/WordPicker.svelte`: Props unverändert.
- Produces, `limited-input.ts`: `LimitedInputOptions.onEnter?: () => void`. Mit `onEnter` ruft „Return“ (außerhalb einer Komposition) `onEnter` statt `blur`.
- Produces, `chime.ts`: `playChime(makeContext?: () => AudioContext, volume = 0.8): void`; `CHIME_EVENING = 0.4` exportiert.
- Consumes: `intentionSentence` (Task 2).

- [ ] **Step 1: Failing tests:**
  - **`flow-frame.test.ts`** (mountet `FlowFrame` mit einem Test-Schritt):
    - Dialog mit Namen aus `label`; Punkte mit Namen „Schritt 2 von 3“ bei `step` = zweitem Eintrag; im Abschluss weder Punkte noch „Überspringen“.
    - Escape vor dem Abschluss setzt `confirming`; der Dialog zeigt `confirmTitle`; „Beenden“ ruft `onClose`; „Weiter machen“ schließt den Dialog und fokussiert `[data-step-title]`.
    - Escape im Abschluss ruft `onClose` ohne Rückfrage.
    - Schrittwechsel fokussiert die neue Überschrift; „Überspringen“ ruft `onSkip`.
  - **`limited-input.test.ts`:** mit `onEnter` ruft „Return“ `onEnter` und behält den Fokus; ohne `onEnter` unverändert `blur`; während einer Komposition keiner von beiden.
  - **`chime.test.ts`:** `playChime(make, 0.4)` setzt die Verstärkung auf 0.4; ohne Angabe 0.8.
- [ ] **Step 2:** `npx vitest run --project browser tests/browser/flow-frame.test.ts tests/browser/limited-input.test.ts tests/browser/chime.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `MorningFlow` rendert seine Schritte im `FlowFrame` (`bind:confirming={morningUi.confirming}`, `hidden={morningHidden()}`, `onClose={closeMorning}`, `onSkip={skipStep}`); sein Warten auf den Player (`morningPlayerClosed`-Effekt) bleibt in `MorningFlow`. Der Morgen-Check-in übergibt `onSaved = (l) => { morningUi.checkin = { ...l }; nextStep() }`.
- [ ] **Step 4:** `npm test`, `npm run check`, `npx playwright test tests/e2e/morgen.spec.ts tests/e2e/morgen-heute.spec.ts`, erwartet: alles grün, die Morgen-Tests ohne inhaltliche Änderung (nur Importpfade dürfen sich ändern).
- [ ] **Step 5: Commit** `refactor: gemeinsamer Rahmen für geführte Abläufe`.

### Task 4: Ablauf-Zustand und Stichwort-Auswahl

**Files:**
- Create:
  - `src/lib/ui/evening-ui.svelte.ts`
  - `src/components/evening/TagPicker.svelte`
- Test:
  - `tests/browser/evening-ui.test.ts` (neu; `playChime` ersetzt wie in `morning-ui.test.ts`)
  - `tests/browser/tag-picker.test.ts` (neu)

**Interfaces:**
- Consumes: `logbookDay`, `hasReview`, `isSunday`, `eveningSteps`, `EveningStep` (Task 2); `saveEvening`, `toggleDomino`, `stats` (Task 1 / M10); `playChime`, `CHIME_EVENING` (Task 3); `appNow()`.
- Produces, `evening-ui.svelte.ts`:
  - `interface EveningDraft { gave: string[]; cost: string[]; intentionScore: IntentionScore | null; learned: string; better: string; weekFocus: string }`
  - `interface EveningState { open: boolean; day: string; sunday: boolean; steps: EveningStep[]; step: EveningStep; draft: EveningDraft; entry: EveningEntry | null; confirming: boolean }`
  - `eveningUi: EveningState` (`$state`)
  - `openEvening(): void`: legt `day = logbookDay(appNow())`, `sunday`, `steps` fest; Schritt `'checkin'`, leerer Entwurf, `entry = null`.
  - `nextEveningStep(): void`: zum nächsten Schritt; nach dem letzten Eingabeschritt `entry = { ...saveEvening(input) }` (mit `weekFocus` nur sonntags), Schritt `'abschluss'`, `playChime(undefined, CHIME_EVENING)`. Im Abschluss und bei geschlossenem Ablauf ohne Wirkung.
  - `skipEveningStep(): void`: verwirft die Eingabe des Schritts (Global Constraints), dann `nextEveningStep()`.
  - `closeEvening(): void`
  - `draftEntry(): EveningEntry`: der Entwurf als Eintrag von `eveningUi.day` (für `weekReview(…, draft)`).
- Produces, `TagPicker.svelte`, Props: `own: readonly string[]`, `tags: readonly string[]`, `selected: readonly string[]`, `onChange: (selected: string[]) => void`.
  - Gruppe „Deine Stichworte“ nur mit eigenen, Gruppe „Vorschläge“ mit `tags`, Knöpfe als Umschalter (`aria-pressed`, Haken vor dem Text).
  - „+ Eigenes“ öffnet das Feld „Eigenes Stichwort“ (`limitedInput`, `max = TAG_MAX`, `onEnter` = hinzufügen) mit „Hinzufügen“. Hinzufügen trimmt; leer tut nichts; gleicht es (klein geschrieben) einem sichtbaren Stichwort, wird dieses gewählt; sonst steht es danach vorn unter „Deine Stichworte“ und ist gewählt.
  - Bei `TAGS_MAX` gewählten sind nicht gewählte Stichworte und „+ Eigenes“ gesperrt.
  - Über der Auswahl keine Live-Zeile; die Zählzeile gehört zum Schritt (Task 5).

- [ ] **Step 1: Failing tests:**
  - **`evening-ui.test.ts`:**
    - Werktag ohne Morgen-Eintrag: `steps` = 5, erster Schritt `'checkin'`. Mit Morgen-Eintrag (Domino) an einem Sonntag: 7 Schritte.
    - Geöffnet am Montag 2.11.2026 um 0:30 (`tageszeitUi.now`): `day = '2026-11-01'`, `sunday = true`. Uhr danach auf 4:05: `nextEveningStep` bis zum Ende speichert unter `'2026-11-01'` mit `weekFocus`.
    - Durchlauf mit Entwurf (`gave`, `cost`, `intentionScore: 'teils'`, `learned`, `better`) speichert genau diese Werte; `playChime` wurde einmal mit `0.4` gerufen; ein zweiter `nextEveningStep` im Abschluss speichert nicht erneut.
    - `skipEveningStep` auf `'geber'` leert `gave`; auf `'rueckblick'` leert `intentionScore`.
    - `weekFocus` an einem Werktag wird nicht gespeichert.
    - `closeEvening` vor dem Abschluss: kein Logbuch-Eintrag.
    - `draftEntry()` hat `day` und die Entwurfswerte.
  - **`tag-picker.test.ts`:**
    - Antippen schaltet um (`aria-pressed`), `onChange` bekommt die neue Auswahl.
    - „+ Eigenes“, Eingabe „Kochen“, Enter: `onChange` mit „Kochen“; „bewegung“ wählt „Bewegung“ ohne Doppel; nur Leerzeichen tut nichts; 35 Zeichen werden auf 30 gekürzt.
    - Mit 20 gewählten sind ein nicht gewähltes Stichwort und „+ Eigenes“ gesperrt, ein gewähltes lässt sich abwählen.
- [ ] **Step 2:** `npx vitest run --project browser tests/browser/evening-ui.test.ts tests/browser/tag-picker.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** nach dem Muster von `morning-ui.svelte.ts` (ohne Player-Teile).
- [ ] **Step 4:** dieselben Tests, `npm test`, `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: Zustand des Abend-Logbuchs und Stichwort-Auswahl`.

### Task 5: Der Ablauf im Vollbild und die Karte im Reiter „Energie“

**Files:**
- Create, alle unter `src/components/evening/`:
  - `EveningFlow.svelte`
  - `TagsStep.svelte` (Geber und Räuber, Prop `side`)
  - `ReviewStep.svelte`
  - `TextStep.svelte` (Gelernt und 1 % besser, Props für Texte und Grenze) oder je eine Datei
  - `WeekStep.svelte`
  - `WeekSummary.svelte` (die Blöcke der Wochenauswertung, ohne Überschrift; auch für Task 6)
  - `EveningSummary.svelte` (die Zeilen von „Dein Abend“; auch für Task 6)
  - `EveningDone.svelte`
  - `EveningStartCard.svelte`
- Modify: `src/App.svelte`, `src/screens/Energie.svelte`
- Test:
  - `tests/e2e/abend.spec.ts` (neu)
  - `tests/e2e/energie.spec.ts` (nur, wo Karten des Reiters gezählt oder geordnet werden)

**Interfaces:**
- Consumes: alles aus Task 1–4; `CheckinStep`, `WordPicker`, `FlowFrame`, `limitedInput`; `toggleDomino(day)`; `intentionSentence`; `weekReview`, `draftEntry`, `ownTags`, `ownFocus`, `chosenLine`.
- Produces:
  - `EveningSummary.svelte`, Props: `entry: EveningEntry`, `morning: MorningEntry | null` (für die Domino-Zeile). Zeilen und Regeln nach Spec §2.1; ohne Angaben „Logbuch erledigt.“.
  - `WeekSummary.svelte`, Props: `review: WeekReview`. Blöcke nach Spec §2.3 Schritt 7 (Balken `aria-hidden`), Überschriften als `h3`.
  - `EveningStartCard.svelte`: Karte nach Spec §2.2, steht in `Energie.svelte` direkt unter `MorningStartCard`. „Starten“ mit `tapArming(() => eveningUi.open)`.
  - `App.svelte`: `{#if eveningUi.open}<EveningFlow />{/if}` neben `MorningFlow`; `appInert` gilt auch bei `eveningUi.open`.

- [ ] **Step 1: Failing tests (`abend.spec.ts`, Berlin, `setFixedTime`):**
  - Aus „Energie“ am Donnerstag 29.10.2026 um 20:00 mit vorbereitetem Morgen-Eintrag (`intention: 'klar'`, `domino: 'Konzept skizzieren'`): Check-in (vier Stufen, „Weiter“), Geber „Bewegung“ und eigenes „Kochen“, Räuber „Bildschirm“, Rückblick „Geschafft“ und „teils“, Gelernt, 1 % besser, Abschluss.
    - Gespeichert: `evenings[0]` mit `day '2026-10-29'`, `gave ['Bewegung','Kochen']`, `cost ['Bildschirm']`, `intentionScore 'teils'`, `learned`, `better`; ein neuer `energyCheckins`-Eintrag; `mornings[0].dominoDone` gesetzt.
    - Abschluss zeigt „Gute Nacht.“ und die Zeilen „Hat Energie gegeben“, „Big Domino geschafft: Konzept skizzieren“, „Gelernt: …“, „Morgen 1 % besser: …“; „Fertig“ schließt, History-Tiefe 0.
    - Der Rückblick zeigt „Heute will ich klar sein.“
  - Ohne Morgen-Eintrag: Punkte „Schritt 1 von 5“, kein Rückblick. Alles überspringen speichert einen Eintrag nur mit `day` und `at`; Abschluss zeigt „Logbuch erledigt.“.
  - Haken (Review Focus 4): „Geschafft“ setzen, dann „×“ → „Beenden“: kein Logbuch-Eintrag, `dominoDone` bleibt, der Check-in bleibt. Ein bereits abgehakter Domino zeigt „Geschafft“ gedrückt; ein Tipp nimmt den Haken zurück.
  - Sonntag 1.11.2026 um 21:00 mit vorbereiteten Einträgen vom 26.–31.10.: Wochenseite mit „26. Oktober bis 1. November“, Top 3 Geber mit „· {n}×“ inklusive der heute gewählten Stichworte, „{a} von {b} geschafft“, „Gelernt“; Fokus „Mehr Schlaf“ wählen → gespeichert als `weekFocus`. Knopf der Energie-Karte bleibt „Starten“.
  - Zweites Mal am selben Abend: Energie-Karte zeigt „Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.“; danach gibt es genau einen Eintrag für den Tag.
  - Morgen-Eintrag nur mit Intention: Der Rückblick zeigt nur den Block „Intention“. Ein zweiter Tipp auf die gewählte Stufe nimmt sie zurück (gespeichert ohne `intentionScore`).
  - Neuladen mitten im Ablauf (nach dem Check-in): Ablauf ist zu, kein Logbuch-Eintrag, der Check-in bleibt.
  - Zurück-Geste und Escape vor dem Abschluss: Rückfrage „Abend-Logbuch beenden?“; „Weiter machen“ bleibt im Schritt.
  - Doppeltipp (Review Focus 3): `doubleTap` auf „Beenden“ in der Rückfrage über „Starten“ der Energie-Karte (`putOver`) → Ablauf bleibt zu. Doppeltipp auf „Weiter“ im Check-in trifft im Geber-Schritt kein Stichwort.
  - Lange Eingaben (Review Focus 5) bei 360 px und 130 %: eigenes Stichwort mit 30 Zeichen ohne Leerzeichen, Gelernt mit 120 und 1 % besser mit 80 Zeichen; kein seitliches Scrollen im Ablauf und im Abschluss.
  - **`energie.spec.ts`:** Tests, die Karten im Reiter zählen oder ordnen, zählen „Abend-Logbuch“ mit; keine Prüfung entfällt.
- [ ] **Step 2:** `npx playwright test tests/e2e/abend.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:** Jeder Schritt hat das Wurzelelement `.step` mit `.content` / `.foot`, die Überschrift mit `data-step-title` und einen „Weiter“-Knopf mit eigenem `tapArming()`. Die Zählzeile über „Weiter“ im Geber-/Räuber-Schritt (`chosenLine`) steht in einem `aria-live="polite"`-Element und ändert sich nur bei Auswahl. Die Wochenseite rechnet `weekReview(evenings, mornings, eveningUi.day, draftEntry())`. Der Haken im Rückblick liest `dominoDone` aus `stats.data.mornings` (nicht aus einer Kopie).
- [ ] **Step 4:** `npx playwright test tests/e2e/abend.spec.ts tests/e2e/energie.spec.ts tests/e2e/morgen.spec.ts`, `npm test`, `npm run check`, erwartet: alles grün.
- [ ] **Step 5: Commit** `feat: Abend-Logbuch als geführter Ablauf`.

### Task 6: Karten auf „Heute“, Wochenrückblick und Kasten im Morgen-Start

**Files:**
- Create: `src/components/evening/EveningTodayCard.svelte`
- Modify:
  - `src/screens/Heute.svelte`
  - `src/components/energy/WeekCard.svelte`
  - `src/components/morning/IntentionStep.svelte`
- Test:
  - `tests/e2e/abend-heute.spec.ts` (neu)
  - `tests/browser/intention-step.test.ts`
  - bestehende E2E am Abend: `heute.spec.ts`, `ich.spec.ts`, `tageszeit.spec.ts`, `karten.spec.ts`, `morgen.spec.ts`, `morgen-heute.spec.ts`

**Interfaces:**
- Consumes: `eveningCard`, `eveningEntry`, `logbookDay`, `eveningCount`, `eveningCountLine`, `weekReview`, `morningReminder`, `isSunday` (Task 2); `EveningSummary`, `WeekSummary` (Task 5); `openEvening`, `eveningUi` (Task 4); `todayEntry` (M10).
- Produces:
  - `EveningTodayCard.svelte`: „Tag abschließen“ bzw. „Dein Abend“ nach Spec §2.1 aus `eveningCard(…, appNow())`; „Starten · 3 Min“ / „Mit Wochenrückblick · 5 Min“ mit `tapArming(() => \`${kind}|${eveningUi.open}\`)`.
  - `Heute.svelte`: `EveningTodayCard` direkt über `MorningTodayCard`; `MorningTodayCard` entfällt, solange `eveningCard` `'dein-abend'` ist. Kommentar zur Reihenfolge aktualisieren.
  - `WeekCard.svelte`: Abschnitt „Wochenrückblick“ (`h3`) mit `WeekSummary` aus `weekReview(evenings, mornings, logbookDay(now))`, nur mit mindestens einem Logbuch-Eintrag in den 7 Tagen (`review.days ≥ 1`); darunter „Wochenfokus: {Wort}“ mit `morningReminder(evenings, now).weekFocus`, falls nicht `null`.
  - `IntentionStep.svelte`: Kasten über der Kleinüberschrift aus `morningReminder(evenings, appNow())`, beim Einblenden festgehalten (`untrack`); reiner Text, ohne Werte kein Kasten.

- [ ] **Step 1: Failing tests:**
  - **`abend-heute.spec.ts`** (Berlin, `setFixedTime`):
    - Ohne Eintrag: 17:59 keine Karte, 18:00 „Tag abschließen“ mit „Starten · 3 Min“, 0:30 noch, 4:00 stattdessen „Guten Morgen“ (M10).
    - Reihenfolge um 20:00 mit Morgen-Eintrag: Begrüßung → „Tag abschließen“ → „Dein Tag“ → „Dein Akku“.
    - Mit Eintrag um 21:00: „Dein Abend“ mit allen Zeilen und „Logbuch an 1 der letzten 7 Tage“, „Dein Tag“ fehlt; um 0:30 des Folgetags steht „Dein Abend“ noch (Review Focus 2); um 14:00 nach einem Logbuch aus „Energie“ ebenfalls „Dein Abend“.
    - Fortsetzen ohne Neuladen: geöffnet um 17:58, Uhr auf 18:01 und `visibilitychange` → „Tag abschließen“ erscheint.
    - Sonntag 21:00: Knopf „Mit Wochenrückblick · 5 Min“; Montag 0:30 ebenso.
    - Doppeltipp (Review Focus 3): „Fertig“ im Abschluss bzw. „Beenden“ in der Rückfrage per `doubleTap` über „Starten · 3 Min“ → der Ablauf öffnet nicht wieder.
    - „Deine Woche“ zeigt mit Logbuch-Einträgen den Abschnitt „Wochenrückblick“ und „Wochenfokus: Mehr Schlaf“ (Fokus vom Sonntag, Ansicht am Dienstag); ohne Einträge fehlt der Abschnitt.
    - Morgen-Start am 30.10. um 7:00 mit Logbuch vom 29.10. (`better: 'Handy aus bis 10 Uhr'`) und Sonntags-Fokus vom 25.10.: Intention-Schritt zeigt „Gestern vorgenommen“ / „Handy aus bis 10 Uhr“ und „Wochenfokus“; ohne beides kein Kasten.
    - 360 px und 130 %: „Dein Abend“ mit 30-Zeichen-Stichworten und 120/80-Zeichen-Sätzen und der Wochenrückblick mit langen Stichworten scrollen nicht seitlich.
    - Kontrast: Die Marken für Geber und Räuber erreichen mindestens 4,5:1 in allen drei Stimmungen: im Abschluss eines Logbuchs aus „Energie“ um 8:00 (morgen), auf „Dein Abend“ um 14:00 (tag) und um 21:00 (abend). Messung mit `tests/e2e/color.ts` wie in den bestehenden Kontrast-Tests.
    - Backup: Export unter „Ich“ enthält `evenings`; nach Löschen und Import sind die Logbuch-Einträge wieder da, ein zweiter Import meldet keine neuen Energie-Einträge.
  - **`intention-step.test.ts`:** Der Kasten ändert sich nicht, wenn sich die Daten während des Schritts ändern.
  - **Bestehende E2E am Abend (Review Focus 1):** Jeder Test in den genannten Dateien läuft; wo einer Karten, Überschriften oder gefüllte Knöpfe auf „Heute“ zählt oder ordnet, wird er auf seinen Bereich eingegrenzt oder zählt „Tag abschließen“ mit. Keine Prüfung entfällt, jede Anpassung bekommt einen Kommentar.
- [ ] **Step 2:** `npx playwright test tests/e2e/abend-heute.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4:** `npm test`, `npm run check`, die ganze Suite `npx playwright test` (vorher Port 4173 frei), erwartet: alles grün. Zahlen in den Bericht.
- [ ] **Step 5: Commit** `feat: Karten „Tag abschließen“ und „Dein Abend“, Wochenrückblick, Erinnerung im Morgen-Start`.

### Task 7: README, Haupt-Spec und Gesamtprüfung

**Files:**
- Modify:
  - `README.md`
  - `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- [ ] **Step 1: README:**
  - **„Handy-Checkliste Meilenstein 11“:** aus Spec §8, als Abhak-Liste im Stil der Nachbarn, vor „Handy-Checkliste Meilenstein 10“. Beschriftungen genau so, wie die App sie zeigt.
  - **„Erinnerungen einrichten“:** ein Abend-Wecker, z. B. 21:30, Bezeichnung „Tag abschließen“, mit dem Hinweis, die App danach über das Startbildschirm-Symbol zu öffnen.
- [ ] **Step 2: Haupt-Spec**, Ergänzung vom 30.10.2026 (Meilenstein 11), jeweils mit Verweis auf die M11-Spec:
  - bei den Daten (§6.1): `evenings`
  - in §3.1 („Heute“): die Abend-Karten über den Morgen-Karten
- [ ] **Step 3: Gesamtprüfung:**
  - `npm run check` (0 Fehler), `npm test` (alle grün), `npx playwright test` (alle grün).
  - Abend-Lauf: die ganze Suite noch einmal mit einer Zeitzone, in der die Ortszeit beim Start zwischen 19 und 22 Uhr liegt (vorher mit `TZ=<Zone> date` prüfen): `TZ=<Zone> npx playwright test`. Rot wird geprüft: echt (die Abend-Karte stört) → beheben; Testumgebung (Zeitzonen-Annahme) → genau berichten.
  - Die Zahlen kommen ins Ledger.
- [ ] **Step 4: Commit** `docs: Handy-Checkliste M11 und Abend-Wecker`.
