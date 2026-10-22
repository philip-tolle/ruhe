# Ruhe – Meilenstein 4: Optik & Tageszeiten

*Stand: 22.10.2026 · ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md` (im Folgenden „Haupt-Spec“). Wo dieses Dokument etwas anders regelt, gilt dieses Dokument; die Haupt-Spec bekommt an den betroffenen Stellen eine datierte Notiz mit Verweis hierher.*

Entwürfe (privat): https://claude.ai/artifact/Xj1LBKUjN413NKGUwwruPH – Blätter „Heute zu drei Tageszeiten“, „Gemalte Symbole: drei Stilproben“, „Atem-Blüte (animiert)“.

## 1. Ziel & Rahmen

Die App bekommt ein hochwertiges, ruhiges Erscheinungsbild nach dem Vorbild von Samsung Health: gemalte Aquarell-Motive, Kacheln mit Motiv, eine Atem-Blüte statt des Kreises – und drei Stimmungen je nach Tageszeit. Funktionen und Abläufe bleiben, wie sie sind.

**Vom Nutzer entschieden (Brainstorming 22.10.2026):**

1. Aufteilung: Meilenstein 4 Optik & Tageszeiten, Meilenstein 5 Meditationsmusik/-klänge, Meilenstein 6 Stimmungs-Check-in – je eigene Spec, eigener Plan, eigene Veröffentlichung.
2. Tageszeiten: **immer dunkel**, Farbton und Licht wandern mit (Variante A).
3. Motive: **gemalt** (Bilder), Stil **„zart mit feiner Goldlinie“** (Stilprobe 3).
4. Atem-Blüte: sechs gemalte Blätter, Farbe je Phase, wie im Entwurf – **ohne** den goldenen Ring.
5. Umfang der Motive: **B** – Hauptsymbole, Vorschlag des Tages, Themen, jede Atemübung, jeder Klang.

### Erfolgskriterien

- Morgens, nachmittags und abends sieht die App erkennbar anders aus, bleibt aber dunkel und ruhig; der Wechsel geschieht ohne Neustart und ohne Sprung.
- Jede Atemübung und jeder Klang hat ein eigenes gemaltes Motiv im einheitlichen Stil.
- Die Atem-Blüte bleibt auch nach dem Entsperren im Takt von Ton und Vibration, die Phasen sind an Farbe und Wort zu erkennen.
- Alle Texte erfüllen WCAG AA in allen drei Stimmungen; alles ist sofort offline verfügbar.

### Nicht-Ziele

- Keine helle Variante, kein Umschalter für die Stimmung (sie folgt allein der Uhrzeit).
- Keine neuen Funktionen (Musik: Meilenstein 5, Stimmungs-Check-in: Meilenstein 6).
- Kein eigenes Motiv je geführter Meditation (Umfang B: ein Motiv je Thema).
- Keine neue Schrift, keine neuen Reiter-Symbole.

## 2. Tageszeiten

### 2.1 Bestimmung

- `tageszeit(date)` → `'morgen' | 'tag' | 'abend'` nach lokaler Uhrzeit: **morgen 5–11 Uhr, tag 11–17 Uhr, abend 17–5 Uhr** (Grenze jeweils inklusive Beginn, exklusive Ende) – genau die Grenzen der Begrüßung; `greetingFor` stützt sich künftig darauf.
- Die App setzt die Stimmung an **einer** Stelle: `data-tageszeit` am `<html>`-Element. Beim Start sofort (vor dem ersten Zeichnen, damit nichts aufblitzt), danach zu jeder vollen Minute und beim Zurückkehren in die App (`visibilitychange`). Ein JS-Timer ist hier zulässig – er steuert nur die Anzeige, kein Audio.
- Laufende Sitzungen, Begrüßung und „Vorschlag des Tages“ folgen dem Wechsel ebenfalls (Begrüßung und Vorschlag werden beim Wechsel neu bestimmt).

### 2.2 Farbwerte

Jede Stimmung ist ein Satz CSS-Variablen unter `:root[data-tageszeit='…']` in `src/app.css`. Startwerte aus dem Entwurf (Feinschliff nach Augenmaß erlaubt, solange die Kontrast-Tests grün bleiben):

| Rolle | Morgen | Tag | Abend (wie bisher) |
|---|---|---|---|
| Himmel oben `--sky-top` | `#1B1838` | `#0F2236` | `#0B1026` |
| Himmel Mitte `--sky-mid` | `#352A5C` | `#1C3B55` | `#1B2350` |
| Himmel unten `--sky-bottom` | `#7C4D72` | `#3C6272` | `#3A2F5B` |
| Horizont `--sky-horizon` | `#C47C7C` | `#5F8487` | `#3A2F5B` |
| Akzent `--accent` | `#F8B98F` (Pfirsich) | `#9FE0CF` (Mint) | `#F2C98A` (Gold) |
| auf Akzent `--on-accent` | `#2B1B2C` | `#0F2236` | `#0B1026` |
| Text `--text` | `#F7F1FB` | `#EEF6F8` | `#EEF0FA` |
| Text gedämpft `--text-muted` | `#D6CBE4` | `#BFD3D9` | `#A9AFCB` |
| Berge fern / nah | `#5A3660` / `#33223F` | `#2C5163` / `#1A3447` | wie bisher |
| Sterne (Deckkraft) | 0,35 | 0 | 1 |

Dazu, für alle Stimmungen gleich: `--gold: #F2C98A` für Goldlinien und Zierelemente (bleibt Gold, auch wenn der Akzent Pfirsich oder Mint ist), Flächen `--surface` und `--surface-border` wie bisher.

*Ergänzung vom 22.10.2026 (Abschluss):* `--sky-horizon` und `--gold` gibt es in `src/app.css` nicht mehr, weil nichts sie malte: Den Schein über dem Horizont malt `--horizon-glow`, die Goldlinien stecken in den Motiven selbst.

### 2.3 Himmel (`Sky.svelte`)

Berge, See und Sterne bleiben; je Stimmung ändern sich Farben und Gestirn:

- **Morgen:** warmer Sonnenschein, der hinter den Bergen aufgeht (weicher radialer Schein über dem Horizont), blasse Sterne, rosé Glanz auf dem See.
- **Tag:** helle, weiche Sonne oben rechts mit großem Schein, keine Sterne, heller Glanz auf dem See.
- **Abend:** Mond und Sterne wie bisher.

Der Wechsel blendet in 1,5 s über (Gestirn und Himmel als übereinanderliegende Ebenen; die Farbvariablen als registrierte Eigenschaften mit Übergang, wo der Browser das kann). Bei „Bewegung reduzieren“ wechselt alles ohne Übergang; das Funkeln der Sterne entfällt wie bisher.

## 3. Gemalte Motive

### 3.1 Stil

Aquarell, **zart**: schlanke Formen, transparente Pastell-Lasuren, feine Pigmentkörnung, weiche Ränder, viel Luft – mit **feinen goldenen Haarlinien** an Teilen der Konturen. Keine Umrisse, kein Text, keine Schatten. Vorlage: Stilprobe 3 (Steine, Kreise, Wellen) und die drei Blütenblätter aus dem Entwurf.

### 3.2 Motivliste (28)

| Gruppe | ID (`public/images/motive/<id>.webp`) | Motiv |
|---|---|---|
| Symbole | `meditieren` | drei balancierte Kiesel über einer flachen Schale *(vorhanden, Probe 3)* |
| | `atmen` | zwei überlappende Kreise *(vorhanden, Probe 3)* |
| | `klaenge` | zwei schlanke Wellen *(vorhanden, Probe 3)* |
| | `timer` | schlanke Sanduhr |
| | `ich` | eine einzelne Lotusblüte |
| Vorschlag des Tages | `vorschlag-morgen` | Sonne, die über sanften Hügeln aufgeht (Pfirsich, Rosé) |
| | `vorschlag-tag` | weiche Sonne mit einer Wolke (Mint, Himmelblau) |
| | `vorschlag-abend` | Mondsichel mit zwei kleinen Sternen (Lavendel, Gold) |
| Themen | `thema-achtsamkeit` | eine schwebende Feder |
| | `thema-stress` | Wasserringe auf stillem Wasser |
| | `thema-fokus` | ein einzelner Berggipfel mit kleiner Sonne |
| Atemübungen | `atem-478` | Mondsichel (Einschlafen) |
| | `atem-box` | vier Blütenblätter im Quadrat |
| | `atem-kohaerent` | zwei gleich große, sich berührende Kreise |
| | `atem-langes-ausatmen` | eine lange, auslaufende Windlinie |
| | `atem-seufzer` | eine kleine Wolke, die sich auflöst |
| | `atem-wechselatmung` | zwei ineinander geschwungene Blätter |
| Klänge | `klang-regen` | fallende Regentropfen |
| | `klang-meer` | eine sich brechende Welle |
| | `klang-wind` | im Wind gebogene Gräser |
| | `klang-braun` | eine warme, weiche Sanddüne |
| | `klang-wald` | drei schlanke Tannen |
| | `klang-kaminfeuer` | eine ruhige Flamme |
| | `klang-bach` | Kiesel in fließendem Wasser |
| | `klang-klangschalen` | eine Klangschale |
| Atem-Blüte | `blatt-ein` / `blatt-halten` / `blatt-aus` | ein Blütenblatt in Lavendel / Pfirsich-Gold / Blaugrün *(vorhanden, Entwurf)* |

### 3.3 Entstehung

1. **Erzeugen** (Controller, ElevenLabs-Connector, Modell `gpt-image-2.5-sunburst`): je Bild drei Motive einer Gruppe nebeneinander auf flacher, dunkler Navy-Fläche `#1B2350`, gemeinsamer Stil-Text wie in 3.1. Die englischen Prompts stehen in `content/motive.json` (je Motiv: `id`, `prompt`, Quelle `flow`/`generation`, Ausschnitt `crop`), damit sich ein Motiv später im selben Stil nachmalen lässt.
2. **Auswählen:** Alle neuen Gruppen werden auf **einer** Auswahlseite (Artifact) gezeigt; der Nutzer wählt je Gruppe eine Variante. Erst danach geht es weiter.
3. **Freistellen:** `scripts/freistellen.py` (Entwicklungswerkzeug, Python 3 mit Pillow und NumPy – nicht Teil der App, nicht in der CI): Ausschnitt → Hintergrund = vom Rand her zusammenhängende Fläche nahe der Grundfarbe, Kanten-Alpha aus dem Farbabstand, Grundfarbe aus den Kantenpixeln herausgerechnet → auf das Motiv beschnitten, quadratisch, Zielgröße → **WebP mit Alpha** (Qualität 82).
4. **Zielgrößen** (3× der Anzeigegröße): Symbole 168 px, Themen 192 px, Vorschlag 288 px, Atem-Kacheln 240 px, Klang-Kacheln 480 px, Blütenblätter 360 px.
5. **Budget:** je Datei ≤ 60 KB (Klang ≤ 90 KB), zusammen ≤ 1,5 MB. Kosten der Erzeugung ≈ 190 Credits (≈ 4 US-Cent) je Variante, für alle neuen Gruppen geschätzt 1–2 €.

### 3.4 In der App

- `src/lib/content/motive.ts`: `motivUrl(id)` über `assetUrl()`; die IDs sind ein Typ, eine fehlende Datei fällt im Test auf.
- Motive sind **Schmuck**: `<img alt="">` (bzw. `aria-hidden`), die Bedeutung trägt immer der Text daneben.
- Precache: `vite.config.ts` nimmt `webp` in `globPatterns` auf – die Motive sind ab dem ersten Laden offline da.

## 4. Bildschirme

Allgemein: Karten mit weicherem Glas (stärkere Unschärfe dahinter, Rundung 28 px), Akzent der Tageszeit für Knöpfe und aktiven Reiter, Gold für Zierlinien. Schriften (Fraunces, Nunito Sans), Reiter-Symbole und alle Texte bleiben. Tippflächen ≥ 48 px.

### 4.1 Heute

Reihenfolge:

1. Begrüßung und Serie (wie bisher).
2. **Vorschlag des Tages** (wie bisher), rechts das Motiv der Tageszeit (`vorschlag-morgen|tag|abend`, 96 px).
3. **Zuletzt genutzt** (wie bisher).
4. **Aktivitäten** – eine Karte mit drei Zeilen, je Zeile Symbol (56 px), Titel und Untertitel, die ganze Zeile ist der Knopf:
   - *Meditieren* – „Geführt oder mit Timer“ → wechselt zum Reiter Meditieren.
   - *Atemübung* – „3 Min kohärent atmen“ → startet wie bisher „3 Min durchatmen“ direkt Kohärentes Atmen für 3 Minuten (merkt es als zuletzt genutzt).
   - *Klänge* – „Zur Ruhe kommen“ → wechselt zum Reiter Klänge.

Die bisherigen Einzelkarten „3 Min durchatmen“ und „Zur Ruhe kommen“ entfallen; ihre Funktion steckt in den Zeilen. (Haupt-Spec §3.1 bekommt dazu eine Notiz.)

### 4.2 Meditieren

- Timer-Karte mit Symbol `timer`.
- Jede Themengruppe zeigt im Kopf ihr Motiv (`thema-…`, 64 px) neben der Überschrift; die Einträge bleiben schlanke Zeilen wie bisher (Offline-Status, Vorabversion, gesperrt offline).

### 4.3 Atmen

- Dauer-Auswahl oben wie bisher.
- Die sechs Übungen als **Kacheln in zwei Spalten**: Titel, Rhythmus, Wirkung, Motiv (80 px). Die ganze Kachel ist der Knopf und startet die Übung mit der gewählten Dauer (zugänglicher Name „{Titel} starten“ wie bisher).
- **Rhythmus** aus den Phasen: Sekunden mit „-“ verbunden, aufeinanderfolgende Phasen gleicher Art mit „+“, Dezimalkomma – also 4-7-8, 4-4-4-4, 5,5-5,5, 4-6, 3+1-6, 4-4-4-4.
- **Wirkung** (neues Feld je Übung): 4-7-8 „Einschlafen“, Box-Atmung „Konzentration“, Kohärentes Atmen „Balance“, Langes Ausatmen „Entspannung“, Physiologischer Seufzer „Schnell beruhigen“, Wechselatmung „Ausgleich“.
- Die bisherige Beschreibung jeder Übung bleibt erreichbar: als Beschreibung der Kachel (`aria-describedby`) und im Player.

### 4.4 Klänge

Die acht Kacheln zeigen ihr Motiv (`klang-…`) als Bild in der Kachel; Titel gut lesbar darüber (Verlauf hinter dem Text). Antippen (Abspielen/Wechseln), Lautstärke, Sleep-Timer und Mini-Player bleiben unverändert.

### 4.5 Ich

Symbol `ich` neben der Überschrift; alle Karten im neuen Kartenstil; Inhalt unverändert.

### 4.6 Player

- Alle Player (Timer, Atem, geführte Meditation) zeigen den Himmel der Tageszeit; Ring und Hauptknopf im Akzent der Tageszeit.
- Der Atem-Player bekommt die Atem-Blüte (Abschnitt 5) statt Kreis, Schein und Phasenring.

## 5. Atem-Blüte

- **Aufbau:** sechs Blütenblätter (`blatt-ein|halten|aus`, je Blatt alle drei Farben übereinander), jedes um 60° gedreht, Spitze im Mittelpunkt; die Blätter überlagern sich leicht durchscheinend (Deckkraft ≈ 0,8, Mischmodus „screen“).
- **Takt:** Wie bisher aus der Audio-Uhr (`programClock`, `breathAt`): Die Größe der Blüte folgt `circleScale(easedLevel(moment))`, das Spreizen der Blätter (Verschiebung nach außen um bis zu 13 % der Blattlänge) folgt ebenfalls dem Atemstand. Nach dem Entsperren stimmt die Blüte sofort wieder.
- **Farbe je Phase:** Einatmen **Lavendel**, Halten **Pfirsich-Gold**, Ausatmen **Blaugrün**. Beim Phasenwechsel blenden die Farbebenen in 0,6 s über. `phaseColor` liefert dazu passend `#B7A8F0` / `#F2C98A` / `#8FD0D6` für den weichen Schein hinter der Blüte.
- **Drehung:** reine Zierde, eine Umdrehung in 120 s (CSS); sie ruht, solange die Übung pausiert.
- **Entfällt:** der Kreis, sein Schein-Ring und der Phasenring (auf Wunsch des Nutzers).
- **Bleibt:** Phasenwort und Sekunden-Countdown darunter, Vibration je Phase, alle Texte.
- **Bewegung reduzieren:** Die Blüte steht in mittlerer Größe still, dreht und spreizt sich nicht; nur die Farbe wechselt mit der Phase.

## 6. Technik & Struktur

| Datei | Aufgabe |
|---|---|
| `src/lib/time/tageszeit.ts` | `tageszeit(date)`, Grenzen 5/11/17; `greetingFor` nutzt es |
| `src/lib/ui/tageszeit.svelte.ts` | setzt `data-tageszeit`, Minuten-Takt, `visibilitychange`; reaktiver Wert für Bildschirme |
| `src/app.css` | Farbwerte je Stimmung, Kartenstil |
| `src/components/Sky.svelte` | Himmel je Stimmung mit Überblendung |
| `src/lib/content/motive.ts`, `content/motive.json` | Motiv-IDs, Adressen, Prompts |
| `public/images/motive/*.webp` | die 28 Motive |
| `scripts/freistellen.py` | Freistellen und WebP (Entwicklungswerkzeug) |
| `src/components/BreathFlower.svelte` | die Atem-Blüte |
| `src/lib/breath/view.ts` | Farben je Phase, Spreizen, Rhythmus-Text |
| `src/lib/breath/patterns.ts` | neues Feld `effect` (Wirkung) |
| Bildschirme `Heute`, `Meditieren`, `Atmen`, `Klaenge`, `Ich`, `SoundTile`, Player | neue Darstellung |

Keine neuen Abhängigkeiten der App. Audio-Zeitsteuerung bleibt unberührt.

## 7. Tests

- **Unit:** `tageszeit` an allen Grenzen (4:59, 5:00, 10:59, 11:00, 16:59, 17:00, Mitternacht) und Gleichlauf mit `greetingFor`; Rhythmus-Text aller sechs Übungen; Farbe je Phase; Spreizen bei Atemstand 0 und 1.
- **Kontrast:** Für jede Stimmung: `--text` und `--text-muted` auf Karte über `--sky-mid` und `--sky-bottom` ≥ 4,5:1; `--on-accent` auf `--accent` ≥ 4,5:1 (berechnet aus den Werten in `app.css`).
- **Motive:** Jede ID aus `motive.ts` hat eine Datei; jede Datei ist WebP mit Alpha, Größe im Budget; zusammen ≤ 1,5 MB; der gebaute Service Worker führt alle Motive im Precache.
- **e2e (Playwright, feste Uhr):** 08:00 / 14:00 / 20:00 → `data-tageszeit` morgen/tag/abend, Begrüßung, Vorschlags-Motiv; Wechsel bei offener App (Uhr von 10:59:30 auf 11:00:30 vorstellen → Stimmung „tag“ ohne Neuladen); Aktivitäten-Zeilen (Navigation bzw. Start der 3-Min-Übung); Atem-Kacheln starten die richtige Übung; Atem-Blüte: beim Einatmen größer, Farbebene je Phase, mit `reducedMotion: 'reduce'` ohne Bewegung; alle bisherigen e2e-Tests bleiben grün (angepasst, wo sich Texte/Struktur ändern).
- **Bildschirmfotos:** alle Reiter und der Atem-Player bei 08:00, 14:00, 20:00, auf Pixel 7 und 360×640 – vom Implementierer angesehen, Überlappungen behoben.

## 8. Abnahme

„Handy-Checkliste Meilenstein 4“ im README, u. a.:

1. App um kurz vor 11 bzw. 17 Uhr offen lassen: Die Stimmung wechselt weich, ohne Neustart.
2. Atemübung 3 Min bei gesperrtem und wieder entsperrtem Bildschirm: Die Blüte ist sofort wieder im Takt mit Ton und Vibration.
3. Draußen bei Tageslicht: alle Texte in allen drei Stimmungen gut lesbar.
4. Flugmodus direkt nach der Installation des Updates: alle Motive sichtbar.
5. Mit „Bewegung reduzieren“ (Android: Einstellungen › Bedienungshilfen): Blüte still, nur Farbwechsel.

Veröffentlicht wird – wie immer – erst nach dem OK des Nutzers.

## 9. Ausblick

- **Meilenstein 5 – Meditationsmusik & -klänge:** ruhige Musik/Klangflächen, auch als Hintergrund der geführten Meditationen. Der vollständige ElevenLabs-Connector (mit Musik) ist inzwischen verbunden.
- **Meilenstein 6 – Stimmungs-Check-in:** „Wie geht es dir?“, sichtbar unter „Ich“; wird in der Gestaltung dieses Meilensteins gebaut (eigenes Symbol, z. B. Wellen in Orange wie im Vorbild).
