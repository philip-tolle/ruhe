// Das Blatt (`Sheet`, Spec M12 §5): Danebentippen ist kurz nach dem Öffnen gesperrt, mit `rearm` auch nach jedem Wechsel
// seiner Ansicht. Liegt unter browser/, weil die Komponente einen Svelte-Compiler und echte Zeitgeber braucht.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SheetHarness from './harness/SheetHarness.svelte'

let target: HTMLElement
let instance: { next: () => void } & Record<string, unknown>
let onClose: ReturnType<typeof vi.fn<() => void>>

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function open(): void {
  target = document.createElement('div')
  document.body.append(target)
  onClose = vi.fn<() => void>()
  instance = mount(SheetHarness, { target, props: { onClose } }) as typeof instance
  flushSync()
}

beforeEach(() => {
  history.replaceState(null, '')
})

afterEach(() => {
  unmount(instance)
  target.remove()
})

test('Danebentippen ist kurz nach dem Öffnen und nach jedem Wechsel von rearm gesperrt', async () => {
  open()
  const backdrop = () => document.querySelector<HTMLButtonElement>('.backdrop')!
  expect(backdrop().disabled).toBe(true)
  await wait(450)
  expect(backdrop().disabled).toBe(false)
  instance.next()
  flushSync()
  expect(backdrop().disabled).toBe(true)
  await wait(450)
  backdrop().click()
  expect(onClose).toHaveBeenCalledTimes(1)
})
