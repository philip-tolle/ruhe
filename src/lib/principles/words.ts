// Arten, Längen und Grenzen der Sammlung (Spec M12 §3.1, §4.1) und der gemeinsame Textschlüssel. Ohne Importe, damit
// schema.ts, collection.ts und die Logik sie nutzen können, ohne einander zu importieren.

/** Die drei Arten der Sammlung: Prinzip, Wachstumsfeld, Erkenntnis. */
export type CollectionKind = 'prinzip' | 'feld' | 'erkenntnis'

/** Längen in Code-Punkten (getrimmt; zu lang wird gekürzt, leer entfällt). */
export const LEITSATZ_MAX = 60
export const NOTE_MAX = 160
export const IF_THEN_MAX = 120
export const INSIGHT_MAX = 500
export const SOURCE_MAX = 80
export const FIELD_NAME_MAX = 40
export const STEP_MAX = 120
/** Beim Einfügen zählen höchstens so viele Code-Punkte des Rohtexts. */
export const PASTE_MAX = 50_000

/** Grenzen beim Anlegen; die Oberfläche setzt sie durch. */
export const KIND_MAX: Readonly<Record<CollectionKind, number>> = { prinzip: 12, feld: 3, erkenntnis: 300 }
/** Grenzen beim Laden und beim Import, gezählt je Art in Listenfolge (Schutz vor kaputten Daten). */
export const KIND_LOAD_MAX: Readonly<Record<CollectionKind, number>> = { prinzip: 50, feld: 20, erkenntnis: 600 }

/** Kennung eines Eintrags: `s-` und 8 Hex-Zeichen. */
export const COLLECTION_ID = /^s-[0-9a-f]{8}$/

/**
 * Schlüssel für „gleicher Text“ (Spec M12 §4.1): Unicode-NFC, jeder Leerraum in Folge ein Leerzeichen, getrimmt, klein.
 * `toLowerCase` statt `localeCompare`, weil es nicht vom Gerät abhängt und keine Schreibweisen gleichsetzt.
 */
export function textKey(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}
