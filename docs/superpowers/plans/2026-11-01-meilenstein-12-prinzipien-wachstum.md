# Meilenstein 12: Prinzipien & Wachstum – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine stille Schicht für eigene Prinzipien, Erkenntnisse und höchstens drei Wachstumsfelder: die Karte „Deine Prinzipien“ unter „Energie“ mit dem Blatt „Deine Sammlung“ (Editor, „Notizen einfügen“), dazu das Prinzip der Woche als Sonntagswahl im Logbuch mit Anzeige im Morgen-Kasten und in „Deine Woche“, ein freiwilliges Wachstumsfeld bei „1 % besser“ und je Feld die Zählung der letzten 7 Tage in „Deine Woche“.

**Architecture:**
- **Daten:** eine freiwillige Liste `collection` in `ruhe.v1` (`version` bleibt 1). Grenzen und `textKey` stehen in `src/lib/principles/words.ts` (ohne Importe), der Parser in `src/lib/principles/collection.ts`; `with…` rein in `persist.ts`, Zusammenführen in `backup.ts`, geschrieben nur über `commit()`. Zwei neue Logbuch-Felder (`weekPrinciple`, `growthField`) verweisen per Kennung; aufgelöst wird erst bei der Anzeige.
- **Logik:** reine Funktionen mit `now` bzw. `day` als Parameter in `src/lib/principles/logic.ts`; nur die Oberfläche importiert sie.
- **Oberfläche:** neue Komponenten unter `src/components/principles/`; `Sheet`, `ChoiceGroup`, `WordPicker` und `TextStep` bekommen je eine kleine, optionale Erweiterung. Ohne Einträge sehen Morgen-Start, Logbuch und „Deine Woche“ aus wie in M11, bis auf die zwei benannten Änderungen (Spec §2.1).

**Tech Stack:** Svelte 5 (Runen), TypeScript, Vite-PWA, Vitest (Unit in Node, Browser in Chromium), Playwright auf dem Produktions-Build (Pixel 7, 412 px; 360-px-Tests setzen den Viewport).

**Spec:** `docs/superpowers/specs/2026-11-01-ruhe-m12-prinzipien-wachstum-design.md`

## Global Constraints

- **Spec und Texte:** Bindend ist die Spec; die Oberflächentexte unten gelten wörtlich (Anführungszeichen „…“, Gedankenstrich –). Die Beispiel-Einträge der Leinwand „Prinzipien Entwürfe“ kommen weder in App noch in Tests, Commits oder README.
- **Beispiele (Spec §3.2), nur diese und Abwandlungen:** Prinzip „Mehrweg statt Einweg“ (Erklärung „Dann fällt weniger Müll an.“, Wenn-dann „Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.“); Wachstumsfeld „Schach lernen“ (Schritt „Jeden Abend eine Eröffnung nachspielen.“, 1-%-Satz „Morgen zehn Minuten Schachaufgaben lösen.“); Erkenntnis „Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.“ (Quelle „Ein Schachkurs“); der Vorschlag „Dranbleiben“ als Leitsatz; erfundene Alltagszeilen nur im Einfügetext; für Mengen- und Längentests durchnummerierte Füllzeilen und Texte ohne Leerzeichen; nie echte Buchtitel, Personen oder Buchstellen.
- **Privatsphäre:** Prinzipien, Erkenntnisse, Wachstumsfelder und Zuordnungen liegen nur auf dem Gerät und im Backup, nie im Repo, in Commits, PR-Texten, Bildschirmfotos, Logs, Fehlermeldungen oder der Medien-Anzeige; der Rohtext von „Notizen einfügen“ steht nie in `localStorage`, `sessionStorage` oder Logs.
- **Kosten und Bilder:** keine Bild- oder Sprach-Generierung, keine neuen Bilder; die Karte nutzt das vorhandene Motiv `energie-sinn` (56 px, `alt=""`).
- **Unverändert:** `App.svelte`, `Heute.svelte`, `TabBar.svelte`, `ConfirmDialog.svelte`, `src/lib/ui/energy-ui.svelte.ts`, `src/lib/ui/layers.svelte.ts`, `morningReminder` und `ownFocus`, `src/lib/morning/*` samt `limited-input.ts`, `GratitudeStep.svelte`, `MorningFlow.svelte`, `src/lib/ui/ich-view.ts`, `content/hacks.json`, die Media Session und die Specs M9 bis M11.
- **Kopfkommentare** neuer und geänderter Dateien verweisen auf „Spec M12 §x“.
- **Speicher:** `localStorage['ruhe.v1']`, `version` bleibt 1, keine Migration; `collection` fehlt, solange sie leer ist, und liegt nie in `settings`.
- **Eintrag:** `{ id, kind, text, note?, ifThen?, source?, step? }`, `kind` ist `'prinzip' | 'feld' | 'erkenntnis'`; `note` und `ifThen` nur bei `prinzip`, `step` nur bei `feld`, `source` nur bei `erkenntnis`; kein Zeitstempel, Bereich, Zustand oder Unterart; fremde Felder und unbekannte Schlüssel entfallen.
- **Kennung:** `s-` und die ersten 8 Hex-Zeichen von `crypto.randomUUID()` (`COLLECTION_ID = /^s-[0-9a-f]{8}$/`), beim Anlegen gezogen, nie geändert; vergeben sind die Kennungen der Sammlung, die schon gezogenen derselben Einfügung und alle `weekPrinciple` und `growthField` in `evenings`.
- **Längen** (Code-Punkte, getrimmt, zu lang gekürzt, leer entfällt): Leitsatz 60 (`LEITSATZ_MAX`), Erklärung 160 (`NOTE_MAX`), Wenn-dann 120 (`IF_THEN_MAX`), Erkenntnis 500 (`INSIGHT_MAX`), Quelle 80 (`SOURCE_MAX`), Name 40 (`FIELD_NAME_MAX`), Schritt 120 (`STEP_MAX`); beim Einfügen zählen höchstens die ersten 50 000 Code-Punkte (`PASTE_MAX`).
- **Grenzen:** anlegen (`KIND_MAX`) 12 Prinzipien, 3 Felder, 300 Erkenntnisse, durchgesetzt von der Oberfläche; laden und importieren (`KIND_LOAD_MAX`) 50, 20, 600, gezählt je Art in Listenfolge.
- **Reihenfolge:** Prinzipien und Felder wie angelegt (neue hinten); neue Erkenntnisse vorn, eine Einfügung als Block in Zeilenfolge; Bearbeiten lässt die Stelle; Importiertes kommt hinten dazu.
- **Gleicher Text** heißt überall gleicher `textKey(text)`: Unicode-NFC, jeder Leerraum in Folge ein Leerzeichen, getrimmt, `toLowerCase()` (nie `localeCompare`); er gilt für die Doppel-Sperre im Editor, das Einfügen, den Import von Erkenntnissen und das Ausblenden am Sonntag.
- **Logbuch:** `weekPrinciple` nur an einem Sonntag als Logbuch-Tag und dann ohne `weekFocus`; `growthField` nur zusammen mit `better`; im Entwurf sind beide anfangs `null`.
- **Verweise:** nur über Kennung und Art (`weekPrinciple` → `prinzip`, `growthField` → `feld`), aufgelöst erst bei der Anzeige; unbekannt oder falsche Art gilt als kein Verweis, ohne Rückgriff auf ein älteres Wort; Umbenennen ändert nur `text`, Löschen entfernt nur den Eintrag.
- **Zeit:** Wahl des Ankers am Logbuch-Tag (Sonntag 4:00 bis Montag 3:59); Geltung Kalendertag 1 bis 7 nach dem Sonntag der Wahl (`dayKey`); Feldzählung über den Logbuch-Tag und die 6 Tage davor; die Erkenntnis des Tages wechselt um Mitternacht; geprüft am 29.03.2026 (23 Stunden) und 25.10.2026 (25 Stunden).
- **„Jetzt“:** Ansichten rechnen in `$derived` mit `appNow()`; der Morgen-Kasten wird beim Einblenden festgehalten (`untrack`).
- **Schichtung:** `words.ts` importiert nichts; `collection.ts` nur `words.ts` und `src/lib/text.ts`, nie `schema.ts`; `schema.ts` importiert `src/lib/text.ts`, `collection.ts`, `words.ts`; `persist.ts` und `backup.ts` nutzen `schema.ts`, `collection.ts`, `words.ts`; `store.svelte.ts` nutzt `persist.ts`, `backup.ts`, `newCollectionId`; `logic.ts` nutzt `words.ts`, `collection.ts`, `src/lib/text.ts`, `src/lib/evening/logic.ts`, `dayKey` und Typen aus `schema.ts`; jede Aktion schreibt mit genau einem `commit` (eine Einfügung auch).
- **Statistik:** Sammlung und Zuordnungen zählen nicht in Sitzungen, Minuten, Serie, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in.
- **Backup:** `serializeBackup` nimmt `collection` auf, wenn es Einträge gibt; Import: Gerät bleibt, Datei in ihrer Reihenfolge, bekannte Kennung übersprungen, bei Erkenntnissen auch gleicher `textKey`, sonst hinten an, solange die Art unter `KIND_LOAD_MAX` liegt; Rückgabe `{ data, added, addedEnergy }` und `importMessage` bleiben, die Sammlung zählt in keiner Zahl.
- **Ebenen:** „Deine Sammlung“ hängt in `src/screens/Energie.svelte` hinter `</section>` (im `inert` der App); Editor und „Notizen einfügen“ sind eigene Blätter als Geschwister dahinter (später im DOM liegt oben); die Rückfrage hängt im Editor; die Vorschau ist eine eigene Ebene (`openLayer`), genau solange `view === 'preview'`.
- **Schließen:** Zurück-Geste, Escape und Danebentippen schließen nur die oberste Ebene, in der Vorschau führen sie zum Text; bei der Rückfrage wirken Zurück-Geste und Escape wie „Behalten“, ein Tipp daneben tut nichts; Editor und Einfügen verwerfen ohne Rückfrage; nach „Speichern“ und „Löschen“ schließt der Editor.
- **Fokus:** beim Öffnen auf der Überschrift des Blatts, bei der Rückfrage auf „Behalten“, nie ungefragt in einem Feld; nach `tick()`: Editor oder Einfügen zu → auslösende Zeile bzw. Knopf, gibt es sie nicht mehr → h3 des Abschnitts; Sammlung zu → „Sammlung öffnen“; Rückfrage ohne Löschen zu → „Löschen“ im Editor; nie `body`.
- **Doppeltipps:** In `PrinciplesCard`, `CollectionSheet`, `ItemEditor` und `PasteSheet` sperrt `tapArming` nur Tipps (`onclick` prüft `armed`; weder `disabled` noch `aria-disabled`, die Knöpfe bleiben fokussierbar); `disabled` nur für echte Sperren („Speichern“ bei leerem oder doppeltem Pflichtfeld, „Vorschau zeigen“ bei leerem Text).
- **Sperren im Einzelnen:** „Sammlung öffnen“ `tapArming(() => open)`; Knöpfe, Zeilen und Danebentippen der Sammlung beginnen neu, wenn Editor oder Einfügen öffnen oder schließen; Editor `tapArming(() => confirming)` für „Speichern“, „Löschen“ und das „Löschen“ der Rückfrage (geprüft in `onConfirm`), sein Danebentippen ebenso; Einfügen `tapArming(() => view)` für „Vorschau zeigen“, „… übernehmen“, „Zurück zum Text“ und sein Danebentippen.
- **Eingabe:** alle Felder außer „Deine Notizen“ laufen über `limitedInput` (Code-Punkte, Zeilenumbruch → Leerzeichen, nie `maxlength`) mit Zähler „{n} / {Grenze}“ per `aria-describedby`; in Blättern bekommt `limitedInput` ein `onEnter`, das das umgebende `[role=dialog]` fokussiert; „Deine Notizen“ ist ein schlichtes `textarea` (6 Zeilen, `bind:value`), das nichts kürzt.
- **Größen:** Tippflächen mindestens 48 px, Eingabefelder mindestens 52 px; bei 360 px und 130 % Schrift kein seitliches Scrollen; Texte ohne Leerzeichen in voller Länge brechen um (`overflow-wrap: anywhere`) in Karte, Sammlung, Editor, Einfügen (beide Ansichten), Rückfrage, Sonntags-Chips, Feld-Chips, Morgen-Kasten, „Dein Abend“ und „Deine Woche“.
- **Tests, Daten:** nur erfundene Werte (§3.2); `tests/unit/principles-logic.test.ts` hat in Zeile 1 `process.env.TZ = 'Europe/Berlin'` und einen eigenen Test der Zeitzone.
- **Tests, Uhr:** Browser-Tests mit fester Uhr setzen `vi.useFakeTimers({ toFake: ['Date'] })`, `vi.setSystemTime(at)` und `tageszeitUi.now = at.getTime()` (`appNow` nimmt das Spätere) und stellen beides in `afterEach` zurück; E2E mit `timezoneId: 'Europe/Berlin'`, Seeds per `addInitScript` mit `sessionStorage`-Merker wie `tests/e2e/abend.spec.ts:46–52`, `page.clock.setFixedTime` nur, solange kein Programm läuft (M9 R1).
- **Tests, Tipp-Sperre:** Weil die neuen Knöpfe ohne `disabled` sperren (`ARM_MS = 400`, `src/lib/ui/arming.svelte.ts:5`), wartet jeder Test nach dem Öffnen oder Schließen eines Blatts oder der Rückfrage und nach jedem Wechsel der Ansicht, bevor er tippt: im Browser 450 ms (`armed()`; Sperre und Warten laufen auf derselben Uhr), im E2E 600 ms (`settle(page)`; Puffer, falls der Timer im ausgelasteten Browser später feuert). Sonst verfällt der Tipp still.
- **Bestehende Tests:** Genau fünf bestehende Prüfzeilen ändern sich: `tests/e2e/energie.spec.ts:952` und `:955`, `tests/e2e/abend.spec.ts:268`, `tests/e2e/ich.spec.ts:680`, `tests/browser/evening-ui.test.ts:50`. Dazu kommen nur erweiterte Importzeilen, am Dateiende angehängte Tests und der Helfer `alignOverSheet` am Ende von `tests/e2e/taps.ts`. Alle übrigen Prüfungen bleiben ohne Änderung grün, darunter `abend-heute.spec.ts:189`, `:212–215`, `:227`, `abend.spec.ts:98–100`, `energie.spec.ts:1094`, `ich.spec.ts:740`, `:757`, `atmen.spec.ts:361` (Chip-Höhe), `intention-step.test.ts:175–203`, `stats-store.test.ts:63–64`, `:114–115`, `evening-logic.test.ts:186–202`, `stats-backup.test.ts:21–22`, `:29`, `ich-view.test.ts:107–119`, `heute.spec.ts`, `karten.spec.ts` und `morgen*.spec.ts`.
- **Texte, Karte** (unter „Energie“ zwischen „Fokus-Sprint“ und „Brain Hacks“): h2 „Deine Prinzipien“ (Region gleichen Namens); mit Erkenntnissen h3 „Erkenntnis des Tages“, der volle Text und leise „Quelle: {Quelle}“; ohne Einträge „Halte fest, was dich leitet, was du aus Büchern mitnimmst und woran du wachsen willst.“; mit Einträgen ohne Erkenntnis „Hier steht jeden Tag eine deiner Erkenntnisse, sobald du welche festhältst.“; Umrissknopf über die volle Breite „Sammlung öffnen“; „Kein Goldrand“ (die Karte behält den gewöhnlichen `.card`-Rand `--gold-line`, kein `--gold-line-strong` wie `EveningTodayCard.svelte:72`), nichts zum Abhaken, kein Prinzip der Woche.
- **Texte, Blatt:** Titel und Dialogname „Deine Sammlung“, darunter „Alles hier bleibt auf diesem Gerät und in deinem Backup.“; scheitert das Speichern (`role=alert`): „Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.“
- **Texte, Abschnitt „Prinzipien“:** Knopf „Neues Prinzip“, an der Grenze „Höchstens 12 Prinzipien.“, leer „Kurze Leitsätze, die dir Richtung geben, gern mit Wenn-dann. Sonntags kannst du eines als Prinzip der Woche wählen.“
- **Texte, Abschnitt „Wachstumsfelder“:** Knopf „Neues Wachstumsfeld“, an der Grenze „Höchstens 3 Wachstumsfelder.“, leer „Etwas, woran du bewusst arbeitest, oder etwas, das du lernen willst. Abends kannst du deinen Vorsatz für morgen einem Feld zuordnen.“
- **Texte, Abschnitt „Erkenntnisse“:** Knöpfe „Neue Erkenntnis“ und „Notizen einfügen“ in einer Zeile (rutschen bei Enge untereinander), an der Grenze „Höchstens 300 Erkenntnisse.“, leer „Was du aus Büchern und Erfahrungen mitnimmst, am besten in deinen Worten. Jeden Tag steht eine davon auf der Karte.“; Statuszeile (`role=status`, zwischen Knöpfen und Zeilen) „{n} Erkenntnisse übernommen.“ bzw. „1 Erkenntnis übernommen.“
- **Texte, Zeilen:** je Eintrag ein Knopf mit dem Namen „{Text} bearbeiten“ (ganzer Text), Stift als Schmuck (`aria-hidden`), Goldlinien wie unter „Eigene Muster“; leise Zeile als Beschreibung (`aria-describedby`): Prinzip das Wenn-dann, ohne Wenn-dann die Erklärung; Feld „Nächster kleiner Schritt: {Schritt}“; Erkenntnis „Quelle: {Quelle}“, der Text höchstens drei Zeilen sichtbar.
- **Texte, Editor Prinzip:** „Neues Prinzip“ / „Prinzip bearbeiten“, Zeile „Kurz und als Richtung, nicht als strenge Regel.“; Felder „Leitsatz“, „z. B. Mehrweg statt Einweg“, „{n} / 60“ · „Was heißt das für dich? (freiwillig)“, „z. B. Dann fällt weniger Müll an.“, „{n} / 160“ · „Wenn-dann (freiwillig)“, „z. B. Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.“, „{n} / 120“.
- **Texte, Editor Erkenntnis:** „Neue Erkenntnis“ / „Erkenntnis bearbeiten“, Zeile „Am besten in deinen eigenen Worten, so bleibt sie leichter hängen.“; Felder „Erkenntnis“, „z. B. Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.“, „{n} / 500“ · „Quelle (freiwillig)“, „z. B. Buchtitel, Autorin“, „{n} / 80“.
- **Texte, Editor Wachstumsfeld:** „Neues Wachstumsfeld“ / „Wachstumsfeld bearbeiten“, Zeile „Etwas, woran du bewusst arbeitest, oder etwas, das du lernen willst.“; Felder „Name“, „z. B. Schach lernen“, „{n} / 40“ · „Nächster kleiner Schritt (freiwillig)“, „z. B. Jeden Abend eine Eröffnung nachspielen.“, „{n} / 120“.
- **Texte, Editor-Knöpfe:** „Speichern“ (gefüllt), „Löschen“ (Umrissknopf, nur beim Bearbeiten); einzeilig sind Leitsatz, Quelle und Name, die übrigen Felder mehrzeilig; Doppel: „Das steht schon in deiner Sammlung.“ unter dem Pflichtfeld, per `aria-describedby` am Feld und am gesperrten „Speichern“.
- **Texte, Rückfrage** (Knöpfe „Löschen“ und „Behalten“, {Leitsatz}/{Name} = gespeicherter Text): „Prinzip löschen?“ mit „„{Leitsatz}“ verschwindet aus deiner Sammlung.“, als geltendes Prinzip der Woche dahinter „Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.“, ist für die neue Woche schon ein anderes gewählt nur „Es ist gerade dein Prinzip der Woche.“, sonst als Wahl für die neue Woche „Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.“; „Wachstumsfeld löschen?“ mit „„{Name}“ verschwindet aus deiner Sammlung. Deine Sätze im Logbuch bleiben, nur die Zuordnung entfällt.“; „Erkenntnis löschen?“ mit „Sie verschwindet aus deiner Sammlung.“
- **Texte, Einfügen „Text“:** Titel und Dialogname „Notizen einfügen“; „Kopiere Text aus deiner Notiz-App und füge ihn hier ein. Jede Zeile wird eine Erkenntnis. Alles bleibt auf diesem Gerät.“; Feld „Deine Notizen“ mit Platzhalter „Eine Erkenntnis pro Zeile“; Feld „Quelle für alle (freiwillig)“, „z. B. Buchtitel, Autorin“, „{n} / 80“; Knopf „Vorschau zeigen“ (gefüllt).
- **Texte, Einfügen „Vorschau“:** h3 „Vorschau“; „{n} neue Erkenntnisse“ / „1 neue Erkenntnis“ / „Keine neue Erkenntnis dabei.“; nur bei Bedarf „{d} doppelt oder schon vorhanden, übersprungen.“, „{k} gekürzt auf 500 Zeichen.“, „{o} passen nicht mehr (höchstens 300 Erkenntnisse).“ / „1 passt nicht mehr (höchstens 300 Erkenntnisse).“, „Der Text ist sehr lang. Verwendet werden die ersten 50 000 Zeichen.“, „Quelle: {Quelle}“; Knopf „{n} Erkenntnisse übernehmen“ / „1 Erkenntnis übernehmen“ (gefüllt, fehlt bei 0), daneben „Zurück zum Text“ (Umrissknopf); darunter eine nummerierte Liste (`<ol>`) aller neuen Erkenntnisse, gekürzte mit der Marke „gekürzt“.
- **Texte, „1 % besser“** (M11-Texte unverändert): nur mit Feldern unter Feld und Zähler die sichtbare Beschriftung „Wachstumsfeld (freiwillig)“ (`aria-hidden`, zugleich Name der Radiogruppe) und je Feld ein Chip mit dem Namen, in der Reihenfolge der Sammlung; kein Chip vorgewählt, ein Tipp wählt, ein zweiter nimmt zurück, Pfeiltasten wählen nur ein anderes Feld.
- **Texte, Wochenseite** (nur sonntags): unter „Dein Fokus für nächste Woche“ mit Prinzipien zuerst „Deine Prinzipien“ (sichtbar beschriftet, Leitsätze in der Reihenfolge der Sammlung), dann „Vorschläge“ (jetzt sichtbar beschriftet), „Deine Wörter“, Feld „Eigenes Wort“ mit „oder eigenes Wort“; ohne Prinzipien Zeichen für Zeichen wie M11.
- **Texte, Abschluss und „Dein Abend“:** „Für die neue Woche: {Wort}“ bzw. „Für die neue Woche: {Leitsatz}“ statt „Wochenfokus: {Wort}“, auch ohne Prinzipien; ohne jede Angabe „Logbuch erledigt.“
- **Texte, Morgen-Kasten** (Region „Von gestern Abend“, kurz und lang): „Gestern vorgenommen“ unverändert; „Prinzip der Woche“ mit dem Leitsatz (Akzent, fett) und, falls gesetzt, dem Wenn-dann (normal, etwas kleiner), ohne Erklärung; bei einem Wort wie bisher „Wochenfokus“.
- **Texte, „Deine Woche“:** direkt hinter dem Abschnitt „Wochenrückblick“ (auch ohne ihn) „Prinzip der Woche: {Leitsatz}“ mit leisem „{Wenn-dann}“ darunter bzw. „Wochenfokus: {Wort}“; h3 „Wachstumsfelder“ (nur mit Feldern) als Liste mit dem Namen, bei n ≥ 1 „Vorgenommen an {n} der letzten 7 Tage“ und „Zuletzt: {Satz}“, bei n = 0 nur, falls gesetzt, „Nächster kleiner Schritt: {Schritt}“; danach „Was bei dir wirkt“; kein neues `role=img`, keine Balken, Prozente, Rangfolgen.
- **Texte, „Ich“:** Hinweis der Karte „Backup“: „Sichere deine Sitzungen, Energie-Einträge, Prinzipien und Einstellungen in einer Datei. Beim Importieren kommen neue Sitzungen dazu, die Einstellungen werden aus der Datei übernommen.“; die Import-Meldung bleibt („0 neue Sitzungen importiert.“, wenn die Datei nur Einträge der Sammlung bringt).

## Review Focus

1. **Danebentippen oder Escape in der Vorschau:** Auf dem Handy liegt über dem Blatt eine große Fläche; ein Tipp dorthin oder Escape in der Vorschau führt zur Textansicht, Text und Quelle bleiben, der Fokus liegt auf „Vorschau zeigen“, nichts wird gespeichert. Die Spec-Tests prüfen dort nur die Zurück-Geste (Test in Task 5).
2. **Neues Wachstumsfeld ohne Vorsatz:** „Deine Woche“ zeigt Namen und „Nächster kleiner Schritt: …“, nie „Vorgenommen an 0 der letzten 7 Tage“ oder „Zuletzt:“; das sieht jeder, der ein Feld neu anlegt (Test in Task 7).
3. **Sonntags-Logbuch nach Mitternacht beendet:** Wer Sonntag um 23:50 beginnt und Mo 0:35 abschließt, behält das gewählte Prinzip (`weekPrinciple` am Sonntag); der Sonntag hängt am Logbuch-Tag aus dem Eingang, nie an `now` (Tests in Task 1 und Task 6).
4. **Doppeltipp auf „Vorschau zeigen“:** Der zweite Tipp trifft den Hauptknopf der Vorschau und übernimmt nichts; ohne Rückgängig ist die Vorschau der einzige Schutz vor bis zu 300 falschen Einträgen (Test in Task 5).
5. **Sehr langer Export (über 50 000 Zeichen):** Das Feld „Deine Notizen“ behält beim Einfügen alles (kein `maxlength`, kein `limitedInput`); erst „Vorschau zeigen“ nimmt die ersten 50 000 Zeichen und nennt „Der Text ist sehr lang. Verwendet werden die ersten 50 000 Zeichen.“ (Test in Task 5).

---

### Task 1: Sammlung und neue Logbuch-Felder speichern, laden, sichern

**Files:**
- Create:
  - `src/lib/principles/words.ts`
  - `src/lib/principles/collection.ts`
  - `tests/unit/principles-logic.test.ts` (erster Teil: Zeitzone, `textKey`, `newCollectionId`; Task 2 ergänzt)
- Modify:
  - `src/lib/text.ts` (Kopfkommentar Z. 1 wird „Kleine reine Hilfen für Texte.“; nimmt `clipChars` und `clipText` auf)
  - `src/lib/stats/schema.ts:105–131` (`EveningEntry`, `EveningInput`), `:178–193` (`AppData`), `:222–228` und `:235–241` (`clipChars`, `clipText` ziehen um; `clipTask` Z. 230–233 bleibt), `:477–495` (`parseEvening`), `:506–536` (`parseData`)
  - `src/lib/stats/persist.ts:102–115` (neue `with…` dahinter), `:184–204` (`withEvening`)
  - `src/lib/stats/backup.ts:1–2`, `:13–21`, `:61–104`
  - `src/lib/stats/store.svelte.ts:9–10`, `:105–113` (neue Funktionen dahinter)
- Test:
  - `tests/unit/text.test.ts`, `tests/unit/principles-logic.test.ts`, `tests/unit/stats-schema.test.ts`, `tests/unit/stats-persist.test.ts`, `tests/unit/stats-backup.test.ts`
  - `tests/browser/stats-store.test.ts`

**Interfaces:**
- Consumes: `isSunday` (`summary.ts:15`); Muster `parseBreathPatterns` (`schema.ts:340–349`), `withBreathPattern`/`withoutBreathPattern` (`persist.ts:102–115`), `newCustomPatternId` (`src/lib/breath/custom.ts:46–48`), `commit()` (`store.svelte.ts:27–30`).
- Produces, `src/lib/text.ts`: `clipChars(text: string, max: number): string`, `clipText(text: string, max: number): string` (unverändert umgezogen, samt Kommentaren); `schema.ts` exportiert dieselben Funktionen weiter.
- Produces, `words.ts` (ohne Importe):
  - `type CollectionKind = 'prinzip' | 'feld' | 'erkenntnis'`
  - `LEITSATZ_MAX = 60`, `NOTE_MAX = 160`, `IF_THEN_MAX = 120`, `INSIGHT_MAX = 500`, `SOURCE_MAX = 80`, `FIELD_NAME_MAX = 40`, `STEP_MAX = 120`, `PASTE_MAX = 50_000`
  - `KIND_MAX: Readonly<Record<CollectionKind, number>> = { prinzip: 12, feld: 3, erkenntnis: 300 }`, `KIND_LOAD_MAX = { prinzip: 50, feld: 20, erkenntnis: 600 }` (gleicher Typ)
  - `COLLECTION_ID = /^s-[0-9a-f]{8}$/`, `textKey(text: string): string`
- Produces, `collection.ts`:
  - `interface CollectionItem { id: string; kind: CollectionKind; text: string; note?: string; ifThen?: string; source?: string; step?: string }`
  - `parseCollectionItem(raw: unknown): CollectionItem | null`, `parseCollection(raw: unknown): CollectionItem[]`
  - `newCollectionId(taken: ReadonlySet<string>, random: () => string = () => crypto.randomUUID()): string`
- Produces, `schema.ts`: `AppData.collection?: CollectionItem[]`; `EveningEntry.weekPrinciple?: string`, `EveningEntry.growthField?: string`; `EveningInput.weekPrinciple?: string | null`, `EveningInput.growthField?: string | null`.
- Produces, `persist.ts`: `withCollectionItem(data: AppData, item: CollectionItem): AppData`, `withoutCollectionItem(data: AppData, id: string): AppData`, `withInsights(data: AppData, items: readonly CollectionItem[]): AppData`; `withEvening(data, input, now)` mit den neuen Feldern.
- Produces, `backup.ts`: `serializeBackup` mit `collection`; intern `mergeCollection(own: readonly CollectionItem[] | undefined, incoming: readonly CollectionItem[] | undefined): CollectionItem[]`; `mergeBackup` mit unveränderter Rückgabe.
- Produces, `store.svelte.ts`: `saveCollectionItem(item: Omit<CollectionItem, 'id'> & { id?: string }): void`, `deleteCollectionItem(id: string): void`, `addInsights(texts: readonly string[], source: string): void`.

- [ ] **Step 1: Failing tests schreiben.** Gemeinsame Einträge (in jeder Testdatei oben, Typen je nach Datei):

```ts
const P = { id: 's-0000000a', kind: 'prinzip', text: 'Mehrweg statt Einweg', note: 'Dann fällt weniger Müll an.', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' } as const
const F = { id: 's-0000000b', kind: 'feld', text: 'Schach lernen', step: 'Jeden Abend eine Eröffnung nachspielen.' } as const
const E = { id: 's-0000000c', kind: 'erkenntnis', text: 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', source: 'Ein Schachkurs' } as const
const hex = (n: number) => `s-${n.toString(16).padStart(8, '0')}`
```

`tests/unit/text.test.ts`:

```ts
import { clipChars, clipText } from '../../src/lib/text'
import * as schema from '../../src/lib/stats/schema'
test('clipChars und clipText wohnen in text.ts; schema.ts reicht dieselben Funktionen weiter', () => {
  expect(schema.clipChars).toBe(clipChars)
  expect(schema.clipText).toBe(clipText)
  expect(clipText('  Mehrweg statt Einweg  ', 7)).toBe('Mehrweg')
  expect(clipChars('😀😀', 1)).toBe('😀')
})
```

`tests/unit/principles-logic.test.ts` (neu, Zeile 1 `process.env.TZ = 'Europe/Berlin'`):

```ts
test('Zeitzone Europe/Berlin (sonst prüfen die Umstellungs-Tests nichts)', () => {
  expect([new Date(2026, 9, 24, 12).getTimezoneOffset(), new Date(2026, 9, 26, 12).getTimezoneOffset()]).toEqual([-120, -60])
})
describe('textKey', () => {
  test('Groß und klein, Leerraum in Folge, Ränder', () => expect(textKey('  Mehrweg\u00a0 statt\tEINWEG\n')).toBe('mehrweg statt einweg'))
  test('NFC: zerlegtes und zusammengesetztes „é“ sind gleich', () => {
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe(textKey('Ein Schachkurs im Caf\u00e9'))
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe('ein schachkurs im caf\u00e9')
  })
})
describe('newCollectionId', () => {
  test('Form: s- und 8 Hex-Zeichen', () => expect(newCollectionId(new Set())).toMatch(COLLECTION_ID))
  test('bei Kollision neu gezogen; Kennungen der Sammlung, derselben Einfügung und Verweise aus evenings zählen', () => {
    const draws = ['aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-2222-4222-8222-222222222222', 'cccccccc-3333-4333-8333-333333333333']
    const random = () => draws.shift()!
    const taken = new Set(['s-bbbbbbbb']) // etwa ein weekPrinciple aus evenings
    const first = newCollectionId(taken, random)
    taken.add(first) // wie addInsights: eben gezogen, dieselbe Einfügung
    expect([first, newCollectionId(taken, random)]).toEqual(['s-aaaaaaaa', 's-cccccccc'])
  })
})
```

`tests/unit/stats-schema.test.ts` (ans Ende):

```ts
const withCollection = (collection: unknown) => parseData({ version: 1, sessions: [], settings: {}, collection })!
const evenings = (list: object[]) => parseData({ version: 1, sessions: [], settings: {}, evenings: list })!.evenings
test('Sammlung: gültige Einträge je Art bleiben in ihrer Reihenfolge; leer oder kaputt fehlt das Feld', () => {
  expect(withCollection([P, F, E]).collection).toEqual([P, F, E])
  expect(withCollection([])).not.toHaveProperty('collection')
  expect(withCollection('kaputt')).not.toHaveProperty('collection')
})
test('Sammlung: kein Objekt, falsche Kennung, unbekannte Art, fehlender oder leerer Text: nur der Eintrag entfällt', () => {
  const bad = [42, null, [], { ...P, id: 'eigen-0000000a' }, { ...P, id: 's-0000000G' }, { ...F, kind: 'wert' }, { ...E, text: '   ' }, { ...E, text: 7 }, { id: hex(9), kind: 'feld' }]
  expect(withCollection([...bad, F]).collection).toEqual([F])
})
test('Sammlung: je Feld gekürzt, leere freiwillige und fremde Felder entfallen', () => {
  const [p, f, e] = withCollection([
    { ...P, text: ` ${'L'.repeat(70)} `, note: 'N'.repeat(170), ifThen: 'W'.repeat(130), source: 'fremd', step: 'fremd', extra: 1 },
    { ...F, text: 'F'.repeat(45), step: '  ', note: 'fremd' },
    { ...E, text: 'E'.repeat(510), source: 'Q'.repeat(90), ifThen: 'fremd' },
  ]).collection!
  expect(p).toEqual({ id: P.id, kind: 'prinzip', text: 'L'.repeat(60), note: 'N'.repeat(160), ifThen: 'W'.repeat(120) })
  expect(f).toEqual({ id: F.id, kind: 'feld', text: 'F'.repeat(40) })
  expect(e).toEqual({ id: E.id, kind: 'erkenntnis', text: 'E'.repeat(500), source: 'Q'.repeat(80) })
})
test('Sammlung: bei doppelter Kennung gilt der erste', () => {
  expect(withCollection([P, { ...P, text: 'Mehrweg statt Einweg im Büro' }]).collection).toEqual([P])
})
test('Sammlung: Lade-Grenzen je Art in Listenfolge (50, 20, 600), viele Erkenntnisse verdrängen nichts', () => {
  const many = (kind: string, from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: hex(from + i), kind, text: `Zeile ${i + 1}` }))
  const list = withCollection([...many('erkenntnis', 1, 700), ...many('prinzip', 1001, 60), ...many('feld', 2001, 25)]).collection!
  const count = (kind: string) => list.filter((i) => i.kind === kind).length
  expect([count('erkenntnis'), count('prinzip'), count('feld')]).toEqual([600, 50, 20])
  expect(list[599].text).toBe('Zeile 600')
})
test('Logbuch: weekPrinciple nur sonntags mit gültiger Kennung, dann ohne weekFocus; growthField nur mit better', () => {
  const at = '2026-11-01T20:00:00.000Z'
  const better = 'Morgen zehn Minuten Schachaufgaben lösen.'
  expect(evenings([{ day: '2026-11-01', at, weekFocus: 'Dranbleiben', weekPrinciple: P.id }])).toEqual([{ day: '2026-11-01', at, weekPrinciple: P.id }])
  expect(evenings([{ day: '2026-11-01', at, weekFocus: 'Dranbleiben', weekPrinciple: 'eigen-0000000a' }])).toEqual([{ day: '2026-11-01', at, weekFocus: 'Dranbleiben' }])
  expect(evenings([{ day: '2026-11-02', at, weekPrinciple: P.id }])).toEqual([{ day: '2026-11-02', at }])
  expect(evenings([{ day: '2026-11-02', at, better, growthField: F.id }])).toEqual([{ day: '2026-11-02', at, better, growthField: F.id }])
  expect(evenings([{ day: '2026-11-03', at, growthField: F.id }, { day: '2026-11-04', at, better, growthField: 'feld-1' }])).toEqual([{ day: '2026-11-03', at }, { day: '2026-11-04', at, better }])
})
```

`tests/unit/stats-persist.test.ts` (ans Ende; `base = { ...emptyData(), collection: [P, F, E] }`):

```ts
test('withCollectionItem ersetzt bei gleicher Kennung an der Stelle; andere Art oder ungültig ergibt data; Eingang bleibt', () => {
  const before = JSON.stringify(base)
  expect(withCollectionItem(base, { ...F, text: 'Schach spielen' }).collection!.map((i) => i.text)).toEqual([P.text, 'Schach spielen', E.text])
  expect(withCollectionItem(base, { ...F, kind: 'prinzip' })).toBe(base)
  expect(withCollectionItem(base, { ...P, id: 'x' })).toBe(base)
  expect(withCollectionItem(base, { ...P, text: '  ' })).toBe(base)
  expect(JSON.stringify(base)).toBe(before)
})
test('withCollectionItem: neue Erkenntnis vorn, neues Prinzip und Feld hinten', () => {
  expect(withCollectionItem(base, { id: hex(1), kind: 'erkenntnis', text: 'Wer im Schach die Mitte besetzt, hat mehr Zeit.' }).collection![0].id).toBe(hex(1))
  expect(withCollectionItem(base, { id: hex(2), kind: 'feld', text: 'Mehrweg im Alltag' }).collection!.at(-1)!.id).toBe(hex(2))
  expect(withCollectionItem(base, { id: hex(3), kind: 'prinzip', text: 'Dranbleiben' }).collection!.at(-1)!.id).toBe(hex(3))
})
test('withCollectionItem kürzt und lässt leere und fremde Felder weg', () => {
  const item = { id: hex(4), kind: 'prinzip', text: ` ${'L'.repeat(70)} `, note: ' ', step: 'fremd' } as CollectionItem
  expect(withCollectionItem(emptyData(), item).collection).toEqual([{ id: hex(4), kind: 'prinzip', text: 'L'.repeat(60) }])
})
test('withoutCollectionItem: ohne Einträge fehlt das Feld, Logbücher bleiben, unbekannte Kennung ergibt data', () => {
  const evenings = [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', weekPrinciple: P.id }]
  const one: AppData = { ...emptyData(), collection: [P], evenings }
  expect(withoutCollectionItem(one, P.id)).toEqual({ ...emptyData(), evenings })
  expect(withoutCollectionItem(one, 's-000000ff')).toBe(one)
})
test('withInsights stellt neue Erkenntnisse in ihrer Reihenfolge vor die vorhandenen; Ungültiges entfällt', () => {
  const fresh = [{ id: hex(5), kind: 'erkenntnis', text: 'Eins' }, { id: hex(6), kind: 'erkenntnis', text: 'Zwei' }, { id: 'kaputt', kind: 'erkenntnis', text: 'Drei' }] as CollectionItem[]
  expect(withInsights(base, fresh).collection!.map((i) => i.id)).toEqual([hex(5), hex(6), P.id, F.id, E.id])
})
test('withEvening: weekPrinciple nur sonntags und nur auf ein vorhandenes Prinzip, dann ohne weekFocus', () => {
  const sunday = new Date(2026, 10, 1, 21)
  const save = (input: Partial<EveningInput>) => withEvening(base, { day: '2026-11-01', ...input }, sunday).evenings![0]
  expect(save({ weekFocus: 'Dranbleiben', weekPrinciple: P.id })).toEqual({ day: '2026-11-01', at: sunday.toISOString(), weekPrinciple: P.id })
  expect(save({ weekFocus: 'Dranbleiben', weekPrinciple: F.id })).toEqual({ day: '2026-11-01', at: sunday.toISOString(), weekFocus: 'Dranbleiben' })
  expect(save({ weekPrinciple: 's-000000ff' })).not.toHaveProperty('weekPrinciple')
  expect(withEvening(base, { day: '2026-11-02', weekPrinciple: P.id }, new Date(2026, 10, 2, 21)).evenings![0]).not.toHaveProperty('weekPrinciple')
})
test('withEvening: ein Sonntags-Logbuch, das Mo 0:30 endet, behält sein Prinzip (Review Focus 3)', () => {
  expect(withEvening(base, { day: '2026-11-01', weekPrinciple: P.id }, new Date(2026, 10, 2, 0, 30)).evenings![0]).toMatchObject({ day: '2026-11-01', weekPrinciple: P.id })
})
test('withEvening: growthField nur mit Satz und vorhandenem Feld', () => {
  const save = (input: Partial<EveningInput>) => withEvening(base, { day: '2026-10-29', ...input }, new Date(2026, 9, 29, 21)).evenings![0]
  expect(save({ better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id })).toMatchObject({ growthField: F.id })
  for (const input of [{ better: '  ', growthField: F.id }, { better: 'x', growthField: P.id }, { better: 'x', growthField: null }]) expect(save(input)).not.toHaveProperty('growthField')
})
```

`tests/unit/stats-backup.test.ts` (ans Ende):

```ts
const merged = (mine: AppData, theirs: object) => { const r = mergeBackup(mine, JSON.stringify(theirs)); if ('error' in r) throw new Error(r.error); return r }
test('Sammlung im Backup: Export enthält collection, ohne Einträge fehlt das Feld', () => {
  expect(JSON.parse(serializeBackup({ ...emptyData(), collection: [P] })).collection).toEqual([P])
  expect(JSON.parse(serializeBackup(emptyData()))).not.toHaveProperty('collection')
})
test('Sammlung im Backup: Gerät bleibt, Datei in ihrer Reihenfolge hinten, das Gerät gewinnt; gleicher Text nur bei Erkenntnissen übersprungen; nichts zählt', () => {
  const mine: AppData = { ...emptyData(), collection: [{ ...P, text: 'Mehrweg statt Einweg im Alltag' }, E] }
  const file = { ...JSON.parse(serializeBackup(emptyData())), collection: [{ ...E, id: hex(7), text: 'wer im Schach früh die Mitte besetzt,  hat mehr Möglichkeiten.' }, F, P, { ...P, id: hex(8) }] }
  const r = merged(mine, file)
  expect(r.data.collection!.map((i) => i.id)).toEqual([P.id, E.id, F.id, hex(8)])
  expect(r.data.collection![0].text).toBe('Mehrweg statt Einweg im Alltag')
  expect(Object.keys(r)).toEqual(['data', 'added', 'addedEnergy'])
  expect([r.added, r.addedEnergy]).toEqual([0, 0])
})
test('Sammlung im Backup: Gelöschtes kehrt zurück, ein zweiter Import ändert nichts, ein altes Backup lässt die Sammlung stehen', () => {
  const file = JSON.parse(serializeBackup({ ...emptyData(), collection: [P, F] }))
  const once = merged({ ...emptyData(), collection: [P] }, file).data
  expect(once.collection).toEqual([P, F])
  expect(merged(once, file).data.collection).toEqual([P, F])
  expect(merged(once, JSON.parse(serializeBackup(emptyData()))).data.collection).toEqual([P, F])
})
test('Sammlung im Backup: Kappung je Art schon beim Zusammenführen; Neuladen verliert nichts', () => {
  const insights = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: hex(from + i), kind: 'erkenntnis' as const, text: `Zeile ${from + i}` }))
  const data = merged({ ...emptyData(), collection: insights(1, 590) }, { ...JSON.parse(serializeBackup(emptyData())), collection: [...insights(1001, 20), F] }).data
  expect(data.collection!.filter((i) => i.kind === 'erkenntnis')).toHaveLength(600)
  expect(data.collection!.at(-1)).toEqual(F)
  expect(parseData(JSON.parse(JSON.stringify(data)))!.collection).toEqual(data.collection)
})
test('Logbuch im Backup: weekPrinciple und growthField reisen mit, ein neues Logbuch zählt weiter in addedEnergy', () => {
  const evening = { day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id, weekPrinciple: P.id }
  const r = merged(emptyData(), JSON.parse(serializeBackup({ ...emptyData(), collection: [P, F], evenings: [evening] })))
  expect(r.data.evenings).toEqual([evening])
  expect(r.addedEnergy).toBe(1)
})
```

`tests/browser/stats-store.test.ts` (`vi` dazu importieren):

```ts
test('saveCollectionItem ohne id vergibt eine Kennung nach COLLECTION_ID und speichert; mit id ersetzt es an der Stelle', () => {
  saveCollectionItem({ kind: 'prinzip', text: 'Mehrweg statt Einweg' })
  saveCollectionItem({ kind: 'feld', text: 'Schach lernen' })
  const [p] = stats.data.collection!
  expect(p.id).toMatch(COLLECTION_ID) // echte Zufallsquelle: fängt auch ein ungebundenes crypto.randomUUID
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).collection).toEqual(stats.data.collection)
  saveCollectionItem({ ...p, text: 'Mehrweg statt Einweg im Alltag' })
  expect(stats.data.collection!.map((i) => i.text)).toEqual(['Mehrweg statt Einweg im Alltag', 'Schach lernen'])
})
test('deleteCollectionItem entfernt den Eintrag; ohne Einträge fehlt collection', () => {
  saveCollectionItem({ kind: 'feld', text: 'Schach lernen' })
  deleteCollectionItem(stats.data.collection![0].id)
  expect(stats.data).not.toHaveProperty('collection')
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!)).not.toHaveProperty('collection')
})
test('addInsights: n Einträge mit n Kennungen vorn, Quelle getrimmt und auf 80 gekürzt, ein commit', () => {
  saveCollectionItem({ kind: 'erkenntnis', text: 'Alt' })
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  addInsights(['Eins', 'Zwei', 'Drei'], `  ${'Q'.repeat(90)} `)
  expect(setItem).toHaveBeenCalledTimes(1)
  setItem.mockRestore()
  const list = stats.data.collection!
  expect(list.map((i) => i.text)).toEqual(['Eins', 'Zwei', 'Drei', 'Alt'])
  expect(new Set(list.map((i) => i.id)).size).toBe(4)
  expect(list.slice(0, 3).map((i) => i.source)).toEqual(Array(3).fill('Q'.repeat(80)))
  addInsights(['Vier'], '   ')
  expect(stats.data.collection![0]).not.toHaveProperty('source')
})
test('neue Kennungen meiden Verweise aus evenings und die eben gezogenen derselben Einfügung', () => {
  stats.data = { ...emptyData(), evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: 's-bbbbbbbb' }] } // Verweis eines gelöschten Prinzips
  const uuid = vi.spyOn(crypto, 'randomUUID')
  for (const head of ['bbbbbbbb', 'cccccccc', 'dddddddd', 'dddddddd', 'eeeeeeee']) uuid.mockReturnValueOnce(`${head}-1111-4111-8111-111111111111`)
  saveCollectionItem({ kind: 'prinzip', text: 'Mehrweg statt Einweg' })
  addInsights(['Eins', 'Zwei'], '')
  uuid.mockRestore()
  expect(stats.data.collection!.map((i) => i.id)).toEqual(['s-dddddddd', 's-eeeeeeee', 's-cccccccc'])
})
```

- [ ] **Step 2: Laufen lassen.** `npx vitest run tests/unit/text.test.ts tests/unit/principles-logic.test.ts tests/unit/stats-schema.test.ts tests/unit/stats-persist.test.ts tests/unit/stats-backup.test.ts` und `npx vitest run --project browser tests/browser/stats-store.test.ts`.
  Expected: FAIL, u. a. `Failed to resolve import "../../src/lib/principles/words"` und `withCollectionItem is not a function`.

- [ ] **Step 3: Implementieren.**
  - **`text.ts`:** `clipChars` (samt Kommentar `schema.ts:222–224`) und `clipText` (samt JSDoc `:235–238`) unverändert hierher; `schema.ts` importiert beide aus `'../text'` und exportiert sie mit `export { clipChars, clipText }` weiter (Importe in `persist.ts`, `DominoStep.svelte`, `limited-input.ts` und den Tests bleiben).
  - **`words.ts`:** Werte wie unter Interfaces; `textKey` in dieser Reihenfolge: `normalize('NFC')`, `/\s+/g` → `' '`, `trim()`, `toLowerCase()`.
  - **`collection.ts`:** `parseCollectionItem` prüft Objekt, `COLLECTION_ID`, Art und Text (`clipText` auf die Grenze der Art: `LEITSATZ_MAX`, `FIELD_NAME_MAX`, `INSIGHT_MAX`; leer → `null`) und übernimmt nur die freiwilligen Felder der Art (`prinzip`: `note`/`NOTE_MAX`, `ifThen`/`IF_THEN_MAX`; `feld`: `step`/`STEP_MAX`; `erkenntnis`: `source`/`SOURCE_MAX`), gekürzt mit `clipText`, leer entfällt. `parseCollection`: kein Array → `[]`; je Eintrag in Listenfolge übernehmen, wenn gültig, Kennung noch nicht in der Liste und Art unter `KIND_LOAD_MAX`. `newCollectionId`: Form wie `newCustomPatternId` (`src/lib/breath/custom.ts:46–48`), mit `s-` und aus `random()`; neu gezogen, solange die Kennung in `taken` steht.
  - **`schema.ts`:** `AppData.collection?` hinter `evenings`; `parseData` setzt `collection`, wenn `parseCollection(raw.collection)` nicht leer ist; `parseEvening`: `weekPrinciple` nur, wenn es `COLLECTION_ID` erfüllt und `isSunday(day)` gilt, dann ohne `weekFocus`; `growthField` nur mit gültiger Kennung und gesetztem `better`.
  - **`persist.ts`:** `withCollectionItem`, `withoutCollectionItem`, `withInsights` (jeder Eintrag über `parseCollectionItem`, nur gültige der Art `erkenntnis`; ohne gültige bleibt `data`) nach Spec §4.4 und dem Muster Z. 102–115; `withEvening` (Z. 201–202): gilt `isSunday(day)` (der Logbuch-Tag aus dem Eingang, nie `now`) und steht in `data.collection` ein Eintrag der Art `prinzip` mit der Kennung, bekommt der Eintrag `weekPrinciple` und kein `weekFocus`; mit `better !== ''` und einem Eintrag der Art `feld` bekommt er `growthField`.
  - **`backup.ts`:** `collection` in Destrukturierung und `optional` von `serializeBackup` (hinter `evenings`); `mergeCollection` nach Spec §4.11 Punkt 1–4 (Kennungen und `textKey`s der Erkenntnisse von Gerät und eben Übernommenem merken, Zähler je Art); `mergeBackup` setzt `data.collection`, wenn die Liste nicht leer ist; Kopfkommentare von `serializeBackup` und `mergeBackup` nennen die Sammlung.
  - **`store.svelte.ts`:** internes `takenIds(): Set<string>` (Kennungen von `stats.data.collection` und alle `weekPrinciple`/`growthField` in `stats.data.evenings`); `saveCollectionItem`: `id` oder `newCollectionId(takenIds())`, dann `commit(withCollectionItem(…))`; `deleteCollectionItem`: `commit(withoutCollectionItem(…))`; `addInsights`: je Text `{ id, kind: 'erkenntnis', text, source }` mit einer neuen Kennung (jede kommt sofort in `taken`) und der Quelle, wie sie kommt; Trimmen, Kürzen auf `SOURCE_MAX` und das Weglassen einer leeren Quelle übernimmt `withInsights` über `parseCollectionItem` (keine zweite Kürzung im Store); ein `commit(withInsights(…))`.

- [ ] **Step 4: Laufen lassen.** Dieselben Befehle, dann `npm test` und `npm run check`.
  Expected: PASS, 0 Fehler; die bestehenden Tests (u. a. `stats-backup.test.ts:21–22`, `:29`) bleiben grün.

- [ ] **Step 5: Commit** `feat: Sammlung und neue Logbuch-Felder speichern, prüfen und sichern`.

### Task 2: Logik für Prinzip der Woche, Erkenntnis des Tages, Felder und Einfügen

**Files:**
- Create: `src/lib/principles/logic.ts`
- Modify: `src/lib/evening/logic.ts:37–41` (nur `export` vor `function weekDays`)
- Test: `tests/unit/principles-logic.test.ts`

**Interfaces:**
- Consumes: `CollectionItem` (Task 1), `CollectionKind`, `textKey`, `INSIGHT_MAX`, `PASTE_MAX` (Task 1); `clipChars`, `clipText` (`src/lib/text.ts`); `shiftDay`, `eveningEntry`, `weekDays` (`src/lib/evening/logic.ts`); `dayKey`; Typ `EveningEntry`.
- Produces, `src/lib/evening/logic.ts`: `export function weekDays(day: string): string[]` (sonst unverändert).
- Produces, `logic.ts`:
  - `sameText(items: readonly CollectionItem[], kind: CollectionKind, text: string, original: string): boolean`
  - `insightOfDay(collection: readonly CollectionItem[], now: Date): CollectionItem | null`
  - `type WeekAnchor = { kind: 'prinzip'; item: CollectionItem } | { kind: 'wort'; text: string }`, `weekAnchor(evenings: readonly EveningEntry[], collection: readonly CollectionItem[], now: Date): WeekAnchor | null`
  - `nextWeekPrinciple(evenings: readonly EveningEntry[], now: Date): string | null`
  - `sundayChoices(suggestions: readonly string[], own: readonly string[], principles: readonly CollectionItem[]): { suggestions: string[]; own: string[] }` (nur Einträge der Art `prinzip` zählen)
  - `interface GrowthRow { item: CollectionItem; count: number; last: string | null }`, `growthWeek(collection: readonly CollectionItem[], evenings: readonly EveningEntry[], day: string): GrowthRow[]`, `growthLine(n: number): string`
  - `interface PasteLine { text: string; clipped: boolean }`, `interface PasteResult { lines: PasteLine[]; duplicates: number; clipped: number; overflow: number; truncated: boolean }`, `pasteLines(text: string, existing: readonly CollectionItem[], room: number): PasteResult` (nur Einträge der Art `erkenntnis` in `existing` zählen)

- [ ] **Step 1: Failing tests in `tests/unit/principles-logic.test.ts` ergänzen.** Helfer: `t = (month, day, h, min = 0) => new Date(2026, month - 1, day, h, min)`, `evening = (day, extra = {}) => ({ day, at: `${day}T20:00:00.000Z`, ...extra })`, `item(id, kind, text, extra = {})`, `ins = (n: number) => item(`s-0000000${n}`, 'erkenntnis', `Erkenntnis ${n}`)`, `P` mit Wenn-dann, `D = item('s-0000000d', 'prinzip', 'Dranbleiben')`, `F`, `F2 = item('s-0000000e', 'feld', 'Mehrweg im Alltag', { step: 'Eine Stofftasche einpacken.' })`.

```ts
test('sameText: nur geänderter Text, der bei einem anderen Eintrag derselben Art steht', () => {
  const items = [P, F, item('s-00000010', 'prinzip', 'Mehrweg statt Einweg im Büro')]
  expect(sameText(items, 'prinzip', ' mehrweg  statt EINWEG', '')).toBe(true)
  expect(sameText(items, 'prinzip', 'Mehrweg statt Einweg', 'Mehrweg statt Einweg')).toBe(false) // unverändert, eigener Eintrag
  expect(sameText(items, 'prinzip', 'mehrweg statt einweg', 'Mehrweg statt Einweg')).toBe(false) // nur die Schreibweise
  expect(sameText(items, 'prinzip', 'Mehrweg statt Einweg im Büro', 'Mehrweg statt Einweg')).toBe(true)
  expect(sameText(items, 'feld', 'Mehrweg statt Einweg', '')).toBe(false) // andere Art
  expect(sameText([P, { ...P, id: 's-00000011' }], 'prinzip', P.text, P.text)).toBe(false) // Doppel aus einem Import
})
describe('insightOfDay', () => {
  test('0, 1 und n Erkenntnisse; nur die Art erkenntnis zählt', () => {
    expect(insightOfDay([P, F], t(11, 2, 12))).toBeNull()
    expect([t(11, 2, 12), t(11, 3, 12)].map((d) => insightOfDay([P, ins(1), F], d))).toEqual([ins(1), ins(1)])
  })
  test('das Beispiel aus §4.8, Rang nach Kennung unabhängig von der Listenfolge', () => {
    expect(insightOfDay([ins(2), ins(3), ins(1)], t(11, 2, 12))!.id).toBe('s-00000003') // t = 20 759, p = 2
    expect(insightOfDay([ins(2), ins(3), ins(1)], t(11, 3, 12))!.id).toBe('s-00000001') // p = 0
    expect(insightOfDay([ins(1), ins(2), ins(3)], t(11, 2, 12))!.id).toBe('s-00000003')
  })
  test('gleich um 0:00 und 23:59, auch am 29.03. und 25.10.; Wechsel um Mitternacht', () => {
    const list = [ins(1), ins(2), ins(3)]
    for (const [m, d] of [[11, 2], [3, 29], [10, 25]]) expect(insightOfDay(list, t(m, d, 0, 0))).toEqual(insightOfDay(list, t(m, d, 23, 59)))
    expect(insightOfDay(list, t(11, 3, 0, 0))).not.toEqual(insightOfDay(list, t(11, 2, 23, 59)))
  })
  test('jede genau einmal in n Tagen, auch über die Umstellungen', () => {
    const list = [1, 2, 3, 4, 5].map(ins)
    for (const [m, d] of [[3, 26], [10, 23]]) expect(new Set([0, 1, 2, 3, 4].map((i) => insightOfDay(list, t(m, d + i, 12))!.id)).size).toBe(5)
  })
  test('Anlegen verschiebt, Bearbeiten ändert nur den Text', () => {
    const list = [ins(1), ins(2), ins(3)]
    const today = insightOfDay(list, t(11, 2, 12))!
    expect(insightOfDay(list.map((e) => (e.id === today.id ? { ...e, text: 'Neu' } : e)), t(11, 2, 12))).toEqual({ ...today, text: 'Neu' })
    expect(insightOfDay([ins(4), ...list], t(11, 2, 12))!.id).toBe('s-00000004') // n = 4: 20 759 mod 4 = 3
  })
})
describe('weekAnchor', () => {
  test('Sonntag 1 und 7 Tage zurück gültig, 0 und 8 nicht', () => {
    const list = [evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [P], t(11, 2, 7))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 8, 23, 59))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 1, 21))).toBeNull()
    expect(weekAnchor(list, [P], t(11, 9, 0, 0))).toBeNull()
  })
  test('bei einem Wort dasselbe wie morningReminder(…).weekFocus', () => {
    const list = [evening('2026-10-25', { weekFocus: 'Dranbleiben' }), evening('2026-10-29', { better: 'Morgen zehn Minuten Schachaufgaben lösen.' })]
    for (const now of [t(10, 26, 7), t(11, 1, 7), t(11, 2, 7), t(10, 25, 21)]) {
      const anchor = weekAnchor(list, [], now)
      expect(anchor?.kind === 'wort' ? anchor.text : null).toBe(morningReminder(list, now).weekFocus)
    }
  })
  test('gelöscht oder falsche Art ergibt null, ohne Rückgriff auf ein älteres Wort; Umbenennen folgt', () => {
    // Ein Wort im Fenster (hier ausnahmsweise an einem Samstag), das ein Rückgriff fände
    const list = [evening('2026-10-31', { weekFocus: 'Dranbleiben' }), evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [], t(11, 3, 7))).toBeNull()
    expect(weekAnchor(list, [{ ...P, kind: 'feld' }], t(11, 3, 7))).toBeNull()
    expect(weekAnchor(list, [{ ...P, text: 'Mehrweg statt Einweg im Alltag' }], t(11, 3, 7))).toEqual({ kind: 'prinzip', item: { ...P, text: 'Mehrweg statt Einweg im Alltag' } })
  })
  test('So 21:00 der alte Anker, Mo 0:30 und Mo 4:00 der neue', () => {
    const list = [evening('2026-10-25', { weekFocus: 'Dranbleiben' }), evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [P], t(11, 1, 21))).toEqual({ kind: 'wort', text: 'Dranbleiben' })
    expect(weekAnchor(list, [P], t(11, 2, 0, 30))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 2, 4))).toEqual({ kind: 'prinzip', item: P })
  })
  test('Wahl an den Umstellungssonntagen 29.03. und 25.10.: So 23:59 der alte, Mo 0:00 der neue Anker', () => {
    for (const [m, d] of [[3, 29], [10, 25]]) {
      const day = dayKey(t(m, d, 12))
      const list = [evening(shiftDay(day, -7), { weekFocus: 'Dranbleiben' }), evening(day, { weekPrinciple: P.id })]
      expect(weekAnchor(list, [P], t(m, d, 23, 59))).toEqual({ kind: 'wort', text: 'Dranbleiben' })
      expect(weekAnchor(list, [P], t(m, d + 1, 0, 0))).toEqual({ kind: 'prinzip', item: P })
    }
  })
})
test('nextWeekPrinciple: So 21:00 mit Logbuch des Tages die Kennung, Mo 0:30 null; ebenso an den Umstellungssonntagen um 23:30', () => {
  expect(nextWeekPrinciple([evening('2026-11-01', { weekPrinciple: P.id })], t(11, 1, 21))).toBe(P.id)
  expect(nextWeekPrinciple([evening('2026-11-01', { weekPrinciple: P.id })], t(11, 2, 0, 30))).toBeNull()
  expect(nextWeekPrinciple([evening('2026-11-01', { weekFocus: 'Dranbleiben' })], t(11, 1, 21))).toBeNull()
  for (const [m, d] of [[3, 29], [10, 25]]) {
    const list = [evening(dayKey(t(m, d, 12)), { weekPrinciple: P.id })]
    expect([nextWeekPrinciple(list, t(m, d, 23, 30)), nextWeekPrinciple(list, t(m, d + 1, 0, 30))]).toEqual([P.id, null])
  }
})
test('sundayChoices: Vorschlag und eigenes Wort gleich einem Leitsatz ausgeblendet (Groß und klein, Leerraum, NFC); ohne Prinzipien unverändert', () => {
  const principles = [item('s-00000012', 'prinzip', ' dranbleiben '), item('s-00000013', 'prinzip', 'Ein Schachkurs im Cafe\u0301'), P]
  expect(sundayChoices(FOCUS_SUGGESTIONS, ['Ein Schachkurs im  Caf\u00e9', 'MEHRWEG statt Einweg', 'Schach lernen'], principles))
    .toEqual({ suggestions: FOCUS_SUGGESTIONS.slice(1), own: ['Schach lernen'] })
  expect(sundayChoices(FOCUS_SUGGESTIONS, ['Schach lernen'], [])).toEqual({ suggestions: [...FOCUS_SUGGESTIONS], own: ['Schach lernen'] })
  expect(sundayChoices(FOCUS_SUGGESTIONS, [], [item('s-00000014', 'feld', 'Dranbleiben')]).suggestions).toEqual([...FOCUS_SUGGESTIONS])
})
describe('growthWeek und growthLine', () => {
  test('Fenster des Logbuch-Tags, unbekannte und fremde Kennungen übergangen, „Zuletzt“ der jüngste Satz, Reihenfolge der Sammlung', () => {
    const list = [
      evening('2026-10-26', { better: 'Zu alt', growthField: F.id }),
      evening('2026-10-27', { better: 'Morgen eine Eröffnung üben.', growthField: F.id }),
      evening('2026-10-30', { better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id }),
      evening('2026-10-31', { better: 'Falsche Art', growthField: P.id }),
      evening('2026-11-01', { better: 'Eine Stofftasche einpacken.', growthField: F2.id }),
      evening('2026-11-02', { better: 'Unbekannt', growthField: 's-000000ff' }),
    ]
    expect(growthWeek([F2, P, F], list, '2026-11-02')).toEqual([
      { item: F2, count: 1, last: 'Eine Stofftasche einpacken.' },
      { item: F, count: 2, last: 'Morgen zehn Minuten Schachaufgaben lösen.' },
    ])
  })
  test('n = 0', () => expect(growthWeek([F], [], '2026-11-02')).toEqual([{ item: F, count: 0, last: null }]))
  test('3:59 gehört zum Vortag, 4:00 zum neuen Tag, über die Zeitumstellung', () => {
    const list = [evening('2026-10-19', { better: 'Morgen eine Eröffnung üben.', growthField: F.id })]
    expect(growthWeek([F], list, logbookDay(t(10, 26, 3, 59)))[0].count).toBe(1) // Fenster 19.–25.10.
    expect(growthWeek([F], list, logbookDay(t(10, 26, 4, 0)))[0].count).toBe(0) // Fenster 20.–26.10.
  })
  test('zweiter Durchgang am selben Tag: ersetzt, der Tag zählt einmal', () => {
    const list = [{ ...evening('2026-11-01', { better: 'A', growthField: F.id }), at: '2026-11-01T19:00:00.000Z' }, { ...evening('2026-11-01', { better: 'B', growthField: F2.id }), at: '2026-11-01T21:00:00.000Z' }]
    expect(growthWeek([F, F2], list, '2026-11-01')).toEqual([{ item: F, count: 0, last: null }, { item: F2, count: 1, last: 'B' }])
  })
  test('growthLine', () => expect(growthLine(2)).toBe('Vorgenommen an 2 der letzten 7 Tage'))
})
describe('pasteLines', () => {
  const texts = (r: PasteResult) => r.lines.map((l) => l.text)
  const EMPTY = { lines: [], duplicates: 0, clipped: 0, overflow: 0, truncated: false }
  const NOTES = ['- Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', '- [ ] Morgens zuerst ein Glas Wasser trinken.', '-5 Grad am Morgen, trotzdem eine Runde gehen.', '1.', '', '---', '• Pausen helfen beim Lernen.', 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', 'Heute lerne ich etwas Neues. '.repeat(20)].join('\n')
  test('Zeilenwechsel CR LF, CR, LF, U+2028, U+2029', () => {
    expect(texts(pasteLines('Eins\r\nZwei\rDrei\nVier\u2028Fünf\u2029Sechs', [], 300))).toEqual(['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'])
  })
  test('U+FEFF, U+200B, U+2060 entfernt, ein Emoji mit U+200D bleibt ganz; Tab und geschütztes Leerzeichen', () => {
    const coder = '👩\u200d💻'
    expect(texts(pasteLines(`\ufeffSchach\u200b lernen\u2060\n${coder} Abends eine Eröffnung nachspielen.\nMehrweg\tstatt\u00a0 Einweg `, [], 300)))
      .toEqual(['Schach lernen', `${coder} Abends eine Eröffnung nachspielen.`, 'Mehrweg statt Einweg'])
  })
  test('jedes Listenzeichen höchstens einmal, die eindeutigen mit und ohne Leerraum; Nummern bis drei Ziffern; Kästchen', () => {
    const unique = ['•', '▪', '◦', '‣', '☐', '☑', '☒', '✓', '✔'].flatMap((mark, i) => [`${mark}Ohne ${i + 1}`, `${mark} Mit ${i + 1}`])
    const kept = ['–Strich ohne Leerraum', '—Strich ohne Leerraum', '1234. Jahr'] // brauchen Leerraum bzw. höchstens drei Ziffern
    const lines = ['- Eins', '– Zwei', '— Drei', '* Vier', '> Fünf', '1. Sechs', '12) Sieben', '123. Acht', ...unique, '- [ ] Siebzehn', '* [x] Achtzehn', '[X] Neunzehn', '- - Zwanzig', ...kept]
    expect(texts(pasteLines(lines.join('\n'), [], 300))).toEqual(['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', ...unique.map((line) => line.slice(1).trim()), 'Siebzehn', 'Achtzehn', 'Neunzehn', '- Zwanzig', ...kept])
  })
  test('ohne Leerraum danach bleiben -5, *Wichtig* und >3; ein Datum wird als Nummer gelesen', () => {
    expect(texts(pasteLines('-5 Grad am Morgen\n*Wichtig* ist der erste Zug\n>3 Tage Pause\n3. Oktober Schachturnier', [], 300)))
      .toEqual(['-5 Grad am Morgen', '*Wichtig* ist der erste Zug', '>3 Tage Pause', 'Oktober Schachturnier'])
  })
  test('Leerzeilen, Trennlinien, leere Aufzählungen und „1.“ oder „2)“ allein entfallen; leerer Text', () => {
    expect(pasteLines('\n   \n---\n***\n___\n-\n- [ ]\n1.\n2)\n☐', [], 300)).toEqual(EMPTY)
    expect(pasteLines('', [], 300)).toEqual(EMPTY)
  })
  test('Kürzen auf 500, ohne ein Ersatzpaar am Schnitt zu zerreißen', () => {
    expect(pasteLines(`${'a'.repeat(499)}😀😀`, [], 300)).toEqual({ ...EMPTY, lines: [{ text: `${'a'.repeat(499)}😀`, clipped: true }], clipped: 1 })
  })
  test('Doppelte in sich und gegen den Bestand; nur Erkenntnisse sind Bestand', () => {
    const r = pasteLines('- wer im Schach früh die Mitte besetzt,  hat mehr Möglichkeiten.\nMehrweg statt Einweg\n* mehrweg statt einweg', [E, P], 300)
    expect([texts(r), r.duplicates]).toEqual([['Mehrweg statt Einweg'], 2])
  })
  test('Platz und Überlauf; gekürzt zählt nur unter lines', () => {
    expect(pasteLines('Zeile 1\nZeile 2\nZeile 3', [], 1)).toEqual({ ...EMPTY, lines: [{ text: 'Zeile 1', clipped: false }], overflow: 2 })
    expect(pasteLines(NOTES, [], 3)).toMatchObject({ duplicates: 1, clipped: 0, overflow: 2 })
  })
  test('mehr als 50 000 Zeichen: die ersten 50 000, truncated', () => {
    const r = pasteLines(`Zeile 1\n${'x'.repeat(50_000)}`, [], 300)
    expect([r.truncated, r.lines.map((l) => Array.from(l.text).length)]).toEqual([true, [7, 500]])
    expect(pasteLines('x'.repeat(50_000), [], 300).truncated).toBe(false)
  })
  test('alle Zählwerte am Einfügetext aus E2E 3', () => {
    expect(pasteLines(NOTES, [], 300)).toEqual({
      lines: [
        { text: 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', clipped: false },
        { text: 'Morgens zuerst ein Glas Wasser trinken.', clipped: false },
        { text: '-5 Grad am Morgen, trotzdem eine Runde gehen.', clipped: false },
        { text: 'Pausen helfen beim Lernen.', clipped: false },
        { text: `${'Heute lerne ich etwas Neues. '.repeat(17)}Heute l`, clipped: true },
      ],
      duplicates: 1, clipped: 1, overflow: 0, truncated: false,
    })
  })
})
```

- [ ] **Step 2: Laufen lassen.** `npx vitest run tests/unit/principles-logic.test.ts tests/unit/evening-logic.test.ts`.
  Expected: FAIL mit `Failed to resolve import "../../src/lib/principles/logic"`.

- [ ] **Step 3: Implementieren** in `src/lib/principles/logic.ts` (Kopfkommentar „Spec M12 §4.1, §4.7–§4.10“), `weekDays` exportieren.
  - `sameText`: wahr, wenn `textKey(text) !== textKey(original)` und ein Eintrag der Art `kind` denselben `textKey` hat.
  - `insightOfDay` nach Spec §4.8: Erkenntnisse aufsteigend nach `id` mit `<`; `t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000`; Stelle `((t % n) + n) % n`.
  - `weekAnchor`: über `weekDays(shiftDay(dayKey(now), -1))` vom jüngsten Tag rückwärts je Tag `eveningEntry`; das erste Logbuch mit `weekPrinciple` oder `weekFocus` entscheidet: `weekPrinciple` → Eintrag mit dieser Kennung und Art `prinzip`, sonst `null`; `weekFocus` → `{ kind: 'wort', text }`.
  - `nextWeekPrinciple` nach Spec §4.7: `weekPrinciple` des Logbuchs von `dayKey(now)` (über `eveningEntry`), sonst `null`.
  - `sundayChoices`: beide Listen ohne Einträge, deren `textKey` dem eines Leitsatzes gleicht.
  - `growthWeek`: je Feld in Sammlungsfolge über `weekDays(day)` mit `eveningEntry` je Tag zählen; `last` ist `better` des jüngsten Treffers. `growthLine(n)` → `` `Vorgenommen an ${n} der letzten 7 Tage` ``.
  - `pasteLines` in der Reihenfolge von Spec §4.10 (1 kürzen auf `PASTE_MAX` mit `clipChars`, 2 trennen, 3 bereinigen, 4 Listenzeichen, 5 Leeres weg, 6 `clipText` auf `INSIGHT_MAX`, 7 Doppelte, 8 Platz) mit genau diesen Ausdrücken:

```ts
const LINE_BREAK = /\r\n|\r|\n|\u2028|\u2029/
const INVISIBLE = /[\ufeff\u200b\u2060]/g // vor dem Zusammenfassen des Leerraums entfernen
const LIST_MARK = /^(?:(?:[-–—*>]|\d{1,3}[.)])\s+|[•▪◦‣☐☑☒✓✔]\s*)?(?:\[[ xX]\](?:\s+|$))?/
const HAS_CONTENT = /[\p{L}\p{N}]/u
const NUMBER_ONLY = /^\d{1,3}[.)]$/
```

- [ ] **Step 4: Laufen lassen.** Dieselben Tests, `npm run check`. Expected: PASS, 0 Fehler.

- [ ] **Step 5: Commit** `feat: Logik für Prinzip der Woche, Erkenntnis des Tages, Wachstumsfelder und Einfügen`.

### Task 3: Bausteine: Blatt mit Neu-Sperre, Chips mit Umbruch, Wortwahl mit Prinzipien

**Files:**
- Modify:
  - `src/components/Sheet.svelte:8`, `:15`
  - `src/components/ChoiceGroup.svelte:17–42`, `:72–82`
  - `src/components/flow/WordPicker.svelte:11–38`, `:50–53`, `:62–88`, `:91–118`
- Create:
  - `tests/browser/harness/SheetHarness.svelte`, `tests/browser/sheet.test.ts`
  - `tests/browser/choice-group.test.ts`
  - `tests/browser/harness/WordPickerHarness.svelte`, `tests/browser/word-picker.test.ts`

**Interfaces:**
- Consumes: `tapArming` (`src/lib/ui/arming.svelte.ts:14`), `limitedInput`.
- Produces:
  - `Sheet.svelte`: neue optionale Prop `rearm?: () => unknown`; ohne sie wie bisher.
  - `ChoiceGroup.svelte`: Props unverändert (`T` darf `string | null` sein); eine Taste auf die gewählte Option ruft `onSelect` nicht.
  - `WordPicker.svelte`: neue optionale Props `refLabel?: string`, `refs?: readonly { id: string; text: string }[]`, `refValue?: string | null`, `onRef?: (id: string | null) => void`.

- [ ] **Step 1: Failing tests schreiben.**
  - `SheetHarness.svelte`: hält `let phase = $state(0)`, `export function next(): void { phase++ }`, zeichnet `<Sheet title="Test-Blatt" rearm={() => phase} {onClose}><p>Inhalt</p></Sheet>` (Prop `onClose`).
  - `WordPickerHarness.svelte` (Muster `TagPickerHarness.svelte`): Props `words`, `own = []`, `refs?`; Zustand `value = $state('')`, `refValue = $state<string | null>(null)`; `export function current() { return { value, refValue } }`; zeichnet `WordPicker` mit `label="Vorschläge"`, `ownLabel="Deine Wörter"`, `fieldLabel="Eigenes Wort"`, `placeholder="oder eigenes Wort"`, `max={40}`, `capitalize="sentences"`, `onChange={(v) => { value = v; refValue = null }}` und nur bei `refs !== undefined` zusätzlich `refLabel="Deine Prinzipien"`, `{refs}`, `{refValue}`, `onRef={(id) => { refValue = id; value = '' }}` (sonst ohne diese Props, per `{#if}`).

```ts
// tests/browser/sheet.test.ts (wait(ms) = new Promise((r) => setTimeout(r, ms)); open() mountet SheetHarness mit onClose = vi.fn()
// und ruft flushSync(); instance ist der Rückgabewert von mount, mit next())
test('Danebentippen ist kurz nach dem Öffnen und nach jedem Wechsel von rearm gesperrt', async () => {
  open()
  const backdrop = () => document.querySelector<HTMLButtonElement>('.backdrop')!
  expect(backdrop().disabled).toBe(true)
  await wait(450)
  expect(backdrop().disabled).toBe(false)
  instance.next(); flushSync()
  expect(backdrop().disabled).toBe(true)
  await wait(450)
  backdrop().click()
  expect(onClose).toHaveBeenCalledTimes(1)
})

// tests/browser/choice-group.test.ts (mountet ChoiceGroup direkt; keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
test('eine Pfeiltaste auf die gewählte Option bewegt nur den Fokus', () => {
  show([{ value: 's-0000000b', label: 'Schach lernen' }], 's-0000000b')
  radios()[0].focus(); radios()[0].dispatchEvent(keydown('ArrowRight'))
  expect(onSelect).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(radios()[0])
})
test('ohne Wahl ist die erste Option erreichbar; eine Pfeiltaste auf eine andere wählt sie', () => {
  show([{ value: 'a', label: 'Schach lernen' }, { value: 'b', label: 'Mehrweg im Alltag' }], null)
  expect(radios().map((r) => r.tabIndex)).toEqual([0, -1])
  radios()[0].dispatchEvent(keydown('ArrowRight'))
  expect(onSelect).toHaveBeenCalledWith('b')
})
test('ein langes Wort ohne Leerzeichen bricht im Chip um; ein einzeiliger Chip bleibt 48 px hoch', () => {
  show([{ value: 'a', label: 'x'.repeat(40) }, { value: 'b', label: 'Kurz' }], null, '200px') // Breite des Behälters
  const [long, short] = radios()
  expect(long.getBoundingClientRect().width).toBeLessThanOrEqual(200)
  expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth)
  expect(short.getBoundingClientRect().height).toBe(48)
})

// tests/browser/word-picker.test.ts (groups() = Namen aller [role=radiogroup], aus aria-label oder dem Text des aria-labelledby-Ziels;
// labels() = sichtbare Beschriftungen (.own-label); radio(name); checked() = Texte aller aria-checked="true"; radiosOf(gruppe) = ihre Radios,
// radiosIn(gruppe) = deren Texte; field() = Feld „Eigenes Wort“; type(text) wie tag-picker.test.ts:30–37, danach immer flushSync(), bevor
// das Feld programmatisch geändert und geprüft wird (sonst sieht der Effekt von value={typed} nur '' → '', und set_value lässt den Text stehen);
// keydown(key) wie oben;
// unmountAll() baut alle Prüfstände ab)
const REFS = [{ id: 's-0000000a', text: 'Mehrweg statt Einweg' }, { id: 's-0000000f', text: 'Schach im Park' }]
test('ohne refs: Vorschläge ohne sichtbare Beschriftung, Verhalten wie bisher', () => {
  show({ words: ['Dranbleiben', 'Mehr Schlaf'], own: ['Schach lernen'] })
  expect([groups(), labels()]).toEqual([['Vorschläge', 'Deine Wörter'], ['Deine Wörter']])
  radio('Dranbleiben').click(); expect(current().value).toBe('Dranbleiben')
  radio('Dranbleiben').click(); expect(current().value).toBe('')
})
test('refs: [] ergibt dasselbe DOM wie ohne refs', () => {
  expect(html({ words: ['Dranbleiben'], own: ['Schach lernen'], refs: [] })).toBe(html({ words: ['Dranbleiben'], own: ['Schach lernen'] }))
  // html(props): mountet, liest innerHTML, ersetzt das Präfix aus $props.id() (id des Felds ohne „-field“) durch „#“
})
test('mit refs: „Deine Prinzipien“ zuerst in der Reihenfolge von refs, „Vorschläge“ sichtbar beschriftet', () => {
  show({ words: ['Dranbleiben'], own: ['Schach lernen'], refs: REFS })
  expect([groups(), labels()]).toEqual([['Deine Prinzipien', 'Vorschläge', 'Deine Wörter'], ['Deine Prinzipien', 'Vorschläge', 'Deine Wörter']])
  expect(radiosIn('Deine Prinzipien')).toEqual(['Mehrweg statt Einweg', 'Schach im Park'])
})
test('genau eine Wahl über alle Gruppen; ein Tipp auf ein Prinzip leert das Feld, ein zweiter nimmt zurück; ein getipptes Wort bleibt ein Wort', () => {
  show({ words: ['Dranbleiben'], refs: REFS })
  type('Mehrweg statt Einweg'); flushSync()
  expect([current(), checked()]).toEqual([{ value: 'Mehrweg statt Einweg', refValue: null }, []])
  radio('Mehrweg statt Einweg').click(); flushSync()
  expect([current(), field().value, checked()]).toEqual([{ value: '', refValue: 's-0000000a' }, '', ['Mehrweg statt Einweg']])
  radio('Dranbleiben').click(); flushSync()
  expect([current(), checked()]).toEqual([{ value: 'Dranbleiben', refValue: null }, ['Dranbleiben']])
  radio('Schach im Park').click(); radio('Schach im Park').click(); flushSync()
  expect([current().refValue, checked()]).toEqual([null, []])
})
test('Pfeiltasten je Gruppe; auf das gewählte Prinzip bewegen sie nur den Fokus', () => {
  show({ words: ['Dranbleiben'], refs: REFS })
  radio('Mehrweg statt Einweg').click(); flushSync()
  radio('Mehrweg statt Einweg').dispatchEvent(keydown('ArrowRight')); flushSync()
  expect([current().refValue, document.activeElement]).toEqual(['s-0000000f', radio('Schach im Park')])
  unmountAll(); show({ words: ['Dranbleiben'], refs: [REFS[0]] })
  radio('Mehrweg statt Einweg').click(); radio('Mehrweg statt Einweg').dispatchEvent(keydown('ArrowRight')); flushSync()
  expect(current().refValue).toBe('s-0000000a')
})
test('zwei gleiche Leitsätze und 13 refs (wie nach einem Import): alle da, ohne Fehler, nur der getippte gewählt', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `s-${(i + 1).toString(16).padStart(8, '0')}`, text: i < 2 ? 'Mehrweg statt Einweg' : `Prinzip ${i + 1}` }))
  show({ words: ['Dranbleiben'], refs: many })
  expect(radiosIn('Deine Prinzipien')).toHaveLength(13)
  radiosOf('Deine Prinzipien')[1].click(); flushSync()
  expect(current().refValue).toBe('s-00000002')
  expect(radiosOf('Deine Prinzipien').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', ...Array(11).fill('false')])
})
test('ohne Vorschläge fehlt deren Gruppe samt Beschriftung', () => {
  show({ words: [], refs: REFS })
  expect([groups(), labels()]).toEqual([['Deine Prinzipien'], ['Deine Prinzipien']])
})
```

- [ ] **Step 2: Laufen lassen.** `npx vitest run --project browser tests/browser/sheet.test.ts tests/browser/choice-group.test.ts tests/browser/word-picker.test.ts`.
  Expected: FAIL (Danebentippen bleibt nach `next()` frei; Pfeiltaste ruft `onSelect('s-0000000b')`; der lange Chip läuft über; Gruppe „Deine Prinzipien“ fehlt).

- [ ] **Step 3: Implementieren.**
  - **`Sheet.svelte`:** Prop `rearm?: () => unknown`; `const arming = tapArming(() => rearm?.())` (liest die Prop bei jedem Lauf neu).
  - **`ChoiceGroup.svelte`:** in `onKeydown` `onSelect(options[next].value)` nur, wenn `options[next].value !== value`, der Fokus wandert immer (wie `WordPicker.svelte:86`); Knopf-Stil: `padding: 8px var(--choice-padding, 16px)`, `line-height: 1.25`, `overflow-wrap: anywhere` (so bleibt ein einzeiliger Chip auch bei 130 % genau 48 px hoch, `atmen.spec.ts:361`).
  - **`WordPicker.svelte`:** Props wie unter Interfaces; `pickRef(id)`: `typed = ''`, dann `onRef?.(id === refValue ? null : id)`. Das Snippet wird `group(items: readonly { key: string; text: string }[], selected: string | null, choose: (key: string) => void, labelAttrs)`, geschlüsselt nach `item.key`, `checked = selected === item.key`, `tabindex` wie Z. 99 mit `selected`; die Tastatur arbeitet auf `items` und ruft `choose(items[next].key)` nur bei `items[next].key !== selected`. Wörter: `key = text = Wort`, `selected = picked`, `choose = pick`; Prinzipien: `key = id`, `selected = refValue ?? null`, `choose = pickRef`. Markup: mit nicht leerem `refs` zuerst `.own` mit `<p class="own-label" id="{id}-refs">{refLabel}</p>` und der Gruppe (`aria-labelledby`); Vorschläge nur mit `words.length > 0`, mit Prinzipien als `.own` mit `<p class="own-label" id="{id}-words">{label}</p>` (`aria-labelledby`), sonst wie bisher mit `aria-label={label}`; „Deine Wörter“ und Feld unverändert.

- [ ] **Step 4: Laufen lassen.** Dieselben Tests, `npm test`, `npm run check`, dazu `npx playwright test tests/e2e/atmen.spec.ts tests/e2e/energie.spec.ts tests/e2e/morgen.spec.ts tests/e2e/abend.spec.ts tests/e2e/timer.spec.ts tests/e2e/tageszeit.spec.ts` (Port 4173 frei; `ChoiceGroup` steht auch in `TimerSetup.svelte:65`, `:86`).
  Expected: PASS, 0 Fehler; die Bestandstests unverändert grün.

- [ ] **Step 5: Commit** `feat: Bausteine für Prinzipien: Blatt mit Neu-Sperre, Chips mit Umbruch, Wortwahl mit Prinzipien`.

### Task 4: Karte „Deine Prinzipien“, Sammlung und Editor

**Files:**
- Create:
  - `src/components/principles/PrinciplesCard.svelte`, `src/components/principles/CollectionSheet.svelte`, `src/components/principles/ItemEditor.svelte`
  - `tests/browser/collection-sheet.test.ts`, `tests/e2e/prinzipien.spec.ts` (Tests 1 und 2; Abweichung vom vorgegebenen Schnitt: den Doppeltipp auf „… übernehmen“ bekommt Test 2 erst in Task 5, weil `PasteSheet` dort entsteht)
- Modify:
  - `src/screens/Energie.svelte:1–11`, `:28–31`
  - `tests/e2e/taps.ts` (neuer Helfer `alignOverSheet` am Ende)
  - `tests/e2e/energie.spec.ts:952`, `:955`

**Interfaces:**
- Consumes: Task 1 (`CollectionItem`, `CollectionKind`, `KIND_MAX`, die Längen, `saveCollectionItem`, `deleteCollectionItem`, `stats`), Task 2 (`sameText`, `insightOfDay`, `weekAnchor`, `nextWeekPrinciple`), Task 3 (`Sheet` mit `rearm`); `ConfirmDialog`, `Motiv`, `limitedInput`, `tapArming`, `appNow`.
- Produces:
  - `PrinciplesCard.svelte`, Props `open: boolean`, `onOpen: () => void`.
  - `CollectionSheet.svelte`, Prop `onClose: () => void`; Zustand `editing: { kind: CollectionKind; item: CollectionItem | null } | null`, `status: string`, Fokusziel `returnTo: { el: HTMLElement; kind: CollectionKind } | null`; Funktion `restoreFocus(): Promise<void>` (Task 5 nutzt sie).
  - `ItemEditor.svelte`, Props `kind: CollectionKind`, `item: CollectionItem | null` (`null` = neu), `onClose: () => void`.
  - `tests/e2e/taps.ts`: `alignOverSheet(page: Page, dialog: Locator, button: Locator, under: Locator): Promise<void>`.
  - `tests/e2e/prinzipien.spec.ts`: Helfer für Task 5–8 (unten).

- [ ] **Step 1: Failing tests schreiben.**

`tests/browser/collection-sheet.test.ts` (Helfer: `armed()` = 450 ms warten; `show(data)` setzt `stats.data`, mountet `CollectionSheet` mit `onClose = vi.fn()`; `dialog(name)` sucht `[role=dialog]` nach dem Text seines `aria-labelledby`-Ziels; `button(scope, name)` nach `aria-label` oder Text; beide geben ohne Treffer `null` zurück (`?? null`, denn `.find()` allein ergäbe `undefined`, und `toBeNull()` schlüge fehl); `lastBackdrop()` ist das letzte `button.backdrop` (das Danebentippen des obersten Blatts); `section(title)` ist der Abschnitt mit dieser h3; `fill(field, text)` wie `tag-picker.test.ts:30–37`; `setClock(at)` wie `evening-ui.test.ts:15–19`; `remount()` baut das Blatt ab; `hex`, `P`, `D`, `F`, `F2`, `E` wie in Task 1 und 2; `beforeEach` setzt `history.replaceState(null, '')` und `stats.saveFailed = false`, `afterEach` stellt die Uhr zurück):

```ts
test('drei Abschnitte mit Satz und Knopf; die Statuszeile steht leer bei den Erkenntnissen', () => {
  show({})
  expect([...dialog('Deine Sammlung')!.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Prinzipien', 'Wachstumsfelder', 'Erkenntnisse'])
  expect(dialog('Deine Sammlung')!.textContent).toContain('Alles hier bleibt auf diesem Gerät und in deinem Backup.')
  expect(section('Prinzipien').textContent).toContain('Kurze Leitsätze, die dir Richtung geben, gern mit Wenn-dann. Sonntags kannst du eines als Prinzip der Woche wählen.')
  expect(section('Erkenntnisse').querySelector('[role="status"]')!.textContent).toBe('')
})
test('scheitert das Speichern, steht der Hinweis wörtlich im Blatt (role=alert)', () => {
  show({}); stats.saveFailed = true; flushSync()
  expect(dialog('Deine Sammlung')!.querySelector('[role="alert"]')!.textContent!.trim()).toBe('Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.')
})
test('ein drittes Feld anlegen: danach „Höchstens 3 Wachstumsfelder.“ statt des Knopfs, der Fokus auf der h3', async () => {
  show({ collection: [F, F2] }); await armed()
  button(section('Wachstumsfelder'), 'Neues Wachstumsfeld')!.click(); flushSync()
  const editor = dialog('Neues Wachstumsfeld')!
  expect(document.activeElement!.textContent).toBe('Neues Wachstumsfeld') // Überschrift, kein Feld
  fill(editor.querySelector('input')!, 'Schach üben'); flushSync(); await armed()
  button(editor, 'Speichern')!.click(); flushSync(); await tick()
  expect(dialog('Neues Wachstumsfeld')).toBeNull()
  expect(section('Wachstumsfelder').textContent).toContain('Höchstens 3 Wachstumsfelder.')
  expect(button(section('Wachstumsfelder'), 'Neues Wachstumsfeld')).toBeNull()
  expect(document.activeElement).toBe(section('Wachstumsfelder').querySelector('h3'))
})
test('mit 13 Prinzipien (wie nach einem Import) alle 13 Zeilen und „Höchstens 12 Prinzipien.“', () => {
  show({ collection: Array.from({ length: 13 }, (_, i) => ({ id: hex(i + 1), kind: 'prinzip' as const, text: `Prinzip ${i + 1}` })) })
  expect(section('Prinzipien').querySelectorAll('li button')).toHaveLength(13)
  expect(section('Prinzipien').textContent).toContain('Höchstens 12 Prinzipien.')
  expect(button(section('Prinzipien'), 'Neues Prinzip')).toBeNull()
})
test('Zeilen heißen „{Text} bearbeiten“, die leise Zeile ist ihre Beschreibung', () => {
  show({ collection: [P, { id: hex(16), kind: 'prinzip' as const, text: 'Mehrweg statt Einweg im Büro', note: 'Dann fällt im Büro weniger Müll an.' }, F, E] })
  const describedBy = (name: string) => document.getElementById(button(dialog('Deine Sammlung')!, name)!.getAttribute('aria-describedby')!)!.textContent
  expect(describedBy('Mehrweg statt Einweg bearbeiten')).toBe(P.ifThen)
  expect(describedBy('Mehrweg statt Einweg im Büro bearbeiten')).toBe('Dann fällt im Büro weniger Müll an.')
  expect(describedBy('Schach lernen bearbeiten')).toBe('Nächster kleiner Schritt: Jeden Abend eine Eröffnung nachspielen.')
  expect(describedBy(`${E.text} bearbeiten`)).toBe('Quelle: Ein Schachkurs')
})
test('Return im Leitsatz fokussiert den Editor; Escape schließt dann nur ihn, der Fokus geht an die Zeile', async () => {
  show({ collection: [P] }); await armed()
  const row = button(section('Prinzipien'), 'Mehrweg statt Einweg bearbeiten')!
  row.click(); flushSync()
  const editor = dialog('Prinzip bearbeiten')!
  const field = editor.querySelector('input')!
  field.focus(); field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(editor)
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flushSync(); await tick()
  expect([dialog('Prinzip bearbeiten'), dialog('Deine Sammlung') !== null, document.activeElement]).toEqual([null, true, row])
})
test('die Rückfrage nennt den gespeicherten Text und die Zusätze zum Prinzip der Woche', async () => {
  // confirmText(name): Zeile antippen (nach armed), Pflichtfeld auf „Geänderter Entwurf“, armed, „Löschen“, Text der Rückfrage lesen,
  // „Behalten“, prüfen: Fokus auf „Löschen“ im Editor; dann Escape im Editor und auf das Schließen warten.
  setClock(new Date(2026, 10, 2, 10)) // Montag: P gilt seit gestern
  show({ collection: [P, D, F, E], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }] })
  expect(await confirmText('Mehrweg statt Einweg bearbeiten')).toBe('„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.')
  expect(await confirmText('Schach lernen bearbeiten')).toBe('„Schach lernen“ verschwindet aus deiner Sammlung. Deine Sätze im Logbuch bleiben, nur die Zuordnung entfällt.')
  expect(await confirmText(`${E.text} bearbeiten`)).toBe('Sie verschwindet aus deiner Sammlung.')
  remount(); setClock(new Date(2026, 10, 8, 21)) // Sonntag: P läuft noch, für die neue Woche ist D gewählt
  show({ collection: [P, D], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }, { day: '2026-11-08', at: '2026-11-08T19:00:00.000Z', weekPrinciple: D.id }] })
  expect(await confirmText('Mehrweg statt Einweg bearbeiten')).toBe('„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche.')
  expect(await confirmText('Dranbleiben bearbeiten')).toBe('„Dranbleiben“ verschwindet aus deiner Sammlung. Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.')
})
test('Danebentippen sperrt neu: das des Editors, wenn die Rückfrage schließt; das der Sammlung, wenn der Editor schließt', async () => {
  show({ collection: [P] }); await armed()
  button(section('Prinzipien'), 'Mehrweg statt Einweg bearbeiten')!.click(); flushSync(); await armed()
  const editor = dialog('Prinzip bearbeiten')!
  button(editor, 'Löschen')!.click(); flushSync(); await armed()
  button(document.querySelector<HTMLElement>('[role="alertdialog"]')!, 'Behalten')!.click(); flushSync()
  expect(lastBackdrop().disabled).toBe(true) // das des Editors
  await armed(); editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flushSync()
  expect([dialog('Prinzip bearbeiten'), lastBackdrop().disabled]).toEqual([null, true]) // jetzt das der Sammlung
  await armed(); expect(lastBackdrop().disabled).toBe(false)
})
```

`tests/e2e/taps.ts` (am Ende; der Inhalt ist Testcode, darum hier ganz):

```ts
// Wie `putOver` für eine Rückfrage über einem Blatt von unten: Beide wandern mit der Höhe, und die Knöpfe am Fuß der Rückfrage
// erreichen die am Fuß des Blatts erst, wenn die Rückfrage den Bildschirm fast füllt. Stellt die Höhe auf die der Rückfrage
// plus 40 px, holt `under` im Blatt ins Bild und prüft, dass die Mitte jedes der beiden Knöpfe im anderen liegt; dann trifft
// `doubleTap(page, …, 0.5)` auf den einen mit dem zweiten Tipp den anderen.
export async function alignOverSheet(page: Page, dialog: Locator, button: Locator, under: Locator): Promise<void> {
  const { width } = page.viewportSize()!
  await page.setViewportSize({ width, height: Math.ceil((await dialog.boundingBox())!.height) + 40 })
  await under.scrollIntoViewIfNeeded()
  const [b, u] = [(await button.boundingBox())!, (await under.boundingBox())!]
  for (const [inner, outer] of [[b, u], [u, b]]) {
    const [x, y] = [inner.x + inner.width / 2, inner.y + inner.height / 2]
    expect(x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height, 'die Knöpfe überdecken sich').toBe(true)
  }
}
```

`tests/e2e/prinzipien.spec.ts` (neu). Kopf: Kommentar (Spec M12, Berlin, feste Uhr ohne Programm, nur erfundene Einträge), `test.use({ timezoneId: 'Europe/Berlin' })`. Helfer (Signaturen; Seeds wie `abend.spec.ts:46–52`):
- `at(time: string, day: string): Date` (`+01:00`), `MONDAY = at('10:00:00', '2026-11-02')`, `SETTINGS` wie `abend.spec.ts:14`, `P`, `D`, `F`, `F2`, `E` wie in Task 1 und 2;
- `open(page, now: Date, data?: object, tab = 'Energie')`: `setFixedTime`, Seed `{ version: 1, sessions: [], settings: SETTINGS, ...data }`, `goto('./')`; bei `'Energie'` und `'Ich'` den Reiter wählen und `expect(h1).toHaveText(tab)`, bei `'Heute'` (Startreiter) nur `expect(h1).toBeVisible()`, denn dort ist die h1 die Begrüßung (`Heute.svelte:116`, wie `abend-heute.spec.ts:44–49`);
- `resume(page, now)` wie `abend-heute.spec.ts:51–54`; `settle(page)` = `page.waitForTimeout(600)` (Global Constraints, Tipp-Sperre); `stored(page)`, `depth(page)` wie `abend.spec.ts:17–18`; `nav(page, name)`;
- `card(page)` (`.card` mit h2 „Deine Prinzipien“), `openButton(page)`, `collection(page)` (Dialog „Deine Sammlung“), `editor(page)` (Dialog `/^(Neues Prinzip|Prinzip bearbeiten|Neue Erkenntnis|Erkenntnis bearbeiten|Neues Wachstumsfeld|Wachstumsfeld bearbeiten)$/`), `paste(page)` (Dialog „Notizen einfügen“), `weekCard(page)` (`.card` mit h2 „Deine Woche“), `row(page, text)` (Knopf „{text} bearbeiten“ in der Sammlung);
- `openCollection(page)`: `settle`, Tipp auf „Sammlung öffnen“, Dialog sichtbar, `settle`; `expectNoSideways(page, root: Locator)` wie `abend-heute.spec.ts:56–65`.

Test `'1 Sammlung: Leertexte, anlegen, Doppel, Neuladen, ändern, löschen mit Rückfrage'` (`open(page, MONDAY)` ohne Seed; `save`, `leitsatz`, `remove` sind „Speichern“, das Textfeld „Leitsatz“ und „Löschen“ im Editor, `confirm` der Alertdialog „Prinzip löschen?“):
1. Karte: `expectMotiv(card(page).locator('img'), 'energie-sinn', 56)`, `toContainText('Halte fest, was dich leitet, was du aus Büchern mitnimmst und woran du wachsen willst.')`.
2. `openCollection`, „Neues Prinzip“: `expect(editor(page)).toHaveAccessibleName('Neues Prinzip')`, `toContainText('Kurz und als Richtung, nicht als strenge Regel.')`, `expect(leitsatz).toHaveAttribute('placeholder', 'z. B. Mehrweg statt Einweg')`, `expect(save).toBeDisabled()`.
3. Leitsatz `P.text`: `getByText('20 / 60', { exact: true })` sichtbar, `expect(save).toBeEnabled()`; Wenn-dann `P.ifThen`; „Speichern“ → `expect(row(page, P.text)).toHaveAccessibleDescription(P.ifThen)`.
4. Noch einmal „Neues Prinzip“, Leitsatz `' mehrweg  statt EINWEG '`: „Das steht schon in deiner Sammlung.“ sichtbar, `expect(save).toBeDisabled()`, `expect(leitsatz).toHaveAccessibleDescription(/Das steht schon in deiner Sammlung\./)`, `expect(save).toHaveAccessibleDescription('Das steht schon in deiner Sammlung.')`; Escape schließt den Editor.
5. Neuladen mitten im Editor (Spec §6): Zeile öffnen, Leitsatz „Mehrweg statt Einweg im Alltag“ eintragen, ohne Speichern `page.reload()`, Reiter „Energie“: `expect(collection(page)).toHaveCount(0)`, `expect(editor(page)).toHaveCount(0)`, Karte `toContainText('Hier steht jeden Tag eine deiner Erkenntnisse, sobald du welche festhältst.')`; `(await stored(page)).collection` hat genau einen Eintrag, `toMatchObject({ kind: 'prinzip', text: P.text, ifThen: P.ifThen })`; `openCollection`: `row(page, P.text)` ist da.
6. Zeile öffnen, Leitsatz „Mehrweg statt Einweg im Alltag“, „Speichern“; Zeile öffnen, „Löschen“: `expect(confirm).toContainText('„Mehrweg statt Einweg im Alltag“ verschwindet aus deiner Sammlung.')`; „Behalten“ → `expect(remove).toBeFocused()`; `settle`, „Löschen“, in der Rückfrage „Löschen“ → Editor und Zeile sind weg, `expect(await stored(page)).not.toHaveProperty('collection')`.

Test `'2 Ebenen, Fokus und Doppeltipps'` (zuerst `test.setTimeout(60_000)` mit dem Kommentar „viele Sperren von 600 ms und Doppeltipps, keine Echtzeit“, Muster `atmen.spec.ts:605`; `open(page, MONDAY, { collection: [P] })`; `keep` und `confirmDelete` sind „Behalten“ und „Löschen“ der Rückfrage):
1. `settle`, `doubleTap(page, openButton(page), 0.5)` → Sammlung offen, `expect(editor(page)).toHaveCount(0)`.
2. Zeile öffnen, `page.goBack()` → nur der Editor ist zu, `expect(row(page, P.text)).toBeFocused()`; `settle`, Escape → Sammlung zu, `expect(openButton(page)).toBeFocused()`.
3. `openCollection`, `doubleTap(page, row(page, P.text), 0.5)` → Editor offen, `expect((await stored(page)).collection).toEqual([P])`.
4. Leitsatz „Mehrweg statt Einweg im Alltag“, `settle`, `doubleTap(page, save, 0.5)` über der kurzen Sammlung → Editor zu, Sammlung offen, gespeichert genau ein Eintrag mit diesem Text. (Bei 412 × 839 trifft der zweite Tipp Inhalt der Sammlung, nicht ihre Abdunklung; dass deren Danebentippen neu sperrt, prüft der Browser-Test „Danebentippen sperrt neu …“.)
5. `page.emulateMedia({ reducedMotion: 'reduce' })`; Zeile öffnen, „Löschen“; `alignOverSheet(page, confirm, confirmDelete, remove)`; „Behalten“, `settle`; `doubleTap(page, remove, 0.5)` → `expect(confirm).toBeVisible()`, `collection` hat einen Eintrag. `settle`; `alignOverSheet(page, confirm, keep, save)`; `doubleTap(page, keep, 0.5)` → Rückfrage zu, `expect(editor(page)).toBeVisible()`, Gespeichertes unverändert.
6. `page.setViewportSize({ width: 800, height: 839 })` (die Reiterleiste ragt dann seitlich über das 560 px breite Blatt hinaus), `settle`, `page.touchscreen.tap(8, 831)` → Editor zu, Sammlung offen, h1 weiter „Energie“; `settle`, derselbe Tipp → Sammlung zu.
7. Zurück auf 412 × 839, die Seite per `window.scrollBy` so, dass „Sammlung öffnen“ bei y ≈ 40 über dem Blatt liegt, `openCollection`; zwei `page.touchscreen.tap` auf die Mitte von „Sammlung öffnen“ (150 ms Abstand, danach 500 ms warten): Der erste trifft die Abdunklung und schließt, der zweite öffnet nicht wieder → `expect(collection(page)).toHaveCount(0)`.

`tests/e2e/energie.spec.ts`: Z. 952 bekommt den Titel `'the cards come in this order: morning start, evening logbook, battery, reset, sprint, principles, hacks, week'`; Z. 955 erwartet `['Morgen-Start', 'Tag abschließen', 'Dein Akku', 'Jetzt-Reset', 'Fokus-Sprint', 'Deine Prinzipien', 'Brain Hacks', 'Deine Woche']`.

- [ ] **Step 2: Laufen lassen.** `npx vitest run --project browser tests/browser/collection-sheet.test.ts` und `npx playwright test tests/e2e/prinzipien.spec.ts tests/e2e/energie.spec.ts -g "principles|Sammlung|Ebenen"`.
  Expected: FAIL mit `Failed to resolve import "../../src/components/principles/CollectionSheet.svelte"` bzw. ohne Karte „Deine Prinzipien“.

- [ ] **Step 3: Implementieren.**
  - **`PrinciplesCard.svelte`** (Spec M12 §2.2): `<section class="card" aria-labelledby>` mit `<Motiv id="energie-sinn" size={56} />` und h2 „Deine Prinzipien“; `insight = $derived(insightOfDay(stats.data.collection ?? [], appNow()))`; mit Erkenntnis h3 „Erkenntnis des Tages“, `<p class="insight">` mit dem vollen Text (ohne Kürzung) und leise „Quelle: …“; sonst der passende Satz (mit oder ohne Einträge in `collection`); „Sammlung öffnen“ als `button-line` über die volle Breite, `onclick` ruft `onOpen()` nur bei `arming.armed` (`tapArming(() => open)`); fällt `open` von `true` auf `false`, fokussiert ein `$effect` mit Merkvariable den Knopf nach `tick()` (beim Einhängen nicht).
  - **`CollectionSheet.svelte`** (Spec M12 §2.3, §2.10): Tabelle `SECTIONS` (Art, h3, Knopf, Grenz-Satz, Leer-Satz aus den Global Constraints); `const arming = tapArming(() => editing === null)`; `<Sheet title="Deine Sammlung" rearm={() => editing === null} {onClose}>` mit Satz, `{#if stats.saveFailed}` dem Hinweis (`role=alert`) und je Abschnitt `<section aria-labelledby>`: `<h3 tabindex="-1">`, leer der Satz, unter `KIND_MAX[kind]` der Knopf (`button-line`; die Knöpfe einer Zeile in `.actions` wie `PatternEditor.svelte:135–144`), sonst der Grenz-Satz; bei den Erkenntnissen `<p class="status" role="status">{status}</p>` (`.status:empty` hebt den Abstand auf wie `Ich.svelte:364–366`); dann `<ul role="list">` aller Einträge der Art in Listenfolge (`{#each … (item.id)}`), auch über `KIND_MAX`. Zeile: `<button class="row" aria-label="{item.text} bearbeiten" aria-describedby={…}>` mit Titel, leiser Zeile (Global Constraints) und Stift-SVG (`aria-hidden`, Pfad wie `Atmen.svelte:105–107`), Stil wie `Atmen.svelte:232–284`, mindestens 48 px; der Text einer Erkenntnis höchstens drei Zeilen (`-webkit-line-clamp: 3`). `openEditor(kind, item, el)` nur bei `arming.armed`: `returnTo = { el, kind }`, `editing = { kind, item }`; `closeEditor()`: `editing = null`, `restoreFocus()` = nach `tick()` Fokus auf `returnTo.el`, wenn `isConnected`, sonst auf die h3 von `returnTo.kind`. Hinter dem `Sheet`: `{#if editing}<ItemEditor kind={editing.kind} item={editing.item} onClose={closeEditor} />{/if}`.
  - **`ItemEditor.svelte`** (Spec M12 §2.4): Tabelle `FORMS: Record<CollectionKind, …>` mit Titeln, Zeile und Feldern (Schlüssel `text` | `note` | `ifThen` | `source` | `step`, Beschriftung, Platzhalter, Grenze aus `words.ts`, ein- oder mehrzeilig); `let draft = $state({ text, note, ifThen, source, step })` aus `item` (fehlt → `''`, `// svelte-ignore state_referenced_locally` wie `PatternEditor.svelte:27–29`); einzeilig `<input type="text">`, mehrzeilig `<textarea rows="3">` wie `TextStep.svelte:32–42`, je mit `<label for>`, `use:limitedInput={{ max, onChange, onEnter: focusDialog }}` (`focusDialog` fokussiert `document.activeElement?.closest('[role="dialog"]')`) und Zähler; `duplicate = $derived(sameText(stats.data.collection ?? [], kind, draft.text, item?.text ?? ''))`; „Speichern“ `disabled={draft.text.trim() === '' || duplicate}`, Klick bei `arming.armed`: `saveCollectionItem({ ...(item ? { id: item.id } : {}), kind, ...draft })`, `onClose()`; „Löschen“ bei `arming.armed`: `confirming = true`; „Speichern“ (`class="button"`) und, nur beim Bearbeiten, „Löschen“ (`class="button-line"`) stehen als letzter Block in `<div class="actions">`, „Speichern“ zuerst, Markup und Stil wie `PatternEditor.svelte:77–82`, `:135–144` (`flex-wrap: wrap`, `gap: 10px`, Kinder `flex: 1 1 9rem`); nur so liegt „Behalten“ der Rückfrage über „Speichern“ und ihr „Löschen“ über dem des Editors (`ConfirmDialog.svelte:60–65`, Test 2 Punkt 5); `const arming = tapArming(() => confirming)`; `<Sheet title={…} rearm={() => confirming} {onClose}>`; Rückfrage wie `PatternEditor.svelte:85–94` mit Titel und Text der Art, `onConfirm` nur bei `arming.armed`: `deleteCollectionItem(item.id)`, `onClose()`; `onCancel`: `confirming = false`, nach `tick()` Fokus auf „Löschen“. Der Zusatz für Prinzipien (Spec §4.7), hinter den Satz „„{Leitsatz}“ verschwindet aus deiner Sammlung.“ gehängt:

```ts
const addition = $derived.by(() => {
  if (kind !== 'prinzip' || !item) return ''
  const now = appNow()
  const anchor = weekAnchor(stats.data.evenings ?? [], stats.data.collection ?? [], now)
  const next = nextWeekPrinciple(stats.data.evenings ?? [], now)
  if (anchor?.kind === 'prinzip' && anchor.item.id === item.id)
    return next !== null && next !== item.id ? ' Es ist gerade dein Prinzip der Woche.' : ' Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.'
  return next === item.id ? ' Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.' : ''
})
```

  - **`Energie.svelte`:** `PrinciplesCard` und `CollectionSheet` importieren; `let collection = $state(false)`; `<PrinciplesCard open={collection} onOpen={() => (collection = true)} />` zwischen `<SprintCard />` und `<HackLibrary />`; hinter `</section>` mit Kommentar wie `Atmen.svelte:123`: `{#if collection}<CollectionSheet onClose={() => (collection = false)} />{/if}`.

- [ ] **Step 4: Laufen lassen.** Dieselben Tests, `npm test`, `npm run check`, `npx playwright test tests/e2e/energie.spec.ts tests/e2e/atemmuster.spec.ts`.
  Expected: PASS, 0 Fehler.

- [ ] **Step 5: Commit** `feat: Karte „Deine Prinzipien“ mit Sammlung und Editor`.

### Task 5: Notizen einfügen

**Files:**
- Create: `src/components/principles/PasteSheet.svelte`
- Modify: `src/components/principles/CollectionSheet.svelte` (Knopf „Notizen einfügen“, `pasting`, Statuszeile)
- Test: `tests/browser/collection-sheet.test.ts`, `tests/e2e/prinzipien.spec.ts` (Test 3; Test 2 bekommt am Ende den Doppeltipp auf „… übernehmen“)

**Interfaces:**
- Consumes: `pasteLines`, `PasteResult` (Task 2); `addInsights`, `KIND_MAX`, `SOURCE_MAX`, `stats` (Task 1); `Sheet` mit `rearm` (Task 3); `returnTo`, `restoreFocus`, `status` (Task 4); `openLayer`, `limitedInput`, `tapArming`.
- Produces: `PasteSheet.svelte`, Prop `onClose: (added: number) => void` (`added` = Zahl der übernommenen Erkenntnisse, 0 beim Abbrechen); in `CollectionSheet` `pasting: boolean`.

- [ ] **Step 1: Failing tests schreiben.** `tests/browser/collection-sheet.test.ts` (neue Helfer: `openPaste()` = `armed()`, „Notizen einfügen“ antippen, `armed()`; `notes()`/`source()` sind die beiden Felder des Dialogs „Notizen einfügen“; `setNotes(text)` setzt `value` und löst `input` aus):

```ts
test('mit 299 Erkenntnissen drei neue Zeilen einfügen: „1 neue Erkenntnis“, „2 passen nicht mehr …“, danach die Grenze und der Fokus auf der h3', async () => {
  show({ collection: Array.from({ length: 299 }, (_, i) => ({ id: hex(i + 1), kind: 'erkenntnis' as const, text: `Zeile ${i + 1}` })) })
  await openPaste(); setNotes('Neu 1\nNeu 2\nNeu 3'); flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync()
  const paste = dialog('Notizen einfügen')!
  expect(paste.textContent).toContain('1 neue Erkenntnis')
  expect(paste.textContent).toContain('2 passen nicht mehr (höchstens 300 Erkenntnisse).')
  await armed(); button(paste, '1 Erkenntnis übernehmen')!.click(); flushSync(); await tick()
  expect(dialog('Notizen einfügen')).toBeNull()
  expect(section('Erkenntnisse').textContent).toContain('Höchstens 300 Erkenntnisse.')
  expect([button(section('Erkenntnisse'), 'Neue Erkenntnis'), button(section('Erkenntnisse'), 'Notizen einfügen')]).toEqual([null, null])
  expect(section('Erkenntnisse').querySelector('[role="status"]')!.textContent).toBe('1 Erkenntnis übernommen.')
  expect(document.activeElement).toBe(section('Erkenntnisse').querySelector('h3'))
})
test('Escape, Danebentippen und „Zurück zum Text“ in der Vorschau führen zum Text; Text und Quelle bleiben (Review Focus 1)', async () => {
  show({}); await openPaste(); setNotes('Mehrweg statt Einweg'); fill(source(), 'Ein Schachkurs'); flushSync()
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Mehrweg statt Einweg') // Rohtext nie im Speicher
  const toPreview = async () => { button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync(); await armed() }
  const atText = () => [notes().value, source().value, document.activeElement, stats.data.collection]
  const textView = () => ['Mehrweg statt Einweg', 'Ein Schachkurs', button(dialog('Notizen einfügen')!, 'Vorschau zeigen'), undefined]
  await toPreview()
  dialog('Notizen einfügen')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flushSync(); await tick()
  expect(atText()).toEqual(textView())
  await armed(); await toPreview()
  lastBackdrop().click(); flushSync(); await tick()
  expect(atText()).toEqual(textView())
  await armed(); await toPreview()
  button(dialog('Notizen einfügen')!, 'Zurück zum Text')!.click(); flushSync(); await tick()
  expect(atText()).toEqual(textView())
})
test('Return in „Quelle für alle“ fokussiert das Einfügen; Escape schließt dann nur es, der Fokus geht an „Notizen einfügen“', async () => {
  show({}); await openPaste()
  source().focus(); source().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(dialog('Notizen einfügen'))
  dialog('Notizen einfügen')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flushSync(); await tick()
  expect([dialog('Notizen einfügen'), dialog('Deine Sammlung') !== null, document.activeElement]).toEqual([null, true, button(section('Erkenntnisse'), 'Notizen einfügen')])
})
test('Danebentippen sperrt neu: das des Einfügens bei jedem Wechsel der Ansicht, das der Sammlung, wenn das Einfügen schließt', async () => {
  show({}); await openPaste(); setNotes('Mehrweg statt Einweg'); flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync()
  expect(lastBackdrop().disabled).toBe(true)
  await armed(); button(dialog('Notizen einfügen')!, 'Zurück zum Text')!.click(); flushSync()
  expect(lastBackdrop().disabled).toBe(true)
  await armed(); dialog('Notizen einfügen')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flushSync()
  expect([dialog('Notizen einfügen'), lastBackdrop().disabled]).toEqual([null, true]) // jetzt das der Sammlung
  await armed(); expect(lastBackdrop().disabled).toBe(false)
})
test('ein Tipp auf „… übernehmen“ gleich nach „Vorschau zeigen“ übernimmt nichts (Review Focus 4)', async () => {
  show({}); await openPaste(); setNotes('Pausen helfen beim Lernen.'); flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync()
  button(dialog('Notizen einfügen')!, '1 Erkenntnis übernehmen')!.click(); flushSync()
  expect([stats.data.collection, dialog('Notizen einfügen')!.textContent!.includes('Vorschau')]).toEqual([undefined, true])
  await armed(); button(dialog('Notizen einfügen')!, '1 Erkenntnis übernehmen')!.click(); flushSync()
  expect(stats.data.collection).toHaveLength(1)
})
test('dieselben Notizen noch einmal: „Keine neue Erkenntnis dabei.“ und kein Knopf zum Übernehmen', async () => {
  show({ collection: [E] }); await openPaste(); setNotes(`- ${E.text}`); flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync()
  const paste = dialog('Notizen einfügen')!
  expect(paste.textContent).toContain('Keine neue Erkenntnis dabei.')
  expect(paste.textContent).toContain('1 doppelt oder schon vorhanden, übersprungen.')
  expect([...paste.querySelectorAll('button')].some((b) => b.textContent!.includes('übernehmen'))).toBe(false)
})
test('mehr als 50 000 Zeichen: das Feld kürzt nichts, erst die Vorschau nennt es (Review Focus 5)', async () => {
  const long = `Zeile 1\n${'x'.repeat(50_100)}`
  show({}); await openPaste(); setNotes(long); flushSync()
  expect([notes().value, notes().hasAttribute('maxlength')]).toEqual([long, false])
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click(); flushSync()
  const text = dialog('Notizen einfügen')!.textContent!
  for (const line of ['Der Text ist sehr lang. Verwendet werden die ersten 50 000 Zeichen.', '2 neue Erkenntnisse', '1 gekürzt auf 500 Zeichen.']) expect(text).toContain(line)
})
```

`tests/e2e/prinzipien.spec.ts`, Test `'3 Notizen einfügen: Vorschau, Zurück, Übernehmen, Statuszeile, Erkenntnis des Tages'` (`open(page, MONDAY)`; `NOTES` und die fünf erwarteten Texte `LINES` wie im Unit-Test „alle Zählwerte“ von Task 2; `notes` ist „Deine Notizen“, `show` ist „Vorschau zeigen“):
1. `openCollection`, „Notizen einfügen“: `expect(paste(page)).toContainText('Kopiere Text aus deiner Notiz-App und füge ihn hier ein. Jede Zeile wird eine Erkenntnis. Alles bleibt auf diesem Gerät.')`, `expect(notes).toHaveAttribute('placeholder', 'Eine Erkenntnis pro Zeile')`.
2. `notes.fill(NOTES)`, „Quelle für alle (freiwillig)“ = „Ein Schachkurs“, `show`: h3 „Vorschau“ `toBeFocused()`; sichtbar „5 neue Erkenntnisse“, „1 doppelt oder schon vorhanden, übersprungen.“, „1 gekürzt auf 500 Zeichen.“, „Quelle: Ein Schachkurs“; `paste(page).getByRole('listitem')` hat 5 Einträge, der erste `toHaveText(LINES[0])`, nur der fünfte enthält „gekürzt“.
3. `page.goBack()` → `expect(notes).toHaveValue(NOTES)`, `expect(show).toBeFocused()`.
4. `settle`, `show`, `settle`, „5 Erkenntnisse übernehmen“ → Dialog zu; `collection(page).getByRole('status')` `toHaveText('5 Erkenntnisse übernommen.')`; „Notizen einfügen“ `toBeFocused()`; gespeichert sind die Texte `LINES` in dieser Folge, jeder mit `source: 'Ein Schachkurs'`.
5. Zeile `LINES[0]` öffnen → `toHaveAccessibleName('Erkenntnis bearbeiten')`, Statuszeile `toHaveText('')`; Escape, `expect.poll(() => depth(page)).toBe(1)`; ein einziges `page.goBack()` schließt die Sammlung, `depth` wird 0.
6. Karte: `today = await card(page).locator('.insight').textContent()` ist einer der `LINES`, dazu „Quelle: Ein Schachkurs“; `resume(page, at('10:00:00', '2026-11-03'))` → `.insight` `not.toHaveText(today)`.
7. Neuladen mitten im Einfügen (Spec §6; zuletzt, weil danach alte History-Einträge die Tiefe aus Punkt 5 verschieben): `openCollection`, „Notizen einfügen“, `settle`, `notes.fill('Mehrweg statt Einweg im Büro')`, `show`; sobald die h3 „Vorschau“ den Fokus hat, `page.reload()`, Reiter „Energie“: `expect(collection(page)).toHaveCount(0)`, `expect(paste(page)).toHaveCount(0)`; gespeichert sind weiter genau die Texte `LINES`; `page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))` enthält „Mehrweg statt Einweg im Büro“ nicht.

Test 2 bekommt am Ende den Doppeltipp auf „… übernehmen“ über einer kurzen Sammlung: `openCollection`, „Notizen einfügen“, Text „Pausen helfen beim Lernen.“ und „Morgens zuerst ein Glas Wasser trinken.“ (zwei Zeilen), `show`, `settle`, `doubleTap(page, paste(page).getByRole('button', { name: '2 Erkenntnisse übernehmen', exact: true }), 0.5)` → Einfügen zu, Sammlung offen, kein Editor, `collection` hat 3 Einträge. (Auch hier trifft der zweite Tipp Inhalt der Sammlung; die Neu-Sperre ihres Danebentippens prüft der Browser-Test „Danebentippen sperrt neu …“.)

- [ ] **Step 2: Laufen lassen.** `npx vitest run --project browser tests/browser/collection-sheet.test.ts` und `npx playwright test tests/e2e/prinzipien.spec.ts -g "Notizen|Ebenen"`.
  Expected: FAIL, Knopf „Notizen einfügen“ fehlt.

- [ ] **Step 3: Implementieren.**
  - **`PasteSheet.svelte`** (Spec M12 §2.5): Zustand `view = $state<'text' | 'preview'>('text')`, `text`, `source`, `result: PasteResult | null`; `const arming = tapArming(() => view)`; `<Sheet title="Notizen einfügen" rearm={() => view} onClose={back}>`, `back()` = in der Vorschau `toText()`, sonst `onClose(0)`. Text: Satz, `<label for>` „Deine Notizen“ mit `<textarea rows="6" bind:value={text}>` (ohne `limitedInput`, ohne `maxlength`), Quelle mit `limitedInput` (`SOURCE_MAX`, `onEnter` fokussiert den Dialog) und Zähler, „Vorschau zeigen“ (`class="button"`, `disabled={text.trim() === ''}`): nur bei `arming.armed` `result = pasteLines(text, stats.data.collection ?? [], Math.max(0, KIND_MAX.erkenntnis - Zahl der Erkenntnisse))`, `view = 'preview'`, nach `tick()` Fokus auf die h3. Vorschau: h3 „Vorschau“ (`tabindex="-1"`), die Zeilen der Global Constraints (Einzahl/Mehrzahl, nur bei Bedarf; Quelle getrimmt, nur falls gesetzt), „… übernehmen“ nur bei Zeilen: bei `arming.armed` `addInsights(result.lines.map((l) => l.text), source)`, `onClose(result.lines.length)`; „Zurück zum Text“ (`button-line`) bei `arming.armed` `toText()`; `<ol>` mit `<li>` je Zeile und `<span class="mark">gekürzt</span>`. `toText()`: `view = 'text'`, nach `tick()` Fokus auf „Vorschau zeigen“. Ebene: `$effect(() => { if (view === 'preview') return openLayer(() => toText()) })` (Muster `FlowFrame.svelte:66–69`).
  - **`CollectionSheet.svelte`:** `pasting = $state(false)`; neben „Neue Erkenntnis“ der Knopf „Notizen einfügen“ (beide unter `KIND_MAX.erkenntnis`, sonst der Grenz-Satz); `openPaste(el)` bei `arming.armed`: `status = ''`, `returnTo = { el, kind: 'erkenntnis' }`, `pasting = true`; `openEditor` leert ebenfalls `status`; `closePaste(added)`: `pasting = false`, bei `added > 0` `status` = „1 Erkenntnis übernommen.“ bzw. `` `${added} Erkenntnisse übernommen.` ``, dann `restoreFocus()`; `arming` und `rearm` werden `() => editing === null && !pasting`; `{#if pasting}<PasteSheet onClose={closePaste} />{/if}` hinter dem Editor.

- [ ] **Step 4: Laufen lassen.** Dieselben Browser-Tests, die ganze Datei `npx playwright test tests/e2e/prinzipien.spec.ts` (auch Test 1, weil sich `CollectionSheet` ändert), `npm test`, `npm run check`. Expected: PASS, 0 Fehler.

- [ ] **Step 5: Commit** `feat: Notizen einfügen mit Vorschau`.

### Task 6: Sonntag: Prinzip der Woche wählen und anzeigen

**Files:**
- Modify:
  - `src/lib/ui/evening-ui.svelte.ts:13–20`, `:37`, `:65–71`, `:112–114`
  - `src/components/evening/WeekStep.svelte:1–16`, `:28–40`
  - `src/components/evening/EveningSummary.svelte:1–11`, `:39–41`
  - `src/components/morning/IntentionStep.svelte:5`, `:29–31`, `:45–60`, `:94–129`
  - `src/components/energy/WeekCard.svelte:15`, `:21–24`, `:38`, `:90–99`, `:188–192`
- Create: `tests/browser/evening-summary.test.ts`, `tests/browser/week-card.test.ts`
- Test: `tests/browser/evening-ui.test.ts` (Z. 50 und neue Tests), `tests/browser/intention-step.test.ts`, `tests/e2e/abend.spec.ts:268`, `tests/e2e/prinzipien.spec.ts` (Test 4 ohne Feld-Chip und `growthField`, Test 5 Anker-Teil; Abweichung vom vorgegebenen Schnitt: Feld-Chip und `growthField` von Test 4 kommen in Task 7 dazu, weil `FieldChoice` dort entsteht)

**Interfaces:**
- Consumes: `weekAnchor`, `WeekAnchor`, `sundayChoices` (Task 2); `WordPicker` mit `refs` (Task 3); `CollectionSheet` (Task 4, in E2E); `ownFocus`, `FOCUS_SUGGESTIONS`, `morningReminder` (M11).
- Produces:
  - `EveningDraft` mit `weekPrinciple: string | null` und `growthField: string | null`, `emptyDraft()` mit beiden `null` (Task 7 verdrahtet `growthField`).
  - `inputFromDraft()`: sonntags `weekFocus` und `weekPrinciple`; `skipEveningStep()` leert auf `'woche'` auch `weekPrinciple`.
  - `EveningSummary.svelte`, `IntentionStep.svelte`: Props unverändert; `WeekCard.svelte`: `view.anchor: WeekAnchor | null` statt `focusWord`.

- [ ] **Step 1: Failing tests schreiben.**
  - `tests/browser/evening-ui.test.ts`, Z. 50: `expect(eveningUi.draft).toEqual({ gave: [], cost: [], intentionScore: null, learned: '', better: '', weekFocus: '', weekPrinciple: null, growthField: null })`.

```ts
const PRINZIP = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg' }
test('sonntags wird weekPrinciple statt weekFocus gespeichert, werktags nicht', () => {
  setClock(new Date(2026, 10, 1, 21, 0)); stats.data = { ...emptyData(), collection: [PRINZIP] }
  openEvening(); eveningUi.draft.weekPrinciple = PRINZIP.id; walkToEnd()
  expect(stats.data.evenings![0]).toEqual({ day: '2026-11-01', at: expect.any(String), weekPrinciple: PRINZIP.id })
  setClock(new Date(2026, 9, 29, 20, 0)); openEvening(); eveningUi.draft.weekPrinciple = PRINZIP.id; walkToEnd()
  expect(stats.data.evenings!.find((e) => e.day === '2026-10-29')).not.toHaveProperty('weekPrinciple')
})
test('Überspringen auf der Wochenseite leert Wort und Prinzip', () => {
  setClock(new Date(2026, 10, 1, 21, 0)); stats.data = { ...emptyData(), collection: [PRINZIP] }
  openEvening(); Object.assign(eveningUi.draft, { weekFocus: 'Dranbleiben', weekPrinciple: PRINZIP.id })
  while (eveningUi.step !== 'woche') nextEveningStep()
  skipEveningStep()
  expect(eveningUi.draft).toMatchObject({ weekFocus: '', weekPrinciple: null })
  expect(stats.data.evenings![0]).toEqual({ day: '2026-11-01', at: expect.any(String) })
})
test('ein Sonntags-Logbuch, das nach Mitternacht endet, behält das Prinzip (Review Focus 3)', () => {
  setClock(new Date(2026, 10, 1, 23, 50)); stats.data = { ...emptyData(), collection: [PRINZIP] }
  openEvening(); eveningUi.draft.weekPrinciple = PRINZIP.id
  setClock(new Date(2026, 10, 2, 0, 35)); walkToEnd()
  expect(stats.data.evenings![0]).toMatchObject({ day: '2026-11-01', weekPrinciple: PRINZIP.id })
})
```

```ts
// tests/browser/evening-summary.test.ts: mountet EveningSummary mit { entry, morning: null }; lines() = Texte aller .line
const at = '2026-11-01T20:00:00.000Z'
const PRINZIP = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg' }
test('„Für die neue Woche: {Wort}“ statt „Wochenfokus: …“', () => {
  show({ day: '2026-11-01', at, weekFocus: 'Mehr Schlaf' })
  expect(lines()).toEqual(['Für die neue Woche: Mehr Schlaf'])
})
test('„Für die neue Woche: {Leitsatz}“ über die Sammlung; Umbenennen folgt sofort', () => {
  stats.data = { ...emptyData(), collection: [PRINZIP] }
  show({ day: '2026-11-01', at, weekPrinciple: PRINZIP.id })
  expect(lines()).toEqual(['Für die neue Woche: Mehrweg statt Einweg'])
  stats.data = { ...emptyData(), collection: [{ ...PRINZIP, text: 'Mehrweg statt Einweg im Alltag' }] }; flushSync()
  expect(lines()).toEqual(['Für die neue Woche: Mehrweg statt Einweg im Alltag'])
})
test('gelöschtes Prinzip: keine Zeile, dann „Logbuch erledigt.“', () => {
  stats.data = emptyData()
  show({ day: '2026-11-01', at, weekPrinciple: PRINZIP.id })
  expect(lines()).toEqual(['Logbuch erledigt.'])
})

// tests/browser/week-card.test.ts: mountet WeekCard; setClock wie evening-ui.test.ts; h3s() = Texte aller h3;
// section(title) = Elternelement der h3 mit diesem Text (Task 7 nutzt es für „Wachstumsfelder“)
const P = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' }
for (const [extra, line] of [[{ weekPrinciple: P.id }, 'Prinzip der Woche: Mehrweg statt Einweg'], [{ weekFocus: 'Mehr Schlaf' }, 'Wochenfokus: Mehr Schlaf']] as const) {
  test(`nur das Sonntags-Logbuch 7 Tage zuvor: „${line}“ ohne Wochenrückblick, am Montag danach nichts`, () => {
    setClock(new Date(2026, 10, 8, 12))
    stats.data = { ...emptyData(), collection: [P], evenings: [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', ...extra }] }
    show()
    expect(h3s()).not.toContain('Wochenrückblick')
    expect(target.textContent).toContain(line)
    if ('weekPrinciple' in extra) expect(target.textContent).toContain(P.ifThen)
    setClock(new Date(2026, 10, 9, 12)); flushSync()
    expect(target.textContent).not.toMatch(/Prinzip der Woche:|Wochenfokus:/)
  })
}
test('mit Logbuch in den 7 Tagen steht die Anker-Zeile direkt hinter dem Abschnitt „Wochenrückblick“, nicht darin', () => {
  setClock(new Date(2026, 10, 3, 12))
  stats.data = { ...emptyData(), collection: [P], evenings: [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', weekPrinciple: P.id }] }
  show()
  const review = section('Wochenrückblick')
  expect(review.textContent).not.toContain('Prinzip der Woche:')
  expect(review.nextElementSibling!.textContent).toContain('Prinzip der Woche: Mehrweg statt Einweg')
})
```

  - `tests/browser/intention-step.test.ts` (neuer Test):

```ts
test('der Kasten zeigt das Prinzip der Woche mit Leitsatz und Wenn-dann, ohne Erklärung; ein gelöschtes zeigt keinen Kasten', () => {
  const P = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg', note: 'Dann fällt weniger Müll an.', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' }
  const evenings = [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', weekPrinciple: P.id }]
  setClock(new Date(2026, 10, 2, 7, 0))
  stats.data = { ...emptyData(), collection: [P], evenings }
  show()
  for (const text of ['Prinzip der Woche', P.text, P.ifThen]) expect(box()?.textContent).toContain(text)
  expect(box()?.textContent).not.toContain(P.note)
  void unmount(instance!); target!.remove()
  stats.data = { ...emptyData(), evenings }
  show()
  expect(box()).toBeNull()
})
```

  - `tests/e2e/abend.spec.ts:268` wird `await expect(flow(page)).toContainText('Für die neue Woche: Mehr Schlaf')`.
  - `tests/e2e/prinzipien.spec.ts`, Helfer: `flow(page)`, `title(page, name)`, `skipTo(page, title)` wie `abend.spec.ts:22–25`, `:76–79`; `toIntention(page)` wie `abend-heute.spec.ts:207–211` (auf „Heute“ „Kurz · 5 Min“ der Karte „Morgen-Start“, dann „Überspringen“ bis „Wie willst du heute sein?“); `confirmText(page, text)` öffnet die Zeile, tippt „Löschen“, gibt den Satz der Rückfrage zurück, tippt „Behalten“ und schließt den Editor mit Escape (`settle` dazwischen).
  - Test `'4 Sonntag: Prinzip der Woche wählen, Abschluss, alter Anker bis Mitternacht, ab Montag der neue'` (`open(page, at('20:00:00', '2026-11-01'), { collection: [D, P, F], evenings: [{ day: '2026-10-25', at: '2026-10-25T19:00:00.000Z', weekPrinciple: D.id }] })`):
    1. „Starten“ auf der Karte „Tag abschließen“, `skipTo(page, 'Was machst du morgen 1 % besser?')`, Satz „Morgen zehn Minuten Schachaufgaben lösen.“ (Task 7 ergänzt hier den Feld-Chip), „Weiter“.
    2. Wochenseite: die Namen der Radiogruppen (`aria-label` bzw. Text des `aria-labelledby`-Ziels) `toEqual(['Deine Prinzipien', 'Vorschläge'])`; die Gruppe „Deine Prinzipien“ `getByRole('radio')` `toHaveText(['Dranbleiben', 'Mehrweg statt Einweg'])`; `flow(page).getByRole('radio', { name: 'Dranbleiben', exact: true })` `toHaveCount(1)`.
    3. Prinzip „Mehrweg statt Einweg“, „Weiter“: `expect(flow(page)).toContainText('Für die neue Woche: Mehrweg statt Einweg')`; das Logbuch vom `'2026-11-01'` `toMatchObject({ better: 'Morgen zehn Minuten Schachaufgaben lösen.', weekPrinciple: P.id })` und `not.toHaveProperty('weekFocus')`; „Fertig“.
    4. `resume(page, at('21:00:00', '2026-11-01'))`: `weekCard` `toContainText('Prinzip der Woche: Dranbleiben')`; Sammlung öffnen; `confirmText(page, P.text)` ergibt „„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.“, `confirmText(page, D.text)` ergibt „„Dranbleiben“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche.“; Escape schließt die Sammlung.
    5. `resume(page, at('00:30:00', '2026-11-02'))`: auf „Heute“ enthält die Karte „Dein Abend“ „Für die neue Woche: Mehrweg statt Einweg“; unter „Energie“ enthält `weekCard` „Prinzip der Woche: Mehrweg statt Einweg“.
  - Test `'5 Montag: Prinzip der Woche im Morgen-Kasten und in „Deine Woche“; umbenennen, löschen'` (`open(page, at('07:00:00', '2026-11-02'), { collection: [P, F], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }] }, 'Heute')`):
    1. `toIntention(page)`: die Region „Von gestern Abend“ enthält „Prinzip der Woche“, `P.text` und `P.ifThen`, nicht `P.note`; Morgen-Start über „Morgen-Start beenden“ → „Beenden“ schließen.
    2. Unter „Energie“ enthält `weekCard` „Prinzip der Woche: Mehrweg statt Einweg“ und `P.ifThen` (Task 7 ergänzt hier die Wachstumsfelder).
    3. Leitsatz auf „Mehrweg statt Einweg im Alltag“ ändern, Sammlung mit Escape schließen → `weekCard` enthält „Prinzip der Woche: Mehrweg statt Einweg im Alltag“.
    4. Sammlung öffnen, Zeile, „Löschen“: die Rückfrage enthält „„Mehrweg statt Einweg im Alltag“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.“; „Löschen“; Sammlung schließen → `weekCard` `not.toContainText('Prinzip der Woche:')` und `not.toContainText('Wochenfokus:')`.

- [ ] **Step 2: Laufen lassen.** `npx vitest run --project browser tests/browser/evening-ui.test.ts tests/browser/evening-summary.test.ts tests/browser/week-card.test.ts tests/browser/intention-step.test.ts` und `npx playwright test tests/e2e/prinzipien.spec.ts tests/e2e/abend.spec.ts -g "Sonntag|Montag|week"`.
  Expected: FAIL (Entwurf ohne die neuen Schlüssel; „Wochenfokus: Mehr Schlaf“ statt „Für die neue Woche: …“; Gruppe „Deine Prinzipien“ fehlt).

- [ ] **Step 3: Implementieren.**
  - **`evening-ui.svelte.ts`:** `EveningDraft` und `emptyDraft` mit `weekPrinciple: null`, `growthField: null`; `inputFromDraft`: sonntags (`eveningUi.sunday`, beim Öffnen festgelegt) zusätzlich `input.weekPrinciple = draft.weekPrinciple`; `skipEveningStep` auf `'woche'` zusätzlich `draft.weekPrinciple = null`.
  - **`WeekStep.svelte`:** `principles = $derived` aus `stats.data.collection` (Art `prinzip`, Sammlungsfolge, `{ id, text }`); `choices = $derived(sundayChoices(FOCUS_SUGGESTIONS, ownFocus(stats.data.evenings ?? []), stats.data.collection ?? []))`; `WordPicker` mit `words={choices.suggestions}`, `own={choices.own}`, `refLabel="Deine Prinzipien"`, `refs={principles}`, `refValue={eveningUi.draft.weekPrinciple}`, `onRef={(id) => { eveningUi.draft.weekPrinciple = id; eveningUi.draft.weekFocus = '' }}`, `onChange={(value) => { eveningUi.draft.weekFocus = value; eveningUi.draft.weekPrinciple = null }}`.
  - **`EveningSummary.svelte`:** Prinzip über `stats.data.collection` auflösen (Kennung und Art `prinzip`); `anchor = $derived(principle?.text ?? entry.weekFocus ?? null)`; Zeile `Für die neue Woche: {anchor}`; `empty` prüft `anchor` statt `entry.weekFocus`; Kopfkommentar nennt Spec M12 §2.6.
  - **`IntentionStep.svelte`:** `const anchor = untrack(() => weekAnchor(stats.data.evenings ?? [], stats.data.collection ?? [], appNow()))`; Kasten bei `reminder.better || anchor`; Prinzip: Beschriftung „Prinzip der Woche“, `<p class="reminder-text accent">` mit dem Leitsatz, falls gesetzt `<p class="reminder-note">` mit dem Wenn-dann (`font-weight: 400`, `font-size: 0.9375rem`, `overflow-wrap: anywhere`); Wort: wie bisher „Wochenfokus“.
  - **`WeekCard.svelte`:** `anchor: weekAnchor(stats.data.evenings ?? [], stats.data.collection ?? [], now)` statt `focusWord`; die Zeile verlässt den `.review`-Block und steht direkt hinter dessen `{/if}`: `<p class="focus-word">Prinzip der Woche: {Leitsatz}</p>` und leise `<p class="focus-note">{Wenn-dann}</p>` bzw. `Wochenfokus: {Wort}`; `.focus-note` gedämpft wie `.hint`, `overflow-wrap: anywhere`; Kopfkommentar ergänzt Spec M12 §2.8.

- [ ] **Step 4: Laufen lassen.** Dieselben Tests, dazu `npx playwright test tests/e2e/abend.spec.ts tests/e2e/abend-heute.spec.ts tests/e2e/morgen.spec.ts tests/e2e/energie.spec.ts tests/e2e/morgen-heute.spec.ts` (die beiden letzten prüfen „Deine Woche“, die hier umgebaut wird), `npm test`, `npm run check`.
  Expected: PASS, 0 Fehler; `abend-heute.spec.ts:189`, `:212–215`, `:227` und `intention-step.test.ts:175–203` unverändert grün.

- [ ] **Step 5: Commit** `feat: Prinzip der Woche am Sonntag, im Morgen-Kasten und in „Deine Woche“`.

### Task 7: „1 % besser“ mit Wachstumsfeld und die Felder in „Deine Woche“

**Files:**
- Create: `src/components/principles/FieldChoice.svelte`, `tests/browser/field-choice.test.ts`
- Modify:
  - `src/components/evening/TextStep.svelte:1–16`, `:44`
  - `src/components/evening/EveningFlow.svelte:1–10`, `:44–52`
  - `src/lib/ui/evening-ui.svelte.ts` (`inputFromDraft` und Fall `'besser'` in `skipEveningStep`; Task 6 hat die Zeilen verschoben)
  - `src/components/energy/WeekCard.svelte` (Block „Wachstumsfelder“ direkt vor dem Block „Was bei dir wirkt“, `.works`)
- Test: `tests/browser/evening-ui.test.ts`, `tests/browser/week-card.test.ts`, `tests/e2e/prinzipien.spec.ts` (Feld-Teile von Test 4 und 5)

**Interfaces:**
- Consumes: `growthWeek`, `growthLine` (Task 2); `ChoiceGroup` mit Tastenschutz (Task 3); `EveningDraft.growthField` (Task 6); `logbookDay`.
- Produces: `FieldChoice.svelte` ohne Props (liest `stats.data.collection` und `eveningUi.draft.growthField`); `TextStep.svelte` mit `children?: Snippet`; `inputFromDraft()` gibt `growthField` immer weiter; `skipEveningStep()` leert auf `'besser'` auch `growthField`; `WeekCard.svelte` mit `view.growth: GrowthRow[]`.

- [ ] **Step 1: Failing tests schreiben.**

```ts
// tests/browser/field-choice.test.ts: mountet FieldChoice; radios() = alle [role=radio]; beforeEach: localStorage.clear(),
// stats.data = emptyData(), eveningUi.draft.growthField = null (der Zustand des Moduls bleibt zwischen den Tests); afterEach baut ab
// wie intention-step.test.ts
const F = { id: 's-0000000b', kind: 'feld' as const, text: 'Schach lernen' }
const F2 = { id: 's-0000000e', kind: 'feld' as const, text: 'Mehrweg im Alltag' }
test('ohne Felder nichts', () => {
  stats.data = { ...emptyData(), collection: [{ id: 's-0000000a', kind: 'prinzip', text: 'Mehrweg statt Einweg' }] }; show()
  expect([target.textContent!.trim(), target.querySelector('[role="radiogroup"]')]).toEqual(['', null])
})
test('Chips in der Reihenfolge der Sammlung, kein Chip vorgewählt; die Gruppe heißt wie die sichtbare Beschriftung', () => {
  stats.data = { ...emptyData(), collection: [F2, F] }; show()
  expect(target.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Wachstumsfeld (freiwillig)')
  const label = target.querySelector('[aria-hidden="true"]')!
  expect(label.textContent).toBe('Wachstumsfeld (freiwillig)')
  expect(radios().map((r) => [r.textContent!.trim(), r.getAttribute('aria-checked')])).toEqual([['Mehrweg im Alltag', 'false'], ['Schach lernen', 'false']])
})
test('ein Tipp wählt, ein zweiter nimmt zurück', () => {
  stats.data = { ...emptyData(), collection: [F] }; show()
  radios()[0].click(); flushSync(); expect(eveningUi.draft.growthField).toBe(F.id)
  radios()[0].click(); flushSync(); expect(eveningUi.draft.growthField).toBeNull()
})
test('mit einem Feld nimmt eine Pfeiltaste die Wahl nicht zurück (Tastenschutz in ChoiceGroup)', () => {
  stats.data = { ...emptyData(), collection: [F] }; show()
  radios()[0].click(); flushSync()
  radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); flushSync()
  expect(eveningUi.draft.growthField).toBe(F.id)
})

// tests/browser/evening-ui.test.ts
test('1 % besser: ein Satz mit Feld speichert growthField; Überspringen leert Satz und Feld; ein Feld ohne Satz wird nicht gespeichert', () => {
  const FELD = { id: 's-0000000b', kind: 'feld' as const, text: 'Schach lernen' }
  setClock(new Date(2026, 9, 29, 20, 0)); stats.data = { ...emptyData(), collection: [FELD] }
  openEvening(); Object.assign(eveningUi.draft, { better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: FELD.id }); walkToEnd()
  expect(stats.data.evenings![0]).toMatchObject({ better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: FELD.id })
  openEvening(); Object.assign(eveningUi.draft, { better: 'Morgen eine Eröffnung üben.', growthField: FELD.id })
  while (eveningUi.step !== 'besser') nextEveningStep()
  skipEveningStep()
  expect(eveningUi.draft).toMatchObject({ better: '', growthField: null })
  expect(stats.data.evenings![0]).not.toHaveProperty('growthField')
  openEvening(); eveningUi.draft.growthField = FELD.id; walkToEnd()
  expect(stats.data.evenings![0]).not.toHaveProperty('growthField')
})

// tests/browser/week-card.test.ts
test('Wachstumsfelder: bei n ≥ 1 Zählung und jüngster Satz, bei n = 0 nur Name und Schritt (Review Focus 2)', () => {
  const F = { id: 's-0000000b', kind: 'feld' as const, text: 'Schach lernen', step: 'Jeden Abend eine Eröffnung nachspielen.' }
  const F2 = { id: 's-0000000e', kind: 'feld' as const, text: 'Mehrweg im Alltag', step: 'Eine Stofftasche einpacken.' }
  setClock(new Date(2026, 10, 2, 10))
  stats.data = { ...emptyData(), collection: [F, F2], evenings: [
    { day: '2026-10-30', at: '2026-10-30T20:00:00.000Z', better: 'Morgen eine Eröffnung üben.', growthField: F.id },
    { day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id },
  ] }
  show()
  expect(h3s().slice(-2)).toEqual(['Wachstumsfelder', 'Was bei dir wirkt'])
  const [first, second] = [...section('Wachstumsfelder').querySelectorAll('li')].map((li) => li.textContent!)
  for (const text of ['Schach lernen', 'Vorgenommen an 2 der letzten 7 Tage', 'Zuletzt: Morgen zehn Minuten Schachaufgaben lösen.']) expect(first).toContain(text)
  expect(first).not.toContain('Nächster kleiner Schritt')
  expect(second).toContain('Mehrweg im Alltag'); expect(second).toContain('Nächster kleiner Schritt: Eine Stofftasche einpacken.')
  expect(second).not.toMatch(/Vorgenommen an|Zuletzt:/)
})
test('ohne Felder kein Abschnitt „Wachstumsfelder“', () => {
  setClock(new Date(2026, 10, 2, 10)); stats.data = emptyData(); show()
  expect(h3s()).not.toContain('Wachstumsfelder')
})
```

  - **E2E, Test 4:** an der markierten Stelle in Punkt 1 `const fields = flow(page).getByRole('radiogroup', { name: 'Wachstumsfeld (freiwillig)', exact: true })`, Chip „Schach lernen“ antippen (`aria-checked="true"`), noch einmal (`"false"`), noch einmal (`"true"`); das gespeicherte Logbuch erwartet in Punkt 3 zusätzlich `growthField: F.id`.
  - **E2E, Test 5:** der Seed bekommt `{ day: '2026-10-30', at: '2026-10-30T19:00:00.000Z', better: 'Morgen eine Eröffnung üben.', growthField: F.id }` und am 1.11. zusätzlich `better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id`; an der markierten Stelle in Punkt 2 erwartet `weekCard` die h3 „Wachstumsfelder“, „Schach lernen“, „Vorgenommen an 2 der letzten 7 Tage“ und „Zuletzt: Morgen zehn Minuten Schachaufgaben lösen.“.

- [ ] **Step 2: Laufen lassen.** `npx vitest run --project browser tests/browser/field-choice.test.ts tests/browser/evening-ui.test.ts tests/browser/week-card.test.ts` und `npx playwright test tests/e2e/prinzipien.spec.ts -g "Sonntag|Montag"`.
  Expected: FAIL mit `Failed to resolve import "../../src/components/principles/FieldChoice.svelte"` bzw. ohne `growthField` im Logbuch.

- [ ] **Step 3: Implementieren.**
  - **`FieldChoice.svelte`** (Spec M12 §2.6): Felder der Sammlung (Art `feld`, Sammlungsfolge); ohne Felder nichts; sonst `<span class="label" aria-hidden="true">Wachstumsfeld (freiwillig)</span>` und `<ChoiceGroup label="Wachstumsfeld (freiwillig)" options={options}` (`options: { value: string | null; label: string }[]` aus `fields.map((f) => ({ value: f.id, label: f.text }))`) mit `value={eveningUi.draft.growthField}` und `onSelect={(id) => (eveningUi.draft.growthField = eveningUi.draft.growthField === id ? null : id)}` (Aufbau wie `Atmen.svelte:37–40`).
  - **`TextStep.svelte`:** Prop `children?: Snippet`; `{@render children?.()}` direkt hinter dem `.field`-Block (nach Z. 44), noch in `.content`; TextStep weiß nichts von Prinzipien.
  - **`EveningFlow.svelte`:** im Zweig `'besser'` `<TextStep …><FieldChoice /></TextStep>`.
  - **`evening-ui.svelte.ts`:** `inputFromDraft` gibt `growthField: draft.growthField` immer weiter (`withEvening` verwirft es ohne Satz); `skipEveningStep` auf `'besser'` zusätzlich `draft.growthField = null`.
  - **`WeekCard.svelte`:** `growth: growthWeek(stats.data.collection ?? [], stats.data.evenings ?? [], logbookDay(now))`; vor „Was bei dir wirkt“ mit Feldern `<div class="growth">` mit h3 „Wachstumsfelder“ und `<ul role="list">`: je Feld der Name, bei `count ≥ 1` `growthLine(count)` und `Zuletzt: {last}`, sonst nur, falls gesetzt, `Nächster kleiner Schritt: {step}`; Stil wie `.review`/`.works`, `overflow-wrap: anywhere`; kein `role=img`.

- [ ] **Step 4: Laufen lassen.** Dieselben Tests, `npx playwright test tests/e2e/abend.spec.ts tests/e2e/energie.spec.ts`, `npm test`, `npm run check`.
  Expected: PASS, 0 Fehler; `energie.spec.ts:1094` (28 Bilder) unverändert grün.

- [ ] **Step 5: Commit** `feat: Wachstumsfeld bei „1 % besser“ und Wachstumsfelder in „Deine Woche“`.

### Task 8: Backup-Hinweis, E2E 6–7, README, Haupt-Spec und Gesamtprüfung

**Files:**
- Modify:
  - `src/screens/Ich.svelte:216–217`
  - `tests/e2e/ich.spec.ts:680`
  - `tests/e2e/prinzipien.spec.ts` (Tests 6 und 7)
  - `README.md:70` (neuer Abschnitt davor), `:79`, `:235`, `:236`
  - `docs/superpowers/specs/2026-10-21-ruhe-design.md:36` (Ergänzung dahinter), `:365` (Ergänzung dahinter)

**Interfaces:**
- Consumes: alles aus Task 1–7; `chooseFile` und `backupStatus` wie `tests/e2e/ich.spec.ts:52–58`, `:65`; `expectTargets` wie `atemmuster.spec.ts:180–187`; Helfer aus Task 4 und 6 in `prinzipien.spec.ts`.
- Produces: keine neuen Schnittstellen.

- [ ] **Step 1: Failing tests schreiben.**
  - `tests/e2e/ich.spec.ts:680` erwartet den neuen Hinweis aus den Global Constraints.
  - `tests/e2e/prinzipien.spec.ts`, Test `'6 Backup: Sammlung und Verweise überstehen Export und Import ohne Doppelte'` (`open(page, MONDAY, { collection: [P, F, E], evenings: [EVENING] }, 'Ich')` mit `EVENING = { day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id, weekPrinciple: P.id }`; `backupFile(data = {})` = `JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, ...data })`; `chooseFile` und `backupStatus` wie `ich.spec.ts:52–58`, `:65`):
    1. Der Hinweis der Karte „Backup“ steht wörtlich da (Global Constraints).
    2. „Backup exportieren“: die geladene Datei `toMatchObject({ collection: [P, F, E], evenings: [EVENING] })`.
    3. Gerät leeren (`localStorage.clear()`, Neuladen, Reiter „Ich“), die Datei importieren: `backupStatus` `toHaveText('0 neue Sitzungen importiert. Dazu 1 neuer Energie-Eintrag.')`; gespeichert `toMatchObject({ collection: [P, F, E], evenings: [EVENING] })`; unter „Energie“ enthält `weekCard` „Prinzip der Woche: Mehrweg statt Einweg“ und „Vorgenommen an 1 der letzten 7 Tage“.
    4. Dieselbe Datei noch einmal: „0 neue Sitzungen importiert.“, `collection` hat 3 Einträge.
    5. `backupFile()` (altes Backup ohne Sammlung): „0 neue Sitzungen importiert.“, `collection` `toEqual([P, F, E])`.
    6. `backupFile({ collection: [{ id: 's-00000020', kind: 'erkenntnis', text: 'Wer im Schach die Mitte besetzt, hat mehr Zeit.' }] })`: „0 neue Sitzungen importiert.“, Kennungen `[P.id, F.id, E.id, 's-00000020']` (Importiertes hinten).
  - Test `'7 360 px und 130 %: lange Texte ohne Leerzeichen laufen nirgends seitlich hinaus'` (`test.describe` mit `viewport: { width: 360, height: 640 }`; im Test zuerst `test.setTimeout(60_000)` mit dem Kommentar „zehn Ansichten samt Logbuch und Morgen-Start, keine Echtzeit“; `long(stem, n)` wiederholt `stem` und schneidet auf `n` Zeichen; Seed `collection: [LP, LF, LE]` mit Leitsatz `long('Mehrweg', 60)`, Erklärung `long('Müll', 160)`, Wenn-dann `long('Stofftasche', 120)`, Feld `long('Schach', 40)` mit Schritt `long('Eröffnung', 120)`, Erkenntnis `long('Mitte', 500)` mit Quelle `long('Schachkurs', 80)`; Start `at('20:00:00', '2026-11-01')`, dann `document.documentElement.style.fontSize = '130%'`; `expectTargets(scope)` wie `atemmuster.spec.ts:180–187`, zusätzlich jedes Textfeld mindestens 52 px hoch). Nach jedem Punkt `expectNoSideways(page, …)` auf das genannte Element:
    1. Karte (Erkenntnis des Tages mit 500 Zeichen); Sammlung (`expectTargets`); Editor des Prinzips (`expectTargets`); „Löschen“ → Rückfrage; „Behalten“, Escape.
    2. „Notizen einfügen“ mit `long('Zentrum', 520)` (nicht `LE.text`, sonst bliebe die Vorschau als Doppel leer) und Quelle `long('Schachkurs', 80)`: Textansicht (`expectTargets`); „Vorschau zeigen“: `paste(page).getByRole('listitem')` hat genau einen Eintrag, der „gekürzt“ enthält, „1 gekürzt auf 500 Zeichen.“ und der Knopf „1 Erkenntnis übernehmen“ sind sichtbar; Vorschau (`expectTargets`); dreimal Escape (Vorschau → Text → Sammlung → zu).
    3. Logbuch über „Starten“ der Karte „Tag abschließen“, `skipTo` bis „Was machst du morgen 1 % besser?“, Satz `long('Schachaufgaben', 80)`, Feld-Chip `LF.text`: Ablauf; „Weiter“, Sonntags-Chip `LP.text`: Ablauf; „Weiter“: Abschluss mit `` `Für die neue Woche: ${LP.text}` ``; „Fertig“.
    4. `resume(page, at('00:30:00', '2026-11-02'))`: auf „Heute“ die Karte „Dein Abend“; unter „Energie“ `weekCard` (mit „Wachstumsfelder“).
    5. `resume(page, at('07:00:00', '2026-11-02'))`, „Heute“, `toIntention(page)`: die Region „Von gestern Abend“.

- [ ] **Step 2: Laufen lassen.** `npx playwright test tests/e2e/ich.spec.ts tests/e2e/prinzipien.spec.ts -g "import merges|Backup|360"`.
  Expected: FAIL in `ich.spec.ts` und Test 6 (alter Hinweis unter „Ich“). Test 7 prüft fertige Teile und darf schon grün sein; ist er rot, wird die Ursache in der zuständigen Komponente behoben (Umbruch, Mindestgröße), nie im Test; solche Korrekturen kommen als eigener Commit `fix: lange Texte bei 360 px und 130 % umbrechen` (mit den geänderten Komponenten) vor die Commits aus Step 5.

- [ ] **Step 3: Umsetzen.**
  - **`Ich.svelte:216–217`:** der Hinweis aus den Global Constraints, umbrochen wie bisher.
  - **README, vor Z. 70:** Abschnitt „## Handy-Checkliste Meilenstein 12“ mit den neun Punkten aus Spec §8, wörtlich, je mit einer fetten Kurzüberschrift im Stil der M11-Liste: 1 **Karte und Sammlung:**, 2 **Prinzip pflegen:**, 3 **Notizen einfügen:**, 4 **Erkenntnis des Tages:**, 5 **Wachstumsfeld am Abend:**, 6 **Sonntags das Prinzip der Woche:**, 7 **Ab Montag:**, 8 **Große Schrift:**, 9 **Backup:**; darunter `> Hinweis: Prinzipien, Erkenntnisse und Wachstumsfelder liegen nur auf dem Handy (und im Backup), nie im Repo. Die Sammlung zählt nicht in Serie, Minuten, Kalender und „Zuletzt genutzt“.`
  - **README Z. 79** (Anfang „**Wochenrückblick unter „Energie“:**“ bleibt), danach: „„Energie“ → „Deine Woche“ zeigt den Abschnitt „Wochenrückblick“, sobald es in den letzten 7 Tagen ein Logbuch gibt. Direkt dahinter steht, solange er gilt, der gewählte Fokus („Wochenfokus: …“, bei einem Prinzip „Prinzip der Woche: …“), auch ohne Logbuch in diesen Tagen.“
  - **README Z. 235** (Anfang „**Hildebrandt:**“ bleibt), danach: „Henry Hildebrandts „Brainhacks“ (2025) erscheint nur als Leseempfehlung, `further` mit dem Wortlaut „Henry Hildebrandt, Brainhacks (2025)“, und nur bei den vier Geist-Hacks. Das bleibt so, bis aus deinen Buchnotizen Karten in eigenen Worten entstehen und du sie freigibst; das ist ein eigener späterer Inhalts-Schritt nach Meilenstein 12. Deine Notizen selbst kommen nie ins Repo; in der App liegen sie nur auf dem Handy.“
  - **README Z. 236** (Anfang „**Nichts Persönliches:**“ bleibt), danach: „Check-ins, Läufe und Sprints sowie deine Prinzipien, Erkenntnisse und Wachstumsfelder bleiben auf dem Handy; in Beispielen und Tests stehen nur ausgedachte Werte.“
  - **Haupt-Spec, hinter Z. 36** (zwei Leerzeichen eingerückt wie Z. 35–36): „*Ergänzung vom 01.11.2026 (Meilenstein 12):* Die Sammlung unter „Energie“ (Prinzipien, Wachstumsfelder, Erkenntnisse) ist eine selbst gepflegte Liste ohne Datum wie die eigenen Atemmuster, kein Tagebuch. Es gibt kein Archiv der Logbuch-Sätze und keine weitere Verlaufsgrafik; Wachstumsfelder zählen nur als Satz („Vorgenommen an … der letzten 7 Tage“). Siehe `docs/superpowers/specs/2026-11-01-ruhe-m12-prinzipien-wachstum-design.md` §1 (Nicht-Ziele).“
  - **Haupt-Spec, hinter Z. 365:** „*Ergänzung vom 01.11.2026 (Meilenstein 12):* Der Datenstand bekommt eine weitere optionale Liste `collection` (`version` bleibt 1): Prinzipien, Wachstumsfelder und Erkenntnisse (`id` mit `s-` und 8 Hex-Zeichen, `kind` mit `prinzip`, `feld` oder `erkenntnis`, `text`, je nach Art optional `note` und `ifThen`, `step` oder `source`). Die Liste fehlt, solange sie leer ist; beim Laden und beim Import gelten je Art höchstens 50, 20 und 600 Einträge. Das Backup enthält sie; der Import behält die Einträge des Geräts und hängt aus der Datei nur Einträge mit unbekannter Kennung hinten an, Erkenntnisse nur mit neuem Text; sie zählen nicht in der Import-Meldung. Die Logbuch-Einträge bekommen `weekPrinciple` (Kennung eines Prinzips, nur an einem Sonntag, dann ohne `weekFocus`) und `growthField` (Kennung eines Wachstumsfelds, nur mit `better`). Typen und Regeln in `docs/superpowers/specs/2026-11-01-ruhe-m12-prinzipien-wachstum-design.md` §4.“

- [ ] **Step 4: Gesamtprüfung.** `npm run check` (0 Fehler), `npm test` (alle grün), die ganze Suite `npx playwright test` (Port 4173 vorher frei).
  Expected: PASS; Playwright meldet 371 Tests in 21 Dateien (vorher 364 in 20), etwa eine Minute mehr; keine bestehende Prüfung entfällt, geändert sind nur die fünf Prüfzeilen aus den Global Constraints (dazu nur Importzeilen, neue Tests und `alignOverSheet`). Die Zahlen und die Laufzeit jedes der sieben Tests aus `prinzipien.spec.ts` kommen in den Bericht (sie laufen nacheinander in einem Worker, `playwright.config.ts` setzt kein `fullyParallel`).

- [ ] **Step 5: Commits** `feat: Backup-Hinweis nennt Prinzipien; E2E für Backup und große Schrift` (`Ich.svelte`, `ich.spec.ts`, `prinzipien.spec.ts`) und `docs: Handy-Checkliste M12, Hildebrandt-Zeile und Haupt-Spec` (`README.md`, Haupt-Spec).
