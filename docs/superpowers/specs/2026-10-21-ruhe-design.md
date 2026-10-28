# Ruhe – Design-Spezifikation

**Datum:** 21.10.2026
**Status:** Entwurf, wartet auf Freigabe
**Repo:** https://github.com/philip-tolle/ruhe
**Adresse der App:** https://philip-tolle.github.io/ruhe/

---

## 1. Ziel & Rahmen

**Was:** Eine Meditations-App nach dem Vorbild von Calm, ausschließlich für den persönlichen Gebrauch.

**Für wen:** Eine Person (der Besitzer des Repos), auf einem Android-Handy.

**Form:** Installierbare Web-App (PWA), gehostet auf GitHub Pages. Wird in Chrome über „Zum Startbildschirm hinzufügen“ installiert und verhält sich danach wie eine normale App (eigenes Icon, keine Browserleiste, offline nutzbar).

**Sprache:** Oberfläche und alle Inhalte auf Deutsch, Ansprache in der Du-Form.

### Erfolgskriterien

1. Die App lässt sich auf dem Android-Startbildschirm installieren und startet direkt in die App.
2. Nach dem ersten Öffnen funktionieren Timer, Atemübungen und Klänge ohne Internet; geführte Meditationen, sobald sie gespeichert sind.
3. Die Stimme der geführten Meditationen klingt so angenehm, dass man sie gern wiederholt.
4. Naturklänge laufen bei ausgeschaltetem Bildschirm durch, bis der Sleep-Timer sie sanft ausblendet.
5. Play/Pause funktioniert über die Android-Benachrichtigung und den Sperrbildschirm.

### Nicht-Ziele

- Kein Login, keine Konten, keine Cloud-Synchronisation, kein Server.
- Keine Bezahlfunktion, kein App-Store-Eintrag, keine APK.
- Keine täglichen Erinnerungs-Benachrichtigungen (bräuchte einen Push-Server).
- Keine geführten Schlaf-Meditationen (Schlaf wird über Naturklänge + Sleep-Timer abgedeckt).
- Keine ausführliche Statistik (Stimmungstagebuch, Diagramme).
  *Ergänzung vom 24.10.2026 (Meilenstein 6):* Der Ruhe-Check-in (nach einer Sitzung „Vorher“ und „Jetzt“ in fünf Stufen, unter „Ich“ zwei Sätze zu Wirkung und Verlauf) ist kein Stimmungstagebuch; es gibt weiter keine Diagramme und keine Liste. Siehe `docs/superpowers/specs/2026-10-24-ruhe-m6-ruhe-check-in-design.md`.
  *Ergänzung vom 27.10.2026 (Meilenstein 9):* Das Wochenraster unter „Energie“ (die letzten 7 Tage × 4 Bereiche, ein Feld je Tag und Bereich aus den Energie-Check-ins) ist die einzige Verlaufsgrafik der App; Kurvendiagramme, Listen und ein Tagebuch bleiben Nicht-Ziel. Hacks und Sprints zählen nicht in die Meditationsstatistik. Siehe `docs/superpowers/specs/2026-10-27-ruhe-m9-energie-basis-design.md` §1 (Nicht-Ziele) und §6.4.
- Kein iOS-/Desktop-Feinschliff: Ziel ist Chrome auf Android. Andere Browser dürfen funktionieren, werden aber nicht gezielt getestet.

### Rahmenbedingungen

- Das Repo ist **öffentlich** (Voraussetzung für kostenloses GitHub Pages). Texte und Audiodateien sind damit theoretisch für jeden abrufbar – das ist akzeptiert.
- Persönliche Daten (Statistik, Einstellungen) liegen **nur** lokal auf dem Handy, nie im Repo.

---

## 2. Technik

| Baustein | Wahl | Begründung |
|---|---|---|
| Build | Vite | Schnell, schlank, Standard |
| UI | Svelte 5 + TypeScript | Komponenten ohne Ballast, sehr kleines Bundle |
| Offline | `vite-plugin-pwa` (Workbox) | Erprobter Service Worker inkl. Range-Requests für gecachte Audiodateien |
| Audio | Web Audio API, kein Framework | Volle Kontrolle über Mischung und Zeitplanung |
| Schriften | lokal gebündelt über npm (`@fontsource`) | Keine Abhängigkeit von Google Fonts, offline verfügbar |
| Unit-Tests | Vitest | Passt zu Vite |
| Browser-Tests | Playwright (Chromium, Handy-Viewport) | Chromium ist in der Entwicklungsumgebung vorinstalliert |
| Deployment | GitHub Actions → GitHub Pages | Push auf `main` = neue Version online |
| Audio-Erzeugung | Node-Skripte + ffmpeg + ElevenLabs-API | Läuft nur in der Entwicklungsumgebung, nicht in der App |

Vite `base` ist `/ruhe/`, passend zur Pages-Adresse.

---

## 3. Bildschirme & Navigation

Unten eine feste Leiste mit fünf Reitern. Die Android-Zurück-Geste schließt zuerst offene Ebenen (Player, Dialoge) und verlässt erst dann die App (über `history.pushState` beim Öffnen von Ebenen).

### 3.1 Heute

- **Begrüßung** nach Tageszeit: „Guten Morgen“ (5–11 Uhr), „Guten Tag“ (11–17 Uhr), „Guten Abend“ (17–5 Uhr).
- **Serie** (Tage in Folge) gut sichtbar.
- **Drei Schnellstart-Karten:**
  1. *Vorschlag des Tages:* eine geführte Meditation passend zur Tageszeit – morgens *Fokus & Energie*, tagsüber *Stress & Ruhe*, abends *Einsteiger & Achtsamkeit*. Innerhalb der Kategorie wird nach Kalendertag rotiert, damit der Vorschlag über den Tag stabil bleibt.
  2. *Zuletzt genutzt:* die letzte geführte Meditation, Timer- oder Atem-Sitzung erneut starten (gleiche Meditation, gleiche Timer-Einstellungen bzw. gleiche Übung und Dauer). Klänge zählen hier nicht. Ohne bisherige Sitzung: „Ankommen im Atem“.
  3. *3 Min durchatmen:* startet direkt „Kohärentes Atmen“ für 3 Minuten.

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Der „Vorschlag des Tages“ und der Ersatz „Ankommen im Atem“ sind umgesetzt. Die Karten stehen in dieser Reihenfolge: Vorschlag des Tages, Zuletzt genutzt, 3 Min durchatmen, Zur Ruhe kommen. Ohne bisherige Sitzung zeigt „Zuletzt genutzt“ „Ankommen im Atem“ mit dem Knopf „Jetzt starten“ (es gibt noch nichts zu wiederholen); kennt der Katalog die gemerkte Meditation nicht (mehr), gilt derselbe Ersatz. Offline folgen die geführten Starts auf „Heute“ der Regel aus „Meditieren“: Sie sind gesperrt und nennen „Nicht offline verfügbar“, solange die Datei nicht gespeichert ist.

*Ergänzung vom 22.10.2026 (Meilenstein 4):* Die Karten „3 Min durchatmen“ und „Zur Ruhe kommen“ entfallen. An ihre Stelle tritt eine Karte „Aktivitäten“ mit drei Zeilen: „Meditieren“ („Geführt oder mit Timer“) wechselt zum Reiter Meditieren, „Atemübung“ („3 Min kohärent atmen“) startet wie bisher Kohärentes Atmen für 3 Minuten und merkt es als zuletzt genutzt, „Klänge“ („Zur Ruhe kommen“) wechselt zum Reiter Klänge. Die Reihenfolge ist nun: Begrüßung und Serie, Vorschlag des Tages (mit dem gemalten Motiv der Tageszeit), Zuletzt genutzt, Aktivitäten. Näheres in `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §4.1.

*Ergänzung vom 24.10.2026 (Meilenstein 7):* Der Vorschlag des Tages kommt je Tageszeit aus zwei Themen: morgens *Fokus & Energie* und *Achtsam im Alltag*, tagsüber *Stress & Ruhe* und *Gefühle & Loslassen*, abends *Einsteiger & Achtsamkeit* und *Mitgefühl & Freundlichkeit*. Rotiert wird nach Kalendertag über die Meditationen beider Themen zusammen, in Katalog-Reihenfolge. Siehe §3.2 und `docs/superpowers/specs/2026-10-24-ruhe-m7-meditationen-design.md` §6.

*Ergänzung vom 28.10.2026 (Meilenstein 10):* Über „Dein Akku“ (M9) steht oben auf „Heute“ die Morgen-Karte. Von 4:00 bis 10:59 Ortszeit zeigt sie, solange es für heute keinen Morgen-Eintrag gibt, die Karte „Guten Morgen“ (so heißt sie in dieser Spec, nicht die Begrüßung; sichtbar: Kleinüberschrift „Morgen-Start“, Titel „Starte wach in den Tag“, Knöpfe „Kurz · 5 Min“ und „Lang · 15 Min“, Motiv `vorschlag-morgen`). Sobald es für heute einen Morgen-Eintrag gibt, ersetzt sie bis Mitternacht „Dein Tag“ mit der Intention, dem Big Domino (abhakbar, mit „Sprint starten“) und der Dankbarkeit; zu anderen Zeiten steht dort nichts. Die Reihenfolge ist nun: Begrüßung und Serie, Morgen-Karte, Dein Akku, Vorschlag des Tages, Zuletzt genutzt, Aktivitäten. Der Morgen-Start selbst ist ein geführter Vollbild-Ablauf, den die Karte und der Reiter „Energie“ starten. Siehe `docs/superpowers/specs/2026-10-28-ruhe-m10-morgen-start-design.md` §2.1 und §2.3.

### 3.2 Meditieren

- Oben eine Karte **Meditations-Timer** (öffnet die Timer-Einstellungen).
- Darunter die **geführten Meditationen**, gruppiert nach Thema, jeweils mit Titel, Dauer und ✓, wenn offline verfügbar.

**Katalog (Arbeitstitel, Ziel-Längen):**

| Thema | Meditation | Länge |
|---|---|---|
| Einsteiger & Achtsamkeit | Ankommen im Atem | 5 Min |
| Einsteiger & Achtsamkeit | Gedanken wie Wolken | 8 Min |
| Einsteiger & Achtsamkeit | Bodyscan im Sitzen | 10 Min |
| Stress & Ruhe | Drei-Minuten-Atempause | 3 Min |
| Stress & Ruhe | Nach einem vollen Tag | 10 Min |
| Stress & Ruhe | Vor einem wichtigen Termin | 5 Min |
| Fokus & Energie | Guten Morgen | 5 Min |
| Fokus & Energie | Fokus vor der Arbeit | 7 Min |
| Fokus & Energie | Energie in der Mittagspause | 8 Min |

**Meditations-Timer:**

- Dauer: 5 / 10 / 15 / 20 / 30 Min oder frei (1–120 Min).
- 10 Sekunden Vorlauf zum Ankommen (abschaltbar). Der Vorlauf zählt weder zur gewählten Dauer noch zur Statistik; die Dauer beginnt mit der ersten Klangschale.
- Klangschale 1× zu Beginn, 3× am Ende.
- Intervall-Klangschale: aus / alle 1 / 2 / 5 / 10 Min. Fällt eine Intervall-Schale auf das Ende, entfällt sie zugunsten der End-Schalen.
- Optionaler Hintergrundklang (einer der 8 Klänge).
- Die zuletzt gewählten Einstellungen werden gemerkt.

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Ist die Datei einer geführten Meditation noch ein Platzhalter (leise Töne statt Sprache), steht neben ihr in der Liste der Chip „Vorabversion“. Das Manifest führt dafür das Feld `placeholder`.

*Ergänzung vom 24.10.2026 (Meilenstein 7):* Der Katalog umfasst jetzt 18 Meditationen in 6 Themen. Neu sind die Themen *Mitgefühl & Freundlichkeit* (Freundlich mit dir 8 Min, Liebevolle Güte 10 Min), *Gefühle & Loslassen* (Ein schweres Gefühl begleiten 10 Min, Wenn die Gedanken kreisen 7 Min) und *Achtsam im Alltag* (Gehmeditation 10 Min, Achtsam essen 5 Min). Die bisherigen Themen bekommen je eine Meditation dazu: Klänge hören (7 Min), Die Schultern sinken lassen (8 Min) und Atemzüge zählen (6 Min). Die Themen stehen in dieser Reihenfolge untereinander, jedes mit eigenem Motiv; benachbarte Themen haben unterschiedliche Farbflächen. Näheres in `docs/superpowers/specs/2026-10-24-ruhe-m7-meditationen-design.md`.

### 3.3 Atmen

Sechs Übungen, jeweils mit Dauer 1 / 3 / 5 / 10 Min. Nach Ablauf der Zeit wird der laufende Atemzyklus noch zu Ende geführt.

| Übung | Ablauf | Zyklus |
|---|---|---|
| 4-7-8 | ein 4 s · halten 7 s · aus 8 s | 19 s |
| Box-Atmung | ein 4 s · halten 4 s · aus 4 s · halten 4 s | 16 s |
| Kohärentes Atmen | ein 5,5 s · aus 5,5 s | 11 s |
| Langes Ausatmen | ein 4 s · aus 6 s | 10 s |
| Physiologischer Seufzer | ein 3 s · nachatmen 1 s · aus 6 s | 10 s |
| Wechselatmung | links ein 4 s · rechts aus 4 s · rechts ein 4 s · links aus 4 s | 16 s |

*Ergänzung vom 21.10.2026 (auf Nutzerwunsch):* Langes Ausatmen, Physiologischer Seufzer und Wechselatmung kamen dazu. Für sie kann eine Phase einen eigenen Text tragen („Nachatmen“, „Links einatmen“ …), und beim Seufzer wächst der Kreis beim Nachatmen noch ein Stück weiter.

- **Anzeige:** Ein Kreis wächst beim Einatmen, ruht beim Halten, schrumpft beim Ausatmen. Darunter der Text („Einatmen“, „Halten“, „Ausatmen“) und der Sekunden-Countdown der Phase.

  *Ergänzung vom 21.10.2026:* Der Kreis ist größer (ausgeatmet knapp halb so groß wie eingeatmet, eingeatmet fast so breit wie der Bildschirm) und bewegt sich weich: Jede Phase beginnt und endet langsam. Die Phasen haben eigene Farben – Einatmen warmes Gold, Halten helles Lila, Ausatmen kühles Blau – mit einem weichen Schein um den Kreis, der beim Halten sanft pulsiert. Ein dünner Phasenring um den Kreis füllt sich in jeder Phase im Uhrzeigersinn. Jede Phase vibriert mit eigenem Muster: Einatmen ein Puls, Halten ein kurzes Antippen, Ausatmen zwei Pulse. Bei „Bewegung reduzieren“ steht der Kreis still; Farbe, Ring, Text und Countdown zeigen die Phase.
- **Ton:** ein leiser, weicher Ton bei jedem Phasenwechsel (live synthetisiert).
- **Vibration:** kurzes Vibrieren bei jedem Phasenwechsel (in den Einstellungen abschaltbar).
- **Bildschirm bleibt an** (Screen Wake Lock), solange die Übung läuft.

*Ergänzung vom 21.10.2026:* Der Atem-Player hat auch „Pause“ und „Weiter“ (nötig, wenn ein Anruf die Übung unterbricht).

*Ergänzung vom 22.10.2026 (Meilenstein 4):* Kreis, Schein und Phasenring sind durch die Atem-Blüte ersetzt (sechs gemalte Blütenblätter, die sich mit dem Atemstand öffnen und schließen). Die Phasenfarben sind jetzt Einatmen Lavendel, Halten Pfirsich-Gold und Ausatmen Blaugrün; das Pulsieren beim Halten entfällt. Mit „Bewegung reduzieren“ steht die Blüte in mittlerer Größe still, nur die Farbe wechselt mit der Phase. Die Übungen stehen auf „Atmen“ als Kacheln mit Motiv, Rhythmus und Wirkung, und der Player zeigt die Beschreibung der Übung unter dem Titel. Näheres in `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §5 (Blüte) und §4.3 (Kacheln).

*Ergänzung vom 24.10.2026 (Meilenstein 8):* Unter den sechs Kacheln steht der Abschnitt „Eigene Muster“.
- **Anlegen:** Bis zu 6 eigene Rhythmen mit Namen. Jeder hat vier Phasen in fester Reihenfolge: Einatmen 2–15 s, Halten 0–20 s, Ausatmen 2–20 s, Halten 0–20 s, jeweils in Schritten von 0,5 s. Phasen mit 0 s entfallen.
- **Bedienen:** Bearbeitet und gelöscht wird im Editor (Blatt), gestartet aus der Liste. Danach laufen sie wie die festen Übungen: Dauer, Atemgeräusch, Hintergrund, Statistik, Ruhe-Check-in und „Zuletzt genutzt“.
- **Speichern:** Die Muster stehen in `ruhe.v1.breathPatterns` und im Backup.
- **Gelöschtes Muster:** „Zuletzt genutzt“ bietet dann wieder „Ankommen im Atem“ an.

Näheres in `docs/superpowers/specs/2026-10-24-ruhe-m8-eigene-atemmuster-design.md`.

### 3.4 Klänge

**Acht Klänge**, es läuft immer **einer** zur Zeit:

- **Antippen wechselt:** Tippt man einen anderen Klang an, blendet der bisherige aus (0,8 s) und der neue ein (1,5 s). Tippt man den laufenden Klang an, geht er aus.
- Der laufende Klang hat einen Lautstärkeregler.

| Klang | Herkunft |
|---|---|
| Regen | ElevenLabs-Loop |
| Meeresrauschen | ElevenLabs-Loop |
| Wind | ElevenLabs-Loop |
| Braunes Rauschen | ElevenLabs-Loop |
| Wald mit Vögeln | ElevenLabs-Loop |
| Kaminfeuer | ElevenLabs-Loop |
| Bach | ElevenLabs-Loop |
| Klangschalen | ElevenLabs-Loop |

*Änderung vom 21.10.2026 (auf Nutzerwunsch):* Ursprünglich waren die Klänge frei kombinierbar, und Regen, Meeresrauschen, Wind und braunes Rauschen wurden live erzeugt. Jetzt sind alle acht echte Aufnahmen (nahtlose 30-s-Schleifen), und Antippen wechselt den Klang, statt ihn dazuzumischen.

- **Sleep-Timer:** 15 / 30 / 45 / 60 / 90 Min oder endlos. Die letzte Minute wird sanft ausgeblendet, danach stoppt die Wiedergabe. Ein Wechsel des Klangs startet den Countdown nicht neu.
- Klang-Sitzungen zählen **nicht** zur Statistik.

*Ergänzung vom 22.10.2026 (Meilenstein 4):* Die acht Klänge sind Kacheln mit einem gemalten Motiv; der Titel steht gut lesbar über dem Motiv, auf einem Verlauf. Antippen, Lautstärke, Sleep-Timer und Mini-Player bleiben unverändert (siehe `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §4.4).

*Ergänzung vom 26.10.2026 (auf Nutzerwunsch):* Vier Lofi-Stücke zu je 5 Minuten (ElevenLabs Music) stehen als eigene Gruppe „Lofi“ zwischen „Musik“ und „Natur“, ebenso in der Hintergrundauswahl. Zwei haben einen sanften Beat zum Arbeiten (Kaffee & Notizen, Regenfenster), zwei kommen fast ohne Schlagzeug zum Entspannen aus (Abendlicht, Alte Kassette). Jedes hat ein eigenes gemaltes Motiv. An der Naht der Schleife überblenden sie in 3 s statt 8 s, damit zwei Beats nicht lange durcheinanderlaufen.

### 3.5 Ich

- Serie, Gesamtminuten, Anzahl Sitzungen.
- Monatskalender: Tage mit mindestens einer gezählten Sitzung sind markiert; Monate vor- und zurückblätterbar.
- Darunter die **Einstellungen** (siehe 6.4) sowie „Alle offline speichern“ und Backup.

### 3.6 Player & Mini-Player

- **Vollbild-Player** für geführte Meditationen und den Timer: ruhiger Hintergrund, Titel, verbleibende Zeit, Fortschrittsring, Pause/Fortsetzen, Beenden. Bei geführten Meditationen zusätzlich ±15 s Spulen und optionaler Hintergrundklang mit Lautstärkeregler.
- **Mini-Player:** Läuft ein Klang (ohne Vollbild-Player), bleibt über der Reiterleiste ein schmaler Balken mit seinem Namen, der Restzeit des Sleep-Timers und Pause.
- Es läuft immer nur **eine** Sitzung: Startet man eine Meditation, während ein Klang läuft, wird er gestoppt (der Hintergrundklang der Meditation ist davon unabhängig wählbar).

---

## 4. Audio-Engine

Das Herzstück. Ziel: zuverlässige Wiedergabe bei gesperrtem Bildschirm und sekundengenaue Abläufe, auch wenn Android die App im Hintergrund drosselt.

### 4.1 Aufbau

```
 Loops (Opus)  ─────┐
 Klangschalen  ─────┼─► Mischpult (Gain je Quelle) ─► Master-Gain ─► Begrenzer ─► Lautsprecher (ctx.destination)
 Stimme (MP3)  ─────┘
   (über MediaElementSource,
    wird gestreamt)            Lautloser Anker: <audio loop> mit nahezu stiller Aufnahme
                               → Android: Medienwiedergabe + Benachrichtigung (Media Session)
```

- **Ein `AudioContext`** für die ganze App, erzeugt beim ersten Tipp auf „Start“ (Autoplay-Regel des Browsers).
- **Ein einziger Klang-Ausgang:** Das gemischte Signal geht direkt an den Lautsprecher (`ctx.destination`).
- **Klänge:** Alle acht sind Loops (siehe 4.4). Von ihnen klingt immer nur einer; nur während eines Wechsels überblenden kurz der alte und der neue.
- **Lautloser Anker:** Parallel spielt ein verstecktes `<audio>`-Element eine 30 s lange, nahezu stille Aufnahme in Schleife. Dadurch behandelt Android die App als Medienwiedergabe: Ton läuft bei ausgeschaltetem Bildschirm weiter, Titel und Steuerung erscheinen in Benachrichtigung und Sperrbildschirm. Seine `pause`-Ereignisse zeigen Unterbrechungen durch das System an.
- *Änderung vom 21.10.2026:* Ursprünglich lief die Mischung über einen `MediaStreamAudioDestinationNode` in das `<audio>`-Element. Auf dem Android-Testgerät ruckelte dieser Weg dauerhaft (Diagnose: Weg B ruckelt, Web Audio direkt nicht). Web Audio direkt plus lautloser Anker lief dort bei gesperrtem Bildschirm stabil durch, die Sperrbildschirm-Steuerung funktionierte.
- **Stimme** wird nicht komplett dekodiert (eine 10-Minuten-Datei wäre > 100 MB im Speicher), sondern über ein `<audio>`-Element gestreamt und per `MediaElementAudioSourceNode` ins Mischpult geführt.
- **Hintergrund unter der Stimme:** Ein Hintergrundklang in einer geführten Meditation läuft konstant leiser als die Stimme. Der Pegel ist der Wert „Balance Stimme ↔ Hintergrund“ (Standard: Hintergrund auf 50 %). Der Regler im Player und die Einstellung in 6.4 sind derselbe, gemerkte Wert.
- *Änderung vom 26.10.2026:* Der Regler wirkte zu schwach (linear 0,7 × Balance; weil die Klänge mit −26 LUFS 7 dB leiser abgemischt sind als die Stimme mit −19 LUFS, blieb der Hintergrund selbst ganz rechts etwa 10 dB unter ihr). Jetzt bestimmt er den Abstand des Hintergrunds zur Stimme gleichmäßig in dB: 0 % ist aus, knapp darüber liegt der Hintergrund 30 dB unter der Stimme, je 10 % 3 dB näher, bei 100 % gleich laut. Der Standard 50 % liegt 15 dB darunter und klingt damit fast wie bisher (16 dB); gespeicherte Werte bleiben gültig. Ab etwa 77 % spielt der Hintergrund voll; darüber gibt die Stimme nach (bei 100 % um 7 dB), statt den Hintergrund über 1 zu verstärken und den Begrenzer pumpen zu lassen. „Konstant leiser als die Stimme“ gilt also bis 100 %, wo beide gleich laut sind. Ohne Hintergrund bleibt die Stimme immer voll. Umgesetzt in `guidedLevels` (`src/lib/meditation/guided-view.ts`) und `setVoiceVolume` der Engine.

### 4.2 Zeitplanung über die Audio-Uhr

Normale JavaScript-Timer werden von Android im Hintergrund stark gedrosselt. Deshalb:

- Ein **Timer-Plan** wird als reine Funktion berechnet (Eingabe: Einstellungen → Ausgabe: Liste von Ereignissen mit Zeitpunkt, z. B. „Klangschale bei 0 s“, „Intervall-Schale bei 300 s“, „3 Schalen ab 1200 s“, „Ende bei 1212 s“).

  *Ergänzung vom 21.10.2026:* Das Ausklingen nach der letzten End-Schale dauert jetzt 15 s (tiefere, länger klingende Schale), das Beispiel endet also bei 1215 s.
- Die Engine plant diese Ereignisse **vorab** auf der Zeitleiste des `AudioContext` (`source.start(when)`), ebenso die Ausblend-Rampe des Sleep-Timers (`gain.linearRampToValueAtTime`).
- Das **Ende einer Sitzung** wird über das `ended`-Ereignis einer eingeplanten Quelle erkannt. Kommt das Ereignis verzögert an (gedrosselter Hintergrund), wird die Dauer trotzdem korrekt aus der Audio-Uhr berechnet.
- Die Anzeige (Restzeit, Ring) liest bei sichtbarem Bildschirm `audioContext.currentTime` aus; sie steuert nichts.
- **Pause** hält die Audio-Uhr (`audioContext.suspend()`) und die Stimme gemeinsam an. Alle eingeplanten Ereignisse verschieben sich dadurch automatisch mit.

*Ergänzung vom 21.10.2026:* Endet ein Programm (regulär oder vorzeitig), klingen seine Klänge in 0,8 s aus, statt abrupt abzubrechen.

### 4.3 Live erzeugte Klänge (entfallen)

*Änderung vom 21.10.2026 (auf Nutzerwunsch):* echte Aufnahmen statt Synthese. Regen, Meeresrauschen, Wind und braunes Rauschen sind jetzt wie die übrigen Klänge ElevenLabs-Loops (siehe 3.4 und 4.4). Die live erzeugten Klänge (gefilterte Rausch-Puffer mit langsamer Modulation) und ihr Code sind entfernt.

### 4.4 Loops & Klangschalen

- Alle acht Klänge (ElevenLabs-Loops, je 30 s) und die Klangschale liegen als **Ogg/Opus** vor. Chrome dekodiert Opus ohne Lücke am Dateianfang, dadurch laufen `AudioBufferSourceNode`-Schleifen nahtlos (bei MP3 entstünde ein Klick an der Nahtstelle).
- Sie werden beim ersten Gebrauch dekodiert und im Speicher gehalten.

### 4.5 Media Session

- Metadaten: Titel (z. B. „Regen · Sleep-Timer 45 Min“ oder Meditationstitel), Album „Ruhe“, App-Icon als Artwork.
- Aktionen: Play, Pause, Stop; bei geführten Meditationen zusätzlich Spulen ±15 s und Positionsanzeige.
- **Unterbrechungen:** Pausiert das System den Ausgang (Anruf, andere App spielt Ton), wechselt die Engine in den Zustand „pausiert“. Fortsetzen per Tipp in der App oder über die Benachrichtigung.

### 4.6 Bekanntes Risiko & Plan B

**Risiko:** Manche Android-Energiesparmodi beenden lange Hintergrund-Wiedergaben aus dem Web-Audio-Pfad trotzdem.

**Absicherung:** Meilenstein 1 endet mit einem Härtetest auf dem echten Handy: 60 Min Regen mit Sleep-Timer bei gesperrtem Bildschirm.

**Plan B**, falls der Test scheitert: Die vier Rauschklänge werden per Skript als lange (≈ 5 Min) nahtlose Ogg/Opus-Dateien vorab erzeugt und im Schlafmodus direkt über ein `<audio loop>`-Element abgespielt statt über das Mischpult. Eine Wiederholung nach 5 Minuten ist praktisch nicht hörbar. (Stand 21.10.2026: Live erzeugte Rauschklänge gibt es nicht mehr, alle Klänge sind Aufnahmen, siehe 4.3.)

*Hinweis aus der Gerätediagnose (21.10.2026):* Ein `<audio loop>`-Element erzeugt auf Android beim Neustart der Schleife einen hörbaren Ruckler. Plan B müsste diese Naht deshalb anders lösen, z. B. durch sehr lange Dateien. Vorrang hat der Weg aus 4.1: Web Audio direkt plus lautloser Anker.

---

## 5. Inhalte & Vertonung

### 5.1 Meditationstexte

Eine Datei pro Meditation unter `content/meditations/<id>.md`:

```markdown
---
id: ankommen-im-atem
title: Ankommen im Atem
category: achtsamkeit   # achtsamkeit | stress | fokus
minutes: 5              # Ziel-Länge, die echte Länge kommt aus der Audiodatei
description: Eine erste, ganz einfache Übung, um im Moment anzukommen.
---

Setz dich bequem hin … und lass deine Augen sanft zufallen.

[Pause 8s]

Atme ein … und lass den Atem ganz von allein wieder gehen.

[Pause 20s]
```

**Regeln für die Markierungen:**

- `[Pause Ns]`: N Sekunden Stille (ganze oder halbe Sekunden).
- Leerzeile zwischen Absätzen ohne Markierung = 3 s Stille.
- Klangschale am Anfang und Ende wird automatisch ergänzt, nicht im Text markiert.

**Stil:** Du-Form, warm, einfache Sprache, kurze Sätze, viel Raum. Richtwert: mindestens 40 % der Gesamtlänge sind Stille.

**Freigabe:** Alle 9 Texte werden vor der Vertonung gegengelesen und freigegeben.

### 5.2 Vertonungs-Skript `scripts/voice.mjs`

| Befehl | Wirkung |
|---|---|
| `estimate [id]` | Probelauf ohne API: zählt Zeichen und schätzt die Credits pro Meditation und gesamt |
| `cast` | Vertont einen kurzen Probetext (≈ 400 Zeichen) mit 3 ausgewählten deutschen Stimmen → `audio-work/casting/*.mp3` zum Anhören |
| `build [id]` | Vertont eine oder alle Meditationen |

**Ablauf von `build`:**

1. Text an den Pausen-Markierungen und Absätzen in Abschnitte zerlegen.
2. Jeden Abschnitt an ElevenLabs Text-to-Speech schicken, mit `previous_text`/`next_text` als Kontext für durchgehende Betonung. Modell: `eleven_multilingual_v2`, sofern beim Casting kein neueres Modell für Deutsch klar besser klingt. Ruhige Stimm-Einstellungen (u. a. leicht reduziertes Tempo), die beim Casting festgelegt werden.
3. **Cache:** Jeder Abschnitt wird unter einem Hash aus Stimme, Modell, Einstellungen und *eigenem* Text in `audio-work/cache/` gespeichert und mit ins Repo eingecheckt. Unveränderte Abschnitte werden nie erneut bezahlt, auch nicht in einer neuen Session.
4. Mit ffmpeg zusammensetzen: Klangschale, Abschnitte, Stille, Klangschale.
5. Lautheit angleichen (`loudnorm`, Ziel ca. −19 LUFS, True Peak −1,5 dB) und als **MP3 mono 64 kbit/s** speichern → `public/audio/meditations/<id>.mp3` (≈ 0,5 MB/Min, alle 9 zusammen ≈ 30 MB).
6. Manifest `src/content/meditations.json` erzeugen (id, Titel, Thema, Beschreibung, echte Dauer per ffprobe, Dateigröße).

**API-Schlüssel:** wird aus der Umgebungsvariable `ELEVENLABS_API_KEY` gelesen, nie in Dateien geschrieben.

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Vertont wird über den ElevenLabs-Connector in einer Claude-Sitzung, nicht über ein Skript, das die API aufruft. Das Skript `scripts/meditations.mjs` (Logik in `scripts/lib/`) ersetzt `voice.mjs` und `placeholders.mjs` aus §8 und hat die Befehle `estimate [id]` (Zeichen, geschätzte Länge und Stilleanteil statt Credits), `split [id]` (Abschnittslisten nach `audio-work/sections/`, nicht eingecheckt), `placeholders`, `assemble <id>` (Klangschale, Abschnitte und Pausen; `loudnorm` in zwei Durchgängen) und `manifest`. `cast` und `build` entfallen. Es gibt keinen API-Schlüssel (`ELEVENLABS_API_KEY` entfällt) und keinen Zugriff auf `api.elevenlabs.io`. Die Stimme steht in `audio-work/voice.json`: Susanne K („Calm Meditation Guide“), Modell `eleven_v4` (statt `eleven_multilingual_v2`), Präfix `[softly] [slowly]`; je Abschnitt eine Aufnahme. Der Abschnitt-Cache `audio-work/cache/<hash>.mp3` bleibt eingecheckt und ist wie beschrieben nach dem Hash aus Stimme, Modell, Einstellungen und eigenem Text benannt, sodass nur fehlende Hashes vertont werden.

### 5.3 Klang-Skript `scripts/sounds.mjs`

- Definitionen in `content/sounds.json`: id, Titel, Datei und der ElevenLabs-Prompt der Aufnahme.
- Erzeugt die 8 Loops über ElevenLabs Sound Effects im Loop-Modus (30 s) sowie einen einzelnen Klangschalen-Schlag.
- Ist eine Nahtstelle hörbar, wird sie mit einer kurzen Überblendung geglättet.
- Ausgabe als Ogg/Opus (Stereo, 48 kHz, ≈ 96 kbit/s, −26 LUFS) nach `public/audio/sounds/`.
- *Stand 21.10.2026:* Die 8 Loops sind echt und eingecheckt (je 4 Varianten, gewählt nach der saubersten Naht); die Prompts in `content/sounds.json` sind die tatsächlich verwendeten. Offen ist nur noch der Klangschalen-Schlag.

*Ergänzung vom 21.10.2026:* Der Klangschalen-Schlag ist seit Meilenstein 2 ebenfalls eine echte Aufnahme.

### 5.4 Platzhalter bis zur Vertonung

Ein Platzhalter-Skript erzeugt per ffmpeg für jede Meditation eine Datei in der Ziel-Länge (leise Stille mit synthetischem Glockenton alle 30 s). So sind Player, Offline-Speicher und Statistik vollständig testbar, bevor die Vertonung steht. Die echten Dateien ersetzen die Platzhalter später unter gleichem Namen.

*Änderung vom 21.10.2026:* Die 8 Loops sind jetzt echte Aufnahmen, für sie gibt es keine Platzhalter mehr. Auch der Klangschalen-Schlag (`public/audio/sounds/klangschale.ogg`) ist seit Meilenstein 2 eine echte Aufnahme (ElevenLabs, vom Nutzer aus 4 Varianten gewählt). Das bisherige Skript `scripts/placeholders.mjs` (Loops und Klangschale) ist mit den Live-Klängen entfallen; das Skript für die Meditations-Platzhalter entsteht mit Meilenstein 3.

### 5.5 Kosten (Schätzung)

≈ 30.000–40.000 Zeichen Sprache (inkl. Nachbesserungen) plus Soundeffekte. ElevenLabs *Starter* (≈ 5 $/Monat) ist vermutlich zu knapp, *Creator* (≈ 22 $/Monat) reicht sicher; ein Monat genügt. `estimate` liefert vor dem ersten bezahlten Aufruf eine genaue Zahl.

---

## 6. Daten, Offline & Statistik

### 6.1 Speicherung

- Alles in `localStorage` unter dem Schlüssel `ruhe.v1` als JSON:

```ts
{
  version: 1,
  sessions: Session[],
  settings: Settings,
  lastUsed?: LastUsed   // für die Karte „Zuletzt genutzt“
}

type Session = {
  id: string;                 // zufällige ID
  start: string;              // ISO-Zeitpunkt
  kind: 'guided' | 'timer' | 'breath';
  ref: string;                // Meditations-ID, 'timer' oder Atemübungs-ID
  seconds: number;            // tatsächlich absolviert
};
```

- Beim Laden wird die Struktur geprüft. Ist sie beschädigt, wird der Rohinhalt unter `ruhe.v1.corrupt` gesichert und die App startet mit leerem Stand, statt abzustürzen.

*Ergänzung vom 27.10.2026 (Meilenstein 9):* Der Datenstand bekommt drei weitere optionale Listen (`version` bleibt 1): `energyCheckins` (Energie-Check-ins: `id`, `at`, `levels` mit Stufen 1–5 für Körper, Gefühl, Geist und Sinn), `hackRuns` (gelaufene Brain Hacks: `id`, `at`, `hack`, `area`, `seconds`, optional `before` und `after`) und `focusSprints` (Fokus-Sprints: `id`, `at`, `planned` mit 25, 50 oder 90 Minuten, `seconds`, optional `task` mit höchstens 80 Zeichen). Eine Liste fehlt, solange sie leer ist. Jeder Eintrag wird beim Laden und beim Import einzeln geprüft (ein ungültiger fällt weg, der Rest bleibt); das Backup enthält die drei Listen, und der Import fügt nur Einträge mit unbekannter `id` hinzu. Ein Hack-Lauf wird ab 30 s gespeichert, ein Sprint ab 5 Minuten, jeweils mit der tatsächlichen Zeit. Die Listen sind von `sessions` getrennt und zählen nicht in Statistik, Serie und Kalender. Typen und Regeln in `docs/superpowers/specs/2026-10-27-ruhe-m9-energie-basis-design.md` §6.1.

*Ergänzung vom 28.10.2026 (Meilenstein 10):* Der Datenstand bekommt eine weitere optionale Liste `mornings` (`version` bleibt 1): die Morgen-Einträge des Morgen-Starts (`day` als Tag in Ortszeit, `at`, `variant` mit `kurz` oder `lang`, optional `intention`, `gratitude`, `value`, `domino` und `dominoDone`; je Tag höchstens ein Eintrag). Die Liste fehlt, solange sie leer ist, und ist nach `day` sortiert. Jeder Eintrag wird beim Laden und beim Import einzeln geprüft (ein ungültiger fällt weg, der Rest bleibt; zu lange Texte werden gekürzt); das Backup enthält die Liste, und der Import führt je Tag zusammen, wobei bei gleichem Tag der spätere `at` gilt. Gespeichert wird, wenn der Ablauf den Abschluss erreicht; ein zweiter Durchgang am selben Tag ersetzt den Eintrag. Die Liste ist von `sessions` getrennt und zählt nicht in Statistik, Serie und Kalender. Typen und Regeln in `docs/superpowers/specs/2026-10-28-ruhe-m10-morgen-start-design.md` §4.

### 6.2 Statistik-Regeln

- Gespeichert wird eine Sitzung (geführt, Timer, Atmen), sobald sie endet oder abgebrochen wird. Sie zählt, wenn **≥ 60 Sekunden** absolviert wurden; kürzere werden verworfen.
- Gezählt werden die **tatsächlich** absolvierten Sekunden; Pausen zählen nicht.
- Klang- und Schlafsitzungen werden nicht gespeichert.
- **Tagesgrenze:** Mitternacht in lokaler Zeit; maßgeblich ist der Startzeitpunkt der Sitzung.
- **Serie:** Gibt es heute eine Sitzung, wird ab heute rückwärts gezählt, sonst ab gestern. Die Zählung endet am ersten Tag ohne Sitzung. (Wer heute noch nicht meditiert hat, verliert die Serie also erst nach Mitternacht.)
- **Gesamtminuten:** Summe aller Sekunden ÷ 60, abgerundet.

### 6.3 Backup

- **Exportieren:** lädt `ruhe-backup-JJJJ-MM-TT.json` herunter (Sitzungen + Einstellungen).
- **Importieren:** Datei wählen → Struktur prüfen → Sitzungen werden **zusammengeführt** (doppelte IDs übersprungen), Einstellungen aus der Datei übernommen. Bei ungültiger Datei: verständliche Meldung, nichts wird verändert.

### 6.4 Einstellungen

- Vibration bei Atemübungen: an/aus (Standard: an)
- Balance Stimme ↔ Hintergrund bei geführten Meditationen
- Standard-Hintergrundklang für den Timer (Standard: keiner)
- Vorlauf beim Timer: an/aus (Standard: an)

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Neue Einstellung `guidedSound` (Standard: keiner): der zuletzt gewählte Hintergrundklang der geführten Meditation. Er wird im Player gewählt und gilt beim nächsten Start wieder; der Klang unter „Ich“ gilt weiter nur für den Timer und heißt dort jetzt „Hintergrundklang beim Timer“. Die Balance (`voiceBalance`) wirkt im Player sofort und wird beim Loslassen des Reglers gespeichert.

*Ergänzung vom 27.10.2026 (Meilenstein 9):* Neue Einstellung `settings.focus` = `{ minutes: 25 | 50 | 90, sound: BackgroundId | null }`, Standard `{ minutes: 50, sound: 'kaffee-und-notizen' }`: Länge und Hintergrund des Fokus-Sprints, wie beim letzten Start gewählt; sie gelten beim nächsten Sprint wieder. Der Wert hat immer eine Belegung: Fehlt er in alten Daten oder Backups oder ist er ungültig, gilt der Standard. Siehe `docs/superpowers/specs/2026-10-27-ruhe-m9-energie-basis-design.md` §6.1.

### 6.5 Offline (Service Worker)

- **Vorab gespeichert (Precache):** App-Grundgerüst, Schriften, Icons, die 8 Loops und die Klangschale (≈ 3 MB). Damit laufen Timer, Atmen und Klänge sofort offline.
- **Meditationen:** Beim ersten Abspielen wird die Datei gestreamt und parallel vollständig in den Cache `ruhe-meditations` geladen (der Browser fragt beim Streamen nur Teilstücke an, die sich nicht cachen lassen; deshalb der zusätzliche vollständige Download). Aus dem Cache wird mit Range-Unterstützung ausgeliefert, damit Spulen offline funktioniert.
- **„Alle offline speichern“** lädt alle fehlenden Meditationen mit Fortschrittsanzeige.
- **Offline-Status** je Meditation wird über den Cache abgefragt (✓ in der Liste). Offline und nicht gespeichert: Eintrag ausgegraut mit Hinweis „Nicht offline verfügbar“.
- Beim ersten Speichern einer Meditation bittet die App um dauerhaften Speicher (`navigator.storage.persist()`).
- **Updates:** Neue Versionen werden im Hintergrund geladen. Danach erscheint der Hinweis „Neue Version – tippen zum Aktualisieren“, aber nie während einer laufenden Sitzung.

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Die Meditationen werden unter einer versionierten Adresse abgespielt und gecacht: `audio/meditations/<id>.mp3?v=<Version>`, wobei die Version aus den ersten 10 Hex-Zeichen des SHA-256 der Datei besteht (Feld `version` im Manifest). Eine neu aufgenommene Meditation hat so eine neue Adresse, und Geräte spielen nicht die alte Kopie aus dem Cache. „Alle offline speichern“ entfernt zuerst die veralteten Einträge aus `ruhe-meditations`. Als gespeichert gilt nur Audio (Content-Type `audio/*`); die Startseite, die ein Server statt einer fehlenden Datei liefern kann, zählt nicht. Eine Datei, die sich nicht laden lässt, bricht den Lauf nicht ab: Sie wird übersprungen und in der Meldung gezählt. Ein voller Speicher beendet den Lauf, schon Gespeichertes bleibt.

### 6.6 Web-App-Manifest

Name und Kurzname „Ruhe“, `display: standalone`, Hochformat, `lang: de`, `start_url` und `scope` `/ruhe/`, Theme- und Hintergrundfarbe im Nachtblau der App, Icons 192 px, 512 px und maskierbar.

---

## 7. Gestaltung

**Stimmung:** Abendhimmel, ähnlich Calm, dunkel und ruhig. Angenehm abends und im Bett.

**Farben (Startwerte, Feinschliff nach Augenmaß):**

| Rolle | Wert |
|---|---|
| Hintergrund oben | `#0B1026` (Nachtblau) |
| Hintergrund Mitte | `#1B2350` (Indigo) |
| Hintergrund unten | `#3A2F5B` (Dämmerungsviolett) |
| Akzent warm | `#F2C98A` (sanftes Gold, z. B. Atemkreis, Fortschritt) |
| Text | `#EEF0FA` |
| Text gedämpft | `#A9AFCB` |

- **Illustration:** Berg- und Seesilhouetten als SVG im Code (keine Fotos), dezente Sterne, die sanft funkeln. Bei „Bewegung reduzieren“ in den Systemeinstellungen wird auf Animationen verzichtet.
- **Schrift:** weiche Serifenschrift für Überschriften (Vorschlag: Fraunces), runde, gut lesbare Sans für Text (Vorschlag: Nunito Sans), beide lokal gebündelt.
- **Bedienung:** Tippflächen ≥ 48 px, Kontrast mindestens WCAG AA.

*Ergänzung vom 22.10.2026 (Meilenstein 4):* Die App hat drei Stimmungen nach lokaler Uhrzeit: morgen (5–11 Uhr), tag (11–17 Uhr) und abend (17–5 Uhr); der Abend entspricht den Farben oben, nur der gedämpfte Text ist jetzt `#B3B8D2` statt `#A9AFCB` (erst so hat er auf den Karten mindestens 4,5:1, WCAG AA). Der Himmel bleibt in allen dreien dunkel, nur Farbton, Akzent (Pfirsich, Mint, Gold) und Gestirn wandern mit; das Gold der Zierlinien bleibt in jeder Stimmung. Die Stimmung wird als `data-tageszeit` am `<html>`-Element gesetzt, die Farbwerte stehen in `src/app.css`. Hinzu kommen 28 gemalte Aquarell-Motive als WebP unter `public/images/motive/` (Stil „zart mit feiner Goldlinie“); sie sind Schmuck, die Bedeutung trägt immer der Text. Näheres in `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §2 (Stimmungen und Farbwerte), §3 (Motive) und §4 (wo sie erscheinen).

---

## 8. Projektstruktur

```
ruhe/
├─ content/
│  ├─ meditations/*.md          Sprechtexte (Quelle der Wahrheit)
│  └─ sounds.json               Klang-Definitionen inkl. ElevenLabs-Prompts
├─ scripts/
│  ├─ voice.mjs                 Vertonung: estimate | cast | build
│  ├─ sounds.mjs                Loops & Klangschale erzeugen
│  └─ placeholders.mjs          Platzhalter-Audio für Meditationen per ffmpeg (Meilenstein 3)
├─ audio-work/                  Casting-Proben & Abschnitt-Cache (eingecheckt)
├─ public/
│  ├─ audio/meditations/*.mp3   erzeugt
│  ├─ audio/sounds/*.ogg        erzeugt
│  └─ icons/
├─ src/
│  ├─ lib/
│  │  ├─ audio/                 engine, loops, schedule (Timer-Plan), media-session
│  │  ├─ breath/                Atemmuster & Phasen-Ablauf
│  │  ├─ stats/                 store, streak, backup
│  │  ├─ offline/               Cache-Status, „Alle speichern“
│  │  └─ content/               Katalog (liest das generierte Manifest)
│  ├─ content/meditations.json  generiertes Manifest
│  ├─ screens/                  Heute, Meditieren, Atmen, Klaenge, Ich
│  ├─ components/               Player, MiniPlayer, TabBar, BreathCircle, Calendar, …
│  └─ App.svelte, main.ts
├─ tests/
│  ├─ unit/                     Vitest
│  └─ e2e/                      Playwright
└─ .github/workflows/deploy.yml
```

Jede Datei unter `src/lib/` hat eine klar umrissene Aufgabe und ist ohne UI testbar. Die Svelte-Komponenten enthalten möglichst keine Logik, sondern rufen diese Module auf.

---

## 9. Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Audiodatei lädt nicht (Netz weg, Fehler) | Hinweis im Player mit „Erneut versuchen“; die Sitzung wird nicht gezählt, sofern < 60 s |
| Offline und Meditation nicht gespeichert | Eintrag ausgegraut, Hinweis „Nicht offline verfügbar“ |
| Audio blockiert (Autoplay-Regel) | Kann nicht auftreten, da jede Wiedergabe durch einen Tipp startet; falls doch: Hinweis „Zum Starten tippen“ |
| Unterbrechung durch Anruf/andere App | Sitzung pausiert, Fortsetzen per Tipp oder Benachrichtigung |
| Gespeicherte Daten beschädigt | Rohdaten sichern, mit leerem Stand starten (siehe 6.1) |
| Speicher voll beim Offline-Speichern | Meldung „Nicht genug Speicherplatz“, bereits Gespeichertes bleibt erhalten |
| Ungültige Backup-Datei | Meldung, nichts wird verändert |
| Wake Lock / Vibration nicht verfügbar | Funktion entfällt still, Übung läuft trotzdem |

---

## 10. Tests

**Automatisch – Logik (Vitest):**

- Serien-Berechnung inkl. Tagesgrenzen, Lücken und „heute noch nicht meditiert“
- Atemphasen-Ablauf je Muster, inkl. „Zyklus zu Ende führen“
- Timer-Plan: Vorlauf, Start-, Intervall- und End-Klangschalen bei verschiedenen Einstellungen
- Sleep-Timer: Zeitpunkt und Dauer der Ausblendung, „endlos“
- Statistik: 60-Sekunden-Schwelle, Pausen werden nicht gezählt
- Backup: Export → Import ergibt denselben Stand; Zusammenführen ohne Duplikate; ungültige Dateien
- Text-Parser: Pausen-Markierungen, Absatz-Pausen, Fehlermeldung bei falscher Syntax

**Automatisch – im Browser (Playwright, Chromium, Handy-Format):**

- Navigation zwischen allen Reitern; Zurück schließt den Player
- Timer starten, pausieren, beenden → Statistik aktualisiert
- Atemübung startet und zeigt die Phasen
- Offline-Modus: nach erstem Laden Netz abschalten → App, Timer und Klänge funktionieren
- Ungespeicherte Meditation ist offline ausgegraut

**Manuell auf dem Handy (Checkliste):**

1. Installation über Chrome-Menü → Icon auf dem Startbildschirm, Start ohne Browserleiste
2. Flugmodus → Timer, Atmen und Klänge funktionieren
3. 60 Min Regen mit Sleep-Timer bei gesperrtem Bildschirm → läuft durch, blendet sanft aus
4. Benachrichtigung zeigt Titel und Play/Pause; Steuerung vom Sperrbildschirm funktioniert
5. Vibration bei der Atemübung; ein Anruf pausiert die Wiedergabe

---

## 11. Meilensteine

| # | Inhalt | Abnahme durch dich |
|---|---|---|
| 1 | Grundgerüst, Gestaltung, Reiterleiste, Audio-Engine, 4 Live-Klänge + Platzhalter-Loops (*21.10.2026:* ersetzt durch 8 echte ElevenLabs-Loops, ein Klang zur Zeit), Sleep-Timer, PWA/Offline, Deployment | Härtetest: 60 Min Regen bei gesperrtem Bildschirm (Checkliste 1–4) |
| 2 | Meditations-Timer, Atemübungen, Statistik, Einstellungen, Backup | Erste echte Meditationen mit Timer und Atmen |
| 3 | Geführte Meditationen: Player, Offline-Speicher, Platzhalter-Audio, Vertonungs-Skript (ohne API getestet), die 9 Texte | Texte gegenlesen und freigeben |
| 4 | *Neue Session mit ElevenLabs-Zugang:* Stimm-Casting, Vertonung der 9 Meditationen (die 8 Loops und der Klangschalen-Schlag sind seit 21.10.2026 fertig) | Fertige App, komplette Checkliste |

*Ergänzung vom 21.10.2026 (Meilenstein 3):* Meilenstein 4 (Vertonung) ist in Meilenstein 3 aufgegangen. Weil der Connector vertont (§5.2), braucht es keine neue Session mit API-Zugang; nach Freigabe der Texte und der Stimmwahl werden die 9 Meditationen im selben Meilenstein vertont, bis dahin spielen Platzhalter. Von der Vorbedingung „Vor Meilenstein 4“ in §12 entfallen damit nur die Freischaltung von `api.elevenlabs.io` und der API-Schlüssel; für neue Texte braucht es weiter das ElevenLabs-Konto mit Credits. Abgenommen wird mit der „Handy-Checkliste Meilenstein 3“ im README.

*Ergänzung vom 22.10.2026 (Meilenstein 4):* Meilenstein 4 trägt jetzt den Titel „Optik & Tageszeiten“ (Zeile 4 der Tabelle, die Vertonung, ist in Meilenstein 3 aufgegangen): drei Stimmungen nach Tageszeit, gemalte Motive, Kacheln für Atemübungen und Klänge, Atem-Blüte statt Kreis. Er ist umgesetzt und wird mit der „Handy-Checkliste Meilenstein 4“ im README abgenommen (siehe `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §8). Als Nächstes folgen Meilenstein 5 (Meditationsmusik und -klänge, auch als Hintergrund der geführten Meditationen) und Meilenstein 6 (Stimmungs-Check-in „Wie geht es dir?“, sichtbar unter „Ich“), jeweils mit eigener Spec und eigenem Plan (siehe `docs/superpowers/specs/2026-10-22-ruhe-m4-optik-design.md` §9).

Für jeden Meilenstein entsteht ein eigener Implementierungsplan, beginnend mit Meilenstein 1. Ergibt der Härtetest in Meilenstein 1, dass Plan B (4.6) nötig ist, wird das vor Meilenstein 2 umgesetzt.

---

## 12. Voraussetzungen von deiner Seite

| Wann | Was |
|---|---|
| Vor dem ersten Deployment (Meilenstein 1) | Im Repo unter *Settings → Pages → Source* „GitHub Actions“ wählen |
| Vor Meilenstein 4 *(überholt)* | ~~In der Cloud-Umgebung `api.elevenlabs.io` unter *Allowed domains* freischalten und den Schlüssel als `ELEVENLABS_API_KEY` (Network secrets bzw. Umgebungsvariable) hinterlegen; ElevenLabs-Abo *Creator*; dann eine neue Session starten~~ *Ergänzung vom 22.10.2026:* Entfällt. Vertont wird seit Meilenstein 3 über den ElevenLabs-Connector in einer Claude-Sitzung (§5.2, §11): kein API-Schlüssel, keine Freischaltung von `api.elevenlabs.io`, keine neue Session. Für neue Texte braucht es weiter das ElevenLabs-Konto mit Credits. |
