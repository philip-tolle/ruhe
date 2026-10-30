<script lang="ts">
  import MiniPlayer from './components/MiniPlayer.svelte'
  import Sky from './components/Sky.svelte'
  import TabBar from './components/TabBar.svelte'
  import UpdateToast from './components/UpdateToast.svelte'
  import CheckInSheet from './components/energy/CheckInSheet.svelte'
  import HackCard from './components/energy/HackCard.svelte'
  import MorningFlow from './components/morning/MorningFlow.svelte'
  import EveningFlow from './components/evening/EveningFlow.svelte'
  import BreathPlayer from './components/player/BreathPlayer.svelte'
  import GuidedPlayer from './components/player/GuidedPlayer.svelte'
  import HackPlayer from './components/player/HackPlayer.svelte'
  import SprintPlayer from './components/player/SprintPlayer.svelte'
  import TimerPlayer from './components/player/TimerPlayer.svelte'
  import Heute from './screens/Heute.svelte'
  import Energie from './screens/Energie.svelte'
  import Meditieren from './screens/Meditieren.svelte'
  import Atmen from './screens/Atmen.svelte'
  import Klaenge from './screens/Klaenge.svelte'
  import Ich from './screens/Ich.svelte'
  import { audio } from './lib/audio/engine-store.svelte'
  import { hackById } from './lib/energy/hacks'
  import { pwa } from './lib/pwa/update.svelte'
  import { closeCheckIn, closeHackCard, energyUi } from './lib/ui/energy-ui.svelte'
  import { morningUi } from './lib/ui/morning-ui.svelte'
  import { eveningUi } from './lib/ui/evening-ui.svelte'
  import { anyPlayerOpen, playerOpen } from './lib/ui/player-state'
  import { sessionUi } from './lib/ui/session-ui.svelte'
  import type { TabId } from './lib/ui/tabs'

  let tab = $state<TabId>('heute')

  const program = $derived(audio.snap.program)

  // Vollbild-Player von Timer, Atemübung, Brain Hack, Fokus-Sprint und geführter Meditation: Laufansicht, solange die
  // Sitzung läuft; danach ihr Abschluss, solange er offen ist (die End-Schalen klingen dabei noch aus).
  // Darunter ist die App unerreichbar; ebenso unter dem Morgen-Start, der selbst an der Wurzel hängt (s. u.).
  const timerPlayerVisible = $derived(playerOpen('timer'))
  const breathPlayerVisible = $derived(playerOpen('breath'))
  const hackPlayerVisible = $derived(playerOpen('hack'))
  const sprintPlayerVisible = $derived(playerOpen('focus'))
  const guidedPlayerVisible = $derived(playerOpen('guided'))
  const appInert = $derived(anyPlayerOpen() || morningUi.open || eveningUi.open)

  // Der Hack, dessen Karte offen ist; eine unbekannte Kennung zeigt keine.
  const cardHack = $derived(energyUi.hackCard ? hackById(energyUi.hackCard) : null)

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

  // Ein Reiterwechsel schließt, was zum Reiter davor gehörte: das Check-in-Blatt und die Hack-Karte.
  function onNavigate(next: TabId) {
    closeCheckIn()
    closeHackCard()
    tab = next
    window.scrollTo(0, 0)
  }
</script>

<Sky />

<div inert={appInert}>
  <main class:with-player-bar={playbackBarVisible}>
    {#if tab === 'heute'}
      <Heute {onNavigate} />
    {:else if tab === 'energie'}
      <Energie />
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

<!-- Der Morgen-Start (Vollbild) steht vor den Playern im Dokument: Übung und Meditation des Ablaufs öffnen ihren Player
     auf derselben Ebene, und der liegt dann darüber. Der Ablauf bleibt dabei eingehängt, nur verborgen (`hidden`, `inert`):
     So liegt seine Ebene im Stapel der Zurück-Geste unter der des Players. Außerhalb von `inert`, wie die Player. Das
     Abend-Logbuch (Vollbild, Spec M11) startet keinen Player. -->
{#if morningUi.open}
  <MorningFlow />
{/if}
{#if eveningUi.open}
  <EveningFlow />
{/if}

{#if timerPlayerVisible}
  <TimerPlayer />
{/if}

{#if breathPlayerVisible}
  <BreathPlayer />
{/if}

{#if hackPlayerVisible}
  <HackPlayer />
{/if}

{#if sprintPlayerVisible}
  <SprintPlayer />
{/if}

{#if guidedPlayerVisible}
  <GuidedPlayer />
{/if}

<!-- An der Wurzel, nicht in `inert`: Das Blatt gehört keinem Reiter und lässt sich auch von „Heute“ und aus den
     Playern öffnen. Nur bei offenem Blatt eingehängt, damit jedes Öffnen mit leeren Zeilen beginnt. -->
{#if energyUi.checkInOpen}
  <CheckInSheet />
{/if}

<!-- Ebenso die Hack-Karte: Sie öffnet sich von „Energie“ aus (Jetzt-Reset, Bibliothek) und schließt beim Reiterwechsel. -->
{#if cardHack}
  <HackCard hack={cardHack} {onNavigate} />
{/if}
