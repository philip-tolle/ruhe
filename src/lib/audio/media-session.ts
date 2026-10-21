// Media Session: Titel, Artwork und Steuerung in Benachrichtigung und Sperrbildschirm.
import { SOUNDS, assetUrl } from '../sounds/catalog'
import { mediaTitle } from './media-title'
import type { EngineSnapshot } from './engine'

export interface MediaActions {
  play(): void
  pause(): void
  stop(): void
}

// Zuletzt gesetzter Titel: Metadaten nur bei Änderung neu setzen, damit z. B. ein
// Lautstärkeregler die Benachrichtigung nicht ständig neu aufbaut.
let lastTitle: string | undefined

export function syncMediaSession(snap: EngineSnapshot, actions: MediaActions): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const session = navigator.mediaSession

  // Aktive Klänge in Katalog-Reihenfolge, unabhängig von der Reihenfolge des Einschaltens.
  const titles = SOUNDS.filter((s) => snap.volumes[s.id] !== undefined).map((s) => s.title)
  const title = mediaTitle(titles, snap.sleepMinutes)
  if (title !== lastTitle || !session.metadata) {
    session.metadata = new MediaMetadata({
      title,
      artist: 'Ruhe',
      album: 'Ruhe',
      artwork: [{ src: assetUrl('icons/icon-512.png'), sizes: '512x512', type: 'image/png' }],
    })
    lastTitle = title
  }

  session.playbackState = snap.state === 'playing' ? 'playing' : snap.state === 'paused' ? 'paused' : 'none'
  session.setActionHandler('play', () => actions.play())
  session.setActionHandler('pause', () => actions.pause())
  session.setActionHandler('stop', () => actions.stop())
}
