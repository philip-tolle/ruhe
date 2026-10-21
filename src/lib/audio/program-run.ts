// Ein Durchlauf eines Programms auf der Audio-Uhr: Startzeit, eigener Gain, die beiden Marken
// (gezählte Zeit vorbei, ausgeklungen) und das Sitzungsergebnis, das er höchstens einmal meldet.
// Dazu die Schnittstelle, die er mit einer geführten Sitzung (guided-run.ts) teilt: Die Engine hält
// höchstens eine Sitzung der einen oder anderen Art; Output, Zustand und Hintergrundklang regelt sie.
import { holdParam, scheduleMarker } from './clock'
import type { ProgramAssets, ProgramSpec } from './program'
import type { SessionResult } from '../stats/schema'

// s Vorsprung des Programmstarts, damit die ersten Klänge nicht schon in der Vergangenheit liegen.
const START_DELAY = 0.05

// Laufende Sitzung für die Oberfläche; Zeiten in Sekunden ab Programmstart bzw. Dateianfang.
export interface ProgramSnapshot {
  kind: 'timer' | 'breath' | 'guided'
  ref: string
  title: string
  lead: number
  length: number
  finish: number
  elapsed: number // auf der Audio-Uhr (Pausen zählen nicht); geführt: Position in der Datei
  ended: boolean // gezählte Zeit vorbei und Ergebnis gemeldet; es klingt noch aus
  noBowl: boolean // ein Timer, dessen Klangschale nicht geladen werden konnte: Er läuft still
  error: boolean // eine geführte Meditation, deren Datei nicht lädt; bei Programmen nie
}

// Ausblenden beim Beenden (Audio-Uhr): Rampe auf 0 bis `fadeEnd`, die Klänge enden bei `stopAt`.
export interface FadeOut {
  fadeEnd: number
  stopAt: number
}

// Eine Sitzung, wie die Engine sie hält. Jeder Weg, der sie beendet, ruft `end`; gemeldet wird
// dabei höchstens einmal je Sitzung.
export interface SessionRun {
  // Ergebnis schon gemeldet? Dann klingt die Sitzung nur noch aus.
  readonly reported: boolean
  snapshot(): ProgramSnapshot
  // s für die Anzeige (`engine.programElapsed()`).
  elapsed(): number
  // Beendet die Sitzung: meldet (falls noch nicht geschehen) und lässt ihren Klang mit `fade`
  // ausklingen, ohne `fade` (die Audio-Uhr steht) verstummt er sofort.
  end(fade: FadeOut | null): void
}

// Was der Durchlauf eingeplant hat: sein Gain in `sink` und der Stopp seiner Klänge.
interface Sound {
  gain: GainNode
  sink: AudioNode
  stop: (when?: number) => void
}

export class ProgramRun implements SessionRun {
  // Programmstart auf der Audio-Uhr und als Datum; null, solange die Klangschale noch lädt.
  private start: { t0: number; date: Date } | null = null
  private sound: Sound | null = null
  private markers: (() => void)[] = []
  private hasReported = false
  private noBowl = false

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
    this.start = { t0, date: new Date() }
    // Nur der Timer spielt die Klangschale; eine Atemübung braucht sie nie.
    this.noBowl = spec.kind === 'timer' && assets.strike === null
    this.sound = { gain, sink, stop: spec.schedule(ctx, gain, t0, assets) }
    // Am Ende zählt genau die geplante Dauer: Kommt eine Marke verzögert an (gedrosselter
    // Hintergrund), ändert das nichts. Ausgeklungen heißt, die gezählte Zeit ist sicher vorbei.
    this.markers = [
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

  // Hat der Durchlauf sein Ergebnis gemeldet? Ab dem Ende der gezählten Zeit klingt er nur noch aus.
  get reported(): boolean {
    return this.hasReported
  }

  // s seit Programmstart auf der Audio-Uhr (sie steht in der Pause); 0, solange noch nicht eingeplant.
  elapsed(): number {
    return this.start ? Math.max(0, this.ctx.currentTime - this.start.t0) : 0
  }

  snapshot(): ProgramSnapshot {
    const { kind, ref, title, lead, length, finish } = this.spec
    return { kind, ref, title, lead, length, finish, elapsed: this.elapsed(), ended: this.hasReported, noBowl: this.noBowl, error: false }
  }

  // Beendet den Durchlauf; die Marken entfallen sofort. Was klingt, blendet mit `fade` aus wie ein
  // gestoppter Klang, statt hart abzubrechen. Ohne `fade` (die Audio-Uhr steht, eine Rampe wäre erst
  // nach dem Fortsetzen zu hören) verstummt es sofort. War der Durchlauf eingeplant, meldet er
  // (falls noch nicht geschehen) die bis jetzt gezählte Zeit ohne Vorlauf.
  end(fade: FadeOut | null): void {
    for (const cancel of this.markers) cancel()
    this.markers = []
    this.silence(fade)
    if (!this.start) return
    const { lead, length } = this.spec
    this.complete(Math.min(length, Math.max(0, this.elapsed() - lead)))
  }

  private silence(fade: FadeOut | null): void {
    const sound = this.sound
    this.sound = null
    if (!sound) return
    const { gain, sink, stop } = sound
    if (!fade) {
      stop()
      gain.disconnect()
      return
    }
    const now = this.ctx.currentTime
    holdParam(gain.gain, now)
    gain.gain.linearRampToValueAtTime(0, fade.fadeEnd)
    stop(fade.stopAt)
    scheduleMarker(this.ctx, sink, now, fade.stopAt, () => gain.disconnect())
  }

  private complete(seconds: number): void {
    if (this.hasReported || !this.start) return
    this.hasReported = true
    const { kind, ref } = this.spec
    this.report({ kind, ref, start: this.start.date, seconds })
  }
}
