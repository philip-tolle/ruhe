<script lang="ts">
  import TagPicker from './TagPicker.svelte'
  import { chosenLine, ownTags } from '../../lib/evening/logic'
  import { tagsOf, type TagSide } from '../../lib/evening/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { eveningUi, nextEveningStep } from '../../lib/ui/evening-ui.svelte'

  // „Energie-Bilanz“ (Spec M11 §2.3, Schritte 2 und 3): was heute Energie gegeben bzw. gekostet hat, als Mehrfachwahl aus
  // Stichworten. Die Zeile über „Weiter“ zählt die Wahl; sie ändert sich nur beim Antippen und wird dann angesagt.
  let { side }: { side: TagSide } = $props()

  const arming = tapArming()
  const own = $derived(ownTags(stats.data.evenings ?? [], side))
  const selected = $derived(eveningUi.draft[side])
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Energie-Bilanz</p>
      <h2 class="title" tabindex="-1" data-step-title>
        {side === 'gave' ? 'Was hat dir heute Energie gegeben?' : 'Was hat dich heute Energie gekostet?'}
      </h2>
      <p class="lead">Tipp alles an, was passt.</p>
    </header>

    <TagPicker {own} tags={tagsOf(side)} {selected} onChange={(next) => (eveningUi.draft[side] = next)} />
  </div>

  <div class="foot">
    <p class="summary" aria-live="polite">{chosenLine(selected.length)}</p>
    <button type="button" class="button" disabled={!arming.armed} onclick={nextEveningStep}>Weiter</button>
  </div>
</div>
