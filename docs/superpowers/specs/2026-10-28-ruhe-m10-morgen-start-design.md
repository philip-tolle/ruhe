# Ruhe – Meilenstein 10: Morgen-Start

Stand: 28.10.2026 · Etappe B des Energie-Ausbaus (Übersicht: Spec M9 §1) · baut auf M9 „Energie-Basis“ (main b49fda1) auf.

## 1. Ziel & Rahmen

Ein kurzer, geführter Start in den Tag: einchecken, den Körper wecken, eine Haltung für den Tag wählen, kurz innehalten und die eine wichtigste Sache festlegen. Er dient dem Ziel des Nutzers, seine Energie hochzuhalten und sich stetig weiterzuentwickeln.

**Vom Nutzer entschieden (Brainstorming 27./28.10.2026):**

1. **Bausteine:**
   - Aktivieren (Körper)
   - Check-in und Intention
   - Big Domino mit Sprint
   - Dankbarkeit und Werte
2. **Dauer:** wählbar.
   - **Kurz:** etwa 5 Minuten (Standard).
   - **Lang:** etwa 12–15 Minuten.
3. **Platz:**
   - Morgens steht oben auf „Heute“ eine Karte „Guten Morgen“.
   - Danach zeigt dort den ganzen Tag die Karte „Dein Tag“ deine Intention und deinen Big Domino.
   - Zusätzlich ist der Morgen-Start im Reiter „Energie“ jederzeit startbar.
4. **Intention:**
   - Ein Wort aus Vorschlägen wählen, die zum schwächsten Bereich passen, oder ein eigenes tippen.
   - Eigene Wörter merkt sich die App.
5. **Big Domino:**
   - Steht den Tag über auf „Heute“.
   - Ein Tipp startet einen Fokus-Sprint mit ihm als Vorhaben.
   - Er lässt sich abhaken.
   - Das Abend-Logbuch (M11) greift ihn später auf.
6. **Aktivieren:**
   - Drei neue, kurze Morgen-Übungen.
   - In der langen Variante folgt die Meditation „Guten Morgen“ oder „Tageslicht tanken“.
7. **Dankbarkeit und Werte:**
   - Kurz: ein Satz „Wofür bist du heute dankbar?“.
   - Lang: dazu „Welcher Wert trägt dich heute?“.
   - Gespeichert wird nur lokal.
8. **Stimme:** erst ohne; Hinweiston und Klangschale wie bei den Hacks. Die Stimme kommt mit der späteren Hack-Vertonung.
9. **Ansatz:** ein geführter Ablauf im Vollbild, Schritt für Schritt. Jeder Schritt lässt sich überspringen.
10. **Entwürfe:**
    - Artifact „Morgen-Start Entwürfe“ (https://claude.ai/artifact/AsWzdk7t4qQdPfSNZAUp1V), freigegeben mit „Passt, weiter“.
    - Abweichung zum Entwurf: Die Reihenfolge ist jetzt Check-in vor Aktivieren (Punkt 11), und der Kartentext folgt dem.
11. **Reihenfolge:** Check-in zuerst, dann Aktivieren mit kurzer Nachfrage „Körper jetzt?“. So lernt „Was bei dir wirkt“ (M9 §6.3) auch die Morgen-Übungen kennen.
12. **Abschnitte 1–4** des Designs (Ablauf und Ansicht, Inhalte, Daten und Logik, Technik und Tests) wurden wie vorgestellt freigegeben. Punkt 11 wurde danach nachgeschärft.

### Erfolgskriterien

- Die kurze Variante dauert etwa 5 Minuten. Jeder Schritt lässt sich mit einem Tipp überspringen.
- Nach dem Morgen-Start zeigt „Heute“ bis Mitternacht „Dein Tag“ mit Intention, Big Domino und Dankbarkeit.
- Vom Big Domino zum laufenden Fokus-Sprint ist es ein Tipp.
- Check-in, Morgen-Übung und Meditation landen wie gewohnt in Akku, „Was bei dir wirkt“ und Meditationsstatistik.
- Alle neuen Daten überstehen Neuladen, Backup und Import. Alte Daten bleiben gültig.

### Nicht-Ziele (Etappe B)

- Keine Stimme, keine Push-Benachrichtigungen, kein Server. Die Erinnerung läuft wie in M9 über Wecker oder Kalender (README).
- Kein Abend-Logbuch und kein Wochenrückblick (M11).
- Keine eigenen Prinzipien (M12).
- Kein Bearbeiten früherer Tage.
- Keine Serie, die bei einem verpassten Tag reißt. Gezählt wird nur „an n der letzten 7 Tage“.
- Der Morgen-Start selbst zählt nicht als Meditation. Nur eine darin gehörte geführte Meditation zählt wie sonst.
- Keine neuen Bilder: Die Morgen-Karte nutzt das vorhandene Motiv `vorschlag-morgen`, die Übungen das Körper-Motiv.

### Quellen und Recht

Es gelten die Regeln von M9 §1 („Quellen und Recht“): eigene Worte, Quelle, keine Buchtexte. Intention, Dankbarkeit, Wert und Big Domino sind persönlich. Sie liegen nur lokal auf dem Gerät, nie im Repo, nie in Tests mit echten Daten, nie in Logs oder der Medien-Anzeige.

## 2. Was man sieht

### 2.1 „Heute“

Von oben nach unten: Begrüßung, **Morgen-Karte**, „Dein Akku“ (M9), „Vorschlag des Tages“, übrige Karten wie bisher.

**Karte „Guten Morgen“.** Sie steht da von 4:00 bis 10:59 Ortszeit, solange es heute keinen Morgen-Eintrag gibt.
- Kleinüberschrift „Morgen-Start“, Titel „Starte wach in den Tag“, Satz „Einchecken, aktivieren, ausrichten.“
- Motiv `vorschlag-morgen` (80 px, `alt=""`).
- Zwei Knöpfe:
  - „Kurz · 5 Min“, gefüllt
  - „Lang · 15 Min“, umrandet
- Die Karte hat einen Goldrand wie die Reset-Karte.

**Karte „Dein Tag“.** Sie steht da, sobald es für heute einen Morgen-Eintrag gibt, bis Mitternacht, und ersetzt „Guten Morgen“.
- Kleinüberschrift „Dein Tag“. Rechts klein „Morgen-Start an {n} der letzten 7 Tage“.
- „Heute will ich sein:“ und darunter groß die Intention, nur wenn eine gewählt ist.
- **Big Domino.** Der Block erscheint nur, wenn einer gesetzt ist:
  - Kleinüberschrift „Big Domino“, daneben der Text.
  - Davor ein runder Abhak-Knopf mit dem Namen „Big Domino erledigt“. Er ist ein Umschalter: ein Tipp setzt den Haken, ein zweiter nimmt ihn zurück. Erledigt wird der Text durchgestrichen und gedämpft.
  - Knopf „Sprint starten · {n} Min“. Er fehlt, wenn der Big Domino erledigt ist.
- „Dankbar für: {Satz}“, nur wenn einer da ist.
- Ist alles übersprungen, steht unter der Kleinüberschrift „Morgen-Start erledigt.“
- Beide Karten rechnen beim Fortsetzen der App neu, über dieselbe Minuten-Uhr wie der Akku (M9, R15).

### 2.2 Reiter „Energie“

Die Karte „Morgen-Start“ steht zwischen Kopf und „Dein Akku“:
- Titel „Morgen-Start“, Satz „Kurz oder lang, jederzeit.“, darunter die Knöpfe „Kurz · 5 Min“ und „Lang · 15 Min“.
- Gibt es heute schon einen Eintrag, steht statt des Satzes „Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.“

In „Deine Woche“ steht unter der Fokus-Zeile „Morgen-Start an {n} der letzten 7 Tage“, wenn n mindestens 1 ist.

### 2.3 Der Ablauf

Der Ablauf ist ein Vollbild mit dem Dialognamen „Morgen-Start“, gezeichnet wie ein Player (Himmel der aktuellen Stimmung).

**Kopfzeile:**
- links „×“ mit dem Namen „Morgen-Start beenden“
- in der Mitte die Fortschrittspunkte mit dem Namen „Schritt {i} von {n}“
- rechts „Überspringen“

Bei jedem Schrittwechsel erhält die Überschrift des neuen Schritts den Fokus.

| # | Kurz | Lang |
|---|---|---|
| 1 | Check-in | Check-in |
| 2 | Aktivieren | Aktivieren |
| 3 | Intention | Vertiefen |
| 4 | Dankbarkeit | Intention |
| 5 | Big Domino | Dankbarkeit und Wert |
| 6 | – | Big Domino |
| danach | Abschluss | Abschluss |

**Check-in**
- Kleinüberschrift „Check-in“, Titel „Wie voll ist dein Akku?“, Zeile „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
- Vier Reihen wie im Check-in-Blatt (M9 §3.3).
- „Weiter“ ist aktiv, wenn alle vier gesetzt sind. Es speichert einen normalen Energie-Check-in.

**Aktivieren**
- Kleinüberschrift „Aktivieren“, Titel „Wach werden“, Zeile „Erst der Körper, dann der Kopf.“
- Darunter die Übungskarte mit:
  - Chip „Körper · {n} Min“
  - Titel und Nutzen-Satz
  - Körper-Motiv (72 px)
  - die nummerierten Schritte
- Knöpfe „Starten · {m:ss}“ und „Andere Übung“.
- „Starten“ spielt die Übung im bekannten Hack-Player (M9 §3.5). Der Ablauf tritt so lange zurück.
- **Ende ab 30 s, auch vorzeitig:**
  - Der Player zeigt die Wirkungsfrage von M9: „Körper jetzt?“ in einer Reihe, weil der Check-in den Vorher-Wert liefert; ohne Check-in zwei Reihen.
  - Statt „Fertig“ und „Noch einmal“ gibt es einen Knopf „Weiter“. Er schließt den Player, und der Ablauf geht zum nächsten Schritt.
- **Ende unter 30 s:** Es wird nichts gespeichert. Der Ablauf bleibt bei „Aktivieren“.

**Vertiefen (nur lang)**
- Kleinüberschrift „Vertiefen“, Titel „Noch fünf Minuten für dich“.
- Zwei Wahlknöpfe:
  - **„Guten Morgen“ mit „Meditation · 5 Min“:** Startet die geführte Meditation im bekannten Player. Kann sie gerade nicht spielen (nicht offline gespeichert und kein Netz), ist sie gesperrt mit „Nicht offline verfügbar“.
  - **„Tageslicht tanken“ mit „Draußen · 5 Min“:** Vor 7:00 steht darunter „Am besten, sobald es hell ist.“
- Ende der Meditation:
  - Sie zählt wie jede Meditation.
  - Statt ihres Abschlusses (mit Ruhe-Check-in) geht der Ablauf zum nächsten Schritt.
  - Wird sie vorzeitig beendet, gilt dasselbe wie sonst für das Speichern, und der Ablauf geht weiter.
- „Tageslicht tanken“ endet wie „Aktivieren“.

**Intention**
- Kleinüberschrift „Intention“, Titel „Wie willst du heute sein?“.
- Mit Check-in steht darunter „Dein {Bereich}-Akku ist gerade am niedrigsten.“
- Eine Radiogruppe „Vorschläge“ mit sechs Wörtern (§3.2).
- Darunter „Deine Wörter“ mit bis zu drei eigenen Wörtern, nur wenn es welche gibt.
- Feld „Eigenes Wort“, höchstens 40 Zeichen. Tippen hebt die Auswahl auf; eine Auswahl leert das Feld.
- Über „Weiter“ steht „Heute will ich {Wort} sein.“ oder „Wähle ein Wort oder tippe ein eigenes.“

**Dankbarkeit (und Wert)**
- Kleinüberschrift „Dankbarkeit“, Titel „Wofür bist du heute dankbar?“.
- Feld „Dein Satz“ mit Platzhalter „z. B. ein Mensch, ein Moment, etwas Kleines“, höchstens 120 Zeichen.
- Nur lang:
  - darunter „Welcher Wert trägt dich heute?“
  - eine Radiogruppe „Werte“ mit den zwölf Werten (§3.3)
  - „Deine Werte“, bis zu drei eigene
  - Feld „Eigener Wert“, höchstens 40 Zeichen

**Big Domino**
- Kleinüberschrift „Big Domino“, Titel „Was ist heute dein Big Domino?“, Zeile „Die eine Sache, die vieles andere leichter macht.“
- Hinweis klein: „Frag dich: Welche eine Sache macht heute vieles andere leichter oder unnötig?“
- Gibt es einen offenen Big Domino der letzten drei Tage (§4.3), erscheint ein Kasten „Von gestern offen“ mit dessen Text und „Übernehmen“. „Übernehmen“ füllt das Feld.
- Feld „Dein Big Domino“ (mehrzeilig), höchstens 80 Zeichen, Zähler „{n} / 80“.

**Abschluss**
- Eine Klangschale ertönt (einzelner Anschlag, ohne Hintergrund), wenn sie geladen ist; sonst ist es still.
- Kleinüberschrift „Geschafft“, Titel „Dein Tag“, Motiv `vorschlag-morgen` (96 px).
- Eine Karte mit den gesetzten Angaben:
  - „Heute will ich sein:“
  - „Big Domino“
  - „Dankbar für“
  - „Wert des Tages“
- Knöpfe:
  - „Fokus-Sprint starten · {n} Min“, nur mit Big Domino. Er startet den Sprint mit `settings.focus` und dem Big Domino als Vorhaben.
  - „Fertig“.
- Der Morgen-Eintrag wird beim Erreichen des Abschlusses gespeichert (§4.2).

**Beenden**
- „×“ und die Zurück-Geste fragen „Morgen-Start beenden?“ mit „Beenden“ und „Weiter machen“, wie die Rückfrage der Sitzungen.
- Beenden schließt den Ablauf ohne Morgen-Eintrag. Schon gespeicherte Check-ins, Hack-Läufe und Meditationen bleiben.
- Im Abschluss schließen „Fertig“, „×“ und die Zurück-Geste ohne Rückfrage.

**Bedienbarkeit**
- Tippflächen mindestens 44 × 44 px.
- Bei 360 px und 130 % Schrift kein seitliches Scrollen. Lange Wörter brechen um.
- Die Knöpfe des Abschlusses und des ersten Schritts sind gegen Doppeltipps geschützt (`tapArming`).

## 3. Inhalte

### 3.1 Drei Morgen-Übungen

Die Übungen kommen in `content/hacks.json`, im Format von M9 §5.1. Damit gilt:
- Bereich `koerper`, Führung `schritte`, Motiv `energie-koerper`.
- Sie stehen auch in der Bibliothek, die damit 19 Karten hat.

Die Texte schreibt die Umsetzung in eigenen Worten. Der Nutzer gibt sie frei, bevor sie in die Oberfläche kommen (wie M9 Task 1).

| id | Titel | Min | Schritte (Sekunden, Symbol) | Fenster | Quelle (Richtung) |
|---|---|---|---|---|---|
| `strecken` | Strecken & Aufrichten | 2 | 1. räkeln (30, liegen) 2. lang machen, zur Seite dehnen (30, bewegung) 3. Wirbel für Wirbel aufrichten (30, bewegung) 4. Schultern kreisen (30, bewegung) | – | allgemeine Mobilisation; Energie-Management nach Loehr/Schwartz |
| `wasser-licht` | Wasser & Licht | 2 | 1. ein Glas Wasser (30, wasser) 2. ans Fenster oder raus, fünf tiefe Atemzüge (60, sonne) 3. Blick in die Ferne (30, auge) | 4–12 | Morgenlicht und innere Uhr, angelehnt an Huberman |
| `wach-klopfen` | Wach-Klopfen | 1 | 1. Arme und Beine abklopfen (20, bewegung) 2. Brust und Rücken (20, bewegung) 3. ausschütteln (20, bewegung) | – | angelehnt an Qigong-Übungen |

- **„Warum es wirkt“:** vorsichtig formuliert („kann …“), ohne medizinische Versprechen.
- **„Hinweis“:**
  - für `wach-klopfen`: sanft klopfen, schmerzende Stellen auslassen
  - für `strecken`: nur so weit, wie es angenehm ist
- **Übung des Tages:** Die Reihenfolge ist `strecken`, `wasser-licht`, `wach-klopfen`. Am Tag `t` (Tage seit 1.1.1970, Ortszeit) ist es die Übung `t mod 3`.
- **„Andere Übung“:** nimmt die nächste in dieser Reihenfolge, auch außerhalb ihres Fensters, und kehrt nach der dritten zur ersten zurück.
- **Fenster von `wasser-licht`:** gilt nur für den Jetzt-Reset (M9 §6.7). Der Morgen-Start bietet die Übung immer an.

### 3.2 Intentions-Wörter

Sechs Vorschläge, je nach schwächstem Bereich (`weakestArea`, M9) des Check-ins aus Schritt 1. Ohne diesen Check-in gilt ein frischer Check-in (M9 §6.1). Ohne beide gilt die letzte Zeile.

| Schwächster Bereich | Vorschläge |
|---|---|
| Körper | geerdet, kraftvoll, leicht, beweglich, sanft mit mir, achtsam |
| Gefühl | gelassen, freundlich, zuversichtlich, verbunden, geduldig, heiter |
| Geist | klar, fokussiert, wach, neugierig, gesammelt, entschieden |
| Sinn | mutig, ausgerichtet, dankbar, großzügig, echt, entschlossen |
| ohne Check-in | klar, gelassen, mutig, freundlich, fokussiert, dankbar |

**„Deine Wörter“:** die bis zu drei jüngsten eigenen Intentionen, also Intentionen früherer Einträge, die in keiner Vorschlagsliste stehen. Ohne Doppelte, Groß- und Kleinschreibung zählt nicht, die jüngste zuerst.

### 3.3 Werte (nur lang)

Geduld, Mut, Klarheit, Freundlichkeit, Ehrlichkeit, Fokus, Gelassenheit, Großzügigkeit, Neugier, Verlässlichkeit, Disziplin, Leichtigkeit.

„Deine Werte“: bis zu drei eigene, nach derselben Regel wie die eigenen Wörter. Später (M12) kommen die eigenen Prinzipien dazu.

## 4. Daten und Logik

### 4.1 Speicher

In `localStorage['ruhe.v1']`; `version` bleibt 1. Neu ist die freiwillige Liste `mornings`. Sie fehlt, solange sie leer ist, und ist nach `day` sortiert.

```ts
interface MorningEntry {
  day: string          // Tag in Ortszeit, 'YYYY-MM-DD'; je Tag höchstens ein Eintrag
  at: string           // ISO-Zeitpunkt, an dem der Abschluss erreicht wurde
  variant: 'kurz' | 'lang'
  intention?: string   // getrimmt, 1–40 Zeichen
  gratitude?: string   // getrimmt, 1–120 Zeichen
  value?: string       // nur lang; getrimmt, 1–40 Zeichen
  domino?: string      // getrimmt, 1–80 Zeichen
  dominoDone?: string  // ISO-Zeitpunkt des Abhakens; nur mit domino
}
```

**Laden:** Jeder Eintrag wird einzeln geprüft. Ungültige Einträge fallen weg, die übrigen bleiben. Zu lange Texte werden gekürzt, leere entfallen. Gibt es zwei Einträge für einen Tag, gilt der mit dem späteren `at`.

### 4.2 Speichern

- **Wann:** Beim Erreichen des Abschlusses, auch wenn alle Schritte übersprungen wurden. Der Tag ist der Tag dieses Zeitpunkts.
- **Zweiter Durchgang am selben Tag:** Er ersetzt den Eintrag. `dominoDone` bleibt nur, wenn der neue Big Domino derselbe Text ist (getrimmt, ohne Unterschied in Groß- und Kleinschreibung).
- **Abhaken:** Der Knopf auf „Dein Tag“ setzt `dominoDone` auf jetzt bzw. entfernt es.
- **Was der Ablauf sonst speichert:**
  - Der Check-in aus Schritt 1 ist ein normaler `energyCheckins`-Eintrag (M9).
  - Übungen und „Tageslicht tanken“ sind normale `hackRuns` mit der Wirkungsfrage von M9.
  - „Guten Morgen“ ist eine normale Sitzung.
  - Der Morgen-Eintrag verweist auf nichts davon.

### 4.3 Abgeleitete Werte (reine Funktionen, `now` als Eingabe)

- **`morningCard(entries, now)`:**
  - `'dein-tag'`, wenn es einen Eintrag für heute gibt;
  - sonst `'guten-morgen'` von 4:00 bis 10:59;
  - sonst `null`.
- **`exerciseOfDay(now)`** und **`nextExercise(id)`** nach §3.1.
- **`suggestions(area | null)`** nach §3.2; **`ownWords(entries)`** und **`ownValues(entries)`** nach §3.2/§3.3.
- **`openDomino(entries, now)`:** der Big Domino des jüngsten Eintrags vor heute, wenn dieser höchstens drei Tage zurückliegt, einen Big Domino hat und `dominoDone` fehlt; sonst `null`.
- **`morningCount(entries, now)`:** Zahl der Tage mit Eintrag unter heute und den sechs Tagen davor.

### 4.4 Backup und Import

- `mornings` gehört ins Backup.
- **Import:** Er führt je Tag zusammen. Bei gleichem Tag gilt der spätere `at`, und ein gleicher Eintrag zählt nicht als neu.
- **Meldung:** Neue Morgen-Einträge zählen in die bestehende Energie-Meldung („ Dazu {n} neue Energie-Einträge.“, M9).
- Ein altes Backup ohne `mornings` lässt die Morgen-Einträge des Geräts unverändert.

### 4.5 Statistik

Der Morgen-Start zählt nicht in Sitzungen, Minuten, Serie, Kalender, „Zuletzt genutzt“ und den Ruhe-Check-in. Eine im Ablauf gehörte Meditation zählt wie jede Meditation, auch in „Zuletzt genutzt“.

## 5. Technik

| Teil | Ort | Inhalt |
|---|---|---|
| Inhalte | `content/hacks.json` | 3 neue Hacks (§3.1) |
| Wörter und Logik | `src/lib/morning/words.ts`, `src/lib/morning/logic.ts` | Listen aus §3.2/§3.3 und Übungsreihenfolge, Funktionen aus §4.3 |
| Daten | `src/lib/stats/schema.ts`, `persist.ts`, `backup.ts`, `store.svelte.ts` | `MorningEntry`, Prüfen, `saveMorning`, `toggleDomino`, Zusammenführen |
| Ablauf-Zustand | `src/lib/ui/morning-ui.svelte.ts` | offen, Variante, Schritt, Entwurf der Eingaben, wartet auf Übung bzw. Meditation |
| Oberfläche | `src/components/morning/…` | `MorningCard` (Heute und Energie), `MorningFlow` (Vollbild) mit je einem Baustein pro Schritt, Wortauswahl als Radiogruppe |
| Einbau | `Heute.svelte`, `Energie.svelte`, `WeekCard.svelte`, `App.svelte`, `HackEffect.svelte`, `PlayerShell` bzw. `main.ts` | Karten, Wochenzeile, Ablauf an der App-Wurzel außerhalb von `inert`, Ende im Ablauf |

**Ablauf und Player**
- Startet der Ablauf eine Übung oder Meditation, merkt `morning-ui` sich das. Der Ablauf ist während des Players verborgen, und die App bleibt unter dem Player unerreichbar wie sonst.
- **Hack-Ende im Ablauf:** `HackEffect` zeigt statt „Fertig“ und „Noch einmal“ einen Knopf „Weiter“. Er ruft `clearDone` und führt den Ablauf zum nächsten Schritt.
- **Meditations-Ende im Ablauf:** Der Abschluss-Bildschirm entfällt. Der Ablauf ruft `clearDone` und geht weiter.
- **Endet ein Lauf ohne Ende-Ansicht** (Hack unter 30 s), kehrt der Ablauf zu seinem Schritt zurück.
- **Klangschale im Abschluss:** ein einzelner Anschlag über die Audio-Engine, wenn die Klangschale geladen ist. Der Plan legt fest, über welche Schnittstelle.
- **„Jetzt“:** Alle Ansichten rechnen mit der Minuten-Uhr `appNow()` (M9, R15).

**Keine Kosten:** keine Bild- oder Sprach-Generierung.

## 6. Grenzfälle

| Fall | Erwartung |
|---|---|
| App wird um 11:02 aus dem Hintergrund fortgesetzt, ohne Morgen-Eintrag | „Guten Morgen“ ist weg (Minuten-Uhr, ohne Neuladen) |
| Morgen-Start um 14:00 aus „Energie“ | „Dein Tag“ erscheint auf „Heute“ bis Mitternacht |
| Ablauf über Mitternacht (Start 23:55, Abschluss 0:03) | Eintrag gehört zum neuen Tag (Tag des Abschlusses) |
| Zweiter Durchgang am selben Tag mit gleichem Big Domino | Eintrag ersetzt, Haken bleibt |
| Check-in übersprungen | Vorschläge aus frischem Check-in oder „ohne Check-in“; Übung fragt zwei Reihen „vorher“/„jetzt“ |
| Übung nach 10 s beendet | nichts gespeichert, Ablauf bleibt bei „Aktivieren“ |
| „Guten Morgen“ offline und nicht gespeichert | Knopf gesperrt, „Nicht offline verfügbar“, „Tageslicht tanken“ wählbar |
| Neuladen mitten im Ablauf | Ablauf ist zu; bis dahin Gespeichertes bleibt; kein Morgen-Eintrag |
| 80 Zeichen Big Domino ohne Leerzeichen | bricht um, kein seitliches Scrollen (Ablauf, „Dein Tag“, Sprint-Player) |
| Backup zweimal importiert | keine Doppelten, keine Meldung über neue Morgen-Einträge beim zweiten Mal |

## 7. Tests

- **Unit, `tests/unit/morning-logic.test.ts` (TZ Europe/Berlin):**
  - `morningCard` an 3:59, 4:00, 10:59, 11:00 und Mitternacht
  - `exerciseOfDay` und `nextExercise`
  - `suggestions` je Bereich und ohne
  - `ownWords`: Doppelte, Groß- und Kleinschreibung, Grenze 3
  - `openDomino`: gestern offen, erledigt, vier Tage alt, heute
  - `morningCount`, auch über die Zeitumstellung
- **Unit, Daten:** Laden kaputter und doppelter Einträge, Kürzen, `saveMorning` ersetzt den Eintrag (Haken bleibt oder fällt), `toggleDomino`, Import ohne Doppelte, neuerer `at` gewinnt, altes Backup.
- **Unit, Inhalte:** Die bestehende Prüfung von `hacks.json` deckt die drei neuen Hacks ab. Die Zahl der Karten steigt auf 19.
- **E2E, `tests/e2e/morgen.spec.ts`:**
  - Karte „Guten Morgen“ um 7:00 sichtbar, um 11:00 nicht (`page.clock` nur für die Uhrzeit, M9 R1)
  - kurzer Ablauf: Check-in, Übung überspringen, Wort wählen, Satz, Big Domino; danach „Dein Tag“ mit allen Angaben, gespeicherter Eintrag und Check-in
  - langer Ablauf mit Wert und Übernahme des Big Domino von gestern
  - Abhaken und Zurücknehmen
  - „Sprint starten“ übernimmt den Big Domino als Vorhaben (Sprint gleich beenden)
  - „Wach-Klopfen“ in Echtzeit (60 s + Ausklang): „Körper jetzt?“ in einer Reihe, „Weiter“ führt zur Intention, der Lauf hat `before` und `after`
  - Beenden mit Rückfrage: kein Eintrag
  - Fortsetzen nach 11 Uhr per `visibilitychange`
  - 360 px und 130 % ohne seitliches Scrollen
- **E2E, bestehende Tests:** Zählen von Karten auf „Heute“ und in der Bibliothek angleichen (16 → 19).

## 8. Abnahme (Handy-Checkliste Meilenstein 10)

1. Morgens vor 11 Uhr steht „Guten Morgen“ oben auf „Heute“, nach 11 Uhr nicht mehr (auch wenn die App im Hintergrund war).
2. Kurzer Morgen-Start in etwa 5 Minuten, jeder Schritt überspringbar.
3. Die Morgen-Übung läuft im Hack-Player, danach „Körper jetzt?“ und weiter im Ablauf.
4. Lange Variante mit „Guten Morgen“ (Stimme und Hintergrund wie gewohnt) oder „Tageslicht tanken“.
5. „Dein Tag“ zeigt Intention, Big Domino und Dankbarkeit bis Mitternacht.
6. Abhaken; „Sprint starten“ startet den Sprint mit dem Big Domino als Vorhaben.
7. Am nächsten Morgen bietet die App einen offenen Big Domino zur Übernahme an.
8. Backup exportieren und importieren: Morgen-Einträge bleiben, nichts doppelt.
9. Wecker-Erinnerung für den Morgen nach README eingerichtet.

## 9. Annahmen

- 4:00 bis 10:59 als Morgen-Fenster passt zum Tagesrhythmus des Nutzers. Die Werte stehen als Konstanten in `logic.ts`.
- Die Klangschale im Abschluss ist erwünscht. Ist sie nicht geladen, bleibt es still, ohne Hinweis.
- Eigene Wörter und Werte werden aus den Einträgen abgeleitet, nicht als Einstellung gespeichert.
