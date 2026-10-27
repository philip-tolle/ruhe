<script lang="ts">
  import ChoiceGroup from '../ChoiceGroup.svelte'
  import Motiv from '../Motiv.svelte'
  import SoundSelect from '../SoundSelect.svelte'
  import { FOKUS_MOTIV } from '../../lib/content/motive'
  import type { BackgroundId } from '../../lib/sounds/catalog'
  import { clipTask, FOCUS_MINUTES, MAX_TASK_LENGTH, type FocusMinutes } from '../../lib/stats/schema'
  import { stats } from '../../lib/stats/store.svelte'
  import { startSprint } from '../../lib/ui/session-ui.svelte'

  // Karte „Fokus-Sprint“ (Spec M9 §3.2 Punkt 4): ein freiwilliges Vorhaben, die Länge, der Hintergrund und „Sprint starten“.
  // Länge und Hintergrund öffnen mit dem, was zuletzt gewählt wurde (`settings.focus`, gemerkt beim Start); das Vorhaben
  // gilt nur für diesen Sprint und steht danach allein im gespeicherten Eintrag.
  const id = $props.id()

  const LENGTHS = FOCUS_MINUTES.map((value) => ({ value, label: `${value} Min` }))

  const saved = stats.data.settings.focus
  let task = $state('')
  let minutes = $state<FocusMinutes>(saved.minutes)
  let sound = $state<BackgroundId | null>(saved.sound)

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt. Ein zweiter, schneller Tipp trifft schon den Player, der
  // sich über die Karte legt (seine Knöpfe nehmen Tipps erst kurz nach dem Start an, siehe `tapArming`).
  function start() {
    startSprint(minutes, clipTask(task.trim()), sound)
  }
</script>

<section class="card sprint" aria-labelledby="{id}-title">
  <div class="head">
    <Motiv id={FOKUS_MOTIV} size={72} />
    <h2 id="{id}-title">Fokus-Sprint</h2>
  </div>

  <div class="field">
    <label for="{id}-task">Woran arbeitest du?</label>
    <input
      id="{id}-task"
      type="text"
      maxlength={MAX_TASK_LENGTH}
      autocomplete="off"
      autocapitalize="sentences"
      enterkeyhint="done"
      bind:value={task}
    />
  </div>

  <div class="field">
    <span class="label" aria-hidden="true">Dauer</span>
    <div class="lengths">
      <ChoiceGroup label="Dauer" options={LENGTHS} value={minutes} onSelect={(value) => (minutes = value)} />
    </div>
  </div>

  <div class="field">
    <span class="label" aria-hidden="true">Hintergrund</span>
    <SoundSelect label="Hintergrund" bind:value={sound} />
  </div>

  <button type="button" class="button start" onclick={start}>Sprint starten</button>
</section>

<style>
  .sprint {
    width: 100%;
  }

  /* Das Motiv links neben dem Titel; der Titel bricht notfalls um, das Motiv behält seine Fläche. */
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  label,
  .label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  input {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
  }

  /* Drei kurze Chips sollen auf Telefonbreite in eine Zeile passen, auch bei 130 % Schrift. „25 Min“ bricht nie in zwei
     Zeilen um: Wird es zu eng (noch größere Schrift), rutscht ein Chip in die nächste Zeile (wie beim Filter der Bibliothek). */
  .lengths {
    --choice-min: 0px;
    --choice-flex: 1 1 auto;
    --choice-padding: 6px;
    white-space: nowrap;
  }

  .start {
    width: 100%;
    margin-top: 4px;
  }
</style>
