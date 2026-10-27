<script lang="ts">
  import type { Hack } from '../../lib/energy/hacks'

  // „Warum es wirkt“ (Spec M9 §3.4): das Wirkungsbild von … nach … und der Erklärtext. Die Überschrift setzt, wer es
  // einsetzt (Karte: Abschnitt, Player: aufklappender Knopf). Der Zielzustand trägt die Farbe des Bereichs, der
  // Ausgangszustand bleibt neutral; beide sind deckende Flächen, damit der Kontrast nicht vom Untergrund abhängt.
  let { hack }: { hack: Hack } = $props()
</script>

<div class="why" style:--area="var(--area-{hack.area})" style:--area-text="var(--area-{hack.area}-text)">
  <div class="picture">
    <span class="state from">{hack.why.from}</span>
    <svg class="arrow" viewBox="0 0 28 16" width="28" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 8h22M18 2l6 6-6 6" />
    </svg>
    <span class="visually-hidden">wird zu</span>
    <span class="state to">{hack.why.to}</span>
  </div>
  <p class="text">{hack.why.text}</p>
</div>

<style>
  .why {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .picture {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .state {
    display: flex;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 36px;
    padding: 4px 10px;
    border-radius: 18px;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .from {
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--text) 10%, var(--sky-mid));
    color: var(--text-muted);
  }

  .to {
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--area) 16%, var(--sky-mid));
    color: var(--area-text);
  }

  .arrow {
    flex: none;
    color: var(--text-muted);
  }

  .text {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.5;
  }
</style>
