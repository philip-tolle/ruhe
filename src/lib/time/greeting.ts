/** Begrüßung nach lokaler Tageszeit: Morgen 5–11, Tag 11–17, sonst Abend. */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return 'Guten Morgen'
  if (hour >= 11 && hour < 17) return 'Guten Tag'
  return 'Guten Abend'
}
