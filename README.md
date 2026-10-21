# Ruhe

Ruhe ist meine persönliche Meditations-App: beruhigende Klänge mit Sleep-Timer, ein Meditations-Timer, Atemübungen, Statistik mit Backup und geführte Meditationen. Sie läuft im Browser und lässt sich wie eine normale App aufs Handy installieren.

**Adresse:** <https://philip-tolle.github.io/ruhe/>

Die App wird automatisch veröffentlicht, sobald etwas auf `main` landet (GitHub Actions → GitHub Pages).

## Auf dem Handy installieren (Android)

1. Die Adresse oben in **Chrome** öffnen.
2. Menü **⋮** antippen.
3. **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“** wählen.

Danach startet Ruhe wie eine App, ohne Browserleiste.

## Handy-Checkliste Meilenstein 1

1. Installation über Chrome → Icon auf dem Startbildschirm, Start ohne Browserleiste.
2. Flugmodus → Klänge, Timer und Atmen funktionieren auch offline.
3. Regen + Sleep-Timer 60 Min, Bildschirm sperren → läuft durch und blendet in der letzten Minute sanft aus.
4. Benachrichtigung bzw. Sperrbildschirm zeigt Titel und Play/Pause, die Steuerung funktioniert.

> Hinweis: Alle acht Klänge und der einzelne Klangschalen-Schlag des Meditations-Timers sind echte Aufnahmen (ElevenLabs).

## Handy-Checkliste Meilenstein 2

1. Timer 5 Min mit Intervall bei gesperrtem Bildschirm: Klangschalen pünktlich, danach erscheint die Sitzung unter „Ich“.
2. Anruf während des Timers: pausiert, die Zeit zählt nicht weiter.
3. Atemübung mit Vibration, Bildschirm bleibt an.
4. Backup exportieren und wieder importieren.
5. Atemübung 10 Min: Handy wird nicht auffällig warm, Akku sinkt nicht ungewöhnlich (alle Töne werden zu Beginn eingeplant).
6. Timer zu Ende laufen lassen und während die Klangschalen ausklingen im Sperrbildschirm auf Pause tippen: die Benachrichtigung verschwindet, die Sitzung steht unter „Ich“.
7. Backup über Drive oder Messenger auf ein anderes Gerät schicken und dort importieren.
8. Auf „Starten“ doppelt tippen: Der Timer läuft normal.

## Handy-Checkliste Meilenstein 3

1. Eine Meditation bei gesperrtem Bildschirm bis zum Ende hören: Sie läuft durch, danach erscheint die Sitzung unter „Ich“.
2. Benachrichtigung bzw. Sperrbildschirm: ±15 s springen, und die angezeigte Position stimmt.
3. Unter „Ich“ „Alle offline speichern“ (mit Netz), dann Flugmodus: Die Meditation spielt, und Vor- und Zurückspulen geht – und „Bodyscan im Sitzen“ im Flugmodus bis nach Minute 7 hören bzw. dorthin vorspulen.
4. Im Player einen Hintergrundklang wählen und die Balance Stimme ↔ Hintergrund verschieben: Beides wirkt sofort und gilt beim nächsten Start wieder.
5. Anruf während der Meditation: Die Wiedergabe pausiert, „Weiter“ setzt an derselben Stelle fort.
6. Eine Meditation einmal mit Netz abspielen: Danach steht bei ihr unter „Meditieren“ „✓ offline“.
7. Im Flugmodus ist eine Meditation, die nie gespeichert wurde, auf „Meditieren“ und auf „Heute“ ausgegraut und nennt „Nicht offline verfügbar“.
8. Auf „Heute“ starten „Vorschlag des Tages“ und „Zuletzt genutzt“ die richtige Meditation; „Erneut starten“ wiederholt einen Timer oder eine Atemübung genau so wie zuletzt.
9. Unter „Ich“ „Alle offline speichern“ starten, den Reiter wechseln und zurückkommen: Der Lauf ging weiter, es steht der Fortschritt da – oder, wenn er inzwischen fertig ist, das Ergebnis.

## Meditationen vertonen

Die Texte stehen in `content/meditations/<id>.md`, die fertigen Dateien entstehen mit `scripts/meditations.mjs` (`npm run meditations <Befehl>`; braucht ffmpeg und ffprobe). Gesprochen wird in einer Claude-Sitzung über den ElevenLabs-Connector. Dafür ist kein API-Schlüssel nötig, und es wird keiner gespeichert.

1. **Text bearbeiten:** `content/meditations/<id>.md`. Eine eigene Zeile `[Pause 8s]` ist N Sekunden Stille (ganze oder halbe Sekunden); eine Leerzeile zwischen Absätzen ohne Markierung sind 3 Sekunden, eine Markierung ersetzt sie. Die Klangschalen am Anfang und Ende kommen automatisch dazu.
2. **Länge schätzen:** `npm run meditations estimate [id]` zeigt je Meditation Zeichen, Ziel- und geschätzte Länge und den Stilleanteil (mindestens 40 %, sonst endet der Befehl mit Fehler).
3. **Abschnitte zerlegen:** `npm run meditations split [id]` schreibt die Sprechabschnitte nach `audio-work/sections/<id>.json` (nicht eingecheckt, jederzeit neu erzeugbar) und nennt, wie viele noch nicht im Cache liegen.
4. **Abschnitte vertonen:** In einer Claude-Sitzung mit dem ElevenLabs-Connector. Stimme, Modell und Präfix stehen in `audio-work/voice.json` (`id`, `model`, `settings.prefix`; derzeit Susanne K, `eleven_v4`, `[softly] [slowly]`). Je Abschnitt eine Aufnahme, gespeichert als `audio-work/cache/<hash>.mp3` (liegt im Repo). Vertont werden nur fehlende Hashes: Der Hash gilt für Stimme, Modell, Einstellungen und den eigenen Text eines Abschnitts. Ein geänderter Satz ändert also nur seinen Hash und kostet nichts doppelt. Ändern sich Stimme, Modell oder Einstellungen (auch das Präfix), gelten dagegen alle Hashes neu.
5. **Zusammensetzen:** `npm run meditations assemble <id>` schreibt `public/audio/meditations/<id>.mp3`: Klangschale am Anfang (das erste Wort folgt nach 4 s) und Ende (3 s nach dem letzten Wort), dazwischen Abschnitte und Pausen. Die Lautheit wird in zwei Durchgängen (messen, dann angleichen) auf −19 LUFS bei höchstens −1,5 dB True Peak gebracht, als MP3 mono mit 64 kbit/s. Fehlen Abschnitte im Cache, bricht der Befehl ab und nennt sie. Der Pegel der Klangschale steht als `BOWL_GAIN` in `scripts/lib/meditation-audio.mjs` (1 = unverändert). Mit Optionen braucht der Aufruf ein `--` vor dem Befehl, sonst schluckt npm sie: `npm run meditations -- assemble <id> --cache <Ordner> --out <Datei>` (zum Ausprobieren mit anderem Cache oder Ziel).
6. **Manifest schreiben:** `npm run meditations manifest` erzeugt `src/content/meditations.json` mit Dauer, Bytes und `version` je Meditation (die ersten 10 Hex-Zeichen des SHA-256 der MP3).
7. **Veröffentlichen:** Eine neue Aufnahme hat eine neue `version`, die App ruft die Datei als `<id>.mp3?v=<version>` ab. Das Handy lädt sie dadurch frisch, statt die alte aus dem Cache zu spielen. Ein Gerät, auf dem alles gespeichert war, muss nach einer neuen Aufnahme „Alle offline speichern“ erneut antippen: Die neuen `?v=`-Fassungen sind dort noch nicht gespeichert, und nur dieser Knopf entfernt die alten Kopien.

Solange eine Meditation noch nicht vertont ist, spielt eine Platzhalter-Datei (leise Töne, in der App als „Vorabversion“ gekennzeichnet): `npm run meditations placeholders` legt sie für jede Meditation ohne echte Datei an und vermerkt sie in `audio-work/placeholders.json`; `assemble` nimmt die id dort wieder heraus. Echte Dateien überschreibt der Befehl nie.

## Entwicklung

Voraussetzung: Node.js ab Version 22.18.

```bash
npm install            # Abhängigkeiten installieren
npm run dev            # Entwicklungsserver (http://localhost:5173/ruhe/)
npm run check          # Typen und Svelte-Prüfung
npm test               # Unit- und Browser-Tests (Vitest)
npm run test:e2e       # End-to-End-Tests (Playwright, baut und startet die App selbst)
npm run icons          # App-Icons neu erzeugen (braucht Chromium von Playwright)
npm run build          # Produktions-Build nach dist/
```

Die Browser- und End-to-End-Tests sowie `npm run icons` brauchen Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.
