import { test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { SOUNDS, EFFECTS, soundById, soundTileTitle } from '../../src/lib/sounds/catalog'

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

test('tile titles get a soft hyphen at the joint of their long compounds and stay the same otherwise', () => {
  const shy = '\u00AD'
  expect(soundTileTitle('Meeresrauschen')).toBe(`Meeres${shy}rauschen`)
  expect(soundTileTitle('Klangschalen')).toBe(`Klang${shy}schalen`)
  expect(soundTileTitle('Kaminfeuer')).toBe(`Kamin${shy}feuer`)
  // Kürzere Wörter und Wörter außerhalb der Liste bleiben unverändert.
  expect(soundTileTitle('Braunes Rauschen')).toBe('Braunes Rauschen')
  expect(soundTileTitle('Wald mit Vögeln')).toBe('Wald mit Vögeln')
  expect(soundTileTitle('Unbekanntes Wort')).toBe('Unbekanntes Wort')
  for (const sound of SOUNDS) {
    const shown = soundTileTitle(sound.title)
    // Ohne die Trennstellen ist es der Titel selbst; jedes Wort ab 10 Buchstaben hat genau eine.
    expect(shown.replaceAll(shy, '')).toBe(sound.title)
    const words = (title: string) => title.split(/\s+/)
    expect(words(shown).filter((word) => word.includes(shy))).toHaveLength(words(sound.title).filter((word) => word.length >= 10).length)
  }
})
