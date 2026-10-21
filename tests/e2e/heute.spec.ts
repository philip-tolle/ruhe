import { test, expect, type Page } from '@playwright/test'

// Sitzungen und Zeiten tragen ihren Offset und der Browser läuft in Berlin; so hängt kein Test
// von der Zeitzone des Rechners ab. „Heute“ ist der 21.10.2026, 20 Uhr.
test.use({ timezoneId: 'Europe/Berlin' })
const NOW = new Date('2026-10-21T20:00:00+02:00')

const session = (id: string, start: string) => ({ id, start, kind: 'timer', ref: 'timer', seconds: 600 })
const THREE_DAYS = [
  session('s-19', '2026-10-19T07:30:00+02:00'),
  session('s-20', '2026-10-20T07:30:00+02:00'),
  session('s-21', '2026-10-21T07:30:00+02:00'),
]
const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }
const dataOf = (sessions: object[], lastUsed?: object, settings: object = SETTINGS) => ({
  version: 1,
  sessions,
  settings,
  ...(lastUsed ? { lastUsed } : {}),
})

// addInitScript läuft bei jeder Navigation (auch Neuladen); ein Merker in sessionStorage lässt es nur
// einmal je Test säen, damit Änderungen im Test ein Neuladen überstehen.
async function open(page: Page, data: object | null) {
  await page.clock.setFixedTime(NOW)
  if (data) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify(data))
  }
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Abend')
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const lastUsedCard = (page: Page) =>
  page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Zuletzt genutzt', exact: true }) })

// Der Player erscheint, sobald der Start angestoßen ist; eingeplant wird erst, wenn die Klangschale
// geladen ist. Wer vorher „Beenden“ tippt, beendet nichts Eingeplantes und bekommt keinen Abschluss.
// Läuft der Countdown weiter, ist die Sitzung eingeplant.
async function waitUntilRunning(page: Page) {
  const countdown = page.getByRole('timer')
  const first = (await countdown.textContent())!
  await expect(countdown).not.toHaveText(first)
}

// Zurück auf „Heute“: Reiter aktiv, Begrüßung da, kein Player mehr.
async function expectBackOnHeute(page: Page) {
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Heute' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Abend')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('streak and quick start', async ({ page }) => {
  await open(page, dataOf(THREE_DAYS, { kind: 'breath', pattern: '478', minutes: 1 }))
  await expect(page.getByText('3 Tage in Folge', { exact: true })).toBeVisible()
  await expect(page.getByText('Heute ist ein guter Tag zum Anfangen.')).toHaveCount(0)

  const last = lastUsedCard(page)
  await expect(last.getByText('4-7-8 · 1 Min', { exact: true })).toBeVisible()
  await expect(last.getByRole('button', { name: 'Erneut starten' })).toBeVisible()

  // Reihenfolge: Zuletzt genutzt, 3 Min durchatmen, Zur Ruhe kommen.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Zuletzt genutzt', '3 Min durchatmen', 'Zur Ruhe kommen'])
  await expect(page.getByText('Kohärentes Atmen', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Jetzt durchatmen' }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Kohärentes Atmen' })).toBeVisible()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
  await waitUntilRunning(page)

  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expectBackOnHeute(page)

  // Die Übung ist jetzt die zuletzt genutzte.
  await expect(lastUsedCard(page).getByText('Kohärentes Atmen · 3 Min', { exact: true })).toBeVisible()
  expect((await stored(page)).lastUsed).toEqual({ kind: 'breath', pattern: 'kohaerent', minutes: 3 })
  await expect(page.getByText('3 Tage in Folge', { exact: true })).toBeVisible() // unter 60 s zählt nicht
})

test('empty state', async ({ page }) => {
  await open(page, null)
  await expect(page.getByText('Heute ist ein guter Tag zum Anfangen.', { exact: true })).toBeVisible()
  await expect(page.getByText('Tage in Folge')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Zuletzt genutzt' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Erneut starten' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['3 Min durchatmen', 'Zur Ruhe kommen'])
  await expect(page.getByRole('button', { name: 'Jetzt durchatmen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zu den Klängen' })).toBeVisible()
})

test('„3 Min durchatmen“ starts coherent breathing and becomes the last used', async ({ page }) => {
  await open(page, null)
  await page.getByRole('button', { name: 'Jetzt durchatmen' }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Kohärentes Atmen' })).toBeVisible()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  // Sofort gemerkt, nicht erst am Ende.
  expect((await stored(page)).lastUsed).toEqual({ kind: 'breath', pattern: 'kohaerent', minutes: 3 })
  await waitUntilRunning(page)
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expectBackOnHeute(page)
  await expect(lastUsedCard(page).getByText('Kohärentes Atmen · 3 Min', { exact: true })).toBeVisible()
  await expect(page.getByText('Heute ist ein guter Tag zum Anfangen.')).toBeVisible() // unter 60 s zählt nicht
  // Das Gemerkte übersteht ein Neuladen.
  await page.reload()
  await expect(lastUsedCard(page).getByText('Kohärentes Atmen · 3 Min', { exact: true })).toBeVisible()
})

test('„Erneut starten“ restarts exactly the stored timer', async ({ page }) => {
  // Die Timer-Einstellungen weichen bewusst ab: Gestartet wird, was zuletzt genutzt wurde.
  const lastUsed = { kind: 'timer', minutes: 5, intervalMin: 2, sound: 'regen', lead: false }
  const settings = { ...SETTINGS, timerSound: 'wald', timerLead: true, timer: { minutes: 30, intervalMin: 10 } }
  await open(page, dataOf(THREE_DAYS, lastUsed, settings))
  await expect(lastUsedCard(page).getByText('Timer · 5 Min', { exact: true })).toBeVisible()

  await lastUsedCard(page).getByRole('button', { name: 'Erneut starten' }).click()
  await expect(page.getByRole('heading', { name: 'Meditation · 5 Min' })).toBeVisible()
  // Ohne Vorlauf: keine Ankommen-Anzeige, die Restzeit von 5 Min läuft sofort.
  await expect(page.getByRole('timer')).toHaveText(/^(5:00|4:5\d)$/)
  await expect(page.getByText('Ankommen', { exact: true })).toHaveCount(0)
  await waitUntilRunning(page)

  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expectBackOnHeute(page)

  // Weder „Zuletzt genutzt“ noch die Einstellungen ändern sich durch den Neustart.
  const data = await stored(page)
  expect(data.lastUsed).toEqual(lastUsed)
  expect(data.settings).toEqual(settings)
  expect(data.sessions).toEqual(THREE_DAYS)
  await expect(lastUsedCard(page).getByText('Timer · 5 Min', { exact: true })).toBeVisible()
})

test('„Erneut starten“ restarts exactly the stored breathing exercise', async ({ page }) => {
  const lastUsed = { kind: 'breath', pattern: 'box', minutes: 5 }
  await open(page, dataOf(THREE_DAYS, lastUsed))
  await expect(lastUsedCard(page).getByText('Box-Atmung · 5 Min', { exact: true })).toBeVisible()

  await lastUsedCard(page).getByRole('button', { name: 'Erneut starten' }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Box-Atmung' })).toBeVisible()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await waitUntilRunning(page)
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expectBackOnHeute(page)
  expect((await stored(page)).lastUsed).toEqual(lastUsed)
  await expect(lastUsedCard(page).getByText('Box-Atmung · 5 Min', { exact: true })).toBeVisible()
})

test('a single day reads in the singular', async ({ page }) => {
  await open(page, dataOf([session('only', '2026-10-21T07:30:00+02:00')]))
  await expect(page.getByText('1 Tag in Folge', { exact: true })).toBeVisible()
  // Sitzungen allein ergeben noch kein „Zuletzt genutzt“: Das merkt sich erst ein Start aus der App.
  await expect(page.getByRole('heading', { level: 2, name: 'Zuletzt genutzt' })).toHaveCount(0)
})

test('the streak runs from yesterday while today has no session yet', async ({ page }) => {
  await open(page, dataOf([session('s-19', '2026-10-19T07:30:00+02:00'), session('s-20', '2026-10-20T07:30:00+02:00')]))
  await expect(page.getByText('2 Tage in Folge', { exact: true })).toBeVisible()
})

test('a gap in the days ends the streak', async ({ page }) => {
  await open(page, dataOf([session('s-18', '2026-10-18T07:30:00+02:00'), session('s-21', '2026-10-21T07:30:00+02:00')]))
  await expect(page.getByText('1 Tag in Folge', { exact: true })).toBeVisible()
})

test('the streak counts local days, not UTC days', async ({ page }) => {
  // 23:30 und 00:30 (Berlin) liegen in UTC beide am 19.; der 21. um 00:10 (Berlin) noch am 20.
  await open(
    page,
    dataOf([
      session('late-19', '2026-10-19T23:30:00+02:00'),
      session('early-20', '2026-10-20T00:30:00+02:00'),
      session('early-21', '2026-10-21T00:10:00+02:00'),
    ]),
  )
  await expect(page.getByText('3 Tage in Folge', { exact: true })).toBeVisible()
})

test('touch targets are at least 48px and the cards stay within the screen', async ({ page }) => {
  await open(page, dataOf(THREE_DAYS, { kind: 'breath', pattern: '478', minutes: 1 }))
  const targets = [
    page.getByRole('button', { name: 'Erneut starten' }),
    page.getByRole('button', { name: 'Jetzt durchatmen' }),
    page.getByRole('button', { name: 'Zu den Klängen' }),
  ]
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded()
    const box = (await target.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.width).toBeGreaterThanOrEqual(48)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('the card for the sounds still leads to the sounds', async ({ page }) => {
  await open(page, null)
  await page.getByRole('button', { name: 'Zu den Klängen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})
