<script lang="ts">
  // Prüfstand für `TagPicker` (tests/browser/tag-picker.test.ts): hält die Auswahl als Zustand, wie es der Ablauf tut, damit
  // ein Tipp die Anzeige wirklich ändert.
  import TagPicker from '../../../src/components/evening/TagPicker.svelte'

  let { own = [], tags }: { own?: readonly string[]; tags: readonly string[] } = $props()

  let selected = $state<string[]>([])
</script>

<TagPicker {own} {tags} {selected} onChange={(next) => (selected = next)} />
