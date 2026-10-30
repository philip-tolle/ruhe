// Der Zustand des Abend-Logbuchs (Spec M11 §2.3, §4.2): offen, Logbuch-Tag, Sonntag, Schritte, aktueller Schritt, Entwurf
// der Eingaben und der gespeicherte Eintrag des Abschlusses. Logbuch-Tag, Sonntag und Rückblick werden beim Öffnen
// festgelegt und gelten bis zum Schließen, auch wenn die Uhr währenddessen über Mitternacht oder 4:00 geht. Der Ablauf
// startet keinen Player; der Check-in und der Haken am Big Domino speichern sich in ihren Schritten selbst.
import { CHIME_EVENING, playChime } from '../audio/chime'
import { hasReview, logbookDay } from '../evening/logic'
import { eveningSteps, type EveningStep } from '../evening/steps'
import type { EveningEntry, EveningInput, IntentionScore } from '../stats/schema'
import { saveEvening, stats } from '../stats/store.svelte'
import { isSunday } from '../stats/summary'
import { appNow } from './tageszeit.svelte'

export interface EveningDraft {
  gave: string[]
  cost: string[]
  intentionScore: IntentionScore | null
  learned: string
  better: string
  weekFocus: string
}

export interface EveningState {
  open: boolean
  /** Logbuch-Tag `JJJJ-MM-TT`, beim Öffnen festgelegt. */
  day: string
  sunday: boolean
  /** Die Eingabeschritte dieses Durchgangs (ohne Abschluss). */
  steps: EveningStep[]
  step: EveningStep
  draft: EveningDraft
  /** Der gespeicherte Eintrag, sobald der Abschluss steht; sonst `null`. */
  entry: EveningEntry | null
  /** Die Rückfrage „Abend-Logbuch beenden?“ ist offen. */
  confirming: boolean
}

const emptyDraft = (): EveningDraft => ({ gave: [], cost: [], intentionScore: null, learned: '', better: '', weekFocus: '' })

export const eveningUi: EveningState = $state({
  open: false,
  day: '',
  sunday: false,
  steps: [],
  step: 'checkin',
  draft: emptyDraft(),
  entry: null,
  confirming: false,
})

/** Öffnet das Logbuch von vorn: Logbuch-Tag, Sonntag und Schritte aus „jetzt“, Schritt „Check-in“, leerer Entwurf. */
export function openEvening(): void {
  const day = logbookDay(appNow())
  const sunday = isSunday(day)
  eveningUi.open = true
  eveningUi.day = day
  eveningUi.sunday = sunday
  eveningUi.steps = eveningSteps(hasReview(stats.data.mornings ?? [], day), sunday)
  eveningUi.step = 'checkin'
  // An Ort und Stelle statt eines neuen Objekts: Wer den Entwurf schon in der Hand hält (Eingabefelder), sieht den Neustart.
  Object.assign(eveningUi.draft, emptyDraft())
  eveningUi.entry = null
  eveningUi.confirming = false
}

/** Der Entwurf als Eingang des Speicherns; den Wochenfokus gibt es nur sonntags. */
function inputFromDraft(): EveningInput {
  const { day, sunday, draft } = eveningUi
  const input: EveningInput = { day, gave: [...draft.gave], cost: [...draft.cost], intentionScore: draft.intentionScore, learned: draft.learned, better: draft.better }
  if (sunday) input.weekFocus = draft.weekFocus
  return input
}

/**
 * Zum folgenden Schritt. Nach dem letzten Eingabeschritt wird der Eintrag gespeichert (auch wenn alles übersprungen
 * wurde), der Abschluss steht, und die Klangschale läutet leise. Im Abschluss und bei geschlossenem Ablauf tut es nichts,
 * damit ein zweiter Tipp nicht ein zweites Mal speichert.
 */
export function nextEveningStep(): void {
  if (!eveningUi.open) return
  const index = eveningUi.steps.indexOf(eveningUi.step)
  if (index === -1) return
  if (index < eveningUi.steps.length - 1) {
    eveningUi.step = eveningUi.steps[index + 1]
    return
  }
  // Der Eintrag, wie er gespeichert ist (bereinigt, gekürzt); der Abschluss zeigt ihn. Eine Kopie, damit spätere
  // Änderungen an den Daten sie nicht berühren.
  eveningUi.entry = { ...saveEvening(inputFromDraft()) }
  eveningUi.step = 'abschluss'
  playChime(undefined, CHIME_EVENING)
}

/** Wie `nextEveningStep`, nur ohne die Eingaben des aktuellen Schritts. Der Haken im Rückblick ist schon gespeichert. */
export function skipEveningStep(): void {
  const { draft } = eveningUi
  switch (eveningUi.step) {
    case 'geber':
      draft.gave = []
      break
    case 'raeuber':
      draft.cost = []
      break
    case 'rueckblick':
      draft.intentionScore = null
      break
    case 'gelernt':
      draft.learned = ''
      break
    case 'besser':
      draft.better = ''
      break
    case 'woche':
      draft.weekFocus = ''
      break
  }
  nextEveningStep()
}

/** Beendet das Logbuch ohne Eintrag; was der Ablauf schon gespeichert hat (Check-in, Haken), bleibt. */
export function closeEvening(): void {
  eveningUi.open = false
  eveningUi.confirming = false
}

/** Der Entwurf als Eintrag des Logbuch-Tages, für die Wochenseite (sie rechnet den laufenden Durchgang schon mit ein). */
export function draftEntry(): EveningEntry {
  const { day, draft } = eveningUi
  const entry: EveningEntry = { day, at: appNow().toISOString() }
  if (draft.gave.length > 0) entry.gave = [...draft.gave]
  if (draft.cost.length > 0) entry.cost = [...draft.cost]
  const learned = draft.learned.trim()
  if (learned !== '') entry.learned = learned
  return entry
}
