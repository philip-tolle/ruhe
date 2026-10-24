// Verbindet das Ende jeder Sitzung mit der Statistik und der Abschluss-Anzeige: Erst wird das
// Ergebnis erfasst (zählt es, ab 60 s, bekommt es eine ID), dann mit dieser ID angezeigt, damit der
// Abschluss den Ruhe-Check-in an die Sitzung hängen kann; `null` heißt: zählt nicht. Die Quelle ist in der
// App die Audio-Engine; hier reicht ihr `onSessionEnd`, damit sich das ohne Audio testen lässt.
import type { SessionResult } from './stats/schema'

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
