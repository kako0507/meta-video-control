import { createUrlWatcher } from './url-watcher'
import { createVideoDetector } from './video-detector'
import { createVideoController, VideoController } from './video-controller'
import { createKeyboardHandler } from '../keyboard/keyboard-handler'
import { createMediaIndex } from './media-index'
import { createDownloadSource } from './download-source'

const mediaIndex = createMediaIndex()

let activeController: VideoController | null = null
let activeVideo: HTMLVideoElement | null = null

const stopKeyboard = createKeyboardHandler(() => activeVideo)

const detector = createVideoDetector(
  (video) => {
    activeController?.destroy()
    activeVideo = video
    activeController = createVideoController(video, createDownloadSource(video, mediaIndex))
  },
  (_video) => {
    activeController?.destroy()
    activeController = null
    activeVideo = null
  }
)

detector.scan()

createUrlWatcher(() => {
  activeController?.destroy()
  activeController = null
  activeVideo = null
  detector.reset()
  setTimeout(() => detector.scan(), 300)
})
