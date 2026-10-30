<script lang="ts">
  import { morningEntry } from '../../lib/evening/logic'
  import { intentionSentence } from '../../lib/morning/logic'
  import { INTENTION_SCORES, type IntentionScore } from '../../lib/stats/schema'
  import { stats, toggleDomino } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { eveningUi, nextEveningStep } from '../../lib/ui/evening-ui.svelte'

  // „Rückblick“ (Spec M11 §2.3, Schritt 4): was aus dem Morgen geworden ist. Der Big Domino und die Intention kommen aus dem
  // Morgen-Eintrag des Logbuch-Tages; der Haken „Geschafft“ ist derselbe wie auf „Dein Tag“ und wird sofort gespeichert
  // (er liest den Stand aus dem Speicher, nicht aus einer Kopie). Die Stufe der Intention ist eine Radiogruppe; ein zweiter
  // Tipp auf die gewählte Stufe nimmt die Wahl zurück.
  const id = $props.id()
  const arming = tapArming()

  const morning = $derived(morningEntry(stats.data.mornings ?? [], eveningUi.day))
  const score = $derived(eveningUi.draft.intentionScore)

  function pick(level: IntentionScore) {
    eveningUi.draft.intentionScore = score === level ? null : level
  }

  // Pfeiltasten, Pos1 und Ende wählen wie in einer Radiogruppe und nehmen den Fokus mit.
  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) {
    const last = INTENTION_SCORES.length - 1
    const keys: Record<string, number> = { ArrowRight: index === last ? 0 : index + 1, ArrowDown: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, ArrowUp: index === 0 ? last : index - 1, Home: 0, End: last }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    eveningUi.draft.intentionScore = INTENTION_SCORES[next]
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Rückblick</p>
      <h2 class="title" tabindex="-1" data-step-title>Was ist aus deinem Morgen geworden?</h2>
    </header>

    {#if morning?.domino}
      <section class="block" aria-label="Big Domino">
        <p class="block-label">Big Domino</p>
        <p class="text">{morning.domino}</p>
        <button type="button" class="done" aria-pressed={Boolean(morning.dominoDone)} onclick={() => toggleDomino(eveningUi.day)}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
          Geschafft
        </button>
      </section>
    {/if}

    {#if morning?.intention}
      <section class="block" aria-label="Intention">
        <p class="block-label">Intention</p>
        <p class="text">{intentionSentence(morning.intention)}</p>
        <p class="question" id="{id}-question">Wie gut ist es dir gelungen?</p>
        <div class="levels" role="radiogroup" aria-labelledby="{id}-question">
          {#each INTENTION_SCORES as level, index (level)}
            {@const checked = score === level}
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              tabindex={checked || (score === null && index === 0) ? 0 : -1}
              class="level"
              onclick={() => pick(level)}
              onkeydown={(event) => onKeydown(event, index)}
            >
              {level}
            </button>
          {/each}
        </div>
      </section>
    {/if}
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={nextEveningStep}>Weiter</button>
  </div>
</div>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--surface-border);
    border-radius: 18px;
    background: var(--surface);
  }

  .block-label {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .text {
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .question {
    font-size: 0.9375rem;
    font-weight: 600;
  }

  /* „Geschafft“ als Umschalter: umrandet, gesetzt gefüllt mit Haken. */
  .done {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 20px 0 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
    border-radius: 24px;
    background: transparent;
    color: var(--accent);
    font-weight: 700;
  }

  .done svg {
    opacity: 0.35;
  }

  .done[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }

  .done[aria-pressed='true'] svg {
    opacity: 1;
  }

  .levels {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .level {
    min-height: 48px;
    padding: 0 8px;
    border: 1px solid var(--surface-border);
    border-radius: 24px;
    background: color-mix(in srgb, var(--accent) 8%, var(--sky-mid));
    color: var(--text);
    font-weight: 600;
  }

  .level[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
</style>
