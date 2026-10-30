<script lang="ts">
  import { limitedInput } from '../../lib/morning/limited-input'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { eveningUi, nextEveningStep } from '../../lib/ui/evening-ui.svelte'

  // Ein Satz als Schritt des Abend-Logbuchs (Spec M11 §2.3): „Gelernt“ (Schritt 5) und „1 % besser“ (Schritt 6). Das Feld
  // trägt die Frage der Überschrift als Namen. Gezählt und gekürzt wird nach Unicode-Zeichen; ein Zeilenumbruch wird zum
  // Leerzeichen, „Return“ schließt nur die Tastatur (das alles tut `limitedInput`).
  let {
    field,
    kicker,
    title,
    lead,
    placeholder,
    max,
  }: { field: 'learned' | 'better'; kicker: string; title: string; lead: string; placeholder: string; max: number } = $props()

  const id = $props.id()
  const arming = tapArming()
  const count = $derived(Array.from(eveningUi.draft[field]).length)
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">{kicker}</p>
      <h2 class="title" id="{id}-title" tabindex="-1" data-step-title>{title}</h2>
      <p class="lead">{lead}</p>
    </header>

    <div class="field">
      <textarea
        rows="3"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        aria-labelledby="{id}-title"
        aria-describedby="{id}-count"
        {placeholder}
        value={eveningUi.draft[field]}
        use:limitedInput={{ max, onChange: (value) => (eveningUi.draft[field] = value) }}
      ></textarea>
      <p class="count" id="{id}-count">{count} / {max}</p>
    </div>
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={nextEveningStep}>Weiter</button>
  </div>
</div>
