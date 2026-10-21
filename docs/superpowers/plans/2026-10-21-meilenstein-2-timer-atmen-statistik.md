# Meilenstein 2: Timer, Atemübungen & Statistik – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meditations-Timer mit echter Klangschale, sechs Atemübungen, lokale Statistik (Serie, Minuten, Kalender), Einstellungen und Backup – plus Schnellstart auf „Heute“.

**Architecture:** Timer und Atemübung sind *Programme* der bestehenden Audio-Engine: Ein Programm plant beim Start alle Klänge (Klangschalen bzw. Atem-Töne) auf der Audio-Uhr ein, hat eine gezählte Länge und meldet am Ende ein `SessionResult`. Pause, Unterbrechung und gesperrter Bildschirm funktionieren dadurch wie bei den Klängen. Alle Berechnungen (Timer-Plan, Atem-Ablauf, Serie, Backup) sind reine Funktionen in Node getestet; Speicherung läuft über genau einen `localStorage`-Schlüssel.

**Tech Stack:** wie Meilenstein 1 (Vite 8, Svelte 5 Runes, TypeScript 6, Vitest 5 Node + Browser Mode, Playwright 1.56.1), dazu ElevenLabs (Klangschale, vom Controller erzeugt).

**Spec:** `docs/superpowers/specs/2026-10-21-ruhe-design.md` – §3.1 (Heute), §3.2 (Timer), §3.3 (Atmen), §3.5 (Ich), §3.6 (Player), §4.2 (Audio-Uhr), §6 (Daten, Statistik, Backup, Einstellungen). Bei Widersprüchen gilt die Spec.

**Branch:** `meilenstein-2` (von `main` @ 94ec70a). Veröffentlicht wird erst nach dem Merge in `main`.

## Global Constraints

- Paketversionen unverändert aus `package.json` (keine neuen Abhängigkeiten). Nie `playwright install` lokal.
- Vite `base` `/ruhe/`; Asset-URLs nur über `assetUrl()`.
- Oberfläche Deutsch, Du-Form; vom Plan vorgegebene Texte wörtlich.
- **Audio-Zeitsteuerung nie über `setTimeout`/`setInterval`/`requestAnimationFrame`.** Klänge, Programmende und Ausblenden laufen auf der Audio-Uhr (`start(when)`, `stop(when)`, Rampen, Marken mit `onended`). JS-Timer und `requestAnimationFrame` nur für Anzeige, Vibration und Wake Lock.
- Ein `AudioContext`; Ausgabe direkt an `ctx.destination` plus lautloser Anker (`src/lib/audio/output.ts`, `anchor.ts`) – unverändert lassen.
- **Immer nur eine Sitzung:** Ein Programm beendet laufende Klänge; ein angetippter Klang beendet ein laufendes Programm.
- Persistenz ausschließlich unter `localStorage['ruhe.v1']` (Schema §6.1); beschädigte Daten werden nach `localStorage['ruhe.v1.corrupt']` gesichert. Jeder Zugriff auf `localStorage` in `try/catch` – Fehler dürfen nie bis zur Oberfläche durchschlagen.
- Eine Sitzung zählt ab **60 Sekunden**; Pausen und der Vorlauf zählen nicht; Klänge-Sitzungen werden nie gespeichert.
- Tagesgrenze: Mitternacht **lokale Zeit**, maßgeblich ist der Startzeitpunkt.
- Tippflächen ≥ 48 px, Kontrast WCAG AA, Animationen nur unter `prefers-reduced-motion: no-preference`.
- Svelte-Runes-Dateien (`*.svelte.ts`) sind in Vitest-Unit-Tests nicht kompilierbar: Logik gehört in reine `.ts`-Module, die `.svelte.ts`-Hüllen bleiben dünn.
- Jede Commit-Nachricht endet mit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YFBD4q9VZrxdFh2nUt9NdS
  ```

## Review Focus

1. **Bildschirm gesperrt während des Timers:** JS ist gedrosselt, das Ende-Ereignis kommt verspätet an → die Sitzung zählt trotzdem mit der vollen Länge (nicht mit gemessener Wanduhr-Zeit). *(Task 5: `natural end reports the planned length`)*
2. **Anruf/Unterbrechung oder Pause mitten im Timer** → die Pausenzeit zählt nicht. *(Task 5: `pause freezes the program clock and is not counted`)*
3. **Speicher voll, gesperrt oder kaputt** (`setItem` wirft, ungültiges JSON) → kein Absturz, Daten der laufenden Sitzung bleiben im Speicher der App, beschädigte Rohdaten werden gesichert. *(Task 4: `save failure is reported, not thrown` und `corrupt data is backed up and replaced`)*
4. **Mitternacht und Zeitumstellung** → Sitzung um 23:50 zählt für diesen Tag; die Serie reißt über die Sommerzeit-Umstellung nicht ab. *(Task 3: `streak survives the DST switch` und `session just before midnight counts for that day`)*
5. **Doppeltippen auf „Starten“ / Start während Klänge laufen** → genau ein Programm, laufende Klänge verstummen. *(Task 5: `double start keeps exactly one program` und `program stops running sounds and reports its title`)*

**Bewusst auf später verschoben (Meilenstein 3):** Karte „Vorschlag des Tages“, Rückfall „Ankommen im Atem“ bei leerem „Zuletzt genutzt“ (bis dahin wird die Karte ausgeblendet), Regler „Balance Stimme ↔ Hintergrund“ (der Wert `voiceBalance` wird schon gespeichert), „Alle offline speichern“.

---

## Dateistruktur (neu/geändert)

```
public/audio/sounds/klangschale.ogg           echte Klangschale (Task 0, Controller)
src/lib/meditation/timer-plan.ts              Timer-Ablauf (rein)
src/lib/breath/patterns.ts                    Atemmuster, Ablauf, Phase zu Zeitpunkt (rein)
src/lib/stats/schema.ts                       Typen, Standardwerte, Validierung, SessionResult
src/lib/stats/summary.ts                      Serie, Minuten, Kalendertage (rein)
src/lib/stats/backup.ts                       Export/Import (rein)
src/lib/stats/persist.ts                      Laden/Speichern/Erfassen mit Storage (rein, Storage injiziert)
src/lib/stats/store.svelte.ts                 reaktive Hülle für die Oberfläche
src/lib/audio/strike.ts, cue.ts               Klangschale bzw. Atem-Ton auf der Audio-Uhr einplanen
src/lib/audio/program.ts                      ProgramSpec + timerProgram()/breathProgram()
src/lib/audio/engine.ts                       Programme starten/beenden, Ergebnis melden
src/lib/audio/media-session.ts                Programm-Titel
src/lib/ui/layers.svelte.ts                   Ebenen + Android-Zurück
src/lib/ui/wake-lock.ts                       Bildschirm anlassen
src/lib/session-wiring.ts                     Engine-Ergebnis → Statistik + Abschluss-Anzeige
src/lib/ui/session-ui.svelte.ts               Abschluss-Anzeige (zuletzt beendete Sitzung)
src/components/Sheet.svelte, ConfirmDialog.svelte
src/components/timer/TimerSetup.svelte, src/components/player/TimerPlayer.svelte
src/components/player/BreathPlayer.svelte, src/components/player/SessionDone.svelte
src/components/Calendar.svelte
src/screens/Heute.svelte, Meditieren.svelte, Atmen.svelte, Ich.svelte, App.svelte
```

---

### Task 0 (Controller, vor Task 5): Echte Klangschale

Wird vom Controller selbst mit dem ElevenLabs-Connector ausgeführt (kostenpflichtig, Hörprobe an den Nutzer), nicht von einem Implementierer.

- [ ] Sound-Effekt (kein Loop, ca. 8 s, 4 Varianten) mit dem Prompt aus `content/sounds.json` → `effects[0].prompt` erzeugen, herunterladen, mit ffmpeg (`astats`, `silencedetect`) prüfen (kein Clipping, sauberer Ausklang, Stille am Anfang).
- [ ] Gewählte Variante: führende Stille abschneiden (Anschlag beginnt bei ≤ 20 ms), Ende 0,3 s ausblenden, Spitzenpegel auf −3 dBFS normalisieren, als Ogg/Opus Stereo 48 kHz 96 kbit/s nach `public/audio/sounds/klangschale.ogg`. Hörprobe an den Nutzer, nach OK committen.

---

### Task 1: Timer-Plan

**Files:** Create `src/lib/meditation/timer-plan.ts` · Test `tests/unit/timer-plan.test.ts`

**Interfaces:**
- Produces (`src/lib/meditation/timer-plan.ts`):
  - `TIMER_PRESETS: readonly number[] = [5, 10, 15, 20, 30]`
  - `INTERVAL_OPTIONS: readonly (number | null)[] = [null, 1, 2, 5, 10]`
  - `LEAD_SECONDS = 10`, `END_STRIKES: readonly number[] = [0, 3, 6]`, `TIMER_TAIL = 12`
  - `interface TimerSettings { minutes: number; intervalMin: number | null; sound: SoundId | null; lead: boolean }`
  - `interface TimerPlan { lead: number; length: number; strikes: number[]; finish: number }` – alle Zeiten in Sekunden ab Programmstart; `length` = gezählte Dauer.
  - `timerPlan(s: Pick<TimerSettings, 'minutes' | 'intervalMin' | 'lead'>): TimerPlan`
  - `clampMinutes(n: number): number` – runden, auf 1–120 begrenzen, `NaN` → 10.

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/timer-plan.test.ts
import { test, expect } from 'vitest'
import { timerPlan, clampMinutes, TIMER_PRESETS, INTERVAL_OPTIONS } from '../../src/lib/meditation/timer-plan'

test('options', () => {
  expect(TIMER_PRESETS).toEqual([5, 10, 15, 20, 30])
  expect(INTERVAL_OPTIONS).toEqual([null, 1, 2, 5, 10])
})
test('20 min, interval 5, with lead', () => {
  expect(timerPlan({ minutes: 20, intervalMin: 5, lead: true })).toEqual({
    lead: 10, length: 1200, strikes: [10, 310, 610, 910, 1210, 1213, 1216], finish: 1222,
  })
})
test('interval falling on the end is dropped', () => {
  expect(timerPlan({ minutes: 10, intervalMin: 5, lead: false }).strikes).toEqual([0, 300, 600, 603, 606])
  expect(timerPlan({ minutes: 1, intervalMin: 1, lead: false }).strikes).toEqual([0, 60, 63, 66])
})
test('no interval', () => {
  expect(timerPlan({ minutes: 5, intervalMin: null, lead: false })).toEqual({ lead: 0, length: 300, strikes: [0, 300, 303, 306], finish: 312 })
})
test('clampMinutes', () => {
  expect([clampMinutes(0), clampMinutes(121), clampMinutes(7.6), clampMinutes(Number.NaN)]).toEqual([1, 120, 8, 10])
})
```

- [ ] **Step 2:** `npm test -- --project unit timer-plan` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren (Startschale bei `lead`; Intervalle bei `lead + k·intervall·60` für alle k ≥ 1 mit Zeitpunkt < `lead + length`; End-Schalen bei `lead + length + END_STRIKES`; `finish = lead + length + TIMER_TAIL`).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `feat: Timer-Plan mit Vorlauf, Intervall- und End-Klangschalen`.

---

### Task 2: Atemmuster & Ablauf

**Files:** Create `src/lib/breath/patterns.ts` · Test `tests/unit/breath.test.ts`

**Interfaces:**
- Produces (`src/lib/breath/patterns.ts`):
  - `type BreathPatternId = '478' | 'box' | 'kohaerent' | 'langes-ausatmen' | 'seufzer' | 'wechselatmung'`; `type PhaseKind = 'ein' | 'halten' | 'aus'`
  - `interface BreathPhase { kind: PhaseKind; seconds: number; label?: string; level?: number }` – `label` ersetzt `PHASE_LABEL[kind]` in der Anzeige; `level` = Kreisgröße am Phasenende (0 klein … 1 groß), Standard: ein → 1, aus → 0, halten → unverändert. Jeder Zyklus beginnt und endet bei 0.
  - `interface BreathPattern { id: BreathPatternId; title: string; description: string; phases: readonly BreathPhase[] }`
  - `BREATH_PATTERNS: readonly BreathPattern[]` in dieser Reihenfolge (Texte wörtlich):
    - `478`: title „4-7-8“, description „Einatmen 4 s · Halten 7 s · Ausatmen 8 s“, Phasen ein 4, halten 7, aus 8
    - `box`: „Box-Atmung“, „Einatmen 4 s · Halten 4 s · Ausatmen 4 s · Halten 4 s“, ein 4, halten 4, aus 4, halten 4
    - `kohaerent`: „Kohärentes Atmen“, „Einatmen 5,5 s · Ausatmen 5,5 s“, ein 5.5, aus 5.5
    - `langes-ausatmen`: „Langes Ausatmen“, „Einatmen 4 s · Ausatmen 6 s“, ein 4, aus 6
    - `seufzer`: „Physiologischer Seufzer“, „Einatmen 3 s · kurz Nachatmen 1 s · langsam Ausatmen 6 s“, ein 3 (level 0.8), ein 1 (label „Nachatmen“, level 1), aus 6
    - `wechselatmung`: „Wechselatmung“, „Je 4 s: links ein · rechts aus · rechts ein · links aus. Das andere Nasenloch hältst du mit dem Finger zu.“, ein 4 (label „Links einatmen“), aus 4 („Rechts ausatmen“), ein 4 („Rechts einatmen“), aus 4 („Links ausatmen“)
  - `BREATH_MINUTES: readonly number[] = [1, 3, 5, 10]`
  - `PHASE_LABEL: Record<PhaseKind, string> = { ein: 'Einatmen', halten: 'Halten', aus: 'Ausatmen' }`
  - `patternById(id: BreathPatternId): BreathPattern`
  - `interface BreathPlan { cycle: number; cycles: number; length: number; cues: { at: number; kind: PhaseKind }[] }` – `cycles = ceil(minutes·60 / cycle)` (laufender Zyklus wird zu Ende geführt), `length = cycles·cycle`, ein Cue am Beginn jeder Phase.
  - `breathPlan(id: BreathPatternId, minutes: number): BreathPlan`
  - `interface BreathMoment { kind: PhaseKind; label: string; level: number; phaseElapsed: number; phaseLength: number; secondsLeft: number; done: boolean }` – `secondsLeft = ceil(phaseLength − phaseElapsed)`; `level` linear vom Stand am Phasenbeginn zum Ziel der Phase.
  - `breathAt(id: BreathPatternId, elapsed: number, length: number): BreathMoment` – `elapsed < 0` → Beginn der ersten Phase; `elapsed ≥ length` → `done: true` (Phase = letzte, `level` 0).

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/breath.test.ts
import { test, expect } from 'vitest'
import { BREATH_PATTERNS, breathPlan, breathAt, PHASE_LABEL } from '../../src/lib/breath/patterns'

test('patterns', () => {
  expect(BREATH_PATTERNS.map(p => p.title)).toEqual(['4-7-8', 'Box-Atmung', 'Kohärentes Atmen', 'Langes Ausatmen', 'Physiologischer Seufzer', 'Wechselatmung'])
  expect(PHASE_LABEL).toEqual({ ein: 'Einatmen', halten: 'Halten', aus: 'Ausatmen' })
})
test('new patterns: lengths, labels and circle level', () => {
  expect(breathPlan('langes-ausatmen', 3).length).toBe(180)
  expect([breathPlan('seufzer', 1).cycle, breathPlan('seufzer', 1).length]).toEqual([10, 60])
  expect(breathPlan('wechselatmung', 1).length).toBe(64)
  expect(breathAt('seufzer', 1.5, 60)).toMatchObject({ kind: 'ein', label: 'Einatmen', level: expect.closeTo(0.4) })
  expect(breathAt('seufzer', 3.5, 60)).toMatchObject({ kind: 'ein', label: 'Nachatmen', level: expect.closeTo(0.9) })
  expect(breathAt('seufzer', 7, 60)).toMatchObject({ kind: 'aus', label: 'Ausatmen', level: expect.closeTo(0.5) })
  expect([1, 5, 9, 13].map(t => breathAt('wechselatmung', t, 64).label)).toEqual(['Links einatmen', 'Rechts ausatmen', 'Rechts einatmen', 'Links ausatmen'])
  expect([breathAt('box', 6, 64).level, breathAt('box', 14, 64).level]).toEqual([1, 0]) // Halten nach ein bzw. aus
})
test('plans finish the running cycle', () => {
  const p = breathPlan('478', 1)
  expect([p.cycle, p.cycles, p.length]).toEqual([19, 4, 76])
  expect(p.cues.slice(0, 4)).toEqual([{ at: 0, kind: 'ein' }, { at: 4, kind: 'halten' }, { at: 11, kind: 'aus' }, { at: 19, kind: 'ein' }])
  expect(p.cues).toHaveLength(12)
  expect(breathPlan('kohaerent', 3).length).toBe(187)
  expect(breathPlan('box', 10).length).toBe(608)
})
test('moment at a point in time', () => {
  expect(breathAt('478', 5, 76)).toEqual({ kind: 'halten', label: 'Halten', level: 1, phaseElapsed: 1, phaseLength: 7, secondsLeft: 6, done: false })
  expect(breathAt('kohaerent', -2, 187)).toMatchObject({ kind: 'ein', phaseElapsed: 0, done: false })
  expect(breathAt('478', 76, 76)).toMatchObject({ done: true })
})
```

- [ ] **Step 2:** `npm test -- --project unit breath` → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: sechs Atemmuster mit Ablaufplan und Kreisgröße`.

---

### Task 3: Statistik-Kern (Schema, Serie, Backup)

**Files:** Create `src/lib/stats/schema.ts`, `src/lib/stats/summary.ts`, `src/lib/stats/backup.ts` · Tests `tests/unit/stats-schema.test.ts`, `tests/unit/stats-summary.test.ts`, `tests/unit/stats-backup.test.ts`

**Interfaces:**
- Produces `src/lib/stats/schema.ts`:
  ```ts
  type SessionKind = 'guided' | 'timer' | 'breath'
  interface Session { id: string; start: string /* ISO */; kind: SessionKind; ref: string; seconds: number }
  interface SessionResult { kind: SessionKind; ref: string; start: Date; seconds: number } // von der Engine gemeldet
  interface Settings {
    vibration: boolean          // Standard true
    voiceBalance: number        // Standard 0.5 (für Meilenstein 3, noch ohne Oberfläche)
    timerSound: SoundId | null  // Standard-Hintergrundklang des Timers, Standard null
    timerLead: boolean          // Standard true
    timer: { minutes: number; intervalMin: number | null } // zuletzt gewählt, Standard { minutes: 10, intervalMin: null }
  }
  type LastUsed =
    | { kind: 'timer'; minutes: number; intervalMin: number | null; sound: SoundId | null; lead: boolean }
    | { kind: 'breath'; pattern: BreathPatternId; minutes: number }
  interface AppData { version: 1; sessions: Session[]; settings: Settings; lastUsed?: LastUsed }
  const DEFAULT_SETTINGS: Settings
  function emptyData(): AppData
  function parseData(raw: unknown): AppData | null   // strenge Strukturprüfung; fehlende Settings-Felder mit Standardwerten auffüllen; sonst ungültig → null
  ```
- Produces `src/lib/stats/summary.ts`: `MIN_SECONDS = 60`; `dayKey(d: Date): string` (`YYYY-MM-DD`, lokal); `streak(sessions: Session[], now: Date): number`; `totalMinutes(sessions: Session[]): number` (Σ seconds / 60, abgerundet); `daysInMonth(sessions: Session[], year: number, month0: number): Set<number>` (Tage 1–31 mit ≥ 1 Sitzung).
- Produces `src/lib/stats/backup.ts`: `backupFileName(now: Date): string` → `ruhe-backup-JJJJ-MM-TT.json`; `serializeBackup(data: AppData): string` (`{ version, sessions, settings }`, eingerückt); `mergeBackup(current: AppData, text: string): { data: AppData; added: number } | { error: string }` – Sitzungen nach `id` zusammenführen (vorhandene IDs überspringen, nach `start` sortiert), Einstellungen aus der Datei übernehmen, `lastUsed` behalten; Fehlertext exakt „Diese Datei ist kein gültiges Ruhe-Backup.“

- [ ] **Step 1: Failing tests** (Auszug – je Datei; Zeiten lokal, Testumgebung `TZ=Europe/Berlin` per `process.env.TZ` am Dateianfang setzen)

```ts
// tests/unit/stats-summary.test.ts
process.env.TZ = 'Europe/Berlin'
import { test, expect } from 'vitest'
import { streak, totalMinutes, daysInMonth, dayKey } from '../../src/lib/stats/summary'
const s = (start: Date, seconds = 600) => ({ id: start.toISOString(), start: start.toISOString(), kind: 'timer' as const, ref: 'timer', seconds })
const d = (y: number, m: number, day: number, h = 8, min = 0) => new Date(y, m - 1, day, h, min)

test('streak counts back from today, or from yesterday if today is empty', () => {
  const ss = [s(d(2026, 10, 19)), s(d(2026, 10, 20)), s(d(2026, 10, 21))]
  expect(streak(ss, d(2026, 10, 21, 22))).toBe(3)
  expect(streak(ss.slice(0, 2), d(2026, 10, 21, 22))).toBe(2)   // heute noch nicht meditiert
  expect(streak(ss.slice(0, 2), d(2026, 10, 22, 0, 1))).toBe(0)  // gestern auch nicht → gerissen
  expect(streak([], d(2026, 10, 21))).toBe(0)
})
test('session just before midnight counts for that day', () => {
  expect(dayKey(d(2026, 10, 20, 23, 50))).toBe('2026-10-20')
  expect(streak([s(d(2026, 10, 20, 23, 50)), s(d(2026, 10, 21, 0, 10))], d(2026, 10, 21, 12))).toBe(2)
})
test('streak survives the DST switch', () => {
  const ss = [s(d(2026, 3, 28, 23, 30)), s(d(2026, 3, 29, 9)), s(d(2026, 3, 30, 9))]
  expect(streak(ss, d(2026, 3, 30, 20))).toBe(3)
})
test('totals and calendar days', () => {
  expect(totalMinutes([s(d(2026, 10, 1), 90), s(d(2026, 10, 2), 61)])).toBe(2)
  expect([...daysInMonth([s(d(2026, 10, 1)), s(d(2026, 10, 1, 20)), s(d(2026, 11, 3))], 2026, 9)]).toEqual([1])
})
```

```ts
// tests/unit/stats-schema.test.ts
import { test, expect } from 'vitest'
import { parseData, emptyData, DEFAULT_SETTINGS } from '../../src/lib/stats/schema'
test('defaults', () => {
  expect(DEFAULT_SETTINGS).toEqual({ vibration: true, voiceBalance: 0.5, timerSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } })
  expect(emptyData()).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
})
test('parseData accepts valid data and fills missing settings', () => {
  const raw = { version: 1, sessions: [{ id: 'a', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }], settings: { vibration: false } }
  expect(parseData(raw)).toEqual({ ...raw, settings: { ...DEFAULT_SETTINGS, vibration: false } })
})
test('parseData rejects broken data', () => {
  for (const bad of [null, 'x', { version: 2, sessions: [], settings: {} }, { version: 1, sessions: [{ id: 1 }], settings: {} }, { version: 1, sessions: [{ id: 'a', start: 'kein Datum', kind: 'timer', ref: 'timer', seconds: 60 }], settings: {} }])
    expect(parseData(bad)).toBeNull()
})
```

```ts
// tests/unit/stats-backup.test.ts
import { test, expect } from 'vitest'
import { backupFileName, serializeBackup, mergeBackup } from '../../src/lib/stats/backup'
import { emptyData } from '../../src/lib/stats/schema'
const sess = (id: string, start: string) => ({ id, start, kind: 'timer' as const, ref: 'timer', seconds: 600 })
test('file name', () => expect(backupFileName(new Date(2026, 9, 21, 9))).toBe('ruhe-backup-2026-10-21.json'))
test('round trip and merge without duplicates', () => {
  const mine = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z')] }
  const theirs = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z'), sess('b', '2026-10-19T08:00:00.000Z')], settings: { ...emptyData().settings, vibration: false } }
  const r = mergeBackup(mine, serializeBackup(theirs))
  expect('data' in r && r.added).toBe(1)
  expect('data' in r && r.data.sessions.map(x => x.id)).toEqual(['b', 'a'])
  expect('data' in r && r.data.settings.vibration).toBe(false)
})
test('invalid backup', () => {
  expect(mergeBackup(emptyData(), '{nope')).toEqual({ error: 'Diese Datei ist kein gültiges Ruhe-Backup.' })
  expect(mergeBackup(emptyData(), '{"version":7}')).toEqual({ error: 'Diese Datei ist kein gültiges Ruhe-Backup.' })
})
```

- [ ] **Step 2:** `npm test -- --project unit stats` → FAIL.
- [ ] **Step 3:** Implementieren. `parseData` prüft je Sitzung: `id` nicht leerer String, `start` gültiges ISO-Datum, `kind` ∈ SessionKind, `ref` String, `seconds` endliche Zahl ≥ 0; `lastUsed` nur übernehmen, wenn gültig (sonst weglassen).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: Statistik-Kern mit Serie, Kalendertagen und Backup`.

---

### Task 4: Speicherung & reaktiver Store

**Files:** Create `src/lib/stats/persist.ts`, `src/lib/stats/store.svelte.ts` · Test `tests/unit/stats-persist.test.ts`

**Interfaces:**
- Consumes: Task 3 (`AppData`, `parseData`, `emptyData`, `SessionResult`, `MIN_SECONDS`, `mergeBackup`).
- Produces `src/lib/stats/persist.ts`:
  - `STORAGE_KEY = 'ruhe.v1'`, `CORRUPT_KEY = 'ruhe.v1.corrupt'`
  - `type StorageLike = Pick<Storage, 'getItem' | 'setItem'>`
  - `loadData(storage: StorageLike | null): AppData` – fehlt → `emptyData()`; ungültig → Rohtext nach `CORRUPT_KEY`, `emptyData()`; wirft nie.
  - `saveData(storage: StorageLike | null, data: AppData): boolean` – `false` bei Fehler, wirft nie.
  - `withSession(data: AppData, result: SessionResult, id: string): AppData | null` – `null`, wenn `seconds < 60`; sonst neue Sitzung angehängt (`start` = `result.start.toISOString()`, `seconds` abgerundet).
- Produces `src/lib/stats/store.svelte.ts` (dünne Hülle, nicht unit-getestet):
  - `stats: { data: AppData; saveFailed: boolean }` (`$state`, initial aus `loadData(safeLocalStorage())`)
  - `recordSession(result: SessionResult): boolean` (true = gezählt, d. h. ≥ 60 s – auch wenn das Speichern scheitert; die Sitzung bleibt dann im Speicher der App), `setLastUsed(last: LastUsed): void`, `updateSettings(patch: Partial<Settings>): void`, `importBackup(text: string): { added: number } | { error: string }` – jede Änderung speichert sofort; `saveFailed` merkt sich Speicherfehler.
  - `safeLocalStorage(): StorageLike | null` – `null`, wenn der Zugriff wirft.

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/stats-persist.test.ts
import { test, expect } from 'vitest'
import { loadData, saveData, withSession, STORAGE_KEY, CORRUPT_KEY } from '../../src/lib/stats/persist'
import { emptyData } from '../../src/lib/stats/schema'
const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

test('missing data gives an empty state', () => expect(loadData(mem())).toEqual(emptyData()))
test('corrupt data is backed up and replaced', () => {
  const s = mem(); s.m.set(STORAGE_KEY, '{kaputt')
  expect(loadData(s)).toEqual(emptyData())
  expect(s.m.get(CORRUPT_KEY)).toBe('{kaputt')
})
test('save and load round trip', () => {
  const s = mem(); const data = { ...emptyData(), lastUsed: { kind: 'breath' as const, pattern: '478' as const, minutes: 3 } }
  expect(saveData(s, data)).toBe(true)
  expect(loadData(s)).toEqual(data)
})
test('save failure is reported, not thrown', () => {
  const broken = { getItem: () => null, setItem: () => { throw new DOMException('voll', 'QuotaExceededError') } }
  expect(saveData(broken, emptyData())).toBe(false)
  expect(loadData({ getItem: () => { throw new Error('gesperrt') }, setItem: () => {} })).toEqual(emptyData())
  expect(loadData(null)).toEqual(emptyData())
})
test('withSession applies the 60 second rule', () => {
  const start = new Date('2026-10-21T08:00:00.000Z')
  expect(withSession(emptyData(), { kind: 'timer', ref: 'timer', start, seconds: 59.9 }, 'x')).toBeNull()
  expect(withSession(emptyData(), { kind: 'breath', ref: '478', start, seconds: 76.4 }, 'x')!.sessions)
    .toEqual([{ id: 'x', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }])
})
```

- [ ] **Step 2:** `npm test -- --project unit stats-persist` → FAIL.
- [ ] **Step 3:** `persist.ts` implementieren, dann `store.svelte.ts` (IDs über `crypto.randomUUID()`).
- [ ] **Step 4:** `npm test -- --project unit && npm run check` → PASS, 0 Fehler.
- [ ] **Step 5:** Commit `feat: Statistik speichern und laden, robust gegen Speicherfehler`.

---

### Task 5: Programme in der Audio-Engine

**Files:** Create `src/lib/audio/strike.ts`, `src/lib/audio/cue.ts`, `src/lib/audio/program.ts` · Modify `src/lib/audio/engine.ts`, `src/lib/audio/media-session.ts` · Test `tests/browser/program.test.ts`

**Interfaces:**
- Consumes: Task 1 (`timerPlan`, `TimerSettings`), Task 2 (`breathPlan`, `patternById`, `BreathPatternId`, `PhaseKind`), Task 3 (`SessionResult`); `EFFECTS`, `assetUrl` aus `src/lib/sounds/catalog.ts`.
- Produces:
  - `src/lib/audio/strike.ts`: `scheduleStrike(ctx: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer, when: number): AudioBufferSourceNode`
  - `src/lib/audio/cue.ts`: `scheduleCue(ctx: BaseAudioContext, destination: AudioNode, when: number, kind: PhaseKind): OscillatorNode` – Sinus 528 Hz (ein) / 440 Hz (halten) / 396 Hz (aus), Spitzenpegel 0,15, Anstieg 0,06 s, exponentielles Abklingen, Länge 0,6 s.
  - `src/lib/audio/program.ts`:
    ```ts
    interface ProgramAssets { strike: AudioBuffer | null }
    interface ProgramSpec {
      kind: 'timer' | 'breath'
      ref: string                 // 'timer' bzw. BreathPatternId
      title: string               // Media-Session-Titel
      lead: number; length: number; finish: number   // s ab Programmstart
      background: SoundId | null
      // Plant alle Klänge ab t0 ein und liefert eine Funktion, die alles Eingeplante sofort stoppt.
      schedule(ctx: BaseAudioContext, destination: AudioNode, t0: number, assets: ProgramAssets): () => void
    }
    function timerProgram(s: TimerSettings): ProgramSpec   // title „Meditation · {minutes} Min“, ref 'timer'
    function breathProgram(id: BreathPatternId, minutes: number): ProgramSpec // title „Atmen · {pattern.title}“, lead 0, finish = length + 1, background null
    ```
  - `src/lib/audio/engine.ts` (zusätzlich):
    ```ts
    interface ProgramSnapshot { kind: 'timer' | 'breath'; ref: string; title: string; lead: number; length: number; finish: number; elapsed: number; ended: boolean }
    // EngineSnapshot bekommt: program: ProgramSnapshot | null
    startProgram(spec: ProgramSpec): Promise<void>
    endProgram(): Promise<void>
    programElapsed(): number | null      // s seit Programmstart auf der Audio-Uhr
    onSessionEnd(listener: (r: SessionResult) => void): () => void
    ```

**Verhalten (verbindlich):**
- `startProgram`: Output sicherstellen (Nutzergeste), laufende Klänge und einen laufenden Programm-Vorgänger beenden (Vorgänger meldet sein Ergebnis), Sleep-Countdown verwerfen. Klangschalen-Puffer über den vorhandenen Loader laden (`assetUrl(EFFECTS[0].file)`, Fehler → `strike: null`, Programm läuft ohne Schalen). Erst danach `t0 = ctx.currentTime + 0.05` festlegen und `spec.schedule(...)` mit einem eigenen Gain (1,0) in `input` aufrufen; `startDate = new Date()` merken. Hintergrundklang über denselben Weg wie `toggle` starten (Fehler → ohne Klang weiter). Marken auf der Audio-Uhr: bei `t0 + lead + length` „gezählte Zeit vorbei“ → Ergebnis melden (`seconds = length`, unabhängig von der Wanduhr), `ended = true`; bei `t0 + finish` → Hintergrund ausblenden, Programm entfernen, Zustand `idle` (mit der vorhandenen Settle-Logik).
- Gezählte Sekunden bei vorzeitigem Ende: `clamp(elapsed − lead, 0, length)` mit `elapsed` auf der Audio-Uhr (Pausen zählen dadurch nicht).
- `endProgram`: eingeplante Klänge sofort stoppen (Rückgabe von `schedule`), Marken verwerfen, Ergebnis melden – außer es wurde schon gemeldet –, Hintergrund ausblenden, `idle`.
- `toggle(id)` während eines Programms beendet zuerst das Programm (wie `endProgram`) und startet dann den Klang.
- `stopAll()` während eines Programms (z. B. „Stop“ in der Benachrichtigung) wirkt wie `endProgram()`.
- Während eines Programms gilt kein Sleep-Timer (`setSleepTimer` speichert nur die Auswahl; `remainingSec` ist `null`).
- Pause/Weiter/Unterbrechung/`needsTap` wie bisher; die Audio-Uhr steht in der Pause, alle Marken verschieben sich mit.
- Ergebnis: `{ kind, ref, start: startDate, seconds }` genau einmal je Programm an alle `onSessionEnd`-Hörer.
- Media Session: Läuft ein Programm, ist der Titel `program.title` (statt der Klangtitel).

- [ ] **Step 1: Failing tests** (`tests/browser/program.test.ts`; Muster wie `tests/browser/engine.test.ts`: `make()` mit synthetischem Loader, `afterEach` schließt den Kontext; Zeitpunkte über `expect.poll`)

```ts
const spec = (over: Partial<ProgramSpec> = {}): ProgramSpec => ({
  kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 0.2, length: 1, finish: 1.5, background: null,
  schedule: vi.fn(() => vi.fn()), ...over,
})

test('program stops running sounds and reports its title', async () => { /* toggle('regen'); startProgram(spec()) → volumes {}, program.title, navigator.mediaSession.metadata.title === 'Meditation · 1 Min' */ })
test('natural end reports the planned length', async () => {
  // onSessionEnd → genau 1 Ergebnis { kind:'timer', ref:'timer', seconds: 1 } (exakt spec.length); start ist ein Date;
  // danach (poll) state 'idle', program null
})
test('pause freezes the program clock and is not counted', async () => {
  // lead 0, length 10, finish 11: warte 0,4 s, pause, warte 0,6 s, resume, warte 0,3 s, endProgram
  // → seconds ≈ 0,7 (toBeGreaterThan(0.5), toBeLessThan(0.95))
})
test('early end inside the lead counts nothing', async () => { /* lead 0.5: nach 0,2 s endProgram → seconds 0 */ })
test('starting a sound ends the running program', async () => { /* startProgram; toggle('wald') → program null, 1 Ergebnis, volumes {wald:0.7} */ })
test('double start keeps exactly one program', async () => {
  // const a = spec(), b = spec({ title: 'B' }); await Promise.all([e.startProgram(a), e.startProgram(b)])
  // → program.title 'B'; der Stop-Rückgabewert von a.schedule wurde aufgerufen (falls a geplant hatte); höchstens 1 Ergebnis für a
})
test('stopAll ends the program and reports once', async () => { /* startProgram; stopAll → program null, state 'idle', genau 1 Ergebnis */ })
test('program ignores the sleep timer', async () => { /* setSleepTimer(0.02); startProgram(length 3) → nach 2 s state 'playing', remainingSec null */ })
test('background sound plays and fades at finish', async () => { /* background 'regen' → während: volumes {regen:0.7}; nach finish: volumes {}, voiceCount → 0 */ })
test('timerProgram schedules strikes at the planned times', async () => {
  // OfflineAudioContext; Spy auf AudioBufferSourceNode.prototype.start; timerProgram({minutes:1,intervalMin:null,lead:true,sound:null})
  //   .schedule(ctx, ctx.destination, 2, { strike: buffer }) → Startzeiten [12, 72, 75, 78]
})
test('breathProgram schedules a cue at every phase', async () => {
  // Spy auf OscillatorNode.prototype.start; breathProgram('478', 1).schedule(ctx, dest, 0, {strike:null})
  //   → 12 Starts bei [0,4,11,19,…]; Titel 'Atmen · 4-7-8'; length 76; finish 77
})
```

- [ ] **Step 2:** `npm test -- --project browser program` → FAIL.
- [ ] **Step 3:** `strike.ts`, `cue.ts`, `program.ts` und die Engine-Erweiterung implementieren. Wächst `engine.ts` über ~480 Zeilen, die Programm-Verwaltung (Marken, Ergebnis) in eine eigene Klasse `ProgramRun` in `src/lib/audio/program-run.ts` auslagern, die die Engine hält.
- [ ] **Step 4:** `npm test -- --project browser` (3×) und `npm run check` → PASS, keine Flakiness.
- [ ] **Step 5:** Commit `feat: Programme (Timer, Atmen) auf der Audio-Uhr mit Sitzungsergebnis`.

---

### Task 6: Ebenen, Bestätigung & Android-Zurück

**Files:** Create `src/lib/ui/layers.svelte.ts`, `src/components/Sheet.svelte`, `src/components/ConfirmDialog.svelte` · Test `tests/browser/layers.test.ts`

**Interfaces:**
- Produces `src/lib/ui/layers.svelte.ts`: `openLayer(onBack: () => void): () => void` – legt einen History-Eintrag an; die Zurück-Geste (`popstate`) ruft `onBack` der obersten Ebene; die zurückgegebene Funktion schließt die Ebene programmatisch (entfernt ihren Eintrag per `history.back()`, ohne `onBack` auszulösen). Mehrere Ebenen stapeln sich. `history.back()` wirkt asynchron: Ein `openLayer`, solange ein programmatisches Schließen noch auf sein `popstate` wartet, legt seinen Eintrag erst danach an (sonst landet die Rückwärts-Navigation auf dem neuen Eintrag und löst dessen `onBack` aus).
- `Sheet.svelte`: Props `title: string`, `onClose: () => void`, Snippet `children`; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` auf die Überschrift; Fokus beim Öffnen auf die Überschrift; Escape schließt; nutzt `openLayer`.
- `ConfirmDialog.svelte`: Props `title`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`; `role="alertdialog"`; Fokus auf den Abbrechen-Knopf.

- [ ] **Step 1: Failing test** (Vitest Browser, echte History-API)

```ts
test('back closes the top layer first', async () => {
  const closed: string[] = []
  openLayer(() => closed.push('a')); openLayer(() => closed.push('b'))
  history.back(); await expect.poll(() => closed).toEqual(['b'])
  history.back(); await expect.poll(() => closed).toEqual(['b', 'a'])
})
test('closing programmatically does not trigger onBack', async () => {
  const closed: string[] = []
  const close = openLayer(() => closed.push('a')); close()
  await new Promise(r => setTimeout(r, 200)); expect(closed).toEqual([])
})
test('close then open in one go keeps the new layer', async () => {
  const closed: string[] = []
  const close = openLayer(() => closed.push('sheet')); close(); openLayer(() => closed.push('player'))
  await new Promise(r => setTimeout(r, 200)); expect(closed).toEqual([])
  history.back(); await expect.poll(() => closed).toEqual(['player'])
})
```

- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS + `npm run check`.
- [ ] **Step 5:** Commit `feat: Ebenen mit Android-Zurück, Sheet und Bestätigungsdialog`.

---

### Task 7: Meditations-Timer (Oberfläche)

**Files:** Create `src/components/timer/TimerSetup.svelte`, `src/components/player/TimerPlayer.svelte`, `src/components/player/SessionDone.svelte`, `src/lib/session-wiring.ts`, `src/lib/ui/session-ui.svelte.ts` · Modify `src/screens/Meditieren.svelte`, `src/App.svelte`, `src/main.ts` · Test `tests/unit/session-wiring.test.ts`, `tests/e2e/timer.spec.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: Task 1, 4, 5, 6.
- Produces:
  - `src/lib/session-wiring.ts`: `connectSessions(source: { onSessionEnd(l: (r: SessionResult) => void): () => void }, record: (r: SessionResult) => boolean, done: (r: SessionResult, counted: boolean) => void): () => void`
  - `src/lib/ui/session-ui.svelte.ts`: `sessionUi: { done: { kind: SessionKind; ref: string; seconds: number; counted: boolean } | null }`, `clearDone(): void`
  - `main.ts` ruft einmal `connectSessions(engine, recordSession, (r, counted) => sessionUi.done = {...})`.

**Texte & Rollen (wörtlich):**
- Meditieren: `<h1>Meditieren</h1>`; Karte `<h2>Meditations-Timer</h2>` mit Zusammenfassung der gemerkten Einstellungen (z. B. „10 Min · ohne Zwischenschale“ / „20 Min · Klangschale alle 5 Min“ / „… jede Minute“) und Knopf „Timer einstellen“; darunter `<h2>Geführte Meditationen</h2>` + „Kommen mit dem nächsten Update.“
- Sheet „Meditations-Timer“: `role="radiogroup" aria-label="Dauer"` mit „5 Min“ … „30 Min“ und „Frei“; bei „Frei“ ein Zahlenfeld `aria-label="Minuten"` (1–120, Wert über `clampMinutes`); `role="radiogroup" aria-label="Klangschale zwischendurch"` mit „Aus“, „Jede Minute“, „Alle 2 Min“, „Alle 5 Min“, „Alle 10 Min“; `<select aria-label="Hintergrundklang">` mit „Keiner“ + 8 Klangtitel; Schalter `role="switch"` „10 Sekunden ankommen“; Knopf „Starten“ (nach dem ersten Tipp deaktiviert, bis das Programm läuft).
- Das Sheet öffnet mit den gemerkten Werten: `settings.timer`, `settings.timerSound`, `settings.timerLead` (Hintergrund und Vorlauf sind dieselben Werte wie unter „Ich“).
- Start: `updateSettings({ timer: { minutes, intervalMin }, timerSound: sound, timerLead: lead })` und `setLastUsed({ kind: 'timer', minutes, intervalMin, sound, lead })`, dann `engine.startProgram(timerProgram(settings))`; sobald das Programm läuft, schließt sich das Sheet (`close()` seiner Ebene) und der Player erscheint.
- Player (Vollbild über allem, ohne Reiterleiste). Laufansicht, solange `program?.kind === 'timer' && !program.ended`; Abschluss (`SessionDone`), solange `sessionUi.done?.kind === 'timer'` (die End-Schalen klingen dabei noch aus):
  - oben `program.title`
  - im Vorlauf: „Ankommen“ und die Restsekunden (10 … 1)
  - danach die Restzeit groß (`formatRemaining(length − (elapsed − lead))` aus `src/lib/time/format.ts`) mit Fortschrittsring
  - Knöpfe „Pause“/„Weiter“ (`togglePause()`) und „Beenden“ (`engine.endProgram()`, ohne Rückfrage); bei `audio.snap.needsTap` der Hinweis „Zum Starten tippen“ wie im Klänge-Reiter
  - Abschluss: `<h2>Schön, dass du dir die Zeit genommen hast.</h2>`, dazu „{n} Min meditiert“ (n = abgerundete Minuten) oder bei `counted: false` „Unter einer Minute – das zählt noch nicht für die Statistik.“; Knopf „Fertig“ (`clearDone()`)
- Ebenen-Ablauf: Der Player öffnet beim Erscheinen eine Ebene. Zurück in der Laufansicht verbraucht sie: Der Player öffnet sofort wieder seine Ebene und zeigt `ConfirmDialog` „Meditation beenden?“ mit „Beenden“ / „Weiter meditieren“ (eigene Ebene; Zurück im Dialog = „Weiter meditieren“). Endet das Programm, während der Dialog offen ist, schließt er sich. Im Abschluss schließen Zurück oder „Fertig“ den Player.
- Die Anzeige liest die Zeit per `requestAnimationFrame` aus `engine.programElapsed()` (nur Anzeige; der Sekundentakt in `engine-store` läuft ohnehin, solange der Zustand nicht `idle` ist).
- `MiniPlayer` nur ohne Programm; `UpdateToast` nur, wenn `state === 'idle'`, kein Programm und kein `sessionUi.done`.

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/session-wiring.test.ts
test('results are recorded and shown', () => {
  let emit!: (r: SessionResult) => void
  const shown: unknown[] = []
  connectSessions({ onSessionEnd: l => { emit = l; return () => {} } }, r => r.seconds >= 60, (r, counted) => shown.push([r.ref, counted]))
  emit({ kind: 'timer', ref: 'timer', start: new Date(), seconds: 30 })
  emit({ kind: 'breath', ref: '478', start: new Date(), seconds: 76 })
  expect(shown).toEqual([['timer', false], ['478', true]])
})
```

```ts
// tests/e2e/timer.spec.ts – Kernablauf
test('set up, run, pause, confirm back, end', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await page.getByRole('radio', { name: '5 Min', exact: true }).click()
  await page.getByRole('radio', { name: 'Alle 2 Min' }).click()
  await page.getByLabel('Hintergrundklang').selectOption({ label: 'Regen' })
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByText('Ankommen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.goBack()
  await expect(page.getByRole('alertdialog', { name: 'Meditation beenden?' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter meditieren' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await expect(page.getByRole('radio', { name: '5 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Alle 2 Min' })).toHaveAttribute('aria-checked', 'true')
})
test('a full one-minute timer is counted', async ({ page }) => {
  test.setTimeout(120_000)
  // Meditieren → „Timer einstellen“ → „Frei“, Minuten 1, „10 Sekunden ankommen“ aus → „Starten“
  // → nach ≈ 60 s (timeout 75_000) „1 Min meditiert“; „Fertig“; Reiter „Ich“ zeigt bei „Sitzungen“ 1
  //   (bis Task 9 fertig ist: localStorage['ruhe.v1'].sessions hat Länge 1, kind 'timer', seconds 60)
})
```

`tests/e2e/pwa.spec.ts` → `works offline after first visit` am Ende ergänzen: offline Meditieren → „Timer einstellen“ → „Starten“ → „Ankommen“ (exakt) sichtbar → „Beenden“.

- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** `npm run check && npm test && npx playwright test` → PASS.
- [ ] **Step 5:** Commit `feat: Meditations-Timer mit Einstellungen, Vollbild-Player und Abschluss`.

---

### Task 8: Atemübungen (Oberfläche)

**Files:** Create `src/components/player/BreathPlayer.svelte`, `src/lib/ui/wake-lock.ts` · Modify `src/screens/Atmen.svelte`, `src/App.svelte` · Test `tests/e2e/atmen.spec.ts`

**Interfaces:**
- Consumes: Task 2, 4 (`stats.data.settings.vibration`, `setLastUsed`), 5 (`breathProgram`, `engine.programElapsed()`), 6, 7 (`SessionDone`, `sessionUi`).
- Produces `src/lib/ui/wake-lock.ts`: `keepScreenOn(): () => void` – fordert `navigator.wakeLock.request('screen')` an, fordert nach `visibilitychange` (sichtbar) neu an, Rückgabe gibt frei; ohne API oder bei Fehler still wirkungslos.

**Texte & Verhalten:**
- Atmen: `<h1>Atmen</h1>`; `role="radiogroup" aria-label="Dauer"` mit „1 Min“, „3 Min“, „5 Min“, „10 Min“ (Standard 3); je Muster eine Karte mit `<h2>{title}</h2>`, `description` und Knopf „Starten“ (`aria-label="{title} starten"`).
- Player (Vollbild; Laufansicht, solange `program?.kind === 'breath' && !program.ended`, Abschluss, solange `sessionUi.done?.kind === 'breath'`; Ebenen-Ablauf wie in Task 7):
  - Kreis mit Skalierung `0.6 + 0.4 · moment.level` (wächst beim Einatmen, ruht beim Halten, schrumpft beim Ausatmen; beim Seufzer wächst er beim Nachatmen noch ein Stück). Unter `prefers-reduced-motion: reduce` bleibt er statisch.
  - darunter `moment.label` (z. B. „Einatmen“, „Nachatmen“, „Links einatmen“) und die Restsekunden der Phase
  - Knöpfe „Pause“/„Weiter“ und „Beenden“ (nach einem Anruf steht die Übung auf Pause und lässt sich so fortsetzen); `needsTap`-Hinweis wie in Task 7
  - Zeitbasis: `breathAt(id, engine.programElapsed(), length)` pro `requestAnimationFrame`. Dadurch stimmt die Anzeige auch nach dem Entsperren sofort wieder.
  - Bei jedem Phasenwechsel (in der Anzeige erkannt) `navigator.vibrate(40)`, wenn `settings.vibration`.
  - Wake Lock während der Übung.
- Zurück-Geste → `ConfirmDialog` „Übung beenden?“ mit „Beenden“ / „Weiter atmen“.
- Abschluss über `SessionDone`: Überschrift „Gut gemacht.“, darunter „{n} Min geatmet“ bzw. der Unter-einer-Minute-Text aus Task 7.
- Start: `setLastUsed({ kind: 'breath', pattern, minutes })`, dann `engine.startProgram(breathProgram(pattern, minutes))`.

- [ ] **Step 1: Failing test**

```ts
// tests/e2e/atmen.spec.ts
test('breathing shows the phases in order and can be ended', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Atmen' }).click()
  await page.getByRole('radio', { name: '1 Min' }).click()
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 7000 })
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
})
```

- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** Gesamtsuite PASS.
- [ ] **Step 5:** Commit `feat: Atemübungen mit Atemkreis, Tönen, Vibration und Wake Lock`.

---

### Task 9: „Ich“ – Statistik, Kalender, Einstellungen, Backup

**Files:** Create `src/components/Calendar.svelte` · Modify `src/screens/Ich.svelte` · Test `tests/e2e/ich.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`streak`, `totalMinutes`, `daysInMonth`, `backupFileName`, `serializeBackup`), Task 4 (`stats`, `updateSettings`, `importBackup`).

**Texte & Verhalten:**
- `<h1>Ich</h1>`; drei Kennzahlen mit Beschriftung „Serie“ (Wert „{n} Tage“, bei 1 „1 Tag“), „Minuten gesamt“, „Sitzungen“.
- Kalender: Überschrift „{Monatsname} {Jahr}“ (deutsch, z. B. „Oktober 2026“), Knöpfe `aria-label` „Vorheriger Monat“ / „Nächster Monat“, Wochenbeginn Montag, markierte Tage mit `aria-label` „{Tag}. {Monatsname}, meditiert“.
- `<h2>Einstellungen</h2>`: Schalter (`role="switch"`) „Vibration bei Atemübungen“ und „10 Sekunden ankommen“, `<select aria-label="Standard-Hintergrundklang">` („Keiner“ + 8 Titel).
- `<h2>Backup</h2>`: Knopf „Backup exportieren“ (lädt `backupFileName(now)` mit `serializeBackup(stats.data)` herunter), Knopf „Backup importieren“ (öffnet verstecktes `<input type="file" accept="application/json,.json">`). Ergebnis als `role="status"`: „{n} neue Sitzung(en) importiert.“ (1 → „1 neue Sitzung importiert.“) oder der Fehlertext aus Task 3.
- Ist `stats.saveFailed`, steht über dem Backup der Hinweis „Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.“

- [ ] **Step 1: Failing test** (Daten per `page.addInitScript` in `localStorage['ruhe.v1']` vorbelegen; Uhr per `page.clock.setFixedTime(new Date(2026, 9, 21, 20))`)

```ts
// tests/e2e/ich.spec.ts – Auszüge
test('stats, calendar, settings and backup', async ({ page }) => {
  // seed: Sitzungen am 19., 20., 21.10.2026 je 600 s (timer) + 1 am 03.09.2026 (breath, 76 s)
  // → Serie „3 Tage“, Minuten gesamt „31“, Sitzungen „4“
  // Kalender zeigt „Oktober 2026“; Tag mit aria-label „21. Oktober, meditiert“ vorhanden;
  // „Vorheriger Monat“ → „September 2026“ mit „3. September, meditiert“
  // Schalter „Vibration bei Atemübungen“ aus → localStorage['ruhe.v1'].settings.vibration === false
  // „Backup exportieren“ → Download-Dateiname 'ruhe-backup-2026-10-21.json', Inhalt enthält 4 Sitzungen
  // Import einer Datei mit 1 neuen + 1 vorhandenen Sitzung → „1 neue Sitzung importiert.“, Sitzungen „5“
  // Import „kaputt.json“ ('{nope') → „Diese Datei ist kein gültiges Ruhe-Backup.“, Sitzungen weiterhin „5“
})
```

- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** Gesamtsuite PASS.
- [ ] **Step 5:** Commit `feat: Statistik, Kalender, Einstellungen und Backup im Reiter Ich`.

---

### Task 10: „Heute“ – Serie & Schnellstart, Abschluss

**Files:** Modify `src/screens/Heute.svelte`, `README.md`, `docs/superpowers/specs/2026-10-21-ruhe-design.md` (nur Abweichungen nachtragen, falls entstanden) · Test `tests/e2e/heute.spec.ts`

**Texte & Verhalten:**
- Unter der Begrüßung:
  - mit Serie: „{n} Tage in Folge“ (1 → „1 Tag in Folge“)
  - bei 0: „Heute ist ein guter Tag zum Anfangen.“
- Karten:
  1. „Zuletzt genutzt“, nur wenn `lastUsed` gesetzt ist. Beschreibung je nach Art:
     - Timer: „Timer · {minutes} Min“
     - Atmen: „{pattern.title} · {minutes} Min“

     Knopf „Erneut starten“ startet genau diese Sitzung.
  2. „3 Min durchatmen“, Beschreibung „Kohärentes Atmen“, Knopf „Jetzt durchatmen“ startet `breathProgram('kohaerent', 3)`.
  3. Die bestehende Karte „Zur Ruhe kommen“ / „Zu den Klängen“ bleibt.

  Den „Vorschlag des Tages“ gibt es erst mit Meilenstein 3.
- README: Handy-Checkliste für Meilenstein 2:
  1. Timer 5 Min mit Intervall bei gesperrtem Bildschirm: Klangschalen pünktlich, danach erscheint die Sitzung unter „Ich“
  2. Anruf während des Timers: pausiert, die Zeit zählt nicht weiter
  3. Atemübung mit Vibration, Bildschirm bleibt an
  4. Backup exportieren und wieder importieren

- [ ] **Step 1: Failing test**

```ts
// tests/e2e/heute.spec.ts
test('streak and quick start', async ({ page }) => {
  // seed wie Task 9, lastUsed { kind:'breath', pattern:'478', minutes:1 }; Uhr 21.10.2026 20:00
  // → „3 Tage in Folge“; Karte „Zuletzt genutzt“ mit „4-7-8 · 1 Min“
  // „Jetzt durchatmen“ → Vollbild-Player mit „Einatmen“ sichtbar; „Beenden“; „Fertig“ → wieder „Heute“
})
test('empty state', async ({ page }) => { /* ohne Daten → „Heute ist ein guter Tag zum Anfangen.“, keine Karte „Zuletzt genutzt“ */ })
```

- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** `npm run check && npm test && npx playwright test` → PASS.
- [ ] **Step 5:** Commit `feat: Serie und Schnellstart auf Heute, Handy-Checkliste Meilenstein 2`.
