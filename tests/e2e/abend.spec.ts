import { test, expect, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'
import { doubleTap, putOverWide } from './taps'

// Das Abend-Logbuch (Spec M11 §2.2, §2.3): die Karte im Reiter „Energie“ und der Ablauf im Vollbild. Der Browser läuft in
// Berlin. Im Abend-Ablauf läuft kein Programm, darum steht die Uhr fest (`setFixedTime`). Alle Werte sind ausgedachte
// Testdaten. Der 29.10.2026 ist ein Donnerstag, der 1.11.2026 ein Sonntag (Winterzeit, +01:00).
test.use({ timezoneId: 'Europe/Berlin' })

const THURSDAY = new Date('2026-10-29T20:00:00+01:00')
const SUNDAY = new Date('2026-11-01T21:00:00+01:00')
const DAY = '2026-10-29'

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

const card = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Tag abschließen', exact: true }) })
const start = (page: Page) => card(page).getByRole('button', { name: 'Starten', exact: true })
const flow = (page: Page) => page.getByRole('dialog', { name: 'Abend-Logbuch', exact: true })
const title = (page: Page, name: string) => flow(page).getByRole('heading', { level: 2, name, exact: true })
const next = (page: Page) => flow(page).getByRole('button', { name: 'Weiter', exact: true })
const skip = (page: Page) => flow(page).getByRole('button', { name: 'Überspringen', exact: true })
const close = (page: Page) => flow(page).getByRole('button', { name: 'Abend-Logbuch beenden', exact: true })
const confirm = (page: Page) => page.getByRole('alertdialog', { name: 'Abend-Logbuch beenden?', exact: true })
const tag = (page: Page, name: string) => flow(page).getByRole('button', { name, exact: true })
const dots = (page: Page, text: string) => flow(page).getByRole('img', { name: text, exact: true })
const dot = (page: Page, area: string, n: number, word: string) => flow(page).getByRole('radio', { name: `${area}: ${n} von 5, ${word}`, exact: true })

const CHECKIN = 'Wie voll sind deine Akkus jetzt?'
const GAVE = 'Was hat dir heute Energie gegeben?'
const COST = 'Was hat dich heute Energie gekostet?'
const REVIEW = 'Was ist aus deinem Morgen geworden?'
const LEARNED = 'Was hast du heute gelernt?'
const BETTER = 'Was machst du morgen 1 % besser?'
const WEEK = 'Deine Woche'
const DONE = 'Gute Nacht.'

interface Seed {
  mornings?: object[]
  evenings?: object[]
}

async function seed(page: Page, { mornings, evenings }: Seed) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, ...(mornings ? { mornings } : {}), ...(evenings ? { evenings } : {}) }))
}

/** Öffnet die App im Reiter „Energie“ mit fester Uhr. */
async function open(page: Page, now: Date, seeded: Seed = {}) {
  await page.clock.setFixedTime(now)
  if (seeded.mornings || seeded.evenings) await seed(page, seeded)
  await page.goto('./')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
}

async function begin(page: Page) {
  await start(page).click()
  await expect(flow(page)).toBeVisible()
  await expect(title(page, CHECKIN)).toBeFocused()
}

const WORDS = ['', 'leer', 'schwach', 'mittel', 'gut', 'voll']
async function checkin(page: Page, levels: [number, number, number, number] = [3, 2, 4, 3]) {
  for (const [i, area] of ['Körper', 'Gefühl', 'Geist', 'Sinn'].entries()) await dot(page, area, levels[i], WORDS[levels[i]]).click()
  await next(page).click()
  await expect(title(page, GAVE)).toBeFocused()
}

async function skipTo(page: Page, until: string) {
  for (let i = 0; i < 8 && (await title(page, until).count()) === 0; i++) await skip(page).click()
  await expect(title(page, until)).toBeFocused()
}

async function expectNoSideways(page: Page) {
  const sticksOut = await flow(page).evaluate((root) =>
    [...root.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5)
    }).map((e) => `${e.tagName}.${e.className}`),
  )
  expect(sticksOut).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
}

const MORNING = { day: DAY, at: '2026-10-29T06:30:00.000Z', variant: 'kurz', intention: 'klar', domino: 'Konzept skizzieren' }

// ── Die Karte im Reiter „Energie“ (Spec §2.2) ───────────────────────────────────────────────────────────────────

test('the card sits right below "Morgen-Start" with its sentence, motif and "Starten"', async ({ page }) => {
  await open(page, THURSDAY)
  const headings = page.locator('.screen').getByRole('heading', { level: 2 })
  await expect(headings.nth(0)).toHaveText('Morgen-Start')
  await expect(headings.nth(1)).toHaveText('Tag abschließen')
  const c = card(page)
  await expect(c.getByText('Abend-Logbuch', { exact: true })).toBeVisible()
  await expect(c.getByText('Jederzeit Bilanz ziehen.', { exact: true })).toBeVisible()
  await expectMotiv(c.locator('img'), 'vorschlag-abend', 56)
  await expect(c.getByRole('button')).toHaveText(['Starten'])
  await expect(flow(page)).toHaveCount(0)
})

// ── Der Ablauf (Spec §2.3) ─────────────────────────────────────────────────────────────────────────────────────

test('a full logbook with a morning entry saves the entry, the check-in and the tick, and the summary shows it', async ({ page }) => {
  await open(page, THURSDAY, { mornings: [MORNING] })
  await begin(page)
  await expect(dots(page, 'Schritt 1 von 6')).toBeVisible()
  await checkin(page)

  // Geber: ein Vorschlag und ein eigenes Stichwort.
  await expect(flow(page).getByText('Tipp alles an, was passt.', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Nichts gewählt', { exact: true })).toBeVisible()
  await tag(page, 'Bewegung').click()
  await expect(tag(page, 'Bewegung')).toHaveAttribute('aria-pressed', 'true')
  await tag(page, '+ Eigenes').click()
  await flow(page).getByLabel('Eigenes Stichwort', { exact: true }).fill('Kochen')
  await tag(page, 'Hinzufügen').click()
  await expect(flow(page).getByRole('group', { name: 'Deine Stichworte', exact: true }).getByRole('button', { name: 'Kochen', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(flow(page).getByText('2 gewählt', { exact: true })).toBeVisible()
  await next(page).click()

  await expect(title(page, COST)).toBeFocused()
  await tag(page, 'Bildschirm').click()
  await next(page).click()

  // Rückblick: Big Domino abhaken und die Intention bewerten.
  await expect(title(page, REVIEW)).toBeFocused()
  await expect(flow(page).getByText('Konzept skizzieren', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Heute will ich klar sein.', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Wie gut ist es dir gelungen?', { exact: true })).toBeVisible()
  const done = flow(page).getByRole('button', { name: 'Geschafft', exact: true })
  await expect(done).toHaveAttribute('aria-pressed', 'false')
  await done.click()
  await expect(done).toHaveAttribute('aria-pressed', 'true')
  await flow(page).getByRole('radio', { name: 'teils', exact: true }).click()
  await expect(flow(page).getByRole('radio', { name: 'teils', exact: true })).toHaveAttribute('aria-checked', 'true')
  await next(page).click()

  await expect(title(page, LEARNED)).toBeFocused()
  await flow(page).getByRole('textbox', { name: LEARNED, exact: true }).fill('Pausen machen mich schneller.')
  await expect(flow(page).getByText('29 / 120', { exact: true })).toBeVisible()
  await next(page).click()

  await expect(title(page, BETTER)).toBeFocused()
  await flow(page).getByRole('textbox', { name: BETTER, exact: true }).fill('Handy aus bis 10 Uhr')
  await next(page).click()

  // Abschluss.
  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page).getByText('Lass den Tag hier liegen. Morgen geht es weiter.', { exact: true })).toBeVisible()
  await expectMotiv(flow(page).locator('img').first(), 'vorschlag-abend', 96)
  await expect(flow(page)).toContainText('Hat Energie gegeben')
  await expect(flow(page)).toContainText('Hat Energie gekostet')
  await expect(flow(page)).toContainText('Big Domino geschafft: Konzept skizzieren')
  await expect(flow(page)).toContainText('Gelernt: Pausen machen mich schneller.')
  await expect(flow(page)).toContainText('Morgen 1 % besser: Handy aus bis 10 Uhr')
  await expect(flow(page)).not.toContainText('Logbuch an')

  const data = await stored(page)
  expect(data.evenings).toHaveLength(1)
  expect(data.evenings[0]).toMatchObject({ day: DAY, gave: ['Bewegung', 'Kochen'], cost: ['Bildschirm'], intentionScore: 'teils', learned: 'Pausen machen mich schneller.', better: 'Handy aus bis 10 Uhr' })
  expect(data.evenings[0]).not.toHaveProperty('weekFocus')
  expect(data.energyCheckins).toHaveLength(1)
  expect(data.energyCheckins[0].levels).toEqual({ koerper: 3, gefuehl: 2, geist: 4, sinn: 3 })
  expect(data.mornings[0].dominoDone).toBeTruthy()
  expect(data.sessions).toEqual([])

  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
})

test('without a morning entry there is no review; skipping everything saves an entry with only day and time', async ({ page }) => {
  await open(page, THURSDAY)
  await begin(page)
  await expect(dots(page, 'Schritt 1 von 5')).toBeVisible()
  await skipTo(page, DONE)
  await expect(flow(page).getByText('Logbuch erledigt.', { exact: true })).toBeVisible()
  const data = await stored(page)
  expect(Object.keys(data.evenings[0]).sort()).toEqual(['at', 'day'])
  expect(data.evenings[0].day).toBe(DAY)
  expect(data.energyCheckins).toBeUndefined()
})

test('the tick in the review is saved at once and stays when the logbook is ended; a done domino can be unticked', async ({ page }) => {
  await open(page, THURSDAY, { mornings: [MORNING] })
  await begin(page)
  await checkin(page)
  await skipTo(page, REVIEW)
  await flow(page).getByRole('button', { name: 'Geschafft', exact: true }).click()
  await close(page).click()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  let data = await stored(page)
  expect(data.evenings).toBeUndefined()
  expect(data.mornings[0].dominoDone).toBeTruthy()
  expect(data.energyCheckins).toHaveLength(1)

  // Noch einmal: Der Haken steht jetzt gesetzt, ein Tipp nimmt ihn zurück.
  await expect(start(page)).toBeEnabled()
  await begin(page)
  await skipTo(page, REVIEW)
  const done = flow(page).getByRole('button', { name: 'Geschafft', exact: true })
  await expect(done).toHaveAttribute('aria-pressed', 'true')
  await done.click()
  await expect(done).toHaveAttribute('aria-pressed', 'false')
  data = await stored(page)
  expect(data.mornings[0]).not.toHaveProperty('dominoDone')
})

test('a morning entry with only an intention shows only that block; a second tap takes the level back', async ({ page }) => {
  await open(page, THURSDAY, { mornings: [{ day: DAY, at: '2026-10-29T06:30:00.000Z', variant: 'kurz', intention: 'sanft mit mir' }] })
  await begin(page)
  await skipTo(page, REVIEW)
  await expect(flow(page).getByRole('button', { name: 'Geschafft', exact: true })).toHaveCount(0)
  await expect(flow(page).getByText('Heute will ich sanft mit mir sein.', { exact: true })).toBeVisible()
  const ganz = flow(page).getByRole('radio', { name: 'ganz', exact: true })
  await ganz.click()
  await expect(ganz).toHaveAttribute('aria-checked', 'true')
  await ganz.click()
  await expect(ganz).toHaveAttribute('aria-checked', 'false')
  await next(page).click()
  await skipTo(page, DONE)
  expect((await stored(page)).evenings[0]).not.toHaveProperty('intentionScore')
})

test('on a Sunday the week page sums up the week including tonight, and the chosen focus is saved', async ({ page }) => {
  await open(page, SUNDAY, {
    evenings: [
      { day: '2026-10-26', at: '2026-10-26T20:00:00.000Z', gave: ['Bewegung', 'Musik'], cost: ['Bildschirm'], learned: 'Erstens' },
      { day: '2026-10-28', at: '2026-10-28T20:00:00.000Z', gave: ['Bewegung', 'Draußen'], cost: ['Bildschirm', 'Lärm'], learned: 'Zweitens' },
      { day: '2026-10-30', at: '2026-10-30T20:00:00.000Z', gave: ['Musik'], cost: ['Lärm'] },
      { day: '2026-10-31', at: '2026-10-31T20:00:00.000Z', gave: ['Bewegung'] },
    ],
    mornings: [
      { day: '2026-10-26', at: '2026-10-26T06:30:00.000Z', variant: 'kurz', domino: 'A', dominoDone: '2026-10-26T10:00:00.000Z' },
      { day: '2026-10-27', at: '2026-10-27T06:30:00.000Z', variant: 'kurz', domino: 'B' },
    ],
  })
  // Im Reiter „Energie“ heißt der Knopf auch sonntags „Starten“.
  await expect(start(page)).toBeVisible()
  await begin(page)
  await expect(dots(page, 'Schritt 1 von 6')).toBeVisible()
  await skip(page).click()
  await expect(title(page, GAVE)).toBeFocused()
  await tag(page, 'Musik').click()
  await next(page).click()
  await skipTo(page, WEEK)

  await expect(flow(page).getByText('26. Oktober bis 1. November · Logbuch an 5 Tagen', { exact: true })).toBeVisible()
  const bilanz = flow(page).getByRole('region', { name: 'Energie-Bilanz der Woche', exact: true })
  await expect(bilanz).toContainText('Musik · 3×')
  await expect(bilanz.getByText(/ · \d+×$/)).toHaveText(['Musik · 3×', 'Bewegung · 3×', 'Draußen · 1×', 'Lärm · 2×', 'Bildschirm · 2×'])
  await expect(flow(page)).toContainText('1 von 2 geschafft')
  await expect(flow(page).getByRole('region', { name: 'Gelernt', exact: true })).toContainText('Zweitens')
  await expect(flow(page).getByText('Dein Fokus für nächste Woche', { exact: true })).toBeVisible()
  await flow(page).getByRole('radio', { name: 'Mehr Schlaf', exact: true }).click()
  await next(page).click()

  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page)).toContainText('Wochenfokus: Mehr Schlaf')
  const saved = (await stored(page)).evenings.find((e: { day: string }) => e.day === '2026-11-01')
  expect(saved).toMatchObject({ gave: ['Musik'], weekFocus: 'Mehr Schlaf' })
})

test('a second run on the same evening replaces the entry; the card says it has been done', async ({ page }) => {
  await open(page, THURSDAY, { evenings: [{ day: DAY, at: '2026-10-29T18:30:00.000Z', learned: 'Früher' }] })
  await expect(card(page).getByText('Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.', { exact: true })).toBeVisible()
  await expect(card(page).getByText('Jederzeit Bilanz ziehen.', { exact: true })).toHaveCount(0)
  await begin(page)
  await skipTo(page, DONE)
  const data = await stored(page)
  expect(data.evenings).toHaveLength(1)
  expect(data.evenings[0]).not.toHaveProperty('learned')
})

test('reloading in the middle closes the logbook; the check-in stays, no logbook entry', async ({ page }) => {
  await open(page, THURSDAY)
  await begin(page)
  await checkin(page)
  await page.reload()
  await expect(flow(page)).toHaveCount(0)
  const data = await stored(page)
  expect(data.evenings).toBeUndefined()
  expect(data.energyCheckins).toHaveLength(1)
})

test('back gesture and Escape ask before ending; "Weiter machen" stays on the step', async ({ page }) => {
  await open(page, THURSDAY)
  await begin(page)
  await page.goBack()
  await expect(confirm(page)).toBeVisible()
  await confirm(page).getByRole('button', { name: 'Weiter machen', exact: true }).click()
  await expect(confirm(page)).toHaveCount(0)
  await expect(title(page, CHECKIN)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm(page)).toBeVisible()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
})

test('a double tap on "Beenden" does not reach "Starten" of the card below, and the logbook stays closed', async ({ page }) => {
  await open(page, THURSDAY)
  await begin(page)
  await close(page).click()
  await expect(confirm(page)).toBeVisible()
  const ending = confirm(page).getByRole('button', { name: 'Beenden', exact: true })
  const x = await putOverWide(page, ending, start(page))
  await doubleTap(page, ending, x)
  await expect(flow(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  await expect(start(page)).toBeEnabled()
  await start(page).click()
  await expect(flow(page)).toBeVisible()
})

test('a double tap on "Weiter" in the check-in does not pick anything on the next step', async ({ page }) => {
  await open(page, THURSDAY)
  await begin(page)
  for (const area of ['Körper', 'Gefühl', 'Geist', 'Sinn']) await dot(page, area, 3, 'mittel').click()
  await expect(next(page)).toBeEnabled()
  await doubleTap(page, next(page), 0.5)
  await expect(title(page, GAVE)).toBeVisible()
  await expect(flow(page).getByText('Nichts gewählt', { exact: true })).toBeVisible()
  await expect(flow(page).locator('[aria-pressed="true"]')).toHaveCount(0)
})

// ── 360 px und 130 % ────────────────────────────────────────────────────────────────────────────────────────────

test.describe('on a 360px phone with 130% text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const LONG_TAG = 'Abcdefghij'.repeat(3) // 30 Zeichen ohne Leerzeichen

  test('long own tags and sentences wrap; nothing sticks out in the flow or the summary', async ({ page }) => {
    await open(page, THURSDAY)
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await begin(page)
    await expectNoSideways(page)
    await skip(page).click()
    await tag(page, '+ Eigenes').click()
    await flow(page).getByLabel('Eigenes Stichwort', { exact: true }).fill(LONG_TAG)
    await tag(page, 'Hinzufügen').click()
    await expect(tag(page, LONG_TAG)).toHaveAttribute('aria-pressed', 'true')
    await expectNoSideways(page)
    await next(page).click()
    await skipTo(page, LEARNED)
    await flow(page).getByRole('textbox', { name: LEARNED, exact: true }).fill('Lmnopqrstu'.repeat(12))
    await expectNoSideways(page)
    await next(page).click()
    await flow(page).getByRole('textbox', { name: BETTER, exact: true }).fill('Vwxyzabcde'.repeat(8))
    await expectNoSideways(page)
    await next(page).click()
    await expect(title(page, DONE)).toBeFocused()
    await expectNoSideways(page)
  })
})
