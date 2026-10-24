import { test, expect, type Page } from '@playwright/test'

// Eigene Atemmuster unter „Atmen“ (Spec M8). Ohne gesätes Muster startet die App leer.
type Own = { id: string; name: string; inhale: number; holdIn: number; exhale: number; holdOut: number }
const own = (id: string, name: string, over: Partial<Own> = {}): Own => ({ id, name, inhale: 4, holdIn: 2, exhale: 6, holdOut: 0, ...over })
const ABENDRUHE = own('eigen-0123abcd', 'Abendruhe')
const SETTINGS = { vibration: true, breathSound: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, breathBackground: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

// addInitScript läuft bei jedem Laden; der Merker in sessionStorage sät nur einmal je Test.
async function seed(page: Page, data: { breathPatterns?: Own[]; lastUsed?: object }) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, ...data }))
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name }).click()

async function openAtmen(page: Page) {
  await page.goto('./')
  await nav(page, 'Atmen')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const section = (page: Page) => page.getByRole('region', { name: 'Eigene Muster' })
const editor = (page: Page) => page.getByRole('dialog', { name: /^(Neues Muster|Muster bearbeiten)$/ })
const stepper = (page: Page, label: string) => editor(page).getByRole('group', { name: label, exact: true })
const tap = (page: Page, name: string) => editor(page).getByRole('button', { name, exact: true }).click()

test('empty: the section invites to create a pattern', async ({ page }) => {
  await openAtmen(page)
  await expect(section(page).getByRole('heading', { level: 2 })).toHaveText('Eigene Muster')
  await expect(section(page).getByText('Stell dir deinen eigenen Rhythmus zusammen.')).toBeVisible()
  await expect(section(page).getByRole('button', { name: 'Neues Muster' })).toBeVisible()
})

test('create, list and start a pattern', async ({ page }) => {
  await openAtmen(page)
  await section(page).getByRole('button', { name: 'Neues Muster' }).click()
  await expect(editor(page)).toHaveAccessibleName('Neues Muster')
  await expect(editor(page).getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'Eigenes Muster')
  await editor(page).getByRole('textbox', { name: 'Name' }).fill('Abendruhe')
  await tap(page, 'Einatmen länger')
  await tap(page, 'Einatmen länger')
  await tap(page, 'Halten nach dem Einatmen kürzer')
  await expect(stepper(page, 'Einatmen')).toContainText('5 s')
  await expect(stepper(page, 'Halten nach dem Einatmen')).toContainText('1,5 s')
  await expect(editor(page).getByText('Ein Atemzug dauert 12,5 s, etwa 4,8 pro Minute.')).toBeVisible()
  await tap(page, 'Speichern')

  await expect(editor(page)).toHaveCount(0)
  const start = section(page).getByRole('button', { name: 'Abendruhe starten', exact: true })
  await expect(start).toBeVisible()
  await expect(start).toHaveAccessibleDescription('Einatmen 5 s · Halten 1,5 s · Ausatmen 6 s')
  const [pattern] = (await stored(page)).breathPatterns
  expect(pattern).toMatchObject({ name: 'Abendruhe', inhale: 5, holdIn: 1.5, exhale: 6, holdOut: 0 })
  expect(pattern.id).toMatch(/^eigen-[0-9a-f]{8}$/)

  await page.getByRole('radio', { name: '1 Min' }).click()
  await start.click()
  const player = page.getByRole('dialog', { name: 'Atemübung' })
  await expect(player.getByRole('heading', { name: 'Atmen · Abendruhe' })).toBeVisible()
  await expect(player.getByText('Einatmen 5 s · Halten 1,5 s · Ausatmen 6 s')).toBeVisible()
  await expect(player.locator('.phase')).toHaveText('Einatmen')
  expect((await stored(page)).lastUsed).toEqual({ kind: 'breath', pattern: pattern.id, minutes: 1 })
})

// Review Focus 4: An den Grenzen ist Schluss.
test('limits: the buttons stop at the bounds', async ({ page }) => {
  await openAtmen(page)
  await section(page).getByRole('button', { name: 'Neues Muster' }).click()
  for (let i = 0; i < 4; i++) await tap(page, 'Einatmen kürzer')
  await expect(stepper(page, 'Einatmen')).toContainText('2 s')
  await expect(editor(page).getByRole('button', { name: 'Einatmen kürzer', exact: true })).toBeDisabled()
  await expect(editor(page).getByRole('button', { name: 'Einatmen länger', exact: true })).toBeEnabled()
  await expect(editor(page).getByRole('button', { name: 'Halten nach dem Ausatmen kürzer' })).toBeDisabled()
  await expect(stepper(page, 'Halten nach dem Ausatmen')).toContainText('0 s')
})

// Review Focus 5: „Behalten“ behält.
test('edit and delete with confirmation', async ({ page }) => {
  await seed(page, { breathPatterns: [ABENDRUHE] })
  await openAtmen(page)
  await section(page).getByRole('button', { name: 'Abendruhe bearbeiten' }).click()
  await expect(editor(page)).toHaveAccessibleName('Muster bearbeiten')
  await expect(editor(page).getByRole('textbox', { name: 'Name' })).toHaveValue('Abendruhe')
  await editor(page).getByRole('textbox', { name: 'Name' }).fill('Morgen')
  await tap(page, 'Speichern')
  await expect(section(page).getByRole('button', { name: 'Morgen starten' })).toBeVisible()
  expect((await stored(page)).breathPatterns).toEqual([{ ...ABENDRUHE, name: 'Morgen' }])

  await section(page).getByRole('button', { name: 'Morgen bearbeiten' }).click()
  await tap(page, 'Löschen')
  const confirm = page.getByRole('alertdialog', { name: 'Muster löschen?' })
  await expect(confirm).toContainText('„Morgen“ verschwindet aus der Liste. Deine bisherigen Sitzungen bleiben in der Statistik.')
  await confirm.getByRole('button', { name: 'Behalten' }).click()
  await expect(confirm).toHaveCount(0)
  expect((await stored(page)).breathPatterns).toHaveLength(1)

  await tap(page, 'Löschen')
  await confirm.getByRole('button', { name: 'Löschen' }).click()
  await expect(editor(page)).toHaveCount(0)
  await expect(section(page).getByText('Stell dir deinen eigenen Rhythmus zusammen.')).toBeVisible()
  expect(await stored(page)).not.toHaveProperty('breathPatterns')
})

// Review Focus 5: Verlassen ohne Speichern ändert nichts.
test('leaving the editor discards the changes', async ({ page }) => {
  await seed(page, { breathPatterns: [ABENDRUHE] })
  await openAtmen(page)
  await section(page).getByRole('button', { name: 'Abendruhe bearbeiten' }).click()
  await editor(page).getByRole('textbox', { name: 'Name' }).fill('Anders')
  await tap(page, 'Einatmen länger')
  await page.goBack()
  await expect(editor(page)).toHaveCount(0)
  await expect(section(page).getByRole('button', { name: 'Abendruhe starten' })).toBeVisible()

  await section(page).getByRole('button', { name: 'Abendruhe bearbeiten' }).click()
  await expect(editor(page).getByRole('textbox', { name: 'Name' })).toHaveValue('Abendruhe')
  await editor(page).getByRole('textbox', { name: 'Name' }).fill('Anders')
  await page.mouse.click(20, 20) // die Fläche über dem Blatt
  await expect(editor(page)).toHaveCount(0)
  expect((await stored(page)).breathPatterns).toEqual([ABENDRUHE])
})

test('at most six patterns', async ({ page }) => {
  await seed(page, { breathPatterns: Array.from({ length: 6 }, (_, i) => own(`eigen-0000000${i}`, `Muster ${i + 1}`)) })
  await openAtmen(page)
  await expect(section(page).getByRole('button', { name: /starten$/ })).toHaveCount(6)
  await expect(section(page).getByRole('button', { name: 'Neues Muster' })).toHaveCount(0)
  await expect(section(page).getByText('Höchstens 6 eigene Muster.')).toBeVisible()
})

test('a reload keeps the patterns', async ({ page }) => {
  await openAtmen(page)
  await section(page).getByRole('button', { name: 'Neues Muster' }).click()
  await editor(page).getByRole('textbox', { name: 'Name' }).fill('Abendruhe')
  await tap(page, 'Speichern')
  await page.reload()
  await nav(page, 'Atmen')
  await expect(section(page).getByRole('button', { name: 'Abendruhe starten' })).toBeVisible()
})

test.describe('Heute', () => {
  const lastUsedCard = (page: Page) =>
    page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Zuletzt genutzt', exact: true }) })

  test('the last used own pattern restarts', async ({ page }) => {
    await seed(page, { breathPatterns: [ABENDRUHE], lastUsed: { kind: 'breath', pattern: ABENDRUHE.id, minutes: 1 } })
    await page.goto('./')
    await expect(lastUsedCard(page).getByText('Abendruhe · 1 Min', { exact: true })).toBeVisible()
    await lastUsedCard(page).getByRole('button', { name: 'Erneut starten' }).click()
    await expect(page.getByRole('dialog', { name: 'Atemübung' }).getByRole('heading', { name: 'Atmen · Abendruhe' })).toBeVisible()
  })

  // Review Focus 1: gelöscht, dann der Ersatz.
  test('deleted, the card falls back to „Ankommen im Atem“', async ({ page }) => {
    await seed(page, { breathPatterns: [ABENDRUHE], lastUsed: { kind: 'breath', pattern: ABENDRUHE.id, minutes: 1 } })
    await openAtmen(page)
    await section(page).getByRole('button', { name: 'Abendruhe bearbeiten' }).click()
    await tap(page, 'Löschen')
    await page.getByRole('alertdialog', { name: 'Muster löschen?' }).getByRole('button', { name: 'Löschen' }).click()
    await nav(page, 'Heute')
    await expect(lastUsedCard(page).getByText('Ankommen im Atem · 5 Min', { exact: true })).toBeVisible()
    await expect(lastUsedCard(page).getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
    await expect(lastUsedCard(page).getByRole('button', { name: 'Erneut starten' })).toHaveCount(0)
  })
})

test.describe('on a small phone at 130 %', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const fitsSideways = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

  async function expectTargets(scope: ReturnType<Page['locator']>) {
    for (const target of await scope.getByRole('button').all()) {
      const box = (await target.boundingBox())!
      const name = await target.getAttribute('aria-label') ?? await target.innerText()
      expect(box.height, name).toBeGreaterThanOrEqual(48)
      expect(box.width, name).toBeGreaterThanOrEqual(48)
    }
  }

  // Ein einziges langes Wort (29 Zeichen, erlaubt sind 30) bricht notfalls im Wort um, statt überzulaufen (Spec §8).
  test('a name of one long word stays inside the player, „Heute“ and the delete question', async ({ page }) => {
    const long = own('eigen-0000000c', 'Atemrhythmusentspannungsübung')
    // Weder läuft der Text aus seinem Element noch das Element über den rechten Rand seines Behälters.
    const inside = async (locator: ReturnType<Page['locator']>, container: ReturnType<Page['locator']>) => {
      const [box, outer] = [(await locator.boundingBox())!, (await container.boundingBox())!]
      return box.x + box.width <= outer.x + outer.width + 1 && (await locator.evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    }
    const larger = () => page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await seed(page, { breathPatterns: [long], lastUsed: { kind: 'breath', pattern: long.id, minutes: 1 } })

    await page.goto('./')
    await larger()
    const card = page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Zuletzt genutzt', exact: true }) })
    const summary = card.locator('.hint')
    await expect(summary).toHaveText('Atemrhythmusentspannungsübung · 1 Min')
    expect(await inside(summary, card), 'Zusammenfassung auf „Heute“').toBe(true)

    await page.getByRole('button', { name: 'Erneut starten' }).click()
    const player = page.getByRole('dialog', { name: 'Atemübung' })
    const title = player.getByRole('heading', { level: 2 })
    await expect(title).toHaveText('Atmen · Atemrhythmusentspannungsübung')
    expect(await inside(title, player), 'Titel im Player').toBe(true)

    await page.reload()
    await nav(page, 'Atmen')
    await larger()
    await section(page).getByRole('button', { name: `${long.name} bearbeiten` }).click()
    await tap(page, 'Löschen')
    const confirm = page.getByRole('alertdialog', { name: 'Muster löschen?' })
    await expect(confirm).toBeVisible()
    expect(await inside(confirm.locator('.text'), confirm), 'Satz der Rückfrage').toBe(true)
    expect(await fitsSideways(page)).toBe(true)
  })

  test('list and editor keep their buttons at least 48 px and nothing scrolls sideways', async ({ page }) => {
    await seed(page, { breathPatterns: [ABENDRUHE, own('eigen-0000000a', 'Ruhiger Abend nach langem Tag', { inhale: 4.5, holdIn: 12.5, exhale: 10.5, holdOut: 12.5 })] })
    await openAtmen(page)
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await section(page).scrollIntoViewIfNeeded()
    expect(await fitsSideways(page)).toBe(true)
    await expectTargets(section(page))

    await section(page).getByRole('button', { name: 'Ruhiger Abend nach langem Tag bearbeiten' }).click()
    await expect(editor(page)).toBeVisible()
    expect(await fitsSideways(page)).toBe(true)
    expect(await editor(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expectTargets(editor(page))
  })
})
