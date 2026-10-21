// Titel für die Medien-Benachrichtigung (Lockscreen, Systemleiste).

/** Klangnamen zu einem Titel verbinden: "A", "A & B", "A, B & C". Leere Liste ergibt "Ruhe". */
function joinTitles(titles: string[]): string {
  if (titles.length === 0) return 'Ruhe'
  if (titles.length === 1) return titles[0]
  return `${titles.slice(0, -1).join(', ')} & ${titles[titles.length - 1]}`
}

/** Medientitel; mit aktivem Sleep-Timer wird die Dauer angehängt. */
export function mediaTitle(titles: string[], sleepMinutes: number | null): string {
  const base = joinTitles(titles)
  return typeof sleepMinutes === 'number' ? `${base} · Sleep-Timer ${sleepMinutes} Min` : base
}
