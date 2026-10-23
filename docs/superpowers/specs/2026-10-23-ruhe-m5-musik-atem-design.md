# Ruhe – Meilenstein 5: Meditationsmusik & Atemgeräusch

*Stand: 23.10.2026 · ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md`, die M4-Spec `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` und die M4.1-Spec `docs/superpowers/specs/2026-10-23-ruhe-m4-1-karten-design.md`. Wo dieses Dokument etwas anders regelt, gilt dieses Dokument.*

## 1. Ziel & Rahmen

Der Nutzer wünscht sich zwei Dinge:

- **Meditationsmusik**, auch als Hintergrund der geführten Meditationen, weil die Naturklänge dort nicht passen;
- bei den Atemübungen **charmante Ein- und Ausatemgeräusche** statt des Pings.

**Vom Nutzer entschieden (Brainstorming 23.10.2026):**

1. **Stil:** warm, dunkel, sparsam, pentatonisch, ohne Beat und ohne Gesang, wie seine drei Gemini-Stücke. Dazu eine Mischung aus vier Stilen. Alle vier Hörproben gefallen.
2. **Länge:** 5 Minuten je neuem Stück (Option B).
3. Seine **drei Gemini-Stücke** kommen mit in die App.
4. **Atem:** echter menschlicher Atem, Variante 1 („dunkler“), und zwar so dezent wie die letzte Hörprobe (`atem-mensch-1-leiser.mp3`, −40 LUFS). Die Welle entfällt.
5. Die drei Design-Teile wie vorgestellt:
   - Inhalte (Abschnitte 2–3);
   - App (Abschnitt 4), mit dem Hinweis „Nicht offline verfügbar“;
   - Technik (Abschnitt 5).

### Erfolgskriterien

- 7 Musikstücke spielen in „Klänge“ und als Hintergrund von Timer und geführter Meditation.
- Jedes Stück läuft beliebig lange ohne hörbare Naht.
- Die Musik ist im Speicher kein Problem: Sie wird gestreamt, nie ganz dekodiert.
- In jeder Atemübung hört man beim Ein- und Ausatmen ein leises Atemgeräusch, das zur Länge der Phase passt; Halten bleibt still.
- Der Schalter „Atemgeräusch“ unter „Ich“ schaltet es ab.
- Mit „Alle offline speichern“ geht alles ohne Netz. Das Atemgeräusch geht immer ohne Netz.

### Nicht-Ziele

- Keine Musik unter den Atemübungen.
- Kein eigener Lautstärkeregler für das Atemgeräusch.
- Keine Wiedergabeliste und kein Wechsel zwischen Stücken während einer Sitzung, außer über die bestehende Hintergrundauswahl.
- Keine neuen Naturklänge. Klangschale und Timer-Ablauf bleiben, wie sie sind.

## 2. Musik

### 2.1 Stücke

| ID | Titel | Herkunft | Länge | Motiv (Vorschlag) |
|---|---|---|---|---|
| `schwebend` | Schwebende Flächen | neu, Stil 1: Klangflächen mit tiefen Piano-Tönen | 5:00 | drei sanfte, überlappende Nebelschleier |
| `klavier` | Stilles Klavier | neu, Stil 2: Felt-Piano, viel Hall | 5:00 | ein kleiner Flügel von der Seite |
| `obertoene` | Obertöne | neu, Stil 3: Klangschalen über einem Oberton-Grund | 5:00 | eine Klangschale mit aufsteigenden Klangringen |
| `bambusfloete` | Bambusflöte | neu, Stil 4: Bambusflöte und Harfe über einer Fläche | 5:00 | eine Bambusflöte mit einem Blatt |
| `zwischen-zwei-atemzuegen` | Zwischen zwei Atemzügen | Gemini („Between Two Breaths“) | 2:54 | zwei sanft geschwungene Atemlinien |
| `salz-und-sternenlicht` | Salz und Sternenlicht | Gemini („Salt and Starlight“) | 2:31 | ein Salzkristall unter einem kleinen Stern |
| `unter-der-oberflaeche` | Unter der Oberfläche | Gemini („Underneath the Surface“) | 2:39 | eine Wasserfläche, darunter ein sinkender Kiesel |

Hinweise:

- „Obertöne“ heißt nicht „Klangschalen“, weil es diesen Naturklang schon gibt.
- Die Musik-IDs dürfen nicht mit den Klang-IDs übereinstimmen. Ein Test prüft das.

### 2.2 Erzeugung der vier neuen Stücke

- **Wer:** der Controller, über den ElevenLabs-Connector, Flow `okOZzzvC1AkFQC5zHLFu`.
- **Modell:** `eleven_music_v2_5`.
- **Parameter:** `duration_seconds: 300`, `lyrics_type: instrumental`, `instrumental: true`, je **eine** Generierung.
- **Prompts:** dieselben wie die Hörproben (Knoten `MM7qBnL0cD5L42PWZqPS`, `MZfCAA8ZgyTUYCQrptw1`, `TY0nWfJgcTd0KMzzmp8w`, `BWrScLFrOBHzn5XkCc78`). Bei „Obertöne“ kommt ergänzend dazu: „Begins softly from silence.“ Der Grund: Die Probe setzte ohne Einblenden ein.
- **Kosten:** etwa 3,30 $.
- Missfällt dem Nutzer ein Stück, wird es einzeln neu erzeugt, aber nur nach Rücksprache.
- **Herkunft festhalten:** Prompt, Flow und Generierung stehen in `content/sounds.json`, damit sich ein Stück nachbauen lässt.

### 2.3 Aufbereitung

Neues Entwicklungswerkzeug `scripts/musik.py`. Wie `scripts/freistellen.py` ist es nicht Teil der App und nicht in der CI. Es braucht Python 3 und ffmpeg.

- **Lautheit:** Jedes Stück wird auf **−26 LUFS** integriert gebracht, mit True Peak **≤ −2 dBTP**. Das ist die Lautheit der Naturklänge. So gilt der Balance-Regler zwischen Stimme und Hintergrund für Musik genauso.
- **Kanten:** 1,5 s Einblenden und 3 s Ausblenden als Sicherung, falls ein Stück hart beginnt oder endet.
- **Format:** Opus, 96 kbit/s, Stereo, 48 kHz, Datei `public/audio/music/<id>.opus`.
- **Budget:** alle 7 zusammen **≤ 22 MB**. Die Versionsangabe für den Cache steht im Katalog, wie bei den Meditationen (`?v=`).
- **Quellen:**
  - die vier neuen Stücke als MP3 vom Connector;
  - die Gemini-Stücke aus den Uploads des Nutzers. Sie liegen bei −12 LUFS und werden abgesenkt.
- **Credit im README:** „Musik: ElevenLabs Music (4 Stücke) und vom Nutzer mit Gemini erstellt (3 Stücke).“

## 3. Atemgeräusch

### 3.1 Dateien

- **Quelle:** Variante 1 aus Flow `okOZzzvC1AkFQC5zHLFu`:
  - Einatmen: Generierung `PMTn0SaseKGi9cK0XYaW`, Knoten „Atem ein – Mensch“;
  - Ausatmen: Generierung `phrVHCICpt5jeevhud6K`, Knoten „Atem aus – Mensch“.
- **Aufbereitung** (in `scripts/musik.py`, Unterbefehl `atem`):
  - Tiefpass bei 4 kHz;
  - Stille am Anfang und Ende abschneiden (Schwelle −30 dB unter der Spitze);
  - 30 ms Ein- und Ausblenden;
  - jede Datei auf **−26 LUFS**, aktiver Teil;
  - Mono, Ogg Vorbis.
- **Ergebnis:** `public/audio/breath/ein.ogg` (≈ 3,6 s) und `public/audio/breath/aus.ogg` (≈ 6,3 s), zusammen ≤ 150 KB.
- **Precache:** Beide Dateien kommen über `globPatterns` (`ogg`) in den Precache, sind also immer offline da.

### 3.2 Wiedergabe je Phase

Für jede Phase `ein` oder `aus` der Länge `L` (Sekunden), mit `D` als Dauer der Datei:

- **Geschwindigkeit:** `rate = clamp(D / L, 0.75, 1.25)` (`playbackRate`). Das Geräusch klingt dann `min(L, D / rate)` Sekunden.
  - Beispiele: 4 s ein ergibt 0,9. Seufzer-Nachatmen 1 s ergibt 1,25, das ist ein kleines Nachschnaufen. 4-7-8 aus 8 s ergibt 0,79.
- **Hüllkurve:** Sei `E` das Ende des Geräuschs, also `min(L, D / rate)`.
  - Der Gain steigt linear von 0 auf `G` über `min(0.35, 0.3·L)`.
  - Er fällt auf 0 über `min(1.0, 0.4·E)` und ist **spätestens bei `E`** auf 0.
  - Die Quelle endet bei `E`.
- **Pegel:** `G` ist für das Einatmen 0,25 und für das Ausatmen 0,21. Das entspricht −40 LUFS hinter dem Mischpult mit 0,8 Reserve, also der freigegebenen Hörprobe. Das Ausatmen ist etwas leiser.
- **Halten:** still.
- **Wechselatmung:** wie die übrigen Muster, jede Ein- und Ausatemphase bekommt ihr Geräusch.
- **Taktung:** Die Planung läuft auf der Audio-Uhr wie bisher (`ProgramSpec.schedule`), damit Pausen und Fortsetzen stimmen.
- **Fehler:** Fehlen die Dateien, läuft die Übung still weiter. Die Vibration bleibt in jedem Fall.
- **Abschalten:** `settings.breathSound: boolean`, Standard `true`. Bei `false` wird nichts geladen und nichts eingeplant.
- **Ping:** Er entfällt, `cue.ts` wird ersetzt.

## 4. In der App

### 4.1 Reiter „Klänge“

- **Zwei Abschnitte:** zuerst **„Musik“** mit den 7 Stücken in der Reihenfolge der Tabelle 2.1, darunter **„Natur“** mit den 8 Klängen. Der Sleep-Timer bleibt darunter.
- **Überschriften:** Die beiden Abschnittsüberschriften folgen der Überschriftenregel aus M4.1 (kurze Goldlinie).
- **Musikkacheln:** gleiche Kachel wie die Naturklänge, mit eigenem gemaltem Motiv `musik-<id>`.
  - Bedienung: Antippen startet bzw. wechselt, nochmal tippen stoppt. Lautstärke und Sleep-Timer gelten wie bisher.
  - Ein Stück startet immer am Anfang, nicht an einer zufälligen Stelle.
- **Offline-Zeichen:** Ein offline gespeichertes Stück trägt das Offline-Zeichen aus M4.1 (`OfflineMark`).
- **Ohne Netz:** Ein nicht gespeichertes Stück ist gedämpft und deaktiviert, daneben steht „Nicht offline verfügbar“, wie bei den Meditationen.

### 4.2 Motive

- 7 neue Motive `musik-<id>`, erzeugt wie in M4-Spec §3.3: Modell `gpt-image-2.5-sunburst`, je Bild drei Motive auf `#1B2350`, gemeinsamer Stil-Text aus `content/motive.json`.
- Freigestellt werden sie mit `scripts/freistellen.py`. Die Prompts kommen nach `content/motive.json`.
- **Auswahl:** Der Nutzer wählt die Motive vor dem Einbau aus. Kosten etwa 1 $.
- **Budget:** Alle Motive zusammen bleiben ≤ 1,5 MB.

### 4.3 Hintergrundauswahl

- `SoundSelect` (Timer, geführter Player, Reiter „Ich“) wird gegliedert: „Keiner“, dann `<optgroup label="Musik">` mit den 7 Stücken, dann `<optgroup label="Natur">` mit den 8 Klängen.
- **Ohne Netz:** Nicht gespeicherte Musikstücke sind deaktiviert, mit dem Zusatz „ – nicht offline verfügbar“.
- **Ist ein gewählter Hintergrund offline nicht da**, startet die Sitzung ohne Hintergrund. Das ist dasselbe Verhalten wie bei einem Ladefehler.
- Bisherige Einstellungen bleiben erhalten.
- Unter den Atemübungen gibt es weiterhin keinen Hintergrund.

### 4.4 Reiter „Ich“

- **Neuer Schalter** „Atemgeräusch bei Atemübungen“ direkt unter „Vibration bei Atemübungen“.
- **„Alle offline speichern“** speichert Meditationen **und** Musik und zeigt die Gesamtgröße an, etwa 50 MB. Fortschritt, Speicher-voll-Hinweis und Fehler verhalten sich wie bisher.

### 4.5 Sonst

- Media Session (Sperrbildschirm, Benachrichtigung) und Mini-Player zeigen den Titel des Stücks.
- Statistik und „Zuletzt genutzt“ speichern den Hintergrund eines Timers, also auch ein Musikstück.

## 5. Technik

### 5.1 Katalog & Typen

- `content/sounds.json` bekommt die Liste `music`, je Eintrag:
  - `id`, `title`, `file`, `version`, `seconds`;
  - `source`: Prompt + Flow + Generierung bzw. „Gemini (Nutzer)“.
- **Typen:**
  - `MusicId` für die 7 IDs;
  - `BackgroundId = SoundId | MusicId`;
  - `backgroundById(id)` liefert `{ kind: 'nature' | 'music', … }`.
- `settings.timerSound`, `settings.guidedSound` und das `sound` einer Timer-Sitzung sind `BackgroundId | null`. Die Prüfung beim Laden kennt beide Listen. Unbekanntes wird zu `null` bzw. zum Standard, wie bisher.
- **Engine:** Schnappschuss (`volumes`, `loading`, `errors`), `toggle`, `setVolume` und `setBackground` arbeiten mit `BackgroundId`.

### 5.2 Musik in der Engine

- **Neue Stimme `createMusicVoice(ctx, url)`** mit zwei `<audio>`-Elementen. Sie werden wie die Sprechstimme gebaut: `crossOrigin = 'anonymous'`, `MediaElementSource`, und jedes hat einen eigenen Gain in den gemeinsamen Ausgang der Stimme.
- **Schleife:**
  - Element A spielt ab 0.
  - Erreicht es `duration − 8 s` (beobachtet über `timeupdate`), startet B bei 0.
  - A fällt über 8 s linear auf 0, B steigt auf 1, beides auf der Audio-Uhr.
  - Danach pausiert A und springt auf 0. Die Rollen tauschen.
- **Laden:** Die Kachel gilt als ladend, bis A `canplay` meldet. Ein `error` vorher wird zum bekannten Ladefehler („Konnte nicht geladen werden“).
- **Pause, Weiter, Sleep-Ende, Stopp:** Die Engine hält mit dem Output auch die Musik-Elemente an und setzt sie fort. Gemeint sind die gerade klingenden Elemente; eine laufende Überblendung setzt dort fort.
  - Eigene `pause`-Ereignisse der Elemente sind keine Unterbrechung. Unterbrechungen erkennt die Engine wie bisher am Anker.
  - `stop(when)` pausiert beide Elemente zum Zeitpunkt `when` (Marke auf der Audio-Uhr) und gibt sie frei (`src` entfernen).
- **Ablösen:** Naturklänge bleiben dekodierte Schleifen (`createLoopVoice`). Ablösen und Überblenden zwischen Klang und Musik laufen über die bestehenden Kanäle der Engine.
- **Sitzungen:** Musik als Hintergrund von Timer und geführter Meditation läuft über denselben Weg (`playSound`). Fehlt sie, läuft die Sitzung ohne Hintergrund weiter.

### 5.3 Atemgeräusch in der Engine

- **Neues Modul `src/lib/audio/breath-sound.ts`:**
  - `scheduleBreath(ctx, destination, when, kind, length, buffers, gains)` setzt Abschnitt 3.2 um.
  - Es liefert die Quelle oder `null` für `halten`.
- **Anbindung:** `breathProgram(id, minutes, { sound })` übergibt Länge und Art jeder Phase aus `breathPlan`. Die Länge einer Phase ist der Abstand zum nächsten Cue bzw. zum Ende.
- **Laden:** Die Dateien lädt `startProgram` neben der Klangschale über `loadBuffer`. Sie werden nur einmal geladen und dann wiederverwendet.

### 5.4 Offline

- Der Offline-Speicher (`src/lib/offline/meditations.ts`) wird allgemeiner. Er speichert vollständige Audiodateien in einen genannten Cache:
  - Meditationen weiter in `ruhe-meditations`;
  - Musik in `ruhe-musik`.
- Die bestehenden Absicherungen gelten für beide: unvollständige Einträge, Content-Encoding, `audio/*`, Speicher voll.
- **Workbox:** Neue Route `/audio/music/<id>.opus(?…)` mit Cache `ruhe-musik` und Range-Unterstützung, wie bei den Meditationen.
- **Precache:** `.opus` ist **nicht** in `globPatterns`.
- **Typ beim Ausliefern:** GitHub Pages liefert `.opus` laut mime-db als `audio/ogg`, also als `audio/*`. Aus dem Container ist github.io nicht erreichbar; ob das Speichern klappt, prüft deshalb die Handy-Checkliste (Punkt 4).
- **Status:** `offline.saved` und `refreshSaved` gelten auch für Musik-Adressen.

## 6. Dateien

| Datei | Inhalt |
|---|---|
| `content/sounds.json`, `src/lib/sounds/catalog.ts` | Liste `music`, `MusicId`, `BackgroundId`, `backgroundById` |
| `src/lib/audio/music.ts` | `createMusicVoice` (zwei Elemente, Überblenden) |
| `src/lib/audio/breath-sound.ts` | `scheduleBreath` (ersetzt `cue.ts`) |
| `src/lib/audio/engine.ts`, `program.ts` | Musik-Stimmen, Pause/Weiter der Elemente, Atemgeräusch statt Ping |
| `src/lib/offline/*` | Offline-Speicher für beide Caches |
| `src/lib/stats/schema.ts` | `breathSound`, `BackgroundId` in Einstellungen und Sitzungen |
| `src/screens/Klaenge.svelte`, `src/components/SoundTile.svelte` | Abschnitte, Musikkacheln, Offline-Zustand |
| `src/components/SoundSelect.svelte` | Gruppen, deaktivierte Optionen ohne Netz |
| `src/screens/Ich.svelte` | Schalter, „Alle offline speichern“ mit Musik |
| `src/lib/content/motive.ts`, `content/motive.json`, `public/images/motive/musik-*.webp` | 7 Motive |
| `public/audio/music/*.opus`, `public/audio/breath/{ein,aus}.ogg` | Audio |
| `scripts/musik.py` | Aufbereitung (Entwicklungswerkzeug) |
| `vite.config.ts` | Workbox-Route Musik |
| `README.md` | Credits, Handy-Checkliste M5 |

## 7. Tests

**Unit (Vitest):**

- **`scheduleBreath`:**
  - die Geschwindigkeitsgrenzen 0,75/1,25;
  - die drei Beispiele aus 3.2;
  - der Gain ist spätestens bei `E` gleich 0 und erreicht `G`;
  - `halten` ergibt `null`.
- **Atemprogramm:**
  - mit `sound: false` keine Quellen;
  - mit fehlenden Dateien läuft das Programm ohne Geräusch;
  - jede Phase bekommt die richtige Länge, auch beim Seufzer-Nachatmen (1 s).
- **`createMusicVoice`** mit nachgebauten Elementen:
  - bei `duration − 8 s` startet das zweite Element;
  - die Gain-Rampen dauern 8 s;
  - die Rollen tauschen;
  - `stop` gibt beide frei;
  - Pause und Weiter halten nur die klingenden Elemente an.
- **Engine:**
  - Musik als Klang und als Hintergrund (Timer, geführt);
  - Wechsel Musik ↔ Natur;
  - ein Ladefehler markiert das Stück, die Sitzung läuft weiter;
  - der Sleep-Timer beendet die Musik.
- **Katalog und Schema:**
  - keine ID doppelt zwischen Natur und Musik;
  - jede Datei existiert, das Budget gilt;
  - Einstellungen mit Musik-ID bleiben erhalten, unbekannte IDs fallen zurück;
  - `breathSound` hat den Standard `true`.
- **Offline:** Speichern in `ruhe-musik` mit denselben Absicherungen wie bei den Meditationen.

**e2e (Playwright):**

- „Klänge“ zeigt „Musik“ (7) vor „Natur“ (8); Antippen einer Musikkachel startet sie.
- Die Hintergrundauswahl ist gegliedert.
- Ohne Netz sind nicht gespeicherte Stücke deaktiviert und tragen „Nicht offline verfügbar“.
- Der Schalter „Atemgeräusch“ unter „Ich“ wird gespeichert.
- Alle bisherigen e2e-Tests bleiben grün.

## 8. Handy-Checkliste (für das README)

1. „Klänge“: Jedes Musikstück startet weich. „Stilles Klavier“ 6 Minuten laufen lassen: An der Naht nach 5 Minuten ist kein Bruch zu hören.
2. Geführte Meditation mit „Schwebende Flächen“ als Hintergrund: Der Balance-Regler wirkt, Pause und Weiter halten auch die Musik an.
3. Atemübungen 4-7-8, Box und Seufzer: Das Atemgeräusch ist dezent und passt zu jeder Phase, Halten ist still. Mit „Atemgeräusch“ aus ist alles still, die Vibration bleibt.
4. „Alle offline speichern“, dann Flugmodus: Musik und Meditationen spielen, die Schleife nach 5 Minuten klappt.
5. Flugmodus ohne gespeicherte Musik: Die Stücke sind deaktiviert. Ein Timer mit Musik-Hintergrund startet ohne Hintergrund.
6. Sperrbildschirm: Titel des Stücks; Pause und Weiter funktionieren.

## 9. Kosten

| Posten | Kosten |
|---|---|
| Hörproben Musik | 0,65 $ (erledigt) |
| Hörproben Atem | 0,03 $ (erledigt) |
| 4 Musikstücke zu 5 Minuten | etwa 3,30 $ |
| 7 Motive | etwa 1 $ |
