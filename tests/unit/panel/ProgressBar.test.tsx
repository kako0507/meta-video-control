import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProgressBar from '../../../src/panel/ProgressBar'

describe('ProgressBar', () => {
  it('renders current time and duration as mm:ss', () => {
    render(<ProgressBar currentTime={65} duration={130} onSeek={vi.fn()} />)
    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.getByText('2:10')).toBeInTheDocument()
  })

  it('renders 0:00 / 0:00 when duration is 0', () => {
    render(<ProgressBar currentTime={0} duration={0} onSeek={vi.fn()} />)
    expect(screen.getAllByText('0:00')).toHaveLength(2)
  })

  it('fill width reflects progress percentage', () => {
    render(<ProgressBar currentTime={5} duration={10} onSeek={vi.fn()} />)
    const fill = document.querySelector('.progress-fill') as HTMLElement
    expect(fill.style.width).toBe('50%')
  })

  it('calls onSeek with proportional time on mousedown + mouseup', () => {
    const onSeek = vi.fn()
    render(<ProgressBar currentTime={0} duration={100} onSeek={onSeek} />)
    const track = document.querySelector('.progress-track') as HTMLElement
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 4 }),
    })
    fireEvent.mouseDown(track, { clientX: 50 })
    fireEvent.mouseUp(document, { clientX: 50 })
    expect(onSeek).toHaveBeenCalledWith(25)
  })
})
