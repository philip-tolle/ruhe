<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { openLayer } from '../lib/ui/layers.svelte'

  let { title, onClose, children }: { title: string; onClose: () => void; children: Snippet } = $props()

  const headingId = $props.id()
  let heading = $state<HTMLElement>()

  // Das Sheet ist eine Ebene: Die Zurück-Geste ruft onClose; beim Entfernen gibt die zurückgegebene
  // Funktion den History-Eintrag wieder frei (und tut nichts, wenn die Zurück-Geste ihn schon nahm).
  // Der Aufruf über eine Funktion liest onClose bei jedem Mal neu statt nur beim Einhängen.
  onMount(() => {
    heading?.focus()
    return openLayer(() => onClose())
  })

  // Der Fokus liegt im Sheet (Überschrift, Tippen auf die Fläche, Knöpfe), also genügt Escape hier;
  // so schließt bei gestapelten Ebenen nur die oberste.
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onClose()
  }
</script>

<!-- Gehört an die Wurzel der App, nicht in einen animierten Bereich wie .screen: Eine Transformation
     macht ihn zum Bezugsrahmen für `fixed`. Ebenen über der Reiterleiste (10): Sheet 20, Dialog 30. -->
<div class="layer">
  <!-- Tippen daneben schließt. Für Tastatur und Hilfstechnik gibt es Escape und die Zurück-Geste. -->
  <button type="button" class="backdrop" tabindex="-1" aria-hidden="true" onclick={() => onClose()}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={headingId} tabindex="-1" onkeydown={onKeydown}>
    <h2 id={headingId} tabindex="-1" bind:this={heading}>{title}</h2>
    <div class="body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }

  /* Dunkelt die App ab; die ganze Fläche hinter dem Sheet ist ein Knopf zum Schließen. */
  .backdrop {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: rgb(5 8 24 / 0.64);
    cursor: default;
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: var(--column-width);
    max-height: min(88dvh, 720px);
    padding: 12px var(--gutter) calc(env(safe-area-inset-bottom, 0px) + 28px);
    border: 1px solid var(--surface-border);
    border-bottom: 0;
    border-radius: 28px 28px 0 0;
    background: var(--sky-mid);
    box-shadow: 0 -18px 48px rgb(5 8 24 / 0.5);
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Klicks auf freie Flächen im Sheet holen den Fokus hierher, damit Escape weiter ankommt. */
    outline: none;
  }

  /* kleiner Griff als Zeichen für „Fläche von unten“ */
  .sheet::before {
    content: '';
    flex: none;
    align-self: center;
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: var(--surface-border);
  }

  /* schmal wie der Text, damit der Fokusring die Überschrift umschließt statt die ganze Zeile */
  h2 {
    align-self: flex-start;
    padding: 0 8px;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 0 8px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .backdrop {
      animation: backdrop-in 0.3s ease-out both;
    }

    .sheet {
      animation: sheet-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes backdrop-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes sheet-in {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
      to {
        transform: none;
        opacity: 1;
      }
    }
  }
</style>
