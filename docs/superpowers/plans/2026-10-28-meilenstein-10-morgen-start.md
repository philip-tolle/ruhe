# Meilenstein 10: Morgen-Start – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein geführter Morgen-Start (kurz ~5 Min, lang ~15 Min) aus Check-in, Morgen-Übung, Intention, Dankbarkeit (und Wert) und Big Domino. Dazu kommen die Karten „Guten Morgen“ / „Dein Tag“ auf „Heute“ und die Karte „Morgen-Start“ im Reiter „Energie“.

**Architecture:**
- **Inhalte:** Drei neue Körper-Hacks in `content/hacks.json`. Wortlisten und die Reihenfolge der Morgen-Übungen liegen in `src/lib/morning/words.ts`.
- **Daten:** eine neue, freiwillige Liste `mornings` in `ruhe.v1`, ein Eintrag je Tag. Prüfen, Speichern und Zusammenführen folgen dem Muster der M9-Listen.
- **Logik:** reine Funktionen mit `now` als Parameter in `src/lib/morning/logic.ts`.
- **Ablauf:** ein Vollbild `MorningFlow` an der App-Wurzel mit Zustand in `src/lib/ui/morning-ui.svelte.ts`. Übungen und die Meditation laufen in den vorhandenen Playern. Der Ablauf verbirgt sich so lange und übernimmt danach ihr Ende:
  - Hack: `HackEffect` zeigt „Weiter“.
  - Meditation: Ihr Abschluss entfällt (Haken in `main.ts`).
- **Klangschale:** eine kleine Funktion `playChime` mit eigenem AudioContext. Die Engine bleibt unberührt.

**Tech Stack:** Svelte 5 (Runes), TypeScript, Vitest (unit/browser), Playwright (Pixel 7, 412 px; 360-px-Tests setzen den Viewport).

**Spec:** `docs/superpowers/specs/2026-10-28-ruhe-m10-morgen-start-design.md`

## Global Constraints

- **Morgen-Fenster:** Karte „Guten Morgen“ von 4:00 bis 10:59 Ortszeit (`MORNING_FROM = 4`, `MORNING_UNTIL = 11`, Stunde `from ≤ h < until`), solange es heute keinen Eintrag gibt. „Dein Tag“ gilt ab dem Eintrag bis Mitternacht.
- **Datenstand:**
  - `localStorage['ruhe.v1']`, `version` bleibt 1.
  - `mornings?: MorningEntry[]` fehlt, solange leer, und ist nach `day` sortiert.
  - Je Tag höchstens ein Eintrag; bei zwei gilt der mit späterem `at`.
- **Längen:**
  - Intention 40, Dankbarkeit 120, Wert 40, Big Domino 80 Zeichen.
  - Getrimmt, zu lang wird gekürzt, leer entfällt.
  - `value` nur bei `variant: 'lang'`; `dominoDone` nur mit `domino`.
- **Zweiter Durchgang am Tag:** ersetzt den Eintrag. `dominoDone` bleibt nur bei gleichem Big Domino (getrimmt, Groß- und Kleinschreibung egal).
- **Statistik:**
  - Der Morgen-Start zählt nicht in Sitzungen, Minuten, Serie, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in.
  - Check-in, Hack-Läufe und die Meditation im Ablauf werden wie sonst gespeichert und gezählt.
- **Übungen:**
  - Reihenfolge `strecken`, `wasser-licht`, `wach-klopfen`.
  - Übung des Tages: Index `floor(lokale Mitternacht / 86 400 000 ms seit 1.1.1970, Ortszeit) mod 3`. Der Tag wird aus `Date.UTC(y, m, d)` der lokalen Kalenderdaten gebildet.
  - „Andere Übung“ nimmt die nächste.
- **„Jetzt“:** Jede neue Ansicht rechnet mit `appNow()` aus `src/lib/ui/tageszeit.svelte.ts`, nie mit einem bloßen `new Date()` im `$derived`.
- **Farben:** Schrift in Bereichsfarbe nutzt `var(--area-<a>-text)`, Formen `var(--area-<a>)` (M9, R10).
- **Doppeltipps:** Knöpfe, die an der Stelle eines gerade verschwundenen Knopfs erscheinen, sind mit `tapArming()` geschützt (`src/lib/ui/arming.svelte.ts`).
- **E2E (M9, R1):** Programme laufen in Echtzeit. `page.clock` setzt nur die Uhrzeit (`setFixedTime` / `install({ time })`) und wird nie mit einem laufenden Programm kombiniert.
- **Privatsphäre:** Intention, Dankbarkeit, Wert und Big Domino nur lokal. Tests nur mit erfundenen Daten. Keine Logs, keine Medien-Anzeige.
- **Kosten:** keine Generierung von Bild oder Stimme.
- **Texte der Oberfläche** (wörtlich, aus Spec §2):
  - **„Heute“, Karte „Guten Morgen“:**
    - Kleinüberschrift „Morgen-Start“, Titel „Starte wach in den Tag“, Satz „Einchecken, aktivieren, ausrichten.“
    - Knöpfe „Kurz · 5 Min“ / „Lang · 15 Min“.
  - **„Heute“, Karte „Dein Tag“:**
    - Kleinüberschrift „Dein Tag“, Zählung „Morgen-Start an {n} der letzten 7 Tage“.
    - „Heute will ich sein:“, „Big Domino“, Abhak-Knopf mit dem Namen „Big Domino erledigt“, „Sprint starten · {n} Min“.
    - „Dankbar für: {Satz}“, ohne Angaben „Morgen-Start erledigt.“
  - **Reiter „Energie“, Karte „Morgen-Start“:**
    - Satz „Kurz oder lang, jederzeit.“
    - Mit Eintrag heute: „Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.“
    - In „Deine Woche“: „Morgen-Start an {n} der letzten 7 Tage“ (ab n = 1).
  - **Ablauf, allgemein:**
    - Dialogname „Morgen-Start“, „×“ mit dem Namen „Morgen-Start beenden“, Fortschritt „Schritt {i} von {n}“, „Überspringen“, „Weiter“.
    - Rückfrage „Morgen-Start beenden?“ mit „Beenden“ / „Weiter machen“.
  - **Check-in:** „Check-in“, „Wie voll ist dein Akku?“, „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
  - **Aktivieren:** „Aktivieren“, „Wach werden“, „Erst der Körper, dann der Kopf.“, „Starten · {m:ss}“, „Andere Übung“, Chip „Körper · {n} Min“.
  - **Vertiefen:**
    - „Vertiefen“, „Noch fünf Minuten für dich“.
    - Wahl „Guten Morgen“ mit „Meditation · 5 Min“ und „Tageslicht tanken“ mit „Draußen · 5 Min“.
    - Hinweise „Am besten, sobald es hell ist.“ (vor 7:00) und „Nicht offline verfügbar“.
  - **Intention:**
    - „Intention“, „Wie willst du heute sein?“, „Dein {Bereich}-Akku ist gerade am niedrigsten.“
    - Gruppen „Vorschläge“, „Deine Wörter“; Feld „Eigenes Wort“.
    - „Heute will ich {Wort} sein.“ / „Wähle ein Wort oder tippe ein eigenes.“
  - **Dankbarkeit:**
    - „Dankbarkeit“, „Wofür bist du heute dankbar?“, Feld „Dein Satz“, Platzhalter „z. B. ein Mensch, ein Moment, etwas Kleines“.
    - Lang: „Welcher Wert trägt dich heute?“, Gruppen „Werte“, „Deine Werte“, Feld „Eigener Wert“.
  - **Big Domino:**
    - „Big Domino“, „Was ist heute dein Big Domino?“, „Die eine Sache, die vieles andere leichter macht.“
    - Hinweis „Frag dich: Welche eine Sache macht heute vieles andere leichter oder unnötig?“
    - „Von gestern offen“ mit „Übernehmen“; Feld „Dein Big Domino“, Zähler „{n} / 80“.
  - **Abschluss:**
    - „Geschafft“, „Dein Tag“, Zeilen „Heute will ich sein:“, „Big Domino“, „Dankbar für“, „Wert des Tages“.
    - Knöpfe „Fokus-Sprint starten · {n} Min“, „Fertig“.
- **Wortlisten** (Spec §3.2/§3.3):
  - `koerper`: geerdet, kraftvoll, leicht, beweglich, sanft mit mir, achtsam
  - `gefuehl`: gelassen, freundlich, zuversichtlich, verbunden, geduldig, heiter
  - `geist`: klar, fokussiert, wach, neugierig, gesammelt, entschieden
  - `sinn`: mutig, ausgerichtet, dankbar, großzügig, echt, entschlossen
  - ohne Check-in: klar, gelassen, mutig, freundlich, fokussiert, dankbar
  - Werte: Geduld, Mut, Klarheit, Freundlichkeit, Ehrlichkeit, Fokus, Gelassenheit, Großzügigkeit, Neugier, Verlässlichkeit, Disziplin, Leichtigkeit

## Review Focus

1. **Bestehende E2E-Tests zur echten Uhrzeit:** Zwischen 4:00 und 10:59 erscheint auf „Heute“ eine zusätzliche Karte, im Reiter „Energie“ immer eine. Jeder bestehende Test, der Karten oder Überschriften zählt oder ihre Reihenfolge prüft, setzt `page.clock.setFixedTime` auf 12:00 oder zählt die neue Karte mit, sonst schlägt er morgens fehl (Task 5 und 6).
2. **Ablauf unterbrochen durch einen Player:**
   - Die Zurück-Geste im Hack-Player fragt „Hack beenden?“, nicht „Morgen-Start beenden?“.
   - Nach dem Player steht der Ablauf beim richtigen Schritt.
   - Die History ist danach sauber, die Tiefe sinkt nach dem Schließen auf 0 (Task 5).
3. **Zweiter Morgen-Start am selben Tag:** Er ersetzt den Eintrag. Der Haken bleibt nur bei gleichem Big Domino, egal in welcher Schreibweise (Task 2).
4. **Tagesgrenze und Fortsetzen:**
   - Ein Abschluss nach Mitternacht gehört zum neuen Tag.
   - Um 23:59 steht „Dein Tag“ noch, um 0:00 nicht mehr.
   - Fortsetzen der App um 11:02 per `visibilitychange` blendet „Guten Morgen“ ohne Neuladen aus (Task 3 und 6).
5. **Lange Eingaben ohne Leerzeichen:** Eine Intention mit 40 und ein Big Domino mit 80 Zeichen brechen im Ablauf, auf „Dein Tag“ und im Sprint-Player um. Bei 360 px und 130 % scrollt nichts seitlich (Task 5 und 6).

---

### Task 1: Drei Morgen-Übungen und Wortlisten

**Files:**
- Modify:
  - `content/hacks.json` (drei Einträge nach `power-pause`, also bei den Körper-Hacks)
  - `tests/unit/energy-hacks.test.ts`
  - `tests/unit/energy-reset.test.ts` und `tests/e2e/energie.spec.ts`: jede Stelle, die Katalog-Größe (16) oder die Körper-Reihenfolge festhält
- Create:
  - `src/lib/morning/words.ts`
  - `tests/unit/morning-words.test.ts`

**Interfaces:**
- Consumes: `HACKS`, `hackById`, `hackLength`, `hackProblems`, `inWindow` (M9 `src/lib/energy/hacks.ts`); `EnergyArea` (M9).
- Produces, in `words.ts`:
  - `MORNING_EXERCISES = ['strecken', 'wasser-licht', 'wach-klopfen'] as const`, `type MorningExerciseId`
  - `INTENTIONS: Record<EnergyArea, readonly string[]>`, `INTENTIONS_DEFAULT: readonly string[]`, `VALUES: readonly string[]` (Werte aus den Global Constraints)
  - `INTENTION_MAX = 40`, `GRATITUDE_MAX = 120`, `VALUE_MAX = 40`, `DOMINO_MAX = 80`

- [ ] **Step 1: Failing tests:**
  - **`energy-hacks.test.ts`:**
    - Der Katalog hat 19 Einträge, und `hackProblems` meldet nichts.
    - `strecken`: `koerper`, `schritte`, 2 Min, Schritte 30/30/30/30 mit Symbolen `liegen`, `bewegung`, `bewegung`, `bewegung`.
    - `wasser-licht`: 2 Min, 30/60/30, Symbole `wasser`, `sonne`, `auge`, `window: { from: 4, to: 12 }`.
    - `wach-klopfen`: 1 Min, 20/20/20, alle Symbole `bewegung`.
    - Alle drei haben `further: null`, `link: null` und einen nicht leeren `caution` bei `strecken` und `wach-klopfen`.
    - `inWindow(wasser-licht)` ist um 11:59 wahr und um 12:00 falsch.
  - **`morning-words.test.ts`:**
    - Jede Liste hat sechs Wörter, `VALUES` hat zwölf, alle mit den Werten aus den Global Constraints.
    - Jede Kennung in `MORNING_EXERCISES` ist ein Körper-Hack des Katalogs.
- [ ] **Step 2:** `npx vitest run tests/unit/energy-hacks.test.ts tests/unit/morning-words.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:**
  - **Texte** in eigenen Worten nach Spec §3.1:
    - Nutzen-Satz mit „kann“.
    - `why`: `strecken` „Steif → Beweglich“, `wasser-licht` „Nachtmodus → Tagmodus“, `wach-klopfen` „Träge → Wach“, je zwei bis drei Sätze.
    - `source`: „Allgemeine Mobilisation; Energie-Management nach Loehr/Schwartz“, „Angelehnt an Huberman (Morgenlicht und innere Uhr)“, „Angelehnt an Qigong-Übungen“.
    - `caution`: `strecken` „Nur so weit, wie es angenehm ist.“, `wach-klopfen` „Sanft klopfen und schmerzende Stellen auslassen.“
  - **`words.ts`:** mit den Werten aus den Global Constraints.
  - **Bestehende Tests:** Tests, die 16 Hacks oder die Körper-Reihenfolge festhalten (Reset-Reihenfolge, Bibliothek „16 Kacheln“, Filter „Körper“), auf den neuen Katalog angleichen.
- [ ] **Step 4:** dieselben Tests, `npm test`, `npm run check` und `npx playwright test tests/e2e/energie.spec.ts`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: drei Morgen-Übungen und Wortlisten für den Morgen-Start`.
- [ ] **Step 6 (Controller): Nutzerfreigabe der drei Übungstexte.** Änderungswünsche gehen als Fix-Runde an den Implementierer (wie M9, R4).

### Task 2: Morgen-Einträge speichern, laden, sichern

**Files:**
- Modify:
  - `src/lib/stats/schema.ts`
  - `src/lib/stats/persist.ts`
  - `src/lib/stats/backup.ts`
  - `src/lib/stats/store.svelte.ts`
- Test:
  - `tests/unit/stats-schema.test.ts`
  - `tests/unit/stats-persist.test.ts`
  - `tests/unit/stats-backup.test.ts`
  - `tests/browser/stats-store.test.ts`

**Interfaces:**
- Consumes: `dayKey(d: Date): string` (`src/lib/stats/summary.ts`); die Längen aus Task 1.
- Produces, in `schema.ts`:
  - `type MorningVariant = 'kurz' | 'lang'`, `isMorningVariant(v: unknown): v is MorningVariant`
  - `interface MorningEntry { day: string; at: string; variant: MorningVariant; intention?: string; gratitude?: string; value?: string; domino?: string; dominoDone?: string }`
  - `interface MorningInput { variant: MorningVariant; intention?: string; gratitude?: string; value?: string; domino?: string }`
  - `AppData.mornings?: MorningEntry[]`
  - `clipText(text: string, max: number): string`: trimmt und kürzt auf `max` Zeichen (Codepunkte). `clipTask` nutzt sie mit 80.
- Produces, in `persist.ts`:
  - `withMorning(data: AppData, input: MorningInput, now: Date): AppData`. Tag `dayKey(now)`, `at = now.toISOString()`. Ersetzt einen Eintrag desselben Tags; die Regeln zu Längen und `dominoDone` stehen in den Global Constraints.
  - `withDominoToggled(data: AppData, day: string, now: Date): AppData | null`. Setzt bzw. entfernt `dominoDone`; `null` ohne Eintrag oder ohne `domino`.
- Produces, in `backup.ts`:
  - `mergeBackup` führt `mornings` je Tag zusammen (späteres `at` gewinnt).
  - `addedEnergy` zählt zusätzlich neue Tage und Einträge, die einen älteren ersetzen. Ein gleicher Eintrag zählt nicht.
- Produces, in `store.svelte.ts`:
  - `saveMorning(input: MorningInput): void`
  - `toggleDomino(day: string): void`
  - Beide nutzen `appNow()`.

- [ ] **Step 1: Failing tests:**
  - **`stats-schema.test.ts`:**
    - „Morgen-Einträge werden einzeln geprüft“: Diese Einträge entfallen, die übrigen bleiben:
      - `day: '2026-13-01'`
      - `at: 'heute'`
      - `variant: 'mittel'`
    - Eine Intention mit 60 Zeichen wird auf 40 gekürzt; `intention: '   '` entfällt.
    - `value` bei `variant: 'kurz'` entfällt.
    - `dominoDone` ohne `domino` entfällt.
    - Zwei Einträge für einen Tag ergeben einen, den mit späterem `at`. Die Liste ist nach `day` sortiert; leer fehlt sie.
  - **`stats-persist.test.ts`:**
    - `withMorning` legt `{ day: '2026-10-28', variant: 'kurz', domino: 'Konzept' }` an.
    - Ein zweiter Aufruf am selben Tag ersetzt ihn. `dominoDone` bleibt bei `domino: '  konzept '` und fällt bei `domino: 'Anderes'`.
    - `withMorning` um 0:03 gehört zum neuen Tag.
    - `withDominoToggled` setzt und entfernt den Haken; ohne Eintrag oder ohne `domino` ergibt es `null`.
    - `sessions` bleibt unverändert.
  - **`stats-backup.test.ts`:**
    - Der Export enthält `mornings`.
    - Import:
      - Ein neuer Tag zählt 1 in `addedEnergy`.
      - Derselbe Eintrag noch einmal zählt 0 und erzeugt nichts doppelt.
      - Ein neuerer Eintrag desselben Tags ersetzt den alten und zählt 1.
      - Ein älterer ändert nichts.
    - Ein altes Backup ohne `mornings` lässt die Morgen-Einträge des Geräts unverändert.
  - **`stats-store.test.ts`:** `saveMorning` und `toggleDomino` speichern in `localStorage` und lösen keine Sitzung aus.
- [ ] **Step 2:** `npx vitest run tests/unit/stats-schema.test.ts tests/unit/stats-persist.test.ts tests/unit/stats-backup.test.ts` und `npx vitest run --project browser tests/browser/stats-store.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:** Die Prüfung folgt dem Muster von `parseCheckin`. Der Import zählt in die bestehende Energie-Meldung, `importMessage` bleibt unverändert.
- [ ] **Step 4:** dieselben Tests, `npm test`, `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: Morgen-Einträge speichern, prüfen und sichern`.

### Task 3: Logik des Morgen-Starts

**Files:**
- Create:
  - `src/lib/morning/logic.ts`
  - `tests/unit/morning-logic.test.ts` (TZ Europe/Berlin wie `energy-insights.test.ts`)

**Interfaces:**
- Consumes: `MorningEntry` (Task 2); `MORNING_EXERCISES`, `INTENTIONS`, `INTENTIONS_DEFAULT`, `VALUES` (Task 1); `dayKey`; `EnergyArea`.
- Produces:
  - `MORNING_FROM = 4`, `MORNING_UNTIL = 11`
  - `todayEntry(entries: readonly MorningEntry[], now: Date): MorningEntry | null`
  - `morningCard(entries: readonly MorningEntry[], now: Date): 'guten-morgen' | 'dein-tag' | null`
  - `exerciseOfDay(now: Date): MorningExerciseId`, `nextExercise(id: MorningExerciseId): MorningExerciseId`
  - `suggestions(area: EnergyArea | null): readonly string[]`
  - `ownWords(entries: readonly MorningEntry[]): string[]` und `ownValues(entries: readonly MorningEntry[]): string[]`. Höchstens 3, die jüngste zuerst, ohne Doppelte (Groß- und Kleinschreibung egal). Nur Wörter, die in keiner Vorschlags- bzw. Werteliste stehen.
  - `openDomino(entries: readonly MorningEntry[], now: Date): string | null`
  - `morningCount(entries: readonly MorningEntry[], now: Date): number`
  - `morningCountLine(n: number): string`, liefert „Morgen-Start an {n} der letzten 7 Tage“

- [ ] **Step 1: Failing tests** (`morning-logic.test.ts`):
  - **„Karte nach Uhrzeit“:** ohne Eintrag 3:59 → `null`, 4:00 → `'guten-morgen'`, 10:59 → `'guten-morgen'`, 11:00 → `null`.
  - **„Dein Tag bis Mitternacht“:** mit Eintrag von heute 14:00 → `'dein-tag'`. Mit Eintrag von gestern ist es am Folgetag um 0:00 `null`, um 4:00 `'guten-morgen'`.
  - **„Übung des Tages“:**
    - Drei aufeinanderfolgende Tage ergeben drei verschiedene Übungen in der Reihenfolge von `MORNING_EXERCISES`.
    - 23:59 und 0:00 desselben Kalendertags ergeben dieselbe; über den 25./26.10.2026 (Zeitumstellung) bleibt die Folge lückenlos.
    - `nextExercise('wach-klopfen') === 'strecken'`.
  - **„Vorschläge“:** `suggestions('geist')` beginnt mit `klar`; `suggestions(null)` ist `INTENTIONS_DEFAULT`.
  - **„Eigene Wörter“:**
    - Einträge mit `klar`, `Großzügig`, `wild`, `Wild`, `frei`, `ruhig im Sturm`: `ownWords` ergibt `['ruhig im Sturm', 'frei', 'Wild']`, die jüngste zuerst, ohne Vorschlagswörter, ohne Doppelte.
    - `ownValues` filtert `VALUES`.
  - **„Big Domino von gestern“:**
    - Gestern offen → der Text.
    - Gestern erledigt → `null`.
    - Vier Tage alt → `null`.
    - Nur ein Eintrag von heute → `null`.
    - Bei mehreren gilt der jüngste vor heute.
  - **„Zählung“:**
    - Einträge heute, vor 3 und vor 6 Tagen → 3; vor 7 Tagen zählt nicht.
    - Über die Zeitumstellung wird richtig gezählt.
    - `morningCountLine(4)` ergibt „Morgen-Start an 4 der letzten 7 Tage“.
- [ ] **Step 2:** `npx vitest run tests/unit/morning-logic.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** (Tage über Kalenderdaten wie `dayBack` in `insights.ts`, nicht über 24-h-Schritte).
- [ ] **Step 4:** derselbe Test, `npm test`, `npm run check`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Logik für Morgen-Karte, Übung des Tages und Big Domino`.

### Task 4: Ablauf-Zustand, Klangschale und Verdrahtung mit den Playern

**Files:**
- Create:
  - `src/lib/ui/morning-ui.svelte.ts`
  - `src/lib/morning/steps.ts`
  - `src/lib/audio/chime.ts`
  - `tests/unit/morning-steps.test.ts`
  - `tests/browser/morning-ui.test.ts`
  - `tests/browser/chime.test.ts`
- Modify:
  - `src/main.ts` (Haken vor `sessionUi.done = info`)
  - `src/components/player/HackEffect.svelte` („Weiter“ im Ablauf)

**Interfaces:**
- Consumes:
  - `startHack`, `startGuidedSession`, `clearDone` (`session-ui.svelte.ts`)
  - `saveCheckin`, `saveMorning` (M9, Task 2)
  - `exerciseOfDay`, `nextExercise` (Task 3)
  - `playerOpen` (`player-state.ts`)
  - `meditationById('guten-morgen')`
  - `assetUrl`, `EFFECTS` (`src/lib/sounds/catalog`)
- Produces, in `steps.ts`:
  - `type MorningStep = 'checkin' | 'aktivieren' | 'vertiefen' | 'intention' | 'dankbarkeit' | 'domino' | 'abschluss'`
  - `morningSteps(variant: MorningVariant): MorningStep[]`, ohne `'abschluss'`:
    - kurz: `checkin, aktivieren, intention, dankbarkeit, domino`
    - lang: `checkin, aktivieren, vertiefen, intention, dankbarkeit, domino`
- Produces, in `morning-ui.svelte.ts`:
  - `morningUi`, ein `$state`:
    `{ open: boolean; variant: MorningVariant; step: MorningStep; exercise: MorningExerciseId; checkin: Record<EnergyArea, EnergyLevel> | null; draft: { intention: string; gratitude: string; value: string; domino: string }; awaiting: 'hack' | 'guided' | null; confirming: boolean }`
  - `openMorning(variant: MorningVariant): void`: setzt alles zurück; Schritt `checkin`, Übung `exerciseOfDay(appNow())`.
  - `nextStep(): void`: zum folgenden Schritt, nach `domino` zu `'abschluss'`. Speichert dabei `saveMorning` aus dem Entwurf (leere Felder entfallen) und ruft `playChime()`.
  - `skipStep(): void`, entspricht `nextStep()` ohne die Eingaben des aktuellen Schritts.
  - `closeMorning(): void`
  - `swapExercise(): void`
  - `startExercise(id: string): void`: setzt `awaiting = 'hack'`, dann `startHack(id)`, synchron in der Geste.
  - `startMorningMeditation(): void`: setzt `awaiting = 'guided'`, dann `startGuidedSession(meditationById('guten-morgen')!)`.
  - `morningSessionEnded(kind: ResultKind, counted: boolean): boolean`. Gibt `true` zurück, wenn der Ablauf das Ende übernimmt; dann setzt `main.ts` kein `sessionUi.done`.
    - Guided, während `awaiting === 'guided'`: `awaiting = null`, `nextStep()`, Rückgabe `true`.
    - Hack, der nicht zählt: `awaiting = null`, Schritt bleibt, Rückgabe `false`.
    - Hack, der zählt: `awaiting` bleibt, Rückgabe `false`; `HackEffect` zeigt „Weiter“.
  - `morningContinueAfterHack(): void`: `clearDone()`, `awaiting = null`, `nextStep()`.
- Produces, in `chime.ts`:
  - `playChime(ctx?: () => AudioContext): void`, „Feuer und vergiss“.
  - Lädt die Klangschale `EFFECTS[0]` über `assetUrl`, dekodiert sie und spielt einen Anschlag (Lautstärke 0,8).
  - Fehler werden still verschluckt. Der Kontext wird einmal erzeugt und behalten.

- [ ] **Step 1: Failing tests:**
  - **`morning-steps.test.ts`:** die beiden Folgen oben, wörtlich.
  - **`morning-ui.test.ts` (browser):**
    - `openMorning('kurz')` setzt Schritt `checkin` und Übung des Tages.
    - `nextStep()` nach `domino` geht zu `abschluss` und speichert genau einen Eintrag mit den getrimmten Entwurfswerten, ohne leere Felder.
    - `skipStep()` überall bis zum Abschluss ergibt einen Eintrag nur mit `variant`.
    - `swapExercise()` dreimal kehrt zur ersten Übung zurück.
    - `morningSessionEnded('guided', true)` mit `awaiting: 'guided'` gibt `true` und geht einen Schritt weiter.
    - `morningSessionEnded('hack', false)` gibt `false` und bleibt bei `aktivieren`.
    - Ohne offenen Ablauf gibt jede Art `false`.
  - **`chime.test.ts` (browser):** `playChime` mit einem Kontext-Ersatz ruft `decodeAudioData` und `start` einmal auf. Scheitert das Laden, wirft es nicht.
- [ ] **Step 2:** `npx vitest run tests/unit/morning-steps.test.ts` und `npx vitest run --project browser tests/browser/morning-ui.test.ts tests/browser/chime.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:**
  - **`main.ts`:** `connectSessions(engine, recordResult, (r, id) => { const info = doneInfoFor(r, id); if (morningSessionEnded(r.kind, info !== null && info.counted !== false)) return; if (info) sessionUi.done = info })`. Für Guided bedeutet „zählt“ `info.counted`.
  - **`HackEffect`:** Mit `morningUi.awaiting === 'hack'` ersetzt ein Knopf „Weiter“ (gesichert mit `tapArming`) die Knöpfe „Fertig“ und „Noch einmal“ und ruft `morningContinueAfterHack()`. Der Hinweis „Ohne Antwort einfach „Fertig“.“ heißt dann „Ohne Antwort einfach „Weiter“.“
- [ ] **Step 4:** dieselben Tests, `npm test`, `npm run check`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Zustand des Morgen-Starts und Übergabe an die Player`.

### Task 5: Der Ablauf im Vollbild und die Karte im Reiter „Energie“

**Files:**
- Create:
  - `src/components/morning/MorningFlow.svelte` (Kopfzeile, Fortschritt, Rückfrage, Fokus je Schritt, Schritt-Weiche)
  - `src/components/morning/CheckinStep.svelte`
  - `src/components/morning/ActivateStep.svelte`
  - `src/components/morning/DeepenStep.svelte`
  - `src/components/morning/WordPicker.svelte` (Radiogruppe aus Vorschlägen, eigenen Wörtern und Feld)
  - `src/components/morning/IntentionStep.svelte`
  - `src/components/morning/GratitudeStep.svelte`
  - `src/components/morning/DominoStep.svelte`
  - `src/components/morning/MorningDone.svelte`
  - `src/components/morning/MorningStartCard.svelte` (Reiter „Energie“)
  - `tests/e2e/morgen.spec.ts`
- Modify:
  - `src/App.svelte`: `MorningFlow` an der Wurzel, außerhalb von `inert`, sichtbar bei `morningUi.open`. Mit `hidden` und `inert`, solange `playerOpen('hack') || playerOpen('guided')`. `appInert` gilt auch bei `morningUi.open`.
  - `src/screens/Energie.svelte`: `MorningStartCard` zwischen Kopf und „Dein Akku“.
  - `tests/e2e/energie.spec.ts`: Reihenfolge der Überschriften um „Morgen-Start“ ergänzen.

**Interfaces:**
- Consumes:
  - alles aus Task 4
  - `LevelDots`, `AREAS`, `AREA_INFO`, `weakestArea`, `freshCheckin` (M9)
  - `suggestions`, `ownWords`, `ownValues`, `openDomino`, `todayEntry` (Task 3)
  - `hackById`, `hackLength`, `HackIcon`, `AreaChip`, `Motiv`, `areaMotiv`, `startSprint` (M9)
  - `startable` + Offline-Status wie in `Heute.svelte`
  - `ConfirmDialog`, `openLayer`, `tapArming`
- Produces:
  - `MorningStartCard.svelte`, ohne Props
  - `MorningFlow.svelte`, ohne Props, liest `morningUi`

- [ ] **Step 1: Failing tests** (`morgen.spec.ts`; Start über die Karte im Reiter „Energie“):
  - **„Kurzer Ablauf“** (`setFixedTime` auf 7:00, kein Programm):
    - Fünf Fortschrittspunkte, Name „Schritt 1 von 5“.
    - Check-in mit Geist 1 und den übrigen Bereichen bei 3, dann „Weiter“.
    - Bei „Aktivieren“ „Überspringen“.
    - Intention zeigt „Dein Geist-Akku ist gerade am niedrigsten.“ und als ersten Vorschlag „klar“. „klar“ wählen, die Zeile lautet „Heute will ich klar sein.“
    - Dankbarkeit „den ruhigen Kaffee“.
    - Big Domino mit 80 Zeichen ohne Leerzeichen: Der Zähler zeigt „80 / 80“, und nichts scrollt seitlich.
    - Der Abschluss zeigt alle Angaben.
    - Gespeichert sind ein Check-in und `mornings` mit einem Eintrag `variant: 'kurz'`.
    - „Fertig“ schließt; die History-Tiefe ist 0.
  - **„Langer Ablauf“:**
    - Sechs Punkte; Schritt „Vertiefen“ mit beiden Wahlknöpfen.
    - Um 6:30 steht bei „Tageslicht tanken“ „Am besten, sobald es hell ist.“ (`setFixedTime`; ohne Start).
    - Überspringen; der Wert „Geduld“ landet als `value`.
  - **„Von gestern offen“:** Vorbereiteter Eintrag von gestern mit offenem Big Domino. „Übernehmen“ füllt das Feld.
  - **„Beenden mit Rückfrage“:** „×“ → „Morgen-Start beenden?“ → „Weiter machen“ bleibt; „Beenden“ schließt ohne Morgen-Eintrag, der Check-in bleibt gespeichert.
  - **„Übung im Ablauf“** (Echtzeit, `test.setTimeout(150_000)`, ohne `page.clock`):
    - Check-in.
    - `wach-klopfen` ist dran („Andere Übung“ bis „Wach-Klopfen“), dann „Starten · 1:00“.
    - Der Hack-Player läuft, der Ablauf ist verborgen.
    - Die Zurück-Geste fragt „Hack beenden?“, „Weiter üben“.
    - Am Ende „Körper jetzt?“ in einer Reihe, Tipp auf 4, „Weiter“ → Schritt „Intention“.
    - Der gespeicherte Lauf hat `before` und `after: 4`.
    - Danach bis zum Abschluss überspringen und „Fertig“: Die History-Tiefe ist 0 (Review Focus 2).
  - **„Übung früh beendet“:** nach 5 s beenden → wieder „Aktivieren“, kein Lauf gespeichert.
  - **„Doppeltipp“:** „Kurz · 5 Min“ doppelt getippt (`doubleTap`) landet nicht auf „Überspringen“ und nicht auf einem Punkt.
  - **„360 px und 130 %“:** In jedem Schritt scrollt nichts seitlich, und die Tippflächen sind mindestens 44 px groß. Ein eigenes Wort mit 40 Zeichen ohne Leerzeichen bricht in Intention und Abschluss um (Review Focus 5).
- [ ] **Step 2:** `npx playwright test tests/e2e/morgen.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** nach Spec §2.2–§2.3:
  - Die Wortwahl ist eine Radiogruppe wie `ChoiceGroup`. Ein erneuter Tipp nimmt die Wahl zurück. Tippen in das Feld hebt die Auswahl auf, eine Auswahl leert das Feld.
  - Die Übungskarte zeigt das Körper-Motiv mit 72 px und `alt=""`.
  - „Guten Morgen“ wird gesperrt, wenn `startable` falsch ist.
  - Der Abschluss nutzt das Motiv `vorschlag-morgen` mit 96 px. „Fokus-Sprint starten · {n} Min“ schließt den Ablauf und ruft `startSprint(settings.focus.minutes, domino, settings.focus.sound)`.
- [ ] **Step 4:** derselbe Test, dazu `npm test`, `npm run check` und `npx playwright test`, erwartet: PASS (Review Focus 1: bestehende Zählungen in „Energie“ angepasst).
- [ ] **Step 5: Commit** `feat: Morgen-Start als geführter Ablauf`.

### Task 6: Karten auf „Heute“ und die Zeile in „Deine Woche“

**Files:**
- Create:
  - `src/components/morning/MorningTodayCard.svelte` („Guten Morgen“ bzw. „Dein Tag“)
  - `tests/e2e/morgen-heute.spec.ts`
- Modify:
  - `src/screens/Heute.svelte`: Karte zwischen Begrüßung und „Dein Akku“.
  - `src/components/energy/WeekCard.svelte`: Zeile unter der Fokus-Zeile.
  - `tests/e2e/heute.spec.ts`, `tests/e2e/karten.spec.ts` und jeder weitere Test, der Karten auf „Heute“ zählt oder ordnet: Uhrzeit fest auf 12:00 oder die Karte mitzählen (Review Focus 1).

**Interfaces:**
- Consumes:
  - `morningCard`, `todayEntry`, `morningCount`, `morningCountLine`, `MORNING_FROM`, `MORNING_UNTIL` (Task 3)
  - `openMorning` (Task 4)
  - `toggleDomino` (Task 2)
  - `startSprint`, `Motiv`, `appNow`, `tapArming` (M9)

- [ ] **Step 1: Failing tests** (`morgen-heute.spec.ts`, `setFixedTime`, kein Programm, erfundene Daten):
  - **„Guten Morgen zur rechten Zeit“:**
    - Um 7:00 steht die Karte über „Dein Akku“ mit beiden Knöpfen; „Kurz · 5 Min“ öffnet den Ablauf bei „Schritt 1 von 5“.
    - Um 11:00 fehlt sie.
    - Mit einem Eintrag von heute erscheint stattdessen „Dein Tag“.
  - **„Fortsetzen nach 11 Uhr“:**
    - Seite um 10:58 laden.
    - Uhr auf 11:02, dann `visibilitychange`.
    - Die Karte ist weg, und es gab kein Neuladen (Fenster-Marke).
  - **„Dein Tag“:**
    - Eintrag mit Intention „klar“, Big Domino „Konzept skizzieren“ und Dankbarkeit: Alle drei sind sichtbar, dazu die Zählung „Morgen-Start an 1 der letzten 7 Tage“.
    - Der Abhak-Knopf „Big Domino erledigt“ setzt `dominoDone` und blendet „Sprint starten“ aus.
    - Ein zweiter Tipp nimmt beides zurück.
  - **„Sprint starten“:**
    - Startet den Sprint-Player mit „Konzept skizzieren“.
    - Der Sprint wird nach wenigen Sekunden beendet; es gibt keinen Sprint-Eintrag.
  - **„Mitternacht“:** Um 23:59 steht „Dein Tag“, um 0:00 (am Folgetag) nicht mehr.
  - **„Alles übersprungen“:** Ein Eintrag nur mit `variant` zeigt „Morgen-Start erledigt.“
  - **„Woche“:** Mit Einträgen an 4 der letzten 7 Tage zeigt „Deine Woche“ „Morgen-Start an 4 der letzten 7 Tage“; ohne Einträge fehlt die Zeile.
  - **„360 px und 130 %“:** Ein Big Domino mit 80 Zeichen ohne Leerzeichen bricht um, und nichts scrollt seitlich.
- [ ] **Step 2:** `npx playwright test tests/e2e/morgen-heute.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** nach Spec §2.1:
  - Goldrand wie die Reset-Karte.
  - Motiv `vorschlag-morgen` (80 px, `alt=""`).
  - Ist der Big Domino erledigt, wird er durchgestrichen und gedämpft.
  - Abhak-Knopf und „Sprint starten“ sind mindestens 44 px groß.
- [ ] **Step 4:** derselbe Test, dazu `npm test`, `npm run check` und `npx playwright test` (ganze Suite, Review Focus 1), erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Karten „Guten Morgen“ und „Dein Tag“ auf Heute`.

### Task 7: README, Haupt-Spec und Gesamtprüfung

**Files:**
- Modify:
  - `README.md`
  - `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- [ ] **Step 1: README:**
  - **„Handy-Checkliste Meilenstein 10“:** aus Spec §8, als Abhak-Liste im Stil der Nachbarn, vor „Handy-Checkliste Meilenstein 9“.
  - **„Erinnerungen einrichten“:** ein Morgen-Wecker, z. B. 6:45, mit dem Hinweis, die App danach über das Startbildschirm-Symbol zu öffnen.
  - **„Brain Hacks schreiben“:** die Zahl der Karten (19) und die Liste der Tests, die sie festhalten, angleichen.
- [ ] **Step 2: Haupt-Spec**, Ergänzung vom 28.10.2026 (Meilenstein 10), jeweils mit Verweis auf die M10-Spec:
  - bei den Daten: `mornings`
  - in §3 („Heute“): die Morgen-Karte über „Dein Akku“
- [ ] **Step 3: Gesamtprüfung:** `npm run check` (0 Fehler), `npm test` (alle grün), `npx playwright test` (alle grün). Die Zahlen kommen ins Ledger.
- [ ] **Step 4: Commit** `docs: Handy-Checkliste M10 und Morgen-Wecker`.
