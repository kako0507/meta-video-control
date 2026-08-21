import { useState, useCallback, useEffect, useRef } from 'react'

interface Props {
  volume: number
  muted: boolean
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
}

export default function VolumeSlider({ volume, muted, onVolumeChange, onMuteToggle }: Props) {
  const [dragging, setDragging] = useState(false)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const getPercentFromX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => setDragPercent(getPercentFromX(e.clientX))
    const onUp = (e: MouseEvent) => {
      onVolumeChange(getPercentFromX(e.clientX))
      setDragging(false)
      setDragPercent(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, onVolumeChange, getPercentFromX])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    setDragPercent(getPercentFromX(e.clientX))
  }

  const displayVolume = dragging && dragPercent !== null ? dragPercent : muted ? 0 : volume

  return (
    <div className="volume-wrapper">
      <button className="mute-btn" onClick={onMuteToggle}>
        {muted ? '🔇' : '🔊'}
      </button>
      <div ref={trackRef} className="volume-track" onMouseDown={handleMouseDown}>
        <div className="volume-fill" style={{ width: `${displayVolume * 100}%` }} />
        <div className="volume-thumb" style={{ left: `calc(${displayVolume * 100}% - 4.5px)` }} />
      </div>
    </div>
  )
}
