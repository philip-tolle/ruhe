<script lang="ts">
  import { untrack } from 'svelte'
  import PlayerShell from './PlayerShell.svelte'
  import { audio } from '../../lib/audio/engine-store.svelte'
  import { breathAt, type BreathMoment, type BreathPatternId, type PhaseKind } from '../../lib/breath/patterns'
  import {
    circleScale,
    easedLevel,
    phaseChanged,
    phaseColor,
    phaseProgress,
    vibrationPattern,
  } from '../../lib/breath/view'
  import { stats } from '../../lib/stats/store.svelte'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'
  import { keepScreenOn } from '../../lib/ui/wake-lock'

  // App.svelte zeigt den Player, solange eine Atemübung läuft (Laufansicht) oder ihr Abschluss offen ist.
  const run = $derived(runningProgram('breath'))
  const done = $derived(doneOf('breath'))
  const running = $derived(run !== null)

  // Die Anzeige liest Phase, Countdown, Kreisgröße und Ring pro Bild aus der Audio-Uhr: Auch nach dem
  // Entsperren stimmt sie sofort wieder. `ref` ist die ID des Atemmusters (siehe `breathProgram`).
  const clock = programClock(() => running)
  const moment = $derived(run ? breathAt(run.ref as BreathPatternId, clock.elapsed, run.length) : null)
  const scale = $derived(moment ? circleScale(easedLevel(moment)) : 1)
  const progress = $derived(moment ? phaseProgress(moment) : 0)
  const color = $derived(phaseColor(moment?.kind ?? 'ein'))

  // Phasenring: Kreis mit Radius R im 200er-Feld, der Fortschritt läuft oben beginnend im Uhrzeigersinn.
  const R = 98
  const CIRCUMFERENCE = 2 * Math.PI * R

  // Vibrieren bei jedem Phasenwechsel, den die Anzeige sieht, im Muster der neuen Phase: nicht im
  // ersten Bild, nicht in der Pause und nur, wenn es in den Einstellungen an ist. Fehlt die
  // Schnittstelle, entfällt es still.
  let shown: BreathMoment | null = null

  function vibrate(kind: PhaseKind) {
    try {
      navigator.vibrate?.(vibrationPattern(kind))
    } catch {
      // nicht verfügbar oder gesperrt
    }
  }

  $effect(() => {
    const next = moment
    if (next) {
      untrack(() => {
        if (phaseChanged(shown, next) && audio.snap.state === 'playing' && stats.data.settings.vibration) vibrate(next.kind)
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
    <div class="breath" style:--phase-color={color}>
      <div class="stage">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <circle class="track" cx="100" cy="100" r={R} />
          {#if progress > 0}
            <circle
              class="progress"
              data-testid="phase-ring"
              cx="100"
              cy="100"
              r={R}
              transform="rotate(-90 100 100)"
              stroke-dasharray={CIRCUMFERENCE}
              stroke-dashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          {/if}
        </svg>
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
  /* Die Phasenfarbe als eingetragene Farbe: So kann sie weich übergehen, auch im Verlauf des Kreises. */
  @property --phase-color {
    syntax: '<color>';
    inherits: true;
    initial-value: #f2c98a;
  }

  /* Kreis und Text bilden eine Gruppe, mittig zwischen Titel und Knöpfen. Die Gruppe misst den Platz,
     der dort bleibt (auch wenn „Zum Starten tippen“ dazukommt), und die Bühne nimmt davon so viel,
     wie Breite und Höhe neben dem Text erlauben. */
  .breath {
    --gap: 16px;
    --readout: 6.5rem;

    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap);
    width: 100%;
    min-height: calc(180px + var(--gap) + var(--readout));
    container-type: size;
  }

  .stage {
    --ring: min(100cqw, 100cqh - var(--gap) - var(--readout), 440px);
    --size: calc(var(--ring) * 0.88);

    display: grid;
    place-items: center;
    width: var(--ring);
    aspect-ratio: 1;
  }

  .ring,
  .circle {
    grid-area: 1 / 1;
  }

  .ring {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .track,
  .progress {
    fill: none;
    stroke-width: 1.75;
  }

  .track {
    stroke: rgb(238 240 250 / 0.12);
  }

  .progress {
    stroke: var(--phase-color);
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--phase-color) 55%, transparent));
  }

  /* Der Kreis in der Phasenfarbe, davor (::after) sein Körper, dahinter (::before) sein Schein. Ohne
     Bewegungswunsch des Systems bleibt er in mittlerer Größe stehen. */
  .circle {
    position: relative;
    width: var(--size);
    aspect-ratio: 1;
    transform: scale(0.75);
  }

  .circle::before,
  .circle::after {
    content: '';
    position: absolute;
    border-radius: 50%;
  }

  /* Weicher Schein in der Phasenfarbe; er wächst mit dem Kreis. Ein Verlauf statt eines Schattens:
     Der bleibt auch groß glatt. Innen liegt er unter dem Körper. */
  .circle::before {
    inset: -30%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--phase-color) 40%, transparent) 58%,
      color-mix(in srgb, var(--phase-color) 26%, transparent) 65%,
      color-mix(in srgb, var(--phase-color) 13%, transparent) 73%,
      color-mix(in srgb, var(--phase-color) 5%, transparent) 84%,
      transparent
    );
  }

  .circle::after {
    inset: 0;
    /* Ersatz für Browser ohne color-mix(): sonst entfiele der ganze Kreis, nicht nur sein Verlauf. */
    background: var(--phase-color);
    background: radial-gradient(
      circle at 44% 40%,
      color-mix(in oklab, var(--phase-color), white 40%),
      var(--phase-color) 58%,
      color-mix(in oklab, var(--phase-color), var(--sky-mid) 16%)
    );
  }

  .readout {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    height: var(--readout);
    text-align: center;
  }

  /* Groß und hell; die Farbe trägt der Kreis. Die Größe folgt der Breite, damit auch der längste Text
     („Rechts ausatmen“) bei großer Systemschrift in eine Zeile passt. */
  .phase {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: min(3rem, 11cqw);
    line-height: 1.15;
    white-space: nowrap;
  }

  .count {
    color: var(--text-muted);
    font-size: 2.5rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  /* Mit Bewegung: Der Kreis atmet, die Farbe geht weich über. */
  @media (prefers-reduced-motion: no-preference) {
    .breath {
      transition: --phase-color 0.6s ease-in-out;
    }

    .circle {
      transform: scale(var(--scale));
      will-change: transform;
    }
  }
</style>
