# Meilenstein 5 – Meditationsmusik & Atemgeräusch: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Seven meditation music pieces play in „Klänge“ and as background of timer and guided meditations, looping without a seam and available offline.
- In breathing exercises a quiet human breath replaces the ping, fitted to each phase, with an off switch.

**Architecture:**
- Music is streamed, never decoded whole. A new voice `createMusicVoice` alternates two `<audio>` elements through `MediaElementSource` and crossfades them on the audio clock 8 s before the end.
- The engine treats a background as either a nature loop (decoded buffer, as today) or a music piece (streamed voice). Pause, resume, interruption and sleep end hold and free the music elements like the guided voice.
- The breath sound is a small scheduling module that replaces `cue.ts`. It runs inside the existing program scheduling (`ProgramSpec.schedule`).
- The offline store picks its cache by URL: meditations stay in `ruhe-meditations`, music goes to `ruhe-musik`.

**Tech Stack:**
- Vite 8, Svelte 5 (runes), TypeScript 6, vite-plugin-pwa 2 (Workbox).
- Vitest (unit in node, browser in Chromium), Playwright (Pixel 7, `vite preview` :4173).
- Python 3 + ffmpeg (libopus, libvorbis), for the development tool only.
- ElevenLabs connector (controller tasks only).

**Spec:** `docs/superpowers/specs/2026-10-23-ruhe-m5-musik-atem-design.md`.

## Global Constraints

### Music
- **IDs, titles and order:**
  - `schwebend` „Schwebende Flächen“
  - `klavier` „Stilles Klavier“
  - `obertoene` „Obertöne“
  - `bambusfloete` „Bambusflöte“
  - `zwischen-zwei-atemzuegen` „Zwischen zwei Atemzügen“
  - `salz-und-sternenlicht` „Salz und Sternenlicht“
  - `unter-der-oberflaeche` „Unter der Oberfläche“
- **Files:** `public/audio/music/<id>.opus`, Opus 96 kbit/s, stereo, 48 kHz.
- **Loudness:** −26 LUFS integrated, true peak ≤ −2 dBTP, fade in 1.5 s, fade out 3 s.
- **Budget:** all 7 together ≤ 22 MB.
- **URL:** `assetUrl(file) + '?v=' + version`, where `version` is the first 10 hex characters of the file's SHA-256 (same length as the meditations).
- **Crossfade:** 8 s. Every piece starts at 0, never at a random offset.

### Breath
- **Files:** `public/audio/breath/ein.ogg` and `public/audio/breath/aus.ogg`. Mono Ogg Vorbis, −26 LUFS, together ≤ 150 KB.
- **Rate:** `rate = clamp(D / L, 0.75, 1.25)`, where `D` is the buffer duration and `L` the phase length. The sound ends at `E = min(L, D / rate)`.
- **Envelope:** linear 0 → `G` over `min(0.35, 0.3·L)`, then linear down to 0 over `min(1.0, 0.4·E)`, reaching 0 exactly at `E`.
- **Gain:** `G` is `0.25` for `ein` and `0.21` for `aus`. `halten` gets no sound.
- **Setting:** `settings.breathSound: boolean`, default `true`. When it is `false`, nothing is loaded and nothing is scheduled.

### Copy (exact)
- **Klänge:** headings „Musik“ and „Natur“. Unavailable offline: „Nicht offline verfügbar“.
- **Select:** groups `<optgroup label="Musik">` and `<optgroup label="Natur">`. An unavailable option gets the suffix „ – nicht offline verfügbar“.
- **Ich switch:** „Atemgeräusch bei Atemübungen“, directly below „Vibration bei Atemübungen“.
- **Offline summary:** `„{m} von 9 Meditationen und {k} von 7 Musikstücken offline gespeichert ({saved} von {total})“`, where both sizes come from `megabytes()`, e.g. „12,4 MB von 49,2 MB“.
- **Success message:** „Alle Meditationen und die Musik sind offline verfügbar.“

### Storage
- **Caches:** `ruhe-meditations` (unchanged) and `ruhe-musik`.
- **Precache:** `.opus` is never precached. Breath `.ogg` is precached through the existing `ogg` glob.

### General
- No new npm dependencies.
- German comments in the code style of the surrounding files.
- Development tools (`scripts/*.py`) are not part of the app and not part of CI.

## Rulings made while planning

- **Auto-save on first play:** Music is saved for offline use in the background the first time it plays (`saveForOffline`), exactly like a meditation. The spec says „wie die Meditationen“; this is how meditations behave.
- **Breath gains as constants:** `scheduleBreath` takes its gains from the module constant `BREATH_GAIN` instead of a parameter. The spec's signature listed `gains`, but nothing varies them.
- **File name kept:** The offline module keeps its file name `src/lib/offline/meditations.ts`. `saveMeditation` is renamed to `saveAudio` because it now saves music too.

## Review Focus

1. **Pause in the middle of a crossfade, then Weiter.** Both elements continue and the crossfade completes. Nothing keeps playing silently. Pinned in Task 3.
2. **Interruption (call, lock screen) while music plays.** The engine pauses the music elements. Weiter continues at the same position instead of restarting. Pinned in Task 4.
3. **Tapping two music pieces in quick succession** (the second before the first is ready). Exactly one voice remains, and the superseded voice is stopped and freed. Pinned in Task 4.
4. **Stored data from M4/M4.1** (no `breathSound`, nature ids, a timer `lastUsed`). It loads unchanged and `breathSound` becomes `true`. A stored music id survives a reload. Pinned in Tasks 4 and 5.
5. **Ending a breath exercise in the middle of an exhale.** The sounding breath stops with the program fade, and breath sounds that have not started yet never sound. Pinned in Task 5.

---

### Task 1: Music and breath files (controller)

**Files:**
- Create: `scripts/musik.py`, `public/audio/music/*.opus` (7), `public/audio/breath/ein.ogg`, `public/audio/breath/aus.ogg`
- Modify: `content/sounds.json`

**Interfaces:**
- Produces: `content/sounds.json` → new arrays.
  - `music`: `{ id, title, file, version, seconds, bytes, source }`, where `source` is `{ "kind": "elevenlabs", "prompt", "flow", "generation" }` or `{ "kind": "gemini", "title": "<englischer Originaltitel>" }`.
  - `breath`: `{ id: "ein" | "aus", file, prompt, flow, generation }`.

- [ ] **Step 1: Write `scripts/musik.py`.** Model the header comment and argparse style on `scripts/freistellen.py`. Two subcommands:
  - `musik <quelle> <ziel.opus>`:
    - two-pass `loudnorm` to I=−26, TP=−2 (`linear=true`);
    - `afade` in 1.5 s and out 3 s;
    - `-c:a libopus -b:a 96k -ar 48000 -ac 2`;
    - prints duration, bytes and the first 10 hex characters of the SHA-256.
  - `atem <quelle> <ziel.ogg>`:
    - `lowpass=f=4000`;
    - trims leading and trailing audio quieter than 30 dB below the peak (numpy on the decoded samples);
    - 30 ms fades;
    - loudness −26 LUFS;
    - `-ac 1 -c:a libvorbis -q:a 5`;
    - prints duration and bytes.
  - Run every Python with `python3 -I`.
- [ ] **Step 2: Generate the four new pieces.**
  - Flow `okOZzzvC1AkFQC5zHLFu`, nodes `MM7qBnL0cD5L42PWZqPS` (schwebend), `MZfCAA8ZgyTUYCQrptw1` (klavier), `TY0nWfJgcTd0KMzzmp8w` (obertoene), `BWrScLFrOBHzn5XkCc78` (bambusfloete).
  - `creative_update_node` with `duration_seconds: 300, lyrics_type: "instrumental", instrumental: true`.
  - For obertoene, append to the prompt: „Begins softly from silence.“
  - Run `creative_run_flow_nodes` once with `estimate_only` (expect ≈ 3,30 $), then once for real with `generations_count: 1`. **Never repeat a generation call.**
  - Poll `creative_get_flow_run_status` and download each `content_url` with `curl -s -o` into the scratchpad `m5-musik/`.
- [ ] **Step 3: Convert all seven.**
  - The four downloads.
  - The three Gemini uploads:
    - `/root/.claude/uploads/09f6271c-c18b-5e56-b122-054862a87078/af6a2c9f-Between_Two_Breaths.mp3` → `zwischen-zwei-atemzuegen`
    - `775d1b9a-Salt_and_Starlight.mp3` → `salz-und-sternenlicht`
    - `584d0733-Underneath_the_Surface.mp3` → `unter-der-oberflaeche`
  - Breath from the scratchpad: `m5-atem/mensch-ein-1.mp3` → `ein.ogg` and `m5-atem/mensch-aus-1.mp3` → `aus.ogg`. These are generations `PMTn0SaseKGi9cK0XYaW` and `phrVHCICpt5jeevhud6K`.
- [ ] **Step 4: Verify.**
  - Run: `for f in public/audio/music/*.opus public/audio/breath/*.ogg; do ffmpeg -hide_banner -nostats -i $f -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)"; done; du -cb public/audio/music/*.opus | tail -1; du -cb public/audio/breath/*.ogg | tail -1`
  - Expected:
    - every I is in −26.5…−25.5 LUFS;
    - every Peak is ≤ −1.5 dBFS;
    - music total ≤ 22000000 bytes;
    - breath total ≤ 150000 bytes.
- [ ] **Step 5: Fill `content/sounds.json`.**
  - `music` in the order of the Global Constraints. `seconds` is the duration rounded to 0.1, and `bytes` and `version` come from the script output.
  - `source` holds the prompt, the flow and the generation id, or the Gemini title.
  - Add the `breath` array.
- [ ] **Step 6: Send the four new pieces to the user** (SendUserFile, non-blocking) and continue.
  - If the user dislikes a piece, regenerate it individually only after their go-ahead, then update its file, `version`, `bytes` and `seconds`.
- [ ] **Step 7: Commit.**
  - `git add scripts/musik.py public/audio/music public/audio/breath content/sounds.json`
  - `git commit -m "feat: Musikstücke und Atemgeräusch als Dateien, Aufbereitungsskript"`

### Task 2: Paint the seven music motifs (controller)

**Files:**
- Create: `public/images/motive/musik-<id>.webp` (7)
- Modify: `content/motive.json`

**Interfaces:**
- Produces: the files `musik-<id>.webp` for every `MusicId`. Each is 480 px, WebP with alpha, ≤ 90 KB. Each has an entry in `content/motive.json` (`id`, `subject`, `flow`, `generation`, `crop`, `size: 480`).

- [ ] **Step 1: Generate.**
  - Follow M4-Spec §3.3: model `gpt-image-2.5-sunburst`, three motifs per image on flat `#1B2350`, the `style` text from `content/motive.json`. That makes three images: 3 + 2 + 2 motifs.
  - Subjects:
    - schwebend: „three soft overlapping veils of drifting mist“
    - klavier: „a small grand piano seen from the side“
    - obertoene: „a singing bowl with gentle rising sound rings“
    - bambusfloete: „a bamboo flute with a single leaf“
    - zwischen-zwei-atemzuegen: „two gently curved breath lines“
    - salz-und-sternenlicht: „a salt crystal beneath a small star“
    - unter-der-oberflaeche: „a calm water surface with a pebble sinking below“
  - Estimate first (≈ 1 $). Do not repeat a call.
- [ ] **Step 2: Let the user choose.** Build a numbered overview sheet per image with Pillow and send it. Ask which variant per motif.
  - Tasks 3–6 continue meanwhile. Task 7 needs the answer: if it has not come by then, stop and ask.
- [ ] **Step 3: Cut out.** Use `python3 -I scripts/freistellen.py <quelle.png> public/images/motive/musik-<id>.webp --crop x,y,b,h --size 480`, then add the entries to `content/motive.json`.
- [ ] **Step 4: Verify.**
  - Run: `ls -l public/images/motive/musik-*.webp; du -cb public/images/motive/*.webp | tail -1`
  - Expected: 7 files, each ≤ 90000 bytes. All motifs together ≤ 1500000 bytes.
- [ ] **Step 5: Commit.**
  - `git add public/images/motive content/motive.json`
  - `git commit -m "feat: sieben gemalte Motive für die Musik"`

### Task 3: Streamed music voice with crossfade

**Files:**
- Create: `src/lib/audio/music.ts`, `tests/browser/wav.ts`, `tests/browser/music.test.ts`
- Modify: `src/lib/audio/voice.ts` (extend `Voice`), `tests/browser/guided.test.ts` (import `wav` from the new helper instead of its local copy)

**Interfaces:**
- Produces, in `voice.ts`, an extended `Voice`:
  - `hold?(): void` — pause what sounds, without freeing it;
  - `resume?(): Promise<void>` — play again what `hold` paused.
- Produces, in `music.ts`:
  ```ts
  export const CROSSFADE = 8
  export interface MusicVoice extends Voice {
    ready: Promise<void> // first element can play; rejects with Error('Konnte nicht geladen werden: ' + url)
    hold(): void
    resume(): Promise<void>
  }
  export function createMusicVoice(ctx: AudioContext, url: string, opts?: { crossfade?: number }): MusicVoice
  ```
- Produces, in `tests/browser/wav.ts`: `export function wav(buffer: AudioBuffer): Blob` (moved from `guided.test.ts`) and `export async function toneUrl(seconds: number, frequency = 440): Promise<string>`.

- [ ] **Step 1: Write the failing tests in `tests/browser/music.test.ts`.** Use a 3 s tone (`toneUrl(3)`), `crossfade: 1`, a real `AudioContext`, and spies on `HTMLMediaElement.prototype.play` and `AudioParam.prototype.linearRampToValueAtTime`.
  - `'a music voice gets ready and plays its first element from the start'`:
    - `await voice.ready` resolves;
    - exactly one `play()` call;
    - that element's `currentTime` < 0.5 right after ready.
  - `'the second element starts crossfade seconds before the end and the gains ramp over the crossfade'`:
    - the second `play()` happens when the first element's `currentTime` ≥ 1.7;
    - two ramps end at `t + 1` (±0.05), one to 0 and one to 1.
  - `'after the crossfade the roles swap and the old element rewinds'`:
    - after ≈ 3.3 s the first element is paused with `currentTime === 0`;
    - a third `play()` (the first element again) follows at about 4 s.
  - `'hold pauses only the sounding elements and resume continues them'` (Review Focus 1):
    - outside a crossfade, `hold` pauses one element and `resume` plays exactly that one;
    - inside a crossfade, `hold` pauses both and `resume` plays both;
    - neither element's `currentTime` jumps back.
  - `'stop frees both elements'`: after `stop()` both elements are paused and have no `src` attribute.
  - `'stop at a later time frees at that time'`: `stop(ctx.currentTime + 0.3)` → still playing at +0.1 s, freed at +0.5 s.
  - `'a file that does not load rejects ready'`: a URL to a missing file → `ready` rejects with a message starting `Konnte nicht geladen werden:`.
- [ ] **Step 2: Run them to verify they fail.**
  - Run: `npx vitest run --project browser tests/browser/music.test.ts`
  - Expected: FAIL (module not found).
- [ ] **Step 3: Implement `createMusicVoice` in `src/lib/audio/music.ts`.**
  - Build both elements like `createVoice` (`crossOrigin = 'anonymous'` before `src`). The second one gets `preload = 'none'` until its first use. Each element has its own `GainNode` into the shared `output` gain.
  - Call `play()` on the first element synchronously, inside the user gesture.
  - Watch `timeupdate` on the current element; when `duration − currentTime ≤ crossfade`:
    - start the other element at 0;
    - ramp both gains with `holdParam` and `linearRampToValueAtTime`;
    - put a `scheduleMarker` (`clock.ts`) at the ramp end that pauses the old element, rewinds it and swaps the roles.
  - An `ended` on the current element without a running crossfade starts the other at once.
  - Pauses that the voice causes itself are ignored; interruptions are the engine's business, via the anchor.
  - `stop(when)`: free now when `when ≤ ctx.currentTime`, otherwise at a marker. If the context stops running before that, free at once, as `GuidedRun.end` does. Freeing means `pause()`, disconnect the sources and gains, remove `src`, and `load()`.
- [ ] **Step 4: Move `wav()` into `tests/browser/wav.ts`** and import it in `guided.test.ts`.
- [ ] **Step 5: Run the tests to verify they pass.**
  - Run: `npx vitest run --project browser tests/browser/music.test.ts tests/browser/guided.test.ts`
  - Expected: PASS.
- [ ] **Step 6: Commit.**
  - `git add src/lib/audio/music.ts src/lib/audio/voice.ts tests/browser/wav.ts tests/browser/music.test.ts tests/browser/guided.test.ts`
  - `git commit -m "feat: gestreamte Musik-Stimme mit Überblendung auf der Audio-Uhr"`

### Task 4: Music in catalogue, settings and engine

**Files:**
- Modify:
  - `src/lib/sounds/catalog.ts`
  - `src/lib/stats/schema.ts`
  - `src/lib/meditation/timer-plan.ts`, `src/lib/meditation/timer-view.ts`
  - `src/lib/audio/program.ts`, `src/lib/audio/guided-run.ts` (types only)
  - `src/lib/audio/media-title.ts`
  - `src/lib/audio/engine.ts`
  - `src/components/SoundSelect.svelte`, `src/components/timer/TimerSetup.svelte`, `src/components/player/GuidedPlayer.svelte` (types only)
- Test: `tests/unit/catalog.test.ts`, `tests/unit/stats-schema.test.ts`, `tests/unit/media-title.test.ts`, `tests/unit/timer-view.test.ts`, `tests/browser/engine.test.ts`, `tests/browser/guided.test.ts`

**Interfaces:**
- Consumes: `createMusicVoice` and `MusicVoice` (Task 3); `content/sounds.json` `music` and `breath` (Task 1).
- Produces, in `catalog.ts`:
  ```ts
  export type MusicId = 'schwebend' | 'klavier' | 'obertoene' | 'bambusfloete' | 'zwischen-zwei-atemzuegen' | 'salz-und-sternenlicht' | 'unter-der-oberflaeche'
  export type MusicSource = { kind: 'elevenlabs'; prompt: string; flow: string; generation: string } | { kind: 'gemini'; title: string }
  export interface MusicDef { id: MusicId; title: string; file: string; version: string; seconds: number; bytes: number; source: MusicSource }
  export const MUSIC: readonly MusicDef[]
  export type BackgroundId = SoundId | MusicId
  export type Background = ({ kind: 'nature' } & SoundDef) | ({ kind: 'music' } & MusicDef)
  export function backgroundById(id: BackgroundId): Background // throws 'Unbekannter Klang: ' + id
  export function isBackgroundId(v: unknown): v is BackgroundId
  export function musicUrl(m: MusicDef): string // assetUrl(m.file) + '?v=' + m.version
  export interface BreathDef { id: 'ein' | 'aus'; file: string; prompt: string; flow: string; generation: string }
  export const BREATH: readonly BreathDef[]
  ```
- Produces: in the settings and in `LastUsed` for the timer, the sound fields are `BackgroundId | null`; `TimerSettings.sound`, `ProgramSpec.background` and `GuidedSpec.background` likewise.
- Produces, in the engine:
  - `AudioEngine` options gain `music?: (ctx: AudioContext, url: string) => MusicVoice` (default `createMusicVoice`);
  - `toggle`, `setVolume` and `setBackground` take `BackgroundId`;
  - `EngineSnapshot.volumes`, `loading` and `errors` are keyed by `BackgroundId`.

- [ ] **Step 1: Write the failing unit tests.**
  - `catalog.test.ts`:
    - `'seven music pieces in spec order'` → titles equal the Global Constraints list.
    - `'every music piece is an opus file of its catalogue version and size, all within budget'`:
      - the file exists;
      - `file === 'audio/music/' + id + '.opus'`;
      - the first 10 hex characters of the file's SHA-256 equal `version`;
      - `statSync(...).size === bytes`;
      - the sum of the sizes is ≤ 22000000;
      - `seconds` is in 140…310.
    - `'music and nature ids never collide and backgroundById knows both kinds'`:
      - `backgroundById('klavier').kind === 'music'` and `backgroundById('regen').kind === 'nature'`;
      - `isBackgroundId('klavier')` is true and `isBackgroundId('nichts')` is false.
    - `'the two breath files exist and stay small'`: ids `['ein', 'aus']`, both files exist, together ≤ 150000 bytes.
  - `stats-schema.test.ts`:
    - `'settings and the timer of lastUsed keep a music background'`: `parseData` with `timerSound: 'klavier'`, `guidedSound: 'obertoene'` and `lastUsed.sound: 'schwebend'` returns them unchanged.
    - `'an unknown background falls back'`: `timerSound: 'gibt-es-nicht'` → `null`; a `lastUsed` with that sound is dropped.
  - `media-title.test.ts`: `soundTitles({ volumes: { klavier: 0.7 }, loading: [] })` equals `['Stilles Klavier']`.
  - `timer-view.test.ts`: a summary with `sound: 'klavier'` contains „Stilles Klavier“.
- [ ] **Step 2: Write the failing engine tests.**
  - In `engine.test.ts`, with `music: (ctx) => createMusicVoice(ctx, tone)` where `tone = await toneUrl(3)`:
    - `'toggle plays a music piece as a streamed voice and stops it'`:
      - after `toggle('klavier')` the snapshot is `{ state: 'playing', volumes: { klavier: 0.7 } }` and `voiceCount() === 1`;
      - after `toggle('klavier')` again, the voice count reaches 0, the state is idle and the element is freed (no `src`).
    - `'switching between music and nature keeps exactly one voice'`: regen → klavier → regen; after each switch `volumes` has one key, and finally `voiceCount() === 1`.
    - `'tapping a second piece before the first is ready stops the first'` (Review Focus 3):
      - use a factory whose `ready` resolves on demand and that records its voices;
      - call `toggle('klavier')`, then `toggle('obertoene')`, then resolve both;
      - expect `volumes` to be `{ obertoene: 0.7 }`, the first voice's `stop` to have been called, and `voiceCount() === 1`.
    - `'pause and an interruption hold the music and resume continues where it was'` (Review Focus 2):
      - `pause()` → the music element is paused;
      - `resume()` → it plays, and its `currentTime` ≥ the value at pause;
      - then dispatch `pause` on `out.element` (interruption) → state paused and the music element paused;
      - `resume()` → playing again.
    - `'a music piece that fails to load is marked'`: a factory whose `ready` rejects → `errors` contains `'klavier'`, the state is idle and no voice remains.
    - `'the sleep end stops the music'`: `setSleepTimer(0.05)` with music → idle and the element freed.
  - In `guided.test.ts`:
    - `'a guided session runs on when its music background fails'`: the voice plays and the background id is in `errors`.
    - `'a music background chosen during pause stays silent until resume'`: `setBackground('klavier', 0.35)` while paused → the music element is paused; `resume()` → it plays.
- [ ] **Step 3: Run them to verify they fail.**
  - Run: `npx vitest run tests/unit/catalog.test.ts tests/unit/stats-schema.test.ts tests/unit/media-title.test.ts tests/unit/timer-view.test.ts && npx vitest run --project browser tests/browser/engine.test.ts tests/browser/guided.test.ts`
  - Expected: FAIL.
- [ ] **Step 4: Implement the catalogue and types** as in Interfaces.
  - `schema.ts` validates with `isBackgroundId`.
  - `timer-view` uses `backgroundById(...).title`.
  - `soundTitles` looks through `MUSIC` and `SOUNDS`.
  - Components and `program.ts`/`guided-run.ts` only get the type changes.
- [ ] **Step 5: Implement music in `engine.ts`.**
  - **`playSound`:** for `kind === 'music'`, create the voice synchronously before the first `await` (so `play()` is inside the gesture), then await `starting` and `voice.ready`.
    - If the load is still wanted, `addChannel`; otherwise `voice.stop()`.
    - On rejection: mark the error and `voice.stop()`.
    - If the engine is not `playing` when the voice becomes ready, call `voice.hold()` at once.
  - **`suspendOutput`:** call `voice.hold?.()` for every channel.
  - **`resume`:** after `ensurePlaying`, call `voice.resume?.()` for every active channel, inside the gesture, alongside the guided voice.
  - **Nature sounds:** keep the path unchanged.
- [ ] **Step 6: Run all tests.**
  - Run: `npm run check && npm test`
  - Expected: 0 errors, all PASS (the existing engine, guided, program and e2e-independent suites included).
- [ ] **Step 7: Commit.**
  - `git add -A src tests`
  - `git commit -m "feat: Musik als Klang und Hintergrund – Katalog, Einstellungen, Engine"`

### Task 5: Breath sound instead of the ping

**Files:**
- Create: `src/lib/audio/breath-sound.ts`, `tests/unit/breath-sound.test.ts`
- Delete: `src/lib/audio/cue.ts`
- Modify:
  - `src/lib/audio/program.ts`, `src/lib/audio/engine.ts` (`startProgram` assets)
  - `src/lib/stats/schema.ts` (`breathSound`)
  - `src/lib/ui/heute-view.ts`, `src/screens/Atmen.svelte`, `src/screens/Heute.svelte`, `src/screens/Ich.svelte`
- Test: `tests/browser/program.test.ts` (replace the two cue tests), `tests/unit/stats-schema.test.ts`, `tests/unit/heute-view.test.ts`, `tests/e2e/ich.spec.ts`

**Interfaces:**
- Consumes: `BREATH` (Task 4); `PhaseKind` and `breathPlan` (`src/lib/breath/patterns.ts`).
- Produces, in `breath-sound.ts`:
  ```ts
  export interface BreathBuffers { ein: AudioBuffer; aus: AudioBuffer }
  export const BREATH_GAIN = { ein: 0.25, aus: 0.21 } as const
  export function breathRate(duration: number, length: number): number
  export function scheduleBreath(ctx: BaseAudioContext, destination: AudioNode, when: number, kind: PhaseKind, length: number, buffers: BreathBuffers): AudioBufferSourceNode | null
  ```
- Produces, in `program.ts`:
  - `ProgramAssets` is `{ strike: AudioBuffer | null; breath: BreathBuffers | null }`.
  - `ProgramSpec` gains `assets: readonly ('strike' | 'breath')[]`: the timer has `['strike']`; a breath program has `['breath']`, or `[]` when the sound is off.
  - `breathProgram(id: BreathPatternId, minutes: number, opts: { sound: boolean }): ProgramSpec`.
  - `lastUsedStart(last: LastUsed, breathSound: boolean)`.
- Produces: `Settings.breathSound: boolean`, default `true`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/breath-sound.test.ts`, `'breathRate fits the sound to the phase within 0.75…1.25'`:
    - `breathRate(3.6, 4)` → 0.9;
    - `breathRate(3.6, 1)` → 1.25;
    - `breathRate(6.3, 8)` → 0.7875;
    - `breathRate(3.6, 5.5)` → 0.75;
    - `breathRate(6.3, 4)` → 1.25.
  - `program.test.ts`. Use synthetic buffers filled with 1.0: `ein` 3.6 s, `aus` 6.3 s.
    - `'a breath sound rises to its gain and is silent at the end of its phase'`. Render `scheduleBreath` in an `OfflineAudioContext` (48 kHz):
      - `ein`, L=4, at 0.1: the peak is ≈ 0.25 (±0.005); 0 from 4.1 s on;
      - `ein`, L=1 (Nachatmen): 0 from 1.1 s; source `playbackRate` 1.25;
      - `ein`, L=5.5: 0 from 0.1 + 4.8 s; rate 0.75;
      - `aus`, L=8: peak ≈ 0.21;
      - `halten` returns `null`.
    - `'breathProgram plays a breath sound at every in and out phase'`. With `breathProgram('478', 1, { sound: true })`, spy on `AudioBufferSourceNode.prototype.start`:
      - start times are `[0, 11, 19, 30, 38, 49, 57, 68]`;
      - rates alternate 0.9 and 0.7875;
      - the spec matches `{ assets: ['breath'], background: null, length: 76, finish: 77 }`.
    - `'the sigh gives its 1 s Nachatmen a short sound of its own'`: `'seufzer'` → starts 0, 3 and 4 with rates 1.2, 1.25 and 1.05.
    - `'with the breath sound off a breath program loads and schedules nothing'`: `assets` equals `[]` and no source starts.
    - `'ending a breath program mid-exhale stops the sounding breath at the fade and drops the ones to come'` (Review Focus 5): call `stop(t)` at 12 s → the exhale source started at 11 is stopped at `t`, and every later source is stopped with no time.
    - **Engine:** `'a breath program runs on silently when its breath files fail to load'`: the loader rejects for breath URLs → the program reports at its end. Also `'a breath program never loads the bowl'`: loaded URLs exclude `klangschale.ogg`.
  - `stats-schema.test.ts`: `'breathSound defaults to true and keeps a stored false'`. Data in the M4 shape without the key gives `true`; `false` stays `false` (Review Focus 4).
  - `heute-view.test.ts`: `lastUsedStart(breathLast, false).spec.assets` equals `[]`.
  - `tests/e2e/ich.spec.ts`: `'the breath sound switch sits below vibration and is remembered'`:
    - `getByRole('switch', { name: 'Atemgeräusch bei Atemübungen' })` has `aria-checked` true;
    - click it → false;
    - after a reload it is still false;
    - it directly follows the vibration switch in DOM order.
- [ ] **Step 2: Run them to verify they fail.**
  - Run: `npx vitest run tests/unit/breath-sound.test.ts tests/unit/stats-schema.test.ts tests/unit/heute-view.test.ts && npx vitest run --project browser tests/browser/program.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`breath-sound.ts`:** each source gets its own envelope `GainNode`; `onended` disconnects it.
  - **`breathProgram`:** the phase length is the next cue's `at`, or `plan.length` after the last one. It skips `null` and returns `stopper(ctx, scheduled)`.
  - **`startProgram`:** loads only what `spec.assets` names. `breath` is `{ ein, aus }` only when both files load, otherwise `null`.
  - **Call sites:** pass `{ sound: stats.data.settings.breathSound }` in `Atmen.svelte` and `Heute.svelte`, and `stats.data.settings.breathSound` to `lastUsedStart`.
  - **Ich:** add the switch with the exact label from the Global Constraints, directly below vibration.
  - **Cleanup:** delete `cue.ts` and its two tests.
- [ ] **Step 4: Run all tests.**
  - Run: `npm run check && npm test && npm run build && npx playwright test tests/e2e/ich.spec.ts tests/e2e/atmen.spec.ts`
  - Expected: all PASS.
- [ ] **Step 5: Commit.**
  - `git add -A src tests`
  - `git commit -m "feat: dezentes Atemgeräusch statt Ping, Schalter unter Ich"`

### Task 6: Offline for music

**Files:**
- Modify:
  - `src/lib/offline/meditations.ts`, `src/lib/offline/status.svelte.ts`
  - `src/lib/ui/offline-ui.svelte.ts`, `src/lib/ui/ich-view.ts`, `src/lib/ui/session-ui.svelte.ts`
  - `src/screens/Ich.svelte`
  - `vite.config.ts`
- Test: `tests/browser/offline-meditations.test.ts`, `tests/unit/ich-view.test.ts`, `tests/unit/offline-stale.test.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `MUSIC`, `musicUrl` and `isBackgroundId` (Task 4).
- Produces, in `meditations.ts`:
  - `export const MUSIC_CACHE = 'ruhe-musik'`;
  - `export function cacheNameFor(url: string): string` — `MUSIC_CACHE` when the path contains `/audio/music/`, otherwise `MEDITATION_CACHE`;
  - `saveMeditation` is renamed to `saveAudio` (same signature);
  - `removeStale(currentUrls)` cleans both caches.
- Produces, in `offline-ui.svelte.ts`:
  - `export function absoluteMusicUrl(m: MusicDef, base: string): string`;
  - `export function offlineFiles(): { url: string; bytes: number; kind: 'meditation' | 'music' }[]` (meditations, then music);
  - `export function saveBackgroundForOffline(id: BackgroundId | null): void` — calls `saveForOffline` for a music id, nothing otherwise.
- Produces, in `ich-view.ts`: `offlineSummary(meditations: { saved: number; total: number }, music: { saved: number; total: number }, savedBytes: number, totalBytes: number): string`.

- [ ] **Step 1: Write the failing tests.**
  - `offline-meditations.test.ts`:
    - `'a music file is saved into ruhe-musik with its own content type'`:
      - fake fetch of `/ruhe/audio/music/klavier.opus?v=x` with `Content-Type: audio/ogg`;
      - the entry is in the `ruhe-musik` cache, not in `ruhe-meditations`;
      - the stored `Content-Type` is `audio/ogg`;
      - `isSaved` is true.
    - `'removeStale cleans old versions in both caches'`.
  - `ich-view.test.ts`:
    - `offlineSummary({ saved: 3, total: 9 }, { saved: 2, total: 7 }, 12_400_000, 49_200_000)` → „3 von 9 Meditationen und 2 von 7 Musikstücken offline gespeichert (12,4 MB von 49,2 MB)“;
    - `saveResultMessage({ saved: 16, failed: 0, quota: false }, 16)` → „Alle Meditationen und die Musik sind offline verfügbar.“
  - `pwa.spec.ts`, `'music is not precached, the breath sounds are'`:
    - the precache manifest of the built service worker contains `audio/breath/ein.ogg` and `aus.ogg` and no `.opus`;
    - `curl`-equivalent `request.get('audio/music/klavier.opus')` answers with `content-type` `audio/ogg`.
- [ ] **Step 2: Run them to verify they fail.**
  - Run: `npx vitest run tests/unit/ich-view.test.ts && npx vitest run --project browser tests/browser/offline-meditations.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `saveAudio` stores the response's `Content-Type` (fallback `audio/mpeg`).
  - Add a second `runtimeCaching` entry in `vite.config.ts`:
    - `urlPattern: /\/audio\/music\/.+\.opus(\?.*)?$/`, `CacheFirst`;
    - `cacheName: 'ruhe-musik'`, `rangeRequests: true`;
    - `cacheableResponse: { statuses: [200], headers: { 'Content-Type': 'audio/ogg' } }`;
    - plus a comment in the style of the meditation route.
  - `saveAllOffline` uses `offlineFiles()`.
  - In `Ich.svelte`: the new summary, and `refreshSaved` over all files.
  - In `session-ui`: `saveBackgroundForOffline` for the guided background and the timer sound when a session starts.
  - If the vite preview server does not answer `.opus` with `audio/ogg`, record that in the ledger and make the route header match what it does answer (GitHub Pages uses mime-db: `audio/ogg`).
- [ ] **Step 4: Run all tests.**
  - Run: `npm run check && npm test && npm run build && npx playwright test tests/e2e/pwa.spec.ts tests/e2e/ich.spec.ts`
  - Expected: all PASS.
- [ ] **Step 5: Commit.**
  - `git add -A src tests vite.config.ts`
  - `git commit -m "feat: Musik offline speichern – eigener Cache, Range-Route, Ich zeigt alles"`

### Task 7: Klänge – Musik and Natur

**Files:**
- Modify:
  - `src/screens/Klaenge.svelte`, `src/components/SoundTile.svelte`
  - `src/lib/content/motive.ts`, `src/lib/sounds/catalog.ts` (`TITLE_BREAKS`)
- Test: `tests/unit/motive.test.ts`, `tests/unit/catalog.test.ts`, `tests/e2e/klaenge.spec.ts`, `tests/e2e/pwa.spec.ts` (28 → 35 motifs)

**Interfaces:**
- Consumes:
  - `MUSIC`, `SOUNDS`, `Background` and `backgroundById` (Task 4);
  - `offline`, `refreshSaved`, `absoluteMusicUrl` and `saveBackgroundForOffline` (Task 6);
  - the motif files (Task 2).
- Produces:
  - in `motive.ts`: `musicMotiv(id: MusicId): MotivId` (`musik-<id>`) and `backgroundMotiv(id: BackgroundId): MotivId`;
  - `SoundTile` takes `{ sound: Background }`.

- [ ] **Step 1: Write the failing tests.**
  - `motive.test.ts`: the helpers name `musik-<id>` for all 7 music pieces. The 35 ids each have a file; the limit for `musik-` is 90000 bytes, like `klang-`.
  - `catalog.test.ts`: extend the soft-hyphen test to `MUSIC`. The expected breaks are `Schwe­bende`, `Bambus­flöte`, `Sternen­licht` and `Ober­fläche`.
  - `klaenge.spec.ts`:
    - `'music comes first, then nature'`:
      - the headings „Musik“ and „Natur“ appear in this order;
      - `button[aria-pressed]` has the 7 music titles followed by the 8 nature titles;
      - every music tile shows its motif (`expectMotiv`).
    - `'a music piece plays, switches with nature and shows in the mini player'`:
      - tap „Stilles Klavier“ → pressed, with slider „Lautstärke Stilles Klavier“;
      - tap „Regen“ → exactly one pressed;
      - the mini player on Heute shows the playing title.
    - `'offline, unsaved music is disabled and says so'`: `context.setOffline(true)` → the button „Stilles Klavier“ is disabled and „Nicht offline verfügbar“ is visible beside it. Nature tiles stay enabled.
  - `pwa.spec.ts`: rename the 28-motif test to 35.
- [ ] **Step 2: Run them to verify they fail.**
  - Run: `npx vitest run tests/unit/motive.test.ts tests/unit/catalog.test.ts && npm run build && npx playwright test tests/e2e/klaenge.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`Klaenge.svelte`:** two sections, each with an `h2` („Musik“, „Natur“) and the M4.1 heading line, both using the existing grid. On mount, `refreshSaved` the music URLs.
  - **`SoundTile`:**
    - the motif comes from `backgroundMotiv`;
    - for music, show `OfflineMark` in the label when it is saved;
    - when it is offline and not saved, the button is `disabled` and is described by „Nicht offline verfügbar“ (`aria-describedby`), dimmed like the meditations;
    - starting a music piece calls `saveBackgroundForOffline`.
- [ ] **Step 4: Run all tests.**
  - Run: `npm run check && npm test && npm run build && npx playwright test`
  - Expected: all PASS.
- [ ] **Step 5: Commit.**
  - `git add -A src tests`
  - `git commit -m "feat: Klänge mit Musik und Natur, Musikkacheln mit Motiv und Offline-Zustand"`

### Task 8: Grouped background selection

**Files:**
- Modify: `src/components/SoundSelect.svelte`
- Test: `tests/e2e/timer.spec.ts`, `tests/e2e/guided.spec.ts`

**Interfaces:**
- Consumes: `MUSIC`, `SOUNDS` and `BackgroundId` (Task 4); `offline`, `refreshSaved` and `absoluteMusicUrl` (Task 6).
- Produces: `SoundSelect` keeps its props, with `value: BackgroundId | null`.

- [ ] **Step 1: Write the failing tests.**
  - `timer.spec.ts`, `'the background select groups music before nature and a music piece runs under the timer'`:
    - the select has the `optgroup` labels `['Musik', 'Natur']`;
    - the first option is „Keiner“;
    - choose „Stilles Klavier“ and start → the summary/mini player shows the timer;
    - the setting survives a reload.
  - `guided.spec.ts`, `'offline, unsaved music options are disabled with a hint'`:
    - `context.setOffline(true)` → the option „Stilles Klavier – nicht offline verfügbar“ is disabled;
    - nature options stay enabled.
- [ ] **Step 2: Run them to verify they fail.**
  - Run: `npm run build && npx playwright test tests/e2e/timer.spec.ts tests/e2e/guided.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement the groups and the disabled state.** Use `refreshSaved` on mount for the music URLs.
- [ ] **Step 4: Run all tests.**
  - Run: `npm run check && npm test && npx playwright test`
  - Expected: all PASS.
- [ ] **Step 5: Commit.**
  - `git add -A src tests`
  - `git commit -m "feat: Hintergrundauswahl mit Gruppen Musik und Natur, offline ehrlich"`

### Task 9: Docs and checklist

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-23-ruhe-m5-musik-atem-design.md` (notes only, if rulings changed anything)

- [ ] **Step 1: Update the README.**
  - **Credits:** „Musik: ElevenLabs Music (4 Stücke) und vom Nutzer mit Gemini erstellt (3 Stücke).“
  - **Section „Musik aufbereiten“:** usage of `scripts/musik.py musik|atem`, the target values, and how to swap a piece (file, `version`, `bytes`, `seconds`).
  - **„Handy-Checkliste Meilenstein 5“:** the six points from spec §8, verbatim.
- [ ] **Step 2: Note in the spec** any ruling from the ledger that changes behaviour. Mark it *Ergänzung vom …*, as in M4.
- [ ] **Step 3: Run the full verification.**
  - Run: `npm run check && npm test && npm run build && npx playwright test`
  - Expected: 0 errors, all PASS.
- [ ] **Step 4: Commit.**
  - `git add README.md docs/superpowers/specs/2026-10-23-ruhe-m5-musik-atem-design.md`
  - `git commit -m "docs: README Musik, Handy-Checkliste Meilenstein 5"`
