import { test, expect, type Locator, type Page } from '@playwright/test'
import { doubleTap } from './taps'

// Reiter „Energie“ mit Akku-Karte und Check-in-Blatt (Spec M9 §3.2, §3.3). Der Browser läuft in Berlin und die
// Uhr steht fest, so hängt kein Test von Zeitzone und Tageszeit des Rechners ab. Alle Werte sind ausgedachte Testdaten.
test.use({ timezoneId: 'Europe/Berlin' })
const NOW = new Date('2026-10-21T14:00:00+02:00')

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Wie voll ist dein Akku?' })
const akkuCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Dein Akku', exact: true }) })
// Ein Punkt der Zeile, z. B. dot(page, 'Geist', 2, 'schwach') = „Geist: 2 von 5, schwach“.
const dot = (page: Page, area: string, n: number, word: string) => dialog(page).getByRole('radio', { name: `${area}: ${n} von 5, ${word}`, exact: true })

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

// addInitScript läuft bei jeder Navigation; ein Merker in sessionStorage lässt es nur einmal je Test säen,
// damit Änderungen im Test ein Neuladen überstehen.
async function open(page: Page, { now = NOW, checkins }: { now?: Date; checkins?: object[] } = {}) {
  await page.clock.setFixedTime(now)
  if (checkins) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, energyCheckins: checkins }))
  }
  await page.goto('./')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
}

async function openSheet(page: Page) {
  await akkuCard(page).getByRole('button', { name: 'Check-in', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  // Punkte und Knöpfe nehmen Tipps erst kurz nach dem Einblenden an (Schutz vor dem Doppeltipp); hier ist es so weit.
  await expect(dialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
}

const checkin = (id: string, at: string, levels: [number, number, number, number]) => ({
  id,
  at,
  levels: { koerper: levels[0], gefuehl: levels[1], geist: levels[2], sinn: levels[3] },
})

test('a check-in is saved only once all four areas are set, and the battery card then shows it', async ({ page }) => {
  await open(page)
  await expect(nav(page).getByRole('button', { name: 'Energie' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Noch kein Check-in heute')).toBeVisible()
  // Ohne frischen Check-in: die Frage und „Check-in“, keine Akkus.
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toBeVisible()
  await expect(akkuCard(page).getByRole('listitem')).toHaveCount(0)
  await expect(akkuCard(page).getByRole('button', { name: 'Neuer Check-in' })).toHaveCount(0)

  await openSheet(page)
  await expect(dialog(page).getByText('Ein Tipp je Bereich, 1 = leer, 5 = voll.')).toBeVisible()
  // Vier Zeilen in fester Reihenfolge, je mit Leitfrage, fünf Punkten und noch ohne Wahl.
  await expect(dialog(page).getByRole('radiogroup')).toHaveCount(4)
  for (const [area, question] of [
    ['Körper', 'wach, kräftig, ausgeruht?'],
    ['Gefühl', 'ruhig, zuversichtlich, verbunden?'],
    ['Geist', 'klar, fokussiert, aufnahmefähig?'],
    ['Sinn', 'ausgerichtet, motiviert, im Einklang?'],
  ]) {
    await expect(dialog(page).getByRole('radiogroup', { name: area, exact: true }).getByRole('radio')).toHaveCount(5)
    await expect(dialog(page).getByText(question)).toBeVisible()
  }
  await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
  const save = dialog(page).getByRole('button', { name: 'Speichern' })
  await expect(save).toBeDisabled()

  // Erst mit dem vierten Bereich wird „Speichern“ frei.
  await dot(page, 'Körper', 4, 'gut').click()
  await expect(dot(page, 'Körper', 4, 'gut')).toHaveAttribute('aria-checked', 'true')
  await dot(page, 'Gefühl', 3, 'mittel').click()
  await dot(page, 'Geist', 1, 'leer').click()
  await expect(save).toBeDisabled()
  await dot(page, 'Sinn', 3, 'mittel').click()
  await expect(save).toBeEnabled()
  // Ein anderer Punkt ersetzt die Wahl der Zeile.
  await dot(page, 'Sinn', 5, 'voll').click()
  await expect(dot(page, 'Sinn', 5, 'voll')).toHaveAttribute('aria-checked', 'true')
  await expect(dot(page, 'Sinn', 3, 'mittel')).toHaveAttribute('aria-checked', 'false')
  await dot(page, 'Sinn', 3, 'mittel').click()

  await save.click()
  await expect(dialog(page)).toHaveCount(0)

  // Gespeichert mit der Uhrzeit des Tipps, genau ein Eintrag.
  const data = await stored(page)
  expect(data.energyCheckins).toHaveLength(1)
  expect(data.energyCheckins[0].levels).toEqual({ koerper: 4, gefuehl: 3, geist: 1, sinn: 3 })
  expect(data.energyCheckins[0].at).toBe(NOW.toISOString())

  // Die Karte zeigt den Check-in: Kopfzeile, vier Akkus mit Name und Stufe, „Neuer Check-in“.
  await expect(page.getByText('Letzter Check-in vor 1 Min')).toBeVisible()
  await expect(akkuCard(page).getByRole('listitem')).toHaveCount(4)
  for (const [area, value] of [['Körper', '4 von 5'], ['Gefühl', '3 von 5'], ['Geist', '1 von 5'], ['Sinn', '3 von 5']]) {
    await expect(akkuCard(page).getByRole('listitem').filter({ hasText: area })).toContainText(value)
  }
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toHaveCount(0)
  await expect(akkuCard(page).getByRole('button', { name: 'Check-in', exact: true })).toHaveCount(0)

  // „Neuer Check-in“ öffnet das Blatt wieder, und jede Zeile beginnt leer.
  await akkuCard(page).getByRole('button', { name: 'Neuer Check-in' }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
  await expect(dialog(page).getByRole('button', { name: 'Speichern' })).toBeDisabled()
})

test('"Später", the back gesture, Escape and a tap beside the sheet close it without saving', async ({ page }) => {
  await open(page)
  const url = page.url()
  const unsaved = async () => expect((await stored(page))?.energyCheckins).toBeUndefined()

  // Später
  await openSheet(page)
  await dot(page, 'Körper', 2, 'schwach').click()
  await dialog(page).getByRole('button', { name: 'Später' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await unsaved()

  // Zurück-Geste: Das Blatt schließt, die App bleibt auf dem Reiter.
  await openSheet(page)
  await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0) // jedes Öffnen beginnt leer
  await dot(page, 'Gefühl', 4, 'gut').click()
  await page.goBack()
  await expect(dialog(page)).toHaveCount(0)
  expect(page.url()).toBe(url)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await unsaved()

  // Escape
  await openSheet(page)
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await unsaved()

  // Tippen daneben (oberhalb des Blatts)
  await openSheet(page)
  await page.mouse.click(8, 8)
  await expect(dialog(page)).toHaveCount(0)
  await unsaved()

  await expect(page.getByText('Noch kein Check-in heute')).toBeVisible()
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toBeVisible()
})

test('a tab change closes the sheet without saving', async ({ page }) => {
  await open(page)
  await openSheet(page)
  await dot(page, 'Körper', 2, 'schwach').click()
  // Das Blatt liegt über der Leiste; mit der Tastatur bleibt sie erreichbar.
  await nav(page).getByRole('button', { name: 'Atmen' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  await expect(dialog(page)).toHaveCount(0)
  expect((await stored(page))?.energyCheckins).toBeUndefined()
  // Zurück auf „Energie“ beginnt wieder leer.
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await openSheet(page)
  await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
})

test('a check-in from 23:30 is still fresh at 1:00, but the header says there is none today', async ({ page }) => {
  await open(page, {
    now: new Date('2026-10-21T01:00:00+02:00'),
    checkins: [checkin('c-1', '2026-10-20T23:30:00+02:00', [4, 3, 2, 5])],
  })
  await expect(page.getByText('Noch kein Check-in heute')).toBeVisible()
  await expect(page.getByText(/Letzter Check-in vor/)).toHaveCount(0)
  // Frisch (1,5 Std. alt): die vier Akkus statt der Frage.
  await expect(akkuCard(page).getByRole('listitem')).toHaveCount(4)
  for (const [area, value] of [['Körper', '4 von 5'], ['Gefühl', '3 von 5'], ['Geist', '2 von 5'], ['Sinn', '5 von 5']]) {
    await expect(akkuCard(page).getByRole('listitem').filter({ hasText: area })).toContainText(value)
  }
  await expect(akkuCard(page).getByRole('button', { name: 'Neuer Check-in' })).toBeVisible()
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toHaveCount(0)
})

test('the header counts minutes and hours, and a check-in older than three hours is not fresh', async ({ page }) => {
  await open(page, { checkins: [checkin('c-1', '2026-10-21T10:30:00+02:00', [3, 3, 3, 3])] })
  // 3,5 Std. alt: von heute, aber nicht mehr frisch.
  await expect(page.getByText('Letzter Check-in vor 3 Std.')).toBeVisible()
  await expect(akkuCard(page).getByRole('listitem')).toHaveCount(0)
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toBeVisible()
})

test('the level dots form a radio group: names, targets of 44px and arrow keys', async ({ page }) => {
  await open(page)
  await openSheet(page)
  const geist = dialog(page).getByRole('radiogroup', { name: 'Geist', exact: true })
  const words = ['leer', 'schwach', 'mittel', 'gut', 'voll']
  for (const [i, radio] of (await geist.getByRole('radio').all()).entries()) {
    await expect(radio).toHaveAccessibleName(`Geist: ${i + 1} von 5, ${words[i]}`)
    await expect(radio).toHaveAttribute('aria-checked', 'false')
  }
  for (const radio of await dialog(page).getByRole('radio').all()) {
    const box = (await radio.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  // Ohne Wahl ist nur der erste Punkt der Zeile ein Tabstopp (Roving tabindex), das Wort steht rechts in der Zeile.
  const row: Locator = dialog(page).locator('.row').filter({ has: page.getByRole('radiogroup', { name: 'Geist', exact: true }) })
  await expect(row).toContainText('–')
  await expect(geist.getByRole('radio').first()).toHaveAttribute('tabindex', '0')
  await expect(geist.getByRole('radio').nth(1)).toHaveAttribute('tabindex', '-1')

  // Pfeile wählen und nehmen den Fokus mit; Pos1 und Ende springen an die Enden.
  await dot(page, 'Geist', 1, 'leer').focus()
  await page.keyboard.press('ArrowRight')
  await expect(dot(page, 'Geist', 2, 'schwach')).toHaveAttribute('aria-checked', 'true')
  await expect(dot(page, 'Geist', 2, 'schwach')).toBeFocused()
  await expect(row).toContainText('schwach')
  await page.keyboard.press('End')
  await expect(dot(page, 'Geist', 5, 'voll')).toBeFocused()
  await expect(dot(page, 'Geist', 5, 'voll')).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowRight') // vom letzten Punkt zurück zum ersten
  await expect(dot(page, 'Geist', 1, 'leer')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(dot(page, 'Geist', 5, 'voll')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(dot(page, 'Geist', 1, 'leer')).toBeFocused()
  // Nur ein Punkt der Zeile ist gewählt; die anderen Zeilen bleiben leer.
  await expect(geist.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1)
  await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1)
  // Gewählt heißt: die Punkte bis zur Stufe sind gefüllt.
  await dot(page, 'Geist', 3, 'mittel').click()
  await expect(geist.locator('[role="radio"].filled')).toHaveCount(3)
})

test.describe('on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('nothing sticks out sideways, even with 130% text, and "Speichern" stays reachable', async ({ page }) => {
    await open(page, { checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [4, 3, 2, 5])] })
    const sticksOut = (selector: string) =>
      page.locator(selector).evaluate((root) =>
        [...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5).length,
      )
    const pageScrolls = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(await sticksOut('.screen')).toBe(0)
    expect(await pageScrolls()).toBe(false)
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    expect(await sticksOut('.screen')).toBe(0)
    expect(await pageScrolls()).toBe(false)

    await akkuCard(page).getByRole('button', { name: 'Neuer Check-in' }).click()
    await expect(dialog(page)).toBeVisible()
    expect(await sticksOut('[role="dialog"]')).toBe(0)
    await dot(page, 'Sinn', 5, 'voll').scrollIntoViewIfNeeded()
    await dialog(page).getByRole('button', { name: 'Speichern' }).scrollIntoViewIfNeeded()
    await expect(dialog(page).getByRole('button', { name: 'Speichern' })).toBeInViewport()
    await expect(dialog(page).getByRole('button', { name: 'Später' })).toBeVisible()
  })

  // Ein Doppeltipp auf „Check-in“: Der zweite Tipp trifft dort, wo sich gerade das Blatt einblendet (auf 360 × 640
  // liegt an dieser Stelle eine Punktereihe). Er darf weder das Blatt schließen noch einen Punkt wählen.
  test('a double tap on "Check-in" leaves the sheet open with no dot checked', async ({ page }) => {
    await open(page)
    await doubleTap(page, akkuCard(page).getByRole('button', { name: 'Check-in', exact: true }), 0.5)
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
    // Kurz danach nehmen die Punkte Tipps an.
    await dot(page, 'Körper', 4, 'gut').click()
    await expect(dot(page, 'Körper', 4, 'gut')).toHaveAttribute('aria-checked', 'true')
  })
})
