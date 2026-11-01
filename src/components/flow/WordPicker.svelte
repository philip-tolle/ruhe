<script lang="ts">
  import { untrack } from 'svelte'
  import { limitedInput } from '../../lib/morning/limited-input'

  // Die Wahl eines Worts in geführten Abläufen (Morgen-Start Spec M10 §2.3, Wochenfokus Spec M11 §2.3): eine Radiogruppe
  // aus Vorschlägen, darunter „Deine Wörter“ (die eigenen aus früheren Durchgängen, nur wenn es welche gibt) und ein freies
  // Feld. Es gilt genau ein Wort, und das steht im Entwurf (`value`):
  // - Ein Tipp auf ein Wort wählt es; derselbe Tipp noch einmal nimmt die Wahl zurück. Eine Wahl leert das Feld.
  // - Tippen im Feld hebt die Wahl auf (das Wort im Feld gilt).
  // Dieselbe Komponente wählt Intention und Wert; sie kennt nur die Beschriftungen und die Längengrenze.
  // Mit `refs` (Prinzipien der Sammlung, Spec M12 §2.6) steht vorn eine eigene Gruppe, und „Vorschläge“ bekommt eine sichtbare
  // Beschriftung. Ein Prinzip ist kein Wort: Es kommt als Kennung über `onRef` zurück und steht in `refValue`; die Seite, die
  // die Komponente zeigt, hält Wort und Prinzip so, dass immer nur eines gilt. Ohne `refs` bleibt alles wie bisher.
  let {
    label,
    words,
    ownLabel,
    own,
    fieldLabel,
    placeholder,
    max,
    capitalize,
    value,
    onChange,
    refLabel = '',
    refs = [],
    refValue = null,
    onRef,
  }: {
    /** Name der Gruppe der Vorschläge, etwa „Vorschläge“. */
    label: string
    words: readonly string[]
    /** Name der Gruppe der eigenen Wörter, etwa „Deine Wörter“. */
    ownLabel: string
    own: readonly string[]
    fieldLabel: string
    placeholder: string
    /** Höchstlänge in Zeichen (Unicode-Zeichen, nicht UTF-16-Einheiten). */
    max: number
    /** Großschreibung der Tastatur: Wörter wie „klar“ klein, Werte wie „Geduld“ groß. */
    capitalize: 'none' | 'sentences'
    value: string
    /** Das gewählte oder getippte Wort; `via` sagt, woher es kommt (ein Tipp auf ein Wort oder das freie Feld). */
    onChange: (value: string, via: 'chip' | 'field') => void
    /** Name der Gruppe der Prinzipien, etwa „Deine Prinzipien“. */
    refLabel?: string
    /** Prinzipien in ihrer Reihenfolge; zwei gleiche Texte (nach einem Import) bleiben zwei Chips. */
    refs?: readonly { id: string; text: string }[]
    /** Die Kennung des gewählten Prinzips oder `null`. */
    refValue?: string | null
    /** Ein Tipp auf ein Prinzip meldet seine Kennung, derselbe Tipp noch einmal `null`. */
    onRef?: (id: string | null) => void
  } = $props()

  const id = $props.id()

  type Item = { key: string; text: string }

  const listed = $derived([...words, ...own])
  const wordItems = $derived(words.map((word): Item => ({ key: word, text: word })))
  const ownItems = $derived(own.map((word): Item => ({ key: word, text: word })))
  const refItems = $derived(refs.map((ref): Item => ({ key: ref.id, text: ref.text })))

  // Was im Feld steht. Beim Einblenden zeigt es den Entwurf, wenn der kein Wort der Gruppen ist (der Entwurf bleibt etwa
  // nach einem Player stehen); sonst ist das Feld leer und das Wort gewählt.
  let typed = $state(untrack(() => (listed.includes(value) ? '' : value)))

  const picked = $derived(typed === '' && listed.includes(value) ? value : null)

  function pick(word: string) {
    typed = ''
    onChange(word === picked ? '' : word, 'chip')
  }

  // Ein Prinzip leert das Feld wie ein Wort; die Seite leert dazu das Wort im Entwurf.
  function pickRef(key: string) {
    typed = ''
    onRef?.(key === refValue ? null : key)
  }

  // Das Feld: `limitedInput` macht aus Zeilenumbrüchen (eingefügter Text) Leerzeichen und kürzt auf `max` Zeichen, ohne zu
  // trimmen (das Leerzeichen zwischen zwei Wörtern muss sich tippen lassen; getrimmt wird beim Speichern). Das Wort im Feld gilt.
  function type(text: string) {
    typed = text
    onChange(text, 'field')
  }

  // Pfeiltasten, Pos1 und Ende wählen wie in einer Radiogruppe und nehmen den Fokus mit (wie `LevelDots`), je Gruppe. Zeigt
  // die Taste auf das gewählte Wort oder Prinzip, bewegt sie nur den Fokus: Ein Tipp nimmt zurück, eine Taste nicht.
  function onKeydown(
    event: KeyboardEvent & { currentTarget: HTMLElement },
    items: readonly Item[],
    index: number,
    selected: string | null,
    choose: (key: string) => void,
  ) {
    const last = items.length - 1
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
    if (items[next].key !== selected) choose(items[next].key)
    event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus()
  }
</script>

<!-- Eine Radiogruppe: Wörter mit dem Wort als Schlüssel, Prinzipien mit ihrer Kennung (gleiche Texte bleiben getrennt). -->
{#snippet group(
  items: readonly Item[],
  selected: string | null,
  choose: (key: string) => void,
  labelAttrs: { 'aria-label'?: string; 'aria-labelledby'?: string },
)}
  <div class="chips" role="radiogroup" {...labelAttrs}>
    {#each items as item, index (item.key)}
      {@const checked = selected === item.key}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        tabindex={checked || (index === 0 && (selected === null || !items.some((i) => i.key === selected))) ? 0 : -1}
        class="chip"
        onclick={() => choose(item.key)}
        onkeydown={(event) => onKeydown(event, items, index, selected, choose)}
      >
        {item.text}
      </button>
    {/each}
  </div>
{/snippet}

<div class="picker">
  {#if refItems.length > 0}
    <div class="own">
      <p class="own-label" id="{id}-refs">{refLabel}</p>
      {@render group(refItems, refValue, pickRef, { 'aria-labelledby': `${id}-refs` })}
    </div>
  {/if}

  {#if wordItems.length > 0}
    {#if refItems.length > 0}
      <div class="own">
        <p class="own-label" id="{id}-words">{label}</p>
        {@render group(wordItems, picked, pick, { 'aria-labelledby': `${id}-words` })}
      </div>
    {:else}
      {@render group(wordItems, picked, pick, { 'aria-label': label })}
    {/if}
  {/if}

  {#if own.length > 0}
    <div class="own">
      <p class="own-label" id="{id}-own">{ownLabel}</p>
      {@render group(ownItems, picked, pick, { 'aria-labelledby': `${id}-own` })}
    </div>
  {/if}

  <div class="field">
    <label for="{id}-field">{fieldLabel}</label>
    <input
      id="{id}-field"
      type="text"
      autocomplete="off"
      autocapitalize={capitalize}
      enterkeyhint="done"
      {placeholder}
      value={typed}
      use:limitedInput={{ max, onChange: type }}
    />
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* Deckende Fläche, leicht im Akzent getönt (wie `ChoiceGroup`): Sonne oder Mond scheinen beim Blättern nicht durch.
     Ein langes Wort ohne Leerzeichen bricht im Chip um, statt ihn über den Rand zu schieben. */
  .chip {
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

  .chip[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .own {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .own-label {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
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

  input {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
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
