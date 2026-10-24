<script lang="ts">
  import { CALM_LEVELS } from '../../lib/stats/calm'
  import type { CalmLevel } from '../../lib/stats/schema'
  import { setCalm, stats } from '../../lib/stats/store.svelte'

  // Ruhe-Check-in auf dem Abschluss (Spec M6 §3): zwei Reihen „Vorher“ und „Jetzt“ mit je fünf Punkten.
  // Ein Tipp speichert sofort, ein anderer Punkt ändert, derselbe nimmt zurück. Die Werte stehen an
  // der gespeicherten Sitzung; die Karte liest sie von dort, darum zeigt sie immer den Stand im Store.
  let { sessionId }: { sessionId: string } = $props()

  type Which = 'before' | 'after'

  const calm = $derived(stats.data.sessions.find((s) => s.id === sessionId)?.calm)

  function choose(which: Which, level: CalmLevel) {
    setCalm(sessionId, which, calm?.[which] === level ? null : level)
  }

  // Pfeiltasten, Pos1 und Ende wählen wie in einer Radiogruppe und nehmen den Fokus mit (wie `ChoiceGroup`).
  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, which: Which, index: number) {
    const last = CALM_LEVELS.length - 1
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
    setCalm(sessionId, which, CALM_LEVELS[next].level)
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

{#snippet row(which: Which, label: string)}
  {@const value = calm?.[which]}
  <div class="calm-row">
    <p class="head">
      <span class="label">{label}</span>
      <span class="word" aria-hidden="true">{CALM_LEVELS.find((l) => l.level === value)?.word ?? ''}</span>
    </p>
    <div class="dots" role="radiogroup" aria-label={label}>
      {#each CALM_LEVELS as { level, word, color }, index (level)}
        {@const checked = value === level}
        <button
          type="button"
          role="radio"
          aria-checked={checked}
          aria-label={word}
          tabindex={checked || (value === undefined && index === 0) ? 0 : -1}
          class="dot"
          class:checked
          style:--dot={color}
          onclick={() => choose(which, level)}
          onkeydown={(event) => onKeydown(event, which, index)}
        >
          <i></i>
        </button>
      {/each}
    </div>
    <p class="ends" aria-hidden="true"><span>sehr unruhig</span><span>ganz ruhig</span></p>
  </div>
{/snippet}

<div class="card checkin">
  <p class="ask">Magst du festhalten, wie ruhig du bist?</p>
  {@render row('before', 'Vorher')}
  {@render row('after', 'Jetzt')}
</div>

<style>
  .checkin {
    width: 100%;
    gap: 14px;
    padding: 18px 16px 16px;
    border-radius: 24px;
    text-align: left;
  }

  .ask {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.35;
  }

  /* Jede Reihe über einer feinen Goldlinie, wie die Zeilen der Einstellungen. */
  .calm-row {
    width: 100%;
    padding-top: 12px;
    border-top: 1px solid var(--gold-line);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    margin: 0 0 10px;
    font-size: 0.9375rem;
  }

  .label {
    font-weight: 700;
  }

  .word {
    color: var(--accent);
    font-weight: 600;
  }

  .dots {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }

  /* Tippfläche 48 px; innen ein Farbpunkt, ungewählt klein und halb deckend, gewählt größer, voll und mit Goldring. */
  .dot {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1.5px solid rgb(238 240 250 / 0.22);
    border-radius: 50%;
    background: transparent;
  }

  .dot i {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--dot);
    opacity: 0.55;
  }

  .dot.checked {
    border-color: var(--gold-line-strong);
    box-shadow: 0 0 0 3px rgb(242 201 138 / 0.18);
  }

  .dot.checked i {
    width: 30px;
    height: 30px;
    opacity: 1;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .dot i {
      transition:
        width 0.2s ease,
        height 0.2s ease,
        opacity 0.2s ease;
    }
  }
</style>
