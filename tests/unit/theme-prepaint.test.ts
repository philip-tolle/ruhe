import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { tageszeit } from '../../src/lib/time/tageszeit'

// Das Inline-Skript in index.html setzt die Stimmung, bevor die App-Skripte laden. Es darf nichts
// importieren, deshalb kennt es die Stundengrenzen selbst – dieser Test hält es mit tageszeit() im Gleichschritt.
const html = readFileSync('index.html', 'utf8')

const SCRIPT = /<script\b([^>]*\bid="tageszeit-vorab"[^>]*)>([\s\S]*?)<\/script>/
const found = html.match(SCRIPT)

describe('Inline-Skript #tageszeit-vorab', () => {
  test('ist vorhanden', () => {
    expect(found, '<script id="tageszeit-vorab"> in index.html').not.toBeNull()
  })

  test('ist ein klassisches Skript im <head>, vor jedem Modul-Skript, ohne Import', () => {
    const [, attributes, text] = found!
    expect(attributes).not.toMatch(/type\s*=\s*["']module["']/)
    expect(attributes).not.toMatch(/\b(src|async|defer)\b/)
    expect(text).not.toMatch(/\bimport\b/)

    const start = html.indexOf(found![0])
    expect(start).toBeGreaterThan(html.indexOf('<head>'))
    expect(start).toBeLessThan(html.indexOf('</head>'))
    const firstModule = html.search(/<script\b[^>]*type\s*=\s*["']module["']/)
    expect(firstModule).toBeGreaterThan(start)
  })

  test('schreibt die Stundengrenzen 5/11/17 als Zahlen aus', () => {
    const text = found![2]
    for (const hour of ['5', '11', '17']) expect(text).toMatch(new RegExp(`\\b${hour}\\b`))
  })

  // `new Function('document', 'Date', text)`: Das Skript sieht nur ein Fake-document und ein Fake-Date,
  // dessen getHours() die zu prüfende Stunde liefert.
  const run = (hour: number) => {
    const dataset: Record<string, string> = {}
    const document = { documentElement: { dataset } }
    class FakeDate {
      getHours() {
        return hour
      }
    }
    if (!found) throw new Error('<script id="tageszeit-vorab"> fehlt in index.html')
    new Function('document', 'Date', found[2])(document, FakeDate)
    return dataset.tageszeit
  }

  test.each(Array.from({ length: 24 }, (_, hour) => hour))('%i Uhr: dieselbe Stimmung wie tageszeit()', (hour) => {
    expect(run(hour)).toBe(tageszeit(new Date(2026, 9, 22, hour)))
  })

  test('kennt alle drei Stimmungen', () => {
    const seen = new Set(Array.from({ length: 24 }, (_, hour) => run(hour)))
    expect([...seen].sort()).toEqual(['abend', 'morgen', 'tag'])
  })
})
