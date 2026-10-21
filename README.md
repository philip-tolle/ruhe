# Ruhe

Ruhe ist meine persönliche Meditations-App: beruhigende Klänge, ein Sleep-Timer und (in den nächsten Meilensteinen) Timer, Atemübungen und geführte Meditationen. Sie läuft im Browser und lässt sich wie eine normale App aufs Handy installieren.

**Adresse:** <https://philip-tolle.github.io/ruhe/>

Die App wird automatisch veröffentlicht, sobald etwas auf `main` landet (GitHub Actions → GitHub Pages).

## Auf dem Handy installieren (Android)

1. Die Adresse oben in **Chrome** öffnen.
2. Menü **⋮** antippen.
3. **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“** wählen.

Danach startet Ruhe wie eine App, ohne Browserleiste.

## Handy-Checkliste Meilenstein 1

1. Installation über Chrome → Icon auf dem Startbildschirm, Start ohne Browserleiste.
2. Flugmodus → Klänge funktionieren (Timer und Atmen folgen mit Meilenstein 2).
3. Regen + Sleep-Timer 60 Min, Bildschirm sperren → läuft durch und blendet in der letzten Minute sanft aus.
4. Benachrichtigung bzw. Sperrbildschirm zeigt Titel und Play/Pause, die Steuerung funktioniert.

> Hinweis: Die Klangdateien (Loops und Klangschale) sind bis Meilenstein 4 (ElevenLabs) noch Platzhalter. Regen, Meer, Wind und braunes Rauschen werden live in der App erzeugt.

## Entwicklung

Voraussetzung: Node.js ab Version 22.18.

```bash
npm install            # Abhängigkeiten installieren
npm run dev            # Entwicklungsserver (http://localhost:5173/ruhe/)
npm run check          # Typen und Svelte-Prüfung
npm test               # Unit- und Browser-Tests (Vitest)
npm run test:e2e       # End-to-End-Tests (Playwright, baut und startet die App selbst)
npm run placeholders   # Platzhalter-Klänge neu erzeugen (braucht ffmpeg mit libopus)
npm run icons          # App-Icons neu erzeugen (braucht Chromium von Playwright)
npm run build          # Produktions-Build nach dist/
```

Die Browser- und End-to-End-Tests sowie `npm run icons` brauchen Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.
