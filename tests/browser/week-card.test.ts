// „Deine Woche“ (`WeekCard`, Spec M12 §2.8): die Anker-Zeile „Prinzip der Woche: …“ mit leisem Wenn-dann bzw.
// „Wochenfokus: …“ steht direkt hinter dem Abschnitt „Wochenrückblick“, auch ohne ihn. Liegt unter browser/, weil die
// Komponente einen Svelte-Compiler braucht. Alle Einträge sind erfunden und neutral.
import { afterEach, expect, test, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import WeekCard from '../../src/components/energy/WeekCard.svelte'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

let target: HTMLElement
let instance: Record<string, unknown>

/** Stellt die Uhr des Tests (nur `Date`) und die Minuten-Uhr der App auf `at`. */
function setClock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
  tageszeitUi.now = at.getTime()
}

function show(): void {
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(WeekCard, { target })
  flushSync()
}

afterEach(() => {
  unmount(instance)
  target.remove()
  stats.data = emptyData()
  vi.useRealTimers()
  tageszeitUi.now = Date.now()
})

const h3s = () => [...target.querySelectorAll('h3')].map((h) => h.textContent!.trim())
/** Das Elternelement der h3 mit diesem Text. */
const section = (title: string) => [...target.querySelectorAll('h3')].find((h) => h.textContent!.trim() === title)!.parentElement!

const P = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' }

for (const [extra, line] of [
  [{ weekPrinciple: P.id }, 'Prinzip der Woche: Mehrweg statt Einweg'],
  [{ weekFocus: 'Mehr Schlaf' }, 'Wochenfokus: Mehr Schlaf'],
] as const) {
  test(`nur das Sonntags-Logbuch 7 Tage zuvor: „${line}“ ohne Wochenrückblick, am Montag danach nichts`, () => {
    setClock(new Date(2026, 10, 8, 12))
    stats.data = { ...emptyData(), collection: [P], evenings: [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', ...extra }] }
    show()
    expect(h3s()).not.toContain('Wochenrückblick')
    expect(target.textContent).toContain(line)
    if ('weekPrinciple' in extra) expect(target.textContent).toContain(P.ifThen)
    setClock(new Date(2026, 10, 9, 12))
    flushSync()
    expect(target.textContent).not.toMatch(/Prinzip der Woche:|Wochenfokus:/)
  })
}

test('mit Logbuch in den 7 Tagen steht die Anker-Zeile direkt hinter dem Abschnitt „Wochenrückblick“, nicht darin', () => {
  setClock(new Date(2026, 10, 3, 12))
  stats.data = { ...emptyData(), collection: [P], evenings: [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', weekPrinciple: P.id }] }
  show()
  const review = section('Wochenrückblick')
  expect(review.textContent).not.toContain('Prinzip der Woche:')
  expect(review.nextElementSibling!.textContent).toContain('Prinzip der Woche: Mehrweg statt Einweg')
})

// Spec M12 §2.8, §4.9: die Wachstumsfelder vor „Was bei dir wirkt“.
test('Wachstumsfelder: bei n ≥ 1 Zählung und jüngster Satz, bei n = 0 nur Name und Schritt (Review Focus 2)', () => {
  const F = { id: 's-0000000b', kind: 'feld' as const, text: 'Schach lernen', step: 'Jeden Abend eine Eröffnung nachspielen.' }
  const F2 = { id: 's-0000000e', kind: 'feld' as const, text: 'Mehrweg im Alltag', step: 'Eine Stofftasche einpacken.' }
  setClock(new Date(2026, 10, 2, 10))
  stats.data = {
    ...emptyData(),
    collection: [F, F2],
    evenings: [
      { day: '2026-10-30', at: '2026-10-30T20:00:00.000Z', better: 'Morgen eine Eröffnung üben.', growthField: F.id },
      { day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id },
    ],
  }
  show()
  expect(h3s().slice(-2)).toEqual(['Wachstumsfelder', 'Was bei dir wirkt'])
  const [first, second] = [...section('Wachstumsfelder').querySelectorAll('li')].map((li) => li.textContent!)
  for (const text of ['Schach lernen', 'Vorgenommen an 2 der letzten 7 Tage', 'Zuletzt: Morgen zehn Minuten Schachaufgaben lösen.']) expect(first).toContain(text)
  expect(first).not.toContain('Nächster kleiner Schritt')
  expect(second).toContain('Mehrweg im Alltag')
  expect(second).toContain('Nächster kleiner Schritt: Eine Stofftasche einpacken.')
  expect(second).not.toMatch(/Vorgenommen an|Zuletzt:/)
})

test('ohne Felder kein Abschnitt „Wachstumsfelder“', () => {
  setClock(new Date(2026, 10, 2, 10))
  stats.data = emptyData()
  show()
  expect(h3s()).not.toContain('Wachstumsfelder')
})
