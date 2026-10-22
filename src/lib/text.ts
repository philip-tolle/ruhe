// Kleine reine Hilfen für Anzeigetexte.

/**
 * Setzt in den Wörtern, die in `breaks` stehen, deren Fassung mit weichen Trennstellen (U+00AD) ein, damit sie
 * auf schmalen Bildschirmen und bei großer Schrift an einer Silben- oder Wortfuge umbrechen (mit Trennstrich)
 * statt mitten im Wort. Nur ganze Wörter (Buchstabenfolgen) zählen; alles andere bleibt, wie es ist.
 */
export function softBreaks(text: string, breaks: Readonly<Record<string, string>>): string {
  return text.replace(/\p{L}+/gu, (word) => (Object.hasOwn(breaks, word) ? breaks[word] : word))
}
