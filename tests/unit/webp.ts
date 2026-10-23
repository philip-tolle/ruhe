import { expect } from 'vitest'

// Gemeinsam für die Tests der gemalten Bilder (Motive, Waschungen).
export interface WebpInfo { alpha: boolean; width: number; height: number }

// Liest nur den Kopf der Datei: RIFF/WEBP, dann VP8X (Flags + Leinwandgröße) oder VP8L (Größe und Alpha im Strom).
export function webpInfo(bytes: Buffer): WebpInfo {
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF')
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP')
  expect(bytes.readUInt32LE(4) + 8, 'RIFF-Länge passt zur Dateigröße').toBe(bytes.length)
  const chunk = bytes.subarray(12, 16).toString('latin1')
  if (chunk === 'VP8X') {
    return {
      alpha: (bytes[20] & 0x10) !== 0,
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    }
  }
  if (chunk === 'VP8L') {
    expect(bytes[20], 'VP8L-Signatur').toBe(0x2f)
    const bits = bytes.readUInt32LE(21)
    return { alpha: ((bits >>> 28) & 1) === 1, width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  throw new Error(`Weder VP8X noch VP8L, sondern ${chunk}: kein Alpha möglich`)
}
