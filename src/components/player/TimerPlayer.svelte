<script lang="ts">
  import PlayerShell from './PlayerShell.svelte'
  import { timerDisplay } from '../../lib/meditation/timer-view'
  import { formatRemaining } from '../../lib/time/format'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'

  // App.svelte zeigt den Player, solange ein Timer läuft (Laufansicht) oder sein Abschluss offen ist
  // (die End-Schalen klingen dabei noch aus).
  const run = $derived(runningProgram('timer'))
  const done = $derived(doneOf('timer'))

  const clock = programClock(() => run !== null)
  const view = $derived(run ? timerDisplay(run, clock.elapsed) : null)

  // Ring: Kreis mit Radius R im 200er-Feld, der Fortschritt läuft oben beginnend im Uhrzeigersinn.
  const R = 92
  const CIRCUMFERENCE = 2 * Math.PI * R
</script>

<PlayerShell
  label="Meditation"
  {run}
  {done}
  confirmTitle="Meditation beenden?"
  continueLabel="Weiter meditieren"
>
  {#if view}
    <div class="dial">
      <svg class="ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle class="track" cx="100" cy="100" r={R} />
        {#if view.progress > 0}
          <circle
            class="progress"
            cx="100"
            cy="100"
            r={R}
            transform="rotate(-90 100 100)"
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={CIRCUMFERENCE * (1 - view.progress)}
          />
        {/if}
      </svg>
      <div class="readout">
        {#if view.arriving !== null}
          <p class="phase">Ankommen</p>
          <p class="big">{view.arriving}</p>
        {:else}
          <p class="big" role="timer">{formatRemaining(view.remaining)}</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if run?.noBowl}
    <p class="notice" role="status">Die Klangschale konnte nicht geladen werden – der Timer läuft ohne sie.</p>
  {/if}
</PlayerShell>

<style>
  .dial {
    display: grid;
    flex: 1;
    place-items: center;
    width: 100%;
    min-height: 0;
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

  .notice {
    max-width: 400px;
    color: var(--text-muted);
    text-align: center;
  }

  .big {
    font-size: clamp(3rem, 15vw, 4.25rem);
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
</style>
