// Die Schritte des Abend-Logbuchs (Spec M11 §2.3). Reine Daten ohne Oberfläche; der Abschluss gehört nicht zur Folge:
// Er entsteht erst nach dem letzten Schritt, wenn der Eintrag gespeichert ist.

export type EveningStep = 'checkin' | 'geber' | 'raeuber' | 'rueckblick' | 'gelernt' | 'besser' | 'woche' | 'abschluss'

/**
 * Die Eingabeschritte in der Reihenfolge, ohne `'abschluss'`. Den Rückblick gibt es nur mit Morgen-Start (Big Domino
 * oder Intention), die Wochenseite nur an einem Sonntag als Logbuch-Tag.
 */
export function eveningSteps(review: boolean, sunday: boolean): EveningStep[] {
  return [
    'checkin',
    'geber',
    'raeuber',
    ...(review ? (['rueckblick'] as const) : []),
    'gelernt',
    'besser',
    ...(sunday ? (['woche'] as const) : []),
  ]
}
