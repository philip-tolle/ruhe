import { describe, expect, test } from 'vitest'
import { HACKS, hackById, taktAt, taktEase, taktPhases, type Hack } from '../../src/lib/energy/hacks'
import { CURVE, areaPath, curvePoint, curvePoints, linePath } from '../../src/lib/energy/takt-view'

const takts = HACKS.filter((h) => h.guide === 'takt')

function hack(id: string): Hack {
  const h = hackById(id)
  if (!h) throw new Error(`Hack fehlt: ${id}`)
  return h
}

/** Höhe der Kurve an der Stelle x, linear zwischen den beiden Nachbarpunkten. */
function yAt(points: { x: number; y: number }[], x: number): number {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (x >= a.x && x <= b.x) return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
  }
  throw new Error(`x ${x} liegt außerhalb der Kurve`)
}

describe('Atemkurve eines Zyklus', () => {
  test('der Übergang einer Phase ist weich: 0 am Anfang, 1 am Ende, in der Mitte genau die Hälfte, am Anfang und Ende waagerecht', () => {
    expect(taktEase(0)).toBe(0)
    expect(taktEase(1)).toBe(1)
    expect(taktEase(0.5)).toBeCloseTo(0.5)
    expect(taktEase(0.01)).toBeLessThan(0.001) // sanfter Start
    expect(taktEase(0.99)).toBeGreaterThan(0.999) // sanftes Ende
  })

  test('curvePoint bildet Fortschritt und Pegel auf das Feld ab, begrenzt auf die Kurve', () => {
    expect(curvePoint(0, 0)).toEqual({ x: CURVE.left, y: CURVE.base })
    expect(curvePoint(1, 1)).toEqual({ x: CURVE.right, y: CURVE.top })
    expect(curvePoint(0.5, 0.5)).toEqual({ x: (CURVE.left + CURVE.right) / 2, y: (CURVE.base + CURVE.top) / 2 })
    expect(curvePoint(-1, 2)).toEqual({ x: CURVE.left, y: CURVE.top })
    expect(curvePoint(7, -3)).toEqual({ x: CURVE.right, y: CURVE.base })
  })

  test('es gibt Takt-Hacks, und ihre Kurve füllt das Feld von links nach rechts', () => {
    expect(takts.length).toBeGreaterThan(0)
    for (const h of takts) {
      const points = curvePoints(h)
      expect(points[0], h.id).toEqual({ x: CURVE.left, y: CURVE.base }) // jeder Zyklus beginnt leer
      expect(points.at(-1)!.x, h.id).toBeCloseTo(CURVE.right)
      for (let i = 1; i < points.length; i++) expect(points[i].x, `${h.id} #${i}`).toBeGreaterThan(points[i - 1].x)
      for (const p of points) {
        expect(p.y).toBeGreaterThanOrEqual(CURVE.top - 1e-9)
        expect(p.y).toBeLessThanOrEqual(CURVE.base + 1e-9)
      }
    }
  })

  test('der Punkt aus taktAt liegt zu jeder Zeit auf der Kurve', () => {
    for (const h of takts) {
      const points = curvePoints(h)
      const cycle = taktPhases(h).reduce((sum, p) => sum + p.seconds, 0)
      for (let t = 0; t <= cycle; t += 0.05) {
        const moment = taktAt(h, t)
        const dot = curvePoint(moment.cycleProgress, moment.level)
        expect(Math.abs(dot.y - yAt(points, dot.x)), `${h.id} bei ${t.toFixed(2)} s`).toBeLessThan(0.3)
      }
    }
  })

  test('Seufzer: Einatmen bis 80 %, Nachatmen bis ganz oben, dann langsam hinunter', () => {
    const points = curvePoints(hack('seufzer'))
    const width = CURVE.right - CURVE.left
    const level = (progress: number) => (CURVE.base - yAt(points, CURVE.left + width * progress)) / (CURVE.base - CURVE.top)
    expect(level(2 / 8)).toBeCloseTo(0.8, 2)
    expect(level(3 / 8)).toBeCloseTo(1, 2)
    expect(level(1)).toBeCloseTo(0, 2)
  })

  test('Wach-Atmung: das letzte Viertel (Ausatmen, Halten) ist flach auf dem Boden der Kurve', () => {
    const points = curvePoints(hack('wach-atmung'))
    const width = CURVE.right - CURVE.left
    const flat = points.filter((p) => p.x >= CURVE.left + width * (45 / 60) - 1e-6)
    expect(flat.length).toBeGreaterThanOrEqual(2)
    for (const p of flat) expect(p.y).toBe(CURVE.base)
    // davor wogt sie: 15 Hübe nach oben
    const peaks = points.filter((p) => p.y === CURVE.top)
    expect(peaks.length).toBe(15)
  })

  test('die Pfade: Linie mit Stützpunkten, Fläche darunter geschlossen', () => {
    const points = curvePoints(hack('seufzer'))
    const line = linePath(points)
    expect(line.startsWith('M ')).toBe(true)
    expect(line.match(/ L /g)).toHaveLength(points.length - 1)
    const area = areaPath(points)
    expect(area.startsWith(line)).toBe(true)
    expect(area.endsWith(' Z')).toBe(true)
    expect(area).toContain(`${CURVE.floor}`)
  })
})
