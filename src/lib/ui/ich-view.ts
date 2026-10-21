// Reiter „Ich“: Texte und Kalenderraster. Reine Funktionen, ohne Speicher- und DOM-Zugriff.
// Die Monatsnamen stehen fest hier, damit die Anzeige nicht von den Sprachdaten des Geräts abhängt.

export const MONTH_NAMES: readonly string[] = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** Wochentage ab Montag: Kürzel für die Kopfzeile, ausgeschrieben für Hilfstechnik. */
export const WEEKDAYS: readonly (readonly [short: string, long: string])[] = [
  ['Mo', 'Montag'],
  ['Di', 'Dienstag'],
  ['Mi', 'Mittwoch'],
  ['Do', 'Donnerstag'],
  ['Fr', 'Freitag'],
  ['Sa', 'Samstag'],
  ['So', 'Sonntag'],
]

/** „Oktober 2026“; `month0` zählt ab 0 (Januar). */
export function monthTitle(year: number, month0: number): string {
  return `${MONTH_NAMES[month0]} ${year}`
}

/**
 * Wochen eines Monats, Montag zuerst: je sieben Zellen mit dem Tag (1 …) oder `null` für die
 * Lücken vor dem Ersten und nach dem Letzten.
 */
export function calendarWeeks(year: number, month0: number): (number | null)[][] {
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7 // Montag = 0, Sonntag = 6
  const length = new Date(year, month0 + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Der Monat `delta` Monate vor (positiv) oder zurück (negativ), über Jahresgrenzen hinweg. */
export function shiftMonth(year: number, month0: number, delta: number): { year: number; month0: number } {
  const index = year * 12 + month0 + delta
  const next = Math.floor(index / 12)
  return { year: next, month0: index - next * 12 }
}

/** Name eines markierten Tages für Hilfstechnik, z. B. „21. Oktober, meditiert“. */
export function dayLabel(day: number, month0: number): string {
  return `${day}. ${MONTH_NAMES[month0]}, meditiert`
}

/** „1 Tag“ / „3 Tage“. */
export function streakLabel(days: number): string {
  return days === 1 ? '1 Tag' : `${days} Tage`
}

/** Ergebnis eines Imports: „1 neue Sitzung importiert.“ / „3 neue Sitzungen importiert.“ */
export function importMessage(added: number): string {
  return added === 1 ? '1 neue Sitzung importiert.' : `${added} neue Sitzungen importiert.`
}
