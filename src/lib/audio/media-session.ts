// Media Session: Titel, Artwork und Steuerung in Benachrichtigung und Sperrbildschirm; bei einer
// geführten Meditation zusätzlich Spulen um 15 s und die Positionsanzeige.
import { assetUrl } from '../sounds/catalog'
import { mediaTitle, soundTitles } from './media-title'
import type { EngineSnapshot, ProgramSnapshot } from './engine'

export interface MediaActions {
  play(): void
  pause(): void
  stop(): void
  seek(deltaSeconds: number): void
}

const ACTIONS = ['play', 'pause', 'stop'] as const
// s je Spul-Schritt, wie die Knöpfe im Player.
const SEEK_STEP = 15

// Zuletzt gesetzter Titel: Metadaten nur bei Änderung neu setzen, damit z. B. ein
// Lautstärkeregler die Benachrichtigung nicht ständig neu aufbaut.
let lastTitle: string | undefined
// Aktionen, deren Handler gerade registriert sind; null, solange keine Sitzung läuft.
let registered: MediaActions | null = null
// Ebenso für die Spul-Handler; nur während einer geführten Meditation.
let seeking: MediaActions | null = null

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
    releaseSeeking(session)
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

  const guided = snap.program?.kind === 'guided' ? snap.program : null
  if (!guided || seeking !== actions) releaseSeeking(session)
  if (!guided) return
  if (!seeking) {
    session.setActionHandler('seekbackward', () => actions.seek(-SEEK_STEP))
    session.setActionHandler('seekforward', () => actions.seek(SEEK_STEP))
    seeking = actions
  }
  showPosition(session, guided)
}

// Spulen und Positionsanzeige weg, sobald keine geführte Meditation mehr läuft.
function releaseSeeking(session: MediaSession): void {
  if (!seeking) return
  session.setActionHandler('seekbackward', null)
  session.setActionHandler('seekforward', null)
  session.setPositionState()
  seeking = null
}

// Position bei jeder Änderung; zwischen zwei Änderungen rechnet das System sie beim Abspielen
// selbst weiter. Erst mit bekannter Länge und nur mit gültigen Werten (sonst wirft der Browser).
function showPosition(session: MediaSession, run: ProgramSnapshot): void {
  const { length: duration, elapsed: position } = run
  if (!(duration > 0) || !Number.isFinite(duration) || !(position >= 0) || position > duration) return
  session.setPositionState({ duration, position, playbackRate: 1 })
}
