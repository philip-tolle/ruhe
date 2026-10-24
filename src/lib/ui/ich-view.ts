// Reiter „Ich“: Texte und Kalenderraster. Reine Funktionen, ohne Speicher- und DOM-Zugriff.
// Die Monatsnamen stehen fest hier, damit die Anzeige nicht von den Sprachdaten des Geräts abhängt.
import { CALM_DAYS, CALM_THRESHOLD, type CalmEffect, type CalmTrend } from '../stats/calm'

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

/** Megabyte (1 MB = 1 000 000 Byte) mit einer Nachkommastelle und Komma: „7,7 MB“; ohne Bytes „0 MB“. */
export function megabytes(bytes: number): string {
  return bytes > 0 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB` : '0 MB'
}

/**
 * Stand der Offline-Speicherung:
 * „3 von 9 Meditationen und 2 von 7 Musikstücken offline gespeichert (12,4 MB von 49,2 MB)“.
 */
export function offlineSummary(
  meditations: { saved: number; total: number },
  music: { saved: number; total: number },
  savedBytes: number,
  totalBytes: number,
): string {
  return (
    `${meditations.saved} von ${meditations.total} Meditationen und ${music.saved} von ${music.total} Musikstücken ` +
    `offline gespeichert (${megabytes(savedBytes)} von ${megabytes(totalBytes)})`
  )
}

/** Während des Speicherns: „Speichere 3 von 9 …“; `done` Dateien sind erledigt, die nächste ist dran. */
export function savingLabel(done: number, total: number): string {
  return `Speichere ${Math.min(done + 1, total)} von ${total} …`
}

/** Anteil der geladenen Bytes in ganzen Prozent, 0 … 100 (nichts zu laden: 0). */
export function savePercent(bytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((bytes / totalBytes) * 100)))
}

/** Meldung nach „Alle offline speichern“; `total` ist die Zahl aller Dateien (Meditationen und Musik). */
export function saveResultMessage(result: { saved: number; failed: number; quota: boolean }, total: number): string {
  if (result.quota) return 'Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.'
  if (result.failed > 0) return `${result.saved} von ${total} gespeichert, ${result.failed} fehlgeschlagen.`
  return 'Alle Meditationen und die Musik sind offline verfügbar.'
}

/** Summe der Größen in Bytes. */
export function sumBytes(files: readonly { bytes: number }[]): number {
  return files.reduce((sum, file) => sum + file.bytes, 0)
}

/**
 * Die Dateien, die laut `status` (Adresse → gespeichert, `undefined` = noch nicht geprüft) gespeichert
 * sind: ihre Zahl und Größe zusammen.
 */
export function savedTotals(
  files: readonly { url: string; bytes: number }[],
  status: Partial<Record<string, boolean>>,
): { count: number; bytes: number } {
  const saved = files.filter((file) => status[file.url] === true)
  return { count: saved.length, bytes: sumBytes(saved) }
}

/**
 * Fortschritt von „Alle offline speichern“ in ganzen Prozent der Bytes laut Katalog (`totalBytes`).
 * Er hört auf die Meldungen von `saveAll`: `received(bytes)` mit den bisher empfangenen Bytes
 * (gespeicherte Dateien samt der laufenden, ohne die Bruchstücke gescheiterter), `saved(fileBytes)`
 * mit der Größe laut Katalog, sobald eine Datei vollständig im Cache liegt. Kamen seit der letzten
 * gespeicherten Datei keine Bytes, war sie schon da: Sie zählt dann mit ihrer Katalog-Größe, ohne dass
 * jemand vorher prüfen müsste, was schon gespeichert war. Jeder Aufruf liefert den neuen Stand; er
 * geht nie zurück.
 */
export function saveProgress(totalBytes: number): {
  received: (bytes: number) => number
  saved: (fileBytes: number) => number
} {
  let skipped = 0 // Bytes der Dateien, die schon im Cache lagen
  let received = 0 // zuletzt gemeldete Bytes
  let settled = 0 // Bytes beim Abschluss der letzten gespeicherten Datei
  let percent = 0
  const update = () => (percent = Math.max(percent, savePercent(skipped + received, totalBytes)))
  return {
    received(bytes) {
      received = bytes
      return update()
    },
    saved(fileBytes) {
      if (received === settled) skipped += fileBytes
      settled = received
      return update()
    },
  }
}

// Ruhe-Karte (Spec M6 §4): eine Nachkommastelle mit Komma; die Einordnung prüft den ungerundeten Wert.
const decimal = (n: number) => Math.abs(n).toFixed(1).replace('.', ',')

/** Betrag in Stufen: „1,4 Stufen“, gerundet genau 1,0 als „eine Stufe“. */
export function calmStufen(n: number): string {
  const amount = decimal(n)
  return amount === '1,0' ? 'eine Stufe' : `${amount} Stufen`
}

/** Mit Vorzeichen für die Aufteilung: „+1,6“, „−0,4“ (echtes Minus), gerundet 0,0 als „±0“. */
export function calmSigned(n: number): string {
  const amount = decimal(n)
  if (amount === '0,0') return '±0'
  return `${n > 0 ? '+' : '\u2212'}${amount}`
}

/** Wirkungs-Satz mit Aufteilung und Grundlage; ohne Wirkung die Einladung. */
export function calmEffectLines(effect: CalmEffect | null): { main: string; split: string | null; basis: string | null } {
  if (!effect) {
    return {
      main: 'Halte nach einer Sitzung fest, wie ruhig du vorher und jetzt bist. Hier siehst du dann, was dir deine Übungen bringen.',
      split: null,
      basis: null,
    }
  }
  const { mean, count, breath, meditation } = effect
  const main =
    Math.abs(mean) < CALM_THRESHOLD
      ? 'Nach einer Sitzung bist du im Schnitt etwa so ruhig wie vorher.'
      : `Nach einer Sitzung bist du im Schnitt ${calmStufen(mean)} ${mean > 0 ? 'ruhiger' : 'unruhiger'}.`
  return {
    main,
    split: breath !== null && meditation !== null ? `Atmen ${calmSigned(breath)} · Meditieren ${calmSigned(meditation)}` : null,
    basis: `Aus ${count} Sitzungen der letzten ${CALM_DAYS} Tage`,
  }
}

/** Verlauf-Satz der Vorher-Werte; ohne Verlauf `null`. */
export function calmTrendLine(trend: CalmTrend | null): string | null {
  if (!trend) return null
  const diff = trend.recent - trend.previous
  const start = `Vor deinen Sitzungen warst du in den letzten ${CALM_DAYS} Tagen`
  if (Math.abs(diff) < CALM_THRESHOLD) return `${start} etwa gleich ruhig wie in den ${CALM_DAYS} Tagen davor.`
  return `${start} ${diff > 0 ? 'ruhiger' : 'unruhiger'} als in den ${CALM_DAYS} Tagen davor.`
}
