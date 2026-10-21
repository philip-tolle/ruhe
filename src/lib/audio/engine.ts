// Audio-Engine: Wiedergabe der Klänge (immer nur einer zur Zeit), Sitzungen (Programme wie Timer
// und Atemübung, geführte Meditationen), Sleep-Timer und Wiedergabezustand. Der einzige Output
// (AudioContext → Lautsprecher, plus lautloser Anker) entsteht beim ersten `toggle` bzw. Start einer
// Sitzung, also innerhalb einer Nutzergeste. Ein-/Ausblenden, Sleep-Ende, Programmklänge und -ende
// und das Abbauen gestoppter Stimmen sind auf der Audio-Uhr eingeplant (Rampen, `onended`), nie über
// JS-Timer; eine geführte Meditation läuft auf ihrem Medien-Element.
import { holdParam, scheduleMarker, scheduleSleepFade } from './clock'
import type { GuidedRun, GuidedSpec } from './guided-run'
import { createLoopVoice, loadBuffer } from './loops'
import { syncMediaSession, type MediaActions } from './media-session'
import { createOutput, type Output } from './output'
import type { ProgramSpec } from './program'
import type { FadeOut, ProgramRun, ProgramSnapshot, SessionRun } from './program-run'
import { Sessions } from './sessions'
import { sleepPlan } from './sleep-timer'
import type { Voice } from './voice'
import { assetUrl, EFFECTS, soundById, type SoundId } from '../sounds/catalog'
import type { SessionResult } from '../stats/schema'

export type { ProgramSnapshot } from './program-run'
export type { GuidedSpec } from './guided-run'

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
  // Steuerung aus Benachrichtigung und Sperrbildschirm; Fehler bleiben in der Engine.
  private readonly actions: MediaActions = {
    play: () => void this.resume().catch(() => {}),
    pause: () => void this.pause().catch(() => {}),
    stop: () => void this.stopAll().catch(() => {}),
    seek: (delta) => this.seek(delta),
  }

  private out: Output | null = null
  private state: EngineState = 'idle'
  private starting: Promise<void> = Promise.resolve()
  private startPending = false // der aktuelle Start (resume + play) ist noch nicht durch
  private startFailed = false // der letzte Start wurde abgelehnt
  // Klingender bzw. ladender Klang; zusammen höchstens einer (Antippen wechselt). Während einer
  // Sitzung ist das ihr Hintergrundklang.
  private readonly active = new Map<SoundId, Channel>()
  private readonly pending = new Map<SoundId, { load: number; volume: number }>() // Nummer des Ladevorgangs, Ziel-Lautstärke
  private readonly errors = new Set<SoundId>()
  private readonly channels = new Set<Channel>() // alle noch nicht abgebauten Stimmen, auch ausklingende
  private loads = 0
  // Höchstens eine Sitzung (Programm oder geführte Meditation). Solange sie besteht, ist die
  // Engine nie idle.
  private readonly sessions = new Sessions()
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
  // die Engine `playing`, der Sleep-Countdown läuft weiter. Eine laufende Sitzung endet zuerst
  // (wie mit `endProgram`); der Klang beginnt dann eine neue Sitzung mit eigenem Countdown.
  // Darf ohne Abwarten mehrfach hintereinander gerufen werden: Es gibt höchstens eine aktive
  // Stimme (abgelöste oder gestoppte klingen höchstens noch 0,8 s aus).
  async toggle(id: SoundId): Promise<void> {
    this.ensureOutput()
    if (this.sessions.current) this.endSession()
    if (this.active.has(id) || this.pending.has(id)) {
      this.stop([id])
      this.emit()
      return
    }
    await this.playSound(id, this.ensurePlaying())
  }

  // Startet ein Programm als neue Sitzung: Es beendet laufende Klänge und eine laufende Sitzung
  // (die dabei ihr Ergebnis meldet) und verwirft den Sleep-Countdown; während einer Sitzung
  // gilt kein Sleep-Timer. Output-Start und Durchlauf entstehen vor dem ersten `await`, also noch
  // in der Nutzergeste, und ohne Umweg über idle. Eingeplant wird, sobald die Klangschale geladen
  // ist (fehlt sie, läuft das Programm ohne Schalen). Scheitert der Start des Outputs, steht das
  // Programm trotzdem bereit (pausiert, „Weiter“ spielt es ab Beginn); der Fehler kommt danach.
  async startProgram(spec: ProgramSpec): Promise<void> {
    const out = this.ensureOutput()
    const run = this.sessions.createProgram(spec, out.ctx)
    const starting = this.beginSession(run)
    const [started, strike] = await Promise.allSettled([starting, this.load(out.ctx, assetUrl(EFFECTS[0].file))])
    // Inzwischen abgelöst (Sitzung, Klang, Stopp): Dieser Durchlauf beginnt nie und meldet nichts.
    if (this.sessions.holds(run)) {
      const assets = { strike: strike.status === 'fulfilled' ? strike.value : null }
      run.begin(out.input, assets, () => this.programCounted(run), () => this.finishSession(run))
      this.emit()
      // Der Hintergrund gehört zum Programm; ohne ihn (Ladefehler) läuft es weiter.
      if (spec.background) await this.playSound(spec.background, Promise.resolve())
    }
    if (started.status === 'rejected') throw started.reason
  }

  // Startet eine geführte Meditation als neue Sitzung, wie `startProgram`: Sie beendet laufende
  // Klänge und eine laufende Sitzung, verwirft den Sleep-Countdown und stellt die Gesamtlautstärke
  // zurück. Output-Start und play() der Stimme geschehen vor dem ersten `await`, also noch in der
  // Nutzergeste. Lädt die Datei nicht, steht die Sitzung pausiert mit `error` bereit
  // (`retryGuided`); lehnt der Browser den Start ab, pausiert sie mit Hinweis und der Fehler kommt danach.
  async startGuided(spec: GuidedSpec): Promise<void> {
    const out = this.ensureOutput()
    const run: GuidedRun = this.sessions.createGuided(spec, out.ctx, out.input, {
      change: () => {
        if (this.sessions.holds(run)) this.emit()
      },
      ended: () => this.finishSession(run),
      interrupted: () => {
        if (this.sessions.holds(run)) this.interrupted()
      },
      failed: () => this.voiceFailed(run),
    })
    const starting = this.beginSession(run)
    const voice = this.voiceStarted(run, run.play())
    // Der Hintergrund gehört zur Sitzung; ohne ihn (Ladefehler) läuft sie weiter.
    const background = spec.background && this.playSound(spec.background, starting, spec.backgroundVolume)
    const [started, played] = await Promise.allSettled([starting, voice, background])
    if (started.status === 'rejected') throw started.reason
    if (played.status === 'rejected') throw played.reason
  }

  // Spult eine geführte Sitzung um `deltaSeconds` (auf die Datei begrenzt); sonst geschieht nichts.
  seek(deltaSeconds: number): void {
    const run = this.sessions.guided
    if (!run) return
    run.seek(deltaSeconds)
    this.emit()
  }

  // Hintergrund einer geführten Sitzung: `null` nimmt ihn weg, derselbe Klang ändert nur die
  // Lautstärke, ein anderer löst ihn ab (Überblenden wie beim Antippen). Ohne geführte Sitzung
  // geschieht nichts. In der Pause wird der neue Klang erst mit „Weiter“ hörbar.
  setBackground(id: SoundId | null, volume: number): void {
    if (!this.sessions.guided) return
    const value = Math.min(1, Math.max(0, volume))
    const loading = id === null ? undefined : this.pending.get(id)
    if (id === null) {
      this.stop([...this.active.keys(), ...this.pending.keys()])
    } else if (this.active.has(id)) {
      this.setVolume(id, value)
      return
    } else if (loading) {
      loading.volume = value
    } else {
      void this.playSound(id, Promise.resolve(), value)
      return
    }
    this.emit()
  }

  // Nach einem Ladefehler: dieselbe Meditation ab der letzten Position neu laden und abspielen.
  async retryGuided(): Promise<void> {
    const run = this.sessions.guided
    if (!run?.error) return
    const starting = this.ensurePlaying()
    const voice = this.voiceStarted(run, run.retry())
    this.emit()
    await Promise.all([starting, voice])
  }

  // Beendet eine laufende Sitzung vorzeitig (wie `stopAll`); ohne Sitzung geschieht nichts.
  async endProgram(): Promise<void> {
    if (this.sessions.current) await this.stopAll()
  }

  // Programm: s seit Programmstart auf der Audio-Uhr (Pausen zählen nicht); geführte Sitzung:
  // Position in der Datei. null ohne Sitzung.
  programElapsed(): number | null {
    return this.sessions.current?.elapsed() ?? null
  }

  // Ruft `listener` mit dem Ergebnis jeder Sitzung, genau einmal je eingeplantem Programm bzw.
  // geführter Meditation: am Ende der gezählten Zeit bzw. der Datei oder beim vorzeitigen Ende.
  onSessionEnd(listener: (r: SessionResult) => void): () => void {
    return this.sessions.listen(listener)
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

  // Im Zustand idle und während einer Sitzung wird nur die Auswahl gespeichert, sonst ab jetzt
  // neu geplant.
  setSleepTimer(minutes: number | null): void {
    this.sleepMinutes = minutes
    if (this.state !== 'idle' && !this.sessions.current) this.planSleep()
    this.emit()
  }

  // Hält an, mit der Audio-Uhr auch die Stimme. Klingt ein Programm nur noch aus, endet
  // stattdessen die Sitzung (`endIfCounted`).
  async pause(): Promise<void> {
    if (this.state !== 'playing') return
    if (this.endIfCounted()) return
    this.state = 'paused'
    this.emit()
    await this.suspendOutput()
  }

  // Setzt fort, auch die Stimme. Nach einem Ladefehler heißt Weiter (auch aus der
  // Benachrichtigung): neu versuchen.
  async resume(): Promise<void> {
    if (this.state !== 'paused') return
    const run = this.sessions.guided
    if (run?.error) return this.retryGuided()
    const starting = this.ensurePlaying()
    const voice = run && this.voiceStarted(run, run.play())
    this.emit()
    await Promise.all([starting, voice])
  }

  // Beendet die Sitzung, auch ein Programm (z. B. „Stop“ in der Benachrichtigung).
  async stopAll(): Promise<void> {
    if (this.active.size === 0 && this.pending.size === 0 && !this.sessions.current) return
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
      program: this.sessions.current?.snapshot() ?? null,
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

  // idle/paused → playing: zuerst den Output starten. Ab idle beginnt der Sleep-Countdown, außer
  // für eine Sitzung. Scheitert der Start (z. B. play() ohne Nutzergeste abgelehnt), wird daraus
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
            this.halt(true) // Audio-Uhr anhalten, damit die Restzeit steht
          }
        }
        throw error
      },
    )
    this.starting = starting
    if (fromIdle) {
      this.settle = null
      if (!this.sessions.current) this.planSleep()
    }
    return starting
  }

  // Startet `id` und löst ab, was bisher klingt oder lädt (Antippen, Hintergrund einer Sitzung).
  // Die Stimme entsteht, sobald `starting` (der Output-Start) und das Laden durch sind, mit der
  // dann gewünschten Lautstärke; ein Ladefehler markiert den Klang. Den Output startet der
  // Aufrufer, damit ein Hintergrund, der später lädt oder wechselt, nicht die Pause aufhebt.
  private async playSound(id: SoundId, starting: Promise<void>, volume = DEFAULT_VOLUME): Promise<void> {
    const out = this.out!
    const sound = soundById(id)
    this.errors.delete(id)
    const previous = [...this.active.keys(), ...this.pending.keys()]
    const load = ++this.loads
    this.pending.set(id, { load, volume: Math.min(1, Math.max(0, volume)) })
    // Erst ablösen, wenn der neue Klang vorgemerkt ist: So wird die Engine dabei nicht idle (der
    // Countdown bleibt, keine Marke hält den Output an). Abgelöste Ladevorgänge verfallen über ihre Nummer.
    this.stop(previous)
    this.emit()
    const [started, loaded] = await Promise.allSettled([starting, this.load(out.ctx, assetUrl(sound.file))])
    // Wurde der Klang inzwischen gestoppt (oder danach neu angestoßen), gilt dieser Ladevorgang nicht mehr.
    const wanted = this.pending.get(id)
    if (wanted?.load === load) {
      this.pending.delete(id)
      if (loaded.status === 'fulfilled') {
        this.addChannel(id, createLoopVoice(out.ctx, loaded.value), wanted.volume)
      } else {
        this.errors.add(id)
        this.release([])
      }
      this.emit()
    }
    if (started.status === 'rejected') throw started.reason
  }

  // Neue Stimme mit eigenem Gain, der in 1,5 s von 0 auf die Lautstärke steigt.
  private addChannel(id: SoundId, voice: Voice, volume: number): void {
    const { ctx, input } = this.out!
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + FADE_IN)
    voice.output.connect(gain).connect(input)
    const channel = { voice, gain, volume }
    this.active.set(id, channel)
    this.channels.add(channel)
  }

  // Gezählte Zeit vorbei, das Ergebnis ist gemeldet. Kam die Marke erst nach einer Pause an (die
  // Uhr stand da noch nicht), endet die Sitzung wie bei einer Pause im Ausklingen.
  private programCounted(run: ProgramRun): void {
    if (!this.sessions.holds(run)) return
    if (this.state === 'paused') this.endSession()
    this.emit()
  }

  // Eine Pause, während ein Programm nur noch ausklingt (sein Ergebnis ist gemeldet), beendet die
  // Sitzung, ohne zweites Ergebnis. Pausiert bliebe sonst ein beendetes Programm stehen, samt
  // Benachrichtigung, und „Weiter“ spielte nur noch die Schalen nach. true, wenn beendet.
  private endIfCounted(): boolean {
    if (!this.sessions.current?.reported) return false
    this.endSession()
    this.emit()
    return true
  }

  // Programm ausgeklungen bzw. geführte Meditation zu Ende gehört (das Ergebnis ist schon
  // gemeldet): Sitzung beenden, der Hintergrund blendet aus.
  private finishSession(run: SessionRun): void {
    if (!this.sessions.holds(run)) return
    this.endSession()
    this.emit()
  }

  // Neue Sitzung: Sie löst laufende Klänge und die bisherige Sitzung ab (die dabei meldet),
  // verwirft den Sleep-Countdown (während einer Sitzung gilt keiner) und setzt die
  // Gesamtlautstärke zurück. Der Output startet sofort, noch in der Nutzergeste, und ohne Umweg über
  // idle. Liefert den Output-Start.
  private beginSession(run: SessionRun): Promise<void> {
    const previous = [...this.active.keys(), ...this.pending.keys()]
    const predecessor = this.sessions.swap(run)
    this.discardSleep()
    this.resetFade() // ein Sleep-Ausblenden kann die Gesamtlautstärke gesenkt haben
    const starting = this.ensurePlaying()
    this.stop(previous)
    predecessor?.end(this.fadeOut())
    this.emit()
    return starting
  }

  // Beendet die ganze Sitzung: Klänge und Sitzung blenden in 0,8 s aus, die Engine ist idle. Die
  // Sitzung meldet erst danach (falls noch nicht geschehen), damit Hörer schon den neuen Stand sehen.
  private endSession(): void {
    const fade = this.fadeOut() // vorher: Nach dem Stopp wäre eine Pause schon idle
    const run = this.sessions.swap(null)
    this.stop([...this.active.keys(), ...this.pending.keys()])
    run?.end(fade)
  }

  // Ausblenden einer endenden Sitzung wie in `release`; null, wenn die Audio-Uhr steht.
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
  // mehr aktiv oder ladend und keine Sitzung da, ist die Engine sofort idle, den Output hält erst
  // diese Marke an.
  private release(released: Channel[]): void {
    const { ctx, input } = this.out!
    const now = ctx.currentTime
    const idle = this.active.size === 0 && this.pending.size === 0 && !this.sessions.current
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

  // Hält den Output an, samt Stimme einer geführten Sitzung; die dabei ausgelösten pause-Events
  // der Elemente sind keine Unterbrechung.
  private async suspendOutput(): Promise<void> {
    const out = this.out!
    if (out.ctx.state === 'closed') return
    this.sessions.guided?.hold()
    if (!out.element.paused) this.ownPauses++
    await out.suspend()
  }

  // playing → paused, ohne dass jemand „Pause“ getippt hat (Unterbrechung, abgelehnter Start,
  // Ladefehler): Audio-Uhr und Stimme anhalten. `failedStart` zeigt den Hinweis „Zum Starten tippen“.
  private halt(failedStart = false): void {
    this.state = 'paused'
    this.startFailed = failedStart
    void this.suspendOutput() // die pause-Events dabei sind eigene
    this.emit()
  }

  // Unterbrechung von außen (Anruf, andere App), am Anker, an der Stimme oder an der Audio-Uhr.
  // Klingt ein Programm nur noch aus, endet die Sitzung (wie bei `pause`).
  private interrupted(): void {
    if (this.state !== 'playing') return
    if (!this.endIfCounted()) this.halt()
  }

  private readonly onElementPause = (): void => {
    if (this.ownPauses > 0) {
      this.ownPauses--
      return
    }
    this.interrupted()
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
    this.halt()
  }

  // Lehnt der Browser play() der Stimme ab (Autoplay-Regel), wird daraus wie bei einem abgelehnten
  // Output-Start eine Pause mit Hinweis; „Weiter“ versucht es neu. Der Fehler geht an den Aufrufer.
  private voiceStarted(run: GuidedRun, playing: Promise<void>): Promise<void> {
    return playing.catch((error: unknown) => {
      if (this.sessions.holds(run) && this.state === 'playing') this.halt(true)
      throw error
    })
  }

  // Die Datei lädt nicht: Die Sitzung bleibt mit `error` stehen, mit ihr die Audio-Uhr und damit
  // der Hintergrund, bis „Erneut versuchen“ (`retryGuided`) oder Beenden.
  private voiceFailed(run: GuidedRun): void {
    if (!this.sessions.holds(run)) return
    if (this.state === 'playing') this.halt()
    else this.emit()
  }
}

// App-Singleton.
export const engine = new AudioEngine()
