// Ein schneller zweiter Tipp auf „Starten“ (Doppeltipp) landete sonst auf einem Bedienelement des
// Players, das sich gerade an dieselbe Stelle gelegt hat: Die Bedienelemente nehmen Tipps erst nach
// kurzer Zeit an, sichtbar sind sie sofort. Ein reiner Anzeige-Timer, nicht das Ende des
// Einblendens (bei reduzierter Bewegung gibt es keins).
const ARM_MS = 400

/**
 * `armed` wird kurz nach dem Einbau der Komponente wahr. Gehört in die Initialisierung einer
 * Komponente (legt einen Effekt an).
 *
 * Bleibt die Komponente über mehrere Starts stehen (der Hack-Player zeigt nach dem Ende denselben Rahmen wieder
 * als Laufansicht, wenn „Noch einmal“ getippt wird), beginnt die Sperre mit jedem Wechsel des Werts von `rearm` neu.
 */
export function tapArming(rearm?: () => unknown): { readonly armed: boolean } {
  let armed = $state(false)

  $effect(() => {
    rearm?.() // nur als Abhängigkeit: Ändert sich der Wert, läuft der Effekt von vorn
    armed = false
    const arming = setTimeout(() => (armed = true), ARM_MS)
    return () => clearTimeout(arming)
  })

  return {
    get armed() {
      return armed
    },
  }
}
