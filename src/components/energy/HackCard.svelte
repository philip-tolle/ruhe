<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import Sheet from '../Sheet.svelte'
  import AreaChip from './AreaChip.svelte'
  import HackIcon from './HackIcon.svelte'
  import HackWhy from './HackWhy.svelte'
  import { areaMotiv } from '../../lib/content/motive'
  import { areaLine, linkTitle, startLabel } from '../../lib/energy/hack-view'
  import type { Hack } from '../../lib/energy/hacks'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { closeHackCard } from '../../lib/ui/energy-ui.svelte'
  import { startHack } from '../../lib/ui/session-ui.svelte'
  import type { TabId } from '../../lib/ui/tabs'

  // Hack-Karte (Spec M9 §3.4, Entwurf A) als Blatt von unten: Chip, Kopf „Brain Hack“, Titel, Nutzen und Motiv; „So geht’s“
  // mit den Schritten, „Warum es wirkt“, bei Bedarf Hinweis, „Passt dazu“ und „Weiterlesen“; unten „Starten“ und die Quelle.
  // Sie hängt an der Wurzel der App (App.svelte), solange `energyUi.hackCard` gilt, und lässt sich auch von den Kacheln
  // der Bibliothek und vom Jetzt-Reset öffnen. Zurück-Geste, Escape und Tippen daneben schließen sie (Sheet).
  let { hack, onNavigate }: { hack: Hack; onNavigate: (tab: TabId) => void } = $props()

  const id = $props.id()
  const exercise = $derived(linkTitle(hack))

  // Wer die Karte über „Starten“ des Jetzt-Resets öffnet, tippt dort ein zweites Mal an dieselbe Stelle: Der Tipp träfe
  // sonst ein Bedienelement des Blatts. „Passt dazu“ und „Starten“ nehmen darum erst nach kurzer Zeit Tipps an (siehe `tapArming`).
  const arming = tapArming()

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt: Die Karte schließt, der Player übernimmt ihre Ebene.
  // Die Kennung wird vor dem Schließen gelesen: `hack` ist eine Eigenschaft der Karte, und mit `closeHackCard()` ist
  // der Hack in App.svelte sofort `null`.
  function start() {
    const id = hack.id
    closeHackCard()
    startHack(id)
  }
</script>

<Sheet title="Brain Hack" kicker onClose={closeHackCard}>
  <div class="head">
    <div class="intro">
      <AreaChip area={hack.area} label={areaLine(hack)} />
      <h3 class="name">{hack.title}</h3>
    </div>
    <Motiv id={areaMotiv(hack.area)} size={96} />
  </div>
  <p class="benefit">{hack.benefit}</p>

  <!-- Der Sicherheitshinweis steht vor den Schritten, nicht hinter der Erklärung: Wer gleich „Starten“ tippt, hat ihn gesehen. -->
  {#if hack.caution}
    <div class="caution" role="note" aria-labelledby="{id}-caution">
      <h3 id="{id}-caution">Hinweis</h3>
      <p>{hack.caution}</p>
    </div>
  {/if}

  <section class="panel" aria-labelledby="{id}-steps">
    <h3 id="{id}-steps">So geht’s</h3>
    <ol class="steps">
      {#each hack.steps as step, i (i)}
        <li>
          <span class="badge"><HackIcon name={step.icon} size={30} /></span>
          <span class="step-text">
            <span class="step-title"><span aria-hidden="true">{i + 1} ·</span> {step.title}</span>
            <span class="step-detail">{step.detail}</span>
          </span>
        </li>
      {/each}
    </ol>
  </section>

  <section class="panel" aria-labelledby="{id}-why">
    <h3 id="{id}-why">Warum es wirkt</h3>
    <HackWhy {hack} />
  </section>

  {#if exercise}
    <button type="button" class="link" disabled={!arming.armed} onclick={() => onNavigate('atmen')}>
      <span>Passt dazu: Atemübung {exercise}</span>
      <svg class="chevron" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  {/if}

  {#if hack.further}
    <p class="further">Weiterlesen: {hack.further}</p>
  {/if}

  <!-- Bleibt beim Blättern am unteren Rand des Blatts stehen: „Starten“ ist auch auf einem kleinen Telefon ohne Blättern erreichbar. -->
  <div class="foot">
    <button type="button" class="button start" disabled={!arming.armed} onclick={start}>{startLabel(hack)}</button>
    <p class="source">Quelle: {hack.source}</p>
  </div>
</Sheet>

<style>
  /* Chip und Titel links, das Motiv des Bereichs rechts davon; der Nutzen läuft darunter über die ganze Breite. Lange
     Wörter brechen um, statt ins Motiv zu laufen. */
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .intro {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .name {
    font-size: clamp(1.375rem, 6vw, 1.75rem);
    line-height: 1.15;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .benefit {
    margin-top: -4px;
    color: var(--text-muted);
    line-height: 1.45;
  }

  /* Eine Fläche je Abschnitt, die Überschrift klein, fett und im Akzent (wie im Entwurf). */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 18px;
    border: 1px solid var(--surface-border);
    border-radius: 20px;
    background: var(--surface);
  }

  .panel h3,
  .caution h3 {
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0;
  }

  .panel h3 {
    color: var(--accent);
  }

  /* Der Hinweis fällt auf: Goldrand und dunkle Fläche, Überschrift in der Textfarbe. */
  .caution {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 18px;
    border: 1px solid var(--gold-line-strong);
    border-radius: 20px;
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--accent) 10%, var(--sky-mid));
  }

  .caution p {
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--accent) 14%, var(--sky-mid));
    color: var(--accent);
  }

  .step-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .step-title {
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .step-detail {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  /* „Passt dazu“: eine ganze Zeile als Knopf, Schrift im Akzent mit Pfeil. */
  .link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    padding: 8px 18px;
    border: 1px solid var(--surface-border);
    border-radius: 20px;
    background: var(--surface);
    color: var(--accent);
    font-weight: 600;
    line-height: 1.3;
    text-align: left;
  }

  .link span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .chevron {
    flex: none;
  }

  .further {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  /* Das Blatt hat unten 28 px (und den Sicherheitsabstand) Innenabstand, den `sticky` als Rand des Blatts abzieht: Ohne
     Ausgleich scrollte der Inhalt unter der Fußzeile durch diesen Streifen. Sie reicht darum um den Innenabstand tiefer
     (negativer Rand unten und `bottom`) und füllt ihn mit ihrem eigenen Innenabstand aus. */
  .foot {
    --room: calc(env(safe-area-inset-bottom, 0px) + 28px);
    position: sticky;
    bottom: calc(-1 * var(--room));
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: calc(-1 * var(--room));
    padding: 14px 0 var(--room);
    background: linear-gradient(to bottom, transparent, var(--sky-mid) 14px);
  }

  .start {
    width: 100%;
    min-height: 56px;
  }

  .source {
    color: var(--text-muted);
    font-size: 0.75rem;
    line-height: 1.4;
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
