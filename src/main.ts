import { mount } from 'svelte'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/nunito-sans'
import './app.css'
import App from './App.svelte'
import { engine } from './lib/audio/engine'
import { initPwa } from './lib/pwa/update.svelte'
import { connectSessions } from './lib/session-wiring'
import { recordSession } from './lib/stats/store.svelte'
import { sessionUi } from './lib/ui/session-ui.svelte'
import { followTageszeit } from './lib/ui/tageszeit.svelte'

// Die Stimmung folgt der Uhr (volle Minute, Rückkehr in die App). Vor dem Einhängen, damit die
// Bildschirme gleich den aktuellen Wert lesen; für die ganze Lebensdauer der App, darum nie aufgeräumt.
followTageszeit()

mount(App, { target: document.getElementById('app')! })

// Jede beendete Sitzung wird erfasst (ab 60 s) und danach im Player als Abschluss gezeigt.
// Einmal für die ganze Lebensdauer der App, darum nie getrennt.
connectSessions(engine, recordSession, (r, counted) => {
  sessionUi.done = { kind: r.kind, ref: r.ref, seconds: r.seconds, counted }
})

initPwa()
