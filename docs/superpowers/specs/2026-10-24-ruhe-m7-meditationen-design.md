# Ruhe – Meilenstein 7: Neue geführte Meditationen

*Stand: 24.10.2026 · ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md` (§3 Inhalte, §5 Vertonung) und die Specs zu M4–M6. Wo dieses Dokument etwas anders regelt, gilt dieses Dokument.*

## 1. Ziel & Rahmen

Der Nutzer wünscht sich nach Meilenstein 6 zwei Dinge: weitere geführte Meditationen und eigene Atemmuster. Beides wird getrennt umgesetzt; dieser Meilenstein behandelt die Meditationen. Die eigenen Atemmuster folgen als Meilenstein 8 mit eigener Spec.

**Vom Nutzer entschieden (Brainstorming 24.10.2026):**

1. **Reihenfolge:** erst die Meditationen, dann die Atemmuster.
2. **Wunsch:** neue Themen *und* mehr Auswahl in den bisherigen Themen.
3. **Drei neue Themen:**
   - „Mitgefühl & Freundlichkeit“
   - „Gefühle & Loslassen“
   - „Achtsam im Alltag“
4. **Menge:** 9 neue Meditationen, je 2 in den neuen und je 1 in den bisherigen Themen. Aus 9 werden 18 Meditationen in 6 Themen.
5. **Auswahl** (§2) und **Einbindung in die App** (§4–§6) wurden wie vorgestellt freigegeben.

### Erfolgskriterien

- Unter „Meditieren“ stehen 18 Meditationen in 6 Themen, jede vollständig vertont mit derselben Stimme wie bisher.
- Jedes Thema hat ein eigenes gemaltes Motiv und eine Farbfläche; zwei benachbarte Themen haben nie dieselbe Farbe.
- Der Vorschlag des Tages wechselt je Tageszeit innerhalb von zwei Themen.
- „Alle offline speichern“, „Zuletzt genutzt“, der Ruhe-Check-in und die Statistik funktionieren mit den neuen Meditationen wie mit den bisherigen.

### Nicht-Ziele

- Keine Schlaf-Meditationen (Nicht-Ziel der Haupt-Spec, gilt weiter).
- Keine neue Stimme, kein neues Modell, keine geänderten Stimmeinstellungen. Die Hashes der bisherigen Abschnitte bleiben gültig, die 9 bisherigen Meditationen werden nicht neu vertont.
- Keine Filter, keine Suche und keine Favoriten in der Liste.
- Keine Änderung an Player, Offline-Speicher oder Hintergrundklang.

## 2. Die neun neuen Meditationen

| id | Titel | Thema | Länge |
|---|---|---|---|
| `freundlich-mit-dir` | Freundlich mit dir | Mitgefühl & Freundlichkeit | 8 Min |
| `liebevolle-guete` | Liebevolle Güte | Mitgefühl & Freundlichkeit | 10 Min |
| `ein-schweres-gefuehl-begleiten` | Ein schweres Gefühl begleiten | Gefühle & Loslassen | 10 Min |
| `wenn-die-gedanken-kreisen` | Wenn die Gedanken kreisen | Gefühle & Loslassen | 7 Min |
| `gehmeditation` | Gehmeditation | Achtsam im Alltag | 10 Min |
| `achtsam-essen` | Achtsam essen | Achtsam im Alltag | 5 Min |
| `klaenge-hoeren` | Klänge hören | Einsteiger & Achtsamkeit | 7 Min |
| `die-schultern-sinken-lassen` | Die Schultern sinken lassen | Stress & Ruhe | 8 Min |
| `atemzuege-zaehlen` | Atemzüge zählen | Fokus & Energie | 6 Min |

**Inhalt je Meditation** (die Beschreibung in der Liste entsteht beim Schreiben, ein Satz wie bisher):

1. **Freundlich mit dir:** Selbstmitgefühl. Bemerken, dass es gerade schwer ist; eine Hand aufs Herz; freundliche Sätze zu sich selbst wie zu einem guten Freund.
2. **Liebevolle Güte:** Metta. Gute Wünsche („Mögest du …“) für sich selbst, einen vertrauten Menschen, einen neutralen Menschen und schließlich alle Wesen.
3. **Ein schweres Gefühl begleiten:** Ein Gefühl erkennen, zulassen, freundlich im Körper erforschen und begleiten, bis es sich von selbst verändert. Mit dem Hinweis, dass man jederzeit zum Atem zurückkehren darf.
4. **Wenn die Gedanken kreisen:** aus dem Grübeln aussteigen. Gedanken benennen („Planen“, „Sorgen“), beiseitelegen und zurück in Füße, Hände und Atem.
5. **Gehmeditation:** langsam gehen, drinnen oder draußen, mit offenen Augen. Die Füße spüren (Heben, Bewegen, Aufsetzen), dann die Umgebung, dann wieder die Schritte. Eingangs ein Hinweis, einen sicheren Ort zu wählen.
6. **Achtsam essen:** Eingangs die Bitte, etwas Kleines zu essen bereitzulegen, etwa eine Rosine oder ein Stück Obst. Dann ansehen, riechen, langsam kauen und schmecken, wie zum ersten Mal.
7. **Klänge hören:** Geräusche nah und fern kommen und gehen lassen, ohne sie zu benennen oder zu bewerten. Auch die Stille zwischen den Geräuschen hören.
8. **Die Schultern sinken lassen:** eine kurze progressive Muskelentspannung, also anspannen und loslassen von Händen, Armen, Schultern, Gesicht und Bauch bis zu den Beinen. Am Ende Schwere und Wärme spüren.
9. **Atemzüge zählen:** Ausatmungen von eins bis zehn zählen und dann von vorn. Verliert man den Faden, beginnt man freundlich wieder bei eins. Am Ende das Zählen loslassen und einfach atmen.

## 3. Texte

- **Format:** wie bisher, in `content/meditations/<id>.md` mit Frontmatter (`id`, `title`, `category`, `minutes`, `description`) und Pausenmarken `[Pause Ns]`.
- **Stil:** wie bisher. Ruhig, warm, in Du-Form, einfache Sätze, keine Fachbegriffe ohne Erklärung, kein Versprechen von Heilung.
- **Stille:** Jede Meditation hat mindestens 40 % Stille. `npm run meditations estimate` prüft das und endet sonst mit Fehler. Die geschätzte Länge liegt höchstens eine Minute neben der Ziel-Länge.
- **Freigabe:** Der Nutzer liest die 9 Texte, gesammelt in einer Datei. Vertont wird erst nach seiner Freigabe; Änderungswünsche werden vorher eingearbeitet.

## 4. Themen in der App

| Kategorie (`Category`) | Titel | Farbfläche | Motiv |
|---|---|---|---|
| `achtsamkeit` | Einsteiger & Achtsamkeit | lavendel | `thema-achtsamkeit` (vorhanden) |
| `stress` | Stress & Ruhe | blaugrün | `thema-stress` (vorhanden) |
| `fokus` | Fokus & Energie | pfirsich | `thema-fokus` (vorhanden) |
| `mitgefuehl` | Mitgefühl & Freundlichkeit | lavendel | `thema-mitgefuehl` (neu) |
| `gefuehle` | Gefühle & Loslassen | blaugrün | `thema-gefuehle` (neu) |
| `alltag` | Achtsam im Alltag | pfirsich | `thema-alltag` (neu) |

- Die Reihenfolge unter „Meditieren“ ist die der Tabelle. Aussehen und Aufbau der Liste bleiben unverändert: Überschrift mit Motiv (64 px), darunter die Karten des Themas.
- Innerhalb eines Themas stehen die Meditationen wie bisher in der Reihenfolge des Manifests.
- Die Zuordnungen (`CATEGORY_TITLE`, Reihenfolge, `THEMA` in `waschungen.ts`) sind `Record`s über `Category`. Fehlt ein Eintrag, meldet `npm run check` ihn.

## 5. Motive

Drei neue Themen-Motive entstehen in **einem** Connector-Aufruf, ein Bild mit drei Icons und vier Varianten, Kosten etwa 0,14 $:

- `thema-mitgefuehl`: zwei Blütenblätter, die zusammen ein Herz formen;
- `thema-gefuehle`: ein Blatt, das auf dem Wasser davontreibt;
- `thema-alltag`: eine dampfende Teeschale.

Für jedes Motiv wählt der Nutzer eine Variante. Erzeugt und freigestellt wird wie in M4–M6: Modell `gpt-image-2.5-sunburst`, Stil aus `content/motive.json`, `scripts/freistellen.py`, Zielgröße 192 px wie die übrigen Themen-Motive. Danach gibt es 39 Motive.

## 6. Vorschlag des Tages

Jede Tageszeit bekommt zwei Themen. Der Vorschlag rotiert täglich (nach Tag des Jahres) über die Meditationen beider Themen zusammen, in Manifest-Reihenfolge:

| Tageszeit | Themen | Meditationen |
|---|---|---|
| morgen (5–11 Uhr) | Fokus & Energie, Achtsam im Alltag | 6 |
| tag (11–17 Uhr) | Stress & Ruhe, Gefühle & Loslassen | 6 |
| abend (17–5 Uhr) | Einsteiger & Achtsamkeit, Mitgefühl & Freundlichkeit | 6 |

Das Motiv des Vorschlags bleibt das Motiv der Tageszeit. Der Rückfall bleibt: Hat keines der beiden Themen eine Meditation, rotiert der Vorschlag über die ganze Liste.

## 7. Vertonung

- **Weg:** wie in M3 (README „Meditationen vertonen“): `estimate` → `split` → Abschnitte über den ElevenLabs-Connector → `assemble` → `manifest`.
- **Stimme:** Susanne K, Modell `eleven_v4`, Präfix `[softly] [slowly]` (`audio-work/voice.json`, unverändert). Eine Aufnahme je Abschnitt, gespeichert als `audio-work/cache/<hash>.mp3`.
- **Kosten:** Vor dem ersten Aufruf zählt `estimate` die Zeichen aller 9 Texte. Daraus folgt eine Schätzung der Credits, die der Nutzer erfährt. Vertont wird erst mit seinem OK. Kein Aufruf wird wiederholt; misslingt ein Abschnitt hörbar, entscheidet der Nutzer über eine neue Aufnahme.
- **Abhören:** Vor dem Einbau hört der Nutzer mindestens eine fertige neue Meditation probe. Lautheit −19 LUFS wie bisher.
- **Größe:** etwa 71 Minuten neues Audio bei rund 0,48 MB je Minute, also etwa 34 MB mehr für „Alle offline speichern“. Die Meditationen wachsen damit von 29,7 MB auf etwa 64 MB.

## 8. Code

- **`src/lib/content/catalog.ts`:**
  - `Category` um `mitgefuehl`, `gefuehle`, `alltag` erweitern;
  - `CATEGORY_TITLE` und `CATEGORY_ORDER` wie §4;
  - `CATEGORY_AT` wird zu zwei Themen je Tageszeit wie §6, `suggestionFor` filtert über beide.
- **`src/lib/content/waschungen.ts`:** `THEMA` wie §4.
- **`src/lib/content/motive.ts`, `content/motive.json`:** drei neue IDs mit Herkunft.
- **`scripts/` und Parser:** Die erlaubten Kategorien im Frontmatter-Parser kommen dazu, falls er sie prüft.
- **`src/content/meditations.json`:** wird von `manifest` erzeugt, mit 18 Einträgen.
- **Feste Zahlen in Tests:** Wo Tests 9 Meditationen, 16 Offline-Dateien (9 + 7), die Gesamtgröße oder 36 Motive annehmen, werden sie angepasst. Bekannt sind:
  - `tests/unit/catalog-meditations.test.ts`
  - `tests/unit/ich-view.test.ts` (Offline-Satz)
  - `tests/e2e/ich.spec.ts` (Offline)
  - `tests/e2e/pwa.spec.ts` (Motive)
  - `tests/unit/motive.test.ts`

## 9. Tests

- **Unit:**
  - Der Katalog hat 18 Meditationen in 6 Themen, jede Kategorie ist bekannt, `byCategory` liefert die Reihenfolge aus §4.
  - `suggestionFor` wählt für jede Tageszeit nur aus den zwei Themen aus §6 und rotiert über alle 6 Meditationen, ohne dass sich der Vorschlag am selben Tag ändert.
  - Jede Kategorie hat Farbfläche und Motiv.
  - Die neuen Texte bestehen den Parser, Stilleanteil ≥ 40 %, keine Platzhalter mehr.
- **E2E:**
  - „Meditieren“ zeigt 6 Themen-Überschriften in der Reihenfolge aus §4, mit Motiv. Benachbarte Themen haben unterschiedliche Farbflächen.
  - Eine neue Meditation startet und spielt.
  - „Alle offline speichern“ umfasst 18 Meditationen und 7 Musikstücke.
  - Der Vorschlag des Tages kommt morgens, tagsüber und abends aus den richtigen Themen.
- Alle bisherigen Tests bleiben grün.

## 10. Handy-Checkliste (für das README)

1. „Meditieren“: 6 Themen mit Motiven, die neuen Motive passen zu den alten. Benachbarte Themen haben unterschiedliche Farben.
2. Je eine neue Meditation aus jedem neuen Thema anhören: Stimme, Tempo, Pausen und Lautstärke wie bei den bisherigen, die Klangschale am Anfang und Ende.
3. „Gehmeditation“ unterwegs mit gesperrtem Bildschirm: Sie läuft durch, Pause und Weiter gehen über den Sperrbildschirm.
4. „Alle offline speichern“, dann Flugmodus: Alle 18 Meditationen spielen.
5. Morgens, mittags und abends zeigt „Heute“ einen Vorschlag aus den passenden Themen.

## 11. Kosten

| Posten | Kosten |
|---|---|
| Drei Themen-Motive (ein Bild, vier Varianten) | etwa 0,14 $ |
| Vertonung der 9 Texte | nach `estimate`, vor dem ersten Aufruf genannt |
