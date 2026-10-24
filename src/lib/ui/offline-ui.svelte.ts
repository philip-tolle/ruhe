// „Alle offline speichern“ im Reiter „Ich“ (Meditationen und Musik): Zustand und Ablauf. Beides liegt hier statt im Reiter,
// damit der Fortschritt den Wechsel des Reiters überlebt und ein zweiter Start nicht möglich ist,
// solange einer läuft. Die Texte und Prozente kommen aus `ich-view`, das Laden aus dem Offline-Modul.
import { MEDITATIONS } from '../content/catalog'
import { absoluteAudioUrl } from '../meditation/guided-view'
import { removeStale, saveAll } from '../offline/meditations'
import { markSaved, offline, saveForOffline } from '../offline/status.svelte'
import { MUSIC, musicUrl, type BackgroundId, type MusicDef } from '../sounds/catalog'
import { saveProgress, savedTotals, saveResultMessage, sumBytes } from './ich-view'

export const saveAllUi: { running: boolean; done: number; total: number; percent: number; message: string } = $state({
  running: false,
  done: 0,
  total: MEDITATIONS.length + MUSIC.length,
  percent: 0,
  message: '',
})

/** Adresse eines Musikstücks, absolut gegen `base`; unter ihr ist sein Offline-Status vermerkt. */
export function absoluteMusicUrl(m: MusicDef, base: string): string {
  return new URL(musicUrl(m), base).href
}

/**
 * Alle Dateien für „Alle offline speichern“: alle Meditationen des Katalogs, dann die Musikstücke, je mit
 * absoluter, versionierter Adresse (wie Player und Engine sie abrufen) und Größe laut Katalog.
 */
export function offlineFiles(): { url: string; bytes: number; kind: 'meditation' | 'music' }[] {
  return [
    ...MEDITATIONS.map((m) => ({ url: absoluteAudioUrl(m, location.href), bytes: m.bytes, kind: 'meditation' as const })),
    ...MUSIC.map((m) => ({ url: absoluteMusicUrl(m, location.href), bytes: m.bytes, kind: 'music' as const })),
  ]
}

/**
 * Für das erste Abspielen eines Hintergrunds: Ein Musikstück wird wie eine Meditation im Hintergrund
 * vollständig gespeichert. Naturklänge liegen ohnehin im Precache; ohne Hintergrund geschieht nichts.
 */
export function saveBackgroundForOffline(id: BackgroundId | null): void {
  const music = MUSIC.find((m) => m.id === id)
  if (music) saveForOffline(absoluteMusicUrl(music, location.href))
}

/** Das Ergebnis des letzten Laufs ist einmal zu sehen: Wer den Reiter verlässt, nimmt es mit (nicht mitten im Lauf). */
export function clearSaveMessage(): void {
  if (!saveAllUi.running) saveAllUi.message = ''
}

/**
 * Speichert alle Meditationen und Musikstücke, die noch fehlen. Zuerst fliegen die Reste früherer
 * Aufnahmen aus den Caches (andere Version derselben Datei). Der Fortschritt ist der Anteil der Bytes laut Katalog an
 * allen Dateien (`saveProgress`); was schon gespeichert war, zählt von Anfang an mit. Ohne Netz oder
 * während eines Laufs geschieht nichts. Der Lauf endet immer mit einer Meldung, auch bei einem
 * unerwarteten Fehler.
 */
export async function saveAllOffline(): Promise<void> {
  if (saveAllUi.running || !offline.online) return
  saveAllUi.running = true
  saveAllUi.message = ''
  saveAllUi.done = 0
  saveAllUi.percent = 0
  const files = offlineFiles()
  const urls = files.map((file) => file.url)
  const bytesOf = new Map(files.map((file) => [file.url, file.bytes]))
  saveAllUi.total = urls.length
  try {
    await removeStale(urls)
    const progress = saveProgress(sumBytes(files))
    const result = await saveAll(
      urls,
      (done, count, bytes) => {
        saveAllUi.done = done
        saveAllUi.total = count
        saveAllUi.percent = progress.received(bytes)
      },
      {},
      (url) => {
        markSaved(url)
        saveAllUi.percent = progress.saved(bytesOf.get(url) ?? 0)
      },
    )
    if (result.saved === urls.length) saveAllUi.percent = 100
    saveAllUi.message = saveResultMessage(result, urls.length)
  } catch {
    // Unerwartet (die Teile fangen ihre Fehler selbst ab): Der Stand sagt, wie weit es kam.
    const saved = savedTotals(files, offline.saved).count
    saveAllUi.message = saveResultMessage({ saved, failed: urls.length - saved, quota: false }, urls.length)
  } finally {
    saveAllUi.running = false
  }
}
