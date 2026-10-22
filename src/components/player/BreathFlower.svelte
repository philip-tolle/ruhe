<script lang="ts">
  import type { PhaseKind } from '../../lib/breath/patterns'
  import { circleScale, petalOffset, phaseColor } from '../../lib/breath/view'
  import { motivUrl } from '../../lib/content/motive'

  // Die Atem-Blüte (Spec M4 §5): sechs gemalte Blätter, je um 60° gedreht, die Spitzen in der Mitte.
  // Jedes Blatt trägt alle drei Farben übereinander; zu sehen ist die Ebene der laufenden Phase. Größe
  // (`scale`) und Spreizung (`offset`, Anteil der Blattlänge, siehe `petalOffset`) gibt der Player je
  // Bild aus der Audio-Uhr vor. Die Drehung ist reine Zierde und ruht, solange `paused` gilt.
  // Ohne Bewegungswunsch des Systems steht die Blüte in mittlerer Größe still. Alles Schmuck: Die
  // Bedeutung tragen Phasenwort und Countdown.
  let { scale, offset, kind, paused }: { scale: number; offset: number; kind: PhaseKind; paused: boolean } = $props()

  const PETALS = [0, 1, 2, 3, 4, 5]
  const LAYERS: readonly PhaseKind[] = ['ein', 'halten', 'aus']

  // Der Stand für „Bewegung reduzieren“: Atemstand 0,5.
  const SCALE_STILL = circleScale(0.5)
  const OFFSET_STILL = petalOffset(0.5)
</script>

<div
  class="flower"
  data-testid="breath-flower"
  data-phase={kind}
  aria-hidden="true"
  style:--scale={scale}
  style:--offset={offset}
  style:--scale-still={SCALE_STILL}
  style:--offset-still={OFFSET_STILL}
  style:--phase-color={phaseColor(kind)}
>
  <div class="glow"></div>
  <div class="spin" class:paused>
    <div class="bloom">
      {#each PETALS as i (i)}
        <div class="petal" style:--angle="{i * 60}deg">
          {#each LAYERS as layer (layer)}
            <img
              class="layer"
              class:shown={layer === kind}
              data-layer={layer}
              src={motivUrl(`blatt-${layer}`)}
              alt=""
              width="360"
              height="360"
              decoding="async"
              draggable="false"
            />
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Die Phasenfarbe als eingetragene Farbe: So kann der Schein weich übergehen. */
  @property --phase-color {
    syntax: '<color>';
    inherits: true;
    initial-value: #b7a8f0;
  }

  /* Die Blüte füllt die Bühne des Players (ein Quadrat). Ohne Bewegungswunsch gilt der stille Stand.
     Sie nimmt keine Tipps an: kein Ziehen, kein Markieren, kein Bildmenü bei langem Druck. */
  .flower {
    --bloom-scale: var(--scale-still);
    --petal-offset: var(--offset-still);

    position: relative;
    width: 100%;
    height: 100%;
    pointer-events: none;
    user-select: none;
  }

  .glow,
  .spin,
  .bloom {
    position: absolute;
    inset: 0;
  }

  /* Weicher Schein in der Phasenfarbe hinter der Blüte, nach außen sanft auslaufend. Er bleibt stehen,
     wenn die Blüte atmet. */
  .glow {
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--phase-color) 22%, transparent),
      color-mix(in srgb, var(--phase-color) 14%, transparent) 40%,
      color-mix(in srgb, var(--phase-color) 6%, transparent) 68%,
      color-mix(in srgb, var(--phase-color) 2%, transparent) 86%,
      transparent
    );
  }

  .bloom {
    transform: scale(var(--bloom-scale));
  }

  /* Ein Blatt: Kasten mit der Seitenlänge L = 0,44 der Bühne, die Spitze (Mitte unten) im Mittelpunkt.
     Positive Verschiebung rückt es nach innen, negative nach außen; voll geöffnet (−0,13 L bei Größe 1)
     reicht es 1,13 L weit, die Blüte also knapp bis an den Rand der Bühne. Die Blätter scheinen
     ineinander durch (screen). */
  .petal {
    position: absolute;
    bottom: 50%;
    left: 28%;
    width: 44%;
    height: 44%;
    transform-origin: 50% 100%;
    transform: rotate(var(--angle)) translateY(calc(var(--petal-offset) * 100%));
    mix-blend-mode: screen;
  }

  .layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .layer.shown {
    opacity: 0.8;
  }

  /* Mit Bewegung: Die Blüte atmet und dreht sich (eine Umdrehung in 120 s), Farben gehen weich über. */
  @media (prefers-reduced-motion: no-preference) {
    .flower {
      --bloom-scale: var(--scale);
      --petal-offset: var(--offset);

      transition: --phase-color 0.6s ease-in-out;
    }

    .spin {
      animation: flower-spin 120s linear infinite;
    }

    .spin.paused {
      animation-play-state: paused;
    }

    .layer {
      transition: opacity 0.6s ease-in-out;
    }

    @keyframes flower-spin {
      to {
        transform: rotate(360deg);
      }
    }
  }
</style>
