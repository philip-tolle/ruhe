import { test, expect, type Page } from '@playwright/test'

// Fokus-Sprints, die zählen (Spec M9 §3.6, §5.2): Sie laufen mindestens 5 Minuten auf der Audio-Uhr, die sich im
// Produktions-Build nicht vorspulen lässt, und eine feste Uhr gehört nicht zu einem laufenden Programm (siehe
// energie.spec.ts). Darum liegen diese Tests in einer eigenen Datei und laufen parallel zueinander und zu den anderen
// Dateien; jeder dauert gut fünf Minuten. Karte, kurze Läufe und „Deine Woche“ stehen in energie.spec.ts, das Ende mit
// dem Pausen-Vorschlag („Starten“) in tests/browser/sprint-done.test.ts.
test.describe.configure({ mode: 'parallel' })

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const sprintCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Fokus-Sprint', exact: true }) })
const player = (page: Page) => page.getByRole('dialog', { name: 'Fokus-Sprint', exact: true })

// Wartet Bild für Bild, bis die Restzeit im Player höchstens `seconds` Sekunden zeigt (die Anzeige steht jeweils eine
// Sekunde und rundet auf). „Höchstens“ statt „genau“: Ein verpasstes Bild würde sonst bis zum Zeitlimit warten.
const untilRemaining = (page: Page, seconds: number) =>
  page.waitForFunction(
    (max) => {
      const text = document.querySelector('[role="dialog"] [role="timer"]')?.textContent?.trim()
      if (!text) return false
      return text.split(':').reduce((sum, part) => sum * 60 + Number(part), 0) <= max
    },
    seconds,
    { timeout: 330_000 },
  )

// Startet einen Sprint von 25 Minuten und beendet ihn nach gut 5 Minuten (Restzeit höchstens 19:55): Er zählt, und das
// Ende erscheint.
async function runShortSprint(page: Page, task: string) {
  await page.goto('./')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  const card = sprintCard(page)
  await card.getByRole('radio', { name: '25 Min', exact: true }).click()
  await card.getByLabel('Hintergrund', { exact: true }).selectOption({ label: 'Regen' })
  await card.getByLabel('Woran arbeitest du?').fill(task)
  await card.getByRole('button', { name: 'Sprint starten', exact: true }).click()

  await expect(player(page).getByText(task, { exact: true })).toBeVisible()
  await expect(player(page).getByRole('timer')).toHaveText('25:00')
  await untilRemaining(page, 19 * 60 + 55)
  await player(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(player(page).getByRole('heading', { level: 2, name: 'Sprint geschafft' })).toBeVisible()
}

test('a sprint of 5 minutes counts: remembered choice, summary with break suggestion, saved entry', async ({ page }) => {
  test.setTimeout(420_000)
  await page.goto('./')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  // Die Standardwahl, bevor etwas gemerkt ist.
  await expect(sprintCard(page).getByRole('radio', { name: '50 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(sprintCard(page).getByLabel('Hintergrund', { exact: true })).toHaveValue('kaffee-und-notizen')
  expect((await stored(page))?.focusSprints).toBeUndefined()

  await runShortSprint(page, 'Kurskonzept')

  // Das Ende: tatsächliche Zeit (5 Min, nicht die geplanten 25), Pausen-Vorschlag nach einem 25-Minuten-Sprint ohne
  // Check-in, dazu „Check-in“ und „Fertig“.
  const end = player(page)
  await expect(end.getByText('5 Min Fokus', { exact: true })).toBeVisible()
  await expect(end.getByText('Pausen-Vorschlag', { exact: true })).toBeVisible()
  await expect(end.getByText('Augen-Pause', { exact: true })).toBeVisible()
  await expect(end.getByText('Geist · 2 Min', { exact: true })).toBeVisible()
  await expect(end.getByRole('button', { name: 'Starten', exact: true })).toBeVisible()
  await expect(end.getByRole('button', { name: 'Check-in', exact: true })).toBeVisible()
  await expect(end.getByRole('button', { name: 'Fertig', exact: true })).toBeEnabled()

  await end.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(player(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0)

  // Gespeichert: ein Sprint mit gewählter Länge, Vorhaben und tatsächlicher Zeit; weder Sitzung noch Hack-Lauf.
  const data = await stored(page)
  expect(data.focusSprints).toHaveLength(1)
  expect(data.focusSprints[0]).toMatchObject({ planned: 25, task: 'Kurskonzept' })
  expect(data.focusSprints[0].seconds).toBeGreaterThanOrEqual(305)
  expect(data.focusSprints[0].seconds).toBeLessThan(330)
  expect(data.sessions).toEqual([])
  expect(data.hackRuns).toBeUndefined()
  // Länge und Hintergrund gelten beim nächsten Mal wieder, das Vorhaben nicht.
  expect(data.settings.focus).toEqual({ minutes: 25, sound: 'regen' })
  await page.reload()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(sprintCard(page).getByRole('radio', { name: '25 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(sprintCard(page).getByLabel('Hintergrund', { exact: true })).toHaveValue('regen')
  await expect(sprintCard(page).getByLabel('Woran arbeitest du?')).toHaveValue('')
})

test('"Check-in" at the end of a sprint closes the player and opens the check-in sheet', async ({ page }) => {
  test.setTimeout(420_000)
  await runShortSprint(page, 'Ein anderes Vorhaben')

  await player(page).getByRole('button', { name: 'Check-in', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Wie voll ist dein Akku?' })
  await expect(sheet).toBeVisible()
  await expect(player(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0) // das Blatt ist keine Player-Ebene: die App darunter ist wieder bedienbar
  // Der Sprint ist trotzdem gespeichert, das Blatt beginnt leer.
  expect((await stored(page)).focusSprints).toHaveLength(1)
  await expect(sheet.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Später' }).click()
  await expect(sheet).toHaveCount(0)
})
