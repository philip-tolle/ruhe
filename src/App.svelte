<script lang="ts">
  import MiniPlayer from './components/MiniPlayer.svelte'
  import Sky from './components/Sky.svelte'
  import TabBar from './components/TabBar.svelte'
  import Heute from './screens/Heute.svelte'
  import Meditieren from './screens/Meditieren.svelte'
  import Atmen from './screens/Atmen.svelte'
  import Klaenge from './screens/Klaenge.svelte'
  import Ich from './screens/Ich.svelte'
  import { audio } from './lib/audio/engine-store.svelte'
  import type { TabId } from './lib/ui/tabs'

  let tab = $state<TabId>('heute')

  // Der Mini-Player erscheint, solange Klänge laufen oder pausiert sind – außer im Klänge-Reiter selbst.
  const miniPlayerVisible = $derived(audio.snap.state !== 'idle' && tab !== 'klaenge')

  function onNavigate(next: TabId) {
    tab = next
    window.scrollTo(0, 0)
  }
</script>

<Sky />

<main class:with-mini-player={miniPlayerVisible}>
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

{#if miniPlayerVisible}
  <MiniPlayer {onNavigate} />
{/if}

<TabBar {tab} {onNavigate} />
