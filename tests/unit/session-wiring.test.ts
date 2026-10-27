import { test, expect } from 'vitest'
import { connectSessions, doneInfoFor } from '../../src/lib/session-wiring'
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

const start = new Date('2026-10-27T09:00:00.000Z')

test('a hack or sprint that does not count shows no done view', () => {
  expect(doneInfoFor({ kind: 'hack', ref: 'seufzer', start, seconds: 12 }, null)).toBeNull()
  expect(doneInfoFor({ kind: 'focus', ref: 'focus-25', start, seconds: 200, note: 'X' }, null)).toBeNull()
})

test('a counted hack or sprint shows its done view with the stored id', () => {
  expect(doneInfoFor({ kind: 'hack', ref: 'seufzer', start, seconds: 64 }, 'run-1'))
    .toEqual({ kind: 'hack', ref: 'seufzer', seconds: 64, counted: true, sessionId: 'run-1' })
  expect(doneInfoFor({ kind: 'focus', ref: 'focus-50', start, seconds: 3000, note: 'X' }, 'sprint-1'))
    .toEqual({ kind: 'focus', ref: 'focus-50', seconds: 3000, counted: true, sessionId: 'sprint-1' })
})

test('a timer or breath session always shows its done view, counted or not', () => {
  expect(doneInfoFor({ kind: 'timer', ref: 'timer', start, seconds: 30 }, null))
    .toEqual({ kind: 'timer', ref: 'timer', seconds: 30, counted: false, sessionId: null })
  expect(doneInfoFor({ kind: 'breath', ref: '478', start, seconds: 76 }, 'id'))
    .toEqual({ kind: 'breath', ref: '478', seconds: 76, counted: true, sessionId: 'id' })
})
