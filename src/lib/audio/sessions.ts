// Sitzungs-Verwaltung der Engine: höchstens eine Sitzung zur Zeit (Programm oder geführte
// Meditation) und die Hörer ihrer Ergebnisse. Jede Sitzung meldet über `report` höchstens einmal;
// ein Hörer, der wirft, bricht dabei keinen Wechsel ab. Wann eine Sitzung beginnt und endet und
// was dabei mit Output, Zustand und Klängen geschieht, entscheidet die Engine.
import { GuidedRun, type GuidedEvents, type GuidedSpec } from './guided-run'
import type { ProgramSpec } from './program'
import { ProgramRun, type SessionRun } from './program-run'
import type { SessionResult } from '../stats/schema'

export class Sessions {
  private run: SessionRun | null = null
  private readonly listeners = new Set<(r: SessionResult) => void>()

  // Die laufende Sitzung, auch ein Programm, dessen Klangschale noch lädt; null ohne.
  get current(): SessionRun | null {
    return this.run
  }

  // Die laufende Sitzung, wenn sie eine geführte Meditation ist.
  get guided(): GuidedRun | null {
    return this.run instanceof GuidedRun ? this.run : null
  }

  // Ist `run` noch die laufende Sitzung? Was eine abgelöste meldet, bewirkt nichts mehr.
  holds(run: SessionRun): boolean {
    return this.run === run
  }

  // Neue Sitzungen, deren Ergebnis an die Hörer geht.
  createProgram(spec: ProgramSpec, ctx: BaseAudioContext): ProgramRun {
    return new ProgramRun(spec, ctx, this.report)
  }

  createGuided(spec: GuidedSpec, ctx: AudioContext, sink: AudioNode, events: GuidedEvents): GuidedRun {
    return new GuidedRun(spec, ctx, sink, this.report, events)
  }

  // Macht `next` zur laufenden Sitzung (null: keine) und gibt die bisherige heraus. Beenden
  // (`end`, meldet) muss sie der Aufrufer, sobald Klänge und Zustand zum Wechsel passen.
  swap(next: SessionRun | null): SessionRun | null {
    const previous = this.run
    this.run = next
    return previous
  }

  listen(listener: (r: SessionResult) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Gemeldet wird mitten in einem Wechsel (Stopp, neuer Klang, neue Sitzung): Ein Hörer, der
  // wirft, darf ihn nicht abbrechen. Sein Fehler wird nur berichtet.
  private readonly report = (result: SessionResult): void => {
    for (const listener of this.listeners) {
      try {
        listener(result)
      } catch (error) {
        reportError(error)
      }
    }
  }
}
