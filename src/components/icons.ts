// Strichzeichnungen der acht Klänge im 24×24-Raster. Die Komponente setzt Strichbreite,
// Linienenden und Farbe (currentColor); hier stehen nur die Pfaddaten.
import type { SoundId } from '../lib/sounds/catalog'

export const SOUND_ICONS: Record<SoundId, string> = {
  // Regentropfen
  regen:
    'M9 4.5c-2 2.6-3.4 4.7-3.4 6.5a3.4 3.4 0 0 0 6.8 0c0-1.8-1.4-3.9-3.4-6.5Z' +
    'M17 10.5c-1.6 2-2.6 3.6-2.6 5a2.6 2.6 0 0 0 5.2 0c0-1.4-1-3-2.6-5Z' +
    'M7.5 15.5c-1.1 1.4-1.8 2.5-1.8 3.5a1.8 1.8 0 0 0 3.6 0c0-1-.7-2.1-1.8-3.5Z',
  // Wellen
  meer:
    'M3 8c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0' +
    'M3 12.5c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0' +
    'M3 17c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0',
  // Windlinien mit Wirbel
  wind:
    'M2.5 9h12a2.6 2.6 0 1 0-2.6-2.6' +
    'M2.5 13h17a2.8 2.8 0 1 1-2.8 2.8' +
    'M5.5 17.5h7',
  // unregelmäßige Rauschkurve
  braun: 'M2.5 12h2.5l1.5-4 1.8 8.5 2-12 2 14 1.8-9 1.4 2.5h6',
  // Kiefer
  wald: 'M12 3.5 7 10h2.8L5.5 16h13l-4.3-6H17L12 3.5Z' + 'M12 16v4.5',
  // Flamme mit Kern
  kaminfeuer:
    'M12 2.8c.9 3.4 5.6 5.6 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-2.5 1.1-4.2 2.5-5.5.2 1.6.9 2.6 1.8 3C10.1 8.6 10.7 5.7 12 2.8Z' +
    'M12 19.6c-1.5 0-2.4-1-2.4-2.3 0-1.3 1.2-2.2 2.4-3.6 1.2 1.4 2.4 2.3 2.4 3.6 0 1.3-.9 2.3-2.4 2.3Z',
  // Wasserlinien mit zwei Kieseln
  bach:
    'M3 8c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0' +
    'M3 13c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0' +
    'M6.5 17.5a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0' +
    'M14 19a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0',
  // Klangschale mit Schwingung
  klangschalen:
    'M4 11h16a8 8 0 0 1-16 0Z' + 'M9 20.5h6' + 'M9 7c.9-1.1 1.8-1.1 3 0s2.1 1.1 3 0',
}
