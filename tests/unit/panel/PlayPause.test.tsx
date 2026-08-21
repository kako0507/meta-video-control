import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PlayPause from '../../../src/panel/PlayPause'

describe('PlayPause', () => {
  it('shows pause icon when playing', () => {
    render(<PlayPause playing={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('⏸')
  })

  it('shows play icon when paused', () => {
    render(<PlayPause playing={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('▶')
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<PlayPause playing={true} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
