import { GREETING, tageszeit } from './tageszeit'

/** Begrüßung nach lokaler Tageszeit: Morgen 5–11, Tag 11–17, sonst Abend. */
export function greetingFor(date: Date): string {
  return GREETING[tageszeit(date)]
}
