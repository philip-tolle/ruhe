export type Tageszeit = 'morgen' | 'tag' | 'abend'

/** Begrüßung je Tageszeit. */
export const GREETING: Record<Tageszeit, string> = {
  morgen: 'Guten Morgen',
  tag: 'Guten Tag',
  abend: 'Guten Abend',
}

/** Tageszeit nach lokaler Uhrzeit: Morgen 5–11, Tag 11–17, sonst Abend (Beginn inklusive, Ende exklusive). */
export function tageszeit(date: Date): Tageszeit {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return 'morgen'
  if (hour >= 11 && hour < 17) return 'tag'
  return 'abend'
}
