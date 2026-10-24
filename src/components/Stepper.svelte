<script lang="ts">
  // Regler mit „−“, Wert und „+“ (eigene Atemmuster, Spec M8 §4). Die Gruppe trägt die Beschriftung; die Knöpfe heißen
  // „{label} kürzer“ und „{label} länger“ und sind an den Grenzen gesperrt. Der Wert wird angesagt, wenn er sich ändert.
  let {
    label,
    valueText,
    canDecrease,
    canIncrease,
    onDecrease,
    onIncrease,
  }: {
    label: string
    valueText: string
    canDecrease: boolean
    canIncrease: boolean
    onDecrease: () => void
    onIncrease: () => void
  } = $props()
</script>

<div class="stepper" role="group" aria-label={label}>
  <span class="label" aria-hidden="true">{label}</span>
  <div class="controls">
    <button type="button" class="step" aria-label="{label} kürzer" disabled={!canDecrease} onclick={() => onDecrease()}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 12h12" /></svg>
    </button>
    <span class="value" aria-live="polite">{valueText}</span>
    <button type="button" class="step" aria-label="{label} länger" disabled={!canIncrease} onclick={() => onIncrease()}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 12h12M12 6v12" /></svg>
    </button>
  </div>
</div>

<style>
  /* Beschriftung links (bricht bei großer Schrift um), Regler rechts. Wird es eng, rutscht der Regler unter die
     Beschriftung, statt seitlich hinauszulaufen. */
  .stepper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
  }

  .label {
    flex: 1 1 8rem;
    min-width: 0;
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .controls {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
  }

  .step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
  }

  .step svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .step:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .step:not(:disabled):active {
    transform: scale(0.96);
  }

  .value {
    min-width: 4.25rem;
    font-size: 1.0625rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    text-align: center;
  }
</style>
