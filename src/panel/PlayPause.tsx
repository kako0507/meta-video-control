interface Props {
  playing: boolean
  onToggle: () => void
}

export default function PlayPause({ playing, onToggle }: Props) {
  return (
    <button className="play-pause-btn" onClick={onToggle}>
      {playing ? '⏸' : '▶'}
    </button>
  )
}
