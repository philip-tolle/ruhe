// Eine laufende Stimme: ein Klang als Web-Audio-Graph (z. B. eine Aufnahme in Schleife).
// `output` ist unverbunden; wer die Stimme nutzt, verbindet ihn selbst (z. B. mit dem Mixer).
export interface Voice {
  output: AudioNode
  // Beendet alle Quellen der Stimme zum Zeitpunkt `when` (AudioContext-Uhr).
  // Standard: sofort.
  stop(when?: number): void
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
  element.src = url
  return { element, source: ctx.createMediaElementSource(element) }
}
