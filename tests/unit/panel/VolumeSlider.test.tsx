import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import VolumeSlider from '../../../src/panel/VolumeSlider'

describe('VolumeSlider', () => {
  it('renders muted icon when muted', () => {
    render(<VolumeSlider volume={0.7} muted={true} onVolumeChange={vi.fn()} onMuteToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('🔇')
  })

  it('renders speaker icon when not muted', () => {
    render(<VolumeSlider volume={0.7} muted={false} onVolumeChange={vi.fn()} onMuteToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('🔊')
  })

  it('calls onMuteToggle when icon is clicked', async () => {
    const onMuteToggle = vi.fn()
    render(<VolumeSlider volume={0.7} muted={false} onVolumeChange={vi.fn()} onMuteToggle={onMuteToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onMuteToggle).toHaveBeenCalledTimes(1)
  })

  it('volume fill reflects volume percentage', () => {
    render(<VolumeSlider volume={0.6} muted={false} onVolumeChange={vi.fn()} onMuteToggle={vi.fn()} />)
    const fill = document.querySelector('.volume-fill') as HTMLElement
    expect(fill.style.width).toBe('60%')
  })

  it('calls onVolumeChange on track drag', () => {
    const onVolumeChange = vi.fn()
    render(<VolumeSlider volume={0.5} muted={false} onVolumeChange={onVolumeChange} onMuteToggle={vi.fn()} />)
    const track = document.querySelector('.volume-track') as HTMLElement
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 100, top: 0, bottom: 3, right: 100, height: 3 }),
    })
    fireEvent.mouseDown(track, { clientX: 80 })
    fireEvent.mouseUp(document, { clientX: 80 })
    expect(onVolumeChange).toHaveBeenCalledWith(0.8)
  })
})
