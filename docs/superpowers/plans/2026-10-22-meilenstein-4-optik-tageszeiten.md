# Meilenstein 4 – Optik & Tageszeiten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ruhe bekommt drei Tageszeit-Stimmungen, gemalte Aquarell-Motive (Stil „zart mit Goldlinie“) auf allen Reitern und die Atem-Blüte statt des Atemkreises – ohne Änderung an Funktionen und Audio.

**Architecture:** Eine reine Funktion `tageszeit(date)` bestimmt die Stimmung; ein kleiner Store setzt `data-tageszeit` am `<html>` (ein Inline-Skript in `index.html` schon vor dem ersten Zeichnen), alle Farben kommen aus CSS-Variablen je Stimmung in `app.css`. Die 28 Motive sind freigestellte WebP-Dateien unter `public/images/motive/`, angesprochen über `motivUrl(id)` und im Precache. Die Atem-Blüte ist eine Svelte-Komponente, die Größe, Spreizung und Phase aus der bestehenden Audio-Uhr-Anzeige (`programClock`, `breathAt`) bekommt.

**Tech Stack:** Vite 8, Svelte 5 (Runes), TypeScript 6, vite-plugin-pwa 2 (Workbox), Vitest 5 (unit + browser), Playwright 1.56 (Pixel 7, Port 4173); Motive: ElevenLabs-Connector (`gpt-image-2.5-sunburst`), Freistellen mit Python 3 + Pillow + NumPy (nur Entwicklungswerkzeug).

**Spec:** `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` (ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md`). Entwürfe: https://claude.ai/artifact/Xj1LBKUjN413NKGUwwruPH

## Global Constraints

- Keine neuen Abhängigkeiten der App, Paketversionen unverändert aus `package.json`. Nie `playwright install` lokal.
- Vite `base` `/ruhe/`; Dateien aus `public/` nur über `assetUrl()` (`src/lib/sounds/catalog.ts`) ansprechen.
- Oberfläche Deutsch, Du-Form; Texte aus Spec und Plan wörtlich.
- Audio-Zeitsteuerung nie über `setTimeout`/`setInterval`/`requestAnimationFrame`; der Minuten-Takt der Tageszeit und CSS-Animationen sind reine Anzeige und erlaubt. `output.ts`, `anchor.ts` und die Engine bleiben unverändert.
- Tageszeit-Grenzen: morgen 5–11, tag 11–17, abend 17–5 Uhr (Beginn inklusive, Ende exklusive), lokale Zeit.
- Farbwerte je Stimmung: Startwerte aus Spec §2.2; Feinschliff erlaubt, solange der Kontrast-Test (Task 3) grün ist: Text und gedämpfter Text auf Karte ≥ 4,5:1, `--on-accent` auf `--accent` ≥ 4,5:1.
- `--gold: #F2C98A` in allen Stimmungen für Zierlinien; Knöpfe und aktiver Reiter in `--accent`.
- „Bewegung reduzieren“ (`prefers-reduced-motion: reduce`): keine Überblendungen, keine Bewegung der Blüte, kein Sternfunkeln.
- Motive sind Schmuck: `<img alt="">` bzw. `aria-hidden="true"`; die Bedeutung trägt immer der Text. Tippflächen ≥ 48 px.
- Motive: WebP mit Alpha, je ≤ 60 KB (Klang-Motive ≤ 90 KB), zusammen ≤ 1,5 MB; Zielgrößen Symbole 168, Themen 192, Vorschlag 288, Atem 240, Klang 480, Blätter 360 px.
- Reine Logik in `src/lib/**/*.ts` mit Unit-Tests; `.svelte`/`.svelte.ts` bleiben dünn.
- Vor jedem Playwright-Lauf Port 4173 frei (`lsof -i :4173`; `ss` ist nicht installiert), sonst testet man einen alten Build.
- Jeder Commit endet mit
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und
  `Claude-Session: https://claude.ai/code/session_01YFBD4q9VZrxdFh2nUt9NdS`.

## Review Focus

1. **Rückkehr nach Stunden:** Das Handy lag über 17 Uhr hinweg im Standby → beim Zurückkehren (`visibilitychange`) sofort Abend-Stimmung, ohne auf den nächsten Minuten-Takt zu warten. *(Test in Task 4.)*
2. **Erstes Zeichnen:** Morgens beim Öffnen blitzt nie kurz der Abendhimmel auf → `data-tageszeit` steht, bevor das App-Skript läuft. *(Test in Task 3: Modul-Skript blockiert, Attribut trotzdem gesetzt.)*
3. **Fehlende Motivdatei** (z. B. alter Cache, 404): Kacheln und Zeilen bleiben bedienbar, gleich groß und lesbar. *(Tests in Task 9 und 10.)*
4. **Schmales Handy mit großer Systemschrift** (360 px, Schrift 130 %): Atem-Kacheln brechen um, nichts läuft seitlich über. *(Test in Task 9.)*
5. **Atemübung pausiert:** Die Blüte steht still (auch die Drehung) und ist nach „Weiter“ sofort wieder im Takt. *(Test in Task 11.)*

---

### Task 1 (Controller): Motive erzeugen und zur Auswahl stellen

Kein Implementierer; der Controller nutzt den ElevenLabs-Connector (Bild-Erzeugung frisst viel Kontext → in einen Subagenten auslagern, der nur Dateipfade zurückmeldet).

- [ ] **Step 1:** Für die acht neuen Gruppen je ein Bild mit `generations_count` 4 erzeugen (`gpt-image-2.5-sunburst`), Prompt-Schema (Stil wörtlich aus Stilprobe 3):
  `Three minimal icons in refined watercolor with fine gold accents, side by side in one wide horizontal row on a plain, flat, dark navy blue background (#1b2350), each centered in its third with lots of breathing room. Icon 1: … Icon 2: … Icon 3: … Light transparent washes with subtle pigment granulation, and a few delicate hairline strokes of metallic gold ink tracing parts of each contour, like an elegant gilded illustration. Sophisticated, calm, luxurious, premium wellness aesthetic, no text, no shadows, no paper border.`
  Gruppen (Motive laut Spec §3.2): `timer`+`ich` · `vorschlag-morgen|tag|abend` · `thema-achtsamkeit|stress|fokus` · `atem-478|box|kohaerent` · `atem-langes-ausatmen|seufzer|wechselatmung` · `klang-regen|meer|wind` · `klang-braun|wald|kaminfeuer` · `klang-bach|klangschalen` (bei zwei Motiven „Two minimal icons … each centered in its half“).
- [ ] **Step 2:** PNGs nach `scratchpad/m4-motive/<gruppe>-v<n>.png` laden; Flow- und Generation-IDs notieren.
- [ ] **Step 3:** Auswahlseite als Blatt im Entwurfs-Artifact: je Gruppe die vier Varianten nebeneinander, nummeriert; dem Nutzer die Auswahl stellen. Tasks 2–5 laufen weiter, während der Nutzer wählt.

### Task 2: Tageszeit bestimmen

**Files:** Create `src/lib/time/tageszeit.ts` · Modify `src/lib/time/greeting.ts` · Test `tests/unit/tageszeit.test.ts`, `tests/unit/greeting.test.ts`

**Interfaces:**
- Produces: `type Tageszeit = 'morgen' | 'tag' | 'abend'`; `tageszeit(date: Date): Tageszeit`; `GREETING: Record<Tageszeit, string>` = `{ morgen: 'Guten Morgen', tag: 'Guten Tag', abend: 'Guten Abend' }`; `greetingFor(date)` liefert `GREETING[tageszeit(date)]`.

- [ ] **Step 1: Failing tests** – `tageszeit at every boundary`: 04:59 abend, 05:00 morgen, 10:59 morgen, 11:00 tag, 16:59 tag, 17:00 abend, 23:59 abend, 00:00 abend (jeweils `new Date(2026, 9, 22, h, m)`); `greetingFor agrees with tageszeit for all 24 hours`.
- [ ] **Step 2:** `npx vitest run --project unit tests/unit/tageszeit.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren; `greetingFor` stützt sich auf `tageszeit`, bestehende Greeting-Tests bleiben grün.
- [ ] **Step 4:** Unit-Projekt grün.
- [ ] **Step 5:** Commit `feat: Tageszeit aus der Uhrzeit`.

### Task 3: Farben je Tageszeit, Kartenstil, Stimmung vor dem ersten Zeichnen

**Files:** Modify `src/app.css`, `index.html` · Test `tests/unit/theme-contrast.test.ts`, `tests/unit/theme-prepaint.test.ts`, `tests/e2e/tageszeit.spec.ts`

**Interfaces:**
- Consumes: `tageszeit` (Task 2).
- Produces: CSS-Variablen `--sky-top`, `--sky-mid`, `--sky-bottom`, `--sky-horizon`, `--accent`, `--on-accent`, `--text`, `--text-muted`, `--hill-far`, `--hill-near`, `--star-opacity`, `--gold`, `--surface`, `--surface-border` für `:root` (= abend) sowie `:root[data-tageszeit='morgen']` und `:root[data-tageszeit='tag']`; Inline-Skript `<script id="tageszeit-vorab">` in `index.html`, das `document.documentElement.dataset.tageszeit` setzt.

- [ ] **Step 1: Failing tests**
  - `theme-contrast.test.ts` liest `src/app.css` (Text, Regex auf die drei Blöcke) und prüft je Stimmung: `--text` und `--text-muted` auf `--surface` über `--sky-mid` und über `--sky-bottom` (Alpha-Komposition) ≥ 4.5; `--on-accent` auf `--accent` ≥ 4.5 (WCAG-Formel im Test).
  - `theme-prepaint.test.ts` liest `index.html`, führt den Inhalt von `#tageszeit-vorab` mit einem Fake-`document` und fester Stunde 0…23 aus und erwartet für jede Stunde `tageszeit(...)`.
  - `tageszeit.spec.ts`: `prepaint: the mood is set before the app script runs` – Uhr 08:00 (`page.clock.setFixedTime`, `timezoneId: 'Europe/Berlin'`), alle Requests auf `**/assets/*.js` abbrechen, `page.goto('./')` → `html[data-tageszeit="morgen"]`.
- [ ] **Step 2:** Tests rot.
- [ ] **Step 3:** Variablen und Blöcke laut Spec §2.2 (Abend = bisherige Werte), `@property` für die Farbvariablen (`syntax: '<color>'`) und `--star-opacity` (`'<number>'`) mit Übergang 1,5 s auf `:root` – nur unter `prefers-reduced-motion: no-preference`. Karten (`.card`): Rundung 28 px, `backdrop-filter: blur(14px)`. Inline-Skript: Stundengrenzen 5/11/17, ohne Import.
- [ ] **Step 4:** Unit + e2e grün; bestehende Suiten grün (`npm test`, `npx playwright test`).
- [ ] **Step 5:** Commit `feat: Farben je Tageszeit, schon vor dem ersten Zeichnen`.

### Task 4: Stimmung im Lauf wechseln, Himmel je Tageszeit

**Files:** Create `src/lib/ui/tageszeit.svelte.ts` · Modify `src/components/Sky.svelte`, `src/main.ts` (oder `App.svelte`), `src/screens/Heute.svelte` (Begrüßung, Vorschlag reaktiv) · Test `tests/e2e/tageszeit.spec.ts`, `tests/browser/tageszeit-store.test.ts`

**Interfaces:**
- Consumes: `tageszeit`, `GREETING` (Task 2), CSS-Variablen (Task 3).
- Produces: `tageszeitUi: { current: Tageszeit }` ($state); `followTageszeit(now?: () => Date): () => void` – setzt sofort `data-tageszeit` und `<meta name="theme-color">` (Wert = berechnetes `--sky-top`), plant den nächsten Wechsel zur nächsten vollen Minute, hört auf `visibilitychange`, gibt das Aufräumen zurück. Heute: `greeting = GREETING[tageszeitUi.current]`, Vorschlag wird bei jedem Wechsel von `tageszeitUi.current` neu mit `suggestionFor(new Date())` bestimmt.

- [ ] **Step 1: Failing tests**
  - Browser: `followTageszeit sets the attribute and theme-color at once`; `switches at the next full minute after a boundary` (Fake-Uhr per injiziertem `now`, Vitest-Timer); `switches immediately on visibilitychange`; Aufräumen entfernt Timer und Listener.
  - e2e: `the mood follows the time of day` (08:00/14:00/20:00 → morgen/tag/abend, Begrüßung „Guten Morgen“/„Guten Tag“/„Guten Abend“); `the mood changes while the app is open` (10:59:30, `page.clock.runFor('01:00')` → `tag`, Begrüßung „Guten Tag“, ohne Neuladen); **Review Focus 1:** `returning to the app after hours updates at once` (16:00 → Uhr per `page.clock.setSystemTime` auf 18:00, `visibilitychange` auslösen → sofort `abend`, ohne Minuten-Takt abzuwarten).
- [ ] **Step 2:** Tests rot.
- [ ] **Step 3:** Store implementieren und beim App-Start aufrufen. `Sky.svelte`: Ebenen Morgensonne (warmer Schein hinter den Bergen), Tagessonne (oben rechts), Mond; Sterne mit `opacity: var(--star-opacity)`; Berge über `--hill-far`/`--hill-near`, Seeglanz in `--accent`. Die drei Gestirne liegen übereinander, nur das der Stimmung ist sichtbar (`[data-tageszeit]`-Selektoren), Übergang 1,5 s nur ohne Bewegungswunsch. Player (Spec §4.6): `PlayerShell`, `ProgressDial` und Mini-Player nutzen nur noch die Variablen – fest eingetragene Goldwerte werden `--accent` (Ring, Hauptknopf) bzw. `--gold` (Zierde).
- [ ] **Step 4:** Grün; Bildschirmfotos Heute bei 08:00/14:00/20:00 (Pixel 7, 360×640) nach `scratchpad/shots-m4t4/`, angesehen.
- [ ] **Step 5:** Commit `feat: Stimmung wechselt mit der Tageszeit, Himmel je Stimmung`.

### Task 5: Atem-Logik für Kacheln und Blüte

**Files:** Modify `src/lib/breath/patterns.ts`, `src/lib/breath/view.ts` · Test `tests/unit/breath.test.ts`, `tests/unit/breath-view.test.ts`

**Interfaces:**
- Produces: `BreathPattern.effect: string` (Spec §4.3: 478 „Einschlafen“, box „Konzentration“, kohaerent „Balance“, langes-ausatmen „Entspannung“, seufzer „Schnell beruhigen“, wechselatmung „Ausgleich“); `rhythmLabel(p: BreathPattern): string`; `petalOffset(level: number): number` = `0.04 − 0.17 × level` (Anteil der Blattlänge, negativ = nach außen); `phaseColor` liefert ein `#B7A8F0`, halten `#F2C98A`, aus `#8FD0D6`. `holdPulse` entfällt (mit Test), sobald Task 11 es nicht mehr nutzt – hier schon entfernen und den Aufruf in `BreathPlayer` vorerst durch 0 ersetzen.

- [ ] **Step 1: Failing tests** – `rhythm labels`: 478 → `4-7-8`, box → `4-4-4-4`, kohaerent → `5,5-5,5`, langes-ausatmen → `4-6`, seufzer → `3+1-6`, wechselatmung → `4-4-4-4`; `every pattern has its effect` (die sechs Texte wörtlich); `petalOffset(0)` = 0.04, `petalOffset(1)` = −0.13, `petalOffset(0.5)` ≈ −0.045; `phase colors`.
- [ ] **Step 2:** rot. **Step 3:** implementieren (Rhythmus: aufeinanderfolgende Phasen gleicher Art mit „+“, sonst „-“, Dezimalkomma). **Step 4:** grün.
- [ ] **Step 5:** Commit `feat: Rhythmus, Wirkung und Blütenwerte der Atemübungen`.

### Task 6 (Controller): Motive freistellen und einchecken

Nach der Auswahl des Nutzers (Task 1).

**Files:** Create `scripts/freistellen.py`, `content/motive.json`, `public/images/motive/*.webp` (28)

- [ ] **Step 1:** `scripts/freistellen.py <quelle.png> <ziel.webp> --crop x,y,w,h --size N` aus dem erprobten Scratchpad-Skript (Flood-Fill vom Rand auf Farbabstand < 38 zur Randfarbe, Kantenband 4 px mit Alpha = Abstand/90, Grundfarbe herausrechnen, auf Motiv beschneiden, quadratisch, Lanczos, WebP Qualität 82 mit Alpha). Kopfkommentar: Voraussetzung Python 3, Pillow, NumPy.
- [ ] **Step 2:** `content/motive.json`: `{ "style": "<Stil-Text aus Task 1>", "motive": [ { "id", "subject", "flow", "generation", "crop": [x,y,w,h], "size" } ] }` für alle 28 (vorhandene: `meditieren|atmen|klaenge` aus Flow `FjcZHUenrc2TajssE5ea`, Generation `XkJKuBbAKlJzejpnGeN3`; `blatt-ein|halten|aus` aus Flow `Xg68RH1ZHNte8buN0sSL`, Generation `4FxjINyRQfptlPLbHhth`).
- [ ] **Step 3:** Alle 28 erzeugen, Größen prüfen (Budget laut Global Constraints), auf den drei Himmeln ansehen (Vorschaublatt), Ränder ohne Navy-Saum.
- [ ] **Step 4:** Commit `content: 28 gemalte Motive (zart mit Goldlinie)`.

### Task 7: Motiv-Katalog und Precache

**Files:** Create `src/lib/content/motive.ts` · Modify `vite.config.ts` · Test `tests/unit/motive.test.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: Dateien aus Task 6, `assetUrl`.
- Produces: `type MotivId` (die 28 IDs aus Spec §3.2), `MOTIV_IDS: readonly MotivId[]`, `motivUrl(id: MotivId): string` = `assetUrl('images/motive/' + id + '.webp')`; Hilfen `soundMotiv(id: SoundId): MotivId` (`klang-<id>`), `breathMotiv(id: BreathPatternId): MotivId` (`atem-<id>`), `themaMotiv(c: Category): MotivId` (`thema-<c>`), `vorschlagMotiv(t: Tageszeit): MotivId`.

- [ ] **Step 1: Failing tests** – `every motif id has a webp file with alpha` (RIFF/WEBP-Kopf, VP8L oder VP8X mit Alpha-Flag); `files stay within budget` (≤ 60 KB, `klang-*` ≤ 90 KB, Summe ≤ 1,5 MB); `no stray files in public/images/motive`; e2e `pwa.spec.ts`: der gebaute Service Worker führt alle 28 Motive im Precache.
- [ ] **Step 2:** rot. **Step 3:** Katalog; `globPatterns` um `webp` erweitern. **Step 4:** grün.
- [ ] **Step 5:** Commit `feat: Motive im Katalog und offline ab dem ersten Laden`.

### Task 8: Heute, Meditieren und Ich im neuen Stil

**Files:** Create `src/components/Motiv.svelte` · Modify `src/screens/Heute.svelte`, `src/screens/Meditieren.svelte`, `src/screens/Ich.svelte`, `src/lib/ui/heute-view.ts` (falls Texte dorthin gehören) · Test `tests/e2e/heute.spec.ts`, `tests/e2e/guided.spec.ts`, `tests/e2e/navigation.spec.ts`, `tests/e2e/ich.spec.ts`

**Interfaces:**
- Consumes: `motivUrl`, `vorschlagMotiv`, `themaMotiv` (Task 7), `tageszeitUi` (Task 4).
- Produces: `Motiv.svelte` mit Props `{ id: MotivId; size: number }` → `<img alt="" width height loading="lazy" decoding="async">` mit fester Fläche (fällt das Bild aus, bleibt der Platz).

- [ ] **Step 1: Failing tests (e2e)**
  - Heute: Karten in der Reihenfolge „Vorschlag des Tages“, „Zuletzt genutzt“, „Aktivitäten“; die Karten „3 Min durchatmen“/„Zur Ruhe kommen“ gibt es nicht mehr.
  - Zeile „Meditieren“ (Name enthält „Geführt oder mit Timer“) → Reiter Meditieren aktiv.
  - Zeile „Atemübung“ („3 Min kohärent atmen“) → Atem-Player Kohärentes Atmen läuft, `lastUsed` = `{ kind: 'breath', pattern: 'kohaerent', minutes: 3 }`.
  - Zeile „Klänge“ („Zur Ruhe kommen“) → Reiter Klänge.
  - Vorschlags-Motiv je Stimmung (`img[src*="vorschlag-morgen"]` um 08:00 usw.).
  - Meditieren: Timer-Karte mit Motiv `timer`, je Thema Motiv `thema-…`.
  - Ich: Motiv `ich` neben der Überschrift.
  - Alle bisherigen Prüfungen auf „Jetzt durchatmen“/„Zu den Klängen“ auf die neuen Zeilen umstellen.
- [ ] **Step 2:** rot. **Step 3:** umsetzen nach Spec §4.1, §4.2, §4.5 (Zeilen sind Knöpfe ≥ 48 px, Symbol 56 px, Vorschlags-Motiv 96 px, Themen-Motiv 64 px). **Step 4:** grün; alle e2e grün.
- [ ] **Step 5:** Bildschirmfotos Heute/Meditieren/Ich bei 08/14/20 Uhr, Pixel 7 + 360×640 → `scratchpad/shots-m4t8/`, angesehen.
- [ ] **Step 6:** Commit `feat: Heute, Meditieren und Ich mit gemalten Motiven`.

### Task 9: Atem-Kacheln

**Files:** Modify `src/screens/Atmen.svelte` · Test `tests/e2e/atmen.spec.ts`

**Interfaces:**
- Consumes: `rhythmLabel`, `effect` (Task 5), `breathMotiv` (Task 7), `Motiv.svelte` (Task 8).

- [ ] **Step 1: Failing tests (e2e)**
  - Sechs Kacheln in zwei Spalten (Pixel 7: je Zeile zwei, gleiche Breite).
  - Jede Kachel zeigt Titel, Rhythmus und Wirkung, z. B. „4-7-8“ · „Einschlafen“.
  - Name „{Titel} starten“, Beschreibung (`toHaveAccessibleDescription`) = die bisherige Beschreibung.
  - Tippen startet die Übung mit der gewählten Dauer.
  - **Review Focus 3:** Motive per `page.route('**/images/motive/**', r => r.fulfill({ status: 404 }))` → alle Kacheln bleiben gleich groß, Namen und Texte da.
  - **Review Focus 4:** 360×640 und `document.documentElement.style.fontSize = '130%'` → `scrollWidth <= clientWidth` und kein Text außerhalb seiner Kachel.
- [ ] **Step 2:** rot. **Step 3:** Grid `repeat(2, minmax(0, 1fr))`, ganze Kachel ist `<button>`, Motiv 80 px oben rechts, Text bricht um. **Step 4:** grün.
- [ ] **Step 5:** Bildschirmfotos (3 Stimmungen, 2 Größen) → `scratchpad/shots-m4t9/`, angesehen. **Step 6:** Commit `feat: Atemübungen als Kacheln mit Motiv, Rhythmus und Wirkung`.

### Task 10: Klang-Kacheln mit Motiv

**Files:** Modify `src/components/SoundTile.svelte`, `src/screens/Klaenge.svelte` (falls Raster angepasst), `src/components/icons.ts` (Linien-Symbole der Klänge entfallen, wenn nirgends mehr genutzt) · Test `tests/e2e/klaenge.spec.ts`

**Interfaces:**
- Consumes: `soundMotiv` (Task 7), `Motiv.svelte` (Task 8).

- [ ] **Step 1: Failing tests (e2e)**
  - Jede Klang-Kachel zeigt ihr Motiv (`img[src*="klang-regen"]` usw.).
  - Der Titel bleibt lesbar: Kontrast des Titels gegen den Verlauf, gerechnet im Test aus den berechneten Farben, ≥ 4,5:1.
  - Antippen/Wechseln/Lautstärke unverändert (bestehende Tests grün).
  - **Review Focus 3:** Motive mit 404 → Kacheln gleich groß, bedienbar.
- [ ] **Step 2:** rot. **Step 3:** Motiv als Bild in der Kachel, Verlauf hinter dem Titel; aktive Kachel weiter erkennbar. **Step 4:** grün.
- [ ] **Step 5:** Bildschirmfotos → `scratchpad/shots-m4t10/`, angesehen. **Step 6:** Commit `feat: Klang-Kacheln mit gemalten Motiven`.

### Task 11: Atem-Blüte

**Files:** Create `src/components/player/BreathFlower.svelte` · Modify `src/components/player/BreathPlayer.svelte` · Test `tests/e2e/atmen.spec.ts`

**Interfaces:**
- Consumes: `circleScale`, `easedLevel`, `petalOffset`, `phaseColor` (Task 5), `motivUrl` (`blatt-ein|halten|aus`, Task 7), `programClock`, `breathAt` (bestehend).
- Produces: `BreathFlower.svelte` mit Props `{ scale: number; offset: number; kind: PhaseKind; paused: boolean }`; Wurzel `data-testid="breath-flower"`, `data-phase={kind}`, `style="--scale: …; --offset: …"`.

- [ ] **Step 1: Failing tests (e2e)**
  - `the flower opens while breathing in`: `--scale` wächst in der Einatemphase.
  - `petals change colour with the phase`: `data-phase` folgt ein → halten → aus, und die sichtbare Farbebene passt (Deckkraft der Ebene der Phase > 0,5, der anderen < 0,1 nach 1 s).
  - `the old circle and phase ring are gone`: kein `breath-circle`, kein `phase-ring`.
  - `with reduced motion the flower stands still` (`reducedMotion: 'reduce'`): berechnete `transform` von Blüte und Blättern über 3 s konstant, keine laufende Animation, Farbe wechselt trotzdem.
  - **Review Focus 5:** `paused flower stands still and is in time after resume`: Pause → `transform` und `getAnimations()`-Zustand der Drehung über 2 s unverändert („paused“); „Weiter“ → `--scale` entspricht innerhalb von 0,05 dem Wert aus `breathAt` für die Audio-Uhr.
  - Phasenwort, Countdown, Vibration bleiben (bestehende Tests grün).
  - Im Player steht unter dem Titel die Beschreibung der Übung.
- [ ] **Step 2:** rot.
- [ ] **Step 3:** Blüte laut Spec §5: sechs Blätter je 60°, je Blatt drei Farbebenen, aktive Ebene Deckkraft 0,8, Übergang 0,6 s; Größe `circleScale(easedLevel)`, Spreizung `petalOffset(level)` × Blattlänge; Drehung CSS 120 s je Umdrehung, `animation-play-state: paused` bei `paused`; unter `prefers-reduced-motion: reduce` feste Größe/Spreizung für Atemstand 0,5, keine Drehung, keine Übergänge; weicher Schein in `phaseColor(kind)`. Kreis, Schein-Ring und Phasenring aus `BreathPlayer` entfernen; nicht mehr genutzte Hilfen (`phaseProgress` nur, wenn auch `easedLevel` es nicht mehr braucht) bleiben bzw. entfallen samt Tests.
- [ ] **Step 4:** grün; Atem-Player-Bildschirmfotos in allen drei Phasen und Stimmungen → `scratchpad/shots-m4t11/`, angesehen.
- [ ] **Step 5:** Commit `feat: Atem-Blüte statt Atemkreis`.

### Task 12: Spec-Notizen, Handy-Checkliste, Rundgang

**Files:** Modify `README.md`, `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- [ ] **Step 1:** Haupt-Spec: datierte Notizen *Ergänzung vom 22.10.2026 (Meilenstein 4):* mit Verweis auf die M4-Spec in §3.1 (Aktivitäten-Karte ersetzt „3 Min durchatmen“ und „Zur Ruhe kommen“), §3.3 (Kacheln, Atem-Blüte statt Kreis, Phasenfarben neu), §3.4 (Klang-Kacheln mit Motiv), §7 (drei Stimmungen, gemalte Motive), §11 (Meilensteine 5 Musik, 6 Stimmungs-Check-in).
- [ ] **Step 2:** README: „Handy-Checkliste Meilenstein 4“ mit den fünf Punkten aus Spec §8; Abschnitt „Motive malen“ (Ablauf: Prompt-Schema aus `content/motive.json`, Connector, Auswahl, `python3 scripts/freistellen.py …`, Budget).
- [ ] **Step 3:** Rundgang: alle Reiter und alle drei Player bei 08/14/20 Uhr, Pixel 7 + 360×640 → `scratchpad/shots-m4t12/`, angesehen; `npm run check`, `npm test`, `npx playwright test` grün.
- [ ] **Step 4:** Commit `docs: Handy-Checkliste Meilenstein 4, Spec-Notizen`.
