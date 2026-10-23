# Ruhe – Meilenstein 4.1: Edle Karten mit Aquarell-Hauch

*Stand: 23.10.2026 · ergänzt die M4-Spec `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` (im Folgenden „M4-Spec“) und die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md`. Wo dieses Dokument etwas anders regelt, gilt dieses Dokument.*

Entwürfe (privat): https://claude.ai/artifact/Xj1LBKUjN413NKGUwwruPH – Blätter „Karten mit Aquarell-Hauch: A, B, C“ und „Gewählt: A mit Goldlinien aus C“.

## 1. Ziel & Rahmen

Nach dem ersten Blick auf das Handy wünscht sich der Nutzer eine noch hochwertigere Aufmachung:

- die Karten anders präsentiert, mit einem kleinen Aquarell-Touch;
- Länge und „offline“ weniger auffällig.

**Vom Nutzer entschieden (Brainstorming 23.10.2026):**

1. Richtung **A „Aquarell-Hauch“** mit den **Goldlinien aus C**.
2. Die Gestaltungsregeln (Abschnitt 2) und der Umfang je Bildschirm (Abschnitt 4) wie vorgestellt.
3. Drei neue, größere Waschungen. Der Controller wählt die Varianten selbst aus.

### Erfolgskriterien

- Die App wirkt auf allen Reitern einheitlich edler:
  - feine Goldränder und Goldlinien;
  - Titel in der Serifenschrift;
  - zarte gemalte Waschungen in den Karten.
- Länge und „offline gespeichert“ treten leise zurück. Was den Start verhindert („Nicht offline verfügbar“), bleibt deutlich.
- Schrift liegt nie über einer Waschung (außer auf einer deckenden Fläche wie einem Knopf); alle Texte erfüllen WCAG AA in allen drei Stimmungen.
- Die Waschungen sind ab dem ersten Laden offline da.

### Nicht-Ziele

- Keine neuen Funktionen, keine geänderten Abläufe, keine neuen Texte außer den hier genannten.
- Die Vollbild-Player bleiben, wie sie sind (Atem-Blüte, Timer, geführte Meditation).
- Mini-Player, Wiedergabeleiste der Klänge, Reiterleiste und Hinweis-Toast bleiben, wie sie sind.

## 2. Gestaltungsregeln

1. **Goldlinie:**
   - Neues Token `--gold-line: rgb(233 196 142 / 0.26)`, das in allen Stimmungen gleich ist.
   - Dazu `--gold-line-strong: rgb(233 196 142 / 0.7)` für die kurzen Linien unter Überschriften.
   - Die M4-Regel „Akzent der Tageszeit für Knöpfe und aktiven Reiter“ bleibt. Gold ist hier wieder **Zierlinie** (M4-Spec §4), kein Bedienelement.
2. **Karten** (`.card` und alle kartenartigen Flächen aus Abschnitt 4):
   - Der Rand ist `1px solid var(--gold-line)` statt `--surface-border`.
   - Glas, Rundung und Unschärfe bleiben.
   - Einträge innerhalb einer Liste (Meditationen) haben den Rand `rgb(233 196 142 / 0.22)`.
3. **Überschriften:**
   - Unter der großen Abschnittsüberschrift (z. B. „Geführte Meditationen“) steht eine kurze Linie: 40 px breit, 1 px hoch, `--gold-line-strong`, 8 px Abstand.
   - Neben jeder Themenüberschrift läuft eine Linie bis zum Rand aus: Verlauf von `rgb(233 196 142 / 0.5)` nach transparent.
4. **Trennlinien:**
   - Zeilen innerhalb einer Karte werden durch `1px solid rgb(233 196 142 / 0.28)` getrennt, jeweils über jeder Zeile.
   - Das gilt für Heute › Aktivitäten und Ich › Einstellungen.
5. **Schrift:**
   - Die Titel von Meditationen, Aktivitäten, Atem-Kacheln und Karten stehen in der Display-Schrift (`--font-display`, Fraunces), Gewicht 400, etwa 1.1875rem.
   - Fließtext und Angaben bleiben in Nunito Sans.
   - Kleine Überschriften in Versalien (z. B. „VORSCHLAG DES TAGES“) haben 0.72rem, 700 und Laufweite 0.14em.
6. **Knöpfe:**
   - Je Bildschirm bleibt höchstens **ein** voller Akzent-Knopf: Heute › „Jetzt starten“ des Vorschlags.
   - Andere Aktionsknöpfe in Karten werden Umriss-Knöpfe (neue Klasse `.button-line`): 1px Rand in Akzent 55 %, Fläche Akzent 8 % über `--sky-mid` (deckend wie in der M4-Fehlerwelle), Schrift im Akzent.
   - Betroffen sind Meditieren › „Einstellen“ (bisher „Timer einstellen“) und Heute › „Zuletzt genutzt“.
   - **Play-Kreis:** 40 px, deckende Fläche wie bisher (`color-mix(in srgb, var(--accent) 14%, var(--sky-mid))`), dazu ein 1px Ring in Akzent 50 %, das Dreieck im Akzent.
7. **Pfeil:** Zeilen, die zu einem anderen Reiter führen (Heute › Aktivitäten), zeigen rechts einen feinen Chevron (18 px, Strich 1.5, Farbe `--gold-line-strong`), `aria-hidden`.
8. **Länge und offline:**
   - Die Länge („5 Min“) steht klein (0.78rem) und gedämpft (`--text-muted`) unter dem Titel.
   - „Offline gespeichert“ ist ein Häkchen im Kreis: 13 px, Strich in `--text-muted`, `role="img"`, `aria-label="offline gespeichert"`. Es ersetzt den Text „✓ offline“.
   - Ein nicht startbarer Eintrag (offline, Datei fehlt) zeigt weiter den Text „Nicht offline verfügbar“: 0.8125rem, 600, `--text-muted`. Titel und Play-Kreis treten auf 55 % zurück.
   - Der Chip „Vorabversion“ bleibt.

## 3. Waschungen

1. **Drei Farben:** `lavendel`, `pfirsich`, `blaugruen`.
   - Je eine abstrakte Aquarell-Waschung, weich auslaufend, mit feiner Goldlinie, im Stil der Probe vom 23.10.2026.
   - Modell und Kosten wie bei den Motiven: `gpt-image-2.5-sunburst`, etwa 190 Credits je Variante.
   - Erzeugt wird **auf reinem Schwarz**, je Farbe ein Bild mit einer einzelnen, breiten Waschung.
2. **Freistellen:**
   - `scripts/freistellen.py` bekommt den Modus `--schwarz`.
   - Die Deckkraft ergibt sich aus dem hellsten Kanal, die Farbe wird davon befreit (unvormultipliziert).
   - Dann wird auf die Waschung beschnitten, **ohne** quadratisch aufzufüllen, auf die Zielbreite **900 px** verkleinert und als WebP mit Alpha (Qualität 76) gespeichert.
   - Zur Einschätzung gibt das Skript die hellste Farbe der Waschung aus: das 99. Perzentil der vormultiplizierten Helligkeit.
3. **Ablage:**
   - Die Bilder liegen als `public/images/waschungen/<farbe>.webp`.
   - Daten in `content/waschungen.json`: Modell, Prompt-Schema, Befehl zum Freistellen; je Farbe `id`, `colours`, `flow`, `generation`, Größe.
   - Budget: je Datei ≤ 120 KB, zusammen ≤ 300 KB.
   - Precache über die bestehende `webp`-Regel.
4. **Zuordnung** (`src/lib/content/waschungen.ts`):
   - `type WaschFarbe = 'lavendel' | 'pfirsich' | 'blaugruen'`.
   - Themen: Achtsamkeit → lavendel, Stress & Ruhe → blaugruen, Fokus & Energie → pfirsich.
   - Tageszeit: morgen → pfirsich, tag → blaugruen, abend → lavendel.
   - Atemübungen:
     - 4-7-8 lavendel, Box pfirsich, Kohärent blaugruen;
     - Langes Ausatmen lavendel, Seufzer blaugruen, Wechselatmung pfirsich.
   - Zuletzt genutzt: geführt → Farbe des Themas, Atemübung → Farbe der Übung, Timer → Farbe der Tageszeit.
5. **Komponente** `Waschung.svelte`, Props `{ farbe: WaschFarbe; lage?: 0 | 1 | 2 }`:
   - **Zone:** Die Waschung füllt eine Zone in der **rechten oberen Ecke** der Karte, nie mehr.
     - Größe aus `--wash-w` und `--wash-h`, die die Karte setzt; Standard 40 % × 100 %.
     - Darin ein `<img alt="" decoding="async">`.
     - Die Zone schneidet zu (`overflow: hidden`). Eine Maske lässt die Waschung zum linken und unteren Rand der Zone weich auslaufen: Am Zonenrand ist sie unsichtbar, also ohne harte Kante.
     - Klicks gehen durch (`pointer-events: none`), `aria-hidden`.
   - **Keine Schrift in der Zone:** Jede Karte richtet ihr Layout so ein, dass keine Schrift in der Zone liegt. Ausnahme: Schrift auf einer deckenden Fläche, etwa ein Linienknopf.
   - Drei Lagen des Bildes innerhalb der Zone, damit Listen lebendig wirken:
     - 0: wie gemalt;
     - 1: gespiegelt, um 6° gedreht;
     - 2: um −12° gedreht.
   - In Listen bestimmt der Index modulo 3 die Lage.
   - Deckkraft `var(--wash-opacity)`, Standard 0.35 (Token in `app.css`, zwischen 0.2 und 0.45).
   - Fehlt die Datei, bleibt die Karte unverändert; die Waschung ist reiner Schmuck.
   - *Umsetzungsnotiz 23.10.2026:* Ursprünglich sollte die Waschung bis unter die Schrift reichen, und der Kontrast sollte über ihrer hellsten Stelle geprüft werden. Nachgerechnet hält der gedämpfte Text die 4,5:1 schon bei 7 % Deckkraft nicht mehr; „blasser machen“ hätte die Waschung unsichtbar gemacht. Deshalb gilt der Grundsatz „Lesbarkeit vor Schönheit“ jetzt über die Trennung: Schrift und Waschung teilen sich keine Fläche.

## 4. Bildschirme

- **Heute:**
  - **Vorschlag des Tages:**
    - Waschung in der Tageszeit-Farbe.
    - Die bisherige Überschrift „Vorschlag des Tages“ wird zur kleinen Versalien-Überschrift; sie bleibt die `h2` der Karte.
    - Darunter Titel und Motiv, dann die Beschreibung.
    - Dann eine Zeile mit „Jetzt starten“ (voller Knopf) und daneben, klein, der Länge und gegebenenfalls dem Häkchen.
  - **Zuletzt genutzt:** Waschung nach §3.4, Knopf als `.button-line`.
  - **Aktivitäten:** Titel in Fraunces, Goldlinien zwischen den Zeilen, Chevron rechts.
- **Meditieren:**
  - Timer-Karte: Motiv links, Titel und Zusammenfassung, rechts der Umriss-Knopf „Einstellen“ mit dem zugänglichen Namen „Timer einstellen“. Auf Handys bis rund 412 px, ebenso bei großer Systemschrift (Karte schmaler als 22,5rem), steht der Knopf unter dem Text, damit „Meditations-Timer“ auf einer Zeile bleibt (Ruling R5); auf breiten Bildschirmen steht er rechts daneben. Waschung in der Tageszeit-Farbe.
  - „Geführte Meditationen“ mit kurzer Goldlinie, Themen mit auslaufender Goldlinie.
  - Jede Meditation als eigene Karte mit Waschung in der Farbe des Themas (Lage = Index modulo 3), Titel in Fraunces, Länge und Häkchen leise, Play-Kreis mit Ring.
- **Atmen:**
  - Die Kacheln bekommen Goldrand und Waschung in der Farbe der Übung (Lage = Index modulo 3), Titel in Fraunces wie bisher.
  - Die Dauer-Chips bleiben.
- **Klänge:** Die Kacheln bekommen nur den Goldrand, keine Waschung. Der Rand der aktiven Kachel bleibt im Akzent.
- **Ich:**
  - Kennzahlen-Kacheln und alle Karten mit Goldrand.
  - Die Kalender-Karte, die oberste Karte, bekommt die Waschung in der Tageszeit-Farbe; die übrigen Karten keine.
  - Goldlinien über jeder Einstellungszeile, auch über der ersten, wie bei den Aktivitäten (Ruling R4).
- **Einstell-Blatt (Timer) und Abschluss-Dialog:** nur der Goldrand. Der Abschluss-Dialog ist die Rückfrage „… beenden?“ (`ConfirmDialog.svelte`); `SessionDone.svelte` hat keinen Rahmen und bleibt unverändert.

## 5. Technik & Struktur

- **Neu:**
  - `src/components/Waschung.svelte`
  - `src/components/OfflineMark.svelte` (Häkchen im Kreis, „offline gespeichert“)
  - `src/lib/content/waschungen.ts` mit `WASCH_FARBEN`, `waschUrl(farbe)`, `themaWaschung`, `tageszeitWaschung`, `atemWaschung`, `zuletztWaschung` und `waschLage(index)`.
  - `content/waschungen.json`
  - `public/images/waschungen/*.webp`
- **Geändert:**
  - `app.css`: Tokens, `.card`-Rand, `.button-line`, Linien-Hilfsklassen `.rule` (kurz) und `.rule-fade` (auslaufend).
  - `Heute.svelte`, `Meditieren.svelte`, `Atmen.svelte`, `SoundTile.svelte`, `Ich.svelte`, `Calendar.svelte`, `Sheet.svelte`, `ConfirmDialog.svelte`.
  - `scripts/freistellen.py` (Modus `--schwarz`), README „Motive malen“ (Abschnitt Waschungen).
- **Grenzen:**
  - Keine Änderung an Engine, Speicher, Statistik oder Inhalten.
  - Zugängliche Namen bleiben, wo Tests und Screenreader sie kennen. Einzige Ausnahme: „✓ offline“ wird zum Symbol mit Namen „offline gespeichert“.

## 6. Tests

- **Unit:**
  - **Zuordnung:** alle Themen, Tageszeiten und Übungen haben eine Farbe; `zuletztWaschung` für alle drei Arten.
  - **Dateien:** jede Farbe hat eine Datei, und jede Datei ist WebP mit Alpha und im Budget.
  - **Daten:** `content/waschungen.json` passt zu den Dateien.
- **Kontrast:**
  - Die bestehenden Kontrasttests (Schrift auf der Karte über Himmel, Bergen und See) gelten weiter.
  - `--wash-opacity` liegt in jeder Stimmung zwischen 0.2 und 0.45.
- **Schrift außerhalb der Zone** (e2e), für jede Karte mit Waschung:
  - Kein Textstück (Rechtecke aller Textknoten, ohne unsichtbar versteckte) überschneidet die Zone.
  - Ausnahme: Text, dessen Element oder dessen Vorfahr innerhalb der Karte eine deckende Hintergrundfarbe hat.
  - Geprüft bei 412 px und bei 360 px mit 130 % Schrift.
- **e2e:**
  - **Meditieren:**
    - Gespeicherte Einträge haben ein Bild „offline gespeichert“, kein „✓ offline“ mehr.
    - Nicht startbare Einträge zeigen „Nicht offline verfügbar“.
    - Die Länge steht weiter im Eintrag.
    - Die bestehenden guided/ich-Tests werden angepasst.
  - **Waschungen:** In den betroffenen Karten liegt eine `img[alt=""]` mit `/images/waschungen/<farbe>.webp`, in der richtigen Farbe je Thema bzw. Tageszeit.
  - **Klänge:** Die Kacheln haben keine Waschung.
  - **Fehlende Datei:** Bei 404 für `**/images/waschungen/**` bleiben die Karten gleich groß und bedienbar.
  - **Goldlinien:** Karte und Eintrag haben den Goldrand (berechnete `border-color`). Unter „Geführte Meditationen“ steht die kurze Linie.
  - **Breite:** 360 px und 130 % Schrift, ohne Überlauf auf Heute, Meditieren, Atmen und Ich.
  - **Offline:** Der gebaute Service Worker führt die drei Waschungen im Precache.
- **Bildschirmfotos:**
  - Heute, Meditieren, Atmen, Klänge und Ich um 08, 14 und 20 Uhr, auf Pixel 7 und bei 360×640.
  - Angesehen und mit dem Entwurf verglichen.

## 7. Abnahme

„Handy-Checkliste Meilenstein 4.1“ im README:

1. Meditieren: Wirken Goldränder, Waschungen und Titel edel und ruhig, nicht unruhig?
2. Länge und „offline gespeichert“ sind leise, aber auffindbar.
3. „Nicht offline verfügbar“ fällt auf (Flugmodus, nicht gespeicherte Meditation).
4. Draußen bei Tageslicht: alle Texte in allen drei Stimmungen gut lesbar; die Waschungen sitzen in den Ecken, nie hinter Schrift.
5. Scrollen bleibt flüssig.

Veröffentlicht wird – wie immer – erst nach dem OK des Nutzers.
