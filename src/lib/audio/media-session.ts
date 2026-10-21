// Media Session: Titel, Artwork und Steuerung in Benachrichtigung und Sperrbildschirm.
import { assetUrl } from '../sounds/catalog'
import { mediaTitle, soundTitles } from './media-title'
import type { EngineSnapshot } from './engine'

export interface MediaActions {
  play(): void
  pause(): void
  stop(): void
}

const ACTIONS = ['play', 'pause', 'stop'] as const

// Zuletzt gesetzter Titel: Metadaten nur bei Änderung neu setzen, damit z. B. ein
// Lautstärkeregler die Benachrichtigung nicht ständig neu aufbaut.
let lastTitle: string | undefined
// Aktionen, deren Handler gerade registriert sind; null, solange keine Sitzung läuft.
let registered: MediaActions | null = null

export function syncMediaSession(snap: EngineSnapshot, actions: MediaActions): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const session = navigator.mediaSession

  // Ohne Sitzung verschwindet die Benachrichtigung samt Steuerung: „Play“ hätte nichts
  // fortzusetzen, und den letzten Klang startet die App bewusst nicht von selbst neu.
  if (snap.state === 'idle') {
    if (registered) {
      for (const action of ACTIONS) session.setActionHandler(action, null)
      registered = null
    }
    session.metadata = null
    session.playbackState = 'none'
    lastTitle = undefined
    return
  }

  // Ein Programm trägt seinen eigenen Titel, ohne Sleep-Zusatz: Dort gilt kein Sleep-Timer.
  const title = snap.program ? snap.program.title : mediaTitle(soundTitles(snap), snap.sleepMinutes)
  if (title !== lastTitle || !session.metadata) {
    session.metadata = new MediaMetadata({
      title,
      artist: 'Ruhe',
      album: 'Ruhe',
      artwork: [{ src: assetUrl('icons/icon-512.png'), sizes: '512x512', type: 'image/png' }],
    })
    lastTitle = title
  }

  session.playbackState = snap.state === 'playing' ? 'playing' : 'paused'
  // Handler nur beim Beginn einer Sitzung setzen, nicht bei jeder Änderung.
  if (registered !== actions) {
    session.setActionHandler('play', () => actions.play())
    session.setActionHandler('pause', () => actions.pause())
    session.setActionHandler('stop', () => actions.stop())
    registered = actions
  }
}
