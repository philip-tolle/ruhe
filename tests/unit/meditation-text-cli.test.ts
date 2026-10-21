// Rauchtests für scripts/meditations.mjs: Das Skript läuft als eigener Prozess,
// alle Pfade zeigen in ein Wegwerf-Verzeichnis. Echte Dateien unter public/ und audio-work/ bleiben unberührt.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { parseMeditation, speechHash, splitSections } from '../../scripts/lib/meditation-text.mjs'

const SCRIPT = fileURLToPath(new URL('../../scripts/meditations.mjs', import.meta.url))
const BOWL = fileURLToPath(new URL('../../public/audio/sounds/klangschale.ogg', import.meta.url))
// ffmpeg-Läufe brauchen auf einem ausgelasteten Rechner länger als die 5 s Standard-Zeitlimit.
vi.setConfig({ testTimeout: 60_000 })

let root: string
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ruhe-meditations-'))
})
afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

/** Frisches Arbeitsverzeichnis mit content/, work/ und audio/. */
function workspace(name: string) {
  const dir = join(root, name)
  const ws = {
    dir,
    content: join(dir, 'content'),
    work: join(dir, 'work'),
    audio: join(dir, 'audio'),
    manifest: join(dir, 'manifest.json'),
    cache: join(dir, 'work', 'cache'),
  }
  for (const d of [ws.content, ws.work, ws.audio, ws.cache]) mkdirSync(d, { recursive: true })
  return ws
}
type Workspace = ReturnType<typeof workspace>

const base = (ws: Workspace) => ['--content', ws.content, '--work', ws.work, '--audio', ws.audio, '--manifest', ws.manifest]
const cli = (ws: Workspace, args: string[]) => {
  const result = spawnSync(process.execPath, [SCRIPT, ...args, ...base(ws)], { encoding: 'utf8' })
  return { status: result.status, out: result.stdout, err: result.stderr }
}

const text = (id: string, body: string, minutes = 1, category = 'achtsamkeit') =>
  `---\nid: ${id}\ntitle: Titel ${id}\ncategory: ${category}\nminutes: ${minutes}\ndescription: Beschreibung ${id}.\n---\n\n${body}\n`
const put = (ws: Workspace, id: string, body: string, minutes = 1) =>
  writeFileSync(join(ws.content, `${id}.md`), text(id, body, minutes))

const probe = (file: string, entries: string) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'json', file], { encoding: 'utf8' })
const duration = (file: string): number => Number(JSON.parse(probe(file, 'format=duration')).format.duration)
const streamOf = (file: string) => JSON.parse(probe(file, 'stream=codec_name,channels,sample_rate,bit_rate')).streams[0]

/** Integrierte Lautheit (LUFS) und True Peak (dBFS) einer Datei, gemessen mit ebur128. */
function loudness(file: string) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' })
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]) }
}

const sine = (file: string, seconds: number) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=330:duration=${seconds}`, '-ac', '1', '-ar', '24000', '-b:a', '32k', file])

const voice = { id: 'voice-test', model: 'eleven_multilingual_v2', settings: { stability: 0.5 } }
const voiceFile = (ws: Workspace) => join(ws.work, 'voice.json')

describe('estimate', () => {
  it('druckt die Tabelle und beendet sich mit 0, wenn genug Stille da ist', () => {
    const ws = workspace('estimate-ok')
    put(ws, 'probe-eins', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
    const r = cli(ws, ['estimate'])
    expect(r.status).toBe(0)
    expect(r.out).toContain('probe-eins')
    expect(r.out).toContain('Stille')
    expect(r.out).toMatch(/18\s/) // Zeichen
  })

  it('beendet sich mit 1, wenn eine Meditation unter 40 % Stille liegt', () => {
    const ws = workspace('estimate-low')
    put(ws, 'viel-text', 'Das ist ein sehr langer Satz, der fast nur aus Sprache besteht und nirgends Luft lässt. '.repeat(10))
    const r = cli(ws, ['estimate'])
    expect(r.status).toBe(1)
    expect(r.out + r.err).toMatch(/40 %/)
    expect(r.out + r.err).toContain('viel-text')
  })

  it('nimmt eine einzelne id und lehnt unbekannte ab', () => {
    const ws = workspace('estimate-id')
    put(ws, 'probe-eins', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
    put(ws, 'probe-zwei', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
    const one = cli(ws, ['estimate', 'probe-zwei'])
    expect(one.status).toBe(0)
    expect(one.out).toContain('probe-zwei')
    expect(one.out).not.toContain('probe-eins')
    const unknown = cli(ws, ['estimate', 'gibt-es-nicht'])
    expect(unknown.status).toBe(1)
    expect(unknown.err).toContain('Unbekannte Meditation')
  })

  it('meldet Dateiname und Zeile eines Textfehlers', () => {
    const ws = workspace('estimate-error')
    put(ws, 'kaputt', 'Eins.\n\n[Pause 8]\n\nZwei.')
    const r = cli(ws, ['estimate'])
    expect(r.status).toBe(1)
    expect(r.err).toContain('kaputt.md')
    expect(r.err).toMatch(/Zeile 11:/)
  })

  it('verlangt, dass der Dateiname zur id passt', () => {
    const ws = workspace('estimate-name')
    writeFileSync(join(ws.content, 'falscher-name.md'), text('richtige-id', 'Text.'))
    const r = cli(ws, ['estimate'])
    expect(r.status).toBe(1)
    expect(r.err).toContain('falscher-name.md')
  })
})

describe('split', () => {
  it('verlangt zuerst die Stimme', () => {
    const ws = workspace('split-novoice')
    put(ws, 'probe-eins', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
    const r = cli(ws, ['split'])
    expect(r.status).toBe(1)
    expect(r.err).toContain('Erst die Stimme festlegen (audio-work/voice.json).')
    expect(existsSync(join(ws.work, 'sections'))).toBe(false)
  })

  it('schreibt Hash, Text und Nachbartexte je Sprechabschnitt', () => {
    const ws = workspace('split-ok')
    const body = 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.'
    put(ws, 'probe-eins', body)
    writeFileSync(voiceFile(ws), JSON.stringify(voice))
    const r = cli(ws, ['split'])
    expect(r.status).toBe(0)
    const sections = JSON.parse(readFileSync(join(ws.work, 'sections', 'probe-eins.json'), 'utf8'))
    expect(sections).toEqual(splitSections(parseMeditation(text('probe-eins', body)).segments, voice))
    expect(sections).toEqual([
      { hash: speechHash('Atme ein.', voice), text: 'Atme ein.', previousText: null, nextText: 'Atme aus.' },
      { hash: speechHash('Atme aus.', voice), text: 'Atme aus.', previousText: 'Atme ein.', nextText: null },
    ])
  })

  it('zählt, wie viele Abschnitte schon im Cache liegen', () => {
    const ws = workspace('split-cache')
    put(ws, 'probe-eins', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
    writeFileSync(voiceFile(ws), JSON.stringify(voice))
    writeFileSync(join(ws.cache, `${speechHash('Atme ein.', voice)}.mp3`), 'x')
    const r = cli(ws, ['split', 'probe-eins'])
    expect(r.status).toBe(0)
    expect(r.out).toMatch(/1 von 2 .*Cache/)
  })

  it('lehnt eine ungültige voice.json ab', () => {
    const ws = workspace('split-badvoice')
    put(ws, 'probe-eins', 'Atme ein.')
    writeFileSync(voiceFile(ws), JSON.stringify({ id: 'x' }))
    const r = cli(ws, ['split'])
    expect(r.status).toBe(1)
    expect(r.err).toContain('voice.json')
  })
})

describe('placeholders und manifest', () => {
  it(
    'erzeugt kleine mono-Platzhalter in Ziel-Länge, lässt echte Dateien stehen und schreibt das Manifest in Katalog-Reihenfolge',
    () => {
      const ws = workspace('placeholders')
      put(ws, 'bodyscan-im-sitzen', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.') // im Katalog nach gedanken-wie-wolken
      put(ws, 'gedanken-wie-wolken', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.')
      put(ws, 'zzz-echt', 'Atme ein.\n\n[Pause 30s]\n\nAtme aus.', 3) // nicht im Katalog, schon echt vertont
      const real = join(ws.audio, 'zzz-echt.mp3')
      sine(real, 2)
      const realBytes = readFileSync(real)

      const made = cli(ws, ['placeholders'])
      expect(made.status).toBe(0)
      expect(readFileSync(real).equals(realBytes)).toBe(true)
      expect(JSON.parse(readFileSync(join(ws.work, 'placeholders.json'), 'utf8'))).toEqual([
        'bodyscan-im-sitzen',
        'gedanken-wie-wolken',
      ])

      const file = join(ws.audio, 'gedanken-wie-wolken.mp3')
      expect(streamOf(file)).toMatchObject({ codec_name: 'mp3', channels: 1, sample_rate: '22050', bit_rate: '16000' })
      expect(Math.abs(duration(file) - 60)).toBeLessThan(0.2)
      expect(statSync(file).size).toBeLessThan(130_000)

      // zweiter Lauf ändert nichts (gleiche Bytes, gleiche Liste)
      const again = readFileSync(file)
      expect(cli(ws, ['placeholders']).status).toBe(0)
      expect(readFileSync(file).equals(again)).toBe(true)

      const m = cli(ws, ['manifest'])
      expect(m.status).toBe(0)
      const { meditations } = JSON.parse(readFileSync(ws.manifest, 'utf8'))
      expect(meditations.map((x: { id: string }) => x.id)).toEqual(['gedanken-wie-wolken', 'bodyscan-im-sitzen', 'zzz-echt'])
      const [first, , third] = meditations
      expect(Object.keys(first)).toEqual(['id', 'title', 'category', 'description', 'minutes', 'file', 'duration', 'bytes', 'placeholder'])
      expect(first).toMatchObject({
        id: 'gedanken-wie-wolken',
        title: 'Titel gedanken-wie-wolken',
        category: 'achtsamkeit',
        description: 'Beschreibung gedanken-wie-wolken.',
        minutes: 1,
        file: 'audio/meditations/gedanken-wie-wolken.mp3',
        bytes: statSync(file).size,
        placeholder: true,
      })
      expect(first.duration).toBe(Math.round(duration(file) * 10) / 10)
      expect(third).toMatchObject({ minutes: 3, bytes: realBytes.length, placeholder: false })
      expect(third.duration).toBeCloseTo(2, 0)
    },
  )

  it('weist das Manifest ab, wenn eine Audiodatei fehlt', () => {
    const ws = workspace('manifest-missing')
    put(ws, 'probe-eins', 'Atme ein.')
    const r = cli(ws, ['manifest'])
    expect(r.status).toBe(1)
    expect(r.err).toContain('probe-eins')
    expect(existsSync(ws.manifest)).toBe(false)
  })
})

describe('assemble', () => {
  const body = 'Erster Satz.\n\n[Pause 2s]\n\nZweiter Satz.'
  const hashes = () => splitSections(parseMeditation(text('probe-assemble', body)).segments, voice).map((s: { hash: string }) => s.hash)

  function prepared(name: string) {
    const ws = workspace(name)
    put(ws, 'probe-assemble', body)
    writeFileSync(voiceFile(ws), JSON.stringify(voice))
    writeFileSync(join(ws.work, 'placeholders.json'), JSON.stringify(['anderer-platzhalter', 'probe-assemble']))
    const [a, b] = hashes()
    sine(join(ws.cache, `${a}.mp3`), 1.5)
    sine(join(ws.cache, `${b}.mp3`), 2)
    return { ws, a, b }
  }
  const placeholderList = (ws: Workspace) => JSON.parse(readFileSync(join(ws.work, 'placeholders.json'), 'utf8'))

  it(
    'setzt Schale, Abschnitte, Pausen und End-Schale zu einer MP3 mono 64 kbit/s zusammen (--out: Platzhalterliste bleibt)',
    () => {
      const { ws, a, b } = prepared('assemble-out')
      const out = join(ws.dir, 'out', 'probe.mp3')
      const r = cli(ws, ['assemble', 'probe-assemble', '--out', out])
      expect(r.err).toBe('')
      expect(r.status).toBe(0)

      // 4 s bis zum ersten Wort + Abschnitt 1 + 2 s Pause + Abschnitt 2 + 3 s Stille + End-Schale
      const expected = 4 + duration(join(ws.cache, `${a}.mp3`)) + 2 + duration(join(ws.cache, `${b}.mp3`)) + 3 + duration(BOWL)
      expect(Math.abs(duration(out) - expected)).toBeLessThan(0.15)
      expect(streamOf(out)).toMatchObject({ codec_name: 'mp3', channels: 1, bit_rate: '64000' })
      expect(existsSync(`${out}.part`)).toBe(false)
      const { lufs, peak } = loudness(out)
      expect(lufs).toBeGreaterThan(-20.5)
      expect(lufs).toBeLessThan(-17.5)
      expect(peak).toBeLessThanOrEqual(-1)
      expect(existsSync(join(ws.audio, 'probe-assemble.mp3'))).toBe(false)
      expect(placeholderList(ws)).toEqual(['anderer-platzhalter', 'probe-assemble'])
    },
  )

  it(
    'schreibt ohne --out nach <audio>/<id>.mp3 und nimmt die id aus placeholders.json',
    () => {
      const { ws } = prepared('assemble-default')
      const r = cli(ws, ['assemble', 'probe-assemble'])
      expect(r.status).toBe(0)
      expect(existsSync(join(ws.audio, 'probe-assemble.mp3'))).toBe(true)
      expect(placeholderList(ws)).toEqual(['anderer-platzhalter'])
    },
  )

  it('nennt fehlende Abschnitte mit Hash und Textanfang und schreibt nichts', () => {
    const { ws, b } = prepared('assemble-missing')
    rmSync(join(ws.cache, `${b}.mp3`))
    const out = join(ws.dir, 'out.mp3')
    const r = cli(ws, ['assemble', 'probe-assemble', '--out', out])
    expect(r.status).toBe(1)
    expect(r.err).toContain(b)
    expect(r.err).toContain('Zweiter Satz.')
    expect(existsSync(out)).toBe(false)
    expect(placeholderList(ws)).toEqual(['anderer-platzhalter', 'probe-assemble'])
  })

  it('liest den Cache aus --cache', () => {
    const { ws } = prepared('assemble-cacheopt')
    const elsewhere = join(ws.dir, 'anderer-cache')
    mkdirSync(elsewhere)
    const out = join(ws.dir, 'out.mp3')
    // Standard-Cache ist voll, der angegebene leer: muss fehlschlagen
    const r = cli(ws, ['assemble', 'probe-assemble', '--out', out, '--cache', elsewhere])
    expect(r.status).toBe(1)
    expect(r.err).toContain('Cache')
  })

  it('verlangt eine id und kennt nur bekannte Befehle', () => {
    const ws = workspace('assemble-usage')
    put(ws, 'probe-assemble', body)
    expect(cli(ws, ['assemble']).status).toBe(1)
    const unknown = cli(ws, ['gibtsnicht'])
    expect(unknown.status).toBe(1)
    expect(unknown.err).toMatch(/Befehl/)
  })
})
