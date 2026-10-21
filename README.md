# Ruhe

Ruhe ist meine persönliche Meditations-App: beruhigende Klänge mit Sleep-Timer, ein Meditations-Timer, Atemübungen, Statistik mit Backup und (im nächsten Meilenstein) geführte Meditationen. Sie läuft im Browser und lässt sich wie eine normale App aufs Handy installieren.

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
