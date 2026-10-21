import { readFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'

// Sitzungen und Zeiten tragen ihren Offset und der Browser läuft in Berlin; so hängt kein Test
// von der Zeitzone des Rechners ab. „Heute“ ist der 21.10.2026, 20 Uhr.
test.use({ timezoneId: 'Europe/Berlin' })
const NOW = new Date('2026-10-21T20:00:00+02:00')

const session = (id: string, start: string, kind: 'timer' | 'breath', ref: string, seconds: number) => ({
  id,
  start,
  kind,
  ref,
  seconds,
})
const SESSIONS = [
  session('s-19', '2026-10-19T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-20', '2026-10-20T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-21', '2026-10-21T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-sep', '2026-09-03T21:00:00+02:00', 'breath', '478', 76),
]
const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }
const backupOf = (sessions: object[], settings: object = SETTINGS) => ({ version: 1, sessions, settings })

// addInitScript läuft bei jeder Navigation (auch Neuladen); ein Merker in sessionStorage lässt es nur
// einmal je Test säen, damit Änderungen im Test ein Neuladen überstehen.
async function open(page: Page, data: object | null = backupOf(SESSIONS)) {
  await page.clock.setFixedTime(NOW)
  if (data) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify(data))
  }
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Ich' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ich')
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const storedText = (page: Page) => page.evaluate(() => localStorage.getItem('ruhe.v1'))

// Eine Kennzahl: Beschriftung (dt) und Wert (dd) in einer Kachel.
const figure = (page: Page, label: string) => page.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) })
const value = (page: Page, label: string) => figure(page, label).locator('dd')

const marked = (page: Page, label: string) => page.getByLabel(`${label}, meditiert`, { exact: true })
const monthHeading = (page: Page, title: string) => page.getByRole('heading', { level: 2, name: title })

async function chooseFile(page: Page, file: { name: string; content: string }) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Backup importieren' }).click(),
  ])
  await chooser.setFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.content) })
}

const heightOf = async (locator: Locator) => (await locator.boundingBox())!.height

test('key figures: streak, minutes and sessions', async ({ page }) => {
  await open(page)
  await expect(figure(page, 'Serie')).toHaveCount(1)
  await expect(value(page, 'Serie')).toHaveText('3 Tage')
  await expect(value(page, 'Minuten gesamt')).toHaveText('31') // 1876 s
  await expect(value(page, 'Sitzungen')).toHaveText('4')
})

test('a fresh start shows zeros and no marks', async ({ page }) => {
  await open(page, null)
  await expect(value(page, 'Serie')).toHaveText('0 Tage')
  await expect(value(page, 'Minuten gesamt')).toHaveText('0')
  await expect(value(page, 'Sitzungen')).toHaveText('0')
  await expect(page.getByLabel(', meditiert')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a streak of one day reads in the singular', async ({ page }) => {
  await open(page, backupOf([session('only', '2026-10-21T07:30:00+02:00', 'timer', 'timer', 60)]))
  await expect(value(page, 'Serie')).toHaveText('1 Tag')
  await expect(value(page, 'Minuten gesamt')).toHaveText('1')
  await expect(value(page, 'Sitzungen')).toHaveText('1')
})

test('calendar marks meditated days and pages through the months', async ({ page }) => {
  await open(page)
  await expect(monthHeading(page, 'Oktober 2026')).toBeVisible()
  for (const day of ['19', '20', '21']) await expect(marked(page, `${day}. Oktober`)).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(3)
  await expect(marked(page, '18. Oktober')).toHaveCount(0)

  // Wochenbeginn Montag: Der 1. Oktober 2026 ist ein Donnerstag, also die vierte Spalte der ersten Woche.
  await expect(page.getByRole('columnheader')).toHaveText(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  const firstWeek = page.getByRole('row').nth(1).getByRole('cell')
  await expect(firstWeek).toHaveCount(7)
  await expect(firstWeek.nth(3)).toHaveText('1')
  await expect(firstWeek.nth(2)).toHaveText('')
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1) // heute: der 21.

  await page.getByRole('button', { name: 'Vorheriger Monat' }).click()
  await expect(monthHeading(page, 'September 2026')).toBeVisible()
  await expect(marked(page, '3. September')).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(1)
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(monthHeading(page, 'Oktober 2026')).toBeVisible()
  await expect(marked(page, '21. Oktober')).toBeVisible()
})

test('calendar pages across the year boundary in both directions', async ({ page }) => {
  await open(page)
  const next = page.getByRole('button', { name: 'Nächster Monat' })
  const previous = page.getByRole('button', { name: 'Vorheriger Monat' })
  await next.click()
  await expect(monthHeading(page, 'November 2026')).toBeVisible()
  await next.click()
  await expect(monthHeading(page, 'Dezember 2026')).toBeVisible()
  await next.click()
  await expect(monthHeading(page, 'Januar 2027')).toBeVisible()
  await previous.click()
  await expect(monthHeading(page, 'Dezember 2026')).toBeVisible()
  for (let i = 0; i < 11; i++) await previous.click()
  await expect(monthHeading(page, 'Januar 2026')).toBeVisible()
  await previous.click()
  await expect(monthHeading(page, 'Dezember 2025')).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(0)
})

test('paging the calendar keeps the scroll position and the focus on the button', async ({ page }) => {
  // Ohne Einblend-Animation: Playwright rückt ein Ziel, das sich noch bewegt, selbst zurecht.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  const next = page.getByRole('button', { name: 'Nächster Monat' })
  const previous = page.getByRole('button', { name: 'Vorheriger Monat' })
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY))
  await page.evaluate(() => window.scrollBy(0, 120))
  const before = await scrollY()
  expect(before).toBeGreaterThan(0)
  // Von Oktober 2026 bis April 2027 und zurück bis August 2026: Monate mit vier (Februar 2027),
  // fünf und sechs Wochen (November und August 2026). Die Seitenhöhe darf sich dabei nicht ändern,
  // sonst rutschen Einstellungen und Backup unter dem Finger weg.
  const heights = new Set<number>([Math.round(await heightOf(page.locator('main')))])
  for (let i = 0; i < 6; i++) {
    await next.click()
    heights.add(Math.round(await heightOf(page.locator('main'))))
  }
  await expect(monthHeading(page, 'April 2027')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await previous.click()
    heights.add(Math.round(await heightOf(page.locator('main'))))
  }
  await expect(monthHeading(page, 'August 2026')).toBeVisible()
  expect(await scrollY()).toBe(before)
  expect([...heights]).toHaveLength(1)
  await expect(previous).toBeFocused()
})

test('settings are saved at once and shared with the timer sheet', async ({ page }) => {
  await open(page)
  const vibration = page.getByRole('switch', { name: 'Vibration bei Atemübungen' })
  const lead = page.getByRole('switch', { name: '10 Sekunden ankommen' })
  const sound = page.getByRole('combobox', { name: 'Standard-Hintergrundklang' })
  await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeVisible()
  await expect(vibration).toHaveAttribute('aria-checked', 'true')
  await expect(lead).toHaveAttribute('aria-checked', 'true')
  await expect(sound.locator('option:checked')).toHaveText('Keiner')
  await expect(sound.getByRole('option')).toHaveText([
    'Keiner',
    'Regen',
    'Meeresrauschen',
    'Wind',
    'Braunes Rauschen',
    'Wald mit Vögeln',
    'Kaminfeuer',
    'Bach',
    'Klangschalen',
  ])

  await vibration.click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false')
  expect((await stored(page)).settings.vibration).toBe(false)
  await lead.click()
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  expect((await stored(page)).settings.timerLead).toBe(false)
  await sound.selectOption({ label: 'Regen' })
  expect((await stored(page)).settings.timerSound).toBe('regen')
  expect((await stored(page)).sessions).toHaveLength(4)

  // Derselbe Wert wie im Timer-Sheet unter „Meditieren“.
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Meditieren' }).click()
  await expect(page.getByText('10 Min · ohne Zwischenschale · Regen')).toBeVisible()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await expect(page.getByLabel('Hintergrundklang', { exact: true })).toHaveValue('regen')
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  await page.goBack()

  // Und zurück: „Keiner“ speichert null; nach dem Neuladen bleibt alles.
  await nav.getByRole('button', { name: 'Ich' }).click()
  await sound.selectOption({ label: 'Keiner' })
  expect((await stored(page)).settings.timerSound).toBeNull()
  await page.reload()
  await nav.getByRole('button', { name: 'Ich' }).click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false')
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  await expect(sound.locator('option:checked')).toHaveText('Keiner')
})

test('touch targets are at least 48px', async ({ page }) => {
  await open(page)
  const targets = [
    page.getByRole('button', { name: 'Vorheriger Monat' }),
    page.getByRole('button', { name: 'Nächster Monat' }),
    page.getByRole('switch', { name: 'Vibration bei Atemübungen' }),
    page.getByRole('switch', { name: '10 Sekunden ankommen' }),
    page.getByRole('combobox', { name: 'Standard-Hintergrundklang' }),
    page.getByRole('button', { name: 'Backup exportieren' }),
    page.getByRole('button', { name: 'Backup importieren' }),
  ]
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded()
    const box = (await target.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.width).toBeGreaterThanOrEqual(48)
  }
})

test('export downloads the sessions and settings under the day of today', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Backup' })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Backup exportieren' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('ruhe-backup-2026-10-21.json')
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file).toEqual(backupOf(SESSIONS))
})

test('import merges new sessions, skips known ones and takes over the settings', async ({ page }) => {
  await open(page)
  // Der Hinweis sagt vorher, dass die Einstellungen aus der Datei kommen.
  await expect(
    page.getByText(
      'Sichere deine Sitzungen und Einstellungen in einer Datei. Beim Importieren kommen neue Sitzungen dazu, die Einstellungen werden aus der Datei übernommen.',
    ),
  ).toBeVisible()
  const status = page.getByRole('status')
  await expect(status).toHaveText('')
  const incoming = backupOf(
    [SESSIONS[0], session('s-new', '2026-09-04T08:00:00+02:00', 'timer', 'timer', 120)],
    { ...SETTINGS, vibration: false, timerLead: false, timerSound: 'wald' },
  )
  await chooseFile(page, { name: 'ruhe-backup.json', content: JSON.stringify(incoming) })
  await expect(status).toHaveText('1 neue Sitzung importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')
  await expect(value(page, 'Minuten gesamt')).toHaveText('33') // 1996 s
  await expect(value(page, 'Serie')).toHaveText('3 Tage')

  // Einstellungen stammen aus der Datei, auf dem Bildschirm und im Speicher.
  await expect(page.getByRole('switch', { name: 'Vibration bei Atemübungen' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('combobox', { name: 'Standard-Hintergrundklang' })).toHaveValue('wald')
  const data = await stored(page)
  expect(data.settings).toMatchObject({ vibration: false, timerLead: false, timerSound: 'wald' })
  expect(data.sessions).toHaveLength(5)
  expect(data.sessions.map((s: { id: string }) => s.id)).toEqual(['s-sep', 's-new', 's-19', 's-20', 's-21'])

  // Das Eingabefeld ist wieder leer; dieselbe Datei lässt sich nochmals wählen und bringt nichts Neues.
  await expect(page.locator('input[type="file"]')).toHaveValue('')
  await chooseFile(page, { name: 'ruhe-backup.json', content: JSON.stringify(incoming) })
  await expect(status).toHaveText('0 neue Sitzungen importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')

  // Zwei neue Sitzungen stehen im Plural.
  const more = backupOf([
    session('s-a', '2026-08-01T08:00:00+02:00', 'timer', 'timer', 60),
    session('s-b', '2026-08-02T08:00:00+02:00', 'timer', 'timer', 60),
  ])
  await chooseFile(page, { name: 'mehr.json', content: JSON.stringify(more) })
  await expect(status).toHaveText('2 neue Sitzungen importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('7')
})

test('an invalid file explains itself and changes nothing', async ({ page }) => {
  await open(page)
  const status = page.getByRole('status')
  const before = await storedText(page)
  const invalid: [string, string][] = [
    ['kaputt.json', '{nope'],
    ['leer.json', ''],
    ['falsche-version.json', JSON.stringify({ version: 2, sessions: [], settings: {} })],
    ['kaputte-sitzung.json', JSON.stringify(backupOf([SESSIONS[0], { id: 'x', start: 'gestern', kind: 'timer', ref: 'timer', seconds: 60 }]))],
  ]
  for (const [name, content] of invalid) {
    await chooseFile(page, { name, content })
    await expect(status).toHaveText('Diese Datei ist kein gültiges Ruhe-Backup.')
    await expect(value(page, 'Sitzungen')).toHaveText('4')
    expect(await storedText(page)).toBe(before)
    await expect(page.getByRole('switch', { name: 'Vibration bei Atemübungen' })).toHaveAttribute('aria-checked', 'true')
  }

  // Danach klappt ein gültiges Backup wieder, und das Ergebnis ersetzt die Fehlermeldung.
  await chooseFile(page, { name: 'ok.json', content: JSON.stringify(backupOf([session('s-new', '2026-09-04T08:00:00+02:00', 'timer', 'timer', 60)])) })
  await expect(status).toHaveText('1 neue Sitzung importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')
})

test('a failing save is announced above the backup', async ({ page }) => {
  await open(page)
  // Ab jetzt schlägt jedes Speichern fehl (Speicher voll).
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('voll', 'QuotaExceededError')
    }
  })
  const hint = page.getByText(
    'Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.',
  )
  await expect(hint).toHaveCount(0)
  const vibration = page.getByRole('switch', { name: 'Vibration bei Atemübungen' })
  await vibration.click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false') // der Stand bleibt im Speicher
  await expect(hint).toBeVisible()
  // über dem Backup, nicht darunter
  const hintBox = (await hint.boundingBox())!
  const backupBox = (await page.getByRole('heading', { level: 2, name: 'Backup' }).boundingBox())!
  expect(hintBox.y).toBeLessThan(backupBox.y)
  // Der Export geht trotzdem.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Backup exportieren' }).click(),
  ])
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file.settings.vibration).toBe(false)
})

test('nothing moves under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.getByRole('switch', { name: '10 Sekunden ankommen' }).click()
  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
})
