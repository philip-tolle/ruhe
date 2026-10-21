// Abschluss-Anzeige: die zuletzt beendete Sitzung, bis die Person „Fertig“ tippt oder zurückgeht.
// Gesetzt wird sie in main.ts über `connectSessions`; die Player zeigen solange ihren Abschluss.
import { engine } from '../audio/engine'
import type { ProgramSpec } from '../audio/program'
import type { Meditation } from '../content/catalog'
import { absoluteAudioUrl, backgroundVolume } from '../meditation/guided-view'
import { saveForOffline } from '../offline/status.svelte'
import type { SessionKind } from '../stats/schema'
import { setLastUsed, stats } from '../stats/store.svelte'

export interface SessionDoneInfo {
  kind: SessionKind
  ref: string
  seconds: number
  counted: boolean
}

export const sessionUi: { done: SessionDoneInfo | null } = $state({ done: null })

export function clearDone(): void {
  sessionUi.done = null
}

/**
 * Startet ein Programm aus der Oberfläche (im Tipp, wegen der Autoplay-Regel). Ein noch offener
 * Abschluss gehört zur vorigen Sitzung und verschwindet zuerst. Scheitert der Start, steht das
 * Programm pausiert mit dem Hinweis „Zum Starten tippen“ bereit; der Fehler bleibt hier.
 */
export function startSession(spec: ProgramSpec): void {
  clearDone()
  engine.startProgram(spec).catch(() => {})
}

/**
 * Startet eine geführte Meditation aus der Oberfläche, wie `startSession` im Tipp selbst (kein
 * `await` davor). Hintergrund und Balance kommen aus den Einstellungen. Beim ersten Abspielen wird
 * die Datei zusätzlich im Hintergrund vollständig gespeichert (offline verfügbar).
 */
export function startGuidedSession(m: Meditation): void {
  clearDone()
  setLastUsed({ kind: 'guided', id: m.id })
  const url = absoluteAudioUrl(m, location.href)
  const { guidedSound, voiceBalance } = stats.data.settings
  engine
    .startGuided({ id: m.id, title: m.title, url, background: guidedSound, backgroundVolume: backgroundVolume(voiceBalance) })
    .catch(() => {})
  saveForOffline(url)
}
