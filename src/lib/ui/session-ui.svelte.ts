// Abschluss-Anzeige: die zuletzt beendete Sitzung, bis die Person „Fertig“ tippt oder zurückgeht.
// Gesetzt wird sie in main.ts über `connectSessions`; die Player zeigen solange ihren Abschluss.
import { engine } from '../audio/engine'
import type { ProgramSpec } from '../audio/program'
import type { SessionKind } from '../stats/schema'

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
