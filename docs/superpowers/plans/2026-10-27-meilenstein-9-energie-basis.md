# Meilenstein 9: Energie-Basis – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Reiter „Energie“ mit Energie-Check-in in vier Bereichen, Brain-Hack-Bibliothek mit „Jetzt-Reset“, Hack-Player mit Live-Führung und Wirkungsfrage, Fokus-Sprint und Wochenmuster; dazu eine Akku-Karte auf „Heute“.

**Architecture:**
- **Daten statt Code für Hacks:** Die 16 Hacks stehen in `content/hacks.json` (eigene Texte, vom Nutzer freigegeben). `src/lib/energy/hacks.ts` prüft sie und rechnet Laufzeit, Schritte und Atemtakt aus. Ein Player spielt jeden Hack.
- **Reine Logik in `src/lib/energy/`:** Bereiche, Auswertung (frisch, Wirkung, Wochenraster, Muster-Sätze, Fokus-Zeile), Reset-Reihenfolge und das Umwandeln eines Engine-Ergebnisses in einen Hack-Lauf oder Sprint. Alles mit der Zeit als Parameter.
- **Engine:** zwei neue Programmarten `hack` und `focus` neben `timer` und `breath`. Ihre Ergebnisse gehen nicht in die Sitzungen, sondern in eigene Listen im Datenstand (`ruhe.v1`).
- **Oberfläche:** Reiter `Energie.svelte` mit Bausteinen unter `src/components/energy/`, zwei neue Vollbild-Player (`HackPlayer`, `SprintPlayer`) auf `PlayerShell`, Check-in-Blatt und Hack-Karte als Sheets an der Wurzel der App.

**Tech Stack:** Svelte 5 (Runes), TypeScript, Web Audio, Vitest (unit/browser), Playwright (Pixel 7, 412 px; 360-px-Tests setzen den Viewport).

**Spec:** `docs/superpowers/specs/2026-10-27-ruhe-m9-energie-basis-design.md`

## Global Constraints

- **Bereiche** in fester Reihenfolge (Spec §2):
  - `koerper` Körper `#F0A58C`, Leitfrage „wach, kräftig, ausgeruht?“
  - `gefuehl` Gefühl `#F3B6C8`, Leitfrage „ruhig, zuversichtlich, verbunden?“
  - `geist` Geist `#9FE0CF`, Leitfrage „klar, fokussiert, aufnahmefähig?“
  - `sinn` Sinn `#C7B8F5`, Leitfrage „ausgerichtet, motiviert, im Einklang?“
- **Stufen:** 1 „leer“, 2 „schwach“, 3 „mittel“, 4 „gut“, 5 „voll“.
- **Schwellen:**
  - „frisch“ heißt höchstens 3 Stunden alt.
  - Ein Vorher-Wert zählt aus einem Check-in höchstens 2 Stunden vor dem Start.
  - Muster ab 7 Check-ins in 14 Tagen.
  - „Was bei dir wirkt“ ab 2 bewerteten Läufen, Durchschnitt über 0, höchstens 3 Hacks.
- **Mindestdauern:** Ein Hack-Lauf zählt ab 30 s, ein Sprint ab 300 s; gespeichert wird die tatsächliche, abgerundete Sekundenzahl.
- **Sprint:**
  - Längen 25, 50 und 90 Minuten, Standard `{ minutes: 50, sound: 'kaffee-und-notizen' }`.
  - Vorhaben getrimmt, höchstens 80 Zeichen.
  - `ref` ist `focus-25` / `focus-50` / `focus-90`, der Titel `Fokus-Sprint · 50 Min`.
- **Zeitfenster** `{ from, to }` in vollen Stunden Ortszeit: Ein Hack ist im Fenster, wenn `from ≤ Stunde < to`.
  - `tageslicht`: 7–17
  - `power-pause`: 11–16
- **Statistik:** Hacks und Sprints zählen nicht in Sitzungen, Minuten, Serien, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in.
- **Datenstand:** `localStorage['ruhe.v1']`, `version` bleibt 1.
  - Neue Felder `energyCheckins`, `hackRuns`, `focusSprints` fehlen, solange sie leer sind.
  - `settings.focus` hat immer einen Wert.
- **Texte der Oberfläche** (wörtlich):
  - **Reiter und Kopf:**
    - Reiter „Energie“, Überschrift „Energie“.
    - Unterzeile „Letzter Check-in vor {n} Min“ (unter 60 Min, mindestens 1) bzw. „Letzter Check-in vor {n} Std.“ (ab 60 Min, abgerundet), solange der letzte Check-in von heute ist, sonst „Noch kein Check-in heute“.
  - **Akku:**
    - „Dein Akku“, „{n} von 5“, „Neuer Check-in“.
    - Ohne frischen Check-in „Wie voll ist dein Akku?“ und „Check-in“.
  - **Check-in-Blatt:**
    - Titel „Wie voll ist dein Akku?“, Unterzeile „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
    - Punkt „{Bereich}: {n} von 5, {Wort}“.
    - „Speichern“, „Später“.
  - **Reset:**
    - Kopf „Jetzt-Reset“, Satz „Dein {Bereich} ist gerade am niedrigsten.“
    - Hack-Zeile „{Bereich} · {n} Min“ und „wirkt bei dir“.
    - Knöpfe „Starten“, „Anderer“.
    - Ohne frischen Check-in „Was braucht gerade Energie?“ mit den vier Bereichen als Knöpfe.
  - **Sprint-Karte:** „Fokus-Sprint“, Feld „Woran arbeitest du?“, „25 Min“ / „50 Min“ / „90 Min“, Auswahl „Hintergrund“, Knopf „Sprint starten“.
  - **Bibliothek:** „Brain Hacks“, Filter „Alle“, „Körper“, „Gefühl“, „Geist“, „Sinn“.
  - **Woche:**
    - „Deine Woche“, „Was bei dir wirkt“.
    - Zeile „{Platz} · {Titel} · {Bereich} · +1,2 Stufen“.
    - Hinweise wörtlich aus Spec §6.3 und §6.5.
  - **Hack-Karte:**
    - Kopf „Brain Hack“, Abschnitte „So geht’s“ und „Warum es wirkt“, Kasten „Hinweis“.
    - „Passt dazu: Atemübung {Titel}“, „Weiterlesen: {further}“.
    - Knopf „Starten · {m:ss}“, Fußzeile „Quelle: {source}“.
  - **Hack-Player:**
    - Dialogname „Brain Hack“, Rückfrage „Hack beenden?“ / „Weiter üben“.
    - „Runde {r} von {n}“, „Schritt {i} von {n}“.
    - Ende: „Geschafft“, „{Bereich} jetzt?“, „vorher“ / „jetzt“, „Fertig“, „Noch einmal“.
  - **Sprint-Player:**
    - Dialogname „Fokus-Sprint“, Rückfrage „Sprint beenden?“ / „Weiter fokussieren“.
    - Ende: „Sprint geschafft“, „{n} Min Fokus“, „Pausen-Vorschlag“, „Starten“, „Check-in“, „Fertig“.
  - **„Heute“:** „Dein Akku“ und „{Bereich} am niedrigsten · Jetzt-Reset“; ohne frischen Check-in „Wie voll ist dein Akku?“ und „Check-in“.
  - **Import:** an die bisherige Meldung angehängt „ Dazu 1 neuer Energie-Eintrag.“ bzw. „ Dazu {n} neue Energie-Einträge.“, nur wenn mindestens 1.
- **Bedienbarkeit:**
  - Tippflächen mindestens 44 × 44 px, Reiterleiste mindestens 48 px hoch.
  - 360 px und 130 % Schrift ohne seitliches Überlaufen.
  - Bereichsfarben als Text auf Karten in allen drei Stimmungen mindestens 4,5:1.
- **Privatsphäre:** Persönliches (Check-ins, Läufe, Sprints, Vorhaben) nur lokal; nichts davon in Repo, Tests mit echten Daten oder Logs.
- **Quellen:** Karten in eigenen Worten mit `source`; keine Buchtexte; Hildebrandt nur als `further` „Henry Hildebrandt, Brainhacks (2025)“ bei den vier Geist-Hacks.
- **Kosten:** fünf Motive über den ElevenLabs-Connector, freigegeben unter 0,50 $. Jeder Aufruf zählt; nie wiederholen, um es „nochmal zu versuchen“. Keine Vertonung.

## Review Focus

1. **Check-in kurz vor Mitternacht:** Ein Check-in um 23:30 gilt um 1:00 noch als frisch (Reset nutzt ihn). Im Wochenraster gehört er zum Vortag, und die Kopfzeile sagt „Noch kein Check-in heute“ (Tests in Task 4 und 6).
2. **Hack früh beendet:**
   - Unter 30 s wird nichts gespeichert, und der Player schließt ohne Ende-Ansicht.
   - Ab 30 s kommt die Ende-Ansicht mit Wirkungsfrage, gespeichert mit der tatsächlichen Zeit (Tests in Task 5 und 7).
3. **Backup zweimal importiert, oder ein altes Backup ohne Energie-Felder:**
   - Keine Einträge doppelt.
   - Die Energie-Daten des Geräts bleiben unverändert (Test in Task 3).
4. **Zeitfenster an der Grenze:** Um 10:59 schlägt der Reset die „Power-Pause“ nicht vor, um 11:00 schon, um 16:00 nicht mehr. Die Bibliothek zeigt sie immer (Tests in Task 4 und 7).
5. **Langes Vorhaben aus einem Wort** (80 Zeichen ohne Leerzeichen): Es bricht im Sprint-Player um; auf 360 px gibt es kein seitliches Scrollen (Test in Task 8).

---

### Task 1: Bereiche und Hack-Katalog mit Texten

**Files:**
- Create:
  - `src/lib/energy/areas.ts`
  - `src/lib/energy/hacks.ts`
  - `content/hacks.json`
- Test: `tests/unit/energy-hacks.test.ts` (neu)

**Interfaces:**
- Produces, in `areas.ts`:
  - `type EnergyArea = 'koerper' | 'gefuehl' | 'geist' | 'sinn'`
  - `type EnergyLevel = 1 | 2 | 3 | 4 | 5`
  - `AREAS: readonly EnergyArea[]` (feste Reihenfolge)
  - `AREA_INFO: Record<EnergyArea, { title: string; color: string; question: string }>`
  - `LEVELS: readonly EnergyLevel[]`
  - `LEVEL_WORD: Record<EnergyLevel, string>`
  - `isEnergyArea(v: unknown): v is EnergyArea`
  - `isEnergyLevel(v: unknown): v is EnergyLevel`
- Produces, in `hacks.ts`:
  - **Typen:**
    - `type HackGuide = 'takt' | 'schritte' | 'ring'`
    - `type TaktPhase = 'ein' | 'nach' | 'aus' | 'halten'`
    - `HACK_ICONS` (Liste unten), `type HackIconName = (typeof HACK_ICONS)[number]`
    - `interface HackStep { title: string; detail: string; icon: HackIconName; seconds?: number }`
    - `interface TaktPhaseDef { phase: TaktPhase; seconds: number; say: string }`
    - `type TaktEntry = TaktPhaseDef | { repeat: number; phases: TaktPhaseDef[] }`
    - `interface Hack { id; title; area: EnergyArea; minutes; benefit; guide: HackGuide; steps: HackStep[]; cycle?: TaktEntry[]; why: { from: string; to: string; text: string }; source: string; further: string | null; caution: string | null; window: { from: number; to: number } | null; link: { kind: 'breath'; id: BreathPatternId } | null }`
  - **Funktionen:**
    - `HACKS: readonly Hack[]` (aus der JSON-Datei)
    - `hackProblems(raw: unknown): string[]` (leer = gültig, Regeln aus Spec §5.1)
    - `hackById(id: string): Hack | null`
    - `hacksIn(area: EnergyArea): Hack[]` (Katalog-Reihenfolge)
    - `hackLength(h: Hack): number` (Sekunden)
    - `taktPhases(h: Hack): TaktPhaseDef[]` (ein Zyklus, Gruppen aufgelöst)
    - `taktAt(h: Hack, elapsed: number): { phase: TaktPhase; say: string; round: number; rounds: number; cycleProgress: number; level: number }`
    - `taktShape(h: Hack): { phase: TaktPhase; seconds: number; from: number; to: number }[]`
    - `stepAt(h: Hack, elapsed: number): { index: number; remaining: number }`
    - `stepBoundaries(h: Hack): number[]` (Sekunden der Schrittwechsel ohne 0, nur bei `schritte`)
    - `inWindow(h: Hack, now: Date): boolean`
- `HACK_ICONS`: `['einatmen', 'nachatmen', 'ausatmen', 'halten', 'bewegung', 'gehen', 'sonne', 'wasser', 'liegen', 'stift', 'herz', 'auge', 'handy-weg', 'kompass', 'stern', 'pfeil', 'frage']`

- [ ] **Step 1: Failing tests** in `tests/unit/energy-hacks.test.ts`:
  - **„der Katalog hat 16 gültige Hacks, je 4 pro Bereich“:**
    - `HACKS.length === 16`.
    - Für jeden Bereich `hacksIn(a).length === 4`.
    - `hackProblems(h)` ist für jeden Hack `[]`.
    - Die Kennungen sind genau die 16 aus Spec §4, in dieser Reihenfolge.
  - **„hackProblems meldet Fehler“:**
    - Je ein nicht leeres Ergebnis für: Schritt-Summe ≠ `minutes × 60` bei `schritte`, ein Schritt unter 10 s, `area: 'mut'`, `minutes: 0` und `11`, leere `source`, Takt mit nur einer Phase, Phase 0,4 s oder 31 s, `link` auf `'gibtsnicht'`, `icon: 'blitz'`, `window: { from: 17, to: 7 }`.
  - **„Seufzer: Takt 2 + 1 + 5 s“:**
    - `taktPhases(seufzer)` ergibt `[ein 2, nach 1, aus 5]`, `hackLength` ist `64` (8 Runden).
    - `taktAt(seufzer, 0)`: `phase: 'ein'`, `round: 1`, `rounds: 8`.
    - `taktAt(seufzer, 2.5)`: `phase: 'nach'`.
    - `taktAt(seufzer, 9)`: `phase: 'ein'`, `round: 2`.
    - `taktShape(seufzer)`: `ein` von 0 auf 0.8, `nach` von 0.8 auf 1, `aus` von 1 auf 0.
  - **„Wach-Atmung: Gruppe mit Wiederholung“:**
    - `taktPhases(wachAtmung)` löst `{ repeat, phases }` in Einzelphasen auf.
    - Die Zyklusdauer ist die Summe.
    - Die Runden sind `max(1, round(60 / Zyklus))`.
  - **„Schritte“:**
    - Für `bewegungs-snack` (4 × 30 s) ergibt `stepBoundaries` `[30, 60, 90]`.
    - `stepAt(h, 0)` ist `{ index: 0, remaining: 30 }`, `stepAt(h, 45)` ist `{ index: 1, remaining: 15 }`, `stepAt(h, 200)` ist `{ index: 3, remaining: 0 }`.
  - **„Ring“:** `hackLength(kopfLeeren) === 180`, `stepBoundaries(kopfLeeren)` ist `[]`.
  - **„Zeitfenster“:**
    - `power-pause`: `inWindow` ist um 10:59 `false`, um 11:00 `true`, um 15:59 `true`, um 16:00 `false`.
    - `seufzer` ist immer im Fenster.
  - **„Geist-Hacks nennen Hildebrandt“:** Alle vier Geist-Hacks haben `further === 'Henry Hildebrandt, Brainhacks (2025)'`, alle anderen `null`.
  - **„Seufzer verweist auf die Atemübung“:** `seufzer.link` ist `{ kind: 'breath', id: 'seufzer' }`.
- [ ] **Step 2:** `npx vitest run tests/unit/energy-hacks.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** `areas.ts` und `hacks.ts` (Signaturen oben). Für `taktShape` gilt:
  - Einen Pegel 0…1 je Phase: `ein` endet bei 0,8, wenn `nach` folgt, sonst bei 1.
  - `nach` endet bei 1, `aus` bei 0, `halten` behält den Pegel.
  - `taktAt.level` interpoliert innerhalb der Phase mit `0.5 − cos(π·t)/2`.
- [ ] **Step 4: `content/hacks.json` schreiben.** 16 Hacks nach Spec §4 und §5.1, Texte in eigenen Worten, Du-Form:
  - `benefit` ein Satz.
  - Je Hack 2–4 Schritte, jeder mit `title` (höchstens 4 Wörter) und `detail` (höchstens 12 Wörter).
  - `why.text` 2–3 Sätze, die vorsichtig formulieren („kann“, „hilft vielen“), ohne Heilversprechen.
  - Sicherheitshinweise (`caution`) für `wach-atmung` und `kaltes-gesicht` wie in Spec §4.
  - Takt-Werte:
    - `seufzer`: ein 2, nach 1, aus 5.
    - `wach-atmung`: Gruppe 15 × (ein 1,5 + aus 1,5), dann `aus` 1 „Ausatmen …“ und `halten` 14 „Halten …“.
  - Quellen wie in Spec §4. Eine Angabe, die sich nicht sicher bestätigen lässt, wird allgemeiner formuliert, nie erfunden.
- [ ] **Step 5:** dieselben Tests plus `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 6: Freigabe durch den Nutzer (Spec §4).**
  - Der Controller zeigt alle 16 Karten lesbar, als Artifact-Seite in der Optik der Hack-Karte (Entwurf A).
  - Er wartet auf die Freigabe und arbeitet Änderungswünsche in `content/hacks.json` ein (Tests erneut grün).
  - Ohne Freigabe geht es nicht weiter.
- [ ] **Step 7: Commit** `feat: Energie-Bereiche und Hack-Katalog mit 16 Karten`.

### Task 2: Fünf Motive malen, wählen und eintragen

Controller-Aufgabe (Connector und Auswahl durch den Nutzer); nicht an einen Subagenten geben.

**Files:**
- Create: `public/images/motive/energie-koerper.webp`, `energie-gefuehl.webp`, `energie-geist.webp`, `energie-sinn.webp`, `fokus.webp`
- Modify:
  - `content/motive.json` (fünf Einträge mit Quelle, `crop`, `size`)
  - `src/lib/content/motive.ts`
- Test: `tests/unit/motive.test.ts`

**Interfaces:**
- Consumes: `EnergyArea` (Task 1).
- Produces, in `motive.ts`:
  - die IDs `energie-koerper`, `energie-gefuehl`, `energie-geist`, `energie-sinn`, `fokus` (eigene Gruppe „Energie“ in `IDS`);
  - `areaMotiv(a: EnergyArea): MotivId`;
  - `FOKUS_MOTIV: MotivId`.

- [ ] **Step 1: Failing test** in `motive.test.ts`:
  - „Energie-Motive“: `areaMotiv('geist') === 'energie-geist'`, `FOKUS_MOTIV === 'fokus'`.
  - Die bestehenden Prüfungen (Datei vorhanden, Größe, Budget ≤ 60 KB je Datei, zusammen ≤ 1,5 MB) erfassen die fünf neuen IDs automatisch.
  - Die Zählung im Kopfkommentar und im Test steigt von 43 auf 48.
- [ ] **Step 2:** `npx vitest run tests/unit/motive.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Erzeugen** (README „Motive malen“):
  - Gruppe A: `energie-koerper` „a gentle rising sun over a soft rounded hill“, `energie-gefuehl` „a watercolor heart holding a soft wave“, `energie-geist` „a clear faceted crystal with fine light rays“.
  - Gruppe B: `energie-sinn` „a compass with a small guiding star“, `fokus` „an hourglass with fine flowing sand“, als dritten Platz „a single small leaf“ (wird nicht verwendet).
  - Je Gruppe ein Aufruf `creative_generate_image` mit `gpt-image-2.5-sunburst` und den Standard-Varianten. Prompt aus `content/motive.json` (`prompt`, `style`, Hintergrund `#1B2350`).
- [ ] **Step 4: Auswahl:** Eine Artifact-Seite zeigt alle Varianten je Gruppe; der Nutzer wählt je Gruppe eine.
- [ ] **Step 5: Freistellen:**
  - `python3 scripts/freistellen.py <quelle.png> public/images/motive/<id>.webp --crop x,y,b,h --size 192` je Motiv.
  - Dann IDs, `areaMotiv` und `FOKUS_MOTIV` in `motive.ts` sowie die Einträge in `content/motive.json`.
- [ ] **Step 6:** `npx vitest run tests/unit/motive.test.ts` und `npm run check`, erwartet: PASS.
- [ ] **Step 7: Commit** `feat: fünf Energie-Motive`.

### Task 3: Check-ins, Hack-Läufe und Sprints speichern, laden, sichern

**Files:**
- Modify:
  - `src/lib/stats/schema.ts`
  - `src/lib/stats/persist.ts`
  - `src/lib/stats/backup.ts`
  - `src/lib/stats/store.svelte.ts`
  - `src/lib/ui/ich-view.ts` (`importMessage`)
  - `src/screens/Ich.svelte` (Aufruf von `importMessage`)
- Create:
  - `src/lib/energy/record.ts`
  - `src/lib/energy/insights.ts` (zunächst nur `BEFORE_HOURS` und `beforeLevel`; Task 4 ergänzt die Datei)
- Test:
  - `tests/unit/stats-schema.test.ts`
  - `tests/unit/stats-persist.test.ts`
  - `tests/unit/stats-backup.test.ts`
  - `tests/unit/ich-view.test.ts`
  - `tests/unit/energy-record.test.ts` (neu)

**Interfaces:**
- Consumes: `EnergyArea`, `EnergyLevel`, `isEnergyArea`, `isEnergyLevel` (Task 1), `hackById` (Task 1).
- Produces, in `schema.ts`:
  - `interface EnergyCheckin { id: string; at: string; levels: Record<EnergyArea, EnergyLevel> }`
  - `interface HackRun { id: string; at: string; hack: string; area: EnergyArea; seconds: number; before?: EnergyLevel; after?: EnergyLevel }`
  - `FOCUS_MINUTES = [25, 50, 90] as const`, `type FocusMinutes = (typeof FOCUS_MINUTES)[number]`
  - `interface FocusSprint { id: string; at: string; planned: FocusMinutes; seconds: number; task?: string }`
  - `MAX_TASK_LENGTH = 80`
  - `type ResultKind = SessionKind | 'hack' | 'focus'`
  - `SessionResult.kind: ResultKind`, `SessionResult.note?: string`
  - `Settings.focus: { minutes: FocusMinutes; sound: BackgroundId | null }`
  - `AppData.energyCheckins?`, `AppData.hackRuns?`, `AppData.focusSprints?`
- Produces, in `persist.ts`:
  - `withCheckin(data: AppData, checkin: EnergyCheckin): AppData`
  - `withHackRun(data: AppData, run: HackRun): AppData`
  - `withFocusSprint(data: AppData, sprint: FocusSprint): AppData`
  - `withHackEffect(data: AppData, runId: string, which: 'before' | 'after', level: EnergyLevel | null): AppData | null`
- Produces, in `record.ts`:
  - `MIN_HACK_SECONDS = 30`, `MIN_SPRINT_SECONDS = 300`
  - `hackRunFrom(r: SessionResult, id: string, checkins: readonly EnergyCheckin[]): HackRun | null`. Bereich aus dem Katalog; `before` über `beforeLevel`.
  - `focusSprintFrom(r: SessionResult, id: string): FocusSprint | null` (`planned` aus `ref`, `task` aus `note`, getrimmt, gekürzt, leer entfällt)
- Produces, in `store.svelte.ts`:
  - `recordResult(r: SessionResult): string | null` (leitet nach `r.kind` weiter; Sitzungen wie bisher über `withSession`)
  - `saveCheckin(levels: Record<EnergyArea, EnergyLevel>): void`
  - `setHackEffect(runId: string, which: 'before' | 'after', level: EnergyLevel | null): void`
  - `importBackup(text)` liefert `{ added: number; addedEnergy: number } | { error: string }`
- Produces, in `backup.ts`: `mergeBackup` liefert zusätzlich `addedEnergy` (neue Check-ins + Läufe + Sprints).
- Produces, in `insights.ts`:
  - `BEFORE_HOURS = 2`
  - `beforeLevel(c: readonly EnergyCheckin[], area: EnergyArea, start: Date): EnergyLevel | null` (jüngster Check-in vor oder bei `start`, höchstens 2 Std. davor)
- Produces, in `ich-view.ts`: `importMessage(added: number, addedEnergy = 0): string`

- [ ] **Step 1: Failing tests:**
  - **`stats-schema.test.ts`:**
    - „Energie-Felder werden einzeln geprüft“: Ein Check-in ohne `sinn`, mit Stufe 6, mit `at: 'gestern'` oder mit leerer `id` entfällt; die übrigen Einträge, Sitzungen und Einstellungen bleiben.
    - Ein Lauf mit unbekanntem Hack bleibt erhalten.
    - Ein Lauf mit `before: 7` behält alles außer `before`.
    - Ein Sprint mit `planned: 30` entfällt; ein `task` mit 120 Zeichen wird auf 80 gekürzt.
    - Leere Listen fehlen im Ergebnis.
    - „settings.focus“: fehlt oder ist ungültig (`minutes: 40`, `sound: 'gibtsnicht'`) → `{ minutes: 50, sound: 'kaffee-und-notizen' }`; `sound: null` bleibt `null`.
  - **`energy-record.test.ts`:**
    - „Hack-Lauf ab 30 s“: `{ kind: 'hack', ref: 'seufzer', seconds: 29.9 }` ergibt `null`.
    - `seconds: 64.7` ergibt `seconds: 64`, `area: 'gefuehl'`.
    - Unbekannter `ref` ergibt `null`.
    - „Vorher aus dem Check-in“:
      - Check-in 1 Std. 59 Min vor dem Start mit `gefuehl: 2` ergibt `before: 2`.
      - 2 Std. 1 Min davor ergibt kein `before`.
      - Ein Check-in nach dem Start zählt nicht.
      - Bei mehreren gilt der jüngste vor dem Start.
    - „Sprint ab 300 s“: `seconds: 299` ergibt `null`.
    - `ref: 'focus-90'`, `note: '  Kurskonzept  '`, `seconds: 3000.4` ergibt `planned: 90`, `task: 'Kurskonzept'`, `seconds: 3000`.
    - `note: '   '` ergibt kein `task`; `ref: 'focus-40'` ergibt `null`.
  - **`stats-persist.test.ts`:**
    - `withHackEffect` setzt und entfernt (`null`) Werte; eine unbekannte ID ergibt `null`.
    - `withCheckin`, `withHackRun` und `withFocusSprint` hängen an und lassen `sessions` unverändert.
  - **`stats-backup.test.ts`:**
    - „Energie im Backup“: Export enthält die drei Listen; Import fügt nur unbekannte IDs hinzu, `addedEnergy` zählt sie.
    - Zweimal importiert bleibt `addedEnergy` beim zweiten Mal 0, nichts doppelt.
    - Ein altes Backup ohne Energie-Felder lässt die Energie-Daten des Geräts unverändert.
  - **`ich-view.test.ts`:**
    - `importMessage(3, 0) === '3 neue Sitzungen importiert.'`
    - `importMessage(1, 1) === '1 neue Sitzung importiert. Dazu 1 neuer Energie-Eintrag.'`
    - `importMessage(0, 5) === '0 neue Sitzungen importiert. Dazu 5 neue Energie-Einträge.'`
- [ ] **Step 2:** `npx vitest run tests/unit/stats-schema.test.ts tests/unit/stats-persist.test.ts tests/unit/stats-backup.test.ts tests/unit/ich-view.test.ts tests/unit/energy-record.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:**
  - Signaturen oben; die Prüfung folgt dem Muster von `parseSession` / `parseCustomPattern`.
  - `recordSession` bleibt für die bestehenden Aufrufer.
  - `main.ts` ruft in Task 5 `recordResult`.
- [ ] **Step 4:** dieselben Tests, `npm test` und `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 5: Commit** `feat: Energie-Daten speichern, prüfen und sichern`.

### Task 4: Auswertung und Jetzt-Reset

**Files:**
- Create: `src/lib/energy/reset.ts`
- Modify: `src/lib/energy/insights.ts` (aus Task 3)
- Test:
  - `tests/unit/energy-insights.test.ts` (neu)
  - `tests/unit/energy-reset.test.ts` (neu)

**Interfaces:**
- Consumes: Typen aus Task 1 und Task 3, `dayKey` (`src/lib/stats/summary.ts`), `tageszeit` (`src/lib/time/tageszeit.ts`).
- Produces, in `insights.ts` (zusätzlich zu `BEFORE_HOURS` und `beforeLevel` aus Task 3):
  - **Konstanten:** `FRESH_HOURS = 3`, `PATTERN_MIN = 7`
  - **Check-ins:**
    - `latestCheckin(c: readonly EnergyCheckin[]): EnergyCheckin | null`
    - `freshCheckin(c, now: Date): EnergyCheckin | null`
    - `weakestArea(levels: Record<EnergyArea, EnergyLevel>): EnergyArea`
    - `headerLine(c, now): string` (Kopfzeile, Global Constraints)
  - **Wirkung:**
    - `hackStats(runs: readonly HackRun[]): Map<string, { rated: number; mean: number | null; lastAt: string | null }>`
    - `whatWorks(runs): { hack: Hack; mean: number; rated: number }[]`
    - `effectLabel(mean: number): string` („+1,2 Stufen“, „+1 Stufe“)
    - `WHAT_WORKS_HINT: string`
  - **Wochenraster:** `weekGrid(c, now): { key: string; short: string; long: string; cells: Record<EnergyArea, number | null> }[]` (7 Einträge, ältester zuerst; `short` „Mo“…„So“, `long` „Montag“…)
    - `cellLevel(mean: number): EnergyLevel` (gerundet)
    - `cellLabel(area, long: string, mean: number | null): string` („Geist, Dienstag: 2,5 von 5“ / „Geist, Dienstag: kein Check-in“)
  - **Muster:**
    - `hasPatternData(c, now): boolean`
    - `patternSentences(c, now): string[]`
    - `PATTERN_HINT: string`
  - **Fokus:** `focusLine(s: readonly FocusSprint[], now): string | null`
- Produces, in `reset.ts`:
  - `resetOrder(area: EnergyArea, runs, now): Hack[]`
  - `resetSequence(levels: Record<EnergyArea, EnergyLevel> | null, start: EnergyArea, runs, now): { area: EnergyArea; hack: Hack }[]`: Mit Stufen sind die Bereiche aufsteigend nach Stufe geordnet (Gleichstand: feste Reihenfolge), und `start` wird nicht beachtet. Ohne Stufen gilt die feste Reihenfolge ab `start`. Die Oberfläche zeigt Eintrag `skip % length`.
  - `pauseSuggestion(planned: FocusMinutes, checkins, runs, now): Hack`

- [ ] **Step 1: Failing tests** in `energy-insights.test.ts`:
  - **„frisch“:** Ein Check-in von 23:30 ist am Folgetag um 1:00 frisch, um 2:31 nicht mehr. `headerLine` um 1:00 ist „Noch kein Check-in heute“; um 23:45 desselben Tages „Letzter Check-in vor 15 Min“; nach 2 Std. 10 Min „Letzter Check-in vor 2 Std.“.
  - **„weakestArea bei Gleichstand nach Reihenfolge“:** `{koerper 3, gefuehl 2, geist 2, sinn 4}` ergibt `gefuehl`.
  - **„whatWorks“:**
    - Hack A mit Wirkungen +2, +1 (Schnitt 1,5) vor Hack B mit +1, +1, +1 (Schnitt 1).
    - Hack C mit nur einem bewerteten Lauf fehlt; Hack D mit Schnitt 0 fehlt.
    - Bei gleichem Schnitt steht der mit mehr bewerteten Läufen vorn.
    - Höchstens 3 Einträge.
    - Läufe mit unbekanntem Hack zählen nicht.
    - `effectLabel(1.25) === '+1,3 Stufen'`, `effectLabel(1) === '+1 Stufe'`.
  - **„weekGrid“:**
    - 7 Tage bis heute, beschriftet nach Wochentag.
    - Zwei Check-ins am selben Tag mit Geist 2 und 3 ergeben `2.5`, und `cellLabel` ist „Geist, Dienstag: 2,5 von 5“.
    - Ein Tag ohne Check-in hat `null` und „kein Check-in“.
    - Ein Check-in um 0:30 gehört zum neuen Tag.
    - `cellLevel(2.5) === 3`.
  - **„patternSentences“:**
    - Unter 7 Check-ins in 14 Tagen ist `hasPatternData` `false`.
    - Mit Daten, in denen Geist am niedrigsten ist: `['Am niedrigsten ist zurzeit dein Geist.']` plus ggf. weitere.
    - Tageszeit: Geist nachmittags ≥ 1 Stufe unter den übrigen Zeiten, bei 3 Check-ins nachmittags. Dann steht „Dein Geist ist tagsüber am niedrigsten.“ an erster Stelle, und Satz 1 entfällt.
    - Trend: Körper diese Woche 1,5 Stufen über der Vorwoche, bei je 2 Check-ins, ergibt „Dein Körper liegt diese Woche 1,5 Stufen höher als in der Woche davor.“; 0,5 ergibt „eine halbe Stufe“.
    - Höchstens 2 Sätze.
  - **„focusLine“:** 4 Sprints mit zusammen 200 Min ergeben „Diese Woche: 4 Sprints, 3 Std. 20 Min Fokus“; 1 Sprint mit 25 Min ergibt „Diese Woche: 1 Sprint, 25 Min Fokus“; keiner ergibt `null`.
- [ ] **Step 2: Failing tests** in `energy-reset.test.ts`:
  - **„Reihenfolge im Bereich“:**
    - Gruppe 1 (≥ 2 bewertet, Schnitt > 0, absteigend) vor Gruppe 2 (< 2 bewertet) vor Gruppe 3 (Schnitt ≤ 0).
    - Gleichstand: zuerst der am längsten nicht gelaufene, nie gelaufen zuerst, dann Katalog-Reihenfolge.
  - **„Zeitfenster“:** `resetOrder('koerper', [], 10:59)` enthält `power-pause` nicht, um 11:00 schon, um 16:00 nicht. Um 6:30 fehlt auch `tageslicht`.
  - **„resetSequence“:**
    - Mit Stufen `{koerper 4, gefuehl 3, geist 1, sinn 3}` beginnt die Folge mit den Geist-Hacks, dann Gefühl, dann Sinn, dann Körper.
    - Ohne Stufen und Start `sinn`: Sinn, Körper, Gefühl, Geist.
  - **„pauseSuggestion“:**
    - Ohne frischen Check-in nach 25 Min `augen-pause`, nach 50 und 90 Min `bewegungs-snack`.
    - Mit frischem Check-in (Geist 1, Körper 3) der erste Geist-Hack der Reihenfolge.
    - Fällt der Hack aus dem Zeitfenster, kommt der nächste der Reihenfolge.
- [ ] **Step 3:** `npx vitest run tests/unit/energy-insights.test.ts tests/unit/energy-reset.test.ts`, erwartet: FAIL.
- [ ] **Step 4: Implementieren** (Signaturen oben, Regeln aus Spec §6.2–§6.7):
  - Tageszeiten über `tageszeit()` (morgen → „morgens“, tag → „tagsüber“, abend → „abends“).
  - Trend gerundet auf halbe Stufen: 0,5 ergibt „eine halbe Stufe“, 1 ergibt „1 Stufe“, sonst „{x} Stufen“ mit Komma.
- [ ] **Step 5:** dieselben Tests plus `npm test` und `npm run check`, erwartet: PASS.
- [ ] **Step 6: Commit** `feat: Energie-Auswertung und Jetzt-Reset`.

### Task 5: Programme `hack` und `focus` in der Engine

**Files:**
- Create: `src/lib/audio/cue.ts`
- Modify:
  - `src/lib/audio/program.ts`
  - `src/lib/audio/program-run.ts`
  - `src/lib/ui/player-state.ts`
  - `src/lib/ui/session-ui.svelte.ts`
  - `src/main.ts`
- Test:
  - `tests/browser/program.test.ts`
  - `tests/unit/session-wiring.test.ts`
  - `tests/unit/energy-start.test.ts` (neu)

**Interfaces:**
- Consumes:
  - `Hack`, `hackLength`, `stepBoundaries`, `hackById` (Task 1)
  - `FocusMinutes`, `ResultKind`, `recordResult` (Task 3)
  - `END_STRIKES`, `TIMER_TAIL` (`timer-plan.ts`)
- Produces, in `cue.ts`: `scheduleCue(ctx: BaseAudioContext, destination: AudioNode, when: number): OscillatorNode` (Sinus 660 Hz, 0,25 s, Hüllkurve mit Spitze 0,08, 20 ms Anstieg)
- Produces, in `program.ts`:
  - `ProgramSpec.kind: 'timer' | 'breath' | 'hack' | 'focus'`
  - `ProgramSpec.note?: string`
  - `HACK_TAIL = 8`
  - `hackProgram(h: Hack): ProgramSpec`:
    - `ref = h.id`, `title = h.title`, `lead = 0`, `length = hackLength(h)`, `finish = length + HACK_TAIL`, kein Hintergrund, `assets: ['strike']`.
    - Hinweistöne an `stepBoundaries`, eine Klangschale bei `length`.
  - `focusProgram(minutes: FocusMinutes, sound: BackgroundId | null, task: string): ProgramSpec`:
    - `ref = \`focus-${minutes}\``, `title = \`Fokus-Sprint · ${minutes} Min\``, `lead = 0`, `length = minutes × 60`, `finish = length + TIMER_TAIL`.
    - Schalen `END_STRIKES` ab `length`, `note = task`.
- Produces, in `program-run.ts`:
  - `ProgramSnapshot.kind` umfasst `hack` und `focus`.
  - Das Ergebnis trägt `note` aus der Spec.
  - `noBowl` gilt, wenn die Spec `strike` verlangt und sie fehlt.
- Produces, in `player-state.ts`: `PlayerKind` umfasst `hack` und `focus`; beide in `KINDS`.
- Produces, in `session-ui.svelte.ts`:
  - `SessionDoneInfo.kind: ResultKind`
  - `doneInfoFor(r: SessionResult, id: string | null): SessionDoneInfo | null` (für `hack` und `focus` ohne ID `null`, sonst wie bisher)
  - `startHack(id: string): void`
  - `startSprint(minutes: FocusMinutes, task: string, sound: BackgroundId | null): void` (speichert `settings.focus`, startet im Tipp wie `startSession`)

- [ ] **Step 1: Failing tests:**
  - **`program.test.ts`:**
    - „hackProgram plant Hinweistöne und Schale“: Für `bewegungs-snack` mit gespyten `scheduleCue`/Oszillatoren entstehen Töne bei `t0 + 30`, `60` und `90` und eine Schale bei `t0 + 120`; `finish === 128`.
    - Für `seufzer` entstehen keine Hinweistöne, und `length === 64`.
    - „focusProgram“: `focusProgram(25, 'regen', 'X')` hat `kind 'focus'`, `ref 'focus-25'`, `title 'Fokus-Sprint · 25 Min'`, `lead 0`, `length 1500`, `background 'regen'`, `note 'X'`, Schalen bei 1500, 1503 und 1506.
    - „Ergebnis trägt note“: Ein vorzeitig beendeter Sprint meldet `kind 'focus'` und `note`.
  - **`session-wiring.test.ts`:**
    - `doneInfoFor({ kind: 'hack', … }, null)` ist `null`.
    - Mit ID ergibt es `{ kind: 'hack', sessionId: id, counted: true, … }`.
    - `doneInfoFor({ kind: 'timer', … }, null)` bleibt wie bisher (`counted: false`).
  - **`energy-start.test.ts`:** `startSprint(90, 'Konzept', null)` setzt `settings.focus` auf `{ minutes: 90, sound: null }` und ruft `engine.startProgram` mit `focusProgram(90, null, 'Konzept')` (Engine gemockt).
- [ ] **Step 2:** `npx vitest run tests/unit/session-wiring.test.ts tests/unit/energy-start.test.ts` und `npx vitest run --project browser tests/browser/program.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** (Signaturen oben). `main.ts`: `connectSessions(engine, recordResult, (r, id) => { const info = doneInfoFor(r, id); if (info) sessionUi.done = info })`.
- [ ] **Step 4:** dieselben Tests plus `npm test` und `npm run check`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Programme für Brain Hacks und Fokus-Sprints`.

### Task 6: Reiter „Energie“, Farben, Akku-Karte und Check-in-Blatt

**Files:**
- Create:
  - `src/screens/Energie.svelte`
  - `src/components/energy/AkkuCard.svelte`
  - `src/components/energy/LevelDots.svelte`
  - `src/components/energy/CheckInSheet.svelte`
  - `src/lib/ui/energy-ui.svelte.ts`
  - `tests/e2e/energie.spec.ts`
- Modify:
  - `src/lib/ui/tabs.ts`
  - `src/components/TabBar.svelte`
  - `src/App.svelte`
  - `src/app.css`
  - `tests/unit/theme-contrast.test.ts`
  - `tests/e2e/navigation.spec.ts`
  - `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: Task 1, Task 3 (`saveCheckin`, `stats`), Task 4 (`freshCheckin`, `headerLine`, `weakestArea`).
- Produces:
  - `TabId` mit `'energie'`; `TABS` in der Reihenfolge Heute, Energie, Meditieren, Atmen, Klänge, Ich.
  - CSS-Variablen `--area-koerper`, `--area-gefuehl`, `--area-geist`, `--area-sinn` (Werte aus den Global Constraints, in allen Stimmungen gleich).
  - In `energy-ui.svelte.ts`:
    - `energyUi: { checkInOpen: boolean; hackCard: string | null; resetSkip: number; resetStart: EnergyArea | null }`
    - `openCheckIn()`, `closeCheckIn()`, `openHackCard(id: string)`, `closeHackCard()`
  - `LevelDots.svelte` Props: `{ area: EnergyArea; value: EnergyLevel | null; onPick: (l: EnergyLevel) => void; label?: string }`. Radiogruppe wie `CalmCheckIn`: Pfeiltasten, Pos1 und Ende; Name je Punkt „{Bereich}: {n} von 5, {Wort}“.
  - `AkkuCard.svelte` Props: `{ compact?: boolean; onOpen?: () => void }`.
  - `CheckInSheet.svelte` liegt an der Wurzel von `App.svelte` und ist sichtbar, wenn `energyUi.checkInOpen`.

- [ ] **Step 1: Failing tests:**
  - **`theme-contrast.test.ts`:** „Bereichsfarben als Schrift auf der Karte in jeder Stimmung“: Jede `--area-*` erreicht mindestens 4,5:1 gegen die Kartenfläche über Himmel, Bergen und See, wie der bestehende `--accent`-Test.
  - **`energie.spec.ts`:**
    - „Check-in speichern“: Reiter „Energie“ öffnen, „Wie voll ist dein Akku?“ sichtbar. „Check-in“ öffnet das Blatt; „Speichern“ ist gesperrt, bis alle vier Bereiche gesetzt sind. Nach dem Speichern zeigt die Akku-Karte „1 von 5“ für Geist, und `stored(page).energyCheckins` hat einen Eintrag.
    - „Später schließt ohne Speichern“, auch über die Zurück-Geste.
    - Mit vorbereitetem Check-in von 23:30 bei Uhrzeit 1:00 (`page.clock`): Die Kopfzeile sagt „Noch kein Check-in heute“, die Akku-Karte zeigt die vier Akkus (frisch).
  - **`navigation.spec.ts`:** sechs Reiter in der Reihenfolge der Global Constraints.
  - **`shell.spec.ts` (360 px):** Alle sechs Beschriftungen passen (`scrollWidth <= clientWidth`), jede Tippfläche ist mindestens 48 px hoch, kein seitliches Scrollen.
- [ ] **Step 2:** `npx vitest run tests/unit/theme-contrast.test.ts` und `npx playwright test tests/e2e/energie.spec.ts tests/e2e/navigation.spec.ts tests/e2e/shell.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:**
  - **Reiterleiste:**
    - Blitz-Symbol im Stil der übrigen Linien-Symbole.
    - Unter 380 px Breite bekommen die Beschriftungen 11 px (`0.6875rem`).
  - **`Energie.svelte`:** zunächst Kopf und Akku-Karte; die übrigen Abschnitte kommen in Task 7 und 8.
  - **Check-in-Blatt:**
    - Basiert auf `Sheet.svelte` mit vier `LevelDots`.
    - Jede Zeile startet leer.
    - „Speichern“ ruft `saveCheckin` und schließt.
    - Zurück-Geste, „Später“ und Tippen daneben schließen ohne Speichern.
    - Ein Reiterwechsel schließt das Blatt.
- [ ] **Step 4:** dieselben Tests plus `npm test`, `npm run check` und die bestehenden E2E-Dateien, die Reiter zählen oder anklicken (`npx playwright test`), erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Reiter Energie mit Akku und Check-in`.

### Task 7: Jetzt-Reset, Bibliothek, Hack-Karte und Hack-Player

**Files:**
- Create:
  - `src/components/energy/ResetCard.svelte`
  - `src/components/energy/HackLibrary.svelte`
  - `src/components/energy/HackCard.svelte`
  - `src/components/energy/HackIcon.svelte`
  - `src/components/player/HackPlayer.svelte`
  - `src/components/player/TaktCurve.svelte`
  - `src/components/player/HackEffect.svelte`
- Modify:
  - `src/screens/Energie.svelte`
  - `src/components/player/PlayerShell.svelte` (optionaler Snippet `doneView`)
  - `src/App.svelte`
- Test: `tests/e2e/energie.spec.ts`

**Interfaces:**
- Consumes:
  - Task 1 (`taktAt`, `taktShape`, `stepAt`, `HACK_ICONS`)
  - Task 2 (`areaMotiv`)
  - Task 3 (`setHackEffect`)
  - Task 4 (`resetSequence`, `whatWorks`, `freshCheckin`)
  - Task 5 (`startHack`, `runningProgram('hack')`, `doneOf('hack')`)
  - Task 6 (`energyUi`, `LevelDots`)
- Produces:
  - `PlayerShell` Prop `doneView?: Snippet`; ist er gesetzt, zeigt der Abschluss ihn statt `SessionDone`.
  - `HackIcon.svelte` Props `{ name: HackIconName; size?: number }`: Linien-Symbole, `aria-hidden`, für jedes Element von `HACK_ICONS`.

- [ ] **Step 1: Failing tests** in `energie.spec.ts`:
  - **„Reset schlägt den schwächsten Bereich vor“:** Check-in mit Geist 1 und den übrigen Bereichen bei 3. Die Reset-Karte zeigt „Dein Geist ist gerade am niedrigsten.“ und einen Geist-Hack. „Anderer“ zeigt einen anderen Hack; nach den vier Geist-Hacks folgt ein Hack des nächstschwächsten Bereichs.
  - **„Reset ohne frischen Check-in“:** „Was braucht gerade Energie?“; ein Tipp auf „Körper“ zeigt einen Körper-Hack. Um 10:59 (`page.clock`) erscheint die „Power-Pause“ beim Durchblättern mit „Anderer“ nicht.
  - **„Bibliothek mit Filter“:** 16 Kacheln; Filter „Sinn“ zeigt 4. Die „Power-Pause“ ist um 10:59 in der Bibliothek vorhanden.
  - **„Hack-Karte“:** Ein Tipp auf „Physiologischer Seufzer“ öffnet die Karte mit „So geht’s“, drei Schritten, „Warum es wirkt“, „Quelle: …“, „Passt dazu: Atemübung …“ und „Starten · 1:04“. „Passt dazu“ schließt die Karte und öffnet „Atmen“.
  - **„Takt-Hack bis zum Ende“:**
    - `seufzer` mit `page.clock` vorgespult: Der Player zeigt „Runde 1 von 8“ und die Anweisung „Tief einatmen …“.
    - Am Ende kommen „Geschafft“ und „Gefühl jetzt?“ (frischer Check-in mit Gefühl liegt vor, also nur eine Reihe).
    - Ein Tipp auf 4 und „Fertig“ speichert einen Lauf mit `before` aus dem Check-in und `after: 4`.
  - **„Schritte-Hack ohne Check-in“:** `bewegungs-snack` zeigt „Schritt 1 von 4“, nach 30 s „Schritt 2 von 4“; am Ende stehen zwei Reihen „vorher“ und „jetzt“.
  - **„Früh beendet“:**
    - Nach 10 s „Beenden“ und Bestätigen: Der Player schließt ohne „Geschafft“, und `hackRuns` bleibt leer.
    - Nach 40 s: „Geschafft“, und der Lauf hat `seconds` 40 (±1).
  - **„Doppeltipp auf Starten“** landet nicht auf „Beenden“ (wie `timer.spec.ts`).
  - **„Noch einmal“** startet denselben Hack neu.
- [ ] **Step 2:** `npx playwright test tests/e2e/energie.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren:**
  - **Hack-Karte (Entwurf A, Spec §3.4):** Sheet an der Wurzel von `App.svelte`, sichtbar bei `energyUi.hackCard`. „Starten“ schließt die Karte und ruft `startHack`.
  - **Motive (`alt=""`):** Bereichs-Motiv auf der Hack-Karte 96 px, auf der Reset-Karte 72 px, auf den Kacheln 40 px.
  - **„wirkt bei dir“** auf Reset-Karte und Kachel, wenn der Hack unter `whatWorks` ist.
  - **Hack-Player (Entwurf B, Spec §3.5), auf `PlayerShell` mit Dialogname „Brain Hack“:**
    - Bei `takt` zeichnet `TaktCurve` einen Zyklus aus `taktShape` als SVG-Pfad und den Punkt nach `taktAt(…, programClock.elapsed)`.
    - Bei `schritte` stehen der Schritt groß und die Restzeit des Schritts da. Beim Wechsel vibriert es 60 ms, wenn die Vibration an und die Seite sichtbar ist.
    - Bei `ring` zeigen `ProgressDial` und die Schrittliste den Stand.
    - Die Anweisung bzw. der Schritt steht in einem Element mit `aria-live="polite"`.
    - „Warum es wirkt“ lässt sich im Player aufklappen (Knopf mit `aria-expanded`).
    - Am Ende vibriert es 200 ms, wenn die Vibration an ist.
  - **`HackEffect` als `doneView`:**
    - Mit `before` im gespeicherten Lauf erscheint eine Reihe „{Bereich} jetzt?“, sonst zwei Reihen.
    - Ein Tipp speichert sofort über `setHackEffect`; derselbe Punkt nimmt ihn zurück.
    - „Fertig“ ruft `clearDone`; „Noch einmal“ ruft `startHack(ref)`.
- [ ] **Step 4:** dieselben Tests plus `npm test`, `npm run check` und `npx playwright test`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Jetzt-Reset, Hack-Bibliothek, Hack-Karte und Hack-Player`.

### Task 8: Fokus-Sprint und „Deine Woche“

**Files:**
- Create:
  - `src/components/energy/SprintCard.svelte`
  - `src/components/player/SprintPlayer.svelte`
  - `src/components/energy/WeekCard.svelte`
- Modify:
  - `src/screens/Energie.svelte`
  - `src/App.svelte`
- Test: `tests/e2e/energie.spec.ts`

**Interfaces:**
- Consumes:
  - Task 2 (`FOKUS_MOTIV`)
  - Task 3 (`settings.focus`, `focusSprints`)
  - Task 4 (`pauseSuggestion`, `weekGrid`, `cellLevel`, `cellLabel`, `hasPatternData`, `patternSentences`, `PATTERN_HINT`, `focusLine`, `whatWorks`, `effectLabel`, `WHAT_WORKS_HINT`)
  - Task 5 (`startSprint`, `startHack`)
  - Task 6 (`openCheckIn`)
  - `SoundSelect.svelte` (bestehend)

- [ ] **Step 1: Failing tests** in `energie.spec.ts`:
  - **„Sprint mit gemerkter Wahl“:**
    - Standard „50 Min“ und Hintergrund „Kaffee & Notizen“ sind gewählt.
    - Wähle „25 Min“, „Regen“ und das Vorhaben „Kurskonzept“, dann „Sprint starten“.
    - Der Player zeigt „Kurskonzept“ und „25:00“.
    - Mit `page.clock` bis zum Ende: „Sprint geschafft“, „25 Min Fokus“ und der Pausen-Vorschlag „Augen-Pause“.
    - „Fertig“ schließt; `focusSprints` hat `planned: 25`, `task: 'Kurskonzept'`, und `settings.focus` ist `{ minutes: 25, sound: 'regen' }`.
  - **„Sprint unter 5 Minuten“:** Nach 2 Min beenden: kein Eintrag, kein „Sprint geschafft“.
  - **„Pausen-Vorschlag starten“:** „Starten“ unter „Pausen-Vorschlag“ startet die „Augen-Pause“.
  - **„Check-in nach dem Sprint“:** „Check-in“ schließt den Player und öffnet das Check-in-Blatt.
  - **„Langes Vorhaben auf 360 px“:** 80 Zeichen ohne Leerzeichen: Der Text bricht im Player um, und die Seite scrollt nicht seitlich.
  - **„Deine Woche mit Daten“:** Vorbereitete Daten (8 Check-ins in 10 Tagen, Geist meist 1–2; drei Hacks mit je zwei Bewertungen; 2 Sprints).
    - Das Raster hat 28 Felder mit Namen wie „Geist, {Wochentag}: … von 5“.
    - „Am niedrigsten ist zurzeit dein Geist.“ ist sichtbar.
    - „Was bei dir wirkt“ listet drei Einträge mit „+… Stufen“.
    - Die Fokus-Zeile beginnt mit „Diese Woche: 2 Sprints“.
    - Die Kachel des besten Hacks in der Bibliothek zeigt „wirkt bei dir“.
  - **„Deine Woche leer“:** gestrichelte Felder, `PATTERN_HINT` und `WHAT_WORKS_HINT` sichtbar, keine Fokus-Zeile.
- [ ] **Step 2:** `npx playwright test tests/e2e/energie.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** (Spec §3.2 Punkt 4 und 6, §3.6, §6.4–§6.7):
  - **Sprint-Player** auf `PlayerShell` mit Dialogname „Fokus-Sprint“ und `doneView` für das Ende; Motiv `FOKUS_MOTIV` auf Sprint-Karte und Player 72 px (`alt=""`).
  - **Ende des Sprints:** „Check-in“ ruft erst `clearDone`, dann `openCheckIn`.
  - **Raster:** CSS-Grid mit 8 Spalten (Bereichsname plus 7 Tage).
    - Deckkraft der Bereichsfarbe 0,2 / 0,4 / 0,6 / 0,8 / 1,0 nach `cellLevel`.
    - Ohne Wert gestrichelter Rahmen.
    - Jedes Feld `role="img"` mit `aria-label` aus `cellLabel`.
- [ ] **Step 4:** dieselben Tests plus `npm test`, `npm run check` und `npx playwright test`, erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Fokus-Sprint und Wochenmuster`.

### Task 9: Karte auf „Heute“, README, Haupt-Spec, Gesamtprüfung

**Files:**
- Modify:
  - `src/screens/Heute.svelte`
  - `README.md`
  - `docs/superpowers/specs/2026-10-21-ruhe-design.md`
  - `tests/e2e/heute.spec.ts`
  - `tests/e2e/karten.spec.ts` (falls er Karten auf „Heute“ zählt)

**Interfaces:**
- Consumes: `AkkuCard` mit `compact` (Task 6), `freshCheckin`, `weakestArea` (Task 4), `openCheckIn` (Task 6), `onNavigate` von „Heute“.

- [ ] **Step 1: Failing tests** in `heute.spec.ts`:
  - **„Akku-Karte ohne frischen Check-in“:** „Dein Akku“ steht zwischen Begrüßung und „Vorschlag des Tages“ mit „Wie voll ist dein Akku?“. „Check-in“ öffnet das Blatt direkt auf „Heute“.
  - **„Akku-Karte mit frischem Check-in“:** vier Akkus und „Geist am niedrigsten · Jetzt-Reset“; Tippen öffnet den Reiter „Energie“.
  - **Unverändert:** Die übrigen Karten von „Heute“ bleiben, die bestehenden Tests laufen weiter.
- [ ] **Step 2:** `npx playwright test tests/e2e/heute.spec.ts`, erwartet: FAIL.
- [ ] **Step 3: Implementieren** (Spec §3.7).
- [ ] **Step 4: README:**
  - **„Handy-Checkliste Meilenstein 9“** (Spec §10) vor „Handy-Checkliste Balance“.
  - **„Erinnerungen einrichten“** (Spec §6.8): Uhr- bzw. Wecker-App und Kalender auf Android, wiederkehrend z. B. 9, 13 und 17 Uhr, dazu die App über das Startbildschirm-Symbol öffnen.
  - **„Brain Hacks schreiben“:**
    - Format von `content/hacks.json` (Spec §5.1) und die Freigabe neuer Karten durch den Nutzer.
    - Quellen-Regeln: eigene Worte, Quelle, keine Buchtexte.
    - `npm test` prüft jeden Eintrag.
  - **„Motive malen“:** 48 Motive, neue Zielgröße „Energie 192 px“.
- [ ] **Step 5: Haupt-Spec**, Ergänzung vom 27.10.2026 (Meilenstein 9):
  - In §1 bei den Nicht-Zielen: Das Wochenraster unter „Energie“ ist die einzige Verlaufsgrafik.
  - Bei den Einstellungen: `settings.focus`.
  - Bei den Daten: `energyCheckins`, `hackRuns`, `focusSprints`.
  - Jeweils mit Verweis auf die M9-Spec.
- [ ] **Step 6: Gesamtprüfung:** `npm run check` (0 Fehler), `npm test` (alle grün), `npx playwright test` (alle grün). Ergebnisse mit Zahlen im Ledger festhalten.
- [ ] **Step 7: Commit** `docs: Handy-Checkliste M9, Erinnerungen und Brain-Hack-Format`.
