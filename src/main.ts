import { mount } from 'svelte'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/nunito-sans'
import './app.css'
import App from './App.svelte'
import { engine } from './lib/audio/engine'
import { initPwa } from './lib/pwa/update.svelte'
import { connectSessions } from './lib/session-wiring'
import { recordResult } from './lib/stats/store.svelte'
import { doneInfoFor, sessionUi } from './lib/ui/session-ui.svelte'
import { followTageszeit } from './lib/ui/tageszeit.svelte'

// Die Stimmung folgt der Uhr (volle Minute, Rückkehr in die App). Vor dem Einhängen, damit die
// Bildschirme gleich den aktuellen Wert lesen; für die ganze Lebensdauer der App, darum nie aufgeräumt.
followTageszeit()

mount(App, { target: document.getElementById('app')! })

// Jedes beendete Ergebnis wird nach seiner Art erfasst (Sitzung ab 60 s, Hack ab 30 s, Sprint ab 5 min)
// und danach im Player als Abschluss gezeigt; ein Hack oder Sprint, der nicht zählt, zeigt keinen.
// Einmal für die ganze Lebensdauer der App, darum nie getrennt.
connectSessions(engine, recordResult, (r, id) => {
  const info = doneInfoFor(r, id)
  if (info) sessionUi.done = info
})

initPwa()
