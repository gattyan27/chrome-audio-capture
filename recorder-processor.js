function to16BitPCM(input) {
  const dataLength = input.length * (16 / 8)
  const dataBuffer = new ArrayBuffer(dataLength)
  const dataView = new DataView(dataBuffer)
  let offset = 0
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return dataView
}

function to16kHz(audioData, sampleRate = 44100) {
  const data = new Float32Array(audioData)
  const fitCount = Math.round(data.length * (16000 / sampleRate))
  const newData = new Float32Array(fitCount)
  const springFactor = (data.length - 1) / (fitCount - 1)
  newData[0] = data[0]
  for (let i = 1; i < fitCount - 1; i++) {
    const tmp = i * springFactor
    const before = Math.floor(tmp)
    const after = Math.ceil(tmp)
    const atPoint = tmp - before
    newData[i] = data[before] + (data[after] - data[before]) * atPoint
  }
  newData[fitCount - 1] = data[data.length - 1]
  return newData
}

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.audioDataCache = []
    this.currentTabId = options.processorOptions.currentTabId
  }

  process(inputs) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputData = input[0]
      const output = to16kHz(inputData, sampleRate)
      const audioData = to16BitPCM(output)

      this.audioDataCache.push(...new Int8Array(audioData.buffer))

      if (this.audioDataCache.length > 1280) {
        const audioDataArray = new Int8Array(this.audioDataCache)

        // メインスレッドにメッセージを送信
        this.port.postMessage({
          type: "FROM_OPTION",
          data: audioDataArray.length,
          tabId: this.currentTabId,
        })

        this.audioDataCache.length = 0
      }
    }
    return true
  }
}

registerProcessor("recorder-processor", RecorderProcessor)
