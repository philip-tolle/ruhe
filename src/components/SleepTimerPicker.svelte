<script lang="ts">
  import { engine } from '../lib/audio/engine'
  import { audio } from '../lib/audio/engine-store.svelte'
  import { SLEEP_OPTIONS } from '../lib/audio/sleep-timer'

  const selected = $derived(SLEEP_OPTIONS.indexOf(audio.snap.sleepMinutes))

  const label = (minutes: number | null) => (minutes === null ? 'Endlos' : `${minutes} Min`)

  // Pfeiltasten wählen wie bei einer Radiogruppe und bewegen den Fokus mit.
  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) {
    const last = SLEEP_OPTIONS.length - 1
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
    engine.setSleepTimer(SLEEP_OPTIONS[next])
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

<div class="picker" role="radiogroup" aria-label="Sleep-Timer">
  {#each SLEEP_OPTIONS as minutes, index (minutes)}
    {@const checked = index === selected}
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabindex={checked || (selected === -1 && index === 0) ? 0 : -1}
      onclick={() => engine.setSleepTimer(minutes)}
      onkeydown={(event) => onKeydown(event, index)}
    >
      {label(minutes)}
    </button>
  {/each}
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  button {
    min-height: 48px;
    padding: 0 12px;
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
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 22%, transparent);
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
