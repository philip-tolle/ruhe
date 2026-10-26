// Eine geführte Sitzung: die gestreamte Sprechstimme als <audio>-Element im Mischpult. Ihre
// Zeitbasis ist das Element selbst, nicht die Audio-Uhr: Spulen und Neuladen verschieben die
// Position, und gezählt wird nur, was das Element tatsächlich gespielt hat (`played`). Wie ein
// Programm meldet sie ihr Ergebnis höchstens einmal. Output, Zustand und Hintergrundklang regelt
// die Engine; was am Element geschieht (Ende, Unterbrechung, Ladefehler), erfährt sie über `events`.
import { holdParam, scheduleMarker } from './clock'
import { playedSeconds, rangesOf, type PlayedRange } from './played'
import type { FadeOut, ProgramSnapshot, SessionRun } from './program-run'
import { createVoice } from './voice'
import type { BackgroundId } from '../sounds/catalog'
import type { SessionResult } from '../stats/schema'

export interface GuidedSpec {
  id: string // Meditations-ID, das `ref` des Ergebnisses
  title: string // Media-Session-Titel
  url: string
  background: BackgroundId | null
  backgroundVolume: number // 0..1
  voiceVolume?: number // 0..1, ohne Angabe 1; gibt bei starkem Hintergrund nach (Balance)
}

export interface GuidedEvents {
  change(): void // Länge bekannt geworden: neu anzeigen
  ended(): void // bis zum Ende gehört, das Ergebnis ist gemeldet
  interrupted(): void // das Element wurde angehalten, nicht von der Engine (Anruf, andere App)
  failed(): void // die Datei lädt nicht; `error` ist gesetzt, die Stimme steht
}

// s Abstand zum Ende beim Vorspulen: Ein Sprung genau aufs Ende wäre ein sofortiges Ende ohne
// die letzten Worte.
const END_MARGIN = 0.25

export class GuidedRun implements SessionRun {
  private readonly element: HTMLAudioElement
  private readonly source: MediaElementAudioSourceNode
  private readonly gain: GainNode
  private readonly date = new Date()
  private hasReported = false
  private failed = false
  private ownPauses = 0 // pause-Ereignisse, die die Sitzung selbst auslöst
  private known = 0 // zuletzt bekannte Länge; ein Ladefehler oder Neuladen nimmt sie nicht weg
  private earlier: PlayedRange[] = [] // vor einem Neuladen gehört (load() leert `played`)
  private resumeAt: number | null = null // Position, an der es nach dem Neuladen weitergeht
  private freed = false
  private cancelFree: (() => void) | null = null

  constructor(
    readonly spec: GuidedSpec,
    private readonly ctx: AudioContext,
    private readonly sink: AudioNode,
    private readonly report: (result: SessionResult) => void,
    private readonly events: GuidedEvents,
  ) {
    const { element, source } = createVoice(ctx, spec.url)
    this.element = element
    this.source = source
    // Eigener Gain in das Mischpult: Begrenzer und Sleep-Gesamtlautstärke gelten wie für alles.
    this.gain = ctx.createGain()
    this.gain.gain.value = Math.min(1, Math.max(0, spec.voiceVolume ?? 1))
    source.connect(this.gain).connect(sink)
    element.addEventListener('loadedmetadata', this.onMetadata)
    element.addEventListener('durationchange', this.onMetadata)
    element.addEventListener('pause', this.onPause)
    element.addEventListener('ended', this.onEnded)
    element.addEventListener('error', this.onError)
  }

  get reported(): boolean {
    return this.hasReported
  }

  get error(): boolean {
    return this.failed
  }

  // Position in der Datei; beim Neuladen nach einem Fehler die Stelle, an der es weitergeht.
  elapsed(): number {
    const position = Math.max(0, this.resumeAt ?? this.element.currentTime)
    const length = this.duration()
    return length > 0 ? Math.min(position, length) : position
  }

  snapshot(): ProgramSnapshot {
    const { id, title } = this.spec
    const length = this.duration()
    return { kind: 'guided', ref: id, title, lead: 0, length, finish: length, elapsed: this.elapsed(), ended: this.hasReported, noBowl: false, error: this.failed }
  }

  // Spielt die Stimme (weiter); im Tipp gerufen, wegen der Autoplay-Regel. AbortError: Ein eigenes
  // Anhalten hat dieses play() abgelöst. NotSupportedError: Die Datei lädt nicht (wie `error`).
  // Jede andere Ablehnung (Autoplay-Regel) geht an die Engine.
  play(): Promise<void> {
    return this.element.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof DOMException && error.name === 'NotSupportedError') return this.fail()
      throw error
    })
  }

  // Hält die Stimme an (Pause der Engine); das dabei ausgelöste pause-Ereignis ist keine Unterbrechung.
  hold(): void {
    if (this.freed || this.element.paused) return
    this.ownPauses++
    this.element.pause()
  }

  // Spult um `delta` s, begrenzt auf die Datei und nie genau aufs Ende; übersprungene Stellen
  // fehlen in `played` und zählen so nicht. Ohne bekannte Länge, bei einem Ladefehler und während
  // des Neuladens geschieht nichts. Vorspulen springt nie zurück (kurz vor dem Ende).
  seek(delta: number): void {
    const length = this.duration()
    if (this.failed || this.resumeAt !== null || length <= 0) return
    const current = this.element.currentTime
    const target = Math.max(0, Math.min(current + delta, length - END_MARGIN))
    if (delta > 0 && target <= current) return
    this.element.currentTime = target
  }

  // Nach einem Ladefehler: neu laden und an der letzten Position weiterspielen (sobald die
  // Metadaten da sind). Das bisher Gehörte bleibt, auch wenn load() `played` leert.
  retry(): Promise<void> {
    this.earlier.push(...rangesOf(this.element.played))
    this.resumeAt = this.elapsed()
    this.failed = false
    this.hold()
    this.element.load()
    // load() verwirft noch nicht zugestellte Ereignisse des Elements, auch ein pause-Ereignis eines
    // eigenen Anhaltens kurz zuvor (Chromium stellt es dann nie zu). Bliebe es gezählt, schluckte
    // es die nächste echte Unterbrechung.
    this.ownPauses = 0
    return this.play()
  }

  // Lautstärke der Stimme (0 … 1); gleitet in `glide` s dorthin, gegen Knacken beim Ziehen.
  setVolume(volume: number, glide: number): void {
    if (this.freed) return
    const now = this.ctx.currentTime
    holdParam(this.gain.gain, now)
    this.gain.gain.linearRampToValueAtTime(volume, now + glide)
  }

  // Meldet (falls noch nicht geschehen) die gehörte Zeit und gibt das Element frei. Was noch
  // klingt, blendet mit `fade` auf der Audio-Uhr aus; ohne `fade` oder angehalten sofort.
  end(fade: FadeOut | null): void {
    this.complete()
    this.detach()
    if (!fade || this.freed || this.element.paused) {
      this.free()
      return
    }
    const now = this.ctx.currentTime
    holdParam(this.gain.gain, now)
    this.gain.gain.linearRampToValueAtTime(0, fade.fadeEnd)
    this.cancelFree = scheduleMarker(this.ctx, this.sink, now, fade.stopAt, () => this.free())
    // Hält die Engine die Audio-Uhr vorher an, käme die Marke erst beim nächsten Start: Dann
    // sofort freigeben, statt das Element still weiterstreamen zu lassen.
    this.ctx.addEventListener('statechange', this.onContextState)
  }

  // Länge in s; 0, bis die Metadaten da sind, nie NaN oder unendlich.
  private duration(): number {
    const d = this.element.duration
    if (Number.isFinite(d) && d > 0) this.known = d
    return this.known
  }

  private complete(): void {
    if (this.hasReported) return
    this.hasReported = true
    const ranges = [...this.earlier, ...rangesOf(this.element.played)]
    this.report({ kind: 'guided', ref: this.spec.id, start: this.date, seconds: playedSeconds(ranges, this.duration()) })
  }

  private fail(): void {
    if (this.failed || this.freed) return
    this.failed = true
    this.hold()
    this.events.failed()
  }

  private detach(): void {
    const { element } = this
    element.removeEventListener('loadedmetadata', this.onMetadata)
    element.removeEventListener('durationchange', this.onMetadata)
    element.removeEventListener('pause', this.onPause)
    element.removeEventListener('ended', this.onEnded)
    element.removeEventListener('error', this.onError)
  }

  // Anhalten, aus dem Mischpult lösen und den Stream schließen (ohne `src` lädt load() nichts mehr).
  private free(): void {
    if (this.freed) return
    this.freed = true
    this.cancelFree?.()
    this.cancelFree = null
    this.ctx.removeEventListener('statechange', this.onContextState)
    this.element.pause()
    this.source.disconnect()
    this.gain.disconnect()
    this.element.removeAttribute('src')
    this.element.load()
  }

  private readonly onMetadata = (): void => {
    if (this.resumeAt !== null && this.element.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.element.currentTime = this.resumeAt
      this.resumeAt = null
    }
    this.events.change()
  }

  private readonly onPause = (): void => {
    if (this.ownPauses > 0) {
      this.ownPauses--
      return
    }
    // Am Ende hält das Element selbst an; gleich danach kommt `ended`.
    if (this.element.ended) return
    this.events.interrupted()
  }

  private readonly onEnded = (): void => {
    this.complete()
    this.events.ended()
  }

  private readonly onError = (): void => this.fail()

  private readonly onContextState = (): void => {
    if (this.ctx.state !== 'running') this.free()
  }
}
