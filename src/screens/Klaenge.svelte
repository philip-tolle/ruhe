<script lang="ts">
  import { engine } from '../lib/audio/engine'
  import { audio, togglePause } from '../lib/audio/engine-store.svelte'
  import { SOUNDS } from '../lib/sounds/catalog'
  import { formatRemaining } from '../lib/time/format'
  import SleepTimerPicker from '../components/SleepTimerPicker.svelte'
  import SoundTile from '../components/SoundTile.svelte'

  const snap = $derived(audio.snap)
  // `remainingSec` ist genau bei „endlos“ null, auch in der Pause: dann gibt es keinen Text,
  // „Läuft endlos“ wäre neben „Weiter“ falsch. Nach einem gescheiterten Start zeigt die Leiste
  // statt des Statustexts den Hinweis „Zum Starten tippen“.
  const status = $derived(
    snap.remainingSec !== null
      ? `Noch ${formatRemaining(snap.remainingSec)}`
      : snap.state === 'playing'
        ? 'Läuft endlos'
        : null,
  )
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
</section>

<!-- Steuerung über der Reiterleiste, an der Stelle des Mini-Players: Sie bleibt erreichbar,
     egal wie weit die Liste gescrollt ist. App.svelte hält in `main` den Platz dafür frei.
     Außerhalb von .screen, dessen Einblend-Animation sonst den Bezugsrahmen für `fixed` stellte. -->
{#if snap.state !== 'idle'}
  <div class="dock">
    <div class="bar" class:solo={!snap.needsTap && status === null}>
      {#if snap.needsTap}
        <p class="status hint" role="status">Zum Starten tippen</p>
      {:else if status !== null}
        <p class="status">{status}</p>
      {/if}
      <div class="buttons">
        <button type="button" class="button" onclick={togglePause}>
          {snap.state === 'playing' ? 'Pause' : 'Weiter'}
        </button>
        <button type="button" class="button secondary" onclick={() => engine.stopAll().catch(() => {})}>Stoppen</button>
      </div>
    </div>
  </div>
{/if}

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

  /* Wie der Mini-Player: Die äußere Fläche nimmt keine Berührungen an, nur die Leiste selbst. */
  .dock {
    position: fixed;
    inset: auto 0 calc(var(--tabbar-offset) + var(--miniplayer-gap));
    z-index: 9;
    padding: 0 var(--gutter);
    pointer-events: none;
  }

  /* Maße so knapp, dass „Noch 1:30:00“ auch bei 360 px Breite in eine Zeile passt. Farben wie beim
     Mini-Player: Himmel und Akzent der Stimmung. */
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: var(--column-width);
    height: var(--miniplayer-height);
    margin: 0 auto;
    padding: 0 8px 0 16px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    border-radius: 24px;
    background: color-mix(in srgb, var(--sky-mid) 92%, transparent);
    box-shadow:
      0 10px 32px rgb(5 8 24 / 0.5),
      0 0 28px color-mix(in srgb, var(--accent) 10%, transparent);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    pointer-events: auto;
  }

  /* Ohne color-mix() bliebe die Leiste sonst durchsichtig (siehe MiniPlayer): dann deckend. */
  @supports not (color: color-mix(in srgb, red, red)) {
    .bar {
      background: var(--sky-mid);
    }
  }

  /* Ohne Statustext teilen sich die beiden Schaltflächen die ganze Leiste. */
  .bar.solo {
    padding-left: 8px;
  }

  /* höchstens zwei Zeilen, damit die Leiste immer gleich hoch bleibt */
  .status {
    display: -webkit-box;
    flex: 1 1 0;
    min-width: 0;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
  }

  .status.hint {
    color: var(--text);
    font-weight: 600;
  }

  .buttons {
    display: flex;
    flex: none;
    gap: 6px;
  }

  .bar.solo .buttons {
    flex: 1;
  }

  .bar.solo .button {
    flex: 1;
  }

  .buttons .button {
    min-width: 48px;
    min-height: 48px;
    padding: 0 14px;
    font-size: 0.9375rem;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar {
      animation: dock-in 0.4s ease-out both;
    }

    @keyframes dock-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }
</style>
