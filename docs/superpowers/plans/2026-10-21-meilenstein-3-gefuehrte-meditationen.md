# Meilenstein 3: Geführte Meditationen – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neun geführte Meditationen mit eigenem Vollbild-Player (Stimme, ±15 s, Hintergrundklang mit Balance), offline speicherbar, mit „Vorschlag des Tages“ auf „Heute“ – zuerst mit Platzhalter-Audio, am Ende echt vertont über den ElevenLabs-Connector.

**Architecture:** Die Texte liegen als Markdown unter `content/meditations/`; ein Node-Skript zerlegt sie, schätzt Kosten, erzeugt Platzhalter, setzt vertonte Abschnitte zur MP3 zusammen und schreibt das Manifest `src/content/meditations.json`. Die Audio-Engine bekommt eine zweite Sitzungsart neben den Programmen: eine *geführte Sitzung*, deren Zeitbasis das gestreamte `<audio>`-Element der Stimme ist (über `MediaElementAudioSourceNode` im selben Mischpult wie Hintergrundklang und Klangschale). Gezählt wird die tatsächlich gehörte Zeit aus `element.played`. Offline übernimmt der Service Worker mit einem Laufzeit-Cache samt Range-Unterstützung.

**Tech Stack:** wie Meilenstein 2 (Vite 8, Svelte 5 Runes, TypeScript 6, vite-plugin-pwa 2 / Workbox, Vitest 5 Node + Browser Mode, Playwright 1.56.1), Node 22 + ffmpeg/ffprobe für die Skripte, ElevenLabs-Connector (Controller) für die Vertonung.

**Spec:** `docs/superpowers/specs/2026-10-21-ruhe-design.md` – §3.1 (Vorschlag des Tages, Zuletzt genutzt), §3.2 (Katalog), §3.5 („Alle offline speichern“), §3.6 (Player), §4.1 (Stimme, Balance), §4.5 (Media Session: Spulen, Position), §5.1–5.4 (Texte, Vertonung, Platzhalter), §6.2 (Statistik), §6.4 (Balance), §6.5 (Offline), §9, §10. Bei Widersprüchen gilt die Spec – außer bei den unten genannten, vom Nutzer gewollten Änderungen.

**Branch:** `meilenstein-3` (von `main` @ 107aa60). Veröffentlicht wird erst nach dem Merge in `main`.

**Änderungen gegenüber der Spec (Controller-Entscheid, dem Nutzer mitgeteilt):**
- **Vertonung über den ElevenLabs-Connector** statt über ein Skript mit `ELEVENLABS_API_KEY`: Der Controller erzeugt Casting-Proben und Sprachabschnitte mit dem Connector und legt sie im Abschnitt-Cache ab; das Skript zerlegt, schätzt, setzt zusammen und erzeugt das Manifest. Kein API-Schlüssel, keine Freischaltung von `api.elevenlabs.io` nötig.
- **Meilenstein 4 (Vertonung) wird Teil von Meilenstein 3** (Tasks 10–11): Nach der Freigabe der Texte und der Stimmwahl werden die 9 Meditationen gleich vertont. Bis dahin spielen Platzhalter.
- **Hintergrundklang der geführten Meditation wird gemerkt** (neue Einstellung `guidedSound`, Standard „keiner“) – die Spec sagt dazu nichts; wer einmal „Regen“ wählt, erwartet ihn beim nächsten Mal wieder.

## Global Constraints

- Paketversionen unverändert aus `package.json` (keine neuen Abhängigkeiten; Workbox-Plugins kommen über vite-plugin-pwa). Nie `playwright install` lokal.
- Vite `base` `/ruhe/`; Asset-URLs nur über `assetUrl()`.
- Oberfläche Deutsch, Du-Form; vom Plan vorgegebene Texte wörtlich.
- **Audio-Zeitsteuerung nie über `setTimeout`/`setInterval`/`requestAnimationFrame`.** Programme laufen auf der Audio-Uhr, geführte Sitzungen auf dem Medien-Element; JS-Timer und rAF nur für Anzeige.
- Ein `AudioContext`; Ausgabe direkt an `ctx.destination` plus lautloser Anker (`src/lib/audio/output.ts`, `anchor.ts`) – unverändert lassen.
- **Immer nur eine Sitzung:** Eine geführte Meditation beendet laufende Klänge und Programme; ein Klang oder Programm beendet eine laufende Meditation.
- Persistenz nur unter `localStorage['ruhe.v1']`; jeder Zugriff in `try/catch`. Eine Sitzung zählt ab **60 Sekunden** tatsächlich gehörter Zeit; Pausen und übersprungene Stellen zählen nicht.
- Meditations-Audio: **MP3 mono 64 kbit/s**, Lautheit ca. **−19 LUFS**, True Peak **−1,5 dB**, Dateien `public/audio/meditations/<id>.mp3`; Cache-Name **`ruhe-meditations`**.
- Texte: `[Pause Ns]` = N s Stille (ganze oder halbe Sekunden); Leerzeile zwischen Absätzen ohne Markierung = **3 s** Stille; Klangschale am Anfang und Ende wird automatisch ergänzt. Stil: Du-Form, warm, einfache Sprache, kurze Sätze, **mindestens 40 % Stille**.
- Tippflächen ≥ 48 px, Kontrast WCAG AA, Animationen nur unter `prefers-reduced-motion: no-preference`.
- Logik in reinen `.ts`/`.mjs`-Modulen mit Tests; `*.svelte.ts` bleiben dünn.
- Vor jedem Playwright-Lauf darf kein eigener Preview-Server auf Port 4173 laufen (`ss -ltnp | grep 4173`), sonst testet Playwright einen alten Build.
- Jede Commit-Nachricht endet mit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YFBD4q9VZrxdFh2nUt9NdS
  ```

## Review Focus

1. **Bildschirm gesperrt, Stimme läuft:** das Ende-Ereignis kommt verspätet oder gar nicht, solange JS gedrosselt ist → beim Entsperren stimmt die Anzeige, die Sitzung wird mit der gehörten Zeit gezählt (aus `played`, nicht aus Wanduhr). *(Task 3: `result counts the played ranges, not wall time`)*
2. **Spulen über das Ende oder vor den Anfang**, mehrfaches schnelles Spulen → Position bleibt in `[0, duration]`, übersprungene Stellen zählen nicht, kein Doppel-Ergebnis. *(Task 3: `seeking clamps and skipped parts do not count`)*
3. **Offline und die Meditation ist nur halb gestreamt** (vorher abgebrochen) → sie gilt nicht als gespeichert, der Eintrag ist ausgegraut, Abspielen startet nicht ins Leere. *(Task 4: `a partly streamed file does not count as saved`)*
4. **Speicher voll beim „Alle offline speichern“** → Meldung „Nicht genug Speicherplatz“, bereits Gespeichertes bleibt, die App läuft weiter. *(Task 4: `quota error keeps what was saved and reports it`)*
5. **Datei lädt nicht (Netz weg mitten im Stream, 404)** → Hinweis im Player mit „Erneut versuchen“, unter 60 s wird nichts gezählt. *(Task 3: `a load error is reported in the snapshot`; Task 6: e2e `load error shows retry`)*

**Bewusst nicht in diesem Meilenstein:** Lautstärkeregler für Klangschale/Atem-Töne, Download-Verwaltung einzelner Meditationen (Löschen), mehrere Stimmen zur Auswahl in der App.

---

## Dateistruktur (neu/geändert)

```
content/meditations/<id>.md                   9 Sprechtexte (Task 1, Freigabe durch den Nutzer)
scripts/lib/meditation-text.mjs               Parser: Frontmatter, Abschnitte, Pausen, Hashes (rein)
scripts/meditations.mjs                       CLI: estimate | split | placeholders | assemble | manifest
audio-work/cache/<hash>.mp3                   vertonte Abschnitte (eingecheckt, Task 11)
audio-work/casting/*.mp3                      Casting-Proben (Task 10)
public/audio/meditations/<id>.mp3             Platzhalter (Task 2), später echt (Task 11)
src/content/meditations.json                  Manifest (vom Skript erzeugt, eingecheckt)
src/lib/content/catalog.ts                    Katalog-Typen, Gruppierung, Vorschlag des Tages (rein)
src/lib/stats/schema.ts                       LastUsed 'guided', Settings.guidedSound
src/lib/audio/guided-run.ts                   geführte Sitzung: Stimme, Spulen, gehörte Zeit, Fehler
src/lib/audio/voice.ts                        <audio>-Element + MediaElementSource (dünn)
src/lib/audio/engine.ts                       startGuided/seek/setBackground, gemeinsame Sitzungsschnittstelle
src/lib/audio/media-session.ts                Spulen-Aktionen, Positionsanzeige
src/lib/offline/meditations.ts                gespeichert?, speichern (mit Fortschritt), alle speichern, persist
vite.config.ts                                Laufzeit-Cache ruhe-meditations mit Range-Requests
src/components/player/GuidedPlayer.svelte     Laufansicht der geführten Meditation
src/screens/Meditieren.svelte, Heute.svelte, Ich.svelte, App.svelte
```

---

### Task 1 (Controller + Subagent, zuerst): Die neun Texte

Ein Subagent (Modell: stärkstes) schreibt die neun Texte nach Spec §5.1 und dem Katalog in §3.2; der Controller legt sie dem Nutzer zur Freigabe vor (als lesbares Dokument) und arbeitet Änderungswünsche ein. Die Implementierung (Task 2 ff.) beginnt, sobald der Entwurf committet ist, und wartet nicht auf die Freigabe (Platzhalter in Task 2); nur Tasks 10–11 warten auf sie.

**Files:** Create `content/meditations/{ankommen-im-atem,gedanken-wie-wolken,bodyscan-im-sitzen,drei-minuten-atempause,nach-einem-vollen-tag,vor-einem-wichtigen-termin,guten-morgen,fokus-vor-der-arbeit,energie-in-der-mittagspause}.md`

- Frontmatter exakt: `id`, `title` (wie Katalog §3.2), `category` (`achtsamkeit` | `stress` | `fokus`), `minutes` (Ziel-Länge laut Katalog), `description` (ein Satz).
- Sprechzeit bei ruhigem Tempo ≈ 13 Zeichen/s; Rahmen: 4 s Klangschale bis zum ersten Wort, am Ende 3 s Stille + 12 s Ausklang der Schale. Ziel: geschätzte Gesamtlänge innerhalb ±15 % der Ziel-Länge, Stilleanteil ≥ 40 % (Schalen zählen als Stille). Der Subagent rechnet das selbst nach (Task 2 bringt später `estimate`, das es bestätigt).
- [ ] Texte schreiben, `estimate` grün, commit `content: neun Meditationstexte (Entwurf)`.
- [ ] Freigabe durch den Nutzer; Änderungen einarbeiten; commit `content: Meditationstexte freigegeben`.

---

### Task 2: Text-Parser, Skript, Platzhalter & Manifest

**Files:** Create `scripts/lib/meditation-text.mjs`, `scripts/meditations.mjs`, `src/content/meditations.json`, `public/audio/meditations/*.mp3` (Platzhalter) · Modify `package.json` (nur `"scripts"`: `"meditations": "node scripts/meditations.mjs"`) · Test `tests/unit/meditation-text.test.ts`

**Interfaces:**
- Produces `scripts/lib/meditation-text.mjs` (ESM mit JSDoc-Typen, von Vitest importierbar):
  - `parseMeditation(source: string): { meta: { id, title, category, minutes, description }, segments: Segment[] }` – wirft `Error` mit Zeilennummer bei fehlendem/ungültigem Frontmatter oder falscher Pausen-Syntax (z. B. `[Pause 8]`, `[Pause 2.3s]`, `[Pause -1s]`).
  - `type Segment = { kind: 'speech', text: string } | { kind: 'pause', seconds: number }` – Absätze ohne Markierung dazwischen ergeben `pause 3`; aufeinanderfolgende Pausen werden addiert; keine Pause am Anfang/Ende (die Klangschale rahmt).
  - `speechHash(text: string, voice: { id: string, model: string, settings: object }): string` – SHA-256 (hex, 16 Zeichen) über Stimme, Modell, Einstellungen und *eigenen* Text.
  - `BOWL_LEAD = 4` (s von der Anfangs-Schale bis zum ersten Wort; die Schale klingt darunter weiter), `BOWL_TAIL = 15` (3 s Stille nach dem letzten Wort, dann End-Schale mit 12 s Ausklang).
  - `estimate(segments): { chars: number, speechSeconds: number, pauseSeconds: number, totalSeconds: number, silenceShare: number }` mit 13 Zeichen/s; `BOWL_LEAD` und `BOWL_TAIL` zählen als Stille.
- Produces CLI `scripts/meditations.mjs`:
  - `estimate [id]` – Tabelle je Meditation: Zeichen, geschätzte Länge, Ziel-Länge, Stilleanteil; Exit 1, wenn Stille < 40 %.
  - `split [id]` – schreibt `audio-work/sections/<id>.json`: `[{ hash, text, previousText, nextText }]` für alle Sprechabschnitte (Stimme aus `audio-work/voice.json`, Format `{ id, model, settings }`; fehlt die Datei → Fehlermeldung „Erst die Stimme festlegen (audio-work/voice.json).“).
  - `placeholders` – erzeugt für jede Meditation ohne echte Datei `public/audio/meditations/<id>.mp3`: Ziel-Länge, leise Stille mit synthetischem Glockenton (Sinus 432 Hz, 2 s Abklingen) alle 30 s; **MP3 mono 16 kbit/s, 22,05 kHz** (Platzhalter klein halten; die echten Dateien folgen der Global Constraint). Eine Liste der Platzhalter-IDs steht in `audio-work/placeholders.json`.
  - `assemble <id>` – Anfangs-Schale (`public/audio/sounds/klangschale.ogg`), nach `BOWL_LEAD` die Abschnitte aus `audio-work/cache/<hash>.mp3` mit den Pausen dazwischen (die Schale klingt unter dem ersten Satz aus), nach dem letzten Wort 3 s Stille und die End-Schale, die Datei endet nach deren 12 s; `loudnorm=I=-19:TP=-1.5`; MP3 mono 64 kbit/s; entfernt die ID aus `audio-work/placeholders.json`. Fehlt ein Abschnitt im Cache → Fehler mit dessen Hash und Textanfang.
  - `manifest` – schreibt `src/content/meditations.json`: `{ meditations: [{ id, title, category, description, minutes, file: 'audio/meditations/<id>.mp3', duration: <ffprobe s, 1 Nachkommastelle>, bytes, placeholder: boolean }] }` in Katalog-Reihenfolge (§3.2).
- [ ] **Step 1: Failing tests** `tests/unit/meditation-text.test.ts`: Frontmatter-Felder; `[Pause 8s]` und `[Pause 2.5s]`; Absatz ohne Markierung → 3 s; zwei Pausen hintereinander addiert; Fehler mit Zeilennummer für `[Pause 8]`, `[Pause 2.3s]`; `speechHash` ändert sich mit Text, Stimme, Modell, Einstellungen und *nicht* mit Nachbartext; `estimate` an einem kleinen Beispiel (exakte Zahlen).
- [ ] **Step 2:** `npm test -- --project unit meditation-text` → FAIL.
- [ ] **Step 3:** Implementieren; ffmpeg-Aufrufe über `child_process.execFileSync` (kein Shell-String).
- [ ] **Step 4:** PASS; `npm run meditations estimate` über die Texte aus Task 1 (Exit 0), dann `npm run meditations placeholders && npm run meditations manifest`; `ffprobe` zeigt mono 22,05 kHz und die Ziel-Längen; Platzhalter, `audio-work/placeholders.json` und Manifest committen.
- [ ] **Step 5:** Commit `feat: Meditationstexte zerlegen, Platzhalter und Manifest erzeugen`.

---

### Task 3: Geführte Sitzung in der Audio-Engine

**Files:** Create `src/lib/audio/voice.ts`, `src/lib/audio/guided-run.ts` · Modify `src/lib/audio/engine.ts`, `src/lib/audio/program-run.ts` (gemeinsame Schnittstelle), `src/lib/audio/media-session.ts`, `src/lib/stats/schema.ts` · Test `tests/browser/guided.test.ts`, `tests/unit/played.test.ts`, `tests/unit/stats-schema.test.ts`

**Interfaces:**
- Produces `src/lib/stats/schema.ts`: `LastUsed` zusätzlich `{ kind: 'guided'; id: string }` (gültig, wenn `id` nicht leer); `Settings.guidedSound: SoundId | null` (Standard `null`, wie `timerSound` geprüft). `SessionKind` hat `'guided'` schon.
- Produces `src/lib/audio/played.ts`: `playedSeconds(ranges: { start: number; end: number }[], duration: number): number` – Summe der Bereiche, überlappungsfrei, auf `[0, duration]` begrenzt, endlich (sonst 0).
- Produces `src/lib/audio/voice.ts`: `createVoice(ctx: AudioContext, url: string): { element: HTMLAudioElement; source: MediaElementAudioSourceNode }` (`preload='auto'`, nicht im DOM).
- Produces `src/lib/audio/engine.ts` (zusätzlich):
  ```ts
  interface GuidedSpec { id: string; title: string; url: string; background: SoundId | null; backgroundVolume: number } // 0..1
  startGuided(spec: GuidedSpec): Promise<void>
  seek(deltaSeconds: number): void          // nur bei geführter Sitzung; Position auf [0, duration] begrenzt
  setBackground(id: SoundId | null, volume: number): void   // Hintergrund einer laufenden Sitzung wechseln/ändern
  // ProgramSnapshot.kind wird 'timer' | 'breath' | 'guided'; für 'guided': lead 0, length = finish = duration
  // (0 bis Metadaten da), elapsed = element.currentTime; zusätzlich error: boolean (Datei lädt nicht)
  ```
- Ergebnis einer geführten Sitzung: `{ kind: 'guided', ref: id, start, seconds: playedSeconds(element.played, duration) }`, genau einmal – beim `ended` des Elements, beim vorzeitigen Ende (`endProgram`, `stopAll`, `toggle`, `startProgram`, neue `startGuided`) oder bei Pause im ausgeklungenen Zustand (wie bei Programmen).
- Für Tasks 5–7: `engine.programElapsed()` liefert bei geführten Sitzungen `element.currentTime`; `retryGuided(): Promise<void>` startet dieselbe Meditation nach einem Ladefehler ab der letzten Position neu.

**Verhalten (verbindlich):**
- `startGuided` ruft – wie `startProgram` – Output-Start und `element.play()` synchron vor dem ersten `await` (Nutzergeste), beendet laufende Klänge/Programme/Sitzungen, verwirft den Sleep-Countdown, setzt `fade` auf 1. Die Stimme geht über eigenen Gain (1,0) in `input`; der Hintergrund über den vorhandenen Klang-Weg mit Lautstärke `backgroundVolume` (Kanal zählt in `volumes`).
- Pause/Weiter: Engine-Pause hält zusätzlich das Stimm-Element an, Weiter spielt es weiter. Eine System-Unterbrechung des Stimm-Elements (`pause`-Ereignis, nicht selbst ausgelöst) behandelt die Engine wie die des Ankers.
- `ended` des Elements → Ergebnis melden, Hintergrund ausblenden (0,8 s), Zustand `idle`.
- Ladefehler (`error`-Ereignis, oder `stalled` > 15 s ohne Fortschritt ist **kein** Fehler): `error: true` im Snapshot, Engine pausiert; `retryGuided()` setzt `error` zurück.
- Media Session: bei geführter Sitzung zusätzlich `seekbackward`/`seekforward` (je 15 s) und `setPositionState({ duration, position, playbackRate: 1 })` bei jeder Änderung; Titel = Meditationstitel.

- [ ] **Step 1: Failing tests** – unit `played.test.ts` (Überlappung, Begrenzung, NaN → 0); unit `stats-schema` (guided `lastUsed`, `guidedSound`); browser `guided.test.ts` mit einer im Test erzeugten 3-s-WAV (Blob-URL; per `OfflineAudioContext` gerendert):
  `guided session plays through the mixer and reports once`, `result counts the played ranges, not wall time`, `seeking clamps and skipped parts do not count`, `pause pauses the voice element and the clock`, `starting a sound ends the guided session`, `a load error is reported in the snapshot` (404-URL), `background plays at the given volume and fades at the end`, `media session has seek actions and position during a guided session`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren – gemeinsame Schnittstelle `SessionRun` (snapshot, elapsed, reported, end) für `ProgramRun` und `GuidedRun`; die Engine hält höchstens eine. Wächst `engine.ts` über ~600 Zeilen, die Sitzungs-Verwaltung in ein eigenes Modul auslagern.
- [ ] **Step 4:** `npm test` (Browser-Projekt 2×) und `npm run check` → PASS.
- [ ] **Step 5:** Commit `feat: geführte Sitzungen mit Stimme, Spulen und gehörter Zeit`.

---

### Task 4: Offline-Speicher für Meditationen

**Files:** Create `src/lib/offline/meditations.ts` · Modify `vite.config.ts` · Test `tests/browser/offline-meditations.test.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- `vite.config.ts` → `workbox.runtimeCaching`: URL-Muster `/\/audio\/meditations\/.+\.mp3$/`, `handler: 'CacheFirst'`, `options: { cacheName: 'ruhe-meditations', rangeRequests: true, cacheableResponse: { statuses: [200] } }`. MP3 bleibt aus `globPatterns` heraus.
- Produces `src/lib/offline/meditations.ts` (Cache Storage + fetch injizierbar für Tests):
  - `MEDITATION_CACHE = 'ruhe-meditations'`
  - `isSaved(url: string): Promise<boolean>` – nur eine vollständige 200-Antwort mit passender `Content-Length` zählt.
  - `saveMeditation(url: string, onProgress?: (loaded: number, total: number) => void): Promise<'saved' | 'quota' | 'failed'>` – lädt vollständig (Stream, Fortschritt), legt erst nach vollständigem Empfang in den Cache; `QuotaExceededError` → `'quota'` (bisher Gespeichertes bleibt).
  - `saveAll(urls: string[], onProgress: (done: number, total: number, bytes: number) => void): Promise<{ saved: number; failed: number; quota: boolean }>` – nacheinander, bricht bei `'quota'` ab.
  - `requestPersistOnce(): Promise<void>` – ruft beim ersten Speichern einmal `navigator.storage.persist()` (Merker in `localStorage['ruhe.v1']` nicht nötig; Merker im Speicher reicht pro App-Start), Fehler still.
  - `saveInBackground(url)` – für das erste Abspielen: startet `saveMeditation` ohne Warten, Fehler still.
- [ ] **Step 1: Failing tests** (browser, echte Cache Storage, `fetch` per Fake mit Stream): `a complete download is saved`, `a partly streamed file does not count as saved` (Stream bricht ab → `isSaved` false, nichts im Cache), `quota error keeps what was saved and reports it` (Fake-Cache wirft beim 3. `put` → `{ saved: 2, quota: true }`), `progress reports bytes`. e2e `pwa.spec.ts`: nach erstem Laden und `saveAll` über die Oberfläche (Task 7) – hier zunächst: eine Meditation per `fetch` speichern, offline gehen, Range-Request `bytes=0-99` auf die Datei liefert 206 mit 100 Bytes aus dem Cache.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS (`npm test`, `npx playwright test tests/e2e/pwa.spec.ts`).
- [ ] **Step 5:** Commit `feat: Meditationen offline speichern mit Range-Cache`.

---

### Task 5: Katalog & Vorschlag des Tages

**Files:** Create `src/lib/content/catalog.ts` · Test `tests/unit/catalog-meditations.test.ts`

**Interfaces:**
- Produces `src/lib/content/catalog.ts` (liest `src/content/meditations.json`):
  - `type Category = 'achtsamkeit' | 'stress' | 'fokus'`; `CATEGORY_TITLE = { achtsamkeit: 'Einsteiger & Achtsamkeit', stress: 'Stress & Ruhe', fokus: 'Fokus & Energie' }`
  - `interface Meditation { id; title; category: Category; description; minutes; file; duration; bytes; placeholder: boolean }`
  - `MEDITATIONS: readonly Meditation[]`, `meditationById(id: string): Meditation | null`
  - `byCategory(): { category: Category; title: string; items: Meditation[] }[]` in Reihenfolge achtsamkeit, stress, fokus
  - `suggestionFor(now: Date, list = MEDITATIONS): Meditation` – 5–11 Uhr `fokus`, 11–17 Uhr `stress`, sonst `achtsamkeit`; innerhalb der Kategorie Index = (Tag-des-Jahres, lokal) mod Anzahl → über den Tag stabil.
  - `durationLabel(m: Meditation): string` – „{n} Min“ aus `duration` (gerundet, mind. 1).
  - `FALLBACK_ID = 'ankommen-im-atem'`
- [ ] **Step 1: Failing tests:** Gruppierung und Titel; `suggestionFor` um 10:59/11:00/16:59/17:00/04:59/05:00 → richtige Kategorie; zwei Zeitpunkte am selben Tag → gleiche Meditation, am nächsten Tag → nächste (mod Anzahl); `durationLabel` (299,6 s → „5 Min“, 20 s → „1 Min“).
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS. **Step 5:** Commit `feat: Meditationskatalog und Vorschlag des Tages`.

---

### Task 6: Player für geführte Meditationen & Liste unter „Meditieren“

**Files:** Create `src/components/player/GuidedPlayer.svelte`, `src/lib/meditation/guided-view.ts` · Modify `src/screens/Meditieren.svelte`, `src/App.svelte`, `src/lib/ui/player-state.ts`, `src/components/player/SessionDone.svelte` · Test `tests/unit/guided-view.test.ts`, `tests/e2e/guided.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`startGuided`, `seek`, `setBackground`, `retryGuided`, Snapshot `kind: 'guided'`, `error`), Task 4 (`isSaved`, `saveInBackground`), Task 5 (`byCategory`, `durationLabel`, `meditationById`), `PlayerShell`, `startSession`-Muster aus `session-ui.svelte.ts` (eine `startGuidedSession(m: Meditation)` daneben: `clearDone()`, `setLastUsed({ kind: 'guided', id })`, `engine.startGuided(...).catch(() => {})`, `saveInBackground(url)`).

**Texte & Verhalten (wörtlich):**
- Meditieren: unter dem Timer-Karte `<h2>Geführte Meditationen</h2>`, dann je Thema `<h3>{CATEGORY_TITLE}</h3>` und Einträge als Knöpfe: Titel, darunter „{durationLabel}“ und – wenn gespeichert – „✓ offline“ (`aria-label="{Titel}, {n} Minuten, offline verfügbar"` bzw. ohne den Zusatz). Offline (`navigator.onLine === false`) und nicht gespeichert: ausgegraut, nicht startbar, Zusatz „Nicht offline verfügbar“. Ein Platzhalter-Eintrag zeigt zusätzlich „Vorabversion“.
- Player (über `PlayerShell`, Rückfrage „Meditation beenden?“ / „Weiter meditieren“ wie beim Timer):
  - oben der Meditationstitel, Restzeit groß mit Fortschrittsring (wie Timer, Zeitbasis `programElapsed()`)
  - Knöpfe „15 Sekunden zurück“ / „15 Sekunden vor“ (Symbole mit diesen `aria-label`s) neben „Pause“/„Weiter“ und „Beenden“
  - `<select aria-label="Hintergrundklang">` („Keiner“ + 8 Klänge, wie `SoundSelect`) und ein Regler `<input type="range" aria-label="Balance Stimme ↔ Hintergrund">` (0–100 %), beide wirken sofort (`setBackground`) und speichern `guidedSound` bzw. `voiceBalance`
  - bei `error`: „Die Meditation konnte nicht geladen werden.“ und Knopf „Erneut versuchen“
- Abschluss: `SessionDone` mit „Schön, dass du dir die Zeit genommen hast.“ und „{n} Min meditiert“ (wie Timer).
- Hintergrund-Lautstärke = `0.7 × voiceBalance` (Standard 0,5 → 0,35).
- [ ] **Step 1: Failing tests** – unit `guided-view.test.ts` (aria-Label-Texte, Balance → Lautstärke); e2e `guided.spec.ts` mit Platzhalter-Dateien: Liste gruppiert mit den drei Themen-Überschriften; Start → Player mit Titel; ±15 s ändert die Restzeit um 15 s; Pause/Weiter; Hintergrund „Regen“ wählen → `localStorage` `guidedSound: 'regen'`; Regler auf 20 % → `voiceBalance: 0.2`; Zurück → Rückfrage; „Beenden“ → Abschluss mit Unter-einer-Minute-Text; `load error shows retry` (Route liefert 404 → Hinweis + „Erneut versuchen“); offline + nicht gespeichert → Eintrag ausgegraut mit „Nicht offline verfügbar“.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** `npm run check && npm test && npx playwright test` → PASS.
- [ ] **Step 5:** Commit `feat: Player für geführte Meditationen und Liste unter Meditieren`.

---

### Task 7: „Ich“ – Balance & „Alle offline speichern“

**Files:** Modify `src/screens/Ich.svelte`, `src/lib/ui/ich-view.ts` · Test `tests/unit/ich-view.test.ts`, `tests/e2e/ich.spec.ts`

- Einstellungen: zusätzlich Regler „Balance Stimme ↔ Hintergrund“ (gleicher Wert wie im Player).
- Neuer Abschnitt `<h2>Offline</h2>` über „Backup“: Text „{gespeichert} von 9 Meditationen offline gespeichert ({MB} MB)“, Knopf „Alle offline speichern“ (deaktiviert, wenn alle gespeichert oder offline); während des Ladens `role="progressbar"` mit `aria-valuenow` in Prozent der Bytes und Text „Speichere {i} von {n} …“; Ergebnis als `role="status"`: „Alle Meditationen sind offline verfügbar.“ bzw. bei Speicherfehler „Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.“
- [ ] **Step 1: Failing tests** – unit: Text- und MB-Formatierung (`1 von 9 …`, `9 von 9 …`); e2e: „Alle offline speichern“ → Fortschritt → Erfolgsmeldung, danach in „Meditieren“ überall „✓ offline“; mit Route, die die 3. Datei mit 507/Abbruch beantwortet → Fehlermeldung, 2 gespeichert.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS. **Step 5:** Commit `feat: Balance-Regler und alle Meditationen offline speichern`.

---

### Task 8: „Heute“ – Vorschlag des Tages & Zuletzt genutzt mit Meditation

**Files:** Modify `src/screens/Heute.svelte`, `src/lib/ui/heute-view.ts`, Spec · Test `tests/unit/heute-view.test.ts`, `tests/e2e/heute.spec.ts`

- Karten in dieser Reihenfolge: 1. „Vorschlag des Tages“ (Titel, Beschreibung, `durationLabel`, Knopf „Jetzt starten“) – `suggestionFor(new Date())`; 2. „Zuletzt genutzt“ – jetzt auch geführte Meditationen („{Titel} · {n} Min“); ohne bisherige Sitzung „Ankommen im Atem“ (`FALLBACK_ID`) statt ausgeblendet; 3. „3 Min durchatmen“; 4. „Zur Ruhe kommen“.
- `lastUsedSummary`/`lastUsedProgram` bekommen den Fall `guided` (Start über `startGuidedSession`); unbekannte `id` → Rückfall auf `FALLBACK_ID`.
- Spec §3.1: die Ergänzung „bis Meilenstein 3 …“ durch eine neue dated note ersetzen, dass Vorschlag und Rückfall jetzt umgesetzt sind.
- [ ] **Step 1: Failing tests** – unit: Zusammenfassung guided, Rückfall bei leerem/unbekanntem `lastUsed`; e2e mit fester Uhr 08:00 → Vorschlag aus „Fokus & Energie“, „Jetzt starten“ öffnet den Player mit diesem Titel; ohne Daten → „Zuletzt genutzt“ zeigt „Ankommen im Atem“.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS. **Step 5:** Commit `feat: Vorschlag des Tages und Zuletzt genutzt mit Meditationen`.

---

### Task 9: README, Handy-Checkliste, Spec

**Files:** Modify `README.md`, `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- README: Abschnitt „Meditationen vertonen“ (Ablauf mit dem Skript: `estimate`, `split`, Abschnitte erzeugen, `assemble`, `manifest`); „Handy-Checkliste Meilenstein 3“: 1. Meditation bei gesperrtem Bildschirm bis zum Ende, Sitzung erscheint unter „Ich“; 2. ±15 s und Position in der Benachrichtigung; 3. „Alle offline speichern“, dann Flugmodus, Meditation spielt und spult; 4. Hintergrundklang + Balance; 5. Anruf während der Meditation pausiert, Weiter setzt fort.
- Spec: dated notes zu den drei „Änderungen gegenüber der Spec“ oben (§5.2 Vertonung über Connector, §11 Meilenstein 4 in 3 aufgegangen, §6.4 `guidedSound`).
- [ ] Commit `docs: Vertonung, Handy-Checkliste Meilenstein 3, Spec-Notizen`.

---

### Task 10 (Controller, nach Freigabe der Texte): Stimm-Casting

- [ ] Mit dem Connector deutsche Stimmen suchen (`creative_list_voices`), drei ruhige, warme Kandidaten wählen; je ein Probetext (~400 Zeichen aus „Ankommen im Atem“) mit `eleven_multilingual_v2` und `eleven_v3` (ruhige Einstellungen, leicht reduziertes Tempo) → `audio-work/casting/<stimme>-<modell>.mp3`; Hörproben an den Nutzer.
- [ ] Wahl → `audio-work/voice.json` (`{ id, model, settings }`), commit `content: Stimme für die Vertonung festgelegt`.

### Task 11 (Controller): Vertonung der neun Meditationen

- [ ] `npm run meditations split` → je Abschnitt mit dem Connector vertonen (Kontext: Vorgänger-/Nachfolgetext, soweit der Connector das unterstützt), als `audio-work/cache/<hash>.mp3` speichern (nur fehlende Hashes – nie doppelt bezahlen); vorher Kosten mit `estimate` nennen.
- [ ] `assemble` für alle 9, `manifest`; Stichprobe hören (Anfang/Ende/Pausen), Hörprobe einer Meditation an den Nutzer.
- [ ] e2e-Suite grün (die Tests dürfen sich nicht auf Platzhalter-Längen verlassen), commit `content: neun Meditationen vertont`.
