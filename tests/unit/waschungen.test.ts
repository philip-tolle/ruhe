import { test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import waschungen from '../../content/waschungen.json'
import {
  WASCH_FARBEN, waschUrl, themaWaschung, tageszeitWaschung, atemWaschung, zuletztWaschung, waschLage,
} from '../../src/lib/content/waschungen'
import type { Category } from '../../src/lib/content/catalog'
import { byCategory, CATEGORY_TITLE } from '../../src/lib/content/catalog'
import { assetUrl } from '../../src/lib/sounds/catalog'
import { BREATH_PATTERNS } from '../../src/lib/breath/patterns'
import { GREETING } from '../../src/lib/time/tageszeit'
import type { Tageszeit } from '../../src/lib/time/tageszeit'
import type { LastUsed } from '../../src/lib/stats/schema'
import { webpInfo } from './webp'

const DIR = 'public/images/waschungen'
const file = (farbe: string) => `${DIR}/${farbe}.webp`
const sizeOf = (farbe: string) => readFileSync(file(farbe)).length

test('WASCH_FARBEN equals the ids in content/waschungen.json', () => {
  expect(WASCH_FARBEN).toHaveLength(3)
  expect(new Set(WASCH_FARBEN).size).toBe(3)
  expect([...WASCH_FARBEN].sort()).toEqual(waschungen.waschungen.map((w) => w.id).sort())
})

test('waschUrl is the asset url of images/waschungen/<farbe>.webp', () => {
  for (const farbe of WASCH_FARBEN) expect(waschUrl(farbe)).toBe(assetUrl(`images/waschungen/${farbe}.webp`))
  expect(waschUrl('pfirsich')).toBe(import.meta.env.BASE_URL + 'images/waschungen/pfirsich.webp')
})

test('every colour has a webp file with alpha, 900 px wide, as in the json', () => {
  for (const farbe of WASCH_FARBEN) {
    const info = webpInfo(readFileSync(file(farbe)))
    expect(info.alpha, `${farbe} braucht einen Alphakanal`).toBe(true)
    expect(info.width, `${farbe}: Breite`).toBe(900)
    const eintrag = waschungen.waschungen.find((w) => w.id === farbe)!
    expect([info.width, info.height], `${farbe}: Maße laut json`).toEqual([eintrag.width, eintrag.height])
  }
})

test('files stay within budget: each at most 120 KB, together at most 300 KB', () => {
  for (const farbe of WASCH_FARBEN) {
    expect(sizeOf(farbe), `${farbe} (${sizeOf(farbe)} Bytes, Grenze 120000)`).toBeLessThanOrEqual(120_000)
  }
  const total = WASCH_FARBEN.reduce((sum, farbe) => sum + sizeOf(farbe), 0)
  expect(total).toBeLessThanOrEqual(300_000)
})

test('no stray files in public/images/waschungen', () => {
  expect(readdirSync(DIR).sort()).toEqual(WASCH_FARBEN.map((farbe) => `${farbe}.webp`).sort())
})

test('colour assignment: topics, times of day and breathing exercises', () => {
  expect(themaWaschung('achtsamkeit')).toBe('lavendel')
  expect(themaWaschung('stress')).toBe('blaugruen')
  expect(themaWaschung('fokus')).toBe('pfirsich')
  expect(themaWaschung('mitgefuehl')).toBe('lavendel')
  expect(themaWaschung('gefuehle')).toBe('blaugruen')
  expect(themaWaschung('alltag')).toBe('pfirsich')
  expect(tageszeitWaschung('morgen')).toBe('pfirsich')
  expect(tageszeitWaschung('tag')).toBe('blaugruen')
  expect(tageszeitWaschung('abend')).toBe('lavendel')
  expect(atemWaschung('478')).toBe('lavendel')
  expect(atemWaschung('box')).toBe('pfirsich')
  expect(atemWaschung('kohaerent')).toBe('blaugruen')
  expect(atemWaschung('langes-ausatmen')).toBe('lavendel')
  expect(atemWaschung('seufzer')).toBe('blaugruen')
  expect(atemWaschung('wechselatmung')).toBe('pfirsich')
})

test('every topic, time of day and breathing exercise has a colour from the catalogue', () => {
  const categories = Object.keys(CATEGORY_TITLE) as Category[]
  const zeiten = Object.keys(GREETING) as Tageszeit[]
  const alle = [
    ...categories.map(themaWaschung),
    ...zeiten.map(tageszeitWaschung),
    ...BREATH_PATTERNS.map((p) => atemWaschung(p.id)),
  ]
  expect(alle).toHaveLength(6 + 3 + 6)
  for (const farbe of alle) expect(WASCH_FARBEN).toContain(farbe)
})

// Review Focus 4: In der Liste „Meditieren“ stehen die Themen untereinander; zwei benachbarte tragen nie dieselbe Farbe.
test('neighbouring themes never share a wash', () => {
  const farben = byCategory().map((g) => themaWaschung(g.category))
  expect(farben).toHaveLength(6)
  for (let i = 1; i < farben.length; i++) expect(farben[i], `${i - 1} und ${i}`).not.toBe(farben[i - 1])
})

test('zuletztWaschung takes the colour of the topic, the exercise or the time of day', () => {
  const guided: LastUsed = { kind: 'guided', id: 'gedanken-wie-wolken' }
  expect(zuletztWaschung(guided, 'abend')).toBe('lavendel')
  expect(zuletztWaschung({ kind: 'guided', id: 'gehmeditation' }, 'abend')).toBe('pfirsich')
  const breath: LastUsed = { kind: 'breath', pattern: 'box', minutes: 3 }
  expect(zuletztWaschung(breath, 'abend')).toBe('pfirsich')
  const timer: LastUsed = { kind: 'timer', minutes: 10, intervalMin: null, sound: null, lead: false }
  expect(zuletztWaschung(timer, 'tag')).toBe('blaugruen')
  expect(zuletztWaschung(timer, 'abend')).toBe('lavendel')
})

test('zuletztWaschung falls back to the colour of the time of day for an unknown meditation', () => {
  const unbekannt: LastUsed = { kind: 'guided', id: 'gibt-es-nicht' }
  expect(zuletztWaschung(unbekannt, 'morgen')).toBe('pfirsich')
  expect(zuletztWaschung(unbekannt, 'tag')).toBe('blaugruen')
})

test('waschLage cycles 0,1,2,0 for index 0…3', () => {
  expect([0, 1, 2, 3].map(waschLage)).toEqual([0, 1, 2, 0])
  expect(waschLage(7)).toBe(1)
})
