import { render, act } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Panel from '../../../src/panel/Panel'

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const v = document.createElement('video') as HTMLVideoElement
  Object.defineProperty(v, 'duration', { value: 30, writable: true })
  Object.defineProperty(v, 'currentTime', { value: 0, writable: true })
  Object.defineProperty(v, 'paused', { value: true, writable: true })
  Object.defineProperty(v, 'volume', { value: 1, writable: true })
  Object.defineProperty(v, 'muted', { value: false, writable: true })
  Object.defineProperty(v, 'playbackRate', { value: 1, writable: true })
  v.play = vi.fn().mockResolvedValue(undefined)
  v.pause = vi.fn()
  Object.assign(v, overrides)
  return v
}

describe('Panel', () => {
  it('renders without crashing', () => {
    const video = makeVideo()
    const { container } = render(<Panel video={video} />)
    expect(container.querySelector('.ig-panel')).toBeInTheDocument()
  })

  it('dispatching SET_SPEED writes to video.playbackRate (Flux side effect)', async () => {
    const video = makeVideo()
    const { getByText } = render(<Panel video={video} />)
    await act(async () => { getByText('2×').click() })
    expect(video.playbackRate).toBe(2)
  })

  it('dispatching TOGGLE_PLAY calls video.play() when paused (Flux side effect)', async () => {
    const video = makeVideo()
    const { getByRole } = render(<Panel video={video} />)
    await act(async () => { getByRole('button', { name: /▶/ }).click() })
    expect(video.play).toHaveBeenCalled()
  })

  it('SYNC from timeupdate updates store state without writing back to video', () => {
    const video = makeVideo()
    render(<Panel video={video} />)
    act(() => {
      Object.defineProperty(video, 'currentTime', { value: 10, writable: true })
      video.dispatchEvent(new Event('timeupdate'))
    })
    expect(document.querySelector('.time')?.textContent).toBe('0:10')
  })

  it('dispatching TOGGLE_MUTE writes video.muted (Flux side effect)', async () => {
    const video = makeVideo()
    const { getByRole } = render(<Panel video={video} />)
    await act(async () => { getByRole('button', { name: /🔊/ }).click() })
    expect(video.muted).toBe(true)
  })

  describe('download control', () => {
    const download = { url: 'https://cdn.example/reel.mp4', filename: 'DcQ7XESu_Yy.mp4' }

    it('offers a download when one has been resolved for this reel', () => {
      const { getByLabelText } = render(<Panel video={makeVideo()} download={download} />)
      expect(getByLabelText(/download video/i)).toBeInTheDocument()
    })

    it('offers no download when none could be resolved', () => {
      const { queryByLabelText } = render(<Panel video={makeVideo()} download={null} />)
      expect(queryByLabelText(/download video/i)).not.toBeInTheDocument()
    })
  })
})
