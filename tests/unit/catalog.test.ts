import { test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { SOUNDS, EFFECTS, soundById } from '../../src/lib/sounds/catalog'

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
