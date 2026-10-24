<script lang="ts">
  import { untrack } from 'svelte'
  import BreathFlower from './BreathFlower.svelte'
  import PlayerShell from './PlayerShell.svelte'
  import { audio } from '../../lib/audio/engine-store.svelte'
  import { resolvePattern } from '../../lib/breath/custom'
  import { breathAt, type BreathMoment, type PhaseKind } from '../../lib/breath/patterns'
  import { circleScale, easedLevel, petalOffset, phaseChanged, vibrationPattern } from '../../lib/breath/view'
  import { stats } from '../../lib/stats/store.svelte'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'
  import { keepScreenOn } from '../../lib/ui/wake-lock'

  // App.svelte zeigt den Player, solange eine Atemübung läuft (Laufansicht) oder ihr Abschluss offen ist.
  const run = $derived(runningProgram('breath'))
  const done = $derived(doneOf('breath'))
  const running = $derived(run !== null)

  // Die Anzeige liest Phase, Countdown, Größe und Spreizung der Blüte pro Bild aus der Audio-Uhr: Auch
  // nach dem Entsperren stimmt sie sofort wieder. `ref` ist die Kennung des Atemmusters (siehe `breathProgram`),
  // fest oder eigen. Ein Muster, das es nicht (mehr) gibt, zeigt keine Blüte statt zu werfen.
  const clock = programClock(() => running)
  const pattern = $derived(run ? resolvePattern(run.ref, stats.data.breathPatterns ?? []) : null)
  const moment = $derived(run && pattern ? breathAt(pattern, clock.elapsed, run.length) : null)
  const level = $derived(moment ? easedLevel(moment) : 0)
  const description = $derived(pattern?.description)
  // Die Blüte ruht, solange die Audio-Uhr steht: in der Pause und bis zum ersten Tippen.
  const paused = $derived(audio.snap.state !== 'playing' || audio.snap.needsTap)

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

<PlayerShell label="Atemübung" {run} {done} subtitle={description} confirmTitle="Übung beenden?" continueLabel="Weiter atmen">
  {#if moment}
    <div class="breath">
      <div class="stage">
        <BreathFlower scale={circleScale(level)} offset={petalOffset(level)} kind={moment.kind} {paused} />
      </div>

      <div class="readout">
        <p class="phase" aria-live="polite">{moment.label}</p>
        <p class="count" role="timer">{moment.secondsLeft}</p>
      </div>
    </div>
  {/if}
</PlayerShell>

<style>
  /* Blüte und Text bilden eine Gruppe, mittig zwischen Titel und Knöpfen. Die Gruppe misst den Platz,
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
    width: min(100cqw, 100cqh - var(--gap) - var(--readout), 440px);
    aspect-ratio: 1;
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

  /* Groß und hell; die Farbe trägt die Blüte. Die Größe folgt der Breite, damit auch der längste Text
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
</style>
