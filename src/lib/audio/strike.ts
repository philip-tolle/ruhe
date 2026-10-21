// Klangschale: ein Anschlag der Aufnahme, auf der Audio-Uhr eingeplant (`start(when)`), damit er
// auch bei gesperrtem Bildschirm pünktlich erklingt und sich mit einer Pause verschiebt.

export function scheduleStrike(ctx: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer, when: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(destination)
  source.start(when)
  return source
}
