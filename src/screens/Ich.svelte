<script lang="ts">
  import Calendar from '../components/Calendar.svelte'
  import SoundSelect from '../components/SoundSelect.svelte'
  import Switch from '../components/Switch.svelte'
  import { backupFileName, serializeBackup } from '../lib/stats/backup'
  import { importBackup, stats, updateSettings } from '../lib/stats/store.svelte'
  import { streak, totalMinutes } from '../lib/stats/summary'
  import { importMessage, streakLabel } from '../lib/ui/ich-view'

  const sessions = $derived(stats.data.sessions)
  const settings = $derived(stats.data.settings)

  const figures = $derived([
    { label: 'Serie', value: streakLabel(streak(sessions, new Date())) },
    { label: 'Minuten gesamt', value: String(totalMinutes(sessions)) },
    { label: 'Sitzungen', value: String(sessions.length) },
  ])

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
  <header>
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

  <div class="card">
    <h2>Einstellungen</h2>
    <Switch
      label="Vibration bei Atemübungen"
      checked={settings.vibration}
      onToggle={() => updateSettings({ vibration: !settings.vibration })}
    />
    <Switch
      label="10 Sekunden ankommen"
      checked={settings.timerLead}
      onToggle={() => updateSettings({ timerLead: !settings.timerLead })}
    />
    <div class="field">
      <span class="label" aria-hidden="true">Standard-Hintergrundklang</span>
      <SoundSelect
        label="Standard-Hintergrundklang"
        bind:value={() => settings.timerSound, (timerSound) => updateSettings({ timerSound })}
      />
    </div>
  </div>

  {#if stats.saveFailed}
    <p class="notice" role="alert">
      Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.
    </p>
  {/if}

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
    border: 1px solid var(--surface-border);
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

  /* Die Meldung bleibt im Dokument (sonst liest Hilfstechnik sie nicht vor); leer nimmt sie keinen Platz. */
  .result:empty {
    margin-top: -18px;
  }

  .notice {
    padding: 16px 20px;
    border: 1px solid var(--accent);
    border-radius: 20px;
    background: rgb(242 201 138 / 0.12);
  }
</style>
