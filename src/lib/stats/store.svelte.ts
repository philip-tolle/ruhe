// Reaktive Hülle um die Persistenz: Die Oberfläche liest `stats` und ändert nur über die
// Funktionen hier. Jede Änderung ersetzt `stats.data` durch ein neues Objekt und speichert
// sofort; die Logik steckt in persist.ts und backup.ts.
import { mergeBackup } from './backup'
import type { CustomBreathPattern } from '../breath/custom'
import type { EnergyArea, EnergyLevel } from '../energy/areas'
import { focusSprintFrom, hackRunFrom } from '../energy/record'
import { appNow } from '../ui/tageszeit.svelte'
import { loadData, saveData, withBreathPattern, withCalm, withCheckin, withDominoToggled, withFocusSprint, withHackEffect, withHackRun, withMorning, withoutBreathPattern, withSession, type StorageLike } from './persist'
import type { AppData, CalmLevel, LastUsed, MorningInput, SessionResult, Settings } from './schema'

/** `window.localStorage`, oder `null`, wenn der Zugriff wirft (z. B. SecurityError) oder fehlt. */
export function safeLocalStorage(): StorageLike | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

const storage = safeLocalStorage()

export const stats: { data: AppData; saveFailed: boolean } = $state({ data: loadData(storage), saveFailed: false })

// `saveFailed` zeigt immer das Ergebnis des letzten Speicherns; der Stand bleibt auch dann im Speicher.
function commit(data: AppData): void {
  stats.data = data
  stats.saveFailed = !saveData(storage, data)
}

/**
 * Leitet ein Ergebnis nach seiner Art weiter: Hack-Lauf (ab 30 s), Fokus-Sprint (ab 5 min) oder Sitzung (ab 60 s).
 * Gibt die ID des neuen Eintrags zurück, wenn er zählt (auch bei fehlgeschlagenem Speichern – er steht dann im
 * Speicher der App), sonst `null`.
 */
export function recordResult(r: SessionResult): string | null {
  const id = crypto.randomUUID()
  let next: AppData | null
  if (r.kind === 'hack') {
    const run = hackRunFrom(r, id, stats.data.energyCheckins ?? [])
    next = run && withHackRun(stats.data, run)
  } else if (r.kind === 'focus') {
    const sprint = focusSprintFrom(r, id)
    next = sprint && withFocusSprint(stats.data, sprint)
  } else {
    next = withSession(stats.data, r, id)
  }
  if (!next) return null
  commit(next)
  return id
}

/** Energie-Check-in mit allen vier Stufen, zeitgestempelt mit der aktuellen Uhrzeit. */
export function saveCheckin(levels: Record<EnergyArea, EnergyLevel>): void {
  commit(withCheckin(stats.data, { id: crypto.randomUUID(), at: new Date().toISOString(), levels: { ...levels } }))
}

/**
 * Morgen-Start am Ende des Ablaufs: legt den Eintrag des heutigen Tages an oder ersetzt ihn. „Heute“ ist `appNow()`.
 * Es entsteht nie eine Sitzung; Check-in, Übungen und Meditation des Ablaufs speichern sich selbst.
 */
export function saveMorning(input: MorningInput): void {
  commit(withMorning(stats.data, input, appNow()))
}

/** Hakt das Big Domino eines Tages ab bzw. nimmt den Haken zurück; ohne Eintrag oder Big Domino ändert sich nichts. */
export function toggleDomino(day: string): void {
  const next = withDominoToggled(stats.data, day, appNow())
  if (next) commit(next)
}

/** Vorher- oder Jetzt-Wert eines Hack-Laufs: setzt oder entfernt (`null`); eine unbekannte ID ändert nichts. */
export function setHackEffect(runId: string, which: 'before' | 'after', level: EnergyLevel | null): void {
  const next = withHackEffect(stats.data, runId, which, level)
  if (next) commit(next)
}

/** Ruhe-Check-in vom Abschluss: setzt oder entfernt (`null`) einen Wert; eine unbekannte ID ändert nichts. */
export function setCalm(sessionId: string, which: 'before' | 'after', level: CalmLevel | null): void {
  const next = withCalm(stats.data, sessionId, which, level)
  if (next) commit(next)
}

export function setLastUsed(last: LastUsed): void {
  commit({ ...stats.data, lastUsed: last })
}

/** Eigenes Atemmuster anlegen oder ändern (gleiche Kennung). */
export function saveBreathPattern(pattern: CustomBreathPattern): void {
  commit(withBreathPattern(stats.data, pattern))
}

/** Eigenes Atemmuster löschen; Sitzungen und „Zuletzt genutzt“ bleiben. */
export function deleteBreathPattern(id: string): void {
  commit(withoutBreathPattern(stats.data, id))
}

/** Flaches Zusammenführen; `timer` wird als Ganzes ersetzt. */
export function updateSettings(patch: Partial<Settings>): void {
  commit({ ...stats.data, settings: { ...stats.data.settings, ...patch } })
}

/** Bei einem Fehler bleibt alles unverändert und nichts wird gespeichert. */
export function importBackup(text: string): { added: number; addedEnergy: number } | { error: string } {
  const merged = mergeBackup(stats.data, text)
  if ('error' in merged) return merged
  commit(merged.data)
  return { added: merged.added, addedEnergy: merged.addedEnergy }
}
