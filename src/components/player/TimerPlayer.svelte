<script lang="ts">
  import PlayerShell from './PlayerShell.svelte'
  import ProgressDial from './ProgressDial.svelte'
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
</script>

<PlayerShell
  label="Meditation"
  {run}
  {done}
  confirmTitle="Meditation beenden?"
  continueLabel="Weiter meditieren"
>
  {#if view}
    <!-- Im Vorlauf „Ankommen“ mit den Sekunden bis zur ersten Schale, danach die Restzeit. -->
    <ProgressDial
      progress={view.progress}
      caption={view.arriving !== null ? 'Ankommen' : null}
      value={view.arriving !== null ? String(view.arriving) : formatRemaining(view.remaining)}
    />
  {/if}

  {#if run?.noBowl}
    <p class="notice" role="status">Die Klangschale konnte nicht geladen werden – der Timer läuft ohne sie.</p>
  {/if}
</PlayerShell>

<style>
  .notice {
    max-width: 400px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
