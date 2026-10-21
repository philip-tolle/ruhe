/**
 * Restzeit für die Anzeige: rundet auf volle Sekunden auf, negative Werte ergeben `0:00`.
 * Unter einer Stunde `m:ss` (Minuten ohne führende Null), ab einer Stunde `h:mm:ss`.
 */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sec}`
  return `${m}:${sec}`
}
