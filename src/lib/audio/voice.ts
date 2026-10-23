// Eine laufende Stimme: ein Klang als Web-Audio-Graph (z. B. eine Aufnahme in Schleife).
// `output` ist unverbunden; wer die Stimme nutzt, verbindet ihn selbst (z. B. mit dem Mixer).
export interface Voice {
  output: AudioNode
  // Beendet alle Quellen der Stimme zum Zeitpunkt `when` (AudioContext-Uhr).
  // Standard: sofort.
  stop(when?: number): void
  // Nur gestreamte Stimmen (Musik): Ihre Elemente laufen nicht mit der Audio-Uhr. `hold` hält an,
  // was gerade klingt, ohne es freizugeben; `resume` spielt es weiter.
  hold?(): void
  resume?(): Promise<void>
}

// Die Sprechstimme einer geführten Meditation.
export interface StreamedVoice {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
}

// Die Sprechstimme wird nicht dekodiert (zehn Minuten wären über 100 MB im Speicher), sondern von
// einem <audio>-Element gestreamt und über eine MediaElementAudioSourceNode ins Mischpult geführt.
// Das Element hängt nicht im DOM, `source` ist unverbunden. Je Sitzung ein neues Element: Jedes
// Element lässt sich nur einmal an einen AudioContext hängen.
export function createVoice(ctx: AudioContext, url: string): StreamedVoice {
  const element = new Audio()
  element.preload = 'auto'
  // Vor `src`: Aus dem Cache baut der Service Worker jede Range-Antwort (206) selbst, ohne Adresse.
  // Ohne CORS nimmt Chromium Daten nur von einer Herkunft an und lehnt schon die zweite davon ab;
  // eine gespeicherte lange Meditation bräche dann nach gut zwei Minuten ab. Die Datei liegt auf
  // derselben Herkunft, die MediaElementAudioSourceNode bleibt also hörbar.
  element.crossOrigin = 'anonymous'
  element.src = url
  return { element, source: ctx.createMediaElementSource(element) }
}
