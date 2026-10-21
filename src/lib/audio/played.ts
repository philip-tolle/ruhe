// Gehörte Zeit einer geführten Sitzung: die Bereiche, die das Medien-Element tatsächlich
// abgespielt hat (`element.played`), statt der Wanduhr. Pausen und übersprungene Stellen zählen so
// nicht, und ein verspätetes Ende-Ereignis (gedrosseltes JS bei gesperrtem Bildschirm) ändert nichts.
// Reine Funktionen, ohne DOM-Zugriff.

export interface PlayedRange {
  start: number
  end: number
}

/** Die Bereiche eines `TimeRanges`-Objekts als Liste. */
export function rangesOf(ranges: Pick<TimeRanges, 'length' | 'start' | 'end'>): PlayedRange[] {
  const list: PlayedRange[] = []
  for (let i = 0; i < ranges.length; i++) list.push({ start: ranges.start(i), end: ranges.end(i) })
  return list
}

/**
 * Sekunden, die `ranges` zusammen abdecken: jede Stelle nur einmal (Bereiche dürfen sich
 * überlappen, z. B. vor und nach einem Neuladen), begrenzt auf `[0, duration]`. Ohne gültige Länge
 * (NaN, ≤ 0) ist es 0; Bereiche mit NaN entfallen. Das Ergebnis ist immer endlich, sonst 0.
 */
export function playedSeconds(ranges: PlayedRange[], duration: number): number {
  if (!(duration > 0)) return 0
  const clipped = ranges
    .map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(duration, end) }))
    .filter(({ start, end }) => end > start) // fällt auch bei NaN weg
    .sort((a, b) => a.start - b.start)
  let total = 0
  let reached = 0 // bis hierhin ist schon gezählt
  for (const { start, end } of clipped) {
    if (end <= reached) continue
    total += end - Math.max(start, reached)
    reached = end
  }
  return Number.isFinite(total) ? total : 0
}
