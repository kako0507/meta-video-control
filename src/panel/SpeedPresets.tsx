import { SPEED_PRESETS, SpeedValue } from '../types'

interface Props {
  currentSpeed: SpeedValue
  onSpeedChange: (speed: SpeedValue) => void
}

export default function SpeedPresets({ currentSpeed, onSpeedChange }: Props) {
  return (
    <div className="speed-presets">
      {SPEED_PRESETS.map(speed => (
        <button
          key={speed}
          className={speed === currentSpeed ? 'speed-btn active' : 'speed-btn'}
          onClick={() => onSpeedChange(speed)}
        >
          {speed}×
        </button>
      ))}
    </div>
  )
}
