// Atemkurve eines Takt-Hacks (Spec M9 §3.5): ein Zyklus als Linie im Feld von `CURVE`, darauf läuft der Punkt.
// Reine Geometrie ohne Zeichnen. Die Linie und der Punkt aus `taktAt` nutzen dieselbe Übergangskurve (`taktEase`),
// darum liegt der Punkt zu jeder Zeit auf der Linie.
import { taktEase, taktShape, type Hack } from './hacks'

/**
 * Das Feld der Kurve (Zeichenfläche 350 × 170): links und rechts je 12 px Rand, `base` ist die Höhe des leeren Pegels,
 * `top` die des vollen; `floor` ist die Grundlinie darunter, auf der die Fläche unter der Kurve endet.
 */
export const CURVE = { width: 350, height: 170, left: 12, right: 338, top: 24, base: 140, floor: 150 } as const

/**
 * So viele Strecken hat der Bogen einer bewegten Phase. Die Linie läuft in der Zeit gleichmäßig (Punkt und Linie rücken
 * mit derselben Uhr), nur der Pegel folgt dem Kosinus; bei 20 Strecken weicht die Linie auch beim vollen Hub (116 px)
 * höchstens 0,2 px von ihm ab, der Punkt aus `taktAt` bleibt also sichtbar auf der Linie.
 */
const ARC_PARTS = 20

export interface Point {
  x: number
  y: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Stelle im Feld für einen Fortschritt im Zyklus (0 … 1) und einen Pegel (0 leer … 1 voll). */
export function curvePoint(progress: number, level: number): Point {
  return {
    x: CURVE.left + (CURVE.right - CURVE.left) * clamp01(progress),
    y: CURVE.base - (CURVE.base - CURVE.top) * clamp01(level),
  }
}

/** Stützpunkte der Kurve über einen ganzen Zyklus, von links nach rechts; leer, wenn der Hack kein Takt-Hack ist. */
export function curvePoints(h: Hack): Point[] {
  const shape = taktShape(h)
  const cycle = shape.reduce((sum, phase) => sum + phase.seconds, 0)
  const points: Point[] = []
  let start = 0
  for (const { seconds, from, to } of shape) {
    // Eine ebene Phase (Halten) braucht nur ihre Enden, eine bewegte genug Punkte, dass der Bogen rund bleibt.
    const parts = from === to ? 1 : ARC_PARTS
    for (let i = points.length === 0 ? 0 : 1; i <= parts; i++) {
      const t = i / parts
      points.push(curvePoint((start + seconds * t) / cycle, from + (to - from) * taktEase(t)))
    }
    start += seconds
  }
  return points
}

const round = (v: number) => Math.round(v * 10) / 10

/** Linienzug für `d` eines SVG-Pfads. */
export function linePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ')
}

/** Dieselbe Linie, unten über die Grundlinie geschlossen: die Fläche unter der Kurve. */
export function areaPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  return `${linePath(points)} L ${round(points[points.length - 1].x)} ${CURVE.floor} L ${round(points[0].x)} ${CURVE.floor} Z`
}
