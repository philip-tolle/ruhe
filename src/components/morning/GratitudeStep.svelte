<script lang="ts">
  import WordPicker from './WordPicker.svelte'
  import { ownValues } from '../../lib/morning/logic'
  import { limitedInput } from '../../lib/morning/limited-input'
  import { GRATITUDE_MAX, VALUES, VALUE_MAX } from '../../lib/morning/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningUi, nextStep } from '../../lib/ui/morning-ui.svelte'

  // „Dankbarkeit“ (Spec M10 §2.3): ein Satz, höchstens 120 Zeichen. Im langen Ablauf kommt darunter der Wert des Tages:
  // zwölf Werte zur Wahl, eigene aus früheren Durchgängen und ein freies Feld (dieselbe Wahl wie bei der Intention).
  // Gezählt und gekürzt wird nach Unicode-Zeichen, nicht nach UTF-16-Einheiten; ein Zeilenumbruch wird zum Leerzeichen, und
  // „Return“ schließt nur die Tastatur (das alles tut `limitedInput`, wie bei den anderen Eingaben des Ablaufs).
  const id = $props.id()
  const arming = tapArming()

  const lang = $derived(morningUi.variant === 'lang')
  const own = $derived(ownValues(stats.data.mornings ?? []))
  const count = $derived(Array.from(morningUi.draft.gratitude).length)
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Dankbarkeit</p>
      <h2 class="title" tabindex="-1" data-step-title>Wofür bist du heute dankbar?</h2>
    </header>

    <div class="field">
      <label for="{id}-gratitude">Dein Satz</label>
      <textarea
        id="{id}-gratitude"
        rows="3"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        placeholder="z. B. ein Mensch, ein Moment, etwas Kleines"
        aria-describedby="{id}-count"
        value={morningUi.draft.gratitude}
        use:limitedInput={{ max: GRATITUDE_MAX, onChange: (value) => (morningUi.draft.gratitude = value) }}
      ></textarea>
      <p class="count" id="{id}-count">{count} / {GRATITUDE_MAX}</p>
    </div>

    {#if lang}
      <h3 class="sub">Welcher Wert trägt dich heute?</h3>
      <WordPicker
        label="Werte"
        words={VALUES}
        ownLabel="Deine Werte"
        {own}
        fieldLabel="Eigener Wert"
        placeholder="z. B. Zuversicht"
        max={VALUE_MAX}
        capitalize="sentences"
        value={morningUi.draft.value}
        onChange={(value) => (morningUi.draft.value = value)}
      />
    {/if}
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={nextStep}>Weiter</button>
  </div>
</div>

<style>
  .sub {
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.3;
  }
</style>
