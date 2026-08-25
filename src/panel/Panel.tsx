import { useReducer, useEffect, useCallback, useState } from 'react'
import SpeedPresets from './SpeedPresets'
import ProgressBar from './ProgressBar'
import PlayPause from './PlayPause'
import VolumeSlider from './VolumeSlider'
import DownloadButton from './DownloadButton'
import { videoReducer, createInitialState, VideoAction } from './store'
import { MediaDownload } from '../content/post-media'
import { SpeedValue, SPEED_PRESETS, PanelPosition, POSITION_STORAGE_KEY, DEFAULT_POSITION } from '../types'

export interface DownloadSource {
  current: () => MediaDownload | null
  subscribe: (listener: () => void) => () => void
}

interface Props {
  video: HTMLVideoElement
  downloads?: DownloadSource | null
}

function readPosition(): PanelPosition {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (raw) {
      const pos = JSON.parse(raw) as PanelPosition
      if (pos.x !== -1 && pos.y !== -1) return pos
    }
  } catch {}
  return { x: window.innerWidth - 260, y: window.innerHeight - 220 }
}

export default function Panel({ video, downloads = null }: Props) {
  const [state, dispatchRaw] = useReducer(videoReducer, video, createInitialState)

  // Harvesting is asynchronous, so a video can become downloadable after its
  // panel is already on screen. Follow the source rather than reading once.
  const [download, setDownload] = useState(() => downloads?.current() ?? null)

  useEffect(() => {
    if (!downloads) {
      setDownload(null)
      return
    }
    setDownload(downloads.current())
    return downloads.subscribe(() => setDownload(downloads.current()))
  }, [downloads])

  const dispatch = useCallback((action: VideoAction) => {
    switch (action.type) {
      case 'SET_SPEED':   video.playbackRate = action.payload; break
      case 'SEEK':        video.currentTime = action.payload; break
      case 'TOGGLE_PLAY': video.paused ? video.play() : video.pause(); break
      case 'SET_VOLUME':  video.volume = action.payload; video.muted = false; break
      case 'TOGGLE_MUTE': video.muted = !video.muted; break
    }
    dispatchRaw(action)
  }, [video])

  useEffect(() => {
    const sync = () => dispatch({
      type: 'SYNC',
      payload: {
        currentTime: video.currentTime,
        duration: isNaN(video.duration) ? 0 : (video.duration || 0),
        playing: !video.paused,
        volume: video.volume,
        muted: video.muted,
        playbackRate: video.playbackRate,
      },
    })
    video.addEventListener('timeupdate', sync)
    video.addEventListener('play', sync)
    video.addEventListener('pause', sync)
    video.addEventListener('volumechange', sync)
    video.addEventListener('loadedmetadata', sync)
    return () => {
      video.removeEventListener('timeupdate', sync)
      video.removeEventListener('play', sync)
      video.removeEventListener('pause', sync)
      video.removeEventListener('volumechange', sync)
      video.removeEventListener('loadedmetadata', sync)
    }
  }, [video, dispatch])

  const [pos, setPos] = useState<PanelPosition>(readPosition)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const newPos = {
        x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.y)),
      }
      setPos(newPos)
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(newPos))
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, dragOffset])

  const handleDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y })
  }

  const currentSpeed = SPEED_PRESETS.includes(state.playbackRate as SpeedValue)
    ? (state.playbackRate as SpeedValue)
    : 1

  return (
    <div
      className="ig-panel"
      style={{ position: 'fixed', left: pos.x, top: pos.y, pointerEvents: 'all' }}
    >
      <div className="drag-handle" onMouseDown={handleDragStart}>
        <span className="panel-label">▶ IG Control</span>
        <span className="drag-icon">⠿</span>
      </div>
      <SpeedPresets
        currentSpeed={currentSpeed}
        onSpeedChange={s => dispatch({ type: 'SET_SPEED', payload: s })}
      />
      <ProgressBar
        currentTime={state.currentTime}
        duration={state.duration}
        onSeek={t => dispatch({ type: 'SEEK', payload: t })}
      />
      <div className="bottom-row">
        <PlayPause
          playing={state.playing}
          onToggle={() => dispatch({ type: 'TOGGLE_PLAY' })}
        />
        <VolumeSlider
          volume={state.volume}
          muted={state.muted}
          onVolumeChange={v => dispatch({ type: 'SET_VOLUME', payload: v })}
          onMuteToggle={() => dispatch({ type: 'TOGGLE_MUTE' })}
        />
        {download && <DownloadButton url={download.url} filename={download.filename} />}
      </div>
    </div>
  )
}
