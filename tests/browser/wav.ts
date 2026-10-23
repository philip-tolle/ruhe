// Testtöne für gestreamte Stimmen: ein Puffer als 16-Bit-PCM-WAV (mono) und ein fertiger Sinuston
// als Blob-Adresse, die ein <audio>-Element abspielen kann.

export function wav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0)
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)                     // PCM
  view.setUint16(22, 1, true)                     // mono
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 0x7fff), true))
  return new Blob([view.buffer], { type: 'audio/wav' })
}

// `seconds` lang ein Sinuston (Amplitude 0,5), gerendert und als WAV-Blob-Adresse.
export async function toneUrl(seconds: number, frequency = 440): Promise<string> {
  const rate = 22050
  const ctx = new OfflineAudioContext(1, Math.round(rate * seconds), rate)
  const osc = ctx.createOscillator()
  osc.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.value = 0.5
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  return URL.createObjectURL(wav(await ctx.startRendering()))
}
