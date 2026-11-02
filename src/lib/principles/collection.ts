// Ein Eintrag der Sammlung (Spec M12 §4.1, §4.3): Prüfen beim Laden, Grenzen je Art und neue Kennungen. Importiert
// schema.ts nie (kein Zirkelimport), nur words.ts und text.ts.
import { clipText } from '../text'
import {
  COLLECTION_ID,
  FIELD_NAME_MAX,
  IF_THEN_MAX,
  INSIGHT_MAX,
  KIND_LOAD_MAX,
  LEITSATZ_MAX,
  NOTE_MAX,
  SOURCE_MAX,
  STEP_MAX,
  type CollectionKind,
} from './words'

export interface CollectionItem {
  /** `s-` und 8 Hex-Zeichen; entsteht beim Anlegen und ändert sich nie. */
  id: string
  kind: CollectionKind
  /** Leitsatz, Name oder Erkenntnis; getrimmt, nie leer. */
  text: string
  /** Nur Prinzip: „Was heißt das für dich?“ */
  note?: string
  /** Nur Prinzip: das Wenn-dann (ein eindeutiger Name für das Feld). */
  ifThen?: string
  /** Nur Erkenntnis: die Quelle. */
  source?: string
  /** Nur Wachstumsfeld: der nächste kleine Schritt. */
  step?: string
}

type OptionalField = 'note' | 'ifThen' | 'source' | 'step'

const TEXT_MAX: Readonly<Record<CollectionKind, number>> = { prinzip: LEITSATZ_MAX, feld: FIELD_NAME_MAX, erkenntnis: INSIGHT_MAX }

/** Die freiwilligen Felder je Art mit ihrer Länge; Felder einer anderen Art entfallen. */
const OPTIONAL: Readonly<Record<CollectionKind, readonly (readonly [OptionalField, number])[]>> = {
  prinzip: [['note', NOTE_MAX], ['ifThen', IF_THEN_MAX]],
  feld: [['step', STEP_MAX]],
  erkenntnis: [['source', SOURCE_MAX]],
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isKind(v: unknown): v is CollectionKind {
  return v === 'prinzip' || v === 'feld' || v === 'erkenntnis'
}

/**
 * Ein gültiger Eintrag, getrimmt, gekürzt und ohne fremde oder leere Felder; sonst `null` (kein Objekt, falsche
 * Kennung, unbekannte Art, fehlender oder leerer Text).
 */
export function parseCollectionItem(raw: unknown): CollectionItem | null {
  if (!isRecord(raw)) return null
  const { id, kind, text } = raw
  if (typeof id !== 'string' || !COLLECTION_ID.test(id) || !isKind(kind) || typeof text !== 'string') return null
  const clipped = clipText(text, TEXT_MAX[kind])
  if (clipped === '') return null
  const item: CollectionItem = { id, kind, text: clipped }
  for (const [key, max] of OPTIONAL[kind]) {
    const value = raw[key]
    if (typeof value !== 'string') continue
    const field = clipText(value, max)
    if (field !== '') item[key] = field
  }
  return item
}

/**
 * Gültige Einträge in Listenfolge (Muster `parseBreathPatterns`): Bei doppelter Kennung gilt der erste, je Art höchstens
 * `KIND_LOAD_MAX`, damit viele Erkenntnisse nie Prinzipien oder Felder verdrängen, auf die Logbücher zeigen.
 */
export function parseCollection(raw: unknown): CollectionItem[] {
  if (!Array.isArray(raw)) return []
  const list: CollectionItem[] = []
  const ids = new Set<string>()
  const count: Record<CollectionKind, number> = { prinzip: 0, feld: 0, erkenntnis: 0 }
  for (const entry of raw) {
    const item = parseCollectionItem(entry)
    if (!item || ids.has(item.id) || count[item.kind] >= KIND_LOAD_MAX[item.kind]) continue
    ids.add(item.id)
    count[item.kind]++
    list.push(item)
  }
  return list
}

/**
 * Eine neue Kennung, die nicht in `taken` steht (Sammlung, dieselbe Einfügung, Verweise aus Logbüchern); ist sie
 * vergeben, wird neu gezogen. Die Zufallsquelle ist ein Parameter, damit Tests sie festlegen. Der Standard ruft
 * `crypto.randomUUID` gebunden auf: Ungebunden wirft Chrome „Illegal invocation“, Node nicht.
 */
export function newCollectionId(taken: ReadonlySet<string>, random: () => string = () => crypto.randomUUID()): string {
  for (;;) {
    const id = `s-${random().replace(/-/g, '').slice(0, 8)}`
    if (!taken.has(id)) return id
  }
}
