<script lang="ts">
  import { tick } from 'svelte'
  import Sheet from '../Sheet.svelte'
  import { limitedInput } from '../../lib/morning/limited-input'
  import { pasteLines, type PasteResult } from '../../lib/principles/logic'
  import { KIND_MAX, SOURCE_MAX } from '../../lib/principles/words'
  import { addInsights, stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { openLayer } from '../../lib/ui/layers.svelte'

  // Blatt „Notizen einfügen“ (Spec M12 §2.5) mit zwei Ansichten, damit die Tastatur nie Vorschau und Knopf verdeckt: „Text“ mit
  // einem schlichten Feld, das nichts kürzt, und der Quelle für alle; „Vorschau“ mit dem Ergebnis von `pasteLines`. Erst
  // „… übernehmen“ schreibt, mit einem `commit`. Der Rohtext steht nur im Zustand dieses Blatts, nie im Speicher.
  /** `added`: Zahl der übernommenen Erkenntnisse, 0 beim Abbrechen. */
  let { onClose }: { onClose: (added: number) => void } = $props()

  const id = $props.id()

  let view = $state<'text' | 'preview'>('text')
  let text = $state('')
  let source = $state('')
  let result = $state<PasteResult | null>(null)
  let showButton = $state<HTMLButtonElement>()
  let previewHeading = $state<HTMLElement>()

  // Eine Sperre für „Vorschau zeigen“, „… übernehmen“, „Zurück zum Text“ und das Danebentippen, neu bei jedem Wechsel der
  // Ansicht: Der Hauptknopf der Vorschau kann dort liegen, wo eben „Vorschau zeigen“ lag (Spec M12 §2.10). Sie sperrt nur
  // Tipps; die Knöpfe bleiben fokussierbar.
  const arming = tapArming(() => view)

  // Für die Zurück-Geste ist die Vorschau eine eigene Ebene, genau solange sie zu sehen ist: Beim Wechsel zum Text und beim
  // Abbau des Blatts gibt die Schließ-Funktion ihren History-Eintrag frei.
  $effect(() => {
    if (view === 'preview') return openLayer(() => toText())
  })

  const sourceCount = $derived(Array.from(source).length)
  const shownSource = $derived(source.trim())

  // „Return“ in der Quelle schließt die Tastatur und gibt den Fokus an das Blatt, damit Escape weiter dort ankommt.
  function focusDialog() {
    document.activeElement?.closest<HTMLElement>('[role="dialog"]')?.focus()
  }

  // Der Fokus wechselt nach `tick()`, mit `.then` statt `await` (siehe `restoreFocus` in `CollectionSheet`).
  function showPreview() {
    if (!arming.armed || text.trim() === '') return
    const collection = stats.data.collection ?? []
    const insights = collection.filter((item) => item.kind === 'erkenntnis').length
    result = pasteLines(text, collection, Math.max(0, KIND_MAX.erkenntnis - insights))
    view = 'preview'
    void tick().then(() => previewHeading?.focus())
  }

  /** Zur Textansicht: Text und Quelle bleiben, der Fokus geht an „Vorschau zeigen“, nicht ins Feld. */
  function toText() {
    view = 'text'
    void tick().then(() => showButton?.focus())
  }

  // Escape und Danebentippen: in der Vorschau zum Text, sonst schließt das Blatt ohne zu speichern.
  function back() {
    if (view === 'preview') toText()
    else onClose(0)
  }

  function backToText() {
    if (arming.armed) toText()
  }

  function adopt() {
    if (!arming.armed || !result || result.lines.length === 0) return
    addInsights(
      result.lines.map((line) => line.text),
      source,
    )
    onClose(result.lines.length)
  }

  const newLine = (n: number) => (n === 0 ? 'Keine neue Erkenntnis dabei.' : n === 1 ? '1 neue Erkenntnis' : `${n} neue Erkenntnisse`)
  const overflowLine = (n: number) =>
    n === 1 ? '1 passt nicht mehr (höchstens 300 Erkenntnisse).' : `${n} passen nicht mehr (höchstens 300 Erkenntnisse).`
  const adoptLabel = (n: number) => (n === 1 ? '1 Erkenntnis übernehmen' : `${n} Erkenntnisse übernehmen`)
</script>

<Sheet title="Notizen einfügen" rearm={() => view} onClose={back}>
  {#if view === 'text' || !result}
    <p class="intro">Kopiere Text aus deiner Notiz-App und füge ihn hier ein. Jede Zeile wird eine Erkenntnis. Alles bleibt auf diesem Gerät.</p>

    <div class="field">
      <label for="{id}-notes">Deine Notizen</label>
      <!-- Bewusst ohne `limitedInput` und ohne `maxlength`: Die Zeilenumbrüche bleiben, beim Einfügen wird nichts gekürzt. -->
      <textarea id="{id}-notes" class="notes" rows="6" autocomplete="off" autocapitalize="sentences" placeholder="Eine Erkenntnis pro Zeile" bind:value={text}
      ></textarea>
    </div>

    <div class="field">
      <label for="{id}-source">Quelle für alle (freiwillig)</label>
      <input
        id="{id}-source"
        type="text"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        placeholder="z. B. Buchtitel, Autorin"
        aria-describedby="{id}-source-count"
        value={source}
        use:limitedInput={{ max: SOURCE_MAX, onChange: (value) => (source = value), onEnter: focusDialog }}
      />
      <p class="count" id="{id}-source-count">{sourceCount} / {SOURCE_MAX}</p>
    </div>

    <button type="button" class="button" bind:this={showButton} disabled={text.trim() === ''} onclick={showPreview}>Vorschau zeigen</button>
  {:else}
    <h3 tabindex="-1" bind:this={previewHeading}>Vorschau</h3>

    <div class="summary">
      <p class="total">{newLine(result.lines.length)}</p>
      {#if result.duplicates > 0}
        <p>{result.duplicates} doppelt oder schon vorhanden, übersprungen.</p>
      {/if}
      {#if result.clipped > 0}
        <p>{result.clipped} gekürzt auf 500 Zeichen.</p>
      {/if}
      {#if result.overflow > 0}
        <p>{overflowLine(result.overflow)}</p>
      {/if}
      {#if result.truncated}
        <p>Der Text ist sehr lang. Verwendet werden die ersten 50 000 Zeichen.</p>
      {/if}
      {#if shownSource}
        <p>Quelle: {shownSource}</p>
      {/if}
    </div>

    <div class="actions">
      {#if result.lines.length > 0}
        <button type="button" class="button" onclick={adopt}>{adoptLabel(result.lines.length)}</button>
      {/if}
      <button type="button" class="button-line" onclick={backToText}>Zurück zum Text</button>
    </div>

    {#if result.lines.length > 0}
      <ol class="lines">
        {#each result.lines as line, index (index)}
          <li>
            {line.text}{#if line.clipped}
              <span class="mark">gekürzt</span>{/if}
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</Sheet>

<style>
  .intro {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  input,
  textarea {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
  }

  textarea {
    padding: 14px 16px;
    line-height: 1.45;
    resize: vertical;
    overflow-wrap: anywhere;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-muted);
  }

  .count {
    align-self: flex-end;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  /* schmal wie der Text, damit der Fokusring die Überschrift umschließt statt die ganze Zeile */
  h3 {
    align-self: flex-start;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.125rem;
    font-weight: 400;
    line-height: 1.3;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .summary .total {
    color: var(--text);
    font-weight: 700;
  }

  /* Übernehmen und Zurück teilen sich die Zeile und rutschen untereinander, wenn es eng wird. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions > * {
    flex: 1 1 9rem;
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding-left: 1.6em;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .mark {
    display: inline-block;
    margin-left: 6px;
    padding: 0 8px;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
  }
</style>
