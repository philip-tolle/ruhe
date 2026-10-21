import { describe, test, expect } from 'vitest'
import { audioUrl, MEDITATIONS, type Meditation } from '../../src/lib/content/catalog'
import {
  absoluteAudioUrl,
  backgroundVolume,
  balanceFromPercent,
  balancePercent,
  canSeek,
  entryLabel,
  guidedDisplay,
  SEEK_SECONDS,
  startable,
} from '../../src/lib/meditation/guided-view'

const meditation = (over: Partial<Meditation> = {}): Meditation => ({
  id: 'ankommen-im-atem',
  title: 'Ankommen im Atem',
  category: 'achtsamkeit',
  description: '',
  minutes: 5,
  file: 'audio/meditations/ankommen-im-atem.mp3',
  duration: 300.1,
  bytes: 1,
  version: 'b258c3f2f7',
  placeholder: false,
  ...over,
})

describe('entry label', () => {
  test('title and minutes, with the offline note only when saved', () => {
    expect(entryLabel(meditation(), false)).toBe('Ankommen im Atem, 5 Minuten')
    expect(entryLabel(meditation(), true)).toBe('Ankommen im Atem, 5 Minuten, offline verfügbar')
  })

  test('minutes come from the file length, rounded like the visible label', () => {
    expect(entryLabel(meditation({ title: 'Drei-Minuten-Atempause', duration: 196.2 }), false)).toBe(
      'Drei-Minuten-Atempause, 3 Minuten',
    )
    expect(entryLabel(meditation({ duration: 599.6 }), false)).toBe('Ankommen im Atem, 10 Minuten')
  })

  test('one minute is singular', () => {
    expect(entryLabel(meditation({ duration: 50 }), true)).toBe('Ankommen im Atem, 1 Minute, offline verfügbar')
  })
})

test('an entry starts online, and offline only when it is saved', () => {
  expect(startable(false, true)).toBe(true)
  expect(startable(true, true)).toBe(true)
  expect(startable(true, false)).toBe(true)
  expect(startable(false, false)).toBe(false)
})

test('an entry that has not been checked yet is never held back', () => {
  // Beim Start ohne Netz steht der Cache-Status noch aus (undefined): kein „Nicht offline verfügbar“.
  expect(startable(undefined, false)).toBe(true)
  expect(startable(undefined, true)).toBe(true)
})

describe('balance', () => {
  test('background volume is 0.7 × balance, the default 0.5 gives 0.35', () => {
    expect(backgroundVolume(0.5)).toBeCloseTo(0.35, 10)
    expect(backgroundVolume(0.2)).toBeCloseTo(0.14, 10)
    expect(backgroundVolume(0)).toBe(0)
    expect(backgroundVolume(1)).toBeCloseTo(0.7, 10)
  })

  test('background volume stays within 0 … 0.7', () => {
    expect(backgroundVolume(-0.5)).toBe(0)
    expect(backgroundVolume(3)).toBeCloseTo(0.7, 10)
  })

  test('the slider shows whole percent', () => {
    expect(balancePercent(0.5)).toBe(50)
    expect(balancePercent(0.2)).toBe(20)
    expect(balancePercent(0.35)).toBe(35)
    expect(balancePercent(0.123)).toBe(12)
  })

  test('a slider value becomes a balance of 0 … 1', () => {
    expect(balanceFromPercent(20)).toBe(0.2)
    expect(balanceFromPercent(0)).toBe(0)
    expect(balanceFromPercent(100)).toBe(1)
    expect(balanceFromPercent(55)).toBe(0.55)
    expect(balanceFromPercent(140)).toBe(1)
    expect(balanceFromPercent(-5)).toBe(0)
  })
})

describe('display', () => {
  test('remaining time and ring follow the position in the file', () => {
    expect(guidedDisplay(300, 300.1, 0)).toEqual({ remaining: 300, progress: 0 })
    expect(guidedDisplay(300, 300.1, 150)).toEqual({ remaining: 150, progress: 0.5 })
    expect(guidedDisplay(300, 300.1, 285)).toEqual({ remaining: 15, progress: 0.95 })
  })

  test('until the length is known, the catalog length counts and the ring stays empty', () => {
    expect(guidedDisplay(0, 180.1, 0)).toEqual({ remaining: 180.1, progress: 0 })
    expect(guidedDisplay(0, 180, 12)).toEqual({ remaining: 168, progress: 0 })
  })

  test('never below zero or past a full ring', () => {
    expect(guidedDisplay(300, 300, 310)).toEqual({ remaining: 0, progress: 1 })
  })
})

test('seeking moves 15 s and needs a known length without a load error', () => {
  expect(SEEK_SECONDS).toBe(15)
  expect(canSeek({ length: 0, error: false })).toBe(false)
  expect(canSeek({ length: 300, error: true })).toBe(false)
  expect(canSeek({ length: 300, error: false })).toBe(true)
})

test('the audio address is absolute and keeps the version', () => {
  const m = MEDITATIONS[0]
  const url = absoluteAudioUrl(m, 'http://localhost:4173/ruhe/heute')
  expect(audioUrl(m).startsWith('/')).toBe(true)
  expect(url).toBe(`http://localhost:4173${audioUrl(m)}`)
  expect(url).toMatch(/\?v=[0-9a-f]{10}$/)
})
