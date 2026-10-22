import { test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import motive from '../../content/motive.json'
import { MOTIV_IDS, motivUrl, soundMotiv, breathMotiv, themaMotiv, vorschlagMotiv } from '../../src/lib/content/motive'
import type { Category } from '../../src/lib/content/catalog'
import { CATEGORY_TITLE } from '../../src/lib/content/catalog'
import { SOUNDS, assetUrl } from '../../src/lib/sounds/catalog'
import { BREATH_PATTERNS } from '../../src/lib/breath/patterns'
import { GREETING } from '../../src/lib/time/tageszeit'
import type { Tageszeit } from '../../src/lib/time/tageszeit'

const DIR = 'public/images/motive'
const file = (id: string) => `${DIR}/${id}.webp`
const sizeOf = (id: string) => readFileSync(file(id)).length

interface WebpInfo { alpha: boolean; width: number; height: number }

// Liest nur den Kopf der Datei: RIFF/WEBP, dann VP8X (Flags + Leinwandgröße) oder VP8L (Größe und Alpha im Strom).
function webpInfo(bytes: Buffer): WebpInfo {
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

test('MOTIV_IDS lists exactly the 28 motifs of content/motive.json', () => {
  expect(MOTIV_IDS).toHaveLength(28)
  expect(new Set(MOTIV_IDS).size).toBe(28)
  expect([...MOTIV_IDS].sort()).toEqual(motive.motive.map((m) => m.id).sort())
})

test('motivUrl is the asset url of images/motive/<id>.webp', () => {
  for (const id of MOTIV_IDS) expect(motivUrl(id)).toBe(assetUrl(`images/motive/${id}.webp`))
  expect(motivUrl('ich')).toBe(import.meta.env.BASE_URL + 'images/motive/ich.webp')
})

test('helpers name the motif of every sound, breath pattern, topic and time of day', () => {
  const sounds = SOUNDS.map((s) => s.id)
  expect(sounds.map(soundMotiv)).toEqual([
    'klang-regen', 'klang-meer', 'klang-wind', 'klang-braun', 'klang-wald', 'klang-kaminfeuer', 'klang-bach', 'klang-klangschalen',
  ])
  const patterns = BREATH_PATTERNS.map((p) => p.id)
  expect(patterns.map(breathMotiv)).toEqual([
    'atem-478', 'atem-box', 'atem-kohaerent', 'atem-langes-ausatmen', 'atem-seufzer', 'atem-wechselatmung',
  ])
  const categories = Object.keys(CATEGORY_TITLE) as Category[]
  expect(categories.map(themaMotiv)).toEqual(['thema-achtsamkeit', 'thema-stress', 'thema-fokus'])
  const zeiten = Object.keys(GREETING) as Tageszeit[]
  expect(zeiten.map(vorschlagMotiv)).toEqual(['vorschlag-morgen', 'vorschlag-tag', 'vorschlag-abend'])
  for (const id of [...sounds.map(soundMotiv), ...patterns.map(breathMotiv), ...categories.map(themaMotiv), ...zeiten.map(vorschlagMotiv)]) {
    expect(MOTIV_IDS).toContain(id)
  }
})

test('every motif id has a webp file with alpha', () => {
  for (const id of MOTIV_IDS) {
    const info = webpInfo(readFileSync(file(id)))
    expect(info.alpha, `${id} braucht einen Alphakanal`).toBe(true)
    const size = motive.motive.find((m) => m.id === id)!.size
    expect([info.width, info.height], `${id}: Zielgröße`).toEqual([size, size])
  }
})

test('files stay within budget', () => {
  for (const id of MOTIV_IDS) {
    const limit = id.startsWith('klang-') ? 90_000 : 60_000
    expect(sizeOf(id), `${id} (${sizeOf(id)} Bytes, Grenze ${limit})`).toBeLessThanOrEqual(limit)
  }
  const total = MOTIV_IDS.reduce((sum, id) => sum + sizeOf(id), 0)
  expect(total).toBeLessThanOrEqual(1_500_000)
})

test('no stray files in public/images/motive', () => {
  expect(readdirSync(DIR).sort()).toEqual(MOTIV_IDS.map((id) => `${id}.webp`).sort())
})
