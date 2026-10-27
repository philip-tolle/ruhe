<script lang="ts">
  import AkkuCard from '../components/energy/AkkuCard.svelte'
  import HackLibrary from '../components/energy/HackLibrary.svelte'
  import ResetCard from '../components/energy/ResetCard.svelte'
  import SprintCard from '../components/energy/SprintCard.svelte'
  import WeekCard from '../components/energy/WeekCard.svelte'
  import { headerLine } from '../lib/energy/insights'
  import { stats } from '../lib/stats/store.svelte'
  import { appNow } from '../lib/ui/tageszeit.svelte'

  // Kopfzeile wie die Karte: die Zeit der App (`appNow`), neu bei jeder Änderung der Daten, mit jeder vollen Minute
  // und bei der Rückkehr in die App.
  const line = $derived(headerLine(stats.data.energyCheckins ?? [], appNow()))
</script>

<section class="screen">
  <header>
    <h1>Energie</h1>
    <p class="lead">{line}</p>
  </header>

  <AkkuCard />
  <ResetCard />
  <SprintCard />
  <HackLibrary />
  <WeekCard />
</section>
