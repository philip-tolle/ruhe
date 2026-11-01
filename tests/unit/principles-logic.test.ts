process.env.TZ = 'Europe/Berlin'
// Reine Logik der Sammlung (Spec M12 §4): Textschlüssel, Kennungen, Prinzip der Woche, Erkenntnis des Tages,
// Wachstumsfelder und Einfügen. Alle Einträge sind erfunden und neutral (Spec M12 §3.2).
import { describe, expect, test } from 'vitest'
import { COLLECTION_ID, textKey, type CollectionKind } from '../../src/lib/principles/words'
import { newCollectionId, type CollectionItem } from '../../src/lib/principles/collection'
import { growthLine, growthWeek, insightOfDay, nextWeekPrinciple, pasteLines, sameText, sundayChoices, weekAnchor, type PasteResult } from '../../src/lib/principles/logic'
import { logbookDay, morningReminder, shiftDay } from '../../src/lib/evening/logic'
import { FOCUS_SUGGESTIONS } from '../../src/lib/evening/words'
import { dayKey } from '../../src/lib/stats/summary'
import type { EveningEntry } from '../../src/lib/stats/schema'

const t = (month: number, day: number, h: number, min = 0) => new Date(2026, month - 1, day, h, min)
const evening = (day: string, extra: Partial<EveningEntry> = {}): EveningEntry => ({ day, at: `${day}T20:00:00.000Z`, ...extra })
const item = (id: string, kind: CollectionKind, text: string, extra: Partial<CollectionItem> = {}): CollectionItem => ({ id, kind, text, ...extra })
const ins = (n: number) => item(`s-0000000${n}`, 'erkenntnis', `Erkenntnis ${n}`)
const P = item('s-0000000a', 'prinzip', 'Mehrweg statt Einweg', { note: 'Dann fällt weniger Müll an.', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' })
const F = item('s-0000000b', 'feld', 'Schach lernen', { step: 'Jeden Abend eine Eröffnung nachspielen.' })
const E = item('s-0000000c', 'erkenntnis', 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', { source: 'Ein Schachkurs' })
const F2 = item('s-0000000e', 'feld', 'Mehrweg im Alltag', { step: 'Eine Stofftasche einpacken.' })

test('Zeitzone Europe/Berlin (sonst prüfen die Umstellungs-Tests nichts)', () => {
  expect([new Date(2026, 9, 24, 12).getTimezoneOffset(), new Date(2026, 9, 26, 12).getTimezoneOffset()]).toEqual([-120, -60])
})
describe('textKey', () => {
  test('Groß und klein, Leerraum in Folge, Ränder', () => expect(textKey('  Mehrweg\u00a0 statt\tEINWEG\n')).toBe('mehrweg statt einweg'))
  test('NFC: zerlegtes und zusammengesetztes „\u00e9“ sind gleich', () => {
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe(textKey('Ein Schachkurs im Caf\u00e9'))
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe('ein schachkurs im caf\u00e9')
  })
})
describe('newCollectionId', () => {
  test('Form: s- und 8 Hex-Zeichen', () => expect(newCollectionId(new Set())).toMatch(COLLECTION_ID))
  test('bei Kollision neu gezogen; Kennungen der Sammlung, derselben Einfügung und Verweise aus evenings zählen', () => {
    const draws = ['aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-2222-4222-8222-222222222222', 'cccccccc-3333-4333-8333-333333333333']
    const random = () => draws.shift()!
    const taken = new Set(['s-bbbbbbbb']) // etwa ein weekPrinciple aus evenings
    const first = newCollectionId(taken, random)
    taken.add(first) // wie addInsights: eben gezogen, dieselbe Einfügung
    expect([first, newCollectionId(taken, random)]).toEqual(['s-aaaaaaaa', 's-cccccccc'])
  })
})

test('sameText: nur geänderter Text, der bei einem anderen Eintrag derselben Art steht', () => {
  const items = [P, F, item('s-00000010', 'prinzip', 'Mehrweg statt Einweg im Büro')]
  expect(sameText(items, 'prinzip', ' mehrweg  statt EINWEG', '')).toBe(true)
  expect(sameText(items, 'prinzip', 'Mehrweg statt Einweg', 'Mehrweg statt Einweg')).toBe(false) // unverändert, eigener Eintrag
  expect(sameText(items, 'prinzip', 'mehrweg statt einweg', 'Mehrweg statt Einweg')).toBe(false) // nur die Schreibweise
  expect(sameText(items, 'prinzip', 'Mehrweg statt Einweg im Büro', 'Mehrweg statt Einweg')).toBe(true)
  expect(sameText(items, 'feld', 'Mehrweg statt Einweg', '')).toBe(false) // andere Art
  expect(sameText([P, { ...P, id: 's-00000011' }], 'prinzip', P.text, P.text)).toBe(false) // Doppel aus einem Import
})
describe('insightOfDay', () => {
  test('0, 1 und n Erkenntnisse; nur die Art erkenntnis zählt', () => {
    expect(insightOfDay([P, F], t(11, 2, 12))).toBeNull()
    expect([t(11, 2, 12), t(11, 3, 12)].map((d) => insightOfDay([P, ins(1), F], d))).toEqual([ins(1), ins(1)])
  })
  test('das Beispiel aus §4.8, Rang nach Kennung unabhängig von der Listenfolge', () => {
    expect(insightOfDay([ins(2), ins(3), ins(1)], t(11, 2, 12))!.id).toBe('s-00000003') // t = 20 759, p = 2
    expect(insightOfDay([ins(2), ins(3), ins(1)], t(11, 3, 12))!.id).toBe('s-00000001') // p = 0
    expect(insightOfDay([ins(1), ins(2), ins(3)], t(11, 2, 12))!.id).toBe('s-00000003')
  })
  test('gleich um 0:00 und 23:59, auch am 29.03. und 25.10.; Wechsel um Mitternacht', () => {
    const list = [ins(1), ins(2), ins(3)]
    for (const [m, d] of [[11, 2], [3, 29], [10, 25]]) expect(insightOfDay(list, t(m, d, 0, 0))).toEqual(insightOfDay(list, t(m, d, 23, 59)))
    expect(insightOfDay(list, t(11, 3, 0, 0))).not.toEqual(insightOfDay(list, t(11, 2, 23, 59)))
  })
  test('jede genau einmal in n Tagen, auch über die Umstellungen', () => {
    const list = [1, 2, 3, 4, 5].map(ins)
    for (const [m, d] of [[3, 26], [10, 23]]) expect(new Set([0, 1, 2, 3, 4].map((i) => insightOfDay(list, t(m, d + i, 12))!.id)).size).toBe(5)
  })
  test('Anlegen verschiebt, Bearbeiten ändert nur den Text', () => {
    const list = [ins(1), ins(2), ins(3)]
    const today = insightOfDay(list, t(11, 2, 12))!
    expect(insightOfDay(list.map((e) => (e.id === today.id ? { ...e, text: 'Neu' } : e)), t(11, 2, 12))).toEqual({ ...today, text: 'Neu' })
    expect(insightOfDay([ins(4), ...list], t(11, 2, 12))!.id).toBe('s-00000004') // n = 4: 20 759 mod 4 = 3
  })
})
describe('weekAnchor', () => {
  test('Sonntag 1 und 7 Tage zurück gültig, 0 und 8 nicht', () => {
    const list = [evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [P], t(11, 2, 7))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 8, 23, 59))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 1, 21))).toBeNull()
    expect(weekAnchor(list, [P], t(11, 9, 0, 0))).toBeNull()
  })
  test('bei einem Wort dasselbe wie morningReminder(…).weekFocus', () => {
    const list = [evening('2026-10-25', { weekFocus: 'Dranbleiben' }), evening('2026-10-29', { better: 'Morgen zehn Minuten Schachaufgaben lösen.' })]
    for (const now of [t(10, 26, 7), t(11, 1, 7), t(11, 2, 7), t(10, 25, 21)]) {
      const anchor = weekAnchor(list, [], now)
      expect(anchor?.kind === 'wort' ? anchor.text : null).toBe(morningReminder(list, now).weekFocus)
    }
  })
  test('gelöscht oder falsche Art ergibt null, ohne Rückgriff auf ein älteres Wort; Umbenennen folgt', () => {
    // Ein Wort im Fenster (hier ausnahmsweise an einem Samstag), das ein Rückgriff fände
    const list = [evening('2026-10-31', { weekFocus: 'Dranbleiben' }), evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [], t(11, 3, 7))).toBeNull()
    expect(weekAnchor(list, [{ ...P, kind: 'feld' }], t(11, 3, 7))).toBeNull()
    expect(weekAnchor(list, [{ ...P, text: 'Mehrweg statt Einweg im Alltag' }], t(11, 3, 7))).toEqual({ kind: 'prinzip', item: { ...P, text: 'Mehrweg statt Einweg im Alltag' } })
  })
  test('So 21:00 der alte Anker, Mo 0:30 und Mo 4:00 der neue', () => {
    const list = [evening('2026-10-25', { weekFocus: 'Dranbleiben' }), evening('2026-11-01', { weekPrinciple: P.id })]
    expect(weekAnchor(list, [P], t(11, 1, 21))).toEqual({ kind: 'wort', text: 'Dranbleiben' })
    expect(weekAnchor(list, [P], t(11, 2, 0, 30))).toEqual({ kind: 'prinzip', item: P })
    expect(weekAnchor(list, [P], t(11, 2, 4))).toEqual({ kind: 'prinzip', item: P })
  })
  test('Wahl an den Umstellungssonntagen 29.03. und 25.10.: So 23:59 der alte, Mo 0:00 der neue Anker', () => {
    for (const [m, d] of [[3, 29], [10, 25]]) {
      const day = dayKey(t(m, d, 12))
      const list = [evening(shiftDay(day, -7), { weekFocus: 'Dranbleiben' }), evening(day, { weekPrinciple: P.id })]
      expect(weekAnchor(list, [P], t(m, d, 23, 59))).toEqual({ kind: 'wort', text: 'Dranbleiben' })
      expect(weekAnchor(list, [P], t(m, d + 1, 0, 0))).toEqual({ kind: 'prinzip', item: P })
    }
  })
})
test('nextWeekPrinciple: So 21:00 mit Logbuch des Tages die Kennung, Mo 0:30 null; ebenso an den Umstellungssonntagen um 23:30', () => {
  expect(nextWeekPrinciple([evening('2026-11-01', { weekPrinciple: P.id })], t(11, 1, 21))).toBe(P.id)
  expect(nextWeekPrinciple([evening('2026-11-01', { weekPrinciple: P.id })], t(11, 2, 0, 30))).toBeNull()
  expect(nextWeekPrinciple([evening('2026-11-01', { weekFocus: 'Dranbleiben' })], t(11, 1, 21))).toBeNull()
  for (const [m, d] of [[3, 29], [10, 25]]) {
    const list = [evening(dayKey(t(m, d, 12)), { weekPrinciple: P.id })]
    expect([nextWeekPrinciple(list, t(m, d, 23, 30)), nextWeekPrinciple(list, t(m, d + 1, 0, 30))]).toEqual([P.id, null])
  }
})
test('sundayChoices: Vorschlag und eigenes Wort gleich einem Leitsatz ausgeblendet (Groß und klein, Leerraum, NFC); ohne Prinzipien unverändert', () => {
  const principles = [item('s-00000012', 'prinzip', ' dranbleiben '), item('s-00000013', 'prinzip', 'Ein Schachkurs im Cafe\u0301'), P]
  expect(sundayChoices(FOCUS_SUGGESTIONS, ['Ein Schachkurs im  Caf\u00e9', 'MEHRWEG statt Einweg', 'Schach lernen'], principles))
    .toEqual({ suggestions: FOCUS_SUGGESTIONS.slice(1), own: ['Schach lernen'] })
  expect(sundayChoices(FOCUS_SUGGESTIONS, ['Schach lernen'], [])).toEqual({ suggestions: [...FOCUS_SUGGESTIONS], own: ['Schach lernen'] })
  expect(sundayChoices(FOCUS_SUGGESTIONS, [], [item('s-00000014', 'feld', 'Dranbleiben')]).suggestions).toEqual([...FOCUS_SUGGESTIONS])
})
describe('growthWeek und growthLine', () => {
  test('Fenster des Logbuch-Tags, unbekannte und fremde Kennungen übergangen, „Zuletzt“ der jüngste Satz, Reihenfolge der Sammlung', () => {
    const list = [
      evening('2026-10-26', { better: 'Zu alt', growthField: F.id }),
      evening('2026-10-27', { better: 'Morgen eine Eröffnung üben.', growthField: F.id }),
      evening('2026-10-30', { better: 'Morgen zehn Minuten Schachaufgaben lösen.', growthField: F.id }),
      evening('2026-10-31', { better: 'Falsche Art', growthField: P.id }),
      evening('2026-11-01', { better: 'Eine Stofftasche einpacken.', growthField: F2.id }),
      evening('2026-11-02', { better: 'Unbekannt', growthField: 's-000000ff' }),
    ]
    expect(growthWeek([F2, P, F], list, '2026-11-02')).toEqual([
      { item: F2, count: 1, last: 'Eine Stofftasche einpacken.' },
      { item: F, count: 2, last: 'Morgen zehn Minuten Schachaufgaben lösen.' },
    ])
  })
  test('n = 0', () => expect(growthWeek([F], [], '2026-11-02')).toEqual([{ item: F, count: 0, last: null }]))
  test('3:59 gehört zum Vortag, 4:00 zum neuen Tag, über die Zeitumstellung', () => {
    const list = [evening('2026-10-19', { better: 'Morgen eine Eröffnung üben.', growthField: F.id })]
    expect(growthWeek([F], list, logbookDay(t(10, 26, 3, 59)))[0].count).toBe(1) // Fenster 19.–25.10.
    expect(growthWeek([F], list, logbookDay(t(10, 26, 4, 0)))[0].count).toBe(0) // Fenster 20.–26.10.
  })
  test('zweiter Durchgang am selben Tag: ersetzt, der Tag zählt einmal', () => {
    const list = [{ ...evening('2026-11-01', { better: 'A', growthField: F.id }), at: '2026-11-01T19:00:00.000Z' }, { ...evening('2026-11-01', { better: 'B', growthField: F2.id }), at: '2026-11-01T21:00:00.000Z' }]
    expect(growthWeek([F, F2], list, '2026-11-01')).toEqual([{ item: F, count: 0, last: null }, { item: F2, count: 1, last: 'B' }])
  })
  test('growthLine', () => expect(growthLine(2)).toBe('Vorgenommen an 2 der letzten 7 Tage'))
})
describe('pasteLines', () => {
  const texts = (r: PasteResult) => r.lines.map((l) => l.text)
  const EMPTY = { lines: [], duplicates: 0, clipped: 0, overflow: 0, truncated: false }
  const NOTES = ['- Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', '- [ ] Morgens zuerst ein Glas Wasser trinken.', '-5 Grad am Morgen, trotzdem eine Runde gehen.', '1.', '', '---', '• Pausen helfen beim Lernen.', 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', 'Heute lerne ich etwas Neues. '.repeat(20)].join('\n')
  test('Zeilenwechsel CR LF, CR, LF, U+2028, U+2029', () => {
    expect(texts(pasteLines('Eins\r\nZwei\rDrei\nVier\u2028Fünf\u2029Sechs', [], 300))).toEqual(['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'])
  })
  test('U+FEFF, U+200B, U+2060 entfernt, ein Emoji mit U+200D bleibt ganz; Tab und geschütztes Leerzeichen', () => {
    const coder = '👩\u200d💻'
    expect(texts(pasteLines(`\ufeffSchach\u200b lernen\u2060\n${coder} Abends eine Eröffnung nachspielen.\nMehrweg\tstatt\u00a0 Einweg `, [], 300)))
      .toEqual(['Schach lernen', `${coder} Abends eine Eröffnung nachspielen.`, 'Mehrweg statt Einweg'])
  })
  test('jedes Listenzeichen höchstens einmal, die eindeutigen mit und ohne Leerraum; Nummern bis drei Ziffern; Kästchen', () => {
    const unique = ['•', '▪', '◦', '‣', '☐', '☑', '☒', '✓', '✔'].flatMap((mark, i) => [`${mark}Ohne ${i + 1}`, `${mark} Mit ${i + 1}`])
    const kept = ['–Strich ohne Leerraum', '—Strich ohne Leerraum', '1234. Jahr'] // brauchen Leerraum bzw. höchstens drei Ziffern
    const lines = ['- Eins', '– Zwei', '— Drei', '* Vier', '> Fünf', '1. Sechs', '12) Sieben', '123. Acht', ...unique, '- [ ] Siebzehn', '* [x] Achtzehn', '[X] Neunzehn', '- - Zwanzig', ...kept]
    expect(texts(pasteLines(lines.join('\n'), [], 300))).toEqual(['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', ...unique.map((line) => line.slice(1).trim()), 'Siebzehn', 'Achtzehn', 'Neunzehn', '- Zwanzig', ...kept])
  })
  test('ohne Leerraum danach bleiben -5, *Wichtig* und >3; ein Datum wird als Nummer gelesen', () => {
    expect(texts(pasteLines('-5 Grad am Morgen\n*Wichtig* ist der erste Zug\n>3 Tage Pause\n3. Oktober Schachturnier', [], 300)))
      .toEqual(['-5 Grad am Morgen', '*Wichtig* ist der erste Zug', '>3 Tage Pause', 'Oktober Schachturnier'])
  })
  test('Leerzeilen, Trennlinien, leere Aufzählungen und „1.“ oder „2)“ allein entfallen; leerer Text', () => {
    expect(pasteLines('\n   \n---\n***\n___\n-\n- [ ]\n1.\n2)\n☐', [], 300)).toEqual(EMPTY)
    expect(pasteLines('', [], 300)).toEqual(EMPTY)
  })
  test('Kürzen auf 500, ohne ein Ersatzpaar am Schnitt zu zerreißen', () => {
    expect(pasteLines(`${'a'.repeat(499)}😀😀`, [], 300)).toEqual({ ...EMPTY, lines: [{ text: `${'a'.repeat(499)}😀`, clipped: true }], clipped: 1 })
  })
  test('Doppelte in sich und gegen den Bestand; nur Erkenntnisse sind Bestand', () => {
    const r = pasteLines('- wer im Schach früh die Mitte besetzt,  hat mehr Möglichkeiten.\nMehrweg statt Einweg\n* mehrweg statt einweg', [E, P], 300)
    expect([texts(r), r.duplicates]).toEqual([['Mehrweg statt Einweg'], 2])
  })
  test('Platz und Überlauf; gekürzt zählt nur unter lines', () => {
    expect(pasteLines('Zeile 1\nZeile 2\nZeile 3', [], 1)).toEqual({ ...EMPTY, lines: [{ text: 'Zeile 1', clipped: false }], overflow: 2 })
    expect(pasteLines(NOTES, [], 3)).toMatchObject({ duplicates: 1, clipped: 0, overflow: 2 })
  })
  test('mehr als 50 000 Zeichen: die ersten 50 000, truncated', () => {
    const r = pasteLines(`Zeile 1\n${'x'.repeat(50_000)}`, [], 300)
    expect([r.truncated, r.lines.map((l) => Array.from(l.text).length)]).toEqual([true, [7, 500]])
    expect(pasteLines('x'.repeat(50_000), [], 300).truncated).toBe(false)
  })
  test('alle Zählwerte am Einfügetext aus E2E 3', () => {
    expect(pasteLines(NOTES, [], 300)).toEqual({
      lines: [
        { text: 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', clipped: false },
        { text: 'Morgens zuerst ein Glas Wasser trinken.', clipped: false },
        { text: '-5 Grad am Morgen, trotzdem eine Runde gehen.', clipped: false },
        { text: 'Pausen helfen beim Lernen.', clipped: false },
        { text: `${'Heute lerne ich etwas Neues. '.repeat(17)}Heute l`, clipped: true },
      ],
      duplicates: 1, clipped: 1, overflow: 0, truncated: false,
    })
  })
})
