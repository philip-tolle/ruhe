<script module lang="ts">
  import type { HackIconName } from '../../lib/energy/hacks'

  // Die Linien der Symbole, je Name eine Liste von Pfaden im 24er-Feld. Als `Record` über alle Namen: Kommt ein Symbol
  // zu `HACK_ICONS` hinzu, meldet `npm run check` hier, dass seine Zeichnung fehlt.
  const SHAPES: Record<HackIconName, readonly string[]> = {
    // Lunge
    einatmen: ['M12 3v8', 'M12 11c-1.6 0-3 1-3.9 2.8L6.3 18c-.6 1.6.3 2.5 1.6 2.5 2 0 3.3-1.2 3.3-3.2V11', 'M12 11c1.6 0 3 1 3.9 2.8l1.8 4.2c.6 1.6-.3 2.5-1.6 2.5-2 0-3.3-1.2-3.3-3.2V11'],
    // Pfeil nach oben bis an die Decke: noch ein Zug obendrauf
    nachatmen: ['M12 19V7', 'M7 12l5-5 5 5', 'M5 4h14'],
    // Wind
    ausatmen: ['M3 8h10a3 3 0 1 0-3-3', 'M3 12h15a3 3 0 1 1-3 3', 'M3 16h7'],
    // Pause im Kreis
    halten: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M10 9v6', 'M14 9v6'],
    // Figur mit ausgebreiteten Armen
    bewegung: ['M12 2.7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M5 8.5l7 1.5 7-1.5', 'M12 10v4.5', 'M12 14.5l-3.5 6', 'M12 14.5l3.5 6'],
    // Gehende Figur
    gehen: ['M13.5 2.7a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z', 'M13 8.5l-1.8 5', 'M11.2 13.5l-2.7 7', 'M11.2 13.5l3.6 3 .9 4', 'M13 9l3.3 2.5 2.2-.7', 'M13 9l-3.5 1.3-1 3'],
    // Sonne mit Strahlen
    sonne: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2', 'M5.6 5.6 7 7', 'M17 17l1.4 1.4', 'M18.4 5.6 17 7', 'M7 17l-1.4 1.4'],
    // Tropfen
    wasser: ['M12 3c3.2 4 6 7.2 6 11a6 6 0 0 1-12 0c0-3.8 2.8-7 6-11Z'],
    // Bett mit liegender Person
    liegen: ['M3.5 5.5v13', 'M3.5 15.5h17.5v3', 'M7.4 10.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z', 'M10.6 13.2h6.4a2.6 2.6 0 0 1 2.6 2.6'],
    // Stift
    stift: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
    // Herz
    herz: ['M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z'],
    // Auge
    auge: ['M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
    // durchgestrichenes Handy
    'handy-weg': ['M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3Z', 'M11 18h2', 'M4 4l16 16'],
    // Kompass
    kompass: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M15.5 8.5l-2 5-5 2 2-5 5-2Z'],
    // Stern
    stern: ['M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6 6.8 19.4l1-5.9L3.5 9.4l5.9-.8L12 3.2Z'],
    // Pfeil nach rechts
    pfeil: ['M5 12h14', 'M13 6l6 6-6 6'],
    // Fragezeichen im Kreis
    frage: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.7', 'M12 17.3h.01'],
  }
</script>

<script lang="ts">
  // Linien-Symbol zu einem Schritt eines Hacks (Spec M9 §3.4): 24 × 24, Strich 1,6, runde Enden, wie die Symbole der
  // Reiterleiste. Reiner Schmuck: Der Text des Schritts steht daneben, darum `aria-hidden`. Die Farbe kommt von der
  // Schriftfarbe der Umgebung (`currentColor`).
  let { name, size = 24 }: { name: HackIconName; size?: number } = $props()
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each SHAPES[name] as d, i (i)}
    <path {d} />
  {/each}
</svg>
