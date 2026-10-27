// Auswertung der Energie-Daten (Spec M9 §6). Reine Funktionen ohne Speicherzugriff.
import { AREAS, AREA_INFO, type EnergyArea, type EnergyLevel } from './areas'
import { HACKS, hackById, type Hack } from './hacks'
import type { EnergyCheckin, FocusSprint, HackRun } from '../stats/schema'
import { dayKey } from '../stats/summary'
import { tageszeit, type Tageszeit } from '../time/tageszeit'

/** So viele Stunden vor dem Start gilt ein Check-in noch als „Vorher“ eines Hacks (Spec M9 §6.2). */
export const BEFORE_HOURS = 2

/**
 * Stufe des Bereichs aus dem jüngsten Check-in vor oder bei `start`, der höchstens `BEFORE_HOURS`
 * Stunden davor liegt; sonst `null`. Die Reihenfolge der Liste spielt keine Rolle.
 */
export function beforeLevel(c: readonly EnergyCheckin[], area: EnergyArea, start: Date): EnergyLevel | null {
  const end = start.getTime()
  if (Number.isNaN(end)) return null
  const from = end - BEFORE_HOURS * 3_600_000
  let found: EnergyCheckin | null = null
  let foundAt = -Infinity
  for (const checkin of c) {
    const at = Date.parse(checkin.at)
    // Bei gleichem Zeitpunkt gilt der spätere Eintrag der Liste.
    if (at >= from && at <= end && at >= foundAt) {
      found = checkin
      foundAt = at
    }
  }
  return found ? found.levels[area] : null
}

// ── Frische und Kopfzeile (Spec M9 §6.1, §3) ─────────────────────────────────────────────────────

/** So viele Stunden ist ein Check-in „frisch“ (Reset, Pausen-Vorschlag, Erinnerung). */
export const FRESH_HOURS = 3

/** So viele Check-ins in den letzten 14 Tagen braucht es für Muster-Sätze (Spec M9 §6.5). */
export const PATTERN_MIN = 7

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
/** Rundungstoleranz für Vergleiche von Durchschnitten (Quotienten ganzer Zahlen). */
const EPS = 1e-9
const TAGESZEITEN: readonly Tageszeit[] = ['morgen', 'tag', 'abend']
const TAGESZEIT_WORT: Record<Tageszeit, string> = { morgen: 'morgens', tag: 'tagsüber', abend: 'abends' }
const WOCHENTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const

/** Zahl mit deutschem Komma und höchstens einer Nachkommastelle, ohne „,0“: 2,5 → „2,5“, 2 → „2“. */
function zahl(x: number): string {
  return String(Math.round(x * 10) / 10).replace('.', ',')
}

function average(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Der jüngste Check-in (größter Zeitpunkt, bei Gleichstand der spätere der Liste); `null` ohne Check-ins. */
export function latestCheckin(c: readonly EnergyCheckin[]): EnergyCheckin | null {
  let found: EnergyCheckin | null = null
  let foundAt = -Infinity
  for (const checkin of c) {
    const at = Date.parse(checkin.at)
    if (at >= foundAt) {
      found = checkin
      foundAt = at
    }
  }
  return found
}

/** Der jüngste Check-in, der höchstens `FRESH_HOURS` Stunden alt ist; einer in der Zukunft ist nicht frisch. */
export function freshCheckin(c: readonly EnergyCheckin[], now: Date): EnergyCheckin | null {
  const end = now.getTime()
  if (Number.isNaN(end)) return null
  const from = end - FRESH_HOURS * HOUR_MS
  return latestCheckin(c.filter((checkin) => {
    const at = Date.parse(checkin.at)
    return at >= from && at <= end
  }))
}

/** Der Bereich mit der niedrigsten Stufe; bei Gleichstand der erste in der festen Reihenfolge. */
export function weakestArea(levels: Record<EnergyArea, EnergyLevel>): EnergyArea {
  let weakest = AREAS[0]
  for (const area of AREAS) if (levels[area] < levels[weakest]) weakest = area
  return weakest
}

/**
 * Kopfzeile des Akku-Bildes: „Letzter Check-in vor {n} Min“ (unter 60 Min, mindestens 1) bzw.
 * „… vor {n} Std.“ (ab 60 Min, abgerundet), solange der jüngste Check-in von heute ist; sonst „Noch kein Check-in heute“.
 */
export function headerLine(c: readonly EnergyCheckin[], now: Date): string {
  const latest = latestCheckin(c)
  if (!latest) return 'Noch kein Check-in heute'
  const at = new Date(latest.at)
  if (dayKey(at) !== dayKey(now)) return 'Noch kein Check-in heute'
  const minutes = Math.floor((now.getTime() - at.getTime()) / MINUTE_MS)
  if (minutes < 60) return `Letzter Check-in vor ${Math.max(1, minutes)} Min`
  return `Letzter Check-in vor ${Math.floor(minutes / 60)} Std.`
}

// ── Wirkung (Spec M9 §6.3) ───────────────────────────────────────────────────────────────────────

export const WHAT_WORKS_HINT =
  'Bewerte nach einem Hack kurz, wie es dir jetzt geht. Ab zwei Bewertungen je Hack siehst du hier, was bei dir wirkt.'

/** So viele Hacks zeigt „Was bei dir wirkt“ höchstens. */
const WHAT_WORKS_MAX = 3

export interface HackStat {
  /** Läufe mit Vorher- und Jetzt-Wert. */
  rated: number
  /** Schnitt von `after − before` über die bewerteten Läufe; `null` ohne bewertete. */
  mean: number | null
  /** Beginn des jüngsten Laufs (bewertet oder nicht); `null`, wenn kein Zeitpunkt lesbar ist. */
  lastAt: string | null
}

/** Je Hack-Kennung die Bewertungen und der letzte Lauf; auch Kennungen, die der Katalog nicht (mehr) kennt. */
export function hackStats(runs: readonly HackRun[]): Map<string, HackStat> {
  const sums = new Map<string, { rated: number; sum: number; lastAt: string | null; lastMs: number }>()
  for (const r of runs) {
    let s = sums.get(r.hack)
    if (!s) sums.set(r.hack, (s = { rated: 0, sum: 0, lastAt: null, lastMs: -Infinity }))
    if (r.before !== undefined && r.after !== undefined) {
      s.rated++
      s.sum += r.after - r.before
    }
    const ms = Date.parse(r.at)
    if (ms > s.lastMs) {
      s.lastMs = ms
      s.lastAt = r.at
    }
  }
  const stats = new Map<string, HackStat>()
  for (const [id, s] of sums) stats.set(id, { rated: s.rated, mean: s.rated > 0 ? s.sum / s.rated : null, lastAt: s.lastAt })
  return stats
}

/**
 * „Was bei dir wirkt“: bis zu drei Hacks des Katalogs mit mindestens 2 bewerteten Läufen und Schnitt über 0,
 * absteigend nach Schnitt, dann nach mehr bewerteten Läufen, dann in Katalog-Reihenfolge.
 */
export function whatWorks(runs: readonly HackRun[]): { hack: Hack; mean: number; rated: number }[] {
  const list: { hack: Hack; mean: number; rated: number; index: number }[] = []
  for (const [id, s] of hackStats(runs)) {
    const hack = hackById(id)
    if (hack && s.mean !== null && s.rated >= 2 && s.mean > 0) {
      list.push({ hack, mean: s.mean, rated: s.rated, index: HACKS.indexOf(hack) })
    }
  }
  list.sort((a, b) => b.mean - a.mean || b.rated - a.rated || a.index - b.index)
  return list.slice(0, WHAT_WORKS_MAX).map(({ hack, mean, rated }) => ({ hack, mean, rated }))
}

/** „+1,2 Stufen“, „+1 Stufe“: eine Nachkommastelle mit Komma. */
export function effectLabel(mean: number): string {
  const x = Math.round(mean * 10) / 10
  return x === 1 ? '+1 Stufe' : `+${zahl(x)} Stufen`
}

// ── Kalendertage ─────────────────────────────────────────────────────────────────────────────────

/** `dayKey` des Tages `back` Kalendertage vor `now`; der Kalender rechnet, damit 23- und 25-Stunden-Tage nicht stören. */
function dayBack(now: Date, back: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
}

/** Die Tage `from` bis `from + count − 1` vor `now` als Schlüsselmenge, z. B. (0, 7) = heute und die 6 davor. */
function dayKeys(now: Date, from: number, count: number): Set<string> {
  const keys = new Set<string>()
  for (let i = 0; i < count; i++) keys.add(dayKey(dayBack(now, from + i)))
  return keys
}

/** Die Check-ins aus den Tagen `from` bis `from + count − 1` vor `now`. */
function checkinsIn(c: readonly EnergyCheckin[], now: Date, from: number, count: number): EnergyCheckin[] {
  const keys = dayKeys(now, from, count)
  return c.filter((checkin) => keys.has(dayKey(new Date(checkin.at))))
}

// ── Wochenraster (Spec M9 §6.4) ──────────────────────────────────────────────────────────────────

export interface WeekDay {
  /** Lokaler Kalendertag `JJJJ-MM-TT`. */
  key: string
  /** „Mo“ … „So“. */
  short: string
  /** „Montag“ … „Sonntag“. */
  long: string
  /** Schnitt der Stufen des Bereichs an diesem Tag; `null` ohne Check-in. */
  cells: Record<EnergyArea, number | null>
}

/** Die letzten 7 Kalendertage bis heute (Ortszeit), der älteste zuerst, mit dem Tagesschnitt je Bereich. */
export function weekGrid(c: readonly EnergyCheckin[], now: Date): WeekDay[] {
  const days: WeekDay[] = []
  for (let back = 6; back >= 0; back--) {
    const date = dayBack(now, back)
    const key = dayKey(date)
    const ofDay = c.filter((checkin) => dayKey(new Date(checkin.at)) === key)
    const cells = { koerper: null, gefuehl: null, geist: null, sinn: null } as Record<EnergyArea, number | null>
    if (ofDay.length > 0) for (const area of AREAS) cells[area] = average(ofDay.map((checkin) => checkin.levels[area]))
    days.push({ key, short: WOCHENTAG_KURZ[date.getDay()], long: WOCHENTAG_LANG[date.getDay()], cells })
  }
  return days
}

/** Stufe des Feldes: der Schnitt auf eine ganze Stufe gerundet (bestimmt die Deckkraft der Bereichsfarbe). */
export function cellLevel(mean: number): EnergyLevel {
  return Math.min(5, Math.max(1, Math.round(mean))) as EnergyLevel
}

/** Vorlesetext eines Feldes: „Geist, Dienstag: 2,5 von 5“ bzw. „Geist, Dienstag: kein Check-in“. */
export function cellLabel(area: EnergyArea, long: string, mean: number | null): string {
  return `${AREA_INFO[area].title}, ${long}: ${mean === null ? 'kein Check-in' : `${zahl(mean)} von 5`}`
}

// ── Muster-Sätze (Spec M9 §6.5) ──────────────────────────────────────────────────────────────────

export const PATTERN_HINT = 'Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.'

/** Gibt es genug Check-ins (heute und die 13 Tage davor) für Muster-Sätze? */
export function hasPatternData(c: readonly EnergyCheckin[], now: Date): boolean {
  return checkinsIn(c, now, 0, 14).length >= PATTERN_MIN
}

function meanOf(c: readonly EnergyCheckin[], area: EnergyArea): number {
  return average(c.map((checkin) => checkin.levels[area]))
}

/** Satz 1: der Bereich mit dem niedrigsten Schnitt; bei Gleichstand der erste der festen Reihenfolge. */
function weakestSentence(last14: readonly EnergyCheckin[]): { area: EnergyArea; text: string } {
  let area = AREAS[0]
  let low = meanOf(last14, area)
  for (const a of AREAS) {
    const m = meanOf(last14, a)
    if (m < low - EPS) {
      area = a
      low = m
    }
  }
  return { area, text: `Am niedrigsten ist zurzeit dein ${AREA_INFO[area].title}.` }
}

/**
 * Satz 2: Bereich und Tageszeit mit dem größten Abstand nach unten (mindestens 1 Stufe) zum Schnitt der übrigen
 * Check-ins, bei mindestens 3 Check-ins in der Tageszeit. Gleichstand: feste Reihenfolge der Bereiche, dann
 * morgens, tagsüber, abends.
 */
function tageszeitSentence(last14: readonly EnergyCheckin[]): { area: EnergyArea; text: string } | null {
  const zeit = last14.map((checkin) => tageszeit(new Date(checkin.at)))
  let best: { area: EnergyArea; part: Tageszeit; gap: number } | null = null
  for (const area of AREAS) {
    for (const part of TAGESZEITEN) {
      const inPart = last14.filter((_, i) => zeit[i] === part)
      const rest = last14.filter((_, i) => zeit[i] !== part)
      if (inPart.length < 3 || rest.length === 0) continue
      const gap = meanOf(rest, area) - meanOf(inPart, area)
      if (gap >= 1 - EPS && (!best || gap > best.gap + EPS)) best = { area, part, gap }
    }
  }
  return best && { area: best.area, text: `Dein ${AREA_INFO[best.area].title} ist ${TAGESZEIT_WORT[best.part]} am niedrigsten.` }
}

/** „eine halbe Stufe“, „1 Stufe“, „1,5 Stufen“, „2 Stufen“ für einen Unterschied in halben Stufen. */
function stufen(diff: number): string {
  if (diff === 0.5) return 'eine halbe Stufe'
  return diff === 1 ? '1 Stufe' : `${zahl(diff)} Stufen`
}

/**
 * Satz 3: Bereich mit dem größten Unterschied (mindestens 0,5 Stufen) zwischen dieser Woche und der davor, bei
 * mindestens 2 Check-ins in jeder Woche; der Unterschied wird auf halbe Stufen gerundet.
 */
function trendSentence(c: readonly EnergyCheckin[], now: Date): string | null {
  const thisWeek = checkinsIn(c, now, 0, 7)
  const before = checkinsIn(c, now, 7, 7)
  if (thisWeek.length < 2 || before.length < 2) return null
  let best: { area: EnergyArea; diff: number } | null = null
  for (const area of AREAS) {
    const diff = meanOf(thisWeek, area) - meanOf(before, area)
    if (Math.abs(diff) >= 0.5 - EPS && (!best || Math.abs(diff) > Math.abs(best.diff) + EPS)) best = { area, diff }
  }
  if (!best) return null
  const halves = Math.round(Math.abs(best.diff) * 2) / 2
  return `Dein ${AREA_INFO[best.area].title} liegt diese Woche ${stufen(halves)} ${best.diff > 0 ? 'höher' : 'tiefer'} als in der Woche davor.`
}

/**
 * Bis zu zwei Sätze in der Reihenfolge schwächster Bereich, Tageszeit, Trend; leer unter `PATTERN_MIN` Check-ins in
 * 14 Tagen. Nennt der Tageszeit-Satz denselben Bereich wie der erste, entfällt der erste.
 */
export function patternSentences(c: readonly EnergyCheckin[], now: Date): string[] {
  const last14 = checkinsIn(c, now, 0, 14)
  if (last14.length < PATTERN_MIN) return []
  const weakest = weakestSentence(last14)
  const zeit = tageszeitSentence(last14)
  const trend = trendSentence(c, now)
  const sentences = [zeit && zeit.area === weakest.area ? null : weakest.text, zeit?.text ?? null, trend]
  return sentences.filter((s): s is string => s !== null).slice(0, 2)
}

// ── Fokus-Zeile (Spec M9 §6.6) ───────────────────────────────────────────────────────────────────

/** „Diese Woche: 4 Sprints, 3 Std. 20 Min Fokus“ aus den Sprints der letzten 7 Tage; `null` ohne Sprint. */
export function focusLine(s: readonly FocusSprint[], now: Date): string | null {
  const keys = dayKeys(now, 0, 7)
  const week = s.filter((sprint) => keys.has(dayKey(new Date(sprint.at))))
  if (week.length === 0) return null
  const minutes = Math.floor(week.reduce((sum, sprint) => sum + sprint.seconds, 0) / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const dauer = hours === 0 ? `${rest} Min` : rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min`
  return `Diese Woche: ${week.length} ${week.length === 1 ? 'Sprint' : 'Sprints'}, ${dauer} Fokus`
}
