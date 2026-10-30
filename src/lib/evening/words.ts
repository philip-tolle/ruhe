// Die Inhalte des Abend-Logbuchs (Spec M11 §3): Stichworte für Energie-Geber und -Räuber, Vorschläge für den Wochenfokus
// und die Längengrenzen der Eingaben. Reihenfolge wie in der Spec, so stehen sie auch in der Auswahl.

/** „Was hat dir heute Energie gegeben?“ */
export const GAVE_TAGS: readonly string[] = ['Bewegung', 'Draußen', 'Gute Gespräche', 'Fokus-Arbeit', 'Erfolg', 'Guter Schlaf', 'Gutes Essen', 'Musik', 'Lernen', 'Pause', 'Familie', 'Lachen']

/** „Was hat dich heute Energie gekostet?“ */
export const COST_TAGS: readonly string[] = ['Wenig Schlaf', 'Bildschirm', 'Meetings', 'Konflikt', 'Zeitdruck', 'Unterbrechungen', 'Grübeln', 'Schweres Essen', 'Lärm', 'Viel Sitzen', 'Alkohol', 'Nachrichten']

/** „Dein Fokus für nächste Woche“ (nur sonntags). */
export const FOCUS_SUGGESTIONS: readonly string[] = ['Dranbleiben', 'Mehr Schlaf', 'Mehr Bewegung', 'Weniger Bildschirm', 'Erst das Wichtige', 'Mehr Pausen']

/** Höchstlänge eines Stichworts in Zeichen (Code-Punkte). */
export const TAG_MAX = 30
/** Höchstens so viele gewählte Stichworte je Seite. */
export const TAGS_MAX = 20
/** „Was hast du heute gelernt?“ */
export const LEARNED_MAX = 120
/** „Was machst du morgen 1 % besser?“ */
export const BETTER_MAX = 80
/** Wochenfokus. */
export const FOCUS_MAX = 40

/** Die Seite der Energie-Bilanz: gegeben oder gekostet. */
export type TagSide = 'gave' | 'cost'

/** Die vorgeschlagenen Stichworte einer Seite. */
export function tagsOf(side: TagSide): readonly string[] {
  return side === 'gave' ? GAVE_TAGS : COST_TAGS
}
