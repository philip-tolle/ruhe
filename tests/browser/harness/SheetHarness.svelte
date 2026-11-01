<script lang="ts">
  // Prüfstand für `Sheet` (tests/browser/sheet.test.ts): `rearm` hängt an einem Zustand, den der Test mit `next()` weiterzählt,
  // wie ein Blatt, das zwischen seinen Ansichten wechselt.
  import Sheet from '../../../src/components/Sheet.svelte'

  let { onClose }: { onClose: () => void } = $props()

  let phase = $state(0)

  export function next(): void {
    phase++
  }
</script>

<Sheet title="Test-Blatt" rearm={() => phase} {onClose}><p>Inhalt</p></Sheet>
