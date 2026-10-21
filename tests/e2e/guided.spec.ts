import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// Die Aufnahmen können neu entstehen (andere Länge, wieder ein Platzhalter): Die Tests verlassen sich nie
// auf genaue Längen, nur auf Unterschiede (Spulen ≈ 15 s, ±2 s), und lesen „Platzhalter“ aus dem Manifest.
type ManifestEntry = { title: string; placeholder: boolean }
const MANIFEST: ManifestEntry[] = JSON.parse(readFileSync('src/content/meditations.json', 'utf8')).meditations
const PLACEHOLDER = new Map(MANIFEST.map((m) => [m.title, m.placeholder]))

// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen).
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))

async function openMeditieren(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Ein Eintrag der Liste, gleich ob gespeichert oder nicht.
const entry = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${escape(title)}, \\d+ Minuten?(, offline verfügbar)?$`) })

// Restzeit im Player in Sekunden (Anzeige m:ss).
async function remaining(page: Page): Promise<number> {
  const [minutes, seconds] = (await page.getByRole('timer').innerText()).split(':').map(Number)
  return minutes * 60 + seconds
}

// Wartet, bis die Restzeit höchstens `tolerance` Sekunden von `target` entfernt ist.
async function expectRemainingNear(page: Page, target: number, tolerance = 2) {
  await expect.poll(async () => Math.abs((await remaining(page)) - target)).toBeLessThanOrEqual(tolerance)
}

// Hauptschaltfläche: das Gold der Oberfläche (--accent).
const GOLD = 'rgb(242, 201, 138)'

const GROUPS = {
  'Einsteiger & Achtsamkeit': ['Ankommen im Atem', 'Gedanken wie Wolken', 'Bodyscan im Sitzen'],
  'Stress & Ruhe': ['Drei-Minuten-Atempause', 'Nach einem vollen Tag', 'Vor einem wichtigen Termin'],
  'Fokus & Energie': ['Guten Morgen', 'Fokus vor der Arbeit', 'Energie in der Mittagspause'],
}

test('the guided meditations are listed by theme with their length', async ({ page }) => {
  await openMeditieren(page)
  const list = page.getByRole('region', { name: 'Geführte Meditationen' })
  await expect(list.getByRole('heading', { level: 2 })).toHaveText('Geführte Meditationen')
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(Object.keys(GROUPS))
  await expect(list.getByRole('button')).toHaveCount(9)

  for (const [theme, titles] of Object.entries(GROUPS)) {
    const group = list.getByRole('region', { name: theme })
    const entries = group.getByRole('button')
    await expect(entries).toHaveCount(3)
    for (const [index, title] of titles.entries()) {
      await expect(entries.nth(index)).toHaveAccessibleName(new RegExp(`^${escape(title)}, \\d+ Minuten?$`))
      await expect(entries.nth(index)).toContainText(title)
      await expect(entries.nth(index)).toContainText(/\d+ Min/)
      // Ein Platzhalter ist als Vorabversion gekennzeichnet, eine echte Aufnahme nicht; gespeichert ist noch keine.
      if (PLACEHOLDER.get(title)) await expect(entries.nth(index)).toContainText('Vorabversion')
      else await expect(entries.nth(index)).not.toContainText('Vorabversion')
      await expect(entries.nth(index)).not.toContainText('✓ offline')
      await expect(entries.nth(index)).toBeEnabled()
    }
  }

  for (const target of await list.getByRole('button').all()) {
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
  }
})

test('start, seek, pause, ask before ending and end with the done screen', async ({ page }) => {
  await openMeditieren(page)
  await entry(page, 'Drei-Minuten-Atempause').click()

  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  await expect(player.getByRole('heading', { name: 'Drei-Minuten-Atempause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  await expect(page.locator('[inert] main')).toHaveCount(1)
  await expect(page.locator('[inert] nav')).toHaveCount(1)
  expect((await stored(page)).lastUsed).toEqual({ kind: 'guided', id: 'drei-minuten-atempause' })

  // Spulen geht, sobald die Länge der Datei bekannt ist.
  const forward = player.getByRole('button', { name: '15 Sekunden vor' })
  const back = player.getByRole('button', { name: '15 Sekunden zurück' })
  await expect(forward).toBeEnabled()
  await expect(back).toBeEnabled()

  // Die Restzeit läuft …
  const first = await remaining(page)
  await expect.poll(() => remaining(page)).toBeLessThan(first)

  // … und springt beim Vorspulen um 15 s (die Wiedergabe läuft dabei weiter).
  const beforeForward = await remaining(page)
  await forward.click()
  await expect.poll(() => remaining(page)).toBeLessThanOrEqual(beforeForward - 13)
  expect(await remaining(page)).toBeGreaterThanOrEqual(beforeForward - 18)

  // Pause hält die Anzeige an; Zurückspulen wirkt auch dann.
  await player.getByRole('button', { name: 'Pause' }).click()
  await expect(player.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.waitForTimeout(300)
  const paused = await remaining(page)
  await page.waitForTimeout(1500)
  expect(await remaining(page)).toBe(paused)
  await back.click()
  await expectRemainingNear(page, paused + 15)
  await forward.click()
  await expectRemainingNear(page, paused)

  await player.getByRole('button', { name: 'Weiter' }).click()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  const resumed = await remaining(page)
  await expect.poll(() => remaining(page)).toBeLessThan(resumed)

  // Zurück fragt nach; „Weiter meditieren“ lässt sie laufen.
  const confirm = page.getByRole('alertdialog', { name: 'Meditation beenden?' })
  await page.goBack()
  await expect(confirm).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)
  await confirm.getByRole('button', { name: 'Weiter meditieren' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // „Beenden“ führt zum Abschluss wie beim Timer; unter einer Minute zählt nichts.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Schön, dass du dir die Zeit genommen hast.' })).toBeVisible()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  expect((await stored(page)).sessions).toEqual([])

  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('the background sound and the balance act at once and are remembered', async ({ page }) => {
  await openMeditieren(page)
  await entry(page, 'Guten Morgen').click()

  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  const sound = player.getByRole('combobox', { name: 'Hintergrundklang' })
  const balance = player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' })
  await expect(sound).toBeVisible()
  // Die sichtbare Beschriftung nennt dasselbe wie der Name des Felds.
  await expect(player.getByText('Hintergrundklang', { exact: true })).toBeVisible()
  await expect(player.getByText('Klang', { exact: true })).toHaveCount(0)
  // Ohne Hintergrund gibt es nichts abzuwägen.
  await expect(balance).toHaveCount(0)

  await sound.selectOption({ label: 'Regen' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBe('regen')
  await expect(balance).toBeVisible()
  await expect(balance).toHaveValue('50')

  await balance.fill('20')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.2)
  // Der Timer behält seinen eigenen Hintergrund.
  expect((await stored(page)).settings.timerSound).toBeNull()

  await sound.selectOption({ label: 'Keiner' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBeNull()
  await expect(balance).toHaveCount(0)
  await sound.selectOption({ label: 'Wald mit Vögeln' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBe('wald')

  // Die nächste Meditation beginnt mit der gemerkten Wahl.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await entry(page, 'Ankommen im Atem').click()
  await expect(player.getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
  await expect(sound).toHaveValue('wald')
  await expect(balance).toHaveValue('20')
})

test('the background sound and the balance reach the engine', async ({ page }) => {
  // Der Klang lädt und dekodiert erst (Netz, Platte, Dekoder), bevor die Engine ihn einblendet; auf einem
  // langsamen Rechner dauert das. Der Test wartet darum großzügig und nennt bei einem Fehlschlag, was er
  // gesehen hat.
  test.setTimeout(120_000)
  const WAIT = 30_000

  // Die Engine blendet jeden Klang auf seine Lautstärke ein und fährt sie später mit einer Rampe auf
  // den neuen Wert. Der Test zeichnet die Ziele der Rampen je AudioParam auf: Der Hintergrund ist der
  // Regler, dessen erste Rampe 0,7 × Balance ist und dem danach die neuen Werte folgen. Ein anderer
  // Parameter (Stimme, Sleep-Timer, Ausblenden) erfüllt das nicht.
  await page.addInitScript(() => {
    const ramps: { param: AudioParam; value: number }[] = []
    ;(window as unknown as { __ramps: typeof ramps }).__ramps = ramps
    const original = AudioParam.prototype.linearRampToValueAtTime
    AudioParam.prototype.linearRampToValueAtTime = function (value: number, endTime: number) {
      ramps.push({ param: this, value })
      return original.call(this, value, endTime)
    }
  })
  // Was mit den Klangdateien geschah (für die Meldung bei einem Fehlschlag).
  const soundLog: string[] = []
  page.on('response', (r) => r.url().includes('/audio/sounds/') && soundLog.push(`${r.status()} ${r.url()}`))
  page.on('requestfailed', (r) => r.url().includes('/audio/sounds/') && soundLog.push(`failed ${r.url()}`))
  page.on('pageerror', (e) => soundLog.push(`pageerror ${e.message}`))

  // Je AudioParam die Ziele in der Reihenfolge der Rampen; ein Regler meldet beim Loslassen denselben
  // Wert nochmals (input, dann change), das zählt einmal.
  const perParam = (): Promise<number[][]> =>
    page.evaluate(() => {
      const byParam = new Map<AudioParam, number[]>()
      for (const { param, value } of (window as unknown as { __ramps: { param: AudioParam; value: number }[] }).__ramps) {
        const targets = byParam.get(param) ?? []
        if (targets.length === 0 || Math.abs(targets[targets.length - 1] - value) > 1e-9) targets.push(value)
        byParam.set(param, targets)
      }
      return [...byParam.values()]
    })
  // Wartet, bis ein Parameter existiert, dessen Rampen mit genau diesen Werten beginnen.
  const startsWith = (expected: number[]) =>
    expect(async () => {
      const seen = await perParam()
      const found = seen.some((seq) => expected.every((v, i) => seq[i] !== undefined && Math.abs(seq[i] - v) < 1e-6))
      const shown = found ? '' : await page.getByRole('dialog').innerText().catch(() => '(kein Player)')
      expect(
        found,
        `Rampen je AudioParam: ${JSON.stringify(seen)}; erwartet ein Parameter mit Beginn ${JSON.stringify(expected)}; ` +
          `Klangdateien: ${JSON.stringify(soundLog)}; Player: ${JSON.stringify(shown)}`,
      ).toBe(true)
    }).toPass({ timeout: WAIT })

  await openMeditieren(page)
  await entry(page, 'Guten Morgen').click()
  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  // Die Sitzung läuft, sobald die Länge der Datei bekannt ist (Spulen geht): erst dann den Hintergrund wählen.
  await expect(player.getByRole('button', { name: '15 Sekunden vor' })).toBeEnabled({ timeout: WAIT })
  const sound = player.getByRole('combobox', { name: 'Hintergrundklang' })
  const balance = player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' })

  // Ein neuer Hintergrund beginnt mit 0,7 × Balance (Standard 0,5 → 0,35) …
  await sound.selectOption({ label: 'Regen' })
  await startsWith([0.35])
  // … und derselbe Parameter fährt danach auf 0,7 × 0,2 und 0,7 × 1.
  await balance.fill('20')
  await startsWith([0.35, 0.14])
  await balance.fill('100')
  await startsWith([0.35, 0.14, 0.7])
  await balance.fill('80')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.8)
  await startsWith([0.35, 0.14, 0.7, 0.56])

  // Die nächste Meditation beginnt gleich mit der gemerkten Wahl: Regen bei 0,7 × 0,8, als erste Rampe
  // eines neuen Parameters.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.evaluate(() => (window as unknown as { __ramps: unknown[] }).__ramps.splice(0))
  await entry(page, 'Ankommen im Atem').click()
  await expect(player.getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
  await startsWith([0.56])
})

test.describe('when the file does not load', () => {
  // Ohne Service Worker: Sonst beantwortete er den Abruf an der Route vorbei.
  test.use({ serviceWorkers: 'block' })

  test('load error shows retry', async ({ page }) => {
    await page.route('**/audio/meditations/**', (route) => route.fulfill({ status: 404, body: 'nicht da' }))
    await openMeditieren(page)
    await entry(page, 'Guten Morgen').click()

    const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
    await expect(player.getByText('Die Meditation konnte nicht geladen werden.')).toBeVisible()
    const retry = player.getByRole('button', { name: 'Erneut versuchen' })
    await expect(retry).toBeVisible()
    // „Erneut versuchen“ ist die einzige Hauptschaltfläche (Gold); „Weiter“ versucht dasselbe, tritt aber zurück.
    await expect(retry).toHaveCSS('background-color', GOLD)
    await expect(player.getByRole('button', { name: 'Weiter' })).not.toHaveCSS('background-color', GOLD)
    await expect(player.getByRole('button', { name: 'Beenden' })).not.toHaveCSS('background-color', GOLD)
    await expect(player.getByRole('timer')).toHaveCount(0)
    await expect(player.getByRole('button', { name: '15 Sekunden vor' })).toBeDisabled()

    // Ist die Datei wieder erreichbar, geht es weiter.
    await page.unroute('**/audio/meditations/**')
    await retry.click()
    await expect(player.getByRole('timer')).toBeVisible()
    await expect(player.getByText('Die Meditation konnte nicht geladen werden.')).toHaveCount(0)
    await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
    // Ohne Fehler ist „Pause“ wieder die Hauptschaltfläche.
    await expect(player.getByRole('button', { name: 'Pause' })).toHaveCSS('background-color', GOLD)
    await expect(player.getByRole('button', { name: '15 Sekunden vor' })).toBeEnabled()
  })
})

test('a played meditation is saved; offline only saved ones can start', async ({ page, context }) => {
  await openMeditieren(page)

  // Beim ersten Abspielen wird die Datei im Hintergrund gespeichert.
  await entry(page, 'Drei-Minuten-Atempause').click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  const saved = page.getByRole('button', { name: /^Drei-Minuten-Atempause, \d+ Minuten, offline verfügbar$/ })
  await expect(saved).toBeVisible()
  await expect(saved).toContainText('✓ offline')

  // Der Status kommt aus dem Cache, auch nach dem Neuladen.
  await page.reload()
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await expect(saved).toBeVisible()
  await expect(entry(page, 'Guten Morgen')).not.toContainText('✓ offline')

  await context.setOffline(true)
  const hints = page.getByText('Nicht offline verfügbar', { exact: true })
  await expect(hints).toHaveCount(8)
  await expect(entry(page, 'Guten Morgen')).toBeDisabled()
  await expect(entry(page, 'Guten Morgen')).toContainText('Nicht offline verfügbar')
  await expect(saved).toBeEnabled()
  await expect(saved).not.toContainText('Nicht offline verfügbar')

  await context.setOffline(false)
  await expect(hints).toHaveCount(0)
  await expect(entry(page, 'Guten Morgen')).toBeEnabled()
})

test('offline at launch, an entry is not held back before the cache has been read', async ({ page, context }) => {
  await openMeditieren(page)
  await entry(page, 'Drei-Minuten-Atempause').click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(1)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })

  // Beim nächsten Start ohne Netz hält der Test das Lesen des Caches an: Der Status ist noch offen.
  await page.addInitScript(() => {
    const w = window as unknown as { __releaseCache: () => void }
    const open = CacheStorage.prototype.open
    const gate = new Promise<void>((resolve) => (w.__releaseCache = resolve))
    CacheStorage.prototype.open = async function (...args: Parameters<CacheStorage['open']>) {
      await gate
      return open.apply(this, args)
    }
  })
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()

  // Noch ungeprüft: nichts ist gesperrt, nichts als gespeichert gezeigt.
  await expect(entry(page, 'Guten Morgen')).toBeVisible()
  await expect(entry(page, 'Guten Morgen')).toBeEnabled()
  await expect(entry(page, 'Drei-Minuten-Atempause')).toBeEnabled()
  await expect(page.getByText('Nicht offline verfügbar', { exact: true })).toHaveCount(0)
  await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(0)

  // Gelesen: Die gespeicherte bleibt startbar, die übrigen acht sind gesperrt.
  await page.evaluate(() => (window as unknown as { __releaseCache: () => void }).__releaseCache())
  await expect(page.getByText('Nicht offline verfügbar', { exact: true })).toHaveCount(8)
  await expect(entry(page, 'Guten Morgen')).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Drei-Minuten-Atempause, \d+ Minuten, offline verfügbar$/ })).toBeEnabled()
  await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(1)
})

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('every control of the player is at least 48 px and nothing scrolls sideways', async ({ page }) => {
    await openMeditieren(page)
    await entry(page, 'Energie in der Mittagspause').click()
    const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
    await player.getByRole('combobox', { name: 'Hintergrundklang' }).selectOption({ label: 'Braunes Rauschen' })

    const targets = [
      player.getByRole('button', { name: '15 Sekunden zurück' }),
      player.getByRole('button', { name: '15 Sekunden vor' }),
      player.getByRole('button', { name: 'Pause' }),
      player.getByRole('button', { name: 'Beenden' }),
      player.getByRole('combobox', { name: 'Hintergrundklang' }),
      player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' }),
    ]
    for (const target of targets) {
      await expect(target).toBeVisible()
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(48)
      expect(box.width).toBeGreaterThanOrEqual(48)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
    expect(await player.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  })
})
