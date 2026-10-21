<script lang="ts">
  import { untrack } from 'svelte'
  import PlayerShell from './PlayerShell.svelte'
  import { audio } from '../../lib/audio/engine-store.svelte'
  import { breathAt, type BreathMoment, type BreathPatternId } from '../../lib/breath/patterns'
  import { circleScale, phaseChanged } from '../../lib/breath/view'
  import { stats } from '../../lib/stats/store.svelte'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'
  import { keepScreenOn } from '../../lib/ui/wake-lock'

  // App.svelte zeigt den Player, solange eine Atemübung läuft (Laufansicht) oder ihr Abschluss offen ist.
  const run = $derived(runningProgram('breath'))
  const done = $derived(doneOf('breath'))
  const running = $derived(run !== null)

  // Die Anzeige liest Phase, Countdown und Kreisgröße pro Bild aus der Audio-Uhr: Auch nach dem
  // Entsperren stimmt sie sofort wieder. `ref` ist die ID des Atemmusters (siehe `breathProgram`).
  const clock = programClock(() => running)
  const moment = $derived(run ? breathAt(run.ref as BreathPatternId, clock.elapsed, run.length) : null)
  const scale = $derived(moment ? circleScale(moment.level) : 1)

  // Kurzes Vibrieren bei jedem Phasenwechsel, den die Anzeige sieht: nicht im ersten Bild, nicht in
  // der Pause und nur, wenn es in den Einstellungen an ist. Fehlt die Schnittstelle, entfällt es still.
  const VIBRATION_MS = 40
  let shown: BreathMoment | null = null

  function vibrate() {
    try {
      navigator.vibrate?.(VIBRATION_MS)
    } catch {
      // nicht verfügbar oder gesperrt
    }
  }

  $effect(() => {
    const next = moment
    if (next) {
      untrack(() => {
        if (phaseChanged(shown, next) && audio.snap.state === 'playing' && stats.data.settings.vibration) vibrate()
      })
    }
    shown = next
  })

  // Der Bildschirm bleibt an, solange die Laufansicht steht; danach und beim Abbau wird er frei.
  $effect(() => {
    if (!running) return
    return keepScreenOn()
  })
</script>

<PlayerShell label="Atemübung" {run} {done} confirmTitle="Übung beenden?" continueLabel="Weiter atmen">
  {#if moment}
    <div class="breath">
      <div class="stage">
        <div class="guide" aria-hidden="true"></div>
        <div class="circle" data-testid="breath-circle" aria-hidden="true" style:--scale={scale}></div>
      </div>

      <div class="readout">
        <p class="phase" aria-live="polite">{moment.label}</p>
        <p class="count" role="timer">{moment.secondsLeft}</p>
      </div>
    </div>
  {/if}
</PlayerShell>

<style>
  /* Kreis und Text bilden eine Gruppe, mittig zwischen Titel und Knöpfen. */
  .breath {
    --size: min(72vw, 36dvh, 320px);

    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    width: 100%;
    min-height: 0;
  }

  .stage {
    display: grid;
    place-items: center;
  }

  .guide,
  .circle {
    grid-area: 1 / 1;
    width: var(--size);
    aspect-ratio: 1;
    border-radius: 50%;
  }

  /* Die volle Größe des Kreises, damit man sieht, wohin er wächst. */
  .guide {
    border: 1px solid rgb(238 240 250 / 0.14);
  }

  /* Warmes Gold; ohne Bewegungswunsch des Systems bleibt der Kreis in mittlerer Größe stehen. */
  .circle {
    background: radial-gradient(circle at 38% 34%, #fff4dc, var(--accent) 58%, #dba763);
    box-shadow: 0 0 48px 8px rgb(242 201 138 / 0.28);
    transform: scale(0.8);
  }

  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 7rem;
    text-align: center;
  }

  .phase {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: clamp(1.75rem, 8vw, 2.25rem);
    line-height: 1.2;
  }

  .count {
    color: var(--accent);
    font-size: 3rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .circle {
      transform: scale(var(--scale));
      will-change: transform;
    }
  }
</style>
