// Ein Durchlauf eines Programms auf der Audio-Uhr: Startzeit, eigener Gain, die beiden Marken
// (gezählte Zeit vorbei, ausgeklungen) und das Sitzungsergebnis, das er höchstens einmal meldet.
// Die Engine hält höchstens einen Durchlauf; Output, Zustand und Hintergrundklang regelt sie.
import { scheduleMarker } from './clock'
import type { ProgramAssets, ProgramSpec } from './program'
import type { SessionResult } from '../stats/schema'

// s Vorsprung des Programmstarts, damit die ersten Klänge nicht schon in der Vergangenheit liegen.
const START_DELAY = 0.05

// Laufendes Programm für die Oberfläche; Zeiten in Sekunden ab Programmstart.
export interface ProgramSnapshot {
  kind: 'timer' | 'breath'
  ref: string
  title: string
  lead: number
  length: number
  finish: number
  elapsed: number // auf der Audio-Uhr, Pausen zählen nicht
  ended: boolean // gezählte Zeit vorbei und Ergebnis gemeldet; es klingt noch aus
}

export class ProgramRun {
  // Programmstart auf der Audio-Uhr und als Datum; null, solange die Klangschale noch lädt.
  private start: { t0: number; date: Date } | null = null
  private gain: GainNode | null = null
  private cancels: (() => void)[] = []
  private reported = false

  constructor(
    readonly spec: ProgramSpec,
    private readonly ctx: BaseAudioContext,
    private readonly report: (result: SessionResult) => void,
  ) {}

  // Plant alles ab kurz nach jetzt ein, über einen eigenen Gain in `sink`. Nach dem Ergebnis am
  // Ende der gezählten Zeit folgt `onCounted`, nach dem Ausklingen `onFinish`.
  begin(sink: AudioNode, assets: ProgramAssets, onCounted: () => void, onFinish: () => void): void {
    const { ctx, spec } = this
    const now = ctx.currentTime
    const t0 = now + START_DELAY
    const gain = ctx.createGain()
    gain.gain.value = 1
    gain.connect(sink)
    this.gain = gain
    this.start = { t0, date: new Date() }
    // Am Ende zählt genau die geplante Dauer: Kommt eine Marke verzögert an (gedrosselter
    // Hintergrund), ändert das nichts. Ausgeklungen heißt, die gezählte Zeit ist sicher vorbei.
    this.cancels = [
      spec.schedule(ctx, gain, t0, assets),
      scheduleMarker(ctx, sink, now, t0 + spec.lead + spec.length, () => {
        this.complete(spec.length)
        onCounted()
      }),
      scheduleMarker(ctx, sink, now, t0 + spec.finish, () => {
        this.complete(spec.length)
        onFinish()
      }),
    ]
  }

  // s seit Programmstart auf der Audio-Uhr (sie steht in der Pause); 0, solange noch nicht eingeplant.
  elapsed(): number {
    return this.start ? Math.max(0, this.ctx.currentTime - this.start.t0) : 0
  }

  snapshot(): ProgramSnapshot {
    const { kind, ref, title, lead, length, finish } = this.spec
    return { kind, ref, title, lead, length, finish, elapsed: this.elapsed(), ended: this.reported }
  }

  // Bricht sofort ab: Eingeplantes verstummt, die Marken entfallen. War der Durchlauf schon
  // eingeplant, meldet er (falls noch nicht geschehen) die bis jetzt gezählte Zeit ohne Vorlauf.
  end(): void {
    for (const cancel of this.cancels) cancel()
    this.cancels = []
    this.gain?.disconnect()
    this.gain = null
    if (!this.start) return
    const { lead, length } = this.spec
    this.complete(Math.min(length, Math.max(0, this.elapsed() - lead)))
  }

  private complete(seconds: number): void {
    if (this.reported || !this.start) return
    this.reported = true
    const { kind, ref } = this.spec
    this.report({ kind, ref, start: this.start.date, seconds })
  }
}
