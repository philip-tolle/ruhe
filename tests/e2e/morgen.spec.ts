import { test, expect, type Page } from '@playwright/test'
import { expectMotiv } from './motiv'
import { doubleTap } from './taps'

// Der Morgen-Start (Spec M10 §2.2, §2.3): die Karte im Reiter „Energie“ und der Ablauf im Vollbild. Der Browser läuft in
// Berlin; die meisten Tests setzen nur die Uhrzeit (`setFixedTime`), kein Programm läuft dabei (R1). Die zwei Tests mit
// laufender Übung nehmen die echte Uhr und säen nichts, was von der Tageszeit abhängt: Die Karte „Morgen-Start“ im Reiter
// „Energie“ steht zu jeder Stunde. Alle Werte sind ausgedachte Testdaten.
test.use({ timezoneId: 'Europe/Berlin' })

// Der 28. Oktober 2026 liegt in der Winterzeit (MEZ, +01:00). An diesem Tag ist die Übung des Tages `strecken`
// (Tage seit 1.1.1970 = 20754, durch 3 ohne Rest).
const SEVEN = new Date('2026-10-28T07:00:00+01:00')
const DAY = '2026-10-28'
const YESTERDAY = '2026-10-27'

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen), wie in timer.spec.ts.
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

const card = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Morgen-Start', exact: true }) })
const flow = (page: Page) => page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
const title = (page: Page, name: string) => flow(page).getByRole('heading', { level: 2, name, exact: true })
const next = (page: Page) => flow(page).getByRole('button', { name: 'Weiter', exact: true })
const skip = (page: Page) => flow(page).getByRole('button', { name: 'Überspringen', exact: true })
const close = (page: Page) => flow(page).getByRole('button', { name: 'Morgen-Start beenden', exact: true })
const confirm = (page: Page) => page.getByRole('alertdialog', { name: 'Morgen-Start beenden?', exact: true })
const field = (page: Page, label: string) => flow(page).getByLabel(label, { exact: true })
const radio = (page: Page, group: string, name: string) => flow(page).getByRole('radiogroup', { name: group, exact: true }).getByRole('radio', { name, exact: true })
const dot = (page: Page, area: string, n: number, word: string) => flow(page).getByRole('radio', { name: `${area}: ${n} von 5, ${word}`, exact: true })

// Die Titel der Schritte.
const CHECKIN = 'Wie voll ist dein Akku?'
const ACTIVATE = 'Wach werden'
const DEEPEN = 'Noch fünf Minuten für dich'
const INTENTION = 'Wie willst du heute sein?'
const GRATITUDE = 'Wofür bist du heute dankbar?'
const DOMINO = 'Was ist heute dein Big Domino?'
const DONE = 'Dein Tag'

interface Seed {
  mornings?: object[]
  checkins?: object[]
}

// addInitScript läuft bei jeder Navigation; ein Merker in sessionStorage lässt es nur einmal je Test säen.
async function seed(page: Page, { mornings, checkins }: Seed) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ruhe.v1', json)
  }, JSON.stringify({
    version: 1,
    sessions: [],
    settings: SETTINGS,
    ...(checkins ? { energyCheckins: checkins } : {}),
    ...(mornings ? { mornings } : {}),
  }))
}

// Öffnet die App im Reiter „Energie“. Mit `now` steht die Uhr fest (ohne laufendes Programm); ohne läuft die echte.
async function open(page: Page, { now, ...seeded }: Seed & { now?: Date } = {}) {
  if (now) await page.clock.setFixedTime(now)
  if (seeded.mornings || seeded.checkins) await seed(page, seeded)
  await page.goto('./')
  await nav(page).getByRole('button', { name: 'Energie' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
}

type Variant = 'Kurz · 5 Min' | 'Lang · 15 Min'

async function start(page: Page, variant: Variant) {
  await card(page).getByRole('button', { name: variant, exact: true }).click()
  await expect(flow(page)).toBeVisible()
  await expect(title(page, CHECKIN)).toBeFocused()
}

// Alle vier Bereiche setzen und „Weiter“. Stufen: leer 1, schwach 2, mittel 3, gut 4, voll 5.
const WORDS = ['', 'leer', 'schwach', 'mittel', 'gut', 'voll']
async function checkin(page: Page, [koerper, gefuehl, geist, sinn]: [number, number, number, number]) {
  for (const [area, n] of [['Körper', koerper], ['Gefühl', gefuehl], ['Geist', geist], ['Sinn', sinn]] as const) {
    await dot(page, area, n, WORDS[n]).click()
  }
  await next(page).click()
  await expect(title(page, ACTIVATE)).toBeFocused()
}

// Überspringt Schritt für Schritt, bis der Titel `until` steht.
async function skipTo(page: Page, until: string) {
  for (let i = 0; i < 8 && (await title(page, until).count()) === 0; i++) await skip(page).click()
  await expect(title(page, until)).toBeFocused()
}

const hackDialog = (page: Page) => page.getByRole('dialog', { name: 'Brain Hack', exact: true })

// Nichts ragt über den rechten oder linken Rand, und die Seite scrollt nicht seitlich.
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

// ── Die Karte im Reiter „Energie“ (Spec §2.2) ───────────────────────────────────────────────────────────────────

test('the card sits between the header and "Dein Akku", with the sentence and two start buttons', async ({ page }) => {
  await open(page, { now: SEVEN })
  await expect(page.locator('.screen').getByRole('heading', { level: 2 }).first()).toHaveText('Morgen-Start')
  const c = card(page)
  await expect(c.getByText('Kurz oder lang, jederzeit.', { exact: true })).toBeVisible()
  await expect(c.getByText('Heute schon gemacht.', { exact: false })).toHaveCount(0)
  await expectMotiv(c.locator('img'), 'vorschlag-morgen', 56)
  const buttons = c.getByRole('button')
  await expect(buttons).toHaveText(['Kurz · 5 Min', 'Lang · 15 Min'])
  for (const button of await buttons.all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  // Das Blatt liegt noch zu: nichts ist geöffnet, die App ist bedienbar.
  await expect(flow(page)).toHaveCount(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('with an entry for today the card says so, and a new run is still offered', async ({ page }) => {
  // Ein Eintrag von heute (7:10 Ortszeit) und einer von gestern.
  await open(page, {
    now: new Date('2026-10-28T14:00:00+01:00'),
    mornings: [
      { day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', intention: 'klar' },
      { day: DAY, at: '2026-10-28T06:10:00.000Z', variant: 'kurz', intention: 'gelassen' },
    ],
  })
  const c = card(page)
  await expect(c.getByText('Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.', { exact: true })).toBeVisible()
  await expect(c.getByText('Kurz oder lang, jederzeit.')).toHaveCount(0)
  await expect(c.getByRole('button')).toHaveText(['Kurz · 5 Min', 'Lang · 15 Min'])
  await start(page, 'Lang · 15 Min')
})

test('with an entry only from yesterday the card keeps its usual sentence', async ({ page }) => {
  await open(page, { now: SEVEN, mornings: [{ day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', intention: 'klar' }] })
  await expect(card(page).getByText('Kurz oder lang, jederzeit.', { exact: true })).toBeVisible()
})

// ── Der kurze Ablauf (Spec §2.3) ────────────────────────────────────────────────────────────────────────────────

test('the short flow: check-in, activate, intention, gratitude, big domino, then the summary', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Kurz · 5 Min')
  await expect.poll(() => depth(page)).toBe(1)
  await expect(page.locator('[inert] main')).toHaveCount(1) // die App darunter ist unerreichbar

  // Fünf Fortschrittspunkte, der Name nennt den Schritt.
  const dots = flow(page).getByRole('img', { name: 'Schritt 1 von 5', exact: true })
  await expect(dots).toBeVisible()
  await expect(dots.locator('i')).toHaveCount(5)
  await expect(flow(page).getByText('Check-in', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Ein Tipp je Bereich, 1 = leer, 5 = voll.', { exact: true })).toBeVisible()

  // Vier Reihen wie im Check-in-Blatt; „Weiter“ erst mit allen vier.
  await expect(flow(page).getByRole('radiogroup')).toHaveCount(4)
  await expect(next(page)).toBeDisabled()
  await dot(page, 'Geist', 1, 'leer').click()
  await dot(page, 'Körper', 3, 'mittel').click()
  await dot(page, 'Gefühl', 3, 'mittel').click()
  await expect(next(page)).toBeDisabled()
  await dot(page, 'Sinn', 3, 'mittel').click()
  await expect(next(page)).toBeEnabled()
  await next(page).click()

  // Der Check-in ist gespeichert wie sonst.
  await expect(title(page, ACTIVATE)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 2 von 5', exact: true })).toBeVisible()
  const saved = await stored(page)
  expect(saved.energyCheckins).toHaveLength(1)
  expect(saved.energyCheckins[0].levels).toEqual({ koerper: 3, gefuehl: 3, geist: 1, sinn: 3 })

  // Aktivieren: die Übung des Tages mit Chip, Motiv, Nutzen, Schritten und Hinweis; „Andere Übung“ nimmt die nächste.
  await expect(flow(page).getByText('Aktivieren', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Erst der Körper, dann der Kopf.', { exact: true })).toBeVisible()
  const exercise = (name: string) => flow(page).getByRole('heading', { level: 3, name, exact: true })
  await expect(exercise('Strecken & Aufrichten')).toBeVisible()
  await expect(flow(page).getByText('Körper · 2 Min', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Zwei Minuten Strecken können dich geschmeidiger und wacher machen.', { exact: true })).toBeVisible()
  await expectMotiv(flow(page).locator('img'), 'energie-koerper', 72)
  await expect(flow(page).getByRole('list').getByRole('listitem')).toHaveCount(4)
  await expect(flow(page).getByRole('list').getByRole('listitem').first()).toContainText('Räkeln')
  await expect(flow(page).getByText('Nur so weit, wie es angenehm ist.')).toBeVisible()
  const startExercise = flow(page).getByRole('button', { name: /^Starten · \d:\d\d$/ })
  await expect(startExercise).toHaveText('Starten · 2:00')
  const other = flow(page).getByRole('button', { name: 'Andere Übung', exact: true })
  for (const [name, time] of [['Wasser & Licht', '2:00'], ['Wach-Klopfen', '1:00'], ['Strecken & Aufrichten', '2:00']]) {
    await other.click()
    await expect(exercise(name)).toBeVisible()
    await expect(startExercise).toHaveText(`Starten · ${time}`)
  }
  await skip(page).click()

  // Intention: der niedrigste Bereich bestimmt die Vorschläge; ein Tipp wählt, ein zweiter nimmt zurück.
  await expect(title(page, INTENTION)).toBeFocused()
  await expect(flow(page).getByText('Dein Geist-Akku ist gerade am niedrigsten.', { exact: true })).toBeVisible()
  const suggestions = flow(page).getByRole('radiogroup', { name: 'Vorschläge', exact: true })
  await expect(suggestions.getByRole('radio')).toHaveText(['klar', 'fokussiert', 'wach', 'neugierig', 'gesammelt', 'entschieden'])
  await expect(flow(page).getByText('Wähle ein Wort oder tippe ein eigenes.', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Deine Wörter', { exact: true })).toHaveCount(0)
  await radio(page, 'Vorschläge', 'klar').click()
  await expect(radio(page, 'Vorschläge', 'klar')).toHaveAttribute('aria-checked', 'true')
  await expect(flow(page).getByText('Heute will ich klar sein.', { exact: true })).toBeVisible()
  await radio(page, 'Vorschläge', 'klar').click()
  await expect(radio(page, 'Vorschläge', 'klar')).toHaveAttribute('aria-checked', 'false')
  await expect(flow(page).getByText('Wähle ein Wort oder tippe ein eigenes.', { exact: true })).toBeVisible()
  await radio(page, 'Vorschläge', 'klar').click()
  await next(page).click()

  // Dankbarkeit (kurz: ohne Wert).
  await expect(title(page, GRATITUDE)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 4 von 5', exact: true })).toBeVisible()
  await expect(field(page, 'Dein Satz')).toHaveAttribute('placeholder', 'z. B. ein Mensch, ein Moment, etwas Kleines')
  await expect(flow(page).getByText('Welcher Wert trägt dich heute?')).toHaveCount(0)
  await field(page, 'Dein Satz').fill('den ruhigen Kaffee')
  await next(page).click()

  // Big Domino: 80 Zeichen ohne Leerzeichen, Zähler, und nichts scrollt seitlich.
  await expect(title(page, DOMINO)).toBeFocused()
  await expect(flow(page).getByText('Die eine Sache, die vieles andere leichter macht.', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Frag dich: Welche eine Sache macht heute vieles andere leichter oder unnötig?', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Von gestern offen')).toHaveCount(0)
  await expect(flow(page).getByText('0 / 80', { exact: true })).toBeVisible()
  const long = 'Konzeptentwurf'.repeat(6).slice(0, 80)
  await field(page, 'Dein Big Domino').fill(long)
  await expect(flow(page).getByText('80 / 80', { exact: true })).toBeVisible()
  await expectNoSideways(page)
  await next(page).click()

  // Abschluss: alle Angaben, ohne Wert; „Fertig“ schließt.
  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page).getByText('Geschafft', { exact: true })).toBeVisible()
  await expectMotiv(flow(page).locator('img'), 'vorschlag-morgen', 96)
  await expect(flow(page).getByRole('img', { name: /^Schritt/ })).toHaveCount(0)
  const summary = flow(page).getByRole('definition')
  await expect(summary).toHaveText(['klar', long, 'den ruhigen Kaffee'])
  await expect(flow(page).getByText('Heute will ich sein:', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Big Domino', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Dankbar für', { exact: true })).toBeVisible()
  await expect(flow(page).getByText('Wert des Tages')).toHaveCount(0)
  await expect(flow(page).getByRole('button', { name: 'Fokus-Sprint starten · 50 Min', exact: true })).toBeVisible()
  await expect(flow(page).getByRole('button', { name: 'Überspringen' })).toHaveCount(0)
  await expectNoSideways(page)

  // Gespeichert: ein Check-in und ein Morgen-Eintrag der kurzen Variante, keine Sitzung.
  const data = await stored(page)
  expect(data.energyCheckins).toHaveLength(1)
  expect(data.mornings).toHaveLength(1)
  expect(data.mornings[0]).toMatchObject({ day: DAY, variant: 'kurz', intention: 'klar', gratitude: 'den ruhigen Kaffee', domino: long })
  expect('value' in data.mornings[0]).toBe(false)
  expect(data.sessions).toEqual([])

  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  // Die Karte weiß es jetzt.
  await expect(card(page).getByText('Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.', { exact: true })).toBeVisible()
})

// ── Der lange Ablauf ────────────────────────────────────────────────────────────────────────────────────────────

test('the long flow has six steps, offers both deepening choices and saves the value', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Lang · 15 Min')
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 6', exact: true })).toBeVisible()
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 6', exact: true }).locator('i')).toHaveCount(6)

  await skip(page).click() // Check-in
  await expect(title(page, ACTIVATE)).toBeFocused()
  await skip(page).click()

  // Vertiefen: zwei Wahlknöpfe; um 7:00 ist es hell genug, der Hinweis fehlt.
  await expect(title(page, DEEPEN)).toBeFocused()
  await expect(flow(page).getByText('Vertiefen', { exact: true })).toBeVisible()
  const guten = flow(page).getByRole('button', { name: /^Guten Morgen/ })
  const licht = flow(page).getByRole('button', { name: /^Tageslicht tanken/ })
  await expect(guten).toContainText('Meditation · 5 Min')
  await expect(licht).toContainText('Draußen · 5 Min')
  await expect(guten).toBeEnabled()
  await expect(licht).toBeEnabled()
  await expect(flow(page).getByText('Am besten, sobald es hell ist.')).toHaveCount(0)
  await expect(flow(page).getByText('Nicht offline verfügbar')).toHaveCount(0)
  for (const choice of [guten, licht]) expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await skip(page).click()

  // Ohne Check-in gelten die Standardvorschläge, und es gibt keine Zeile über den Akku.
  await expect(title(page, INTENTION)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 4 von 6', exact: true })).toBeVisible()
  await expect(flow(page).getByText(/Akku ist gerade am niedrigsten/)).toHaveCount(0)
  await expect(flow(page).getByRole('radiogroup', { name: 'Vorschläge', exact: true }).getByRole('radio')).toHaveText(['klar', 'gelassen', 'mutig', 'freundlich', 'fokussiert', 'dankbar'])
  await skip(page).click()

  // Dankbarkeit und Wert: zwölf Werte, ein Tipp wählt „Geduld“, das Feld „Eigener Wert“ leert sich beim Wählen.
  await expect(title(page, GRATITUDE)).toBeFocused()
  await expect(flow(page).getByText('Welcher Wert trägt dich heute?', { exact: true })).toBeVisible()
  await expect(flow(page).getByRole('radiogroup', { name: 'Werte', exact: true }).getByRole('radio')).toHaveCount(12)
  await field(page, 'Eigener Wert').fill('Zuversicht')
  await radio(page, 'Werte', 'Geduld').click()
  await expect(radio(page, 'Werte', 'Geduld')).toHaveAttribute('aria-checked', 'true')
  await expect(field(page, 'Eigener Wert')).toHaveValue('')
  await next(page).click()

  await expect(title(page, DOMINO)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 6 von 6', exact: true })).toBeVisible()
  await skip(page).click()

  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page).getByText('Wert des Tages', { exact: true })).toBeVisible()
  await expect(flow(page).getByRole('definition')).toHaveText(['Geduld'])
  await expect(flow(page).getByRole('button', { name: /^Fokus-Sprint starten/ })).toHaveCount(0) // ohne Big Domino kein Sprint
  const data = await stored(page)
  expect(data.mornings).toHaveLength(1)
  expect(data.mornings[0]).toMatchObject({ day: DAY, variant: 'lang', value: 'Geduld' })
  expect(data.energyCheckins).toBeUndefined()
  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect.poll(() => depth(page)).toBe(0)
})

test('before 7:00 "Tageslicht tanken" says it is best once it is light', async ({ page }) => {
  await open(page, { now: new Date('2026-10-28T06:30:00+01:00') })
  await start(page, 'Lang · 15 Min')
  await skip(page).click()
  await skip(page).click()
  await expect(title(page, DEEPEN)).toBeFocused()
  await expect(flow(page).getByText('Am besten, sobald es hell ist.', { exact: true })).toBeVisible()
  // Der Hinweis gehört zur Wahl „Tageslicht tanken“ (beschreibt den Knopf), sie bleibt wählbar.
  const licht = flow(page).getByRole('button', { name: /^Tageslicht tanken/ })
  await expect(licht).toBeEnabled()
  await expect(licht).toHaveAccessibleDescription('Am besten, sobald es hell ist.')
})

test('without a check-in in the flow, a fresh one from earlier gives the area and the suggestions', async ({ page }) => {
  await open(page, {
    now: SEVEN,
    // Körper am niedrigsten, vor einer Stunde.
    checkins: [{ id: 'c-1', at: '2026-10-28T05:00:00.000Z', levels: { koerper: 1, gefuehl: 3, geist: 3, sinn: 3 } }],
  })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, INTENTION)
  await expect(flow(page).getByText('Dein Körper-Akku ist gerade am niedrigsten.', { exact: true })).toBeVisible()
  await expect(radio(page, 'Vorschläge', 'geerdet')).toBeVisible()
})

// ── Eigene Wörter und gestern offen ─────────────────────────────────────────────────────────────────────────────

test('"Von gestern offen" offers yesterday\'s big domino and "Übernehmen" fills the field', async ({ page }) => {
  await open(page, {
    now: SEVEN,
    mornings: [{ day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', domino: 'Angebot für den Workshop schicken' }],
  })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, DOMINO)
  const box = flow(page).getByRole('region', { name: 'Von gestern offen', exact: true })
  await expect(box).toBeVisible()
  await expect(box.getByText('Angebot für den Workshop schicken', { exact: true })).toBeVisible()
  await expect(field(page, 'Dein Big Domino')).toHaveValue('')
  await box.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(field(page, 'Dein Big Domino')).toHaveValue('Angebot für den Workshop schicken')
  await expect(field(page, 'Dein Big Domino')).toBeFocused()
  await expect(flow(page).getByText('33 / 80', { exact: true })).toBeVisible()
  // Das Feld ist belegt: Der Kasten verschwindet.
  await expect(box).toHaveCount(0)

  await next(page).click()
  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page).getByRole('definition')).toHaveText(['Angebot für den Workshop schicken'])
  const today = (await stored(page)).mornings.find((e: { day: string }) => e.day === DAY)
  expect(today.domino).toBe('Angebot für den Workshop schicken')
})

test('no box when yesterday\'s big domino is done', async ({ page }) => {
  await open(page, {
    now: SEVEN,
    mornings: [{ day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', domino: 'Angebot schicken', dominoDone: '2026-10-27T15:00:00.000Z' }],
  })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, DOMINO)
  await expect(flow(page).getByText('Von gestern offen')).toHaveCount(0)
})

test('own words from earlier runs appear under "Deine Wörter"; typing clears the choice and a choice clears the field', async ({ page }) => {
  await open(page, {
    now: SEVEN,
    mornings: [
      { day: '2026-10-26', at: '2026-10-26T06:10:00.000Z', variant: 'kurz', intention: 'stark' },
      { day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', intention: 'leuchtend' },
    ],
  })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, INTENTION)
  await expect(flow(page).getByText('Deine Wörter', { exact: true })).toBeVisible()
  const own = flow(page).getByRole('radiogroup', { name: 'Deine Wörter', exact: true })
  await expect(own.getByRole('radio')).toHaveText(['leuchtend', 'stark']) // die jüngste zuerst

  await radio(page, 'Deine Wörter', 'stark').click()
  await expect(radio(page, 'Deine Wörter', 'stark')).toHaveAttribute('aria-checked', 'true')
  await expect(flow(page).getByText('Heute will ich stark sein.', { exact: true })).toBeVisible()

  // Tippen im Feld hebt die Auswahl auf (in beiden Gruppen) und schreibt das Wort.
  await field(page, 'Eigenes Wort').fill('furchtlos')
  await expect(flow(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
  await expect(flow(page).getByText('Heute will ich furchtlos sein.', { exact: true })).toBeVisible()

  // Eine Auswahl leert das Feld.
  await radio(page, 'Vorschläge', 'klar').click()
  await expect(field(page, 'Eigenes Wort')).toHaveValue('')
  await expect(flow(page).getByText('Heute will ich klar sein.', { exact: true })).toBeVisible()

  // Ein Wort aus „Vorschläge“ und eines aus „Deine Wörter“ sind nie zugleich gewählt.
  await radio(page, 'Deine Wörter', 'leuchtend').click()
  await expect(flow(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1)
  await expect(radio(page, 'Vorschläge', 'klar')).toHaveAttribute('aria-checked', 'false')

  // Die Pfeiltasten wählen wie in jeder Radiogruppe (hier: das nächste Wort der Gruppe) und nehmen den Fokus mit.
  await radio(page, 'Deine Wörter', 'leuchtend').focus()
  await page.keyboard.press('ArrowRight')
  await expect(radio(page, 'Deine Wörter', 'stark')).toHaveAttribute('aria-checked', 'true')
  await expect(radio(page, 'Deine Wörter', 'stark')).toBeFocused()
  await next(page).click()
  await expect(title(page, GRATITUDE)).toBeFocused()
  await next(page).click()
  await expect(title(page, DOMINO)).toBeFocused()
  await next(page).click()
  await expect(title(page, DONE)).toBeFocused()
  await expect(flow(page).getByRole('definition')).toHaveText(['stark'])
})

test('the fields count characters and not UTF-16 units', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, INTENTION)
  // Ein Emoji sind zwei UTF-16-Einheiten, aber ein Zeichen: Getippt passen 40 hinein (ein `maxlength="40"` hielte bei 20 an) …
  const word = field(page, 'Eigenes Wort')
  await word.click()
  await page.keyboard.type('😀'.repeat(40))
  expect(Array.from(await word.inputValue())).toHaveLength(40)
  // … und ein Zeichen mehr nicht.
  await page.keyboard.type('😀😀')
  expect(Array.from(await word.inputValue())).toHaveLength(40)
  // Eingefügter, längerer Text wird auf 40 Zeichen gekürzt, ohne ein Zeichen zu zerreißen.
  await word.fill('😀'.repeat(45))
  expect(Array.from(await word.inputValue())).toHaveLength(40)
  await next(page).click()
  await expect(title(page, GRATITUDE)).toBeFocused()
  await field(page, 'Dein Satz').fill('😀'.repeat(125))
  expect(Array.from(await field(page, 'Dein Satz').inputValue())).toHaveLength(120)
  await next(page).click()
  await expect(title(page, DOMINO)).toBeFocused()
  await field(page, 'Dein Big Domino').fill('😀'.repeat(85))
  expect(Array.from(await field(page, 'Dein Big Domino').inputValue())).toHaveLength(80)
  await expect(flow(page).getByText('80 / 80', { exact: true })).toBeVisible()
  // Der Eintrag trägt dieselben Längen.
  await next(page).click()
  await expect(title(page, DONE)).toBeFocused()
  const entry = (await stored(page)).mornings[0]
  expect(Array.from(entry.intention)).toHaveLength(40)
  expect(Array.from(entry.gratitude)).toHaveLength(120)
  expect(Array.from(entry.domino)).toHaveLength(80)
})

// ── Beenden, Zurück-Geste ───────────────────────────────────────────────────────────────────────────────────────

test('"×" asks before ending; "Weiter machen" stays, "Beenden" closes without an entry but keeps the check-in', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Kurz · 5 Min')
  await checkin(page, [3, 3, 3, 3])
  await expect.poll(() => depth(page)).toBe(1)

  await close(page).click()
  await expect(confirm(page)).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)
  await confirm(page).getByRole('button', { name: 'Weiter machen', exact: true }).click()
  await expect(confirm(page)).toHaveCount(0)
  await expect(flow(page)).toBeVisible()
  await expect(title(page, ACTIVATE)).toBeFocused()
  await expect.poll(() => depth(page)).toBe(1)

  // Die Zurück-Geste fragt ebenso; zurück aus der Rückfrage bleibt im Ablauf.
  await page.goBack()
  await expect(confirm(page)).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)
  await page.goBack()
  await expect(confirm(page)).toHaveCount(0)
  await expect(flow(page)).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // Escape fragt auch; „Beenden“ schließt.
  await page.keyboard.press('Escape')
  await expect(confirm(page)).toBeVisible()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect(confirm(page)).toHaveCount(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect.poll(() => depth(page)).toBe(0)

  const data = await stored(page)
  expect(data.mornings).toBeUndefined()
  expect(data.energyCheckins).toHaveLength(1)
  await expect(card(page).getByText('Kurz oder lang, jederzeit.', { exact: true })).toBeVisible()
})

test('the back gesture asks before ending, and "Beenden" leaves a clean history', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Lang · 15 Min')
  await page.goBack()
  await expect(confirm(page)).toBeVisible()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  // Der nächste Durchgang beginnt von vorn.
  await start(page, 'Kurz · 5 Min')
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 5', exact: true })).toBeVisible()
})

test('in the summary "×", the back gesture and "Fertig" close without asking', async ({ page }) => {
  await open(page, { now: SEVEN })
  for (const closeWith of ['×', 'back', 'Fertig'] as const) {
    await start(page, 'Kurz · 5 Min')
    await skipTo(page, DONE)
    await expect.poll(() => depth(page)).toBe(1)
    if (closeWith === '×') await close(page).click()
    else if (closeWith === 'back') await page.goBack()
    else await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
    await expect(flow(page)).toHaveCount(0)
    await expect(confirm(page)).toHaveCount(0)
    await expect.poll(() => depth(page)).toBe(0)
    await expect(page.locator('[inert]')).toHaveCount(0)
  }
  // Drei Durchgänge am selben Tag: ein einziger Eintrag.
  expect((await stored(page)).mornings).toHaveLength(1)
})

test('"Fokus-Sprint starten" closes the flow and starts the sprint with the big domino', async ({ page }) => {
  await open(page) // echte Uhr: Der Sprint ist ein Programm
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, DOMINO)
  await field(page, 'Dein Big Domino').fill('Konzept für Modul 3 skizzieren')
  await next(page).click()
  await expect(title(page, DONE)).toBeFocused()
  const sprint = flow(page).getByRole('button', { name: 'Fokus-Sprint starten · 50 Min', exact: true })
  await expect(sprint).toBeEnabled()
  await sprint.click()

  const player = page.getByRole('dialog', { name: 'Fokus-Sprint', exact: true })
  await expect(player.getByRole('heading', { level: 2, name: 'Fokus-Sprint · 50 Min' })).toBeVisible()
  await expect(player.getByText('Konzept für Modul 3 skizzieren', { exact: true })).toBeVisible()
  await expect(flow(page)).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1) // nur die Ebene des Sprints
  await expect(page.locator('[inert] main')).toHaveCount(1)

  await player.getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energie')
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  const data = await stored(page)
  expect(data.mornings).toHaveLength(1)
  expect(data.mornings[0].domino).toBe('Konzept für Modul 3 skizzieren')
  expect(data.settings.focus.minutes).toBe(50)
})

// ── Übungen im Ablauf (Echtzeit, ohne `page.clock`) ─────────────────────────────────────────────────────────────

const runs = async (page: Page) => (await stored(page))?.hackRuns ?? []

// Wählt mit „Andere Übung“ die Übung `name` (höchstens zwei Wechsel) und startet sie.
async function startExercise(page: Page, name: string, time: string) {
  const heading = flow(page).getByRole('heading', { level: 3, name, exact: true })
  for (let i = 0; i < 3 && (await heading.count()) === 0; i++) await flow(page).getByRole('button', { name: 'Andere Übung', exact: true }).click()
  await expect(heading).toBeVisible()
  await flow(page).getByRole('button', { name: `Starten · ${time}`, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
}

test('an exercise in the flow hides it, asks "Hack beenden?" on back, and "Weiter" leads to the intention', async ({ page }) => {
  test.setTimeout(150_000) // 60 s Übung und 8 s Ausklang; die Audio-Uhr lässt sich nicht vorspulen
  await open(page)
  await start(page, 'Kurz · 5 Min')
  await checkin(page, [2, 3, 3, 3])
  await startExercise(page, 'Wach-Klopfen', '1:00')

  // Der Player ist da, der Ablauf verborgen (aber eingehängt), die App darunter unerreichbar.
  await expect(hackDialog(page)).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Morgen-Start', exact: true, includeHidden: true })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Morgen-Start', exact: true, includeHidden: true })).toHaveCount(1)
  await expect.poll(() => depth(page)).toBe(2) // Ablauf und Player

  // Die Zurück-Geste gehört dem Player: „Hack beenden?“, nicht „Morgen-Start beenden?“.
  await page.goBack()
  const ask = page.getByRole('alertdialog', { name: 'Hack beenden?', exact: true })
  await expect(ask).toBeVisible()
  await expect(confirm(page)).toHaveCount(0)
  await ask.getByRole('button', { name: 'Weiter üben', exact: true }).click()
  await expect(ask).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)

  // Am Ende: „Körper jetzt?“ in einer Reihe (der Check-in liefert „vorher“), ein Tipp, dann „Weiter“ statt „Fertig“.
  const player = hackDialog(page)
  await expect(player.getByRole('heading', { level: 2, name: 'Geschafft' })).toBeVisible({ timeout: 90_000 })
  await expect(player.getByText('Körper jetzt?', { exact: true })).toBeVisible()
  await expect(player.getByRole('radiogroup')).toHaveCount(1)
  await expect(player.getByRole('button', { name: 'Fertig' })).toHaveCount(0)
  await expect(player.getByRole('button', { name: 'Noch einmal' })).toHaveCount(0)
  await player.getByRole('radio', { name: 'Körper: 4 von 5, gut', exact: true }).click()
  await expect.poll(async () => (await runs(page))[0]?.after).toBe(4)
  await player.getByRole('button', { name: 'Weiter', exact: true }).click()

  // Der Ablauf steht beim nächsten Schritt, nicht beim Aktivieren, und ist wieder sichtbar.
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(title(page, INTENTION)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 3 von 5', exact: true })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  expect(await runs(page)).toHaveLength(1)
  expect((await runs(page))[0]).toMatchObject({ hack: 'wach-klopfen', area: 'koerper', before: 2, after: 4 })

  // Bis zum Abschluss und „Fertig“: Die History ist danach leer (Tiefe 0).
  await skipTo(page, DONE)
  await expect.poll(() => depth(page)).toBe(1)
  await flow(page).getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(0)
  expect(await runs(page)).toHaveLength(1)
})

test('closing the end view of an exercise with the back gesture continues the flow like "Weiter"', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page)
  await start(page, 'Kurz · 5 Min')
  await skip(page).click() // ohne Check-in: zwei Reihen
  await expect(title(page, ACTIVATE)).toBeFocused()
  await startExercise(page, 'Wach-Klopfen', '1:00')
  const player = hackDialog(page)
  await expect(player.getByRole('heading', { level: 2, name: 'Geschafft' })).toBeVisible({ timeout: 90_000 })
  await expect(player.getByRole('radiogroup')).toHaveCount(2) // „vorher“ und „jetzt“
  await expect.poll(() => depth(page)).toBe(2)

  await page.goBack()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(confirm(page)).toHaveCount(0)
  await expect(title(page, INTENTION)).toBeFocused() // nicht wieder bei „Aktivieren“
  await expect.poll(() => depth(page)).toBe(1)
  expect(await runs(page)).toHaveLength(1)

  await close(page).click()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect.poll(() => depth(page)).toBe(0)
})

test('ending an exercise early returns to "Aktivieren" and saves nothing', async ({ page }) => {
  await open(page)
  await start(page, 'Kurz · 5 Min')
  await skip(page).click() // Check-in
  await expect(title(page, ACTIVATE)).toBeFocused()
  await flow(page).getByRole('button', { name: /^Starten · \d:\d\d$/ }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(hackDialog(page)).toBeVisible()
  await page.waitForTimeout(5000)

  await hackDialog(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(hackDialog(page)).toHaveCount(0)
  await expect(title(page, ACTIVATE)).toBeVisible()
  await expect(title(page, ACTIVATE)).toBeFocused()
  await expect(flow(page).getByRole('img', { name: 'Schritt 2 von 5', exact: true })).toBeVisible()
  expect(await runs(page)).toHaveLength(0)
  await expect.poll(() => depth(page)).toBe(1)

  // Der Ablauf geht normal weiter und endet sauber.
  await skipTo(page, DONE)
  await close(page).click()
  await expect.poll(() => depth(page)).toBe(0)
})

// ── Doppeltipp ──────────────────────────────────────────────────────────────────────────────────────────────────

for (const [variant, x] of [['Kurz · 5 Min', 0.5], ['Lang · 15 Min', 0.5]] as const) {
  test(`a double tap on "${variant}" does not reach "Überspringen" or a dot`, async ({ page }) => {
    await open(page, { now: SEVEN })
    await doubleTap(page, card(page).getByRole('button', { name: variant, exact: true }), x)
    await expect(title(page, CHECKIN)).toBeVisible()
    await expect(flow(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(0)
    await expect(confirm(page)).toHaveCount(0)
    expect((await stored(page))?.energyCheckins).toBeUndefined() // kein Punkt, kein „Weiter“
  })
}

test('"Überspringen" takes no tap right after the flow opened', async ({ page }) => {
  await open(page, { now: SEVEN })
  // Wo „Überspringen“ steht, zeigt ein erster Durchgang.
  await start(page, 'Kurz · 5 Min')
  await expect(skip(page)).toBeEnabled()
  const box = (await skip(page).boundingBox())!
  await close(page).click()
  await confirm(page).getByRole('button', { name: 'Beenden', exact: true }).click()
  await expect(flow(page)).toHaveCount(0)

  // Ein Tipp dorthin, noch bevor der Knopf Tipps annimmt (Sekundenbruchteile nach dem Öffnen), springt nicht weiter.
  await card(page).getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(500)
  await expect(title(page, CHECKIN)).toBeVisible()
  await expect(flow(page).getByRole('img', { name: 'Schritt 1 von 5', exact: true })).toBeVisible()
  // Danach nimmt er Tipps an.
  await expect(skip(page)).toBeEnabled()
  await skip(page).click()
  await expect(title(page, ACTIVATE)).toBeVisible()
})

test('a double tap on "Weiter" does not skip the next step', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, INTENTION)
  await expect(next(page)).toBeEnabled()
  await doubleTap(page, next(page), 0.5)
  await expect(title(page, GRATITUDE)).toBeVisible()
  await expect(flow(page).getByRole('img', { name: 'Schritt 4 von 5', exact: true })).toBeVisible()
})

test('a double tap on the last "Weiter" does not close the summary', async ({ page }) => {
  await open(page, { now: SEVEN })
  await start(page, 'Kurz · 5 Min')
  await skipTo(page, DOMINO)
  await field(page, 'Dein Big Domino').fill('Vorhaben prüfen')
  await expect(next(page)).toBeEnabled()
  // Der Abschluss legt „Fertig“ an die Stelle von „Weiter“, „Fokus-Sprint starten“ darüber.
  await doubleTap(page, next(page), 0.5, 0.5)
  await expect(title(page, DONE)).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Fokus-Sprint' })).toHaveCount(0)
  await expect(flow(page)).toBeVisible()
})

// ── 360 px und 130 % ────────────────────────────────────────────────────────────────────────────────────────────

test.describe('on a 360px phone with 130% text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const OWN_WORD = 'abcdefghij'.repeat(4) // 40 Zeichen ohne Leerzeichen
  const OWN_VALUE = 'klmnopqrst'.repeat(4)
  const OWN_DOMINO = 'Uvwxyzabcd'.repeat(8) // 80 Zeichen ohne Leerzeichen

  async function expectTapTargets(page: Page) {
    const small = await flow(page).evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('button, input, textarea')]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => ({ name: e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 24) ?? e.id, ...e.getBoundingClientRect().toJSON() }))
        .filter((r) => r.height < 44 || r.width < 44)
        .map((r) => `${r.name}: ${Math.round(r.width)} × ${Math.round(r.height)}`),
    )
    expect(small).toEqual([])
  }

  test('every step stays inside the screen, taps are at least 44 px, and long own words wrap', async ({ page }) => {
    await open(page, {
      now: SEVEN,
      mornings: [
        { day: '2026-10-26', at: '2026-10-26T06:10:00.000Z', variant: 'lang', value: OWN_VALUE, gratitude: 'ein Spaziergang' },
        { day: YESTERDAY, at: '2026-10-27T06:10:00.000Z', variant: 'kurz', intention: OWN_WORD, domino: OWN_DOMINO },
      ],
    })
    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await start(page, 'Lang · 15 Min')
    await expectNoSideways(page)
    await expectTapTargets(page)
    await checkin(page, [2, 4, 3, 5])
    await expectNoSideways(page)
    await expectTapTargets(page)

    // Aktivieren: Karte mit Chip, Motiv, Schritten und Hinweis; „Starten“ bleibt ohne Blättern erreichbar.
    await expectNoSideways(page)
    await expectTapTargets(page)
    await expect(flow(page).getByRole('button', { name: /^Starten · / })).toBeInViewport()
    await skip(page).click()

    await expect(title(page, DEEPEN)).toBeFocused()
    await expectNoSideways(page)
    await expectTapTargets(page)
    await skip(page).click()

    // Intention: Das eigene Wort mit 40 Zeichen bricht um, ebenso die Zeile darüber.
    await expect(title(page, INTENTION)).toBeFocused()
    await expect(radio(page, 'Deine Wörter', OWN_WORD)).toBeVisible()
    await radio(page, 'Deine Wörter', OWN_WORD).click()
    await expect(flow(page).getByText(`Heute will ich ${OWN_WORD} sein.`, { exact: true })).toBeVisible()
    await expectNoSideways(page)
    await expectTapTargets(page)
    await next(page).click()

    await expect(title(page, GRATITUDE)).toBeFocused()
    await radio(page, 'Deine Werte', OWN_VALUE).click()
    await expect(radio(page, 'Deine Werte', OWN_VALUE)).toHaveAttribute('aria-checked', 'true')
    await expectNoSideways(page)
    await expectTapTargets(page)
    await next(page).click()

    await expect(title(page, DOMINO)).toBeFocused()
    await expect(flow(page).getByText(OWN_DOMINO, { exact: true })).toBeVisible() // der Kasten „Von gestern offen“
    await expectNoSideways(page)
    await expectTapTargets(page)
    await flow(page).getByRole('button', { name: 'Übernehmen', exact: true }).click()
    await expect(flow(page).getByText('80 / 80', { exact: true })).toBeVisible()
    await expectNoSideways(page)
    await next(page).click()

    // Abschluss: alle vier Angaben, die langen Wörter brechen um, die Knöpfe bleiben im Bild.
    await expect(title(page, DONE)).toBeFocused()
    await expect(flow(page).getByRole('definition')).toHaveText([OWN_WORD, OWN_DOMINO, OWN_VALUE])
    await expectNoSideways(page)
    await expectTapTargets(page)
    await expect(flow(page).getByRole('button', { name: 'Fertig', exact: true })).toBeInViewport()
  })
})
