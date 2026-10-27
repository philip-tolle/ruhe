// Die Sperre gegen den Doppeltipp (`tapArming`): Sie gilt kurz nach dem Einbau und, wenn ein Wert angegeben ist, nach
// jedem Wechsel dieses Werts neu. Liegt unter browser/ und heißt `.svelte.test.ts`, weil die Datei Runen braucht.
import { afterEach, expect, test } from 'vitest'
import { flushSync } from 'svelte'
import { tapArming } from '../../src/lib/ui/arming.svelte'

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('it arms shortly after it is created', async () => {
  let arming!: ReturnType<typeof tapArming>
  cleanup = $effect.root(() => {
    arming = tapArming()
  })
  flushSync()
  expect(arming.armed).toBe(false)
  await wait(150)
  expect(arming.armed).toBe(false)
  await wait(400)
  expect(arming.armed).toBe(true)
})

test('it starts over whenever the given value changes, and not when it stays', async () => {
  let running = $state(true)
  let arming!: ReturnType<typeof tapArming>
  cleanup = $effect.root(() => {
    arming = tapArming(() => running)
  })
  flushSync()
  await wait(550)
  expect(arming.armed).toBe(true)

  running = false // die Laufansicht endet: Der Rahmen bleibt stehen, die Sperre gilt wieder
  flushSync()
  expect(arming.armed).toBe(false)
  await wait(550)
  expect(arming.armed).toBe(true)

  running = true // „Noch einmal“: Die Laufansicht ist zurück, ein Doppeltipp darf sie nicht treffen
  flushSync()
  expect(arming.armed).toBe(false)
  await wait(150)
  expect(arming.armed).toBe(false)
  await wait(400)
  expect(arming.armed).toBe(true)
})
