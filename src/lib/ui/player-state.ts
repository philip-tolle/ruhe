// Welche Sitzung ein Vollbild-Player (Timer, Atemübung, geführte Meditation) zeigt: die Laufansicht,
// solange die Sitzung seiner Art läuft, danach den Abschluss, solange er offen ist. Liest nur
// reaktiven Zustand; aufgerufen aus `$derived`, bleibt das Ergebnis aktuell.
import { audio } from '../audio/engine-store.svelte'
import type { ProgramSnapshot } from '../audio/engine'
import { sessionUi, type SessionDoneInfo } from './session-ui.svelte'

export type PlayerKind = ProgramSnapshot['kind']

/** Das laufende Programm dieser Art; `null`, solange keines läuft oder sein Ergebnis schon gemeldet ist. */
export function runningProgram(kind: PlayerKind): ProgramSnapshot | null {
  const program = audio.snap.program
  return program?.kind === kind && !program.ended ? program : null
}

/** Der offene Abschluss einer Sitzung dieser Art. */
export function doneOf(kind: PlayerKind): SessionDoneInfo | null {
  return sessionUi.done?.kind === kind ? sessionUi.done : null
}

/** Ist der Player dieser Art offen (Lauf- oder Abschlussansicht)? */
export function playerOpen(kind: PlayerKind): boolean {
  return runningProgram(kind) !== null || doneOf(kind) !== null
}

const KINDS: readonly PlayerKind[] = ['timer', 'breath', 'guided']

/** Ist irgendein Vollbild-Player offen? Dann ist die App darunter unerreichbar. */
export function anyPlayerOpen(): boolean {
  return KINDS.some(playerOpen)
}
