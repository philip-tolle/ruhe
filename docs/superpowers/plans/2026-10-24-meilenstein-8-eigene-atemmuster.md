# Meilenstein 8: Eigene Atemmuster – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unter „Atmen“ eigene Atemmuster (vier Phasen, Name) anlegen, bearbeiten, löschen und starten, mit Statistik, „Zuletzt genutzt“ und Backup.

**Architecture:**
- **Kern:** Ein eigenes Muster ist ein kleiner Datensatz (`CustomBreathPattern`) in `ruhe.v1`. `customToPattern` macht daraus ein gewöhnliches `BreathPattern`.
- **Ablauf:** Plan, Anzeige und Programm nehmen künftig ein Muster oder eine feste Kennung an. Feste Übungen und bisherige Aufrufe bleiben so unverändert.
- **Oberfläche:** Abschnitt „Eigene Muster“ auf „Atmen“ und ein Editor als Sheet.

**Tech Stack:** Svelte 5 (Runes), TypeScript, Vitest (unit/browser), Playwright (Pixel 7, 412 px).

**Spec:** `docs/superpowers/specs/2026-10-24-ruhe-m8-eigene-atemmuster-design.md`

## Global Constraints

- **Phasen und Bereiche:**
  - Einatmen `inhale` 2–15 s, Standard 4.
  - Halten nach dem Einatmen `holdIn` 0–20 s, Standard 2.
  - Ausatmen `exhale` 2–20 s, Standard 6.
  - Halten nach dem Ausatmen `holdOut` 0–20 s, Standard 0.
  - Schritt 0,5 s; Phasen mit 0 s entfallen.
- **Name:** getrimmt, höchstens 30 Zeichen; leer heißt „Eigenes Muster“.
- **Kennung:** `eigen-` und 8 Hex-Zeichen, unveränderlich.
- **Anzahl:** höchstens 6 beim Anlegen, Hinweis „Höchstens 6 eigene Muster.“; beim Laden höchstens 50.
- **Beschreibung:** Phasen über 0 s mit „ · “, Sekunden mit Komma, z. B. „Einatmen 4 s · Halten 2 s · Ausatmen 6 s“.
- **Texte:**
  - Abschnitt „Eigene Muster“; leer: „Stell dir deinen eigenen Rhythmus zusammen.“
  - Knöpfe „Neues Muster“, „{Name} starten“, „{Name} bearbeiten“.
  - Editor-Titel „Neues Muster“ / „Muster bearbeiten“; Feld „Name“ mit Platzhalter „Eigenes Muster“.
  - Regler „Einatmen“, „Halten nach dem Einatmen“, „Ausatmen“, „Halten nach dem Ausatmen“; Knöpfe „{Phase} kürzer“ / „{Phase} länger“.
  - Vorschau „Ein Atemzug dauert 12 s, etwa 5 pro Minute.“
  - „Speichern“, „Löschen“.
  - Rückfrage: Titel „Muster löschen?“, Text „„{Name}“ verschwindet aus der Liste. Deine bisherigen Sitzungen bleiben in der Statistik.“, Knöpfe „Löschen“ und „Behalten“.
- **Daten:**
  - `ruhe.v1.breathPatterns` (fehlt ohne Muster), `version` bleibt 1.
  - Ein ungültiges oder doppeltes Muster entfällt einzeln.
  - Backup: Export mit Mustern; Import fügt nur unbekannte Kennungen hinzu.
- **„Zuletzt genutzt“:**
  - Eigenes Muster: „{Name} · 3 Min“, Waschung der Tageszeit.
  - Gelöschtes Muster: Ersatz „Ankommen im Atem“.
- **Ziele:** Alle Knöpfe mindestens 48 px; 360 px und 130 % Schrift ohne seitliches Überlaufen.
- **Kosten:** Keine neuen Bilder, keine Generierung.

## Review Focus

1. **Gemerktes Muster gelöscht:** „Heute“ zeigt bei „Zuletzt genutzt“ „Ankommen im Atem“ mit „Jetzt starten“, kein Fehler (Tests in Task 3 und 4).
2. **Kaputtes Muster im Speicher** (z. B. Text statt Zahl): Nur dieses Muster entfällt, Sitzungen und Einstellungen bleiben (Test in Task 2).
3. **Backup zweimal importiert** oder auf ein leeres Gerät: Die Muster sind einmal da, nie doppelt (Test in Task 2).
4. **Regler an den Grenzen:**
   - Der Knopf ist gesperrt, und Werte bleiben Vielfache von 0,5.
   - „5,5 s“ steht mit Komma (Tests in Task 1 und 4).
5. **Editor verlassen ohne Speichern** (Zurück-Geste, Tippen daneben) oder „Behalten“ in der Rückfrage: Nichts ändert sich (Test in Task 4).

---

### Task 1: Eigenes Muster als Atemmuster, Ablauf für beliebige Muster

**Files:**
- Create: `src/lib/breath/custom.ts`
- Modify:
  - `src/lib/breath/patterns.ts`
  - `src/lib/audio/program.ts` (`breathProgram`)
- Test:
  - `tests/unit/breath-custom.test.ts` (neu)
  - `tests/unit/breath.test.ts`
  - `tests/browser/program.test.ts`

**Interfaces:**
- Produces, in `custom.ts`:
  - **Typen:**
    - `interface CustomBreathPattern { id: string; name: string; inhale: number; holdIn: number; exhale: number; holdOut: number }`
    - `type PhaseField = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'`
  - **Konstanten:**
    - `PHASE_FIELDS: readonly PhaseField[]` (in dieser Reihenfolge)
    - `PHASE_LIMITS: Record<PhaseField, { min: number; max: number }>`
    - `PHASE_FIELD_LABEL: Record<PhaseField, string>`
    - `PHASE_STEP = 0.5`
    - `MAX_CUSTOM_PATTERNS = 6`, `MAX_LOADED_PATTERNS = 50`
    - `MAX_NAME_LENGTH = 30`, `DEFAULT_PATTERN_NAME = 'Eigenes Muster'`
    - `CUSTOM_PATTERN_ID = /^eigen-[0-9a-f]{8}$/`
  - **Funktionen:**
    - `newCustomPatternId(): string`
    - `defaultCustomPattern(id: string): CustomBreathPattern` (Name `''`, 4/2/6/0)
    - `stepSeconds(field: PhaseField, value: number, direction: 1 | -1): number`
    - `customTitle(p: CustomBreathPattern): string`
    - `customToPattern(p: CustomBreathPattern): BreathPattern`
    - `parseCustomPattern(raw: unknown): CustomBreathPattern | null`
    - `cyclePreview(p: CustomBreathPattern): string`
    - `secondsLabel(seconds: number): string` („5,5 s“)
    - `resolvePattern(id: string, custom: readonly CustomBreathPattern[]): BreathPattern | null`
- Produces, in `patterns.ts`:
  - `BreathPattern.id` wird `string`.
  - `BREATH_PATTERNS: readonly (BreathPattern & { id: BreathPatternId })[]`
  - `isBuiltinPatternId(id: string): id is BreathPatternId`
  - `breathPlan(pattern: BreathPattern | BreathPatternId, minutes)`
  - `breathAt(pattern: BreathPattern | BreathPatternId, elapsed, length)`
- Produces, in `program.ts`: `breathProgram(pattern: BreathPattern | BreathPatternId, minutes, opts)` mit `ref = pattern.id` und `title = \`Atmen · ${pattern.title}\``.

- [ ] **Step 1: Failing tests** in `tests/unit/breath-custom.test.ts`:
  - **„customToPattern: vier Phasen, 0-s-Phasen entfallen“:**
    - `{inhale: 4, holdIn: 2, exhale: 6, holdOut: 0}` ergibt die Phasen `[ein 4, halten 2, aus 6]` und die Beschreibung `'Einatmen 4 s · Halten 2 s · Ausatmen 6 s'`.
    - `4.5/0/5.5/0` ergibt `'Einatmen 4,5 s · Ausatmen 5,5 s'`.
    - `4/4/4/4` ergibt vier Phasen, die letzte `halten`.
  - **„Titel: getrimmter Name oder ‚Eigenes Muster‘“:** `'  Abendruhe '` wird zu `'Abendruhe'`; `''` und `'   '` werden zu `'Eigenes Muster'`. `customToPattern(p).id === p.id`.
  - **„stepSeconds: 0,5er-Schritte, an den Grenzen bleibt der Wert“:**
    - `stepSeconds('inhale', 4, 1) === 4.5`, `('inhale', 2, -1) === 2`, `('inhale', 15, 1) === 15`.
    - `('holdIn', 0, -1) === 0`, `('exhale', 20, 1) === 20`.
  - **„parseCustomPattern“:**
    - Gültig ergibt dasselbe Objekt.
    - Ein Name über 30 Zeichen wird auf 30 gekürzt; ein Name, der kein Text ist, ergibt `null`.
    - `null` ergeben auch: Kennung nicht im Format, Zahl außerhalb des Bereichs, kein Vielfaches von 0,5 (`4.2`), Text statt Zahl, `NaN`.
  - **„cyclePreview“:**
    - 4/2/6/0 ergibt `'Ein Atemzug dauert 12 s, etwa 5 pro Minute.'`
    - 4/7/8/0 ergibt `'… 19 s, etwa 3,2 pro Minute.'`
    - 5.5/0/5.5/0 ergibt `'… 11 s, etwa 5,5 pro Minute.'`
  - **„newCustomPatternId“:** passt auf `CUSTOM_PATTERN_ID`, zwei Aufrufe unterscheiden sich.
  - **„resolvePattern“:**
    - Eine feste Kennung ergibt das feste Muster.
    - Eine eigene Kennung aus der Liste ergibt `customToPattern`.
    - Eine unbekannte Kennung ergibt `null`.
  - In `breath.test.ts`:
    - „breathPlan und breathAt mit einem Muster-Objekt“: Für 4/2/6/0 hat der Plan bei 1 Minute 5 Zyklen und die Länge 60, die Cues fallen auf `0 ein, 4 halten, 6 aus, 12 ein …`. `breathAt(p, 5, 60)` liefert `kind: 'halten'`, Label „Halten“ und `level` 1.
    - Ergebnis gleich wie mit der Kennung: `breathPlan('box', 3)` stimmt mit `breathPlan(patternById('box'), 3)` überein.
  - In `program.test.ts`: `breathProgram(customToPattern(p), 1, opts)` hat `ref === p.id`, `title === 'Atmen · Abendruhe'` und `length === 60`.
- [ ] **Step 2:** `npx vitest run tests/unit/breath-custom.test.ts tests/unit/breath.test.ts tests/browser/program.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** (Signaturen oben).
  - Feste und eigene Kennungen überschneiden sich nie (Präfix `eigen-`).
  - `parseCustomPattern` prüft jede Zahl mit `Number.isFinite`, dem Bereich und `Number.isInteger(v * 2)`.
  - Die Zahl pro Minute ist `Math.round(600 / Zyklus) / 10`, mit Komma und ohne „,0“.
  - `effect` eigener Muster ist `'Eigener Rhythmus'`.
- [ ] **Step 4:** dieselben Tests plus `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: eigene Atemmuster als Datensatz, Ablauf für beliebige Muster`.

### Task 2: Speichern, Laden und Backup

**Files:**
- Modify:
  - `src/lib/stats/schema.ts`
  - `src/lib/stats/persist.ts`
  - `src/lib/stats/store.svelte.ts`
  - `src/lib/stats/backup.ts`
- Test: `tests/unit/stats-schema.test.ts`, `tests/unit/stats-backup.test.ts`, `tests/unit/stats-persist.test.ts` (oder die vorhandene Testdatei zu `persist.ts`)

**Interfaces:**
- Consumes: `parseCustomPattern`, `CUSTOM_PATTERN_ID`, `MAX_LOADED_PATTERNS`, `isBuiltinPatternId` (Task 1).
- Produces:
  - `AppData.breathPatterns?: CustomBreathPattern[]`
  - `LastUsed` Atem: `{ kind: 'breath'; pattern: string; minutes: number }`
  - `withBreathPattern(data: AppData, p: CustomBreathPattern): AppData` (ersetzt nach Kennung, sonst anhängen)
  - `withoutBreathPattern(data: AppData, id: string): AppData` (leere Liste: Feld entfällt)
  - im Store `saveBreathPattern(p)` und `deleteBreathPattern(id)`

- [ ] **Step 1: Failing tests:**
  - `stats-schema.test.ts`:
    - „parseData liest eigene Muster“: zwei gültige bleiben in Reihenfolge; ohne Feld oder bei leerer Liste fehlt `breathPatterns`.
    - Review Focus 2: „ein kaputtes Muster entfällt einzeln, Sitzungen und Einstellungen bleiben“. `[gültig, {…inhale: 'vier'}, gültig mit derselben id wie das erste]` ergibt genau das erste; `sessions` und `settings` bleiben unverändert.
    - „höchstens 50 Muster“: Aus 60 werden die ersten 50.
    - „lastUsed mit eigener Kennung“: `{ kind: 'breath', pattern: 'eigen-0123abcd', minutes: 3 }` bleibt. `pattern: 'eigen-xyz'` und `'unbekannt'` ergeben kein `lastUsed`.
  - `stats-backup.test.ts`:
    - „serializeBackup enthält eigene Muster“: Mit Mustern steht `breathPatterns` im JSON, ohne fehlt das Feld.
    - Review Focus 3: „Import fügt nur unbekannte Muster hinzu“.
      - Gerät hat A, Datei hat A' (gleiche id, anderer Name) und B: Ergebnis `[A, B]`.
      - Ein zweiter Import derselben Datei ergibt weiter `[A, B]`.
      - Auf leerem Gerät ergibt sie `[A', B]`.
      - Datei ohne Feld: Die Muster des Geräts bleiben.
  - Persist-Test: `withBreathPattern` ersetzt bzw. hängt an, ohne `data` zu verändern. `withoutBreathPattern` des letzten Musters entfernt das Feld; eine unbekannte id ändert nichts.
- [ ] **Step 2:** die drei Testdateien, erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `parseData` nimmt `breathPatterns` nur als Array.
  - `parseLastUsed` akzeptiert `isBuiltinPatternId(pattern) || CUSTOM_PATTERN_ID.test(pattern)`.
  - `mergeBackup` bildet die Vereinigung nach Kennung: zuerst die Muster des Geräts, dann neue aus der Datei.
- [ ] **Step 4:** Tests plus `npm run check`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: eigene Atemmuster speichern, laden und im Backup`.

### Task 3: „Zuletzt genutzt“, Waschung und Player für eigene Muster

**Files:**
- Modify:
  - `src/lib/ui/heute-view.ts`
  - `src/lib/content/waschungen.ts`
  - `src/screens/Heute.svelte`
  - `src/components/player/BreathPlayer.svelte`
- Test: `tests/unit/heute-view.test.ts`, `tests/unit/waschungen.test.ts`

**Interfaces:**
- Consumes: `resolvePattern`, `customToPattern`, `isBuiltinPatternId` (Task 1); `AppData.breathPatterns` (Task 2).
- Produces:
  - `lastUsedSummary(last, custom = [])`
  - `lastUsedStart(last, breath, custom = [])`
  - `lastUsedCard(last, custom = [])`
  - Jeweils `custom: readonly CustomBreathPattern[]`. Eine Atemübung, deren Muster `resolvePattern` nicht findet, gilt wie eine unbekannte Meditation: Die Karte zeigt den Ersatz, und `lastUsedStart` startet den Ersatz.
  - `zuletztWaschung(last, now)`: Atemübung mit eigener Kennung ergibt `tageszeitWaschung(now)`.

- [ ] **Step 1: Failing tests:**
  - `heute-view.test.ts`:
    - „eigenes Muster in Zuletzt genutzt“: `lastUsedSummary({kind:'breath', pattern: p.id, minutes: 3}, [p])` ergibt `'Abendruhe · 3 Min'`. `lastUsedStart(...)` ist ein Programm mit `ref === p.id` und `length === breathPlan(customToPattern(p), 3).length`.
    - Review Focus 1: „gelöschtes Muster: Ersatz Ankommen im Atem“. `lastUsedCard({kind:'breath', pattern: 'eigen-0123abcd', minutes: 3}, [])` liefert `action: 'Jetzt starten'` und die Zusammenfassung von „Ankommen im Atem“.
  - `waschungen.test.ts`: `zuletztWaschung({kind:'breath', pattern:'eigen-0123abcd', minutes:3}, 'morgen') === 'pfirsich'` und für `'abend'` `'lavendel'`.
- [ ] **Step 2:** erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `Heute.svelte` reicht `stats.data.breathPatterns ?? []` an `lastUsedCard` und `lastUsedStart`.
  - `BreathPlayer.svelte` löst das Muster mit `resolvePattern(run.ref, stats.data.breathPatterns ?? [])` auf (Beschreibung und `breathAt`).
  - Findet es keines, zeigt der Player keine Blüte (`moment` ist `null`), statt zu werfen.
- [ ] **Step 4:** Tests plus `npm run check`, erwartet: PASS; `npx playwright test tests/e2e/heute.spec.ts tests/e2e/atmen.spec.ts` grün.
- [ ] **Step 5: Commit** `feat: eigene Atemmuster in „Zuletzt genutzt“ und im Player`.

### Task 4: Abschnitt „Eigene Muster“ und Editor

**Files:**
- Create:
  - `src/components/Stepper.svelte`
  - `src/components/breath/PatternEditor.svelte`
  - `tests/e2e/atemmuster.spec.ts`
- Modify: `src/screens/Atmen.svelte`
- Test: `tests/e2e/atemmuster.spec.ts`; bestehende Atmen-Zählungen in `tests/e2e/atmen.spec.ts` und `tests/e2e/karten.spec.ts` nur anpassen, wenn der neue Abschnitt sie berührt.

**Interfaces:**
- Consumes: alles aus Task 1–3; `saveBreathPattern`, `deleteBreathPattern` (Task 2); `Sheet.svelte`, `ConfirmDialog.svelte` (vorhanden).
- Produces:
  - `Stepper.svelte`: Props `{ label: string; valueText: string; canDecrease: boolean; canIncrease: boolean; onDecrease: () => void; onIncrease: () => void }`.
    - Knöpfe „{label} kürzer“ / „{label} länger“, jeweils `disabled`, wenn nicht möglich.
    - Wert in `aria-live="polite"`; Gruppe mit `role="group"` und `aria-label={label}`.
  - `PatternEditor.svelte`: Props `{ pattern: CustomBreathPattern | null; onClose: () => void }` (`null` = neu).

- [ ] **Step 1: Failing E2E-Tests** in `tests/e2e/atemmuster.spec.ts` (leerer Start, Navigation zu „Atmen“):
  - „empty: the section invites to create a pattern“: Die Überschrift „Eigene Muster“ und der Satz aus den Global Constraints sind zu sehen, ebenso der Knopf „Neues Muster“.
  - „create, list and start a pattern“:
    - **Anlegen:** „Neues Muster“, Name „Abendruhe“, Einatmen 2× länger (5 s), Halten nach dem Einatmen 1× kürzer (1,5 s).
    - **Vorschau:** „Ein Atemzug dauert 12,5 s, etwa 4,8 pro Minute.“
    - **Speichern:** Das Blatt ist zu, und der Knopf „Abendruhe starten“ ist da, mit der Beschreibung „Einatmen 5 s · Halten 1,5 s · Ausatmen 6 s“.
    - **Gespeichert:** `localStorage` enthält ein Muster mit diesen Werten.
    - **Start bei „1 Min“:** Der Player „Atemübung“ zeigt die Überschrift „Abendruhe“ und die Beschreibung, der Phasen-Text ist „Einatmen“.
    - **Gemerkt:** `lastUsed` ist `{ kind: 'breath', pattern: <id>, minutes: 1 }`.
  - „limits: the buttons stop at the bounds“:
    - Einatmen 4× kürzer: Wert „2 s“, „Einatmen kürzer“ ist `disabled`.
    - „Halten nach dem Ausatmen kürzer“ ist von Anfang an `disabled` (0 s).
  - „edit and delete with confirmation“ (Review Focus 5):
    - **Bearbeiten:** Name zu „Morgen“ ändern und speichern; in der Liste steht „Morgen starten“.
    - **Löschen, dann „Behalten“:** Das Muster bleibt.
    - **Löschen, dann „Löschen“:** Der Abschnitt ist wieder leer.
  - „leaving the editor discards the changes“ (Review Focus 5):
    - Name ändern, dann `page.goBack()`: Das Blatt ist zu, der Name unverändert.
    - Dasselbe mit Tippen auf die Fläche daneben.
  - „at most six patterns“: Nach 6 gespeicherten fehlt „Neues Muster“, und „Höchstens 6 eigene Muster.“ steht da.
  - „a reload keeps the patterns“.
  - „Heute: the last used own pattern restarts; deleted, the card falls back“ (Review Focus 1):
    - „Zuletzt genutzt“ zeigt „Abendruhe · 1 Min“, und „Erneut starten“ öffnet den Player mit „Abendruhe“.
    - Nach dem Löschen zeigt die Karte „Ankommen im Atem · 5 Min“ mit „Jetzt starten“.
  - „on a small phone at 130 %“ (360 × 640): Editor und Liste laufen nicht seitlich über, alle Knöpfe im Editor und in der Liste sind mindestens 48 × 48 px.
- [ ] **Step 2:** `npx playwright test tests/e2e/atemmuster.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - **`Atmen.svelte`:**
    - Unter den Kacheln: Abschnitt mit `h2` „Eigene Muster“ und Karte.
    - Zeilen: Startknopf und Stift-Knopf (Inline-SVG, `aria-hidden`), getrennt durch Goldlinien wie bei den „Aktivitäten“ auf „Heute“.
    - Dann „Neues Muster“ als Umrissknopf bzw. der Hinweis.
    - Start wie bei den Kacheln (`setLastUsed` und `startSession(breathProgram(customToPattern(p), minutes, …))`).
  - **`PatternEditor.svelte`:**
    - Arbeitet auf einer Kopie.
    - Speichern ruft `saveBreathPattern({ ...draft, name: draft.name.trim().slice(0, 30) })` und `onClose()`.
    - Löschen öffnet `ConfirmDialog`; bestätigt ruft es `deleteBreathPattern(id)` und `onClose()`.
- [ ] **Step 4:** `npx playwright test tests/e2e/atemmuster.spec.ts tests/e2e/atmen.spec.ts tests/e2e/karten.spec.ts tests/e2e/heute.spec.ts`, erwartet: alle grün.
- [ ] **Step 5: Commit** `feat: Abschnitt „Eigene Muster“ und Editor unter „Atmen“`.

### Task 5: Handy-Checkliste, Haupt-Spec, Gesamtprüfung

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- [ ] **Step 1:** README: Der Abschnitt „Handy-Checkliste Meilenstein 8“ mit den 5 Punkten aus Spec §10, wörtlich, steht vor der Checkliste von Meilenstein 7.
- [ ] **Step 2:** Haupt-Spec §3.3: kursive *Ergänzung vom 24.10.2026 (Meilenstein 8)* mit eigenen Mustern (vier Phasen, höchstens 6, Abschnitt unter den Kacheln), Verweis auf die M8-Spec.
- [ ] **Step 3:** `npm run check && npm test && npx playwright test`, erwartet: 0 Fehler, alles grün.
- [ ] **Step 4: Commit** `docs: Handy-Checkliste Meilenstein 8`.
