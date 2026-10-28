// Die Schritte des Morgen-Starts (Spec M10 §2.3). Reine Daten ohne Oberfläche; der Abschluss gehört nicht zur Folge:
// Er entsteht erst nach dem letzten Schritt, wenn der Eintrag gespeichert ist.
import type { MorningVariant } from '../stats/schema'

export type MorningStep = 'checkin' | 'aktivieren' | 'vertiefen' | 'intention' | 'dankbarkeit' | 'domino' | 'abschluss'

/** Die Schritte der Variante in der Reihenfolge, ohne `'abschluss'`. „Vertiefen“ gibt es nur im langen Ablauf. */
export function morningSteps(variant: MorningVariant): MorningStep[] {
  return variant === 'lang'
    ? ['checkin', 'aktivieren', 'vertiefen', 'intention', 'dankbarkeit', 'domino']
    : ['checkin', 'aktivieren', 'intention', 'dankbarkeit', 'domino']
}
