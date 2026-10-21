<script lang="ts">
  import Sky from './components/Sky.svelte'
  import TabBar from './components/TabBar.svelte'
  import Heute from './screens/Heute.svelte'
  import Meditieren from './screens/Meditieren.svelte'
  import Atmen from './screens/Atmen.svelte'
  import Klaenge from './screens/Klaenge.svelte'
  import Ich from './screens/Ich.svelte'
  import type { TabId } from './lib/ui/tabs'

  let tab = $state<TabId>('heute')

  function onNavigate(next: TabId) {
    tab = next
    window.scrollTo(0, 0)
  }
</script>

<Sky />

<main>
  {#if tab === 'heute'}
    <Heute {onNavigate} />
  {:else if tab === 'meditieren'}
    <Meditieren />
  {:else if tab === 'atmen'}
    <Atmen />
  {:else if tab === 'klaenge'}
    <Klaenge />
  {:else}
    <Ich />
  {/if}
</main>

<TabBar {tab} {onNavigate} />
