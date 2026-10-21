// Audio-Engine: Wiedergabe der Klänge (immer nur einer zur Zeit), Programme (Timer, Atemübung),
// Sleep-Timer und Wiedergabezustand. Der einzige Output (AudioContext → Lautsprecher, plus
// lautloser Anker) entsteht beim ersten `toggle` bzw. `startProgram`, also innerhalb einer
// Nutzergeste. Ein-/Ausblenden, Sleep-Ende, Programmklänge und -ende und das Abbauen gestoppter
// Stimmen sind auf der Audio-Uhr eingeplant (Rampen, `onended`), nie über JS-Timer.
import { holdParam, scheduleMarker, scheduleSleepFade } from './clock'
import { createLoopVoice, loadBuffer } from './loops'
import { syncMediaSession, type MediaActions } from './media-session'
import { createOutput, type Output } from './output'
import type { ProgramSpec } from './program'
import { ProgramRun, type FadeOut, type ProgramSnapshot } from './program-run'
import { sleepPlan } from './sleep-timer'
import type { Voice } from './voice'
import { assetUrl, EFFECTS, soundById, type SoundId } from '../sounds/catalog'
import type { SessionResult } from '../stats/schema'

export type { ProgramSnapshot } from './program-run'

export type EngineState = 'idle' | 'playing' | 'paused'

export interface EngineSnapshot {
  state: EngineState
  volumes: Partial<Record<SoundId, number>> // laufender Klang (höchstens einer) → Lautstärke 0..1
  loading: SoundId[]
  errors: SoundId[]
  sleepMinutes: number | null // Auswahl, bleibt über Sitzungen erhalten
  remainingSec: number | null // null wenn idle, endlos oder während eines Programms
  needsTap: boolean // Start scheiterte (z. B. Autoplay-Regel): pausiert, „Weiter“ versucht es neu
  program: ProgramSnapshot | null
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
  private readonly sessionListeners = new Set<(r: SessionResult) => void>()
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
  // Klingender bzw. ladender Klang; zusammen höchstens einer (Antippen wechselt). Während eines
  // Programms ist das sein Hintergrundklang.
  private readonly active = new Map<SoundId, Channel>()
  private readonly pending = new Map<SoundId, number>() // → Nummer des Ladevorgangs
  private readonly errors = new Set<SoundId>()
  private readonly channels = new Set<Channel>() // alle noch nicht abgebauten Stimmen, auch ausklingende
  private loads = 0
  // Höchstens ein Programm, auch während es noch lädt. Solange es besteht, ist die Engine nie idle.
  private program: ProgramRun | null = null
  private sleepMinutes: number | null = null
  private countdown: Countdown | null = null
  private settle: object | null = null // Marke, die nach dem letzten Stopp den Output anhält
  private ownPauses = 0 // pause-Events des Elements, die die Engine selbst auslöst

  constructor(opts: { createOutput?: () => Output; load?: Loader } = {}) {
    this.makeOutput = opts.createOutput ?? createOutput
    this.load = opts.load ?? loadBuffer
  }

  // Antippen = Wechseln: Ein aktiver oder ladender Klang wird gestoppt. Jeder andere startet und
  // löst den bisherigen ab; der blendet in 0,8 s aus, der neue in 1,5 s ein. Beim Wechsel bleibt
  // die Engine `playing`, der Sleep-Countdown läuft weiter. Ein laufendes Programm endet zuerst
  // (wie mit `endProgram`); der Klang beginnt dann eine neue Sitzung mit eigenem Countdown.
  // Darf ohne Abwarten mehrfach hintereinander gerufen werden: Es gibt höchstens eine aktive
  // Stimme (abgelöste oder gestoppte klingen höchstens noch 0,8 s aus).
  async toggle(id: SoundId): Promise<void> {
    this.ensureOutput()
    if (this.program) this.endSession()
    if (this.active.has(id) || this.pending.has(id)) {
      this.stop([id])
      this.emit()
      return
    }
    await this.playSound(id, this.ensurePlaying())
  }

  // Startet ein Programm als neue Sitzung: Es beendet laufende Klänge und ein laufendes Programm
  // (das dabei sein Ergebnis meldet) und verwirft den Sleep-Countdown; während eines Programms
  // gilt kein Sleep-Timer. Output-Start und Durchlauf entstehen vor dem ersten `await`, also noch
  // in der Nutzergeste, und ohne Umweg über idle. Eingeplant wird, sobald die Klangschale geladen
  // ist (fehlt sie, läuft das Programm ohne Schalen). Scheitert der Start des Outputs, steht das
  // Programm trotzdem bereit (pausiert, „Weiter“ spielt es ab Beginn); der Fehler kommt danach.
  async startProgram(spec: ProgramSpec): Promise<void> {
    const out = this.ensureOutput()
    const previous = [...this.active.keys(), ...this.pending.keys()]
    const predecessor = this.program
    const run = new ProgramRun(spec, out.ctx, this.report)
    this.program = run
    this.discardSleep()
    this.resetFade() // ein Sleep-Ausblenden kann die Gesamtlautstärke gesenkt haben
    const starting = this.ensurePlaying()
    this.stop(previous)
    predecessor?.end(this.fadeOut())
    this.emit()
    const [started, strike] = await Promise.allSettled([starting, this.load(out.ctx, assetUrl(EFFECTS[0].file))])
    // Inzwischen abgelöst (Programm, Klang, Stopp): Dieser Durchlauf beginnt nie und meldet nichts.
    if (this.program === run) {
      const assets = { strike: strike.status === 'fulfilled' ? strike.value : null }
      run.begin(out.input, assets, () => this.programCounted(run), () => this.finishProgram(run))
      this.emit()
      // Der Hintergrund gehört zum Programm; ohne ihn (Ladefehler) läuft es weiter.
      if (spec.background) await this.playSound(spec.background, Promise.resolve())
    }
    if (started.status === 'rejected') throw started.reason
  }

  // Beendet ein laufendes Programm vorzeitig (wie `stopAll`); ohne Programm geschieht nichts.
  async endProgram(): Promise<void> {
    if (this.program) await this.stopAll()
  }

  // s seit Programmstart auf der Audio-Uhr (Pausen zählen nicht); null ohne Programm.
  programElapsed(): number | null {
    return this.program ? this.program.elapsed() : null
  }

  // Ruft `listener` mit dem Ergebnis jedes Programms, genau einmal je eingeplantem Programm:
  // am Ende der gezählten Zeit oder beim vorzeitigen Ende.
  onSessionEnd(listener: (r: SessionResult) => void): () => void {
    this.sessionListeners.add(listener)
    return () => {
      this.sessionListeners.delete(listener)
    }
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

  // Im Zustand idle und während eines Programms wird nur die Auswahl gespeichert, sonst ab jetzt
  // neu geplant.
  setSleepTimer(minutes: number | null): void {
    this.sleepMinutes = minutes
    if (this.state !== 'idle' && !this.program) this.planSleep()
    this.emit()
  }

  // Hält an. Klingt ein Programm nur noch aus, endet stattdessen die Sitzung (`endIfCounted`).
  async pause(): Promise<void> {
    if (this.state !== 'playing') return
    if (this.endIfCounted()) return
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

  // Beendet die Sitzung, auch ein Programm (z. B. „Stop“ in der Benachrichtigung).
  async stopAll(): Promise<void> {
    if (this.active.size === 0 && this.pending.size === 0 && !this.program) return
    this.endSession()
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
      program: this.program?.snapshot() ?? null,
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

  // Gemeldet wird mitten in einem Wechsel (Stopp, neuer Klang, neues Programm): Ein Hörer, der
  // wirft, darf ihn nicht abbrechen. Sein Fehler wird nur berichtet.
  private readonly report = (result: SessionResult): void => {
    for (const listener of this.sessionListeners) {
      try {
        listener(result)
      } catch (error) {
        reportError(error)
      }
    }
  }

  private ensureOutput(): Output {
    if (!this.out) {
      this.out = this.makeOutput()
      this.out.element.addEventListener('pause', this.onElementPause)
      this.out.ctx.addEventListener('statechange', this.onContextStateChange)
    }
    return this.out
  }

  // idle/paused → playing: zuerst den Output starten. Ab idle beginnt der Sleep-Countdown, außer
  // für ein Programm. Scheitert der Start (z. B. play() ohne Nutzergeste abgelehnt), wird daraus
  // eine Pause mit Hinweis, statt still „playing“ zu bleiben; „Weiter“ startet dann neu.
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
      if (!this.program) this.planSleep()
    }
    return starting
  }

  // Startet `id` und löst ab, was bisher klingt oder lädt (Antippen, Hintergrund eines Programms).
  // Die Stimme entsteht, sobald `starting` (der Output-Start) und das Laden durch sind; ein
  // Ladefehler markiert den Klang. Den Output startet der Aufrufer, damit ein Programm im Hintergrund
  // nicht die Pause aufhebt.
  private async playSound(id: SoundId, starting: Promise<void>): Promise<void> {
    const out = this.out!
    const sound = soundById(id)
    this.errors.delete(id)
    const previous = [...this.active.keys(), ...this.pending.keys()]
    const load = ++this.loads
    this.pending.set(id, load)
    // Erst ablösen, wenn der neue Klang vorgemerkt ist: So wird die Engine dabei nicht idle (der
    // Countdown bleibt, keine Marke hält den Output an). Abgelöste Ladevorgänge verfallen über ihre Nummer.
    this.stop(previous)
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

  // Gezählte Zeit vorbei, das Ergebnis ist gemeldet. Kam die Marke erst nach einer Pause an (die
  // Uhr stand da noch nicht), endet die Sitzung wie bei einer Pause im Ausklingen.
  private programCounted(run: ProgramRun): void {
    if (this.program !== run) return
    if (this.state === 'paused') this.endSession()
    this.emit()
  }

  // Eine Pause, während ein Programm nur noch ausklingt (sein Ergebnis ist gemeldet), beendet die
  // Sitzung, ohne zweites Ergebnis. Pausiert bliebe sonst ein beendetes Programm stehen, samt
  // Benachrichtigung, und „Weiter“ spielte nur noch die Schalen nach. true, wenn beendet.
  private endIfCounted(): boolean {
    if (!this.program?.reported) return false
    this.endSession()
    this.emit()
    return true
  }

  // Programm ausgeklungen (sein Ergebnis ist schon gemeldet): Sitzung beenden.
  private finishProgram(run: ProgramRun): void {
    if (this.program !== run) return
    this.endSession()
    this.emit()
  }

  // Beendet die ganze Sitzung: Klänge und Programm blenden in 0,8 s aus, die Engine ist idle. Das
  // Programm meldet erst danach (falls noch nicht geschehen), damit Hörer schon den neuen Stand sehen.
  private endSession(): void {
    const run = this.program
    const fade = this.fadeOut() // vorher: Nach dem Stopp wäre eine Pause schon idle
    this.program = null
    this.stop([...this.active.keys(), ...this.pending.keys()])
    run?.end(fade)
  }

  // Ausblenden eines endenden Programms wie in `release`; null, wenn die Audio-Uhr steht.
  private fadeOut(): FadeOut | null {
    if (this.frozen()) return null
    const now = this.out!.ctx.currentTime
    return { fadeEnd: now + FADE_OUT, stopAt: now + STOP_AFTER }
  }

  private frozen(): boolean {
    return this.state === 'paused' || this.out!.ctx.state !== 'running'
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
  // mehr aktiv oder ladend und kein Programm da, ist die Engine sofort idle, den Output hält erst
  // diese Marke an.
  private release(released: Channel[]): void {
    const { ctx, input } = this.out!
    const now = ctx.currentTime
    const idle = this.active.size === 0 && this.pending.size === 0 && !this.program
    // Steht die Audio-Uhr (Pause), wäre eine Rampe erst nach dem Fortsetzen zu hören: sofort
    // beenden. In der Pause ist das Medien-Element schon angehalten, das Ende also unhörbar.
    // Das gilt für jede Stimme außer der aktiven, auch für eine, die ein Wechsel kurz zuvor
    // abgelöst hat und deren Ausblenden mit der Uhr stehen geblieben ist.
    const frozen = this.frozen()
    if (frozen) {
      const playing = new Set(this.active.values())
      for (const channel of [...this.channels]) {
        if (playing.has(channel)) continue
        channel.voice.stop(now)
        this.teardown(channel)
      }
    } else {
      for (const channel of released) {
        holdParam(channel.gain.gain, now)
        channel.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT)
        channel.voice.stop(now + STOP_AFTER)
      }
    }

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

  // Gesamtlautstärke sofort zurück auf 1. Über `value` statt setValueAtTime: gilt sofort, auch
  // wenn der Output gleich angehalten wird, bevor die Audio-Uhr diesen Zeitpunkt verarbeitet hat.
  private resetFade(): void {
    const { ctx, fade } = this.out!
    fade.gain.cancelScheduledValues(ctx.currentTime)
    fade.gain.value = 1
  }

  // Sleep-Ende: Es ist schon ausgeblendet, also alles sofort beenden und anhalten.
  private sleepEnded(): void {
    const { ctx } = this.out!
    const now = ctx.currentTime
    this.countdown = null
    this.pending.clear()
    this.active.clear()
    for (const channel of [...this.channels]) {
      channel.voice.stop(now)
      this.teardown(channel)
    }
    this.resetFade()
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

  // Unterbrechung von außen (Anruf, andere App): Audio-Uhr anhalten, Zustand paused. Klingt ein
  // Programm nur noch aus, endet die Sitzung (wie bei `pause`).
  private readonly onElementPause = (): void => {
    if (this.ownPauses > 0) {
      this.ownPauses--
      return
    }
    if (this.state !== 'playing') return
    if (this.endIfCounted()) return
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
    if (this.endIfCounted()) {
      // Die Marke, die danach den Output anhält, läuft auf der stehenden Uhr nie ab: selbst anhalten.
      void this.suspendOutput()
      return
    }
    this.state = 'paused'
    void this.suspendOutput() // auch das Medien-Element anhalten; sein pause-Event ist eigenes
    this.emit()
  }
}

// App-Singleton.
export const engine = new AudioEngine()
