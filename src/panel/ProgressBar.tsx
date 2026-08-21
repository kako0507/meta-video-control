import { useState, useCallback, useEffect, useRef } from 'react'

interface Props {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

function toMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ProgressBar({ currentTime, duration, onSeek }: Props) {
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubPercent, setScrubPercent] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const getPercentFromX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  useEffect(() => {
    if (!scrubbing) return
    const onMove = (e: MouseEvent) => setScrubPercent(getPercentFromX(e.clientX))
    const onUp = (e: MouseEvent) => {
      onSeek(getPercentFromX(e.clientX) * duration)
      setScrubbing(false)
      setScrubPercent(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [scrubbing, duration, onSeek, getPercentFromX])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setScrubbing(true)
    setScrubPercent(getPercentFromX(e.clientX))
  }

  const fillPercent = scrubbing && scrubPercent !== null
    ? scrubPercent * 100
    : duration > 0 ? (currentTime / duration) * 100 : 0

  const displayTime = scrubbing && scrubPercent !== null
    ? scrubPercent * duration
    : currentTime

  return (
    <div className="progress-wrapper">
      <span className="time">{toMMSS(displayTime)}</span>
      <div
        ref={trackRef}
        className="progress-track"
        onMouseDown={handleMouseDown}
      >
        <div className="progress-fill" style={{ width: `${fillPercent}%` }} />
        <div className="progress-thumb" style={{ left: `calc(${fillPercent}% - 6px)` }} />
      </div>
      <span className="time">{toMMSS(duration)}</span>
    </div>
  )
}
