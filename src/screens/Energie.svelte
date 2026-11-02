<script lang="ts">
  import AkkuCard from '../components/energy/AkkuCard.svelte'
  import HackLibrary from '../components/energy/HackLibrary.svelte'
  import ResetCard from '../components/energy/ResetCard.svelte'
  import SprintCard from '../components/energy/SprintCard.svelte'
  import WeekCard from '../components/energy/WeekCard.svelte'
  import MorningStartCard from '../components/morning/MorningStartCard.svelte'
  import EveningStartCard from '../components/evening/EveningStartCard.svelte'
  import CollectionSheet from '../components/principles/CollectionSheet.svelte'
  import PrinciplesCard from '../components/principles/PrinciplesCard.svelte'
  import { headerLine } from '../lib/energy/insights'
  import { stats } from '../lib/stats/store.svelte'
  import { appNow } from '../lib/ui/tageszeit.svelte'

  // Kopfzeile wie die Karte: die Zeit der App (`appNow`), neu bei jeder Änderung der Daten, mit jeder vollen Minute
  // und bei der Rückkehr in die App.
  const line = $derived(headerLine(stats.data.energyCheckins ?? [], appNow()))

  // Das Blatt „Deine Sammlung“ (Spec M12 §2.3) hängt am Reiter, wie der Editor eigener Muster unter „Atmen“.
  let collection = $state(false)
</script>

<section class="screen">
  <header>
    <h1>Energie</h1>
    <p class="lead">{line}</p>
  </header>

  <MorningStartCard />
  <EveningStartCard />
  <AkkuCard />
  <ResetCard />
  <SprintCard />
  <PrinciplesCard open={collection} onOpen={() => (collection = true)} />
  <HackLibrary />
  <WeekCard />
</section>

<!-- Außerhalb von .screen, dessen Einblend-Animation sonst den Bezugsrahmen für `fixed` stellte. -->
{#if collection}
  <CollectionSheet onClose={() => (collection = false)} />
{/if}
