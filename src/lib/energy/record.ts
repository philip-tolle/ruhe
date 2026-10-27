// Aus einem Engine-Ergebnis wird ein Hack-Lauf oder ein Fokus-Sprint (Spec M9 §5.2, §6.1).
// Reine Funktionen; ein Ergebnis unter der Mindestdauer ergibt `null` und wird nicht gespeichert.
import { hackById } from './hacks'
import { beforeLevel } from './insights'
import { clipTask, FOCUS_MINUTES, type EnergyCheckin, type FocusSprint, type HackRun, type SessionResult } from '../stats/schema'

/** Ein Hack-Lauf zählt ab 30 s gehörter Zeit, ein Sprint ab 5 Minuten. */
export const MIN_HACK_SECONDS = 30
export const MIN_SPRINT_SECONDS = 300

/** Gültige Dauer und gültiger Beginn: Sonst machte der Eintrag beim nächsten Laden Ärger oder `toISOString` wirft. */
function counts(r: SessionResult, minSeconds: number): boolean {
  return Number.isFinite(r.seconds) && r.seconds >= minSeconds && !Number.isNaN(r.start.getTime())
}

/**
 * Der Hack-Lauf zu einem Ergebnis (`ref` = Hack-Kennung), oder `null` unter 30 s und bei einem Hack, den der Katalog
 * nicht kennt. Der Bereich stammt aus dem Katalog; `before` steht nur da, wenn ein Check-in dafür jung genug ist.
 */
export function hackRunFrom(r: SessionResult, id: string, checkins: readonly EnergyCheckin[]): HackRun | null {
  if (!counts(r, MIN_HACK_SECONDS)) return null
  const hack = hackById(r.ref)
  if (!hack) return null
  const run: HackRun = { id, at: r.start.toISOString(), hack: hack.id, area: hack.area, seconds: Math.floor(r.seconds) }
  const before = beforeLevel(checkins, hack.area, r.start)
  if (before !== null) run.before = before
  return run
}

/**
 * Der Fokus-Sprint zu einem Ergebnis (`ref` = `focus-25`, `focus-50` oder `focus-90`, `note` = Aufgabe), oder `null`
 * unter 5 Minuten und bei einer anderen Länge. Die Aufgabe wird getrimmt und gekürzt; ist sie leer, fehlt sie.
 */
export function focusSprintFrom(r: SessionResult, id: string): FocusSprint | null {
  const planned = FOCUS_MINUTES.find(m => r.ref === `focus-${m}`)
  if (planned === undefined || !counts(r, MIN_SPRINT_SECONDS)) return null
  const sprint: FocusSprint = { id, at: r.start.toISOString(), planned, seconds: Math.floor(r.seconds) }
  const task = clipTask((r.note ?? '').trim())
  if (task !== '') sprint.task = task
  return sprint
}
