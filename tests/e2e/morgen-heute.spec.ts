import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'

// Die Morgen-Karten auf „Heute“ („Guten Morgen“ und „Dein Tag“, Spec M10 §2.1) und die Zeile in „Deine Woche“ (§2.2).
// Der Browser läuft in Berlin; fast alle Tests setzen nur die Uhrzeit (`setFixedTime`), kein Programm läuft dabei (R1).
// Der Test zu „Sprint starten“ und der zum Sprint-Player bei 360 px nehmen die echte Uhr: Dort läuft ein Programm, und der
// Eintrag von „heute“ wird erst im Browser gesät (Tag in Ortszeit der Seite). Das geht ohne Rücksicht auf die Tageszeit,
// denn „Dein Tag“ steht zu jeder Stunde. Alle Werte sind ausgedachte Testdaten.
test.use({ timezoneId: 'Europe/Berlin' })

// Der 28. Oktober 2026 liegt in der Winterzeit (MEZ, +01:00).
const DAY = '2026-10-28'
const at = (time: string, day = DAY) => new Date(`${day}T${time}+01:00`)

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

interface Seed {
  mornings?: object[]
  focusSprints?: object[]
}

// Ein Eintrag mit festem Tag; `at` liegt am Vormittag des Tages (die Uhrzeit spielt für „Dein Tag“ keine Rolle).
const entry = (day: string, rest: object = {}) => ({ day, at: `${day}T08:10:00.000Z`, variant: 'kurz', ...rest })
const FULL = entry(DAY, { intention: 'klar', domino: 'Konzept skizzieren', gratitude: 'ein ruhiger Kaffee am Fenster' })

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name, exact: true })
const card = (page: Page, name: string) => page.locator('.card').filter({ has: heading(page, name) })
const morgenKarte = (page: Page) => card(page, 'Morgen-Start')
const tagKarte = (page: Page) => card(page, 'Dein Tag')
const tick = (page: Page) => page.getByRole('button', { name: 'Big Domino erledigt', exact: true })
const sprintButton = (page: Page) => page.getByRole('button', { name: /^Sprint starten · \d+ Min$/ })
const flow = (page: Page) => page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
const sprintDialog = (page: Page) => page.getByRole('dialog', { name: 'Fokus-Sprint', exact: true })

// addInitScript läuft bei jeder Navigation (auch Neuladen); ein Merker in sessionStorage lässt es nur einmal je Test säen.
async function seed(page: Page, { mornings, focusSprints }: Seed) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({
    version: 1,
    sessions: [],
    settings: SETTINGS,
    ...(mornings ? { mornings } : {}),
    ...(focusSprints ? { focusSprints } : {}),
  }))
}

// Öffnet „Heute“ zur festen Uhrzeit.
async function open(page: Page, now: Date, seeded: Seed = {}) {
  await page.clock.setFixedTime(now)
  if (seeded.mornings || seeded.focusSprints) await seed(page, seeded)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

// Wie `open`, aber mit der echten Uhr (für Tests mit laufendem Programm) und einem Eintrag von heute, dessen Tag der Browser
// selbst bestimmt (Ortszeit der Seite).
async function openLive(page: Page, rest: object) {
  await page.addInitScript((extra) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const mornings = [{ day, at: d.toISOString(), variant: 'kurz', ...extra }]
    localStorage.setItem('ruhe.v1', JSON.stringify({ version: 1, sessions: [], settings: { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }, mornings }))
  }, rest)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

// Nichts ragt über den rechten oder linken Rand, und die Seite scrollt nicht seitlich.
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

// ── „Guten Morgen zur rechten Zeit“ (Spec §2.1) ─────────────────────────────────────────────────────────────────

test('„Guten Morgen“ at 7:00 sits above „Dein Akku“ with both buttons, and „Kurz“ opens the flow at step 1', async ({ page }) => {
  await open(page, at('07:00:00'))
  const c = morgenKarte(page)
  await expect(c).toHaveCount(1)
  await expect(page.locator('.screen').getByRole('heading', { level: 2 })).toHaveText(['Morgen-Start', 'Dein Akku', 'Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten'])
  await expect(c.getByText('Starte wach in den Tag', { exact: true })).toBeVisible()
  await expect(c.getByText('Einchecken, aktivieren, ausrichten.', { exact: true })).toBeVisible()
  await expectMotiv(c.locator('img'), 'vorschlag-morgen', 80)
  await expect(c.getByRole('button')).toHaveText(['Kurz · 5 Min', 'Lang · 15 Min'])
  for (const button of await c.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  // Zwischen Begrüßung und „Dein Akku“.
  const [h1, karte, akku] = await Promise.all([page.getByRole('heading', { level: 1 }).boundingBox(), c.boundingBox(), card(page, 'Dein Akku').boundingBox()])
  expect(karte!.y).toBeGreaterThanOrEqual(h1!.y + h1!.height)
  expect(karte!.y + karte!.height).toBeLessThanOrEqual(akku!.y)

  // Goldrand wie die Reset-Karte: der kräftige Goldton, nicht der zarte der übrigen Karten.
  const border = (l: Locator) => l.evaluate((el) => getComputedStyle(el).borderTopColor)
  expect(await border(c)).toBe('rgba(233, 196, 142, 0.7)')
  expect(await border(card(page, 'Dein Akku'))).not.toBe(await border(c))

  // „Kurz“ ist gefüllt, „Lang“ umrandet.
  expect(await c.getByRole('button', { name: 'Kurz · 5 Min' }).evaluate((el) => el.classList.contains('button') && !el.classList.contains('button-line'))).toBe(true)
  expect(await c.getByRole('button', { name: 'Lang · 15 Min' }).evaluate((el) => el.classList.contains('button-line') && !el.classList.contains('button'))).toBe(true)

  await expect(flow(page)).toHaveCount(0)
  await c.getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
  await expect(flow(page)).toBeVisible()
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 5', exact: true })).toBeVisible()
})

test('„Lang · 15 Min“ opens the long flow', async ({ page }) => {
  await open(page, at('07:00:00'))
  await morgenKarte(page).getByRole('button', { name: 'Lang · 15 Min', exact: true }).click()
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 6', exact: true })).toBeVisible()
})

// Die Grenzen des Fensters (Stunde 4 ≤ h < 11): 3:59 noch nicht, 4:00 und 10:59 ja, 11:00 nicht mehr.
for (const [time, shown] of [
  ['03:59:00', false],
  ['04:00:00', true],
  ['10:59:00', true],
  ['11:00:00', false],
  ['12:00:00', false],
] as const) {
  test(`at ${time.slice(0, 5)} the morning card is ${shown ? 'there' : 'not there'} (no entry today)`, async ({ page }) => {
    await open(page, at(time))
    await expect(morgenKarte(page)).toHaveCount(shown ? 1 : 0)
    await expect(tagKarte(page)).toHaveCount(0)
    await expect(card(page, 'Vorschlag des Tages')).toHaveCount(1)
  })
}

test('with an entry from today „Dein Tag“ stands instead of „Guten Morgen“, in the window and after it', async ({ page }) => {
  await open(page, at('07:00:00'), { mornings: [FULL] })
  await expect(tagKarte(page)).toHaveCount(1)
  await expect(morgenKarte(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kurz · 5 Min' })).toHaveCount(0)
  await expect(page.locator('.screen').getByRole('heading', { level: 2 })).toHaveText(['Dein Tag', 'Dein Akku', 'Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten'])

  // Am Nachmittag steht sie weiter, bis Mitternacht.
  await page.clock.setFixedTime(at('16:30:00'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(tagKarte(page)).toHaveCount(1)
})

test('an entry from yesterday does not make „Dein Tag“: in the morning „Guten Morgen“ stands', async ({ page }) => {
  await open(page, at('07:00:00'), { mornings: [entry('2026-10-27', { intention: 'klar' })] })
  await expect(morgenKarte(page)).toHaveCount(1)
  await expect(tagKarte(page)).toHaveCount(0)
})

// ── Fortsetzen nach 11 Uhr (Spec §2.1, Review Focus 4) ──────────────────────────────────────────────────────────

test('resuming the app after 11:00 hides „Guten Morgen“ without a reload', async ({ page }) => {
  await open(page, at('10:58:00'))
  await expect(morgenKarte(page)).toHaveCount(1)
  await page.evaluate(() => ((window as unknown as { ruheMarker: boolean }).ruheMarker = true)) // übersteht nur ohne Neuladen

  // Vier Minuten später, ohne dass ein Timer gefeuert hat (wie nach dem Entsperren).
  await page.clock.setFixedTime(at('11:02:00'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

  await expect(morgenKarte(page)).toHaveCount(0, { timeout: 2000 })
  await expect(card(page, 'Vorschlag des Tages')).toHaveCount(1)
  expect(await page.evaluate(() => (window as unknown as { ruheMarker?: boolean }).ruheMarker)).toBe(true)
})

// ── „Dein Tag“ (Spec §2.1) ──────────────────────────────────────────────────────────────────────────────────────

test('„Dein Tag“ shows intention, big domino and gratitude with the count of the week', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [FULL] })
  const c = tagKarte(page)
  await expect(c.getByText('Heute will ich sein:', { exact: true })).toBeVisible()
  await expect(c.getByText('klar', { exact: true })).toBeVisible()
  await expect(c.getByText('Big Domino', { exact: true })).toBeVisible()
  await expect(c.getByText('Konzept skizzieren', { exact: true })).toBeVisible()
  await expect(c.getByText('Dankbar für: ein ruhiger Kaffee am Fenster', { exact: true })).toBeVisible()
  await expect(c.getByText('Morgen-Start an 1 der letzten 7 Tage', { exact: true })).toBeVisible()
  await expect(c.getByText('Morgen-Start erledigt.')).toHaveCount(0)
  await expect(sprintButton(page)).toHaveText('Sprint starten · 50 Min')
  expect((await sprintButton(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const box = (await tick(page).boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  // Die Karte steht zwischen Begrüßung und „Dein Akku“ und trägt denselben Goldrand.
  const [h1, karte, akku] = await Promise.all([page.getByRole('heading', { level: 1 }).boundingBox(), c.boundingBox(), card(page, 'Dein Akku').boundingBox()])
  expect(karte!.y).toBeGreaterThanOrEqual(h1!.y + h1!.height)
  expect(karte!.y + karte!.height).toBeLessThanOrEqual(akku!.y)
})

test('the count of the week counts days, not entries, over today and the six days before', async ({ page }) => {
  await open(page, at('14:00:00'), {
    mornings: [entry('2026-10-21'), entry('2026-10-22'), entry('2026-10-24'), entry('2026-10-26', { intention: 'klar' }), entry(DAY, { intention: 'klar' })],
  })
  // 21.10. liegt außerhalb (heute und die 6 Tage davor sind der 22. bis 28.).
  await expect(tagKarte(page).getByText('Morgen-Start an 4 der letzten 7 Tage', { exact: true })).toBeVisible()
})

test('the tick toggles the big domino: struck through and dimmed when done, and „Sprint starten“ goes; a second tap takes both back', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [FULL] })
  const c = tagKarte(page)
  const text = c.getByText('Konzept skizzieren', { exact: true })
  const lineThrough = () => text.evaluate((el) => getComputedStyle(el).textDecorationLine)
  await expect(tick(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await lineThrough()).toBe('none')
  const color = () => text.evaluate((el) => getComputedStyle(el).color)
  const before = await color()

  await tick(page).click()
  await expect(tick(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(sprintButton(page)).toHaveCount(0)
  // Die Sperre gegen Doppeltipps gilt nur beim Erscheinen der Karte: Eine Änderung der Daten sperrt den Knopf nicht erneut
  // (sonst gingen Tipps in den 400 ms danach verloren).
  await page.waitForTimeout(100)
  await expect(tick(page)).toBeEnabled({ timeout: 100 })
  expect(await lineThrough()).toBe('line-through')
  expect(await color(), 'gedämpft').not.toBe(before)
  const done = (await stored(page)).mornings[0].dominoDone
  expect(typeof done).toBe('string')
  expect(Number.isNaN(Date.parse(done))).toBe(false)

  await tick(page).click()
  await expect(tick(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(sprintButton(page)).toBeVisible()
  expect(await lineThrough()).toBe('none')
  expect((await stored(page)).mornings[0].dominoDone).toBeUndefined()
})

test('an entry that is already ticked shows struck through, without „Sprint starten“', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [entry(DAY, { domino: 'Konzept skizzieren', dominoDone: '2026-10-28T09:00:00.000Z' })] })
  await expect(tick(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(sprintButton(page)).toHaveCount(0)
  // Ohne Intention und Dankbarkeit stehen nur der Big Domino und die Zählung.
  await expect(tagKarte(page).getByText('Heute will ich sein:')).toHaveCount(0)
  await expect(tagKarte(page).getByText('Dankbar für', { exact: false })).toHaveCount(0)
})

test('rows show only when set: an entry with only a gratitude shows just that', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [entry(DAY, { gratitude: 'der Regen' })] })
  const c = tagKarte(page)
  await expect(c.getByText('Dankbar für: der Regen', { exact: true })).toBeVisible()
  await expect(c.getByText('Heute will ich sein:')).toHaveCount(0)
  await expect(c.getByText('Big Domino')).toHaveCount(0)
  await expect(c.getByRole('button')).toHaveCount(0)
  await expect(c.getByText('Morgen-Start erledigt.')).toHaveCount(0)
})

test('everything skipped: „Dein Tag“ says „Morgen-Start erledigt.“', async ({ page }) => {
  await open(page, at('14:00:00'), { mornings: [entry(DAY)] })
  const c = tagKarte(page)
  await expect(c.getByText('Morgen-Start erledigt.', { exact: true })).toBeVisible()
  await expect(c.getByText('Morgen-Start an 1 der letzten 7 Tage', { exact: true })).toBeVisible()
  await expect(c.getByText('Heute will ich sein:')).toHaveCount(0)
  await expect(c.getByText('Big Domino')).toHaveCount(0)
  await expect(c.getByText('Dankbar für', { exact: false })).toHaveCount(0)
  await expect(c.getByRole('button')).toHaveCount(0)
})

// ── „Sprint starten“ (läuft in Echtzeit, keine feste Uhr: R1) ───────────────────────────────────────────────────

test('„Sprint starten“ starts the sprint player with the big domino, and ending it early leaves no sprint entry', async ({ page }) => {
  await openLive(page, { intention: 'klar', domino: 'Konzept skizzieren' })
  await sprintButton(page).click()
  const player = sprintDialog(page)
  await expect(player).toBeVisible()
  await expect(player.getByText('Konzept skizzieren', { exact: true })).toBeVisible()
  const timer = player.getByRole('timer')
  await expect(timer).toHaveText('50:00')
  // Er läuft: Nach wenigen Sekunden steht eine kleinere Zeit da.
  await expect(timer).not.toHaveText('50:00', { timeout: 10_000 })
  await expect(timer).not.toHaveText('49:55')

  await player.getByRole('button', { name: 'Beenden', exact: true }).click() // unter 5 Minuten: schließt ohne Ende-Ansicht
  await expect(sprintDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Sprint geschafft' })).toHaveCount(0)
  const data = await stored(page)
  expect(data.focusSprints).toBeUndefined()
  expect(data.sessions).toEqual([])
  // Der Big Domino bleibt, wie er war; der Sprint hat ihn nicht abgehakt.
  expect(data.mornings[0].dominoDone).toBeUndefined()
  await expect(tagKarte(page).getByText('Konzept skizzieren', { exact: true })).toBeVisible()
})

// ── Mitternacht (Spec §2.1, Review Focus 4) ─────────────────────────────────────────────────────────────────────

test('at 23:59 „Dein Tag“ still stands, at 0:00 of the next day it is gone, and in the morning „Guten Morgen“ is back', async ({ page }) => {
  await open(page, at('23:59:00'), { mornings: [FULL] })
  await expect(tagKarte(page)).toHaveCount(1)
  await page.evaluate(() => ((window as unknown as { ruheMarker: boolean }).ruheMarker = true))

  await page.clock.setFixedTime(at('00:00:00', '2026-10-29'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(tagKarte(page)).toHaveCount(0, { timeout: 2000 })
  await expect(morgenKarte(page)).toHaveCount(0) // nachts zwischen 0 und 4 Uhr gibt es keine Karte

  await page.clock.setFixedTime(at('05:00:00', '2026-10-29'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(morgenKarte(page)).toHaveCount(1, { timeout: 2000 })
  await expect(tagKarte(page)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { ruheMarker?: boolean }).ruheMarker)).toBe(true)
})

// ── „Deine Woche“ (Spec §2.2) ───────────────────────────────────────────────────────────────────────────────────

const week = (page: Page) => page.getByRole('region', { name: 'Deine Woche', exact: true })

async function openWeek(page: Page, seeded: Seed) {
  await open(page, at('14:00:00'), seeded)
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(week(page)).toBeVisible()
}

test('„Deine Woche“ shows the count under the focus line when mornings were done on 4 of the last 7 days', async ({ page }) => {
  await openWeek(page, {
    mornings: [entry('2026-10-23'), entry('2026-10-25'), entry('2026-10-27'), entry(DAY), entry('2026-10-20')],
    focusSprints: [{ id: 'f-1', at: '2026-10-27T09:00:00.000Z', planned: 25, seconds: 1500 }],
  })
  const line = week(page).getByText('Morgen-Start an 4 der letzten 7 Tage', { exact: true })
  await expect(line).toBeVisible()
  const focus = week(page).getByText('Diese Woche: 1 Sprint, 25 Min Fokus', { exact: true })
  await expect(focus).toBeVisible()
  const [f, m] = await Promise.all([focus.boundingBox(), line.boundingBox()])
  expect(m!.y, 'unter der Fokus-Zeile').toBeGreaterThanOrEqual(f!.y + f!.height)
})

test('„Deine Woche“ has no morning line without entries in the last 7 days', async ({ page }) => {
  await openWeek(page, { mornings: [entry('2026-10-20'), entry('2026-10-21')] }) // beide älter als die 7 Tage
  await expect(week(page).getByText('Morgen-Start an', { exact: false })).toHaveCount(0)
})

test('„Deine Woche“ has no morning line at all without mornings', async ({ page }) => {
  await openWeek(page, {})
  await expect(week(page).getByText('Morgen-Start an', { exact: false })).toHaveCount(0)
})

// ── Lange Eingaben, 360 px und 130 % (Review Focus 5) ───────────────────────────────────────────────────────────

const LONG_WORD = 'W'.repeat(40) // die längste Intention, ohne Leerzeichen
const LONG_DOMINO = 'D'.repeat(80) // der längste Big Domino, ohne Leerzeichen
const LONG_THANKS = 'T'.repeat(120) // die längste Dankbarkeit, ohne Leerzeichen

test.describe('on a 360 px phone with 130 % text', () => {
  test.use({ viewport: { width: 360, height: 640 } })
  const larger = (page: Page) => page.evaluate(() => (document.documentElement.style.fontSize = '130%'))

  test('„Guten Morgen“ fits and keeps both buttons at least 44 px high', async ({ page }) => {
    await open(page, at('07:00:00'))
    await larger(page)
    const c = morgenKarte(page)
    await expectNoSideways(page, c)
    for (const button of await c.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test('„Dein Tag“ wraps a 40-letter word, an 80-letter big domino and a 120-letter gratitude, and nothing scrolls sideways', async ({ page }) => {
    await open(page, at('14:00:00'), { mornings: [entry(DAY, { intention: LONG_WORD, domino: LONG_DOMINO, gratitude: LONG_THANKS })] })
    const c = tagKarte(page)
    await expectNoSideways(page, c)
    await larger(page)
    await expectNoSideways(page, c)
    // Die Wörter brechen wirklich um: Der Big Domino steht auf mehr als einer Zeile.
    const lines = await c.getByText(LONG_DOMINO, { exact: true }).evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
    expect(lines).toBeGreaterThan(1)
    // Tick und Sprint bleiben bedienbar.
    expect((await tick(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await sprintButton(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test('the sprint player wraps the 80-letter big domino too', async ({ page }) => {
    await openLive(page, { intention: LONG_WORD, domino: LONG_DOMINO })
    await larger(page)
    await sprintButton(page).click()
    const player = sprintDialog(page)
    await expect(player.getByText(LONG_DOMINO, { exact: true })).toBeVisible()
    await expectNoSideways(page, player)
    await expect(player.getByRole('button', { name: 'Beenden', exact: true })).toBeInViewport()
    await player.getByRole('button', { name: 'Beenden', exact: true }).click()
    await expect(sprintDialog(page)).toHaveCount(0)
  })
})
