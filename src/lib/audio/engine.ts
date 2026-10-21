// Audio-Engine: Mischpult für bis zu acht Klänge, Sleep-Timer und Wiedergabezustand.
// Der einzige Output (AudioContext → Lautsprecher, plus lautloser Anker) entsteht beim ersten `toggle`,
// also innerhalb einer Nutzergeste. Ein-/Ausblenden, Sleep-Ende und das Abbauen gestoppter
// Stimmen sind auf der Audio-Uhr eingeplant (Rampen, `onended`), nie über JS-Timer.
import { holdParam, scheduleMarker, scheduleSleepFade } from './clock'
import { createLoopVoice, loadBuffer } from './loops'
import { syncMediaSession, type MediaActions } from './media-session'
import { createOutput, type Output } from './output'
import { sleepPlan } from './sleep-timer'
import type { Voice } from './voice'
import { assetUrl, soundById, type SoundId } from '../sounds/catalog'

export type EngineState = 'idle' | 'playing' | 'paused'

export interface EngineSnapshot {
  state: EngineState
  volumes: Partial<Record<SoundId, number>> // aktive Klänge → Lautstärke 0..1
  loading: SoundId[]
  errors: SoundId[]
  sleepMinutes: number | null // Auswahl, bleibt über Sitzungen erhalten
  remainingSec: number | null // null wenn idle oder endlos
  needsTap: boolean // Start scheiterte (z. B. Autoplay-Regel): pausiert, „Weiter“ versucht es neu
}

export const DEFAULT_VOLUME = 0.7

const FADE_IN = 1.5 // s, Einblenden einer neuen Stimme
const FADE_OUT = 0.8 // s, Ausblenden beim Stoppen
const STOP_AFTER = 0.9 // s, danach enden die Quellen der Stimme
const VOLUME_GLIDE = 0.05 // s, gegen Knacken beim Ziehen des Lautstärkereglers

type Loader = (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>

// Eine Stimme mit eigenem Gain im Mischpult.
interface Channel {
  voice: Voice
  gain: GainNode
  volume: number
}

// Laufender Sleep-Countdown ab `t0` (Audio-Uhr).
interface Countdown {
  t0: number
  end: number
  cancel: () => void
}

export class AudioEngine {
  private readonly makeOutput: () => Output
  private readonly load: Loader
  private readonly listeners = new Set<(s: EngineSnapshot) => void>()
  // Steuerung aus Benachrichtigung und Sperrbildschirm; Fehler bleiben in der Engine.
  private readonly actions: MediaActions = {
    play: () => void this.resume().catch(() => {}),
    pause: () => void this.pause().catch(() => {}),
    stop: () => void this.stopAll().catch(() => {}),
  }

  private out: Output | null = null
  private state: EngineState = 'idle'
  private starting: Promise<void> = Promise.resolve()
  private startPending = false // der aktuelle Start (resume + play) ist noch nicht durch
  private startFailed = false // der letzte Start wurde abgelehnt
  private readonly active = new Map<SoundId, Channel>() // klingende Klänge
  private readonly pending = new Map<SoundId, number>() // ladende Klänge → Nummer des Ladevorgangs
  private readonly errors = new Set<SoundId>()
  private readonly channels = new Set<Channel>() // alle noch nicht abgebauten Stimmen
  private loads = 0
  private sleepMinutes: number | null = null
  private countdown: Countdown | null = null
  private settle: object | null = null // Marke, die nach dem letzten Stopp den Output anhält
  private ownPauses = 0 // pause-Events des Elements, die die Engine selbst auslöst

  constructor(opts: { createOutput?: () => Output; load?: Loader } = {}) {
    this.makeOutput = opts.createOutput ?? createOutput
    this.load = opts.load ?? loadBuffer
  }

  // Startet einen inaktiven Klang bzw. stoppt einen aktiven oder ladenden.
  // Darf ohne Abwarten mehrfach hintereinander gerufen werden: Je Klang gibt es höchstens eine
  // aktive Stimme (eine gerade gestoppte klingt höchstens noch 0,8 s aus).
  async toggle(id: SoundId): Promise<void> {
    const out = this.ensureOutput()
    if (this.active.has(id) || this.pending.has(id)) {
      this.stop([id])
      this.emit()
      return
    }

    const sound = soundById(id)
    this.errors.delete(id)
    const starting = this.ensurePlaying()
    const load = ++this.loads
    this.pending.set(id, load)
    this.emit()
    const [started, loaded] = await Promise.allSettled([starting, this.load(out.ctx, assetUrl(sound.file))])
    // Wurde der Klang inzwischen gestoppt (oder danach neu angestoßen), gilt dieser Ladevorgang nicht mehr.
    if (this.pending.get(id) === load) {
      this.pending.delete(id)
      if (loaded.status === 'fulfilled') {
        this.addChannel(id, createLoopVoice(out.ctx, loaded.value))
      } else {
        this.errors.add(id)
        this.release([])
      }
      this.emit()
    }
    if (started.status === 'rejected') throw started.reason
  }

  setVolume(id: SoundId, volume: number): void {
    const channel = this.active.get(id)
    if (!channel) return
    const value = Math.min(1, Math.max(0, volume))
    const now = this.out!.ctx.currentTime
    channel.volume = value
    holdParam(channel.gain.gain, now)
    channel.gain.gain.linearRampToValueAtTime(value, now + VOLUME_GLIDE)
    this.emit()
  }

  // Im Zustand idle wird nur die Auswahl gespeichert, sonst ab jetzt neu geplant.
  setSleepTimer(minutes: number | null): void {
    this.sleepMinutes = minutes
    if (this.state !== 'idle') this.planSleep()
    this.emit()
  }

  async pause(): Promise<void> {
    if (this.state !== 'playing') return
    this.state = 'paused'
    this.emit()
    await this.suspendOutput()
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') return
    const starting = this.ensurePlaying()
    this.emit()
    await starting
  }

  async stopAll(): Promise<void> {
    if (this.active.size === 0 && this.pending.size === 0) return
    this.stop([...this.active.keys(), ...this.pending.keys()])
    this.emit()
  }

  snapshot(): EngineSnapshot {
    const volumes: Partial<Record<SoundId, number>> = {}
    for (const [id, channel] of this.active) volumes[id] = channel.volume
    const c = this.countdown
    return {
      state: this.state,
      volumes,
      loading: [...this.pending.keys()],
      errors: [...this.errors],
      sleepMinutes: this.sleepMinutes,
      remainingSec: c && this.state !== 'idle' ? Math.max(0, c.t0 + c.end - this.out!.ctx.currentTime) : null,
      needsTap: this.state === 'paused' && this.startFailed,
    }
  }

  voiceCount(): number {
    return this.channels.size
  }

  // Ruft `listener` sofort mit dem aktuellen Stand und danach nach jeder Änderung.
  subscribe(listener: (s: EngineSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const listener of this.listeners) listener(snap)
    syncMediaSession(snap, this.actions)
  }

  private ensureOutput(): Output {
    if (!this.out) {
      this.out = this.makeOutput()
      this.out.element.addEventListener('pause', this.onElementPause)
      this.out.ctx.addEventListener('statechange', this.onContextStateChange)
    }
    return this.out
  }

  // idle/paused → playing: zuerst den Output starten. Ab idle beginnt der Sleep-Countdown.
  // Scheitert der Start (z. B. play() ohne Nutzergeste abgelehnt), wird daraus eine Pause mit
  // Hinweis, statt still „playing“ zu bleiben; „Weiter“ startet dann neu.
  private ensurePlaying(): Promise<void> {
    if (this.state === 'playing') return this.starting
    const fromIdle = this.state === 'idle'
    this.state = 'playing'
    this.startFailed = false
    this.startPending = true
    const starting: Promise<void> = this.out!.start().then(
      () => {
        if (this.starting === starting) this.startPending = false
      },
      (error: unknown) => {
        if (this.starting === starting) {
          this.startPending = false
          if (this.state === 'playing') {
            this.starting = Promise.resolve()
            this.state = 'paused'
            this.startFailed = true
            void this.suspendOutput() // Audio-Uhr anhalten, damit die Restzeit steht
            this.emit()
          }
        }
        throw error
      },
    )
    this.starting = starting
    if (fromIdle) {
      this.settle = null
      this.planSleep()
    }
    return starting
  }

  // Neue Stimme mit eigenem Gain, der in 1,5 s von 0 auf die Lautstärke steigt.
  private addChannel(id: SoundId, voice: Voice): void {
    const { ctx, input } = this.out!
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(DEFAULT_VOLUME, now + FADE_IN)
    voice.output.connect(gain).connect(input)
    const channel = { voice, gain, volume: DEFAULT_VOLUME }
    this.active.set(id, channel)
    this.channels.add(channel)
  }

  private stop(ids: SoundId[]): void {
    const released: Channel[] = []
    for (const id of ids) {
      this.pending.delete(id)
      const channel = this.active.get(id)
      if (!channel) continue
      this.active.delete(id)
      released.push(channel)
    }
    this.release(released)
  }

  // Blendet `released` in 0,8 s aus; die Marke am Rampenende baut sie ab. Ist danach nichts
  // mehr aktiv oder ladend, ist die Engine sofort idle, den Output hält erst diese Marke an.
  private release(released: Channel[]): void {
    const { ctx, input } = this.out!
    const now = ctx.currentTime
    // Steht die Audio-Uhr (Pause), wäre eine Rampe erst nach dem Fortsetzen zu hören: sofort
    // beenden. In der Pause ist das Medien-Element schon angehalten, das Ende also unhörbar.
    const frozen = this.state === 'paused' || ctx.state !== 'running'
    for (const channel of released) {
      if (frozen) {
        channel.voice.stop(now)
        this.teardown(channel)
        continue
      }
      holdParam(channel.gain.gain, now)
      channel.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT)
      channel.voice.stop(now + STOP_AFTER)
    }

    const idle = this.active.size === 0 && this.pending.size === 0
    if (idle) {
      this.state = 'idle'
      this.discardSleep()
    } else if (frozen || released.length === 0) {
      return
    }
    const settle = {}
    if (idle) this.settle = settle
    scheduleMarker(ctx, input, now, now + STOP_AFTER, () => {
      for (const channel of released) this.teardown(channel)
      if (this.settle === settle && this.state === 'idle') {
        this.settle = null
        void this.suspendOutput()
      }
    })
  }

  private teardown(channel: Channel): void {
    if (!this.channels.delete(channel)) return
    channel.voice.output.disconnect()
    channel.gain.disconnect()
  }

  private planSleep(): void {
    const { ctx, fade, input } = this.out!
    this.discardSleep()
    const t0 = ctx.currentTime
    const plan = sleepPlan(this.sleepMinutes)
    scheduleSleepFade(fade.gain, t0, plan)
    if (!plan) return
    const countdown: Countdown = {
      t0,
      end: plan.end,
      cancel: scheduleMarker(ctx, input, t0, t0 + plan.end, () => {
        if (this.countdown === countdown) this.sleepEnded()
      }),
    }
    this.countdown = countdown
  }

  // Verwirft den Countdown; `fade` bleibt auf dem aktuellen Wert stehen.
  private discardSleep(): void {
    this.countdown?.cancel()
    this.countdown = null
    const { ctx, fade } = this.out!
    holdParam(fade.gain, ctx.currentTime)
  }

  // Sleep-Ende: Es ist schon ausgeblendet, also alles sofort beenden und anhalten.
  private sleepEnded(): void {
    const { ctx, fade } = this.out!
    const now = ctx.currentTime
    this.countdown = null
    this.pending.clear()
    this.active.clear()
    for (const channel of [...this.channels]) {
      channel.voice.stop(now)
      this.teardown(channel)
    }
    fade.gain.cancelScheduledValues(now)
    // Über `value` statt setValueAtTime: gilt sofort, auch wenn der Output gleich angehalten
    // wird, bevor die Audio-Uhr diesen Zeitpunkt verarbeitet hat.
    fade.gain.value = 1
    this.state = 'idle'
    this.settle = null
    void this.suspendOutput()
    this.emit()
  }

  // Hält den Output an; das dabei ausgelöste pause-Event des Elements ist keine Unterbrechung.
  private async suspendOutput(): Promise<void> {
    const out = this.out!
    if (out.ctx.state === 'closed') return
    if (!out.element.paused) this.ownPauses++
    await out.suspend()
  }

  // Unterbrechung von außen (Anruf, andere App): Audio-Uhr anhalten, Zustand paused.
  private readonly onElementPause = (): void => {
    if (this.ownPauses > 0) {
      this.ownPauses--
      return
    }
    if (this.state !== 'playing') return
    this.state = 'paused'
    const { ctx } = this.out!
    if (ctx.state !== 'closed') void ctx.suspend()
    this.emit()
  }

  // Das System hält die Audio-Uhr selbst an: wie eine Unterbrechung behandeln, sonst bliebe
  // „playing“ mit stehender Restzeit. Eigenes Anhalten zählt nicht: Dabei ist der Zustand
  // schon paused/idle, und während eines eigenen Starts gilt der Zwischenstand noch nicht.
  private readonly onContextStateChange = (): void => {
    const { ctx } = this.out!
    if (this.state !== 'playing' || this.startPending) return
    if (ctx.state === 'running' || ctx.state === 'closed') return
    this.state = 'paused'
    void this.suspendOutput() // auch das Medien-Element anhalten; sein pause-Event ist eigenes
    this.emit()
  }
}

// App-Singleton.
export const engine = new AudioEngine()
