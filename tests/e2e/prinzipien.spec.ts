import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'
import { alignOverSheet, doubleTap } from './taps'

// Prinzipien & Wachstum (Spec M12): die Karte „Deine Prinzipien“ unter „Energie“, das Blatt „Deine Sammlung“ mit Editor,
// Rückfrage und „Notizen einfügen“, die Sonntagswahl im Logbuch, der Morgen-Kasten und „Deine Woche“. Der Browser läuft in
// Berlin; die Uhr steht fest (`setFixedTime`), solange kein Programm läuft. Alle Einträge sind erfunden und neutral
// (Spec M12 §3.2). Der 1.11.2026 ist ein Sonntag, der 2.11.2026 ein Montag (Winterzeit, +01:00).
test.use({ timezoneId: 'Europe/Berlin' })

const at = (time: string, day: string) => new Date(`${day}T${time}+01:00`)
const MONDAY = at('10:00:00', '2026-11-02')

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

const P = { id: 's-0000000a', kind: 'prinzip', text: 'Mehrweg statt Einweg', note: 'Dann fällt weniger Müll an.', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' }
const D = { id: 's-0000000d', kind: 'prinzip', text: 'Dranbleiben' }
const F = { id: 's-0000000b', kind: 'feld', text: 'Schach lernen', step: 'Jeden Abend eine Eröffnung nachspielen.' }
const F2 = { id: 's-0000000e', kind: 'feld', text: 'Mehrweg im Alltag', step: 'Eine Stofftasche einpacken.' }
const E = { id: 's-0000000c', kind: 'erkenntnis', text: 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', source: 'Ein Schachkurs' }

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)
/** Die neuen Knöpfe sperren Tipps 400 ms lang ohne `disabled` (Spec M12 §2.10); 600 ms Puffer, falls der Timer später feuert. */
const settle = (page: Page) => page.waitForTimeout(600)

const card = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Deine Prinzipien', exact: true }) })
const openButton = (page: Page) => card(page).getByRole('button', { name: 'Sammlung öffnen', exact: true })
const collection = (page: Page) => page.getByRole('dialog', { name: 'Deine Sammlung', exact: true })
const editor = (page: Page) =>
  page.getByRole('dialog', { name: /^(Neues Prinzip|Prinzip bearbeiten|Neue Erkenntnis|Erkenntnis bearbeiten|Neues Wachstumsfeld|Wachstumsfeld bearbeiten)$/ })
const paste = (page: Page) => page.getByRole('dialog', { name: 'Notizen einfügen', exact: true })
const weekCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Deine Woche', exact: true }) })
const row = (page: Page, text: string) => collection(page).getByRole('button', { name: `${text} bearbeiten`, exact: true })

/** Öffnet die App zur festen Uhrzeit mit einem Stand und wählt den Reiter; auf „Heute“ ist die h1 die Begrüßung. */
async function open(page: Page, now: Date, data: object = {}, tab = 'Energie') {
  await page.clock.setFixedTime(now)
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, ...data }))
  await page.goto('./')
  if (tab === 'Heute') {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    return
  }
  await nav(page).getByRole('button', { name: tab }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab)
}

async function resume(page: Page, now: Date) {
  await page.clock.setFixedTime(now)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

async function openCollection(page: Page) {
  await settle(page)
  await openButton(page).click()
  await expect(collection(page)).toBeVisible()
  await settle(page)
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

// ── Karte, Sammlung und Editor ───────────────────────────────────────────────────────────────────────────────────

test('1 Sammlung: Leertexte, anlegen, Doppel, Neuladen, ändern, löschen mit Rückfrage', async ({ page }) => {
  await open(page, MONDAY)
  const save = editor(page).getByRole('button', { name: 'Speichern', exact: true })
  const leitsatz = editor(page).getByRole('textbox', { name: 'Leitsatz', exact: true })
  const remove = editor(page).getByRole('button', { name: 'Löschen', exact: true })
  const confirm = page.getByRole('alertdialog', { name: 'Prinzip löschen?', exact: true })

  await expectMotiv(card(page).locator('img'), 'energie-sinn', 56)
  await expect(card(page)).toContainText('Halte fest, was dich leitet, was du aus Büchern mitnimmst und woran du wachsen willst.')

  await openCollection(page)
  await collection(page).getByRole('button', { name: 'Neues Prinzip', exact: true }).click()
  await expect(editor(page)).toHaveAccessibleName('Neues Prinzip')
  await expect(editor(page)).toContainText('Kurz und als Richtung, nicht als strenge Regel.')
  await expect(leitsatz).toHaveAttribute('placeholder', 'z. B. Mehrweg statt Einweg')
  await expect(save).toBeDisabled()

  await leitsatz.fill(P.text)
  await expect(editor(page).getByText('20 / 60', { exact: true })).toBeVisible()
  await expect(save).toBeEnabled()
  await editor(page).getByRole('textbox', { name: 'Wenn-dann (freiwillig)', exact: true }).fill(P.ifThen)
  await settle(page)
  await save.click()
  await expect(editor(page)).toHaveCount(0)
  await expect(row(page, P.text)).toHaveAccessibleDescription(P.ifThen)

  await settle(page)
  await collection(page).getByRole('button', { name: 'Neues Prinzip', exact: true }).click()
  await leitsatz.fill(' mehrweg  statt EINWEG ')
  await expect(editor(page).getByText('Das steht schon in deiner Sammlung.', { exact: true })).toBeVisible()
  await expect(save).toBeDisabled()
  await expect(leitsatz).toHaveAccessibleDescription(/Das steht schon in deiner Sammlung\./)
  await expect(save).toHaveAccessibleDescription('Das steht schon in deiner Sammlung.')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)

  // Neuladen mitten im Editor (Spec M12 §6): nichts gespeichert, kein Blatt offen.
  await settle(page)
  await row(page, P.text).click()
  await leitsatz.fill('Mehrweg statt Einweg im Alltag')
  await page.reload()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(collection(page)).toHaveCount(0)
  await expect(editor(page)).toHaveCount(0)
  await expect(card(page)).toContainText('Hier steht jeden Tag eine deiner Erkenntnisse, sobald du welche festhältst.')
  const afterReload = (await stored(page)).collection
  expect(afterReload).toHaveLength(1)
  expect(afterReload[0]).toMatchObject({ kind: 'prinzip', text: P.text, ifThen: P.ifThen })
  await openCollection(page)
  await expect(row(page, P.text)).toBeVisible()

  await row(page, P.text).click()
  await leitsatz.fill('Mehrweg statt Einweg im Alltag')
  await settle(page)
  await save.click()
  await expect(editor(page)).toHaveCount(0)
  await settle(page)
  await row(page, 'Mehrweg statt Einweg im Alltag').click()
  await settle(page)
  await remove.click()
  await expect(confirm).toContainText('„Mehrweg statt Einweg im Alltag“ verschwindet aus deiner Sammlung.')
  await confirm.getByRole('button', { name: 'Behalten', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await expect(remove).toBeFocused()
  await settle(page)
  await remove.click()
  await settle(page)
  await confirm.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
  await expect(row(page, 'Mehrweg statt Einweg im Alltag')).toHaveCount(0)
  expect(await stored(page)).not.toHaveProperty('collection')
})

test('2 Ebenen, Fokus und Doppeltipps', async ({ page }) => {
  test.setTimeout(60_000) // viele Sperren von 600 ms und Doppeltipps, keine Echtzeit
  await open(page, MONDAY, { collection: [P] })
  const save = editor(page).getByRole('button', { name: 'Speichern', exact: true })
  const leitsatz = editor(page).getByRole('textbox', { name: 'Leitsatz', exact: true })
  const remove = editor(page).getByRole('button', { name: 'Löschen', exact: true })
  const confirm = page.getByRole('alertdialog', { name: 'Prinzip löschen?', exact: true })
  const keep = confirm.getByRole('button', { name: 'Behalten', exact: true })
  const confirmDelete = confirm.getByRole('button', { name: 'Löschen', exact: true })
  const RENAMED = 'Mehrweg statt Einweg im Alltag'

  // 1. Ein Doppeltipp auf „Sammlung öffnen“ öffnet nur die Sammlung.
  await settle(page)
  await doubleTap(page, openButton(page), 0.5)
  await expect(collection(page)).toBeVisible()
  await expect(editor(page)).toHaveCount(0)

  // 2. Die Zurück-Geste schließt nur den Editor, der Fokus geht an die Zeile; Escape schließt dann die Sammlung.
  await settle(page)
  await row(page, P.text).click()
  await expect(editor(page)).toBeVisible()
  await page.goBack()
  await expect(editor(page)).toHaveCount(0)
  await expect(collection(page)).toBeVisible()
  await expect(row(page, P.text)).toBeFocused()
  await settle(page)
  await page.keyboard.press('Escape')
  await expect(collection(page)).toHaveCount(0)
  await expect(openButton(page)).toBeFocused()

  // 3. Ein Doppeltipp auf eine Zeile öffnet den Editor und ändert nichts.
  await openCollection(page)
  await doubleTap(page, row(page, P.text), 0.5)
  await expect(editor(page)).toBeVisible()
  expect((await stored(page)).collection).toEqual([P])

  // 4. Ein Doppeltipp auf „Speichern“ über der kurzen Sammlung speichert einmal und lässt die Sammlung offen.
  await leitsatz.fill(RENAMED)
  await settle(page)
  await doubleTap(page, save, 0.5)
  await expect(editor(page)).toHaveCount(0)
  await expect(collection(page)).toBeVisible()
  const renamed = (await stored(page)).collection
  expect(renamed).toHaveLength(1)
  expect(renamed[0].text).toBe(RENAMED)

  // 5. Rückfrage über dem Editor: Der zweite Tipp trifft das „Löschen“ der Rückfrage bzw. „Speichern“ und bewirkt nichts.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await settle(page)
  await row(page, RENAMED).click()
  await settle(page)
  await remove.click()
  await expect(confirm).toBeVisible()
  await alignOverSheet(page, confirm, confirmDelete, remove)
  await keep.click()
  await expect(confirm).toHaveCount(0)
  await settle(page)
  await doubleTap(page, remove, 0.5)
  await expect(confirm).toBeVisible()
  expect((await stored(page)).collection).toHaveLength(1)
  await settle(page)
  await alignOverSheet(page, confirm, keep, save)
  await doubleTap(page, keep, 0.5)
  await expect(confirm).toHaveCount(0)
  await expect(editor(page)).toBeVisible()
  expect((await stored(page)).collection).toEqual(renamed)

  // 6. Breiter Bildschirm: Ein Tipp neben das Blatt (über der Reiterleiste) schließt nur die oberste Ebene.
  await page.setViewportSize({ width: 800, height: 839 })
  await settle(page)
  await page.touchscreen.tap(8, 831)
  await expect(editor(page)).toHaveCount(0)
  await expect(collection(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await settle(page)
  await page.touchscreen.tap(8, 831)
  await expect(collection(page)).toHaveCount(0)

  // 7. Liegt „Sammlung öffnen“ über dem Blatt, schließt der erste Tipp die Sammlung, der zweite öffnet sie nicht wieder.
  await page.setViewportSize({ width: 412, height: 839 })
  const box = (await openButton(page).boundingBox())!
  await page.evaluate((dy) => window.scrollBy(0, dy), box.y - 40)
  await openCollection(page)
  const target = (await openButton(page).boundingBox())!
  const [x, y] = [target.x + target.width / 2, target.y + target.height / 2]
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(150)
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(500)
  await expect(collection(page)).toHaveCount(0)
})

