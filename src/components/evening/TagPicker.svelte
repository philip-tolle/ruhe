<script lang="ts">
  import { tick } from 'svelte'
  import { TAG_MAX, TAGS_MAX } from '../../lib/evening/words'
  import { limitedInput } from '../../lib/morning/limited-input'

  // Die Stichwort-Auswahl der Energie-Bilanz (Spec M11 §2.3, Geber und Räuber): eine Mehrfachwahl aus Umschaltern.
  // - „Deine Stichworte“ (nur wenn es welche gibt): die eigenen aus früheren Abenden, davor die eben hinzugefügten.
  // - „Vorschläge“: die zwölf Stichworte der Seite, dahinter „+ Eigenes“.
  // - „+ Eigenes“ öffnet ein Feld; „Hinzufügen“ oder Return nimmt das Wort auf und wählt es. Gleicht es einem sichtbaren
  //   Stichwort (Groß- und Kleinschreibung egal), wird dieses gewählt, es entsteht kein Doppel.
  // - Höchstens `TAGS_MAX` gewählte: Dann sind übrige Stichworte und „+ Eigenes“ gesperrt, gewählte lassen sich abwählen.
  // Die Auswahl hält der Ablauf (`selected`, `onChange`); hier steht nur das offene Feld.
  let {
    own,
    tags,
    selected,
    onChange,
  }: {
    own: readonly string[]
    tags: readonly string[]
    selected: readonly string[]
    onChange: (selected: string[]) => void
  } = $props()

  const id = $props.id()
  const key = (tag: string) => tag.toLowerCase()

  // Eben hinzugefügte Stichworte (weder in den Vorschlägen noch unter den gespeicherten eigenen) stehen vorn, das jüngste
  // zuerst. Die Auswahl merkt sie sich selbst (`added`), damit ein abgewähltes an seiner Stelle stehen bleibt; dazu kommen
  // gewählte unbekannte, die schon vor dem Einblenden gewählt waren.
  let added = $state<string[]>([])
  const ownShown = $derived.by(() => {
    const known = new Set([...tags, ...own].map(key))
    const fresh = [...selected, ...added].filter((t) => !known.has(key(t))).reverse()
    const seen = new Set<string>()
    return [...fresh, ...own].filter((t) => !seen.has(key(t)) && (seen.add(key(t)), true))
  })
  const chosen = $derived(new Set(selected.map(key)))
  const full = $derived(selected.length >= TAGS_MAX)

  let adding = $state(false)
  let typed = $state('')
  let input = $state<HTMLInputElement>()
  let addButton = $state<HTMLButtonElement>()

  function toggle(tag: string) {
    if (chosen.has(key(tag))) onChange(selected.filter((t) => key(t) !== key(tag)))
    else if (!full) onChange([...selected, tag])
  }

  async function startAdding() {
    adding = true
    typed = ''
    await tick()
    input?.focus()
  }

  async function add() {
    const word = typed.trim()
    if (word === '') return
    const visible = [...ownShown, ...tags].find((t) => key(t) === key(word))
    const tag = visible ?? word
    if (!visible) added = [...added, word]
    if (!chosen.has(key(tag)) && !full) onChange([...selected, tag])
    adding = false
    typed = ''
    await tick()
    addButton?.focus()
  }
</script>

{#snippet chip(tag: string)}
  {@const on = chosen.has(key(tag))}
  <button type="button" class="chip" aria-pressed={on} disabled={!on && full} onclick={() => toggle(tag)}>
    {#if on}
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    {/if}
    {tag}
  </button>
{/snippet}

<div class="picker">
  {#if ownShown.length > 0}
    <div class="group-wrap">
      <p class="group-label" aria-hidden="true">Deine Stichworte</p>
      <div class="chips" role="group" aria-label="Deine Stichworte">
        {#each ownShown as tag (key(tag))}
          {@render chip(tag)}
        {/each}
      </div>
    </div>
  {/if}

  <div class="group-wrap">
    <p class="group-label" aria-hidden="true">Vorschläge</p>
    <div class="chips" role="group" aria-label="Vorschläge">
      {#each tags as tag (key(tag))}
        {@render chip(tag)}
      {/each}
      {#if !adding}
        <button type="button" class="chip add" disabled={full} bind:this={addButton} onclick={startAdding}>+ Eigenes</button>
      {/if}
    </div>
  </div>

  {#if adding}
    <div class="field">
      <label for="{id}-own">Eigenes Stichwort</label>
      <div class="row">
        <input
          id="{id}-own"
          type="text"
          autocomplete="off"
          autocapitalize="sentences"
          enterkeyhint="done"
          value={typed}
          bind:this={input}
          use:limitedInput={{ max: TAG_MAX, onChange: (v) => (typed = v), onEnter: add }}
        />
        <button type="button" class="button-line confirm" onclick={add}>Hinzufügen</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .group-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-label {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* Wie die Wortwahl (`WordPicker`): deckende, leicht getönte Fläche; ein langes Wort ohne Leerzeichen bricht im Chip um. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    padding: 8px 18px;
    border: 1px solid var(--surface-border);
    border-radius: 24px;
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--accent) 8%, var(--sky-mid));
    color: var(--text);
    font-weight: 600;
    line-height: 1.25;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .chip svg {
    flex: none;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .chip.add {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--accent) 70%, transparent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  input {
    flex: 1 1 12rem;
    min-width: 0;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
  }

  .confirm {
    flex: none;
    min-height: 52px;
    padding: 0 18px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .chip {
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        color 0.25s ease,
        box-shadow 0.3s ease;
    }
  }
</style>
