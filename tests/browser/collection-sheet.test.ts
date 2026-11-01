// Das Blatt „Deine Sammlung“ mit Editor und Rückfrage (Spec M12 §2.3, §2.4, §2.10): Abschnitte, Grenzen, Zeilen mit
// Beschreibung, Fokus nach dem Schließen, die Zusätze der Rückfrage zum Prinzip der Woche und die Neu-Sperre des
// Danebentippens. Liegt unter browser/, weil die Komponenten einen Svelte-Compiler, echte Zeitgeber und echten Fokus
// brauchen. Alle Einträge sind erfunden und neutral (Spec M12 §3.2).
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushSync, mount, tick, unmount } from 'svelte'
import CollectionSheet from '../../src/components/principles/CollectionSheet.svelte'
import type { CollectionItem } from '../../src/lib/principles/collection'
import { emptyData, type AppData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

let target: HTMLElement | null = null
let instance: Record<string, unknown> | null = null
let onClose: ReturnType<typeof vi.fn<() => void>>

const hex = (n: number) => `s-${n.toString(16).padStart(8, '0')}`
const P: CollectionItem = { id: 's-0000000a', kind: 'prinzip', text: 'Mehrweg statt Einweg', note: 'Dann fällt weniger Müll an.', ifThen: 'Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.' }
const D: CollectionItem = { id: 's-0000000d', kind: 'prinzip', text: 'Dranbleiben' }
const F: CollectionItem = { id: 's-0000000b', kind: 'feld', text: 'Schach lernen', step: 'Jeden Abend eine Eröffnung nachspielen.' }
const F2: CollectionItem = { id: 's-0000000e', kind: 'feld', text: 'Mehrweg im Alltag', step: 'Eine Stofftasche einpacken.' }
const E: CollectionItem = { id: 's-0000000c', kind: 'erkenntnis', text: 'Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', source: 'Ein Schachkurs' }

/** Wartet, bis die Tipp-Sperren (400 ms) vorbei sind; Sperre und Warten laufen auf derselben Uhr. */
const armed = () => new Promise((resolve) => setTimeout(resolve, 450))

function show(data: Partial<AppData>): void {
  stats.data = { ...emptyData(), ...data }
  target = document.createElement('div')
  document.body.append(target)
  onClose = vi.fn<() => void>()
  instance = mount(CollectionSheet, { target, props: { onClose } })
  flushSync()
}

function remount(): void {
  if (instance) unmount(instance)
  target?.remove()
  instance = null
  target = null
}

/** Stellt die Uhr des Tests (nur `Date`) und die Minuten-Uhr der App auf `at`. */
function setClock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
  tageszeitUi.now = at.getTime()
}

beforeEach(() => {
  history.replaceState(null, '')
  stats.saveFailed = false
  localStorage.clear()
})

afterEach(() => {
  remount()
  vi.useRealTimers()
  tageszeitUi.now = Date.now()
})

const dialogs = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
const dialog = (name: string) => dialogs().find((d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() === name) ?? null
const button = (scope: HTMLElement, name: string) =>
  [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name) ?? null
const lastBackdrop = () => [...document.querySelectorAll<HTMLButtonElement>('button.backdrop')].at(-1)!
const section = (title: string) => [...dialog('Deine Sammlung')!.querySelectorAll<HTMLElement>('section')].find((s) => s.querySelector('h3')?.textContent === title)!
const keydown = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

/** Tippt `text` in ein Feld, wie der Browser: erst `beforeinput`, dann der neue Wert und `input`. */
function fill(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.focus()
  field.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }))
  field.value = text
  field.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }))
}

/**
 * Öffnet die Zeile, ändert das Pflichtfeld (die Rückfrage nennt trotzdem den gespeicherten Text), tippt „Löschen“, liest den
 * Text der Rückfrage, tippt „Behalten“ und prüft den Fokus auf „Löschen“ im Editor; dann schließt Escape den Editor.
 */
async function confirmText(name: string): Promise<string> {
  await armed()
  button(dialog('Deine Sammlung')!, name)!.click()
  flushSync()
  const editor = dialogs().at(-1)!
  fill(editor.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!, 'Geänderter Entwurf')
  flushSync()
  await armed()
  button(editor, 'Löschen')!.click()
  flushSync()
  const alert = document.querySelector<HTMLElement>('[role="alertdialog"]')!
  const text = document.getElementById(alert.getAttribute('aria-describedby')!)!.textContent!
  button(alert, 'Behalten')!.click()
  flushSync()
  await tick()
  expect(document.activeElement).toBe(button(editor, 'Löschen'))
  editor.dispatchEvent(keydown('Escape'))
  flushSync()
  await tick()
  return text
}

test('drei Abschnitte mit Satz und Knopf; die Statuszeile steht leer bei den Erkenntnissen', () => {
  show({})
  expect([...dialog('Deine Sammlung')!.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Prinzipien', 'Wachstumsfelder', 'Erkenntnisse'])
  expect(dialog('Deine Sammlung')!.textContent).toContain('Alles hier bleibt auf diesem Gerät und in deinem Backup.')
  expect(section('Prinzipien').textContent).toContain('Kurze Leitsätze, die dir Richtung geben, gern mit Wenn-dann. Sonntags kannst du eines als Prinzip der Woche wählen.')
  expect(section('Erkenntnisse').querySelector('[role="status"]')!.textContent).toBe('')
})

test('scheitert das Speichern, steht der Hinweis wörtlich im Blatt (role=alert)', () => {
  show({})
  stats.saveFailed = true
  flushSync()
  expect(dialog('Deine Sammlung')!.querySelector('[role="alert"]')!.textContent!.trim()).toBe('Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.')
})

test('ein drittes Feld anlegen: danach „Höchstens 3 Wachstumsfelder.“ statt des Knopfs, der Fokus auf der h3', async () => {
  show({ collection: [F, F2] })
  await armed()
  button(section('Wachstumsfelder'), 'Neues Wachstumsfeld')!.click()
  flushSync()
  const editor = dialog('Neues Wachstumsfeld')!
  expect(document.activeElement!.textContent).toBe('Neues Wachstumsfeld') // Überschrift, kein Feld
  fill(editor.querySelector('input')!, 'Schach üben')
  flushSync()
  await armed()
  button(editor, 'Speichern')!.click()
  flushSync()
  await tick()
  expect(dialog('Neues Wachstumsfeld')).toBeNull()
  expect(section('Wachstumsfelder').textContent).toContain('Höchstens 3 Wachstumsfelder.')
  expect(button(section('Wachstumsfelder'), 'Neues Wachstumsfeld')).toBeNull()
  expect(document.activeElement).toBe(section('Wachstumsfelder').querySelector('h3'))
})

test('mit 13 Prinzipien (wie nach einem Import) alle 13 Zeilen und „Höchstens 12 Prinzipien.“', () => {
  show({ collection: Array.from({ length: 13 }, (_, i) => ({ id: hex(i + 1), kind: 'prinzip' as const, text: `Prinzip ${i + 1}` })) })
  expect(section('Prinzipien').querySelectorAll('li button')).toHaveLength(13)
  expect(section('Prinzipien').textContent).toContain('Höchstens 12 Prinzipien.')
  expect(button(section('Prinzipien'), 'Neues Prinzip')).toBeNull()
})

test('Zeilen heißen „{Text} bearbeiten“, die leise Zeile ist ihre Beschreibung', () => {
  show({ collection: [P, { id: hex(16), kind: 'prinzip' as const, text: 'Mehrweg statt Einweg im Büro', note: 'Dann fällt im Büro weniger Müll an.' }, F, E] })
  const describedBy = (name: string) => document.getElementById(button(dialog('Deine Sammlung')!, name)!.getAttribute('aria-describedby')!)!.textContent
  expect(describedBy('Mehrweg statt Einweg bearbeiten')).toBe(P.ifThen)
  expect(describedBy('Mehrweg statt Einweg im Büro bearbeiten')).toBe('Dann fällt im Büro weniger Müll an.')
  expect(describedBy('Schach lernen bearbeiten')).toBe('Nächster kleiner Schritt: Jeden Abend eine Eröffnung nachspielen.')
  expect(describedBy(`${E.text} bearbeiten`)).toBe('Quelle: Ein Schachkurs')
})

test('Return im Leitsatz fokussiert den Editor; Escape schließt dann nur ihn, der Fokus geht an die Zeile', async () => {
  show({ collection: [P] })
  await armed()
  const row = button(section('Prinzipien'), 'Mehrweg statt Einweg bearbeiten')!
  row.click()
  flushSync()
  const editor = dialog('Prinzip bearbeiten')!
  const field = editor.querySelector('input')!
  field.focus()
  field.dispatchEvent(keydown('Enter'))
  expect(document.activeElement).toBe(editor)
  editor.dispatchEvent(keydown('Escape'))
  flushSync()
  await tick()
  expect([dialog('Prinzip bearbeiten'), dialog('Deine Sammlung') !== null, document.activeElement]).toEqual([null, true, row])
})

test('die Rückfrage nennt den gespeicherten Text und die Zusätze zum Prinzip der Woche', async () => {
  setClock(new Date(2026, 10, 2, 10)) // Montag: P gilt seit gestern
  show({ collection: [P, D, F, E], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }] })
  expect(await confirmText('Mehrweg statt Einweg bearbeiten')).toBe('„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.')
  expect(await confirmText('Schach lernen bearbeiten')).toBe('„Schach lernen“ verschwindet aus deiner Sammlung. Deine Sätze im Logbuch bleiben, nur die Zuordnung entfällt.')
  expect(await confirmText(`${E.text} bearbeiten`)).toBe('Sie verschwindet aus deiner Sammlung.')
  remount()
  setClock(new Date(2026, 10, 8, 21)) // Sonntag: P läuft noch, für die neue Woche ist D gewählt
  show({ collection: [P, D], evenings: [{ day: '2026-11-01', at: '2026-11-01T19:00:00.000Z', weekPrinciple: P.id }, { day: '2026-11-08', at: '2026-11-08T19:00:00.000Z', weekPrinciple: D.id }] })
  expect(await confirmText('Mehrweg statt Einweg bearbeiten')).toBe('„Mehrweg statt Einweg“ verschwindet aus deiner Sammlung. Es ist gerade dein Prinzip der Woche.')
  expect(await confirmText('Dranbleiben bearbeiten')).toBe('„Dranbleiben“ verschwindet aus deiner Sammlung. Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.')
})

test('Danebentippen sperrt neu: das des Editors, wenn die Rückfrage schließt; das der Sammlung, wenn der Editor schließt', async () => {
  show({ collection: [P] })
  await armed()
  button(section('Prinzipien'), 'Mehrweg statt Einweg bearbeiten')!.click()
  flushSync()
  await armed()
  const editor = dialog('Prinzip bearbeiten')!
  button(editor, 'Löschen')!.click()
  flushSync()
  await armed()
  button(document.querySelector<HTMLElement>('[role="alertdialog"]')!, 'Behalten')!.click()
  flushSync()
  expect(lastBackdrop().disabled).toBe(true) // das des Editors
  await armed()
  editor.dispatchEvent(keydown('Escape'))
  flushSync()
  expect([dialog('Prinzip bearbeiten'), lastBackdrop().disabled]).toEqual([null, true]) // jetzt das der Sammlung
  await armed()
  expect(lastBackdrop().disabled).toBe(false)
})

// ── Notizen einfügen (Spec M12 §2.5) ─────────────────────────────────────────────────────────────────────────────

const notes = () => dialog('Notizen einfügen')!.querySelector<HTMLTextAreaElement>('textarea')!
const source = () => dialog('Notizen einfügen')!.querySelector<HTMLInputElement>('input')!

/** Setzt den Text von „Deine Notizen“ wie ein Einfügen (das Feld kürzt nichts, darum genügt `input`). */
function setNotes(text: string): void {
  notes().value = text
  notes().dispatchEvent(new Event('input', { bubbles: true }))
}

async function openPaste(): Promise<void> {
  await armed()
  button(section('Erkenntnisse'), 'Notizen einfügen')!.click()
  flushSync()
  await armed()
}

test('mit 299 Erkenntnissen drei neue Zeilen einfügen: „1 neue Erkenntnis“, „2 passen nicht mehr …“, danach die Grenze und der Fokus auf der h3', async () => {
  show({ collection: Array.from({ length: 299 }, (_, i) => ({ id: hex(i + 1), kind: 'erkenntnis' as const, text: `Zeile ${i + 1}` })) })
  await openPaste()
  setNotes('Neu 1\nNeu 2\nNeu 3')
  flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
  flushSync()
  const paste = dialog('Notizen einfügen')!
  expect(paste.textContent).toContain('1 neue Erkenntnis')
  expect(paste.textContent).toContain('2 passen nicht mehr (höchstens 300 Erkenntnisse).')
  await armed()
  button(paste, '1 Erkenntnis übernehmen')!.click()
  flushSync()
  await tick()
  expect(dialog('Notizen einfügen')).toBeNull()
  expect(section('Erkenntnisse').textContent).toContain('Höchstens 300 Erkenntnisse.')
  expect([button(section('Erkenntnisse'), 'Neue Erkenntnis'), button(section('Erkenntnisse'), 'Notizen einfügen')]).toEqual([null, null])
  expect(section('Erkenntnisse').querySelector('[role="status"]')!.textContent).toBe('1 Erkenntnis übernommen.')
  expect(document.activeElement).toBe(section('Erkenntnisse').querySelector('h3'))
})

test('Escape, Danebentippen und „Zurück zum Text“ in der Vorschau führen zum Text; Text und Quelle bleiben (Review Focus 1)', async () => {
  show({})
  await openPaste()
  setNotes('Mehrweg statt Einweg')
  fill(source(), 'Ein Schachkurs')
  flushSync()
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Mehrweg statt Einweg') // Rohtext nie im Speicher
  const toPreview = async () => {
    button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
    flushSync()
    await armed()
  }
  const atText = () => [notes().value, source().value, document.activeElement, stats.data.collection]
  const textView = () => ['Mehrweg statt Einweg', 'Ein Schachkurs', button(dialog('Notizen einfügen')!, 'Vorschau zeigen'), undefined]
  await toPreview()
  dialog('Notizen einfügen')!.dispatchEvent(keydown('Escape'))
  flushSync()
  await tick()
  expect(atText()).toEqual(textView())
  await armed()
  await toPreview()
  lastBackdrop().click()
  flushSync()
  await tick()
  expect(atText()).toEqual(textView())
  await armed()
  await toPreview()
  button(dialog('Notizen einfügen')!, 'Zurück zum Text')!.click()
  flushSync()
  await tick()
  expect(atText()).toEqual(textView())
})

test('Return in „Quelle für alle“ fokussiert das Einfügen; Escape schließt dann nur es, der Fokus geht an „Notizen einfügen“', async () => {
  show({})
  await openPaste()
  source().focus()
  source().dispatchEvent(keydown('Enter'))
  expect(document.activeElement).toBe(dialog('Notizen einfügen'))
  dialog('Notizen einfügen')!.dispatchEvent(keydown('Escape'))
  flushSync()
  await tick()
  expect([dialog('Notizen einfügen'), dialog('Deine Sammlung') !== null, document.activeElement]).toEqual([null, true, button(section('Erkenntnisse'), 'Notizen einfügen')])
})

test('Danebentippen sperrt neu: das des Einfügens bei jedem Wechsel der Ansicht, das der Sammlung, wenn das Einfügen schließt', async () => {
  show({})
  await openPaste()
  setNotes('Mehrweg statt Einweg')
  flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
  flushSync()
  expect(lastBackdrop().disabled).toBe(true)
  await armed()
  button(dialog('Notizen einfügen')!, 'Zurück zum Text')!.click()
  flushSync()
  expect(lastBackdrop().disabled).toBe(true)
  await armed()
  dialog('Notizen einfügen')!.dispatchEvent(keydown('Escape'))
  flushSync()
  expect([dialog('Notizen einfügen'), lastBackdrop().disabled]).toEqual([null, true]) // jetzt das der Sammlung
  await armed()
  expect(lastBackdrop().disabled).toBe(false)
})

test('ein Tipp auf „… übernehmen“ gleich nach „Vorschau zeigen“ übernimmt nichts (Review Focus 4)', async () => {
  show({})
  await openPaste()
  setNotes('Pausen helfen beim Lernen.')
  flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
  flushSync()
  button(dialog('Notizen einfügen')!, '1 Erkenntnis übernehmen')!.click()
  flushSync()
  expect([stats.data.collection, dialog('Notizen einfügen')!.textContent!.includes('Vorschau')]).toEqual([undefined, true])
  await armed()
  button(dialog('Notizen einfügen')!, '1 Erkenntnis übernehmen')!.click()
  flushSync()
  expect(stats.data.collection).toHaveLength(1)
})

test('dieselben Notizen noch einmal: „Keine neue Erkenntnis dabei.“ und kein Knopf zum Übernehmen', async () => {
  show({ collection: [E] })
  await openPaste()
  setNotes(`- ${E.text}`)
  flushSync()
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
  flushSync()
  const paste = dialog('Notizen einfügen')!
  expect(paste.textContent).toContain('Keine neue Erkenntnis dabei.')
  expect(paste.textContent).toContain('1 doppelt oder schon vorhanden, übersprungen.')
  expect([...paste.querySelectorAll('button')].some((b) => b.textContent!.includes('übernehmen'))).toBe(false)
})

test('mehr als 50 000 Zeichen: das Feld kürzt nichts, erst die Vorschau nennt es (Review Focus 5)', async () => {
  const long = `Zeile 1\n${'x'.repeat(50_100)}`
  show({})
  await openPaste()
  setNotes(long)
  flushSync()
  expect([notes().value, notes().hasAttribute('maxlength')]).toEqual([long, false])
  button(dialog('Notizen einfügen')!, 'Vorschau zeigen')!.click()
  flushSync()
  const text = dialog('Notizen einfügen')!.textContent!
  for (const line of ['Der Text ist sehr lang. Verwendet werden die ersten 50 000 Zeichen.', '2 neue Erkenntnisse', '1 gekürzt auf 500 Zeichen.']) expect(text).toContain(line)
})
