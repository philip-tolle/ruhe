// „Alle offline speichern“ im Reiter „Ich“: Zustand und Ablauf. Beides liegt hier statt im Reiter,
// damit der Fortschritt den Wechsel des Reiters überlebt und ein zweiter Start nicht möglich ist,
// solange einer läuft. Die Texte und Prozente kommen aus `ich-view`, das Laden aus dem Offline-Modul.
import { MEDITATIONS } from '../content/catalog'
import { absoluteAudioUrl } from '../meditation/guided-view'
import { removeStale, saveAll } from '../offline/meditations'
import { markSaved, offline, refreshSaved } from '../offline/status.svelte'
import { savePercent, saveResultMessage } from './ich-view'

export const saveAllUi: { running: boolean; done: number; total: number; percent: number; message: string } = $state({
  running: false,
  done: 0,
  total: MEDITATIONS.length,
  percent: 0,
  message: '',
})

/** Die neun Meditationen mit ihrer absoluten, versionierten Adresse (wie Liste und Player sie nutzen) und Größe. */
export function meditationFiles(): { url: string; bytes: number }[] {
  return MEDITATIONS.map((m) => ({ url: absoluteAudioUrl(m, location.href), bytes: m.bytes }))
}

const sumBytes = (files: { bytes: number }[]) => files.reduce((sum, file) => sum + file.bytes, 0)

/** Die Meldung gehört zum letzten Lauf; wer den Reiter neu öffnet, soll sie nicht noch einmal lesen. */
export function clearSaveMessage(): void {
  if (!saveAllUi.running) saveAllUi.message = ''
}

/**
 * Speichert alle Meditationen, die noch fehlen. Zuerst fliegen die Reste früherer Aufnahmen aus dem
 * Cache (andere Version derselben Datei). Der Fortschritt ist der Anteil der Bytes laut Katalog an
 * allen neun; was schon gespeichert war, zählt von Anfang an mit. Ohne Netz oder während eines
 * Laufs geschieht nichts.
 */
export async function saveAllOffline(): Promise<void> {
  if (saveAllUi.running || !offline.online) return
  saveAllUi.running = true
  saveAllUi.message = ''
  saveAllUi.done = 0
  saveAllUi.percent = 0
  try {
    const files = meditationFiles()
    const urls = files.map((file) => file.url)
    saveAllUi.total = urls.length
    await removeStale(urls)
    await refreshSaved(urls) // damit bekannt ist, was schon da ist
    const total = sumBytes(files)
    const already = sumBytes(files.filter((file) => offline.saved[file.url] === true))
    saveAllUi.percent = savePercent(already, total)
    const result = await saveAll(
      urls,
      (done, count, bytes) => {
        saveAllUi.done = done
        saveAllUi.total = count
        // Nie rückwärts: Die Bruchstücke einer fehlgeschlagenen Datei fallen wieder heraus.
        saveAllUi.percent = Math.max(saveAllUi.percent, savePercent(already + bytes, total))
      },
      {},
      markSaved,
    )
    saveAllUi.message = saveResultMessage(result, urls.length)
  } finally {
    saveAllUi.running = false
  }
}
