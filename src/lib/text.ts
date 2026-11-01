// Kleine reine Hilfen für Texte.

/**
 * Setzt in den Wörtern, die in `breaks` stehen, deren Fassung mit weichen Trennstellen (U+00AD) ein, damit sie
 * auf schmalen Bildschirmen und bei großer Schrift an einer Silben- oder Wortfuge umbrechen (mit Trennstrich)
 * statt mitten im Wort. Nur ganze Wörter (Buchstabenfolgen) zählen; alles andere bleibt, wie es ist.
 */
export function softBreaks(text: string, breaks: Readonly<Record<string, string>>): string {
  return text.replace(/\p{L}+/gu, (word) => (Object.hasOwn(breaks, word) ? breaks[word] : word))
}

// Gezählt werden Unicode-Zeichen (Codepunkte), damit kein Ersatzpaar zerreißt. Der Morgen-Start kürzt damit auch beim
// Tippen (ohne zu trimmen, ein Leerzeichen zwischen zwei Wörtern muss sich tippen lassen), damit Feld und Speicher
// dieselbe Grenze haben; `maxlength` zählte UTF-16-Einheiten und schnitte ein Emoji nach der Hälfte der Zeichen ab.
export function clipChars(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') : text
}

/**
 * Trimmt und kürzt auf `max` Zeichen; leer ergibt `''`. Der Schnitt kann auf einem Leerzeichen landen, darum wird
 * danach noch einmal hinten getrimmt: Gespeichert ist immer ein getrimmter Text (Spec M10 §4.1).
 */
export function clipText(text: string, max: number): string {
  return clipChars(text.trim(), max).trimEnd()
}
