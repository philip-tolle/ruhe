<script lang="ts">
  // Fortschrittsring mit großer Zeit in der Mitte (Timer, geführte Meditation). `caption` steht
  // klein über der Zahl (z. B. „Ankommen“); ohne sie ist die Zahl die laufende Restzeit (`timer`).
  // `fit`: Der Ring nimmt den Platz, der zwischen Titel und Knöpfen bleibt, statt einer festen Größe
  // nach dem Bildschirm (für Player mit mehr Bedienelementen).
  let {
    progress,
    value,
    caption = null,
    fit = false,
  }: { progress: number; value: string; caption?: string | null; fit?: boolean } = $props()

  // Ring: Kreis mit Radius R im 200er-Feld, der Fortschritt läuft oben beginnend im Uhrzeigersinn.
  const R = 92
  const CIRCUMFERENCE = 2 * Math.PI * R
</script>

<div class="dial" class:fit>
  <svg class="ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <circle class="track" cx="100" cy="100" r={R} />
    {#if progress > 0}
      <circle
        class="progress"
        cx="100"
        cy="100"
        r={R}
        transform="rotate(-90 100 100)"
        stroke-dasharray={CIRCUMFERENCE}
        stroke-dashoffset={CIRCUMFERENCE * (1 - progress)}
      />
    {/if}
  </svg>
  <div class="readout">
    {#if caption !== null}
      <p class="phase">{caption}</p>
      <p class="big">{value}</p>
    {:else}
      <p class="big" role="timer">{value}</p>
    {/if}
  </div>
</div>

<style>
  .dial {
    display: grid;
    flex: 1;
    place-items: center;
    width: 100%;
    min-height: 0;
  }

  /* Der Ring misst den Platz, den die Spalte ihm lässt; wird es zu eng, scrollt der Player. */
  .dial.fit {
    min-height: 168px;
    container-type: size;
  }

  .ring,
  .readout {
    grid-area: 1 / 1;
  }

  .ring {
    width: min(78vw, 46dvh, 320px);
    height: auto;
    overflow: visible;
  }

  .fit .ring {
    width: min(100cqw, 100cqh, 320px);
  }

  .track,
  .progress {
    fill: none;
    stroke-width: 5;
  }

  .track {
    stroke: rgb(238 240 250 / 0.12);
  }

  .progress {
    stroke: var(--accent);
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px rgb(242 201 138 / 0.45));
  }

  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .phase {
    color: var(--text-muted);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .big {
    font-size: clamp(3rem, 15vw, 4.25rem);
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
</style>
