// Musik: ein Stück als gestreamte Stimme in Endlosschleife. Dekodiert wäre ein Stück von fünf
// Minuten über 100 MB im Speicher; deshalb spielen es zwei <audio>-Elemente über je eine
// MediaElementAudioSourceNode, im Wechsel: `crossfade` Sekunden vor dem Ende beginnt das andere von
// vorn, und beide blenden auf der Audio-Uhr über. Danach hält das alte an und springt an den Anfang.
// Hält die Engine die Audio-Uhr an, hält sie mit `hold` auch die Elemente an, die gerade klingen
// (mitten in einer Überblendung beide), und setzt sie mit `resume` fort. Unterbrechungen von außen
// erkennt die Engine am Anker; was die Elemente selbst melden, zählt hier nicht.
import { holdParam, scheduleMarker } from './clock'
import type { Voice } from './voice'

// s Überblendung an der Naht.
export const CROSSFADE = 8

export interface MusicVoice extends Voice {
  // Das erste Element kann spielen; lädt die Datei nicht: Fehler „Konnte nicht geladen werden: <url>“.
  ready: Promise<void>
  hold(): void
  resume(): Promise<void>
}

interface Player {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
}

// Wie die Sprechstimme (voice.ts): nicht im DOM, CORS vor `src`, damit der Service Worker auch
// gespeicherte Dateien in Teilstücken ausliefern kann.
function player(ctx: AudioContext, url: string, output: AudioNode, preload: 'auto' | 'none', level: number): Player {
  const element = new Audio()
  element.preload = preload
  element.crossOrigin = 'anonymous'
  element.src = url
  const source = ctx.createMediaElementSource(element)
  const gain = ctx.createGain()
  gain.gain.value = level
  source.connect(gain).connect(output)
  return { element, source, gain }
}

// play(), dessen Ablehnung nur zählt, wenn sie kein eigenes Anhalten (AbortError) und kein
// Ladefehler (NotSupportedError, dafür gibt es `ready`) ist.
function start(element: HTMLAudioElement): Promise<void> {
  return element.play().catch((error: unknown) => {
    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotSupportedError')) return
    throw error
  })
}

class MusicLoop implements MusicVoice {
  readonly output: GainNode
  readonly ready: Promise<void>
  private readonly players: [Player, Player]
  private index = 0 // das Element, das gerade (allein bzw. ausblendend) spielt
  private crossing = false
  private freed = false
  private cancelSwap: (() => void) | null = null
  private cancelStop: (() => void) | null = null

  constructor(
    private readonly ctx: AudioContext,
    url: string,
    private readonly crossfade: number,
  ) {
    this.output = ctx.createGain()
    this.players = [player(ctx, url, this.output, 'auto', 1), player(ctx, url, this.output, 'none', 0)]
    const first = this.players[0].element
    this.ready = new Promise((resolve, reject) => {
      const done = () => {
        first.removeEventListener('canplay', ok)
        first.removeEventListener('error', failed)
      }
      const ok = () => {
        done()
        resolve()
      }
      const failed = () => {
        done()
        reject(new Error('Konnte nicht geladen werden: ' + url))
      }
      first.addEventListener('canplay', ok)
      first.addEventListener('error', failed)
    })
    // Wird die Stimme gestoppt, bevor jemand wartet, bleibt die Ablehnung trotzdem nicht unbehandelt.
    this.ready.catch(() => {})
    for (const { element } of this.players) {
      element.addEventListener('timeupdate', this.onTime)
      element.addEventListener('ended', this.onEnded)
    }
    // Sofort, noch in der Nutzergeste.
    void start(first).catch(() => {})
  }

  hold(): void {
    if (this.freed) return
    for (const { element } of this.sounding()) element.pause()
  }

  async resume(): Promise<void> {
    if (this.freed) return
    await Promise.all(this.sounding().map(({ element }) => start(element)))
  }

  stop(when = this.ctx.currentTime): void {
    if (this.freed) return
    if (when <= this.ctx.currentTime) {
      this.free()
      return
    }
    this.cancelStop?.()
    this.cancelStop = scheduleMarker(this.ctx, this.output, this.ctx.currentTime, when, () => this.free())
    // Hält die Engine die Audio-Uhr vorher an, käme die Marke erst beim nächsten Start: dann sofort.
    this.ctx.addEventListener('statechange', this.onContextState)
  }

  private get current(): Player {
    return this.players[this.index]
  }

  private get next(): Player {
    return this.players[1 - this.index]
  }

  private sounding(): Player[] {
    return this.crossing ? [this.current, this.next] : [this.current]
  }

  // Das andere Element beginnt von vorn; beide blenden über `crossfade` s über, dann tauschen sie.
  private cross(): void {
    const { current, next, ctx, crossfade } = this
    this.crossing = true
    next.element.currentTime = 0
    void start(next.element).catch(() => {})
    const now = ctx.currentTime
    holdParam(current.gain.gain, now)
    current.gain.gain.linearRampToValueAtTime(0, now + crossfade)
    holdParam(next.gain.gain, now)
    next.gain.gain.linearRampToValueAtTime(1, now + crossfade)
    this.cancelSwap = scheduleMarker(ctx, this.output, now, now + crossfade, () => this.swap())
  }

  private swap(): void {
    const old = this.current
    this.cancelSwap = null
    this.index = 1 - this.index
    this.crossing = false
    old.element.pause()
    old.element.currentTime = 0
  }

  private free(): void {
    if (this.freed) return
    this.freed = true
    this.cancelSwap?.()
    this.cancelStop?.()
    this.cancelSwap = this.cancelStop = null
    this.ctx.removeEventListener('statechange', this.onContextState)
    for (const { element, source, gain } of this.players) {
      element.removeEventListener('timeupdate', this.onTime)
      element.removeEventListener('ended', this.onEnded)
      element.pause()
      source.disconnect()
      gain.disconnect()
      // Ohne `src` lädt load() nichts mehr: Der Stream schließt.
      element.removeAttribute('src')
      element.load()
    }
  }

  private readonly onTime = (event: Event): void => {
    if (this.freed || this.crossing || event.target !== this.current.element) return
    const { duration, currentTime } = this.current.element
    if (Number.isFinite(duration) && duration > 0 && duration - currentTime <= this.crossfade) this.cross()
  }

  // Kam kein `timeupdate` rechtzeitig (gedrosselt), beginnt das andere spätestens am Ende.
  private readonly onEnded = (event: Event): void => {
    if (!this.freed && !this.crossing && event.target === this.current.element) this.cross()
  }

  private readonly onContextState = (): void => {
    if (this.ctx.state !== 'running') this.free()
  }
}

export function createMusicVoice(ctx: AudioContext, url: string, opts: { crossfade?: number } = {}): MusicVoice {
  return new MusicLoop(ctx, url, opts.crossfade ?? CROSSFADE)
}
