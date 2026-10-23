// Offline-Status der Meditationen und der Musik für die Oberfläche: welche Dateien gespeichert sind
// und ob das Gerät online ist. Der Status kommt aus dem Cache (`isSaved`); weil `isSaved` die ganze Datei
// liest, wird jede Adresse höchstens einmal zur Zeit geprüft, nacheinander, und eine gespeicherte
// nicht noch einmal. Schlüssel sind die absoluten Adressen (`absoluteAudioUrl`). Drei Zustände:
// `undefined` (noch nicht geprüft), `false` (nicht gespeichert), `true` (gespeichert).
import { isSaved, saveAudio } from './meditations'

export const offline: { saved: Partial<Record<string, boolean>>; online: boolean } = $state({
  saved: {},
  online: navigator.onLine,
})

// Für die ganze Lebensdauer der App, darum nie abgemeldet.
const followNetwork = () => (offline.online = navigator.onLine)
window.addEventListener('online', followNetwork)
window.addEventListener('offline', followNetwork)

const checking = new Set<string>()
const saving = new Set<string>()

/** Vermerkt `url` als gespeichert. */
export function markSaved(url: string): void {
  offline.saved[url] = true
}

/** Prüft nacheinander jede Adresse, die noch nicht als gespeichert bekannt ist. */
export async function refreshSaved(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    if (offline.saved[url] || checking.has(url)) continue
    checking.add(url)
    try {
      const saved = await isSaved(url)
      // Ein Speichern kann während der Prüfung fertig geworden sein: Das gewinnt.
      offline.saved[url] = offline.saved[url] || saved
    } finally {
      checking.delete(url)
    }
  }
}

/**
 * Für das erste Abspielen: speichert die Datei im Hintergrund vollständig, ohne zu warten, und
 * vermerkt sie danach. Schon gespeichert oder gerade in Arbeit: nichts. Fehler bleiben still.
 */
export function saveForOffline(url: string): void {
  if (offline.saved[url] || saving.has(url)) return
  saving.add(url)
  saveAudio(url)
    .then((result) => {
      if (result === 'saved') markSaved(url)
    })
    .catch(() => {})
    .finally(() => saving.delete(url))
}
