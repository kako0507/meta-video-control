import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SpeedPresets from '../../../src/panel/SpeedPresets'
import { SPEED_PRESETS } from '../../../src/types'

describe('SpeedPresets', () => {
  it('renders all 5 speed buttons', () => {
    render(<SpeedPresets currentSpeed={1} onSpeedChange={vi.fn()} />)
    SPEED_PRESETS.forEach(s => {
      expect(screen.getByText(`${s}×`)).toBeInTheDocument()
    })
  })

  it('highlights the active speed button', () => {
    render(<SpeedPresets currentSpeed={1.5} onSpeedChange={vi.fn()} />)
    expect(screen.getByText('1.5×')).toHaveClass('active')
    expect(screen.getByText('1×')).not.toHaveClass('active')
  })

  it('calls onSpeedChange with correct value on click', async () => {
    const onSpeedChange = vi.fn()
    render(<SpeedPresets currentSpeed={1} onSpeedChange={onSpeedChange} />)
    await userEvent.click(screen.getByText('2×'))
    expect(onSpeedChange).toHaveBeenCalledWith(2)
  })
})
