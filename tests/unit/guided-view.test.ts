import { describe, test, expect } from 'vitest'
import { audioUrl, MEDITATIONS, type Meditation } from '../../src/lib/content/catalog'
import {
  absoluteAudioUrl,
  balanceFromPercent,
  balancePercent,
  canSeek,
  entryLabel,
  guidedDisplay,
  guidedLevels,
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
  // Abstand des Hintergrunds zur Stimme in dB; die Klänge sind 7 dB leiser abgemischt (−26 zu −19 LUFS).
  const gap = (balance: number) => {
    const { voice, background } = guidedLevels(balance, true)
    return 20 * Math.log10(background / voice) - 7
  }

  test('at 0 the background is off and the voice is full', () => {
    expect(guidedLevels(0, true)).toEqual({ voice: 1, background: 0 })
  })

  test('just above 0 the background is 30 dB under the voice, at 100 % as loud as the voice', () => {
    expect(gap(0.01)).toBeCloseTo(-29.7, 6)
    expect(gap(1)).toBeCloseTo(0, 6)
  })

  test('the default 0.5 puts the background 15 dB under the voice, close to before (0.35)', () => {
    expect(gap(0.5)).toBeCloseTo(-15, 6)
    expect(guidedLevels(0.5, true).voice).toBe(1)
    expect(guidedLevels(0.5, true).background).toBeCloseTo(10 ** (-8 / 20), 6) // ≈ 0,40
  })

  test('every 10 % makes the background 3 dB louder against the voice', () => {
    for (let p = 10; p < 100; p += 10) expect(gap((p + 10) / 100) - gap(p / 100)).toBeCloseTo(3, 6)
  })

  test('the voice stays full up to 76 %; above, the background is full and the voice gives way', () => {
    expect(guidedLevels(0.76, true).voice).toBe(1)
    expect(guidedLevels(0.76, true).background).toBeLessThan(1)
    expect(guidedLevels(0.77, true).background).toBe(1)
    expect(guidedLevels(0.77, true).voice).toBeLessThan(1)
    expect(guidedLevels(1, true)).toEqual({ voice: expect.closeTo(10 ** (-7 / 20), 6), background: 1 }) // ≈ 0,45
  })

  test('levels stay within 0 … 1 for any balance', () => {
    expect(guidedLevels(-0.5, true)).toEqual({ voice: 1, background: 0 })
    expect(guidedLevels(3, true)).toEqual(guidedLevels(1, true))
    for (let p = 0; p <= 100; p++) {
      const { voice, background } = guidedLevels(p / 100, true)
      expect(voice).toBeGreaterThan(0.44)
      expect(voice).toBeLessThanOrEqual(1)
      expect(background).toBeGreaterThanOrEqual(0)
      expect(background).toBeLessThanOrEqual(1)
    }
  })

  test('without a background the voice stays full at any balance', () => {
    for (const balance of [0, 0.5, 0.9, 1]) expect(guidedLevels(balance, false).voice).toBe(1)
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
