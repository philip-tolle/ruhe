import { test, expect } from 'vitest'
import { keepScreenOn } from '../../src/lib/ui/wake-lock'

// Ein Sentinel wie im Browser: `released` wird wahr, wenn der Browser (etwa beim Verbergen der
// Seite) oder die App die Sperre freigibt.
class FakeSentinel {
  released = false
  async release(): Promise<void> {
    this.released = true
  }
}

function setup(request?: () => Promise<FakeSentinel>) {
  const sentinels: FakeSentinel[] = []
  const requests: string[] = []
  const listeners = new Set<() => void>()
  const nav = {
    wakeLock: {
      request: (type: 'screen') => {
        requests.push(type)
        if (request) return request()
        const sentinel = new FakeSentinel()
        sentinels.push(sentinel)
        return Promise.resolve(sentinel)
      },
    },
  }
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: 'visibilitychange', listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => void listeners.delete(listener),
  }
  const show = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    for (const listener of [...listeners]) listener()
  }
  return { nav, doc, sentinels, requests, listeners, show }
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve))

test('asks for the screen lock and gives it back on release', async () => {
  const { nav, doc, sentinels, requests } = setup()
  const release = keepScreenOn(nav, doc)
  await settle()
  expect(requests).toEqual(['screen'])
  expect(sentinels[0].released).toBe(false)
  release()
  await settle()
  expect(sentinels[0].released).toBe(true)
})

test('asks again when the page becomes visible after the browser released the lock', async () => {
  const { nav, doc, sentinels, requests, show } = setup()
  keepScreenOn(nav, doc)
  await settle()
  // Der Browser gibt die Sperre beim Verbergen der Seite selbst frei.
  show('hidden')
  sentinels[0].released = true
  await settle()
  expect(requests).toHaveLength(1)
  show('visible')
  await settle()
  expect(requests).toHaveLength(2)
  expect(sentinels[1].released).toBe(false)
})

test('does not ask again while it still holds the lock', async () => {
  const { nav, doc, requests, show } = setup()
  keepScreenOn(nav, doc)
  await settle()
  show('visible')
  show('visible')
  await settle()
  expect(requests).toHaveLength(1)
})

test('does not ask again while a request is still pending', async () => {
  const pending: ((s: FakeSentinel) => void)[] = []
  const { nav, doc, requests, show } = setup(() => new Promise((resolve) => pending.push(resolve)))
  keepScreenOn(nav, doc)
  show('visible')
  expect(requests).toHaveLength(1)
  expect(pending).toHaveLength(1)
})

test('after release it neither asks again nor listens any more', async () => {
  const { nav, doc, sentinels, requests, listeners, show } = setup()
  const release = keepScreenOn(nav, doc)
  await settle()
  expect(listeners.size).toBe(1)
  release()
  expect(listeners.size).toBe(0)
  sentinels[0].released = true
  show('visible')
  await settle()
  expect(requests).toHaveLength(1)
  release() // darf mehrfach aufgerufen werden
})

test('a lock granted after release is given back at once', async () => {
  let grant!: (s: FakeSentinel) => void
  const { nav, doc } = setup(() => new Promise((resolve) => (grant = resolve)))
  const release = keepScreenOn(nav, doc)
  release()
  const late = new FakeSentinel()
  grant(late)
  await settle()
  expect(late.released).toBe(true)
})

test('without the API it does nothing and does not throw', () => {
  const { doc, listeners } = setup()
  const release = keepScreenOn({}, doc)
  expect(listeners.size).toBe(0)
  expect(() => release()).not.toThrow()
})

test('a rejected request is silent, and a later visible page tries again', async () => {
  let attempt = 0
  const granted = new FakeSentinel()
  const { nav, doc, requests, show } = setup(() => (++attempt === 1 ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(granted)))
  const release = keepScreenOn(nav, doc)
  await settle()
  expect(requests).toHaveLength(1)
  show('visible')
  await settle()
  expect(requests).toHaveLength(2)
  release()
  await settle()
  expect(granted.released).toBe(true)
})

test('a request that throws at once is silent', async () => {
  const nav = {
    wakeLock: {
      request: (): Promise<FakeSentinel> => {
        throw new Error('SecurityError')
      },
    },
  }
  const { doc } = setup()
  const release = keepScreenOn(nav, doc)
  await settle()
  expect(() => release()).not.toThrow()
})

test('a release that fails is silent', async () => {
  const sentinel = { released: false, release: () => Promise.reject(new Error('InvalidStateError')) }
  const { doc } = setup()
  const release = keepScreenOn({ wakeLock: { request: () => Promise.resolve(sentinel) } }, doc)
  await settle()
  expect(() => release()).not.toThrow()
  await settle() // eine unbehandelte Ablehnung ließe Vitest scheitern
})
