<script lang="ts">
  import { untrack } from 'svelte'
  import CheckinStep from '../flow/CheckinStep.svelte'
  import FlowFrame from '../flow/FlowFrame.svelte'
  import ActivateStep from './ActivateStep.svelte'
  import DeepenStep from './DeepenStep.svelte'
  import DominoStep from './DominoStep.svelte'
  import GratitudeStep from './GratitudeStep.svelte'
  import IntentionStep from './IntentionStep.svelte'
  import MorningDone from './MorningDone.svelte'
  import type { EnergyArea, EnergyLevel } from '../../lib/energy/areas'
  import { morningSteps } from '../../lib/morning/steps'
  import { closeMorning, morningHidden, morningPlayerClosed, morningUi, nextStep, skipStep } from '../../lib/ui/morning-ui.svelte'

  // Der Morgen-Start im Vollbild (Spec M10 §2.3) im gemeinsamen Rahmen `FlowFrame` (Kopfzeile, Rückfrage, Zurück-Geste,
  // Fokus je Schritt). Jeder Schritt ist eine eigene Komponente und liest und schreibt `morningUi`; hier stehen die Weiche
  // und das Warten auf die Player. Hängt an der Wurzel der App, außerhalb von `inert` (App.svelte), solange
  // `morningUi.open` gilt.

  const steps = $derived(morningSteps(morningUi.variant))

  // Solange ein Player läuft, auf den der Ablauf wartet (Übung, Meditation), ist er verborgen und unerreichbar, aber
  // eingehängt: So bleibt seine Ebene im Stapel der Zurück-Geste unter der des Players.
  const hidden = $derived(morningHidden())

  // Der Check-in liefert den Bereich der Intention und den Vorher-Wert der Übung.
  function onCheckin(levels: Record<EnergyArea, EnergyLevel>) {
    morningUi.checkin = { ...levels }
    nextStep()
  }

  // Der Player, auf den der Ablauf wartet, ist zu: Eine Ende-Ansicht der Übung, die ohne „Weiter“ geschlossen wurde
  // (Zurück-Geste), führt den Ablauf weiter; ein Start, der nie einen Player zeigte, hebt das Warten auf. Ohne dies bliebe
  // der Ablauf verborgen. Der Aufruf schreibt Zustand, den dieser Effekt liest: `untrack`, sonst liefe er in sich selbst.
  $effect(() => {
    if (morningUi.open && morningUi.awaiting !== null && !morningHidden()) untrack(morningPlayerClosed)
  })
</script>

<FlowFrame
  label="Morgen-Start"
  closeLabel="Morgen-Start beenden"
  confirmTitle="Morgen-Start beenden?"
  {steps}
  step={morningUi.step}
  {hidden}
  bind:confirming={morningUi.confirming}
  onSkip={skipStep}
  onClose={closeMorning}
>
  {#if morningUi.step === 'checkin'}
    <CheckinStep title="Wie voll ist dein Akku?" onSaved={onCheckin} />
  {:else if morningUi.step === 'aktivieren'}
    <ActivateStep />
  {:else if morningUi.step === 'vertiefen'}
    <DeepenStep />
  {:else if morningUi.step === 'intention'}
    <IntentionStep />
  {:else if morningUi.step === 'dankbarkeit'}
    <GratitudeStep />
  {:else if morningUi.step === 'domino'}
    <DominoStep />
  {:else}
    <MorningDone />
  {/if}
</FlowFrame>
