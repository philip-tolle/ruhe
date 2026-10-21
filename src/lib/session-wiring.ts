// Verbindet das Ende jeder Sitzung mit der Statistik und der Abschluss-Anzeige: Erst wird das
// Ergebnis erfasst (zählt es, ab 60 s?), dann mit diesem Urteil angezeigt. Die Quelle ist in der
// App die Audio-Engine; hier reicht ihr `onSessionEnd`, damit sich das ohne Audio testen lässt.
import type { SessionResult } from './stats/schema'

export interface SessionSource {
  onSessionEnd(listener: (r: SessionResult) => void): () => void
}

/** Gibt eine Funktion zurück, die die Verbindung wieder löst. */
export function connectSessions(
  source: SessionSource,
  record: (r: SessionResult) => boolean,
  done: (r: SessionResult, counted: boolean) => void,
): () => void {
  return source.onSessionEnd((r) => done(r, record(r)))
}
