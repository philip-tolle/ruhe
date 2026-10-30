<script lang="ts">
  import CheckinStep from '../flow/CheckinStep.svelte'
  import FlowFrame from '../flow/FlowFrame.svelte'
  import EveningDone from './EveningDone.svelte'
  import ReviewStep from './ReviewStep.svelte'
  import TagsStep from './TagsStep.svelte'
  import TextStep from './TextStep.svelte'
  import WeekStep from './WeekStep.svelte'
  import { BETTER_MAX, LEARNED_MAX } from '../../lib/evening/words'
  import { closeEvening, eveningUi, nextEveningStep, skipEveningStep } from '../../lib/ui/evening-ui.svelte'

  // Das Abend-Logbuch im Vollbild (Spec M11 §2.3) im gemeinsamen Rahmen `FlowFrame` (Kopfzeile, Rückfrage, Zurück-Geste,
  // Fokus je Schritt). Jeder Schritt ist eine eigene Komponente und liest und schreibt `eveningUi`; hier steht die Weiche.
  // Hängt an der Wurzel der App, außerhalb von `inert` (App.svelte), solange `eveningUi.open` gilt. Kein Player.
</script>

<FlowFrame
  label="Abend-Logbuch"
  closeLabel="Abend-Logbuch beenden"
  confirmTitle="Abend-Logbuch beenden?"
  steps={eveningUi.steps}
  step={eveningUi.step}
  bind:confirming={eveningUi.confirming}
  onSkip={skipEveningStep}
  onClose={closeEvening}
>
  {#if eveningUi.step === 'checkin'}
    <CheckinStep title="Wie voll sind deine Akkus jetzt?" onSaved={nextEveningStep} />
  {:else if eveningUi.step === 'geber'}
    <TagsStep side="gave" />
  {:else if eveningUi.step === 'raeuber'}
    <TagsStep side="cost" />
  {:else if eveningUi.step === 'rueckblick'}
    <ReviewStep />
  {:else if eveningUi.step === 'gelernt'}
    <TextStep
      field="learned"
      kicker="Gelernt"
      title="Was hast du heute gelernt?"
      lead="Eine Erkenntnis, ein Satz reicht."
      placeholder="z. B. Pausen machen mich schneller."
      max={LEARNED_MAX}
    />
  {:else if eveningUi.step === 'besser'}
    <TextStep
      field="better"
      kicker="Wachstum"
      title="Was machst du morgen 1 % besser?"
      lead="Klein und konkret. Der Morgen-Start erinnert dich daran."
      placeholder="z. B. Erst der Big Domino, dann Mails."
      max={BETTER_MAX}
    />
  {:else if eveningUi.step === 'woche'}
    <WeekStep />
  {:else}
    <EveningDone />
  {/if}
</FlowFrame>
