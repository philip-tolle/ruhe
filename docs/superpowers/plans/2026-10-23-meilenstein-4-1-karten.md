# Meilenstein 4.1 – Edle Karten mit Aquarell-Hauch: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tab looks more refined:
- fine gold borders and gold lines;
- titles in Fraunces;
- delicate painted washes in the cards;
- length and „offline gespeichert“ shown quietly.

**Architecture:**
- Three new painted washes live as WebP with alpha in `public/images/waschungen/`.
- A small module assigns each theme, time of day and breathing exercise its colour.
- A decorative component `Waschung.svelte` lies behind the content of a card.
- Gold lines, outline buttons and the offline symbol come as tokens, helper classes and one small component. The screens only use them.

**Tech Stack:**
- Vite 8, Svelte 5 (runes), TypeScript 6, vite-plugin-pwa 2 (Workbox).
- Vitest (unit + browser), Playwright (Pixel 7, `vite preview` :4173).
- Python 3 with Pillow/NumPy, for the development tool only.

**Spec:** `docs/superpowers/specs/2026-10-23-ruhe-m4-1-karten-design.md`. It extends `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md`.

## Global Constraints

### Tokens and lines
- `--gold-line: rgb(233 196 142 / 0.26)` and `--gold-line-strong: rgb(233 196 142 / 0.7)` are the same in every mood.
- Card border: `1px solid var(--gold-line)`. Entries inside a list (meditations) use `rgb(233 196 142 / 0.22)`.
- Short line under a section heading: 40 px wide, 1 px high, `--gold-line-strong`, 8 px gap.
- Fading line beside a theme heading: gradient from `rgb(233 196 142 / 0.5)` to transparent.
- Row divider inside a card: `1px solid rgb(233 196 142 / 0.28)`, above each row.

### Type
- Titles: `--font-display` (Fraunces), weight 400, about 1.1875rem.
- Small caps headings: 0.72rem, weight 700, letter-spacing 0.14em.

### Buttons
- At most one full accent button per screen; on Heute that is „Jetzt starten“.
- `.button-line`:
  - border `1px` accent at 55 %;
  - fill accent 8 % over `--sky-mid`, opaque;
  - text in the accent colour.
- Play circle: 40 px, fill `color-mix(in srgb, var(--accent) 14%, var(--sky-mid))`, 1px ring accent 50 %, triangle in the accent colour.
- Chevron: 18 px, stroke 1.5, `--gold-line-strong`, `aria-hidden`.

### Length and offline
- Length: 0.78rem, `--text-muted`.
- Offline symbol:
  - circle with a tick, 13 px, stroke `--text-muted`;
  - `role="img"`, `aria-label="offline gespeichert"`;
  - replaces the text „✓ offline“.
- „Nicht offline verfügbar“ stays as text: 0.8125rem, 600, `--text-muted`. Title and play circle drop to 55 %.

### Washes
- Colours `lavendel`, `pfirsich`, `blaugruen`.
- Files `public/images/waschungen/<farbe>.webp`: WebP with alpha, width 900 px, ≤ 120 KB each, ≤ 300 KB together.
- Data in `content/waschungen.json`: `model`, `prompt`, `freistellen`, and per colour `id`, `colours`, `flow`, `generation`, `width`, `height`. There is no `hellste` field (ruling R1).
- **Zone (ruling R1):** the wash fills only a zone in the **top right corner** of the card.
  - Size from `--wash-w` / `--wash-h`, set by the card; default `40%` × `100%`.
  - The zone clips its content.
  - A mask fades the wash out softly towards the zone's left and bottom edges, so it is invisible at the zone edge.
- **No text in the zone**, except text on an opaque surface such as a line button.
- Opacity `var(--wash-opacity)`, default 0.35, between 0.2 and 0.45 in every mood.
- `pointer-events: none`, `aria-hidden`, `alt=""`.
- Three positions of the image inside the zone: 0 as painted, 1 mirrored and turned 6°, 2 turned −12°. In lists the position is the index modulo 3.

### Colour assignment
- Themes:
  - achtsamkeit → lavendel
  - stress → blaugruen
  - fokus → pfirsich
- Time of day:
  - morgen → pfirsich
  - tag → blaugruen
  - abend → lavendel
- Breathing exercises:
  - 478 → lavendel
  - box → pfirsich
  - kohaerent → blaugruen
  - langes-ausatmen → lavendel
  - seufzer → blaugruen
  - wechselatmung → pfirsich
- Zuletzt genutzt:
  - guided → colour of its theme
  - breath → colour of the exercise
  - timer → colour of the time of day

### What stays unchanged
- Unchanged:
  - the full-screen players, mini player, Klänge playback bar, tab bar, toast;
  - engine, storage, statistics, content.
- Accessible names stay. Only exception: „✓ offline“ becomes the symbol „offline gespeichert“.
- The timer button visibly reads „Einstellen“; its accessible name stays „Timer einstellen“.
- **Ruling P1:** the spec's „Abschluss-Dialog“ means `ConfirmDialog.svelte` (the „… beenden?“ prompt). `SessionDone.svelte` has no frame and stays unchanged; Task 7 corrects spec §5.
- No new texts besides „VORSCHLAG DES TAGES“ (existing heading, now small caps), „Einstellen“ and „offline gespeichert“.

### Project rules
- German comments, as dense as the surrounding code.
- No prettier.
- Every commit ends with the two trailer lines:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01YFBD4q9VZrxdFh2nUt9NdS`
- Check `lsof -i :4173` before starting a preview server, and stop the servers afterwards.
- Publish only with the user's OK.

## Review Focus

1. **Wash file missing (404, old cache):**
   - Cards keep their size and remain operable.
   - No broken-image icon, no layout shift.
   - Test: Task 4 (Meditieren) and Task 6 (Atmen).
2. **Text drifts into the wash zone** (a long title, a wrapped description, 130 % font):
   - No text node overlaps the zone of its card, except text on an opaque surface.
   - Test: helper `expectNoTextInWash` (Task 4), used in Tasks 4, 5 and 6 at 412 px and at 360 px with 130 %.
3. **360 px wide at 130 % font size:**
   - Timer card with „Einstellen“, Vorschlag start row, Aktivitäten rows and Atem tiles: nothing overflows, the button wraps below the text if needed.
   - Test: Task 4, Task 5, Task 6.
4. **Offline state for the screen reader:**
   - A saved entry announces „offline gespeichert“.
   - A blocked entry announces „Nicht offline verfügbar“ as its description.
   - The length is still in the text.
   - Test: Task 4.
5. **The wash steals taps or widens the page:**
   - A tap on the area of the wash starts the entry.
   - `document.documentElement.scrollWidth <= clientWidth` on every changed screen.
   - Test: Task 4 (tap), Task 4/5/6 (width).

---

### Task 1: Paint and cut out the washes (controller)

The ElevenLabs connector is only available to the controller, so this task is not an implementer dispatch.

**Files:**
- Modify: `scripts/freistellen.py` (mode `--schwarz`)
- Create: `public/images/waschungen/lavendel.webp`, `public/images/waschungen/pfirsich.webp`, `public/images/waschungen/blaugruen.webp`
- Create: `content/waschungen.json`

**Interfaces:**
- Produces: the three files and `content/waschungen.json`:
  ```json
  {
    "model": "…",
    "style": "…",
    "waschungen": [
      { "id": "<farbe>", "colours": "…", "flow": "…", "generation": "…", "width": 900, "height": n }
    ]
  }
  ```

- [ ] **Step 1: Generate three times, 4 variants each** with `gpt-image-2.5-sunburst`.
  - Prompt per colour, with `<COLOURS>` = „lavender and soft violet“ / „peach, apricot and rosé“ / „teal and powder blue“:

    > „A single soft abstract watercolor wash on a plain, flat, pure black background (#000000), centered, wide and low (about three times wider than tall), with lots of empty black space around it. An irregular, organic bloom of transparent pigment with soft feathered edges, gentle color bleeding, subtle granulation and a few darker blooms where the water dried. Colors: <COLOURS>. Along its upper edge runs a single delicate hairline stroke of metallic gold ink. Refined, calm, luxurious, premium wellness aesthetic, no text, no objects, no paper texture, no border, no shadows.“

  - Never repeat a call; if one fails, only record it.
- [ ] **Step 2: Download and build an overview sheet** in `scratchpad/m41-wash/`. Choose per colour: the calmest shape with a clean gold line, wide format. Record the choice in the ledger.
- [ ] **Step 3: Add mode `--schwarz` to `scripts/freistellen.py`.**
  - Signature: `python3 scripts/freistellen.py <quelle.png> <ziel.webp> --schwarz --breite 900`.
  - Opacity: `clip((max(R,G,B)/255 − 0.04)/0.96, 0, 1)`; colour = RGB / opacity.
  - Crop to the opacity > 0.03 area, without squaring.
  - Scale to width 900 px; save as WebP, quality 80.
  - Print the brightest colour: the 99th luminance percentile among pixels with opacity > 0.5, as `#RRGGBB`.
  - The existing mode stays unchanged.
- [ ] **Step 4: Cut out the three files, write `content/waschungen.json`, check the budget.** ≤ 120 KB each, ≤ 300 KB together.
- [ ] **Step 5: Check visually.** Lay each wash at opacity 0.35 over the three sky colours (`#1b2350`, `#352a5c`, `#1c3b55`). No black edges.
- [ ] **Step 6: Commit** `content: drei gemalte Waschungen für die Karten`.

### Task 2: Wash catalogue and component

**Files:**
- Create: `src/lib/content/waschungen.ts`, `src/components/Waschung.svelte`
- Test: `tests/unit/waschungen.test.ts`; `tests/e2e/pwa.spec.ts` (precache)
- Move: `webpInfo` from `tests/unit/motive.test.ts` to the new `tests/unit/webp.ts`; `motive.test.ts` imports it from there.

**Interfaces:**
- Consumes:
  - `assetUrl` from `src/lib/sounds/catalog`
  - `Category`, `meditationById` from `src/lib/content/catalog`
  - `Tageszeit`
  - `BreathPatternId`
  - `LastUsed` from `src/lib/stats/schema`
- Produces:
  - `type WaschFarbe = 'lavendel' | 'pfirsich' | 'blaugruen'`
  - `WASCH_FARBEN: readonly WaschFarbe[]`
  - `type WaschLage = 0 | 1 | 2`
  - `waschUrl(farbe: WaschFarbe): string` → `assetUrl('images/waschungen/' + farbe + '.webp')`
  - `themaWaschung(c: Category): WaschFarbe`
  - `tageszeitWaschung(t: Tageszeit): WaschFarbe`
  - `atemWaschung(id: BreathPatternId): WaschFarbe`
  - `zuletztWaschung(last: LastUsed, now: Tageszeit): WaschFarbe`
  - `waschLage(index: number): WaschLage` (index modulo 3)
  - `Waschung.svelte` with props `{ farbe: WaschFarbe; lage?: WaschLage }` (default 0). It renders `<span class="waschung lage-{lage}" aria-hidden="true"><img src alt="" decoding="async" draggable="false"></span>`. The `span` is the zone.

- [ ] **Step 1: Failing unit tests** (`tests/unit/waschungen.test.ts`)
  - `WASCH_FARBEN equals the ids in content/waschungen.json`
  - `every colour has a webp file with alpha, 900 px wide, ≤ 120 KB; together ≤ 300 KB` (reuse `webpInfo` from `tests/unit/motive.test.ts` by moving it to `tests/unit/webp.ts`)
  - `no stray files in public/images/waschungen`
  - `colour assignment`: all values from Global Constraints, e.g. `expect(themaWaschung('stress')).toBe('blaugruen')`, `expect(atemWaschung('wechselatmung')).toBe('pfirsich')`, `expect(tageszeitWaschung('abend')).toBe('lavendel')`
  - `zuletztWaschung`:
    - `{kind:'guided', id:'gedanken-wie-wolken'}` → `'lavendel'`
    - `{kind:'breath', pattern:'box', minutes:3}` → `'pfirsich'`
    - a timer at `'tag'` → `'blaugruen'`
    - unknown guided id at `'morgen'` → `'pfirsich'` (the time-of-day colour)
  - `waschLage cycles 0,1,2,0` for index 0…3
- [ ] **Step 2:** Run `npx vitest run tests/unit/waschungen.test.ts`. It must fail (module missing).
- [ ] **Step 3: Implement** `waschungen.ts` (comment style as in `motive.ts`) and `Waschung.svelte`.
  - Zone (`span.waschung`):
    - `position: absolute; top: 0; right: 0; width: var(--wash-w, 40%); height: var(--wash-h, 100%)`;
    - `overflow: hidden; pointer-events: none; z-index: 0; opacity: var(--wash-opacity, 0.35)`;
    - mask so the wash is invisible at the zone's left and bottom edge: `mask-image: linear-gradient(to right, transparent, #000 45%), linear-gradient(to bottom, #000 55%, transparent)` with `mask-composite: intersect` (and `-webkit-mask-composite: source-in`).
  - Image: `position: absolute`, height about 150 % of the zone, width auto, anchored so its densest part sits near the zone's top right.
    - Position 1: `transform: scaleX(-1) rotate(6deg)`.
    - Position 2: `transform: rotate(-12deg)`.
  - Comment: the card must provide `position: relative; overflow: hidden; isolation: isolate`, its content `position: relative; z-index: 1`, set `--wash-w`/`--wash-h`, and keep its text out of the zone.
- [ ] **Step 4: Precache test** in `tests/e2e/pwa.spec.ts`: the built service worker lists `images/waschungen/lavendel.webp`, `pfirsich.webp` and `blaugruen.webp` (same pattern as the motif precache test). Run it: green.
- [ ] **Step 5:** Run `npm run test` and `npm run check`; both green.
- [ ] **Step 6: Commit** `feat: Katalog der Waschungen und Baustein Waschung`.

### Task 3: Tokens, helper classes and the offline mark

**Files:**
- Modify: `src/app.css`
- Create: `src/components/OfflineMark.svelte`
- Test: `tests/unit/theme-contrast.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - Tokens `--gold-line`, `--gold-line-strong` (`:root`) and `--wash-opacity` (per mood).
  - `.card` border `1px solid var(--gold-line)`.
  - Classes:
    - `.button-line` (outline button, see Global Constraints);
    - `.rule` (short line under a heading, as a `::after` of the heading or its own `<span class="rule" aria-hidden="true">`);
    - `.rule-fade` (fading line, flex-grow).
  - `OfflineMark.svelte` without props: `<svg class="offline-mark" role="img" aria-label="offline gespeichert" viewBox="0 0 16 16">` with circle r 6.3 and tick, 13 px, stroke `currentColor` (colour comes from the surrounding text).

- [ ] **Step 1: Failing unit tests** in `theme-contrast.test.ts`:
  - `'--wash-opacity liegt in jeder Stimmung zwischen 0.2 und 0.45'`. It reads the value from the mood block, falling back to `:root`.
  - `'--gold-line und --gold-line-strong stehen in :root'` with the exact values from Global Constraints.
  - `'.card hat den Goldrand'`: the `.card` rule contains `border: 1px solid var(--gold-line)`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/theme-contrast.test.ts`. It fails because the tokens are missing.
- [ ] **Step 3: Tokens and classes in `app.css`.**
  - `--wash-opacity: 0.35` in `:root`. Only override it per mood if a screenshot later shows a mood too bright or too faint.
  - Write `OfflineMark.svelte`.
  - Ruling R1: there is no contrast test over the wash, because text never sits on it (see Global Constraints, Zone).
- [ ] **Step 4:** Run `npm run test`: green, including the existing contrast tests.
- [ ] **Step 5:** Run `npm run test:e2e` once. The gold border must not break any computed-style test; existing tests that check `--surface-border` on cards are updated to the gold value.
- [ ] **Step 6: Commit** `feat: Goldlinien, Linienknopf und Offline-Zeichen als Bausteine`.

### Task 4: Meditieren

**Files:**
- Modify: `src/screens/Meditieren.svelte`
- Test: `tests/e2e/guided.spec.ts`, `tests/e2e/ich.spec.ts` (replace „✓ offline“); Create: `tests/e2e/karten.spec.ts`

**Interfaces:**
- Consumes:
  - `Waschung`, `themaWaschung`, `tageszeitWaschung`, `waschLage` (Task 2);
  - `OfflineMark`, `.button-line`, `.rule`, `.rule-fade`, tokens (Task 3);
  - `tageszeitUi` from `src/lib/ui/tageszeit.svelte`.
- Produces: e2e helpers in `tests/e2e/karten.spec.ts`; Tasks 5/6 extend this file.
  - `async function waschungIn(card: Locator): Promise<string | null>` returns the colour from the `src` of the `img` inside `.waschung`, or `null`.
  - `async function expectNoTextInWash(card: Locator): Promise<void>` (Review Focus 2):
    - Zone = bounding rect of the card's `.waschung`, intersected with the card's rect.
    - For every non-whitespace text node in the card, use the client rects of a `Range` over it. Skip text inside `.visually-hidden`, and text with an ancestor below the card whose computed `background-color` has alpha 1.
    - Each rect must not overlap the zone by more than 1 px. The message names the text.

- [ ] **Step 1: Failing e2e tests.**
  - In `guided.spec.ts`, replace every `'✓ offline'` assertion with the symbol:
    - saved: `entry.getByRole('img', { name: 'offline gespeichert' })` visible;
    - not saved: count 0.
  - `ich.spec.ts:408` likewise.
  - New in `karten.spec.ts` (clock 08:00):
    - The timer card has a wash `pfirsich` (morning) and a button with name „Timer einstellen“ and visible text „Einstellen“.
    - **Review Focus 2:** `expectNoTextInWash` passes for the timer card and every entry, at 412 px and at 360×640 with 130 %.
    - Under „Geführte Meditationen“ there is a `.rule`. Each theme heading has a `.rule-fade`.
    - Every meditation entry has a wash in its theme colour (Achtsamkeit `lavendel`, Stress `blaugruen`, Fokus `pfirsich`), with positions 0, 1, 2 in order.
    - Title `font-family` contains `Fraunces`.
    - `border-top-color` of the timer card is `rgba(233, 196, 142, 0.26)`; of an entry `rgba(233, 196, 142, 0.22)`.
    - The length is still in the entry text („5 Min“).
    - **Review Focus 4:**
      - Offline (`context.setOffline(true)`) with nothing saved: the entry is disabled, „Nicht offline verfügbar“ is visible, and `toHaveAccessibleDescription(/Nicht offline verfügbar/)`.
      - Saved entry: `getByRole('img', { name: 'offline gespeichert' })`.
    - **Review Focus 5:** a tap in the middle of the first entry's wash zone starts the meditation, i.e. the player heading is visible. `scrollWidth <= clientWidth`.
    - **Review Focus 1:**
      - Use `page.route('**/images/waschungen/**', r => r.fulfill({ status: 404 }))` and `serviceWorkers: 'block'`.
      - Entries keep their height (±1 px against the run with images).
      - No `img.waschung` has `naturalWidth > 0`.
      - A tap still starts.
    - **Review Focus 3:** 360×640 with `fontSize = '130%'`:
      - Timer card, entries and page: no overflow (`scrollWidth <= clientWidth` per card).
      - „Einstellen“ lies completely inside the card.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/karten.spec.ts tests/e2e/guided.spec.ts`: red.
- [ ] **Step 3: Implement.**
  - **Timer card:** motif · text · `.button-line` „Einstellen“ (`aria-label="Timer einstellen"`). Use `flex-wrap: wrap`, so the button moves below the text when space is short. Wash `tageszeitWaschung(tageszeitUi.current)`, its zone behind the button column. The button's opaque fill carries its text.
  - **Headings:** `h2` with `.rule`; theme heading as a row with motif, `h3` and `.rule-fade`.
  - **Entries:**
    - `position: relative; overflow: hidden; isolation: isolate`; border `rgb(233 196 142 / 0.22)`.
    - `<Waschung farbe={themaWaschung(group.category)} lage={waschLage(i)} />` as the first child.
    - The zone is the play column, about 104 px wide (`--wash-w`). The text column ends left of it, via `margin-right` or a wider gap.
    - Title in Fraunces about 1.1875rem.
    - `.meta` 0.78rem `--text-muted` with the length and `<OfflineMark />` when saved.
    - Play circle with ring.
    - Disabled entry as in Global Constraints.
- [ ] **Step 4:** The tests from step 2 are green. Run `npm run test:e2e` completely once.
- [ ] **Step 5: Screenshots** of Meditieren at 08:00, 14:00 and 20:00 on Pixel 7 and 360×640, saved to `scratchpad/shots-m41t4/`. Look at them and compare with the board „Gewählt: A mit Goldlinien aus C“.
- [ ] **Step 6: Commit** `feat: Meditieren mit Goldlinien, Waschungen und leisen Angaben`.

### Task 5: Heute

**Files:**
- Modify: `src/screens/Heute.svelte`
- Test: `tests/e2e/heute.spec.ts`, `tests/e2e/karten.spec.ts`

**Interfaces:**
- Consumes:
  - `Waschung`, `tageszeitWaschung`, `zuletztWaschung` (Task 2);
  - `OfflineMark`, `.button-line`, `.rule-fade`, tokens (Task 3);
  - `waschungIn` (Task 4).

- [ ] **Step 1: Failing e2e tests** in `karten.spec.ts`.
  - **Vorschlag des Tages:**
    - At 08:00 and 20:00 the wash is `pfirsich` and `lavendel` respectively.
    - The `h2` of the card is still „Vorschlag des Tages“ (accessible name), visibly in small caps (`text-transform: uppercase`, `letter-spacing` 0.14em).
    - Next to „Jetzt starten“ (full button) are the length and, when saved, `img` „offline gespeichert“.
    - The zone is the top right around the motif, above the description. `expectNoTextInWash` passes.
  - **Zuletzt genutzt:**
    - With `lastUsed` breath `box`: wash `pfirsich`, button with class `button-line`.
    - With guided `nach-einem-vollen-tag`: wash `blaugruen`.
    - Without `lastUsed`: the fallback „Ankommen im Atem“ gives `lavendel`.
    - The zone is a top-right corner. Heading and summary stay out of it, e.g. via `padding-right`. `expectNoTextInWash` passes.
  - **Aktivitäten:**
    - Each row has `border-top` `rgba(233, 196, 142, 0.28)`, title in Fraunces and a chevron `svg[aria-hidden="true"]`.
    - Names unchanged („Meditieren“, „Atemübung“, „Klänge“).
  - **Review Focus 3:** 360×640 at 130 %: the Vorschlag start row wraps without overflow; `scrollWidth <= clientWidth`; `expectNoTextInWash` passes for both cards.
  - Existing `heute.spec.ts` stays green: names, Vorschlag, Zuletzt, offline lock.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/karten.spec.ts tests/e2e/heute.spec.ts`: red.
- [ ] **Step 3: Implement** as in the board „Heute · morgens“.
  - Card content `position: relative; z-index: 1`.
  - The „Nicht offline verfügbar“ hint stays below the start row.
- [ ] **Step 4:** Green; run `npm run test:e2e` completely once.
- [ ] **Step 5: Screenshots** of Heute at 08:00, 14:00 and 20:00 on Pixel 7 and 360×640, saved to `scratchpad/shots-m41t5/`. Look at them.
- [ ] **Step 6: Commit** `feat: Heute mit Waschungen, Goldlinien und leisem Start`.

### Task 6: Atmen, Klänge, Ich and dialogs

**Files:**
- Modify:
  - `src/screens/Atmen.svelte`, `src/components/SoundTile.svelte`
  - `src/screens/Ich.svelte`, `src/components/Calendar.svelte`
  - `src/components/Sheet.svelte`, `src/components/ConfirmDialog.svelte`
- Test: `tests/e2e/karten.spec.ts`, `tests/e2e/atmen.spec.ts`, `tests/e2e/klaenge.spec.ts`, `tests/e2e/ich.spec.ts`

**Interfaces:**
- Consumes: `Waschung`, `atemWaschung`, `tageszeitWaschung`, `waschLage` (Task 2); tokens (Task 3); `waschungIn` (Task 4).

- [ ] **Step 1: Failing e2e tests** in `karten.spec.ts`.
  - **Atmen:**
    - Each tile has a wash in the colour from Global Constraints (`478` → `lavendel` … `wechselatmung` → `pfirsich`), positions by index modulo 3.
    - Border `rgba(233, 196, 142, 0.26)`.
    - The zone is beside the motif, above the title. `expectNoTextInWash` passes for every tile, at 412 px and at 360 px with 130 %.
    - **Review Focus 1:** with the wash at 404, tiles keep their size, the tap starts.
    - **Review Focus 3:** 360 px at 130 % stays green (existing test).
  - **Klänge:** no tile contains `img.waschung`. An inactive tile has border `rgba(233, 196, 142, 0.26)`; an active one keeps the accent border (existing test stays).
  - **Ich:**
    - Key-figure tiles and every `.card` have the gold border.
    - Only the calendar card has a wash (08:00 → `pfirsich`); `Einstellungen`, `Offline` and `Backup` have none.
    - The calendar's zone sits in a text-free top-right corner. `expectNoTextInWash` passes, at 412 px and at 360 px with 130 %.
    - Settings rows (the switches) have `border-top` `rgba(233, 196, 142, 0.28)` from the second row on.
  - **Dialogs:**
    - The timer sheet (Meditieren › Einstellen) has border `rgba(233, 196, 142, 0.26)`.
    - The confirmation „Übung beenden?“ in the breath player likewise.
  - `scrollWidth <= clientWidth` on Atmen and Ich at 360 px.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/karten.spec.ts`: red.
- [ ] **Step 3: Implement.**
  - Atem tiles: `isolation: isolate`, content `z-index: 1`; the effect line keeps the accent.
  - SoundTile: inactive border `var(--gold-line)`.
  - Ich: `.figure` border `var(--gold-line)`; Calendar card with `<Waschung farbe={tageszeitWaschung(tageszeitUi.current)} />`; dividers between the setting rows.
  - Sheet/ConfirmDialog: border `var(--gold-line)`.
- [ ] **Step 4:** Green; run `npm run test:e2e` completely once.
- [ ] **Step 5: Screenshots** of Atmen, Klänge (one tile active) and Ich at 08:00, 14:00 and 20:00, Pixel 7 + 360×640, plus the timer sheet. Save to `scratchpad/shots-m41t6/` and look at them.
- [ ] **Step 6: Commit** `feat: Atmen, Klänge, Ich und Dialoge mit Goldrand und Waschung`.

### Task 7: Docs, checklist, walkthrough

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-23-ruhe-m4-1-karten-design.md` (§5 per ruling P1), `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` (dated note in §4)

- [ ] **Step 1: README.**
  - Add „Handy-Checkliste Meilenstein 4.1“ with the five points from spec §7.
  - Add a section „Waschungen malen“ to „Motive malen“:
    - prompt from `content/waschungen.json`;
    - `python3 scripts/freistellen.py <quelle.png> <ziel.webp> --schwarz --breite 900`;
    - budget;
    - `--wash-opacity` in `app.css` (0.2–0.45);
    - rule: text never sits in a wash zone, checked by `expectNoTextInWash`.
- [ ] **Step 2: Notes.**
  - M4 spec §4: *Ergänzung vom 23.10.2026 (Meilenstein 4.1):* gold edge, washes and quiet length/offline, with a reference to the M4.1 spec.
  - M4.1 spec §5: replace `SessionDone.svelte` with `ConfirmDialog.svelte` (ruling P1).
- [ ] **Step 3: Walkthrough.**
  - All five tabs, the timer sheet and the confirmation at 08:00, 14:00 and 20:00, Pixel 7 + 360×640, saved to `scratchpad/shots-m41t7/`. Look at them.
  - Report problems in the report, do not fix them.
  - Run `npm run check`, `npm run test` and `npm run test:e2e`; all green; record the counts.
- [ ] **Step 4: Commit** `docs: Handy-Checkliste Meilenstein 4.1, Spec-Notizen`.
