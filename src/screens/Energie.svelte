<script lang="ts">
  import AkkuCard from '../components/energy/AkkuCard.svelte'
  import HackLibrary from '../components/energy/HackLibrary.svelte'
  import ResetCard from '../components/energy/ResetCard.svelte'
  import { headerLine } from '../lib/energy/insights'
  import { stats } from '../lib/stats/store.svelte'

  // Kopfzeile wie die Karte: die Zeit beim Berechnen, neu bei jeder Änderung der Daten (wie auf „Heute“ und „Ich“).
  const line = $derived(headerLine(stats.data.energyCheckins ?? [], new Date()))
</script>

<section class="screen">
  <header>
    <h1>Energie</h1>
    <p class="lead">{line}</p>
  </header>

  <AkkuCard />
  <ResetCard />
  <HackLibrary />
</section>
