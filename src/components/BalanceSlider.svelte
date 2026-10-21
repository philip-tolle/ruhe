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
    class="range"
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

  /* Aussehen des Reglers: Klasse `range` in app.css. */
  input[type='range'] {
    flex: 1;
    min-width: 0;
  }
</style>
