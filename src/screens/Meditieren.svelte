<script lang="ts">
  import TimerSetup from '../components/timer/TimerSetup.svelte'
  import { savedTimer, timerSummary } from '../lib/meditation/timer-view'
  import { stats } from '../lib/stats/store.svelte'

  let setupOpen = $state(false)

  const summary = $derived(timerSummary(savedTimer(stats.data.settings)))
</script>

<section class="screen">
  <header>
    <h1>Meditieren</h1>
  </header>

  <div class="card">
    <h2>Meditations-Timer</h2>
    <p class="hint">{summary}</p>
    <button type="button" class="button" onclick={() => (setupOpen = true)}>Timer einstellen</button>
  </div>

  <section class="guided">
    <h2>Geführte Meditationen</h2>
    <p class="hint">Kommen mit dem nächsten Update.</p>
  </section>
</section>

<!-- Außerhalb von .screen, dessen Einblend-Animation sonst den Bezugsrahmen für `fixed` stellte. -->
{#if setupOpen}
  <TimerSetup onClose={() => (setupOpen = false)} />
{/if}

<style>
  .hint {
    color: var(--text-muted);
  }

  .guided {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
