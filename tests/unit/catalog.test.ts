import { test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { SOUNDS, EFFECTS, soundById } from '../../src/lib/sounds/catalog'

test('eight sounds in spec order', () => {
  expect(SOUNDS.map(s => s.title)).toEqual(['Regen', 'Meeresrauschen', 'Wind', 'Braunes Rauschen', 'Wald mit Vögeln', 'Kaminfeuer', 'Bach', 'Klangschalen'])
  expect(SOUNDS.filter(s => s.kind === 'live').map(s => s.id)).toEqual(['regen', 'meer', 'wind', 'braun'])
  expect(soundById('bach').title).toBe('Bach')
})

test('loops and effects point to existing ogg files and carry prompts', () => {
  for (const s of [...SOUNDS.filter(s => s.kind === 'loop'), ...EFFECTS]) {
    expect(s.file).toMatch(/^audio\/sounds\/[a-z]+\.ogg$/)
    expect(existsSync(`public/${s.file}`)).toBe(true)
    expect(s.prompt!.length).toBeGreaterThan(20)
  }
})
