<script lang="ts">
  import { AREA_INFO, LEVELS, LEVEL_WORD, type EnergyArea, type EnergyLevel } from '../../lib/energy/areas'

  // Fünf Punkte für die Stufen eines Bereichs (Spec M9 §3.3), eine Radiogruppe wie `CalmCheckIn`: Der Name der
  // Gruppe ist der Bereich, jeder Punkt heißt „Geist: 2 von 5, schwach“ und meldet, ob er gewählt ist. Die Punkte
  // bis zur gewählten Stufe sind gefüllt. Die Komponente meldet nur die Wahl; ob und wie sie gilt (und ob dieselbe
  // Stufe noch einmal etwas bedeutet), entscheidet, wer sie einsetzt. `disabled` sperrt alle Punkte, etwa kurz nach
  // dem Einblenden des Blatts (siehe `tapArming`).
  let {
    area,
    value,
    onPick,
    label,
    disabled = false,
  }: {
    area: EnergyArea
    value: EnergyLevel | null
    onPick: (level: EnergyLevel) => void
    label?: string
    disabled?: boolean
  } = $props()

  const title = $derived(AREA_INFO[area].title)

  // Pfeiltasten, Pos1 und Ende wählen wie in einer Radiogruppe und nehmen den Fokus mit (wie `CalmCheckIn`).
  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) {
    const last = LEVELS.length - 1
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
    onPick(LEVELS[next])
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

<div class="dots" role="radiogroup" aria-label={label ?? title} style:--dot="var(--area-{area})">
  {#each LEVELS as level, index (level)}
    {@const checked = value === level}
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label="{title}: {level} von 5, {LEVEL_WORD[level]}"
      tabindex={checked || (value === null && index === 0) ? 0 : -1}
      {disabled}
      class="dot"
      class:filled={value !== null && level <= value}
      class:checked
      onclick={() => onPick(level)}
      onkeydown={(event) => onKeydown(event, index)}
    >
      <i></i>
    </button>
  {/each}
</div>

<style>
  .dots {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }

  /* Tippfläche 48 px; innen ein Ring in der Bereichsfarbe, bis zur gewählten Stufe gefüllt. Die gewählte Stufe
     trägt zusätzlich den Goldring der Ruhe-Punkte: Die Füllung zeigt den Stand, der Ring die Wahl. */
  .dot {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1.5px solid transparent;
    border-radius: 50%;
    background: transparent;
  }

  .dot i {
    width: 26px;
    height: 26px;
    border: 2px solid var(--dot);
    border-radius: 50%;
    background: transparent;
  }

  .dot.filled i {
    background: var(--dot);
  }

  .dot.checked {
    border-color: var(--gold-line-strong);
    box-shadow: 0 0 0 3px rgb(242 201 138 / 0.18);
  }

  @media (prefers-reduced-motion: no-preference) {
    .dot i {
      transition: background-color 0.2s ease;
    }
  }
</style>
