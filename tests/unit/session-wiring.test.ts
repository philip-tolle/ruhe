import { test, expect } from 'vitest'
import { connectSessions } from '../../src/lib/session-wiring'
import type { SessionResult } from '../../src/lib/stats/schema'

test('results are recorded and shown', () => {
  let emit!: (r: SessionResult) => void
  const shown: unknown[] = []
  connectSessions({ onSessionEnd: l => { emit = l; return () => {} } }, r => r.seconds >= 60, (r, counted) => shown.push([r.ref, counted]))
  emit({ kind: 'timer', ref: 'timer', start: new Date(), seconds: 30 })
  emit({ kind: 'breath', ref: '478', start: new Date(), seconds: 76 })
  expect(shown).toEqual([['timer', false], ['478', true]])
})

test('each result is recorded before it is shown', () => {
  let emit!: (r: SessionResult) => void
  const calls: string[] = []
  connectSessions(
    { onSessionEnd: l => { emit = l; return () => {} } },
    () => { calls.push('record'); return true },
    () => calls.push('done'),
  )
  emit({ kind: 'timer', ref: 'timer', start: new Date(), seconds: 600 })
  expect(calls).toEqual(['record', 'done'])
})

test('the returned function disconnects from the source', () => {
  let unsubscribed = 0
  const stop = connectSessions({ onSessionEnd: () => () => { unsubscribed++ } }, () => true, () => {})
  stop()
  expect(unsubscribed).toBe(1)
})
