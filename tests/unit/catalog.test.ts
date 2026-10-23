import { test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { SOUNDS, EFFECTS, MUSIC, BREATH, soundById, soundTileTitle, backgroundById, isBackgroundId } from '../../src/lib/sounds/catalog'

test('eight sounds in spec order', () => {
  expect(SOUNDS.map(s => s.title)).toEqual(['Regen', 'Meeresrauschen', 'Wind', 'Braunes Rauschen', 'Wald mit Vögeln', 'Kaminfeuer', 'Bach', 'Klangschalen'])
  expect(soundById('bach').title).toBe('Bach')
})

test('every sound is a recording: own ogg file and prompt, no live synthesis', () => {
  for (const s of SOUNDS) {
    expect(Object.keys(s).sort()).toEqual(['file', 'id', 'prompt', 'title'])
    expect(s.file).toBe(`audio/sounds/${s.id}.ogg`)
    expect(existsSync(`public/${s.file}`)).toBe(true)
    expect(s.prompt.length).toBeGreaterThan(20)
  }
})

test('effects point to existing ogg files and carry prompts', () => {
  for (const s of EFFECTS) {
    expect(s.file).toMatch(/^audio\/sounds\/[a-z]+\.ogg$/)
    expect(existsSync(`public/${s.file}`)).toBe(true)
    expect(s.prompt.length).toBeGreaterThan(20)
  }
})

test('the tile titles of the sounds get a soft hyphen at the joint of their long compounds', () => {
  const shy = '\u00AD'
  expect(soundTileTitle('Meeresrauschen')).toBe(`Meeres${shy}rauschen`)
  expect(soundTileTitle('Klangschalen')).toBe(`Klang${shy}schalen`)
  expect(soundTileTitle('Kaminfeuer')).toBe(`Kamin${shy}feuer`)
  expect(soundTileTitle('Braunes Rauschen')).toBe('Braunes Rauschen')
  expect(soundTileTitle('Wald mit Vögeln')).toBe('Wald mit Vögeln')
  expect(soundTileTitle('Schwebende Flächen')).toBe(`Schwe${shy}bende Flächen`)
  expect(soundTileTitle('Bambusflöte')).toBe(`Bambus${shy}flöte`)
  expect(soundTileTitle('Salz und Sternenlicht')).toBe(`Salz und Sternen${shy}licht`)
  expect(soundTileTitle('Unter der Oberfläche')).toBe(`Unter der Ober${shy}fläche`)
  for (const sound of [...SOUNDS, ...MUSIC]) {
    const shown = soundTileTitle(sound.title)
    // Ohne die Trennstellen ist es der Titel selbst; jedes Wort ab 10 Buchstaben hat genau eine.
    expect(shown.replaceAll(shy, '')).toBe(sound.title)
    const words = (title: string) => title.split(/\s+/)
    expect(words(shown).filter((word) => word.includes(shy))).toHaveLength(words(sound.title).filter((word) => word.length >= 10).length)
  }
})

test('seven music pieces in spec order', () => {
  expect(MUSIC.map(m => m.id)).toEqual(['schwebend', 'klavier', 'obertoene', 'bambusfloete', 'zwischen-zwei-atemzuegen', 'salz-und-sternenlicht', 'unter-der-oberflaeche'])
  expect(MUSIC.map(m => m.title)).toEqual(['Schwebende Flächen', 'Stilles Klavier', 'Obertöne', 'Bambusflöte', 'Zwischen zwei Atemzügen', 'Salz und Sternenlicht', 'Unter der Oberfläche'])
})

test('every music piece is an opus file of its catalogue version and size, all within budget', () => {
  let total = 0
  for (const m of MUSIC) {
    expect(m.file).toBe(`audio/music/${m.id}.opus`)
    const path = `public/${m.file}`
    // Die Version ist der Anfang des SHA-256: Eine neue Aufnahme bekommt eine neue Adresse.
    expect(createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10)).toBe(m.version)
    expect(statSync(path).size).toBe(m.bytes)
    expect(m.seconds).toBeGreaterThanOrEqual(140)
    expect(m.seconds).toBeLessThanOrEqual(310)
    expect(['elevenlabs', 'gemini']).toContain(m.source.kind)
    total += m.bytes
  }
  expect(total).toBeLessThanOrEqual(22_000_000)
})

test('music and nature ids never collide and backgroundById knows both kinds', () => {
  const ids = [...SOUNDS.map(s => s.id), ...MUSIC.map(m => m.id)]
  expect(new Set(ids).size).toBe(ids.length)
  expect(backgroundById('klavier')).toMatchObject({ kind: 'music', title: 'Stilles Klavier' })
  expect(backgroundById('regen')).toMatchObject({ kind: 'nature', title: 'Regen' })
  expect(isBackgroundId('klavier')).toBe(true)
  expect(isBackgroundId('regen')).toBe(true)
  expect(isBackgroundId('nichts')).toBe(false)
  expect(isBackgroundId(null)).toBe(false)
})

test('the two breath files exist and stay small', () => {
  expect(BREATH.map(b => b.id)).toEqual(['ein', 'aus'])
  let total = 0
  for (const b of BREATH) {
    expect(b.file).toBe(`audio/breath/${b.id}.ogg`)
    total += statSync(`public/${b.file}`).size
  }
  expect(total).toBeLessThanOrEqual(150_000)
})
