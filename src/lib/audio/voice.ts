// Eine laufende Stimme: ein live synthetisierter Klang als Web-Audio-Graph.
// `output` ist unverbunden; wer die Stimme nutzt, verbindet ihn selbst (z. B. mit dem Mixer).
export interface Voice {
  output: AudioNode
  // Beendet alle Quellen und LFOs der Stimme zum Zeitpunkt `when` (AudioContext-Uhr).
  // Standard: sofort.
  stop(when?: number): void
}
