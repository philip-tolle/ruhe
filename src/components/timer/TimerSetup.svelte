<script lang="ts">
  import ChoiceGroup from '../ChoiceGroup.svelte'
  import Sheet from '../Sheet.svelte'
  import SoundSelect from '../SoundSelect.svelte'
  import Switch from '../Switch.svelte'
  import { audio } from '../../lib/audio/engine-store.svelte'
  import { timerProgram } from '../../lib/audio/program'
  import { clampMinutes, INTERVAL_OPTIONS, TIMER_PRESETS, type TimerSettings } from '../../lib/meditation/timer-plan'
  import { intervalLabel, savedTimer } from '../../lib/meditation/timer-view'
  import type { SoundId } from '../../lib/sounds/catalog'
  import { setLastUsed, stats, updateSettings } from '../../lib/stats/store.svelte'
  import { startSession } from '../../lib/ui/session-ui.svelte'

  let { onClose }: { onClose: () => void } = $props()

  type Duration = number | 'free'

  const DURATIONS: { value: Duration; label: string }[] = [
    ...TIMER_PRESETS.map((minutes) => ({ value: minutes, label: `${minutes} Min` })),
    { value: 'free', label: 'Frei' },
  ]
  const INTERVALS = INTERVAL_OPTIONS.map((value) => ({ value, label: intervalLabel(value) }))

  // Das Sheet öffnet mit den gemerkten Werten; Hintergrund und Vorlauf sind dieselben wie unter
  // „Ich“. Gemerkte Minuten, die keine Vorgabe sind, stehen unter „Frei“.
  const saved = savedTimer(stats.data.settings)

  let duration = $state<Duration>(TIMER_PRESETS.includes(saved.minutes) ? saved.minutes : 'free')
  let freeText = $state(String(saved.minutes))
  let intervalMin = $state(saved.intervalMin)
  let sound = $state<SoundId | null>(saved.sound)
  let lead = $state(saved.lead)
  let starting = $state(false)

  // Leer oder unlesbar ergibt über clampMinutes 10, sonst ganze Minuten von 1 bis 120.
  const freeMinutes = $derived(clampMinutes(parseFloat(freeText)))
  const minutes = $derived(duration === 'free' ? freeMinutes : duration)

  function selectDuration(value: Duration) {
    // „Frei“ beginnt bei der bisher gewählten Vorgabe.
    if (value === 'free' && duration !== 'free') freeText = String(duration)
    duration = value
  }

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt. Ein zweiter Tipp tut nichts.
  function start() {
    if (starting) return
    starting = true
    const settings: TimerSettings = { minutes, intervalMin, sound, lead }
    updateSettings({ timer: { minutes, intervalMin }, timerSound: sound, timerLead: lead })
    setLastUsed({ kind: 'timer', ...settings })
    startSession(timerProgram(settings))
  }

  // Sobald das Programm läuft, macht das Sheet über seinen eigenen Schließweg dem Player Platz.
  $effect(() => {
    const program = audio.snap.program
    if (starting && program !== null && !program.ended) onClose()
  })
</script>

<Sheet title="Meditations-Timer" {onClose}>
  <div class="field">
    <span class="label" aria-hidden="true">Dauer</span>
    <ChoiceGroup label="Dauer" options={DURATIONS} value={duration} onSelect={selectDuration} />
    {#if duration === 'free'}
      <div class="free">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          max="120"
          step="1"
          aria-label="Minuten"
          value={freeText}
          oninput={(event) => (freeText = event.currentTarget.value)}
          onchange={() => (freeText = String(freeMinutes))}
        />
        <span aria-hidden="true">Min</span>
      </div>
    {/if}
  </div>

  <div class="field">
    <span class="label" aria-hidden="true">Klangschale zwischendurch</span>
    <ChoiceGroup
      label="Klangschale zwischendurch"
      options={INTERVALS}
      value={intervalMin}
      onSelect={(value) => (intervalMin = value)}
    />
  </div>

  <div class="field">
    <span class="label" aria-hidden="true">Hintergrundklang</span>
    <SoundSelect label="Hintergrundklang" bind:value={sound} />
  </div>

  <Switch label="10 Sekunden ankommen" checked={lead} onToggle={() => (lead = !lead)} />

  <button type="button" class="button start" disabled={starting} onclick={start}>Starten</button>
</Sheet>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .free {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-muted);
    font-weight: 600;
  }

  input {
    width: 7rem;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .start {
    width: 100%;
    margin-top: 4px;
  }

  .start:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
