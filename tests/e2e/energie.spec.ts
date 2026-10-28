import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'
import { doubleTap, expectStillRunning } from './taps'

// Reiter „Energie“ mit Akku-Karte und Check-in-Blatt (Spec M9 §3.2, §3.3), Jetzt-Reset, Bibliothek, Hack-Karte und
// Hack-Player (§3.2, §3.4, §3.5), Sprint-Karte und „Deine Woche“ (§3.2, §3.6, §6). Der Browser läuft in Berlin und die
// Uhr steht fest, so hängt kein Test von Zeitzone und Tageszeit des Rechners ab; nur die Tests mit laufendem Hack oder
// Sprint nehmen die echte Uhr (siehe `open`, `live`). Die langen Sprint-Tests (5 Minuten) liegen in sprint.spec.ts.
// Alle Werte sind ausgedachte Testdaten.
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
// damit Änderungen im Test ein Neuladen überstehen. `live`: die echte Uhr statt der festen. Ein Hack läuft auf der
// Audio-Uhr, die sich im Produktions-Build nicht vorspulen lässt, und eine feste Zeit gehört nicht zu einem laufenden
// Programm; solche Tests säen ihre Check-ins relativ zur echten Zeit (`ago`).
async function open(
  page: Page,
  {
    now = NOW,
    checkins,
    hackRuns,
    focusSprints,
    focus,
    live = false,
  }: { now?: Date; checkins?: object[]; hackRuns?: object[]; focusSprints?: object[]; focus?: object; live?: boolean } = {},
) {
  if (!live) await page.clock.setFixedTime(now)
  if (checkins || hackRuns || focusSprints || focus) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify({
      version: 1,
      sessions: [],
      settings: focus ? { ...SETTINGS, focus } : SETTINGS,
      ...(checkins ? { energyCheckins: checkins } : {}),
      ...(hackRuns ? { hackRuns } : {}),
      ...(focusSprints ? { focusSprints } : {}),
    }))
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

  // Tippen daneben (oberhalb des Blatts); die Fläche nimmt Tipps erst kurz nach dem Einblenden an
  await openSheet(page)
  await expect(page.locator('.backdrop')).toBeEnabled()
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
  // Auch der Reset nimmt ihn nicht mehr als Grundlage: Er fragt, was Energie braucht.
  await expect(resetCard(page).getByText('Was braucht gerade Energie?')).toBeVisible()
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


// ── Jetzt-Reset (Spec M9 §3.2, §6.7) ────────────────────────────────────────────────────────────────────────────

const resetCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Jetzt-Reset', exact: true }) })
const resetName = (page: Page) => resetCard(page).locator('.name')
const area = (page: Page, name: string) => resetCard(page).getByRole('button', { name, exact: true })
const next = (page: Page) => resetCard(page).getByRole('button', { name: 'Anderer', exact: true })

// Blättert mit „Anderer“ einmal durch die ganze Folge und gibt alle gezeigten Titel zurück.
async function browse(page: Page, steps = 20): Promise<string[]> {
  const titles: string[] = []
  for (let i = 0; i < steps; i++) {
    titles.push(await resetName(page).innerText())
    await next(page).click()
  }
  return titles
}

test('the reset suggests a hack of the weakest area and "Anderer" moves on, first through that area, then the next weakest', async ({ page }) => {
  // Geist ist am niedrigsten; die übrigen drei stehen gleich, also folgt nach der festen Reihenfolge Körper.
  await open(page, { checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [3, 3, 1, 3])] })
  const card = resetCard(page)
  const sentence = card.getByText('Dein Geist ist gerade am niedrigsten.')
  await expect(sentence).toBeVisible()
  await expect(card.getByText('Was braucht gerade Energie?')).toHaveCount(0)

  // Niemand lief je: Die Folge im Bereich ist die Reihenfolge des Katalogs.
  await expect(resetName(page)).toHaveText('Kopf leeren')
  await expect(card.getByText('Geist · 3 Min', { exact: true })).toBeVisible()
  await expect(card.getByText('wirkt bei dir')).toHaveCount(0)
  await expectMotiv(card.locator('img'), 'energie-geist', 72)
  for (const title of ['Nächster kleiner Schritt', 'Ablenkung aus', 'Augen-Pause']) {
    await next(page).click()
    await expect(resetName(page)).toHaveText(title)
    await expect(sentence).toBeVisible()
  }

  // Nach den vier Geist-Hacks der nächstschwächste Bereich; der Satz bleibt bei dem, was am niedrigsten ist.
  await next(page).click()
  await expect(resetName(page)).toHaveText('Bewegungs-Snack')
  await expect(card.getByText('Körper · 2 Min', { exact: true })).toBeVisible()
  await expectMotiv(card.locator('img'), 'energie-koerper', 72)
  await expect(sentence).toBeVisible()

  // „Starten“ öffnet die Hack-Karte des Vorschlags; gestartet wird erst dort.
  await card.getByRole('button', { name: 'Starten', exact: true }).click()
  await expect(hackDialog(page).getByRole('heading', { level: 3, name: 'Bewegungs-Snack' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
})

test('the suggestions start over when a new check-in is saved', async ({ page }) => {
  await open(page, { checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [3, 3, 1, 3])] })
  await next(page).click()
  await next(page).click()
  await expect(resetName(page)).toHaveText('Ablenkung aus')

  await akkuCard(page).getByRole('button', { name: 'Neuer Check-in' }).click()
  await expect(dialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
  for (const [areaName, n, word] of [['Körper', 1, 'leer'], ['Gefühl', 4, 'gut'], ['Geist', 4, 'gut'], ['Sinn', 4, 'gut']] as const) {
    await dot(page, areaName, n, word).click()
  }
  await dialog(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog(page)).toHaveCount(0)

  await expect(resetCard(page).getByText('Dein Körper ist gerade am niedrigsten.')).toBeVisible()
  await expect(resetName(page)).toHaveText('Bewegungs-Snack')
})

test('when the fresh check-in expires, the area question starts clean, without an old area or a step in the middle of a sequence', async ({ page }) => {
  await open(page)
  // Erst ohne Check-in einen Bereich wählen, dann einen Check-in speichern: Die Wahl gehört nicht mehr dazu.
  await area(page, 'Geist').click()
  await expect(area(page, 'Geist')).toHaveAttribute('aria-pressed', 'true')
  await akkuCard(page).getByRole('button', { name: 'Check-in', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Später' })).toBeEnabled()
  for (const [areaName, n, word] of [['Körper', 1, 'leer'], ['Gefühl', 4, 'gut'], ['Geist', 4, 'gut'], ['Sinn', 4, 'gut']] as const) {
    await dot(page, areaName, n, word).click()
  }
  await dialog(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(resetCard(page).getByText('Dein Körper ist gerade am niedrigsten.')).toBeVisible()
  await next(page).click()
  await next(page).click()
  await expect(resetName(page)).toHaveText('Wach-Atmung')

  // Vier Stunden später (nicht mehr frisch), beim nächsten Öffnen des Reiters: Die Frage steht da, nichts ist gewählt.
  await page.clock.setFixedTime(new Date('2026-10-21T18:00:00+02:00'))
  await nav(page).getByRole('button', { name: 'Atmen' }).click()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(resetCard(page).getByText('Was braucht gerade Energie?')).toBeVisible()
  for (const name of ['Körper', 'Gefühl', 'Geist', 'Sinn']) await expect(area(page, name)).toHaveAttribute('aria-pressed', 'false')
  await expect(resetCard(page).locator('.name')).toHaveCount(0)

  // Eine neue Wahl beginnt wieder beim ersten Vorschlag des Bereichs.
  await area(page, 'Gefühl').click()
  await expect(resetName(page)).toHaveText('Physiologischer Seufzer')
})

test('without a fresh check-in the reset asks what needs energy, and the chosen area shows its hacks', async ({ page }) => {
  await open(page)
  const card = resetCard(page)
  await expect(card.getByText('Was braucht gerade Energie?')).toBeVisible()
  await expect(card.getByText(/ist gerade am niedrigsten/)).toHaveCount(0)
  const names = ['Körper', 'Gefühl', 'Geist', 'Sinn']
  for (const name of names) {
    await expect(area(page, name)).toHaveAttribute('aria-pressed', 'false')
    const box = (await area(page, name).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  // Noch kein Vorschlag, bis ein Bereich gewählt ist.
  await expect(card.locator('.name')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Starten', exact: true })).toHaveCount(0)

  await area(page, 'Körper').click()
  await expect(area(page, 'Körper')).toHaveAttribute('aria-pressed', 'true')
  await expect(area(page, 'Geist')).toHaveAttribute('aria-pressed', 'false')
  await expect(resetName(page)).toHaveText('Bewegungs-Snack')
  await expect(card.getByText(/ist gerade am niedrigsten/)).toHaveCount(0)

  // Die Folge läuft durch die Körper-Hacks (um 14 Uhr sechs von sieben: Wasser & Licht gilt nur von 4 bis 12 Uhr),
  // dann weiter zum nächsten Bereich der festen Reihenfolge.
  const titles: string[] = []
  for (let i = 0; i < 8; i++) {
    titles.push(await resetName(page).innerText())
    await next(page).click()
  }
  expect(titles).toEqual([
    'Bewegungs-Snack', 'Tageslicht tanken', 'Wach-Atmung', 'Power-Pause', 'Strecken & Aufrichten', 'Wach-Klopfen',
    'Physiologischer Seufzer', 'Kaltes Gesicht',
  ])

  // Eine neue Wahl beginnt wieder beim ersten Vorschlag des Bereichs.
  await area(page, 'Geist').click()
  await expect(area(page, 'Geist')).toHaveAttribute('aria-pressed', 'true')
  await expect(area(page, 'Körper')).toHaveAttribute('aria-pressed', 'false')
  await expect(resetName(page)).toHaveText('Kopf leeren')
})

// Zeitfenster (Spec M9 §6.7, M10 §3.1): tageslicht 7–17, power-pause 11–16, wasser-licht 4–12; der Reset schlägt außerhalb nichts vor.
for (const [time, power, light, water] of [
  ['10:59', false, true, true],
  ['11:00', true, true, true],
  ['16:00', false, true, false],
  ['17:00', false, false, false],
] as const) {
  test(`at ${time} the reset ${power ? 'offers' : 'skips'} the Power-Pause, ${light ? 'offers' : 'skips'} Tageslicht tanken and ${water ? 'offers' : 'skips'} Wasser & Licht`, async ({ page }) => {
    await open(page, { now: new Date(`2026-10-21T${time}:00+02:00`) })
    await area(page, 'Körper').click()
    // Mehr Schritte als die längste Folge (alle 19 Hacks um 11:00), damit sie sich sicher schließt.
    const seen = await browse(page, 24)
    expect(seen.includes('Power-Pause')).toBe(power)
    expect(seen.includes('Tageslicht tanken')).toBe(light)
    expect(seen.includes('Wasser & Licht')).toBe(water)
    // Der Rest bleibt, und die Folge schließt sich: nach dem letzten Vorschlag kommt der erste wieder.
    expect(seen.includes('Bewegungs-Snack')).toBe(true)
    expect(seen[0]).toBe('Bewegungs-Snack')
    expect(seen.lastIndexOf('Bewegungs-Snack')).toBeGreaterThan(0)
  })
}

const rated = (id: string, hack: string, areaId: string, at: string, before: number, after: number) => ({ id, at, hack, area: areaId, seconds: 60, before, after })

test('"wirkt bei dir" marks the hacks that worked for you, on the reset card and on the tile', async ({ page }) => {
  await open(page, {
    checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [3, 3, 1, 3])],
    hackRuns: [
      rated('r-1', 'ablenkung-aus', 'geist', '2026-10-19T09:00:00+02:00', 1, 3),
      rated('r-2', 'ablenkung-aus', 'geist', '2026-10-20T09:00:00+02:00', 2, 4),
    ],
  })
  // Zwei bewertete Läufe mit Gewinn: Der Hack steht vorn, mit dem Hinweis.
  await expect(resetName(page)).toHaveText('Ablenkung aus')
  await expect(resetCard(page).getByText('Geist · 1 Min', { exact: true })).toBeVisible()
  await expect(resetCard(page).getByText('wirkt bei dir')).toBeVisible()
  await next(page).click()
  await expect(resetName(page)).toHaveText('Kopf leeren')
  await expect(resetCard(page).getByText('wirkt bei dir')).toHaveCount(0)

  const marked = library(page).getByRole('listitem').filter({ hasText: 'wirkt bei dir' })
  await expect(marked).toHaveCount(1)
  await expect(marked).toContainText('Ablenkung aus')
})

// ── Bibliothek (Spec M9 §3.2) ───────────────────────────────────────────────────────────────────────────────────

const library = (page: Page) => page.getByRole('region', { name: 'Brain Hacks', exact: true })
const tile = (page: Page, title: string) => library(page).getByRole('button', { name: title })
const chip = (page: Page, name: string) => library(page).getByRole('radio', { name, exact: true })

test('the library shows all 19 hacks, filters by area, remembers the filter for the session and ignores time windows', async ({ page }) => {
  // 10:59: Der Reset schlüge die Power-Pause nicht vor, die Bibliothek zeigt sie.
  await open(page, { now: new Date('2026-10-21T10:59:00+02:00') })
  await expect(library(page).getByRole('heading', { level: 2, name: 'Brain Hacks' })).toBeVisible()
  await expect(library(page).getByRole('listitem')).toHaveCount(19)
  await expect(tile(page, 'Power-Pause')).toBeVisible()
  await expect(library(page).getByText('Körper · 10 Min', { exact: true })).toBeVisible()

  // Filter als Radiogruppe, anfangs „Alle“.
  await expect(library(page).getByRole('radio')).toHaveText(['Alle', 'Körper', 'Gefühl', 'Geist', 'Sinn'])
  await expect(chip(page, 'Alle')).toHaveAttribute('aria-checked', 'true')

  await chip(page, 'Sinn').click()
  await expect(chip(page, 'Sinn')).toHaveAttribute('aria-checked', 'true')
  const items = library(page).getByRole('listitem')
  await expect(items).toHaveCount(4)
  await expect(items.locator('.title')).toHaveText(['Big Domino', 'Werte-Anker', 'Kleiner Fortschritt', 'Wofür?'])
  await expect(items.first()).toContainText('Sinn · 3 Min')

  // Kachel: Motiv des Bereichs (40 px, nur Schmuck), Titel, Zeile; ganze Fläche tippbar (≥ 44 px).
  await expectMotiv(items.first().locator('img'), 'energie-sinn', 40)
  for (const target of [...(await items.all()), ...(await library(page).getByRole('radio').all())]) {
    const box = (await target.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  // Ein Reiterwechsel hebt den Filter nicht auf, ein Neuladen schon.
  await nav(page).getByRole('button', { name: 'Atmen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(chip(page, 'Sinn')).toHaveAttribute('aria-checked', 'true')
  await expect(library(page).getByRole('listitem')).toHaveCount(4)

  await page.reload()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(chip(page, 'Alle')).toHaveAttribute('aria-checked', 'true')
  await expect(library(page).getByRole('listitem')).toHaveCount(19)

  await chip(page, 'Körper').click()
  await expect(library(page).getByRole('listitem').locator('.title')).toHaveText([
    'Bewegungs-Snack', 'Tageslicht tanken', 'Wach-Atmung', 'Power-Pause', 'Strecken & Aufrichten', 'Wasser & Licht', 'Wach-Klopfen',
  ])

  for (const [name, count] of [['Körper', 7], ['Gefühl', 4], ['Geist', 4]] as const) {
    await chip(page, name).click()
    await expect(library(page).getByRole('listitem')).toHaveCount(count)
  }
})

// ── Hack-Karte (Spec M9 §3.4) ───────────────────────────────────────────────────────────────────────────────────

const hackDialog = (page: Page) => page.getByRole('dialog', { name: 'Brain Hack', exact: true })

async function openCard(page: Page, title: string) {
  await tile(page, title).click()
  await expect(hackDialog(page)).toBeVisible()
}

const startButton = (page: Page) => hackDialog(page).getByRole('button', { name: /^Starten · \d+:\d\d$/ })

// Startet den Hack aus der offenen Karte; danach läuft der Player.
async function startFromCard(page: Page) {
  await startButton(page).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
}

// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen), wie in timer.spec.ts.
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

test('a tile opens the hack card with steps, reason, source and start; "Passt dazu" leads to the breath exercise', async ({ page }) => {
  await open(page)
  await openCard(page, 'Physiologischer Seufzer')
  const card = hackDialog(page)

  // Kopf, Chip, Titel, Nutzen, Motiv (nur Schmuck)
  await expect(card.getByRole('heading', { level: 2, name: 'Brain Hack' })).toBeVisible()
  await expect(card.getByText('Gefühl · 1 Min', { exact: true })).toBeVisible()
  await expect(card.getByRole('heading', { level: 3, name: 'Physiologischer Seufzer' })).toBeVisible()
  await expect(card.getByText('Kann dir helfen, Stress in einer Minute spürbar herunterzufahren.')).toBeVisible()
  await expectMotiv(card.locator('img'), 'energie-gefuehl', 96)

  // „Zurück“: sichtbarer Weg zum Schließen (ohne Zurück-Geste, etwa in einer installierten App auf iOS), ein Kreis von 44 px
  const back = card.getByRole('button', { name: 'Zurück', exact: true })
  await expect(back).toBeVisible()
  const backBox = (await back.boundingBox())!
  expect(backBox.width).toBeGreaterThanOrEqual(44)
  expect(backBox.height).toBeGreaterThanOrEqual(44)

  // „So geht’s“: drei nummerierte Schritte, je mit Symbol, Titel und Erklärung
  const steps = card.getByRole('region', { name: 'So geht’s' })
  await expect(steps.getByRole('listitem')).toHaveCount(3)
  await expect(steps.getByRole('listitem').nth(0)).toContainText('Tief einatmen')
  await expect(steps.getByRole('listitem').nth(0)).toContainText('Atme durch die Nase ein, bis die Lunge fast voll ist.')
  await expect(steps.getByRole('listitem').nth(1)).toContainText('Kurz nachatmen')
  await expect(steps.getByRole('listitem').nth(2)).toContainText('Lang ausatmen')
  await expect(steps.locator('svg[aria-hidden="true"]')).toHaveCount(3)
  // Die Liste bleibt eine Liste für Hilfstechnik, auch ohne Aufzählungszeichen (WebKit lässt sie sonst fallen).
  await expect(steps.locator('ol')).toHaveAttribute('role', 'list')

  // „Warum es wirkt“: Wirkungsbild von … nach … und der Text
  const why = card.getByRole('region', { name: 'Warum es wirkt' })
  await expect(why.getByText('Alarm', { exact: true })).toBeVisible()
  await expect(why.getByText('Ruhe', { exact: true })).toBeVisible()
  await expect(why).toContainText('Das kurze Nachatmen füllt die Lunge noch einmal auf.')

  await expect(card.getByText('Hinweis', { exact: true })).toHaveCount(0)
  await expect(card.getByText(/^Weiterlesen:/)).toHaveCount(0)
  await expect(card.getByText('Quelle: Balban u. a. 2023', { exact: true })).toBeVisible()
  await expect(startButton(page)).toHaveText('Starten · 1:04')
  const box = (await startButton(page).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(48)

  // „Passt dazu“ schließt die Karte und öffnet „Atmen“.
  await card.getByRole('button', { name: 'Passt dazu: Atemübung Physiologischer Seufzer' }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  await expect(nav(page).getByRole('button', { name: 'Atmen' })).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => depth(page)).toBe(0)
})

test('the hack card closes with Escape, the back gesture and a tap beside it, and shows notes and further reading when there are some', async ({ page }) => {
  await open(page)

  // Hinweis (Sicherheit), kein Verweis
  await openCard(page, 'Wach-Atmung')
  let card = hackDialog(page)
  await expect(card.getByText('Hinweis', { exact: true })).toBeVisible()
  await expect(card).toContainText('Übe nur im Sitzen, nie beim Fahren oder im Wasser.')
  await expect(card.getByRole('button', { name: /^Passt dazu/ })).toHaveCount(0)
  await expect(startButton(page)).toHaveText('Starten · 1:00')
  await expect.poll(() => depth(page)).toBe(1)
  await page.keyboard.press('Escape')
  await expect(hackDialog(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)

  // Weiterlesen
  await openCard(page, 'Kopf leeren')
  card = hackDialog(page)
  await expect(card.getByText('Weiterlesen: Henry Hildebrandt, Brainhacks (2025)', { exact: true })).toBeVisible()
  await expect(card.getByText('Hinweis', { exact: true })).toHaveCount(0)
  await expect(startButton(page)).toHaveText('Starten · 3:00')
  await page.goBack()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')

  // Tippen daneben (oberhalb des Blatts); die Fläche nimmt Tipps erst kurz nach dem Einblenden an
  await openCard(page, 'Big Domino')
  await expect(page.locator('.backdrop')).toBeEnabled()
  await page.mouse.click(8, 8)
  await expect(hackDialog(page)).toHaveCount(0)

  // „Zurück“ oben im Blatt, mit sauberem History-Stapel
  await openCard(page, 'Drei gute Dinge')
  await expect.poll(() => depth(page)).toBe(1)
  await hackDialog(page).getByRole('button', { name: 'Zurück', exact: true }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
})

// ── Hack-Player und Ende (Spec M9 §3.5, §6.2) ───────────────────────────────────────────────────────────────────

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// Merkt jeden Aufruf von navigator.vibrate; die Seite kennt die Schnittstelle sonst nicht überall.
async function recordVibration(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vibes: unknown[] }
    w.__vibes = []
    navigator.vibrate = (pattern) => {
      w.__vibes.push(pattern)
      return true
    }
  })
}
const vibrations = (page: Page) => page.evaluate(() => (window as unknown as { __vibes: unknown[] }).__vibes)

// Wartet Bild für Bild, bis die Restzeit im Player genau `text` zeigt (die Anzeige steht jeweils eine Sekunde).
const untilTimer = (page: Page, text: string, timeout = 20_000) =>
  page.waitForFunction((t) => document.querySelector('[role="dialog"] [role="timer"]')?.textContent?.trim() === t, text, { timeout })

// Ein Punkt in der Wirkungsfrage des Endes: „Gefühl jetzt“ bzw. „Körper vorher“, dann „Gefühl: 4 von 5, gut“.
const effectDot = (page: Page, row: string, areaName: string, n: number, word: string) =>
  page.getByRole('radiogroup', { name: row, exact: true }).getByRole('radio', { name: `${areaName}: ${n} von 5, ${word}`, exact: true })
const runs = async (page: Page) => (await stored(page))?.hackRuns ?? []

test('a takt hack shows round and instruction, ends by itself and asks how you feel now', async ({ page }) => {
  test.setTimeout(150_000) // 64 s Hack, 8 s Ausklang; die Audio-Uhr lässt sich nicht vorspulen
  await recordVibration(page)
  await open(page, { live: true, checkins: [checkin('c-live', ago(20), [3, 2, 3, 3])] })
  await openCard(page, 'Physiologischer Seufzer')
  await startFromCard(page)
  await expect.poll(() => depth(page)).toBe(1) // der Player ersetzt die Karte: genau eine Ebene
  await expect(page.locator('[inert] main')).toHaveCount(1)

  const player = hackDialog(page)
  await expect(player.getByRole('heading', { level: 2, name: 'Physiologischer Seufzer' })).toBeVisible()
  await expect(player.getByText('Gefühl · 1 Min', { exact: true })).toBeVisible()
  await expect(player.getByText('Runde 1 von 8')).toBeVisible()
  // Die Anweisung steht in einem höflichen Live-Bereich, damit Hilfstechnik sie beim Wechsel ansagt. Ein Beobachter
  // sammelt, was dort im ersten Zyklus (8 s) stand; ein Abfragen würde die eine Sekunde „kurz nachatmen“ verpassen.
  const say = player.locator('[aria-live="polite"]')
  await expect(say).toHaveText('Tief einatmen …')
  await page.evaluate(() => {
    const region = document.querySelector('[role="dialog"] [aria-live="polite"]')!
    const seen = new Set<string>()
    const read = () => seen.add(region.textContent ?? '')
    read()
    new MutationObserver(read).observe(region, { childList: true, characterData: true, subtree: true })
    ;(window as unknown as { __say: Set<string> }).__say = seen
  })
  await expect
    .poll(() => page.evaluate(() => [...(window as unknown as { __say: Set<string> }).__say].sort()), { timeout: 12_000 })
    .toEqual(['… kurz nachatmen', 'Lang ausatmen …', 'Tief einatmen …'].sort())
  await expect(player.getByRole('timer')).toHaveText(/^[01]:\d\d$/)
  await expect(player.getByText('Quelle: Balban u. a. 2023', { exact: true })).toBeVisible()

  // Der Punkt der Kurve läuft mit.
  const dotX = () => player.locator('svg circle.dot').getAttribute('cx')
  const x0 = await dotX()
  await page.waitForTimeout(1200)
  expect(await dotX()).not.toBe(x0)

  // „Warum es wirkt“ klappt auf und zu.
  const why = player.getByRole('button', { name: 'Warum es wirkt' })
  await expect(why).toHaveAttribute('aria-expanded', 'false')
  await expect(player.getByText('Das kurze Nachatmen füllt die Lunge noch einmal auf.')).toHaveCount(0)
  await why.click()
  await expect(why).toHaveAttribute('aria-expanded', 'true')
  await expect(player.getByText('Das kurze Nachatmen füllt die Lunge noch einmal auf.')).toBeVisible()
  await why.click()
  await expect(why).toHaveAttribute('aria-expanded', 'false')

  // Am Ende: Geschafft und, weil der Check-in von vorhin das „Vorher“ liefert, nur eine Reihe.
  await expect(player.getByRole('heading', { level: 2, name: 'Geschafft' })).toBeVisible({ timeout: 90_000 })
  await expect(player.getByText('Gefühl jetzt?', { exact: true })).toBeVisible()
  await expect(player.getByText('vorher', { exact: true })).toHaveCount(0)
  await expect(player.getByRole('radiogroup')).toHaveCount(1)
  expect(await vibrations(page)).toContain(200)
  expect(await runs(page)).toHaveLength(1)
  expect((await runs(page))[0]).toMatchObject({ hack: 'seufzer', area: 'gefuehl', before: 2 })
  expect((await runs(page))[0].seconds).toBeGreaterThanOrEqual(63)
  expect('after' in (await runs(page))[0]).toBe(false)

  // Ein Tipp speichert sofort, derselbe Punkt nimmt zurück.
  await effectDot(page, 'Gefühl jetzt', 'Gefühl', 4, 'gut').click()
  await expect(effectDot(page, 'Gefühl jetzt', 'Gefühl', 4, 'gut')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => (await runs(page))[0].after).toBe(4)
  await effectDot(page, 'Gefühl jetzt', 'Gefühl', 4, 'gut').click()
  await expect.poll(async () => 'after' in (await runs(page))[0]).toBe(false)
  await effectDot(page, 'Gefühl jetzt', 'Gefühl', 4, 'gut').click()
  await expect.poll(async () => (await runs(page))[0].after).toBe(4)

  // „Fertig“ schließt den Player; die Antwort bleibt gespeichert.
  await player.getByRole('button', { name: 'Fertig' }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  expect(await runs(page)).toHaveLength(1)
  expect((await runs(page))[0]).toMatchObject({ before: 2, after: 4 })
})

test('a steps hack counts its steps; ending it after 40 s still asks for the effect, and "Noch einmal" starts it again', async ({ page }) => {
  test.setTimeout(150_000)
  await recordVibration(page)
  await open(page, { live: true }) // kein Check-in
  await openCard(page, 'Bewegungs-Snack')
  await startFromCard(page)
  const player = hackDialog(page)

  // Schritt groß mit Titel und Erklärung (angesagt), darunter „Schritt 1 von 4“ und die Restzeit des Schritts.
  await expect(player.getByText('Schritt 1 von 4', { exact: true })).toBeVisible()
  const live = player.locator('[aria-live="polite"]')
  await expect(live).toContainText('Kniebeugen')
  await expect(player.locator('.step-left')).toHaveText(/^0:[0-3]\d$/)
  expect(await vibrations(page)).not.toContain(60)
  await expect(player.getByText('Schritt 2 von 4', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(live).toContainText('Auf der Stelle laufen')
  expect(await vibrations(page)).toContain(60) // leises Vibrieren beim Schrittwechsel (Vibration ist an)

  // Bei 40 s beenden: 120 s − 40 s = 1:20 (die Anzeige rundet auf).
  await untilTimer(page, '1:20')
  await player.getByRole('button', { name: 'Beenden' }).click()
  await expect(player.getByRole('heading', { level: 2, name: 'Geschafft' })).toBeVisible()
  expect(await runs(page)).toHaveLength(1)
  const first = (await runs(page))[0]
  expect(first).toMatchObject({ hack: 'bewegungs-snack', area: 'koerper' })
  // Die Restzeit zeigt „1:20“, sobald 40 s gelaufen sind (sie rundet auf); der Test beendet im selben Bild: 40 oder 41.
  expect(first.seconds).toBeGreaterThanOrEqual(40)
  expect(first.seconds).toBeLessThanOrEqual(41)
  expect('before' in first || 'after' in first).toBe(false)

  // Ohne Check-in zwei Reihen. „vorher“ macht daraus keine einzelne Reihe.
  await expect(player.getByText('vorher', { exact: true })).toBeVisible()
  await expect(player.getByText('jetzt', { exact: true })).toBeVisible()
  await expect(player.getByText('Körper jetzt?', { exact: true })).toHaveCount(0)
  await expect(player.getByRole('radiogroup')).toHaveCount(2)
  await effectDot(page, 'Körper vorher', 'Körper', 2, 'schwach').click()
  await expect.poll(async () => (await runs(page))[0].before).toBe(2)
  await expect(player.getByRole('radiogroup')).toHaveCount(2)
  await effectDot(page, 'Körper jetzt', 'Körper', 4, 'gut').click()
  await expect.poll(async () => (await runs(page))[0].after).toBe(4)
  expect(await vibrations(page)).toContain(200)

  // „Noch einmal“: derselbe Hack von vorn, das alte Ende ist weg. Ein Doppeltipp (zwei Tipps im Abstand von 150 ms, wie
  // `doubleTap`) trifft nicht „Beenden“ des neuen Laufs. Nach dem ersten Tipp ist der Knopf mit dem Fokus weg: Der Fokus
  // geht auf den Titel der neuen Laufansicht, nicht auf `body` im Dialog. Der zweite Tipp auf das gesperrte „Beenden“
  // nähme ihn wieder (ein Tipp auf etwas, das keinen Fokus annimmt, entfernt ihn), darum wird dazwischen geprüft.
  const again = player.getByRole('button', { name: 'Noch einmal' })
  await again.click({ trial: true })
  const againBox = (await again.boundingBox())!
  const [tapX, tapY] = [againBox.x + againBox.width * 0.75, againBox.y + againBox.height / 2]
  const newTitle = player.getByRole('heading', { level: 2, name: 'Bewegungs-Snack' })
  await page.touchscreen.tap(tapX, tapY)
  await page.waitForTimeout(150)
  await expect(newTitle).toBeFocused()
  await page.touchscreen.tap(tapX, tapY)
  await page.waitForTimeout(500)
  await expectStillRunning(page)
  await expect(newTitle).toBeVisible()
  await expect(player.getByText('Schritt 1 von 4', { exact: true })).toBeVisible()
  await expect(player.getByText('Geschafft')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1)
  expect(await runs(page)).toHaveLength(1)

  // Wieder früh beenden (unter 30 s): kein Ende, kein neuer Lauf, die Antwort des ersten bleibt.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  expect(await runs(page)).toHaveLength(1)
  expect((await runs(page))[0]).toMatchObject({ before: 2, after: 4 })
})

test('ending a ring hack after 10 s closes the player without the effect question and saves nothing', async ({ page }) => {
  await recordVibration(page)
  await open(page, { live: true, checkins: [checkin('c-live', ago(20), [3, 3, 2, 3])] })
  await openCard(page, 'Tageslicht tanken')
  await startFromCard(page)
  const player = hackDialog(page)

  // Ring: Restzeit im Ring, darunter alle Schritte als ruhige Liste
  await expect(player.getByText('Körper · 5 Min', { exact: true })).toBeVisible()
  const list = player.getByRole('list')
  await expect(list).toHaveAttribute('role', 'list')
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await expect(list).toContainText('Raus ins Freie')
  await expect(list).toContainText('Zum Himmel schauen')
  await expect(list).toContainText('Gemütlich gehen')
  await untilTimer(page, '4:50') // 10 s gelaufen

  // Die Zurück-Geste fragt nach; „Weiter üben“ führt zurück.
  await page.goBack()
  const confirm = page.getByRole('alertdialog', { name: 'Hack beenden?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Weiter üben' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  await page.goBack()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Beenden' }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Geschafft' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect.poll(() => depth(page)).toBe(0)
  expect(await runs(page)).toEqual([])
  expect(await vibrations(page)).not.toContain(200) // ohne Ende auch kein Vibrieren
})

test('a double tap on "Starten" in the hack card does not reach the player that opens under it', async ({ page }) => {
  await open(page, { live: true })
  // Unter „Starten“ liegen dann links „Pause“, rechts „Beenden“.
  for (const side of [0.25, 0.75]) {
    await openCard(page, 'Physiologischer Seufzer')
    await expect(startButton(page)).toBeEnabled()
    await doubleTap(page, startButton(page), side)
    await expectStillRunning(page)
    await page.getByRole('button', { name: 'Beenden' }).click()
    await expect(hackDialog(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  }
  expect(await runs(page)).toEqual([])
})

// Auf einem Telefon liegen „Starten“ der Karte und die Bedienelemente des Players nicht immer an derselben Stelle. Darum
// hier der zweite Tipp genau dort, wo die Bedienelemente des Players stehen: erst lernt der Test ihre Stellen, dann tippt er
// „Starten“ und 150 ms später auf jede dieser Stellen.
test('a second tap on the spot of the player controls right after "Starten" does nothing', async ({ page }) => {
  await open(page, { live: true })
  const spots: { name: string; x: number; y: number }[] = []
  await openCard(page, 'Physiologischer Seufzer')
  await startFromCard(page)
  const player = hackDialog(page)
  for (const [name, target] of [
    ['Pause', player.getByRole('button', { name: 'Pause', exact: true })],
    ['Beenden', player.getByRole('button', { name: 'Beenden', exact: true })],
    ['Warum es wirkt', player.getByRole('button', { name: 'Warum es wirkt' })],
  ] as const) {
    const box = (await target.boundingBox())!
    spots.push({ name, x: box.x + box.width / 2, y: box.y + box.height / 2 })
  }
  await player.getByRole('button', { name: 'Beenden' }).click()
  await expect(hackDialog(page)).toHaveCount(0)

  for (const { name, x, y } of spots) {
    await openCard(page, 'Physiologischer Seufzer')
    await expect(startButton(page)).toBeEnabled()
    const box = (await startButton(page).boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(150)
    await page.touchscreen.tap(x, y)
    await page.waitForTimeout(500)
    await expectStillRunning(page)
    await expect(player.getByRole('button', { name: 'Warum es wirkt' }), name).toHaveAttribute('aria-expanded', 'false')
    await player.getByRole('button', { name: 'Beenden' }).click()
    await expect(hackDialog(page)).toHaveCount(0)
  }
  expect(await runs(page)).toEqual([])
})

test('a double tap on "Starten" of the reset card opens the card once and does not start anything', async ({ page }) => {
  await open(page, { checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [3, 3, 1, 3])] })
  await doubleTap(page, resetCard(page).getByRole('button', { name: 'Starten', exact: true }), 0.5)
  await expect(hackDialog(page).getByRole('heading', { level: 3, name: 'Kopf leeren' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
})

test.describe('on a 360px phone with 130% text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('reset card, library, hack card and player stay inside the screen, and "Starten" stays in reach', async ({ page }) => {
    await open(page, { live: true, checkins: [checkin('c-live', ago(20), [3, 2, 3, 3])] })
    const sticksOut = (selector: string) =>
      page.locator(selector).evaluate((root) =>
        [...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5).length,
      )
    const pageScrolls = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    expect(await sticksOut('.screen')).toBe(0)
    expect(await pageScrolls()).toBe(false)

    // Die Karte mit dem längsten Titel: Das Blatt rutscht nicht seitlich, „Starten“ liegt ohne Blättern im Bild.
    await openCard(page, 'Physiologischer Seufzer')
    expect(await sticksOut('[role="dialog"]')).toBe(0)
    await expect(startButton(page)).toBeInViewport()
    await startButton(page).click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    expect(await sticksOut('[role="dialog"]')).toBe(0)
    expect(await pageScrolls()).toBe(false)
    await page.getByRole('button', { name: 'Beenden' }).click()
    await expect(hackDialog(page)).toHaveCount(0)
  })
})

// ── Fokus-Sprint (Spec M9 §3.2 Punkt 4, §3.6) ────────────────────────────────────────────────────────────────────
// Die Karte und kurze Läufe stehen hier; ein Sprint, der zählt, läuft mindestens 5 Minuten und steht in sprint.spec.ts.

const sprintCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Fokus-Sprint', exact: true }) })
const sprintDialog = (page: Page) => page.getByRole('dialog', { name: 'Fokus-Sprint', exact: true })
const sprintField = (page: Page) => sprintCard(page).getByLabel('Woran arbeitest du?')
const startSprintButton = (page: Page) => sprintCard(page).getByRole('button', { name: 'Sprint starten', exact: true })

test('the cards come in this order: battery, reset, sprint, hacks, week', async ({ page }) => {
  await open(page)
  await expect(page.locator('.screen').getByRole('heading', { level: 2 })).toHaveText(['Dein Akku', 'Jetzt-Reset', 'Fokus-Sprint', 'Brain Hacks', 'Deine Woche'])
})

test('the sprint card shows the motif, a free field of at most 80 characters, the three lengths and the background', async ({ page }) => {
  await open(page)
  const card = sprintCard(page)
  await expectMotiv(card.locator('img'), 'fokus', 72)

  // Das Feld ist freiwillig und fasst höchstens 80 Zeichen (Tippen schneidet ab, auch bei längerem Text).
  await expect(sprintField(page)).toHaveValue('')
  await expect(sprintField(page)).toHaveAttribute('maxlength', '80')
  await sprintField(page).click()
  await page.keyboard.type('x'.repeat(95))
  expect(await sprintField(page).inputValue()).toHaveLength(80)

  // Standard 50 Min und „Kaffee & Notizen“; die Länge ist eine Radiogruppe wie die anderen Auswahlen.
  const lengths = card.getByRole('radiogroup', { name: 'Dauer', exact: true })
  await expect(lengths.getByRole('radio')).toHaveText(['25 Min', '50 Min', '90 Min'])
  await expect(lengths.getByRole('radio', { name: '50 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(lengths.getByRole('radio', { name: '25 Min', exact: true })).toHaveAttribute('aria-checked', 'false')
  await expect(card.getByLabel('Hintergrund', { exact: true })).toHaveValue('kaffee-und-notizen')
  // Dieselbe gegliederte Auswahl wie beim Timer, mit „Keiner“.
  await expect(card.getByLabel('Hintergrund', { exact: true }).locator('option').first()).toHaveText('Keiner')
  await expect(startSprintButton(page)).toBeVisible()
  // Die Tippflächen sind mindestens 44 px hoch.
  for (const target of [sprintField(page), startSprintButton(page), ...(await lengths.getByRole('radio').all())]) {
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('the sprint card opens with the remembered length and background', async ({ page }) => {
  await open(page, { focus: { minutes: 90, sound: 'regen' } })
  const card = sprintCard(page)
  await expect(card.getByRole('radio', { name: '90 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(card.getByLabel('Hintergrund', { exact: true })).toHaveValue('regen')
})

test('the sprint card opens on "Keiner" when no background was remembered', async ({ page }) => {
  await open(page, { focus: { minutes: 25, sound: null } })
  await expect(sprintCard(page).getByRole('radio', { name: '25 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(sprintCard(page).getByLabel('Hintergrund', { exact: true })).toHaveValue('')
})

test('a sprint under 5 minutes leaves no entry, no summary, and the player closes by itself', async ({ page }) => {
  await open(page, { live: true })
  await sprintField(page).fill('Nur ein Versuch')
  await startSprintButton(page).click()
  const player = sprintDialog(page)

  // Laufansicht: Titel, Motiv, Restzeit groß, Vorhaben, Pause/Beenden.
  await expect(player.getByRole('heading', { level: 2, name: 'Fokus-Sprint · 50 Min' })).toBeVisible()
  await expectMotiv(player.locator('img'), 'fokus', 72)
  await expect(player.getByRole('timer')).toHaveText('50:00')
  await expect(player.getByText('Nur ein Versuch', { exact: true })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.locator('[inert] main')).toHaveCount(1) // darunter ist die App unerreichbar
  await untilTimer(page, '49:57')

  await player.getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(sprintDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Sprint geschafft' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0)
  const data = await stored(page)
  expect(data.focusSprints).toBeUndefined()
  expect(data.sessions).toEqual([])
  // Die Wahl gilt trotzdem beim nächsten Mal.
  expect(data.settings.focus).toEqual({ minutes: 50, sound: 'kaffee-und-notizen' })
  await expect.poll(() => depth(page)).toBe(0)
})

test('an empty field shows "Fokus-Sprint" in the player, and the back gesture asks before ending', async ({ page }) => {
  await open(page, { live: true })
  await startSprintButton(page).click()
  const player = sprintDialog(page)
  await expect(player.getByRole('timer')).toBeVisible()
  // Ohne Vorhaben steht „Fokus-Sprint“ unter der Zeit (der Titel oben heißt „Fokus-Sprint · 50 Min“).
  await expect(player.locator('.task')).toHaveText('Fokus-Sprint')

  await page.goBack()
  const confirm = page.getByRole('alertdialog', { name: 'Sprint beenden?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Weiter fokussieren' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  await player.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Weiter', exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Weiter', exact: true }).click()

  await page.goBack()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(sprintDialog(page)).toHaveCount(0) // unter 5 Minuten: schließt ohne Ende-Ansicht
  await expect.poll(() => depth(page)).toBe(0)
})

// ── „Deine Woche“ (Spec M9 §3.2 Punkt 6, §6.3–§6.6) ──────────────────────────────────────────────────────────────

const weekCard = (page: Page) => page.getByRole('region', { name: 'Deine Woche', exact: true })
const WEEKDAY = '(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)'
const cell = (page: Page, name: string) => weekCard(page).getByRole('img', { name, exact: true })

// Alles ausgedacht. Heute ist Mittwoch, der 21.10.; das Raster zeigt Do 15. bis Mi 21. Acht Check-ins in zehn Tagen, der
// Geist durchweg bei 1–2, über alle Tageszeiten gleich (so entsteht nur der Satz „Am niedrigsten …“, kein Tageszeit-Satz).
const WEEK_CHECKINS = [
  checkin('w-1', '2026-10-12T10:00:00+02:00', [4, 4, 2, 4]),
  checkin('w-2', '2026-10-13T15:00:00+02:00', [3, 3, 1, 4]),
  checkin('w-3', '2026-10-16T09:00:00+02:00', [4, 3, 2, 4]), // Fr
  checkin('w-4', '2026-10-17T14:00:00+02:00', [3, 4, 1, 3]), // Sa
  checkin('w-5', '2026-10-19T09:00:00+02:00', [4, 4, 2, 4]), // Mo (zwei Check-ins)
  checkin('w-6', '2026-10-19T15:00:00+02:00', [3, 3, 1, 4]),
  checkin('w-7', '2026-10-20T10:30:00+02:00', [4, 3, 2, 3]), // Di
  checkin('w-8', '2026-10-21T09:00:00+02:00', [3, 4, 1, 4]), // Mi (heute, aber nicht mehr frisch)
]
// Drei Hacks mit je zwei Bewertungen: Kopf leeren +2 und +2, Bewegungs-Snack +1 und +2, Seufzer +1 und 0.
const WEEK_RUNS = [
  rated('r-1', 'kopf-leeren', 'geist', '2026-10-16T09:10:00+02:00', 1, 3),
  rated('r-2', 'kopf-leeren', 'geist', '2026-10-19T09:10:00+02:00', 2, 4),
  rated('r-3', 'bewegungs-snack', 'koerper', '2026-10-17T14:10:00+02:00', 3, 4),
  rated('r-4', 'bewegungs-snack', 'koerper', '2026-10-20T10:40:00+02:00', 2, 4),
  rated('r-5', 'seufzer', 'gefuehl', '2026-10-18T11:00:00+02:00', 2, 3),
  rated('r-6', 'seufzer', 'gefuehl', '2026-10-20T11:00:00+02:00', 3, 3),
]
// Zwei Sprints in der Woche (25 Min und 50 Min, zusammen 1 Std. 15 Min) und einer davor, der nicht zählt.
const WEEK_SPRINTS = [
  { id: 'sp-1', at: '2026-10-19T09:00:00+02:00', planned: 25, seconds: 1500 },
  { id: 'sp-2', at: '2026-10-20T13:00:00+02:00', planned: 50, seconds: 3000, task: 'Beispielaufgabe' },
  { id: 'sp-0', at: '2026-10-10T09:00:00+02:00', planned: 90, seconds: 5400 },
]

test('the week shows 28 named cells, the pattern, the focus line and what works', async ({ page }) => {
  await open(page, { checkins: WEEK_CHECKINS, hackRuns: WEEK_RUNS, focusSprints: WEEK_SPRINTS })
  const week = weekCard(page)
  await expect(week.getByRole('heading', { level: 2, name: 'Deine Woche', exact: true })).toBeVisible()

  // 4 Bereiche × 7 Tage, jedes Feld ein Bild mit Namen „Geist, Dienstag: 2 von 5“ bzw. „… kein Check-in“.
  const cells = week.getByRole('img')
  await expect(cells).toHaveCount(28)
  const names = await cells.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
  for (const name of names) expect(name).toMatch(new RegExp(`^(?:Körper|Gefühl|Geist|Sinn), ${WEEKDAY}: (?:\\d(?:,\\d)? von 5|kein Check-in)$`))
  // Die Tage laufen vom ältesten (Do) zu heute (Mi); die Bereiche in fester Reihenfolge.
  expect(names.slice(0, 7).map((n) => n!.split(': ')[0])).toEqual([
    'Körper, Donnerstag', 'Körper, Freitag', 'Körper, Samstag', 'Körper, Sonntag', 'Körper, Montag', 'Körper, Dienstag', 'Körper, Mittwoch',
  ])
  expect(names.filter((n) => n!.startsWith('Geist')).length).toBe(7)
  expect(names.filter((n) => n!.endsWith('kein Check-in')).length).toBe(8) // Do und So, je viermal

  // Werte: Geist am Montag (2 und 1) im Schnitt 1,5; am Freitag 2; am Mittwoch 1; am Donnerstag ohne Check-in.
  await expect(cell(page, 'Geist, Montag: 1,5 von 5')).toBeVisible()
  await expect(cell(page, 'Geist, Freitag: 2 von 5')).toBeVisible()
  await expect(cell(page, 'Geist, Mittwoch: 1 von 5')).toBeVisible()
  await expect(cell(page, 'Geist, Donnerstag: kein Check-in')).toBeVisible()
  await expect(cell(page, 'Körper, Montag: 3,5 von 5')).toBeVisible()

  // Die Deckkraft folgt der ganzen Stufe (1,5 → 2): 0,2 / 0,4 / 0,6 / 0,8 / 1,0; ohne Wert ein gestrichelter Rahmen ohne Füllung.
  const look = (name: string) =>
    cell(page, name).evaluate((el) => {
      const style = getComputedStyle(el)
      return { opacity: style.opacity, border: style.borderTopStyle, fill: style.backgroundColor }
    })
  expect((await look('Geist, Mittwoch: 1 von 5')).opacity).toBe('0.2')
  expect((await look('Geist, Montag: 1,5 von 5')).opacity).toBe('0.4')
  expect((await look('Körper, Samstag: 3 von 5')).opacity).toBe('0.6')
  expect((await look('Körper, Freitag: 4 von 5')).opacity).toBe('0.8')
  const filled = await look('Körper, Freitag: 4 von 5')
  expect(filled.border).not.toBe('dashed')
  const empty = await look('Geist, Donnerstag: kein Check-in')
  expect(empty.border).toBe('dashed')
  expect(empty.opacity).toBe('1')
  expect(empty.fill).toBe('rgba(0, 0, 0, 0)')

  // Muster-Satz (ab 7 Check-ins in 14 Tagen), kein Hinweis.
  await expect(week.getByText('Am niedrigsten ist zurzeit dein Geist.', { exact: true })).toBeVisible()
  await expect(week.getByText('Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.')).toHaveCount(0)

  // Fokus-Zeile: nur die zwei Sprints der letzten 7 Tage.
  await expect(week.getByText('Diese Woche: 2 Sprints, 1 Std. 15 Min Fokus', { exact: true })).toBeVisible()

  // Was bei dir wirkt: drei Zeilen in der Reihenfolge der Wirkung, mit Platz, Titel, Bereich und Stufen.
  await expect(week.getByRole('heading', { level: 3, name: 'Was bei dir wirkt', exact: true })).toBeVisible()
  const works = week.getByRole('listitem')
  await expect(works).toHaveText([
    '1 · Kopf leeren · Geist · +2 Stufen',
    '2 · Bewegungs-Snack · Körper · +1,5 Stufen',
    '3 · Physiologischer Seufzer · Gefühl · +0,5 Stufen',
  ])
  await expect(week.getByText('Bewerte nach einem Hack kurz', { exact: false })).toHaveCount(0)

  // In der Bibliothek trägt der beste Hack „wirkt bei dir“.
  await expect(tile(page, 'Kopf leeren')).toContainText('wirkt bei dir')
})

test('an empty week shows dashed cells, both hints and no focus line', async ({ page }) => {
  await open(page)
  const week = weekCard(page)
  const cells = week.getByRole('img')
  await expect(cells).toHaveCount(28)
  const looks = await cells.evaluateAll((els) =>
    els.map((el) => ({ name: el.getAttribute('aria-label') ?? '', border: getComputedStyle(el).borderTopStyle, opacity: getComputedStyle(el).opacity })),
  )
  expect(looks.every((l) => l.name.endsWith(': kein Check-in'))).toBe(true)
  expect(looks.every((l) => l.border === 'dashed' && l.opacity === '1')).toBe(true)

  await expect(week.getByText('Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.', { exact: true })).toBeVisible()
  await expect(week.getByRole('heading', { level: 3, name: 'Was bei dir wirkt', exact: true })).toBeVisible()
  await expect(
    week.getByText('Bewerte nach einem Hack kurz, wie es dir jetzt geht. Ab zwei Bewertungen je Hack siehst du hier, was bei dir wirkt.', { exact: true }),
  ).toBeVisible()
  await expect(week.getByText(/^Diese Woche:/)).toHaveCount(0)
  await expect(week.getByRole('listitem')).toHaveCount(0)
})

test('with few check-ins the week shows the cells but only the hint instead of patterns', async ({ page }) => {
  await open(page, { checkins: WEEK_CHECKINS.slice(2, 7) }) // fünf Check-ins in 14 Tagen
  const week = weekCard(page)
  await expect(week.getByText('Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.', { exact: true })).toBeVisible()
  await expect(week.getByText(/Am niedrigsten/)).toHaveCount(0)
  await expect(cell(page, 'Geist, Freitag: 2 von 5')).toBeVisible()
})

test('the sprint line counts one sprint in the singular', async ({ page }) => {
  await open(page, { focusSprints: [WEEK_SPRINTS[0]] })
  await expect(weekCard(page).getByText('Diese Woche: 1 Sprint, 25 Min Fokus', { exact: true })).toBeVisible()
})

test.describe('on a 360px phone with 130% text, sprint and week', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const sticksOut = (page: Page, selector: string) =>
    page.locator(selector).evaluate((root) =>
      [...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5).length,
    )
  const pageScrolls = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

  test('the card, the week grid and its cells fit the screen', async ({ page }) => {
    await open(page, { checkins: WEEK_CHECKINS, hackRuns: WEEK_RUNS, focusSprints: WEEK_SPRINTS })
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await sprintField(page).fill('x'.repeat(80))
    expect(await sticksOut(page, '.screen')).toBe(0)
    expect(await pageScrolls(page)).toBe(false)
    // Auch bei 130 % bleiben die Felder sichtbar groß (kein Zusammenschieben auf wenige Pixel) und innerhalb der Karte.
    const card = (await weekCard(page).boundingBox())!
    for (const box of await weekCard(page).getByRole('img').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeGreaterThanOrEqual(18)
      expect(box.height).toBeGreaterThanOrEqual(18)
      expect(box.left).toBeGreaterThanOrEqual(card.x)
      expect(box.right).toBeLessThanOrEqual(card.x + card.width)
    }
  })

  test('an 80 character task without spaces wraps inside the player', async ({ page }) => {
    await open(page, { live: true })
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    const task = 'Kurskonzeptmodul'.repeat(5) // 80 Zeichen, kein Leerzeichen
    expect(task).toHaveLength(80)
    await sprintField(page).fill(task)
    await startSprintButton(page).click()
    const player = sprintDialog(page)
    await expect(player.getByRole('timer')).toBeVisible()

    const line = player.getByText(task, { exact: true })
    await expect(line).toBeVisible()
    const { width, height, lineHeight } = await line.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    }))
    expect(width).toBeLessThanOrEqual(360)
    expect(height).toBeGreaterThan(lineHeight * 1.5) // mehr als eine Zeile: Das Wort bricht um
    expect(await sticksOut(page, '[role="dialog"]')).toBe(0)
    expect(await pageScrolls(page)).toBe(false)
    expect(await player.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    // Auch mit fünf Zeilen Vorhaben liegen Pause und Beenden ohne Blättern im Bild.
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport()
    await expect(player.getByRole('button', { name: 'Beenden', exact: true })).toBeInViewport()

    await player.getByRole('button', { name: 'Beenden', exact: true }).click() // unter 5 Minuten: schließt
    await expect(sprintDialog(page)).toHaveCount(0)
  })
})

// ── Die Zeit steht nicht still (Ruling R15) ──────────────────────────────────────────────────────────────────────

// Bleibt die App im Speicher und kommt aus dem Hintergrund zurück (`visibilitychange`, kein Neuladen), rechnen Kopfzeile,
// Akku, Reset und Woche mit der neuen Uhrzeit: Ein Check-in, der alt geworden ist, gilt nicht mehr als frisch, und das
// Raster rückt mit dem Kalendertag weiter.
test('returning to the app after hours moves the header, the battery, the reset and the week on without a reload', async ({ page }) => {
  await open(page, { checkins: [checkin('c-1', '2026-10-21T13:00:00+02:00', [4, 3, 2, 4])] }) // NOW ist 14 Uhr
  await expect(page.getByText('Letzter Check-in vor 1 Std.')).toBeVisible()
  await expect(akkuCard(page).getByRole('button', { name: 'Neuer Check-in' })).toBeVisible()
  await expect(resetCard(page).getByText('Dein Geist ist gerade am niedrigsten.')).toBeVisible()
  await expect(weekCard(page).getByRole('img').first()).toHaveAccessibleName('Körper, Donnerstag: kein Check-in')
  await page.evaluate(() => ((window as unknown as { ruheMarker: boolean }).ruheMarker = true)) // übersteht nur ohne Neuladen

  // Fünf Stunden später (18 Uhr): 5 Std. alt, nicht mehr frisch.
  await page.clock.setFixedTime(new Date('2026-10-21T18:00:00+02:00'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('Letzter Check-in vor 5 Std.')).toBeVisible({ timeout: 2000 })
  await expect(akkuCard(page).getByText('Wie voll ist dein Akku?')).toBeVisible()
  await expect(akkuCard(page).getByRole('button', { name: 'Check-in', exact: true })).toBeVisible()
  await expect(resetCard(page).getByText('Was braucht gerade Energie?')).toBeVisible()

  // Einen Tag später (Donnerstag): Der Check-in ist von gestern, das Raster beginnt am Freitag.
  await page.clock.setFixedTime(new Date('2026-10-22T14:00:00+02:00'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('Noch kein Check-in heute')).toBeVisible({ timeout: 2000 })
  await expect(weekCard(page).getByRole('img').first()).toHaveAccessibleName('Körper, Freitag: kein Check-in')
  expect(await page.evaluate(() => (window as unknown as { ruheMarker?: boolean }).ruheMarker)).toBe(true)
})
