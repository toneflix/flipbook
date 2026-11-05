let context: AudioContext | null = null

/**
 * A soft paper swish made from filtered noise, so no audio file is needed. Browsers only allow
 * audio after a user gesture, which a page turn always is.
 */
export function playPageTurn(volume = 0.18) {
  try {
    context ??= new AudioContext()

    const duration = 0.45
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < data.length; i++) {
      const t = i / data.length
      // Noise shaped into a quick rise and a long, uneven fall.
      const envelope = Math.sin(Math.PI * Math.min(1, t * 2.2)) * (1 - t) ** 1.5

      data[i] = (Math.random() * 2 - 1) * envelope * (0.6 + 0.4 * Math.sin(t * 40))
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()

    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = 2200
    filter.Q.value = 0.6
    gain.gain.value = volume
    source.connect(filter).connect(gain).connect(context.destination)
    source.start()
  } catch {
    // Audio isn't available; turning pages silently is fine.
  }
}
