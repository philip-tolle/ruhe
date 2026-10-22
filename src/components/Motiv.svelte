<script lang="ts">
  import { motivUrl, type MotivId } from '../lib/content/motive'

  // Ein gemaltes Motiv als Schmuck: Die Bedeutung trägt immer der Text daneben, deshalb `alt=""`.
  // Die Fläche hat feste Maße (Attribut und CSS), auch wenn das Bild ausfällt – das Layout springt nie.
  // Kein `loading="lazy"`: Die Dateien sind klein und im Precache; verzögertes Laden ließe sie beim
  // Wechsel der Reiter aufblitzen.
  let { id, size }: { id: MotivId; size: number } = $props()
</script>

<img class="motiv" src={motivUrl(id)} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" decoding="async" />

<style>
  .motiv {
    display: block;
    flex: none;
    object-fit: contain;
  }
</style>
