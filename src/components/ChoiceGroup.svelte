<script lang="ts" generics="T">
  // Auswahl als Radiogruppe aus Chips, wie der Sleep-Timer im Klänge-Reiter.
  let {
    label,
    options,
    value,
    onSelect,
  }: {
    label: string
    options: readonly { value: T; label: string }[]
    value: T
    onSelect: (value: T) => void
  } = $props()

  const selected = $derived(options.findIndex((option) => option.value === value))

  // Pfeiltasten wählen wie bei einer Radiogruppe und bewegen den Fokus mit.
  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) {
    const last = options.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index === last ? 0 : index + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index === 0 ? last : index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    onSelect(options[next].value)
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

<div class="choices" role="radiogroup" aria-label={label}>
  {#each options as option, index (index)}
    {@const checked = index === selected}
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabindex={checked || (selected === -1 && index === 0) ? 0 : -1}
      onclick={() => onSelect(option.value)}
      onkeydown={(event) => onKeydown(event, index)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  /* Chips füllen ihre Zeile; was nicht mehr passt, rutscht in die nächste. */
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  button {
    flex: 1 1 auto;
    min-width: 5.5rem;
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
  }

  button[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
    box-shadow: 0 0 24px rgb(242 201 138 / 0.22);
  }

  @media (prefers-reduced-motion: no-preference) {
    button {
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        color 0.25s ease,
        box-shadow 0.3s ease;
    }
  }
</style>
