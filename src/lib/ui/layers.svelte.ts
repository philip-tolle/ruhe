/*
  Ebenen (Player, Sheets, Dialoge) auf der History-API: Die Android-Zurück-Geste schließt zuerst
  die oberste Ebene und verlässt die App erst, wenn keine mehr offen ist.

  Jede offene Ebene besitzt einen History-Eintrag mit der Marke `{ ruheLayer: Tiefe }` (Tiefe 1 =
  unterste Ebene, 0 = Ausgangseintrag ohne Marke). Ein `popstate` zu Tiefe d schließt jede Ebene,
  die tiefer liegt als d, von oben nach unten und ruft deren `onBack`. Die Tiefe steht im Eintrag
  selbst, also braucht es keinen Zähler, der mit dem Browser auseinanderlaufen könnte.

  Programmatisches Schließen markiert die Ebene als geschlossen und gibt ihren Eintrag per
  `history.go(-n)` zurück. Das folgende `popstate` findet keine offene Ebene mehr vor und ruft
  darum kein `onBack`. Wird eine Ebene geschlossen, die nicht oben liegt (etwa weil ein Elternteil
  Player und Dialog in einem Zug entfernt und der Player zuerst abgebaut wird), bleibt sie als
  geschlossene Hülle im Stapel, weil ihr Eintrag erst frei wird, wenn alles darüber weg ist. Sobald
  oben im Stapel nur noch Hüllen liegen, geht ein einziger Schritt über alle zurück; so bleibt nie
  ein leerer Eintrag übrig, der die Zurück-Geste einmal ins Leere laufen ließe.

  `history.go` wirkt asynchron: Solange ein `popstate` noch aussteht, warten weitere Schritte
  zurück und neue Ebenen (`pushState`) in der Reihe, sonst träfe der Schritt den neuen Eintrag und
  schlösse ihn gleich wieder. Es läuft immer nur ein Schritt zugleich.

  Keine Runen: Die Datei trägt `.svelte.ts` nur wegen des festen Pfads, und ohne Runen lässt sie
  sich auch in Tests ohne Svelte-Plugin laden.
*/

const MARK = 'ruheLayer'

interface Layer {
  onBack: () => void
  /** Tiefe des eigenen History-Eintrags; erst gesetzt, wenn die Ebene im Stapel liegt. */
  depth: number
  /** `queued`: wartet auf sein `pushState`; `open`: aktiv; `closed`: beendet, endgültig. */
  status: 'queued' | 'open' | 'closed'
}

const stack: Layer[] = [] // Ebenen mit History-Eintrag (auch geschlossene Hüllen), unten zuerst
const queued: Layer[] = [] // geöffnet, während ein Schritt zurück noch aussteht
let owed = 0 // freie Einträge, für die noch kein Schritt zurück angestoßen ist
let waiting = false // ein angestoßener Schritt zurück wartet auf sein popstate
let listening = false

function currentDepth(): number {
  const depth = (history.state as Record<string, unknown> | null)?.[MARK]
  return typeof depth === 'number' ? depth : 0
}

function push(layer: Layer) {
  layer.depth = currentDepth() + 1
  layer.status = 'open'
  history.pushState({ [MARK]: layer.depth }, '')
  stack.push(layer)
}

// Stößt den Schritt zurück für alle freien Einträge an; ist nichts frei, kommen die wartenden
// Ebenen an die Reihe.
function advance() {
  if (owed > 0) {
    const steps = owed
    owed = 0
    waiting = true
    history.go(-steps)
    return
  }
  for (const layer of queued.splice(0)) push(layer)
}

// Oben im Stapel liegende geschlossene Hüllen geben ihre Einträge frei.
function release() {
  while (stack.at(-1)?.status === 'closed') {
    stack.pop()
    owed++
  }
  if (!waiting) advance()
}

function onPopState() {
  const depth = currentDepth()
  const popped: Layer[] = []
  for (let top = stack.at(-1); top && top.depth > depth; top = stack.at(-1)) {
    stack.pop()
    if (top.status === 'open') {
      top.status = 'closed'
      popped.push(top)
    }
  }
  waiting = false
  // Erst den eigenen Zustand fortschreiben, dann die Rückrufe: Sie dürfen Ebenen öffnen und schließen.
  release()
  for (const layer of popped) layer.onBack()
}

function close(layer: Layer) {
  // Idempotent, und ein Aufruf nach der Zurück-Geste (die Ebene ist dann schon weg) tut nichts.
  if (layer.status === 'closed') return
  const wasQueued = layer.status === 'queued'
  layer.status = 'closed'
  if (wasQueued) queued.splice(queued.indexOf(layer), 1)
  else release()
}

/**
 * Öffnet eine Ebene: legt einen History-Eintrag an, damit die Zurück-Geste sie schließt statt der App.
 * `onBack` läuft genau dann, wenn die Ebene durch die Zurück-Geste geschlossen wurde. Die
 * zurückgegebene Funktion schließt sie programmatisch (ohne `onBack`) und darf beliebig oft, auch
 * nach der Zurück-Geste, aufgerufen werden.
 */
export function openLayer(onBack: () => void): () => void {
  if (!listening) {
    listening = true
    window.addEventListener('popstate', onPopState)
  }
  const layer: Layer = { onBack, depth: 0, status: 'queued' }
  if (waiting) queued.push(layer)
  else push(layer)
  return () => close(layer)
}
