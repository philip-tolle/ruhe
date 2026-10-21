// Hält den Bildschirm an, solange eine Übung läuft (Screen Wake Lock API). Fehlt die API oder
// scheitert eine Anfrage, tut die Funktion still nichts: Die Übung läuft auch mit ausgehendem
// Bildschirm. Navigator und Dokument sind Parameter, damit sich das ohne Browser testen lässt.

interface Sentinel {
  readonly released: boolean
  release(): Promise<void>
}

export interface WakeNavigator {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> }
}

export interface WakeDocument {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

function apiOf(nav: WakeNavigator): WakeNavigator['wakeLock'] {
  try {
    return nav.wakeLock
  } catch {
    return undefined
  }
}

function giveBack(sentinel: Sentinel): void {
  try {
    sentinel.release().catch(() => {})
  } catch {
    // schon frei
  }
}

/**
 * Fordert die Bildschirmsperre an und holt sie nach dem Verbergen der Seite zurück: Der Browser gibt
 * sie dabei selbst frei, also fordert die Funktion beim nächsten Sichtbarwerden neu an. Die
 * zurückgegebene Funktion gibt sie frei und darf beliebig oft aufgerufen werden.
 */
export function keepScreenOn(nav: WakeNavigator = navigator, doc: WakeDocument = document): () => void {
  const wakeLock = apiOf(nav)
  if (!wakeLock) return () => {}

  let held: Sentinel | null = null
  let requesting = false
  let stopped = false

  function request(): void {
    if (stopped || requesting || (held && !held.released)) return
    requesting = true
    let pending: Promise<Sentinel>
    try {
      pending = wakeLock!.request('screen')
    } catch {
      requesting = false
      return
    }
    pending.then(
      (sentinel) => {
        requesting = false
        // Während der Anfrage freigegeben: Die Sperre kommt zu spät und geht gleich zurück.
        if (stopped) giveBack(sentinel)
        else held = sentinel
      },
      () => {
        requesting = false
      },
    )
  }

  function onVisibility(): void {
    if (doc.visibilityState === 'visible') request()
  }

  doc.addEventListener('visibilitychange', onVisibility)
  request()

  return () => {
    stopped = true
    doc.removeEventListener('visibilitychange', onVisibility)
    if (held) giveBack(held)
    held = null
  }
}
