// Update-Hinweis der PWA: Eine neue Version wird vom Service Worker vorbereitet und wartet,
// bis die Person sie bewusst übernimmt (`registerType: 'prompt'`). Die Oberfläche liest nur
// `pwa.needRefresh` und ruft `applyUpdate()` auf.
import { registerSW } from 'virtual:pwa-register'

export const pwa: { needRefresh: boolean } = $state({ needRefresh: false })

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

/** Registriert den Service Worker (einmal). Im Dev-Server tut `registerSW` nichts. */
export function initPwa(): void {
  if (updateSW) return
  updateSW = registerSW({
    onNeedRefresh() {
      pwa.needRefresh = true
    },
  })
}

/** Aktiviert die wartende Version; die Seite lädt danach von selbst neu. */
export async function applyUpdate(): Promise<void> {
  await updateSW?.(true)
}
