// Verbindet das Ende jeder Sitzung mit der Statistik und der Abschluss-Anzeige: Erst wird das
// Ergebnis erfasst (zählt es, bekommt es eine ID), dann mit dieser ID angezeigt, damit der
// Abschluss den Ruhe-Check-in an die Sitzung hängen kann; `null` heißt: zählt nicht. Die Quelle ist in der
// App die Audio-Engine; hier reicht ihr `onSessionEnd`, damit sich das ohne Audio testen lässt.
import type { SessionResult } from './stats/schema'
import type { SessionDoneInfo } from './ui/session-ui.svelte'

export interface SessionSource {
  onSessionEnd(listener: (r: SessionResult) => void): () => void
}

/** Gibt eine Funktion zurück, die die Verbindung wieder löst. */
export function connectSessions(
  source: SessionSource,
  record: (r: SessionResult) => string | null,
  done: (r: SessionResult, sessionId: string | null) => void,
): () => void {
  return source.onSessionEnd((r) => done(r, record(r)))
}

/**
 * Was die Oberfläche nach einem Ergebnis zeigt. Ein Timer, eine Atemübung oder eine geführte Meditation
 * zeigt ihren Abschluss auch dann, wenn sie nicht zählt (`counted: false`). Ein Hack oder Sprint, der nicht
 * zählt (zu kurz), hat nichts zu zeigen: `null`.
 */
export function doneInfoFor(r: SessionResult, id: string | null): SessionDoneInfo | null {
  if ((r.kind === 'hack' || r.kind === 'focus') && id === null) return null
  return { kind: r.kind, ref: r.ref, seconds: r.seconds, counted: id !== null, sessionId: id }
}
