import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BOWL_LEAD,
  BOWL_TAIL,
  CATALOG_ORDER,
  estimate,
  MIN_SILENCE_SHARE,
  parseMeditation,
  speechHash,
  splitSections,
  validateVoice,
} from '../../scripts/lib/meditation-text.mjs'
import {
  BOWL_GAIN,
  buildAssembleArgs,
  buildMeasureArgs,
  buildPlaceholderArgs,
  parseLoudness,
  planTimeline,
} from '../../scripts/lib/meditation-audio.mjs'

const FRONTMATTER = `---
id: test-id
title: Testmeditation
category: stress   # achtsamkeit | stress | fokus
minutes: 5
description: Ein kurzer Satz zur Übung.
---
`

const doc = (body: string) => `${FRONTMATTER}\n${body}\n`
const lineOf = (source: string, needle: string) => source.split('\n').findIndex((l) => l.includes(needle)) + 1
const voice = { id: 'voice-1', model: 'eleven_multilingual_v2', settings: { stability: 0.5, speed: 0.9 } }

describe('parseMeditation: Frontmatter', () => {
  it('liest alle fünf Felder, auch mit Kommentar am Zeilenende', () => {
    const { meta } = parseMeditation(doc('Hallo.'))
    expect(meta).toEqual({
      id: 'test-id',
      title: 'Testmeditation',
      category: 'stress',
      minutes: 5,
      description: 'Ein kurzer Satz zur Übung.',
    })
  })

  it('verträgt Windows-Zeilenenden und ein BOM', () => {
    const source = '﻿' + doc('Erster Satz.\n\n[Pause 4s]\n\nZweiter Satz.').replace(/\n/g, '\r\n')
    const { meta, segments } = parseMeditation(source)
    expect(meta.id).toBe('test-id')
    expect(segments).toEqual([
      { kind: 'speech', text: 'Erster Satz.' },
      { kind: 'pause', seconds: 4 },
      { kind: 'speech', text: 'Zweiter Satz.' },
    ])
  })

  it('wirft ohne Frontmatter mit Zeile 1', () => {
    expect(() => parseMeditation('Nur Text.\n')).toThrow(/Zeile 1:/)
  })

  it('wirft bei nicht geschlossenem Frontmatter', () => {
    expect(() => parseMeditation('---\nid: a\ntitle: b\n')).toThrow(/Zeile 1:.*schließ/)
  })

  it('wirft bei fehlendem Feld und nennt es', () => {
    const source = doc('Text.').replace('title: Testmeditation\n', '')
    expect(() => parseMeditation(source)).toThrow(/title/)
  })

  it('wirft bei ungültiger Kategorie mit der Zeile des Feldes', () => {
    const source = doc('Text.').replace('category: stress', 'category: schlaf')
    expect(() => parseMeditation(source)).toThrow(new RegExp(`Zeile ${lineOf(source, 'category')}:.*category`))
  })

  it.each(['0', '-5', '2.5', 'fünf', ''])('wirft bei ungültigen Minuten (%s)', (value) => {
    const source = doc('Text.').replace('minutes: 5', `minutes: ${value}`)
    expect(() => parseMeditation(source)).toThrow(new RegExp(`Zeile ${lineOf(source, 'minutes')}:`))
  })

  it('wirft bei ungültiger id, unbekanntem und doppeltem Feld', () => {
    expect(() => parseMeditation(doc('Text.').replace('id: test-id', 'id: Test ID'))).toThrow(/Zeile 2:.*id/)
    expect(() => parseMeditation(doc('Text.').replace('minutes: 5', 'minutes: 5\nfarbe: blau'))).toThrow(/Zeile 6:.*farbe/)
    expect(() => parseMeditation(doc('Text.').replace('minutes: 5', 'minutes: 5\nminutes: 6'))).toThrow(/Zeile 6:.*minutes/)
  })

  it('wirft bei einer Frontmatter-Zeile ohne Doppelpunkt', () => {
    expect(() => parseMeditation(doc('Text.').replace('minutes: 5', 'minutes 5'))).toThrow(/Zeile 5:/)
  })
})

describe('parseMeditation: Abschnitte und Pausen', () => {
  it('liest [Pause 8s] und [Pause 2.5s] als Pausen', () => {
    const { segments } = parseMeditation(doc('Eins.\n\n[Pause 8s]\n\nZwei.\n\n[Pause 2.5s]\n\nDrei.'))
    expect(segments).toEqual([
      { kind: 'speech', text: 'Eins.' },
      { kind: 'pause', seconds: 8 },
      { kind: 'speech', text: 'Zwei.' },
      { kind: 'pause', seconds: 2.5 },
      { kind: 'speech', text: 'Drei.' },
    ])
  })

  it('setzt zwischen zwei Absätzen ohne Markierung 3 Sekunden', () => {
    const { segments } = parseMeditation(doc('Eins.\n\nZwei.'))
    expect(segments).toEqual([
      { kind: 'speech', text: 'Eins.' },
      { kind: 'pause', seconds: 3 },
      { kind: 'speech', text: 'Zwei.' },
    ])
  })

  it('addiert aufeinanderfolgende Pausen und gibt neben einer Markierung keine zusätzlichen 3 s', () => {
    const { segments } = parseMeditation(doc('Eins.\n\n[Pause 4s]\n\n[Pause 6s]\n[Pause 0.5s]\n\nZwei.'))
    expect(segments).toEqual([
      { kind: 'speech', text: 'Eins.' },
      { kind: 'pause', seconds: 10.5 },
      { kind: 'speech', text: 'Zwei.' },
    ])
  })

  it('behandelt eine Markierung direkt an einem Absatz (ohne Leerzeile) wie eine getrennte', () => {
    const { segments } = parseMeditation(doc('Eins.\n[Pause 5s]\nZwei.'))
    expect(segments).toEqual([
      { kind: 'speech', text: 'Eins.' },
      { kind: 'pause', seconds: 5 },
      { kind: 'speech', text: 'Zwei.' },
    ])
  })

  it('verwirft Pausen am Anfang und am Ende (die Klangschale rahmt)', () => {
    const { segments } = parseMeditation(doc('[Pause 9s]\n\nNur ein Satz.\n\n[Pause 20s]\n\n[Pause 5s]'))
    expect(segments).toEqual([{ kind: 'speech', text: 'Nur ein Satz.' }])
  })

  it('macht aus Zeilenumbrüchen innerhalb eines Absatzes Leerzeichen', () => {
    const { segments } = parseMeditation(doc('Erste Zeile\n  zweite Zeile  \ndritte Zeile.\n\n\n\nNeuer Absatz.'))
    expect(segments).toEqual([
      { kind: 'speech', text: 'Erste Zeile zweite Zeile dritte Zeile.' },
      { kind: 'pause', seconds: 3 },
      { kind: 'speech', text: 'Neuer Absatz.' },
    ])
  })

  it('behandelt Zeilen nur aus Leerzeichen als Leerzeile', () => {
    const { segments } = parseMeditation(doc('Eins.\n   \t \nZwei.'))
    expect(segments.map((s) => s.kind)).toEqual(['speech', 'pause', 'speech'])
  })

  it('wirft, wenn gar kein Sprechtext vorkommt', () => {
    expect(() => parseMeditation(doc('[Pause 5s]'))).toThrow(/Sprechtext/)
  })

  it.each([
    ['[Pause 8]', '8 ohne s'],
    ['[Pause 2.3s]', 'keine halbe Sekunde'],
    ['[Pause -1s]', 'negativ'],
    ['[Pause 0s]', 'null'],
    ['[Pause 2,5s]', 'Komma'],
    ['[Pause 8 s]', 'Leerzeichen vor s'],
    ['[Pause]', 'ohne Zahl'],
    ['[pause 8s]', 'klein geschrieben'],
  ])('wirft mit Zeilennummer bei %s (%s)', (marker) => {
    const source = doc(`Eins.\n\n${marker}\n\nZwei.`)
    const line = lineOf(source, marker)
    expect(() => parseMeditation(source)).toThrow(new RegExp(`^Zeile ${line}:`))
  })

  it('wirft, wenn eine Markierung mitten im Satz steht (würde sonst vorgelesen)', () => {
    const source = doc('Eins.\n\nAtme ein [Pause 4s] und aus.')
    expect(() => parseMeditation(source)).toThrow(new RegExp(`^Zeile ${lineOf(source, 'Atme')}:`))
  })

  it('hängt die Zeilennummer auch als Eigenschaft an den Fehler', () => {
    const source = doc('Eins.\n\n[Pause 8]\n')
    try {
      parseMeditation(source)
      expect.unreachable()
    } catch (err) {
      expect((err as Error & { line: number }).line).toBe(lineOf(source, '[Pause 8]'))
    }
  })
})

describe('speechHash', () => {
  const base = speechHash('Atme ein.', voice)

  it('ist ein Hex-String mit 16 Zeichen und stabil', () => {
    expect(base).toMatch(/^[0-9a-f]{16}$/)
    expect(speechHash('Atme ein.', structuredClone(voice))).toBe(base)
  })

  it('ändert sich mit Text, Stimme, Modell und jeder Einstellung', () => {
    const hashes = new Set([
      base,
      speechHash('Atme aus.', voice),
      speechHash('Atme ein. ', voice),
      speechHash('Atme ein.', { ...voice, id: 'voice-2' }),
      speechHash('Atme ein.', { ...voice, model: 'eleven_v3' }),
      speechHash('Atme ein.', { ...voice, settings: { ...voice.settings, stability: 0.6 } }),
      speechHash('Atme ein.', { ...voice, settings: { ...voice.settings, speed: 0.8 } }),
      speechHash('Atme ein.', { ...voice, settings: { ...voice.settings, similarity_boost: 0.8 } }),
    ])
    expect(hashes.size).toBe(8)
  })

  it('hängt nicht von der Reihenfolge der Einstellungen ab', () => {
    const reordered = { ...voice, settings: { speed: 0.9, stability: 0.5 } }
    expect(speechHash('Atme ein.', reordered)).toBe(base)
  })

  it('hängt nicht vom Nachbartext ab', () => {
    const a = splitSections(parseMeditation(doc('Vorher A.\n\nAtme ein.\n\nNachher A.')).segments, voice)
    const b = splitSections(parseMeditation(doc('Ganz anders.\n\n[Pause 7s]\n\nAtme ein.')).segments, voice)
    expect(a[1].hash).toBe(base)
    expect(b[1].hash).toBe(base)
    expect(a[1].previousText).not.toBe(b[1].previousText)
  })
})

describe('splitSections', () => {
  it('liefert Hash, Text und die Nachbartexte der Sprechabschnitte (null an den Enden)', () => {
    const { segments } = parseMeditation(doc('Eins.\n\n[Pause 5s]\n\nZwei.\n\nDrei.'))
    const sections = splitSections(segments, voice)
    expect(sections).toEqual([
      { hash: speechHash('Eins.', voice), text: 'Eins.', previousText: null, nextText: 'Zwei.' },
      { hash: speechHash('Zwei.', voice), text: 'Zwei.', previousText: 'Eins.', nextText: 'Drei.' },
      { hash: speechHash('Drei.', voice), text: 'Drei.', previousText: 'Zwei.', nextText: null },
    ])
  })

  it('liefert für einen einzigen Abschnitt beide Nachbarn als null', () => {
    const [only] = splitSections(parseMeditation(doc('Allein.')).segments, voice)
    expect(only.previousText).toBeNull()
    expect(only.nextText).toBeNull()
  })
})

describe('validateVoice', () => {
  it('lässt { id, model, settings } durch', () => {
    expect(validateVoice(voice)).toEqual(voice)
  })

  it.each([null, 'x', [], {}, { id: 'a' }, { id: 'a', model: 'm' }, { id: '', model: 'm', settings: {} }, { id: 'a', model: 'm', settings: [] }])(
    'wirft bei %j',
    (value) => {
      expect(() => validateVoice(value)).toThrow(/voice\.json/)
    },
  )
})

describe('estimate', () => {
  it('rechnet mit 13 Zeichen/s und zählt die Schalen als Stille', () => {
    expect(BOWL_LEAD).toBe(4)
    expect(BOWL_TAIL).toBe(15)
    // 130 Zeichen = 10 s Sprache, 21 s Pausen im Text, dazu 4 + 15 s Schalen
    const segments = [
      { kind: 'speech' as const, text: 'a'.repeat(65) },
      { kind: 'pause' as const, seconds: 20 },
      { kind: 'speech' as const, text: 'b'.repeat(65) },
      { kind: 'pause' as const, seconds: 1 },
    ]
    expect(estimate(segments)).toEqual({
      chars: 130,
      speechSeconds: 10,
      pauseSeconds: 40,
      totalSeconds: 50,
      silenceShare: 0.8,
    })
  })

  it('zählt die Zeichen der Sprechabschnitte, nicht die der Pausen', () => {
    const e = estimate([{ kind: 'speech', text: 'Atme ein … und aus.' }])
    expect(e.chars).toBe(19)
    expect(e.speechSeconds).toBeCloseTo(19 / 13, 10)
    expect(e.pauseSeconds).toBe(19)
    expect(e.totalSeconds).toBeCloseTo(19 / 13 + 19, 10)
    expect(e.silenceShare).toBeCloseTo(19 / (19 / 13 + 19), 10)
  })

  it('nennt 40 % als Untergrenze für den Stilleanteil', () => {
    expect(MIN_SILENCE_SHARE).toBe(0.4)
  })
})

describe('die neun Meditationstexte', () => {
  const dir = fileURLToPath(new URL('../../content/meditations/', import.meta.url))
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
  const parsed = files.map((file) => ({ file, ...parseMeditation(readFileSync(dir + file, 'utf8')) }))

  it('entsprechen dem Katalog (Dateiname = id) und haben die Reihenfolge aus Spec 3.2 festgelegt', () => {
    expect(CATALOG_ORDER).toHaveLength(9)
    expect(parsed.map((p) => p.meta.id).sort()).toEqual([...CATALOG_ORDER].sort())
    for (const p of parsed) expect(p.file).toBe(`${p.meta.id}.md`)
  })

  it.each(files)('%s hat mindestens 40 % Stille', (file) => {
    const p = parsed.find((x) => x.file === file)!
    expect(estimate(p.segments).silenceShare).toBeGreaterThanOrEqual(MIN_SILENCE_SHARE)
  })
})

describe('planTimeline', () => {
  const segments = [
    { kind: 'speech' as const, text: 'Eins.' },
    { kind: 'pause' as const, seconds: 3 },
    { kind: 'speech' as const, text: 'Zwei.' },
    { kind: 'pause' as const, seconds: 2.5 },
    { kind: 'speech' as const, text: 'Drei.' },
  ]

  it('beginnt nach BOWL_LEAD, setzt die Pausen dazwischen und die End-Schale 3 s nach dem letzten Wort', () => {
    const tl = planTimeline(segments, [10, 20.25, 5], 12)
    expect(tl.placements).toEqual([
      { start: 4, duration: 10 },
      { start: 17, duration: 20.25 },
      { start: 39.75, duration: 5 },
    ])
    expect(tl.endBowlStart).toBe(47.75)
    expect(tl.totalSeconds).toBe(59.75)
  })

  it('stimmt bei 12 s Schale mit der Schätzung (BOWL_LEAD + Sprache + Pausen + BOWL_TAIL) überein', () => {
    const durations = [10, 20, 5]
    const tl = planTimeline(segments, durations, 12)
    expect(tl.totalSeconds).toBe(BOWL_LEAD + 35 + 5.5 + BOWL_TAIL)
  })

  it('wirft, wenn die Zahl der Dauern nicht zu den Sprechabschnitten passt', () => {
    expect(() => planTimeline(segments, [1, 2], 12)).toThrow(/3 Sprechabschnitte.*2 Längen/)
  })
})

describe('buildAssembleArgs', () => {
  const segments = [
    { kind: 'speech' as const, text: 'Eins.' },
    { kind: 'pause' as const, seconds: 3 },
    { kind: 'speech' as const, text: 'Zwei.' },
  ]
  const timeline = planTimeline(segments, [10.5, 4.0004], 11.993)
  const args = buildAssembleArgs({
    bowlFile: '/b/klangschale.ogg',
    sectionFiles: ['/c/aaa.mp3', '/c/bbb.mp3'],
    timeline,
    outFile: '/o/out.mp3.part',
  })
  const graph = args[args.indexOf('-filter_complex') + 1]

  it('übergibt nur Strings als Argumente (kein Shell-String)', () => {
    expect(args.every((a: unknown) => typeof a === 'string')).toBe(true)
  })

  it('öffnet die Schale zweimal und danach die Abschnitte in Reihenfolge', () => {
    const inputs = args.flatMap((a: string, i: number) => (args[i - 1] === '-i' ? [a] : []))
    expect(inputs).toEqual(['/b/klangschale.ogg', '/b/klangschale.ogg', '/c/aaa.mp3', '/c/bbb.mp3'])
  })

  it('verzögert jeden Abschnitt auf seinen Startpunkt in Millisekunden', () => {
    // Abschnitt 1 bei 4 s, Abschnitt 2 bei 4 + 10,5 + 3 = 17,5 s, End-Schale 3 s nach 21,5004 s
    expect(graph).toContain('[2:a]aformat=sample_rates=44100:channel_layouts=mono,adelay=4000:all=1[s0]')
    expect(graph).toContain('[3:a]aformat=sample_rates=44100:channel_layouts=mono,adelay=17500:all=1[s1]')
    expect(graph).toContain('adelay=24500:all=1[bowl1]')
  })

  it('lässt die erste Schale bei 0 starten, mit dem Schalenpegel', () => {
    expect(graph).toContain(`[0:a]aformat=sample_rates=44100:channel_layouts=mono,volume=${BOWL_GAIN}[bowl0]`)
  })

  it('mischt ohne Pegelskalierung, normalisiert die Lautheit und gibt mono 44,1 kHz aus', () => {
    expect(graph).toContain('[bowl0][s0][s1][bowl1]amix=inputs=4:duration=longest:normalize=0,loudnorm=I=-19:TP=-1.5,aresample=44100[out]')
  })

  it('schneidet auf die Gesamtlänge und kodiert MP3 mono 64 kbit/s', () => {
    const next = (flag: string) => args[args.indexOf(flag) + 1]
    // 24,5004 s (Start der End-Schale) + 11,993 s Schale
    expect(next('-t')).toBe('36.493')
    expect(next('-ac')).toBe('1')
    expect(next('-c:a')).toBe('libmp3lame')
    expect(next('-b:a')).toBe('64k')
    expect(next('-map')).toBe('[out]')
    expect(args.at(-1)).toBe('/o/out.mp3.part')
  })

  it('verlangt zu jedem Zeitpunkt eine Datei', () => {
    expect(() => buildAssembleArgs({ bowlFile: 'b', sectionFiles: ['a'], timeline, outFile: 'o' })).toThrow(/Abschnitt/)
  })

  it('wendet mit Messwerten aus dem ersten Durchgang linear normalisiert an', () => {
    const measured = { input_i: '-28.41', input_tp: '-2.86', input_lra: '8.00', input_thresh: '-39.15', target_offset: '0.60' }
    const second = buildAssembleArgs({
      bowlFile: '/b/klangschale.ogg',
      sectionFiles: ['/c/aaa.mp3', '/c/bbb.mp3'],
      timeline,
      outFile: '/o/out.mp3.part',
      measured,
    })
    const secondGraph = second[second.indexOf('-filter_complex') + 1]
    expect(secondGraph).toContain(
      'loudnorm=I=-19:TP=-1.5:measured_I=-28.41:measured_TP=-2.86:measured_LRA=8.00:measured_thresh=-39.15:offset=0.60:linear=true,aresample=44100[out]',
    )
    // sonst identisch: gleiche Zeiten, gleiche Kodierung
    expect(secondGraph.replace(/loudnorm=[^,]*,/, 'loudnorm,')).toBe(graph.replace(/loudnorm=[^,]*,/, 'loudnorm,'))
  })
})

describe('buildMeasureArgs', () => {
  const segments = [
    { kind: 'speech' as const, text: 'Eins.' },
    { kind: 'pause' as const, seconds: 3 },
    { kind: 'speech' as const, text: 'Zwei.' },
  ]
  const timeline = planTimeline(segments, [10.5, 4], 12)
  const options = { bowlFile: '/b/k.ogg', sectionFiles: ['/c/a.mp3', '/c/b.mp3'], timeline }
  const measure = buildMeasureArgs(options)
  const encode = buildAssembleArgs({ ...options, outFile: '/o/x' })
  const graphOf = (a: string[]) => a[a.indexOf('-filter_complex') + 1]

  it('misst denselben Zusammenbau mit loudnorm im JSON-Modus, ohne Datei zu schreiben', () => {
    expect(graphOf(measure)).toContain('loudnorm=I=-19:TP=-1.5:print_format=json')
    expect(graphOf(measure).replace(':print_format=json', '')).toBe(graphOf(encode))
    expect(measure[measure.indexOf('-loglevel') + 1]).toBe('info')
    expect(measure.slice(-3)).toEqual(['-f', 'null', '-'])
    expect(measure.every((a: unknown) => typeof a === 'string')).toBe(true)
  })
})

describe('parseLoudness', () => {
  const log = `[Parsed_loudnorm_9 @ 0x55d0c8a3c0c0]
{
\t"input_i" : "-28.41",
\t"input_tp" : "-2.86",
\t"input_lra" : "8.00",
\t"input_thresh" : "-39.15",
\t"output_i" : "-19.60",
\t"output_tp" : "-1.50",
\t"output_lra" : "7.90",
\t"output_thresh" : "-29.80",
\t"normalization_type" : "dynamic",
\t"target_offset" : "0.60"
}
[out#0/null @ 0x55d0c8a1f040] video:0kB audio:2410kB`

  it('liest die Messwerte aus dem Log von ffmpeg', () => {
    expect(parseLoudness(log)).toEqual({
      input_i: '-28.41',
      input_tp: '-2.86',
      input_lra: '8.00',
      input_thresh: '-39.15',
      target_offset: '0.60',
    })
  })

  it('wirft, wenn keine Messung im Log steht oder das Signal still war', () => {
    expect(() => parseLoudness('nichts Brauchbares')).toThrow(/Lautheit/)
    expect(() => parseLoudness(log.replace('"-28.41"', '"-inf"'))).toThrow(/Lautheit/)
  })
})

describe('buildPlaceholderArgs', () => {
  const args = buildPlaceholderArgs({ seconds: 180, outFile: '/o/p.mp3' })
  const next = (flag: string) => args[args.indexOf(flag) + 1]

  it('erzeugt den 432-Hz-Ton alle 30 s mit 2 s Abklingen, leise, in der Ziel-Länge', () => {
    const source = next('-i')
    expect(source).toMatch(/^aevalsrc=/)
    expect(source).toContain('432')
    expect(source).toContain('mod(t,30)')
    expect(source).toContain('lt(mod(t,30),2)')
    expect(source).toContain('d=180')
    expect(source).toContain('s=22050')
    // Spitze 0,1 = -20 dBFS
    expect(source).toMatch(/'0\.1\*sin/)
  })

  it('kodiert MP3 mono 16 kbit/s mit 22,05 kHz', () => {
    expect(next('-ac')).toBe('1')
    expect(next('-ar')).toBe('22050')
    expect(next('-c:a')).toBe('libmp3lame')
    expect(next('-b:a')).toBe('16k')
    expect(args.at(-1)).toBe('/o/p.mp3')
    expect(args.every((a: unknown) => typeof a === 'string')).toBe(true)
  })
})
