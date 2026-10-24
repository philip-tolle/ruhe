# Meilenstein 7: Neue geführte Meditationen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 neue, vertonte Meditationen in drei neuen und den drei bisherigen Themen, mit eigenen Motiven, Farbflächen und einem Vorschlag des Tages aus zwei Themen je Tageszeit.

**Architecture:**
- **Inhalte:** die Texte in `content/meditations/*.md`, gelesen vom vorhandenen Parser (`scripts/lib/meditation-text.mjs`).
- **App:** Die Themen stehen als `Category` in `src/lib/content/catalog.ts`, die Farben in `waschungen.ts`, die Motive in `motive.ts`.
- **Vertonung:** Sie läuft über den bestehenden Weg (`npm run meditations …` und ElevenLabs-Connector). Bis dahin spielen Platzhalter, damit Code und Tests vorher fertig werden.

**Tech Stack:** Svelte 5, TypeScript, Vitest, Playwright, Node-Skript `scripts/meditations.mjs` (ffmpeg), ElevenLabs-Connector (Sprache und Bilder), `scripts/freistellen.py`.

**Spec:** `docs/superpowers/specs/2026-10-24-ruhe-m7-meditationen-design.md`

## Global Constraints

- **IDs, Titel, Themen und Ziel-Längen** der 9 neuen Meditationen genau wie Spec §2:
  - `freundlich-mit-dir` 8, `liebevolle-guete` 10 (`mitgefuehl`)
  - `ein-schweres-gefuehl-begleiten` 10, `wenn-die-gedanken-kreisen` 7 (`gefuehle`)
  - `gehmeditation` 10, `achtsam-essen` 5 (`alltag`)
  - `klaenge-hoeren` 7 (`achtsamkeit`), `die-schultern-sinken-lassen` 8 (`stress`), `atemzuege-zaehlen` 6 (`fokus`)
- **Themen-Reihenfolge und Titel:**
  - `achtsamkeit` „Einsteiger & Achtsamkeit“, `stress` „Stress & Ruhe“, `fokus` „Fokus & Energie“
  - `mitgefuehl` „Mitgefühl & Freundlichkeit“, `gefuehle` „Gefühle & Loslassen“, `alltag` „Achtsam im Alltag“
- **Farbflächen:** `mitgefuehl` lavendel, `gefuehle` blaugruen, `alltag` pfirsich; die bisherigen bleiben.
- **Vorschlag:** morgen `fokus` + `alltag`, tag `stress` + `gefuehle`, abend `achtsamkeit` + `mitgefuehl`. Rotation über beide Themen zusammen, in Katalog-Reihenfolge.
- **Texte:** Stilleanteil ≥ 40 %, geschätzte Länge höchstens 1 Minute neben der Ziel-Länge. Ruhig, Du-Form, keine Heilsversprechen.
- **Stimme:** Susanne K, `eleven_v4`, Präfix `[softly] [slowly]`. `audio-work/voice.json` bleibt unverändert.
- **Motive:** `thema-mitgefuehl`, `thema-gefuehle`, `thema-alltag`, Zielgröße 192, danach 39 Motive.
- **Kosten:** Jede Connector-Generierung genau einmal, nie wiederholen.
- **Freigaben des Nutzers:** Vertont wird erst nach Freigabe der Texte und nach OK zu den geschätzten Credits. Veröffentlicht wird nur mit OK.

## Review Focus

1. **Tageszeit-Grenzen:** Um 4:59, 5:00, 10:59, 11:00, 16:59 und 17:00 Uhr kommt der Vorschlag aus dem richtigen Themenpaar (Test in Task 3).
2. **Gerät mit altem Offline-Stand:** Alle 9 bisherigen sind gespeichert. „Ich“ zeigt dann „9 von 18 Meditationen“, und „Alle offline speichern“ lädt nur die 9 neuen (Test in Task 3).
3. **Platzhalter rutscht in die Veröffentlichung:** Nach der Vertonung ist keine Meditation mehr als Platzhalter markiert, und `audio-work/placeholders.json` ist leer (Test in Task 4).
4. **Benachbarte Themen mit gleicher Farbe:** In der Reihenfolge aus Spec §4 haben zwei aufeinanderfolgende Themen nie dieselbe Farbfläche (Test in Task 3).
5. **„Zuletzt genutzt“ mit einer neuen Meditation:** Ist z. B. `gehmeditation` gemerkt, zeigt „Heute“ ihren Titel, und „Erneut starten“ öffnet sie (Test in Task 3).

---

### Task 1: Neun Texte schreiben und freigeben lassen (Controller, Freigabe des Nutzers)

**Files:**
- Create: die 9 Dateien `content/meditations/<id>.md` aus den Global Constraints
- Modify: `scripts/lib/meditation-text.mjs` (`Category`-Typedef, `CATEGORIES`, `CATALOG_ORDER`)
- Test: `tests/unit/meditation-text.test.ts`, `tests/unit/meditation-text-cli.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORIES = ['achtsamkeit', 'stress', 'fokus', 'mitgefuehl', 'gefuehle', 'alltag']`;
  - `CATALOG_ORDER` = die 9 bisherigen IDs, danach die 9 neuen in der Reihenfolge der Spec-Tabelle §2;
  - 9 Textdateien, die den Parser bestehen.

- [ ] **Step 1: Failing tests** in `meditation-text.test.ts`:
  - „accepts the three new themes“: Ein Text mit `category: mitgefuehl` (ebenso `gefuehle`, `alltag`) wird gelesen.
  - „CATALOG_ORDER lists the 18 meditations, the new ones after the old in spec order“: Länge 18; `slice(9)` gleich den 9 neuen IDs in Spec-Reihenfolge.
- [ ] **Step 2:** `npx vitest run tests/unit/meditation-text.test.ts`, erwartet: FAIL (ungültiges Thema, Länge 9).
- [ ] **Step 3: Parser.** `CATEGORIES`, Typedef und `CATALOG_ORDER` wie oben. Die Fehlermeldung nennt automatisch alle sechs Themen.
- [ ] **Step 4: Texte schreiben.**
  - Neun Dateien nach Spec §2 (Inhalt) und §3 (Format, Stil), im Ton der bisherigen Texte (Vorbild: `drei-minuten-atempause.md`, `bodyscan-im-sitzen.md`).
  - Frontmatter mit `id`, `title`, `category`, `minutes`, `description` (ein Satz).
  - `gehmeditation` beginnt mit dem Hinweis auf einen sicheren Ort und offene Augen, `achtsam-essen` mit der Bitte, etwas Kleines bereitzulegen.
- [ ] **Step 5:** `npm run meditations estimate` muss für alle 18 durchlaufen: Stilleanteil ≥ 40 %, keine neue Meditation mehr als 1 Minute neben ihrer Ziel-Länge (Abweichungen durch Pausen ausgleichen). Dazu `npx vitest run tests/unit/meditation-text.test.ts tests/unit/meditation-text-cli.test.ts`, erwartet: PASS.
- [ ] **Step 6: Freigabe** (Stopp für den Nutzer):
  - Die 9 Texte als eine lesbare Datei im Scratchpad zusammenstellen (Titel, Thema, Länge, Beschreibung, Text; Pausen als „· 6 s ·“) und mit `SendUserFile` schicken.
  - Mit `AskUserQuestion` nach Freigabe oder Änderungswünschen fragen.
  - Änderungen einarbeiten, Step 5 wiederholen, bis der Nutzer freigibt.
- [ ] **Step 7: Commit** `content: neun neue Meditationstexte (freigegeben)` mit den 9 Texten, dem Parser und den Tests.

### Task 2: Drei Themen-Motive (Controller, Wahl des Nutzers)

Darf schon laufen, während der Nutzer die Texte aus Task 1 liest.

**Files:**
- Create: `public/images/motive/thema-mitgefuehl.webp`, `thema-gefuehle.webp`, `thema-alltag.webp`
- Modify: `content/motive.json`, `src/lib/content/motive.ts` (IDs in der Gruppe „Themen“, Kopfkommentar „39“), `tests/unit/motive.test.ts` (39), `tests/e2e/pwa.spec.ts` (39), `README.md` („Die 39 gemalten Motive“)

**Interfaces:**
- Produces: `MotivId` enthält `'thema-mitgefuehl' | 'thema-gefuehle' | 'thema-alltag'`.

- [ ] **Step 1: Failing test.** In `motive.test.ts` lautet der Test jetzt „… the 39 motifs …“ und erwartet 39. Dazu `npx vitest run tests/unit/motive.test.ts`, erwartet: FAIL (36).
- [ ] **Step 2: Erzeugen.**
  - Genau ein Aufruf `creative_generate_image` mit `gpt-image-2.5-sunburst` und dem Schema aus `content/motive.json`.
  - Icon 1 „two flower petals forming a heart“, Icon 2 „a single leaf drifting away on calm water“, Icon 3 „a steaming tea bowl“.
  - Danach `creative_get_flow_run_status` abfragen, bis alles fertig ist.
- [ ] **Step 3: Wahl.**
  - Auswahlseite mit den Feldern 1A bis 4C wie in M6 (PNG) per `SendUserFile` schicken.
  - Mit `AskUserQuestion` je Motiv eine Variante wählen lassen, in drei Fragen in einem Aufruf.
- [ ] **Step 4: Freistellen.**
  - Den Ausschnitt jeweils über die Pixel vor der Grundfarbe im Drittel des gewählten Bildes ermitteln, mit etwa 20 px Rand.
  - `python3 scripts/freistellen.py <png> public/images/motive/thema-<id>.webp --crop … --size 192`.
  - Ergebnis per `Read` ansehen.
- [ ] **Step 5: Eintragen.**
  - In `motive.json` je Motiv ein Eintrag mit `subject`, `flow`, `generation`, `crop` und `size: 192`.
  - In `motive.ts` stehen die IDs in der Themen-Zeile nach `'thema-fokus'`.
  - README und `pwa.spec.ts` mit der Zahl 39.
- [ ] **Step 6:** `npx vitest run tests/unit/motive.test.ts && npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 7: Commit** `feat: drei Themen-Motive für Mitgefühl, Gefühle und Alltag`.

### Task 3: Sechs Themen in der App, mit Platzhalter-Audio

**Files:**
- Modify:
  - `src/lib/content/catalog.ts`
  - `src/lib/content/waschungen.ts`
  - `public/audio/meditations/` (9 Platzhalter)
  - `audio-work/placeholders.json`
  - `src/content/meditations.json`
- Test:
  - `tests/unit/catalog-meditations.test.ts`, `tests/unit/waschungen.test.ts`, `tests/unit/motive.test.ts`
  - `tests/e2e/guided.spec.ts`, `tests/e2e/ich.spec.ts`, `tests/e2e/heute.spec.ts`

**Interfaces:**
- Consumes: Texte und `CATALOG_ORDER` (Task 1); Motiv-IDs (Task 2).
- Produces:
  - `type Category = 'achtsamkeit' | 'stress' | 'fokus' | 'mitgefuehl' | 'gefuehle' | 'alltag'`;
  - `CATEGORY_TITLE` mit den sechs Titeln;
  - `byCategory()` in der Reihenfolge der Global Constraints;
  - `suggestionFor(now, list?)` wählt aus zwei Themen je Tageszeit.

- [ ] **Step 1: Failing unit tests.**
  - `catalog-meditations.test.ts`:
    - Der Test „neun Meditationen, je drei pro Thema“ wird zu „18 Meditationen: je vier in den bisherigen, je zwei in den neuen Themen, jede mit gültigem Thema“.
    - Der Test „Themen in der Reihenfolge …“ erwartet sechs Titel in der Reihenfolge der Global Constraints.
    - Die Vorschlagstests werden zu Themenpaaren: Morgen liefert nur `fokus` oder `alltag`, Tag nur `stress` oder `gefuehle`, Abend nur `achtsamkeit` oder `mitgefuehl`.
    - Grenzen (Review Focus 1): 4:59 → Abend-Paar, 5:00 → Morgen-Paar, 10:59 → Morgen, 11:00 → Tag, 16:59 → Tag, 17:00 → Abend.
    - Rotation: An sechs aufeinanderfolgenden Tagen um 8 Uhr kommen 6 verschiedene Meditationen, am siebten Tag wieder die erste. Am selben Tag bleibt der Vorschlag über alle Stunden einer Tageszeit gleich.
    - Rückfall: Hat keines der beiden Themen einen Eintrag, kommt der Vorschlag aus der ganzen Liste.
  - `waschungen.test.ts`:
    - `themaWaschung('mitgefuehl') === 'lavendel'`, `'gefuehle' → 'blaugruen'`, `'alltag' → 'pfirsich'`.
    - „neighbouring themes never share a wash“: über `byCategory()` sind je zwei aufeinanderfolgende Farben verschieden (Review Focus 4).
  - `motive.test.ts`: `themaMotiv` über alle sechs Themen ergibt die sechs `thema-*`-IDs.
- [ ] **Step 2:** `npx vitest run tests/unit/catalog-meditations.test.ts tests/unit/waschungen.test.ts tests/unit/motive.test.ts`, erwartet: FAIL.
- [ ] **Step 3: Platzhalter und Manifest.** `npm run meditations placeholders` legt die 9 Platzhalter an, danach `npm run meditations manifest` (18 Einträge, die 9 neuen mit `placeholder: true`).
- [ ] **Step 4: Code.**
  - `catalog.ts`: `Category`, `CATEGORY_TITLE` und `CATEGORY_ORDER` wie oben.
  - `CATEGORY_AT: Record<Tageszeit, readonly [Category, Category]>` mit morgen `['fokus', 'alltag']`, tag `['stress', 'gefuehle']`, abend `['achtsamkeit', 'mitgefuehl']`. `suggestionFor` filtert auf beide Themen und lässt den Rest unverändert.
  - `waschungen.ts`: `THEMA` ergänzen.
  - Den Kommentar zur Spec-Stelle anpassen.
- [ ] **Step 5:** dieselben Unit-Tests plus `npm run check`, erwartet: PASS, 0 Fehler.
- [ ] **Step 6: E2E anpassen.**
  - `guided.spec.ts`: `GROUPS` und die Motiv-Zuordnung auf sechs Themen, die neuen Titel in Katalog-Reihenfolge; ein neuer Eintrag (`Gehmeditation`) startet den Player.
  - `ich.spec.ts`: In `SUMMARY` und den Sätzen „von 9 Meditationen“ steht jetzt „von 18 Meditationen“; erwartete Abrufe und Cache-Einträge 9 → 18.
  - Neuer Test „a device that saved the 9 earlier meditations shows 9 of 18 and saving fetches only the 9 new“ (Review Focus 2): die 9 bisherigen Adressen vorher in den Cache legen, wie es die vorhandenen Offline-Tests tun.
  - `heute.spec.ts`, neuer Test (Review Focus 5): `lastUsed: { kind: 'guided', id: 'gehmeditation' }` gesät; die Karte „Zuletzt genutzt“ zeigt „Gehmeditation · 10 Min“; „Erneut starten“ öffnet den Player mit dem Titel „Gehmeditation“.
- [ ] **Step 7:** `npx playwright test tests/e2e/guided.spec.ts tests/e2e/ich.spec.ts tests/e2e/heute.spec.ts tests/e2e/karten.spec.ts`, erwartet: alle grün.
- [ ] **Step 8: Commit** `feat: sechs Themen unter „Meditieren“, Vorschlag aus zwei Themen je Tageszeit`.

### Task 4: Vertonen (Controller, OK des Nutzers zu den Credits und Probehören)

**Files:**
- Create: `audio-work/cache/<hash>.mp3` (neue Abschnitte)
- Modify:
  - `public/audio/meditations/<id>.mp3` (die 9 neuen)
  - `audio-work/placeholders.json` (danach leer)
  - `src/content/meditations.json`
- Test: `tests/unit/catalog-meditations.test.ts`

**Interfaces:**
- Consumes: Texte (Task 1), Manifest mit Platzhaltern (Task 3).

- [ ] **Step 1: Failing test** in `catalog-meditations.test.ts`, „no meditation is a placeholder any more“ (Review Focus 3):
  - `MEDITATIONS.every((m) => !m.placeholder)`;
  - `JSON.parse(readFileSync('audio-work/placeholders.json'))` ist `[]`.
  - Erwartet: FAIL (9 Platzhalter).
- [ ] **Step 2: Schätzen.** `npm run meditations estimate` liefert die Zeichen der 9 neuen Texte. Mit `npm run meditations split` stehen die fehlenden Abschnitte fest. Für einen Abschnitt `creative_generate_speech` mit `estimate_only` aufrufen (falls angeboten), sonst aus den Zeichen schätzen. Daraus folgen die erwarteten Credits für alle fehlenden Abschnitte.
- [ ] **Step 3: OK holen** (Stopp für den Nutzer): Mit `AskUserQuestion` Zeichen, Abschnitte und geschätzte Credits nennen; weiter nur mit OK.
- [ ] **Step 4: Vertonen** wie in M3 (README „Meditationen vertonen“, Schritt 4):
  - je fehlendem Abschnitt eine Aufnahme mit Stimme, Modell und Präfix aus `voice.json`;
  - jede genau einmal, gespeichert als `audio-work/cache/<hash>.mp3`;
  - danach zeigt `split` „0 fehlend“.
- [ ] **Step 5: Zusammensetzen.** `npm run meditations assemble <id>` für die 9 neuen, dann `npm run meditations manifest`.
- [ ] **Step 6: Probehören** (Stopp für den Nutzer):
  - `gehmeditation.mp3` und `freundlich-mit-dir.mp3` per `SendUserFile` schicken.
  - Mit `AskUserQuestion` fragen, ob Stimme, Tempo, Pausen und Lautstärke passen.
  - Bei Mängeln einzelne Abschnitte nur nach Rückfrage neu vertonen.
- [ ] **Step 7:**
  - `npx vitest run tests/unit/catalog-meditations.test.ts`, erwartet: PASS, einschließlich „Datei, Version und Größe stimmen“.
  - `npx playwright test tests/e2e/ich.spec.ts`, erwartet: grün, mit neuen Gesamtgrößen.
- [ ] **Step 8: Commit** `audio: neun neue Meditationen vertont (Susanne K)`.

### Task 5: Handy-Checkliste, Haupt-Spec, Gesamtprüfung

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-21-ruhe-design.md`

- [ ] **Step 1: README.**
  - Neuer Abschnitt „Handy-Checkliste Meilenstein 7“ mit den 5 Punkten aus Spec §10, wörtlich, vor der Checkliste von M6.
  - Wo das README die Zahl der Meditationen oder Themen nennt, stehen jetzt 18 und 6.
- [ ] **Step 2: Haupt-Spec.** Kursive *Ergänzung vom 24.10.2026 (Meilenstein 7)* bei §3 (Inhalte): 18 Meditationen in 6 Themen, Verweis auf die M7-Spec.
- [ ] **Step 3: Gesamtprüfung.** `npm run check && npm test && npx playwright test`, erwartet: 0 Fehler, alles grün. Die Zahlen notieren.
- [ ] **Step 4: Commit** `docs: Handy-Checkliste Meilenstein 7`.
