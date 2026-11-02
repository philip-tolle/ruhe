<script lang="ts">
  // Prüfstand für `WordPicker` (tests/browser/word-picker.test.ts): hält Wort und Prinzip als Zustand, wie es der Ablauf tut
  // (genau eine Wahl: ein Wort leert das Prinzip, ein Prinzip das Wort). Ohne `refs` bekommt die Komponente die neuen Props gar
  // nicht, damit der Test das bisherige Verhalten sieht.
  import WordPicker from '../../../src/components/flow/WordPicker.svelte'

  let { words, own = [], refs }: { words: readonly string[]; own?: readonly string[]; refs?: readonly { id: string; text: string }[] } = $props()

  let value = $state('')
  let refValue = $state<string | null>(null)

  export function current(): { value: string; refValue: string | null } {
    return { value, refValue }
  }
</script>

{#if refs !== undefined}
  <WordPicker
    label="Vorschläge"
    {words}
    ownLabel="Deine Wörter"
    {own}
    fieldLabel="Eigenes Wort"
    placeholder="oder eigenes Wort"
    max={40}
    capitalize="sentences"
    {value}
    onChange={(v) => {
      value = v
      refValue = null
    }}
    refLabel="Deine Prinzipien"
    {refs}
    {refValue}
    onRef={(id) => {
      refValue = id
      value = ''
    }}
  />
{:else}
  <WordPicker
    label="Vorschläge"
    {words}
    ownLabel="Deine Wörter"
    {own}
    fieldLabel="Eigenes Wort"
    placeholder="oder eigenes Wort"
    max={40}
    capitalize="sentences"
    {value}
    onChange={(v) => {
      value = v
      refValue = null
    }}
  />
{/if}
