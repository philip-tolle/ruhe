<script lang="ts">
  import { onMount } from 'svelte'
  import { openLayer } from '../lib/ui/layers.svelte'

  let {
    title,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    title: string
    confirmLabel: string
    cancelLabel: string
    onConfirm: () => void
    onCancel: () => void
  } = $props()

  const titleId = $props.id()
  let cancelButton = $state<HTMLButtonElement>()

  // Der Dialog ist eine Ebene: Die Zurück-Geste gilt als Abbrechen. Beim Entfernen gibt die
  // zurückgegebene Funktion den History-Eintrag wieder frei (und tut nichts, wenn die Geste ihn nahm).
  // Der Aufruf über eine Funktion liest onCancel bei jedem Mal neu statt nur beim Einhängen.
  onMount(() => {
    cancelButton?.focus()
    return openLayer(() => onCancel())
  })

  // Der Fokus liegt im Dialog (zuerst auf „Abbrechen“), also genügt Escape hier;
  // so schließt bei gestapelten Ebenen nur die oberste.
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onCancel()
  }
</script>

<!-- Gehört an die Wurzel der App, nicht in einen animierten Bereich wie .screen (siehe Sheet).
     Über Sheet und Reiterleiste: Dialog 30. Ein Tippen neben den Dialog tut bewusst nichts. -->
<div class="layer">
  <div class="backdrop" aria-hidden="true"></div>
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabindex="-1" onkeydown={onKeydown}>
    <h2 id={titleId}>{title}</h2>
    <div class="actions">
      <button type="button" class="button secondary" bind:this={cancelButton} onclick={() => onCancel()}>
        {cancelLabel}
      </button>
      <button type="button" class="button" onclick={() => onConfirm()}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(env(safe-area-inset-top, 0px) + var(--gutter)) var(--gutter)
      calc(env(safe-area-inset-bottom, 0px) + var(--gutter));
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(5 8 24 / 0.72);
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 400px;
    max-height: 100%;
    padding: 28px 24px 24px;
    border: 1px solid var(--gold-line);
    border-radius: 28px;
    background: var(--sky-mid);
    box-shadow: 0 18px 48px rgb(5 8 24 / 0.5);
    overflow-y: auto;
    /* Klicks auf freie Flächen im Dialog holen den Fokus hierher, damit Escape weiter ankommt. */
    outline: none;
  }

  h2 {
    text-align: center;
  }

  /* Die Knöpfe teilen sich die Zeile und rutschen untereinander, wenn die Beschriftung nicht passt. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions .button {
    flex: 1 1 9rem;
    min-height: 52px;
    padding: 0 20px;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .backdrop {
      animation: backdrop-in 0.25s ease-out both;
    }

    .dialog {
      animation: dialog-in 0.3s ease-out both;
    }

    @keyframes backdrop-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes dialog-in {
      from {
        transform: translateY(12px) scale(0.97);
        opacity: 0;
      }
      to {
        transform: none;
        opacity: 1;
      }
    }
  }
</style>
