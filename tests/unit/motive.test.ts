import { test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import motive from '../../content/motive.json'
import { MOTIV_IDS, motivUrl, soundMotiv, musicMotiv, backgroundMotiv, breathMotiv, themaMotiv, vorschlagMotiv } from '../../src/lib/content/motive'
import type { Category } from '../../src/lib/content/catalog'
import { CATEGORY_TITLE } from '../../src/lib/content/catalog'
import { MUSIC, SOUNDS, assetUrl } from '../../src/lib/sounds/catalog'
import { BREATH_PATTERNS } from '../../src/lib/breath/patterns'
import { GREETING } from '../../src/lib/time/tageszeit'
import type { Tageszeit } from '../../src/lib/time/tageszeit'
import { webpInfo } from './webp'

const DIR = 'public/images/motive'
const file = (id: string) => `${DIR}/${id}.webp`
const sizeOf = (id: string) => readFileSync(file(id)).length

test('MOTIV_IDS lists exactly the 39 motifs of content/motive.json', () => {
  expect(MOTIV_IDS).toHaveLength(39)
  expect(new Set(MOTIV_IDS).size).toBe(39)
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
  expect(categories.map(themaMotiv)).toEqual([
    'thema-achtsamkeit', 'thema-stress', 'thema-fokus', 'thema-mitgefuehl', 'thema-gefuehle', 'thema-alltag',
  ])
  const zeiten = Object.keys(GREETING) as Tageszeit[]
  expect(zeiten.map(vorschlagMotiv)).toEqual(['vorschlag-morgen', 'vorschlag-tag', 'vorschlag-abend'])
  const music = MUSIC.map((m) => m.id)
  expect(music.map(musicMotiv)).toEqual([
    'musik-schwebend', 'musik-klavier', 'musik-obertoene', 'musik-bambusfloete',
    'musik-zwischen-zwei-atemzuegen', 'musik-salz-und-sternenlicht', 'musik-unter-der-oberflaeche',
  ])
  expect(backgroundMotiv('klavier')).toBe('musik-klavier')
  expect(backgroundMotiv('regen')).toBe('klang-regen')
  for (const id of [...music.map(musicMotiv), ...sounds.map(soundMotiv), ...patterns.map(breathMotiv), ...categories.map(themaMotiv), ...zeiten.map(vorschlagMotiv)]) {
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
    const limit = id.startsWith('klang-') || id.startsWith('musik-') ? 90_000 : 60_000
    expect(sizeOf(id), `${id} (${sizeOf(id)} Bytes, Grenze ${limit})`).toBeLessThanOrEqual(limit)
  }
  const total = MOTIV_IDS.reduce((sum, id) => sum + sizeOf(id), 0)
  expect(total).toBeLessThanOrEqual(1_500_000)
})

test('no stray files in public/images/motive', () => {
  expect(readdirSync(DIR).sort()).toEqual(MOTIV_IDS.map((id) => `${id}.webp`).sort())
})
