<script lang="ts">
  // Regler „Balance Stimme ↔ Hintergrund“ geführter Meditationen (0 … 100 % in 5er-Schritten):
  // links mehr Stimme, rechts mehr Hintergrund. `onInput` folgt dem Ziehen, `onChange` dem
  // Loslassen; beide bekommen die Balance 0 … 1.
  import { balanceFromPercent, balancePercent } from '../lib/meditation/guided-view'

  let {
    value,
    disabled = false,
    onInput,
    onChange,
  }: {
    value: number
    disabled?: boolean
    onInput?: (balance: number) => void
    onChange?: (balance: number) => void
  } = $props()

  const percent = $derived(balancePercent(value))

  const read = (event: Event & { currentTarget: HTMLInputElement }) => balanceFromPercent(event.currentTarget.valueAsNumber)
</script>

<div class="balance">
  <span class="end" aria-hidden="true">Stimme</span>
  <input
    type="range"
    aria-label="Balance Stimme ↔ Hintergrund"
    aria-valuetext="{percent} % Hintergrund"
    min="0"
    max="100"
    step="5"
    value={percent}
    style:--v={percent / 100}
    {disabled}
    oninput={(event) => onInput?.(read(event))}
    onchange={(event) => onChange?.(read(event))}
  />
  <span class="end" aria-hidden="true">Hintergrund</span>
</div>

<style>
  .balance {
    --track: rgb(169 175 203 / 0.72);
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .end {
    flex: none;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
    height: 48px;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type='range']:disabled {
    cursor: default;
  }

  /* Der Füllstand endet in der Mitte des Reglerknopfs (12 px = halber Knopf). */
  input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(
      to right,
      var(--accent) calc(12px + (100% - 24px) * var(--v)),
      var(--track) calc(12px + (100% - 24px) * var(--v))
    );
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -9px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    box-shadow:
      0 0 0 4px rgb(242 201 138 / 0.2),
      0 2px 8px rgb(5 8 24 / 0.5);
  }

  input[type='range']::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--track);
  }

  input[type='range']::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--accent);
  }

  input[type='range']::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    box-shadow:
      0 0 0 4px rgb(242 201 138 / 0.2),
      0 2px 8px rgb(5 8 24 / 0.5);
  }

  input[type='range']:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
    border-radius: 14px;
  }
</style>
