// Abschluss-Anzeige: die zuletzt beendete Sitzung, bis die Person „Fertig“ tippt oder zurückgeht.
// Gesetzt wird sie in main.ts über `connectSessions`; die Player zeigen solange ihren Abschluss.
import { engine } from '../audio/engine'
import { focusProgram, hackProgram, type ProgramSpec } from '../audio/program'
import type { Meditation } from '../content/catalog'
import { hackById } from '../energy/hacks'
import { absoluteAudioUrl, guidedLevels } from '../meditation/guided-view'
import { saveForOffline } from '../offline/status.svelte'
import type { BackgroundId } from '../sounds/catalog'
import { saveBackgroundForOffline } from './offline-ui.svelte'
import type { FocusMinutes, ResultKind } from '../stats/schema'
import { setLastUsed, stats, updateSettings } from '../stats/store.svelte'

export interface SessionDoneInfo {
  kind: ResultKind
  ref: string
  seconds: number
  counted: boolean
  /** Die gespeicherte Sitzung (für den Ruhe-Check-in); `null`, wenn sie nicht zählt. */
  sessionId: string | null
}

// Die reine Abbildung Ergebnis → Abschluss liegt in session-wiring.ts (ohne Runen, damit sie sich ohne
// Oberfläche testen lässt); die Oberfläche greift hier darauf zu.
export { doneInfoFor } from '../session-wiring'

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
  saveBackgroundForOffline(spec.background)
}

/**
 * Startet einen Brain Hack aus der Oberfläche (im Tipp, wie `startSession`). Eine unbekannte Kennung
 * tut nichts. „Zuletzt genutzt“ bleibt: Es kennt nur Meditationen, Timer und Atemübungen.
 */
export function startHack(id: string): void {
  const hack = hackById(id)
  if (hack) startSession(hackProgram(hack))
}

/**
 * Startet einen Fokus-Sprint aus der Oberfläche (im Tipp, wie `startSession`). Dauer und Hintergrund
 * gelten beim nächsten Mal wieder (`settings.focus`); die Aufgabe nur für diesen Sprint.
 */
export function startSprint(minutes: FocusMinutes, task: string, sound: BackgroundId | null): void {
  updateSettings({ focus: { minutes, sound } })
  startSession(focusProgram(minutes, sound, task))
}

/**
 * Startet eine geführte Meditation aus der Oberfläche, wie `startSession` im Tipp selbst (kein
 * `await` davor). Hintergrund und Balance kommen aus den Einstellungen. Beim ersten Abspielen wird
 * die Datei (und ein Musikstück als Hintergrund) zusätzlich im Hintergrund vollständig gespeichert.
 */
export function startGuidedSession(m: Meditation): void {
  clearDone()
  setLastUsed({ kind: 'guided', id: m.id })
  const url = absoluteAudioUrl(m, location.href)
  const { guidedSound, voiceBalance } = stats.data.settings
  const levels = guidedLevels(voiceBalance, guidedSound !== null)
  engine
    .startGuided({ id: m.id, title: m.title, url, background: guidedSound, backgroundVolume: levels.background, voiceVolume: levels.voice })
    .catch(() => {})
  saveForOffline(url)
  saveBackgroundForOffline(guidedSound)
}
