# Meilenstein 6: Ruhe-Check-in – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nach jeder gezählten Sitzung lässt sich festhalten, wie ruhig man vorher und jetzt ist. Unter „Ich“ zeigen zwei Sätze die Wirkung und den Verlauf.

**Architecture:**
- **Daten:** Die Ruhe-Werte hängen als optionales `calm` an der `Session`. `recordSession` gibt die neue ID zurück, und der Abschluss schreibt über `setCalm`.
- **Auswertung:** reine Funktionen in `src/lib/stats/calm.ts`; die Texte entstehen in `src/lib/ui/ich-view.ts`.
- **Oberfläche:** eine neue Komponente auf dem Abschluss-Bildschirm und eine neue Karte unter „Ich“ mit gemaltem Motiv `ruhe`.

**Tech Stack:** Svelte 5 (Runes), TypeScript, Vite, Vitest (node + Browser), Playwright; ElevenLabs-Connector (nur für das Motiv), `scripts/freistellen.py`.

**Spec:** `docs/superpowers/specs/2026-10-24-ruhe-m6-ruhe-check-in-design.md`. Zahlen, Wörter und Sätze kommen wörtlich von dort.

## Global Constraints

- **Skala** (Spec §2): 1 „sehr unruhig“ `#E7A29A`, 2 „etwas unruhig“ `#E9B894`, 3 „teils, teils“ `#E6CF9A`, 4 „ruhig“ `#B9D3C0`, 5 „ganz ruhig“ `#8FD0D6`. Die Farben gelten in allen Tageszeiten; die Bedeutung trägt das Wort.
- **Zeiträume:** nach lokalem Kalendertag. „Letzte 30 Tage“ heißt heute und die 29 Tage davor; „30 Tage davor“ heißt 30 bis 59 Tage zurück. Sitzungen mit Datum in der Zukunft zählen nirgends.
- **Mindestmengen:** 3 Paare für die Wirkung, 3 Paare je Art für die Aufteilung, 3 Vorher-Werte je Zeitraum für den Verlauf. Die Schwelle ist 0,3: Ein Betrag `< 0.3` gilt als „etwa so/gleich“.
- **Zahlen:** eine Nachkommastelle mit Komma. Genau 1,0 wird zu „eine Stufe“. Vorzeichen in der Aufteilung: „+“, „−“ (U+2212), „±0“.
- **Bestand:** Check-in-Daten verwerfen nie eine Sitzung; alte Daten ohne `calm` bleiben gültig. `version` bleibt 1.
- **Barrierefreiheit:** Tippflächen ≥ 48 × 48 px. Motive sind Schmuck (`alt=""`). Kein Überlauf bei 360 px und bei 130 % Schrift.
- **Kosten:** Connector-Generierungen werden nie wiederholt. Für das Motiv gibt es genau einen Aufruf.
- **Veröffentlichen** (Push nach `main`) nur mit dem OK des Nutzers. API-Schlüssel nie im Chat.

## Review Focus

1. **Tagesgrenzen und Zeitumstellung:** Eine Sitzung um 23:30 Uhr am 29. Tag zurück zählt zum jüngeren Zeitraum, eine um 23:30 Uhr am 30. Tag zurück zum älteren, auch wenn dazwischen die Zeitumstellung liegt (Test in Task 3).
2. **Uhr verstellt:** Sitzungen mit einem Datum nach heute verschieben weder die Wirkung noch den Verlauf (Test in Task 3).
3. **Schwelle genau getroffen:** Ein Mittel von exakt 0,3 (3 von 10 Paaren +1) gilt als „ruhiger“, 0,2 als „etwa so ruhig“ (Test in Task 3).
4. **Speichern scheitert, während man tippt:** Der Punkt bleibt gewählt, die App stürzt nicht ab, und unter „Ich“ steht der bekannte Hinweis (Test in Task 4).
5. **Zurück-Geste im Abschluss nach dem Tippen:** Die Werte sind gespeichert, der Player schließt wie bisher (Test in Task 4).

---

### Task 1: Motiv `ruhe` (Controller, mit Wahl des Nutzers)

Diesen Task führt der Controller selbst aus, nicht ein Subagent: Er braucht den ElevenLabs-Connector und die Wahl des Nutzers.

**Files:**
- Create: `public/images/motive/ruhe.webp`
- Modify: `content/motive.json` (neuer Eintrag), `src/lib/content/motive.ts` (ID und Kopfkommentar „36“), `tests/unit/motive.test.ts` (Anzahl), `README.md` („Die 36 gemalten Motive“)

**Interfaces:**
- Produces: `MotivId` enthält `'ruhe'`. `<Motiv id="ruhe" size={40} />` funktioniert.

- [ ] **Step 1: Failing test.** In `tests/unit/motive.test.ts` wird der Testname „MOTIV_IDS lists exactly the 35 motifs …“ zu „… the 36 motifs of content/motive.json“, und die erwartete Zahl darin wird 36.
- [ ] **Step 2:** `npx vitest run tests/unit/motive.test.ts`, erwartet: FAIL (35 ≠ 36).
- [ ] **Step 3: Erzeugen.**
  - Ein Aufruf `creative_generate_image` mit dem Modell `gpt-image-2.5-sunburst` und dem Prompt-Schema aus `content/motive.json` (`prompt`, `style`, Hintergrund `#1B2350`), mit drei Wellen-Varianten als Icon 1–3:
    - „three soft, gently curving waves in warm orange, stacked loosely“
    - „two calm flowing wave lines in warm orange and apricot“
    - „a single soft rolling wave in warm orange with a fine gold crest“
  - `generations_count` bleibt beim Standard. Abfragen mit `creative_get_flow_run_status`, bis alles fertig ist.
- [ ] **Step 4: Wahl.**
  - Alle Varianten als eine Auswahlseite (PNG, nummeriert) mit `SendUserFile` zeigen, dann den Nutzer mit `AskUserQuestion` wählen lassen.
  - Erst nach seiner Antwort weitermachen.
- [ ] **Step 5: Freistellen.**
  - Das gewählte Bild als PNG speichern.
  - `python3 scripts/freistellen.py <quelle.png> public/images/motive/ruhe.webp --crop x,y,b,h --size 168`. Den Ausschnitt so wählen, dass nur das gewählte Icon mit etwas Rand darin liegt.
  - Ergebnis mit `Read` ansehen.
- [ ] **Step 6: Eintragen.**
  - In `content/motive.json` ein Eintrag `{ id: "ruhe", subject, flow, generation, crop, size: 168 }`.
  - In `motive.ts` `'ruhe'` in die Gruppe „Symbole der Reiter und Aktivitäten“ nach `'ich'`, dazu den Kopfkommentar „Katalog der 36 gemalten Motive (…, dazu die Ruhe-Karte aus M6)“.
  - README: „Die 36 gemalten Motive“.
- [ ] **Step 7:** `npx vitest run tests/unit/motive.test.ts && npm run check`, erwartet: PASS, 0 Fehler (Budget, Alpha, keine verwaisten Dateien).
- [ ] **Step 8: Commit** `feat: Motiv „ruhe“ für die Ruhe-Karte` (mit allen genannten Dateien).

### Task 2: Ruhe-Werte an der Sitzung

**Files:**
- Modify:
  - `src/lib/stats/schema.ts` (Typen, `parseSession`)
  - `src/lib/stats/persist.ts` (`withCalm`)
  - `src/lib/stats/store.svelte.ts` (`recordSession`, `setCalm`)
  - `src/lib/session-wiring.ts`, `src/lib/ui/session-ui.svelte.ts`, `src/main.ts`
- Test: `tests/unit/stats-schema.test.ts`, `tests/unit/stats-persist.test.ts`, `tests/unit/stats-backup.test.ts`, `tests/unit/session-wiring.test.ts`

**Interfaces:**
- Produces:
  - in `schema.ts`: `export type CalmLevel = 1 | 2 | 3 | 4 | 5`, `export interface Calm { before?: CalmLevel; after?: CalmLevel }`, `Session.calm?: Calm`
  - in `persist.ts`: `withCalm(data: AppData, sessionId: string, which: 'before' | 'after', level: CalmLevel | null): AppData | null`
  - in `store.svelte.ts`: `recordSession(result: SessionResult): string | null` und `setCalm(sessionId: string, which: 'before' | 'after', level: CalmLevel | null): void`
  - in `session-wiring.ts`: `connectSessions(source, record: (r: SessionResult) => string | null, done: (r: SessionResult, sessionId: string | null) => void)`
  - in `session-ui.svelte.ts`: `SessionDoneInfo` bekommt `sessionId: string | null` (`counted` bleibt, `counted === (sessionId !== null)`)

- [ ] **Step 1: Failing tests, Schema** (`stats-schema.test.ts`):
  - „a session keeps a valid calm“: `{ ...session, calm: { before: 2, after: 5 } }` bleibt gleich; `{ ...session, calm: { after: 3 } }` ebenso.
  - „invalid calm values are dropped, the session stays“:
    - für `0, 6, 2.5, '3', null, true` als `before` fehlt `before`;
    - `{ before: 9, after: 4 }` ergibt `{ after: 4 }`;
    - `calm: {}`, `calm: 'x'`, `calm: { before: 0 }` ergeben eine Sitzung ohne den Schlüssel `calm` (`expect('calm' in s).toBe(false)`);
    - `parseData` ist dabei nie `null`.
  - „unknown keys inside calm are dropped“: `{ before: 1, mood: 3 }` ergibt `{ before: 1 }`.
- [ ] **Step 2: Failing tests, Persistenz** (`stats-persist.test.ts`):
  - „withCalm sets, changes and removes a value of one session“: Ausgehend von zwei Sitzungen `a` und `b`:
    - `withCalm(d, 'a', 'before', 2)` gibt `a.calm = { before: 2 }`; `b` ist unverändert und `d` nicht verändert.
    - Danach `'after', 4` gibt `{ before: 2, after: 4 }`.
    - `'before', null` gibt `{ after: 4 }`.
    - `'after', null` gibt eine Sitzung ohne den Schlüssel `calm`.
  - „withCalm ignores an unknown id“: `withCalm(d, 'x', 'before', 3)` ist `null`.
- [ ] **Step 3: Failing tests, Backup** (`stats-backup.test.ts`):
  - „calm travels through export and import“: `serializeBackup` → `mergeBackup` in einen leeren Stand behält `calm`.
  - „import never overwrites calm of a known session“: Der aktuelle Stand hat `a` mit `{ before: 1 }`, die Datei hat `a` mit `{ before: 5 }`; danach gilt weiter `{ before: 1 }`, `added === 0`.
- [ ] **Step 4: Failing tests, Wiring** (`session-wiring.test.ts`):
  - Die bestehenden Tests werden auf IDs umgestellt: `record` liefert `r.seconds >= 60 ? 'id-' + r.ref : null`, gezeigt wird `[ref, sessionId]`, also `[['timer', null], ['478', 'id-478']]`.
  - Im Reihenfolge-Test gibt `record` `'id'` zurück.
- [ ] **Step 5:** `npx vitest run tests/unit/stats-schema.test.ts tests/unit/stats-persist.test.ts tests/unit/stats-backup.test.ts tests/unit/session-wiring.test.ts`, erwartet: FAIL in den neuen Tests.
- [ ] **Step 6: Umsetzen.**
  - **`schema.ts`:** Die Typen oben, dazu `parseCalm(raw: unknown): Calm | undefined`. Ein gültiger Wert ist `Number.isInteger(v) && v >= 1 && v <= 5`. `parseSession` setzt `calm` nur, wenn das Ergebnis mindestens einen Wert hat.
  - **`persist.ts`:** `withCalm` gibt einen neuen Stand zurück, die Sitzung wird ersetzt und ein leeres `calm` weggelassen.
  - **`store.svelte.ts`:**
    - `recordSession` erzeugt die ID wie bisher mit `crypto.randomUUID()` und gibt sie zurück, wenn `withSession` nicht `null` liefert, auch wenn das Speichern scheitert. Sonst gibt es `null` zurück. Den Doc-Kommentar anpassen.
    - `setCalm` ruft `withCalm` auf und bei einem Ergebnis `commit`.
  - **`session-wiring.ts`:** die neuen Typen, der Kopfkommentar nennt die ID.
  - **`main.ts`:** `sessionUi.done = { kind: r.kind, ref: r.ref, seconds: r.seconds, counted: sessionId !== null, sessionId }`.
- [ ] **Step 7:** dieselben Tests plus `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 8: Commit** `feat: Ruhe-Werte an der Sitzung, recordSession gibt die ID zurück`.

### Task 3: Auswertung und Texte

**Files:**
- Create: `src/lib/stats/calm.ts`, `tests/unit/calm.test.ts`
- Modify: `src/lib/ui/ich-view.ts`, `tests/unit/ich-view.test.ts`

**Interfaces:**
- Consumes: `Session`, `CalmLevel` (Task 2); `dayKey`-Logik wie in `summary.ts`.
- Produces in `calm.ts`:
  - `CALM_LEVELS: readonly { level: CalmLevel; word: string; color: string }[]`, die fünf Einträge aus den Global Constraints in dieser Reihenfolge;
  - die Konstanten `CALM_DAYS = 30`, `CALM_MIN = 3`, `CALM_THRESHOLD = 0.3`;
  - `interface CalmEffect { mean: number; count: number; breath: number | null; meditation: number | null }`;
  - `interface CalmTrend { recent: number; previous: number }`;
  - `calmEffect(sessions: readonly Session[], now: Date): CalmEffect | null`;
  - `calmTrend(sessions: readonly Session[], now: Date): CalmTrend | null`.
- Produces in `ich-view.ts`:
  - `calmStufen(n: number): string`, also „1,4 Stufen“ bzw. „eine Stufe“, vom Betrag;
  - `calmSigned(n: number): string`;
  - `calmEffectLines(effect: CalmEffect | null): { main: string; split: string | null; basis: string | null }`;
  - `calmTrendLine(trend: CalmTrend | null): string | null`.

- [ ] **Step 1: Failing tests** in `tests/unit/calm.test.ts`. Erste Zeile `process.env.TZ = 'Europe/Berlin'`, mit demselben Zeitzonen-Wächtertest wie in `stats-summary.test.ts`. Dazu ein Helfer `s(daysBack, hour, kind, before?, after?)`, der eine Sitzung mit lokalem Start `new Date(2026, 10, 10 - daysBack, hour)` baut; „heute“ ist `new Date(2026, 10, 10, 20)`.
  - „CALM_LEVELS are the five words and colours of the spec“: `map(l => [l.level, l.word, l.color])` gleich der Tabelle.
  - „no effect below three pairs; sessions with one value do not count“: zwei Paare plus vier Einzelwerte ergeben `null`.
  - „effect is the mean of after − before with its count“: Die Paare (2→4), (1→2), (3→3) ergeben `{ mean: 1, count: 3 }`.
  - „the window is today and the 29 days before, by calendar day, across the clock change“: `s(29, 23, …)` zählt, `s(30, 23, …)` nicht. Tag 29 zurück ist der 12.10., der 25.10. liegt dazwischen.
  - „sessions dated after today count nowhere“: Paare mit `daysBack = -1` und `-5` ändern weder `calmEffect` noch `calmTrend`.
  - „the split needs three pairs per kind; timer and guided are both meditation“: 3 Atem-Paare plus 2 Timer-Paare plus 1 geführtes Paar ergeben `breath` und `meditation` als Zahlen; mit nur 2 Atem-Paaren ist `breath` `null`.
  - „trend compares the before values of both windows, each needing three“: 3 Vorher-Werte in Tag 0–29 und 2 in Tag 30–59 ergeben `null`; mit 3 und 3 kommt `{ recent, previous }` mit den Mittelwerten. Ein Vorher-Wert an Tag 60 zählt nicht.
- [ ] **Step 2: Failing tests** in `tests/unit/ich-view.test.ts`:
  - „calmStufen“: `1.4` → „1,4 Stufen“, `0.5` → „0,5 Stufen“, `1` und `0.96` → „eine Stufe“, `-0.6` → „0,6 Stufen“, `2.04` → „2,0 Stufen“.
  - „calmSigned“: `1.6` → „+1,6“, `-0.4` → „−0,4“ (U+2212), `0.04` und `-0.04` → „±0“.
  - „calmEffectLines“:
    - `null` ergibt `{ main: 'Halte nach einer Sitzung fest, wie ruhig du vorher und jetzt bist. Hier siehst du dann, was dir deine Übungen bringen.', split: null, basis: null }`.
    - `{ mean: 1.4, count: 12, breath: null, meditation: 1.1 }` ergibt `main: 'Nach einer Sitzung bist du im Schnitt 1,4 Stufen ruhiger.'`, `split: null`, `basis: 'Aus 12 Sitzungen der letzten 30 Tage'`.
    - `mean: -0.6` ergibt „… 0,6 Stufen unruhiger.“.
    - `mean: 0.2` und `mean: -0.29` ergeben „Nach einer Sitzung bist du im Schnitt etwa so ruhig wie vorher.“.
    - `mean: 0.3` (als `3 / 10`) ergibt „… 0,3 Stufen ruhiger.“.
    - `breath: 1.6, meditation: 1.1` ergibt `split: 'Atmen +1,6 · Meditieren +1,1'`.
  - „calmTrendLine“:
    - `null` → `null`;
    - `{ recent: 3.4, previous: 3 }` → „Vor deinen Sitzungen warst du in den letzten 30 Tagen ruhiger als in den 30 Tagen davor.“;
    - `{ recent: 2.5, previous: 3 }` → „… unruhiger als in den 30 Tagen davor.“;
    - `{ recent: 3.2, previous: 3 }` → „Vor deinen Sitzungen warst du in den letzten 30 Tagen etwa gleich ruhig wie in den 30 Tagen davor.“.
- [ ] **Step 3:** `npx vitest run tests/unit/calm.test.ts tests/unit/ich-view.test.ts`, erwartet: FAIL (Module bzw. Funktionen fehlen).
- [ ] **Step 4: Umsetzen.**
  - Tage zurück: `Math.round((Date.UTC(ny, nm, nd) - Date.UTC(sy, sm, sd)) / 86_400_000)` aus den lokalen Jahr/Monat/Tag-Werten von `now` und Start. Das ist unabhängig von 23- oder 25-Stunden-Tagen.
  - Für die Wirkung zählt 0 ≤ zurück ≤ 29. Für den Verlauf zählt „recent“ von 0 bis 29 und „previous“ von 30 bis 59.
  - Die Schwelle prüft immer den ungerundeten Mittelwert.
  - Zahlen mit `toFixed(1).replace('.', ',')`; „eine Stufe“, wenn der gerundete Betrag `'1.0'` ist; „±0“, wenn der gerundete Wert `'0.0'` bzw. `'-0.0'` ist.
- [ ] **Step 5:** dieselben Tests, erwartet: PASS. Dazu `npm run check`, erwartet: 0 Fehler.
- [ ] **Step 6: Commit** `feat: Auswertung und Texte des Ruhe-Check-ins`.

### Task 4: Check-in auf dem Abschluss-Bildschirm

**Files:**
- Create: `src/components/player/CalmCheckIn.svelte`, `tests/e2e/checkin.spec.ts`
- Modify: `src/components/player/SessionDone.svelte`, `src/components/player/PlayerShell.svelte`

**Interfaces:**
- Consumes: `setCalm`, `stats` (Task 2); `CALM_LEVELS` (Task 3); `SessionDoneInfo.sessionId` (Task 2).
- Produces:
  - `CalmCheckIn` mit den Props `{ sessionId: string }`;
  - `SessionDone` bekommt die Prop `sessionId: string | null`, `PlayerShell` reicht `done.sessionId` durch.

- [ ] **Step 1: Failing e2e test** `tests/e2e/checkin.spec.ts`, Test „after a counted session the calm can be noted before and now, changed and taken back“ (`test.setTimeout(120_000)`):
  1. **Übung:** „Atmen“ öffnen → „1 Min“ → „Box-Atmung starten“ (16-s-Zyklus, 64 s). Warten auf `getByText('1 Min geatmet')` (Timeout 90 s).
  2. **Karte:**
     - `getByText('Magst du festhalten, wie ruhig du bist?')` ist sichtbar.
     - `getByRole('radiogroup', { name: 'Vorher' })` und `{ name: 'Jetzt' }` haben je 5 `radio` mit den Namen `['sehr unruhig', 'etwas unruhig', 'teils, teils', 'ruhig', 'ganz ruhig']`; keiner ist `aria-checked="true"`.
     - Jede `boundingBox` ist ≥ 48 × 48.
     - `getByText('Ohne Antwort einfach „Fertig“.')` ist sichtbar.
     - Helfer `calm()` liest `JSON.parse(localStorage['ruhe.v1']).sessions[0].calm`.
  3. **Antippen:**
     - Vorher „etwas unruhig“ → `aria-checked="true"`, `calm()` ist `{ before: 2 }`, die Kopfzeile der Reihe zeigt „etwas unruhig“.
     - Jetzt „ruhig“ → `{ before: 2, after: 4 }`.
     - Jetzt „ganz ruhig“ → `after: 5`.
     - Jetzt „ganz ruhig“ noch einmal → `{ before: 2 }`, in „Jetzt“ ist nichts mehr gewählt.
  4. **Tastatur:**
     - Fokus auf Vorher „etwas unruhig“, `ArrowRight` → „teils, teils“ ist gewählt und fokussiert, `calm()` ist `{ before: 3 }`.
     - `Space` → nichts gewählt, `calm()` ist `undefined`.
     - Danach wieder Vorher „etwas unruhig“ und Jetzt „ruhig“ antippen, also `{ before: 2, after: 4 }`.
  5. **Platz:**
     - Bei 360 px Breite ist `document.scrollingElement.scrollWidth <= clientWidth`.
     - Danach `document.documentElement.style.fontSize = '130%'`: dieselbe Prüfung, „Fertig“ ist erreichbar (`scrollIntoViewIfNeeded`, sichtbar). Danach die Schrift zurücksetzen.
  6. **Speichern scheitert** (Review Focus 4):
     - Per `page.evaluate` `Storage.prototype.setItem` durch eine werfende Funktion ersetzen und das Original merken.
     - Jetzt „ganz ruhig“ antippen → `aria-checked="true"`.
     - Das Original wiederherstellen.
     - `page.goBack()` (Review Focus 5): Der Player schließt.
     - Zum Reiter „Ich“: Der Alarm mit „Speichern ist gerade nicht möglich“ ist sichtbar.
     - `calm()` ist weiter `{ before: 2, after: 4 }`, der zuletzt nicht gespeicherte Wert fehlt also.
  7. **Neu laden:** `calm()` ist `{ before: 2, after: 4 }`.
- [ ] **Step 2: Failing e2e test** „a session under a minute shows no check-in“: Box-Atmung starten, „Beenden“ antippen. Der Text „Unter einer Minute – das zählt noch nicht für die Statistik.“ ist sichtbar, `radiogroup` „Vorher“ hat die Anzahl 0, ebenso der Hinweistext.
- [ ] **Step 3:** `npx playwright test tests/e2e/checkin.spec.ts`, erwartet: FAIL (keine Karte).
- [ ] **Step 4: Umsetzen `CalmCheckIn.svelte`.**
  - **Werte:** Die aktuellen Werte kommen aus `stats.data.sessions.find((s) => s.id === sessionId)?.calm`. Jede Wahl ruft `setCalm(sessionId, which, level | null)` auf.
  - **Aufbau:** Eine Reihe ist ein Snippet mit Kopfzeile, Radiogruppe und Endwörtern; Aufbau, Größen und Farben wie Spec §3 und der freigegebene Entwurf A.
    - Kopfzeile: links „Vorher“/„Jetzt“ fett, rechts das Wort in `--accent`, `aria-hidden`.
    - Radiogruppe: `role="radiogroup"` mit `aria-label`.
    - Endwörter: klein und gedämpft.
  - **Punkte:** fünf `button role="radio"`, 48 px.
    - Ungewählt ist der innere Punkt 22 px groß mit Deckkraft 0.55.
    - Gewählt ist er 30 px groß und voll deckend, mit Ring `--gold-line-strong` und Schein `0 0 0 3px rgb(242 201 138 / .18)`.
  - **Tastatur:** wie `ChoiceGroup` (Pfeile, Home/End wählen und bewegen den Fokus). Leertaste und Enter lösen den Klick aus, und ein Klick auf den gewählten Punkt nimmt zurück. `tabindex` wie in `ChoiceGroup`.
  - Die Karte nutzt `.card` mit den Goldlinien über den Reihen (`--gold-line`).
- [ ] **Step 5: Umsetzen `SessionDone`/`PlayerShell`.**
  - Unter `.detail` steht `{#if counted && sessionId}<CalmCheckIn {sessionId} />{/if}`. Unter „Fertig“ steht, nur in diesem Fall, `<p class="hint">Ohne Antwort einfach „Fertig“.</p>` (klein, `--text-muted`).
  - `.done` darf höher als der Bildschirm werden und scrollt mit dem Player. Der Fokus geht weiter zuerst auf die Überschrift.
- [ ] **Step 6:** `npx playwright test tests/e2e/checkin.spec.ts tests/e2e/atmen.spec.ts tests/e2e/timer.spec.ts tests/e2e/guided.spec.ts` und `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 7: Commit** `feat: Ruhe-Check-in auf dem Abschluss-Bildschirm`.

### Task 5: Karte „Ruhe“ unter „Ich“, Checkliste

**Files:**
- Modify:
  - `src/screens/Ich.svelte`
  - `tests/e2e/ich.spec.ts`, `tests/e2e/karten.spec.ts`
  - `README.md`
  - `docs/superpowers/specs/2026-10-21-ruhe-design.md` (Ergänzung)

**Interfaces:**
- Consumes: `calmEffect`, `calmTrend` (Task 3), `calmEffectLines`, `calmTrendLine` (Task 3), Motiv `ruhe` (Task 1).

- [ ] **Step 1: Failing e2e tests** in `ich.spec.ts`, neuer `describe('Ruhe')`. Ein Helfer `calmSession(id, daysBack, kind, before?, after?)` setzt den Start auf `NOW` minus `daysBack` Tage um 08:00 Uhr Berliner Zeit (Offset im String).
  - „without check-ins the card invites, under the calendar and above Einstellungen“:
    - mit `SESSIONS` ohne `calm`;
    - die Karte mit `h2` „Ruhe“ zeigt den Einladungssatz;
    - kein Verlaufssatz;
    - Reihenfolge der `h2`/Tabelle: Kalender-`table` vor „Ruhe“ vor „Einstellungen“ (Positionen per `boundingBox().y`);
    - `expectMotiv` für `ruhe` in der Karte (Schmuck, `alt=""`).
  - „effect, split and basis“:
    - Daten: 3 Atem-Paare (2→4) und 3 Timer-Paare (2→3), alle in den letzten 10 Tagen;
    - erwartet: „Nach einer Sitzung bist du im Schnitt 1,5 Stufen ruhiger.“, „Atmen +2,0 · Meditieren +1,0“, „Aus 6 Sitzungen der letzten 30 Tage“.
  - „less calm and about the same“: Daten mit Mittel −0,6 bzw. +0,2 zeigen die Sätze „… 0,6 Stufen unruhiger.“ bzw. „… etwa so ruhig wie vorher.“.
  - „trend sentences“: Je 3 Vorher-Werte in Tag 1–5 und in Tag 35–40 ergeben die drei Verlaufssätze (ruhiger, unruhiger, etwa gleich) wörtlich nach Spec §4. Ein Verlaufssatz kann neben dem Einladungssatz stehen, wenn es keine Paare gibt.
  - „check-ins survive export and import“:
    - Daten mit Paaren exportieren;
    - den Stand leeren (`localStorage.clear()`, neu laden);
    - die exportierte Datei importieren;
    - der Wirkungssatz ist derselbe wie vorher.
- [ ] **Step 2: Failing tests** in `karten.spec.ts` (`describe('Ich')`):
  - `ichCards` hat 5 Karten, Kommentar „Kalender, Ruhe, Einstellungen, Offline, Backup“, alle mit Goldrand 0.26;
  - in der Waschungsprüfung kommt „Ruhe“ zur Liste der Karten ohne Waschung.
- [ ] **Step 3:** `npx playwright test tests/e2e/ich.spec.ts tests/e2e/karten.spec.ts -g "Ruhe|Ich"`, erwartet: FAIL.
- [ ] **Step 4: Umsetzen `Ich.svelte`.**
  - Die neue `.card` steht direkt nach `<Calendar>`. Der Kopf ist `<div class="card-head"><Motiv id="ruhe" size={40} /><h2>Ruhe</h2></div>`.
  - Darunter stehen `main` als `<p>`, `split` und `basis` als `<p class="quiet">` (wenn nicht `null`) und der Verlaufssatz als `<p>` (wenn nicht `null`).
  - Werte: `$derived(calmEffect(sessions, new Date()))` und `calmTrend` entsprechend.
  - `.quiet` ist klein und gedämpft wie die übrigen Nebentexte unter „Ich“.
- [ ] **Step 5: Doku.**
  - Im README der Abschnitt „Handy-Checkliste Meilenstein 6“ mit den 6 Punkten aus Spec §9, wörtlich, vor „Handy-Checkliste Meilenstein 5“.
  - In der Haupt-Spec eine kursive *Ergänzung vom 24.10.2026 (Meilenstein 6)* unter den Nicht-Zielen: Der Ruhe-Check-in (zwei Sätze unter „Ich“) ist kein Stimmungstagebuch, Verweis auf die M6-Spec.
- [ ] **Step 6: Gesamtprüfung.** `npm run check && npm test && npx playwright test`, erwartet: 0 Fehler, alle Tests grün. Die Zahlen notieren.
- [ ] **Step 7: Commit** `feat: Karte „Ruhe“ unter „Ich“, Handy-Checkliste Meilenstein 6`.
