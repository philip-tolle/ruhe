// Der Zustand des Morgen-Starts (Spec M10 §2.3, §4.2, §5): ob der Ablauf offen ist, bei welchem Schritt er steht,
// was bisher eingegeben ist und ob er gerade auf einen Player wartet. Die Vollbild-Oberfläche liest und schreibt
// ihn (Task 5); die Reihenfolge der Schritte steht in `morning/steps.ts`, das Speichern in `stats/store`.
import { playChime } from '../audio/chime'
import { meditationById } from '../content/catalog'
import type { EnergyArea, EnergyLevel } from '../energy/areas'
import { hackById } from '../energy/hacks'
import { exerciseOfDay, nextExercise } from '../morning/logic'
import { morningSteps, type MorningStep } from '../morning/steps'
import { MORNING_EXERCISES, type MorningExerciseId } from '../morning/words'
import type { MorningInput, MorningVariant, ResultKind } from '../stats/schema'
import { saveMorning } from '../stats/store.svelte'
import { clearDone, startGuidedSession, startHack } from './session-ui.svelte'
import { appNow } from './tageszeit.svelte'

export interface MorningDraft {
  intention: string
  gratitude: string
  value: string
  domino: string
}

export interface MorningState {
  open: boolean
  variant: MorningVariant
  step: MorningStep
  /** Die Übung, die „Aktivieren“ zeigt (die des Tages, mit „Andere Übung“ die nächste). */
  exercise: MorningExerciseId
  /** Der Check-in aus Schritt 1, wenn er gespeichert wurde; gibt Vorschläge und Bereich der Intention vor. */
  checkin: Record<EnergyArea, EnergyLevel> | null
  /** Die Eingaben, bis der Abschluss erreicht ist; erst dann wird gespeichert. Leer heißt: nichts eingegeben. */
  draft: MorningDraft
  /** Der Ablauf hat einen Player gestartet und ist so lange verborgen. */
  awaiting: 'hack' | 'guided' | null
  /** Die Rückfrage „Morgen-Start beenden?“ steht. */
  confirming: boolean
}

const emptyDraft = (): MorningDraft => ({ intention: '', gratitude: '', value: '', domino: '' })

// Die Anfangsübung ist die erste der Reihenfolge, nicht die des Tages: Die Uhr gehört nicht in die Auswertung des
// Moduls; `openMorning` setzt die Übung des Tages mit der Minuten-Uhr.
export const morningUi: MorningState = $state({
  open: false,
  variant: 'kurz',
  step: 'checkin',
  exercise: MORNING_EXERCISES[0],
  checkin: null,
  draft: emptyDraft(),
  awaiting: null,
  confirming: false,
})

/** Öffnet den Ablauf von vorn: alles zurückgesetzt, Schritt „Check-in“, Übung des Tages. */
export function openMorning(variant: MorningVariant): void {
  morningUi.open = true
  morningUi.variant = variant
  morningUi.step = 'checkin'
  morningUi.exercise = exerciseOfDay(appNow())
  morningUi.checkin = null
  // An Ort und Stelle statt eines neuen Objekts: Wer den Entwurf schon in der Hand hält (Eingabefelder), sieht den Neustart.
  Object.assign(morningUi.draft, emptyDraft())
  morningUi.awaiting = null
  morningUi.confirming = false
}

/** Der Eintrag aus dem Entwurf; getrimmte leere Felder entfallen, den Wert gibt es nur im langen Ablauf. */
function inputFromDraft(): MorningInput {
  const { variant, draft } = morningUi
  const input: MorningInput = { variant }
  const intention = draft.intention.trim()
  if (intention !== '') input.intention = intention
  const gratitude = draft.gratitude.trim()
  if (gratitude !== '') input.gratitude = gratitude
  const value = draft.value.trim()
  if (variant === 'lang' && value !== '') input.value = value
  const domino = draft.domino.trim()
  if (domino !== '') input.domino = domino
  return input
}

/**
 * Zum folgenden Schritt. Nach dem letzten Eingabeschritt („Big Domino“) wird der Eintrag gespeichert (auch wenn
 * alles übersprungen wurde), der Abschluss steht, und die Klangschale läutet. Im Abschluss und bei geschlossenem
 * Ablauf tut es nichts, damit ein zweiter Tipp nicht ein zweites Mal speichert.
 */
export function nextStep(): void {
  if (!morningUi.open) return
  const steps = morningSteps(morningUi.variant)
  const index = steps.indexOf(morningUi.step)
  if (index === -1) return
  if (index < steps.length - 1) {
    morningUi.step = steps[index + 1]
    return
  }
  saveMorning(inputFromDraft())
  morningUi.step = 'abschluss'
  playChime()
}

/** Wie `nextStep`, nur ohne die Eingaben des aktuellen Schritts: Sie werden nicht gespeichert. */
export function skipStep(): void {
  const { draft } = morningUi
  switch (morningUi.step) {
    case 'intention':
      draft.intention = ''
      break
    case 'dankbarkeit':
      // Der Wert gehört zum Schritt „Dankbarkeit“.
      draft.gratitude = ''
      draft.value = ''
      break
    case 'domino':
      draft.domino = ''
      break
  }
  nextStep()
}

/** Beendet den Ablauf ohne Morgen-Eintrag; was der Ablauf schon gespeichert hat (Check-in, Läufe), bleibt. */
export function closeMorning(): void {
  morningUi.open = false
  morningUi.awaiting = null
  morningUi.confirming = false
}

/** „Andere Übung“: die nächste der Reihenfolge. */
export function swapExercise(): void {
  morningUi.exercise = nextExercise(morningUi.exercise)
}

// Die beiden Starts laufen im Tipp (Autoplay-Regel), das Warten steht vor dem Start: Der Player erscheint, sobald die
// Engine sein Programm meldet, und der Ablauf muss dann schon verborgen sein.

/** „Starten“ bei „Aktivieren“: spielt die Übung im Hack-Player. Eine unbekannte Kennung tut nichts (kein Warten). */
export function startExercise(id: string): void {
  if (!hackById(id)) return
  morningUi.awaiting = 'hack'
  startHack(id)
}

/** „Guten Morgen“ bei „Vertiefen“: spielt die geführte Meditation im Player. */
export function startMorningMeditation(): void {
  const meditation = meditationById('guten-morgen')
  if (!meditation) return
  morningUi.awaiting = 'guided'
  startGuidedSession(meditation)
}

/**
 * Das Ende eines Laufs, gemeldet aus main.ts nach dem Erfassen. `true` heißt: Der Ablauf übernimmt das Ende, und
 * main.ts zeigt keinen Abschluss.
 *
 * - Meditation, auf die der Ablauf wartet: Sie ist erfasst (zählt oder nicht, wie sonst), ihr Abschluss entfällt,
 *   der Ablauf geht weiter.
 * - Hack, der nicht zählt (unter 30 s): Er hat keine Ende-Ansicht, der Ablauf bleibt bei seinem Schritt.
 * - Hack, der zählt: Das Warten bleibt; `HackEffect` zeigt die Wirkungsfrage mit „Weiter“.
 */
export function morningSessionEnded(kind: ResultKind, counted: boolean): boolean {
  if (!morningUi.open) return false
  if (kind === 'guided' && morningUi.awaiting === 'guided') {
    morningUi.awaiting = null
    clearDone()
    nextStep()
    return true
  }
  if (kind === 'hack' && morningUi.awaiting === 'hack' && !counted) morningUi.awaiting = null
  return false
}

/** „Weiter“ im Ende-Bild des Hacks: schließt es und geht im Ablauf zum nächsten Schritt. */
export function morningContinueAfterHack(): void {
  clearDone()
  morningUi.awaiting = null
  nextStep()
}
