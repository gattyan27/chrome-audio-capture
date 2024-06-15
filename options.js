function tabCapture() {
  return new Promise((resolve) => {
    chrome.tabCapture.capture(
      {
        audio: true,
        video: false,
      },
      (stream) => {
        resolve(stream)
      }
    )
  })
}

async function startRecord(option) {
  console.log("Start Record")
  const stream = await tabCapture()

  if (stream) {
    console.log("Stream", stream)
    stream.oninactive = () => {
      window.close()
    }

    const context = new AudioContext()
    await context.audioWorklet.addModule("recorder-processor.js")
    const mediaStream = context.createMediaStreamSource(stream)
    const recorder = new AudioWorkletNode(context, "recorder-processor", {
      processorOptions: { currentTabId: option.currentTabId },
    })

    // メッセージリスナーを追加
    recorder.port.onmessage = (event) => {
      const { type, data, tabId } = event.data
      if (type === "FROM_OPTION") {
        chrome.tabs.sendMessage(tabId, { type, data }, (res) => {
          console.log("Response from tab:", res)
        })
      }
    }

    // Prevent page mute
    mediaStream.connect(recorder)
    recorder.connect(context.destination)
    mediaStream.connect(context.destination)
  } else {
    window.close()
  }
}

// Receive data from Current Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request

  switch (type) {
    case "START_RECORD":
      startRecord(data)
      break
    default:
      break
  }

  sendResponse({})
})
