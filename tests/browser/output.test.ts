import { test, expect, vi } from 'vitest'
import { createOutput } from '../../src/lib/audio/output'

// Auf Android ruckelt der Umweg Web Audio → MediaStream → <audio> dauerhaft (Diagnose Weg B).
// Stabil sind: Web Audio direkt an den Lautsprecher plus ein lautloser Anker (Weg D).

test('mix goes straight to the speakers, not through a MediaStream', async () => {
  const viaStream = vi.spyOn(AudioContext.prototype, 'createMediaStreamDestination')
  const connect = vi.spyOn(AudioNode.prototype, 'connect')
  const out = createOutput()
  expect(viaStream).not.toHaveBeenCalled()
  expect(connect.mock.calls.some(([target]) => (target as unknown) === out.ctx.destination)).toBe(true)
  expect(out.element.srcObject).toBeNull()
  viaStream.mockRestore()
  connect.mockRestore()
  await out.ctx.close()
})

test('anchor element loops an inaudible local recording of at least 5 s', async () => {
  const out = createOutput()
  expect(out.element.loop).toBe(true)
  expect(out.element.src.startsWith('blob:')).toBe(true)
  const bytes = await (await fetch(out.element.src)).arrayBuffer()
  const anchor = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(bytes)
  // Chrome zeigt die Medien-Steuerung erst für Medien ab 5 s Länge.
  expect(anchor.duration).toBeGreaterThanOrEqual(5)
  const peak = anchor.getChannelData(0).reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  expect(peak).toBeLessThan(0.001)
  await out.ctx.close()
})
