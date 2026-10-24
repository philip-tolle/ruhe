import { test, expect } from 'vitest'
import { connectSessions } from '../../src/lib/session-wiring'
import type { SessionResult } from '../../src/lib/stats/schema'

test('results are recorded and shown', () => {
  let emit!: (r: SessionResult) => void
  const shown: unknown[] = []
  connectSessions({ onSessionEnd: l => { emit = l; return () => {} } }, r => (r.seconds >= 60 ? 'id-' + r.ref : null), (r, sessionId) => shown.push([r.ref, sessionId]))
  emit({ kind: 'timer', ref: 'timer', start: new Date(), seconds: 30 })
  emit({ kind: 'breath', ref: '478', start: new Date(), seconds: 76 })
  expect(shown).toEqual([['timer', null], ['478', 'id-478']])
})

test('each result is recorded before it is shown', () => {
  let emit!: (r: SessionResult) => void
  const calls: string[] = []
  connectSessions(
    { onSessionEnd: l => { emit = l; return () => {} } },
    () => { calls.push('record'); return 'id' },
    () => calls.push('done'),
  )
  emit({ kind: 'timer', ref: 'timer', start: new Date(), seconds: 600 })
  expect(calls).toEqual(['record', 'done'])
})

test('the returned function disconnects from the source', () => {
  let unsubscribed = 0
  const stop = connectSessions({ onSessionEnd: () => () => { unsubscribed++ } }, () => 'id', () => {})
  stop()
  expect(unsubscribed).toBe(1)
})
