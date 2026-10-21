import { test, expect } from 'vitest'
import { timerPlan, clampMinutes, TIMER_PRESETS, INTERVAL_OPTIONS } from '../../src/lib/meditation/timer-plan'

test('options', () => {
  expect(TIMER_PRESETS).toEqual([5, 10, 15, 20, 30])
  expect(INTERVAL_OPTIONS).toEqual([null, 1, 2, 5, 10])
})
test('20 min, interval 5, with lead', () => {
  expect(timerPlan({ minutes: 20, intervalMin: 5, lead: true })).toEqual({
    lead: 10, length: 1200, strikes: [10, 310, 610, 910, 1210, 1213, 1216], finish: 1222,
  })
})
test('interval falling on the end is dropped', () => {
  expect(timerPlan({ minutes: 10, intervalMin: 5, lead: false }).strikes).toEqual([0, 300, 600, 603, 606])
  expect(timerPlan({ minutes: 1, intervalMin: 1, lead: false }).strikes).toEqual([0, 60, 63, 66])
})
test('no interval', () => {
  expect(timerPlan({ minutes: 5, intervalMin: null, lead: false })).toEqual({ lead: 0, length: 300, strikes: [0, 300, 303, 306], finish: 312 })
})
test('clampMinutes', () => {
  expect([clampMinutes(0), clampMinutes(121), clampMinutes(7.6), clampMinutes(Number.NaN)]).toEqual([1, 120, 8, 10])
})
