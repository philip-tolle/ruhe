# Ruhe – Meilenstein 6: Ruhe-Check-in

*Stand: 24.10.2026 · ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md` sowie die Specs zu M4, M4.1 und M5. Wo dieses Dokument etwas anders regelt, gilt dieses Dokument.*

## 1. Ziel & Rahmen

In der M4-Spec (§9) war Meilenstein 6 als Stimmungs-Check-in „Wie geht es dir?“ angekündigt, sichtbar unter „Ich“. Der Nutzer möchte damit zwei Dinge sehen:

- **Wirkung:** ob und wie sehr ihm Meditieren und Atmen helfen;
- **Verlauf:** wie sich seine Ruhe über die Wochen entwickelt.

**Vom Nutzer entschieden (Brainstorming 24.10.2026):**

1. **Zeitpunkt:** Gefragt wird nur auf dem Abschluss-Bildschirm einer Sitzung, freiwillig. Dort stehen zwei Reihen, „Vorher“ und „Jetzt“. Der Start bleibt ein einziger Tipp.
2. **Skala:** Gemessen wird die **Ruhe** in 5 Stufen, von „sehr unruhig“ bis „ganz ruhig“, nicht die allgemeine Stimmung.
3. **Aussehen:** Variante A, „Punkte“: fünf Punkte von warm (unruhig) zu kühl (ruhig), das Wort der gewählten Stufe steht daneben.
4. **Anzeige unter „Ich“:** ein Wirkungs-Satz und ein Verlauf-Satz. Es gibt kein Diagramm, keine Liste und keine Markierung im Kalender.
5. **Motiv:** Die neue Karte „Ruhe“ bekommt ein eigenes gemaltes Motiv mit sanften Wellen in Orange.
6. Abschnitt 1 (was man sieht) und Abschnitt 2 (Daten, Auswertung, Grenzfälle, Tests) wurden wie vorgestellt freigegeben.
7. **Technischer Ansatz:** Die Ruhe-Werte hängen an der Sitzung. Die Alternativen waren eine eigene Liste oder Check-ins ohne Bezug zu einer Sitzung.

### Erfolgskriterien

- Nach jeder gezählten Sitzung (ab 1 Minute) lassen sich mit je einem Tipp „Vorher“ und „Jetzt“ festhalten. Ohne Antwort schließt „Fertig“ wie bisher.
- Unter „Ich“ steht, um wie viele Stufen ruhiger man nach einer Sitzung im Schnitt ist, und ob man vor den Sitzungen ruhiger oder unruhiger geworden ist.
- Die Werte überstehen Neuladen, Backup und Import. Alte Daten bleiben gültig.

### Nicht-Ziele

- Kein täglicher Check-in ohne Sitzung und keine Frage vor dem Start.
- Keine Notizen, kein Freitext, kein nachträgliches Bearbeiten früherer Einträge.
- Kein Diagramm, keine Liste der Einträge, keine Markierung im Kalender. Das Nicht-Ziel der Haupt-Spec „Keine ausführliche Statistik (Stimmungstagebuch, Diagramme)“ gilt weiter; zwei Sätze sind kein Tagebuch.
- Kein Check-in für Sitzungen unter einer Minute (sie werden nicht gespeichert) und keiner für „Klänge“ (dort gibt es keine Sitzungen).
- Keine Empfehlung von Übungen anhand der Ruhe.

## 2. Die Skala

| Stufe | Wort | Farbe des Punkts |
|---|---|---|
| 1 | sehr unruhig | `#E7A29A` |
| 2 | etwas unruhig | `#E9B894` |
| 3 | teils, teils | `#E6CF9A` |
| 4 | ruhig | `#B9D3C0` |
| 5 | ganz ruhig | `#8FD0D6` |

- Die Farben sind in allen drei Tageszeiten gleich. Die Bedeutung trägt immer das Wort, nie die Farbe allein.
- Die Wörter stehen an einer Stelle im Code (`CALM_LEVELS` in `src/lib/stats/calm.ts`), Oberfläche und Texte lesen sie von dort.

## 3. Abschluss-Bildschirm

Die Karte erscheint in `SessionDone` unter der Zeile mit den Minuten, aber nur, wenn die Sitzung gespeichert wurde (ab 60 s). Bei „Unter einer Minute – das zählt noch nicht für die Statistik.“ gibt es keine Karte.

**Aufbau** (wie Variante A im Entwurf):

- Die Karte hat das Aussehen der übrigen Karten (`.card`). Oben steht leise „Magst du festhalten, wie ruhig du bist?“.
- Darunter folgen zwei Reihen, jede über einer feinen Goldlinie:
  - Kopfzeile: links „Vorher“ bzw. „Jetzt“ (fett), rechts in Akzentfarbe das Wort der gewählten Stufe; ohne Wahl bleibt es leer.
  - Fünf runde Punkte, gleichmäßig über die Breite verteilt, je mindestens 48 × 48 px Tippfläche. Ein ungewählter Punkt zeigt einen kleinen Farbpunkt mit halber Deckkraft im feinen Ring. Der gewählte Punkt ist größer und voll deckend, mit goldenem Ring und leichtem Schein.
  - Darunter klein und gedämpft: links „sehr unruhig“, rechts „ganz ruhig“.
- Unter der Karte steht der Knopf „Fertig“ wie bisher, darunter klein und gedämpft „Ohne Antwort einfach „Fertig“.“.

**Verhalten:**

- Ein Tipp auf einen Punkt speichert die Stufe sofort.
- Ein Tipp auf einen anderen Punkt derselben Reihe ändert die Wahl.
- Ein Tipp auf den gewählten Punkt nimmt die Wahl zurück.
- Beide Reihen sind unabhängig: Man darf nur eine beantworten.
- „Fertig“ schließt wie bisher. Startet man vorher eine neue Sitzung, bleibt alles Angetippte gespeichert.

**Barrierefreiheit:**

- Jede Reihe ist eine `radiogroup` mit dem Namen „Vorher“ bzw. „Jetzt“, jeder Punkt ein `radio` mit dem Wort der Stufe als Namen und `aria-checked`.
- Das sichtbare Wort neben „Vorher“/„Jetzt“ ist `aria-hidden`, weil der gewählte Punkt es schon nennt.
- Tastatur: Pfeiltasten bewegen die Wahl innerhalb der Reihe (wie `ChoiceGroup`), Leertaste/Enter wählt bzw. nimmt zurück. Es gibt einen Tab-Stopp je Reihe.
- Der Fokus kommt beim Öffnen weiter auf die Überschrift.

**Platz:** Mit der Karte wird der Abschluss höher als der Bildschirm. Er muss sich bei 360 px Breite und bei 130 % Schriftgröße ohne Überlauf zeigen und scrollen lassen.

## 4. Reiter „Ich“: Karte „Ruhe“

Die neue Karte steht unter dem Kalender und über „Einstellungen“. Ihr Kopf ist das Motiv `ruhe` (40 px, Schmuck) neben der Überschrift „Ruhe“ (`h2`). Danach folgen, jeweils nur wenn genug Daten da sind, diese Zeilen:

1. **Wirkung** (§5.2):
   - ruhiger: „Nach einer Sitzung bist du im Schnitt 1,4 Stufen ruhiger.“
   - unruhiger: „Nach einer Sitzung bist du im Schnitt 0,6 Stufen unruhiger.“
   - kaum Unterschied: „Nach einer Sitzung bist du im Schnitt etwa so ruhig wie vorher.“
2. **Aufteilung**, klein und gedämpft, nur wenn Atmen *und* Meditieren je mindestens 3 Paare haben: „Atmen +1,6 · Meditieren +1,1“.
3. **Grundlage**, klein und gedämpft, immer zusammen mit der Wirkung: „Aus 12 Sitzungen der letzten 30 Tage“.
4. **Verlauf** (§5.3):
   - ruhiger: „Vor deinen Sitzungen warst du in den letzten 30 Tagen ruhiger als in den 30 Tagen davor.“
   - unruhiger: „Vor deinen Sitzungen warst du in den letzten 30 Tagen unruhiger als in den 30 Tagen davor.“
   - kaum Unterschied: „Vor deinen Sitzungen warst du in den letzten 30 Tagen etwa gleich ruhig wie in den 30 Tagen davor.“
5. **Einladung**, wenn keine Wirkung berechnet werden kann: „Halte nach einer Sitzung fest, wie ruhig du vorher und jetzt bist. Hier siehst du dann, was dir deine Übungen bringen.“

Die Wirkung (oder die Einladung) und der Verlauf sind unabhängig: Der Verlauf kann neben der Einladung stehen.

**Zahlen:**

- Eine Nachkommastelle mit deutschem Komma: „1,4 Stufen“, „0,5 Stufen“.
- Ist der gerundete Betrag genau 1,0, heißt es „eine Stufe“.
- In der Aufteilung tragen die Zahlen ein Vorzeichen: „+1,6“, „−0,4“ (echtes Minus, U+2212), und „±0“, wenn der gerundete Wert 0,0 ist.

## 5. Daten und Auswertung

### 5.1 Speichern

- `Session` (in `src/lib/stats/schema.ts`) bekommt optional `calm?: { before?: CalmLevel; after?: CalmLevel }` mit `type CalmLevel = 1 | 2 | 3 | 4 | 5`. Ohne Werte fehlt `calm` ganz, ein leeres Objekt wird nie gespeichert.
- **Laden:** `parseSession` liest `calm` streng. Ein ungültiger Wert (keine ganze Zahl von 1 bis 5) fällt still weg, ebenso ein `calm` ohne gültigen Wert. Die Sitzung selbst bleibt immer erhalten.
- **Erfassen:**
  - `recordSession(result)` gibt künftig die ID der neuen Sitzung zurück, unter 60 s `null`. Bisher gab es `true`/`false` zurück.
  - `connectSessions` meldet dem Abschluss diese ID. `SessionDoneInfo` bekommt `sessionId: string | null`; `counted` ist `sessionId !== null`.
  - Die ID kommt auch dann, wenn das Speichern im Browser scheitert: Die Sitzung steht im Speicher der App, und es gilt der bekannte Hinweis unter „Ich“.
- **Ändern:** `setCalm(sessionId, which: 'before' | 'after', level: CalmLevel | null)` im Store ändert genau diese Sitzung und speichert. `null` entfernt den Wert. Fehlen danach beide Werte, entfällt `calm`. Kennt der Store die ID nicht, geschieht nichts.
- **Backup:** Am Code ändert sich nichts. `calm` reist mit den Sitzungen in Export und Import. Beim Import bleibt eine schon vorhandene Sitzung unverändert, auch ihr `calm`, wie bisher.

### 5.2 Wirkung

`calmEffect(sessions, now)` in `src/lib/stats/calm.ts` (reine Funktion):

- **Zeitraum:** die letzten 30 Tage nach lokalem Kalendertag, also heute und die 29 Tage davor (wie `dayKey`).
- **Paare:** Sitzungen im Zeitraum mit `before` *und* `after`. Gibt es weniger als 3 Paare, ist das Ergebnis `null`.
- **Wert:** Mittelwert von `after − before` über alle Paare, dazu die Anzahl der Paare.
- **Aufteilung:** derselbe Mittelwert getrennt für Atmen (`kind: 'breath'`) und Meditieren (`'timer'` und `'guided'`). Eine Art hat einen Wert nur ab 3 Paaren.
- **Einordnung:** Ist der Betrag kleiner als 0,3, gilt es als „etwa so ruhig wie vorher“; sonst als ruhiger (positiv) oder unruhiger (negativ).

### 5.3 Verlauf

`calmTrend(sessions, now)`:

- Mittelwert der `before`-Werte in den letzten 30 Tagen gegen die 30 Tage davor (Tag 30 bis 59 zurück), wieder nach lokalem Kalendertag.
- Jeder Zeitraum braucht mindestens 3 Werte, sonst ist das Ergebnis `null`.
- Ab +0,3 heißt es „ruhiger“, ab −0,3 „unruhiger“, dazwischen „etwa gleich ruhig“.

### 5.4 Texte

`calmEffectLines(effect)` und `calmTrendLine(trend)` in `src/lib/ui/ich-view.ts` bauen die Sätze aus §4 aus den Ergebnissen von §5.2 und §5.3. Es sind reine Funktionen und werden einzeln getestet.

## 6. Motiv `ruhe`

- **Motiv:** sanfte, ruhige Wellen in warmem Orange mit feiner Goldlinie, im Stil der übrigen Motive („zart mit feiner Goldlinie“, `content/motive.json`).
- **Erzeugung:** derselbe Weg wie in M4/M5. Ein Bild mit drei Varianten nebeneinander; der Nutzer wählt eine, sie wird ausgeschnitten und als WebP gespeichert.
- **Größe:** Zielgröße 168 px wie die übrigen Symbole, angezeigt mit 40 px.
- **Eintragen:**
  - die ID `ruhe` in `src/lib/content/motive.ts`;
  - Quelle, Ausschnitt und Größe in `content/motive.json`;
  - im README steigt die Zahl der Motive auf 36.

## 7. Dateien

- **Neu:** `src/lib/stats/calm.ts` (Skala, Wirkung, Verlauf), `src/components/player/CalmCheckIn.svelte` (die Karte mit zwei Reihen), `public/images/motive/ruhe.webp`.
- **Geändert:**
  - `src/lib/stats/schema.ts` (`calm`)
  - `src/lib/stats/persist.ts`, `src/lib/stats/store.svelte.ts` (`recordSession` gibt die ID zurück, `setCalm`)
  - `src/lib/session-wiring.ts`, `src/main.ts`, `src/lib/ui/session-ui.svelte.ts` (`sessionId`)
  - `src/components/player/SessionDone.svelte`, `src/components/player/PlayerShell.svelte`
  - `src/screens/Ich.svelte`, `src/lib/ui/ich-view.ts`
  - `src/lib/content/motive.ts`, `content/motive.json`
  - README

## 8. Tests

**Unit (Vitest):**

- **Schema:**
  - `calm` mit gültigen Werten bleibt erhalten;
  - ungültige Werte (0, 6, 2,5, `'3'`, `null`) fallen weg, die Sitzung bleibt;
  - ein leeres oder ungültiges `calm` entfällt;
  - alte Daten ohne `calm` sind gültig.
- **Store/Persistenz:**
  - `withSession`/`recordSession` liefern die ID bzw. `null` unter 60 s;
  - `setCalm` setzt, ändert und entfernt; ohne Werte entfällt `calm`;
  - eine unbekannte ID ändert nichts.
- **Backup:** Export und Import tragen `calm`; eine vorhandene Sitzung wird nicht überschrieben.
- **`calmEffect`:**
  - unter 3 Paaren `null`;
  - Sitzungen mit nur einem Wert zählen nicht;
  - Grenzen des Zeitraums: heute und 29 Tage zurück zählen, 30 Tage zurück nicht;
  - Aufteilung erst ab 3 Paaren je Art; Timer und geführte Sitzungen zählen beide als Meditieren;
  - Schwelle 0,3.
- **`calmTrend`:** beide Zeiträume brauchen je 3 Vorher-Werte; Grenzen der Zeiträume; Schwelle ±0,3.
- **Texte:** alle Sätze aus §4 wörtlich, dazu „eine Stufe“ bei 1,0, das Komma, die Vorzeichen „+“, „−“ und „±0“ in der Aufteilung.

**e2e (Playwright):**

- **Eine echte 1-Minuten-Atemübung:**
  - die Karte erscheint unter „1 Min geatmet“;
  - „Vorher“ und „Jetzt“ antippen, ändern und zurücknehmen;
  - die gespeicherten Werte in `localStorage` stimmen nach jedem Schritt;
  - nach dem Neuladen sind sie noch da.
- **Kurze Sitzung:** Bei einer beendeten Sitzung unter einer Minute gibt es keine Karte.
- **Bedienung:**
  - Rollen und Namen (`radiogroup` „Vorher“/„Jetzt“, fünf `radio` mit den Wörtern);
  - Pfeiltasten und Leertaste;
  - Tippflächen ≥ 48 px;
  - kein Überlauf bei 360 px und 130 %.
- **„Ich“ mit vorbereiteten Daten:** Einladung; Wirkung ruhiger, unruhiger und etwa gleich; Aufteilung; Grundlage; die drei Verlaufssätze; die Lage der Karte unter dem Kalender und über „Einstellungen“.
- **Backup:** Ein Backup mit Check-ins wird exportiert und importiert, die Sätze stimmen danach.
- **Kartenprüfung (`karten.spec`):** Die Karte „Ruhe“ sieht aus wie die übrigen Karten, das Motiv ist Schmuck.
- Alle bisherigen Tests bleiben grün.

## 9. Handy-Checkliste (für das README)

1. Eine Atemübung von 1 Minute zu Ende atmen: Unter „Gut gemacht.“ erscheint die Karte. „Vorher“ und „Jetzt“ antippen, einen Punkt ändern, einen zurücknehmen: Alles fühlt sich ruhig und eindeutig an, das Wort neben der Reihe stimmt.
2. Eine Sitzung unter einer Minute beenden: keine Karte.
3. Bei großer Schrift (Android-Einstellung) passt alles, der Abschluss lässt sich scrollen.
4. Nach drei Sitzungen mit beiden Werten zeigt „Ich“ die Wirkung, mit Grundlage. Mit Atmen und Meditieren je dreimal kommt die Aufteilung dazu.
5. Backup exportieren und wieder importieren: Die Sätze unter „Ich“ bleiben gleich.
6. Das Motiv „Ruhe“ sieht in allen drei Tageszeiten gut aus.

## 10. Kosten

| Posten | Kosten |
|---|---|
| Motiv `ruhe` (ein Bild mit drei Varianten) | etwa 0,06–0,10 $ |
