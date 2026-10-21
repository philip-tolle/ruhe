import { test, expect } from 'vitest'
import { sleepPlan, SLEEP_OPTIONS } from '../../src/lib/audio/sleep-timer'
test('sleep plans', () => {
  expect(SLEEP_OPTIONS).toEqual([15, 30, 45, 60, 90, null])
  expect(sleepPlan(15)).toEqual({ fadeStart: 840, end: 900 })
  expect(sleepPlan(90)).toEqual({ fadeStart: 5340, end: 5400 })
  expect(sleepPlan(0.5)).toEqual({ fadeStart: 0, end: 30 })
  expect(sleepPlan(null)).toBeNull()
})
