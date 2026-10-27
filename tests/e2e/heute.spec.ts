import { readFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'
import { doubleTap } from './taps'

// Sitzungen und Zeiten tragen ihren Offset und der Browser läuft in Berlin; so hängt kein Test
// von der Zeitzone des Rechners ab. „Heute“ ist der 21.10.2026, 20 Uhr; die Tests zum Vorschlag am
// Morgen rücken die Uhr auf 8 Uhr.
test.use({ timezoneId: 'Europe/Berlin' })
const NOW = new Date('2026-10-21T20:00:00+02:00')
const MORNING = new Date('2026-10-21T08:00:00+02:00')

// Die Meditationen sind noch Platzhalter und werden später durch echte Aufnahmen ersetzt: Die Tests
// leiten Titel und Beschreibungen aus dem Katalog ab und verlassen sich nie auf genaue Längen.
type Entry = { id: string; title: string; category: string; description: string }
const CATALOG: Entry[] = JSON.parse(readFileSync('src/content/meditations.json', 'utf8')).meditations
// Die zwei Themen des Vorschlags je Tageszeit (Spec M7 §6).
const PAIR = { morgen: ['fokus', 'alltag'], tag: ['stress', 'gefuehle'], abend: ['achtsamkeit', 'mitgefuehl'] } as const
const inPair = (mood: keyof typeof PAIR) => CATALOG.filter((m) => (PAIR[mood] as readonly string[]).includes(m.category))
const ANKOMMEN = CATALOG.find((m) => m.id === 'ankommen-im-atem')!

const session = (id: string, start: string) => ({ id, start, kind: 'timer', ref: 'timer', seconds: 600 })
const THREE_DAYS = [
  session('s-19', '2026-10-19T07:30:00+02:00'),
  session('s-20', '2026-10-20T07:30:00+02:00'),
  session('s-21', '2026-10-21T07:30:00+02:00'),
]
const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }
const dataOf = (sessions: object[], lastUsed?: object, settings: object = SETTINGS, extra: object = {}) => ({
  version: 1,
  sessions,
  settings,
  ...(lastUsed ? { lastUsed } : {}),
  ...extra,
})
// Ein Energie-Check-in (ausgedachte Werte) und die Daten, die ihn enthalten.
const checkin = (id: string, at: string, levels: [number, number, number, number]) => ({
  id,
  at,
  levels: { koerper: levels[0], gefuehl: levels[1], geist: levels[2], sinn: levels[3] },
})
const withCheckin = (at: string, levels: [number, number, number, number]) => dataOf([], undefined, SETTINGS, { energyCheckins: [checkin('c-1', at, levels)] })

// addInitScript läuft bei jeder Navigation (auch Neuladen); ein Merker in sessionStorage lässt es nur
// einmal je Test säen, damit Änderungen im Test ein Neuladen überstehen.
async function open(page: Page, data: object | null, now = NOW, greeting = 'Guten Abend') {
  await page.clock.setFixedTime(now)
  if (data) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify(data))
  }
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(greeting)
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const cardOf = (page: Page, heading: string) =>
  page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })
const lastUsedCard = (page: Page) => cardOf(page, 'Zuletzt genutzt')
const suggestionCard = (page: Page) => cardOf(page, 'Vorschlag des Tages')
const activitiesCard = (page: Page) => cardOf(page, 'Aktivitäten')
// „Dein Akku“ ohne frischen Check-in ist eine Karte mit Überschrift; mit frischem Check-in ein einziger Knopf (Spec M9 §3.7).
const akkuCard = (page: Page) => cardOf(page, 'Dein Akku')
const akkuButton = (page: Page) => page.getByRole('button', { name: /am niedrigsten · Jetzt-Reset/ })
const checkInDialog = (page: Page) => page.getByRole('dialog', { name: 'Wie voll ist dein Akku?' })
// Die Zeilen der Karte „Aktivitäten“; die Reiterleiste hat Knöpfe mit denselben Anfängen („Meditieren“, „Klänge“).
const meditierenRow = (page: Page) => activitiesCard(page).getByRole('button', { name: /^Meditieren/ })
const atemuebungRow = (page: Page) => activitiesCard(page).getByRole('button', { name: /^Atemübung/ })
const klaengeRow = (page: Page) => activitiesCard(page).getByRole('button', { name: /^Klänge/ })

// Der Player erscheint, sobald der Start angestoßen ist; eingeplant wird erst, wenn die Klangschale
// geladen ist. Wer vorher „Beenden“ tippt, beendet nichts Eingeplantes und bekommt keinen Abschluss.
// Läuft der Countdown weiter, ist die Sitzung eingeplant.
async function waitUntilRunning(page: Page) {
  const countdown = page.getByRole('timer')
  const first = (await countdown.textContent())!
  await expect(countdown).not.toHaveText(first)
}

// Zurück auf „Heute“: Reiter aktiv, Begrüßung da, kein Player mehr.
async function expectBackOnHeute(page: Page, greeting = 'Guten Abend') {
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Heute' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(greeting)
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

// Der Player der geführten Meditation mit ihrem Titel; „Beenden“ führt über den Abschluss zurück nach „Heute“.
const guidedPlayer = (page: Page) => page.getByRole('dialog', { name: 'Geführte Meditation' })

async function endGuided(page: Page, greeting?: string) {
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Schön, dass du dir die Zeit genommen hast.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expectBackOnHeute(page, greeting)
}

test('streak and quick start', async ({ page }) => {
  await open(page, dataOf(THREE_DAYS, { kind: 'breath', pattern: '478', minutes: 1 }))
  await expect(page.getByText('3 Tage in Folge', { exact: true })).toBeVisible()
  await expect(page.getByText('Heute ist ein guter Tag zum Anfangen.')).toHaveCount(0)

  const last = lastUsedCard(page)
  await expect(last.getByText('4-7-8 · 1 Min', { exact: true })).toBeVisible()
  await expect(last.getByRole('button', { name: 'Erneut starten' })).toBeVisible()

  // Reihenfolge: Dein Akku (ohne frischen Check-in), Vorschlag des Tages, Zuletzt genutzt, Aktivitäten.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Dein Akku', 'Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten'])
  await expect(atemuebungRow(page)).toContainText('3 Min kohärent atmen')

  await atemuebungRow(page).click()
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
  // Nichts genutzt: „Zuletzt genutzt“ bietet „Ankommen im Atem“ an, und es gibt nichts zu wiederholen.
  const last = lastUsedCard(page)
  await expect(last.getByText(/^Ankommen im Atem · \d+ Min$/)).toBeVisible()
  await expect(last.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Erneut starten' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Dein Akku', 'Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten'])
  await expect(meditierenRow(page)).toBeVisible()
  await expect(atemuebungRow(page)).toBeVisible()
  await expect(klaengeRow(page)).toBeVisible()
})

// ── Karte „Dein Akku“ (Spec M9 §3.7) ────────────────────────────────────────────────────────────────────────────

// Die Karte steht zwischen Begrüßung und „Vorschlag des Tages“.
async function expectBetweenGreetingAndSuggestion(page: Page, akku: Locator) {
  const greeting = (await page.getByRole('heading', { level: 1 }).boundingBox())!
  const box = (await akku.boundingBox())!
  const suggestion = (await suggestionCard(page).boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(greeting.y + greeting.height)
  expect(box.y + box.height).toBeLessThanOrEqual(suggestion.y)
}

test('without a fresh check-in the battery card asks, sits above the suggestion and opens the sheet right on „Heute“', async ({ page }) => {
  await open(page, null)
  const akku = akkuCard(page)
  await expect(akku.getByText('Wie voll ist dein Akku?', { exact: true })).toBeVisible()
  await expectBetweenGreetingAndSuggestion(page, akku)
  // Die übrigen Karten bleiben, jede einmal.
  for (const heading of ['Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten']) await expect(cardOf(page, heading)).toHaveCount(1)
  await expect(akku.getByRole('listitem')).toHaveCount(0)

  await akku.getByRole('button', { name: 'Check-in', exact: true }).click()
  await expect(checkInDialog(page)).toBeVisible()
  // Das Blatt öffnet sich auf „Heute“; der Reiter wechselt nicht.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Abend')
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
  // „Später“ schließt, und die Karte ist unverändert.
  await expect(checkInDialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
  await checkInDialog(page).getByRole('button', { name: 'Später' }).click()
  await expect(checkInDialog(page)).toHaveCount(0)
  await expect(akku.getByText('Wie voll ist dein Akku?', { exact: true })).toBeVisible()
})

test('with a fresh check-in the battery card is one button with four batteries, names the weakest area and opens „Energie“', async ({ page }) => {
  // Eine Stunde alt: Geist ist am niedrigsten.
  await open(page, withCheckin('2026-10-21T19:00:00+02:00', [4, 3, 2, 4]))
  const button = akkuButton(page)
  await expect(button).toHaveCount(1)
  await expect(button).toContainText('Geist am niedrigsten · Jetzt-Reset')
  await expect(button.locator('.battery.mini')).toHaveCount(4)
  await expect(button.locator('.cell.on')).toHaveCount(4 + 3 + 2 + 4)
  // Die Stufen stehen für Hilfstechnik im Namen des Knopfs.
  await expect(button).toHaveAccessibleName(/Körper 4 von 5, Gefühl 3 von 5, Geist 2 von 5, Sinn 4 von 5/)
  await expectBetweenGreetingAndSuggestion(page, button)
  // Die schmale Karte ersetzt die Frage: weder „Check-in“ noch eine Überschrift „Dein Akku“.
  await expect(page.getByRole('button', { name: 'Check-in', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Vorschlag des Tages', 'Zuletzt genutzt', 'Aktivitäten'])

  await button.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Energie' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 2, name: 'Jetzt-Reset', exact: true })).toBeVisible()
})

test('a check-in older than three hours does not count: the card asks again', async ({ page }) => {
  await open(page, withCheckin('2026-10-21T16:30:00+02:00', [1, 1, 1, 1])) // 3,5 Std. alt
  await expect(akkuButton(page)).toHaveCount(0)
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?', { exact: true })).toBeVisible()
})

test('a saved check-in turns the card into the compact one without leaving „Heute“', async ({ page }) => {
  await open(page, null)
  await akkuCard(page).getByRole('button', { name: 'Check-in', exact: true }).click()
  await expect(checkInDialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
  for (const [area, n, word] of [['Körper', 4, 'gut'], ['Gefühl', 3, 'mittel'], ['Geist', 5, 'voll'], ['Sinn', 1, 'leer']] as const) {
    await checkInDialog(page).getByRole('radio', { name: `${area}: ${n} von 5, ${word}`, exact: true }).click()
  }
  await checkInDialog(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(checkInDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Abend')
  await expect(akkuButton(page)).toContainText('Sinn am niedrigsten · Jetzt-Reset')
})

// Auf „Heute“ liegt „Check-in“ nicht im Blatt, sondern kann ÜBER ihm liegen: Der zweite Tipp eines Doppeltipps trifft dann die
// Fläche daneben, die das Blatt schließt. Das Blatt muss offen bleiben und darf keinen Punkt gewählt haben (Ruling R14).
// Auf 360 × 640 und 412 × 839 deckt das Blatt den Knopf noch ab (dort trifft der zweite Tipp einen Punkt); ab etwa 1000 px
// Höhe, auf Tablets und Falthandys, liegt der Knopf darüber. `above`: Der Test prüft, dass es so ist.
const SIZES = [
  { name: 'at 360 × 640', viewport: { width: 360, height: 640 }, above: false },
  { name: 'at the default size', viewport: null, above: false },
  { name: 'on a tall screen (412 × 1100)', viewport: { width: 412, height: 1100 }, above: true },
] as const
for (const { name, viewport, above } of SIZES) {
  test.describe(name, () => {
    if (viewport) test.use({ viewport })

    test('a double tap on „Check-in“ leaves the sheet open with no dot checked', async ({ page }) => {
      await open(page, null)
      const trigger = akkuCard(page).getByRole('button', { name: 'Check-in', exact: true })
      const triggerBox = (await trigger.boundingBox())!
      await doubleTap(page, trigger, 0.5)
      await expect(checkInDialog(page)).toBeVisible()
      await expect(checkInDialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
      if (above) expect(triggerBox.y + triggerBox.height).toBeLessThan((await checkInDialog(page).boundingBox())!.y)
      // Kurz danach nehmen die Punkte Tipps an.
      await expect(checkInDialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
      await checkInDialog(page).getByRole('radio', { name: 'Körper: 4 von 5, gut', exact: true }).click()
      await expect(checkInDialog(page).getByRole('radio', { name: 'Körper: 4 von 5, gut', exact: true })).toHaveAttribute('aria-checked', 'true')
    })
  })
}

test.describe('the battery card on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  for (const [name, data] of [
    ['asking', null],
    ['compact', withCheckin('2026-10-21T19:00:00+02:00', [2, 3, 4, 5])],
  ] as const) {
    test(`${name}: the button is at least 44 px, and nothing scrolls sideways, even with 130% text`, async ({ page }) => {
      await open(page, data)
      const target = name === 'asking' ? akkuCard(page).getByRole('button', { name: 'Check-in', exact: true }) : akkuButton(page)
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
      const scrollsSideways = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(await scrollsSideways()).toBe(false)
      await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
      expect(await scrollsSideways()).toBe(false)
      // Nur die Karte selbst: Die gemalten Waschungen der anderen Karten ragen aus ihrem Rahmen und werden dort abgeschnitten.
      const card = name === 'asking' ? akkuCard(page) : akkuButton(page)
      const sticksOut = await card.evaluate((root) =>
        [root, ...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5).length,
      )
      expect(sticksOut).toBe(0)
    })
  }
})

test('the two quick-start cards of before are gone', async ({ page }) => {
  await open(page, null)
  await expect(page.getByRole('heading', { name: '3 Min durchatmen' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Zur Ruhe kommen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Jetzt durchatmen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zu den Klängen' })).toHaveCount(0)
})

test('„Aktivitäten“: three rows with painting, title and subtitle, each one button', async ({ page }) => {
  await open(page, null)
  const rows = activitiesCard(page).getByRole('button')
  await expect(rows).toHaveCount(3)
  // Der Name des Knopfs ist der sichtbare Text; das Motiv ist Schmuck und trägt nichts bei.
  await expect(rows.nth(0)).toHaveAccessibleName('Meditieren Geführt oder mit Timer')
  await expect(rows.nth(1)).toHaveAccessibleName('Atemübung 3 Min kohärent atmen')
  await expect(rows.nth(2)).toHaveAccessibleName('Klänge Zur Ruhe kommen')

  for (const [index, motiv] of ['meditieren', 'atmen', 'klaenge'].entries()) {
    const row = rows.nth(index)
    await expectMotiv(row.locator('img'), motiv, 56)
    // Layout-Höhe (nicht boundingBox): Beim Einblenden des Bildschirms schwankt diese um Bruchteile eines Pixels.
    expect(await row.evaluate((el: HTMLElement) => el.offsetHeight)).toBeGreaterThanOrEqual(72)
    // Die Zeile ist die ganze Breite der Karte: die ganze Fläche ist der Knopf.
    const box = (await row.boundingBox())!
    const card = (await activitiesCard(page).boundingBox())!
    expect(box.width).toBeGreaterThan(card.width - 60)
  }
})

test('„Meditieren“ in the activities leads to the Meditieren tab', async ({ page }) => {
  await open(page, null)
  await meditierenRow(page).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

for (const [time, mood, greeting] of [
  ['08:00', 'morgen', 'Guten Morgen'],
  ['14:00', 'tag', 'Guten Tag'],
  ['20:00', 'abend', 'Guten Abend'],
] as const) {
  test(`the suggestion shows the painting of the ${mood} (${time})`, async ({ page }) => {
    await open(page, null, new Date(`2026-10-21T${time}:00+02:00`), greeting)
    // Das Motiv; die Karte trägt daneben die Waschung (`img` in `.waschung`), ebenfalls Schmuck.
    const images = suggestionCard(page).locator('img.motiv')
    await expect(images).toHaveCount(1)
    await expectMotiv(images, `vorschlag-${mood}`, 96)
    // Das Motiv steht rechts vom Titel.
    const title = (await suggestionCard(page).locator('.name').boundingBox())!
    const image = (await images.boundingBox())!
    expect(image.x).toBeGreaterThanOrEqual(title.x + title.width)
  })
}

// Am 19. und am 21. Oktober kommt je Tageszeit eines der beiden Themen dran (Rotation in Katalog-Reihenfolge).
for (const [time, mood, greeting] of [
  ['08:00', 'morgen', 'Guten Morgen'],
  ['14:00', 'tag', 'Guten Tag'],
  ['20:00', 'abend', 'Guten Abend'],
] as const) {
  test(`the suggestion of the ${mood} (${time}) comes from its two themes`, async ({ page }) => {
    const categories = new Set<string>()
    for (const day of ['19', '21']) {
      await open(page, null, new Date(`2026-10-${day}T${time}:00+02:00`), greeting)
      const text = await suggestionCard(page).innerText()
      const meditation = inPair(mood).find((m) => text.includes(m.title))
      expect(meditation, `${day}.10.: kein Titel aus ${PAIR[mood].join(' oder ')} in: ${text}`).toBeDefined()
      categories.add(meditation!.category)
    }
    expect([...categories].sort()).toEqual([...PAIR[mood]].sort())
  })
}

test('„Atemübung“ in the activities starts coherent breathing and becomes the last used', async ({ page }) => {
  await open(page, null)
  await atemuebungRow(page).click()
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
  await expect(lastUsedCard(page).getByText(/^Ankommen im Atem · \d+ Min$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Erneut starten' })).toHaveCount(0)
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
    suggestionCard(page).getByRole('button', { name: 'Jetzt starten' }),
    page.getByRole('button', { name: 'Erneut starten' }),
    meditierenRow(page),
    atemuebungRow(page),
    klaengeRow(page),
  ]
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded()
    const box = (await target.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.width).toBeGreaterThanOrEqual(48)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('the row „Klänge“ still leads to the sounds', async ({ page }) => {
  await open(page, null)
  await klaengeRow(page).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})

test('the suggestion of the morning comes from „Fokus & Energie“ or „Achtsam im Alltag“ and starts the guided player', async ({ page }) => {
  await open(page, null, MORNING, 'Guten Morgen')
  const card = suggestionCard(page)

  // Der Vorschlag ist einer der sechs Titel aus Fokus und Alltag; welcher, hängt vom Kalendertag ab.
  const text = await card.innerText()
  const meditation = inPair('morgen').find((m) => text.includes(m.title))
  expect(meditation, `kein Titel aus Fokus oder Alltag in: ${text}`).toBeDefined()
  await expect(card.getByText(meditation!.description, { exact: true })).toBeVisible()
  await expect(card.getByText(/^\d+ Min$/)).toBeVisible()
  // Der Titel ist keine Überschrift: Unter der Begrüßung (h1) bleibt die Karte bei ihrer Überschrift (h2).
  await expect(card.getByRole('heading')).toHaveText(['Vorschlag des Tages'])

  await card.getByRole('button', { name: 'Jetzt starten' }).click()
  await expect(guidedPlayer(page).getByRole('heading', { name: meditation!.title, exact: true })).toBeVisible()
  // Sofort gemerkt, wie bei jedem Start einer geführten Meditation.
  expect((await stored(page)).lastUsed).toEqual({ kind: 'guided', id: meditation!.id })

  await endGuided(page, 'Guten Morgen')
  // Jetzt ist sie die zuletzt genutzte, und die Karte bietet an, sie zu wiederholen.
  const last = lastUsedCard(page)
  await expect(last.getByText(new RegExp(`^${meditation!.title} · \\d+ Min$`))).toBeVisible()
  await expect(last.getByRole('button', { name: 'Erneut starten' })).toBeVisible()
})

test('without any session „Zuletzt genutzt“ offers „Ankommen im Atem“', async ({ page }) => {
  await open(page, null)
  const last = lastUsedCard(page)
  await expect(last.getByText(new RegExp(`^${ANKOMMEN.title} · \\d+ Min$`))).toBeVisible()

  await last.getByRole('button', { name: 'Jetzt starten' }).click()
  await expect(guidedPlayer(page).getByRole('heading', { name: 'Ankommen im Atem', exact: true })).toBeVisible()
  expect((await stored(page)).lastUsed).toEqual({ kind: 'guided', id: ANKOMMEN.id })

  await endGuided(page)
  // Nun gibt es etwas zu wiederholen.
  await expect(last.getByRole('button', { name: 'Erneut starten' })).toBeVisible()
  await expect(last.getByRole('button', { name: 'Jetzt starten' })).toHaveCount(0)
})

test('a stored guided meditation is shown with its title and „Erneut starten“ opens it', async ({ page }) => {
  const lastUsed = { kind: 'guided', id: 'nach-einem-vollen-tag' }
  await open(page, dataOf(THREE_DAYS, lastUsed))
  const last = lastUsedCard(page)
  await expect(last.getByText(/^Nach einem vollen Tag · \d+ Min$/)).toBeVisible()

  await last.getByRole('button', { name: 'Erneut starten' }).click()
  await expect(guidedPlayer(page).getByRole('heading', { name: 'Nach einem vollen Tag', exact: true })).toBeVisible()
  await endGuided(page)
  expect((await stored(page)).lastUsed).toEqual(lastUsed)
  await expect(last.getByText(/^Nach einem vollen Tag · \d+ Min$/)).toBeVisible()
})

// Review Focus 5: eine der neuen Meditationen ist die zuletzt genutzte.
test('a stored new meditation („Gehmeditation“) is shown with its title and „Erneut starten“ opens it', async ({ page }) => {
  const lastUsed = { kind: 'guided', id: 'gehmeditation' }
  await open(page, dataOf(THREE_DAYS, lastUsed))
  const last = lastUsedCard(page)
  await expect(last.getByText('Gehmeditation · 10 Min', { exact: true })).toBeVisible()

  await last.getByRole('button', { name: 'Erneut starten' }).click()
  await expect(guidedPlayer(page).getByRole('heading', { name: 'Gehmeditation', exact: true })).toBeVisible()
  await endGuided(page)
  expect((await stored(page)).lastUsed).toEqual(lastUsed)
})

test('a stored meditation the catalog does not know falls back to „Ankommen im Atem“', async ({ page }) => {
  await open(page, dataOf(THREE_DAYS, { kind: 'guided', id: 'gibt-es-nicht-mehr' }))
  const last = lastUsedCard(page)
  await expect(last.getByText(new RegExp(`^${ANKOMMEN.title} · \\d+ Min$`))).toBeVisible()
  await expect(last.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
  await expect(last.getByRole('button', { name: 'Erneut starten' })).toHaveCount(0)
})

test('offline, a meditation that is not saved cannot start from „Heute“', async ({ page, context }) => {
  await open(page, null, MORNING, 'Guten Morgen')
  const suggestion = suggestionCard(page).getByRole('button', { name: 'Jetzt starten' })
  const fallback = lastUsedCard(page).getByRole('button', { name: 'Jetzt starten' })
  const hints = page.getByText('Nicht offline verfügbar', { exact: true })
  await expect(suggestion).toBeEnabled()
  await expect(hints).toHaveCount(0)

  await context.setOffline(true)
  // Nichts ist gespeichert: Beide geführten Starts sind gesperrt und sagen warum.
  await expect(hints).toHaveCount(2)
  await expect(suggestion).toBeDisabled()
  await expect(suggestion).toHaveAccessibleDescription('Nicht offline verfügbar')
  await expect(suggestionCard(page).getByText('Nicht offline verfügbar', { exact: true })).toBeVisible()
  await expect(fallback).toBeDisabled()
  await expect(fallback).toHaveAccessibleDescription('Nicht offline verfügbar')
  // Die Atemübung braucht kein Netz.
  await expect(atemuebungRow(page)).toBeEnabled()

  await context.setOffline(false)
  await expect(hints).toHaveCount(0)
  await expect(suggestion).toBeEnabled()
  await expect(fallback).toBeEnabled()
})

test('offline, a meditation that is saved starts from „Heute“', async ({ page, context }) => {
  await open(page, null, MORNING, 'Guten Morgen')
  // Das erste Abspielen speichert die Datei im Hintergrund.
  await lastUsedCard(page).getByRole('button', { name: 'Jetzt starten' }).click()
  await expect(guidedPlayer(page).getByRole('heading', { name: 'Ankommen im Atem', exact: true })).toBeVisible()
  await endGuided(page, 'Guten Morgen')
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open('ruhe-meditations')).keys()).length))
    .toBe(1)

  // Nach dem Neuladen kommt der Status aus dem Cache.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  await context.setOffline(true)
  const again = lastUsedCard(page).getByRole('button', { name: 'Erneut starten' })
  await expect(suggestionCard(page).getByRole('button', { name: 'Jetzt starten' })).toBeDisabled()
  await expect(again).toBeEnabled()
  await expect(lastUsedCard(page).getByText('Nicht offline verfügbar', { exact: true })).toHaveCount(0)
  await again.click()
  await expect(guidedPlayer(page).getByRole('heading', { name: 'Ankommen im Atem', exact: true })).toBeVisible()
})

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('the three cards keep their buttons at least 48 px and nothing scrolls sideways', async ({ page }) => {
    await open(page, dataOf(THREE_DAYS, { kind: 'guided', id: 'energie-in-der-mittagspause' }), MORNING, 'Guten Morgen')
    const targets = [
      suggestionCard(page).getByRole('button', { name: 'Jetzt starten' }),
      lastUsedCard(page).getByRole('button', { name: 'Erneut starten' }),
      meditierenRow(page),
      atemuebungRow(page),
      klaengeRow(page),
    ]
    for (const target of targets) {
      await target.scrollIntoViewIfNeeded()
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(48)
      expect(box.width).toBeGreaterThanOrEqual(48)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('the painting beside the suggestion neither overlaps the title nor leaves the card', async ({ page }) => {
    await open(page, null, MORNING, 'Guten Morgen')
    const card = (await suggestionCard(page).boundingBox())!
    const title = (await suggestionCard(page).locator('.name').boundingBox())!
    const image = (await suggestionCard(page).locator('img.motiv').boundingBox())!
    expect(image.x).toBeGreaterThanOrEqual(title.x + title.width)
    expect(image.x + image.width).toBeLessThanOrEqual(card.x + card.width)
    expect(image.y).toBeGreaterThanOrEqual(card.y)
    expect(image.y + image.height).toBeLessThanOrEqual(card.y + card.height)
  })
})
