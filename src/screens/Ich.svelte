<script lang="ts">
  import { onMount } from 'svelte'
  import BalanceSlider from '../components/BalanceSlider.svelte'
  import Calendar from '../components/Calendar.svelte'
  import Motiv from '../components/Motiv.svelte'
  import SoundSelect from '../components/SoundSelect.svelte'
  import Switch from '../components/Switch.svelte'
  import { offline, refreshSaved } from '../lib/offline/status.svelte'
  import { backupFileName, serializeBackup } from '../lib/stats/backup'
  import { importBackup, stats, updateSettings } from '../lib/stats/store.svelte'
  import { streak, totalMinutes } from '../lib/stats/summary'
  import { importMessage, offlineSummary, savedTotals, savingLabel, streakLabel } from '../lib/ui/ich-view'
  import { clearSaveMessage, meditationFiles, saveAllOffline, saveAllUi } from '../lib/ui/offline-ui.svelte'

  const sessions = $derived(stats.data.sessions)
  const settings = $derived(stats.data.settings)

  const figures = $derived([
    { label: 'Serie', value: streakLabel(streak(sessions, new Date())) },
    { label: 'Minuten gesamt', value: String(totalMinutes(sessions)) },
    { label: 'Sitzungen', value: String(sessions.length) },
  ])

  // Die Balance folgt dem Regler beim Ziehen; gespeichert wird beim Loslassen (wie im Player).
  let dragging = $state<number | null>(null)
  const balance = $derived(dragging ?? settings.voiceBalance)

  function saveBalance(value: number) {
    updateSettings({ voiceBalance: value })
    dragging = null
  }

  // Ein Ziehen, das dort endet, wo es begann, löst kein „change“ aus. Ändert sich der gespeicherte Wert
  // danach von außen (Import, Player), gilt er und nicht der Rest des Ziehens.
  $effect(() => {
    void settings.voiceBalance
    dragging = null
  })

  // Offline: Der Stand kommt aus dem Cache (wie in der Liste unter „Meditieren“).
  const files = meditationFiles()
  const saved = $derived(savedTotals(files, offline.saved))
  const canSave = $derived(offline.online && !saveAllUi.running && saved.count < files.length)

  // Eine Meldung nach „Alle offline speichern“ ist einmal zu sehen, auch wenn der Lauf endete, während
  // der Reiter nicht offen war: Sie verschwindet erst, wenn man ihn verlässt.
  onMount(() => {
    void refreshSaved(files.map((file) => file.url))
    return clearSaveMessage
  })

  let fileInput = $state<HTMLInputElement>()
  // Ergebnis des letzten Imports, als Meldung für Hilfstechnik und Anzeige.
  let result = $state('')

  // Die Datei entsteht im Tipp aus dem aktuellen Stand; der Link ist nur der Weg zum Download.
  function exportBackup() {
    const url = URL.createObjectURL(new Blob([serializeBackup(stats.data)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(new Date())
    document.body.append(link)
    link.click()
    link.remove()
    // Der Download hat die Adresse dann längst gelesen.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function onFile(event: Event & { currentTarget: HTMLInputElement }) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Leeren, damit sich dieselbe Datei nochmals wählen lässt.
    input.value = ''
    if (!file) return
    result = ''
    // Eine unlesbare Datei gilt wie eine ungültige: Der leere Text ergibt dieselbe Fehlermeldung.
    const text = await file.text().catch(() => '')
    const outcome = importBackup(text)
    result = 'error' in outcome ? outcome.error : importMessage(outcome.added)
  }
</script>

<section class="screen">
  <header class="with-motiv">
    <Motiv id="ich" size={56} />
    <h1>Ich</h1>
  </header>

  <dl class="figures">
    {#each figures as figure (figure.label)}
      <div class="figure">
        <dt>{figure.label}</dt>
        <dd>{figure.value}</dd>
      </div>
    {/each}
  </dl>

  <Calendar {sessions} />

  <!-- Über jeder Zeile steht eine feine Goldlinie, wie bei den Aktivitäten auf Heute. -->
  <div class="card">
    <h2>Einstellungen</h2>
    <div class="settings">
      <div class="setting">
        <Switch
          label="Vibration bei Atemübungen"
          checked={settings.vibration}
          onToggle={() => updateSettings({ vibration: !settings.vibration })}
        />
      </div>
      <div class="setting">
        <Switch
          label="Atemgeräusch bei Atemübungen"
          checked={settings.breathSound}
          onToggle={() => updateSettings({ breathSound: !settings.breathSound })}
        />
      </div>
      <div class="setting">
        <Switch
          label="10 Sekunden ankommen"
          checked={settings.timerLead}
          onToggle={() => updateSettings({ timerLead: !settings.timerLead })}
        />
      </div>
      <div class="setting field">
        <span class="label" aria-hidden="true">Hintergrundklang beim Timer</span>
        <SoundSelect
          label="Hintergrundklang beim Timer"
          bind:value={() => settings.timerSound, (timerSound) => updateSettings({ timerSound })}
        />
      </div>
      <div class="setting field">
        <span class="label" aria-hidden="true">Balance Stimme ↔ Hintergrund</span>
        <BalanceSlider value={balance} onInput={(value) => (dragging = value)} onChange={saveBalance} />
      </div>
    </div>
  </div>

  {#if stats.saveFailed}
    <p class="notice" role="alert">
      Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.
    </p>
  {/if}

  <div class="card">
    <h2>Offline</h2>
    <p class="hint">{offlineSummary(saved.count, files.length, saved.bytes)}</p>
    <button type="button" class="button" class:secondary={!canSave} disabled={!canSave} onclick={() => void saveAllOffline()}>
      Alle offline speichern
    </button>
    {#if saveAllUi.running}
      <div class="progress">
        <p id="save-progress">{savingLabel(saveAllUi.done, saveAllUi.total)}</p>
        <div
          class="bar"
          role="progressbar"
          aria-labelledby="save-progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={saveAllUi.percent}
        >
          <span style:width="{saveAllUi.percent}%"></span>
        </div>
      </div>
    {/if}
    <p class="result" role="status">{saveAllUi.message}</p>
  </div>

  <div class="card">
    <h2>Backup</h2>
    <p class="hint">
      Sichere deine Sitzungen und Einstellungen in einer Datei. Beim Importieren kommen neue Sitzungen dazu, die
      Einstellungen werden aus der Datei übernommen.
    </p>
    <div class="actions">
      <button type="button" class="button secondary" onclick={exportBackup}>Backup exportieren</button>
      <button type="button" class="button secondary" onclick={() => fileInput?.click()}>Backup importieren</button>
    </div>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    <p class="result" role="status">{result}</p>
  </div>
</section>

<style>
  /* Das Symbol steht links neben der Überschrift, in der Höhe mittig. Die Klasse sorgt dafür, dass es
     `.screen header` (app.css) sicher übertrifft. */
  header.with-motiv {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 0;
  }

  .figure {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    padding: 16px 8px;
    border: 1px solid var(--gold-line);
    border-radius: 24px;
    background: var(--surface);
    text-align: center;
  }

  dt {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
  }

  dd {
    margin: 0;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.5rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .card {
    align-items: stretch;
  }

  /* Einstellungszeilen: Schalter und Felder, durch Goldlinien getrennt (über jeder Zeile, auch der ersten). */
  .settings {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .setting {
    padding: 10px 0;
    border-top: 1px solid rgb(233 196 142 / 0.28);
  }

  .setting:last-child {
    padding-bottom: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label,
  .hint {
    color: var(--text-muted);
  }

  .label {
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .actions {
    display: grid;
    gap: 12px;
  }

  /* Nichts zu speichern oder ohne Netz: wie eine zurückgenommene Schaltfläche (.secondary), mit gedämpfter Schrift. */
  .button:disabled {
    color: var(--text-muted);
    cursor: default;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-border);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
  }

  /* Die Meldung bleibt im Dokument (sonst liest Hilfstechnik sie nicht vor); leer nimmt sie keinen Platz. */
  .result:empty {
    margin-top: -18px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar span {
      transition: width 0.3s ease;
    }
  }

  .notice {
    padding: 16px 20px;
    border: 1px solid var(--accent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
</style>
