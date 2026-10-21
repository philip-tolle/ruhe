<script lang="ts">
  import MiniPlayer from './components/MiniPlayer.svelte'
  import Sky from './components/Sky.svelte'
  import TabBar from './components/TabBar.svelte'
  import UpdateToast from './components/UpdateToast.svelte'
  import TimerPlayer from './components/player/TimerPlayer.svelte'
  import Heute from './screens/Heute.svelte'
  import Meditieren from './screens/Meditieren.svelte'
  import Atmen from './screens/Atmen.svelte'
  import Klaenge from './screens/Klaenge.svelte'
  import Ich from './screens/Ich.svelte'
  import { audio } from './lib/audio/engine-store.svelte'
  import { pwa } from './lib/pwa/update.svelte'
  import { sessionUi } from './lib/ui/session-ui.svelte'
  import type { TabId } from './lib/ui/tabs'

  let tab = $state<TabId>('heute')

  const program = $derived(audio.snap.program)

  // Vollbild-Player des Timers: Laufansicht, solange der Timer läuft; danach sein Abschluss, solange
  // er offen ist (die End-Schalen klingen dabei noch aus). Darunter ist die App unerreichbar.
  const timerPlayerVisible = $derived(
    (program?.kind === 'timer' && !program.ended) || sessionUi.done?.kind === 'timer',
  )

  // Solange Klänge laufen oder pausiert sind, liegt über der Reiterleiste eine Wiedergabeleiste:
  // im Klänge-Reiter dessen eigene Steuerung, sonst der Mini-Player (nur ohne Programm; ein Programm
  // hat seinen Player). `main` hält ihr den Platz frei.
  const sessionActive = $derived(audio.snap.state !== 'idle')
  const miniPlayerVisible = $derived(sessionActive && tab !== 'klaenge' && program === null)
  const playbackBarVisible = $derived(miniPlayerVisible || (sessionActive && tab === 'klaenge'))

  // Neue Version: Der Hinweis erscheint nur im Leerlauf, damit er eine laufende Sitzung nie stört,
  // auch nicht ihren Abschluss.
  const updateToastVisible = $derived(
    pwa.needRefresh && audio.snap.state === 'idle' && program === null && sessionUi.done === null,
  )

  function onNavigate(next: TabId) {
    tab = next
    window.scrollTo(0, 0)
  }
</script>

<Sky />

<div inert={timerPlayerVisible}>
  <main class:with-player-bar={playbackBarVisible}>
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

  {#if updateToastVisible}
    <UpdateToast />
  {/if}

  <TabBar {tab} {onNavigate} />
</div>

{#if timerPlayerVisible}
  <TimerPlayer />
{/if}
