// Jedes Symbol der Hack-Schritte (HACK_ICONS) wird gezeichnet: ein Linien-Symbol aus mindestens einer Form, nur Striche,
// für Hilfstechnik verborgen. Liegt unter browser/, weil die Komponente einen Svelte-Compiler braucht.
import { afterEach, expect, test } from 'vitest'
import { mount, unmount } from 'svelte'
import HackIcon from '../../src/components/energy/HackIcon.svelte'
import { HACK_ICONS, type HackIconName } from '../../src/lib/energy/hacks'

let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

function cleanup() {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
}

afterEach(cleanup)

// Zeichnet ein Symbol; ein früheres wird zuvor abgebaut.
function draw(name: HackIconName, size?: number): SVGSVGElement {
  cleanup()
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(HackIcon, { target, props: size === undefined ? { name } : { name, size } })
  return target.querySelector('svg')!
}

test.each([...HACK_ICONS])('%s is a non-empty line icon hidden from assistive technology', (name) => {
  const svg = draw(name)
  expect(svg).not.toBeNull()
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
  expect(svg.getAttribute('fill')).toBe('none')
  expect(svg.getAttribute('stroke')).toBe('currentColor')
  expect(svg.getAttribute('stroke-width')).toBe('1.6')
  expect(svg.getAttribute('stroke-linecap')).toBe('round')
  expect(svg.getAttribute('stroke-linejoin')).toBe('round')
  const shapes = [...svg.querySelectorAll('path, circle, rect, line, ellipse')]
  expect(shapes.length).toBeGreaterThan(0)
  for (const shape of shapes) {
    // Pfade haben Daten, Kreise einen Radius, Rechtecke eine Breite: nichts Leeres.
    if (shape instanceof SVGPathElement) expect(shape.getAttribute('d')?.trim()).toBeTruthy()
    else expect(Number(shape.getAttribute('r') ?? shape.getAttribute('width') ?? shape.getAttribute('x2'))).toBeGreaterThan(0)
  }
})

test('the size is 24 px by default and can be set', () => {
  expect(draw('stern').getAttribute('width')).toBe('24')
  expect(draw('stern').getAttribute('height')).toBe('24')
  const big = draw('stern', 30)
  expect(big.getAttribute('width')).toBe('30')
  expect(big.getAttribute('height')).toBe('30')
})

test('no two icons draw the same picture', () => {
  const seen = new Map<string, HackIconName>()
  for (const name of HACK_ICONS) {
    const svg = draw(name)
    const picture = svg.innerHTML.replace(/<!--.*?-->/g, '')
    expect(seen.get(picture), `${name} gleicht ${seen.get(picture)}`).toBeUndefined()
    seen.set(picture, name)
  }
})
