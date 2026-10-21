// Eine laufende Stimme: ein Klang als Web-Audio-Graph (z. B. eine Aufnahme in Schleife).
// `output` ist unverbunden; wer die Stimme nutzt, verbindet ihn selbst (z. B. mit dem Mixer).
export interface Voice {
  output: AudioNode
  // Beendet alle Quellen der Stimme zum Zeitpunkt `when` (AudioContext-Uhr).
  // Standard: sofort.
  stop(when?: number): void
}
