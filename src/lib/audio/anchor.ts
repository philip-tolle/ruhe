// Lautloser Anker: Ein <audio>-Element, das eine nahezu stille Aufnahme in Schleife spielt.
// Es liefert keinen hörbaren Ton, sorgt aber dafür, dass Android die App als
// Medienwiedergabe behandelt (läuft bei gesperrtem Bildschirm weiter, Steuerung im
// Sperrbildschirm). Der eigentliche Klang kommt direkt aus dem AudioContext.

const SAMPLE_RATE = 8000
// Chrome zeigt die Medien-Steuerung erst für Medien ab 5 s; 30 s lassen reichlich Abstand.
const SECONDS = 30
// Rauschen bei etwa −80 dBFS statt digitaler Stille, damit kein System die Spur als leer verwirft.
const DITHER = 1e-4

function quietWav(): Blob {
  const samples = SAMPLE_RATE * SECONDS
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true) // Länge des fmt-Blocks
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, SAMPLE_RATE, true)
  v.setUint32(28, SAMPLE_RATE * 2, true) // Bytes pro Sekunde
  v.setUint16(32, 2, true) // Bytes pro Frame
  v.setUint16(34, 16, true) // Bit pro Sample
  text(36, 'data')
  v.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    v.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * DITHER * 0x7fff), true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function createAnchorElement(): HTMLAudioElement {
  const element = new Audio(URL.createObjectURL(quietWav()))
  element.loop = true
  return element
}
