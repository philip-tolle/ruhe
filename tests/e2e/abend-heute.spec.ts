import { test, expect, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { contrast, over, parseColor } from './color'
import { expectMotiv } from './motiv'
import { doubleTap, putOverWide } from './taps'

// Die Abend-Karten auf „Heute“ („Tag abschließen“ und „Dein Abend“, Spec M11 §2.1), der Wochenrückblick in „Deine Woche“
// (§2.2) und der Kasten im Morgen-Start (§2.4). Der Browser läuft in Berlin; die Uhr steht fest (`setFixedTime`), kein
// Programm läuft. Alle Werte sind ausgedachte Testdaten. Der 29.10.2026 ist ein Donnerstag, der 1.11.2026 ein Sonntag.
test.use({ timezoneId: 'Europe/Berlin' })

const at = (time: string, day = '2026-10-29') => new Date(`${day}T${time}+01:00`)
const DAY = '2026-10-29'

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

interface Seed {
  mornings?: object[]
  evenings?: object[]
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name, exact: true })
const card = (page: Page, name: string) => page.locator('.card').filter({ has: heading(page, name) })
const closeCard = (page: Page) => card(page, 'Tag abschließen')
const eveningCard = (page: Page) => card(page, 'Dein Abend')
const startButton = (page: Page) => closeCard(page).getByRole('button')
const flow = (page: Page) => page.getByRole('dialog', { name: 'Abend-Logbuch', exact: true })
const h2s = (page: Page) => page.locator('.screen').getByRole('heading', { level: 2 })

const MORNING = { day: DAY, at: '2026-10-29T06:30:00.000Z', variant: 'kurz', intention: 'klar', domino: 'Konzept skizzieren', dominoDone: '2026-10-29T11:00:00.000Z' }
const EVENING = { day: DAY, at: '2026-10-29T20:00:00.000Z', gave: ['Bewegung', 'Gute Gespräche'], cost: ['Bildschirm'], learned: 'Pausen machen mich schneller.', better: 'Handy aus bis 10 Uhr' }

async function seed(page: Page, { mornings, evenings }: Seed) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, ...(mornings ? { mornings } : {}), ...(evenings ? { evenings } : {}) }))
}

/** Öffnet „Heute“ zur festen Uhrzeit. */
async function open(page: Page, now: Date, seeded: Seed = {}) {
  await page.clock.setFixedTime(now)
  if (seeded.mornings || seeded.evenings) await seed(page, seeded)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function resume(page: Page, now: Date) {
  await page.clock.setFixedTime(now)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

async function expectNoSideways(page: Page, root: Locator) {
  const sticksOut = await root.evaluate((el) =>
    [el, ...el.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5)
    }).map((e) => `${e.tagName}.${e.className}`),
  )
  expect(sticksOut).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
}

// ── Karte „Tag abschließen“ ──────────────────────────────────────────────────────────────────────────────────────

test('without a logbook: no card at 17:59, "Tag abschließen" from 18:00 to 3:59, the morning card at 4:00', async ({ page }) => {
  await open(page, at('17:59:00'))
  await expect(closeCard(page)).toHaveCount(0)
  await resume(page, at('18:00:00'))
  await expect(closeCard(page)).toBeVisible({ timeout: 2000 })
  await expect(closeCard(page).getByText('Wie war dein Tag?', { exact: true })).toBeVisible()
  await expect(closeCard(page).getByText('Bilanz ziehen, Gelerntes festhalten, morgen 1 % besser.', { exact: true })).toBeVisible()
  await expect(startButton(page)).toHaveText(['Starten · 3 Min'])
  await expectMotiv(closeCard(page).locator('img'), 'vorschlag-abend', 80)
  await resume(page, at('00:30:00', '2026-10-30'))
  await expect(closeCard(page)).toBeVisible()
  await resume(page, at('04:00:00', '2026-10-30'))
  await expect(closeCard(page)).toHaveCount(0, { timeout: 2000 })
  await expect(heading(page, 'Morgen-Start')).toBeVisible()
})

test('order at 20:00 with a morning entry: greeting, "Tag abschließen", "Dein Tag", "Dein Akku"', async ({ page }) => {
  await open(page, at('20:00:00'), { mornings: [MORNING] })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Abend')
  await expect(h2s(page).nth(0)).toHaveText('Tag abschließen')
  await expect(h2s(page).nth(1)).toHaveText('Dein Tag')
  await expect(h2s(page).nth(2)).toHaveText('Dein Akku')
})

test('on a Sunday evening and on Monday at 0:30 the button offers the week review', async ({ page }) => {
  await open(page, at('21:00:00', '2026-11-01'))
  await expect(startButton(page)).toHaveText(['Mit Wochenrückblick · 5 Min'])
  await resume(page, at('00:30:00', '2026-11-02'))
  await expect(startButton(page)).toHaveText(['Mit Wochenrückblick · 5 Min'])
  await startButton(page).click()
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 6', exact: true })).toBeVisible()
})

// ── Karte „Dein Abend“ ───────────────────────────────────────────────────────────────────────────────────────────

test('with a logbook "Dein Abend" replaces both cards and shows every line, until 3:59', async ({ page }) => {
  await open(page, at('21:00:00'), { mornings: [MORNING], evenings: [EVENING] })
  const c = eveningCard(page)
  await expect(c).toBeVisible()
  await expect(closeCard(page)).toHaveCount(0)
  await expect(heading(page, 'Dein Tag')).toHaveCount(0)
  await expect(h2s(page).nth(0)).toHaveText('Dein Abend')
  await expect(c.getByText('Tag abgeschlossen', { exact: true })).toBeVisible()
  await expect(c).toContainText('Hat Energie gegeben')
  await expect(c.getByRole('listitem')).toHaveText(['Bewegung', 'Gute Gespräche', 'Bildschirm'])
  await expect(c).toContainText('Big Domino geschafft: Konzept skizzieren')
  await expect(c).toContainText('Gelernt: Pausen machen mich schneller.')
  await expect(c).toContainText('Morgen 1 % besser: Handy aus bis 10 Uhr')
  await expect(c.getByText('Logbuch an 1 der letzten 7 Tage', { exact: true })).toBeVisible()
  await expectMotiv(c.locator('img'), 'vorschlag-abend', 64)

  await resume(page, at('00:30:00', '2026-10-30'))
  await expect(eveningCard(page)).toBeVisible()
  await resume(page, at('04:00:00', '2026-10-30'))
  await expect(eveningCard(page)).toHaveCount(0, { timeout: 2000 })
})

test('a logbook without own lines but with an open domino shows "Big Domino offen" instead of "Logbuch erledigt."', async ({ page }) => {
  await open(page, at('21:00:00'), { mornings: [{ ...MORNING, dominoDone: undefined }], evenings: [{ day: DAY, at: '2026-10-29T20:00:00.000Z' }] })
  await expect(eveningCard(page)).toContainText('Big Domino offen: Konzept skizzieren')
  await expect(eveningCard(page)).not.toContainText('Logbuch erledigt.')
})

test('a logbook done at 14:00 from "Energie" shows "Dein Abend" on "Heute" right away', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [MORNING] })
  await expect(heading(page, 'Dein Tag')).toBeVisible()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await card(page, 'Tag abschließen').getByRole('button', { name: 'Starten', exact: true }).click()
  for (let i = 0; i < 8 && (await flow(page).getByRole('heading', { level: 2, name: 'Gute Nacht.', exact: true }).count()) === 0; i++) {
    await flow(page).getByRole('button', { name: 'Überspringen', exact: true }).click()
  }
  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await nav(page).getByRole('button', { name: 'Heute' }).click()
  await expect(eveningCard(page)).toBeVisible()
  await expect(eveningCard(page)).toContainText('Big Domino geschafft: Konzept skizzieren')
  await expect(heading(page, 'Dein Tag')).toHaveCount(0)
})

// ── Doppeltipp nach dem Schließen ────────────────────────────────────────────────────────────────────────────────

test('a double tap on "Beenden" does not reach "Starten · 3 Min" below, and the logbook stays closed', async ({ page }) => {
  await open(page, at('20:00:00'))
  await startButton(page).click()
  await expect(flow(page)).toBeVisible()
  await flow(page).getByRole('button', { name: 'Abend-Logbuch beenden', exact: true }).click()
  const ending = page.getByRole('alertdialog', { name: 'Abend-Logbuch beenden?', exact: true }).getByRole('button', { name: 'Beenden', exact: true })
  const x = await putOverWide(page, ending, startButton(page))
  await doubleTap(page, ending, x)
  await expect(flow(page)).toHaveCount(0)
  await expect(startButton(page)).toBeEnabled()
})

test('a double tap on "Fertig" closes the summary once; "Dein Abend" stands and nothing reopens', async ({ page }) => {
  await open(page, at('20:00:00'))
  await startButton(page).click()
  for (let i = 0; i < 8 && (await flow(page).getByRole('heading', { level: 2, name: 'Gute Nacht.', exact: true }).count()) === 0; i++) {
    await flow(page).getByRole('button', { name: 'Überspringen', exact: true }).click()
  }
  const fertig = flow(page).getByRole('button', { name: 'Fertig', exact: true })
  await expect(fertig).toBeEnabled()
  await doubleTap(page, fertig, 0.5)
  await expect(flow(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Guten Abend/)
  await expect(eveningCard(page)).toBeVisible()
})

// ── Wochenrückblick in „Deine Woche“ ─────────────────────────────────────────────────────────────────────────────

test('"Deine Woche" shows the week review and the focus from Sunday; without logbooks the section is missing', async ({ page }) => {
  await open(page, at('12:00:00', '2026-11-03'), {
    evenings: [
      { day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', gave: ['Musik'], learned: 'Erst denken, dann tippen.', weekFocus: 'Mehr Schlaf' },
      { day: '2026-11-02', at: '2026-11-02T20:00:00.000Z', gave: ['Musik', 'Lachen'], cost: ['Lärm'] },
    ],
  })
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  const week = card(page, 'Deine Woche')
  await expect(week.getByRole('heading', { level: 3, name: 'Wochenrückblick', exact: true })).toBeVisible()
  await expect(week.getByRole('region', { name: 'Energie-Bilanz der Woche', exact: true })).toContainText('Musik · 2×')
  await expect(week.getByRole('region', { name: 'Gelernt', exact: true })).toContainText('Erst denken, dann tippen.')
  await expect(week).toContainText('Wochenfokus: Mehr Schlaf')
})

test('"Deine Woche" without logbooks has no week review', async ({ page }) => {
  await open(page, at('12:00:00', '2026-11-03'))
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(card(page, 'Deine Woche').getByRole('heading', { name: 'Wochenrückblick' })).toHaveCount(0)
})

// ── Kasten im Morgen-Start ───────────────────────────────────────────────────────────────────────────────────────

test('the next morning the intention step shows "Gestern vorgenommen" and the week focus; without them no box', async ({ page }) => {
  await open(page, at('07:00:00', '2026-10-30'), {
    evenings: [
      { day: '2026-10-25', at: '2026-10-25T20:00:00.000Z', weekFocus: 'Mehr Schlaf' },
      { day: DAY, at: '2026-10-29T20:00:00.000Z', better: 'Handy aus bis 10 Uhr' },
    ],
  })
  const morning = page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
  await card(page, 'Morgen-Start').getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
  for (let i = 0; i < 4 && (await morning.getByRole('heading', { level: 2, name: 'Wie willst du heute sein?', exact: true }).count()) === 0; i++) {
    await morning.getByRole('button', { name: 'Überspringen', exact: true }).click()
  }
  const box = morning.getByRole('region', { name: 'Von gestern Abend', exact: true })
  await expect(box).toContainText('Gestern vorgenommen')
  await expect(box).toContainText('Handy aus bis 10 Uhr')
  await expect(box).toContainText('Wochenfokus')
  await expect(box).toContainText('Mehr Schlaf')
})

test('without a logbook the intention step has no box', async ({ page }) => {
  await open(page, at('07:00:00', '2026-10-30'))
  const morning = page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
  await card(page, 'Morgen-Start').getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
  for (let i = 0; i < 4 && (await morning.getByRole('heading', { level: 2, name: 'Wie willst du heute sein?', exact: true }).count()) === 0; i++) {
    await morning.getByRole('button', { name: 'Überspringen', exact: true }).click()
  }
  await expect(morning.getByRole('heading', { level: 2, name: 'Wie willst du heute sein?', exact: true })).toBeVisible()
  await expect(morning.getByRole('region', { name: 'Von gestern Abend', exact: true })).toHaveCount(0)
})

// ── Kontrast und Backup ──────────────────────────────────────────────────────────────────────────────────────────

/** Jede Marke (Geber, Räuber) hat mindestens 4,5:1 gegen ihre Fläche über dem hellsten Untergrund der Stimmung. */
async function expectMarksReadable(page: Page, root: Locator) {
  const found = await root.locator('.mark').evaluateAll((els) => {
    const probe = document.createElement('span')
    document.body.append(probe)
    const read = (css: string) => ((probe.style.color = css), getComputedStyle(probe).color)
    const ground = { sky: read('var(--sky-bottom)'), tint: read('color-mix(in srgb, var(--accent) 12%, transparent)') }
    probe.remove()
    return els.map((el) => ({ text: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, ...ground }))
  })
  expect(found.length).toBeGreaterThan(0)
  for (const mark of found) {
    const backdrop = over(parseColor(mark.tint), parseColor(mark.sky))
    expect(contrast(parseColor(mark.text), over(parseColor(mark.background), backdrop))).toBeGreaterThanOrEqual(4.5)
  }
}

test('the marks are readable in all three moods', async ({ page }) => {
  // tag (14:00) und abend (21:00) auf „Dein Abend“.
  await open(page, at('14:00:00'), { evenings: [EVENING] })
  await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'tag')
  await expectMarksReadable(page, eveningCard(page))
  await resume(page, at('21:00:00'))
  await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'abend', { timeout: 3000 })
  await expectMarksReadable(page, eveningCard(page))
})

test('the marks are readable in the morning mood (summary of a logbook from "Energie" at 8:00)', async ({ page }) => {
  await open(page, at('08:00:00'))
  await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'morgen')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await card(page, 'Tag abschließen').getByRole('button', { name: 'Starten', exact: true }).click()
  await flow(page).getByRole('button', { name: 'Überspringen', exact: true }).click()
  await flow(page).getByRole('button', { name: 'Bewegung', exact: true }).click()
  await flow(page).getByRole('button', { name: 'Weiter', exact: true }).click()
  await flow(page).getByRole('button', { name: 'Bildschirm', exact: true }).click()
  await flow(page).getByRole('button', { name: 'Weiter', exact: true }).click()
  for (let i = 0; i < 6 && (await flow(page).getByRole('heading', { level: 2, name: 'Gute Nacht.', exact: true }).count()) === 0; i++) {
    await flow(page).getByRole('button', { name: 'Überspringen', exact: true }).click()
  }
  await expectMarksReadable(page, flow(page))
})

test('backup: export contains the logbooks; importing them again restores them once', async ({ page }) => {
  await open(page, at('21:00:00'), { evenings: [EVENING] })
  await nav(page).getByRole('button', { name: 'Ich' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()])
  const text = readFileSync((await download.path())!, 'utf8')
  expect(JSON.parse(text).evenings).toEqual([EVENING])

  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('ruhe.v1')!)
    delete data.evenings
    localStorage.setItem('ruhe.v1', JSON.stringify(data))
  })
  await page.reload()
  await nav(page).getByRole('button', { name: 'Ich' }).click()
  const importFile = async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Backup importieren' }).click()])
    await chooser.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  }
  const status = page.locator('.card').filter({ has: heading(page, 'Backup') }).getByRole('status')
  await importFile()
  await expect(status).toHaveText('0 neue Sitzungen importiert. Dazu 1 neuer Energie-Eintrag.')
  expect((await stored(page)).evenings).toEqual([EVENING])
  await importFile()
  await expect(status).toHaveText('0 neue Sitzungen importiert.')
  expect((await stored(page)).evenings).toHaveLength(1)
})

// ── 360 px und 130 % ────────────────────────────────────────────────────────────────────────────────────────────

test.describe('on a 360px phone with 130% text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const LONG = 'Abcdefghij'.repeat(3)

  test('"Dein Abend" and the week review with long tags and sentences stay inside the screen', async ({ page }) => {
    await open(page, at('21:00:00', '2026-11-01'), {
      evenings: [{ day: '2026-11-01', at: '2026-11-01T20:00:00.000Z', gave: [LONG, 'Musik'], cost: [LONG], learned: 'Lmnopqrstu'.repeat(12), better: 'Vwxyzabcde'.repeat(8), weekFocus: 'Fghijklmno'.repeat(4) }],
    })
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await expect(eveningCard(page)).toBeVisible()
    await expectNoSideways(page, eveningCard(page))
    await nav(page).getByRole('button', { name: 'Energie' }).click()
    const week = card(page, 'Deine Woche')
    await week.scrollIntoViewIfNeeded()
    await expect(week.getByRole('heading', { level: 3, name: 'Wochenrückblick', exact: true })).toBeVisible()
    await expectNoSideways(page, week)
  })
})
