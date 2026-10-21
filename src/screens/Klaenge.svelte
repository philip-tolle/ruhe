<script lang="ts">
  import { engine } from '../lib/audio/engine'
  import { audio, togglePause } from '../lib/audio/engine-store.svelte'
  import { SOUNDS } from '../lib/sounds/catalog'
  import { formatRemaining } from '../lib/time/format'
  import SleepTimerPicker from '../components/SleepTimerPicker.svelte'
  import SoundTile from '../components/SoundTile.svelte'

  const snap = $derived(audio.snap)
  const status = $derived(snap.remainingSec !== null ? `Noch ${formatRemaining(snap.remainingSec)}` : 'Läuft endlos')
</script>

<section class="screen">
  <header>
    <h1>Klänge</h1>
  </header>

  <ul class="grid" role="list">
    {#each SOUNDS as sound (sound.id)}
      <li><SoundTile {sound} /></li>
    {/each}
  </ul>

  <section class="timer">
    <h2>Sleep-Timer</h2>
    <SleepTimerPicker />
  </section>

  {#if snap.state !== 'idle'}
    <div class="card controls">
      <p class="status">{status}</p>
      <div class="buttons">
        <button type="button" class="button" onclick={togglePause}>
          {snap.state === 'playing' ? 'Pause' : 'Weiter'}
        </button>
        <button type="button" class="button secondary" onclick={() => engine.stopAll().catch(() => {})}>Alle stoppen</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .grid li {
    display: flex;
    flex-direction: column;
  }

  .grid li :global(.tile) {
    flex: 1;
  }

  .timer {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .timer h2 {
    font-size: 1.25rem;
  }

  .controls {
    align-items: stretch;
    gap: 16px;
    padding: 20px;
  }

  .status {
    color: var(--text-muted);
    font-size: 1.0625rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .buttons .button {
    flex: 1 1 140px;
  }
</style>
