<script lang="ts">
  import { breathProgram } from '../lib/audio/program'
  import { greetingFor } from '../lib/time/greeting'
  import { setLastUsed, stats } from '../lib/stats/store.svelte'
  import { streak } from '../lib/stats/summary'
  import { lastUsedProgram, lastUsedSummary, streakLine } from '../lib/ui/heute-view'
  import { startSession } from '../lib/ui/session-ui.svelte'
  import type { TabId } from '../lib/ui/tabs'

  let { onNavigate }: { onNavigate: (tab: TabId) => void } = $props()

  const greeting = greetingFor(new Date())

  const days = $derived(streak(stats.data.sessions, new Date()))
  const lastUsed = $derived(stats.data.lastUsed)

  // Beide Starts im Tipp selbst, damit der Audio-Start als Nutzergeste gilt.
  // „Erneut starten“ ändert nichts am Gemerkten: Es ist ja schon die letzte Sitzung.
  function restart() {
    if (lastUsed) startSession(lastUsedProgram(lastUsed))
  }

  function breatheNow() {
    setLastUsed({ kind: 'breath', pattern: 'kohaerent', minutes: 3 })
    startSession(breathProgram('kohaerent', 3))
  }
</script>

<section class="screen">
  <header>
    <h1>{greeting}</h1>
    <p class="lead" class:streak={days > 0}>{streakLine(days)}</p>
  </header>

  {#if lastUsed}
    <div class="card">
      <h2>Zuletzt genutzt</h2>
      <p class="hint">{lastUsedSummary(lastUsed)}</p>
      <button type="button" class="button" onclick={restart}>Erneut starten</button>
    </div>
  {/if}

  <div class="card">
    <h2>3 Min durchatmen</h2>
    <p class="hint">Kohärentes Atmen</p>
    <button type="button" class="button" onclick={breatheNow}>Jetzt durchatmen</button>
  </div>

  <div class="card">
    <h2>Zur Ruhe kommen</h2>
    <p class="hint">Ein sanfter Klang hilft beim Ankommen.</p>
    <button type="button" class="button" onclick={() => onNavigate('klaenge')}>Zu den Klängen</button>
  </div>
</section>

<style>
  .hint {
    color: var(--text-muted);
  }

  /* Eine laufende Serie soll ins Auge fallen; ohne Serie bleibt es eine leise Einladung. */
  .streak {
    color: var(--accent);
    font-weight: 600;
  }
</style>
