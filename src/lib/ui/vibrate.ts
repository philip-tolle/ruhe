// Kurzes Vibrieren des Telefons (Hack-Player: Schrittwechsel 60 ms, Ende 200 ms). Nur, wenn es in den Einstellungen an
// ist und der Bildschirm an ist: Ein Hinweis, den niemand sieht, soll auch nicht in der Tasche summen, und der Browser
// lässt es im Hintergrund ohnehin nicht zu. Fehlt die Schnittstelle (Desktop, iOS) oder sperrt der Browser, entfällt es still.
import { stats } from '../stats/store.svelte'

export function vibrate(ms: number): void {
  if (!stats.data.settings.vibration || document.visibilityState !== 'visible') return
  try {
    navigator.vibrate?.(ms)
  } catch {
    // nicht verfügbar oder gesperrt
  }
}
