<script lang="ts">
  import { audio, togglePause } from '../lib/audio/engine-store.svelte'
  import { mediaTitle } from '../lib/audio/media-title'
  import { SOUNDS } from '../lib/sounds/catalog'
  import { formatRemaining } from '../lib/time/format'
  import type { TabId } from '../lib/ui/tabs'

  let { onNavigate }: { onNavigate: (tab: TabId) => void } = $props()

  // Titel des laufenden Klangs; es läuft immer nur einer (Antippen wechselt).
  const title = $derived(
    mediaTitle(
      SOUNDS.filter((s) => audio.snap.volumes[s.id] !== undefined).map((s) => s.title),
      null,
    ),
  )
  const remaining = $derived(audio.snap.remainingSec)
  const playing = $derived(audio.snap.state === 'playing')
</script>

<div class="mini" role="region" aria-label="Wiedergabe">
  <div class="bar">
    <button type="button" class="title" onclick={() => onNavigate('klaenge')}><span>{title}</span></button>
    {#if remaining !== null}
      <span class="remaining">Noch {formatRemaining(remaining)}</span>
    {/if}
    <button type="button" class="button toggle" onclick={togglePause}>
      {playing ? 'Pause' : 'Weiter'}
    </button>
  </div>
</div>

<style>
  /* Die äußere Fläche reicht über die Breite, nimmt aber keine Berührungen an; nur die Leiste selbst. */
  .mini {
    position: fixed;
    inset: auto 0 calc(var(--tabbar-offset) + var(--miniplayer-gap));
    z-index: 9;
    padding: 0 var(--gutter);
    pointer-events: none;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: var(--column-width);
    height: var(--miniplayer-height);
    margin: 0 auto;
    padding: 0 8px 0 18px;
    border: 1px solid rgb(242 201 138 / 0.28);
    border-radius: 24px;
    background: rgb(27 35 80 / 0.92);
    box-shadow:
      0 10px 32px rgb(5 8 24 / 0.5),
      0 0 28px rgb(242 201 138 / 0.1);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    pointer-events: auto;
  }

  .title {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    min-height: 48px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.25;
    text-align: left;
  }

  /* höchstens zwei Zeilen, damit die Leiste immer gleich hoch bleibt */
  .title span {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .remaining {
    flex: none;
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .toggle {
    flex: none;
    min-width: 48px;
    min-height: 48px;
    padding: 0 18px;
    font-size: 0.9375rem;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar {
      animation: mini-in 0.4s ease-out both;
    }

    @keyframes mini-in {
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
