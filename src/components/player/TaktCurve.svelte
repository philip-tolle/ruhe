<script lang="ts">
  import type { Hack } from '../../lib/energy/hacks'
  import { CURVE, areaPath, curvePoint, curvePoints, linePath } from '../../lib/energy/takt-view'

  // Die Atemkurve eines Takt-Hacks (Spec M9 §3.5, Entwurf B): ein ganzer Zyklus als Linie von links nach rechts, die
  // Fläche darunter sanft getönt, und ein leuchtender Punkt, der im Takt auf der Linie läuft. Schmuck für die Augen:
  // Die Anweisung und die Runde stehen als Text darunter, darum `aria-hidden`. `progress` (Fortschritt im Zyklus) und
  // `level` (Pegel) kommen aus `taktAt` und werden pro Bild neu gesetzt; die Linie selbst ändert sich nicht.
  // Das Wach-Atmung-Bild endet bewusst flach: 15 Hübe, dann ein Viertel lang Ausatmen und Halten auf dem Boden.
  let { hack, progress, level }: { hack: Hack; progress: number; level: number } = $props()

  const id = $props.id()
  const points = $derived(curvePoints(hack))
  const line = $derived(linePath(points))
  const fill = $derived(areaPath(points))
  const dot = $derived(curvePoint(progress, level))
</script>

<svg
  class="curve"
  viewBox="0 0 {CURVE.width} {CURVE.height}"
  fill="none"
  aria-hidden="true"
  focusable="false"
  style:--area="var(--area-{hack.area})"
>
  <defs>
    <!-- Die Linie läuft vom Akzent der Stimmung in die Farbe des Bereichs; darunter ein Hauch Akzent, der nach unten ausläuft. -->
    <linearGradient id="{id}-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style="stop-color: var(--accent)" />
      <stop offset="1" style="stop-color: var(--area)" />
    </linearGradient>
    <linearGradient id="{id}-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-opacity="0.22" style="stop-color: var(--accent)" />
      <stop offset="1" stop-opacity="0" style="stop-color: var(--accent)" />
    </linearGradient>
  </defs>
  <path d={fill} fill="url(#{id}-fill)" />
  <path class="floor" d="M {CURVE.left} {CURVE.floor} H {CURVE.right}" />
  <path class="line" d={line} stroke="url(#{id}-line)" />
  <circle class="dot" cx={dot.x} cy={dot.y} r="9" />
</svg>

<style>
  .curve {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .floor {
    stroke: rgb(238 240 250 / 0.18);
    stroke-width: 1;
  }

  .line {
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .dot {
    fill: var(--text);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 80%, transparent));
  }
</style>
