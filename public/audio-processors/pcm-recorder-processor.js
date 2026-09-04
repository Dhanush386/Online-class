/**
 * AudioWorkletProcessor for high-performance real-time microphone capture.
 * Downsamples input audio to 16,000 Hz mono and converts float32 to 16-bit linear PCM.
 * Flushes ~100ms frames (1,600 samples) to the main thread with volume RMS metrics.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.targetSampleRate = 16000
    this.chunkSize = 1600 // ~100ms at 16kHz
    this.buffer = new Int16Array(this.chunkSize)
    this.bufferIndex = 0
    this.isRecording = true

    this.port.onmessage = (e) => {
      if (e.data?.command === 'stop') {
        this.flushRemaining()
        this.isRecording = false
      } else if (e.data?.command === 'start') {
        this.isRecording = true
        this.bufferIndex = 0
      }
    }
  }

  /**
   * Resample Float32 chunk to 16kHz and convert to 16-bit PCM
   */
  process(inputs) {
    if (!this.isRecording) return true

    const input = inputs[0]
    if (!input || !input[0] || input[0].length === 0) return true

    const channelData = input[0] // Mono channel
    const currentSampleRate = sampleRate // Global sampleRate inside AudioWorkletGlobalScope

    // Resample factor
    const ratio = currentSampleRate / this.targetSampleRate
    const inputLength = channelData.length
    const outputLength = Math.floor(inputLength / ratio)

    let sumSquares = 0

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = Math.floor(i * ratio)
      const sample = channelData[sourceIndex] || 0

      sumSquares += sample * sample

      // Clamp float between -1.0 and 1.0
      const clamped = Math.max(-1, Math.min(1, sample))
      // Scale to signed 16-bit integer
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF

      this.buffer[this.bufferIndex++] = int16

      // Flush when buffer reaches chunk size (~100ms)
      if (this.bufferIndex >= this.chunkSize) {
        const copy = new Int16Array(this.buffer)
        const rms = Math.sqrt(sumSquares / outputLength)
        this.port.postMessage(
          {
            type: 'audio-chunk',
            buffer: copy.buffer,
            volume: Math.min(100, Math.round(rms * 250))
          },
          [copy.buffer]
        )
        this.bufferIndex = 0
        sumSquares = 0
      }
    }

    return true
  }

  flushRemaining() {
    if (this.bufferIndex > 0) {
      const remaining = this.buffer.slice(0, this.bufferIndex)
      this.port.postMessage(
        {
          type: 'audio-chunk',
          buffer: remaining.buffer,
          volume: 0,
          isFinal: true
        },
        [remaining.buffer]
      )
      this.bufferIndex = 0
    }
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor)
