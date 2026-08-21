export function createKeyboardHandler(getVideo: () => HTMLVideoElement | null): () => void {
  function handler(e: KeyboardEvent) {
    const video = getVideo()
    if (!video) return

    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) return

    switch (e.key) {
      case ' ':
        e.preventDefault()
        e.stopPropagation()
        if (video.paused) video.play()
        else video.pause()
        break
      case 'ArrowRight':
        e.preventDefault()
        e.stopPropagation()
        video.currentTime = Math.min(video.duration, video.currentTime + 5)
        break
      case 'ArrowLeft':
        e.preventDefault()
        e.stopPropagation()
        video.currentTime = Math.max(0, video.currentTime - 5)
        break
      case 'ArrowUp':
        e.preventDefault()
        e.stopPropagation()
        video.volume = Math.min(1, Math.round((video.volume + 0.1) * 10) / 10)
        break
      case 'ArrowDown':
        e.preventDefault()
        e.stopPropagation()
        video.volume = Math.max(0, Math.round((video.volume - 0.1) * 10) / 10)
        break
      case '.':
      case '>':
        e.preventDefault()
        e.stopPropagation()
        video.playbackRate = Math.min(4, Math.round((video.playbackRate + 0.25) * 100) / 100)
        break
      case ',':
      case '<':
        e.preventDefault()
        e.stopPropagation()
        video.playbackRate = Math.max(0.25, Math.round((video.playbackRate - 0.25) * 100) / 100)
        break
      case 'm':
      case 'M':
        e.preventDefault()
        e.stopPropagation()
        video.muted = !video.muted
        break
    }
  }

  document.addEventListener('keydown', handler, { capture: true })
  return () => document.removeEventListener('keydown', handler, { capture: true })
}
