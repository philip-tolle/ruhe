# Meilenstein 1: Grundgerüst, Audio-Engine & Klänge – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine installierbare, offline-fähige Web-App „Ruhe“ mit Abendhimmel-Design, Reiterleiste, einer Audio-Engine für 8 kombinierbare Klänge (4 live erzeugt, 4 Platzhalter-Loops) und Sleep-Timer, automatisch veröffentlicht auf GitHub Pages.

**Architecture:** Vite + Svelte 5 + TypeScript. Die Audio-Logik liegt UI-frei in `src/lib/audio/`: reine Funktionen (Rauschen, Sleep-Plan, Titel) sind in Node getestet, alles mit Web Audio wird in echtem Chromium getestet (Vitest Browser Mode). Ein `AudioContext` mischt alle Quellen und gibt über einen `MediaStreamAudioDestinationNode` an ein verstecktes `<audio>`-Element aus, damit Android die App als Medienwiedergabe behandelt. Alle Zeitabläufe laufen auf der Audio-Uhr.

**Tech Stack:** Vite 8, Svelte 5, TypeScript 6, vite-plugin-pwa 2 (Workbox), Vitest 5 (Node + Browser Mode via Playwright), Playwright 1.56.1 (E2E), ffmpeg/libopus (Platzhalter-Audio), GitHub Actions → Pages.

**Spec:** `docs/superpowers/specs/2026-10-21-ruhe-design.md` – dieser Plan setzt Meilenstein 1 (Spec §11) um. Bei Unklarheiten gilt die Spec.

**Branch:** Gearbeitet wird auf `meilenstein-1`. Veröffentlicht wird erst nach dem Merge in `main` (Task 10).

## Global Constraints

- Node ≥ 22.18 (Vite 8 und natives Ausführen von `.ts` in Node-Skripten).
- Exakte Paketversionen (ohne `^`): `vite 8.3.5`, `svelte 5.57.2`, `@sveltejs/vite-plugin-svelte 7.3.1`, `vite-plugin-pwa 2.0.0`, `workbox-window 7.4.1`, `vitest 5.0.5`, `@vitest/browser-playwright 5.0.5`, `playwright 1.56.1`, `@playwright/test 1.56.1`, `typescript 6.0.3`, `svelte-check 4.7.7`, `@tsconfig/svelte 5.0.8`, `@fontsource-variable/fraunces 5.3.0`, `@fontsource-variable/nunito-sans 5.3.0`. Playwright bleibt auf 1.56.1, weil das zu den vorinstallierten Browsern in `/opt/pw-browsers` passt. **Nie** `playwright install` lokal ausführen (in CI ist es nötig).
- Vite `base` ist `/ruhe/`. Asset-URLs im Code immer über `import.meta.env.BASE_URL` bilden, nie mit führendem `/`.
- Gesamte Oberfläche auf Deutsch, Du-Form. Texte, die dieser Plan vorgibt, werden wörtlich übernommen.
- **Audio-Zeitsteuerung nie über `setTimeout`/`setInterval`.** Abläufe werden auf der `AudioContext`-Uhr eingeplant (`start(when)`, `stop(when)`, `AudioParam`-Rampen, `onended`); Modulation über `OscillatorNode`-LFOs und geloopte Puffer. JS-Timer sind nur für die *Anzeige* erlaubt.
- Genau ein `AudioContext` in der App. Ausgabe nur über `MediaStreamAudioDestinationNode` → verstecktes `<audio>`. **Nie** mit `ctx.destination` verbinden.
- Farben exakt (Spec §7): `#0B1026`, `#1B2350`, `#3A2F5B`, Akzent `#F2C98A`, Text `#EEF0FA`, gedämpft `#A9AFCB`.
- Tippflächen ≥ 48 px. Kontrast mindestens WCAG AA. Ohne `prefers-reduced-motion: no-preference` keine Animationen.
- Zur Laufzeit keine Anfragen an fremde Hosts: Schriften sind über npm gebündelt.
- Loops und Klangschale: Ogg/Opus, Stereo, 48 kHz, 96 kbit/s, unter `public/audio/sounds/`.
- Meilenstein 1 speichert nichts dauerhaft (kein `localStorage`). Das Schema `ruhe.v1` gehört zu Meilenstein 2.
- Jede Commit-Nachricht endet mit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YFBD4q9VZrxdFh2nUt9NdS
  ```

## Review Focus

Bedingungen, die die Spec impliziert, für die aber sonst kein Test sorgt (wahrscheinlichste zuerst). Die zugehörigen Tests stehen in Task 6 bzw. Task 7.

1. **Schnelles Mehrfach-Tippen auf denselben Klang**, auch während sein Loop noch lädt → nie zwei gleichzeitige Stimmen desselben Klangs. Der Endzustand folgt der Anzahl der Tipps (ungerade = an). *(Task 7: `rapid toggles never duplicate a voice`)*
2. **Sleep-Timer während der Wiedergabe ändern**, auch mitten im Ausblenden → neuer Plan ab jetzt, Lautstärke kehrt auf 100 % zurück. „Endlos“ hebt das Ausblenden auf. *(Task 7: `changing sleep timer during fade restores volume`)*
3. **Systemunterbrechung** (Anruf, andere App pausiert das Medien-Element) → Engine wechselt auf „pausiert“, die Restzeit friert ein, „Weiter“ setzt fort. *(Task 7: `external pause of the media element pauses the engine`)*
4. **Loop-Datei nicht ladbar** (offline vor dem ersten Cachen, Datei fehlt) → nur dieser Klang zeigt einen Fehler, andere laufen weiter, erneutes Tippen versucht es neu. *(Task 7: `failed loop load marks only that sound as error`)*
5. **Rückkehr nach Stunden im Hintergrund, Sleep-Timer längst abgelaufen** → Zustand „idle“, keine negative Restzeit, keine hängenden Stimmen, Audio-Uhr angehalten. *(Task 7: `sleep timer end returns to idle`; Task 6: `formatRemaining clamps negatives`)*

---

## Dateistruktur (Meilenstein 1)

```
package.json, index.html, vite.config.ts, vitest.config.ts, playwright.config.ts,
tsconfig.json, svelte.config.js, .gitignore, README.md
.github/workflows/deploy.yml
content/sounds.json                    Klang-Definitionen inkl. ElevenLabs-Prompts
scripts/placeholders.mjs               Platzhalter-Loops + Klangschale (ffmpeg)
scripts/icons.mjs                      PNG-Icons aus icon.svg (Playwright)
public/audio/sounds/*.ogg              erzeugt, eingecheckt
public/icons/icon.svg, *.png
src/main.ts, src/App.svelte, src/app.css
src/lib/random.ts                      Seeded RNG (keine Imports – wird auch von Node-Skripten genutzt)
src/lib/ui/tabs.ts                     Reiter-Definitionen
src/lib/time/greeting.ts               Begrüßung nach Tageszeit
src/lib/time/format.ts                 Restzeit-Format
src/lib/audio/noise.ts                 Rausch-/Tropfen-Generatoren (keine Imports)
src/lib/audio/voice.ts                 Voice-Interface
src/lib/audio/live-sounds.ts           Graph-Rezepte der 4 Live-Klänge
src/lib/audio/loops.ts                 Laden/Dekodieren + Loop-Stimme
src/lib/audio/sleep-timer.ts           Sleep-Plan
src/lib/audio/media-title.ts           Titel für Benachrichtigung/Mini-Player
src/lib/audio/output.ts                AudioContext + Medien-Ausgang
src/lib/audio/media-session.ts         Media-Session-Abgleich
src/lib/audio/engine.ts                AudioEngine (Mischpult, Sleep-Timer, Zustand)
src/lib/audio/engine-store.svelte.ts   reaktiver Zustand für die UI
src/lib/sounds/catalog.ts              typisierter Klang-Katalog
src/lib/pwa/update.svelte.ts           Service-Worker-Registrierung + Update-Hinweis
src/components/Sky.svelte, TabBar.svelte, SoundTile.svelte, SleepTimerPicker.svelte,
               MiniPlayer.svelte, UpdateToast.svelte, icons.ts
src/screens/Heute.svelte, Meditieren.svelte, Atmen.svelte, Klaenge.svelte, Ich.svelte
tests/unit/*.test.ts                   Vitest, Node
tests/browser/*.test.ts                Vitest Browser Mode, Chromium, echtes Web Audio
tests/e2e/*.spec.ts                    Playwright gegen den Produktions-Build
```

---

### Task 1: Projektgerüst & Testwerkzeuge

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `svelte.config.js`, `.gitignore`, `src/main.ts`, `src/App.svelte`, `src/vite-env.d.ts`
- Test: `tests/browser/smoke.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `preview` (`vite preview --port 4173 --strictPort`), `check` (`svelte-check --tsconfig ./tsconfig.json`), `test` (`vitest run`), `test:e2e` (`playwright test`), `placeholders` (`node scripts/placeholders.mjs`), `icons` (`node scripts/icons.mjs`). Vitest-Projekte `unit` (`tests/unit/**/*.test.ts`, Node) und `browser` (`tests/browser/**/*.test.ts`, Chromium).

- [ ] **Step 1: Branch anlegen**

```bash
git checkout -b meilenstein-1
```

- [ ] **Step 2: Gerüst-Dateien anlegen**

`package.json`: `"type": "module"`, `"private": true`, `"engines": { "node": ">=22.18" }`, die Skripte aus *Interfaces*, Versionen aus *Global Constraints*. Die beiden `@fontsource-variable/*` stehen unter `dependencies`, alles andere unter `devDependencies`.

`tsconfig.json`: erweitert `@tsconfig/svelte/tsconfig.json`; `target`/`module` `ES2022`/`ESNext`, `moduleResolution: "bundler"`, `strict: true`, `resolveJsonModule: true`, `types: ["vite/client", "vite-plugin-pwa/client"]`; include `src`, `tests`, `scripts`, `*.config.ts`.

`svelte.config.js`: `preprocess: vitePreprocess()`.

`vite.config.ts`: `base: '/ruhe/'`, Plugin `svelte()`. Das PWA-Plugin kommt in Task 9 dazu.

`vitest.config.ts` (eigenständig, lädt `vite.config.ts` bewusst nicht):

```ts
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
```

`playwright.config.ts`: `testDir: 'tests/e2e'`, `webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173/ruhe/', reuseExistingServer: !process.env.CI, timeout: 120_000 }`, `use: { baseURL: 'http://localhost:4173/ruhe/', ...devices['Pixel 7'], launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } }`, nur ein Projekt `chromium`.

`index.html`: `lang="de"`, `<title>Ruhe</title>`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<div id="app">`, Script `/src/main.ts`.

`src/App.svelte`: vorerst nur `<main><h1>Ruhe</h1></main>`. `src/main.ts` mountet `App` mit `mount()` aus `svelte`.

`.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.vite`.

- [ ] **Step 3: Abhängigkeiten installieren**

Run: `npm install`
Expected: Exit 0, `package-lock.json` entsteht.

- [ ] **Step 4: Smoke-Tests schreiben**

```ts
// tests/browser/smoke.test.ts
import { test, expect } from 'vitest'
test('offline audio context renders an oscillator', async () => {
  const ctx = new OfflineAudioContext(1, 22050, 22050)
  const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.start()
  const data = (await ctx.startRendering()).getChannelData(0)
  const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
  expect(rms).toBeGreaterThan(0.5)
})
```

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'
test('app starts with title Ruhe', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('Ruhe')
})
```

- [ ] **Step 5: Alles prüfen**

Run: `npm run check && npm test && npm run test:e2e`
Expected: svelte-check meldet 0 Fehler; Vitest `browser` 1 passed; Playwright 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Projektgerüst mit Vite, Svelte, Vitest und Playwright"
```

---

### Task 2: Gestaltung & App-Shell mit Reiterleiste

**Files:**
- Create: `src/app.css`, `src/lib/random.ts`, `src/lib/ui/tabs.ts`, `src/lib/time/greeting.ts`, `src/components/Sky.svelte`, `src/components/TabBar.svelte`, `src/screens/Heute.svelte`, `src/screens/Meditieren.svelte`, `src/screens/Atmen.svelte`, `src/screens/Klaenge.svelte`, `src/screens/Ich.svelte`
- Modify: `src/App.svelte`, `src/main.ts`
- Test: `tests/unit/greeting.test.ts`, `tests/unit/random.test.ts`, `tests/e2e/navigation.spec.ts`

**Interfaces:**
- Produces:
  - `createRng(seed: number): () => number` in `src/lib/random.ts`: mulberry32, liefert Werte in [0, 1). **Die Datei importiert nichts** (wird in Task 5 von einem Node-Skript direkt geladen).
  - `type TabId = 'heute' | 'meditieren' | 'atmen' | 'klaenge' | 'ich'`; `TABS: readonly { id: TabId; label: string }[]` in Reihenfolge mit den Labels `Heute`, `Meditieren`, `Atmen`, `Klänge`, `Ich`.
  - `greetingFor(date: Date): string` in `src/lib/time/greeting.ts`.
  - `App.svelte` hält `let tab = $state<TabId>('heute')` und reicht `onNavigate: (tab: TabId) => void` an Screens und Komponenten weiter, die navigieren müssen.
  - CSS-Variablen in `src/app.css`: `--sky-top`, `--sky-mid`, `--sky-bottom`, `--accent`, `--text`, `--text-muted`, `--font-display: 'Fraunces Variable'`, `--font-body: 'Nunito Sans Variable'`, `--tabbar-height`.

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/unit/greeting.test.ts
import { test, expect } from 'vitest'
import { greetingFor } from '../../src/lib/time/greeting'
const at = (h: number, m = 0) => new Date(2026, 9, 21, h, m)
test.each([
  [at(5), 'Guten Morgen'], [at(10, 59), 'Guten Morgen'],
  [at(11), 'Guten Tag'], [at(16, 59), 'Guten Tag'],
  [at(17), 'Guten Abend'], [at(0), 'Guten Abend'], [at(4, 59), 'Guten Abend'],
])('greetingFor(%s) = %s', (d, expected) => expect(greetingFor(d)).toBe(expected))
```

```ts
// tests/unit/random.test.ts
import { test, expect } from 'vitest'
import { createRng } from '../../src/lib/random'
test('same seed gives same sequence, values in [0,1)', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43)
  const sa = Array.from({ length: 1000 }, a), sb = Array.from({ length: 1000 }, b)
  expect(sa).toEqual(sb)
  expect(Array.from({ length: 1000 }, c)).not.toEqual(sa)
  expect(sa.every(v => v >= 0 && v < 1)).toBe(true)
})
```

```ts
// tests/e2e/navigation.spec.ts
import { test, expect } from '@playwright/test'
test('tab bar navigates between all five screens', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 8, 0))
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await expect(nav.getByRole('button')).toHaveText(['Heute', 'Meditieren', 'Atmen', 'Klänge', 'Ich'])
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  await expect(nav.getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
  for (const label of ['Meditieren', 'Atmen', 'Ich']) {
    await nav.getByRole('button', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    await expect(page.getByText('Kommt mit dem nächsten Update.')).toBeVisible()
  }
  await nav.getByRole('button', { name: 'Klänge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await nav.getByRole('button', { name: 'Heute' }).click()
  await page.getByRole('button', { name: 'Zu den Klängen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npm test -- --project unit && npx playwright test navigation`
Expected: FAIL (Module bzw. Navigation existieren nicht).

- [ ] **Step 3: Implementieren**

- `greetingFor`: Morgen 5:00–10:59, Tag 11:00–16:59, Abend 17:00–4:59 (lokale Zeit).
- `main.ts` importiert `@fontsource-variable/fraunces`, `@fontsource-variable/nunito-sans` und `./app.css`.
- `app.css`: Variablen (Werte aus *Global Constraints*), `body` mit Hintergrundfarbe `--sky-top`, Textfarbe `--text`, Schrift `--font-body`; Überschriften in `--font-display`. Inhaltsspalte max. 560 px, 16 px Seitenrand, unten Platz für Reiterleiste plus `env(safe-area-inset-bottom)`.
- `Sky.svelte`: fester Vollbild-Hintergrund hinter allem (`position: fixed; z-index: -1`) mit vertikalem Verlauf `--sky-top` → `--sky-mid` → `--sky-bottom`; ca. 40 Sterne mit Positionen aus `createRng(7)`, die nur unter `@media (prefers-reduced-motion: no-preference)` funkeln; unten Berg- und Seesilhouette als Inline-SVG in dunklen Tönen, so dezent, dass Text darüber AA-Kontrast behält.
- `TabBar.svelte`: `<nav aria-label="Hauptnavigation">` mit fünf `<button>` (Icon + Label, min. 48 px hoch), aktiver Reiter mit `aria-current="page"` und Akzentfarbe; fest am unteren Rand.
- Screens: jeweils ein `<h1>`. `Heute`: `<h1>{greetingFor(new Date())}</h1>`, darunter „Schön, dass du da bist.“ und eine Karte mit dem Button „Zu den Klängen“ (`onNavigate('klaenge')`). `Meditieren`, `Atmen`, `Ich`: `<h1>` mit dem Reiter-Label plus Absatz „Kommt mit dem nächsten Update.“. `Klaenge`: vorerst nur `<h1>Klänge</h1>`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- --project unit && npx playwright test navigation && npm run check`
Expected: PASS, 0 svelte-check-Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Abendhimmel-Design, Reiterleiste und Bildschirm-Gerüste"
```

---

### Task 3: Rausch- und Tropfen-Generatoren

**Files:**
- Create: `src/lib/audio/noise.ts`
- Test: `tests/unit/noise.test.ts`

**Interfaces:**
- Consumes: `createRng` (Task 2), nur in Tests bzw. vom Aufrufer.
- Produces (in `src/lib/audio/noise.ts`; **die Datei importiert nichts**):
  - `type NoiseColor = 'white' | 'pink' | 'brown'`
  - `fillNoise(out: Float32Array, color: NoiseColor, rng: () => number, crossfade = 4096): Float32Array`: füllt `out` nahtlos loopbar, normalisiert auf RMS 0,25, auf ±1 begrenzt; gibt `out` zurück.
  - `fillDroplets(out: Float32Array, rng: () => number, sampleRate: number, perSecond: number): Float32Array`: kurze, abklingende Sinus-Impulse an zufälligen Stellen; Spitzenwert auf 0,9 normalisiert (bei 0 Tropfen alles 0); nahtlos loopbar.

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/unit/noise.test.ts
import { test, expect } from 'vitest'
import { fillNoise, fillDroplets, type NoiseColor } from '../../src/lib/audio/noise'
import { createRng } from '../../src/lib/random'

const N = 48000 * 2
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
const meanStep = (a: Float32Array) => { let s = 0; for (let i = 1; i < a.length; i++) s += Math.abs(a[i] - a[i - 1]); return s / (a.length - 1) }
const gen = (c: NoiseColor, seed = 1) => fillNoise(new Float32Array(N), c, createRng(seed))

test('deterministic per seed', () => {
  expect(gen('pink', 5)).toEqual(gen('pink', 5))
  expect(gen('pink', 5)).not.toEqual(gen('pink', 6))
})

test.each(['white', 'pink', 'brown'] as const)('%s is bounded and normalized', (c) => {
  const a = gen(c)
  expect(a.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true)
  expect(rms(a)).toBeGreaterThan(0.2); expect(rms(a)).toBeLessThan(0.3)
})

test('spectral tilt: white > pink > brown, brown is smooth', () => {
  const r = (c: NoiseColor) => { const a = gen(c); return meanStep(a) / rms(a) }
  expect(r('white')).toBeGreaterThan(r('pink'))
  expect(r('pink')).toBeGreaterThan(r('brown'))
  expect(r('brown')).toBeLessThan(0.1)
})

test.each(['pink', 'brown'] as const)('%s loops without a jump at the seam', (c) => {
  for (let seed = 1; seed <= 10; seed++) {
    const a = gen(c, seed)
    expect(Math.abs(a[N - 1] - a[0])).toBeLessThan(5 * meanStep(a))
  }
})

test('droplets: silence at 0/s, normalized peak otherwise', () => {
  expect(fillDroplets(new Float32Array(N), createRng(1), 48000, 0).every(v => v === 0)).toBe(true)
  const d = fillDroplets(new Float32Array(N), createRng(1), 48000, 20)
  const peak = d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  expect(peak).toBeGreaterThan(0.89); expect(peak).toBeLessThanOrEqual(0.9 + 1e-6)
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npm test -- --project unit noise`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

- Weiß: `rng() * 2 - 1`. Rosa: Paul-Kellet-Filter (7 Koeffizienten) auf weißes Rauschen. Braun: Leaky-Integrator `b = (b + 0.02 * w) / 1.02`.
- Nahtlosigkeit: intern `out.length + crossfade` Rohwerte erzeugen. Dann `out[i] = raw[i]·sin(π/2·i/F) + raw[n+i]·cos(π/2·i/F)` für `i < F`, sonst `out[i] = raw[i]`. Danach Normalisierung und Begrenzung.
- Tropfen: pro Sample Start mit Wahrscheinlichkeit `perSecond / sampleRate`. Jeder Tropfen: Sinus 1500–4500 Hz, Abklingzeit 4–12 ms, Amplitude 0,2–1,0. Indizes werden modulo `out.length` geschrieben (Überlauf landet am Anfang, dadurch nahtlos). Am Ende Spitzenwert-Normalisierung auf 0,9.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- --project unit noise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/noise.ts tests/unit/noise.test.ts && git commit -m "feat: nahtlose Rausch- und Tropfen-Generatoren"
```

---

### Task 4: Live-Klänge (Regen, Meer, Wind, braunes Rauschen)

**Files:**
- Create: `src/lib/audio/voice.ts`, `src/lib/audio/live-sounds.ts`
- Test: `tests/browser/live-sounds.test.ts`

**Interfaces:**
- Consumes: `fillNoise`, `fillDroplets` (Task 3), `createRng` (Task 2).
- Produces:
  - `src/lib/audio/voice.ts`: `interface Voice { output: AudioNode; stop(when?: number): void }`. `output` ist unverbunden, der Aufrufer verbindet ihn. `stop` beendet alle Quellen und LFOs zum Zeitpunkt `when` (Standard: sofort).
  - `src/lib/audio/live-sounds.ts`:
    - `type LiveSoundId = 'regen' | 'meer' | 'wind' | 'braun'`
    - `interface NoiseBank { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer; dropsA: AudioBuffer; dropsB: AudioBuffer }`
    - `createNoiseBank(ctx: BaseAudioContext, seed = 1): NoiseBank`: Rauschen 15 s mono; Tropfen 13 s (`dropsA`) und 17 s (`dropsB`) mono, je 12 Tropfen/s. Durch die zwei Längen wiederholt sich das Muster erst nach 221 s.
    - `createLiveSound(ctx: BaseAudioContext, id: LiveSoundId, bank: NoiseBank): Voice`

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/browser/live-sounds.test.ts
import { test, expect } from 'vitest'
import { createNoiseBank, createLiveSound, type LiveSoundId } from '../../src/lib/audio/live-sounds'

const SR = 22050
async function render(id: LiveSoundId, seconds: number, stopAt?: number) {
  const ctx = new OfflineAudioContext(1, SR * seconds, SR)
  const v = createLiveSound(ctx, id, createNoiseBank(ctx))
  v.output.connect(ctx.destination)
  if (stopAt !== undefined) v.stop(stopAt)
  return (await ctx.startRendering()).getChannelData(0)
}
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length))
const zcr = (a: Float32Array) => { let z = 0; for (let i = 1; i < a.length; i++) if ((a[i] >= 0) !== (a[i - 1] >= 0)) z++; return z / a.length }

test.each(['regen', 'meer', 'wind', 'braun'] as const)('%s renders audible, bounded sound', async (id) => {
  const d = await render(id, 3)
  expect(d.every(Number.isFinite)).toBe(true)
  expect(d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(1)
  const tail = rms(d.subarray(SR))
  expect(tail).toBeGreaterThan(0.02); expect(tail).toBeLessThan(0.5)
})

test('meer swells in waves', async () => {
  const d = await render('meer', 24)
  const win = Array.from({ length: 24 }, (_, i) => rms(d.subarray(i * SR, (i + 1) * SR)))
  expect(Math.max(...win) / Math.min(...win)).toBeGreaterThan(1.5)
})

test('braun is darker than regen', async () => {
  expect(zcr(await render('braun', 2))).toBeLessThan(zcr(await render('regen', 2)) / 2)
})

test('stop(when) silences everything', async () => {
  const d = await render('regen', 2, 1)
  expect(rms(d.subarray(Math.round(SR * 1.05)))).toBeLessThan(1e-6)
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npm test -- --project browser live-sounds`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

Puffer-Quellen laufen mit `loop = true` und starten an zufälligem Offset (`start(0, offset)`). Ein LFO ist `OscillatorNode` (Sinus) → `GainNode` (Tiefe) → Ziel-`AudioParam`; der Grundwert steht im Parameter. Startwerte (Feinschliff nach Gehör ist erlaubt, solange die Tests grün bleiben):

| Klang | Kette |
|---|---|
| `braun` | brown → Tiefpass 500 Hz (Q 0,7) → Gain 0,9 |
| `regen` | pink → Hochpass 500 Hz → Tiefpass 7000 Hz → Gain 0,6; dazu dropsA + dropsB → Bandpass 3000 Hz (Q 0,8) → Gain 0,35 |
| `meer` | brown → Tiefpass 600 Hz (LFO 0,09 Hz, ±350 Hz) → Gain 0,55 (LFOs 0,083 Hz ±0,3 und 0,137 Hz ±0,12) |
| `wind` | pink → Bandpass 500 Hz, Q 1,2 (LFOs 0,05 Hz ±250 Hz und 0,13 Hz ±120 Hz) → Gain 0,5 (LFO 0,07 Hz ±0,25) |

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- --project browser live-sounds`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/voice.ts src/lib/audio/live-sounds.ts tests/browser/live-sounds.test.ts && git commit -m "feat: live erzeugte Klänge Regen, Meer, Wind und braunes Rauschen"
```

---

### Task 5: Klang-Katalog, Platzhalter-Loops & Loop-Wiedergabe

**Files:**
- Create: `content/sounds.json`, `src/lib/sounds/catalog.ts`, `scripts/placeholders.mjs`, `src/lib/audio/loops.ts`, `public/audio/sounds/{wald,kaminfeuer,bach,klangschalen,klangschale}.ogg` (erzeugt)
- Test: `tests/unit/catalog.test.ts`, `tests/browser/loops.test.ts`

**Interfaces:**
- Consumes: `Voice` (Task 4); `fillNoise`, `fillDroplets` (Task 3) und `createRng` (Task 2) im Node-Skript, direkt als `.ts` importiert.
- Produces:
  - `content/sounds.json`: `{ "sounds": SoundDef[], "effects": EffectDef[] }`
  - `src/lib/sounds/catalog.ts`:
    - `type SoundId = 'regen' | 'meer' | 'wind' | 'braun' | 'wald' | 'kaminfeuer' | 'bach' | 'klangschalen'`
    - `interface SoundDef { id: SoundId; title: string; kind: 'live' | 'loop'; file?: string; prompt?: string }`
    - `interface EffectDef { id: 'klangschale'; title: string; file: string; prompt: string }`
    - `SOUNDS: readonly SoundDef[]`, `EFFECTS: readonly EffectDef[]`, `soundById(id: SoundId): SoundDef`, `assetUrl(file: string): string` (= `import.meta.env.BASE_URL + file`)
  - `src/lib/audio/loops.ts`:
    - `loadBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer>`: memoisiert je Kontext und URL (`WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>`). Bei HTTP- oder Dekodierfehler: Reject mit `Error('Konnte nicht geladen werden: ' + url)`. Fehlgeschlagene Ladevorgänge werden **nicht** gecacht.
    - `createLoopVoice(ctx: BaseAudioContext, buffer: AudioBuffer): Voice`: `AudioBufferSourceNode`, `loop = true`, Start sofort an zufälligem Offset.

- [ ] **Step 1: `content/sounds.json` anlegen**

Reihenfolge und Titel exakt (Spec §3.4):

| id | title | kind | file |
|---|---|---|---|
| regen | Regen | live | – |
| meer | Meeresrauschen | live | – |
| wind | Wind | live | – |
| braun | Braunes Rauschen | live | – |
| wald | Wald mit Vögeln | loop | `audio/sounds/wald.ogg` |
| kaminfeuer | Kaminfeuer | loop | `audio/sounds/kaminfeuer.ogg` |
| bach | Bach | loop | `audio/sounds/bach.ogg` |
| klangschalen | Klangschalen | loop | `audio/sounds/klangschalen.ogg` |

`effects`: `{ "id": "klangschale", "title": "Klangschale", "file": "audio/sounds/klangschale.ogg", ... }`.

Prompts (englisch, für Meilenstein 4):
- wald: `"Peaceful forest ambience in the early morning, gentle birdsong from several distant birds, soft rustling leaves, no wind gusts, seamless loop"`
- kaminfeuer: `"Cozy crackling fireplace, steady soft crackles and gentle pops, close and warm, no music, seamless loop"`
- bach: `"Gentle mountain stream, steady water flowing over small stones, calm and continuous, no birds, seamless loop"`
- klangschalen: `"Slow ambient Tibetan singing bowls, soft overlapping resonant tones, meditative drone, no percussion, seamless loop"`
- klangschale: `"Single strike of a Tibetan singing bowl, clear warm resonance, long natural decay, close recording"`

- [ ] **Step 2: Platzhalter-Skript schreiben und ausführen**

`scripts/placeholders.mjs` erzeugt PCM (Float32, 48 kHz, Stereo) in Node und kodiert per `ffmpeg -f f32le -ar 48000 -ac 2 -i pipe:0 -c:a libopus -b:a 96k <ziel>.ogg -y`. Vorhandene Dateien werden überschrieben. Vorgaben:

- Die 4 Loops sind **exakt 20,000 s** lang und nahtlos loopbar:
  - Rauschanteile über `fillNoise`.
  - Filter im Skript zirkulär anwenden (Puffer zweimal durchlaufen, zweiten Durchlauf behalten).
  - Töne nur mit Frequenzen, deren `f · 20` ganzzahlig ist.
- `klangschale.ogg`: kein Loop, 8 s. Teiltöne 220 / 597 / 1083 Hz mit Abklingzeiten 6 / 3 / 1,5 s, 5 ms Anschlag, 0,3 s Ausblenden am Ende.
- Charakter, damit man die Platzhalter auseinanderhält:
  - wald: leises Rauschen plus kurze Zwitscher-Sweeps 2,5–4,5 kHz
  - kaminfeuer: dunkles Rauschen plus `fillDroplets` mit 6/s
  - bach: bandbegrenztes rosa Rauschen
  - klangschalen: ruhiger Ton-Teppich mit langsamer Amplitudenmodulation (0,05/0,1 Hz)

Run: `npm run placeholders && ls -la public/audio/sounds && ffprobe -v error -show_entries format=duration -of csv=p=0 public/audio/sounds/wald.ogg`
Expected: 5 `.ogg`-Dateien, jeweils < 400 KB; Dauer von `wald.ogg` ≈ 20.0.

- [ ] **Step 3: Failing Tests schreiben**

```ts
// tests/unit/catalog.test.ts
import { test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { SOUNDS, EFFECTS, soundById } from '../../src/lib/sounds/catalog'

test('eight sounds in spec order', () => {
  expect(SOUNDS.map(s => s.title)).toEqual(['Regen', 'Meeresrauschen', 'Wind', 'Braunes Rauschen', 'Wald mit Vögeln', 'Kaminfeuer', 'Bach', 'Klangschalen'])
  expect(SOUNDS.filter(s => s.kind === 'live').map(s => s.id)).toEqual(['regen', 'meer', 'wind', 'braun'])
  expect(soundById('bach').title).toBe('Bach')
})

test('loops and effects point to existing ogg files and carry prompts', () => {
  for (const s of [...SOUNDS.filter(s => s.kind === 'loop'), ...EFFECTS]) {
    expect(s.file).toMatch(/^audio\/sounds\/[a-z]+\.ogg$/)
    expect(existsSync(`public/${s.file}`)).toBe(true)
    expect(s.prompt!.length).toBeGreaterThan(20)
  }
})
```

```ts
// tests/browser/loops.test.ts
import { test, expect } from 'vitest'
import { loadBuffer, createLoopVoice } from '../../src/lib/audio/loops'
import { assetUrl } from '../../src/lib/sounds/catalog'

const SR = 22050
test('placeholder loop decodes to 20 s and keeps looping', async () => {
  const ctx = new OfflineAudioContext(2, SR * 22, SR)
  const buf = await loadBuffer(ctx, assetUrl('audio/sounds/wald.ogg'))
  expect(buf.duration).toBeGreaterThan(19.95); expect(buf.duration).toBeLessThan(20.05)
  expect(await loadBuffer(ctx, assetUrl('audio/sounds/wald.ogg'))).toBe(buf)
  createLoopVoice(ctx, buf).output.connect(ctx.destination)
  const d = (await ctx.startRendering()).getChannelData(0).subarray(SR * 20.5, SR * 21.5)
  expect(Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length)).toBeGreaterThan(0.01)
})

test('missing file rejects and is retried on next call', async () => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const url = assetUrl('audio/sounds/fehlt.ogg')
  await expect(loadBuffer(ctx, url)).rejects.toThrow('Konnte nicht geladen werden')
  await expect(loadBuffer(ctx, url)).rejects.toThrow('Konnte nicht geladen werden')
})
```

- [ ] **Step 4: Fehlschlag prüfen**

Run: `npm test -- catalog loops`
Expected: FAIL (Module fehlen).

- [ ] **Step 5: `catalog.ts` und `loops.ts` implementieren**

`catalog.ts` importiert `content/sounds.json` und typisiert es. Bei unbekannter ID wirft `soundById` einen `Error`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npm test -- catalog loops`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add content scripts/placeholders.mjs public/audio src/lib/sounds src/lib/audio/loops.ts tests && git commit -m "feat: Klang-Katalog, Platzhalter-Loops und Loop-Wiedergabe"
```

---

### Task 6: Sleep-Plan, Restzeit-Format & Medientitel

**Files:**
- Create: `src/lib/audio/sleep-timer.ts`, `src/lib/time/format.ts`, `src/lib/audio/media-title.ts`
- Test: `tests/unit/sleep-timer.test.ts`, `tests/unit/format.test.ts`, `tests/unit/media-title.test.ts`

**Interfaces:**
- Produces:
  - `SLEEP_OPTIONS: readonly (number | null)[] = [15, 30, 45, 60, 90, null]` (`null` = endlos), `FADE_SECONDS = 60`, `interface SleepPlan { fadeStart: number; end: number }` (Sekunden ab Planbeginn), `sleepPlan(minutes: number | null): SleepPlan | null`. Bruchteile von Minuten sind erlaubt (für Tests). Ist die Dauer kürzer als 60 s, beginnt das Ausblenden sofort.
  - `formatRemaining(seconds: number): string`: rundet auf, negative Werte ergeben `0:00`; ab einer Stunde Format `h:mm:ss`.
  - `mediaTitle(titles: string[], sleepMinutes: number | null): string`

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/unit/sleep-timer.test.ts
import { test, expect } from 'vitest'
import { sleepPlan, SLEEP_OPTIONS } from '../../src/lib/audio/sleep-timer'
test('sleep plans', () => {
  expect(SLEEP_OPTIONS).toEqual([15, 30, 45, 60, 90, null])
  expect(sleepPlan(15)).toEqual({ fadeStart: 840, end: 900 })
  expect(sleepPlan(90)).toEqual({ fadeStart: 5340, end: 5400 })
  expect(sleepPlan(0.5)).toEqual({ fadeStart: 0, end: 30 })
  expect(sleepPlan(null)).toBeNull()
})
```

```ts
// tests/unit/format.test.ts
import { test, expect } from 'vitest'
import { formatRemaining } from '../../src/lib/time/format'
test.each([[900, '15:00'], [899.2, '15:00'], [59, '0:59'], [0, '0:00'], [3599, '59:59'], [3600, '1:00:00'], [5400, '1:30:00']])(
  'formatRemaining(%s) = %s', (s, e) => expect(formatRemaining(s)).toBe(e))
test('formatRemaining clamps negatives', () => expect(formatRemaining(-3)).toBe('0:00'))
```

```ts
// tests/unit/media-title.test.ts
import { test, expect } from 'vitest'
import { mediaTitle } from '../../src/lib/audio/media-title'
test('media titles', () => {
  expect(mediaTitle([], null)).toBe('Ruhe')
  expect(mediaTitle(['Regen'], null)).toBe('Regen')
  expect(mediaTitle(['Regen', 'Wald mit Vögeln'], 45)).toBe('Regen & Wald mit Vögeln · Sleep-Timer 45 Min')
  expect(mediaTitle(['Regen', 'Wind', 'Bach'], null)).toBe('Regen, Wind & Bach')
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npm test -- --project unit sleep-timer format media-title`
Expected: FAIL.

- [ ] **Step 3: Die drei Funktionen implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- --project unit sleep-timer format media-title`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/sleep-timer.ts src/lib/time/format.ts src/lib/audio/media-title.ts tests/unit && git commit -m "feat: Sleep-Plan, Restzeit-Format und Medientitel"
```

---

### Task 7: Audio-Engine mit Medien-Ausgang & Media Session

**Files:**
- Create: `src/lib/audio/output.ts`, `src/lib/audio/engine.ts`, `src/lib/audio/media-session.ts`
- Test: `tests/browser/engine.test.ts`

**Interfaces:**
- Consumes: `createNoiseBank`, `createLiveSound`, `LiveSoundId` (Task 4); `Voice` (Task 4); `loadBuffer`, `createLoopVoice` (Task 5); `SOUNDS`, `soundById`, `assetUrl`, `SoundId` (Task 5); `sleepPlan` (Task 6); `mediaTitle` (Task 6).
- Produces:
  - `src/lib/audio/output.ts`:
    - `interface Output { ctx: AudioContext; input: GainNode; fade: GainNode; element: HTMLAudioElement; start(): Promise<void>; suspend(): Promise<void> }`
    - `createOutput(): Output`: `new AudioContext({ latencyHint: 'playback' })`; Kette `input → fade → MediaStreamAudioDestinationNode`; `element = new Audio()` mit `srcObject = dest.stream`. `start()` = `ctx.resume()` + `element.play()`, `suspend()` = `element.pause()` + `ctx.suspend()`.
  - `src/lib/audio/engine.ts`:
    ```ts
    type EngineState = 'idle' | 'playing' | 'paused'
    interface EngineSnapshot {
      state: EngineState
      volumes: Partial<Record<SoundId, number>>   // aktive Klänge → Lautstärke 0..1
      loading: SoundId[]
      errors: SoundId[]
      sleepMinutes: number | null                 // Auswahl, bleibt über Sitzungen erhalten
      remainingSec: number | null                 // null wenn idle oder endlos
    }
    const DEFAULT_VOLUME = 0.7
    class AudioEngine {
      constructor(opts?: { createOutput?: () => Output; load?: (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer> })
      toggle(id: SoundId): Promise<void>
      setVolume(id: SoundId, volume: number): void
      setSleepTimer(minutes: number | null): void
      pause(): Promise<void>
      resume(): Promise<void>
      stopAll(): Promise<void>
      snapshot(): EngineSnapshot
      voiceCount(): number                        // laufende Stimmen (Diagnose/Tests)
      subscribe(listener: (s: EngineSnapshot) => void): () => void
    }
    const engine: AudioEngine                     // App-Singleton
    ```
  - `src/lib/audio/media-session.ts`: `syncMediaSession(snap: EngineSnapshot, actions: { play(): void; pause(): void; stop(): void }): void`

**Verhalten (verbindlich):**
- Der Output wird erst beim ersten `toggle` erzeugt (Nutzergeste). `toggle` auf einen inaktiven Klang startet ihn: Loop laden (`loading` enthält die ID), Stimme mit eigenem Gain von 0 auf die Lautstärke (1,5 s Rampe). Ist der Zustand `idle` oder `paused`, wird zuerst `output.start()` aufgerufen.
- `toggle` auf einen aktiven **oder ladenden** Klang stoppt ihn: Rampe auf 0 in 0,8 s, `voice.stop(now + 0.9)`. Ist der Ladevorgang danach fertig, wird keine Stimme gestartet. Je ID existiert höchstens eine Stimme.
- Ladefehler: ID kommt in `errors`, nicht in `volumes`. Der nächste `toggle` dieser ID entfernt sie aus `errors` und versucht es neu.
- Wird der letzte Klang gestoppt (per `toggle` oder `stopAll()`): Zustand **sofort** `idle`, `volumes` sofort leer, Sleep-Countdown verworfen. `output.suspend()` folgt erst nach Ende der 0,8-s-Rampe (über `onended` der zuletzt gestoppten Quelle, nicht per Timer). `stopAll()` stoppt alle Stimmen mit derselben 0,8-s-Rampe.
- Sleep-Countdown startet beim Übergang `idle → playing` und bei jedem `setSleepTimer` während der Wiedergabe:
  - Ab jetzt `t0`: `fade.gain` wird gekappt (`cancelScheduledValues`) und auf den aktuellen Wert fixiert (`setValueAtTime`). Ist `fadeStart > 0`, wird er linear bis `t0 + min(1, fadeStart)` auf 1 zurückgeführt und ab `t0 + fadeStart` linear bis `t0 + end` auf 0 gesenkt. Ist `fadeStart = 0`, geht es vom aktuellen Wert direkt linear bis `t0 + end` auf 0.
  - Ende über eine `ConstantSourceNode`-Marke (`start(t0)`, `stop(t0 + end)`, verbunden über Gain 0), deren `onended` – falls noch aktuell – alle Stimmen sofort stoppt, `fade` auf 1 setzt, `output.suspend()` aufruft und `idle` meldet.
  - `setSleepTimer(null)` während der Wiedergabe hebt Ausblenden und Marke auf und führt `fade.gain` vom aktuellen Wert in 1 s linear auf 1 zurück.
  - `setSleepTimer` im Zustand `idle` speichert nur die Auswahl. Im Zustand `paused` wird neu geplant; die Audio-Uhr steht, der Countdown läuft also erst mit `resume()` weiter.
- `remainingSec = max(0, t0 + end − ctx.currentTime)`. Die Audio-Uhr steht in der Pause, also friert auch die Restzeit ein.
- `pause()` → `output.suspend()`, `paused`. `resume()` → `output.start()`, `playing`.
- Unterbrechung: Ein `pause`-Event des Elements, das die Engine nicht selbst ausgelöst hat, führt zu `ctx.suspend()` und dem Zustand `paused`.
- Nach jeder Änderung: Listener benachrichtigen und `syncMediaSession` aufrufen.
- `syncMediaSession`: Ohne `navigator.mediaSession` passiert nichts. Sonst:
  - `MediaMetadata` mit `title: mediaTitle(aktive Titel, sleepMinutes)`, `artist: 'Ruhe'`, `album: 'Ruhe'`, `artwork: [{ src: assetUrl('icons/icon-512.png'), sizes: '512x512', type: 'image/png' }]`
  - `playbackState`: `'playing'` / `'paused'` / `'none'`
  - Action-Handler `play`, `pause`, `stop` → `resume`, `pause`, `stopAll`

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/browser/engine.test.ts
import { test, expect, afterEach } from 'vitest'
import { AudioEngine } from '../../src/lib/audio/engine'
import { createOutput, type Output } from '../../src/lib/audio/output'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
let out: Output | undefined
let engine: AudioEngine
function make(load?: (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load })
  return engine
}
afterEach(async () => { await engine?.stopAll(); await out?.ctx.close() })

test('toggle starts and stops a live sound', async () => {
  const e = make()
  await e.toggle('regen')
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 } })
  expect(out!.ctx.state).toBe('running')
  await e.toggle('regen')
  await wait(1200)
  expect(e.snapshot().state).toBe('idle')
  expect(e.voiceCount()).toBe(0)
  expect(out!.ctx.state).toBe('suspended')
})

test('loop sound loads and plays alongside a live sound', async () => {
  const e = make()
  await Promise.all([e.toggle('regen'), e.toggle('wald')])
  expect(Object.keys(e.snapshot().volumes).sort()).toEqual(['regen', 'wald'])
  expect(e.voiceCount()).toBe(2)
})

test('rapid toggles never duplicate a voice', async () => {
  const e = make()
  await Promise.all([e.toggle('wald'), e.toggle('wald'), e.toggle('wald')])
  await wait(1200)
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
  expect(e.voiceCount()).toBe(1)
})

test('sleep timer counts down and pause freezes it', async () => {
  const e = make()
  e.setSleepTimer(15)
  await e.toggle('meer')
  expect(e.snapshot().remainingSec).toBeGreaterThan(898)
  await e.pause()
  const frozen = e.snapshot().remainingSec!
  await wait(500)
  expect(e.snapshot().remainingSec).toBeCloseTo(frozen, 1)
  expect(e.snapshot().state).toBe('paused')
})

test('sleep timer end returns to idle', async () => {
  const e = make()
  e.setSleepTimer(0.02)                      // 1,2 s
  await e.toggle('regen')
  await wait(2000)
  expect(e.snapshot()).toMatchObject({ state: 'idle', remainingSec: null, volumes: {} })
  expect(e.voiceCount()).toBe(0)
  expect(out!.ctx.state).toBe('suspended')
})

test('changing sleep timer during fade restores volume', async () => {
  const e = make()
  e.setSleepTimer(0.05)                      // 3 s, Ausblenden ab 0 s
  await e.toggle('regen')
  await wait(2000)
  expect(out!.fade.gain.value).toBeLessThan(0.6)
  e.setSleepTimer(null)
  await wait(1500)
  expect(e.snapshot().state).toBe('playing')
  expect(out!.fade.gain.value).toBeGreaterThan(0.9)
})

test('external pause of the media element pauses the engine', async () => {
  const e = make()
  e.setSleepTimer(30)
  await e.toggle('wind')
  out!.element.pause()                       // simuliert Anruf / andere App
  await wait(100)
  expect(e.snapshot().state).toBe('paused')
  const frozen = e.snapshot().remainingSec!
  await wait(400)
  expect(e.snapshot().remainingSec).toBeCloseTo(frozen, 1)
  await e.resume()
  expect(e.snapshot().state).toBe('playing')
})

test('failed loop load marks only that sound as error', async () => {
  const e = make(async () => { throw new Error('Konnte nicht geladen werden: x') })
  await e.toggle('regen')
  await e.toggle('wald')
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 }, errors: ['wald'], loading: [] })
  await e.toggle('wald')                     // neuer Versuch, schlägt wieder fehl
  expect(e.snapshot().errors).toEqual(['wald'])
})

test('setVolume changes only that sound and notifies subscribers', async () => {
  const e = make()
  const seen: number[] = []
  const off = e.subscribe(s => { if (s.volumes.regen !== undefined) seen.push(s.volumes.regen) })
  await e.toggle('regen')
  e.setVolume('regen', 0.3)
  off()
  expect(e.snapshot().volumes.regen).toBe(0.3)
  expect(seen.at(-1)).toBe(0.3)
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npm test -- --project browser engine`
Expected: FAIL (Module fehlen).

- [ ] **Step 3: `output.ts`, `media-session.ts` und `engine.ts` nach den Vorgaben implementieren**

`engine.ts` exportiert zusätzlich `engine = new AudioEngine()`. Eine `NoiseBank` wird pro Output einmal angelegt. Für Loops nutzt die Engine `opts.load ?? loadBuffer` mit `assetUrl(soundById(id).file!)`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- --project browser engine`
Expected: PASS (alle 9).

- [ ] **Step 5: Gesamte Suite**

Run: `npm run check && npm test`
Expected: 0 Fehler, alle Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio tests/browser/engine.test.ts && git commit -m "feat: Audio-Engine mit Medien-Ausgang, Sleep-Timer und Media Session"
```

---

### Task 8: Klänge-Bildschirm & Mini-Player

**Files:**
- Create: `src/lib/audio/engine-store.svelte.ts`, `src/components/SoundTile.svelte`, `src/components/SleepTimerPicker.svelte`, `src/components/MiniPlayer.svelte`, `src/components/icons.ts`
- Modify: `src/screens/Klaenge.svelte`, `src/App.svelte`
- Test: `tests/e2e/klaenge.spec.ts`

**Interfaces:**
- Consumes: `engine`, `EngineSnapshot` (Task 7); `SOUNDS`, `SoundId` (Task 5); `SLEEP_OPTIONS` (Task 6); `formatRemaining`, `mediaTitle` (Task 6); `TabId`, `onNavigate` (Task 2).
- Produces:
  - `src/lib/audio/engine-store.svelte.ts`: `audio: { snap: EngineSnapshot }` (`$state`). Wird über `engine.subscribe` aktualisiert und zusätzlich jede Sekunde per `setInterval` aus `engine.snapshot()` – nur solange `document.visibilityState === 'visible'` und der Zustand nicht `idle` ist (reine Anzeige).
  - `icons.ts`: `SOUND_ICONS: Record<SoundId, string>` (SVG-Pfaddaten, Strichzeichnung).

**Texte und Rollen (wörtlich, die Tests verlassen sich darauf):**
- Kachel: `<button aria-pressed>` mit Icon und Titel.
  - Aktiv: darunter `<input type="range" aria-label="Lautstärke {Titel}">` (0–1, Schritt 0,01).
  - Ladend: `aria-busy="true"` mit dezentem Pulsieren.
  - Fehler: Text „Konnte nicht geladen werden“; erneutes Tippen versucht es neu.
- Sleep-Timer: `role="radiogroup" aria-label="Sleep-Timer"` mit Optionen „15 Min“, „30 Min“, „45 Min“, „60 Min“, „90 Min“, „Endlos“ (`role="radio"`, `aria-checked`). Standard: „Endlos“.
- Status:
  - Läuft oder pausiert mit Sleep-Timer: „Noch {formatRemaining}“
  - Läuft endlos: „Läuft endlos“
- Steuerung: Hauptknopf „Pause“ bzw. „Weiter“ und Knopf „Alle stoppen“. Beide sind nur sichtbar, wenn der Zustand nicht `idle` ist.
- Mini-Player: `role="region" aria-label="Wiedergabe"` über der Reiterleiste, sichtbar, wenn der Zustand nicht `idle` und der aktive Reiter nicht `klaenge` ist.
  - Inhalt: `mediaTitle(aktive Titel, null)`, Restzeit (falls Sleep-Timer) und Knopf „Pause“/„Weiter“.
  - Ein Tipp auf den Titel öffnet den Reiter Klänge.

- [ ] **Step 1: Failing E2E-Test schreiben**

```ts
// tests/e2e/klaenge.spec.ts
import { test, expect } from '@playwright/test'

test('mix sounds, sleep timer and mini player', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Klänge' }).click()
  const tiles = page.locator('button[aria-pressed]')
  await expect(tiles).toHaveText(['Regen', 'Meeresrauschen', 'Wind', 'Braunes Rauschen', 'Wald mit Vögeln', 'Kaminfeuer', 'Bach', 'Klangschalen'])

  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Lautstärke Regen' })).toBeVisible()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('radio', { name: '15 Min' }).click()
  await expect(page.getByText(/^Noch 1[45]:\d\d$/)).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  await page.getByRole('button', { name: 'Wald mit Vögeln' }).click()
  await expect(page.getByRole('button', { name: 'Wald mit Vögeln' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })

  await nav.getByRole('button', { name: 'Heute' }).click()
  const mini = page.getByRole('region', { name: 'Wiedergabe' })
  await expect(mini).toContainText('Regen & Wald mit Vögeln')
  await mini.getByRole('button', { name: 'Pause' }).click()
  await expect(mini.getByRole('button', { name: 'Weiter' })).toBeVisible()

  await mini.getByText('Regen & Wald mit Vögeln').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await page.getByRole('button', { name: 'Alle stoppen' }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('region', { name: 'Wiedergabe' })).toHaveCount(0)
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx playwright test klaenge`
Expected: FAIL (keine Kacheln).

- [ ] **Step 3: Store, Komponenten und Bildschirm implementieren**

Layout: Kacheln im 2-Spalten-Raster, darunter Sleep-Timer und Steuerung. Aktive Kacheln heben sich mit Akzentrand und leichtem Leuchten ab. Alle Aktionen rufen direkt `engine.*` auf; die Anzeige liest nur `audio.snap`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx playwright test && npm run check`
Expected: alle E2E-Tests PASS, 0 svelte-check-Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Klänge-Bildschirm mit Mischpult, Sleep-Timer und Mini-Player"
```

---

### Task 9: PWA – Manifest, Icons, Offline & Update-Hinweis

**Files:**
- Create: `public/icons/icon.svg`, `scripts/icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png` (erzeugt), `src/lib/pwa/update.svelte.ts`, `src/components/UpdateToast.svelte`
- Modify: `vite.config.ts`, `index.html`, `src/main.ts`, `src/App.svelte`
- Test: `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `audio.snap` (Task 8).
- Produces: `pwa: { needRefresh: boolean }` (`$state`), `initPwa(): void`, `applyUpdate(): Promise<void>` in `src/lib/pwa/update.svelte.ts` (über `registerSW` aus `virtual:pwa-register`).

- [ ] **Step 1: Icon und Icon-Skript**

- `icon.svg`: Mondsichel in `#F2C98A` über dunkler Bergsilhouette, Hintergrund-Verlauf `#0B1026` → `#3A2F5B`, quadratisch, randlos.
- `scripts/icons.mjs` rendert mit `playwright` (Chromium) per Screenshot:
  - `icon-192.png` und `icon-512.png` (volles Motiv)
  - `maskable-512.png` (Motiv auf 80 % verkleinert, mittig, auf vollflächigem `#0B1026`)

Run: `npm run icons && file public/icons/*.png`
Expected: drei PNGs mit 192×192 bzw. 512×512.

- [ ] **Step 2: Failing E2E-Test schreiben**

```ts
// tests/e2e/pwa.spec.ts
import { test, expect } from '@playwright/test'

test('manifest matches spec', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const m = await (await request.get(new URL(href!, page.url()).href)).json()
  expect(m).toMatchObject({ name: 'Ruhe', short_name: 'Ruhe', display: 'standalone', orientation: 'portrait',
    lang: 'de', start_url: '/ruhe/', scope: '/ruhe/', theme_color: '#0B1026', background_color: '#0B1026' })
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
  expect(m.icons[2].purpose).toBe('maskable')
  for (const i of m.icons) {
    const r = await request.get(new URL(i.src, page.url()).href)
    expect(r.status()).toBe(200); expect(r.headers()['content-type']).toContain('image/png')
  }
})

test('works offline after first visit', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Guten (Morgen|Tag|Abend)$/)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Kaminfeuer' }).click()
  await expect(page.getByRole('button', { name: 'Kaminfeuer' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
})
```

- [ ] **Step 3: Fehlschlag prüfen**

Run: `npx playwright test pwa`
Expected: FAIL (kein Manifest-Link).

- [ ] **Step 4: Implementieren**

- `vite.config.ts`: `VitePWA({ registerType: 'prompt', injectRegister: false, manifest: { name: 'Ruhe', short_name: 'Ruhe', lang: 'de', start_url: '/ruhe/', scope: '/ruhe/', display: 'standalone', orientation: 'portrait', theme_color: '#0B1026', background_color: '#0B1026', icons: [192er, 512er, maskable 512er mit purpose 'maskable'] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,ogg}'], cleanupOutdatedCaches: true } })`. Icon-`src` relativ (`icons/icon-192.png` usw.).
- `index.html`: `<meta name="theme-color" content="#0B1026">`, `<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">` (Vite schreibt `base` davor).
- `initPwa()` in `main.ts` aufrufen. `UpdateToast` in `App.svelte`: sichtbar, wenn `pwa.needRefresh && audio.snap.state === 'idle'`; Text „Neue Version – tippen zum Aktualisieren“; ein Tipp ruft `applyUpdate()` auf.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx playwright test && npm test && npm run check`
Expected: alles PASS. Der Build meldet einen Precache von ca. 2–4 MB oder weniger (Spec §6.5).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: installierbare PWA mit Offline-Cache und Update-Hinweis"
```

---

### Task 10: Deployment, README & Handy-Checkliste

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: npm-Skripte aus Task 1.

- [ ] **Step 1: Workflow schreiben**

`.github/workflows/deploy.yml`:
- Auslöser: `push` auf `main` und `workflow_dispatch`
- `permissions: { contents: read, pages: write, id-token: write }`, `concurrency: { group: pages, cancel-in-progress: false }`
- Job `build` (ubuntu-latest), Schritte in dieser Reihenfolge:
  1. `actions/checkout@v5`
  2. `actions/setup-node@v5` (Node 22, `cache: npm`)
  3. `npm ci`
  4. `npx playwright install --with-deps chromium`
  5. `npm run check`, dann `npm test`, dann `npm run test:e2e` (mit `CI=true`)
  6. `npm run build`
  7. `actions/configure-pages@v5`
  8. `actions/upload-pages-artifact@v4` mit `path: dist`
- Job `deploy` (`needs: build`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`): `actions/deploy-pages@v4` mit `id: deployment`

- [ ] **Step 2: README schreiben**

Inhalt (Deutsch, kurz):
1. Was Ruhe ist und die Adresse `https://philip-tolle.github.io/ruhe/`
2. Installation auf Android: in Chrome öffnen → Menü ⋮ → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“
3. **Handy-Checkliste Meilenstein 1:**
   1. Installation über Chrome → Icon auf dem Startbildschirm, Start ohne Browserleiste
   2. Flugmodus → Klänge funktionieren (Timer und Atmen folgen mit Meilenstein 2)
   3. Regen + Sleep-Timer 60 Min, Bildschirm sperren → läuft durch und blendet in der letzten Minute sanft aus
   4. Benachrichtigung bzw. Sperrbildschirm zeigt Titel und Play/Pause, die Steuerung funktioniert
4. Entwicklung: `npm install`, `npm run dev`, `npm test`, `npm run test:e2e`, `npm run placeholders`, `npm run icons`

- [ ] **Step 3: Lokale Gesamtprüfung**

Run: `npm ci && npm run check && npm test && CI=true npm run test:e2e && npm run build`
Expected: alles grün, `dist/` enthält `index.html`, `sw.js`, `manifest.webmanifest`.

- [ ] **Step 4: Commit und Branch pushen**

```bash
git add .github README.md && git commit -m "ci: Deployment auf GitHub Pages und Handy-Checkliste"
git push -u origin meilenstein-1
```

- [ ] **Step 5: Nutzer-Voraussetzung bestätigen lassen**

Den Nutzer bitten, im Repo *Settings → Pages → Source* auf „GitHub Actions“ zu stellen, und auf die Bestätigung warten.

- [ ] **Step 6: Merge nach `main` und Deployment prüfen**

Den Merge über superpowers:finishing-a-development-branch abwickeln. Nach dem Push auf `main` den Lauf prüfen (öffentliche API, ohne Login):

Run: `curl -s "https://api.github.com/repos/philip-tolle/ruhe/actions/runs?branch=main&per_page=1" | grep -E '"(status|conclusion)"'`
Expected: nach einigen Minuten `"status": "completed"` und `"conclusion": "success"`. Danach dem Nutzer die Adresse und die Checkliste aus dem README geben.
