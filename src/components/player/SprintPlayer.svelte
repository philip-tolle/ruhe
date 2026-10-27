<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import PlayerShell from './PlayerShell.svelte'
  import ProgressDial from './ProgressDial.svelte'
  import SprintDone from './SprintDone.svelte'
  import { FOKUS_MOTIV } from '../../lib/content/motive'
  import { timerDisplay } from '../../lib/meditation/timer-view'
  import { formatRemaining } from '../../lib/time/format'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'

  // Vollbild-Player des Fokus-Sprints (Spec M9 §3.6) auf dem Rahmen der anderen Player. App.svelte zeigt ihn, solange ein
  // Sprint läuft (Laufansicht) oder sein Ende offen ist (`SprintDone`). Kein Vorlauf und keine Zwischenschalen: oben das
  // Motiv, der Ring mit der Restzeit groß, darunter das Vorhaben (oder „Fokus-Sprint“, wenn keines gewählt wurde).
  const run = $derived(runningProgram('focus'))
  const done = $derived(doneOf('focus'))

  // Die Anzeige liest die Zeit pro Bild aus der Audio-Uhr: Auch nach dem Entsperren stimmt sie sofort wieder.
  const clock = programClock(() => run !== null)
  const view = $derived(run ? timerDisplay(run, clock.elapsed) : null)
  const task = $derived(run?.note?.trim() || 'Fokus-Sprint')
</script>

<PlayerShell label="Fokus-Sprint" {run} {done} confirmTitle="Sprint beenden?" continueLabel="Weiter fokussieren" {doneView}>
  {#if view}
    <Motiv id={FOKUS_MOTIV} size={72} />
    <ProgressDial fit progress={view.progress} value={formatRemaining(view.remaining)} />
    <p class="task">{task}</p>
  {/if}

  {#if run?.noBowl}
    <p class="notice" role="status">Die Klangschale konnte nicht geladen werden – der Sprint läuft ohne sie.</p>
  {/if}
</PlayerShell>

{#snippet doneView()}
  {#if done}
    <SprintDone {done} />
  {/if}
{/snippet}

<style>
  /* Das Vorhaben kann ein langes Wort ohne Leerzeichen sein (bis 80 Zeichen): Es bricht notfalls im Wort um. */
  .task {
    max-width: 100%;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.125rem;
    line-height: 1.3;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .notice {
    max-width: 400px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
