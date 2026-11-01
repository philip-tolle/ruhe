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

const flow = (page: Page) => page.getByRole('dialog', { name: 'Abend-Logbuch', exact: true })
const title = (page: Page, name: string) => flow(page).getByRole('heading', { level: 2, name, exact: true })

async function skipTo(page: Page, until: string) {
  for (let i = 0; i < 8 && (await title(page, until).count()) === 0; i++) await flow(page).getByRole('button', { name: 'Überspringen', exact: true }).click()
  await expect(title(page, until)).toBeFocused()
}

/** Auf „Heute“: „Kurz · 5 Min“ der Karte „Morgen-Start“, dann „Überspringen“ bis zur Intention. */
async function toIntention(page: Page) {
  const morning = page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
  const startCard = page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Morgen-Start', exact: true }) })
  await startCard.getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
  const intention = morning.getByRole('heading', { level: 2, name: 'Wie willst du heute sein?', exact: true })
  for (let i = 0; i < 4 && (await intention.count()) === 0; i++) await morning.getByRole('button', { name: 'Überspringen', exact: true }).click()
  await expect(intention).toBeVisible()
  return morning
}

/** Öffnet die Zeile, tippt „Löschen“, liest den Satz der Rückfrage, tippt „Behalten“ und schließt den Editor mit Escape. */
async function confirmText(page: Page, text: string): Promise<string> {
  await settle(page)
  await row(page, text).click()
  await settle(page)
  await editor(page).getByRole('button', { name: 'Löschen', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  const sentence = (await confirm.locator('p').textContent())!.trim()
  await confirm.getByRole('button', { name: 'Behalten', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await settle(page)
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  return sentence
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

  // 8. Ein Doppeltipp auf „… übernehmen“ über der kurzen Sammlung übernimmt einmal und lässt die Sammlung offen.
  await openCollection(page)
  await collection(page).getByRole('button', { name: 'Notizen einfügen', exact: true }).click()
  await settle(page)
  await paste(page).getByRole('textbox', { name: 'Deine Notizen', exact: true }).fill('Pausen helfen beim Lernen.\nMorgens zuerst ein Glas Wasser trinken.')
  await paste(page).getByRole('button', { name: 'Vorschau zeigen', exact: true }).click()
  await settle(page)
  await doubleTap(page, paste(page).getByRole('button', { name: '2 Erkenntnisse übernehmen', exact: true }), 0.5)
  await expect(paste(page)).toHaveCount(0)
  await expect(collection(page)).toBeVisible()
  await expect(editor(page)).toHaveCount(0)
  expect((await stored(page)).collection).toHaveLength(3)
})

// ── Notizen einfügen ────────────────────────────────────────────────────────────────────────────────────────────

const NOTES = [
  '- Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.',
  '- [ ] Morgens zuerst ein Glas Wasser trinken.',
  '-5 Grad am Morgen, trotzdem eine Runde gehen.',
  '1.',
  '',
  '---',
  '• Pausen helfen beim Lernen.',
  'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.',
  'Heute lerne ich etwas Neues. '.repeat(20),
].join('\n')
const LINES = [
  'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.',
  'Morgens zuerst ein Glas Wasser trinken.',
  '-5 Grad am Morgen, trotzdem eine Runde gehen.',
  'Pausen helfen beim Lernen.',
  `${'Heute lerne ich etwas Neues. '.repeat(17)}Heute l`,
]

test('3 Notizen einfügen: Vorschau, Zurück, Übernehmen, Statuszeile, Erkenntnis des Tages', async ({ page }) => {
  await open(page, MONDAY)
  const notes = paste(page).getByRole('textbox', { name: 'Deine Notizen', exact: true })
  const show = paste(page).getByRole('button', { name: 'Vorschau zeigen', exact: true })
  const pasteButton = collection(page).getByRole('button', { name: 'Notizen einfügen', exact: true })
  const preview = paste(page).getByRole('heading', { level: 3, name: 'Vorschau', exact: true })

  // 1. Die Textansicht
  await openCollection(page)
  await pasteButton.click()
  await expect(paste(page)).toContainText('Kopiere Text aus deiner Notiz-App und füge ihn hier ein. Jede Zeile wird eine Erkenntnis. Alles bleibt auf diesem Gerät.')
  await expect(notes).toHaveAttribute('placeholder', 'Eine Erkenntnis pro Zeile')
  await settle(page)

  // 2. Die Vorschau
  await notes.fill(NOTES)
  await paste(page).getByRole('textbox', { name: 'Quelle für alle (freiwillig)', exact: true }).fill('Ein Schachkurs')
  await show.click()
  await expect(preview).toBeFocused()
  for (const line of ['5 neue Erkenntnisse', '1 doppelt oder schon vorhanden, übersprungen.', '1 gekürzt auf 500 Zeichen.', 'Quelle: Ein Schachkurs']) {
    await expect(paste(page).getByText(line, { exact: true })).toBeVisible()
  }
  const items = paste(page).getByRole('listitem')
  await expect(items).toHaveCount(5)
  await expect(items.first()).toHaveText(LINES[0])
  for (let i = 0; i < 4; i++) await expect(items.nth(i)).not.toContainText('gekürzt')
  await expect(items.nth(4)).toContainText('gekürzt')

  // 3. Die Zurück-Geste führt zum Text; Text bleibt, der Fokus auf „Vorschau zeigen“.
  await page.goBack()
  await expect(notes).toHaveValue(NOTES)
  await expect(show).toBeFocused()

  // 4. Übernehmen
  await settle(page)
  await show.click()
  await settle(page)
  await paste(page).getByRole('button', { name: '5 Erkenntnisse übernehmen', exact: true }).click()
  await expect(paste(page)).toHaveCount(0)
  await expect(collection(page).getByRole('status')).toHaveText('5 Erkenntnisse übernommen.')
  await expect(pasteButton).toBeFocused()
  const saved = (await stored(page)).collection
  expect(saved.map((item: { text: string }) => item.text)).toEqual(LINES)
  for (const item of saved) expect(item).toMatchObject({ kind: 'erkenntnis', source: 'Ein Schachkurs' })

  // 5. Der Editor leert die Statuszeile; Escape schließt ihn, eine Zurück-Geste die Sammlung.
  await settle(page)
  await row(page, LINES[0]).click()
  await expect(editor(page)).toHaveAccessibleName('Erkenntnis bearbeiten')
  await expect(collection(page).getByRole('status')).toHaveText('')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1)
  await page.goBack()
  await expect(collection(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)

  // 6. Die Erkenntnis des Tages auf der Karte, am nächsten Tag eine andere
  const today = (await card(page).locator('.insight').textContent())!
  expect(LINES.some((line) => today.includes(line))).toBe(true)
  expect(today).toContain('Quelle: Ein Schachkurs')
  await resume(page, at('10:00:00', '2026-11-03'))
  await expect(card(page).locator('.insight')).not.toHaveText(today)

  // 7. Neuladen mitten im Einfügen (Spec M12 §6): nichts gespeichert, kein Blatt offen, der Rohtext nirgends im Speicher.
  await openCollection(page)
  await pasteButton.click()
  await settle(page)
  await notes.fill('Mehrweg statt Einweg im Büro')
  await show.click()
  await expect(preview).toBeFocused()
  await page.reload()
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(collection(page)).toHaveCount(0)
  await expect(paste(page)).toHaveCount(0)
  expect((await stored(page)).collection.map((item: { text: string }) => item.text)).toEqual(LINES)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Mehrweg statt Einweg im Büro')
})


// ── Prinzip der Woche ───────────────────────────────────────────────────────────────────────────────────────────

test('4 Sonntag: Prinzip der Woche wählen, Abschluss, alter Anker bis Mitternacht, ab Montag der neue', async ({ page }) => {
  await open(page, at('20:00:00', '2026-11-01'), { collection: [D, P, F], evenings: [{ day: '2026-10-25', at: '2026-10-25T19:00:00.000Z', weekPrinciple: D.id }] })
  const next = flow(page).getByRole('button', { name: 'Weiter', exact: true })

  // 1. Bis „1 % besser“, ein Satz
  const startCard = page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Tag abschließen', exact: true }) })
  await startCard.getByRole('button', { name: 'Starten', exact: true }).click()
  await expect(flow(page)).toBeVisible()
  await skipTo(page, 'Was machst du morgen 1 % besser?')
  await flow(page).getByRole('textbox', { name: 'Was machst du morgen 1 % besser?', exact: true }).fill('Morgen zehn Minuten Schachaufgaben lösen.')
  await next.click()

  // 2. Die Wochenseite: „Deine Prinzipien“ zuerst, der Vorschlag „Dranbleiben“ steht nur als Prinzip da.
  await expect(title(page, 'Deine Woche')).toBeFocused()
  const groupNames = await flow(page)
    .locator('[role="radiogroup"]')
    .evaluateAll((groups) => groups.map((g) => g.getAttribute('aria-label') ?? document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? ''))
  expect(groupNames).toEqual(['Deine Prinzipien', 'Vorschläge'])
  await expect(flow(page).getByRole('radiogroup', { name: 'Deine Prinzipien', exact: true }).getByRole('radio')).toHaveText(['Dranbleiben', 'Mehrweg statt Einweg'])
  await expect(flow(page).getByRole('radio', { name: 'Dranbleiben', exact: true })).toHaveCount(1)

  // 3. Das Prinzip wählen und abschließen
  await flow(page).getByRole('radio', { name: 'Mehrweg statt Einweg', exact: true }).click()
  await next.click()
  await expect(flow(page)).toContainText('Für die neue Woche: Mehrweg statt Einweg')
  const saved = (await stored(page)).evenings.find((e: { day: string }) => e.day === '2026-11-01')
  expect(saved).toMatchObject({ better: 'Morgen zehn Minuten Schachaufgaben lösen.', weekPrinciple: P.id })
  expect(saved).not.toHaveProperty('weekFocus')
  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)

  // 4. Sonntagabend: der alte Anker gilt noch; die Rückfrage kennt beide Prinzipien.
  await resume(page, at('21:00:00', '2026-11-01'))
  await expect(weekCard(page)).toContainText('Prinzip der Woche: Dranbleiben')
  await openCollection(page)
  expect(await confirmText(page, P.text)).toBe('„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.')
  expect(await confirmText(page, D.text)).toBe('„Dranbleiben“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche.')
  await settle(page)
  await page.keyboard.press('Escape')
  await expect(collection(page)).toHaveCount(0)

  // 5. Ab Mitternacht gilt das neue Prinzip überall.
  await resume(page, at('00:30:00', '2026-11-02'))
  await nav(page).getByRole('button', { name: 'Heute' }).click()
  const eveningCard = page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Dein Abend', exact: true }) })
  await expect(eveningCard).toContainText('Für die neue Woche: Mehrweg statt Einweg')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(weekCard(page)).toContainText('Prinzip der Woche: Mehrweg statt Einweg')
})

test('5 Montag: Prinzip der Woche im Morgen-Kasten und in „Deine Woche“; umbenennen, löschen', async ({ page }) => {
  await open(page, at('07:00:00', '2026-11-02'), { collection: [P, F], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }] }, 'Heute')
  const RENAMED = 'Mehrweg statt Einweg im Alltag'

  // 1. Der Morgen-Kasten: Leitsatz und Wenn-dann, ohne Erklärung
  const morning = await toIntention(page)
  const box = morning.getByRole('region', { name: 'Von gestern Abend', exact: true })
  for (const text of ['Prinzip der Woche', P.text, P.ifThen]) await expect(box).toContainText(text)
  await expect(box).not.toContainText(P.note)
  await morning.getByRole('button', { name: 'Morgen-Start beenden', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(morning).toHaveCount(0)

  // 2. „Deine Woche“
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(weekCard(page)).toContainText('Prinzip der Woche: Mehrweg statt Einweg')
  await expect(weekCard(page)).toContainText(P.ifThen)

  // 3. Umbenennen folgt sofort
  await openCollection(page)
  await row(page, P.text).click()
  await editor(page).getByRole('textbox', { name: 'Leitsatz', exact: true }).fill(RENAMED)
  await settle(page)
  await editor(page).getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
  await settle(page)
  await page.keyboard.press('Escape')
  await expect(collection(page)).toHaveCount(0)
  await expect(weekCard(page)).toContainText(`Prinzip der Woche: ${RENAMED}`)

  // 4. Löschen: die Rückfrage nennt die Folge, danach steht kein Anker da.
  await openCollection(page)
  await row(page, RENAMED).click()
  await settle(page)
  await editor(page).getByRole('button', { name: 'Löschen', exact: true }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Prinzip löschen?', exact: true })
  await expect(confirm).toContainText(`„${RENAMED}“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.`)
  await settle(page)
  await confirm.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
  await settle(page)
  await page.keyboard.press('Escape')
  await expect(collection(page)).toHaveCount(0)
  await expect(weekCard(page)).not.toContainText('Prinzip der Woche:')
  await expect(weekCard(page)).not.toContainText('Wochenfokus:')
})
