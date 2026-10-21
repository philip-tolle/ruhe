<script lang="ts">
  // Schalter als ganze Zeile: links der Text, rechts die Spur mit dem Knopf.
  let { label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void } = $props()
</script>

<button type="button" class="switch" role="switch" aria-checked={checked} onclick={onToggle}>
  <span>{label}</span>
  <span class="track" aria-hidden="true"></span>
</button>

<style>
  .switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    min-height: 52px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-weight: 600;
    text-align: left;
  }

  .track {
    position: relative;
    flex: none;
    width: 52px;
    height: 32px;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    background: var(--surface);
  }

  .track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .switch[aria-checked='true'] .track {
    border-color: var(--accent);
    background: var(--accent);
  }

  .switch[aria-checked='true'] .track::after {
    background: var(--on-accent);
    transform: translateX(20px);
  }

  @media (prefers-reduced-motion: no-preference) {
    .track,
    .track::after {
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        transform 0.25s ease;
    }
  }
</style>
